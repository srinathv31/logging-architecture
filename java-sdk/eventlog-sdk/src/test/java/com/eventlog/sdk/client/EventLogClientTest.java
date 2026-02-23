package com.eventlog.sdk.client;

import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.exception.EventLogException;
import com.eventlog.sdk.model.ApiResponses.*;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;

class EventLogClientTest {

    @Test
    void retriesOnServerErrorThenSucceeds() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(500, "{}"),
                new EventLogResponse(200, successAccountResponse("acct"))
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(1)
                .retryDelay(Duration.ZERO)
                .build();

        GetEventsByAccountResponse response = client.getEventsByAccount("acct");
        assertEquals("acct", response.getAccountId());
        assertEquals(2, transport.getRequestCount());
    }

    @Test
    void throwsOnClientErrorWithoutRetry() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(400, "{\"error\":\"BAD_REQUEST\"}")
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(3)
                .retryDelay(Duration.ZERO)
                .build();

        EventLogException ex = assertThrows(EventLogException.class,
                () -> client.getEventsByAccount("acct"));
        assertEquals(400, ex.getStatusCode());
        assertEquals("BAD_REQUEST", ex.getErrorCode());
        assertEquals(1, transport.getRequestCount());
    }

    @Test
    void buildsUrlWithEncodedParams() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, successAccountResponse("acct 1"))
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        Map<String, String> params = new LinkedHashMap<>();
        params.put("processName", "My Process");
        params.put("page", "2");

        client.getEventsByAccount("acct 1", params);

        EventLogRequest request = transport.getRequests().get(0);
        String uri = request.getUri().toString();
        assertTrue(uri.contains("/v1/events/account/acct+1"));
        assertTrue(uri.contains("processName=My+Process"));
        assertTrue(uri.contains("page=2"));
    }

    // ========================================================================
    // New tests for coverage
    // ========================================================================

    @Test
    void createEventPostsAndParsesResponse() {
        String responseBody = "{\"success\":true,\"executionIds\":[\"exec-1\"],\"correlationId\":\"corr-1\"}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        CreateEventResponse response = client.createEvent(minimalEvent());
        assertTrue(response.isSuccess());
        assertEquals(List.of("exec-1"), response.getExecutionIds());
        assertEquals("corr-1", response.getCorrelationId());

        EventLogRequest request = transport.getRequests().get(0);
        assertEquals("POST", request.getMethod());
        assertTrue(request.getUri().toString().endsWith("/v1/events"));
        assertNotNull(request.getBody());
        // Verify flat body (no "events" wrapper)
        assertFalse(request.getBody().contains("\"events\""),
                "Body should be a flat event, not wrapped in {\"events\": ...}");
        assertTrue(request.getBody().contains("\"correlationId\""),
                "Body should contain event fields directly");
    }

    @Test
    void createEventsPostsBatchResponse() {
        String responseBody = "{\"success\":true,\"totalReceived\":2,\"totalInserted\":2,\"executionIds\":[\"e1\",\"e2\"],\"correlationIds\":[\"corr\"],\"errors\":[]}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        BatchCreateEventResponse response = client.createEvents(List.of(minimalEvent(), minimalEvent()));
        assertTrue(response.isSuccess());
        assertEquals(2, response.getTotalReceived());
        assertEquals(2, response.getTotalInserted());
        assertEquals(2, response.getExecutionIds().size());
        assertEquals(List.of("corr"), response.getCorrelationIds());
        assertNull(response.getBatchId());

        EventLogRequest request = transport.getRequests().get(0);
        assertTrue(request.getUri().toString().endsWith("/v1/events/batch"));
    }

    @Test
    void createEventAsyncReturnsCompletableFuture() throws Exception {
        String responseBody = "{\"success\":true,\"executionIds\":[\"exec-async\"],\"correlationId\":\"corr-async\"}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        CompletableFuture<CreateEventResponse> future = client.createEventAsync(minimalEvent());
        CreateEventResponse response = future.get();
        assertTrue(response.isSuccess());
        assertEquals("corr-async", response.getCorrelationId());
    }

    @Test
    void getEventsByCorrelationParsesResponse() {
        String responseBody = "{\"correlationId\":\"corr-1\",\"accountId\":\"acct-1\",\"events\":[],\"isLinked\":true}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        GetEventsByCorrelationResponse response = client.getEventsByCorrelation("corr-1");
        assertEquals("corr-1", response.getCorrelationId());
        assertEquals("acct-1", response.getAccountId());
        assertTrue(response.isLinked());
        assertNotNull(response.getEvents());

        EventLogRequest request = transport.getRequests().get(0);
        assertTrue(request.getUri().toString().contains("/v1/events/correlation/corr-1"));
        assertEquals("GET", request.getMethod());
    }

    @Test
    void getEventsByTraceParsesResponse() {
        String responseBody = "{\"traceId\":\"trace-1\",\"events\":[],\"systemsInvolved\":[\"sysA\",\"sysB\"],\"totalDurationMs\":1500}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        GetEventsByTraceResponse response = client.getEventsByTrace("trace-1");
        assertEquals("trace-1", response.getTraceId());
        assertEquals(List.of("sysA", "sysB"), response.getSystemsInvolved());
        assertEquals(1500, response.getTotalDurationMs());
    }

    @Test
    void getBatchSummaryParsesResponse() {
        String responseBody = "{\"batchId\":\"batch-1\",\"totalProcesses\":10,\"completed\":8,\"inProgress\":1,\"failed\":1,\"correlationIds\":[\"c1\"],\"startedAt\":\"2024-01-01\",\"lastEventAt\":\"2024-01-02\"}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        BatchSummaryResponse response = client.getBatchSummary("batch-1");
        assertEquals("batch-1", response.getBatchId());
        assertEquals(10, response.getTotalProcesses());
        assertEquals(8, response.getCompleted());
        assertEquals(1, response.getInProgress());
        assertEquals(1, response.getFailed());

        EventLogRequest request = transport.getRequests().get(0);
        assertTrue(request.getUri().toString().contains("/v1/events/batch/batch-1/summary"));
    }

    @Test
    void createCorrelationLinkPostsCorrectBody() {
        String responseBody = "{\"success\":true,\"correlationId\":\"corr-1\",\"accountId\":\"acct-1\",\"linkedAt\":\"2024-01-01T00:00:00Z\"}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        // Test simple 2-arg overload
        CreateCorrelationLinkResponse response = client.createCorrelationLink("corr-1", "acct-1");
        assertTrue(response.isSuccess());
        assertEquals("corr-1", response.getCorrelationId());
        assertEquals("acct-1", response.getAccountId());

        EventLogRequest request = transport.getRequests().get(0);
        assertEquals("POST", request.getMethod());
        assertTrue(request.getUri().toString().contains("/v1/correlation-links"));
        assertTrue(request.getBody().contains("corr-1"));
        assertTrue(request.getBody().contains("acct-1"));
    }

    @Test
    void createCorrelationLinkFullOverloadIncludesAllFields() {
        String responseBody = "{\"success\":true,\"correlationId\":\"corr-2\",\"accountId\":\"acct-2\",\"linkedAt\":\"2024-01-01T00:00:00Z\"}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        CreateCorrelationLinkResponse response = client.createCorrelationLink(
                "corr-2", "acct-2", "app-1", "cust-1", "5678");
        assertTrue(response.isSuccess());

        EventLogRequest request = transport.getRequests().get(0);
        String body = request.getBody();
        assertTrue(body.contains("corr-2"));
        assertTrue(body.contains("acct-2"));
        assertTrue(body.contains("app-1"));
        assertTrue(body.contains("cust-1"));
        assertTrue(body.contains("5678"));
    }

    @Test
    void tokenProviderAddsAuthorizationHeader() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, successAccountResponse("acct"))
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .tokenProvider(() -> "my-secret-token")
                .maxRetries(0)
                .build();

        client.getEventsByAccount("acct");

        EventLogRequest request = transport.getRequests().get(0);
        assertEquals("Bearer my-secret-token", request.getHeaders().get("Authorization"));
    }

    @Test
    void baseUrlTrailingSlashIsStripped() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, successAccountResponse("acct"))
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test/")
                .transport(transport)
                .maxRetries(0)
                .build();

        client.getEventsByAccount("acct");

        EventLogRequest request = transport.getRequests().get(0);
        String uri = request.getUri().toString();
        assertFalse(uri.contains("//v1"), "Double slash should not appear; trailing slash should be stripped");
        assertTrue(uri.startsWith("https://eventlog-api.test/v1"));
    }

    @Test
    void retriesOnRateLimitThenSucceeds() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(429, "{\"error\":\"RATE_LIMITED\"}"),
                new EventLogResponse(200, successAccountResponse("acct"))
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(1)
                .retryDelay(Duration.ZERO)
                .build();

        GetEventsByAccountResponse response = client.getEventsByAccount("acct");
        assertEquals("acct", response.getAccountId());
        assertEquals(2, transport.getRequestCount(), "Should retry after 429");
    }

    @Test
    void builderThrowsWhenBaseUrlIsNull() {
        assertThrows(IllegalStateException.class,
                () -> EventLogClient.builder().build());
    }

    @Test
    void builderThrowsWhenBaseUrlIsBlank() {
        assertThrows(IllegalStateException.class,
                () -> EventLogClient.builder().baseUrl("  ").build());
    }

    @Test
    void closeDoesNotThrow() {
        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(new SequencedTransport())
                .build();

        assertDoesNotThrow(client::close);
    }

    @Test
    void builderApiKeyCreatesStaticTokenProvider() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, successAccountResponse("acct"))
        );

        @SuppressWarnings("deprecation")
        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .apiKey("test-api-key")
                .maxRetries(0)
                .build();

        client.getEventsByAccount("acct");

        EventLogRequest request = transport.getRequests().get(0);
        assertEquals("Bearer test-api-key", request.getHeaders().get("Authorization"));
    }

    @Test
    void builderApplicationIdAddsHeader() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, successAccountResponse("acct"))
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .applicationId("my-app")
                .maxRetries(0)
                .build();

        client.getEventsByAccount("acct");

        EventLogRequest request = transport.getRequests().get(0);
        assertEquals("my-app", request.getHeaders().get("X-Application-Id"));
    }

    @Test
    void createEventsAsyncReturnsCompletableFuture() throws Exception {
        String responseBody = "{\"success\":true,\"totalReceived\":1,\"totalInserted\":1,\"executionIds\":[\"e1\"],\"errors\":[]}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        var future = client.createEventsAsync(List.of(minimalEvent()));
        var response = future.get();
        assertTrue(response.isSuccess());
    }

    @Test
    void getEventsByAccountWithNoParamsWorks() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, successAccountResponse("acct"))
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        GetEventsByAccountResponse response = client.getEventsByAccount("acct");
        assertEquals("acct", response.getAccountId());
        assertFalse(transport.getRequests().get(0).getUri().toString().contains("?"));
    }

    @Test
    void exhaustedRetriesThrowsException() {
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(500, "{}"),
                new EventLogResponse(500, "{}"),
                new EventLogResponse(500, "{}")
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(2)
                .retryDelay(Duration.ZERO)
                .build();

        assertThrows(EventLogException.class, () -> client.getEventsByAccount("acct"));
        assertEquals(3, transport.getRequestCount());
    }

    @Test
    void getEventsByAccountParsesAllFields() {
        String responseBody = "{\"accountId\":\"acct\",\"events\":[],\"totalCount\":42,\"page\":2,\"pageSize\":25,\"hasMore\":true}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        GetEventsByAccountResponse response = client.getEventsByAccount("acct");
        assertEquals("acct", response.getAccountId());
        assertEquals(42, response.getTotalCount());
        assertEquals(2, response.getPage());
        assertEquals(25, response.getPageSize());
        assertTrue(response.isHasMore());
        assertNotNull(response.getEvents());
    }

    @Test
    void getBatchSummaryParsesAllFields() {
        String responseBody = "{\"batchId\":\"b1\",\"totalProcesses\":10,\"completed\":7,\"inProgress\":2,\"failed\":1,\"correlationIds\":[\"c1\",\"c2\"],\"startedAt\":\"2024-01-01\",\"lastEventAt\":\"2024-01-02\"}";
        SequencedTransport transport = new SequencedTransport(
                new EventLogResponse(200, responseBody)
        );

        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.test")
                .transport(transport)
                .maxRetries(0)
                .build();

        BatchSummaryResponse response = client.getBatchSummary("b1");
        assertEquals("b1", response.getBatchId());
        assertEquals(10, response.getTotalProcesses());
        assertEquals(7, response.getCompleted());
        assertEquals(2, response.getInProgress());
        assertEquals(1, response.getFailed());
        assertEquals(List.of("c1", "c2"), response.getCorrelationIds());
        assertEquals("2024-01-01", response.getStartedAt());
        assertEquals("2024-01-02", response.getLastEventAt());
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private static EventLogEntry minimalEvent() {
        return EventLogEntry.builder()
                .correlationId("corr")
                .traceId("trace")
                .applicationId("app")
                .targetSystem("system")
                .originatingSystem("system")
                .processName("PROC")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("ok")
                .result("OK")
                .build();
    }

    private static String successAccountResponse(String accountId) {
        return "{" +
                "\"accountId\":\"" + accountId + "\"," +
                "\"events\":[]," +
                "\"totalCount\":0," +
                "\"page\":1," +
                "\"pageSize\":50," +
                "\"hasMore\":false" +
                "}";
    }

    private static final class SequencedTransport implements EventLogTransport {
        private final Deque<EventLogResponse> responses = new ArrayDeque<>();
        private final List<EventLogRequest> requests = new ArrayList<>();

        private SequencedTransport(EventLogResponse... responses) {
            for (EventLogResponse response : responses) {
                this.responses.add(response);
            }
        }

        @Override
        public EventLogResponse send(EventLogRequest request) {
            requests.add(request);
            EventLogResponse response = responses.poll();
            if (response == null) {
                return new EventLogResponse(200, "{}" );
            }
            return response;
        }

        @Override
        public CompletableFuture<EventLogResponse> sendAsync(EventLogRequest request) {
            return CompletableFuture.completedFuture(send(request));
        }

        int getRequestCount() {
            return requests.size();
        }

        List<EventLogRequest> getRequests() {
            return requests;
        }
    }
}
