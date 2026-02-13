package com.eventlog.sdk.util;

import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EventLogUtilsTest {

    @Test
    void createCorrelationIdUsesDefaultPrefix() {
        String id = EventLogUtils.createCorrelationId();
        assertTrue(id.startsWith("corr-"));
    }

    @Test
    void createCorrelationIdUsesCustomPrefix() {
        String id = EventLogUtils.createCorrelationId("auth");
        assertTrue(id.startsWith("auth-"));
    }

    @Test
    void createTraceIdIs32Chars() {
        String traceId = EventLogUtils.createTraceId();
        assertEquals(32, traceId.length());
    }

    @Test
    void createSpanIdIs16Chars() {
        String spanId = EventLogUtils.createSpanId();
        assertEquals(16, spanId.length());
    }

    @Test
    void processStartDefaultsAreApplied() {
        EventLogEntry entry = EventLogUtils.processStart("corr", "trace", "PROC")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .summary("start")
                .result("INIT")
                .build();

        assertEquals(EventType.PROCESS_START, entry.getEventType());
        assertEquals(EventStatus.IN_PROGRESS, entry.getEventStatus());
        assertEquals(0, entry.getStepSequence());
        assertNotNull(entry.getEventTimestamp());
    }
}
