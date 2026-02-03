package com.eventlog.sdk.examples;

import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.model.*;
import com.eventlog.sdk.model.ApiResponses.BatchCreateEventResponse;

import java.util.ArrayList;
import java.util.List;

import static com.eventlog.sdk.util.EventLogUtils.*;

/**
 * ============================================================================
 * Event Log SDK - Quick Start Example
 * ============================================================================
 * 
 * This example demonstrates logging a complete business process with:
 *   - Process Start
 *   - Step 1: Sequential step
 *   - Step 2a & 2b: Parallel steps (same step_sequence)
 *   - Step 3: Depends on both parallel steps (uses span_links)
 *   - Process End
 * 
 * Run this example:
 *   1. Add the SDK dependency to your pom.xml
 *   2. Update the baseUrl and apiKey below
 *   3. Run: mvn exec:java -Dexec.mainClass="com.eventlog.sdk.examples.QuickStartExample"
 */
public class QuickStartExample {

    public static void main(String[] args) {
        
        // ====================================================================
        // 1. CREATE THE CLIENT
        // ====================================================================
        EventLogClient client = EventLogClient.builder()
                .baseUrl("https://eventlog-api.yourcompany.com")
                .apiKey("your-api-key")
                .build();

        // ====================================================================
        // 2. GENERATE IDS
        // ====================================================================
        // correlation_id: Groups all events for this business process
        // trace_id: Spans the entire request (propagate via traceparent header)
        // span_id: Unique per step, creates the execution tree
        
        String correlationId = createCorrelationId("demo");  // e.g., "demo-m5k2x9a-7h3j"
        String traceId = createTraceId();                    // e.g., "4bf92f3577b34da6a3ce929d0e0e4736"
        String accountId = "AC-1234567890";
        String processName = "CUSTOMER_ONBOARDING";
        
        // Span IDs for the execution tree
        String rootSpanId = createSpanId();
        String step1SpanId = createSpanId();
        String step2aSpanId = createSpanId();
        String step2bSpanId = createSpanId();
        String step3SpanId = createSpanId();
        String endSpanId = createSpanId();

        List<EventLogEntry> events = new ArrayList<>();
        long processStartTime = System.currentTimeMillis();

        // ====================================================================
        // 3. PROCESS START
        // ====================================================================
        events.add(processStart(correlationId, traceId, processName)
                .accountId(accountId)
                .spanId(rootSpanId)
                .applicationId("onboarding-service")
                .targetSystem("ONBOARDING_SERVICE")
                .originatingSystem("WEB_APP")
                .summary("Customer onboarding initiated for account " + accountId + " via web portal")
                .result("INITIATED")
                .addIdentifier("customer_id", "CUST-9876")
                .build());

        // ====================================================================
        // 4. STEP 1 - Sequential
        // ====================================================================
        events.add(step(correlationId, traceId, processName, 1, "Identity Verification")
                .accountId(accountId)
                .spanId(step1SpanId)
                .parentSpanId(rootSpanId)
                .applicationId("onboarding-service")
                .targetSystem("IDENTITY_PROVIDER")
                .originatingSystem("ONBOARDING_SERVICE")
                .eventStatus(EventStatus.SUCCESS)
                .summary("Verified customer identity via ID document scan - match confidence 98.5%")
                .result("IDENTITY_VERIFIED")
                .addIdentifier("verification_id", "VER-112233")
                .endpoint("/v2/identity/verify")
                .httpMethod(HttpMethod.POST)
                .httpStatusCode(200)
                .executionTimeMs(1250)
                .build());

        // ====================================================================
        // 5. STEP 2a & 2b - Parallel (same step_sequence = 2)
        // ====================================================================
        
        // Step 2a: Credit Check (runs in parallel)
        events.add(step(correlationId, traceId, processName, 2, "Credit Check")
                .accountId(accountId)
                .spanId(step2aSpanId)
                .parentSpanId(step1SpanId)  // Both parallel steps share same parent
                .applicationId("onboarding-service")
                .targetSystem("CREDIT_BUREAU")
                .originatingSystem("ONBOARDING_SERVICE")
                .eventStatus(EventStatus.SUCCESS)
                .summary("Pulled credit report from bureau - FICO score 742, no derogatory marks")
                .result("CREDIT_APPROVED")
                .addIdentifier("credit_report_id", "CR-445566")
                .endpoint("/v1/credit/pull")
                .httpMethod(HttpMethod.POST)
                .httpStatusCode(200)
                .executionTimeMs(2100)
                .build());

        // Step 2b: Compliance Check (runs in parallel)
        events.add(step(correlationId, traceId, processName, 2, "Compliance Check")
                .accountId(accountId)
                .spanId(step2bSpanId)
                .parentSpanId(step1SpanId)  // Same parent as 2a
                .applicationId("onboarding-service")
                .targetSystem("COMPLIANCE_SERVICE")
                .originatingSystem("ONBOARDING_SERVICE")
                .eventStatus(EventStatus.SUCCESS)
                .summary("Completed KYC/AML compliance checks - OFAC clear, PEP negative, risk level LOW")
                .result("COMPLIANT")
                .addIdentifier("compliance_case_id", "COMP-778899")
                .executionTimeMs(1800)
                .build());

        // ====================================================================
        // 6. STEP 3 - Depends on both parallel steps (uses span_links)
        // ====================================================================
        events.add(step(correlationId, traceId, processName, 3, "Account Provisioning")
                .accountId(accountId)
                .spanId(step3SpanId)
                .parentSpanId(step1SpanId)
                .spanLinks(List.of(step2aSpanId, step2bSpanId))  // <-- Fork-join: waited for both
                .applicationId("onboarding-service")
                .targetSystem("CORE_BANKING")
                .originatingSystem("ONBOARDING_SERVICE")
                .eventStatus(EventStatus.SUCCESS)
                .summary("Provisioned customer account in core banking system - account " + accountId + " activated")
                .result("ACCOUNT_PROVISIONED")
                .addIdentifier("core_banking_ref", "CB-998877")
                .endpoint("/v3/accounts/provision")
                .httpMethod(HttpMethod.POST)
                .httpStatusCode(201)
                .executionTimeMs(950)
                .build());

        // ====================================================================
        // 7. PROCESS END
        // ====================================================================
        int totalDuration = (int) (System.currentTimeMillis() - processStartTime);
        
        events.add(processEnd(correlationId, traceId, processName, 4, EventStatus.SUCCESS, totalDuration)
                .accountId(accountId)
                .spanId(endSpanId)
                .parentSpanId(rootSpanId)
                .applicationId("onboarding-service")
                .targetSystem("WEB_APP")
                .originatingSystem("ONBOARDING_SERVICE")
                .summary("Customer onboarding completed successfully for " + accountId + " - account active and ready")
                .result("COMPLETED")
                .addIdentifier("customer_id", "CUST-9876")
                .build());

        // ====================================================================
        // 8. SEND ALL EVENTS
        // ====================================================================
        BatchCreateEventResponse response = client.createEvents(events);
        
        System.out.println("✅ Process logged successfully!");
        System.out.println("   Correlation ID: " + correlationId);
        System.out.println("   Events created: " + response.getTotalInserted());
        System.out.println("   Execution IDs:  " + response.getExecutionIds());

        // ====================================================================
        // 9. QUERY EVENTS BACK (optional - verify it worked)
        // ====================================================================
        var processEvents = client.getEventsByCorrelation(correlationId);
        System.out.println("\n📋 Events for this process:");
        for (var event : processEvents.getEvents()) {
            System.out.printf("   [%d] %s - %s - %s%n",
                    event.getStepSequence(),
                    event.getEventType(),
                    event.getStepName() != null ? event.getStepName() : "Process boundary",
                    event.getEventStatus());
        }
    }
}

/*
 * ============================================================================
 * EXECUTION FLOW VISUALIZATION
 * ============================================================================
 *
 *   PROCESS_START (step_sequence: 0)
 *         │
 *         ▼
 *   Step 1: Identity Verification (step_sequence: 1)
 *         │
 *         ├────────────────┬────────────────┐
 *         ▼                ▼                │
 *   Step 2a: Credit   Step 2b: Compliance   │  (parallel, both step_sequence: 2)
 *         │                │                │
 *         └────────────────┴────────────────┘
 *                          │
 *                          ▼ span_links: [step2a, step2b]
 *   Step 3: Account Provisioning (step_sequence: 3)
 *         │
 *         ▼
 *   PROCESS_END (step_sequence: 4)
 *
 * ============================================================================
 * KEY CONCEPTS
 * ============================================================================
 *
 * correlation_id  → Groups all events for ONE business process instance
 * trace_id        → W3C distributed trace ID (propagate across services)
 * span_id         → Unique ID for each step/operation
 * parent_span_id  → Creates the call hierarchy (who triggered this step)
 * span_links      → Fork-join pattern (which parallel steps did we wait for)
 * step_sequence   → Order indicator (same number = parallel execution)
 *
 * ============================================================================
 */
