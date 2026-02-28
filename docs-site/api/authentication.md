---
title: Authentication
---

# Authentication

## Current State

The API currently has **no authentication middleware**. All endpoints are publicly accessible. Authentication should be added before production deployment.

## SDK Authentication

Both SDKs support two authentication methods for communicating with the API:

### OAuth 2.0 Client Credentials (Recommended)

::: code-group

```java [Java]
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

```typescript [TypeScript]
const tokenProvider = new OAuthTokenProvider({
  tokenUrl: 'https://auth.yourcompany.com/oauth/token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scope: 'eventlog:write eventlog:read',
});

const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  tokenProvider,
});
```

:::

### API Key (Development Only)

::: code-group

```java [Java]
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .apiKey("your-api-key")
    .build();
```

```typescript [TypeScript]
const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  apiKey: 'your-api-key',
});
```

:::

## Database Authentication

The API connects to MSSQL using either:

- **SQL Auth**: Set `DB_USER` and `DB_PASSWORD` environment variables
- **Azure AD MSI**: Set `MSI_ENDPOINT` and `MSI_SECRET` for managed identity authentication in Azure
