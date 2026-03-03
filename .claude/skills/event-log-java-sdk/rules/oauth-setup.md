---
title: OAuth Client Credentials Setup
impact: HIGH
impactDescription: missing or incorrect OAuth config prevents API authentication in production
tags: oauth, authentication, client-credentials, token-caching
---

## OAuth Client Credentials Setup

Production deployments use OAuth client credentials flow for API authentication. The SDK handles token caching and proactive refresh automatically. Misconfiguring OAuth or using API keys in production is a security and reliability risk.

**Incorrect (using api-key in production, hardcoding secrets):**

```yaml
# WRONG — api-key is for development only
eventlog:
  api-key: my-production-key

# WRONG — never hardcode secrets
eventlog:
  oauth:
    client-secret: my-actual-secret-value
```

**Correct (Spring Boot with externalized secret):**

```yaml
eventlog:
  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read
    refresh-buffer: 60s
```

**Correct (programmatic setup):**

```java
OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
    .tokenUrl("https://auth.yourcompany.com/oauth/token")
    .clientId("your-client-id")
    .clientSecret("your-client-secret")
    .scope("eventlog:write eventlog:read")
    .build();

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .tokenProvider(tokenProvider)
    .build();
```

The token is cached until near expiry and refreshed proactively (60s buffer by default). The provider is thread-safe — multiple threads can share one instance. For dev/testing environments, use `eventlog.api-key: dev-key` instead of OAuth.
