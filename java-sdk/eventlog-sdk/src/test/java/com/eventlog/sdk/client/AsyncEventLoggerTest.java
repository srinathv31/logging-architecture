package com.eventlog.sdk.client;

import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.stream.Stream;
import java.util.concurrent.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class AsyncEventLoggerTest {

    private static final String SUCCESS_BODY = "{\"success\":true,\"executionIds\":[\"id1\"],\"correlationId\":\"corr\"}";
    private static final String ERROR_BODY = "{\"error\":\"boom\"}";

    @Test
    void logQueuesAndSends() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            latch.countDown();
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(latch.await(2, TimeUnit.SECONDS));
        logger.shutdown();
    }

    @Test
    void opensCircuitAfterFailures() throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(500, ERROR_BODY));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .circuitBreakerThreshold(1)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());
        Thread.sleep(200);
        assertTrue(logger.isCircuitOpen());
        logger.shutdown();
    }

    @Test
    void queueFullSpilloverDoesNotWriteOnCallerThread(@TempDir Path tempDir) throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        ExecutorService spilloverNoopExecutor = new NoopExecutorService();

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .spilloverPath(tempDir)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .spilloverExecutor(spilloverNoopExecutor)
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));

        // Fill queue while sender is blocked, then overflow to spillover.
        assertTrue(logger.log(minimalEvent()));
        long startNs = System.nanoTime();
        assertTrue(logger.log(minimalEvent()));
        long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNs);

        assertTrue(elapsedMs < 50, "log() should return quickly on spillover");
        assertFalse(hasSpillFiles(tempDir), "spillover should not run on caller thread");

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void spillsToDiskWhenQueueFull(@TempDir Path tempDir) throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .spilloverPath(tempDir)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));

        // Fill queue, then overflow into async spillover.
        assertTrue(logger.log(minimalEvent()));
        assertTrue(logger.log(minimalEvent()));

        boolean spilled = waitUntil(() -> hasSpillFiles(tempDir), Duration.ofSeconds(2));
        assertTrue(spilled);

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void spilloverSerializesFullEventPayload(@TempDir Path tempDir) throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .spilloverPath(tempDir)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));
        assertTrue(logger.log(minimalEvent()));
        assertTrue(logger.log(eventWithExtendedFields()));

        assertTrue(waitUntil(() -> hasSpillFiles(tempDir), Duration.ofSeconds(2)));
        Path spillFile;
        try (Stream<Path> files = Files.list(tempDir)) {
            spillFile = files.findFirst().orElseThrow();
        }
        String json = Files.readString(spillFile);

        assertTrue(json.contains("\"traceId\":\"trace\""));
        assertTrue(json.contains("\"eventType\":\"STEP\""));
        assertTrue(json.contains("\"endpoint\":\"/v1/orders\""));
        assertTrue(json.contains("\"identifiers\":{\"order_id\":\"ORD-123\"}"));
        assertTrue(json.contains("\"metadata\":{\"source\":\"test\"}"));
        assertEquals(0, logger.getMetrics().eventsFailed);

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void shutdownHookIsRemovedAfterClose() throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .registerShutdownHook(true)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // Grab the shutdown hook via reflection
        Field hookField = AsyncEventLogger.class.getDeclaredField("shutdownHook");
        hookField.setAccessible(true);
        Thread hook = (Thread) hookField.get(logger);
        assertNotNull(hook, "shutdown hook should have been registered");

        // Close the logger — should remove the hook
        logger.close();

        // If the hook was removed, we can re-add it without error
        Runtime.getRuntime().addShutdownHook(hook);
        // Clean up: remove the hook we just re-added
        Runtime.getRuntime().removeShutdownHook(hook);
    }

    @Test
    void spilloverCreatesDirectoryIfMissing(@TempDir Path tempDir) throws Exception {
        Path nested = tempDir.resolve("nested").resolve("spill");
        assertFalse(Files.exists(nested), "directory should not exist yet");

        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .spilloverPath(nested)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // Constructor should have created the directory
        assertTrue(Files.isDirectory(nested), "constructor should create spillover directory");

        // Verify spillover actually works in the auto-created directory
        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));
        assertTrue(logger.log(minimalEvent())); // fills queue
        assertTrue(logger.log(minimalEvent())); // overflows to spillover

        assertTrue(waitUntil(() -> hasSpillFiles(nested), Duration.ofSeconds(2)),
                "spill files should appear in auto-created directory");

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void shutdownSpillsStragglersFromRetryRace(@TempDir Path tempDir) throws Exception {
        CountDownLatch failLatch = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            failLatch.countDown();
            return new EventLogResponse(500, ERROR_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(1)
                .baseRetryDelayMs(60_000) // won't fire before shutdown — guaranteed pending
                .spilloverPath(tempDir)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());
        assertTrue(failLatch.await(2, TimeUnit.SECONDS), "Event should have been attempted");

        // Shutdown immediately — no Thread.sleep needed.
        // The retry is pending (60s delay), and the production fix
        // ensures shutdownNow() cancels it and spills via pendingRetryEvents.
        logger.shutdown();

        java.io.File[] files = tempDir.toFile().listFiles();
        assertNotNull(files);
        assertTrue(files.length > 0, "Events should be spilled to disk during shutdown");
    }

    @Test
    void logDropsEventWhenQueueFullWithoutSpillover() throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // First event: queued, sender picks it up and blocks
        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));

        // Second event: fills queue (capacity 1)
        assertTrue(logger.log(minimalEvent()));

        // Third event: queue full, no spillover → dropped
        assertFalse(logger.log(minimalEvent()));
        assertTrue(logger.getMetrics().eventsFailed >= 1);

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void retryReQueuesAndSendsSuccessfully() throws Exception {
        AtomicInteger callCount = new AtomicInteger(0);
        EventLogClient client = clientWithTransport(request -> {
            if (callCount.incrementAndGet() == 1) {
                return new EventLogResponse(500, ERROR_BODY);
            }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(1)
                .baseRetryDelayMs(50)
                .circuitBreakerThreshold(100)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());

        boolean sent = waitUntil(() -> logger.getMetrics().eventsSent == 1, Duration.ofSeconds(2));
        assertTrue(sent, "Event should be retried and sent successfully");
        assertEquals(1, logger.getMetrics().eventsSent);

        logger.shutdown();
    }

    @Test
    void exhaustedRetriesSpillWithSpilloverEnabled(@TempDir Path tempDir) throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(500, ERROR_BODY));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(1)
                .baseRetryDelayMs(50)
                .circuitBreakerThreshold(100)
                .spilloverPath(tempDir)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());

        boolean spilled = waitUntil(() -> hasSpillFiles(tempDir), Duration.ofSeconds(2));
        assertTrue(spilled, "Event should be spilled after retries exhausted");

        logger.shutdown();
    }

    @Test
    void scheduleRetryHandlesRejectedExecution() throws Exception {
        ScheduledExecutorService deadRetryExecutor = Executors.newSingleThreadScheduledExecutor();
        deadRetryExecutor.shutdownNow();

        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(500, ERROR_BODY));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(1)
                .circuitBreakerThreshold(100)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(deadRetryExecutor)
                .build();

        logger.log(minimalEvent());

        boolean failed = waitUntil(() -> logger.getMetrics().eventsFailed >= 1, Duration.ofSeconds(2));
        assertTrue(failed, "Event should be counted as failed when retry executor rejects");

        logger.shutdown();
    }

    @Test
    void shutdownCountsFailedForPendingRetriesWithoutSpillover() throws Exception {
        CountDownLatch failLatch = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            failLatch.countDown();
            return new EventLogResponse(500, ERROR_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(1)
                .baseRetryDelayMs(60_000)
                .circuitBreakerThreshold(100)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());
        assertTrue(failLatch.await(2, TimeUnit.SECONDS), "Event should have been attempted");

        // Allow time for scheduleRetry to add to pendingRetryEvents
        Thread.sleep(100);

        logger.shutdown();

        assertTrue(logger.getMetrics().eventsFailed >= 1,
                "Pending retry should be counted as failed during shutdown");
    }

    // ========================================================================
    // New tests for coverage
    // ========================================================================

    @Test
    void logBatchQueuesAllEvents() throws Exception {
        AtomicInteger sendCount = new AtomicInteger(0);
        EventLogClient client = clientWithTransport(request -> {
            sendCount.incrementAndGet();
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        List<EventLogEntry> batch = List.of(minimalEvent(), minimalEvent(), minimalEvent());
        int queued = logger.log(batch);

        assertEquals(3, queued, "All 3 events should be queued");

        boolean allSent = waitUntil(() -> logger.getMetrics().eventsSent == 3, Duration.ofSeconds(2));
        assertTrue(allSent, "All batch events should be sent");

        logger.shutdown();
    }

    @Test
    void logReturnsFalseAfterShutdown() throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.shutdown();
        assertFalse(logger.log(minimalEvent()), "log() should return false after shutdown");
    }

    @Test
    void flushReturnsTrueWhenQueueDrains() throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());
        boolean flushed = logger.flush(2000);
        assertTrue(flushed, "flush() should return true when queue is drained");

        logger.shutdown();
    }

    @Test
    void flushReturnsFalseOnTimeout() throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(5, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // First event blocks the sender
        logger.log(minimalEvent());
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));

        // Second event stays in queue since sender is blocked
        logger.log(minimalEvent());

        boolean flushed = logger.flush(100);
        assertFalse(flushed, "flush() should return false when timeout expires before queue drains");

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void flushReturnsFalseOnInterrupt() throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(5, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));
        logger.log(minimalEvent());

        Thread callingThread = Thread.currentThread();
        // Schedule interrupt while flush is sleeping
        Executors.newSingleThreadScheduledExecutor().schedule(
                callingThread::interrupt, 50, TimeUnit.MILLISECONDS);

        boolean flushed = logger.flush(5000);
        assertFalse(flushed, "flush() should return false when interrupted");
        // Clear the interrupt flag
        assertTrue(Thread.interrupted());

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void getQueueDepthReflectsQueueSize() throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(5, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // First event picked up by sender
        logger.log(minimalEvent());
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));

        // Second event stays in queue
        logger.log(minimalEvent());
        assertEquals(1, logger.getQueueDepth(), "Queue should have 1 pending event");

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void metricsToStringIncludesAllFields() throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());
        waitUntil(() -> logger.getMetrics().eventsSent == 1, Duration.ofSeconds(2));

        AsyncEventLogger.Metrics metrics = logger.getMetrics();
        String str = metrics.toString();
        assertTrue(str.contains("queued="), "toString should include queued");
        assertTrue(str.contains("sent="), "toString should include sent");
        assertTrue(str.contains("failed="), "toString should include failed");
        assertTrue(str.contains("spilled="), "toString should include spilled");
        assertTrue(str.contains("depth="), "toString should include depth");
        assertTrue(str.contains("circuitOpen="), "toString should include circuitOpen");

        logger.shutdown();
    }

    // ========================================================================
    // EventLossCallback tests
    // ========================================================================

    @Test
    void callbackInvokedWhenQueueFull() throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AtomicInteger callbackCount = new AtomicInteger(0);
        ConcurrentLinkedQueue<String> reasons = new ConcurrentLinkedQueue<>();
        EventLossCallback callback = (event, reason) -> {
            callbackCount.incrementAndGet();
            reasons.add(reason);
        };

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .maxRetries(0)
                .registerShutdownHook(false)
                .onEventLoss(callback)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));
        assertTrue(logger.log(minimalEvent()));
        assertFalse(logger.log(minimalEvent()));

        assertTrue(callbackCount.get() >= 1, "Callback should be invoked on queue full");
        assertTrue(reasons.contains("queue_full"));

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void callbackInvokedAfterShutdown() throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));

        AtomicInteger callbackCount = new AtomicInteger(0);
        ConcurrentLinkedQueue<String> reasons = new ConcurrentLinkedQueue<>();
        EventLossCallback callback = (event, reason) -> {
            callbackCount.incrementAndGet();
            reasons.add(reason);
        };

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .onEventLoss(callback)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.shutdown();
        assertFalse(logger.log(minimalEvent()));

        assertEquals(1, callbackCount.get());
        assertTrue(reasons.contains("shutdown_in_progress"));
    }

    @Test
    void throwingCallbackDoesNotPropagate() throws Exception {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));

        EventLossCallback throwingCallback = (event, reason) -> {
            throw new RuntimeException("callback exploded");
        };

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .onEventLoss(throwingCallback)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.shutdown();
        assertDoesNotThrow(() -> {
            boolean result = logger.log(minimalEvent());
            assertFalse(result, "log() should return false after shutdown");
        });
    }

    @Test
    void defaultCallbackDoesNotThrow() throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        EventLogClient client = clientWithTransport(request -> {
            senderStarted.countDown();
            try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        // No custom callback — default SLF4J logger should not throw
        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));
        assertTrue(logger.log(minimalEvent()));
        assertDoesNotThrow(() -> logger.log(minimalEvent()));

        unblockSender.countDown();
        logger.shutdown();
    }

    // ========================================================================
    // Batch sender tests
    // ========================================================================

    private static final String BATCH_SUCCESS_BODY =
            "{\"success\":true,\"totalReceived\":5,\"totalInserted\":5,\"executionIds\":[\"id1\",\"id2\",\"id3\",\"id4\",\"id5\"],\"errors\":[]}";

    @Test
    void batchSizeOneSendsIndividually() throws Exception {
        AtomicInteger singleCalls = new AtomicInteger(0);
        AtomicInteger batchCalls = new AtomicInteger(0);
        EventLogClient client = clientWithTransport(request -> {
            if (request.getUri().getPath().contains("/batch")) {
                batchCalls.incrementAndGet();
            } else {
                singleCalls.incrementAndGet();
            }
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .batchSize(1)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        logger.log(minimalEvent());
        logger.log(minimalEvent());

        boolean sent = waitUntil(() -> logger.getMetrics().eventsSent >= 2, Duration.ofSeconds(2));
        assertTrue(sent, "Events should be sent");
        assertTrue(singleCalls.get() >= 2, "Should use createEvent (single), not batch");
        assertEquals(0, batchCalls.get(), "Should not call batch endpoint");

        logger.shutdown();
    }

    @Test
    void batchSendMultipleEvents() throws Exception {
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        AtomicInteger batchCalls = new AtomicInteger(0);
        AtomicInteger singleCalls = new AtomicInteger(0);

        EventLogClient client = clientWithTransport(request -> {
            if (senderStarted.getCount() > 0) {
                senderStarted.countDown();
                try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return new EventLogResponse(200, SUCCESS_BODY);
            }
            if (request.getUri().getPath().contains("/batch")) {
                batchCalls.incrementAndGet();
                return new EventLogResponse(200, BATCH_SUCCESS_BODY);
            }
            singleCalls.incrementAndGet();
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .batchSize(5)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // First event: queued, sender picks it up and blocks
        assertTrue(logger.log(minimalEvent()));
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));

        // Queue 5 events while sender is blocked
        for (int i = 0; i < 5; i++) {
            assertTrue(logger.log(minimalEvent()));
        }

        // Unblock sender — the queued 5 events should be drained as a batch
        unblockSender.countDown();

        boolean sent = waitUntil(() -> logger.getMetrics().eventsSent >= 6, Duration.ofSeconds(2));
        assertTrue(sent, "All events should be sent");
        assertTrue(batchCalls.get() >= 1, "Should have used batch endpoint for multi-event drain");

        logger.shutdown();
    }

    @Test
    void entireBatchFailureRetriesAll() throws Exception {
        AtomicInteger callCount = new AtomicInteger(0);
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);

        EventLogClient client = clientWithTransport(request -> {
            int count = callCount.incrementAndGet();
            // First call blocks to accumulate events in queue
            if (count == 1) {
                senderStarted.countDown();
                try { unblockSender.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return new EventLogResponse(200, SUCCESS_BODY);
            }
            // Second call (the batch) fails
            if (count == 2) {
                return new EventLogResponse(500, ERROR_BODY);
            }
            // Subsequent retries succeed
            return new EventLogResponse(200, SUCCESS_BODY);
        });

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .batchSize(3)
                .maxRetries(1)
                .baseRetryDelayMs(50)
                .circuitBreakerThreshold(100)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // First event blocks sender
        logger.log(minimalEvent());
        assertTrue(senderStarted.await(1, TimeUnit.SECONDS));

        // Queue 3 more events
        logger.log(minimalEvent());
        logger.log(minimalEvent());
        logger.log(minimalEvent());

        unblockSender.countDown();

        // All should eventually be sent via retries
        boolean allSent = waitUntil(() -> logger.getMetrics().eventsSent >= 4, Duration.ofSeconds(5));
        assertTrue(allSent, "All events should eventually be sent after batch failure + retry");

        logger.shutdown();
    }

    @Test
    void builderThrowsWhenClientIsNull() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> AsyncEventLogger.builder().build());
        assertTrue(ex.getMessage().contains("client"), "Should mention 'client' in error message");
    }

    @Test
    void builderRejectsBatchSizeZero() {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));
        assertThrows(IllegalArgumentException.class, () ->
                AsyncEventLogger.builder().client(client).batchSize(0).build());
    }

    @Test
    void builderRejectsSenderThreadsZero() {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));
        assertThrows(IllegalArgumentException.class, () ->
                AsyncEventLogger.builder().client(client).senderThreads(0).build());
    }

    @Test
    void builderRejectsNegativeMaxBatchWaitMs() {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));
        assertThrows(IllegalArgumentException.class, () ->
                AsyncEventLogger.builder().client(client).maxBatchWaitMs(-1).build());
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private EventLogClient clientWithTransport(Function<EventLogRequest, EventLogResponse> handler) {
        EventLogTransport transport = new EventLogTransport() {
            @Override
            public EventLogResponse send(EventLogRequest request) {
                return handler.apply(request);
            }

            @Override
            public CompletableFuture<EventLogResponse> sendAsync(EventLogRequest request) {
                return CompletableFuture.completedFuture(handler.apply(request));
            }
        };
        return EventLogClient.builder()
                .baseUrl("http://localhost:0")
                .transport(transport)
                .maxRetries(0)
                .build();
    }

    private EventLogEntry minimalEvent() {
        return EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("system")
                .originatingSystem("system")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("ok")
                .result("OK")
                .build();
    }

    private EventLogEntry eventWithExtendedFields() {
        return EventLogEntry.builder()
                .correlationId("corr-null")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("system")
                .originatingSystem("system")
                .processName("PROC")
                .stepName("Step 2")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("done")
                .endpoint("/v1/orders")
                .addIdentifier("order_id", "ORD-123")
                .addMetadata("source", "test")
                .result("OK")
                .build();
    }

    private boolean hasSpillFiles(Path directory) {
        try (Stream<Path> files = Files.list(directory)) {
            return files.findAny().isPresent();
        } catch (IOException e) {
            return false;
        }
    }

    private boolean waitUntil(BooleanSupplier condition, Duration timeout) throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (condition.getAsBoolean()) {
                return true;
            }
            Thread.sleep(20);
        }
        return condition.getAsBoolean();
    }

    private static final class NoopExecutorService extends AbstractExecutorService {
        private final AtomicInteger shutdown = new AtomicInteger(0);

        @Override
        public void shutdown() {
            shutdown.set(1);
        }

        @Override
        public List<Runnable> shutdownNow() {
            shutdown.set(1);
            return List.of();
        }

        @Override
        public boolean isShutdown() {
            return shutdown.get() == 1;
        }

        @Override
        public boolean isTerminated() {
            return shutdown.get() == 1;
        }

        @Override
        public boolean awaitTermination(long timeout, TimeUnit unit) {
            return true;
        }

        @Override
        public void execute(Runnable command) {
            // intentionally no-op
        }

        @Override
        public Future<?> submit(Runnable task) {
            return CompletableFuture.completedFuture(null);
        }
    }
}
