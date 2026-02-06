package com.eventlog.sdk.client;

import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class AsyncEventLoggerTest {

    private static final String SUCCESS_BODY = "{\"success\":true,\"execution_ids\":[\"id1\"],\"correlation_id\":\"corr\"}";
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
    void spillsToDiskWhenQueueFull(@TempDir Path tempDir) {
        EventLogClient client = clientWithTransport(
                request -> new EventLogResponse(200, SUCCESS_BODY));
        ExecutorService blockingExecutor = new NoopExecutorService();

        AsyncEventLogger logger = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(1)
                .spilloverPath(tempDir)
                .registerShutdownHook(false)
                .senderExecutor(blockingExecutor)
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        assertTrue(logger.log(minimalEvent()));
        assertTrue(logger.log(minimalEvent()));

        boolean spilled = tempDir.toFile().listFiles() != null && tempDir.toFile().listFiles().length > 0;
        assertTrue(spilled);
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
                .baseRetryDelayMs(500) // long enough to be pending during shutdown
                .spilloverPath(tempDir)
                .registerShutdownHook(false)
                .senderExecutor(Executors.newSingleThreadExecutor())
                .retryExecutor(Executors.newSingleThreadScheduledExecutor())
                .build();

        // Log event — it will fail and be scheduled for retry
        logger.log(minimalEvent());
        assertTrue(failLatch.await(2, TimeUnit.SECONDS), "Event should have been attempted");

        // Small delay so the retry gets scheduled but hasn't fired yet (500ms delay)
        Thread.sleep(100);

        // Shutdown while retry is still pending
        logger.shutdown();

        // The pending retry was either cancelled by retryExecutor.shutdown() or
        // if it snuck into the queue, the final drain should have spilled it to disk.
        // Either way, the event is not stranded.
        java.io.File[] files = tempDir.toFile().listFiles();
        assertNotNull(files);
        assertTrue(files.length > 0, "Events should be spilled to disk during shutdown");
    }

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
