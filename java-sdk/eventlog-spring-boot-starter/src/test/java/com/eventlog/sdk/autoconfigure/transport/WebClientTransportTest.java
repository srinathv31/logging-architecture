package com.eventlog.sdk.autoconfigure.transport;

import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WebClientTransportTest {

    private WebClientTransport createTransport(int statusCode, String body) {
        ExchangeFunction exchangeFunction = mock(ExchangeFunction.class);
        ClientResponse clientResponse = ClientResponse.create(HttpStatus.valueOf(statusCode))
                .body(body)
                .build();
        when(exchangeFunction.exchange(any())).thenReturn(Mono.just(clientResponse));
        WebClient webClient = WebClient.builder().exchangeFunction(exchangeFunction).build();
        return new WebClientTransport(webClient);
    }

    @Test
    void sendAsyncReturnsSuccessResponse() throws Exception {
        WebClientTransport transport = createTransport(200, "{\"success\":true}");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{\"data\":\"test\"}",
                Map.of("Content-Type", "application/json"), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future = transport.sendAsync(request);
        EventLogResponse response = future.get();

        assertThat(response.getStatusCode()).isEqualTo(200);
        assertThat(response.getBody()).contains("success");
    }

    @Test
    void sendAsyncWithBodyAndHeaders() throws Exception {
        WebClientTransport transport = createTransport(201, "created");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{\"key\":\"val\"}",
                Map.of("Authorization", "Bearer token"), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future = transport.sendAsync(request);
        EventLogResponse response = future.get();

        assertThat(response.getStatusCode()).isEqualTo(201);
        assertThat(response.getBody()).isEqualTo("created");
    }

    @Test
    void sendAsyncWithoutBody() throws Exception {
        WebClientTransport transport = createTransport(200, "{\"events\":[]}");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "GET", null,
                Map.of(), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future = transport.sendAsync(request);
        EventLogResponse response = future.get();

        assertThat(response.getStatusCode()).isEqualTo(200);
        assertThat(response.getBody()).contains("events");
    }

    @Test
    void sendAsyncHandlesEmptyResponseBody() throws Exception {
        WebClientTransport transport = createTransport(204, "");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "DELETE", null,
                Map.of(), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future = transport.sendAsync(request);
        EventLogResponse response = future.get();

        assertThat(response.getStatusCode()).isEqualTo(204);
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void sendAsyncHandles4xxErrorResponse() throws Exception {
        WebClientTransport transport = createTransport(400, "Bad Request");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future = transport.sendAsync(request);
        EventLogResponse response = future.get();

        assertThat(response.getStatusCode()).isEqualTo(400);
        assertThat(response.getBody()).isEqualTo("Bad Request");
    }

    @Test
    void sendAsyncHandles5xxErrorResponse() throws Exception {
        WebClientTransport transport = createTransport(500, "Internal Server Error");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future = transport.sendAsync(request);
        EventLogResponse response = future.get();

        assertThat(response.getStatusCode()).isEqualTo(500);
        assertThat(response.getBody()).isEqualTo("Internal Server Error");
    }

    @Test
    void sendAsyncWithMultipleHeaders() throws Exception {
        WebClientTransport transport = createTransport(200, "ok");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of("X-First", "one", "X-Second", "two", "Authorization", "Bearer tok"),
                Duration.ofSeconds(10));

        CompletableFuture<EventLogResponse> future = transport.sendAsync(request);
        EventLogResponse response = future.get();

        assertThat(response.getStatusCode()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("ok");
    }

    @Test
    void sendDelegatesToSendAsyncJoin() {
        WebClientTransport transport = createTransport(200, "ok");

        EventLogRequest request = new EventLogRequest(
                URI.create("http://api.test/v1/events"), "POST", "{}",
                Map.of(), Duration.ofSeconds(10));

        EventLogResponse response = transport.send(request);
        assertThat(response.getStatusCode()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("ok");
    }
}
