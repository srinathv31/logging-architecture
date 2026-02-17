package com.eventlog.sdk.util;

import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;

import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Utility class for Event Log SDK operations
 * 
 * <p>Provides helper methods for generating IDs and creating typed events
 * following the Event Log API v1.4 schema conventions.</p>
 */
public final class EventLogUtils {

    private EventLogUtils() {
        // Prevent instantiation
    }

    // ========================================================================
    // ID Generation
    // ========================================================================

    /**
     * Generate a correlation ID with the default prefix
     * 
     * @return A unique correlation ID in format "corr-{timestamp}-{random}"
     */
    public static String createCorrelationId() {
        return createCorrelationId("corr");
    }

    /**
     * Generate a correlation ID with a custom prefix
     * 
     * @param prefix The prefix for the correlation ID (e.g., "orig", "auth", "emp")
     * @return A unique correlation ID in format "{prefix}-{timestamp}-{random}"
     */
    public static String createCorrelationId(String prefix) {
        String timestamp = Long.toString(System.currentTimeMillis(), 36);
        String random = Long.toString(ThreadLocalRandom.current().nextLong(0, Long.MAX_VALUE), 36)
                .substring(0, 8);
        return prefix + "-" + timestamp + "-" + random;
    }

    /**
     * Generate a batch ID for grouping multiple process instances
     * 
     * @param source The source identifier (e.g., "hr-upload", "csv-import")
     * @return A unique batch ID in format "batch-{YYYYMMDD}-{source}-{random}"
     */
    public static String createBatchId(String source) {
        String date = java.time.LocalDate.now().toString().replace("-", "");
        String random = Long.toString(ThreadLocalRandom.current().nextLong(0, Long.MAX_VALUE), 36)
                .substring(0, 6);
        return "batch-" + date + "-" + source + "-" + random;
    }

    /**
     * Generate a W3C-compliant trace ID (32 hex characters)
     * 
     * @return A random trace ID suitable for distributed tracing
     */
    public static String createTraceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /**
     * Generate a span ID (16 hex characters)
     * 
     * @return A random span ID
     */
    public static String createSpanId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    // ========================================================================
    // Typed Event Creation Helpers
    // ========================================================================

    /**
     * Create a PROCESS_START event builder with required fields pre-set
     * 
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @return Builder with PROCESS_START defaults (step_sequence=0, status=IN_PROGRESS)
     *         Note: This overload does not set applicationId, targetSystem, originatingSystem,
     *         summary, or result. Set those fields before build(), or use the overload that
     *         accepts them.
     */
    public static EventLogEntry.Builder processStart(
            String correlationId, 
            String traceId, 
            String processName) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .processName(processName)
                .eventType(EventType.PROCESS_START)
                .eventStatus(EventStatus.SUCCESS)
                .stepSequence(0);
    }

    /**
     * Create a PROCESS_START event builder with required fields pre-set
     *
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @param applicationId Application identifier
     * @param targetSystem Target system
     * @param originatingSystem Originating system
     * @param summary Summary text
     * @param result Result text
     * @return Builder with PROCESS_START defaults (step_sequence=0, status=SUCCESS)
     */
    public static EventLogEntry.Builder processStart(
            String correlationId,
            String traceId,
            String processName,
            String applicationId,
            String targetSystem,
            String originatingSystem,
            String summary,
            String result) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .applicationId(applicationId)
                .targetSystem(targetSystem)
                .originatingSystem(originatingSystem)
                .processName(processName)
                .eventType(EventType.PROCESS_START)
                .eventStatus(EventStatus.SUCCESS)
                .stepSequence(0)
                .summary(summary)
                .result(result);
    }

    /**
     * Create a STEP event builder with required fields pre-set
     * 
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @param stepSequence Step number in the process
     * @param stepName Human-readable step name
     * @return Builder with STEP defaults
     *         Note: This overload does not set applicationId, targetSystem, originatingSystem,
     *         eventStatus, summary, or result. Set those fields before build(), or use the
     *         overload that accepts them.
     */
    public static EventLogEntry.Builder step(
            String correlationId,
            String traceId,
            String processName,
            int stepSequence,
            String stepName) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .processName(processName)
                .eventType(EventType.STEP)
                .stepSequence(stepSequence)
                .stepName(stepName);
    }

    /**
     * Create a STEP event builder with required fields pre-set
     *
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @param stepSequence Step number in the process
     * @param stepName Human-readable step name
     * @param status Event status
     * @param applicationId Application identifier
     * @param targetSystem Target system
     * @param originatingSystem Originating system
     * @param summary Summary text
     * @param result Result text
     * @return Builder with STEP defaults
     */
    public static EventLogEntry.Builder step(
            String correlationId,
            String traceId,
            String processName,
            int stepSequence,
            String stepName,
            EventStatus status,
            String applicationId,
            String targetSystem,
            String originatingSystem,
            String summary,
            String result) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .applicationId(applicationId)
                .targetSystem(targetSystem)
                .originatingSystem(originatingSystem)
                .processName(processName)
                .eventType(EventType.STEP)
                .eventStatus(status)
                .stepSequence(stepSequence)
                .stepName(stepName)
                .summary(summary)
                .result(result);
    }

    /**
     * Create a PROCESS_END event builder with required fields pre-set
     * 
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @param stepSequence Final step number
     * @param status SUCCESS or FAILURE
     * @param totalDurationMs Total process execution time
     * @return Builder with PROCESS_END defaults
     *         Note: This overload does not set applicationId, targetSystem, originatingSystem,
     *         summary, or result. Set those fields before build(), or use the overload that
     *         accepts them.
     */
    public static EventLogEntry.Builder processEnd(
            String correlationId,
            String traceId,
            String processName,
            int stepSequence,
            EventStatus status,
            int totalDurationMs) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .processName(processName)
                .eventType(EventType.PROCESS_END)
                .eventStatus(status)
                .stepSequence(stepSequence)
                .executionTimeMs(totalDurationMs);
    }

    /**
     * Create a PROCESS_END event builder with required fields pre-set
     *
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @param stepSequence Final step number
     * @param status SUCCESS or FAILURE
     * @param totalDurationMs Total process execution time
     * @param applicationId Application identifier
     * @param targetSystem Target system
     * @param originatingSystem Originating system
     * @param summary Summary text
     * @param result Result text
     * @return Builder with PROCESS_END defaults
     */
    public static EventLogEntry.Builder processEnd(
            String correlationId,
            String traceId,
            String processName,
            int stepSequence,
            EventStatus status,
            int totalDurationMs,
            String applicationId,
            String targetSystem,
            String originatingSystem,
            String summary,
            String result) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .applicationId(applicationId)
                .targetSystem(targetSystem)
                .originatingSystem(originatingSystem)
                .processName(processName)
                .eventType(EventType.PROCESS_END)
                .eventStatus(status)
                .stepSequence(stepSequence)
                .executionTimeMs(totalDurationMs)
                .summary(summary)
                .result(result);
    }

    /**
     * Create an ERROR event builder with required fields pre-set
     * 
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @param errorCode Standardized error code
     * @param errorMessage Error details
     * @return Builder with ERROR defaults (status=FAILURE)
     *         Note: This overload does not set applicationId, targetSystem, originatingSystem,
     *         summary, or result. Set those fields before build(), or use the overload that
     *         accepts them.
     */
    public static EventLogEntry.Builder error(
            String correlationId,
            String traceId,
            String processName,
            String errorCode,
            String errorMessage) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .processName(processName)
                .eventType(EventType.ERROR)
                .eventStatus(EventStatus.FAILURE)
                .errorCode(errorCode)
                .errorMessage(errorMessage);
    }

    /**
     * Create an ERROR event builder with required fields pre-set
     *
     * @param correlationId Process-level anchor ID
     * @param traceId Request-level trace ID
     * @param processName Business process name
     * @param errorCode Standardized error code
     * @param errorMessage Error details
     * @param applicationId Application identifier
     * @param targetSystem Target system
     * @param originatingSystem Originating system
     * @param summary Summary text
     * @param result Result text
     * @return Builder with ERROR defaults (status=FAILURE)
     */
    public static EventLogEntry.Builder error(
            String correlationId,
            String traceId,
            String processName,
            String errorCode,
            String errorMessage,
            String applicationId,
            String targetSystem,
            String originatingSystem,
            String summary,
            String result) {
        return EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .applicationId(applicationId)
                .targetSystem(targetSystem)
                .originatingSystem(originatingSystem)
                .processName(processName)
                .eventType(EventType.ERROR)
                .eventStatus(EventStatus.FAILURE)
                .errorCode(errorCode)
                .errorMessage(errorMessage)
                .summary(summary)
                .result(result);
    }

    // ========================================================================
    // Summary Generation
    // ========================================================================

    /**
     * Generate a well-formed summary string following schema guidelines
     * 
     * @param action The action performed (e.g., "Validated authorized user")
     * @param target The target of the action (e.g., "Jane Doe (SSN ***5678)")
     * @param outcome The result (e.g., "identity confirmed")
     * @return Formatted summary string
     */
    public static String generateSummary(String action, String target, String outcome) {
        return generateSummary(action, target, outcome, null);
    }

    /**
     * Generate a well-formed summary string with optional details
     * 
     * @param action The action performed
     * @param target The target of the action (nullable)
     * @param outcome The result
     * @param details Additional details (nullable)
     * @return Formatted summary string
     */
    public static String generateSummary(String action, String target, String outcome, String details) {
        StringBuilder summary = new StringBuilder(action);
        if (target != null && !target.isBlank()) {
            summary.append(" ").append(target);
        }
        summary.append(" - ").append(outcome);
        if (details != null && !details.isBlank()) {
            summary.append(" (").append(details).append(")");
        }
        return summary.toString();
    }

    /**
     * Mask a sensitive value, showing only last 4 characters
     * 
     * @param value The value to mask
     * @return Masked string (e.g., "***1234")
     */
    public static String maskLast4(String value) {
        if (value == null || value.length() <= 4) {
            return "****";
        }
        return "***" + value.substring(value.length() - 4);
    }
}
