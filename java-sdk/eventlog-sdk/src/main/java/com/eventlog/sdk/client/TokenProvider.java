package com.eventlog.sdk.client;

/**
 * Interface for providing authentication tokens to the EventLogClient
 * 
 * <p>Implement this interface to provide custom authentication mechanisms.
 * The SDK provides two built-in implementations:</p>
 * 
 * <ul>
 *   <li>{@link OAuthTokenProvider} - OAuth 2.0 client credentials flow</li>
 *   <li>{@link StaticTokenProvider} - Static API key (for development/testing)</li>
 * </ul>
 */
@FunctionalInterface
public interface TokenProvider {

    /**
     * Get a valid authentication token
     * 
     * <p>Implementations should handle token caching and refresh as needed.
     * This method may be called frequently and should be efficient.</p>
     * 
     * @return A valid bearer token (without "Bearer " prefix)
     * @throws RuntimeException if token cannot be obtained
     */
    String getToken();

    /**
     * Create a static token provider (for API keys or testing)
     * 
     * @param token The static token value
     * @return A TokenProvider that always returns the same token
     */
    static TokenProvider of(String token) {
        return new StaticTokenProvider(token);
    }
}
