package com.eventlog.sdk.client;

import com.eventlog.sdk.exception.EventLogException;
import com.eventlog.sdk.model.ApiResponses;
import com.eventlog.sdk.model.EventLogEntry;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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

    private static final String SPILL_FILE = "eventlog-spillover.jsonl";
    private static final String REPLAY_FILE = "eventlog-spillover.replay.jsonl";

    private static final EventLossCallback DEFAULT_LOSS_CALLBACK = (event, reason) ->
            log.warn("Event lost ({}): correlationId={}, processName={}",
                    reason, event.getCorrelationId(), event.getProcessName());

    private final EventLogClient client;
    private final EventLossCallback eventLossCallback;
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
    private final int batchSize;
    private final long maxBatchWaitMs;
    private final int senderThreads;
    private final Path spilloverPath;
    private final boolean spilloverEnabled;
    private final BlockingQueue<QueuedEvent> spilloverQueue;
    private final ExecutorService spilloverExecutor;
    private final ObjectMapper spilloverObjectMapper;

    // Replay
    private final long replayIntervalMs;
    private final ScheduledExecutorService replayExecutor;
    private final int maxSpilloverEvents;
    private final long maxSpilloverSizeBytes;
    private final AtomicInteger spilloverEventCount = new AtomicInteger(0);
    private final AtomicLong spilloverFileSize = new AtomicLong(0);
    private final Object spillReplayLock = new Object();

    // Metrics
    private final AtomicLong eventsQueued = new AtomicLong(0);
    private final AtomicLong eventsSent = new AtomicLong(0);
    private final AtomicLong eventsFailed = new AtomicLong(0);
    private final AtomicLong eventsSpilled = new AtomicLong(0);
    private final AtomicLong eventsReplayed = new AtomicLong(0);
    
    // Pending retry tracking (CAS gate for shutdown-retry race)
    private final Set<QueuedEvent> pendingRetryEvents = ConcurrentHashMap.newKeySet();

    // Shutdown handling
    private final AtomicBoolean shutdownRequested = new AtomicBoolean(false);
    private final CountDownLatch shutdownLatch;
    private Thread shutdownHook;

    private AsyncEventLogger(Builder builder) {
        this(builder, true);
    }

    protected AsyncEventLogger(Builder builder, boolean startBackground) {
        this.client = builder.client;
        this.eventLossCallback = builder.eventLossCallback != null ? builder.eventLossCallback : DEFAULT_LOSS_CALLBACK;
        this.queue = new LinkedBlockingQueue<>(builder.queueCapacity);
        this.maxRetries = builder.maxRetries;
        this.baseRetryDelayMs = builder.baseRetryDelayMs;
        this.maxRetryDelayMs = builder.maxRetryDelayMs;
        this.circuitBreakerThreshold = builder.circuitBreakerThreshold;
        this.circuitBreakerResetMs = builder.circuitBreakerResetMs;
        this.batchSize = builder.batchSize;
        this.maxBatchWaitMs = builder.maxBatchWaitMs;
        this.senderThreads = builder.senderThreads;
        this.shutdownLatch = new CountDownLatch(builder.senderThreads);
        this.spilloverPath = builder.spilloverPath;
        this.spilloverEnabled = builder.spilloverPath != null;
        if (this.spilloverEnabled) {
            try {
                Files.createDirectories(this.spilloverPath);
            } catch (IOException e) {
                throw new UncheckedIOException(
                    "Failed to create spillover directory: " + this.spilloverPath, e);
            }
        }
        this.spilloverQueue = spilloverEnabled
                ? new LinkedBlockingQueue<>(builder.queueCapacity)
                : null;
        this.spilloverExecutor = spilloverEnabled
                ? (builder.spilloverExecutor != null
                    ? builder.spilloverExecutor
                    : Executors.newSingleThreadExecutor(builder.virtualThreads
                        ? Thread.ofVirtual().name("eventlog-spillover").factory()
                        : r -> {
                            Thread t = new Thread(r, "eventlog-spillover");
                            t.setDaemon(true);
                            return t;
                        }))
                : null;
        this.replayIntervalMs = builder.replayIntervalMs;
        this.maxSpilloverEvents = builder.maxSpilloverEvents;
        this.maxSpilloverSizeBytes = builder.maxSpilloverSizeBytes;
        this.spilloverObjectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        // Initialize spillover counters from existing file
        if (this.spilloverEnabled) {
            Path activeFile = this.spilloverPath.resolve(SPILL_FILE);
            try {
                if (Files.exists(activeFile)) {
                    List<String> existingLines = Files.readAllLines(activeFile);
                    int count = 0;
                    for (String line : existingLines) {
                        if (!line.isBlank()) {
                            count++;
                        }
                    }
                    this.spilloverEventCount.set(count);
                    this.spilloverFileSize.set(Files.size(activeFile));
                }
            } catch (IOException e) {
                log.warn("Could not read existing spillover file for counter init: {}", e.getMessage());
            }
        }

        // Create replay executor
        this.replayExecutor = spilloverEnabled
                ? Executors.newSingleThreadScheduledExecutor(builder.virtualThreads
                    ? Thread.ofVirtual().name("eventlog-replay").factory()
                    : r -> {
                        Thread t = new Thread(r, "eventlog-replay");
                        t.setDaemon(true);
                        return t;
                    })
                : null;

        // Start sender thread(s)
        this.senderExecutor = builder.senderExecutor != null
                ? builder.senderExecutor
                : (this.senderThreads > 1
                    ? Executors.newFixedThreadPool(this.senderThreads, builder.virtualThreads
                        ? Thread.ofVirtual().name("eventlog-sender-", 0).factory()
                        : new ThreadFactory() {
                            private final AtomicInteger idx = new AtomicInteger(0);
                            @Override public Thread newThread(Runnable r) {
                                Thread t = new Thread(r, "eventlog-sender-" + idx.getAndIncrement());
                                t.setDaemon(true);
                                return t;
                            }
                        })
                    : Executors.newSingleThreadExecutor(builder.virtualThreads
                        ? Thread.ofVirtual().name("eventlog-sender").factory()
                        : r -> {
                            Thread t = new Thread(r, "eventlog-sender");
                            t.setDaemon(true);
                            return t;
                        }));
        if (startBackground) {
            for (int i = 0; i < this.senderThreads; i++) {
                senderExecutor.submit(this::senderLoop);
            }
        }
        
        // Start retry scheduler
        this.retryExecutor = builder.retryExecutor != null
                ? builder.retryExecutor
                : Executors.newSingleThreadScheduledExecutor(builder.virtualThreads
                    ? Thread.ofVirtual().name("eventlog-retry").factory()
                    : r -> {
                        Thread t = new Thread(r, "eventlog-retry");
                        t.setDaemon(true);
                        return t;
                    });

        if (startBackground && spilloverExecutor != null) {
            spilloverExecutor.submit(this::spilloverLoop);
        }
        if (startBackground && replayExecutor != null) {
            replayExecutor.scheduleWithFixedDelay(this::replayLoop,
                    replayIntervalMs, replayIntervalMs, TimeUnit.MILLISECONDS);
        }

        // Register shutdown hook
        if (startBackground && builder.registerShutdownHook) {
            this.shutdownHook = new Thread(this::shutdownGracefully, "eventlog-shutdown");
            Runtime.getRuntime().addShutdownHook(shutdownHook);
        }
        
        if (startBackground) {
            log.info("AsyncEventLogger started - queue capacity: {}, spillover: {}, replay interval: {}ms",
                    builder.queueCapacity, spilloverEnabled ? spilloverPath : "disabled",
                    spilloverEnabled ? replayIntervalMs : "N/A");
        }
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
            notifyEventLoss(event, "shutdown_in_progress");
            return false;
        }
        
        QueuedEvent queued = new QueuedEvent(event, 0, Instant.now());
        
        if (queue.offer(queued)) {
            eventsQueued.incrementAndGet();
            return true;
        }

        // Queue full - try spillover or drop
        if (spilloverEnabled) {
            return enqueueSpillover(queued);
        }

        notifyEventLoss(event, "queue_full");
        eventsFailed.incrementAndGet();
        return false;
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
                eventsReplayed.get(),
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
        List<QueuedEvent> batch = new ArrayList<>(batchSize);

        while (!shutdownRequested.get() || !queue.isEmpty()) {
            try {
                batch.clear();
                queue.drainTo(batch, batchSize);

                if (batch.isEmpty()) {
                    QueuedEvent first = queue.poll(maxBatchWaitMs, TimeUnit.MILLISECONDS);
                    if (first == null) {
                        continue;
                    }
                    batch.add(first);
                    if (batchSize > 1) {
                        queue.drainTo(batch, batchSize - 1);
                    }
                }

                // Check circuit breaker for the batch
                if (isCircuitOpen()) {
                    if (shouldResetCircuit()) {
                        resetCircuit();
                    } else {
                        for (QueuedEvent q : batch) {
                            handleCircuitOpen(q);
                        }
                        continue;
                    }
                }

                // Send
                if (batch.size() == 1 || batchSize == 1) {
                    for (QueuedEvent q : batch) {
                        sendSingle(q);
                    }
                } else {
                    sendBatch(batch);
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

    private void sendSingle(QueuedEvent queued) {
        try {
            client.createEventDirect(queued.event);
            onSuccess();
            eventsSent.incrementAndGet();
            log.trace("Event sent: correlationId={}", queued.event.getCorrelationId());
        } catch (EventLogException e) {
            onFailure(queued, e);
        }
    }

    private void sendBatch(List<QueuedEvent> batch) {
        try {
            List<EventLogEntry> events = new ArrayList<>(batch.size());
            for (QueuedEvent q : batch) {
                events.add(q.event);
            }
            ApiResponses.BatchCreateEventResponse response = client.createEventsDirect(events);
            onSuccess();

            List<ApiResponses.BatchError> errors = response.getErrors();
            if (errors == null || errors.isEmpty()) {
                eventsSent.addAndGet(batch.size());
                log.trace("Batch of {} events sent", batch.size());
            } else {
                // Partial failure — retry only the failed items
                Set<Integer> failedIndices = new HashSet<>();
                for (ApiResponses.BatchError err : errors) {
                    failedIndices.add(err.getIndex());
                }
                int succeeded = batch.size() - failedIndices.size();
                eventsSent.addAndGet(succeeded);
                for (int i = 0; i < batch.size(); i++) {
                    if (failedIndices.contains(i)) {
                        onFailure(batch.get(i),
                                new EventLogException("Batch partial failure", 0, errors.toString()));
                    }
                }
            }
        } catch (EventLogException e) {
            // Full failure — retry each individually
            for (QueuedEvent q : batch) {
                onFailure(q, e);
            }
        }
    }

    private void onSuccess() {
        consecutiveFailures.set(0);
    }

    private void onFailure(QueuedEvent queued, EventLogException e) {
        int failures = consecutiveFailures.incrementAndGet();
        
        log.warn("Failed to send event (attempt {}): correlationId={}, status={}, error={}, cause={}",
                queued.attempts + 1, queued.event.getCorrelationId(), e.getStatusCode(),
                e.getMessage(), getRootCauseMessage(e));
        
        // Check if we should open circuit
        if (failures >= circuitBreakerThreshold) {
            openCircuit();
        }
        
        // Retry or give up
        if (queued.attempts < maxRetries) {
            scheduleRetry(queued);
            return;
        }

        log.error("Event permanently failed after {} attempts: correlationId={}",
                maxRetries, queued.event.getCorrelationId());

        if (spilloverEnabled) {
            enqueueSpillover(queued);
        } else {
            notifyEventLoss(queued.event, "retries_exhausted");
            eventsFailed.incrementAndGet();
        }
    }

    private void scheduleRetry(QueuedEvent queued) {
        long delay = calculateRetryDelay(queued.attempts);
        QueuedEvent retry = new QueuedEvent(queued.event, queued.attempts + 1, queued.firstAttempt);
        pendingRetryEvents.add(retry);

        try {
            retryExecutor.schedule(() -> {
                if (!pendingRetryEvents.remove(retry)) return;
                if (queue.offer(retry)) return;

                if (spilloverEnabled) {
                    enqueueSpillover(retry);
                } else {
                    notifyEventLoss(retry.event, "retry_requeue_failed");
                    eventsFailed.incrementAndGet();
                }
            }, delay, TimeUnit.MILLISECONDS);
        } catch (RejectedExecutionException e) {
            pendingRetryEvents.remove(retry);
            if (spilloverEnabled) {
                enqueueSpillover(retry);
            } else {
                notifyEventLoss(retry.event, "retry_executor_rejected");
                eventsFailed.incrementAndGet();
            }
        }

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
            enqueueSpillover(queued);
        } else {
            // Re-queue with delay
            retryExecutor.schedule(() -> queue.offer(queued), 1000, TimeUnit.MILLISECONDS);
        }
    }

    // ========================================================================
    // Internal - Spillover
    // ========================================================================

    private boolean enqueueSpillover(QueuedEvent queued) {
        if (!spilloverEnabled || spilloverQueue == null) {
            eventsFailed.incrementAndGet();
            return false;
        }

        boolean queuedForSpillover = spilloverQueue.offer(queued);
        if (!queuedForSpillover) {
            notifyEventLoss(queued.event, "spillover_queue_full");
            eventsFailed.incrementAndGet();
        }
        return queuedForSpillover;
    }

    private void spilloverLoop() {
        log.debug("Spillover loop started");
        while (!shutdownRequested.get() || !spilloverQueue.isEmpty()) {
            try {
                QueuedEvent queued = spilloverQueue.poll(100, TimeUnit.MILLISECONDS);
                if (queued == null) {
                    continue;
                }
                spillToDisk(queued);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("Unexpected error in spillover loop", e);
            }
        }
        log.debug("Spillover loop stopped");
    }

    private void spillToDisk(QueuedEvent queued) {
        try {
            Path file = spilloverPath.resolve(SPILL_FILE);
            String json = serializeEvent(queued.event);
            byte[] payload = (json + "\n").getBytes(StandardCharsets.UTF_8);
            long lineBytes = payload.length;

            synchronized (spillReplayLock) {
                if (spilloverEventCount.get() >= maxSpilloverEvents) {
                    notifyEventLoss(queued.event, "spillover_max_events");
                    eventsFailed.incrementAndGet();
                    return;
                }
                if (spilloverFileSize.get() + lineBytes > maxSpilloverSizeBytes) {
                    notifyEventLoss(queued.event, "spillover_max_size");
                    eventsFailed.incrementAndGet();
                    return;
                }

                Files.write(file, payload, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
                spilloverEventCount.incrementAndGet();
                spilloverFileSize.addAndGet(lineBytes);
            }
            eventsSpilled.incrementAndGet();
        } catch (IOException e) {
            log.error("Failed to spill event to disk", e);
            eventsFailed.incrementAndGet();
        }
    }

    private void replayLoop() {
        if (circuitOpen.get()) {
            if (shouldResetCircuit()) {
                resetCircuit();
            } else {
                return;
            }
        }

        Path replayFile = spilloverPath.resolve(REPLAY_FILE);
        Path activeFile = spilloverPath.resolve(SPILL_FILE);

        // Step 1: If no replay file, rotate the active file
        synchronized (spillReplayLock) {
            if (!Files.exists(replayFile)) {
                try {
                    if (!Files.exists(activeFile) || Files.size(activeFile) == 0) return;
                    moveActiveToReplay(activeFile, replayFile);
                    spilloverEventCount.set(0);
                    spilloverFileSize.set(0);
                } catch (IOException e) {
                    log.warn("Failed to rotate spillover file for replay: {}", e.getMessage());
                    return;
                }
            }
        }

        // Step 2: Read all lines
        List<String> lines;
        try {
            lines = Files.readAllLines(replayFile);
        } catch (IOException e) {
            log.warn("Failed to read replay file: {}", e.getMessage());
            return;
        }
        if (lines.isEmpty()) {
            synchronized (spillReplayLock) {
                try {
                    Files.deleteIfExists(replayFile);
                } catch (IOException ignored) {}
            }
            return;
        }

        // Step 3: Replay line by line
        int sent = 0;
        for (String line : lines) {
            if (shutdownRequested.get() || circuitOpen.get()) break;
            if (line.isBlank()) { sent++; continue; }
            try {
                EventLogEntry event = spilloverObjectMapper.readValue(line, EventLogEntry.class);
                client.createEventDirect(event);
                eventsReplayed.incrementAndGet();
                sent++;
            } catch (IOException e) {
                log.warn("Skipping corrupt spillover line: {}", e.getMessage());
                sent++; // skip corrupt line
            } catch (Exception e) {
                log.warn("Replay send failed, pausing: {} (cause: {})",
                        e.getMessage(), getRootCauseMessage(e), e);
                break; // stop on API failure
            }
        }

        // Step 4: Rewrite remaining or delete
        synchronized (spillReplayLock) {
            try {
                if (!Files.exists(replayFile)) {
                    return;
                }
                if (sent >= lines.size()) {
                    Files.deleteIfExists(replayFile);
                } else {
                    List<String> remaining = lines.subList(sent, lines.size());
                    rewriteReplayFile(replayFile, remaining);
                }
            } catch (IOException e) {
                log.warn("Failed to update replay file: {}", e.getMessage());
            }
        }
    }

    protected void moveActiveToReplay(Path activeFile, Path replayFile) throws IOException {
        try {
            moveFileAtomic(activeFile, replayFile);
        } catch (AtomicMoveNotSupportedException e) {
            moveFileReplace(activeFile, replayFile);
        }
    }

    protected void moveFileAtomic(Path source, Path target) throws IOException {
        Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
    }

    protected void moveFileReplace(Path source, Path target) throws IOException {
        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
    }

    private void rewriteReplayFile(Path replayFile, List<String> remaining) throws IOException {
        Path tempFile = replayFile.resolveSibling(REPLAY_FILE + ".tmp");
        String payload = String.join("\n", remaining) + "\n";
        Files.writeString(tempFile, payload, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        try {
            Files.move(tempFile, replayFile, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(tempFile, replayFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            try {
                Files.deleteIfExists(tempFile);
            } catch (IOException ignored) {
                // best effort cleanup
            }
            throw e;
        }
    }

    private String serializeEvent(EventLogEntry event) throws IOException {
        return spilloverObjectMapper.writeValueAsString(event);
    }

    private static String getRootCauseMessage(Throwable t) {
        Throwable root = t;
        while (root.getCause() != null) root = root.getCause();
        return root.getClass().getSimpleName() + ": " + root.getMessage();
    }

    private void notifyEventLoss(EventLogEntry event, String reason) {
        try {
            eventLossCallback.onEventLoss(event, reason);
        } catch (Exception e) {
            log.warn("EventLossCallback threw for reason={}: {}", reason, e.getMessage());
        }
    }

    // ========================================================================
    // Internal - Shutdown
    // ========================================================================

    private void shutdownGracefully() {
        if (!shutdownRequested.compareAndSet(false, true)) {
            return; // Already shutting down
        }

        if (shutdownHook != null) {
            try {
                Runtime.getRuntime().removeShutdownHook(shutdownHook);
            } catch (IllegalStateException e) {
                // JVM is already shutting down — hook cannot be removed, which is fine
            }
        }

        log.info("AsyncEventLogger shutting down - {} events in queue", queue.size());

        // Cancel pending retries immediately — don't rely on them firing
        retryExecutor.shutdownNow();

        // Wait for sender to drain current queue
        try {
            boolean flushed = shutdownLatch.await(10, TimeUnit.SECONDS);
            if (!flushed) {
                log.warn("Shutdown timeout - {} events may be lost", queue.size());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Claim any events still in pending retries (cancelled tasks)
        for (QueuedEvent pending : pendingRetryEvents) {
            if (!pendingRetryEvents.remove(pending)) continue;

            if (spilloverEnabled) {
                enqueueSpillover(pending);
            } else {
                notifyEventLoss(pending.event, "shutdown_pending_retry");
                eventsFailed.incrementAndGet();
            }
        }

        // Drain any remaining events from the main queue
        if (spilloverEnabled && !queue.isEmpty()) {
            QueuedEvent event;
            while ((event = queue.poll()) != null) {
                enqueueSpillover(event);
            }
        }

        // Shutdown executors
        senderExecutor.shutdownNow();
        if (replayExecutor != null) {
            replayExecutor.shutdownNow();
        }
        if (spilloverExecutor != null) {
            spilloverExecutor.shutdown();
            try {
                if (!spilloverExecutor.awaitTermination(10, TimeUnit.SECONDS)) {
                    log.warn("Spillover shutdown timeout - {} events may be lost",
                            spilloverQueue != null ? spilloverQueue.size() : 0);
                    spilloverExecutor.shutdownNow();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                spilloverExecutor.shutdownNow();
            }
        }

        log.info("AsyncEventLogger shutdown complete - sent: {}, failed: {}, spilled: {}, replayed: {}",
                eventsSent.get(), eventsFailed.get(), eventsSpilled.get(), eventsReplayed.get());
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
        public final long eventsReplayed;
        public final int currentQueueDepth;
        public final boolean circuitOpen;

        Metrics(long eventsQueued, long eventsSent, long eventsFailed,
                long eventsSpilled, long eventsReplayed, int currentQueueDepth, boolean circuitOpen) {
            this.eventsQueued = eventsQueued;
            this.eventsSent = eventsSent;
            this.eventsFailed = eventsFailed;
            this.eventsSpilled = eventsSpilled;
            this.eventsReplayed = eventsReplayed;
            this.currentQueueDepth = currentQueueDepth;
            this.circuitOpen = circuitOpen;
        }

        @Override
        public String toString() {
            return String.format("Metrics{queued=%d, sent=%d, failed=%d, spilled=%d, replayed=%d, depth=%d, circuitOpen=%s}",
                    eventsQueued, eventsSent, eventsFailed, eventsSpilled, eventsReplayed, currentQueueDepth, circuitOpen);
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
        private boolean virtualThreads = false;
        private ExecutorService senderExecutor;
        private ScheduledExecutorService retryExecutor;
        private ExecutorService spilloverExecutor;
        private EventLossCallback eventLossCallback;
        private int batchSize = 50;
        private long maxBatchWaitMs = 100;
        private int senderThreads = 1;
        private long replayIntervalMs = 10_000;
        private int maxSpilloverEvents = 10_000;
        private long maxSpilloverSizeBytes = 50L * 1024 * 1024;

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

        /**
         * Enable virtual threads for async logging (Java 21+)
         */
        public Builder virtualThreads(boolean enabled) {
            this.virtualThreads = enabled;
            return this;
        }

        /**
         * Provide a custom sender executor (overrides virtualThreads)
         */
        public Builder senderExecutor(ExecutorService senderExecutor) {
            this.senderExecutor = senderExecutor;
            return this;
        }

        /**
         * Provide a custom retry scheduler (overrides virtualThreads)
         */
        public Builder retryExecutor(ScheduledExecutorService retryExecutor) {
            this.retryExecutor = retryExecutor;
            return this;
        }

        /**
         * Provide a custom spillover executor (advanced usage/testing)
         */
        public Builder spilloverExecutor(ExecutorService spilloverExecutor) {
            this.spilloverExecutor = spilloverExecutor;
            return this;
        }

        /**
         * Set a callback invoked whenever an event is dropped.
         * Defaults to a SLF4J WARN logger if not set.
         */
        public Builder onEventLoss(EventLossCallback callback) {
            this.eventLossCallback = callback;
            return this;
        }

        /**
         * Set the maximum number of events to send in a single batch (default: 50).
         * Set to 1 to disable batching.
         */
        public Builder batchSize(int batchSize) {
            this.batchSize = batchSize;
            return this;
        }

        /**
         * Set the maximum time to wait for a batch to fill before sending (default: 100ms)
         */
        public Builder maxBatchWaitMs(long maxBatchWaitMs) {
            this.maxBatchWaitMs = maxBatchWaitMs;
            return this;
        }

        /**
         * Set the number of sender threads (default: 1)
         */
        public Builder senderThreads(int senderThreads) {
            this.senderThreads = senderThreads;
            return this;
        }

        /**
         * Set the replay interval in milliseconds (default: 10000).
         * Controls how often spilled events are retried when the API recovers.
         */
        public Builder replayIntervalMs(long replayIntervalMs) {
            this.replayIntervalMs = replayIntervalMs;
            return this;
        }

        /**
         * Set the maximum number of events to store in the spillover file (default: 10,000).
         * Events beyond this limit are dropped.
         */
        public Builder maxSpilloverEvents(int maxSpilloverEvents) {
            this.maxSpilloverEvents = maxSpilloverEvents;
            return this;
        }

        /**
         * Set the maximum spillover file size in bytes (default: 50MB).
         * Events beyond this limit are dropped.
         */
        public Builder maxSpilloverSizeBytes(long maxSpilloverSizeBytes) {
            this.maxSpilloverSizeBytes = maxSpilloverSizeBytes;
            return this;
        }

        public AsyncEventLogger build() {
            if (client == null) {
                throw new IllegalStateException("client is required");
            }
            if (batchSize < 1) {
                throw new IllegalArgumentException("batchSize must be >= 1, got: " + batchSize);
            }
            if (senderThreads < 1) {
                throw new IllegalArgumentException("senderThreads must be >= 1, got: " + senderThreads);
            }
            if (maxBatchWaitMs < 0) {
                throw new IllegalArgumentException("maxBatchWaitMs must be >= 0, got: " + maxBatchWaitMs);
            }
            if (replayIntervalMs < 1000) {
                throw new IllegalArgumentException("replayIntervalMs must be >= 1000, got: " + replayIntervalMs);
            }
            if (maxSpilloverEvents < 1) {
                throw new IllegalArgumentException("maxSpilloverEvents must be >= 1, got: " + maxSpilloverEvents);
            }
            if (maxSpilloverSizeBytes < 1) {
                throw new IllegalArgumentException("maxSpilloverSizeBytes must be >= 1, got: " + maxSpilloverSizeBytes);
            }
            return new AsyncEventLogger(this);
        }
    }
}
