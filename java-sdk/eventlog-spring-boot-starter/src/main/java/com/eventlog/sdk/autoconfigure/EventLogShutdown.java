package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import org.springframework.context.SmartLifecycle;

final class EventLogShutdown implements SmartLifecycle {
    private final AsyncEventLogger asyncEventLogger;
    private volatile boolean running = true;

    EventLogShutdown(AsyncEventLogger asyncEventLogger) {
        this.asyncEventLogger = asyncEventLogger;
    }

    @Override
    public void start() {
        running = true;
    }

    @Override
    public void stop() {
        if (running) {
            running = false;
            asyncEventLogger.shutdown();
        }
    }

    @Override
    public void stop(Runnable callback) {
        stop();
        callback.run();
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE;
    }

    @Override
    public boolean isAutoStartup() {
        return true;
    }
}
