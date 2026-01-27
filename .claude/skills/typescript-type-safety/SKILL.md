---
name: typescript-type-safety
description: TypeScript type inference and safety patterns. Apply when writing code that needs type narrowing, safe indexing, exhaustive checks, or when deciding between explicit annotations and inference. Triggers on narrowing logic, switch statements over union types, array/object access, or tsconfig strict settings.
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# TypeScript Type Safety Patterns

Practical type inference and safety patterns for everyday TypeScript development. Contains 10 rules across 4 categories focused on narrowing, inference decisions, compiler configuration, and exhaustive checking.

## When to Apply

Reference these guidelines when:
- Writing `typeof`, `instanceof`, or `in` checks for type narrowing
- Handling discriminated unions or tagged unions
- Using `switch` statements on union types
- Accessing array elements or object properties dynamically
- Deciding whether to add explicit type annotations
- Using `as const` or `satisfies` for literal types
- Configuring tsconfig.json strict settings
- Creating exhaustive handlers for all union variants

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Type Narrowing | CRITICAL | `narrow-` |
| 2 | Inference Patterns | HIGH | `infer-` |
| 3 | Compiler Config | HIGH | `config-` |
| 4 | Safety Utilities | MEDIUM | `safety-` |

## Quick Reference

### 1. Type Narrowing (CRITICAL)

- `narrow-typeof-guards` - Use typeof for primitives, beware null returns "object"
- `narrow-instanceof-guards` - Use instanceof for class instances and Error subclasses
- `narrow-discriminated-unions` - Tagged unions with discriminant properties
- `narrow-in-operator` - Property existence narrowing with "in"

### 2. Inference Patterns (HIGH)

- `infer-when-to-annotate` - Annotate params/exports, let TS infer locals/returns
- `infer-satisfies-operator` - Type validation while preserving literal inference (TS 4.9+)
- `infer-const-assertions` - Readonly tuples and literal preservation with as const

### 3. Compiler Config (HIGH)

- `config-strict-mode` - Enable strict mode and understand its flags
- `config-unchecked-index-access` - T | undefined for array/object dynamic access

### 4. Safety Utilities (MEDIUM)

- `safety-exhaustive-never` - Use never type for exhaustive switch/if-else checks

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/narrow-typeof-guards.md
rules/narrow-discriminated-unions.md
rules/infer-satisfies-operator.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and variations

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
