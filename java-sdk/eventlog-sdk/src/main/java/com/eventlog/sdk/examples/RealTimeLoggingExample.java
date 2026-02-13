package com.eventlog.sdk.examples;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.model.*;

import java.nio.file.Path;
import java.util.List;

import static com.eventlog.sdk.util.EventLogUtils.*;

/**
 * ============================================================================
 * REAL-TIME EVENT LOGGING - RECOMMENDED PATTERN
 * ============================================================================
 * 
 * This example shows the correct way to log events in production:
 * 
 *   ✅ Log each step IMMEDIATELY after it completes (fire-and-forget)
 *   ✅ Never block business logic waiting for event log API
 *   ✅ Events are captured even if process crashes mid-way
 *   
 *   ❌ DON'T batch events and send at end of process
 *   ❌ DON'T wait for event log response before continuing
 * 
 * Why? If your process crashes at step 3, you still have logs for steps 1 & 2.
 * That's the whole point of observability!
 */
public class RealTimeLoggingExample {

    public static void main(String[] args) throws Exception {
        
        // ====================================================================
        // SETUP - Do this ONCE at application startup
        // ====================================================================
        
        // 1. Configure OAuth authentication
        OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
                .tokenUrl("https://auth.yourcompany.com/oauth/token")
                .clientId("your-client-id")
                .clientSecret("your-client-secret")
                .scope("eventlog:write eventlog:read")
                .build();

        // 2. Create client with OAuth
        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.yourcompany.com")
                .tokenProvider(tokenProvider)
                .build();

        // 3. Use AsyncEventLogger for fire-and-forget logging
        AsyncEventLogger eventLog = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(10_000)          // Buffer up to 10k events
                .maxRetries(3)                   // Retry failed sends
                .circuitBreakerThreshold(5)      // Open circuit after 5 consecutive failures
                .circuitBreakerResetMs(30_000)   // Try again after 30 seconds
                .spilloverPath(Path.of("/var/log/eventlog-spillover"))  // Save to disk if API down
                .build();

        // ====================================================================
        // YOUR BUSINESS PROCESS
        // ====================================================================
        
        String correlationId = createCorrelationId("onboard");
        String traceId = createTraceId();
        String accountId = "AC-1234567890";
        String processName = "CUSTOMER_ONBOARDING";
        
        String rootSpanId = createSpanId();
        long processStartTime = System.currentTimeMillis();

        // --------------------------------------------------------------------
        // PROCESS START - Log immediately
        // --------------------------------------------------------------------
        eventLog.log(processStart(correlationId, traceId, processName)
                .accountId(accountId)
                .spanId(rootSpanId)
                .applicationId("onboarding-service")
                .targetSystem("ONBOARDING_SERVICE")
                .originatingSystem("WEB_APP")
                .summary("Customer onboarding initiated for account " + accountId)
                .result("INITIATED")
                .addIdentifier("customer_id", "CUST-9876")
                .build());
        // ⬆️ This returns IMMEDIATELY - doesn't wait for API response

        // --------------------------------------------------------------------
        // STEP 1: Identity Verification - Log when complete
        // --------------------------------------------------------------------
        String step1SpanId = createSpanId();
        long step1Start = System.currentTimeMillis();
        
        // ... your actual identity verification code here ...
        IdentityResult identityResult = verifyIdentity("CUST-9876");
        
        // Log the result immediately after step completes
        eventLog.log(step(correlationId, traceId, processName, 1, "Identity Verification")
                .accountId(accountId)
                .spanId(step1SpanId)
                .parentSpanId(rootSpanId)
                .applicationId("onboarding-service")
                .targetSystem("IDENTITY_PROVIDER")
                .originatingSystem("ONBOARDING_SERVICE")
                .eventStatus(identityResult.success ? EventStatus.SUCCESS : EventStatus.FAILURE)
                .summary("Verified customer identity - " + identityResult.message)
                .result(identityResult.success ? "VERIFIED" : "FAILED")
                .addIdentifier("verification_id", identityResult.verificationId)
                .executionTimeMs((int)(System.currentTimeMillis() - step1Start))
                .build());

        if (!identityResult.success) {
            // Log error and exit - but event is already captured!
            logProcessFailure(eventLog, correlationId, traceId, processName, accountId, 
                    rootSpanId, 1, "Identity verification failed", processStartTime);
            return;
        }

        // --------------------------------------------------------------------
        // STEP 2a & 2b: Parallel steps - Log each when complete
        // --------------------------------------------------------------------
        String step2aSpanId = createSpanId();
        String step2bSpanId = createSpanId();
        
        // Run in parallel using CompletableFuture (or your preferred method)
        var creditFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            long start = System.currentTimeMillis();
            CreditResult result = performCreditCheck("CUST-9876");
            
            // Log immediately when this parallel task completes
            eventLog.log(step(correlationId, traceId, processName, 2, "Credit Check")
                    .accountId(accountId)
                    .spanId(step2aSpanId)
                    .parentSpanId(step1SpanId)
                    .applicationId("onboarding-service")
                    .targetSystem("CREDIT_BUREAU")
                    .originatingSystem("ONBOARDING_SERVICE")
                    .eventStatus(result.approved ? EventStatus.SUCCESS : EventStatus.FAILURE)
                    .summary("Credit check completed - FICO " + result.ficoScore + ", " + 
                            (result.approved ? "approved" : "declined"))
                    .result(result.approved ? "APPROVED" : "DECLINED")
                    .addIdentifier("credit_report_id", result.reportId)
                    .executionTimeMs((int)(System.currentTimeMillis() - start))
                    .build());
            
            return result;
        });

        var complianceFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            long start = System.currentTimeMillis();
            ComplianceResult result = performComplianceCheck("CUST-9876");
            
            // Log immediately when this parallel task completes
            eventLog.log(step(correlationId, traceId, processName, 2, "Compliance Check")
                    .accountId(accountId)
                    .spanId(step2bSpanId)
                    .parentSpanId(step1SpanId)
                    .applicationId("onboarding-service")
                    .targetSystem("COMPLIANCE_SERVICE")
                    .originatingSystem("ONBOARDING_SERVICE")
                    .eventStatus(result.compliant ? EventStatus.SUCCESS : EventStatus.FAILURE)
                    .summary("Compliance check - OFAC " + result.ofacStatus + ", risk level " + result.riskLevel)
                    .result(result.compliant ? "COMPLIANT" : "FLAGGED")
                    .addIdentifier("compliance_case_id", result.caseId)
                    .executionTimeMs((int)(System.currentTimeMillis() - start))
                    .build());
            
            return result;
        });

        // Wait for both parallel tasks
        CreditResult creditResult = creditFuture.get();
        ComplianceResult complianceResult = complianceFuture.get();
        
        // At this point, BOTH step 2a and 2b events are already logged!

        if (!creditResult.approved || !complianceResult.compliant) {
            logProcessFailure(eventLog, correlationId, traceId, processName, accountId,
                    rootSpanId, 2, "Credit or compliance check failed", processStartTime);
            return;
        }

        // --------------------------------------------------------------------
        // STEP 3: Account Provisioning - Uses span_links for fork-join
        // --------------------------------------------------------------------
        String step3SpanId = createSpanId();
        long step3Start = System.currentTimeMillis();
        
        ProvisionResult provisionResult = provisionAccount(accountId);
        
        eventLog.log(step(correlationId, traceId, processName, 3, "Account Provisioning")
                .accountId(accountId)
                .spanId(step3SpanId)
                .parentSpanId(step1SpanId)
                .spanLinks(List.of(step2aSpanId, step2bSpanId))  // Fork-join: depended on both
                .applicationId("onboarding-service")
                .targetSystem("CORE_BANKING")
                .originatingSystem("ONBOARDING_SERVICE")
                .eventStatus(provisionResult.success ? EventStatus.SUCCESS : EventStatus.FAILURE)
                .summary("Account provisioned in core banking - " + provisionResult.message)
                .result(provisionResult.success ? "PROVISIONED" : "FAILED")
                .addIdentifier("core_banking_ref", provisionResult.coreBankingRef)
                .executionTimeMs((int)(System.currentTimeMillis() - step3Start))
                .build());

        if (!provisionResult.success) {
            logProcessFailure(eventLog, correlationId, traceId, processName, accountId,
                    rootSpanId, 3, "Account provisioning failed", processStartTime);
            return;
        }

        // --------------------------------------------------------------------
        // PROCESS END - Success!
        // --------------------------------------------------------------------
        int totalDuration = (int)(System.currentTimeMillis() - processStartTime);
        
        eventLog.log(processEnd(correlationId, traceId, processName, 4, EventStatus.SUCCESS, totalDuration)
                .accountId(accountId)
                .spanId(createSpanId())
                .parentSpanId(rootSpanId)
                .applicationId("onboarding-service")
                .targetSystem("WEB_APP")
                .originatingSystem("ONBOARDING_SERVICE")
                .summary("Customer onboarding completed successfully for " + accountId + 
                        " in " + totalDuration + "ms")
                .result("COMPLETED")
                .build());

        // ====================================================================
        // METRICS - Check how the logger is doing
        // ====================================================================
        AsyncEventLogger.Metrics metrics = eventLog.getMetrics();
        System.out.println("Event Log Metrics: " + metrics);
        // Output: Metrics{queued=6, sent=6, failed=0, spilled=0, depth=0, circuitOpen=false}

        // ====================================================================
        // SHUTDOWN - In production, let the shutdown hook handle this
        // ====================================================================
        // eventLog.shutdown();  // Flushes pending events
    }

    // Helper to log process failure
    private static void logProcessFailure(
            AsyncEventLogger eventLog,
            String correlationId, String traceId, String processName,
            String accountId, String rootSpanId, int failedStep,
            String reason, long processStartTime) {
        
        eventLog.log(processEnd(correlationId, traceId, processName, failedStep, 
                EventStatus.FAILURE, (int)(System.currentTimeMillis() - processStartTime))
                .accountId(accountId)
                .spanId(createSpanId())
                .parentSpanId(rootSpanId)
                .applicationId("onboarding-service")
                .targetSystem("WEB_APP")
                .originatingSystem("ONBOARDING_SERVICE")
                .summary("Customer onboarding failed at step " + failedStep + ": " + reason)
                .result("FAILED")
                .errorCode("STEP_" + failedStep + "_FAILED")
                .errorMessage(reason)
                .build());
    }

    // ========================================================================
    // MOCK BUSINESS LOGIC (replace with your actual implementations)
    // ========================================================================
    
    static IdentityResult verifyIdentity(String customerId) {
        // Simulate API call
        try { Thread.sleep(100); } catch (InterruptedException ignored) {}
        return new IdentityResult(true, "VER-" + System.currentTimeMillis(), "Match confidence 98.5%");
    }

    static CreditResult performCreditCheck(String customerId) {
        try { Thread.sleep(150); } catch (InterruptedException ignored) {}
        return new CreditResult(true, 742, "CR-" + System.currentTimeMillis());
    }

    static ComplianceResult performComplianceCheck(String customerId) {
        try { Thread.sleep(120); } catch (InterruptedException ignored) {}
        return new ComplianceResult(true, "CLEAR", "LOW", "COMP-" + System.currentTimeMillis());
    }

    static ProvisionResult provisionAccount(String accountId) {
        try { Thread.sleep(80); } catch (InterruptedException ignored) {}
        return new ProvisionResult(true, "CB-" + System.currentTimeMillis(), "Account activated");
    }

    // Result classes
    record IdentityResult(boolean success, String verificationId, String message) {}
    record CreditResult(boolean approved, int ficoScore, String reportId) {}
    record ComplianceResult(boolean compliant, String ofacStatus, String riskLevel, String caseId) {}
    record ProvisionResult(boolean success, String coreBankingRef, String message) {}
}

/*
 * ============================================================================
 * KEY TAKEAWAYS
 * ============================================================================
 * 
 * 1. USE AsyncEventLogger.log() - It's fire-and-forget, never blocks
 * 
 * 2. LOG IMMEDIATELY after each step completes:
 *    
 *    result = doSomething();
 *    eventLog.log(event);  // RIGHT HERE, not later
 *    
 * 3. DON'T collect events and send at the end:
 *    
 *    ❌ List<Event> events = new ArrayList<>();
 *    ❌ events.add(step1Event);
 *    ❌ events.add(step2Event);
 *    ❌ client.createEvents(events);  // If crash before this, all lost!
 *    
 * 4. PARALLEL STEPS get logged independently as they complete
 * 
 * 5. The AsyncEventLogger handles:
 *    - Retries with exponential backoff
 *    - Circuit breaker when API is down
 *    - Spillover to disk as last resort
 *    - Graceful shutdown (flushes pending events)
 * 
 * ============================================================================
 */
