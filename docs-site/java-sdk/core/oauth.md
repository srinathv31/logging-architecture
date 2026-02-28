---
title: OAuth Provider
---

# OAuth Token Provider

The `OAuthTokenProvider` handles OAuth 2.0 client credentials flow with automatic token caching and refresh.

## Setup

```java
OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
    .tokenUrl("https://auth.yourcompany.com/oauth/token")
    .clientId("your-client-id")
    .clientSecret("your-client-secret")
    .scope("eventlog:write eventlog:read")  // optional
    .build();

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .tokenProvider(tokenProvider)
    .build();
```

## Spring Boot Configuration

```yaml
eventlog:
  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read
    refresh-buffer: 60s
    connect-timeout: 10s
    request-timeout: 30s
```

## Token Caching

The provider automatically:

- Caches the access token until near expiry
- Refreshes the token proactively (configurable via `refresh-buffer`, default 60s before expiry)
- Thread-safe — multiple threads can share one provider

## API Key Alternative

For development and testing, use a static API key instead of OAuth:

```java
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .apiKey("your-api-key")
    .build();
```

Or via Spring Boot properties:

```yaml
eventlog:
  api-key: your-api-key  # dev/testing only
```
