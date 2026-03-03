---
title: Event Model
---

# Event Model

Every event log entry follows a consistent schema. This page explains the key fields you'll set when logging events, the event lifecycle types, and how identifiers connect events together.

## Anatomy of an Event

These are the fields you interact with most when logging events through the SDK:

| Field | Required | Description |
|---|---|---|
| `correlation_id` | Yes | Team-defined custom identifier for the process instance (e.g., `add-auth-user-abc123`) |
| `trace_id` | Yes | Primary process identifier (32 lowercase hex chars) — same across all events in a process |
| `process_name` | Yes | Business process identifier (e.g., `ORDER_PROCESSING`) |
| `step_sequence` | No | Step order within the process (0, 1, 2, ...) |
| `step_name` | No | Human-readable step description (e.g., "Validate Order") |
| `event_type` | Yes | `PROCESS_START`, `STEP`, `PROCESS_END`, or `ERROR` |
| `event_status` | Yes | `SUCCESS`, `FAILURE`, `IN_PROGRESS`, or `SKIPPED` |
| `summary` | Yes | Human-readable narrative of what happened |
| `result` | Yes | Structured outcome label (e.g., `VALIDATED`, `COMPLETED`) |
| `identifiers` | Yes | JSON object with business IDs (order_id, customer_id, etc.) |
| `application_id` | Yes | Source application that logged this event |
| `event_timestamp` | Yes | When the event occurred (set by your application) |
| `execution_time_ms` | No | How long this step took in milliseconds |
| `error_code` | No | Standardized error code when something fails |
| `error_message` | No | Error details |

::: tip SDK handles the boilerplate
When using the Java or Node SDK, fields like `correlation_id`, `trace_id`, `application_id`, and `event_timestamp` are set automatically. You focus on the business-specific fields: `process_name`, `step_name`, `summary`, and `identifiers`.
:::

## Event Types

Each event has a type that describes its role in the process lifecycle:

| Event Type | Description | When to Use |
|---|---|---|
| `PROCESS_START` | Marks the beginning of a business process | First event in a process. Step sequence is typically `0`. |
| `STEP` | An individual step within the process | Each discrete action: validation, API call, database write, etc. |
| `PROCESS_END` | Marks the completion of a business process | Final event when the process finishes (success or failure). |
| `ERROR` | Catch-all for unhandled exceptions | Catch-all for unhandled exceptions only. `step_sequence` and `step_name` are always `null`. For known business errors, use a `STEP` with `FAILURE` status instead. |

A typical successful process looks like:

```
PROCESS_START → STEP → STEP → ... → PROCESS_END
```

A process that fails at step 2 with a **known business error** (e.g., out of stock):

```
PROCESS_START → STEP (success) → STEP (failure) → PROCESS_END (failure)
```

A process that fails with an **unhandled exception** (e.g., NullPointerException):

```
PROCESS_START → STEP → ... → ERROR
```

::: tip Why two failure patterns?
Known business errors use `STEP (failure)` + `PROCESS_END (failure)` to preserve step context — `step_sequence` and `step_name` tell AI agents exactly which step failed and why. The `ERROR` type is reserved for unhandled exceptions where step context is unavailable by design — when an AI agent sees `step_sequence: null`, it knows the failure was unexpected and should escalate to a human.
:::

## Event Statuses

Each event carries a status indicating its outcome:

| Status | Description |
|---|---|
| `SUCCESS` | The step completed successfully |
| `FAILURE` | The step failed |
| `IN_PROGRESS` | The step is still running (used with `PROCESS_START` when awaiting completion) |
| `SKIPPED` | The step was intentionally skipped |

## Identifier Hierarchy

Events are connected through a set of identifiers. `trace_id` and `correlation_id` are **parallel** — both scope to a single process instance, they don't nest inside each other.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       IDENTIFIER HIERARCHY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  batch_id (optional)                                                    │
│  └── Groups multiple process instances from one batch operation         │
│      Example: CSV upload of 100 orders                                  │
│                                                                         │
│      ├── trace_id (1 per process instance)                              │
│      │   Primary process identifier — system-generated, 32 hex chars    │
│      │   The dashboard groups and queries by this field                  │
│      │                                                                  │
│      └── correlation_id (1 per process instance)  ← parallel to trace   │
│          Team-defined custom label for human readability                 │
│          Example: add-auth-user-jkljerw3i2                              │
│          Links processes to accounts via correlation_links              │
│                                                                         │
│      span_id / parent_span_id (1 per operation within a trace)          │
│      └── Each step or downstream call gets its own span                 │
│          parent_span_id creates the call hierarchy                      │
│                                                                         │
│          span_links (for fork-join)                                     │
│          └── References spans this operation waited for                 │
│              Used when multiple parallel spans must complete             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### When to Use Each Identifier

| Identifier | Scope | Description | Example |
|---|---|---|---|
| `batch_id` | Multiple processes | Groups multiple process instances into a single batch | `batch-20250126-hr-upload` |
| `trace_id` | Single process instance | Primary identifier — same across all events in a business process. The dashboard groups and queries by this field. 32 lowercase hex chars. | `4bf92f3577b34da6a3ce929d0e0e4736` |
| `correlation_id` | Single process instance | Team-defined custom label for human readability. Teams typically prepend their app/process name (e.g., `add-auth-user-jkljerw3i2`). Also used to link to accounts via correlation_links. | `add-auth-user-jkljerw3i2` |
| `span_id` | Single operation | Each step/call within a trace | `a1b2c3d4e5f60001` |
| `parent_span_id` | Call hierarchy | Creates parent-child relationships between spans | Points to the triggering span |
| `span_links` | Fork-join dependencies | References spans this operation waited for | `["span-003", "span-004"]` |

### Understanding the Relationships

- **`trace_id` and `correlation_id` are parallel** — both identify the same process instance. They don't nest; they sit side-by-side.
- **`trace_id` is the system identifier** — machine-friendly, auto-generated, and the primary key in the dashboard. All events in a process share the same `trace_id`, even across multiple HTTP requests.
- **`correlation_id` is the team identifier** — human-friendly, with a custom prefix chosen by the team (e.g., `add-auth-user-...`). Used for human readability and to link processes to accounts via correlation_links.
- **One `trace_id`** contains **multiple `span_id`s** — within a process, each step or downstream call gets its own span.
- **`batch_id`** groups multiple process instances — each with their own `trace_id` + `correlation_id`. Only use it when a single action triggers multiple independent processes (e.g., bulk CSV import).

## Writing Good Summaries

The `summary` field is the most important human-facing field. It should be a **complete, standalone narrative** that anyone can understand without parsing other fields.

**Good summaries:**
| Summary | Why It's Good |
|---|---|
| `"Validated order #1234 — 3 items, total $89.97, shipping to CA"` | Includes the business entity, outcome, and key details |
| `"Reserved inventory for 3 items at warehouse WH-EAST"` | Describes what happened and where |
| `"Order processing failed — item SKU-5678 out of stock at all warehouses"` | Clear failure reason with specific business context |

**Bad summaries:**
| Summary | Why It's Bad |
|---|---|
| `"Step completed"` | No context — which step? what happened? |
| `"Success"` | No information about what succeeded |
| `"Called inventory service"` | Missing the outcome — did it work? what was the result? |

::: tip Rule of thumb
Read your summary and ask: *"Could a support engineer understand what happened without looking at any other field?"* If not, add more context.
:::

## The Identifiers Bag

The `identifiers` field is a flexible JSON object where you store business-specific IDs for lookup:

```json
{
  "order_id": "ORD-2025-1234",
  "customer_id": "CUST-5678",
  "warehouse_id": "WH-EAST"
}
```

Identifiers serve two purposes:

1. **Search** — Find all events related to a specific order, customer, or account
2. **Context** — Provide business context alongside each event

Identifiers are **additive** within a process. When using the SDK, identifiers added to a `ProcessLogger` carry forward to all subsequent events:

```java
ProcessLogger process = template.forProcess("ORDER_PROCESSING")
    .addIdentifier("order_id", "ORD-2025-1234");

// Step 1 has: { order_id: "ORD-2025-1234" }
process.logStep(1, "Validate", EventStatus.SUCCESS, "Order validated");

// Add more identifiers as you learn them
process.addIdentifier("warehouse_id", "WH-EAST");

// Step 2 has: { order_id: "ORD-2025-1234", warehouse_id: "WH-EAST" }
process.logStep(2, "Reserve", EventStatus.SUCCESS, "Inventory reserved");
```

## Next Steps

- [Your First Trace](/concepts/your-first-trace) — See a complete end-to-end example with Java SDK code and resulting event data
- [EventLogTemplate](/java-sdk/core/event-log-template) — Full API reference for the Java SDK
- [REST API Events](/api/endpoints/events) — Direct API endpoint for creating events
