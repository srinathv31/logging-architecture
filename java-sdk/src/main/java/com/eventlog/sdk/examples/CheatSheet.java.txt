// ============================================================================
// EVENT LOG SDK - CHEAT SHEET
// ============================================================================
// Copy-paste these patterns into your code

import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.client.TokenProvider;
import com.eventlog.sdk.model.*;
import static com.eventlog.sdk.util.EventLogUtils.*;

// -----------------------------------------------------------------------------
// CLIENT SETUP (do once at app startup)
// -----------------------------------------------------------------------------

// OPTION 1: OAuth (recommended for production)
OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
    .tokenUrl("https://auth.yourcompany.com/oauth/token")
    .clientId("your-client-id")
    .clientSecret("your-client-secret")
    .scope("eventlog:write eventlog:read")
    .build();

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .tokenProvider(tokenProvider)
    .build();

// OPTION 2: API key (dev/testing only - deprecated for production)
// EventLogClient devClient = EventLogClient.builder()
//     .baseUrl("https://eventlog-api.yourcompany.com")
//     .apiKey("your-api-key")
//     .build();

// RECOMMENDED: Use async logger for fire-and-forget
AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .queueCapacity(10_000)
    .maxRetries(3)
    .circuitBreakerThreshold(5)
    .spilloverPath(Path.of("/var/log/eventlog-spillover"))
    .build();

// -----------------------------------------------------------------------------
// GENERATE IDs
// -----------------------------------------------------------------------------
String correlationId = createCorrelationId("myprocess");  // "myprocess-m5k2x-7h3j"
String traceId = createTraceId();                         // "4bf92f3577b34da6..."
String spanId = createSpanId();                           // "a1b2c3d4e5f60001"
String batchId = createBatchId("csv-upload");             // "batch-20250129-csv-upload-x7y8"

// -----------------------------------------------------------------------------
// REAL-TIME LOGGING (RECOMMENDED)
// -----------------------------------------------------------------------------

// Log immediately after each step - fire and forget
var result = doSomething();
eventLog.log(step(correlationId, traceId, "MY_PROCESS", 1, "Step Name")
    .accountId("AC-123")
    .spanId(spanId)
    .eventStatus(result.success ? EventStatus.SUCCESS : EventStatus.FAILURE)
    .summary("Did something - " + result.message)
    .result("COMPLETED")
    .build());
// ⬆️ Returns immediately, never blocks!

// Check metrics
System.out.println(eventLog.getMetrics());

// Graceful shutdown (also happens automatically via shutdown hook)
eventLog.shutdown();

// -----------------------------------------------------------------------------
// CREATE EVENTS (use static imports for cleaner code)
// -----------------------------------------------------------------------------

// Process Start
var start = processStart(correlationId, traceId, "MY_PROCESS")
    .accountId("AC-123")
    .spanId(spanId)
    .applicationId("my-service")
    .targetSystem("SELF")
    .originatingSystem("WEB_APP")
    .summary("Started processing request for account AC-123")
    .result("INITIATED")
    .addIdentifier("request_id", "REQ-456")
    .build();

// Step
var step = step(correlationId, traceId, "MY_PROCESS", 1, "Call External API")
    .accountId("AC-123")
    .spanId(createSpanId())
    .parentSpanId(spanId)
    .applicationId("my-service")
    .targetSystem("VENDOR_API")
    .originatingSystem("MY_SERVICE")
    .eventStatus(EventStatus.SUCCESS)
    .summary("Called vendor API - response received in 250ms")
    .result("API_SUCCESS")
    .endpoint("/v1/process")
    .httpMethod(HttpMethod.POST)
    .httpStatusCode(200)
    .executionTimeMs(250)
    .build();

// Parallel Steps (same step_sequence)
var parallel1 = step(correlationId, traceId, "MY_PROCESS", 2, "Task A")
    .spanId("span-A").parentSpanId(spanId).eventStatus(EventStatus.SUCCESS)
    // ... other fields
    .build();

var parallel2 = step(correlationId, traceId, "MY_PROCESS", 2, "Task B")
    .spanId("span-B").parentSpanId(spanId).eventStatus(EventStatus.SUCCESS)
    // ... other fields
    .build();

// Step after parallel (fork-join with span_links)
var afterParallel = step(correlationId, traceId, "MY_PROCESS", 3, "Merge Results")
    .spanId("span-C")
    .parentSpanId(spanId)
    .spanLinks(List.of("span-A", "span-B"))  // Waited for both
    .eventStatus(EventStatus.SUCCESS)
    // ... other fields
    .build();

// Process End
var end = processEnd(correlationId, traceId, "MY_PROCESS", 4, EventStatus.SUCCESS, 1500)
    .accountId("AC-123")
    .spanId(createSpanId())
    .parentSpanId(spanId)
    .applicationId("my-service")
    .targetSystem("SELF")
    .originatingSystem("WEB_APP")
    .summary("Process completed successfully for account AC-123")
    .result("COMPLETED")
    .build();

// Error Event
var err = error(correlationId, traceId, "MY_PROCESS", "VENDOR_TIMEOUT", "Vendor API timed out after 30s")
    .accountId("AC-123")
    .spanId(createSpanId())
    .applicationId("my-service")
    .targetSystem("VENDOR_API")
    .originatingSystem("MY_SERVICE")
    .stepSequence(1)
    .stepName("Call External API")
    .summary("Vendor API call failed - timeout after 30 seconds")
    .result("FAILED")
    .build();

// -----------------------------------------------------------------------------
// SEND EVENTS
// -----------------------------------------------------------------------------

// RECOMMENDED: Fire-and-forget (use for real-time logging)
eventLog.log(start);  // Returns immediately

// SYNCHRONOUS: Only when you need confirmation
var response = client.createEvent(start);

// BATCH: Only for bulk imports/migrations (NOT for normal process logging)
var batchResponse = client.createEvents(List.of(importEvent1, importEvent2, importEvent3));

// -----------------------------------------------------------------------------
// QUERY EVENTS
// -----------------------------------------------------------------------------

// By account
var accountEvents = client.getEventsByAccount("AC-123");

// By correlation ID (all events for one process instance)
var processEvents = client.getEventsByCorrelation(correlationId);

// By trace ID (distributed tracing)
var traceEvents = client.getEventsByTrace(traceId);

// By batch
var batchSummary = client.getBatchSummary(batchId);

// -----------------------------------------------------------------------------
// CORRELATION LINK (connect correlation_id to account_id after account exists)
// -----------------------------------------------------------------------------
client.createCorrelationLink(correlationId, "AC-123", "APP-789", null, null);

// -----------------------------------------------------------------------------
// SUMMARY HELPER
// -----------------------------------------------------------------------------
String summary = generateSummary("Validated user", "John Doe (SSN ***1234)", "identity confirmed", "fraud score 0.02");
// → "Validated user John Doe (SSN ***1234) - identity confirmed (fraud score 0.02)"

// Mask sensitive data
String masked = maskLast4("123456789");  // → "***6789"
