package com.eventlog.sdk.client;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StaticTokenProviderTest {

    @Test
    void getTokenReturnsStaticValue() {
        StaticTokenProvider provider = new StaticTokenProvider("my-api-key");
        assertEquals("my-api-key", provider.getToken());
        // Ensure stable across multiple calls
        assertEquals("my-api-key", provider.getToken());
    }

    @Test
    void constructorRejectsNull() {
        assertThrows(IllegalArgumentException.class, () -> new StaticTokenProvider(null));
    }

    @Test
    void constructorRejectsBlank() {
        assertThrows(IllegalArgumentException.class, () -> new StaticTokenProvider(""));
        assertThrows(IllegalArgumentException.class, () -> new StaticTokenProvider("   "));
    }

    @Test
    void tokenProviderOfCreatesStaticProvider() {
        TokenProvider provider = TokenProvider.of("test-token");
        assertInstanceOf(StaticTokenProvider.class, provider);
        assertEquals("test-token", provider.getToken());
    }
}
