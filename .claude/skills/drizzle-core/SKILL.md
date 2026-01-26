---
name: drizzle-core
description: Core Drizzle ORM schema definition patterns and best practices. This skill should be used when defining database schemas, creating tables, setting up relationships, or configuring constraints in Drizzle ORM. Triggers on tasks involving schema design, table creation, foreign keys, indexes, or database modeling.
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Drizzle Core Schema Patterns

Comprehensive schema definition guide for Drizzle ORM, applicable across all supported databases (PostgreSQL, MySQL, SQLite, MSSQL). Contains 9 rules across 3 categories focused on building type-safe, well-structured database schemas.

## When to Apply

Reference these guidelines when:
- Defining new database tables with Drizzle ORM
- Setting up primary keys (single or composite)
- Creating foreign key relationships between tables
- Adding indexes for query performance
- Implementing constraints (unique, check, not null)
- Configuring default values for columns
- Setting up Drizzle relations for type-safe queries

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Schema Definition | CRITICAL | `schema-` |
| 2 | Constraints | HIGH | `schema-` |
| 3 | Performance | MEDIUM | `schema-` |

## Quick Reference

### 1. Schema Definition (CRITICAL)

- `schema-table-definition` - Define tables with proper structure and exports
- `schema-column-modifiers` - Use .notNull(), .default(), .$type<>() correctly
- `schema-primary-keys` - Single and composite primary key patterns

### 2. Constraints (HIGH)

- `schema-foreign-keys` - Foreign key relationships and self-references
- `schema-unique-constraints` - Single and composite unique constraints
- `schema-check-constraints` - Data validation with check constraints
- `schema-default-values` - Static, SQL expression, and function defaults

### 3. Performance & Relations (MEDIUM-HIGH)

- `schema-indexes` - Index creation for query optimization
- `schema-relations` - Drizzle relations for type-safe joins

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/schema-table-definition.md
rules/schema-primary-keys.md
rules/schema-foreign-keys.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and variations

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
