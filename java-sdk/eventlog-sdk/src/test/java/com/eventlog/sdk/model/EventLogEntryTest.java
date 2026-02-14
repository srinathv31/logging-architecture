package com.eventlog.sdk.model;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class EventLogEntryTest {

    @Test
    void builderSetsAllFieldsCorrectly() {
        Instant now = Instant.now();

        EventLogEntry entry = EventLogEntry.builder()
                .correlationId("corr-1")
                .accountId("acct-1")
                .traceId("trace-1")
                .spanId("span-1")
                .parentSpanId("parent-1")
                .spanLinks(List.of("link-a", "link-b"))
                .batchId("batch-1")
                .applicationId("app-1")
                .targetSystem("target-1")
                .originatingSystem("origin-1")
                .processName("PROCESS")
                .stepSequence(3)
                .stepName("Validate")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .identifiers(Map.of("user_id", "U-1"))
                .summary("Did something")
                .result("OK")
                .metadata(Map.of("key", "val"))
                .eventTimestamp(now)
                .executionTimeMs(250)
                .endpoint("/v1/test")
                .httpMethod(HttpMethod.POST)
                .httpStatusCode(200)
                .errorCode("E001")
                .errorMessage("Test error")
                .requestPayload("{\"req\":true}")
                .responsePayload("{\"res\":true}")
                .idempotencyKey("idem-1")
                .build();

        assertEquals("corr-1", entry.getCorrelationId());
        assertEquals("acct-1", entry.getAccountId());
        assertEquals("trace-1", entry.getTraceId());
        assertEquals("span-1", entry.getSpanId());
        assertEquals("parent-1", entry.getParentSpanId());
        assertEquals(List.of("link-a", "link-b"), entry.getSpanLinks());
        assertEquals("batch-1", entry.getBatchId());
        assertEquals("app-1", entry.getApplicationId());
        assertEquals("target-1", entry.getTargetSystem());
        assertEquals("origin-1", entry.getOriginatingSystem());
        assertEquals("PROCESS", entry.getProcessName());
        assertEquals(3, entry.getStepSequence());
        assertEquals("Validate", entry.getStepName());
        assertEquals(EventType.STEP, entry.getEventType());
        assertEquals(EventStatus.SUCCESS, entry.getEventStatus());
        assertEquals("U-1", entry.getIdentifiers().get("user_id"));
        assertEquals("Did something", entry.getSummary());
        assertEquals("OK", entry.getResult());
        assertEquals("val", entry.getMetadata().get("key"));
        assertEquals(now, entry.getEventTimestamp());
        assertEquals(250, entry.getExecutionTimeMs());
        assertEquals("/v1/test", entry.getEndpoint());
        assertEquals(HttpMethod.POST, entry.getHttpMethod());
        assertEquals(200, entry.getHttpStatusCode());
        assertEquals("E001", entry.getErrorCode());
        assertEquals("Test error", entry.getErrorMessage());
        assertEquals("{\"req\":true}", entry.getRequestPayload());
        assertEquals("{\"res\":true}", entry.getResponsePayload());
        assertEquals("idem-1", entry.getIdempotencyKey());
    }

    @Test
    void builderValidationFailsOnMissingFields() {
        // Missing all required fields
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> EventLogEntry.builder().build());
        String msg = ex.getMessage();
        assertTrue(msg.contains("correlationId"));
        assertTrue(msg.contains("traceId"));
        assertTrue(msg.contains("applicationId"));
        assertTrue(msg.contains("targetSystem"));
        assertTrue(msg.contains("originatingSystem"));
        assertTrue(msg.contains("processName"));
        assertTrue(msg.contains("eventType"));
        assertTrue(msg.contains("eventStatus"));
        assertTrue(msg.contains("summary"));
        assertTrue(msg.contains("result"));
    }

    @Test
    void builderValidationPassesWithAllRequiredFields() {
        EventLogEntry entry = minimalEntry();
        assertNotNull(entry);
    }

    @Test
    void toBuilderPreservesAllFields() {
        Instant now = Instant.now();

        EventLogEntry original = EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.PROCESS_START)
                .eventStatus(EventStatus.IN_PROGRESS)
                .summary("summary")
                .result("result")
                .accountId("acct")
                .spanId("span")
                .parentSpanId("parent")
                .batchId("batch")
                .stepSequence(1)
                .stepName("step")
                .endpoint("/test")
                .httpMethod(HttpMethod.GET)
                .httpStatusCode(200)
                .executionTimeMs(100)
                .errorCode("EC")
                .errorMessage("EM")
                .requestPayload("req")
                .responsePayload("res")
                .idempotencyKey("key")
                .eventTimestamp(now)
                .build();

        EventLogEntry copy = original.toBuilder().build();

        assertEquals(original.getCorrelationId(), copy.getCorrelationId());
        assertEquals(original.getTraceId(), copy.getTraceId());
        assertEquals(original.getAccountId(), copy.getAccountId());
        assertEquals(original.getSpanId(), copy.getSpanId());
        assertEquals(original.getParentSpanId(), copy.getParentSpanId());
        assertEquals(original.getBatchId(), copy.getBatchId());
        assertEquals(original.getApplicationId(), copy.getApplicationId());
        assertEquals(original.getTargetSystem(), copy.getTargetSystem());
        assertEquals(original.getOriginatingSystem(), copy.getOriginatingSystem());
        assertEquals(original.getProcessName(), copy.getProcessName());
        assertEquals(original.getStepSequence(), copy.getStepSequence());
        assertEquals(original.getStepName(), copy.getStepName());
        assertEquals(original.getEventType(), copy.getEventType());
        assertEquals(original.getEventStatus(), copy.getEventStatus());
        assertEquals(original.getSummary(), copy.getSummary());
        assertEquals(original.getResult(), copy.getResult());
        assertEquals(original.getEndpoint(), copy.getEndpoint());
        assertEquals(original.getHttpMethod(), copy.getHttpMethod());
        assertEquals(original.getHttpStatusCode(), copy.getHttpStatusCode());
        assertEquals(original.getExecutionTimeMs(), copy.getExecutionTimeMs());
        assertEquals(original.getErrorCode(), copy.getErrorCode());
        assertEquals(original.getErrorMessage(), copy.getErrorMessage());
        assertEquals(original.getRequestPayload(), copy.getRequestPayload());
        assertEquals(original.getResponsePayload(), copy.getResponsePayload());
        assertEquals(original.getIdempotencyKey(), copy.getIdempotencyKey());
        assertEquals(original.getEventTimestamp(), copy.getEventTimestamp());
    }

    @Test
    void equalsAndHashCodeContract() {
        Instant now = Instant.now();

        EventLogEntry a = EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .spanId("span")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("s")
                .result("r")
                .eventTimestamp(now)
                .build();

        EventLogEntry b = EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .spanId("span")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("s")
                .result("r")
                .eventTimestamp(now)
                .build();

        EventLogEntry c = EventLogEntry.builder()
                .correlationId("different")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("s")
                .result("r")
                .eventTimestamp(now)
                .build();

        assertEquals(a, b, "Equal objects should be equal");
        assertEquals(a.hashCode(), b.hashCode(), "Equal objects should have same hashCode");
        assertNotEquals(a, c, "Different correlationId should not be equal");
        assertNotEquals(a, null);
        assertNotEquals(a, "string");
        assertEquals(a, a, "Same reference should be equal");
    }

    @Test
    void toStringTruncatesLongSummary() {
        String longSummary = "A".repeat(100);
        EventLogEntry entry = EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary(longSummary)
                .result("r")
                .build();

        String str = entry.toString();
        assertTrue(str.contains("..."), "Long summary should be truncated with ...");
        assertFalse(str.contains(longSummary), "Full long summary should not appear");

        // Short summary should NOT be truncated
        EventLogEntry shortEntry = minimalEntry();
        String shortStr = shortEntry.toString();
        assertFalse(shortStr.contains("..."), "Short summary should not be truncated");
    }

    @Test
    void jsonSerializationRoundTrip() throws Exception {
        ObjectMapper mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        Instant now = Instant.now();

        EventLogEntry original = EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("summary")
                .result("result")
                .eventTimestamp(now)
                .endpoint("/v1/test")
                .addIdentifier("id", "val")
                .addMetadata("mk", "mv")
                .build();

        String json = mapper.writeValueAsString(original);

        // Verify NON_NULL behavior - null fields should not appear
        assertFalse(json.contains("\"account_id\""), "null accountId should be excluded");
        assertFalse(json.contains("\"error_code\""), "null errorCode should be excluded");

        // Verify JSON property names
        assertTrue(json.contains("\"correlation_id\""));
        assertTrue(json.contains("\"trace_id\""));
        assertTrue(json.contains("\"event_type\""));
        assertTrue(json.contains("\"event_status\""));

        // Round-trip
        EventLogEntry deserialized = mapper.readValue(json, EventLogEntry.class);
        assertEquals(original.getCorrelationId(), deserialized.getCorrelationId());
        assertEquals(original.getTraceId(), deserialized.getTraceId());
        assertEquals(original.getProcessName(), deserialized.getProcessName());
        assertEquals(original.getEndpoint(), deserialized.getEndpoint());
    }

    @Test
    void addIdentifierAndAddMetadataAccumulate() {
        EventLogEntry entry = EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("s")
                .result("r")
                .addIdentifier("k1", "v1")
                .addIdentifier("k2", "v2")
                .addMetadata("m1", "mv1")
                .addMetadata("m2", "mv2")
                .build();

        assertEquals(2, entry.getIdentifiers().size());
        assertEquals("v1", entry.getIdentifiers().get("k1"));
        assertEquals("v2", entry.getIdentifiers().get("k2"));
        assertEquals(2, entry.getMetadata().size());
    }

    @Test
    void eventTimestampAutoSetWhenNull() {
        Instant before = Instant.now();
        EventLogEntry entry = minimalEntry();
        Instant after = Instant.now();

        assertNotNull(entry.getEventTimestamp());
        assertFalse(entry.getEventTimestamp().isBefore(before));
        assertFalse(entry.getEventTimestamp().isAfter(after));
    }

    private EventLogEntry minimalEntry() {
        return EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("sys")
                .originatingSystem("sys")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("ok")
                .result("OK")
                .build();
    }
}
