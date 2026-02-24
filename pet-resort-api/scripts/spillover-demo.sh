#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Paws & Claws Pet Resort — Spillover + Metrics Dashboard Demo
# ═══════════════════════════════════════════════════════════════════════════
#
# A standalone demo focused on the metrics dashboard and the SDK's
# resilience features: queue depth, circuit breaker, bounded disk spillover,
# and automatic background replay on recovery.
#
# Prerequisites:
#   1. Pet Resort API running on :8081  →  cd pet-resort-api && mvn spring-boot:run
#   2. Event Log API running on :3000   →  cd api && pnpm dev
#   3. jq installed                     →  brew install jq
#   4. metrics-dashboard.html open in browser (set polling to 2s)
#
# Usage:  bash scripts/spillover-demo.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/.."
APP_CONFIG="$APP_DIR/src/main/resources/application.yml"

BASE_URL="http://localhost:8081"
EVENTLOG_URL="http://localhost:3000"
METRICS_URL="$BASE_URL/actuator/metrics"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
DIM='\033[2m'
NC='\033[0m' # No Color

step()    { echo -e "\n${CYAN}▸ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
info()    { echo -e "${DIM}  $1${NC}"; }
header()  { echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}  $1${NC}"; echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"; }
pause()   { echo -e "\n${MAGENTA}▸ $1${NC}"; read -r; }

metric() {
  local val
  val=$(curl -sf "$METRICS_URL/$1" 2>/dev/null | jq -r '.measurements[0].value // 0' 2>/dev/null) || val="N/A"
  echo "$val"
}

print_metric() {
  local label=$1 name=$2
  printf "  %-28s %s\n" "$label" "$(metric "$name")"
}

async_cfg_value() {
  local key=$1
  awk -v target_key="$key" '
    function indent_of(s) { match(s, /^ */); return RLENGTH }
    /^[[:space:]]*#/ { next }
    {
      line = $0
      sub(/[[:space:]]+#.*/, "", line)
      if (line ~ /^[[:space:]]*$/) next

      indent = indent_of(line)

      if (line ~ /^eventlog:[[:space:]]*$/) {
        in_eventlog = 1
        in_async = 0
        eventlog_indent = indent
        next
      }

      if (in_eventlog && indent <= eventlog_indent) {
        in_eventlog = 0
        in_async = 0
      }
      if (!in_eventlog) next

      if (line ~ /^[[:space:]]*async:[[:space:]]*$/) {
        in_async = 1
        async_indent = indent
        next
      }

      if (in_async && indent <= async_indent) {
        in_async = 0
      }
      if (!in_async) next

      if (line ~ "^[[:space:]]*" target_key ":[[:space:]]*") {
        sub("^[[:space:]]*" target_key ":[[:space:]]*", "", line)
        gsub(/^["'\'']|["'\'']$/, "", line)
        print line
        exit
      }
    }
  ' "$APP_CONFIG"
}

cfg_current_or_default() {
  local key=$1
  local fallback=$2
  local val
  val=$(async_cfg_value "$key")
  if [ -n "$val" ]; then
    echo "$val"
  else
    echo "(dflt) $fallback"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
header "Phase 1: Setup Checks"
echo "Verifying services and preparing the dashboard..."
# ═══════════════════════════════════════════════════════════════════════════

step "Checking Pet Resort API on :8081..."
if curl -sf "$BASE_URL/actuator/health" > /dev/null 2>&1; then
  success "Pet Resort API is running"
else
  echo -e "${RED}✗ Pet Resort API not reachable at $BASE_URL/actuator/health${NC}"
  echo -e "${RED}  Start it:  cd pet-resort-api && mvn spring-boot:run${NC}"
  exit 1
fi

step "Checking Event Log API on :3000..."
if curl -sf "$EVENTLOG_URL/v1/healthcheck" > /dev/null 2>&1; then
  success "Event Log API is running"
else
  echo -e "${RED}✗ Event Log API not reachable at $EVENTLOG_URL/v1/healthcheck${NC}"
  echo -e "${RED}  Start it:  cd api && pnpm dev${NC}"
  exit 1
fi

step "Checking jq..."
if command -v jq &> /dev/null; then
  success "jq is installed"
else
  echo -e "${RED}✗ jq not found — brew install jq${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Open metrics-dashboard.html in your browser now.${NC}"
echo -e "${YELLOW}  Set the polling interval to 2s for real-time updates.${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

step "Baseline metrics snapshot:"
echo -e "  ${BOLD}SDK Metrics${NC}"
print_metric "Events Queued:"        "eventlog.events.queued"
print_metric "Events Sent:"          "eventlog.events.sent"
print_metric "Events Failed:"        "eventlog.events.failed"
print_metric "Events Spilled:"       "eventlog.events.spilled"
print_metric "Events Replayed:"      "eventlog.events.replayed"
print_metric "Queue Depth:"          "eventlog.queue.depth"
print_metric "Circuit Breaker Open:" "eventlog.circuit-breaker.open"
echo -e "  ${BOLD}App Metrics${NC}"
print_metric "Bookings Created:"     "petresort.bookings.created"
print_metric "Check-ins Completed:"  "petresort.checkins.completed"
print_metric "Checkouts Completed:"  "petresort.checkouts.completed"
print_metric "Room Service Orders:"  "petresort.roomservice.orders"
print_metric "Active Bookings:"      "petresort.bookings.active"
print_metric "Pets Checked In:"      "petresort.pets.checked_in"

pause "Press Enter to begin the normal flow demo..."

# ═══════════════════════════════════════════════════════════════════════════
header "Phase 2: Normal Flow — Metrics Incrementing"
echo "Watch the dashboard as SDK and app metrics move together."
# ═══════════════════════════════════════════════════════════════════════════

# --- Step 1: Create a booking ---
step "1. Creating a booking for Buddy (PET-001)..."
info "Expect: bookings.created +1, events.queued +N, events.sent +N, bookings.active +1"
BOOKING_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"petId":"PET-001","checkInDate":"2026-06-01","checkOutDate":"2026-06-05"}')
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | jq -r '.bookingId')
success "Booking created: $BOOKING_ID"
echo "$BOOKING_RESPONSE" | jq .
sleep 2

# --- Step 2: Check in ---
step "2. Checking in Buddy..."
info "Expect: checkins.completed +1, pets.checked_in +1"
CHECKIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings/$BOOKING_ID/check-in" \
  -H "Content-Type: application/json" \
  -d '{"kennelPreference":"A-premium"}')
success "Checked in: $(echo "$CHECKIN_RESPONSE" | jq -r '.kennelNumber')"
echo "$CHECKIN_RESPONSE" | jq .
sleep 2

# --- Step 3: Room service ---
step "3. Ordering room service for Buddy..."
info "Expect: roomservice.orders +1"
ROOM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/room-service" \
  -H "Content-Type: application/json" \
  -d "{\"petId\":\"PET-001\",\"bookingId\":\"$BOOKING_ID\",\"item\":\"Premium Steak Dinner\",\"quantity\":1}")
success "Room service: $(echo "$ROOM_RESPONSE" | jq -r '.orderId')"
echo "$ROOM_RESPONSE" | jq .
sleep 2

# --- Step 4: Check out ---
step "4. Checking out Buddy..."
info "Expect: checkouts.completed +1, payments.total +1, pets.checked_in -1, bookings.active -1"
CHECKOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings/$BOOKING_ID/check-out" \
  -H "Content-Type: application/json" \
  -d '{"paymentAmount":199.99,"cardNumberLast4":"4242"}')
success "Checked out: $(echo "$CHECKOUT_RESPONSE" | jq -r '.status')"
echo "$CHECKOUT_RESPONSE" | jq .
sleep 2

step "Verification — current metrics after normal flow:"
echo -e "  ${BOLD}SDK${NC}"
print_metric "Events Queued:"  "eventlog.events.queued"
print_metric "Events Sent:"    "eventlog.events.sent"
print_metric "Events Failed:"  "eventlog.events.failed"
print_metric "Queue Depth:"    "eventlog.queue.depth"
echo -e "  ${BOLD}App${NC}"
print_metric "Bookings Created:"     "petresort.bookings.created"
print_metric "Check-ins Completed:"  "petresort.checkins.completed"
print_metric "Checkouts Completed:"  "petresort.checkouts.completed"
print_metric "Room Service Orders:"  "petresort.roomservice.orders"

echo ""
echo -e "${GREEN}Dashboard should show all metrics flowing — queued ≈ sent, zero failures.${NC}"

pause "Press Enter to begin the spillover demo..."

# ═══════════════════════════════════════════════════════════════════════════
header "Phase 3: Spillover Demo — Breaking the Event Log API"
echo "We'll stop the Event Log API and flood events to trigger"
echo "circuit breaker + disk spillover."
# ═══════════════════════════════════════════════════════════════════════════

# Record pre-spillover state
PRE_QUEUED=$(metric "eventlog.events.queued")
PRE_SENT=$(metric "eventlog.events.sent")
PRE_FAILED=$(metric "eventlog.events.failed")
PRE_SPILLED=$(metric "eventlog.events.spilled")

echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}  Stop the Event Log API now (Ctrl+C in its terminal).${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
pause "Press Enter once the Event Log API is stopped..."

step "Verifying Event Log API is down..."
if curl -sf "$EVENTLOG_URL/v1/healthcheck" > /dev/null 2>&1; then
  warn "Event Log API still appears to be running! The demo works best with it stopped."
else
  success "Event Log API is down — events will fail delivery"
fi

step "Firing 15 rapid bookings to generate ~75 events against a dead endpoint..."
echo -e "${DIM}  Each booking generates multiple SDK events (PROCESS_START, steps, PROCESS_END).${NC}"
echo -e "${DIM}  Watch the dashboard:${NC}"
echo -e "${DIM}    • Queue Depth climbing${NC}"
echo -e "${DIM}    • Events Spilled to Disk incrementing (spillover absorbs failures)${NC}"
echo -e "${DIM}    • Events Failed usually stays low while spillover has capacity${NC}"
echo -e "${DIM}      (it increases if spillover queue/file limits are reached)${NC}"
echo -e "${DIM}    • Circuit Breaker flipping OPEN (red badge) after 5 failures${NC}"
echo -e "${DIM}    • Delivery Rate % dropping${NC}"
echo ""

for i in $(seq 1 15); do
  printf "${CYAN}  Booking %2d/15...${NC} " "$i"
  RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/api/bookings" \
    -H "Content-Type: application/json" \
    -d "{\"petId\":\"PET-00$((i % 5 + 1))\",\"checkInDate\":\"2026-07-$(printf '%02d' $i)\",\"checkOutDate\":\"2026-07-$(printf '%02d' $((i + 5)))\"}")
  if [ "$RESPONSE" -eq 201 ] || [ "$RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}HTTP $RESPONSE${NC}"
  else
    echo -e "${YELLOW}HTTP $RESPONSE${NC}"
  fi
  sleep 0.3
done

echo ""
success "15 bookings fired — events are piling up"

sleep 3

step "Post-flood metrics:"
echo -e "  ${BOLD}SDK${NC}"
print_metric "Events Queued:"        "eventlog.events.queued"
print_metric "Events Sent:"          "eventlog.events.sent"
print_metric "Events Failed:"        "eventlog.events.failed"
print_metric "Events Spilled:"       "eventlog.events.spilled"
print_metric "Queue Depth:"          "eventlog.queue.depth"
print_metric "Circuit Breaker Open:" "eventlog.circuit-breaker.open"

step "Checking spillover directory..."
if [ -d "$APP_DIR/spillover" ]; then
  SPILL_COUNT=$(find "$APP_DIR/spillover" -type f 2>/dev/null | wc -l | tr -d ' ')
  success "Spillover directory exists — $SPILL_COUNT file(s)"
  ls -la "$APP_DIR/spillover/" 2>/dev/null || true
else
  info "Spillover directory not yet created (events may still be in the queue)"
fi

echo ""
echo -e "${YELLOW}Actuator verification commands:${NC}"
echo -e "${DIM}  curl -s $METRICS_URL/eventlog.events.spilled | jq .${NC}"
echo -e "${DIM}  curl -s $METRICS_URL/eventlog.circuit-breaker.open | jq .${NC}"
echo -e "${DIM}  curl -s $METRICS_URL/eventlog.queue.depth | jq .${NC}"

pause "Observe the dashboard. Press Enter when ready to restore the Event Log API..."

# ═══════════════════════════════════════════════════════════════════════════
header "Phase 4: Recovery — Restoring the Event Log API"
echo "Restart the API and watch the SDK recover automatically."
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Restart the Event Log API now:${NC}"
echo -e "${GREEN}    cd api && pnpm dev${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
pause "Press Enter once the Event Log API is running again..."

step "Polling Event Log API health..."
RETRIES=0
MAX_RETRIES=15
while [ $RETRIES -lt $MAX_RETRIES ]; do
  if curl -sf "$EVENTLOG_URL/v1/healthcheck" > /dev/null 2>&1; then
    success "Event Log API is back online!"
    break
  fi
  RETRIES=$((RETRIES + 1))
  printf "${DIM}  Waiting... (attempt %d/%d)${NC}\n" "$RETRIES" "$MAX_RETRIES"
  sleep 2
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  echo -e "${RED}✗ Event Log API did not come back after $MAX_RETRIES attempts${NC}"
  echo -e "${RED}  Make sure it's running on $EVENTLOG_URL${NC}"
  exit 1
fi

echo ""
echo -e "${DIM}Recovery sequence on the dashboard:${NC}"
echo -e "${DIM}  1. Circuit Breaker resets to CLOSED (green badge) after ~30s${NC}"
echo -e "${DIM}     (no new business requests required)${NC}"
echo -e "${DIM}  2. Events Replayed increments (separate counter from Sent)${NC}"
echo -e "${DIM}     Replay runs on the background interval (default 10s)${NC}"
echo -e "${DIM}  3. Queue Depth drains back toward 0${NC}"
echo -e "${DIM}  4. Delivery Rate bar recovers toward 100%${NC}"

step "Waiting for circuit breaker to reset (polling every 5s, max 90s)..."
CB_ELAPSED=0
CB_MAX=90
CB_CLOSED=false
while [ $CB_ELAPSED -lt $CB_MAX ]; do
  CB_VAL=$(metric "eventlog.circuit-breaker.open")
  if [ "$CB_VAL" = "0" ] || [ "$CB_VAL" = "0.0" ]; then
    CB_CLOSED=true
    success "Circuit breaker CLOSED! Waiting 10s for replay cycle..."
    sleep 10
    break
  fi
  CB_ELAPSED=$((CB_ELAPSED + 5))
  printf "${DIM}  Circuit breaker still OPEN... (%ds elapsed)${NC}\n" "$CB_ELAPSED"
  sleep 5
done
if [ "$CB_CLOSED" = false ]; then
  warn "Circuit breaker still OPEN after ${CB_MAX}s."
  info "If this is an older SDK build, trigger one booking request to force a sender-loop health check."
fi

step "Post-recovery metrics:"
POST_QUEUED=$(metric "eventlog.events.queued")
POST_SENT=$(metric "eventlog.events.sent")
POST_FAILED=$(metric "eventlog.events.failed")
POST_SPILLED=$(metric "eventlog.events.spilled")
POST_REPLAYED=$(metric "eventlog.events.replayed")
POST_DEPTH=$(metric "eventlog.queue.depth")
POST_CB=$(metric "eventlog.circuit-breaker.open")

echo -e "  ${BOLD}SDK${NC}"
printf "  %-28s %-10s → %s\n" "Events Queued:" "$PRE_QUEUED" "$POST_QUEUED"
printf "  %-28s %-10s → %s\n" "Events Sent:" "$PRE_SENT" "$POST_SENT"
printf "  %-28s %-10s → %s\n" "Events Failed:" "$PRE_FAILED" "$POST_FAILED"
printf "  %-28s %-10s → %s\n" "Events Spilled:" "$PRE_SPILLED" "$POST_SPILLED"
printf "  %-28s %s\n" "Events Replayed:" "$POST_REPLAYED"
printf "  %-28s %s\n" "Queue Depth:" "$POST_DEPTH"
if [ "$POST_CB" = "0" ] || [ "$POST_CB" = "0.0" ]; then
  printf "  %-28s ${GREEN}CLOSED${NC}\n" "Circuit Breaker:"
else
  printf "  %-28s ${RED}OPEN (still recovering — wait longer)${NC}\n" "Circuit Breaker:"
fi

step "Checking spillover directory after replay..."
if [ -d "$APP_DIR/spillover" ]; then
  SPILL_COUNT=$(find "$APP_DIR/spillover" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SPILL_COUNT" -eq 0 ]; then
    success "Spillover directory is empty — all events replayed!"
  else
    info "Spillover directory still has $SPILL_COUNT file(s) — replay may need more time"
    info "If API instability persists, the SDK keeps remaining events on disk and retries next cycle."
    ls -la "$APP_DIR/spillover/" 2>/dev/null || true
  fi
else
  success "No spillover directory — nothing was spilled (queue absorbed everything)"
fi

pause "Press Enter to see the summary..."

# ═══════════════════════════════════════════════════════════════════════════
header "Phase 5: Optional — Aggressive Spillover Config"
echo "To trigger spillover even faster, lower these in application.yml:"
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}  eventlog:${NC}"
echo -e "${CYAN}    async:${NC}"
echo -e "${CYAN}      queue-capacity: 10           ${DIM}# was 1000${NC}"
echo -e "${CYAN}      circuit-breaker-threshold: 2  ${DIM}# was 5 (default)${NC}"
echo -e "${CYAN}      max-spillover-events: 200     ${DIM}# optional, default 10000${NC}"
echo -e "${CYAN}      max-spillover-size-mb: 5      ${DIM}# optional, default 50${NC}"
echo ""
echo -e "${DIM}  Restart pet-resort-api after changing, then re-run this script.${NC}"
echo -e "${DIM}  With a tiny queue, even 2-3 bookings will trigger disk spillover.${NC}"

# ═══════════════════════════════════════════════════════════════════════════
header "Phase 6: Summary"
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Final Metrics Snapshot${NC}"
echo "  ┌──────────────────────────────┬───────────┐"
echo "  │ SDK Metric                   │ Value     │"
echo "  ├──────────────────────────────┼───────────┤"
printf "  │ %-28s │ %9s │\n" "eventlog.events.queued"   "$(metric 'eventlog.events.queued')"
printf "  │ %-28s │ %9s │\n" "eventlog.events.sent"     "$(metric 'eventlog.events.sent')"
printf "  │ %-28s │ %9s │\n" "eventlog.events.failed"   "$(metric 'eventlog.events.failed')"
printf "  │ %-28s │ %9s │\n" "eventlog.events.spilled"  "$(metric 'eventlog.events.spilled')"
printf "  │ %-28s │ %9s │\n" "eventlog.events.replayed" "$(metric 'eventlog.events.replayed')"
printf "  │ %-28s │ %9s │\n" "eventlog.queue.depth"     "$(metric 'eventlog.queue.depth')"
printf "  │ %-28s │ %9s │\n" "eventlog.circuit-breaker.open" "$(metric 'eventlog.circuit-breaker.open')"
echo "  ├──────────────────────────────┼───────────┤"
echo "  │ App Metric                   │ Value     │"
echo "  ├──────────────────────────────┼───────────┤"
printf "  │ %-28s │ %9s │\n" "petresort.bookings.created"    "$(metric 'petresort.bookings.created')"
printf "  │ %-28s │ %9s │\n" "petresort.checkins.completed"  "$(metric 'petresort.checkins.completed')"
printf "  │ %-28s │ %9s │\n" "petresort.checkouts.completed" "$(metric 'petresort.checkouts.completed')"
printf "  │ %-28s │ %9s │\n" "petresort.bookings.cancelled"  "$(metric 'petresort.bookings.cancelled')"
printf "  │ %-28s │ %9s │\n" "petresort.payments.total"      "$(metric 'petresort.payments.total')"
printf "  │ %-28s │ %9s │\n" "petresort.payments.failed"     "$(metric 'petresort.payments.failed')"
printf "  │ %-28s │ %9s │\n" "petresort.roomservice.orders"  "$(metric 'petresort.roomservice.orders')"
printf "  │ %-28s │ %9s │\n" "petresort.bookings.active"     "$(metric 'petresort.bookings.active')"
printf "  │ %-28s │ %9s │\n" "petresort.pets.checked_in"     "$(metric 'petresort.pets.checked_in')"
echo "  └──────────────────────────────┴───────────┘"

echo ""
echo -e "${BOLD}Key Config Values (application.yml)${NC}"
ASYNC_QUEUE_CAPACITY=$(cfg_current_or_default "queue-capacity" "10000")
ASYNC_CB_THRESHOLD=$(cfg_current_or_default "circuit-breaker-threshold" "5")
ASYNC_CB_RESET_MS=$(cfg_current_or_default "circuit-breaker-reset-ms" "30000")
ASYNC_SPILLOVER_PATH=$(async_cfg_value "spillover-path")
if [ -z "$ASYNC_SPILLOVER_PATH" ]; then
  ASYNC_SPILLOVER_PATH="(unset)"
fi
ASYNC_REPLAY_INTERVAL=$(cfg_current_or_default "replay-interval-ms" "10000")
ASYNC_MAX_SPILLOVER_EVENTS=$(cfg_current_or_default "max-spillover-events" "10000")
ASYNC_MAX_SPILLOVER_SIZE_MB=$(cfg_current_or_default "max-spillover-size-mb" "50")
echo "  ┌──────────────────────────────────┬──────────────┬──────────┐"
echo "  │ Property                         │ Current      │ Default  │"
echo "  ├──────────────────────────────────┼──────────────┼──────────┤"
printf "  │ %-32s │ %-12s │ %-8s │\n" "async.queue-capacity" "$ASYNC_QUEUE_CAPACITY" "10000"
printf "  │ %-32s │ %-12s │ %-8s │\n" "async.circuit-breaker-threshold" "$ASYNC_CB_THRESHOLD" "5"
printf "  │ %-32s │ %-12s │ %-8s │\n" "async.circuit-breaker-reset-ms" "$ASYNC_CB_RESET_MS" "30000"
printf "  │ %-32s │ %-12s │ %-8s │\n" "async.spillover-path" "$ASYNC_SPILLOVER_PATH" "—"
printf "  │ %-32s │ %-12s │ %-8s │\n" "async.replay-interval-ms" "$ASYNC_REPLAY_INTERVAL" "10000"
printf "  │ %-32s │ %-12s │ %-8s │\n" "async.max-spillover-events" "$ASYNC_MAX_SPILLOVER_EVENTS" "10000"
printf "  │ %-32s │ %-12s │ %-8s │\n" "async.max-spillover-size-mb" "$ASYNC_MAX_SPILLOVER_SIZE_MB" "50"
echo "  └──────────────────────────────────┴──────────────┴──────────┘"

echo ""
echo -e "${CYAN}For the full event log SDK demo (10 scenarios), run:${NC}"
echo -e "${DIM}  bash scripts/demo-runbook.sh${NC}"
echo ""
