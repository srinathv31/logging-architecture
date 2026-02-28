---
title: Processes
---

# Process Definitions

## Create Process Definition

`POST /v1/processes`

Register a new process definition with optional SLA tracking.

### Request Body

```json
{
  "processName": "ADD_AUTH_USER",
  "displayName": "Add Authorized User",
  "description": "Adds an authorized user to an existing credit card account",
  "owningTeam": "Identity Team",
  "expectedSteps": 5,
  "slaMs": 30000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `processName` | string | Yes | Process identifier (1-510 chars) |
| `displayName` | string | Yes | Human-readable name (1-510 chars) |
| `description` | string | Yes | Process description |
| `owningTeam` | string | Yes | Team that owns this process (1-200 chars) |
| `expectedSteps` | integer | No | Expected number of steps |
| `slaMs` | integer | No | SLA in milliseconds |

### Response (201)

```json
{
  "processId": 1,
  "processName": "ADD_AUTH_USER",
  "displayName": "Add Authorized User",
  "description": "Adds an authorized user to an existing credit card account",
  "owningTeam": "Identity Team",
  "expectedSteps": 5,
  "slaMs": 30000,
  "isActive": true,
  "createdAt": "2026-03-01T10:00:00.000Z",
  "updatedAt": "2026-03-01T10:00:00.000Z"
}
```

---

## List Processes

`GET /v1/processes`

List all process definitions, optionally filtered by active status.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `isActive` | boolean | — | Filter by active status |

### Response (200)

```json
{
  "processes": [
    {
      "processId": 1,
      "processName": "ADD_AUTH_USER",
      "displayName": "Add Authorized User",
      "description": "Adds an authorized user to an existing credit card account",
      "owningTeam": "Identity Team",
      "expectedSteps": 5,
      "slaMs": 30000,
      "isActive": true,
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ]
}
```
