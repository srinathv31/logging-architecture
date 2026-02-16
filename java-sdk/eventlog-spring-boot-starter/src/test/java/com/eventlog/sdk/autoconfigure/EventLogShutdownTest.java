package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class EventLogShutdownTest {

    @Test
    void shutdownDelegatesToAsyncEventLogger() {
        AsyncEventLogger logger = mock(AsyncEventLogger.class);
        EventLogShutdown shutdown = new EventLogShutdown(logger);

        shutdown.shutdown();

        verify(logger).shutdown();
    }
}
