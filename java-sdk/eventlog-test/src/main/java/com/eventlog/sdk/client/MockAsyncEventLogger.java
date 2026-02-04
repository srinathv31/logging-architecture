package com.eventlog.sdk.client;

import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventType;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory AsyncEventLogger for tests.
 */
public class MockAsyncEventLogger extends AsyncEventLogger {

    private static final EventLogClient DEFAULT_CLIENT = EventLogClient.builder()
            .baseUrl("http://localhost")
            .build();

    private final CopyOnWriteArrayList<EventLogEntry> capturedEvents = new CopyOnWriteArrayList<>();

    public MockAsyncEventLogger() {
        super(AsyncEventLogger.builder()
                .client(DEFAULT_CLIENT)
                .registerShutdownHook(false),
                false);
    }

    public MockAsyncEventLogger(EventLogClient client) {
        super(AsyncEventLogger.builder()
                .client(client)
                .registerShutdownHook(false),
                false);
    }

    @Override
    public boolean log(EventLogEntry event) {
        capturedEvents.add(event);
        return true;
    }

    @Override
    public int log(List<EventLogEntry> events) {
        if (events == null) {
            return 0;
        }
        capturedEvents.addAll(events);
        return events.size();
    }

    public List<EventLogEntry> getCapturedEvents() {
        return Collections.unmodifiableList(capturedEvents);
    }

    public List<EventLogEntry> getEventsForProcess(String processName) {
        List<EventLogEntry> matches = new ArrayList<>();
        for (EventLogEntry entry : capturedEvents) {
            if (processName.equals(entry.getProcessName())) {
                matches.add(entry);
            }
        }
        return matches;
    }

    public void reset() {
        capturedEvents.clear();
    }

    public void assertEventCount(int expected) {
        int actual = capturedEvents.size();
        if (actual != expected) {
            throw new AssertionError("Expected " + expected + " events but found " + actual);
        }
    }

    public void assertEventLogged(String processName, EventType eventType) {
        for (EventLogEntry entry : capturedEvents) {
            if (processName.equals(entry.getProcessName()) && eventType == entry.getEventType()) {
                return;
            }
        }
        throw new AssertionError("Expected event for process '" + processName + "' with type '" + eventType + "'");
    }
}
