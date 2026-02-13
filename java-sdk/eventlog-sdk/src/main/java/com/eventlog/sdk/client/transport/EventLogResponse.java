package com.eventlog.sdk.client.transport;

public final class EventLogResponse {
    private final int statusCode;
    private final String body;

    public EventLogResponse(int statusCode, String body) {
        this.statusCode = statusCode;
        this.body = body;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getBody() {
        return body;
    }
}
