#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Paws & Claws Pet Resort — Event Log SDK Demo Runbook
# ═══════════════════════════════════════════════════════════════════════════
#
# Prerequisites:
#   1. Pet Resort API running on :8081  →  cd pet-resort-api && ./mvnw spring-boot:run
#   2. Event Log API running on :3000   →  cd api && pnpm dev
#   3. jq installed                     →  brew install jq
#
# Deterministic on a fresh app start (IDs: BKG-002 through BKG-009)
#
# Usage:  bash scripts/demo-runbook.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="http://localhost:8081"
EVENTLOG_URL="http://localhost:3000"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

step() { echo -e "\n${CYAN}▸ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
fail_expected() { echo -e "${YELLOW}✗ $1 (expected)${NC}"; }
header() {
  echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  $1${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════
header "Pre-flight Checks"
echo "Verifying services are running..."
# ═══════════════════════════════════════════════════════════════════════════

step "Checking Pet Resort API on :8081..."
if curl -sf "$BASE_URL/actuator/health" > /dev/null 2>&1; then
  success "Pet Resort API is running"
else
  echo -e "${RED}✗ Pet Resort API not reachable at $BASE_URL/actuator/health${NC}"
  echo -e "${RED}  Start it:  cd pet-resort-api && ./mvnw spring-boot:run${NC}"
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

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 1: Buddy's Booking + Check-in (Happy Path)"
echo "Pet: Buddy (PET-001, DOG) | Owner: Alice Johnson (OWN-001)"
echo "Features: parallel fork-join, span_links, correlation_link, vet check"
echo "Note: Buddy stays CHECKED_IN for Scenarios 7–8"
# ───────────────────────────────────────────────────────────────────────────

step "Creating booking for Buddy..."
BUDDY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"petId":"PET-001","checkInDate":"2026-03-01","checkOutDate":"2026-03-05"}')
BUDDY_BOOKING_ID=$(echo "$BUDDY_RESPONSE" | jq -r '.bookingId')
success "Booking created: $BUDDY_BOOKING_ID"
echo "$BUDDY_RESPONSE" | jq .

step "Checking in Buddy (kennel preference: A-premium)..."
BUDDY_CHECKIN=$(curl -s -X POST "$BASE_URL/api/bookings/$BUDDY_BOOKING_ID/check-in" \
  -H "Content-Type: application/json" \
  -d '{"kennelPreference":"A-premium"}')
success "Checked in: $(echo "$BUDDY_CHECKIN" | jq -r '.kennelNumber')"
echo "$BUDDY_CHECKIN" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 2: Tweety's Failed Booking (Kennel Vendor Timeout)"
echo "Pet: Tweety (PET-003, BIRD) | Owner: Bob Martinez (OWN-002)"
echo "Features: KENNEL_VENDOR_TIMEOUT error, partial process (no PROCESS_END)"
# ───────────────────────────────────────────────────────────────────────────

step "Booking Tweety with X-Simulate: kennel-timeout..."
TWEETY_FAIL=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -H "X-Simulate: kennel-timeout" \
  -d '{"petId":"PET-003","checkInDate":"2026-03-10","checkOutDate":"2026-03-14"}')
TWEETY_FAIL_CODE=$(echo "$TWEETY_FAIL" | tail -1)
TWEETY_FAIL_BODY=$(echo "$TWEETY_FAIL" | sed '$d')

if [ "$TWEETY_FAIL_CODE" -eq 504 ]; then
  fail_expected "HTTP $TWEETY_FAIL_CODE — Kennel vendor timed out"
else
  echo -e "${RED}Unexpected HTTP $TWEETY_FAIL_CODE (expected 504)${NC}"
fi
echo "$TWEETY_FAIL_BODY" | jq . 2>/dev/null || echo "$TWEETY_FAIL_BODY"

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 3: Scales' Booking with Internal Retry + Check-in"
echo "Pet: Scales (PET-005, REPTILE) | Owner: Carol Chen (OWN-003)"
echo "Features: retry (same step_sequence, different span_ids), VET_CHECK_API"
# ───────────────────────────────────────────────────────────────────────────

step "Booking Scales with X-Simulate: kennel-retry..."
SCALES_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -H "X-Simulate: kennel-retry" \
  -d '{"petId":"PET-005","checkInDate":"2026-03-15","checkOutDate":"2026-03-20"}')
SCALES_BOOKING_ID=$(echo "$SCALES_RESPONSE" | jq -r '.bookingId')
success "Booking created: $SCALES_BOOKING_ID (with kennel retry)"
echo "$SCALES_RESPONSE" | jq .

step "Checking in Scales (kennel preference: D-heated)..."
SCALES_CHECKIN=$(curl -s -X POST "$BASE_URL/api/bookings/$SCALES_BOOKING_ID/check-in" \
  -H "Content-Type: application/json" \
  -d '{"kennelPreference":"D-heated"}')
success "Checked in: $(echo "$SCALES_CHECKIN" | jq -r '.kennelNumber')"
echo "$SCALES_CHECKIN" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 4: Tweety's Successful Retry (New Request)"
echo "Pet: Tweety (PET-003, BIRD) | Owner: Bob Martinez (OWN-002)"
echo "Features: OWN-002 now has two correlation_ids (1 failed, 1 succeeded)"
# ───────────────────────────────────────────────────────────────────────────

step "Booking Tweety (no simulation — standard happy path)..."
TWEETY_SUCCESS=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"petId":"PET-003","checkInDate":"2026-03-10","checkOutDate":"2026-03-14"}')
TWEETY_BOOKING_ID=$(echo "$TWEETY_SUCCESS" | jq -r '.bookingId')
success "Booking created: $TWEETY_BOOKING_ID"
echo "$TWEETY_SUCCESS" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 5: Scales' Room Service (Account Lookup Retry)"
echo "Pet: Scales (PET-005, REPTILE) | Owner: Carol Chen (OWN-003)"
echo "Features: INVENTORY_SERVICE target, account retry, order_id identifier"
# ───────────────────────────────────────────────────────────────────────────

step "Ordering room service for Scales with X-Simulate: account-retry..."
ROOM_SERVICE=$(curl -s -X POST "$BASE_URL/api/room-service" \
  -H "Content-Type: application/json" \
  -H "X-Simulate: account-retry" \
  -d "{\"petId\":\"PET-005\",\"bookingId\":\"$SCALES_BOOKING_ID\",\"item\":\"Premium Cricket Feast\",\"quantity\":2}")
success "Room service: $(echo "$ROOM_SERVICE" | jq -r '.orderId')"
echo "$ROOM_SERVICE" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 6: Whiskers' Book, Lookup, and Cancel"
echo "Pet: Whiskers (PET-002, CAT) | Owner: Alice Johnson (OWN-001)"
echo "Features: @LogEvent annotation (getBooking), logError template shorthand (cancelBooking)"
# ───────────────────────────────────────────────────────────────────────────

step "Creating booking for Whiskers..."
WHISKERS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"petId":"PET-002","checkInDate":"2026-03-08","checkOutDate":"2026-03-12"}')
WHISKERS_BOOKING_ID=$(echo "$WHISKERS_RESPONSE" | jq -r '.bookingId')
success "Booking created: $WHISKERS_BOOKING_ID"
echo "$WHISKERS_RESPONSE" | jq .

step "Looking up Whiskers' booking (GET — triggers @LogEvent annotation)..."
WHISKERS_LOOKUP=$(curl -s "$BASE_URL/api/bookings/$WHISKERS_BOOKING_ID")
success "Booking retrieved: $(echo "$WHISKERS_LOOKUP" | jq -r '.status')"
echo "$WHISKERS_LOOKUP" | jq .

step "Cancelling Whiskers' booking (DELETE — triggers logError template shorthand)..."
WHISKERS_CANCEL=$(curl -s -X DELETE "$BASE_URL/api/bookings/$WHISKERS_BOOKING_ID")
success "Booking cancelled: $(echo "$WHISKERS_CANCEL" | jq -r '.status')"
echo "$WHISKERS_CANCEL" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 7: Buddy's Double Check-in Attempt"
echo "Pet: Buddy (PET-001, DOG) | Owner: Alice Johnson (OWN-001)"
echo "Features: BookingConflictException, DOUBLE_CHECK_IN error path"
echo "Prerequisite: Buddy is already CHECKED_IN from Scenario 1"
# ───────────────────────────────────────────────────────────────────────────

step "Attempting to check in Buddy again (should fail with 409)..."
BUDDY_DOUBLE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings/$BUDDY_BOOKING_ID/check-in" \
  -H "Content-Type: application/json" \
  -d '{"kennelPreference":"A-premium"}')
BUDDY_DOUBLE_CODE=$(echo "$BUDDY_DOUBLE" | tail -1)
BUDDY_DOUBLE_BODY=$(echo "$BUDDY_DOUBLE" | sed '$d')

if [ "$BUDDY_DOUBLE_CODE" -eq 409 ]; then
  fail_expected "HTTP $BUDDY_DOUBLE_CODE — Double check-in rejected (DOUBLE_CHECK_IN)"
else
  echo -e "${RED}Unexpected HTTP $BUDDY_DOUBLE_CODE (expected 409)${NC}"
fi
echo "$BUDDY_DOUBLE_BODY" | jq . 2>/dev/null || echo "$BUDDY_DOUBLE_BODY"

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 8: Buddy's Failed Check-out + Successful Retry (FULL PROCESS RETRY)"
echo "Pet: Buddy (PET-001, DOG) | Owner: Alice Johnson (OWN-001)"
echo "Features: process-level retry, same correlationId + different traceIds,"
echo "          payment failure path, PROCESS_END with FAILURE then SUCCESS"
# ───────────────────────────────────────────────────────────────────────────

# Generate a shared correlationId for both attempts
SHARED_CORRELATION_ID="corr-checkout-retry-$(date +%s)"
step "Shared correlationId for both attempts: $SHARED_CORRELATION_ID"

step "Attempt #1: Check-out with X-Simulate: payment-failure (expect 422)..."
BUDDY_CHECKOUT_FAIL=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings/$BUDDY_BOOKING_ID/check-out" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $SHARED_CORRELATION_ID" \
  -H "X-Simulate: payment-failure" \
  -d '{"paymentAmount":249.99,"cardNumberLast4":"4242"}')
BUDDY_CHECKOUT_FAIL_CODE=$(echo "$BUDDY_CHECKOUT_FAIL" | tail -1)
BUDDY_CHECKOUT_FAIL_BODY=$(echo "$BUDDY_CHECKOUT_FAIL" | sed '$d')

if [ "$BUDDY_CHECKOUT_FAIL_CODE" -eq 422 ]; then
  fail_expected "HTTP $BUDDY_CHECKOUT_FAIL_CODE — Payment declined (attempt #1)"
else
  echo -e "${RED}Unexpected HTTP $BUDDY_CHECKOUT_FAIL_CODE (expected 422)${NC}"
fi
echo "$BUDDY_CHECKOUT_FAIL_BODY" | jq . 2>/dev/null || echo "$BUDDY_CHECKOUT_FAIL_BODY"

step "Attempt #2: Check-out with same correlationId (no simulation — expect 200)..."
BUDDY_CHECKOUT_SUCCESS=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings/$BUDDY_BOOKING_ID/check-out" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $SHARED_CORRELATION_ID" \
  -d '{"paymentAmount":249.99,"cardNumberLast4":"4242"}')
BUDDY_CHECKOUT_SUCCESS_CODE=$(echo "$BUDDY_CHECKOUT_SUCCESS" | tail -1)
BUDDY_CHECKOUT_SUCCESS_BODY=$(echo "$BUDDY_CHECKOUT_SUCCESS" | sed '$d')

if [ "$BUDDY_CHECKOUT_SUCCESS_CODE" -eq 200 ]; then
  success "HTTP $BUDDY_CHECKOUT_SUCCESS_CODE — Check-out succeeded (attempt #2)"
else
  echo -e "${RED}Unexpected HTTP $BUDDY_CHECKOUT_SUCCESS_CODE (expected 200)${NC}"
fi
echo "$BUDDY_CHECKOUT_SUCCESS_BODY" | jq . 2>/dev/null || echo "$BUDDY_CHECKOUT_SUCCESS_BODY"

echo -e "\n${CYAN}Both attempts share correlationId: $SHARED_CORRELATION_ID${NC}"
echo -e "${CYAN}Each attempt gets its own traceId — dashboard shows both timelines together${NC}"

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 9: Thumper's Booking + Check-in with Agent Gate"
echo "Pet: Thumper (PET-004, RABBIT) | Owner: Bob Martinez (OWN-002)"
echo "Features: IN_PROGRESS intermediate status, logStep with spanIdOverride,"
echo "          same-step status transition (IN_PROGRESS → SUCCESS)"
# ───────────────────────────────────────────────────────────────────────────

step "Creating booking for Thumper..."
THUMPER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"petId":"PET-004","checkInDate":"2026-03-20","checkOutDate":"2026-03-25"}')
THUMPER_BOOKING_ID=$(echo "$THUMPER_RESPONSE" | jq -r '.bookingId')
success "Booking created: $THUMPER_BOOKING_ID"
echo "$THUMPER_RESPONSE" | jq .

step "Checking in Thumper with X-Simulate: agent-gate (~3s delay)..."
echo -e "${YELLOW}  Agent is calling facilities service center to verify room operability...${NC}"
THUMPER_CHECKIN=$(curl -s -X POST "$BASE_URL/api/bookings/$THUMPER_BOOKING_ID/check-in" \
  -H "Content-Type: application/json" \
  -H "X-Simulate: agent-gate" \
  -d '{"kennelPreference":"C-standard"}')
success "Checked in: $(echo "$THUMPER_CHECKIN" | jq -r '.kennelNumber')"
echo "$THUMPER_CHECKIN" | jq .
echo -e "${CYAN}Event log shows two step 2 events with same spanId:${NC}"
echo -e "${CYAN}  IN_PROGRESS (agent calling service center) → SUCCESS (room cleared)${NC}"

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 10: Whiskers' Check-in with Boarding Approval (awaitCompletion)"
echo "Pet: Whiskers (PET-002, CAT) | Owner: Alice Johnson (OWN-001)"
echo "Features: awaitCompletion on processStart, two-phase check-in,"
echo "          IN_PROGRESS → SUCCESS visible in dashboard"
# ───────────────────────────────────────────────────────────────────────────

step "Creating a new booking for Whiskers (she was cancelled in Scenario 6)..."
WHISKERS_APPROVAL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"petId":"PET-002","checkInDate":"2026-04-01","checkOutDate":"2026-04-05"}')
WHISKERS_APPROVAL_BOOKING_ID=$(echo "$WHISKERS_APPROVAL_RESPONSE" | jq -r '.bookingId')
success "Booking created: $WHISKERS_APPROVAL_BOOKING_ID"
echo "$WHISKERS_APPROVAL_RESPONSE" | jq .

# Shared headers so both calls form one continuous process
APPROVAL_CORRELATION_ID="corr-boarding-approval-$(date +%s)"
APPROVAL_TRACE_ID="$(uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]')"

step "Check-in with X-Simulate: awaiting-approval (expect 202)..."
echo -e "${YELLOW}  Whiskers has special dietary needs — vet diet approval required...${NC}"
WHISKERS_CHECKIN_APPROVAL=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings/$WHISKERS_APPROVAL_BOOKING_ID/check-in" \
  -H "Content-Type: application/json" \
  -H "X-Simulate: awaiting-approval" \
  -H "X-Correlation-Id: $APPROVAL_CORRELATION_ID" \
  -H "X-Trace-Id: $APPROVAL_TRACE_ID" \
  -d '{"kennelPreference":"B-quiet"}')
WHISKERS_CHECKIN_CODE=$(echo "$WHISKERS_CHECKIN_APPROVAL" | tail -1)
WHISKERS_CHECKIN_BODY=$(echo "$WHISKERS_CHECKIN_APPROVAL" | sed '$d')

if [ "$WHISKERS_CHECKIN_CODE" -eq 202 ]; then
  success "HTTP $WHISKERS_CHECKIN_CODE — Check-in accepted, awaiting vet diet approval"
else
  echo -e "${RED}Unexpected HTTP $WHISKERS_CHECKIN_CODE (expected 202)${NC}"
fi
echo "$WHISKERS_CHECKIN_BODY" | jq . 2>/dev/null || echo "$WHISKERS_CHECKIN_BODY"

echo -e "\n${YELLOW}  ▸ Check dashboard now — process shows IN_PROGRESS (yellow pulse)${NC}"
echo -e "${YELLOW}  ▸ Press Enter to approve and complete the check-in...${NC}"
read -r

step "Approving Whiskers' check-in (same correlationId + traceId)..."
WHISKERS_APPROVE=$(curl -s -X POST "$BASE_URL/api/bookings/$WHISKERS_APPROVAL_BOOKING_ID/approve-check-in" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $APPROVAL_CORRELATION_ID" \
  -H "X-Trace-Id: $APPROVAL_TRACE_ID")
success "Check-in approved: $(echo "$WHISKERS_APPROVE" | jq -r '.kennelNumber')"
echo "$WHISKERS_APPROVE" | jq .

echo -e "${CYAN}Both calls share correlationId: $APPROVAL_CORRELATION_ID${NC}"
echo -e "${CYAN}Dashboard now shows SUCCESS (green) — process complete${NC}"

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 11: Tweety's Booking with Vet Warning"
echo "Pet: Tweety (PET-003, BIRD) | Owner: Bob Martinez (OWN-002)"
echo "Features: EventStatus.WARNING on vet health check, booking still succeeds"
# ───────────────────────────────────────────────────────────────────────────

step "Booking Tweety with X-Simulate: vet-warning..."
TWEETY_WARNING_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -H "X-Simulate: vet-warning" \
  -d '{"petId":"PET-003","checkInDate":"2026-04-10","checkOutDate":"2026-04-14"}')
TWEETY_WARNING_BOOKING_ID=$(echo "$TWEETY_WARNING_RESPONSE" | jq -r '.bookingId')
success "Booking created: $TWEETY_WARNING_BOOKING_ID (with vet warning)"
echo "$TWEETY_WARNING_RESPONSE" | jq .

echo -e "${YELLOW}  Vet health check logged as WARNING — expired avian vaccination${NC}"
echo -e "${CYAN}  Booking succeeded (201) despite vet warning — monitoring advisory flagged${NC}"

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 12: Scales' Checkout — Trace-Level Retry (Same traceId)"
echo "Pet: Scales (PET-005, REPTILE) | Owner: Carol Chen (OWN-003)"
echo "Features: same traceId across retry attempts, Request 1 FAILURE → Request 2 SUCCESS,"
echo "          single trace query shows full retry timeline"
echo "Prerequisite: Scales is CHECKED_IN from Scenario 3"
# ───────────────────────────────────────────────────────────────────────────

# Pre-generate a shared traceId + correlationId for both attempts
SCALES_CHECKOUT_TRACE_ID="$(uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]')"
SCALES_CHECKOUT_CORRELATION_ID="corr-scales-checkout-$(date +%s)"
step "Shared traceId for both attempts: $SCALES_CHECKOUT_TRACE_ID"
step "Shared correlationId: $SCALES_CHECKOUT_CORRELATION_ID"

step "Attempt #1: Check-out with X-Simulate: payment-failure (expect 422)..."
SCALES_CHECKOUT_FAIL=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings/$SCALES_BOOKING_ID/check-out" \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: $SCALES_CHECKOUT_TRACE_ID" \
  -H "X-Correlation-Id: $SCALES_CHECKOUT_CORRELATION_ID" \
  -H "X-Simulate: payment-failure" \
  -d '{"paymentAmount":389.99,"cardNumberLast4":"5555"}')
SCALES_CHECKOUT_FAIL_CODE=$(echo "$SCALES_CHECKOUT_FAIL" | tail -1)
SCALES_CHECKOUT_FAIL_BODY=$(echo "$SCALES_CHECKOUT_FAIL" | sed '$d')

if [ "$SCALES_CHECKOUT_FAIL_CODE" -eq 422 ]; then
  fail_expected "HTTP $SCALES_CHECKOUT_FAIL_CODE — Payment declined (attempt #1)"
else
  echo -e "${RED}Unexpected HTTP $SCALES_CHECKOUT_FAIL_CODE (expected 422)${NC}"
fi
echo "$SCALES_CHECKOUT_FAIL_BODY" | jq . 2>/dev/null || echo "$SCALES_CHECKOUT_FAIL_BODY"

step "Attempt #2: Check-out with same traceId (no simulation — expect 200)..."
SCALES_CHECKOUT_SUCCESS=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/bookings/$SCALES_BOOKING_ID/check-out" \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: $SCALES_CHECKOUT_TRACE_ID" \
  -H "X-Correlation-Id: $SCALES_CHECKOUT_CORRELATION_ID" \
  -d '{"paymentAmount":389.99,"cardNumberLast4":"1234"}')
SCALES_CHECKOUT_SUCCESS_CODE=$(echo "$SCALES_CHECKOUT_SUCCESS" | tail -1)
SCALES_CHECKOUT_SUCCESS_BODY=$(echo "$SCALES_CHECKOUT_SUCCESS" | sed '$d')

if [ "$SCALES_CHECKOUT_SUCCESS_CODE" -eq 200 ]; then
  success "HTTP $SCALES_CHECKOUT_SUCCESS_CODE — Check-out succeeded (attempt #2)"
else
  echo -e "${RED}Unexpected HTTP $SCALES_CHECKOUT_SUCCESS_CODE (expected 200)${NC}"
fi
echo "$SCALES_CHECKOUT_SUCCESS_BODY" | jq . 2>/dev/null || echo "$SCALES_CHECKOUT_SUCCESS_BODY"

echo -e "\n${CYAN}Both attempts share traceId: $SCALES_CHECKOUT_TRACE_ID${NC}"
echo -e "${CYAN}Query: GET /v1/events/trace/$SCALES_CHECKOUT_TRACE_ID → shows BOTH timelines${NC}"
echo -e "${CYAN}Compare with Scenario 8: same correlationId but DIFFERENT traceIds${NC}"

# ───────────────────────────────────────────────────────────────────────────
header "Verification Lookups"
# ───────────────────────────────────────────────────────────────────────────

step "Alice's bookings (OWN-001 — Buddy CHECKED_OUT + Whiskers CANCELLED + Whiskers CHECKED_IN)..."
curl -s "$BASE_URL/api/owners/OWN-001/bookings" | jq .

step "Bob's bookings (OWN-002 — Tweety PENDING x2 + Thumper CHECKED_IN)..."
curl -s "$BASE_URL/api/owners/OWN-002/bookings" | jq .

step "Carol's bookings (OWN-003 — Scales CHECKED_OUT)..."
curl -s "$BASE_URL/api/owners/OWN-003/bookings" | jq .

step "Buddy's final state ($BUDDY_BOOKING_ID — should be CHECKED_OUT)..."
curl -s "$BASE_URL/api/bookings/$BUDDY_BOOKING_ID" | jq .

step "Whiskers' cancelled booking ($WHISKERS_BOOKING_ID — should be CANCELLED)..."
curl -s "$BASE_URL/api/bookings/$WHISKERS_BOOKING_ID" | jq .

step "Whiskers' approved booking ($WHISKERS_APPROVAL_BOOKING_ID — should be CHECKED_IN)..."
curl -s "$BASE_URL/api/bookings/$WHISKERS_APPROVAL_BOOKING_ID" | jq .

step "Thumper's final state ($THUMPER_BOOKING_ID — should be CHECKED_IN)..."
curl -s "$BASE_URL/api/bookings/$THUMPER_BOOKING_ID" | jq .

step "Tweety's vet-warning booking ($TWEETY_WARNING_BOOKING_ID — should be PENDING)..."
curl -s "$BASE_URL/api/bookings/$TWEETY_WARNING_BOOKING_ID" | jq .

step "Scales' final state ($SCALES_BOOKING_ID — should be CHECKED_OUT)..."
curl -s "$BASE_URL/api/bookings/$SCALES_BOOKING_ID" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Event Log API Verification"
# ───────────────────────────────────────────────────────────────────────────

step "Alice's events (OWN-001)..."
curl -s "$EVENTLOG_URL/v1/events/account/OWN-001" | jq .

step "Alice's event summary (OWN-001)..."
curl -s "$EVENTLOG_URL/v1/events/account/OWN-001/summary" | jq .

step "Bob's events (OWN-002)..."
curl -s "$EVENTLOG_URL/v1/events/account/OWN-002" | jq .

step "Carol's events (OWN-003)..."
curl -s "$EVENTLOG_URL/v1/events/account/OWN-003" | jq .

step "Dashboard stats..."
curl -s "$EVENTLOG_URL/v1/dashboard/stats" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Demo Complete!"
echo ""
echo "Booking IDs:"
echo "  Buddy:              $BUDDY_BOOKING_ID (booking + check-in + failed checkout + successful checkout)"
echo "  Tweety (fail):      BKG-003 (consumed, not saved — 504 timeout)"
echo "  Scales:             $SCALES_BOOKING_ID (kennel retry + room service + failed checkout + successful checkout)"
echo "  Tweety (retry):     $TWEETY_BOOKING_ID (successful retry)"
echo "  Whiskers (cancel):  $WHISKERS_BOOKING_ID (book → lookup → cancel)"
echo "  Thumper:            $THUMPER_BOOKING_ID (booking + agent-gate check-in)"
echo "  Whiskers (approve): $WHISKERS_APPROVAL_BOOKING_ID (awaitCompletion → approve)"
echo "  Tweety (warning):   $TWEETY_WARNING_BOOKING_ID (vet-warning booking)"
echo ""
echo "Verify in Event Log API:"
echo "  OWN-001 — Buddy: 4 processes (booking, check-in, failed checkout, successful checkout)"
echo "            Whiskers: 3 processes (booking, getBooking, cancel)"
echo "            Whiskers (Sc.10): awaitCompletion check-in → approval (IN_PROGRESS → SUCCESS)"
echo "            Checkout retry: correlationId=$SHARED_CORRELATION_ID (2 attempts, 2 traceIds)"
echo "            Boarding approval: correlationId=$APPROVAL_CORRELATION_ID"
echo "  OWN-002 — 4 correlation IDs (Tweety fail + Tweety success + Thumper booking/check-in + Tweety vet-warning)"
echo "            Thumper check-in: step 2 has IN_PROGRESS → SUCCESS on same spanId"
echo "            Tweety vet-warning: vet health check step has WARNING status"
echo "  OWN-003 — events across 3 process types (booking, room service, checkout)"
echo "            Checkout trace-retry: traceId=$SCALES_CHECKOUT_TRACE_ID (2 attempts, SAME traceId)"
echo ""
