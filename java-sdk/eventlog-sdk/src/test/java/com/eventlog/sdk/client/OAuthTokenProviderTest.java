package com.eventlog.sdk.client;

import com.eventlog.sdk.client.OAuthTokenProvider.OAuthException;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OAuthTokenProviderTest {

    @SuppressWarnings("unchecked")
    private HttpClient mockHttpClient(int statusCode, String body) throws Exception {
        HttpClient httpClient = mock(HttpClient.class);
        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(statusCode);
        when(httpResponse.body()).thenReturn(body);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);
        return httpClient;
    }

    @Test
    void getTokenFetchesAndCachesToken() throws Exception {
        HttpClient httpClient = mockHttpClient(200,
                "{\"access_token\":\"tok-123\",\"token_type\":\"Bearer\",\"expires_in\":3600}");

        OAuthTokenProvider provider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.test/token")
                .clientId("client-id")
                .clientSecret("client-secret")
                .httpClient(httpClient)
                .build();

        String token1 = provider.getToken();
        assertEquals("tok-123", token1);

        // Second call should use cache (no additional HTTP call)
        String token2 = provider.getToken();
        assertEquals("tok-123", token2);

        // Verify only one HTTP request was made
        verify(httpClient, times(1)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void invalidateTokenForcesRefresh() throws Exception {
        HttpClient httpClient = mockHttpClient(200,
                "{\"access_token\":\"tok-first\",\"token_type\":\"Bearer\",\"expires_in\":3600}");

        OAuthTokenProvider provider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.test/token")
                .clientId("client-id")
                .clientSecret("client-secret")
                .httpClient(httpClient)
                .build();

        String first = provider.getToken();
        assertEquals("tok-first", first);

        // Set up second response
        @SuppressWarnings("unchecked")
        HttpResponse<String> secondResponse = mock(HttpResponse.class);
        when(secondResponse.statusCode()).thenReturn(200);
        when(secondResponse.body()).thenReturn("{\"access_token\":\"tok-second\",\"token_type\":\"Bearer\",\"expires_in\":3600}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(secondResponse);

        provider.invalidateToken();
        String second = provider.getToken();
        assertEquals("tok-second", second);

        verify(httpClient, times(2)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void fetchTokenThrowsOnNon200Status() throws Exception {
        HttpClient httpClient = mockHttpClient(401, "Unauthorized");

        OAuthTokenProvider provider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.test/token")
                .clientId("client-id")
                .clientSecret("client-secret")
                .httpClient(httpClient)
                .build();

        OAuthException ex = assertThrows(OAuthException.class, provider::getToken);
        assertTrue(ex.getMessage().contains("401"));
    }

    @Test
    void fetchTokenThrowsOnMissingAccessToken() throws Exception {
        HttpClient httpClient = mockHttpClient(200, "{\"token_type\":\"Bearer\",\"expires_in\":3600}");

        OAuthTokenProvider provider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.test/token")
                .clientId("client-id")
                .clientSecret("client-secret")
                .httpClient(httpClient)
                .build();

        OAuthException ex = assertThrows(OAuthException.class, provider::getToken);
        assertTrue(ex.getMessage().contains("missing access_token"));
    }

    @Test
    void fetchTokenThrowsOnBlankAccessToken() throws Exception {
        HttpClient httpClient = mockHttpClient(200, "{\"access_token\":\"  \",\"token_type\":\"Bearer\",\"expires_in\":3600}");

        OAuthTokenProvider provider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.test/token")
                .clientId("client-id")
                .clientSecret("client-secret")
                .httpClient(httpClient)
                .build();

        OAuthException ex = assertThrows(OAuthException.class, provider::getToken);
        assertTrue(ex.getMessage().contains("missing access_token"));
    }

    @Test
    void getTokenWithScopeIncludesScopeInRequest() throws Exception {
        HttpClient httpClient = mockHttpClient(200,
                "{\"access_token\":\"tok-scoped\",\"token_type\":\"Bearer\",\"expires_in\":3600}");

        OAuthTokenProvider provider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.test/token")
                .clientId("client-id")
                .clientSecret("client-secret")
                .scope("eventlog:write eventlog:read")
                .httpClient(httpClient)
                .build();

        assertEquals("tok-scoped", provider.getToken());
    }

    @Test
    void builderValidationThrowsOnMissingTokenUrl() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> OAuthTokenProvider.builder()
                        .clientId("id")
                        .clientSecret("secret")
                        .build());
        assertTrue(ex.getMessage().contains("tokenUrl"));
    }

    @Test
    void builderValidationThrowsOnMissingClientId() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> OAuthTokenProvider.builder()
                        .tokenUrl("https://auth.test/token")
                        .clientSecret("secret")
                        .build());
        assertTrue(ex.getMessage().contains("clientId"));
    }

    @Test
    void builderValidationThrowsOnMissingClientSecret() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> OAuthTokenProvider.builder()
                        .tokenUrl("https://auth.test/token")
                        .clientId("id")
                        .build());
        assertTrue(ex.getMessage().contains("clientSecret"));
    }

    @Test
    void fetchTokenWrapsIOExceptionInOAuthException() throws Exception {
        HttpClient httpClient = mock(HttpClient.class);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new java.io.IOException("Network error"));

        OAuthTokenProvider provider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.test/token")
                .clientId("client-id")
                .clientSecret("client-secret")
                .httpClient(httpClient)
                .build();

        OAuthException ex = assertThrows(OAuthException.class, provider::getToken);
        assertTrue(ex.getMessage().contains("Failed to fetch OAuth token"));
        assertNotNull(ex.getCause());
    }
}
