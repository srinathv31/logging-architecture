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

        @JsonProperty("executionIds")
        private List<String> executionIds;

        @JsonProperty("correlationId")
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

        @JsonProperty("totalReceived")
        private int totalReceived;

        @JsonProperty("totalInserted")
        private int totalInserted;

        @JsonProperty("executionIds")
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

        @JsonProperty("correlationId")
        private String correlationId;

        public int getIndex() { return index; }
        public String getError() { return error; }
        public String getCorrelationId() { return correlationId; }
    }

    /**
     * Response from GET /api/v1/events/account/{account_id}
     */
    public static class GetEventsByAccountResponse {
        @JsonProperty("accountId")
        private String accountId;

        @JsonProperty("events")
        private List<EventLogRecord> events;

        @JsonProperty("totalCount")
        private int totalCount;

        @JsonProperty("page")
        private int page;

        @JsonProperty("pageSize")
        private int pageSize;

        @JsonProperty("hasMore")
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
        @JsonProperty("correlationId")
        private String correlationId;

        @JsonProperty("accountId")
        private String accountId;

        @JsonProperty("events")
        private List<EventLogRecord> events;

        @JsonProperty("isLinked")
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
        @JsonProperty("traceId")
        private String traceId;

        @JsonProperty("events")
        private List<EventLogRecord> events;

        @JsonProperty("systemsInvolved")
        private List<String> systemsInvolved;

        @JsonProperty("totalDurationMs")
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
        @JsonProperty("batchId")
        private String batchId;

        @JsonProperty("totalProcesses")
        private int totalProcesses;

        @JsonProperty("completed")
        private int completed;

        @JsonProperty("inProgress")
        private int inProgress;

        @JsonProperty("failed")
        private int failed;

        @JsonProperty("correlationIds")
        private List<String> correlationIds;

        @JsonProperty("startedAt")
        private String startedAt;

        @JsonProperty("lastEventAt")
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

        @JsonProperty("correlationId")
        private String correlationId;

        @JsonProperty("accountId")
        private String accountId;

        @JsonProperty("linkedAt")
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
        @JsonProperty("eventLogId")
        private Long eventLogId;

        @JsonProperty("executionId")
        private String executionId;

        @JsonProperty("createdAt")
        private String createdAt;

        @JsonProperty("isDeleted")
        private boolean isDeleted;

        public Long getEventLogId() { return eventLogId; }
        public String getExecutionId() { return executionId; }
        public String getCreatedAt() { return createdAt; }
        public boolean isDeleted() { return isDeleted; }
    }
}
