package com.eventlog.sdk.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Event Log Entry - Core model for the Event Log API v1
 * 
 * <p>Represents a single event in the event log system. Events capture business process
 * steps, API calls, errors, and other significant occurrences for AI context retrieval
 * and observability.</p>
 * 
 * <p>Use the {@link Builder} for fluent construction:</p>
 * <pre>{@code
 * EventLogEntry event = EventLogEntry.builder()
 *     .correlationId("corr-123")
 *     .traceId("trace-abc")
 *     .applicationId("my-service")
 *     .processName("ADD_AUTH_USER")
 *     .eventType(EventType.STEP)
 *     .eventStatus(EventStatus.SUCCESS)
 *     .summary("Validated user against Experian - identity confirmed")
 *     .build();
 * }</pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EventLogEntry {

    // Core identifiers
    @JsonProperty("correlationId")
    private String correlationId;

    @JsonProperty("accountId")
    private String accountId;

    @JsonProperty("traceId")
    private String traceId;

    @JsonProperty("spanId")
    private String spanId;

    @JsonProperty("parentSpanId")
    private String parentSpanId;

    @JsonProperty("spanLinks")
    private List<String> spanLinks;

    @JsonProperty("batchId")
    private String batchId;

    // System context
    @JsonProperty("applicationId")
    private String applicationId;

    @JsonProperty("targetSystem")
    private String targetSystem;

    @JsonProperty("originatingSystem")
    private String originatingSystem;

    // Process details
    @JsonProperty("processName")
    private String processName;

    @JsonProperty("stepSequence")
    private Integer stepSequence;

    @JsonProperty("stepName")
    private String stepName;

    @JsonProperty("eventType")
    private EventType eventType;

    @JsonProperty("eventStatus")
    private EventStatus eventStatus;

    // Business data
    @JsonProperty("identifiers")
    private Map<String, String> identifiers;

    @JsonProperty("summary")
    private String summary;

    @JsonProperty("result")
    private String result;

    @JsonProperty("metadata")
    private Map<String, Object> metadata;

    // Timing
    @JsonProperty("eventTimestamp")
    private Instant eventTimestamp;

    @JsonProperty("executionTimeMs")
    private Integer executionTimeMs;

    // HTTP details
    @JsonProperty("endpoint")
    private String endpoint;

    @JsonProperty("httpMethod")
    private HttpMethod httpMethod;

    @JsonProperty("httpStatusCode")
    private Integer httpStatusCode;

    // Error tracking
    @JsonProperty("errorCode")
    private String errorCode;

    @JsonProperty("errorMessage")
    private String errorMessage;

    // Payloads (sanitized - no PII)
    @JsonProperty("requestPayload")
    private String requestPayload;

    @JsonProperty("responsePayload")
    private String responsePayload;

    // Deduplication
    @JsonProperty("idempotencyKey")
    private String idempotencyKey;

    // Default constructor for Jackson
    public EventLogEntry() {
    }

    // Private constructor for builder
    private EventLogEntry(Builder builder) {
        this.correlationId = builder.correlationId;
        this.accountId = builder.accountId;
        this.traceId = builder.traceId;
        this.spanId = builder.spanId;
        this.parentSpanId = builder.parentSpanId;
        this.spanLinks = builder.spanLinks;
        this.batchId = builder.batchId;
        this.applicationId = builder.applicationId;
        this.targetSystem = builder.targetSystem;
        this.originatingSystem = builder.originatingSystem;
        this.processName = builder.processName;
        this.stepSequence = builder.stepSequence;
        this.stepName = builder.stepName;
        this.eventType = builder.eventType;
        this.eventStatus = builder.eventStatus;
        this.identifiers = builder.identifiers;
        this.summary = builder.summary;
        this.result = builder.result;
        this.metadata = builder.metadata;
        this.eventTimestamp = builder.eventTimestamp;
        this.executionTimeMs = builder.executionTimeMs;
        this.endpoint = builder.endpoint;
        this.httpMethod = builder.httpMethod;
        this.httpStatusCode = builder.httpStatusCode;
        this.errorCode = builder.errorCode;
        this.errorMessage = builder.errorMessage;
        this.requestPayload = builder.requestPayload;
        this.responsePayload = builder.responsePayload;
        this.idempotencyKey = builder.idempotencyKey;
    }

    /**
     * Create a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Create a builder pre-populated with this entry's values (for copying/modifying)
     */
    public Builder toBuilder() {
        return new Builder()
                .correlationId(this.correlationId)
                .accountId(this.accountId)
                .traceId(this.traceId)
                .spanId(this.spanId)
                .parentSpanId(this.parentSpanId)
                .spanLinks(this.spanLinks)
                .batchId(this.batchId)
                .applicationId(this.applicationId)
                .targetSystem(this.targetSystem)
                .originatingSystem(this.originatingSystem)
                .processName(this.processName)
                .stepSequence(this.stepSequence)
                .stepName(this.stepName)
                .eventType(this.eventType)
                .eventStatus(this.eventStatus)
                .identifiers(this.identifiers)
                .summary(this.summary)
                .result(this.result)
                .metadata(this.metadata)
                .eventTimestamp(this.eventTimestamp)
                .executionTimeMs(this.executionTimeMs)
                .endpoint(this.endpoint)
                .httpMethod(this.httpMethod)
                .httpStatusCode(this.httpStatusCode)
                .errorCode(this.errorCode)
                .errorMessage(this.errorMessage)
                .requestPayload(this.requestPayload)
                .responsePayload(this.responsePayload)
                .idempotencyKey(this.idempotencyKey);
    }

    // ========================================================================
    // Getters
    // ========================================================================

    public String getCorrelationId() { return correlationId; }
    public String getAccountId() { return accountId; }
    public String getTraceId() { return traceId; }
    public String getSpanId() { return spanId; }
    public String getParentSpanId() { return parentSpanId; }
    public List<String> getSpanLinks() { return spanLinks; }
    public String getBatchId() { return batchId; }
    public String getApplicationId() { return applicationId; }
    public String getTargetSystem() { return targetSystem; }
    public String getOriginatingSystem() { return originatingSystem; }
    public String getProcessName() { return processName; }
    public Integer getStepSequence() { return stepSequence; }
    public String getStepName() { return stepName; }
    public EventType getEventType() { return eventType; }
    public EventStatus getEventStatus() { return eventStatus; }
    public Map<String, String> getIdentifiers() { return identifiers; }
    public String getSummary() { return summary; }
    public String getResult() { return result; }
    public Map<String, Object> getMetadata() { return metadata; }
    public Instant getEventTimestamp() { return eventTimestamp; }
    public Integer getExecutionTimeMs() { return executionTimeMs; }
    public String getEndpoint() { return endpoint; }
    public HttpMethod getHttpMethod() { return httpMethod; }
    public Integer getHttpStatusCode() { return httpStatusCode; }
    public String getErrorCode() { return errorCode; }
    public String getErrorMessage() { return errorMessage; }
    public String getRequestPayload() { return requestPayload; }
    public String getResponsePayload() { return responsePayload; }
    public String getIdempotencyKey() { return idempotencyKey; }

    // ========================================================================
    // Builder
    // ========================================================================

    /**
     * Fluent builder for EventLogEntry
     */
    public static class Builder {
        private String correlationId;
        private String accountId;
        private String traceId;
        private String spanId;
        private String parentSpanId;
        private List<String> spanLinks;
        private String batchId;
        private String applicationId;
        private String targetSystem;
        private String originatingSystem;
        private String processName;
        private Integer stepSequence;
        private String stepName;
        private EventType eventType;
        private EventStatus eventStatus;
        private Map<String, String> identifiers = new HashMap<>();
        private String summary;
        private String result;
        private Map<String, Object> metadata = new HashMap<>();
        private Instant eventTimestamp;
        private Integer executionTimeMs;
        private String endpoint;
        private HttpMethod httpMethod;
        private Integer httpStatusCode;
        private String errorCode;
        private String errorMessage;
        private String requestPayload;
        private String responsePayload;
        private String idempotencyKey;

        public Builder correlationId(String correlationId) {
            this.correlationId = correlationId;
            return this;
        }

        public Builder accountId(String accountId) {
            this.accountId = accountId;
            return this;
        }

        public Builder traceId(String traceId) {
            this.traceId = traceId;
            return this;
        }

        public Builder spanId(String spanId) {
            this.spanId = spanId;
            return this;
        }

        public Builder parentSpanId(String parentSpanId) {
            this.parentSpanId = parentSpanId;
            return this;
        }

        public Builder spanLinks(List<String> spanLinks) {
            this.spanLinks = spanLinks;
            return this;
        }

        public Builder batchId(String batchId) {
            this.batchId = batchId;
            return this;
        }

        public Builder applicationId(String applicationId) {
            this.applicationId = applicationId;
            return this;
        }

        public Builder targetSystem(String targetSystem) {
            this.targetSystem = targetSystem;
            return this;
        }

        public Builder originatingSystem(String originatingSystem) {
            this.originatingSystem = originatingSystem;
            return this;
        }

        public Builder processName(String processName) {
            this.processName = processName;
            return this;
        }

        public Builder stepSequence(Integer stepSequence) {
            this.stepSequence = stepSequence;
            return this;
        }

        public Builder stepName(String stepName) {
            this.stepName = stepName;
            return this;
        }

        public Builder eventType(EventType eventType) {
            this.eventType = eventType;
            return this;
        }

        public Builder eventStatus(EventStatus eventStatus) {
            this.eventStatus = eventStatus;
            return this;
        }

        public Builder identifiers(Map<String, String> identifiers) {
            this.identifiers = identifiers != null ? new HashMap<>(identifiers) : new HashMap<>();
            return this;
        }

        public Builder addIdentifier(String key, String value) {
            this.identifiers.put(key, value);
            return this;
        }

        public Builder summary(String summary) {
            this.summary = summary;
            return this;
        }

        public Builder result(String result) {
            this.result = result;
            return this;
        }

        public Builder metadata(Map<String, Object> metadata) {
            this.metadata = metadata != null ? new HashMap<>(metadata) : new HashMap<>();
            return this;
        }

        public Builder addMetadata(String key, Object value) {
            this.metadata.put(key, value);
            return this;
        }

        public Builder eventTimestamp(Instant eventTimestamp) {
            this.eventTimestamp = eventTimestamp;
            return this;
        }

        public Builder executionTimeMs(Integer executionTimeMs) {
            this.executionTimeMs = executionTimeMs;
            return this;
        }

        public Builder endpoint(String endpoint) {
            this.endpoint = endpoint;
            return this;
        }

        public Builder httpMethod(HttpMethod httpMethod) {
            this.httpMethod = httpMethod;
            return this;
        }

        public Builder httpStatusCode(Integer httpStatusCode) {
            this.httpStatusCode = httpStatusCode;
            return this;
        }

        public Builder errorCode(String errorCode) {
            this.errorCode = errorCode;
            return this;
        }

        public Builder errorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
            return this;
        }

        public Builder requestPayload(String requestPayload) {
            this.requestPayload = requestPayload;
            return this;
        }

        public Builder responsePayload(String responsePayload) {
            this.responsePayload = responsePayload;
            return this;
        }

        public Builder idempotencyKey(String idempotencyKey) {
            this.idempotencyKey = idempotencyKey;
            return this;
        }

        /**
         * Build the EventLogEntry, validating required fields
         * 
         * @throws IllegalStateException if required fields are missing
         */
        public EventLogEntry build() {
            if (eventTimestamp == null) {
                eventTimestamp = Instant.now();
            }
            if (spanId == null || spanId.isBlank()) {
                spanId = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            }
            validate();
            return new EventLogEntry(this);
        }

        private void validate() {
            StringBuilder errors = new StringBuilder();
            
            if (correlationId == null || correlationId.isBlank()) {
                errors.append("correlationId is required; ");
            }
            if (traceId == null || traceId.isBlank()) {
                errors.append("traceId is required; ");
            }
            if (applicationId == null || applicationId.isBlank()) {
                errors.append("applicationId is required; ");
            }
            if (targetSystem == null || targetSystem.isBlank()) {
                errors.append("targetSystem is required; ");
            }
            if (originatingSystem == null || originatingSystem.isBlank()) {
                errors.append("originatingSystem is required; ");
            }
            if (processName == null || processName.isBlank()) {
                errors.append("processName is required; ");
            }
            if (eventType == null) {
                errors.append("eventType is required; ");
            }
            if (eventStatus == null) {
                errors.append("eventStatus is required; ");
            }
            if (summary == null || summary.isBlank()) {
                errors.append("summary is required; ");
            }
            if (result == null || result.isBlank()) {
                errors.append("result is required; ");
            }
            
            if (errors.length() > 0) {
                throw new IllegalStateException("EventLogEntry validation failed: " + errors);
            }
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EventLogEntry that = (EventLogEntry) o;
        return Objects.equals(correlationId, that.correlationId) &&
               Objects.equals(traceId, that.traceId) &&
               Objects.equals(spanId, that.spanId) &&
               Objects.equals(eventTimestamp, that.eventTimestamp);
    }

    @Override
    public int hashCode() {
        return Objects.hash(correlationId, traceId, spanId, eventTimestamp);
    }

    @Override
    public String toString() {
        return "EventLogEntry{" +
                "correlationId='" + correlationId + '\'' +
                ", accountId='" + accountId + '\'' +
                ", processName='" + processName + '\'' +
                ", stepName='" + stepName + '\'' +
                ", eventType=" + eventType +
                ", eventStatus=" + eventStatus +
                ", summary='" + (summary != null && summary.length() > 50 ? summary.substring(0, 50) + "..." : summary) + '\'' +
                '}';
    }
}
