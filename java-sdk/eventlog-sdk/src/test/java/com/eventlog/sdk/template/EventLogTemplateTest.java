package com.eventlog.sdk.template;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.model.HttpMethod;
import com.eventlog.sdk.template.EventLogTemplate.ContextProvider;
import com.eventlog.sdk.template.EventLogTemplate.EventLogContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.MDC;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventLogTemplateTest {

    private AsyncEventLogger mockLogger;

    @BeforeEach
    void setUp() {
        mockLogger = mock(AsyncEventLogger.class);
        when(mockLogger.log(any(EventLogEntry.class))).thenReturn(true);
        MDC.clear();
    }

    private EventLogTemplate createTemplate() {
        return EventLogTemplate.builder(mockLogger)
                .applicationId("test-app")
                .targetSystem("target-sys")
                .originatingSystem("origin-sys")
                .contextProvider(ContextProvider.none())
                .build();
    }

    @Test
    void logProcessStartSetsCorrectFields() {
        EventLogTemplate template = createTemplate();

        template.logProcessStart("corr-1", "trace-1", "MY_PROCESS", "Starting process", "INIT");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("corr-1", event.getCorrelationId());
        assertEquals("trace-1", event.getTraceId());
        assertEquals("MY_PROCESS", event.getProcessName());
        assertEquals(EventType.PROCESS_START, event.getEventType());
        assertEquals(EventStatus.SUCCESS, event.getEventStatus());
        assertEquals(0, event.getStepSequence());
        assertEquals("Starting process", event.getSummary());
        assertEquals("INIT", event.getResult());
        assertEquals("test-app", event.getApplicationId());
        assertEquals("target-sys", event.getTargetSystem());
        assertEquals("origin-sys", event.getOriginatingSystem());
    }

    @Test
    void logStepSetsCorrectFields() {
        EventLogTemplate template = createTemplate();

        template.logStep("corr-1", "trace-1", "MY_PROCESS", 2, "Validate Input",
                EventStatus.SUCCESS, "Input validated", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals(EventType.STEP, event.getEventType());
        assertEquals(EventStatus.SUCCESS, event.getEventStatus());
        assertEquals(2, event.getStepSequence());
        assertEquals("Validate Input", event.getStepName());
        assertEquals("Input validated", event.getSummary());
        assertEquals("OK", event.getResult());
    }

    @Test
    void logProcessEndSetsFieldsWithDuration() {
        EventLogTemplate template = createTemplate();

        template.logProcessEnd("corr-1", "trace-1", "MY_PROCESS", 5,
                EventStatus.SUCCESS, "Process completed", "DONE", 1500);

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals(EventType.PROCESS_END, event.getEventType());
        assertEquals(EventStatus.SUCCESS, event.getEventStatus());
        assertEquals(5, event.getStepSequence());
        assertEquals("Process completed", event.getSummary());
        assertEquals("DONE", event.getResult());
        assertEquals(1500, event.getExecutionTimeMs());
    }

    @Test
    void logProcessEndOmitsDurationWhenNull() {
        EventLogTemplate template = createTemplate();

        template.logProcessEnd("corr-1", "trace-1", "MY_PROCESS", 3,
                EventStatus.SUCCESS, "Done", "OK", null);

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertNull(event.getExecutionTimeMs(), "executionTimeMs should be null when not provided");
    }

    @Test
    void logErrorSetsFailureStatus() {
        EventLogTemplate template = createTemplate();

        template.logError("corr-1", "trace-1", "MY_PROCESS",
                "ERR_001", "Something failed", "Error occurred", "FAILED");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals(EventType.ERROR, event.getEventType());
        assertEquals(EventStatus.FAILURE, event.getEventStatus());
        assertEquals("ERR_001", event.getErrorCode());
        assertEquals("Something failed", event.getErrorMessage());
        assertEquals("Error occurred", event.getSummary());
        assertEquals("FAILED", event.getResult());
    }

    @Test
    void logErrorShortOverloadDefaultsResultToFailed() {
        EventLogTemplate template = createTemplate();

        template.logError("corr-1", "trace-1", "MY_PROCESS",
                "ERR_002", "Boom", "Error summary");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("FAILED", event.getResult());
    }

    @Test
    void processLoggerFluentApiSetsAllFields() {
        EventLogTemplate template = createTemplate();

        EventLogTemplate.ProcessLogger proc = template.forProcess("ONBOARD")
                .withCorrelationId("corr-p")
                .withTraceId("trace-p")
                .withSpanId("span-1")
                .withParentSpanId("parent-span-1")
                .withBatchId("batch-1")
                .addIdentifier("user_id", "U-123")
                .addMetadata("source", "test");

        proc.processStart("Starting onboard", "INIT");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("ONBOARD", event.getProcessName());
        assertEquals("corr-p", event.getCorrelationId());
        assertEquals("trace-p", event.getTraceId());
        assertEquals("span-1", event.getSpanId());
        assertEquals("parent-span-1", event.getParentSpanId());
        assertEquals("batch-1", event.getBatchId());
        assertEquals(EventType.PROCESS_START, event.getEventType());
        assertEquals(EventStatus.SUCCESS, event.getEventStatus());
        assertEquals(0, event.getStepSequence());
        assertEquals("U-123", event.getIdentifiers().get("user_id"));
        assertEquals("test", event.getMetadata().get("source"));
    }

    @Test
    void processLoggerLogStepAndProcessEnd() {
        EventLogTemplate template = createTemplate();

        EventLogTemplate.ProcessLogger proc = template.forProcess("FLOW")
                .withCorrelationId("corr")
                .withTraceId("trace");

        proc.logStep(1, "Step One", EventStatus.SUCCESS, "Did step 1", "OK");
        proc.logStep(2, "Step Two", EventStatus.SUCCESS, "Did step 2");
        proc.processEnd(3, EventStatus.SUCCESS, "All done", "COMPLETE", 2000);
        proc.processEnd(4, EventStatus.SUCCESS, "Short end");

        verify(mockLogger, times(4)).log(any(EventLogEntry.class));
    }

    @Test
    void processLoggerErrorOverloads() {
        EventLogTemplate template = createTemplate();

        EventLogTemplate.ProcessLogger proc = template.forProcess("FLOW")
                .withCorrelationId("corr")
                .withTraceId("trace");

        proc.error("E1", "msg1", "summary", "RESULT");
        proc.error("E2", "msg2");
        proc.error("E3", "msg3", "summary3");

        verify(mockLogger, times(3)).log(any(EventLogEntry.class));
    }

    @Test
    void processLoggerOverridesTemplateDefaults() {
        EventLogTemplate template = createTemplate();

        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr")
                .withTraceId("trace")
                .withApplicationId("override-app")
                .withDefaultTargetSystem("override-target")
                .withOriginatingSystem("override-origin");

        proc.processStart("start", "INIT");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("override-app", event.getApplicationId());
        assertEquals("override-target", event.getTargetSystem());
        assertEquals("override-origin", event.getOriginatingSystem());
    }

    @Test
    void customContextProviderResolvesValues() {
        ContextProvider customProvider = () -> new EventLogContext(
                "ctx-corr", "ctx-trace", "ctx-span", "ctx-parent", "ctx-batch");

        EventLogTemplate template = EventLogTemplate.builder(mockLogger)
                .applicationId("test-app")
                .targetSystem("target-sys")
                .originatingSystem("origin-sys")
                .contextProvider(customProvider)
                .build();

        // Pass nulls for context fields — provider should fill them
        template.logProcessStart(null, null, "PROC", "summary", "result");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("ctx-corr", event.getCorrelationId());
        assertEquals("ctx-trace", event.getTraceId());
        assertEquals("ctx-span", event.getSpanId());
        assertEquals("ctx-parent", event.getParentSpanId());
        assertEquals("ctx-batch", event.getBatchId());
    }

    @Test
    void explicitValuesOverrideContextProvider() {
        ContextProvider customProvider = () -> new EventLogContext(
                "ctx-corr", "ctx-trace", null, null, null);

        EventLogTemplate template = EventLogTemplate.builder(mockLogger)
                .applicationId("test-app")
                .targetSystem("target-sys")
                .originatingSystem("origin-sys")
                .contextProvider(customProvider)
                .build();

        template.logProcessStart("explicit-corr", "explicit-trace", "PROC", "summary", "result");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("explicit-corr", event.getCorrelationId());
        assertEquals("explicit-trace", event.getTraceId());
    }

    @Test
    void noneContextProviderReturnsEmptyContext() {
        EventLogTemplate template = EventLogTemplate.builder(mockLogger)
                .applicationId("test-app")
                .targetSystem("target-sys")
                .originatingSystem("origin-sys")
                .contextProvider(ContextProvider.none())
                .build();

        // Must provide explicit IDs since none() doesn't provide any
        template.logProcessStart("corr", "trace", "PROC", "summary", "result");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("corr", event.getCorrelationId());
        assertNotNull(event.getSpanId(), "spanId should be auto-generated by build()");
    }

    @Test
    void mdcContextProviderFallsBackGracefully() {
        // slf4j-simple doesn't support MDC, so this exercises the code path
        // where MDC.get() returns null for all keys
        MDC.clear();

        EventLogTemplate template = EventLogTemplate.builder(mockLogger)
                .applicationId("test-app")
                .targetSystem("target-sys")
                .originatingSystem("origin-sys")
                .contextProvider(ContextProvider.mdc())
                .build();

        // Provide explicit corr/trace since MDC won't have them
        template.logProcessStart("corr", "trace", "PROC", "summary", "result");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals("corr", event.getCorrelationId());
        assertEquals("trace", event.getTraceId());
        // spanId should be auto-generated by build() even when MDC is empty
        assertNotNull(event.getSpanId());
    }

    @Test
    void defaultContextProviderIsMdc() {
        // Not passing contextProvider should default to mdc()
        EventLogTemplate template = EventLogTemplate.builder(mockLogger)
                .applicationId("test-app")
                .targetSystem("target-sys")
                .originatingSystem("origin-sys")
                .build();

        template.logProcessStart("corr", "trace", "PROC", "summary", "result");
        verify(mockLogger).log(any(EventLogEntry.class));
    }

    @Test
    void processStartWithAwaitCompletionSetsInProgress() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("LONG_PROC")
                .withCorrelationId("corr").withTraceId("trace")
                .withAwaitCompletion();

        proc.processStart("Starting long process", "INIT");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals(EventType.PROCESS_START, event.getEventType());
        assertEquals(EventStatus.IN_PROGRESS, event.getEventStatus());
        assertEquals(0, event.getStepSequence());
        assertEquals("Starting long process", event.getSummary());
    }

    @Test
    void processStartDefaultsToSuccess() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("QUICK_PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.processStart("Starting", "INIT");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        EventLogEntry event = captor.getValue();
        assertEquals(EventType.PROCESS_START, event.getEventType());
        assertEquals(EventStatus.SUCCESS, event.getEventStatus());
    }

    @Test
    void builderThrowsOnNullEventLog() {
        assertThrows(NullPointerException.class,
                () -> EventLogTemplate.builder(null)
                        .applicationId("app")
                        .targetSystem("sys")
                        .originatingSystem("sys")
                        .build());
    }

    @Test
    void builderThrowsOnMissingApplicationId() {
        assertThrows(IllegalStateException.class,
                () -> EventLogTemplate.builder(mockLogger)
                        .targetSystem("sys")
                        .originatingSystem("sys")
                        .build());
    }

    @Test
    void builderThrowsOnMissingTargetSystem() {
        assertThrows(IllegalStateException.class,
                () -> EventLogTemplate.builder(mockLogger)
                        .applicationId("app")
                        .originatingSystem("sys")
                        .build());
    }

    @Test
    void builderThrowsOnMissingOriginatingSystem() {
        assertThrows(IllegalStateException.class,
                () -> EventLogTemplate.builder(mockLogger)
                        .applicationId("app")
                        .targetSystem("sys")
                        .build());
    }

    // ========================================================================
    // Per-step targetSystem tests
    // ========================================================================

    @Test
    void withTargetSystemClearsAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withTargetSystem("one-shot-target")
                .logStep(1, "Step1", EventStatus.SUCCESS, "s1", "OK");

        proc.logStep(2, "Step2", EventStatus.SUCCESS, "s2", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals("one-shot-target", captor.getAllValues().get(0).getTargetSystem());
        assertEquals("target-sys", captor.getAllValues().get(1).getTargetSystem(),
                "Should revert to template default after one-shot");
    }

    @Test
    void withDefaultTargetSystemPersists() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace")
                .withDefaultTargetSystem("sticky-target");

        proc.logStep(1, "Step1", EventStatus.SUCCESS, "s1", "OK");
        proc.logStep(2, "Step2", EventStatus.SUCCESS, "s2", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals("sticky-target", captor.getAllValues().get(0).getTargetSystem());
        assertEquals("sticky-target", captor.getAllValues().get(1).getTargetSystem(),
                "Default target system should persist across emits");
    }

    @Test
    void perStepTargetOverridesDefault() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace")
                .withDefaultTargetSystem("sticky-target");

        proc.withTargetSystem("one-shot")
                .logStep(1, "Step1", EventStatus.SUCCESS, "s1", "OK");

        proc.logStep(2, "Step2", EventStatus.SUCCESS, "s2", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals("one-shot", captor.getAllValues().get(0).getTargetSystem(),
                "Per-step should override default");
        assertEquals("sticky-target", captor.getAllValues().get(1).getTargetSystem(),
                "Should revert to sticky default after one-shot");
    }

    // ========================================================================
    // spanLinks tests
    // ========================================================================

    @Test
    void processLoggerSpanLinksSetOnEvent() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withSpanLinks(List.of("a", "b"))
                .logStep(1, "Step1", EventStatus.SUCCESS, "s1", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        assertEquals(List.of("a", "b"), captor.getValue().getSpanLinks());
    }

    @Test
    void spanLinksClearedAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withSpanLinks(List.of("link1"))
                .logStep(1, "Step1", EventStatus.SUCCESS, "s1", "OK");

        proc.logStep(2, "Step2", EventStatus.SUCCESS, "s2", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals(List.of("link1"), captor.getAllValues().get(0).getSpanLinks());
        assertNull(captor.getAllValues().get(1).getSpanLinks(),
                "spanLinks should be null on next emit after one-shot");
    }

    @Test
    void addSpanLinkAccumulates() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.addSpanLink("x").addSpanLink("y").addSpanLink("z")
                .logStep(1, "Step1", EventStatus.SUCCESS, "s1", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        assertEquals(List.of("x", "y", "z"), captor.getValue().getSpanLinks());
    }

    // ========================================================================
    // One-shot field tests (requestPayload, responsePayload, executionTimeMs,
    //                       idempotencyKey, errorCode, errorMessage)
    // ========================================================================

    @Test
    void withRequestPayloadPassesThroughAndClearsAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withRequestPayload("{\"id\":1}")
                .withResponsePayload("{\"ok\":true}")
                .logStep(1, "Call API", EventStatus.SUCCESS, "Called", "OK");

        proc.logStep(2, "Next", EventStatus.SUCCESS, "Done", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        EventLogEntry first = captor.getAllValues().get(0);
        assertEquals("{\"id\":1}", first.getRequestPayload());
        assertEquals("{\"ok\":true}", first.getResponsePayload());

        EventLogEntry second = captor.getAllValues().get(1);
        assertNull(second.getRequestPayload(), "requestPayload should be cleared after emit");
        assertNull(second.getResponsePayload(), "responsePayload should be cleared after emit");
    }

    @Test
    void withExecutionTimeMsPassesThroughAndClearsAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withExecutionTimeMs(350)
                .logStep(1, "DB Query", EventStatus.SUCCESS, "Queried", "OK");

        proc.logStep(2, "Next", EventStatus.SUCCESS, "Done", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals(350, captor.getAllValues().get(0).getExecutionTimeMs());
        assertNull(captor.getAllValues().get(1).getExecutionTimeMs(),
                "executionTimeMs should be cleared after emit");
    }

    @Test
    void withIdempotencyKeyPassesThroughAndClearsAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withIdempotencyKey("idem-abc-123")
                .logStep(1, "Submit", EventStatus.SUCCESS, "Submitted", "OK");

        proc.logStep(2, "Next", EventStatus.SUCCESS, "Done", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals("idem-abc-123", captor.getAllValues().get(0).getIdempotencyKey());
        assertNull(captor.getAllValues().get(1).getIdempotencyKey(),
                "idempotencyKey should be cleared after emit");
    }

    @Test
    void withErrorCodeAndMessagePassThroughOnLogStep() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withErrorCode("RATE_LIMIT")
                .withErrorMessage("Too many requests")
                .logStep(1, "Call API", EventStatus.WARNING, "Rate limited", "RETRYING");

        proc.logStep(2, "Retry", EventStatus.SUCCESS, "Succeeded", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        EventLogEntry first = captor.getAllValues().get(0);
        assertEquals("RATE_LIMIT", first.getErrorCode());
        assertEquals("Too many requests", first.getErrorMessage());

        EventLogEntry second = captor.getAllValues().get(1);
        assertNull(second.getErrorCode(), "errorCode should be cleared after emit");
        assertNull(second.getErrorMessage(), "errorMessage should be cleared after emit");
    }

    // ========================================================================
    // One-shot HTTP field tests (endpoint, httpMethod, httpStatusCode)
    // ========================================================================

    @Test
    void withEndpointClearsAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withEndpoint("/api/v1/users")
                .logStep(1, "Call Users API", EventStatus.SUCCESS, "Called", "OK");

        proc.logStep(2, "Next", EventStatus.SUCCESS, "Done", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals("/api/v1/users", captor.getAllValues().get(0).getEndpoint());
        assertNull(captor.getAllValues().get(1).getEndpoint(),
                "endpoint should be cleared after emit");
    }

    @Test
    void withHttpMethodClearsAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withHttpMethod(HttpMethod.POST)
                .logStep(1, "POST Request", EventStatus.SUCCESS, "Posted", "OK");

        proc.logStep(2, "Next", EventStatus.SUCCESS, "Done", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals(HttpMethod.POST, captor.getAllValues().get(0).getHttpMethod());
        assertNull(captor.getAllValues().get(1).getHttpMethod(),
                "httpMethod should be cleared after emit");
    }

    @Test
    void withHttpStatusCodeClearsAfterEmit() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withHttpStatusCode(200)
                .logStep(1, "API Response", EventStatus.SUCCESS, "Got 200", "OK");

        proc.logStep(2, "Next", EventStatus.SUCCESS, "Done", "OK");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger, times(2)).log(captor.capture());

        assertEquals(200, captor.getAllValues().get(0).getHttpStatusCode());
        assertNull(captor.getAllValues().get(1).getHttpStatusCode(),
                "httpStatusCode should be cleared after emit");
    }

    @Test
    void processEndParameterOverridesPendingExecutionTimeMs() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withExecutionTimeMs(100)
                .processEnd(3, EventStatus.SUCCESS, "Done", "COMPLETE", 5000);

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        assertEquals(5000, captor.getValue().getExecutionTimeMs(),
                "processEnd's totalDurationMs parameter should override pending executionTimeMs");
    }

    @Test
    void errorMethodParametersOverridePendingErrorFields() {
        EventLogTemplate template = createTemplate();
        EventLogTemplate.ProcessLogger proc = template.forProcess("PROC")
                .withCorrelationId("corr").withTraceId("trace");

        proc.withErrorCode("PENDING_CODE")
                .withErrorMessage("pending message")
                .error("ACTUAL_CODE", "actual message", "Error summary", "FAILED");

        ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
        verify(mockLogger).log(captor.capture());

        assertEquals("ACTUAL_CODE", captor.getValue().getErrorCode(),
                "error()'s errorCode parameter should override pending");
        assertEquals("actual message", captor.getValue().getErrorMessage(),
                "error()'s errorMessage parameter should override pending");
    }
}
