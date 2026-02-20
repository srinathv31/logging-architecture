package com.eventlog.sdk.client;

import com.eventlog.sdk.model.EventLogEntry;

/**
 * Callback invoked when an event is dropped and will not be delivered.
 *
 * <p>Implementations must be thread-safe and should not throw exceptions.
 * The default implementation logs a warning via SLF4J.</p>
 */
@FunctionalInterface
public interface EventLossCallback {

    /**
     * Called when an event is lost.
     *
     * @param event  the event that was dropped
     * @param reason a short identifier describing why the event was lost
     *               (e.g. "queue_full", "shutdown_in_progress", "retries_exhausted")
     */
    void onEventLoss(EventLogEntry event, String reason);
}
