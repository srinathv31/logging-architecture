#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Paws & Claws Pet Resort — Event Log SDK Demo Runbook
# ═══════════════════════════════════════════════════════════════════════════
#
# Prerequisites:
#   1. Pet Resort API running on :8080  →  cd pet-resort-api && ./mvnw spring-boot:run
#   2. Event Log API running on :3000   →  cd api && npm run dev
#   3. jq installed                     →  brew install jq
#
# Deterministic on a fresh app start (IDs: BKG-002 through BKG-005)
#
# Usage:  bash scripts/demo-runbook.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="http://localhost:8080"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

step() { echo -e "\n${CYAN}▸ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
fail_expected() { echo -e "${YELLOW}✗ $1 (expected)${NC}"; }
header() { echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}  $1${NC}"; echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"; }

# ───────────────────────────────────────────────────────────────────────────
header "Scenario 1: Buddy's Full Stay (Happy Path)"
echo "Pet: Buddy (PET-001, DOG) | Owner: Alice Johnson (OWN-001)"
echo "Features: parallel fork-join, span_links, correlation_link, vet check"
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

step "Checking out Buddy (\$249.99, card ending 4242)..."
BUDDY_CHECKOUT=$(curl -s -X POST "$BASE_URL/api/bookings/$BUDDY_BOOKING_ID/check-out" \
  -H "Content-Type: application/json" \
  -d '{"paymentAmount":249.99,"cardNumberLast4":"4242"}')
success "Checked out — total: \$$(echo "$BUDDY_CHECKOUT" | jq -r '.totalAmount')"
echo "$BUDDY_CHECKOUT" | jq .

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
header "Verification Lookups"
# ───────────────────────────────────────────────────────────────────────────

step "Bob's bookings (OWN-002 — should show 1 successful booking)..."
curl -s "$BASE_URL/api/owners/OWN-002/bookings" | jq .

step "Carol's bookings (OWN-003 — should show Scales' booking)..."
curl -s "$BASE_URL/api/owners/OWN-003/bookings" | jq .

step "Buddy's final booking state ($BUDDY_BOOKING_ID)..."
curl -s "$BASE_URL/api/bookings/$BUDDY_BOOKING_ID" | jq .

# ───────────────────────────────────────────────────────────────────────────
header "Demo Complete!"
echo ""
echo "Booking IDs:"
echo "  Buddy:          $BUDDY_BOOKING_ID (full stay — booking + check-in + check-out)"
echo "  Tweety (fail):  BKG-003 (consumed, not saved — 504 timeout)"
echo "  Scales:         $SCALES_BOOKING_ID (kennel retry + room service)"
echo "  Tweety (retry): $TWEETY_BOOKING_ID (successful retry)"
echo ""
echo "Verify in Event Log API:"
echo "  OWN-001 — events across 3 processes (booking, check-in, check-out)"
echo "  OWN-002 — 2 correlation IDs (1 failed, 1 succeeded)"
echo "  OWN-003 — events across 2 process types (booking, room service)"
echo ""
