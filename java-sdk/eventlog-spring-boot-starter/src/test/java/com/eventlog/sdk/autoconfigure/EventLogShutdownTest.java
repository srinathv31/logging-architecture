package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;

class EventLogShutdownTest {

    @Test
    void stopDelegatesToAsyncEventLogger() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);

        shutdown.stop();

        verify(logger).shutdown();
    }

    @Test
    void stopWithCallbackDelegatesToAsyncEventLoggerAndInvokesCallback() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);
        Runnable callback = mock(Runnable.class);

        shutdown.stop(callback);

        verify(logger).shutdown();
        verify(callback).run();
    }

    @Test
    void isRunningReturnsTrueInitially() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);

        assertThat(shutdown.isRunning()).isTrue();
    }

    @Test
    void isRunningReturnsFalseAfterStop() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);

        shutdown.stop();

        assertThat(shutdown.isRunning()).isFalse();
    }

    @Test
    void stopIsIdempotent() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);

        shutdown.stop();
        shutdown.stop();

        verify(logger, times(1)).shutdown();
    }

    @Test
    void phaseIsMaxValue() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);

        assertThat(shutdown.getPhase()).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void isAutoStartupReturnsTrue() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);

        assertThat(shutdown.isAutoStartup()).isTrue();
    }
}
