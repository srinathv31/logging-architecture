---
title: Error Handling
---

# Error Handling

## Error Response Format

All errors return a consistent JSON response:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    {
      "field": "correlationId",
      "message": "Required"
    }
  ]
}
```

## Error Types

### Validation Errors (400)

Zod schema validation failures return detailed field-level error messages:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "correlationId: String must contain at least 1 character(s); traceId: String must contain exactly 32 character(s)"
}
```

### Conflict Errors (409)

Duplicate unique constraint violations (e.g., duplicate idempotency key):

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "A record with this value already exists"
}
```

### Internal Errors (500)

Unhandled exceptions return a generic error:

```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Retry Behavior

Both SDKs automatically retry on:

- **5xx** server errors — transient failures
- **429** rate limit responses — too many requests

Retries use exponential backoff. The `AsyncEventLogger` adds circuit breaker logic on top.

## Enums

### Event Type

| Value | Description |
|-------|-------------|
| `PROCESS_START` | Beginning of a business process |
| `STEP` | Individual step within a process |
| `PROCESS_END` | End of a business process |
| `ERROR` | Error event |

### Event Status

| Value | Description |
|-------|-------------|
| `SUCCESS` | Step completed successfully |
| `FAILURE` | Step failed |
| `IN_PROGRESS` | Step is still running |
| `SKIPPED` | Step was skipped |
| `WARNING` | Step completed with warnings |

### HTTP Method

`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`
