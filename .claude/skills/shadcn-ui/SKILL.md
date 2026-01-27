---
name: shadcn-ui
description: Shadcn/UI component patterns for Next.js App Router. Apply when building UI components, forms, data tables, or charts in projects using shadcn/ui. Triggers on requests for buttons, cards, dialogs, forms, tables, charts, or any UI that shadcn provides.
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Shadcn/UI Patterns for Next.js

Comprehensive guide for using shadcn/ui effectively with Next.js App Router. Contains 19 rules across 9 categories focused on using the CLI, composing from primitives, and following established patterns.

## Critical Principle

**NEVER recreate shadcn primitives.** Always use `npx shadcn@latest add <component>` to install components, then compose custom UI from those primitives.

## When to Apply

Reference these guidelines when:
- Installing or adding shadcn/ui components
- Building forms with validation
- Creating data tables with sorting/filtering/pagination
- Adding charts and data visualization
- Composing custom UI from shadcn primitives
- Styling components with Tailwind and CSS variables
- Working with client/server component boundaries

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | CLI Usage | CRITICAL | `cli-` |
| 2 | Component Composition | CRITICAL | `compose-` |
| 3 | Form Integration | HIGH | `form-` |
| 4 | Data Tables | HIGH | `table-` |
| 5 | Charts | HIGH | `chart-` |
| 6 | Styling Patterns | HIGH | `style-` |
| 7 | App Router Integration | HIGH | `nextjs-` |
| 8 | Accessibility | MEDIUM | `a11y-` |
| 9 | Extension Patterns | MEDIUM | `extend-` |

## Quick Reference

### 1. CLI Usage (CRITICAL)
- `cli-install-components` - Always use CLI to add components, never recreate
- `cli-init-project` - Proper project initialization with shadcn

### 2. Component Composition (CRITICAL)
- `compose-from-primitives` - Build custom UI from existing shadcn components
- `compose-compound-patterns` - Understand compound component API (asChild, slots)

### 3. Form Integration (HIGH)
- `form-react-hook-form-zod` - react-hook-form + Zod + shadcn Form pattern
- `form-field-components` - FormField, FormItem, FormControl usage

### 4. Data Tables (HIGH)
- `table-tanstack-setup` - TanStack Table + shadcn Table integration
- `table-column-definitions` - Type-safe column definitions
- `table-features` - Sorting, filtering, pagination patterns

### 5. Charts (HIGH)
- `chart-recharts-setup` - ChartContainer setup with responsiveness
- `chart-config-theming` - ChartConfig with CSS variables
- `chart-types` - Bar, Line, Area, Pie, Radar, Radial patterns

### 6. Styling (HIGH)
- `style-cn-utility` - Use cn() for conditional class merging
- `style-css-variables` - Theme with CSS variables, not hardcoded colors

### 7. Next.js Integration (HIGH)
- `nextjs-client-server-boundary` - "use client" directive for interactive components
- `nextjs-loading-patterns` - Skeleton components with Suspense

### 8. Accessibility (MEDIUM)
- `a11y-preserve-radix` - Don't break built-in Radix accessibility

### 9. Extension (MEDIUM)
- `extend-variant-customization` - Add variants with cva safely
- `extend-wrapper-components` - Create wrappers instead of editing ui/ files

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/cli-install-components.md
rules/compose-from-primitives.md
rules/form-react-hook-form-zod.md
```

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
