// ============================================================================
// REAL-TIME EVENT LOGGING - TYPESCRIPT EXAMPLE
// ============================================================================
//
// This example shows the correct way to log events in production:
//
//   ✅ Log each step IMMEDIATELY after it completes (fire-and-forget)
//   ✅ Never block business logic waiting for event log API
//   ✅ Events are captured even if process crashes mid-way
//
//   ❌ DON'T batch events and send at end of process
//   ❌ DON'T await the event log response before continuing

import {
  EventLogClient,
  AsyncEventLogger,
  EventStatus,
  HttpMethod,
  createCorrelationId,
  createTraceId,
  createSpanId,
  createProcessStartEvent,
  createStepEvent,
  createProcessEndEvent,
  createErrorEvent,
} from '@yourcompany/eventlog-sdk';
import * as fs from 'fs';

// ============================================================================
// SETUP - Do this ONCE at application startup
// ============================================================================

const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  apiKey: 'your-api-key',
});

const eventLog = new AsyncEventLogger({
  client,
  queueCapacity: 10_000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30_000,
  
  // Optional: Handle permanently failed events
  onEventFailed: (event, error) => {
    console.error(`Event permanently failed: ${event.correlation_id}`, error);
  },
  
  // Optional: Spillover to disk when queue full or API down
  onSpillover: (event) => {
    fs.appendFileSync(
      '/var/log/eventlog-spillover.json',
      JSON.stringify(event) + '\n'
    );
  },
});

// ============================================================================
// YOUR BUSINESS PROCESS
// ============================================================================

async function onboardCustomer(customerId: string): Promise<void> {
  const correlationId = createCorrelationId('onboard');
  const traceId = createTraceId();
  const accountId = `AC-${customerId}`;
  const processName = 'CUSTOMER_ONBOARDING';
  
  const rootSpanId = createSpanId();
  const processStartTime = Date.now();

  // --------------------------------------------------------------------------
  // PROCESS START - Log immediately
  // --------------------------------------------------------------------------
  eventLog.log(createProcessStartEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: rootSpanId,
    application_id: 'onboarding-service',
    target_system: 'ONBOARDING_SERVICE',
    originating_system: 'WEB_APP',
    process_name: processName,
    identifiers: { customer_id: customerId },
    summary: `Customer onboarding initiated for ${customerId}`,
    result: 'INITIATED',
  }));
  // ⬆️ Returns IMMEDIATELY - doesn't wait for API

  // --------------------------------------------------------------------------
  // STEP 1: Identity Verification
  // --------------------------------------------------------------------------
  const step1SpanId = createSpanId();
  const step1Start = Date.now();
  
  const identityResult = await verifyIdentity(customerId);
  
  // Log immediately after step completes
  eventLog.log(createStepEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: step1SpanId,
    parent_span_id: rootSpanId,
    application_id: 'onboarding-service',
    target_system: 'IDENTITY_PROVIDER',
    originating_system: 'ONBOARDING_SERVICE',
    process_name: processName,
    step_sequence: 1,
    step_name: 'Identity Verification',
    event_status: identityResult.success ? EventStatus.SUCCESS : EventStatus.FAILURE,
    identifiers: { verification_id: identityResult.verificationId },
    summary: `Identity verification - ${identityResult.message}`,
    result: identityResult.success ? 'VERIFIED' : 'FAILED',
    execution_time_ms: Date.now() - step1Start,
  }));

  if (!identityResult.success) {
    await logProcessFailure(correlationId, traceId, processName, accountId, rootSpanId, 
      1, 'Identity verification failed', processStartTime);
    throw new Error('Identity verification failed');
  }

  // --------------------------------------------------------------------------
  // STEP 2a & 2b: Parallel steps
  // --------------------------------------------------------------------------
  const step2aSpanId = createSpanId();
  const step2bSpanId = createSpanId();

  // Run in parallel - each logs independently when complete
  const [creditResult, complianceResult] = await Promise.all([
    (async () => {
      const start = Date.now();
      const result = await performCreditCheck(customerId);
      
      eventLog.log(createStepEvent({
        correlation_id: correlationId,
        account_id: accountId,
        trace_id: traceId,
        span_id: step2aSpanId,
        parent_span_id: step1SpanId,
        application_id: 'onboarding-service',
        target_system: 'CREDIT_BUREAU',
        originating_system: 'ONBOARDING_SERVICE',
        process_name: processName,
        step_sequence: 2,
        step_name: 'Credit Check',
        event_status: result.approved ? EventStatus.SUCCESS : EventStatus.FAILURE,
        identifiers: { credit_report_id: result.reportId },
        summary: `Credit check - FICO ${result.ficoScore}, ${result.approved ? 'approved' : 'declined'}`,
        result: result.approved ? 'APPROVED' : 'DECLINED',
        execution_time_ms: Date.now() - start,
      }));
      
      return result;
    })(),
    
    (async () => {
      const start = Date.now();
      const result = await performComplianceCheck(customerId);
      
      eventLog.log(createStepEvent({
        correlation_id: correlationId,
        account_id: accountId,
        trace_id: traceId,
        span_id: step2bSpanId,
        parent_span_id: step1SpanId,
        application_id: 'onboarding-service',
        target_system: 'COMPLIANCE_SERVICE',
        originating_system: 'ONBOARDING_SERVICE',
        process_name: processName,
        step_sequence: 2,  // Same as 2a - indicates parallel
        step_name: 'Compliance Check',
        event_status: result.compliant ? EventStatus.SUCCESS : EventStatus.FAILURE,
        identifiers: { compliance_case_id: result.caseId },
        summary: `Compliance check - OFAC ${result.ofacStatus}, risk ${result.riskLevel}`,
        result: result.compliant ? 'COMPLIANT' : 'FLAGGED',
        execution_time_ms: Date.now() - start,
      }));
      
      return result;
    })(),
  ]);

  if (!creditResult.approved || !complianceResult.compliant) {
    await logProcessFailure(correlationId, traceId, processName, accountId, rootSpanId,
      2, 'Credit or compliance check failed', processStartTime);
    throw new Error('Credit or compliance check failed');
  }

  // --------------------------------------------------------------------------
  // STEP 3: Account Provisioning (fork-join with span_links)
  // --------------------------------------------------------------------------
  const step3SpanId = createSpanId();
  const step3Start = Date.now();
  
  const provisionResult = await provisionAccount(accountId);
  
  eventLog.log(createStepEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: step3SpanId,
    parent_span_id: step1SpanId,
    span_links: [step2aSpanId, step2bSpanId],  // Fork-join: waited for both
    application_id: 'onboarding-service',
    target_system: 'CORE_BANKING',
    originating_system: 'ONBOARDING_SERVICE',
    process_name: processName,
    step_sequence: 3,
    step_name: 'Account Provisioning',
    event_status: provisionResult.success ? EventStatus.SUCCESS : EventStatus.FAILURE,
    identifiers: { core_banking_ref: provisionResult.coreBankingRef },
    summary: `Account provisioned - ${provisionResult.message}`,
    result: provisionResult.success ? 'PROVISIONED' : 'FAILED',
    endpoint: '/v3/accounts/provision',
    http_method: HttpMethod.POST,
    http_status_code: provisionResult.success ? 201 : 500,
    execution_time_ms: Date.now() - step3Start,
  }));

  if (!provisionResult.success) {
    await logProcessFailure(correlationId, traceId, processName, accountId, rootSpanId,
      3, 'Account provisioning failed', processStartTime);
    throw new Error('Account provisioning failed');
  }

  // --------------------------------------------------------------------------
  // PROCESS END - Success!
  // --------------------------------------------------------------------------
  const totalDuration = Date.now() - processStartTime;
  
  eventLog.log(createProcessEndEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: createSpanId(),
    parent_span_id: rootSpanId,
    application_id: 'onboarding-service',
    target_system: 'WEB_APP',
    originating_system: 'ONBOARDING_SERVICE',
    process_name: processName,
    step_sequence: 4,
    event_status: EventStatus.SUCCESS,
    identifiers: { customer_id: customerId },
    summary: `Customer onboarding completed for ${customerId} in ${totalDuration}ms`,
    result: 'COMPLETED',
    execution_time_ms: totalDuration,
  }));

  console.log('Onboarding complete!');
  console.log('Event Log Metrics:', eventLog.getMetrics());
}

// Helper for failure logging
async function logProcessFailure(
  correlationId: string,
  traceId: string,
  processName: string,
  accountId: string,
  rootSpanId: string,
  failedStep: number,
  reason: string,
  processStartTime: number
): Promise<void> {
  eventLog.log(createErrorEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: createSpanId(),
    parent_span_id: rootSpanId,
    application_id: 'onboarding-service',
    target_system: 'WEB_APP',
    originating_system: 'ONBOARDING_SERVICE',
    process_name: processName,
    step_sequence: failedStep,
    identifiers: {},
    summary: `Onboarding failed at step ${failedStep}: ${reason}`,
    result: 'FAILED',
    error_code: `STEP_${failedStep}_FAILED`,
    error_message: reason,
    execution_time_ms: Date.now() - processStartTime,
  }));
}

// ============================================================================
// MOCK BUSINESS LOGIC (replace with actual implementations)
// ============================================================================

interface IdentityResult {
  success: boolean;
  verificationId: string;
  message: string;
}

interface CreditResult {
  approved: boolean;
  ficoScore: number;
  reportId: string;
}

interface ComplianceResult {
  compliant: boolean;
  ofacStatus: string;
  riskLevel: string;
  caseId: string;
}

interface ProvisionResult {
  success: boolean;
  coreBankingRef: string;
  message: string;
}

async function verifyIdentity(customerId: string): Promise<IdentityResult> {
  await sleep(100);
  return { success: true, verificationId: `VER-${Date.now()}`, message: 'Match confidence 98.5%' };
}

async function performCreditCheck(customerId: string): Promise<CreditResult> {
  await sleep(150);
  return { approved: true, ficoScore: 742, reportId: `CR-${Date.now()}` };
}

async function performComplianceCheck(customerId: string): Promise<ComplianceResult> {
  await sleep(120);
  return { compliant: true, ofacStatus: 'CLEAR', riskLevel: 'LOW', caseId: `COMP-${Date.now()}` };
}

async function provisionAccount(accountId: string): Promise<ProvisionResult> {
  await sleep(80);
  return { success: true, coreBankingRef: `CB-${Date.now()}`, message: 'Account activated' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// RUN EXAMPLE
// ============================================================================

onboardCustomer('CUST-12345')
  .then(() => eventLog.shutdown())
  .catch(async (err) => {
    console.error('Process failed:', err.message);
    await eventLog.shutdown();
  });

/*
 * ============================================================================
 * KEY TAKEAWAYS
 * ============================================================================
 *
 * 1. USE eventLog.log() - Fire-and-forget, never blocks
 *
 * 2. LOG IMMEDIATELY after each step:
 *    const result = await doSomething();
 *    eventLog.log(event);  // RIGHT HERE
 *
 * 3. DON'T collect and send at end:
 *    ❌ const events: EventLogEntry[] = [];
 *    ❌ events.push(step1Event);
 *    ❌ events.push(step2Event);
 *    ❌ await client.createEvents(events);  // If crash, all lost!
 *
 * 4. PARALLEL STEPS log independently as they complete
 *
 * 5. AsyncEventLogger handles:
 *    - Retries with exponential backoff
 *    - Circuit breaker when API down
 *    - Spillover callback for dead letter queue
 *    - Graceful shutdown
 *
 * ============================================================================
 */
