package com.eventlog.sdk.client;

import com.eventlog.sdk.exception.EventLogException;
import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.client.transport.JdkHttpTransport;
import com.eventlog.sdk.model.ApiResponses.*;
import com.eventlog.sdk.model.EventLogEntry;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

/**
 * Event Log API Client - Main entry point for the SDK
 * 
 * <p>Thread-safe client for interacting with the Event Log API. Supports both
 * synchronous and asynchronous operations.</p>
 * 
 * <h2>Usage with OAuth (Recommended):</h2>
 * <pre>{@code
 * // Create OAuth token provider
 * OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
 *     .tokenUrl("https://auth.yourcompany.com/oauth/token")
 *     .clientId("your-client-id")
 *     .clientSecret("your-client-secret")
 *     .scope("eventlog:write eventlog:read")
 *     .build();
 * 
 * // Create client with OAuth
 * EventLogClient client = EventLogClient.builder()
 *     .baseUrl("https://eventlog-api.yourcompany.com")
 *     .tokenProvider(tokenProvider)
 *     .build();
 * }</pre>
 * 
 * <h2>Usage with API Key (Development/Testing):</h2>
 * <pre>{@code
 * EventLogClient client = EventLogClient.builder()
 *     .baseUrl("https://eventlog-api.yourcompany.com")
 *     .apiKey("your-api-key")  // Convenience method, wraps in StaticTokenProvider
 *     .build();
 * }</pre>
 */
public class EventLogClient implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(EventLogClient.class);

    private final String baseUrl;
    private final EventLogTransport transport;
    private final ObjectMapper objectMapper;
    private final Executor asyncExecutor;
    private final Map<String, String> defaultHeaders;
    private final TokenProvider tokenProvider;
    private final int maxRetries;
    private final Duration retryDelay;
    private final Duration requestTimeout;

    private EventLogClient(Builder builder) {
        this.baseUrl = builder.baseUrl.endsWith("/") 
            ? builder.baseUrl.substring(0, builder.baseUrl.length() - 1) 
            : builder.baseUrl;
        
        if (builder.transport != null) {
            this.transport = builder.transport;
        } else {
            HttpClient httpClient = builder.httpClient != null
                    ? builder.httpClient
                    : HttpClient.newBuilder()
                        .connectTimeout(builder.connectTimeout)
                        .build();
            this.transport = new JdkHttpTransport(httpClient);
        }
        
        this.objectMapper = builder.objectMapper != null
                ? builder.objectMapper
                : new ObjectMapper()
                    .registerModule(new JavaTimeModule())
                    .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        this.asyncExecutor = builder.asyncExecutor;
        
        this.defaultHeaders = new HashMap<>();
        this.defaultHeaders.put("Content-Type", "application/json");
        this.defaultHeaders.put("Accept", "application/json");
        
        if (builder.applicationId != null) {
            this.defaultHeaders.put("X-Application-Id", builder.applicationId);
        }
        
        // Token provider for auth (OAuth or static API key)
        this.tokenProvider = builder.tokenProvider;
        
        this.maxRetries = builder.maxRetries;
        this.retryDelay = builder.retryDelay;
        this.requestTimeout = builder.requestTimeout;
    }

    /**
     * Create a new builder for EventLogClient
     */
    public static Builder builder() {
        return new Builder();
    }

    // ========================================================================
    // Event Operations
    // ========================================================================

    /**
     * Create a single event (synchronous)
     * 
     * @param event The event to create
     * @return Response with execution ID
     * @throws EventLogException on API or network errors
     */
    public CreateEventResponse createEvent(EventLogEntry event) {
        return post("/v1/events", Map.of("events", event), CreateEventResponse.class);
    }

    /**
     * Create a single event (asynchronous)
     */
    public CompletableFuture<CreateEventResponse> createEventAsync(EventLogEntry event) {
        return postAsync("/v1/events", Map.of("events", event), CreateEventResponse.class);
    }

    /**
     * Create multiple events in a batch (synchronous)
     * 
     * @param events List of events to create
     * @return Response with execution IDs and any errors
     */
    public BatchCreateEventResponse createEvents(List<EventLogEntry> events) {
        return post("/v1/events/batch", Map.of("events", events), BatchCreateEventResponse.class);
    }

    /**
     * Create multiple events in a batch (asynchronous)
     */
    public CompletableFuture<BatchCreateEventResponse> createEventsAsync(List<EventLogEntry> events) {
        return postAsync("/v1/events/batch", Map.of("events", events), BatchCreateEventResponse.class);
    }

    /**
     * Get events by account ID
     * 
     * @param accountId The account identifier
     * @return Events for the account
     */
    public GetEventsByAccountResponse getEventsByAccount(String accountId) {
        return getEventsByAccount(accountId, null);
    }

    /**
     * Get events by account ID with query parameters
     * 
     * @param accountId The account identifier
     * @param params Optional query parameters (startDate, endDate, processName, eventStatus, page, pageSize)
     */
    public GetEventsByAccountResponse getEventsByAccount(String accountId, Map<String, String> params) {
        String path = "/v1/events/account/" + encode(accountId);
        return get(path, params, GetEventsByAccountResponse.class);
    }

    /**
     * Get events by correlation ID
     * 
     * @param correlationId The correlation identifier
     */
    public GetEventsByCorrelationResponse getEventsByCorrelation(String correlationId) {
        String path = "/v1/events/correlation/" + encode(correlationId);
        return get(path, null, GetEventsByCorrelationResponse.class);
    }

    /**
     * Get events by trace ID
     * 
     * @param traceId The trace identifier
     */
    public GetEventsByTraceResponse getEventsByTrace(String traceId) {
        String path = "/v1/events/trace/" + encode(traceId);
        return get(path, null, GetEventsByTraceResponse.class);
    }

    /**
     * Get batch summary
     * 
     * @param batchId The batch identifier
     */
    public BatchSummaryResponse getBatchSummary(String batchId) {
        String path = "/v1/events/batch/" + encode(batchId) + "/summary";
        return get(path, null, BatchSummaryResponse.class);
    }

    // ========================================================================
    // Correlation Link Operations
    // ========================================================================

    /**
     * Create a correlation link (links correlation_id to account_id)
     * 
     * @param correlationId The correlation ID to link
     * @param accountId The account ID to link to
     */
    public CreateCorrelationLinkResponse createCorrelationLink(String correlationId, String accountId) {
        return createCorrelationLink(correlationId, accountId, null, null, null);
    }

    /**
     * Create a correlation link with additional identifiers
     */
    public CreateCorrelationLinkResponse createCorrelationLink(
            String correlationId, 
            String accountId,
            String applicationId,
            String customerId,
            String cardNumberLast4) {
        
        Map<String, String> body = new HashMap<>();
        body.put("correlationId", correlationId);
        body.put("accountId", accountId);
        if (applicationId != null) body.put("applicationId", applicationId);
        if (customerId != null) body.put("customerId", customerId);
        if (cardNumberLast4 != null) body.put("cardNumberLast4", cardNumberLast4);
        
        return post("/v1/correlation-links", body, CreateCorrelationLinkResponse.class);
    }

    // ========================================================================
    // HTTP Methods
    // ========================================================================

    private <T> T get(String path, Map<String, String> params, Class<T> responseClass) {
        try {
            String url = buildUrl(path, params);
            EventLogRequest request = buildRequest(url, "GET", null);
            return executeWithRetry(request, responseClass);
        } catch (EventLogException e) {
            throw e;
        } catch (Exception e) {
            throw new EventLogException("Failed to execute GET request: " + path, e);
        }
    }

    private <T> T post(String path, Object body, Class<T> responseClass) {
        try {
            String url = buildUrl(path, null);
            String json = objectMapper.writeValueAsString(body);
            EventLogRequest request = buildRequest(url, "POST", json);
            return executeWithRetry(request, responseClass);
        } catch (EventLogException e) {
            throw e;
        } catch (Exception e) {
            throw new EventLogException("Failed to execute POST request: " + path, e);
        }
    }

    private <T> CompletableFuture<T> postAsync(String path, Object body, Class<T> responseClass) {
        try {
            String url = buildUrl(path, null);
            String json = objectMapper.writeValueAsString(body);
            EventLogRequest request = buildRequest(url, "POST", json);
            return executeWithRetryAsync(request, responseClass, 0);
        } catch (Exception e) {
            return CompletableFuture.failedFuture(
                    new EventLogException("Failed to execute POST request: " + path, e));
        }
    }

    private EventLogRequest buildRequest(String url, String method, String body) {
        Map<String, String> headers = new HashMap<>(defaultHeaders);

        // Add auth header from token provider
        if (tokenProvider != null) {
            headers.put("Authorization", "Bearer " + tokenProvider.getToken());
        }

        return new EventLogRequest(URI.create(url), method, body, headers, requestTimeout);
    }

    private <T> T executeWithRetry(EventLogRequest request, Class<T> responseClass) {
        Exception lastException = null;
        
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    log.debug("Retry attempt {} for {}", attempt, request.getUri());
                    Thread.sleep(retryDelay.toMillis() * attempt);
                }
                
                EventLogResponse response = transport.send(request);
                int status = response.getStatusCode();
                String responseBody = response.getBody();
                
                if (status >= 200 && status < 300) {
                    return objectMapper.readValue(responseBody, responseClass);
                } else if (status >= 500 && attempt < maxRetries) {
                    // Retry on server errors
                    lastException = new EventLogException(
                            "Server error: " + status, status, null);
                    continue;
                } else if (status == 429 && attempt < maxRetries) {
                    // Retry on rate limit
                    lastException = new EventLogException(
                            "Rate limited", status, "RATE_LIMITED");
                    continue;
                } else {
                    // Don't retry client errors
                    throw new EventLogException(
                            "API error: " + status + " - " + responseBody, 
                            status, 
                            extractErrorCode(responseBody));
                }
            } catch (EventLogException e) {
                throw e;
            } catch (Exception e) {
                lastException = e;
                if (attempt >= maxRetries) {
                    throw new EventLogException("Request failed after " + maxRetries + " retries", e);
                }
            }
        }
        
        throw new EventLogException("Request failed after " + maxRetries + " retries", lastException);
    }

    private <T> CompletableFuture<T> executeWithRetryAsync(EventLogRequest request, Class<T> responseClass, int attempt) {
        return transport.sendAsync(request)
                .thenCompose(response -> handleResponseAsync(request, responseClass, attempt, response))
                .exceptionallyCompose(ex -> handleAsyncException(request, responseClass, attempt, ex));
    }

    private <T> CompletableFuture<T> handleResponseAsync(
            EventLogRequest request,
            Class<T> responseClass,
            int attempt,
            EventLogResponse response) {
        int status = response.getStatusCode();
        String responseBody = response.getBody();

        if (status >= 200 && status < 300) {
            try {
                return CompletableFuture.completedFuture(objectMapper.readValue(responseBody, responseClass));
            } catch (IOException e) {
                return CompletableFuture.failedFuture(e);
            }
        }

        if (isRetryableStatus(status) && attempt < maxRetries) {
            return scheduleRetryAsync(request, responseClass, attempt + 1, "status " + status);
        }

        return CompletableFuture.failedFuture(new EventLogException(
                "API error: " + status + " - " + responseBody,
                status,
                extractErrorCode(responseBody)));
    }

    private <T> CompletableFuture<T> handleAsyncException(
            EventLogRequest request,
            Class<T> responseClass,
            int attempt,
            Throwable ex) {
        Throwable cause = unwrapCompletionException(ex);
        if (cause instanceof EventLogException eventEx) {
            int status = eventEx.getStatusCode();
            if (isRetryableStatus(status) && attempt < maxRetries) {
                return scheduleRetryAsync(request, responseClass, attempt + 1, "status " + status);
            }
            return CompletableFuture.failedFuture(eventEx);
        }

        if (attempt < maxRetries) {
            return scheduleRetryAsync(request, responseClass, attempt + 1, cause.getClass().getSimpleName());
        }

        return CompletableFuture.failedFuture(
                new EventLogException("Request failed after " + maxRetries + " retries", cause));
    }

    private <T> CompletableFuture<T> scheduleRetryAsync(
            EventLogRequest request,
            Class<T> responseClass,
            int attempt,
            String reason) {
        long delayMs = retryDelay.toMillis() * attempt;
        log.debug("Retry attempt {} for {} ({})", attempt, request.getUri(), reason);
        Executor delayedExecutor = asyncExecutor != null
                ? CompletableFuture.delayedExecutor(delayMs, TimeUnit.MILLISECONDS, asyncExecutor)
                : CompletableFuture.delayedExecutor(delayMs, TimeUnit.MILLISECONDS);
        return CompletableFuture.supplyAsync(() -> null, delayedExecutor)
                .thenCompose(ignored -> executeWithRetryAsync(request, responseClass, attempt));
    }

    private boolean isRetryableStatus(int status) {
        return status >= 500 || status == 429;
    }

    private Throwable unwrapCompletionException(Throwable ex) {
        if (ex instanceof CompletionException && ex.getCause() != null) {
            return ex.getCause();
        }
        return ex;
    }

    private String buildUrl(String path, Map<String, String> params) {
        StringBuilder url = new StringBuilder(baseUrl).append(path);
        
        if (params != null && !params.isEmpty()) {
            url.append("?");
            params.forEach((key, value) -> {
                if (value != null) {
                    url.append(encode(key)).append("=").append(encode(value)).append("&");
                }
            });
            url.setLength(url.length() - 1); // Remove trailing &
        }
        
        return url.toString();
    }

    private String encode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }

    private String extractErrorCode(String responseBody) {
        try {
            var node = objectMapper.readTree(responseBody);
            if (node.has("error")) {
                return node.get("error").asText();
            }
        } catch (Exception ignored) {}
        return null;
    }

    @Override
    public void close() {
        // HttpClient doesn't require explicit closing in Java 21+
        log.debug("EventLogClient closed");
    }

    // ========================================================================
    // Builder
    // ========================================================================

    /**
     * Builder for EventLogClient
     */
    public static class Builder {
        private String baseUrl;
        private TokenProvider tokenProvider;
        private String applicationId;
        private Duration connectTimeout = Duration.ofSeconds(10);
        private Duration requestTimeout = Duration.ofSeconds(30);
        private int maxRetries = 3;
        private Duration retryDelay = Duration.ofMillis(500);
        private ObjectMapper objectMapper;
        private HttpClient httpClient;
        private Executor asyncExecutor;
        private EventLogTransport transport;

        /**
         * Set the base URL for the Event Log API (required)
         */
        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        /**
         * Set the token provider for authentication (recommended)
         * 
         * <p>Use {@link OAuthTokenProvider} for OAuth client credentials flow,
         * or {@link TokenProvider#of(String)} for static API keys.</p>
         * 
         * @see OAuthTokenProvider
         */
        public Builder tokenProvider(TokenProvider tokenProvider) {
            this.tokenProvider = tokenProvider;
            return this;
        }

        /**
         * Set a static API key for authentication (convenience method)
         * 
         * <p>This is equivalent to {@code tokenProvider(TokenProvider.of(apiKey))}.</p>
         * <p>For production, prefer using {@link #tokenProvider(TokenProvider)} with
         * {@link OAuthTokenProvider}.</p>
         * 
         * @param apiKey The API key
         * @deprecated Use {@link #tokenProvider(TokenProvider)} with {@link OAuthTokenProvider} for production
         */
        @Deprecated
        public Builder apiKey(String apiKey) {
            if (apiKey != null && !apiKey.isBlank()) {
                this.tokenProvider = TokenProvider.of(apiKey);
            }
            return this;
        }

        /**
         * Set the default application ID to include in headers
         */
        public Builder applicationId(String applicationId) {
            this.applicationId = applicationId;
            return this;
        }

        /**
         * Set the connection timeout (default: 10 seconds)
         */
        public Builder connectTimeout(Duration timeout) {
            this.connectTimeout = timeout;
            return this;
        }

        /**
         * Alias for connectTimeout for simpler API
         */
        public Builder timeout(Duration timeout) {
            return connectTimeout(timeout);
        }

        /**
         * Set the per-request timeout (default: 30 seconds)
         */
        public Builder requestTimeout(Duration timeout) {
            this.requestTimeout = timeout;
            return this;
        }

        /**
         * Provide a pre-configured ObjectMapper (recommended for Spring Boot integration)
         */
        public Builder objectMapper(ObjectMapper objectMapper) {
            this.objectMapper = objectMapper;
            return this;
        }

        /**
         * Provide a pre-configured HttpClient (connectTimeout will be ignored if set)
         */
        public Builder httpClient(HttpClient httpClient) {
            this.httpClient = httpClient;
            return this;
        }

        /**
         * Executor for async retries and delayed scheduling
         */
        public Builder asyncExecutor(Executor asyncExecutor) {
            this.asyncExecutor = asyncExecutor;
            return this;
        }

        /**
         * Provide a custom transport (overrides any HttpClient settings)
         */
        public Builder transport(EventLogTransport transport) {
            this.transport = transport;
            return this;
        }

        /**
         * Set maximum retry attempts for failed requests (default: 3)
         */
        public Builder maxRetries(int maxRetries) {
            this.maxRetries = maxRetries;
            return this;
        }

        /**
         * Set delay between retries (default: 500ms, increases exponentially)
         */
        public Builder retryDelay(Duration retryDelay) {
            this.retryDelay = retryDelay;
            return this;
        }

        /**
         * Build the EventLogClient
         * 
         * @throws IllegalStateException if baseUrl is not set
         */
        public EventLogClient build() {
            if (baseUrl == null || baseUrl.isBlank()) {
                throw new IllegalStateException("baseUrl is required");
            }
            return new EventLogClient(this);
        }
    }
}
