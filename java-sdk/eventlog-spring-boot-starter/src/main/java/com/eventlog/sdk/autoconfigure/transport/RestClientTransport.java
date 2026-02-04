package com.eventlog.sdk.autoconfigure.transport;

import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

public final class RestClientTransport implements EventLogTransport {
    private final RestClient restClient;
    private final Executor asyncExecutor;

    public RestClientTransport(RestClient restClient, Executor asyncExecutor) {
        this.restClient = restClient;
        this.asyncExecutor = asyncExecutor;
    }

    @Override
    public EventLogResponse send(EventLogRequest request) {
        try {
            RestClient.RequestBodySpec spec = restClient.method(HttpMethod.valueOf(request.getMethod()))
                    .uri(request.getUri());
            request.getHeaders().forEach(spec::header);
            if (request.getBody() != null) {
                spec.body(request.getBody());
            }
            var response = spec.retrieve().toEntity(String.class);
            return new EventLogResponse(response.getStatusCode().value(), response.getBody());
        } catch (RestClientResponseException ex) {
            return new EventLogResponse(ex.getStatusCode().value(), ex.getResponseBodyAsString());
        }
    }

    @Override
    public CompletableFuture<EventLogResponse> sendAsync(EventLogRequest request) {
        if (asyncExecutor != null) {
            return CompletableFuture.supplyAsync(() -> send(request), asyncExecutor);
        }
        return CompletableFuture.supplyAsync(() -> send(request));
    }
}
