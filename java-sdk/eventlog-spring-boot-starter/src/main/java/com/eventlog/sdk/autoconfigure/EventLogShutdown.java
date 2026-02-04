package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import jakarta.annotation.PreDestroy;

final class EventLogShutdown {
    private final AsyncEventLogger asyncEventLogger;

    EventLogShutdown(AsyncEventLogger asyncEventLogger) {
        this.asyncEventLogger = asyncEventLogger;
    }

    @PreDestroy
    public void shutdown() {
        asyncEventLogger.shutdown();
    }
}
