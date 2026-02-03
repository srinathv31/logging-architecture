package com.eventlog.sdk.client;

import com.eventlog.sdk.exception.EventLogException;
import com.eventlog.sdk.model.EventLogEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Async Event Logger - Fire-and-forget event logging with resilience
 * 
 * <p>This is the recommended way to log events in production. Events are queued
 * and sent asynchronously so they never block your business logic.</p>
 * 
 * <h2>Features:</h2>
 * <ul>
 *   <li><b>Fire-and-forget</b> - {@code log()} returns immediately</li>
 *   <li><b>Automatic retry</b> - Failed events are retried with exponential backoff</li>
 *   <li><b>Circuit breaker</b> - Stops hammering API when it's down</li>
 *   <li><b>Graceful shutdown</b> - Flushes pending events on JVM shutdown</li>
 *   <li><b>Spillover to disk</b> - Optionally saves events to file when API is unreachable</li>
 * </ul>
 * 
 * <h2>Usage:</h2>
 * <pre>{@code
 * // Create once at application startup
 * AsyncEventLogger eventLog = AsyncEventLogger.builder()
 *     .client(eventLogClient)
 *     .build();
 * 
 * // In your business logic - fire and forget
 * eventLog.log(event);  // Returns immediately, never blocks
 * 
 * // At application shutdown (optional - shutdown hook handles this)
 * eventLog.shutdown();
 * }</pre>
 * 
 * <h2>Thread Safety:</h2>
 * <p>This class is fully thread-safe. A single instance should be shared
 * across your application.</p>
 */
public class AsyncEventLogger implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(AsyncEventLogger.class);

    private final EventLogClient client;
    private final BlockingQueue<QueuedEvent> queue;
    private final ExecutorService senderExecutor;
    private final ScheduledExecutorService retryExecutor;
    
    // Circuit breaker state
    private final AtomicBoolean circuitOpen = new AtomicBoolean(false);
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicLong circuitOpenedAt = new AtomicLong(0);
    private final int circuitBreakerThreshold;
    private final long circuitBreakerResetMs;
    
    // Configuration
    private final int maxRetries;
    private final long baseRetryDelayMs;
    private final long maxRetryDelayMs;
    private final Path spilloverPath;
    private final boolean spilloverEnabled;
    
    // Metrics
    private final AtomicLong eventsQueued = new AtomicLong(0);
    private final AtomicLong eventsSent = new AtomicLong(0);
    private final AtomicLong eventsFailed = new AtomicLong(0);
    private final AtomicLong eventsSpilled = new AtomicLong(0);
    
    // Shutdown handling
    private final AtomicBoolean shutdownRequested = new AtomicBoolean(false);
    private final CountDownLatch shutdownLatch = new CountDownLatch(1);
    private Thread shutdownHook;

    private AsyncEventLogger(Builder builder) {
        this.client = builder.client;
        this.queue = new LinkedBlockingQueue<>(builder.queueCapacity);
        this.maxRetries = builder.maxRetries;
        this.baseRetryDelayMs = builder.baseRetryDelayMs;
        this.maxRetryDelayMs = builder.maxRetryDelayMs;
        this.circuitBreakerThreshold = builder.circuitBreakerThreshold;
        this.circuitBreakerResetMs = builder.circuitBreakerResetMs;
        this.spilloverPath = builder.spilloverPath;
        this.spilloverEnabled = builder.spilloverPath != null;
        
        // Start sender thread
        this.senderExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "eventlog-sender");
            t.setDaemon(true);
            return t;
        });
        senderExecutor.submit(this::senderLoop);
        
        // Start retry scheduler
        this.retryExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "eventlog-retry");
            t.setDaemon(true);
            return t;
        });
        
        // Register shutdown hook
        if (builder.registerShutdownHook) {
            this.shutdownHook = new Thread(this::shutdownGracefully, "eventlog-shutdown");
            Runtime.getRuntime().addShutdownHook(shutdownHook);
        }
        
        log.info("AsyncEventLogger started - queue capacity: {}, spillover: {}", 
                builder.queueCapacity, spilloverEnabled ? spilloverPath : "disabled");
    }

    /**
     * Create a new builder
     */
    public static Builder builder() {
        return new Builder();
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Log an event asynchronously (fire-and-forget)
     * 
     * <p>This method returns immediately. The event is queued and sent
     * in the background. If the queue is full, the event is either
     * spilled to disk (if enabled) or dropped with a warning.</p>
     * 
     * @param event The event to log
     * @return true if queued successfully, false if dropped
     */
    public boolean log(EventLogEntry event) {
        if (shutdownRequested.get()) {
            log.warn("Cannot log event - shutdown in progress");
            return false;
        }
        
        QueuedEvent queued = new QueuedEvent(event, 0, Instant.now());
        
        if (queue.offer(queued)) {
            eventsQueued.incrementAndGet();
            return true;
        } else {
            // Queue full - try spillover or drop
            if (spilloverEnabled) {
                spillToDisk(queued);
                return true;
            } else {
                log.warn("Event queue full, dropping event: correlationId={}, processName={}", 
                        event.getCorrelationId(), event.getProcessName());
                eventsFailed.incrementAndGet();
                return false;
            }
        }
    }

    /**
     * Log multiple events asynchronously
     * 
     * @param events The events to log
     * @return Number of events successfully queued
     */
    public int log(List<EventLogEntry> events) {
        int queued = 0;
        for (EventLogEntry event : events) {
            if (log(event)) {
                queued++;
            }
        }
        return queued;
    }

    /**
     * Get current queue depth
     */
    public int getQueueDepth() {
        return queue.size();
    }

    /**
     * Check if circuit breaker is open (API considered unavailable)
     */
    public boolean isCircuitOpen() {
        return circuitOpen.get();
    }

    /**
     * Get logger metrics
     */
    public Metrics getMetrics() {
        return new Metrics(
                eventsQueued.get(),
                eventsSent.get(),
                eventsFailed.get(),
                eventsSpilled.get(),
                queue.size(),
                circuitOpen.get()
        );
    }

    /**
     * Flush all pending events synchronously (blocks until complete)
     * 
     * @param timeoutMs Maximum time to wait in milliseconds
     * @return true if all events were flushed, false if timeout
     */
    public boolean flush(long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        
        while (!queue.isEmpty() && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        
        return queue.isEmpty();
    }

    /**
     * Shutdown the logger gracefully, flushing pending events
     */
    public void shutdown() {
        shutdownGracefully();
    }

    @Override
    public void close() {
        shutdown();
    }

    // ========================================================================
    // Internal - Sender Loop
    // ========================================================================

    private void senderLoop() {
        log.debug("Event sender loop started");
        
        while (!shutdownRequested.get() || !queue.isEmpty()) {
            try {
                // Wait for event with timeout (allows checking shutdown flag)
                QueuedEvent queued = queue.poll(100, TimeUnit.MILLISECONDS);
                
                if (queued == null) {
                    continue;
                }
                
                // Check circuit breaker
                if (isCircuitOpen()) {
                    if (shouldResetCircuit()) {
                        resetCircuit();
                    } else {
                        // Re-queue with delay or spill
                        handleCircuitOpen(queued);
                        continue;
                    }
                }
                
                // Try to send
                try {
                    client.createEvent(queued.event);
                    onSuccess();
                    eventsSent.incrementAndGet();
                    
                    log.trace("Event sent: correlationId={}", queued.event.getCorrelationId());
                    
                } catch (EventLogException e) {
                    onFailure(queued, e);
                }
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.debug("Sender loop interrupted");
                break;
            } catch (Exception e) {
                log.error("Unexpected error in sender loop", e);
            }
        }
        
        log.debug("Event sender loop stopped");
        shutdownLatch.countDown();
    }

    private void onSuccess() {
        consecutiveFailures.set(0);
    }

    private void onFailure(QueuedEvent queued, EventLogException e) {
        int failures = consecutiveFailures.incrementAndGet();
        
        log.warn("Failed to send event (attempt {}): correlationId={}, status={}, error={}", 
                queued.attempts + 1, queued.event.getCorrelationId(), e.getStatusCode(), e.getMessage());
        
        // Check if we should open circuit
        if (failures >= circuitBreakerThreshold) {
            openCircuit();
        }
        
        // Retry or give up
        if (queued.attempts < maxRetries) {
            scheduleRetry(queued);
        } else {
            log.error("Event permanently failed after {} attempts: correlationId={}", 
                    maxRetries, queued.event.getCorrelationId());
            
            if (spilloverEnabled) {
                spillToDisk(queued);
            } else {
                eventsFailed.incrementAndGet();
            }
        }
    }

    private void scheduleRetry(QueuedEvent queued) {
        long delay = calculateRetryDelay(queued.attempts);
        
        retryExecutor.schedule(() -> {
            QueuedEvent retry = new QueuedEvent(queued.event, queued.attempts + 1, queued.firstAttempt);
            if (!queue.offer(retry)) {
                if (spilloverEnabled) {
                    spillToDisk(retry);
                } else {
                    eventsFailed.incrementAndGet();
                }
            }
        }, delay, TimeUnit.MILLISECONDS);
        
        log.debug("Scheduled retry in {}ms for correlationId={}", delay, queued.event.getCorrelationId());
    }

    private long calculateRetryDelay(int attempts) {
        // Exponential backoff with jitter
        long delay = baseRetryDelayMs * (1L << attempts);
        delay = Math.min(delay, maxRetryDelayMs);
        // Add jitter (±25%)
        delay = delay + (long) (delay * 0.25 * (Math.random() - 0.5));
        return delay;
    }

    // ========================================================================
    // Internal - Circuit Breaker
    // ========================================================================

    private void openCircuit() {
        if (circuitOpen.compareAndSet(false, true)) {
            circuitOpenedAt.set(System.currentTimeMillis());
            log.warn("Circuit breaker OPENED - API considered unavailable after {} consecutive failures", 
                    circuitBreakerThreshold);
        }
    }

    private boolean shouldResetCircuit() {
        return System.currentTimeMillis() - circuitOpenedAt.get() >= circuitBreakerResetMs;
    }

    private void resetCircuit() {
        circuitOpen.set(false);
        consecutiveFailures.set(0);
        log.info("Circuit breaker RESET - resuming normal operation");
    }

    private void handleCircuitOpen(QueuedEvent queued) {
        if (spilloverEnabled) {
            spillToDisk(queued);
        } else {
            // Re-queue with delay
            retryExecutor.schedule(() -> queue.offer(queued), 1000, TimeUnit.MILLISECONDS);
        }
    }

    // ========================================================================
    // Internal - Spillover
    // ========================================================================

    private void spillToDisk(QueuedEvent queued) {
        try {
            Path file = spilloverPath.resolve("eventlog-spill-" + 
                    Instant.now().toString().replace(":", "-") + ".json");
            
            // Simple JSON serialization (in production, use Jackson)
            String json = serializeEvent(queued.event);
            Files.writeString(file, json + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            
            eventsSpilled.incrementAndGet();
            log.debug("Event spilled to disk: {}", file);
            
        } catch (IOException e) {
            log.error("Failed to spill event to disk", e);
            eventsFailed.incrementAndGet();
        }
    }

    private String serializeEvent(EventLogEntry event) {
        // Simplified - in real implementation, use the ObjectMapper from client
        return String.format("{\"correlation_id\":\"%s\",\"process_name\":\"%s\",\"summary\":\"%s\",\"timestamp\":\"%s\"}",
                event.getCorrelationId(),
                event.getProcessName(),
                event.getSummary().replace("\"", "\\\""),
                event.getEventTimestamp());
    }

    // ========================================================================
    // Internal - Shutdown
    // ========================================================================

    private void shutdownGracefully() {
        if (!shutdownRequested.compareAndSet(false, true)) {
            return; // Already shutting down
        }
        
        log.info("AsyncEventLogger shutting down - {} events in queue", queue.size());
        
        // Wait for queue to drain (with timeout)
        try {
            boolean flushed = shutdownLatch.await(10, TimeUnit.SECONDS);
            if (!flushed) {
                log.warn("Shutdown timeout - {} events may be lost", queue.size());
                
                // Last resort: spill remaining to disk
                if (spilloverEnabled) {
                    QueuedEvent event;
                    while ((event = queue.poll()) != null) {
                        spillToDisk(event);
                    }
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Shutdown executors
        senderExecutor.shutdownNow();
        retryExecutor.shutdownNow();
        
        log.info("AsyncEventLogger shutdown complete - sent: {}, failed: {}, spilled: {}", 
                eventsSent.get(), eventsFailed.get(), eventsSpilled.get());
    }

    // ========================================================================
    // Supporting Classes
    // ========================================================================

    private static class QueuedEvent {
        final EventLogEntry event;
        final int attempts;
        final Instant firstAttempt;

        QueuedEvent(EventLogEntry event, int attempts, Instant firstAttempt) {
            this.event = event;
            this.attempts = attempts;
            this.firstAttempt = firstAttempt;
        }
    }

    /**
     * Metrics snapshot
     */
    public static class Metrics {
        public final long eventsQueued;
        public final long eventsSent;
        public final long eventsFailed;
        public final long eventsSpilled;
        public final int currentQueueDepth;
        public final boolean circuitOpen;

        Metrics(long eventsQueued, long eventsSent, long eventsFailed, 
                long eventsSpilled, int currentQueueDepth, boolean circuitOpen) {
            this.eventsQueued = eventsQueued;
            this.eventsSent = eventsSent;
            this.eventsFailed = eventsFailed;
            this.eventsSpilled = eventsSpilled;
            this.currentQueueDepth = currentQueueDepth;
            this.circuitOpen = circuitOpen;
        }

        @Override
        public String toString() {
            return String.format("Metrics{queued=%d, sent=%d, failed=%d, spilled=%d, depth=%d, circuitOpen=%s}",
                    eventsQueued, eventsSent, eventsFailed, eventsSpilled, currentQueueDepth, circuitOpen);
        }
    }

    // ========================================================================
    // Builder
    // ========================================================================

    public static class Builder {
        private EventLogClient client;
        private int queueCapacity = 10_000;
        private int maxRetries = 3;
        private long baseRetryDelayMs = 1000;
        private long maxRetryDelayMs = 30_000;
        private int circuitBreakerThreshold = 5;
        private long circuitBreakerResetMs = 30_000;
        private Path spilloverPath = null;
        private boolean registerShutdownHook = true;

        /**
         * Set the EventLogClient (required)
         */
        public Builder client(EventLogClient client) {
            this.client = client;
            return this;
        }

        /**
         * Set the maximum queue capacity (default: 10,000)
         */
        public Builder queueCapacity(int capacity) {
            this.queueCapacity = capacity;
            return this;
        }

        /**
         * Set max retry attempts per event (default: 3)
         */
        public Builder maxRetries(int maxRetries) {
            this.maxRetries = maxRetries;
            return this;
        }

        /**
         * Set base retry delay in milliseconds (default: 1000)
         * Actual delay uses exponential backoff with jitter
         */
        public Builder baseRetryDelayMs(long delayMs) {
            this.baseRetryDelayMs = delayMs;
            return this;
        }

        /**
         * Set maximum retry delay in milliseconds (default: 30000)
         */
        public Builder maxRetryDelayMs(long delayMs) {
            this.maxRetryDelayMs = delayMs;
            return this;
        }

        /**
         * Set consecutive failures before circuit opens (default: 5)
         */
        public Builder circuitBreakerThreshold(int threshold) {
            this.circuitBreakerThreshold = threshold;
            return this;
        }

        /**
         * Set time before circuit resets in milliseconds (default: 30000)
         */
        public Builder circuitBreakerResetMs(long resetMs) {
            this.circuitBreakerResetMs = resetMs;
            return this;
        }

        /**
         * Enable spillover to disk when queue is full or API is unreachable
         * Events are written as JSON to this directory
         */
        public Builder spilloverPath(Path path) {
            this.spilloverPath = path;
            return this;
        }

        /**
         * Enable/disable automatic shutdown hook (default: true)
         */
        public Builder registerShutdownHook(boolean register) {
            this.registerShutdownHook = register;
            return this;
        }

        public AsyncEventLogger build() {
            if (client == null) {
                throw new IllegalStateException("client is required");
            }
            return new AsyncEventLogger(this);
        }
    }
}
