// ============================================================================
// REAL-TIME EVENT LOGGING - TYPESCRIPT EXAMPLE
// ============================================================================
//
// This example shows the correct way to log events in production:
//
//   1. Create an EventLogTemplate with shared defaults (ONCE at startup)
//   2. Spawn a ProcessLogger per business process
//   3. Call logStart / logStep / logEnd / logError — no boilerplate
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
  EventLogTemplate,
  EventStatus,
  HttpMethod,
  createDiskSpillover,
  createSpanId,
} from '@yourcompany/eventlog-sdk';

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
  batchSize: 25,
  maxPayloadSize: 32_768,

  // Disk-based spillover (replaces manual fs.appendFileSync)
  onSpillover: createDiskSpillover('/var/log/eventlog-spillover'),

  // Lifecycle hooks for observability
  onBatchSent: (_events, count) => {
    console.log(`[EventLog] Batch sent: ${count} events`);
  },
  onCircuitOpen: (failures) => {
    console.warn(`[EventLog] Circuit OPEN after ${failures} consecutive failures`);
  },
});

// Template with shared defaults — no more repeating these on every event
const template = new EventLogTemplate({
  logger: eventLog,
  applicationId: 'onboarding-service',
  targetSystem: 'ONBOARDING_SERVICE',
  originatingSystem: 'WEB_APP',
});

// ============================================================================
// YOUR BUSINESS PROCESS
// ============================================================================

async function onboardCustomer(customerId: string): Promise<void> {
  const accountId = `AC-${customerId}`;
  const processStartTime = Date.now();

  // Spawn a ProcessLogger scoped to this process run
  const process = template.forProcess('CUSTOMER_ONBOARDING', {
    accountId,
    identifiers: { customer_id: customerId },
  });

  // --------------------------------------------------------------------------
  // PROCESS START - Log immediately
  // --------------------------------------------------------------------------
  process.logStart(`Customer onboarding initiated for ${customerId}`);
  // ⬆️ Returns IMMEDIATELY - doesn't wait for API

  // --------------------------------------------------------------------------
  // STEP 1: Identity Verification
  // --------------------------------------------------------------------------
  const step1Start = Date.now();
  const identityResult = await verifyIdentity(customerId);

  process.logStep(1, 'Identity Verification',
    identityResult.success ? EventStatus.SUCCESS : EventStatus.FAILURE,
    `Identity verification - ${identityResult.message}`,
    { result: identityResult.success ? 'VERIFIED' : 'FAILED', executionTimeMs: Date.now() - step1Start }
  );

  if (!identityResult.success) {
    process.logError('Identity verification failed', 'STEP_1_FAILED', 'Identity verification failed', {
      stepSequence: 1,
    });
    throw new Error('Identity verification failed');
  }

  // --------------------------------------------------------------------------
  // STEP 2a & 2b: Parallel steps (fork-join pattern)
  // --------------------------------------------------------------------------
  const step2aSpanId = createSpanId();
  const step2bSpanId = createSpanId();

  const [creditResult, complianceResult] = await Promise.all([
    (async () => {
      const start = Date.now();
      const result = await performCreditCheck(customerId);

      process.logStep(2, 'Credit Check',
        result.approved ? EventStatus.SUCCESS : EventStatus.FAILURE,
        `Credit check - FICO ${result.ficoScore}, ${result.approved ? 'approved' : 'declined'}`,
        { result: result.approved ? 'APPROVED' : 'DECLINED', spanId: step2aSpanId, executionTimeMs: Date.now() - start }
      );
      return result;
    })(),

    (async () => {
      const start = Date.now();
      const result = await performComplianceCheck(customerId);

      process.logStep(2, 'Compliance Check',
        result.compliant ? EventStatus.SUCCESS : EventStatus.FAILURE,
        `Compliance check - OFAC ${result.ofacStatus}, risk ${result.riskLevel}`,
        { result: result.compliant ? 'COMPLIANT' : 'FLAGGED', spanId: step2bSpanId, executionTimeMs: Date.now() - start }
      );
      return result;
    })(),
  ]);

  if (!creditResult.approved || !complianceResult.compliant) {
    process.logError('Credit or compliance check failed', 'STEP_2_FAILED', 'Credit or compliance check failed', {
      stepSequence: 2,
    });
    throw new Error('Credit or compliance check failed');
  }

  // --------------------------------------------------------------------------
  // STEP 3: Account Provisioning (joins from parallel steps via span_links)
  // --------------------------------------------------------------------------
  const step3Start = Date.now();
  const provisionResult = await provisionAccount(accountId);

  process.logStep(3, 'Account Provisioning',
    provisionResult.success ? EventStatus.SUCCESS : EventStatus.FAILURE,
    `Account provisioned - ${provisionResult.message}`,
    {
      result: provisionResult.success ? 'PROVISIONED' : 'FAILED',
      spanLinks: [step2aSpanId, step2bSpanId],
      endpoint: '/v3/accounts/provision',
      httpMethod: HttpMethod.POST,
      httpStatusCode: provisionResult.success ? 201 : 500,
      executionTimeMs: Date.now() - step3Start,
    }
  );

  if (!provisionResult.success) {
    process.logError('Account provisioning failed', 'STEP_3_FAILED', 'Account provisioning failed', {
      stepSequence: 3,
    });
    throw new Error('Account provisioning failed');
  }

  // --------------------------------------------------------------------------
  // PROCESS END - Success!
  // --------------------------------------------------------------------------
  const totalDuration = Date.now() - processStartTime;

  process.logEnd(
    EventStatus.SUCCESS,
    `Customer onboarding completed for ${customerId} in ${totalDuration}ms`,
    totalDuration,
    'COMPLETED'
  );

  console.log('Onboarding complete!');
  console.log('Event Log Metrics:', eventLog.getMetrics());
}

// ============================================================================
// MOCK BUSINESS LOGIC (replace with actual implementations)
// ============================================================================

interface IdentityResult { success: boolean; verificationId: string; message: string; }
interface CreditResult { approved: boolean; ficoScore: number; reportId: string; }
interface ComplianceResult { compliant: boolean; ofacStatus: string; riskLevel: string; caseId: string; }
interface ProvisionResult { success: boolean; coreBankingRef: string; message: string; }

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
 * 1. EventLogTemplate + ProcessLogger eliminate boilerplate:
 *    - Set shared fields (applicationId, targetSystem, etc.) ONCE in the template
 *    - Each forProcess() call auto-generates correlationId + traceId
 *    - logStart/logStep/logEnd/logError handle event_type and event_status
 *
 * 2. LOG IMMEDIATELY after each step:
 *    const result = await doSomething();
 *    process.logStep(1, 'StepName', EventStatus.SUCCESS, 'Done');
 *
 * 3. DON'T collect and send at end:
 *    ❌ const events: EventLogEntry[] = [];
 *    ❌ events.push(step1Event);
 *    ❌ await client.createEvents(events);  // If crash, all lost!
 *
 * 4. PARALLEL STEPS log independently as they complete
 *
 * 5. AsyncEventLogger handles:
 *    - Batching (batchSize), retries with exponential backoff
 *    - Circuit breaker with lifecycle hooks (onCircuitOpen, onBatchSent)
 *    - Disk spillover via createDiskSpillover() (NDJSON files, debounced)
 *    - Payload truncation (maxPayloadSize)
 *    - Graceful shutdown
 *
 * 6. For one-off events outside a process, use eventBuilder() (see fluent-builder.ts)
 * 7. For unit testing, use MockAsyncEventLogger (see testing-with-mock.ts)
 *
 * ============================================================================
 */
