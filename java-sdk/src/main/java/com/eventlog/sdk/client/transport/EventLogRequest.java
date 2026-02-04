package com.eventlog.sdk.client.transport;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

public final class EventLogRequest {
    private final URI uri;
    private final String method;
    private final String body;
    private final Map<String, String> headers;
    private final Duration timeout;

    public EventLogRequest(URI uri, String method, String body, Map<String, String> headers, Duration timeout) {
        this.uri = uri;
        this.method = method;
        this.body = body;
        this.headers = headers;
        this.timeout = timeout;
    }

    public URI getUri() {
        return uri;
    }

    public String getMethod() {
        return method;
    }

    public String getBody() {
        return body;
    }

    public Map<String, String> getHeaders() {
        return headers;
    }

    public Duration getTimeout() {
        return timeout;
    }
}
