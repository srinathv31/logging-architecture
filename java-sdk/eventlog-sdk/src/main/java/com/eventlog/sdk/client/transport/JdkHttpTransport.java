package com.eventlog.sdk.client.transport;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;

public final class JdkHttpTransport implements EventLogTransport {
    private final HttpClient httpClient;

    public JdkHttpTransport(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    @Override
    public EventLogResponse send(EventLogRequest request) throws Exception {
        HttpRequest httpRequest = buildRequest(request);
        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        return new EventLogResponse(response.statusCode(), response.body());
    }

    @Override
    public CompletableFuture<EventLogResponse> sendAsync(EventLogRequest request) {
        HttpRequest httpRequest = buildRequest(request);
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> new EventLogResponse(response.statusCode(), response.body()));
    }

    private HttpRequest buildRequest(EventLogRequest request) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(request.getUri())
                .timeout(request.getTimeout());

        request.getHeaders().forEach(builder::header);

        String method = request.getMethod();
        String body = request.getBody();
        if ("POST".equals(method) && body != null) {
            builder.POST(HttpRequest.BodyPublishers.ofString(body));
        } else if ("PUT".equals(method) && body != null) {
            builder.PUT(HttpRequest.BodyPublishers.ofString(body));
        } else {
            builder.GET();
        }

        return builder.build();
    }
}
