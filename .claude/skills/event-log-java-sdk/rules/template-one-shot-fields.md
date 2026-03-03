---
title: One-Shot vs Persistent Fields
impact: HIGH
impactDescription: misunderstanding one-shot vs persistent fields causes data leaking between steps
tags: template, one-shot, persistent, fields, auto-clear
---

## One-Shot vs Persistent Fields

Persistent fields (withCorrelationId, addIdentifier, addMetadata) apply to ALL subsequent events. One-shot fields (withEndpoint, withHttpMethod, withExecutionTimeMs, withRequestPayload, etc.) apply to the NEXT emit only, then auto-clear.

**Incorrect (setting endpoint/httpMethod and expecting them on all subsequent events):**

```java
process.withEndpoint("/api/v2/partners/verify")
    .withHttpMethod(HttpMethod.POST);

process.logStep(1, "Partner Verify", EventStatus.SUCCESS, "Verified", "OK");
// endpoint and httpMethod are present here ✓

process.logStep(2, "Transform Data", EventStatus.SUCCESS, "Transformed", "OK");
// BUG: endpoint and httpMethod are null here — they were one-shot fields!
```

**Correct (set one-shot fields before each step that needs them):**

```java
// One-shot fields: set before each step that needs them
process.withEndpoint("/api/v2/partners/verify")
    .withHttpMethod(HttpMethod.POST)
    .withHttpStatusCode(response.statusCode())
    .withRequestPayload(requestBody)
    .withResponsePayload(response.body())
    .withExecutionTimeMs((int) duration.toMillis())
    .logStep(1, "Partner Verify", EventStatus.SUCCESS, "Verified", "OK");

// Next step — all one-shot fields are automatically cleared
process.logStep(2, "Transform Data", EventStatus.SUCCESS, "Transformed", "OK");
// endpoint, httpMethod, httpStatusCode, payloads, executionTimeMs are all null here
```

### Persistent fields (apply to all subsequent events):

| Method |
|--------|
| `withCorrelationId` |
| `withTraceId` |
| `withSpanId` |
| `withBatchId` |
| `withAccountId` |
| `addIdentifier` |
| `addMetadata` |

### One-shot fields (apply to the next emit only, then auto-clear):

| Method |
|--------|
| `withTargetSystem` |
| `withEndpoint` |
| `withHttpMethod` |
| `withHttpStatusCode` |
| `withSpanLinks` |
| `withRequestPayload` |
| `withResponsePayload` |
| `withExecutionTimeMs` |
| `withIdempotencyKey` |
| `withErrorCode` |
| `withErrorMessage` |
