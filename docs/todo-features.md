# Future Features

## SLA Enforcement for IN_PROGRESS Processes

### Problem
When a process uses `awaitCompletion` (PROCESS_START with `status=IN_PROGRESS`), it stays in that state until a `PROCESS_END` event resolves it. If the resolution never comes (e.g., human approval forgotten, downstream system down), the process silently stays IN_PROGRESS forever.

### Solution: Scheduled SLA Check

Use the `sla_ms` column from `process_definitions` to detect stale IN_PROGRESS processes.

#### Scheduled Job
- Runs on a configurable interval (e.g., every 5 minutes)
- Queries for processes where:
  - Latest event is `PROCESS_START` or `STEP` with `status=IN_PROGRESS`
  - No `PROCESS_END` event exists for the same `correlation_id`
  - `DATEDIFF(ms, created_at, GETDATE()) > sla_ms`
- Marks these as **SLA-breached** (metadata flag, not status change)

#### Dashboard Warning Badges
- Processes exceeding SLA show a warning badge (amber clock icon)
- Filterable: "Show SLA-breached processes only"
- Tooltip shows: time elapsed, SLA threshold, how long overdue

#### Notification Options
- **Webhook**: POST to a configurable URL when SLA is breached
- **Email digest**: Daily summary of all SLA-breached processes
- **Slack integration**: Real-time alerts via incoming webhook

### Implementation Notes
- Process status is **derived** at query time (`PROCESS_END` status wins), so SLA enforcement is read-only — it never modifies event data
- The `process_definitions` table already has `sla_ms` — just needs to be populated per process type
- Consider a `sla_breached_at` timestamp in a separate tracking table to avoid re-alerting
