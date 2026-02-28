---
title: Correlation Links
---

# Correlation Links

Link correlation IDs to accounts after account creation.

## Creating a Link

```typescript
await client.createCorrelationLink({
  correlation_id: 'corr-emp-20250126-a1b2c3',
  account_id: 'AC-EMP-001234',
  application_id: 'APP-998877',
  customer_id: 'EMP-456',
});
```

## Use Case

When a process creates a new account, the correlation ID is known before the account ID. After account creation, link them so that:

1. Events logged before account creation (using only `correlation_id`) become queryable by `account_id`
2. The dashboard can show all events for an account, including those from before the account was created

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `correlation_id` | Yes | The process correlation ID (1-200 chars) |
| `account_id` | Yes | The account identifier (1-64 chars) |
| `application_id` | No | Application identifier (max 100 chars) |
| `customer_id` | No | Customer/employee identifier (max 100 chars) |
| `card_number_last4` | No | Last 4 digits of card (exactly 4 chars) |
