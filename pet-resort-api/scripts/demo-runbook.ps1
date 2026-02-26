# ═══════════════════════════════════════════════════════════════════════════
# Paws & Claws Pet Resort — Event Log SDK Demo Runbook (PowerShell)
# ═══════════════════════════════════════════════════════════════════════════
#
# Prerequisites:
#   1. Pet Resort API running on :8081  →  cd pet-resort-api; ./mvnw spring-boot:run
#   2. Event Log API running on :3000   →  cd api; pnpm dev
#
# Deterministic on a fresh app start (IDs: BKG-002 through BKG-008)
#
# Usage:  pwsh scripts/demo-runbook.ps1
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$BASE_URL = "http://localhost:8081"
$EVENTLOG_URL = "http://localhost:3000"

function Step($msg) { Write-Host "`n> $msg" -ForegroundColor Cyan }
function Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function FailExpected($msg) { Write-Host "[X] $msg (expected)" -ForegroundColor Yellow }
function Header($msg) {
    Write-Host ""
    Write-Host ("=" * 59) -ForegroundColor White
    Write-Host "  $msg" -ForegroundColor White
    Write-Host ("=" * 59) -ForegroundColor White
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body,
        [switch]$ReturnStatusCode
    )
    $params = @{
        Method = $Method
        Uri = $Uri
        Headers = $Headers
        ContentType = "application/json"
        ErrorAction = "Stop"
    }
    if ($Body) { $params.Body = $Body }

    if ($ReturnStatusCode) {
        try {
            $response = Invoke-WebRequest @params
            return @{ StatusCode = $response.StatusCode; Body = ($response.Content | ConvertFrom-Json) }
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $rawBody = $null
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $rawBody = $reader.ReadToEnd() | ConvertFrom-Json
            } catch {
                $rawBody = $null
            }
            return @{ StatusCode = $statusCode; Body = $rawBody }
        }
    } else {
        $response = Invoke-RestMethod @params
        return $response
    }
}

function Show-Json($obj) {
    if ($obj) { $obj | ConvertTo-Json -Depth 10 }
}

# ═══════════════════════════════════════════════════════════════════════════
Header "Pre-flight Checks"
Write-Host "Verifying services are running..."
# ═══════════════════════════════════════════════════════════════════════════

Step "Checking Pet Resort API on :8081..."
try {
    Invoke-RestMethod -Uri "$BASE_URL/actuator/health" -ErrorAction Stop | Out-Null
    Success "Pet Resort API is running"
}
catch {
    Write-Host "✗ Pet Resort API not reachable at $BASE_URL/actuator/health" -ForegroundColor Red
    Write-Host "  Start it:  cd pet-resort-api && ./mvnw spring-boot:run" -ForegroundColor Red
    exit 1
}

Step "Checking Event Log API on :3000..."
try {
    Invoke-RestMethod -Uri "$EVENTLOG_URL/v1/healthcheck" -ErrorAction Stop | Out-Null
    Success "Event Log API is running"
}
catch {
    Write-Host "✗ Event Log API not reachable at $EVENTLOG_URL/v1/healthcheck" -ForegroundColor Red
    Write-Host "  Start it:  cd api && pnpm dev" -ForegroundColor Red
    exit 1
}

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 1: Buddy's Booking + Check-in (Happy Path)"
Write-Host "Pet: Buddy (PET-001, DOG) | Owner: Alice Johnson (OWN-001)"
Write-Host "Features: parallel fork-join, span_links, correlation_link, vet check"
Write-Host "Note: Buddy stays CHECKED_IN for Scenarios 7-8"
# ───────────────────────────────────────────────────────────────────────────

Step "Creating booking for Buddy..."
$buddyResponse = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings" `
    -Body '{"petId":"PET-001","checkInDate":"2026-03-01","checkOutDate":"2026-03-05"}'
$buddyBookingId = $buddyResponse.bookingId
Success "Booking created: $buddyBookingId"
Show-Json $buddyResponse

Step "Checking in Buddy (kennel preference: A-premium)..."
$buddyCheckin = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$buddyBookingId/check-in" `
    -Body '{"kennelPreference":"A-premium"}'
Success "Checked in: $($buddyCheckin.kennelNumber)"
Show-Json $buddyCheckin

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 2: Tweety's Failed Booking (Kennel Vendor Timeout)"
Write-Host "Pet: Tweety (PET-003, BIRD) | Owner: Bob Martinez (OWN-002)"
Write-Host "Features: KENNEL_VENDOR_TIMEOUT error, partial process (no PROCESS_END)"
# ───────────────────────────────────────────────────────────────────────────

Step "Booking Tweety with X-Simulate: kennel-timeout..."
$tweetyFail = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings" -ReturnStatusCode `
    -Headers @{ "X-Simulate" = "kennel-timeout" } `
    -Body '{"petId":"PET-003","checkInDate":"2026-03-10","checkOutDate":"2026-03-14"}'

if ($tweetyFail.StatusCode -eq 504) {
    FailExpected "HTTP $($tweetyFail.StatusCode) - Kennel vendor timed out"
} else {
    Write-Host "Unexpected HTTP $($tweetyFail.StatusCode) (expected 504)" -ForegroundColor Red
}
Show-Json $tweetyFail.Body

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 3: Scales' Booking with Internal Retry + Check-in"
Write-Host "Pet: Scales (PET-005, REPTILE) | Owner: Carol Chen (OWN-003)"
Write-Host "Features: retry (same step_sequence, different span_ids), VET_CHECK_API"
# ───────────────────────────────────────────────────────────────────────────

Step "Booking Scales with X-Simulate: kennel-retry..."
$scalesResponse = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings" `
    -Headers @{ "X-Simulate" = "kennel-retry" } `
    -Body '{"petId":"PET-005","checkInDate":"2026-03-15","checkOutDate":"2026-03-20"}'
$scalesBookingId = $scalesResponse.bookingId
Success "Booking created: $scalesBookingId (with kennel retry)"
Show-Json $scalesResponse

Step "Checking in Scales (kennel preference: D-heated)..."
$scalesCheckin = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$scalesBookingId/check-in" `
    -Body '{"kennelPreference":"D-heated"}'
Success "Checked in: $($scalesCheckin.kennelNumber)"
Show-Json $scalesCheckin

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 4: Tweety's Successful Retry (New Request)"
Write-Host "Pet: Tweety (PET-003, BIRD) | Owner: Bob Martinez (OWN-002)"
Write-Host "Features: OWN-002 now has two correlation_ids (1 failed, 1 succeeded)"
# ───────────────────────────────────────────────────────────────────────────

Step "Booking Tweety (no simulation - standard happy path)..."
$tweetySuccess = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings" `
    -Body '{"petId":"PET-003","checkInDate":"2026-03-10","checkOutDate":"2026-03-14"}'
$tweetyBookingId = $tweetySuccess.bookingId
Success "Booking created: $tweetyBookingId"
Show-Json $tweetySuccess

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 5: Scales' Room Service (Account Lookup Retry)"
Write-Host "Pet: Scales (PET-005, REPTILE) | Owner: Carol Chen (OWN-003)"
Write-Host "Features: INVENTORY_SERVICE target, account retry, order_id identifier"
# ───────────────────────────────────────────────────────────────────────────

Step "Ordering room service for Scales with X-Simulate: account-retry..."
$roomServiceBody = @{
    petId     = "PET-005"
    bookingId = $scalesBookingId
    item      = "Premium Cricket Feast"
    quantity  = 2
} | ConvertTo-Json
$roomService = Invoke-Api -Method POST -Uri "$BASE_URL/api/room-service" `
    -Headers @{ "X-Simulate" = "account-retry" } `
    -Body $roomServiceBody
Success "Room service: $($roomService.orderId)"
Show-Json $roomService

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 6: Whiskers' Book, Lookup, and Cancel"
Write-Host "Pet: Whiskers (PET-002, CAT) | Owner: Alice Johnson (OWN-001)"
Write-Host "Features: @LogEvent annotation (getBooking), logError template shorthand (cancelBooking)"
# ───────────────────────────────────────────────────────────────────────────

Step "Creating booking for Whiskers..."
$whiskersResponse = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings" `
    -Body '{"petId":"PET-002","checkInDate":"2026-03-08","checkOutDate":"2026-03-12"}'
$whiskersBookingId = $whiskersResponse.bookingId
Success "Booking created: $whiskersBookingId"
Show-Json $whiskersResponse

Step "Looking up Whiskers' booking (GET - triggers @LogEvent annotation)..."
$whiskersLookup = Invoke-Api -Method GET -Uri "$BASE_URL/api/bookings/$whiskersBookingId"
Success "Booking retrieved: $($whiskersLookup.status)"
Show-Json $whiskersLookup

Step "Cancelling Whiskers' booking (DELETE - triggers logError template shorthand)..."
$whiskersCancel = Invoke-Api -Method DELETE -Uri "$BASE_URL/api/bookings/$whiskersBookingId"
Success "Booking cancelled: $($whiskersCancel.status)"
Show-Json $whiskersCancel

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 7: Buddy's Double Check-in Attempt"
Write-Host "Pet: Buddy (PET-001, DOG) | Owner: Alice Johnson (OWN-001)"
Write-Host "Features: BookingConflictException, DOUBLE_CHECK_IN error path"
Write-Host "Prerequisite: Buddy is already CHECKED_IN from Scenario 1"
# ───────────────────────────────────────────────────────────────────────────

Step "Attempting to check in Buddy again (should fail with 409)..."
$buddyDouble = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$buddyBookingId/check-in" -ReturnStatusCode `
    -Body '{"kennelPreference":"A-premium"}'

if ($buddyDouble.StatusCode -eq 409) {
    FailExpected "HTTP $($buddyDouble.StatusCode) - Double check-in rejected (DOUBLE_CHECK_IN)"
} else {
    Write-Host "Unexpected HTTP $($buddyDouble.StatusCode) (expected 409)" -ForegroundColor Red
}
Show-Json $buddyDouble.Body

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 8: Buddy's Failed Check-out + Successful Retry (FULL PROCESS RETRY)"
Write-Host "Pet: Buddy (PET-001, DOG) | Owner: Alice Johnson (OWN-001)"
Write-Host "Features: process-level retry, same correlationId + different traceIds,"
Write-Host "          payment failure path, PROCESS_END with FAILURE then SUCCESS"
# ───────────────────────────────────────────────────────────────────────────

$sharedCorrelationId = "corr-checkout-retry-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
Step "Shared correlationId for both attempts: $sharedCorrelationId"

Step "Attempt #1: Check-out with X-Simulate: payment-failure (expect 422)..."
$buddyCheckoutFail = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$buddyBookingId/check-out" -ReturnStatusCode `
    -Headers @{ "X-Simulate" = "payment-failure"; "X-Correlation-Id" = $sharedCorrelationId } `
    -Body '{"paymentAmount":249.99,"cardNumberLast4":"4242"}'

if ($buddyCheckoutFail.StatusCode -eq 422) {
    FailExpected "HTTP $($buddyCheckoutFail.StatusCode) - Payment declined (attempt #1)"
} else {
    Write-Host "Unexpected HTTP $($buddyCheckoutFail.StatusCode) (expected 422)" -ForegroundColor Red
}
Show-Json $buddyCheckoutFail.Body

Step "Attempt #2: Check-out with same correlationId (no simulation - expect 200)..."
$buddyCheckoutSuccess = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$buddyBookingId/check-out" -ReturnStatusCode `
    -Headers @{ "X-Correlation-Id" = $sharedCorrelationId } `
    -Body '{"paymentAmount":249.99,"cardNumberLast4":"4242"}'

if ($buddyCheckoutSuccess.StatusCode -eq 200) {
    Success "HTTP $($buddyCheckoutSuccess.StatusCode) - Check-out succeeded (attempt #2)"
} else {
    Write-Host "Unexpected HTTP $($buddyCheckoutSuccess.StatusCode) (expected 200)" -ForegroundColor Red
}
Show-Json $buddyCheckoutSuccess.Body

Write-Host ""
Write-Host "Both attempts share correlationId: $sharedCorrelationId" -ForegroundColor Cyan
Write-Host "Each attempt gets its own traceId - dashboard shows both timelines together" -ForegroundColor Cyan

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 9: Thumper's Booking + Check-in with Agent Gate"
Write-Host "Pet: Thumper (PET-004, RABBIT) | Owner: Bob Martinez (OWN-002)"
Write-Host "Features: IN_PROGRESS intermediate status, logStep with spanIdOverride,"
Write-Host "          same-step status transition (IN_PROGRESS -> SUCCESS)"
# ───────────────────────────────────────────────────────────────────────────

Step "Creating booking for Thumper..."
$thumperResponse = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings" `
    -Body '{"petId":"PET-004","checkInDate":"2026-03-20","checkOutDate":"2026-03-25"}'
$thumperBookingId = $thumperResponse.bookingId
Success "Booking created: $thumperBookingId"
Show-Json $thumperResponse

Step "Checking in Thumper with X-Simulate: agent-gate (~3s delay)..."
Write-Host "  Agent is calling facilities service center to verify room operability..." -ForegroundColor Yellow
$thumperCheckin = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$thumperBookingId/check-in" `
    -Headers @{ "X-Simulate" = "agent-gate" } `
    -Body '{"kennelPreference":"C-standard"}'
Success "Checked in: $($thumperCheckin.kennelNumber)"
Show-Json $thumperCheckin
Write-Host "Event log shows two step 2 events with same spanId:" -ForegroundColor Cyan
Write-Host "  IN_PROGRESS (agent calling service center) -> SUCCESS (room cleared)" -ForegroundColor Cyan

# ───────────────────────────────────────────────────────────────────────────
Header "Scenario 10: Whiskers' Check-in with Boarding Approval (awaitCompletion)"
Write-Host "Pet: Whiskers (PET-002, CAT) | Owner: Alice Johnson (OWN-001)"
Write-Host "Features: awaitCompletion on processStart, two-phase check-in,"
Write-Host "          IN_PROGRESS -> SUCCESS visible in dashboard"
# ───────────────────────────────────────────────────────────────────────────

Step "Creating a new booking for Whiskers (she was cancelled in Scenario 6)..."
$whiskersApprovalResponse = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings" `
    -Body '{"petId":"PET-002","checkInDate":"2026-04-01","checkOutDate":"2026-04-05"}'
$whiskersApprovalBookingId = $whiskersApprovalResponse.bookingId
Success "Booking created: $whiskersApprovalBookingId"
Show-Json $whiskersApprovalResponse

$approvalCorrelationId = "corr-boarding-approval-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$approvalTraceId = [guid]::NewGuid().ToString("N")

Step "Check-in with X-Simulate: awaiting-approval (expect 202)..."
Write-Host "  Whiskers has special dietary needs - vet diet approval required..." -ForegroundColor Yellow
$whiskersCheckinApproval = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$whiskersApprovalBookingId/check-in" -ReturnStatusCode `
    -Headers @{ "X-Simulate" = "awaiting-approval"; "X-Correlation-Id" = $approvalCorrelationId; "X-Trace-Id" = $approvalTraceId } `
    -Body '{"kennelPreference":"B-quiet"}'

if ($whiskersCheckinApproval.StatusCode -eq 202) {
    Success "HTTP $($whiskersCheckinApproval.StatusCode) - Check-in accepted, awaiting vet diet approval"
} else {
    Write-Host "Unexpected HTTP $($whiskersCheckinApproval.StatusCode) (expected 202)" -ForegroundColor Red
}
Show-Json $whiskersCheckinApproval.Body

Write-Host ""
Write-Host "  > Check dashboard now - process shows IN_PROGRESS (yellow pulse)" -ForegroundColor Yellow
Write-Host "  > Press Enter to approve and complete the check-in..." -ForegroundColor Yellow
Read-Host

Step "Approving Whiskers' check-in (same correlationId + traceId)..."
$whiskersApprove = Invoke-Api -Method POST -Uri "$BASE_URL/api/bookings/$whiskersApprovalBookingId/approve-check-in" `
    -Headers @{ "X-Correlation-Id" = $approvalCorrelationId; "X-Trace-Id" = $approvalTraceId }
Success "Check-in approved: $($whiskersApprove.kennelNumber)"
Show-Json $whiskersApprove

Write-Host "Both calls share correlationId: $approvalCorrelationId" -ForegroundColor Cyan
Write-Host "Dashboard now shows SUCCESS (green) - process complete" -ForegroundColor Cyan

# ───────────────────────────────────────────────────────────────────────────
Header "Verification Lookups"
# ───────────────────────────────────────────────────────────────────────────

Step "Alice's bookings (OWN-001 - Buddy CHECKED_OUT + Whiskers CANCELLED + Whiskers CHECKED_IN)..."
Invoke-Api -Uri "$BASE_URL/api/owners/OWN-001/bookings" | Show-Json

Step "Bob's bookings (OWN-002 - Tweety PENDING + Thumper CHECKED_IN)..."
Invoke-Api -Uri "$BASE_URL/api/owners/OWN-002/bookings" | Show-Json

Step "Carol's bookings (OWN-003 - Scales CHECKED_IN)..."
Invoke-Api -Uri "$BASE_URL/api/owners/OWN-003/bookings" | Show-Json

Step "Buddy's final state ($buddyBookingId - should be CHECKED_OUT)..."
Invoke-Api -Uri "$BASE_URL/api/bookings/$buddyBookingId" | Show-Json

Step "Whiskers' cancelled booking ($whiskersBookingId - should be CANCELLED)..."
Invoke-Api -Uri "$BASE_URL/api/bookings/$whiskersBookingId" | Show-Json

Step "Whiskers' approved booking ($whiskersApprovalBookingId - should be CHECKED_IN)..."
Invoke-Api -Uri "$BASE_URL/api/bookings/$whiskersApprovalBookingId" | Show-Json

Step "Thumper's final state ($thumperBookingId - should be CHECKED_IN)..."
Invoke-Api -Uri "$BASE_URL/api/bookings/$thumperBookingId" | Show-Json

# ───────────────────────────────────────────────────────────────────────────
Header "Event Log API Verification"
# ───────────────────────────────────────────────────────────────────────────

Step "Alice's events (OWN-001)..."
Invoke-Api -Uri "$EVENTLOG_URL/v1/events/account/OWN-001" | Show-Json

Step "Alice's event summary (OWN-001)..."
Invoke-Api -Uri "$EVENTLOG_URL/v1/events/account/OWN-001/summary" | Show-Json

Step "Bob's events (OWN-002)..."
Invoke-Api -Uri "$EVENTLOG_URL/v1/events/account/OWN-002" | Show-Json

Step "Carol's events (OWN-003)..."
Invoke-Api -Uri "$EVENTLOG_URL/v1/events/account/OWN-003" | Show-Json

Step "Dashboard stats..."
Invoke-Api -Uri "$EVENTLOG_URL/v1/dashboard/stats" | Show-Json

# ───────────────────────────────────────────────────────────────────────────
Header "Demo Complete!"
Write-Host ""
Write-Host "Booking IDs:"
Write-Host "  Buddy:              $buddyBookingId (booking + check-in + failed checkout + successful checkout)"
Write-Host "  Tweety (fail):      BKG-003 (consumed, not saved - 504 timeout)"
Write-Host "  Scales:             $scalesBookingId (kennel retry + room service)"
Write-Host "  Tweety (retry):     $tweetyBookingId (successful retry)"
Write-Host "  Whiskers (cancel):  $whiskersBookingId (book -> lookup -> cancel)"
Write-Host "  Thumper:            $thumperBookingId (booking + agent-gate check-in)"
Write-Host "  Whiskers (approve): $whiskersApprovalBookingId (awaitCompletion -> approve)"
Write-Host ""
Write-Host "Verify in Event Log API:"
Write-Host "  OWN-001 - Buddy: 4 processes (booking, check-in, failed checkout, successful checkout)"
Write-Host "            Whiskers: 3 processes (booking, getBooking, cancel)"
Write-Host "            Whiskers (Sc.10): awaitCompletion check-in -> approval (IN_PROGRESS -> SUCCESS)"
Write-Host "            Checkout retry: correlationId=$sharedCorrelationId (2 attempts, 2 traceIds)"
Write-Host "            Boarding approval: correlationId=$approvalCorrelationId"
Write-Host "  OWN-002 - 3 correlation IDs (Tweety fail + Tweety success + Thumper booking/check-in)"
Write-Host "            Thumper check-in: step 2 has IN_PROGRESS -> SUCCESS on same spanId"
Write-Host "  OWN-003 - events across 2 process types (booking, room service)"
Write-Host ""
