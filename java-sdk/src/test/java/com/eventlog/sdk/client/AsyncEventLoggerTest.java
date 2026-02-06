package com.eventlog.sdk.client;

import com.eventlog.sdk.exception.EventLogException;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;

import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.stream.Stream;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;

class AsyncEventLoggerTest {

    @Test
    void logQueuesAndSends() throws Exception {
        EventLogClient client = Mockito.mock(EventLogClient.class);
        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(invocation -> {
            latch.countDown();
            return null;
        }).when(client).createEvent(Mockito.any(EventLogEntry.class));

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .maxRetries(0)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(latch.await(1, TimeUnit.SECONDS));
        logger.shutdown();
    }

    @Test
    void opensCircuitAfterFailures() throws Exception {
        EventLogClient client = Mockito.mock(EventLogClient.class);
        doThrow(new EventLogException("boom", 500, null))
                .when(client).createEvent(Mockito.any(EventLogEntry.class));

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
        EventLogClient client = Mockito.mock(EventLogClient.class);
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        doAnswer(invocation -> {
            senderStarted.countDown();
            unblockSender.await(2, TimeUnit.SECONDS);
            return null;
        }).when(client).createEvent(Mockito.any(EventLogEntry.class));

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
        EventLogClient client = Mockito.mock(EventLogClient.class);
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        doAnswer(invocation -> {
            senderStarted.countDown();
            unblockSender.await(2, TimeUnit.SECONDS);
            return null;
        }).when(client).createEvent(Mockito.any(EventLogEntry.class));

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
        EventLogClient client = Mockito.mock(EventLogClient.class);
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        doAnswer(invocation -> {
            senderStarted.countDown();
            unblockSender.await(2, TimeUnit.SECONDS);
            return null;
        }).when(client).createEvent(Mockito.any(EventLogEntry.class));

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

        assertTrue(json.contains("\"trace_id\":\"trace\""));
        assertTrue(json.contains("\"event_type\":\"STEP\""));
        assertTrue(json.contains("\"endpoint\":\"/v1/orders\""));
        assertTrue(json.contains("\"identifiers\":{\"order_id\":\"ORD-123\"}"));
        assertTrue(json.contains("\"metadata\":{\"source\":\"test\"}"));
        assertEquals(0, logger.getMetrics().eventsFailed);

        unblockSender.countDown();
        logger.shutdown();
    }

    @Test
    void shutdownHookIsRemovedAfterClose() throws Exception {
        EventLogClient client = Mockito.mock(EventLogClient.class);

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

        EventLogClient client = Mockito.mock(EventLogClient.class);
        CountDownLatch senderStarted = new CountDownLatch(1);
        CountDownLatch unblockSender = new CountDownLatch(1);
        doAnswer(invocation -> {
            senderStarted.countDown();
            unblockSender.await(2, TimeUnit.SECONDS);
            return null;
        }).when(client).createEvent(Mockito.any(EventLogEntry.class));

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
