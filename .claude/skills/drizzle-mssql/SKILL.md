---
name: drizzle-mssql
description: Microsoft SQL Server specific patterns for Drizzle ORM. This skill should be used when defining schemas for MSSQL databases, choosing MSSQL data types, or configuring MSSQL-specific features. Triggers on tasks involving MSSQL, SQL Server, T-SQL, or when using drizzle-orm/mssql-core.
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Drizzle MSSQL Schema Patterns

MSSQL-specific schema definition guide for Drizzle ORM. Contains 10 rules covering data types, constraints, and patterns unique to Microsoft SQL Server.

## When to Apply

Reference these guidelines when:
- Defining schemas for Microsoft SQL Server databases
- Choosing appropriate MSSQL data types (varchar vs nvarchar, datetime vs datetime2)
- Working with MSSQL-specific features (uniqueidentifier, identity columns)
- Avoiding MSSQL limitations (unique constraints on max-length types)
- Setting up connection pools with the mssql driver

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Data Types | CRITICAL-HIGH | `types-` |
| 2 | Constraints | CRITICAL-HIGH | `constraint-` |
| 3 | Patterns | HIGH | `pattern-` |

## Quick Reference

### 1. Data Types (CRITICAL-HIGH)

- `types-string` - varchar, nvarchar, char, nchar, text, ntext with length considerations
- `types-integer` - int, bigint, smallint, tinyint with modes
- `types-datetime` - datetime, datetime2, date, time, datetimeoffset
- `types-numeric` - decimal, numeric, real, float
- `types-boolean` - bit type for true/false values
- `types-uuid` - uniqueidentifier for GUIDs
- `types-binary` - binary, varbinary for byte data

### 2. Constraints (CRITICAL-HIGH)

- `constraint-unique-limitations` - Cannot use unique on text/ntext/varchar(max)/nvarchar(max)
- `constraint-identity-columns` - Auto-incrementing primary keys

### 3. Patterns (HIGH)

- `pattern-connection-pool` - Proper connection pool setup with async initialization

## MSSQL-Specific Imports

```typescript
import {
  mssqlTable,
  int, bigint, smallint, tinyint,
  varchar, nvarchar, char, nchar, text, ntext,
  datetime, datetime2, date, time, datetimeoffset,
  decimal, numeric, real, float,
  bit,
  uniqueIdentifier,
  binary, varbinary,
  primaryKey, foreignKey, unique, index, uniqueIndex, check,
} from 'drizzle-orm/mssql-core';
```

## Critical MSSQL Limitations

**Cannot create unique constraints or indexes on:**
- `text`
- `ntext`
- `varchar(max)` / `varchar({ length: 'max' })`
- `nvarchar(max)` / `nvarchar({ length: 'max' })`

Always use bounded length strings for columns requiring uniqueness.

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/types-string.md
rules/constraint-unique-limitations.md
rules/pattern-connection-pool.md
```

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
