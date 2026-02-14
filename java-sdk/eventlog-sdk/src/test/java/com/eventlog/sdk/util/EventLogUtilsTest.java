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

    // ========================================================================
    // New tests for coverage
    // ========================================================================

    @Test
    void createBatchIdContainsSourceAndDate() {
        String batchId = EventLogUtils.createBatchId("hr-upload");
        assertTrue(batchId.startsWith("batch-"), "Should start with 'batch-'");
        assertTrue(batchId.contains("hr-upload"), "Should contain source identifier");
        // Format: batch-YYYYMMDD-source-random
        String[] parts = batchId.split("-");
        assertTrue(parts.length >= 4, "Should have at least 4 segments separated by '-'");
    }

    @Test
    void processStartFullOverloadSetsAllFields() {
        EventLogEntry entry = EventLogUtils.processStart(
                "corr", "trace", "PROC", "app-id", "target", "origin", "Starting up", "INIT"
        ).build();

        assertEquals("corr", entry.getCorrelationId());
        assertEquals("trace", entry.getTraceId());
        assertEquals("PROC", entry.getProcessName());
        assertEquals("app-id", entry.getApplicationId());
        assertEquals("target", entry.getTargetSystem());
        assertEquals("origin", entry.getOriginatingSystem());
        assertEquals("Starting up", entry.getSummary());
        assertEquals("INIT", entry.getResult());
        assertEquals(EventType.PROCESS_START, entry.getEventType());
        assertEquals(EventStatus.IN_PROGRESS, entry.getEventStatus());
        assertEquals(0, entry.getStepSequence());
    }

    @Test
    void stepBuilderSetsCorrectDefaults() {
        EventLogEntry entry = EventLogUtils.step("corr", "trace", "PROC", 2, "Validate")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .eventStatus(EventStatus.SUCCESS)
                .summary("step done")
                .result("OK")
                .build();

        assertEquals(EventType.STEP, entry.getEventType());
        assertEquals(2, entry.getStepSequence());
        assertEquals("Validate", entry.getStepName());
        assertEquals("corr", entry.getCorrelationId());
        assertEquals("trace", entry.getTraceId());
    }

    @Test
    void stepFullOverloadSetsAllFields() {
        EventLogEntry entry = EventLogUtils.step(
                "corr", "trace", "PROC", 3, "Check Balance",
                EventStatus.SUCCESS, "app-id", "target", "origin", "Balance checked", "OK"
        ).build();

        assertEquals("corr", entry.getCorrelationId());
        assertEquals("trace", entry.getTraceId());
        assertEquals("PROC", entry.getProcessName());
        assertEquals(3, entry.getStepSequence());
        assertEquals("Check Balance", entry.getStepName());
        assertEquals(EventStatus.SUCCESS, entry.getEventStatus());
        assertEquals("app-id", entry.getApplicationId());
        assertEquals("target", entry.getTargetSystem());
        assertEquals("origin", entry.getOriginatingSystem());
        assertEquals("Balance checked", entry.getSummary());
        assertEquals("OK", entry.getResult());
        assertEquals(EventType.STEP, entry.getEventType());
    }

    @Test
    void processEndBuilderSetsDefaults() {
        EventLogEntry entry = EventLogUtils.processEnd("corr", "trace", "PROC", 5, EventStatus.SUCCESS, 1500)
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .summary("done")
                .result("COMPLETE")
                .build();

        assertEquals(EventType.PROCESS_END, entry.getEventType());
        assertEquals(EventStatus.SUCCESS, entry.getEventStatus());
        assertEquals(5, entry.getStepSequence());
        assertEquals(1500, entry.getExecutionTimeMs());
    }

    @Test
    void processEndFullOverloadSetsAllFields() {
        EventLogEntry entry = EventLogUtils.processEnd(
                "corr", "trace", "PROC", 5, EventStatus.SUCCESS, 2000,
                "app-id", "target", "origin", "Process finished", "DONE"
        ).build();

        assertEquals("corr", entry.getCorrelationId());
        assertEquals("app-id", entry.getApplicationId());
        assertEquals("target", entry.getTargetSystem());
        assertEquals("origin", entry.getOriginatingSystem());
        assertEquals("Process finished", entry.getSummary());
        assertEquals("DONE", entry.getResult());
        assertEquals(EventType.PROCESS_END, entry.getEventType());
        assertEquals(2000, entry.getExecutionTimeMs());
    }

    @Test
    void errorBuilderSetsDefaults() {
        EventLogEntry entry = EventLogUtils.error("corr", "trace", "PROC", "ERR_001", "Something broke")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .summary("error occurred")
                .result("FAILED")
                .build();

        assertEquals(EventType.ERROR, entry.getEventType());
        assertEquals(EventStatus.FAILURE, entry.getEventStatus());
        assertEquals("ERR_001", entry.getErrorCode());
        assertEquals("Something broke", entry.getErrorMessage());
    }

    @Test
    void errorFullOverloadSetsAllFields() {
        EventLogEntry entry = EventLogUtils.error(
                "corr", "trace", "PROC", "ERR_002", "Bad request",
                "app-id", "target", "origin", "Validation failed", "FAILED"
        ).build();

        assertEquals("corr", entry.getCorrelationId());
        assertEquals("app-id", entry.getApplicationId());
        assertEquals("target", entry.getTargetSystem());
        assertEquals("origin", entry.getOriginatingSystem());
        assertEquals("Validation failed", entry.getSummary());
        assertEquals("FAILED", entry.getResult());
        assertEquals(EventType.ERROR, entry.getEventType());
        assertEquals(EventStatus.FAILURE, entry.getEventStatus());
        assertEquals("ERR_002", entry.getErrorCode());
        assertEquals("Bad request", entry.getErrorMessage());
    }

    @Test
    void generateSummaryFormatsCorrectly() {
        // 3-arg overload
        String summary = EventLogUtils.generateSummary("Validated user", "Jane Doe", "identity confirmed");
        assertEquals("Validated user Jane Doe - identity confirmed", summary);

        // With null target
        String noTarget = EventLogUtils.generateSummary("Processed", null, "done");
        assertEquals("Processed - done", noTarget);

        // With blank target
        String blankTarget = EventLogUtils.generateSummary("Processed", "  ", "done");
        assertEquals("Processed - done", blankTarget);

        // 4-arg overload with details
        String withDetails = EventLogUtils.generateSummary("Checked", "account", "passed", "score=95");
        assertEquals("Checked account - passed (score=95)", withDetails);

        // 4-arg overload with null details
        String noDetails = EventLogUtils.generateSummary("Checked", "account", "passed", null);
        assertEquals("Checked account - passed", noDetails);

        // 4-arg overload with blank details
        String blankDetails = EventLogUtils.generateSummary("Checked", "account", "passed", "  ");
        assertEquals("Checked account - passed", blankDetails);
    }

    @Test
    void maskLast4HandlesEdgeCases() {
        // Null
        assertEquals("****", EventLogUtils.maskLast4(null));

        // Short strings (4 chars or fewer)
        assertEquals("****", EventLogUtils.maskLast4(""));
        assertEquals("****", EventLogUtils.maskLast4("ab"));
        assertEquals("****", EventLogUtils.maskLast4("abcd"));

        // Normal string
        assertEquals("***5678", EventLogUtils.maskLast4("12345678"));

        // Exactly 5 chars
        assertEquals("***bcde", EventLogUtils.maskLast4("abcde"));
    }
}
