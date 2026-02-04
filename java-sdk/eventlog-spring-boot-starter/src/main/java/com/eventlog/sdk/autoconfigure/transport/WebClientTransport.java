package com.eventlog.sdk.autoconfigure.transport;

import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import org.springframework.http.HttpMethod;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.concurrent.CompletableFuture;

public final class WebClientTransport implements EventLogTransport {
    private final WebClient webClient;

    public WebClientTransport(WebClient webClient) {
        this.webClient = webClient;
    }

    @Override
    public EventLogResponse send(EventLogRequest request) {
        return sendAsync(request).join();
    }

    @Override
    public CompletableFuture<EventLogResponse> sendAsync(EventLogRequest request) {
        WebClient.RequestBodySpec spec = webClient.method(HttpMethod.valueOf(request.getMethod()))
                .uri(request.getUri());
        request.getHeaders().forEach(spec::header);

        WebClient.RequestHeadersSpec<?> headersSpec = request.getBody() != null
                ? spec.bodyValue(request.getBody())
                : spec;

        return headersSpec
                .exchangeToMono(response -> response.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .map(body -> new EventLogResponse(response.statusCode().value(), body)))
                .timeout(request.getTimeout())
                .toFuture();
    }
}
