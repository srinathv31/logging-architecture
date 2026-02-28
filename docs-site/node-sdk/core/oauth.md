---
title: OAuth Provider
---

# OAuth Token Provider

The `OAuthTokenProvider` handles OAuth 2.0 client credentials flow with automatic token caching.

## Setup

```typescript
import { OAuthTokenProvider, EventLogClient } from '@yourcompany/eventlog-sdk';

const tokenProvider = new OAuthTokenProvider({
  tokenUrl: 'https://auth.yourcompany.com/oauth/token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scope: 'eventlog:write eventlog:read',  // optional
});

const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  tokenProvider,
});
```

## Token Caching

The provider automatically:

- Caches the access token until near expiry
- Refreshes the token proactively before it expires
- Thread-safe — multiple concurrent requests share one token

## API Key Alternative

For development and testing, use a static API key instead:

```typescript
const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  apiKey: 'your-api-key',
});
```
