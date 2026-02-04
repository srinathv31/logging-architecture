package com.eventlog.sdk.client;

import com.eventlog.sdk.exception.EventLogException;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

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
    void spillsToDiskWhenQueueFull(@TempDir Path tempDir) {
        EventLogClient client = Mockito.mock(EventLogClient.class);
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
