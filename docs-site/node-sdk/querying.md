---
title: Querying
---

# Querying Events

The SDK provides methods for querying events by account, correlation ID, and trace ID.

## By Account

```typescript
// Get events by account
const accountEvents = await client.getEventsByAccount('AC-1234567890');

// With filters
const filtered = await client.getEventsByAccount('AC-1234567890', {
  start_date: '2025-01-01T00:00:00Z',
  process_name: 'ADD_AUTH_USER',
  event_status: EventStatus.FAILURE,
  page: 1,
  page_size: 50,
});
```

## By Correlation ID

```typescript
const processEvents = await client.getEventsByCorrelation('corr-emp-20250126-a1b2c3');
```

## By Trace ID

```typescript
// Get by trace ID (distributed tracing)
const traceEvents = await client.getEventsByTrace('4bf92f3577b34da6a3ce929d0e0e4736');
```

## Pagination

All query methods support pagination:

```typescript
const page1 = await client.getEventsByAccount('AC-1234567890', {
  page: 1,
  page_size: 20,
});

if (page1.hasMore) {
  const page2 = await client.getEventsByAccount('AC-1234567890', {
    page: 2,
    page_size: 20,
  });
}
```
