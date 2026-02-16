package com.eventlog.sdk.autoconfigure.transport;

import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;

class RestClientTransportTest {

    private MockRestServiceServer mockServer;
    private RestClient restClient;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        restClient = builder.build();
    }

    @Test
    void sendReturnsSuccessResponse() {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"success\":true}", MediaType.APPLICATION_JSON));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{\"data\":\"test\"}",
                Map.of("Content-Type", "application/json"), Duration.ofSeconds(10));

        EventLogResponse response = new RestClientTransport(restClient, null).send(request);

        assertThat(response.getStatusCode()).isEqualTo(200);
        assertThat(response.getBody()).contains("success");
        mockServer.verify();
    }

    @Test
    void sendPassesHeadersAndBody() {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-Custom", "value"))
                .andExpect(content().string("{\"key\":\"val\"}"))
                .andRespond(withSuccess("ok", MediaType.TEXT_PLAIN));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{\"key\":\"val\"}",
                Map.of("X-Custom", "value"), Duration.ofSeconds(10));

        EventLogResponse response = new RestClientTransport(restClient, null).send(request);
        assertThat(response.getStatusCode()).isEqualTo(200);
        mockServer.verify();
    }

    @Test
    void sendReturnsErrorOnRestClientResponseException() {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError().body("Internal Server Error"));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        EventLogResponse response = new RestClientTransport(restClient, null).send(request);

        assertThat(response.getStatusCode()).isEqualTo(500);
        assertThat(response.getBody()).contains("Internal Server Error");
        mockServer.verify();
    }

    @Test
    void sendHandlesNullBody() {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"events\":[]}", MediaType.APPLICATION_JSON));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "GET", null,
                Map.of(), Duration.ofSeconds(10));

        EventLogResponse response = new RestClientTransport(restClient, null).send(request);
        assertThat(response.getStatusCode()).isEqualTo(200);
        mockServer.verify();
    }

    @Test
    void sendAsyncWithExecutor() throws Exception {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("ok", MediaType.TEXT_PLAIN));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            CompletableFuture<EventLogResponse> future =
                    new RestClientTransport(restClient, executor).sendAsync(request);
            EventLogResponse response = future.get();
            assertThat(response.getStatusCode()).isEqualTo(200);
        } finally {
            executor.shutdown();
        }
        mockServer.verify();
    }

    @Test
    void sendAsyncWithoutExecutor() throws Exception {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("ok", MediaType.TEXT_PLAIN));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future =
                new RestClientTransport(restClient, null).sendAsync(request);
        EventLogResponse response = future.get();
        assertThat(response.getStatusCode()).isEqualTo(200);
        mockServer.verify();
    }

    @Test
    void sendReturnsErrorOn4xxResponse() {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withBadRequest().body("Bad Request"));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        EventLogResponse response = new RestClientTransport(restClient, null).send(request);

        assertThat(response.getStatusCode()).isEqualTo(400);
        assertThat(response.getBody()).contains("Bad Request");
        mockServer.verify();
    }

    @Test
    void sendPassesMultipleHeaders() {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-First", "one"))
                .andExpect(header("X-Second", "two"))
                .andExpect(header("Authorization", "Bearer tok"))
                .andRespond(withSuccess("ok", MediaType.TEXT_PLAIN));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of("X-First", "one", "X-Second", "two", "Authorization", "Bearer tok"),
                Duration.ofSeconds(10));

        EventLogResponse response = new RestClientTransport(restClient, null).send(request);
        assertThat(response.getStatusCode()).isEqualTo(200);
        mockServer.verify();
    }

    @Test
    void sendAsyncReturnsCorrectResponse() throws Exception {
        mockServer.expect(requestTo("http://api.test/v1/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"id\":\"123\"}", MediaType.APPLICATION_JSON));

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future =
                new RestClientTransport(restClient, null).sendAsync(request);
        EventLogResponse response = future.get();
        assertThat(response.getStatusCode()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("{\"id\":\"123\"}");
        mockServer.verify();
    }
}
