package com.eventlog.sdk.client.transport;

import java.util.concurrent.CompletableFuture;

public interface EventLogTransport {
    EventLogResponse send(EventLogRequest request) throws Exception;

    CompletableFuture<EventLogResponse> sendAsync(EventLogRequest request);
}
