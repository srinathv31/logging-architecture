package com.eventlog.sdk.client;

/**
 * Static token provider for API keys or testing
 * 
 * <p>Use this for simple API key authentication or in tests where you don't
 * need OAuth token refresh.</p>
 * 
 * <pre>{@code
 * EventLogClient client = EventLogClient.builder()
 *     .baseUrl("https://eventlog-api.yourcompany.com")
 *     .tokenProvider(TokenProvider.of("your-api-key"))
 *     .build();
 * }</pre>
 */
public class StaticTokenProvider implements TokenProvider {

    private final String token;

    public StaticTokenProvider(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("token cannot be null or blank");
        }
        this.token = token;
    }

    @Override
    public String getToken() {
        return token;
    }
}
