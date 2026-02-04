package com.eventlog.sdk.client;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * OAuth 2.0 Token Provider with automatic refresh
 * 
 * <p>Handles OAuth client credentials flow for service-to-service authentication.
 * Automatically caches tokens and refreshes them before expiry.</p>
 * 
 * <h2>Usage:</h2>
 * <pre>{@code
 * OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
 *     .tokenUrl("https://auth.yourcompany.com/oauth/token")
 *     .clientId("your-client-id")
 *     .clientSecret("your-client-secret")
 *     .scope("eventlog:write eventlog:read")  // optional
 *     .build();
 * 
 * // Use with EventLogClient
 * EventLogClient client = EventLogClient.builder()
 *     .baseUrl("https://eventlog-api.yourcompany.com")
 *     .tokenProvider(tokenProvider)
 *     .build();
 * }</pre>
 * 
 * <h2>Thread Safety:</h2>
 * <p>This class is fully thread-safe. Token refresh is synchronized to prevent
 * multiple concurrent refresh requests.</p>
 */
public class OAuthTokenProvider implements TokenProvider {

    private static final Logger log = LoggerFactory.getLogger(OAuthTokenProvider.class);

    private final String tokenUrl;
    private final String clientId;
    private final String clientSecret;
    private final String scope;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Duration refreshBuffer;
    private final Duration requestTimeout;

    // Token cache
    private volatile CachedToken cachedToken;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    private OAuthTokenProvider(Builder builder) {
        this.tokenUrl = builder.tokenUrl;
        this.clientId = builder.clientId;
        this.clientSecret = builder.clientSecret;
        this.scope = builder.scope;
        this.refreshBuffer = builder.refreshBuffer;
        this.requestTimeout = builder.requestTimeout;
        this.objectMapper = builder.objectMapper != null
                ? builder.objectMapper
                : new ObjectMapper();
        this.httpClient = builder.httpClient != null
                ? builder.httpClient
                : HttpClient.newBuilder()
                    .connectTimeout(builder.connectTimeout)
                    .build();
    }

    public static Builder builder() {
        return new Builder();
    }

    // ========================================================================
    // TokenProvider Interface
    // ========================================================================

    /**
     * Get a valid access token, refreshing if necessary
     * 
     * @return Valid access token
     * @throws OAuthException if token cannot be obtained
     */
    @Override
    public String getToken() {
        // Fast path: check if current token is valid (read lock)
        lock.readLock().lock();
        try {
            if (cachedToken != null && !cachedToken.isExpired(refreshBuffer)) {
                return cachedToken.accessToken;
            }
        } finally {
            lock.readLock().unlock();
        }

        // Slow path: refresh token (write lock)
        lock.writeLock().lock();
        try {
            // Double-check after acquiring write lock
            if (cachedToken != null && !cachedToken.isExpired(refreshBuffer)) {
                return cachedToken.accessToken;
            }

            // Fetch new token
            log.debug("Refreshing OAuth token from {}", tokenUrl);
            cachedToken = fetchToken();
            log.info("OAuth token refreshed, expires in {} seconds", cachedToken.expiresInSeconds());
            
            return cachedToken.accessToken;
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Force refresh the token (useful for handling 401 responses)
     */
    public void invalidateToken() {
        lock.writeLock().lock();
        try {
            cachedToken = null;
            log.debug("OAuth token invalidated");
        } finally {
            lock.writeLock().unlock();
        }
    }

    // ========================================================================
    // Token Fetching
    // ========================================================================

    private CachedToken fetchToken() {
        try {
            // Build request body
            StringBuilder body = new StringBuilder();
            body.append("grant_type=client_credentials");
            if (scope != null && !scope.isBlank()) {
                body.append("&scope=").append(java.net.URLEncoder.encode(scope, StandardCharsets.UTF_8));
            }

            // Build request with Basic auth
            String credentials = Base64.getEncoder().encodeToString(
                    (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tokenUrl))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .header("Authorization", "Basic " + credentials)
                    .header("Accept", "application/json")
                    .timeout(requestTimeout)
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                    .build();

            HttpResponse<String> response = httpClient.send(request, 
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new OAuthException("Token request failed: " + response.statusCode() + 
                        " - " + response.body());
            }

            TokenResponse tokenResponse = objectMapper.readValue(response.body(), TokenResponse.class);
            
            if (tokenResponse.accessToken == null || tokenResponse.accessToken.isBlank()) {
                throw new OAuthException("Token response missing access_token");
            }

            // Calculate expiry time
            int expiresIn = tokenResponse.expiresIn != null ? tokenResponse.expiresIn : 3600;
            Instant expiresAt = Instant.now().plusSeconds(expiresIn);

            return new CachedToken(tokenResponse.accessToken, expiresAt);

        } catch (OAuthException e) {
            throw e;
        } catch (Exception e) {
            throw new OAuthException("Failed to fetch OAuth token: " + e.getMessage(), e);
        }
    }

    // ========================================================================
    // Supporting Classes
    // ========================================================================

    private static class CachedToken {
        final String accessToken;
        final Instant expiresAt;

        CachedToken(String accessToken, Instant expiresAt) {
            this.accessToken = accessToken;
            this.expiresAt = expiresAt;
        }

        boolean isExpired(Duration buffer) {
            return Instant.now().plus(buffer).isAfter(expiresAt);
        }

        long expiresInSeconds() {
            return Duration.between(Instant.now(), expiresAt).toSeconds();
        }
    }

    private static class TokenResponse {
        @JsonProperty("access_token")
        String accessToken;

        @JsonProperty("token_type")
        String tokenType;

        @JsonProperty("expires_in")
        Integer expiresIn;

        @JsonProperty("scope")
        String scope;
    }

    /**
     * Exception thrown when OAuth token operations fail
     */
    public static class OAuthException extends RuntimeException {
        public OAuthException(String message) {
            super(message);
        }

        public OAuthException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    // ========================================================================
    // Builder
    // ========================================================================

    public static class Builder {
        private String tokenUrl;
        private String clientId;
        private String clientSecret;
        private String scope;
        private Duration refreshBuffer = Duration.ofSeconds(60); // Refresh 60s before expiry
        private Duration connectTimeout = Duration.ofSeconds(10);
        private Duration requestTimeout = Duration.ofSeconds(30);
        private ObjectMapper objectMapper;
        private HttpClient httpClient;

        /**
         * OAuth token endpoint URL (required)
         */
        public Builder tokenUrl(String tokenUrl) {
            this.tokenUrl = tokenUrl;
            return this;
        }

        /**
         * OAuth client ID (required)
         */
        public Builder clientId(String clientId) {
            this.clientId = clientId;
            return this;
        }

        /**
         * OAuth client secret (required)
         */
        public Builder clientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
            return this;
        }

        /**
         * OAuth scope(s) to request (optional)
         */
        public Builder scope(String scope) {
            this.scope = scope;
            return this;
        }

        /**
         * How early to refresh token before expiry (default: 60 seconds)
         */
        public Builder refreshBuffer(Duration refreshBuffer) {
            this.refreshBuffer = refreshBuffer;
            return this;
        }

        /**
         * Connection timeout for token requests (default: 10 seconds)
         */
        public Builder connectTimeout(Duration timeout) {
            this.connectTimeout = timeout;
            return this;
        }

        /**
         * Per-request timeout for token requests (default: 30 seconds)
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

        public OAuthTokenProvider build() {
            if (tokenUrl == null || tokenUrl.isBlank()) {
                throw new IllegalStateException("tokenUrl is required");
            }
            if (clientId == null || clientId.isBlank()) {
                throw new IllegalStateException("clientId is required");
            }
            if (clientSecret == null || clientSecret.isBlank()) {
                throw new IllegalStateException("clientSecret is required");
            }
            return new OAuthTokenProvider(this);
        }
    }
}
