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
#   3. metrics-dashboard.html open in browser (set polling to 2s)
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/spillover-demo.ps1
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$AppConfig = Join-Path $AppDir "src/main/resources/application.yml"

$BASE_URL = "http://localhost:8081"
$EVENTLOG_URL = "http://localhost:3000"
$METRICS_URL = "$BASE_URL/actuator/metrics"

# ── Helper functions ──────────────────────────────────────────────────────

function Step($msg) {
    Write-Host ""
    Write-Host "▸ $msg" -ForegroundColor Cyan
}

function Success($msg) {
    Write-Host "✓ $msg" -ForegroundColor Green
}

function Warn($msg) {
    Write-Host "⚠ $msg" -ForegroundColor Yellow
}

function Info($msg) {
    Write-Host "  $msg" -ForegroundColor DarkGray
}

function Header($msg) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
    Write-Host "  $msg" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor White
}

function Pause-Demo($msg) {
    Write-Host ""
    Write-Host "▸ $msg" -ForegroundColor Magenta
    Read-Host | Out-Null
}

function Get-Metric($name) {
    try {
        $response = Invoke-RestMethod -Uri "$METRICS_URL/$name" -ErrorAction Stop
        $val = $response.measurements[0].value
        if ($null -eq $val) { return "0" }
        return [string]$val
    }
    catch {
        return "N/A"
    }
}

function Print-Metric($label, $name) {
    $val = Get-Metric $name
    Write-Host ("  {0,-28} {1}" -f $label, $val)
}

function Get-AsyncCfgValue($key) {
    if (-not (Test-Path $AppConfig)) { return "" }

    $inEventlog = $false
    $inAsync = $false
    $eventlogIndent = -1
    $asyncIndent = -1

    foreach ($rawLine in Get-Content $AppConfig) {
        # Skip comments
        if ($rawLine -match '^\s*#') { continue }

        # Strip inline comments
        $line = $rawLine -replace '\s+#.*', ''

        # Skip blank lines
        if ($line -match '^\s*$') { continue }

        # Calculate indent
        $indent = 0
        if ($line -match '^( +)') { $indent = $Matches[1].Length }

        # Detect eventlog: block
        if ($line -match '^\s*eventlog:\s*$') {
            $inEventlog = $true
            $inAsync = $false
            $eventlogIndent = $indent
            continue
        }

        # Exit eventlog block if indent goes back
        if ($inEventlog -and $indent -le $eventlogIndent) {
            $inEventlog = $false
            $inAsync = $false
        }
        if (-not $inEventlog) { continue }

        # Detect async: block
        if ($line -match '^\s*async:\s*$') {
            $inAsync = $true
            $asyncIndent = $indent
            continue
        }

        # Exit async block if indent goes back
        if ($inAsync -and $indent -le $asyncIndent) {
            $inAsync = $false
        }
        if (-not $inAsync) { continue }

        # Match the target key
        if ($line -match "^\s*${key}:\s*(.+)$") {
            $val = $Matches[1].Trim()
            $val = $val -replace '^[''"]|[''"]$', ''
            return $val
        }
    }

    return ""
}

function Get-CfgCurrentOrDefault($key, $fallback) {
    $val = Get-AsyncCfgValue $key
    if ($val) {
        return $val
    }
    else {
        return "(dflt) $fallback"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
Header "Phase 1: Setup Checks"
Write-Host "Verifying services and preparing the dashboard..."
# ═══════════════════════════════════════════════════════════════════════════

Step "Checking Pet Resort API on :8081..."
try {
    Invoke-RestMethod -Uri "$BASE_URL/actuator/health" -ErrorAction Stop | Out-Null
    Success "Pet Resort API is running"
}
catch {
    Write-Host "✗ Pet Resort API not reachable at $BASE_URL/actuator/health" -ForegroundColor Red
    Write-Host "  Start it:  cd pet-resort-api && mvn spring-boot:run" -ForegroundColor Red
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

# jq check not needed in PowerShell — JSON parsing is built-in

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  Open metrics-dashboard.html in your browser now." -ForegroundColor Yellow
Write-Host "  Set the polling interval to 2s for real-time updates." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Step "Baseline metrics snapshot:"
Write-Host "  SDK Metrics" -ForegroundColor White
Print-Metric "Events Queued:"        "eventlog.events.queued"
Print-Metric "Events Sent:"          "eventlog.events.sent"
Print-Metric "Events Failed:"        "eventlog.events.failed"
Print-Metric "Events Spilled:"       "eventlog.events.spilled"
Print-Metric "Events Replayed:"      "eventlog.events.replayed"
Print-Metric "Queue Depth:"          "eventlog.queue.depth"
Print-Metric "Circuit Breaker Open:" "eventlog.circuit-breaker.open"
Write-Host "  App Metrics" -ForegroundColor White
Print-Metric "Bookings Created:"     "petresort.bookings.created"
Print-Metric "Check-ins Completed:"  "petresort.checkins.completed"
Print-Metric "Checkouts Completed:"  "petresort.checkouts.completed"
Print-Metric "Room Service Orders:"  "petresort.roomservice.orders"
Print-Metric "Active Bookings:"      "petresort.bookings.active"
Print-Metric "Pets Checked In:"      "petresort.pets.checked_in"

Pause-Demo "Press Enter to begin the normal flow demo..."

# ═══════════════════════════════════════════════════════════════════════════
Header "Phase 2: Normal Flow — Metrics Incrementing"
Write-Host "Watch the dashboard as SDK and app metrics move together."
# ═══════════════════════════════════════════════════════════════════════════

# --- Step 1: Create a booking ---
Step "1. Creating a booking for Buddy (PET-001)..."
Info "Expect: bookings.created +1, events.queued +N, events.sent +N, bookings.active +1"
$BookingResponse = Invoke-RestMethod -Uri "$BASE_URL/api/bookings" -Method Post `
    -ContentType "application/json" `
    -Body '{"petId":"PET-001","checkInDate":"2026-06-01","checkOutDate":"2026-06-05"}'
$BookingId = $BookingResponse.bookingId
Success "Booking created: $BookingId"
$BookingResponse | ConvertTo-Json -Depth 5
Start-Sleep -Seconds 2

# --- Step 2: Check in ---
Step "2. Checking in Buddy..."
Info "Expect: checkins.completed +1, pets.checked_in +1"
$CheckinResponse = Invoke-RestMethod -Uri "$BASE_URL/api/bookings/$BookingId/check-in" -Method Post `
    -ContentType "application/json" `
    -Body '{"kennelPreference":"A-premium"}'
Success "Checked in: $($CheckinResponse.kennelNumber)"
$CheckinResponse | ConvertTo-Json -Depth 5
Start-Sleep -Seconds 2

# --- Step 3: Room service ---
Step "3. Ordering room service for Buddy..."
Info "Expect: roomservice.orders +1"
$RoomBody = @{
    petId     = "PET-001"
    bookingId = $BookingId
    item      = "Premium Steak Dinner"
    quantity  = 1
} | ConvertTo-Json
$RoomResponse = Invoke-RestMethod -Uri "$BASE_URL/api/room-service" -Method Post `
    -ContentType "application/json" `
    -Body $RoomBody
Success "Room service: $($RoomResponse.orderId)"
$RoomResponse | ConvertTo-Json -Depth 5
Start-Sleep -Seconds 2

# --- Step 4: Check out ---
Step "4. Checking out Buddy..."
Info "Expect: checkouts.completed +1, payments.total +1, pets.checked_in -1, bookings.active -1"
$CheckoutResponse = Invoke-RestMethod -Uri "$BASE_URL/api/bookings/$BookingId/check-out" -Method Post `
    -ContentType "application/json" `
    -Body '{"paymentAmount":199.99,"cardNumberLast4":"4242"}'
Success "Checked out: $($CheckoutResponse.status)"
$CheckoutResponse | ConvertTo-Json -Depth 5
Start-Sleep -Seconds 2

Step "Verification — current metrics after normal flow:"
Write-Host "  SDK" -ForegroundColor White
Print-Metric "Events Queued:"  "eventlog.events.queued"
Print-Metric "Events Sent:"    "eventlog.events.sent"
Print-Metric "Events Failed:"  "eventlog.events.failed"
Print-Metric "Queue Depth:"    "eventlog.queue.depth"
Write-Host "  App" -ForegroundColor White
Print-Metric "Bookings Created:"     "petresort.bookings.created"
Print-Metric "Check-ins Completed:"  "petresort.checkins.completed"
Print-Metric "Checkouts Completed:"  "petresort.checkouts.completed"
Print-Metric "Room Service Orders:"  "petresort.roomservice.orders"

Write-Host ""
Write-Host "Dashboard should show all metrics flowing — queued ≈ sent, zero failures." -ForegroundColor Green

Pause-Demo "Press Enter to begin the spillover demo..."

# ═══════════════════════════════════════════════════════════════════════════
Header "Phase 3: Spillover Demo — Breaking the Event Log API"
Write-Host "We'll stop the Event Log API and flood events to trigger"
Write-Host "circuit breaker + disk spillover."
# ═══════════════════════════════════════════════════════════════════════════

# Record pre-spillover state
$PreQueued  = Get-Metric "eventlog.events.queued"
$PreSent    = Get-Metric "eventlog.events.sent"
$PreFailed  = Get-Metric "eventlog.events.failed"
$PreSpilled = Get-Metric "eventlog.events.spilled"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Write-Host "  Stop the Event Log API now (Ctrl+C in its terminal)." -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Pause-Demo "Press Enter once the Event Log API is stopped..."

Step "Verifying Event Log API is down..."
$apiUp = $true
try {
    Invoke-RestMethod -Uri "$EVENTLOG_URL/v1/healthcheck" -ErrorAction Stop | Out-Null
}
catch {
    $apiUp = $false
}
if ($apiUp) {
    Warn "Event Log API still appears to be running! The demo works best with it stopped."
}
else {
    Success "Event Log API is down — events will fail delivery"
}

Step "Firing 15 rapid bookings to generate ~75 events against a dead endpoint..."
Info "Each booking generates multiple SDK events (PROCESS_START, steps, PROCESS_END)."
Info "Watch the dashboard:"
Info "  • Queue Depth climbing"
Info "  • Events Spilled to Disk incrementing (spillover absorbs failures)"
Info "  • Events Failed usually stays low while spillover has capacity"
Info "    (it increases if spillover queue/file limits are reached)"
Info "  • Circuit Breaker flipping OPEN (red badge) after 5 failures"
Info "  • Delivery Rate % dropping"
Write-Host ""

for ($i = 1; $i -le 15; $i++) {
    $petNum = ($i % 5) + 1
    $checkIn = "2026-07-{0:D2}" -f $i
    $checkOut = "2026-07-{0:D2}" -f ($i + 5)
    $body = @{
        petId        = "PET-00$petNum"
        checkInDate  = $checkIn
        checkOutDate = $checkOut
    } | ConvertTo-Json

    Write-Host ("  Booking {0,2}/15... " -f $i) -ForegroundColor Cyan -NoNewline
    try {
        $resp = Invoke-WebRequest -Uri "$BASE_URL/api/bookings" -Method Post `
            -ContentType "application/json" -Body $body -ErrorAction Stop
        $code = $resp.StatusCode
        if ($code -eq 200 -or $code -eq 201) {
            Write-Host "HTTP $code" -ForegroundColor Green
        }
        else {
            Write-Host "HTTP $code" -ForegroundColor Yellow
        }
    }
    catch {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            Write-Host "HTTP $code" -ForegroundColor Yellow
        }
        else {
            Write-Host "ERROR" -ForegroundColor Red
        }
    }
    Start-Sleep -Milliseconds 300
}

Write-Host ""
Success "15 bookings fired — events are piling up"

Start-Sleep -Seconds 3

Step "Post-flood metrics:"
Write-Host "  SDK" -ForegroundColor White
Print-Metric "Events Queued:"        "eventlog.events.queued"
Print-Metric "Events Sent:"          "eventlog.events.sent"
Print-Metric "Events Failed:"        "eventlog.events.failed"
Print-Metric "Events Spilled:"       "eventlog.events.spilled"
Print-Metric "Queue Depth:"          "eventlog.queue.depth"
Print-Metric "Circuit Breaker Open:" "eventlog.circuit-breaker.open"

Step "Checking spillover directory..."
$spillDir = Join-Path $AppDir "spillover"
if (Test-Path $spillDir) {
    $spillFiles = Get-ChildItem -Path $spillDir -File -ErrorAction SilentlyContinue
    $spillCount = ($spillFiles | Measure-Object).Count
    Success "Spillover directory exists — $spillCount file(s)"
    if ($spillFiles) { $spillFiles | Format-Table Name, Length, LastWriteTime -AutoSize }
}
else {
    Info "Spillover directory not yet created (events may still be in the queue)"
}

Write-Host ""
Write-Host "Actuator verification commands:" -ForegroundColor Yellow
Info "  Invoke-RestMethod $METRICS_URL/eventlog.events.spilled"
Info "  Invoke-RestMethod $METRICS_URL/eventlog.circuit-breaker.open"
Info "  Invoke-RestMethod $METRICS_URL/eventlog.queue.depth"

Pause-Demo "Observe the dashboard. Press Enter when ready to restore the Event Log API..."

# ═══════════════════════════════════════════════════════════════════════════
Header "Phase 4: Recovery — Restoring the Event Log API"
Write-Host "Restart the API and watch the SDK recover automatically."
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  Restart the Event Log API now:" -ForegroundColor Green
Write-Host "    cd api && pnpm dev" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Pause-Demo "Press Enter once the Event Log API is running again..."

Step "Polling Event Log API health..."
$retries = 0
$maxRetries = 15
$apiBack = $false
while ($retries -lt $maxRetries) {
    try {
        Invoke-RestMethod -Uri "$EVENTLOG_URL/v1/healthcheck" -ErrorAction Stop | Out-Null
        Success "Event Log API is back online!"
        $apiBack = $true
        break
    }
    catch {
        $retries++
        Write-Host ("  Waiting... (attempt {0}/{1})" -f $retries, $maxRetries) -ForegroundColor DarkGray
        Start-Sleep -Seconds 2
    }
}

if (-not $apiBack) {
    Write-Host "✗ Event Log API did not come back after $maxRetries attempts" -ForegroundColor Red
    Write-Host "  Make sure it's running on $EVENTLOG_URL" -ForegroundColor Red
    exit 1
}

Write-Host ""
Info "Recovery sequence on the dashboard:"
Info "  1. Circuit Breaker resets to CLOSED (green badge) after ~30s"
Info "     (no new business requests required)"
Info "  2. Events Replayed increments (separate counter from Sent)"
Info "     Replay runs on the background interval (default 10s)"
Info "  3. Queue Depth drains back toward 0"
Info "  4. Delivery Rate bar recovers toward 100%"

Step "Waiting for circuit breaker to reset (polling every 5s, max 90s)..."
$cbElapsed = 0
$cbMax = 90
$cbClosed = $false
while ($cbElapsed -lt $cbMax) {
    $cbVal = Get-Metric "eventlog.circuit-breaker.open"
    if ($cbVal -eq "0" -or $cbVal -eq "0.0") {
        $cbClosed = $true
        Success "Circuit breaker CLOSED! Waiting 10s for replay cycle..."
        Start-Sleep -Seconds 10
        break
    }
    $cbElapsed += 5
    Write-Host ("  Circuit breaker still OPEN... ({0}s elapsed)" -f $cbElapsed) -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}
if (-not $cbClosed) {
    Warn "Circuit breaker still OPEN after ${cbMax}s."
    Info "If this is an older SDK build, trigger one booking request to force a sender-loop health check."
}

Step "Post-recovery metrics:"
$PostQueued   = Get-Metric "eventlog.events.queued"
$PostSent     = Get-Metric "eventlog.events.sent"
$PostFailed   = Get-Metric "eventlog.events.failed"
$PostSpilled  = Get-Metric "eventlog.events.spilled"
$PostReplayed = Get-Metric "eventlog.events.replayed"
$PostDepth    = Get-Metric "eventlog.queue.depth"
$PostCB       = Get-Metric "eventlog.circuit-breaker.open"

Write-Host "  SDK" -ForegroundColor White
Write-Host ("  {0,-28} {1,-10} → {2}" -f "Events Queued:", $PreQueued, $PostQueued)
Write-Host ("  {0,-28} {1,-10} → {2}" -f "Events Sent:", $PreSent, $PostSent)
Write-Host ("  {0,-28} {1,-10} → {2}" -f "Events Failed:", $PreFailed, $PostFailed)
Write-Host ("  {0,-28} {1,-10} → {2}" -f "Events Spilled:", $PreSpilled, $PostSpilled)
Write-Host ("  {0,-28} {1}" -f "Events Replayed:", $PostReplayed)
Write-Host ("  {0,-28} {1}" -f "Queue Depth:", $PostDepth)
if ($PostCB -eq "0" -or $PostCB -eq "0.0") {
    Write-Host ("  {0,-28} " -f "Circuit Breaker:") -NoNewline
    Write-Host "CLOSED" -ForegroundColor Green
}
else {
    Write-Host ("  {0,-28} " -f "Circuit Breaker:") -NoNewline
    Write-Host "OPEN (still recovering — wait longer)" -ForegroundColor Red
}

Step "Checking spillover directory after replay..."
if (Test-Path $spillDir) {
    $spillFiles = Get-ChildItem -Path $spillDir -File -ErrorAction SilentlyContinue
    $spillCount = ($spillFiles | Measure-Object).Count
    if ($spillCount -eq 0) {
        Success "Spillover directory is empty — all events replayed!"
    }
    else {
        Info "Spillover directory still has $spillCount file(s) — replay may need more time"
        Info "If API instability persists, the SDK keeps remaining events on disk and retries next cycle."
        if ($spillFiles) { $spillFiles | Format-Table Name, Length, LastWriteTime -AutoSize }
    }
}
else {
    Success "No spillover directory — nothing was spilled (queue absorbed everything)"
}

Pause-Demo "Press Enter to see the summary..."

# ═══════════════════════════════════════════════════════════════════════════
Header "Phase 5: Optional — Aggressive Spillover Config"
Write-Host "To trigger spillover even faster, lower these in application.yml:"
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "  eventlog:" -ForegroundColor Cyan
Write-Host "    async:" -ForegroundColor Cyan
Write-Host -NoNewline "      queue-capacity: 10           " -ForegroundColor Cyan
Write-Host "# was 1000" -ForegroundColor DarkGray
Write-Host -NoNewline "      circuit-breaker-threshold: 2  " -ForegroundColor Cyan
Write-Host "# was 5 (default)" -ForegroundColor DarkGray
Write-Host -NoNewline "      max-spillover-events: 200     " -ForegroundColor Cyan
Write-Host "# optional, default 10000" -ForegroundColor DarkGray
Write-Host -NoNewline "      max-spillover-size-mb: 5      " -ForegroundColor Cyan
Write-Host "# optional, default 50" -ForegroundColor DarkGray
Write-Host ""
Info "Restart pet-resort-api after changing, then re-run this script."
Info "With a tiny queue, even 2-3 bookings will trigger disk spillover."

# ═══════════════════════════════════════════════════════════════════════════
Header "Phase 6: Summary"
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "Final Metrics Snapshot" -ForegroundColor White
Write-Host "  ┌──────────────────────────────┬───────────┐"
Write-Host "  │ SDK Metric                   │ Value     │"
Write-Host "  ├──────────────────────────────┼───────────┤"
Write-Host ("  │ {0,-28} │ {1,9} │" -f "eventlog.events.queued",   (Get-Metric 'eventlog.events.queued'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "eventlog.events.sent",     (Get-Metric 'eventlog.events.sent'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "eventlog.events.failed",   (Get-Metric 'eventlog.events.failed'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "eventlog.events.spilled",  (Get-Metric 'eventlog.events.spilled'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "eventlog.events.replayed", (Get-Metric 'eventlog.events.replayed'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "eventlog.queue.depth",     (Get-Metric 'eventlog.queue.depth'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "eventlog.circuit-breaker.open", (Get-Metric 'eventlog.circuit-breaker.open'))
Write-Host "  ├──────────────────────────────┼───────────┤"
Write-Host "  │ App Metric                   │ Value     │"
Write-Host "  ├──────────────────────────────┼───────────┤"
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.bookings.created",    (Get-Metric 'petresort.bookings.created'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.checkins.completed",  (Get-Metric 'petresort.checkins.completed'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.checkouts.completed", (Get-Metric 'petresort.checkouts.completed'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.bookings.cancelled",  (Get-Metric 'petresort.bookings.cancelled'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.payments.total",      (Get-Metric 'petresort.payments.total'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.payments.failed",     (Get-Metric 'petresort.payments.failed'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.roomservice.orders",  (Get-Metric 'petresort.roomservice.orders'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.bookings.active",     (Get-Metric 'petresort.bookings.active'))
Write-Host ("  │ {0,-28} │ {1,9} │" -f "petresort.pets.checked_in",     (Get-Metric 'petresort.pets.checked_in'))
Write-Host "  └──────────────────────────────┴───────────┘"

Write-Host ""
Write-Host "Key Config Values (application.yml)" -ForegroundColor White
$AsyncQueueCapacity       = Get-CfgCurrentOrDefault "queue-capacity" "10000"
$AsyncCBThreshold         = Get-CfgCurrentOrDefault "circuit-breaker-threshold" "5"
$AsyncCBResetMs           = Get-CfgCurrentOrDefault "circuit-breaker-reset-ms" "30000"
$AsyncSpilloverPath       = Get-AsyncCfgValue "spillover-path"
if (-not $AsyncSpilloverPath) { $AsyncSpilloverPath = "(unset)" }
$AsyncReplayInterval      = Get-CfgCurrentOrDefault "replay-interval-ms" "10000"
$AsyncMaxSpilloverEvents  = Get-CfgCurrentOrDefault "max-spillover-events" "10000"
$AsyncMaxSpilloverSizeMB  = Get-CfgCurrentOrDefault "max-spillover-size-mb" "50"
Write-Host "  ┌──────────────────────────────────┬──────────────┬──────────┐"
Write-Host "  │ Property                         │ Current      │ Default  │"
Write-Host "  ├──────────────────────────────────┼──────────────┼──────────┤"
Write-Host ("  │ {0,-32} │ {1,-12} │ {2,-8} │" -f "async.queue-capacity", $AsyncQueueCapacity, "10000")
Write-Host ("  │ {0,-32} │ {1,-12} │ {2,-8} │" -f "async.circuit-breaker-threshold", $AsyncCBThreshold, "5")
Write-Host ("  │ {0,-32} │ {1,-12} │ {2,-8} │" -f "async.circuit-breaker-reset-ms", $AsyncCBResetMs, "30000")
Write-Host ("  │ {0,-32} │ {1,-12} │ {2,-8} │" -f "async.spillover-path", $AsyncSpilloverPath, "—")
Write-Host ("  │ {0,-32} │ {1,-12} │ {2,-8} │" -f "async.replay-interval-ms", $AsyncReplayInterval, "10000")
Write-Host ("  │ {0,-32} │ {1,-12} │ {2,-8} │" -f "async.max-spillover-events", $AsyncMaxSpilloverEvents, "10000")
Write-Host ("  │ {0,-32} │ {1,-12} │ {2,-8} │" -f "async.max-spillover-size-mb", $AsyncMaxSpilloverSizeMB, "50")
Write-Host "  └──────────────────────────────────┴──────────────┴──────────┘"

Write-Host ""
Write-Host "For the full event log SDK demo (10 scenarios), run:" -ForegroundColor Cyan
Info "  bash scripts/demo-runbook.sh"
Write-Host ""
