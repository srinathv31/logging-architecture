package com.eventlog.sdk.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response models for the Event Log API
 */
public class ApiResponses {

    /**
     * Response from POST /api/v1/events
     */
    public static class CreateEventResponse {
        @JsonProperty("success")
        private boolean success;

        @JsonProperty("execution_ids")
        private List<String> executionIds;

        @JsonProperty("correlation_id")
        private String correlationId;

        public boolean isSuccess() { return success; }
        public List<String> getExecutionIds() { return executionIds; }
        public String getCorrelationId() { return correlationId; }

        public void setSuccess(boolean success) { this.success = success; }
        public void setExecutionIds(List<String> executionIds) { this.executionIds = executionIds; }
        public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
    }

    /**
     * Response from POST /api/v1/events/batch
     */
    public static class BatchCreateEventResponse {
        @JsonProperty("success")
        private boolean success;

        @JsonProperty("total_received")
        private int totalReceived;

        @JsonProperty("total_inserted")
        private int totalInserted;

        @JsonProperty("execution_ids")
        private List<String> executionIds;

        @JsonProperty("errors")
        private List<BatchError> errors;

        public boolean isSuccess() { return success; }
        public int getTotalReceived() { return totalReceived; }
        public int getTotalInserted() { return totalInserted; }
        public List<String> getExecutionIds() { return executionIds; }
        public List<BatchError> getErrors() { return errors; }
    }

    /**
     * Error detail for batch operations
     */
    public static class BatchError {
        @JsonProperty("index")
        private int index;

        @JsonProperty("error")
        private String error;

        @JsonProperty("correlation_id")
        private String correlationId;

        public int getIndex() { return index; }
        public String getError() { return error; }
        public String getCorrelationId() { return correlationId; }
    }

    /**
     * Response from GET /api/v1/events/account/{account_id}
     */
    public static class GetEventsByAccountResponse {
        @JsonProperty("account_id")
        private String accountId;

        @JsonProperty("events")
        private List<EventLogRecord> events;

        @JsonProperty("total_count")
        private int totalCount;

        @JsonProperty("page")
        private int page;

        @JsonProperty("page_size")
        private int pageSize;

        @JsonProperty("has_more")
        private boolean hasMore;

        public String getAccountId() { return accountId; }
        public List<EventLogRecord> getEvents() { return events; }
        public int getTotalCount() { return totalCount; }
        public int getPage() { return page; }
        public int getPageSize() { return pageSize; }
        public boolean isHasMore() { return hasMore; }
    }

    /**
     * Response from GET /api/v1/events/correlation/{correlation_id}
     */
    public static class GetEventsByCorrelationResponse {
        @JsonProperty("correlation_id")
        private String correlationId;

        @JsonProperty("account_id")
        private String accountId;

        @JsonProperty("events")
        private List<EventLogRecord> events;

        @JsonProperty("is_linked")
        private boolean isLinked;

        public String getCorrelationId() { return correlationId; }
        public String getAccountId() { return accountId; }
        public List<EventLogRecord> getEvents() { return events; }
        public boolean isLinked() { return isLinked; }
    }

    /**
     * Response from GET /api/v1/events/trace/{trace_id}
     */
    public static class GetEventsByTraceResponse {
        @JsonProperty("trace_id")
        private String traceId;

        @JsonProperty("events")
        private List<EventLogRecord> events;

        @JsonProperty("systems_involved")
        private List<String> systemsInvolved;

        @JsonProperty("total_duration_ms")
        private Integer totalDurationMs;

        public String getTraceId() { return traceId; }
        public List<EventLogRecord> getEvents() { return events; }
        public List<String> getSystemsInvolved() { return systemsInvolved; }
        public Integer getTotalDurationMs() { return totalDurationMs; }
    }

    /**
     * Response from GET /api/v1/events/batch/{batch_id}/summary
     */
    public static class BatchSummaryResponse {
        @JsonProperty("batch_id")
        private String batchId;

        @JsonProperty("total_processes")
        private int totalProcesses;

        @JsonProperty("completed")
        private int completed;

        @JsonProperty("in_progress")
        private int inProgress;

        @JsonProperty("failed")
        private int failed;

        @JsonProperty("correlation_ids")
        private List<String> correlationIds;

        @JsonProperty("started_at")
        private String startedAt;

        @JsonProperty("last_event_at")
        private String lastEventAt;

        public String getBatchId() { return batchId; }
        public int getTotalProcesses() { return totalProcesses; }
        public int getCompleted() { return completed; }
        public int getInProgress() { return inProgress; }
        public int getFailed() { return failed; }
        public List<String> getCorrelationIds() { return correlationIds; }
        public String getStartedAt() { return startedAt; }
        public String getLastEventAt() { return lastEventAt; }
    }

    /**
     * Response from POST /api/v1/correlation-links
     */
    public static class CreateCorrelationLinkResponse {
        @JsonProperty("success")
        private boolean success;

        @JsonProperty("correlation_id")
        private String correlationId;

        @JsonProperty("account_id")
        private String accountId;

        @JsonProperty("linked_at")
        private String linkedAt;

        public boolean isSuccess() { return success; }
        public String getCorrelationId() { return correlationId; }
        public String getAccountId() { return accountId; }
        public String getLinkedAt() { return linkedAt; }
    }

    /**
     * Event record returned from the API (includes DB-generated fields)
     */
    public static class EventLogRecord extends EventLogEntry {
        @JsonProperty("event_log_id")
        private Long eventLogId;

        @JsonProperty("execution_id")
        private String executionId;

        @JsonProperty("created_at")
        private String createdAt;

        @JsonProperty("is_deleted")
        private boolean isDeleted;

        public Long getEventLogId() { return eventLogId; }
        public String getExecutionId() { return executionId; }
        public String getCreatedAt() { return createdAt; }
        public boolean isDeleted() { return isDeleted; }
    }
}
