---
title: Correlation Links
---

# Correlation Links

## Create Correlation Link

`POST /v1/correlation-links`

Create or update a correlation-to-account mapping. Used to link a process correlation ID to an account after the account is created.

### Request Body

```json
{
  "correlationId": "corr-emp-20250126-a1b2c3",
  "accountId": "AC-EMP-001234",
  "applicationId": "APP-998877",
  "customerId": "EMP-456",
  "cardNumberLast4": "1234"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `correlationId` | string | Yes | Correlation identifier (1-200 chars) |
| `accountId` | string | Yes | Account identifier (1-64 chars) |
| `applicationId` | string | No | Application identifier (max 100 chars) |
| `customerId` | string | No | Customer/employee ID (max 100 chars) |
| `cardNumberLast4` | string | No | Last 4 digits of card (exactly 4 chars) |

### Response (201)

```json
{
  "success": true,
  "correlationId": "corr-emp-20250126-a1b2c3",
  "accountId": "AC-EMP-001234",
  "linkedAt": "2026-03-01T10:15:30.123Z"
}
```

---

## Get Correlation Link

`GET /v1/correlation-links/:correlationId`

Retrieve a correlation link by its correlation ID.

### Response (200)

```json
{
  "correlationId": "corr-emp-20250126-a1b2c3",
  "accountId": "AC-EMP-001234",
  "applicationId": "APP-998877",
  "customerId": "EMP-456",
  "cardNumberLast4": "1234",
  "linkedAt": "2026-03-01T10:15:30.123Z"
}
```
