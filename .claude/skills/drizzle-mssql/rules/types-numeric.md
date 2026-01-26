---
title: MSSQL Numeric Types
impact: MEDIUM
impactDescription: ensures precise decimal calculations and appropriate floating-point usage
tags: mssql, numeric, decimal, float, real, money
---

## MSSQL Numeric Types

MSSQL provides exact numeric types (decimal/numeric) and approximate types (float/real). Choose exact types for financial data and approximate types for scientific calculations.

**Numeric types overview:**

| Type | Precision | Use Case |
|------|-----------|----------|
| decimal(p,s) / numeric(p,s) | Exact, user-defined | Financial, precise calculations |
| float(n) | Approximate, 15 digits | Scientific data, large ranges |
| real | Approximate, 7 digits | Scientific data, smaller precision |

**Incorrect (using float for money):**

```typescript
export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  // NEVER use float for money - rounding errors!
  total: float('total'),
  // Real has even less precision
  tax: real('tax'),
});
// 0.1 + 0.2 !== 0.3 with floating point!
```

**Correct (decimal for money):**

```typescript
import { mssqlTable, int, decimal, float, real } from 'drizzle-orm/mssql-core';

export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  // decimal for exact financial calculations
  // precision 10, scale 2 = up to 99,999,999.99
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 4 }),  // e.g., 0.0825
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
});

export const measurements = mssqlTable('measurements', {
  id: int('id').primaryKey(),
  // float for scientific data where approximation is acceptable
  latitude: float('latitude'),
  longitude: float('longitude'),
  // real for less precision needs
  temperature: real('temperature'),
});
```

**Decimal precision and scale:**

```typescript
// precision = total digits, scale = digits after decimal
export const products = mssqlTable('products', {
  id: int('id').primaryKey(),
  // decimal(10, 2): 10 total digits, 2 after decimal
  // Max: 99,999,999.99
  price: decimal('price', { precision: 10, scale: 2 }),

  // decimal(5, 4): 5 total digits, 4 after decimal
  // Max: 9.9999 (for percentages like 0.0825)
  discountRate: decimal('discount_rate', { precision: 5, scale: 4 }),

  // decimal(19, 4): common for financial applications
  // Max: 999,999,999,999,999.9999
  amount: decimal('amount', { precision: 19, scale: 4 }),
});
```

**Float precision:**

```typescript
export const scientific = mssqlTable('scientific', {
  id: int('id').primaryKey(),
  // float(24) = real, 7 digits precision, 4 bytes
  measurement: float('measurement', { precision: 24 }),

  // float(53) = double precision, 15 digits, 8 bytes (default)
  precise: float('precise', { precision: 53 }),

  // Shorthand without precision uses float(53)
  value: float('value'),
});
```

**Type safety with $type:**

```typescript
export const transactions = mssqlTable('transactions', {
  id: int('id').primaryKey(),
  // Decimal returns string by default for precision
  // Use $type to cast if you want number (with precision loss risk)
  amount: decimal('amount', { precision: 10, scale: 2 })
    .notNull()
    .$type<number>(),
});
```

**Guidelines:**
- Always use `decimal` for money and financial calculations
- Use `decimal` when exact representation matters
- Use `float` for scientific data, coordinates, or when range is more important than precision
- Choose precision and scale based on your maximum expected values
- Remember: decimal is returned as string in Drizzle to preserve precision
