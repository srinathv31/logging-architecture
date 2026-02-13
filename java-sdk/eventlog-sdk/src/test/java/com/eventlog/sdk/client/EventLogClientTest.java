package com.eventlog.sdk.client;

import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.exception.EventLogException;
import com.eventlog.sdk.model.ApiResponses.GetEventsByAccountResponse;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

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
                new EventLogResponse(400, "{\"error_code\":\"BAD_REQUEST\"}")
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

    private static String successAccountResponse(String accountId) {
        return "{" +
                "\"account_id\":\"" + accountId + "\"," +
                "\"events\":[]," +
                "\"total_count\":0," +
                "\"page\":1," +
                "\"page_size\":50," +
                "\"has_more\":false" +
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
