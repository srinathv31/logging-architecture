import { describe, it, expect, afterEach } from 'vitest';
import { EventLogTemplate } from '../client/EventLogTemplate';
import { ProcessLogger } from '../client/ProcessLogger';
import { AsyncEventLogger } from '../client/AsyncEventLogger';
import { EventType, EventStatus, HttpMethod, EventLogEntry } from '../models/types';
import { MockAsyncEventLogger } from '../testing/MockAsyncEventLogger';

// ============================================================================
// Tests
// ============================================================================

describe('EventLogTemplate', () => {
  it('creates a ProcessLogger with template defaults', () => {
    const mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'my-app',
      targetSystem: 'core-banking',
      originatingSystem: 'origination-service',
    });

    const process = template.forProcess('CreateAccount');
    expect(process).toBeInstanceOf(ProcessLogger);
    expect(process.correlationId).toBeTruthy();
    expect(process.traceId).toBeTruthy();
  });

  it('passes custom options to ProcessLogger', () => {
    const mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'my-app',
      targetSystem: 'core',
      originatingSystem: 'service',
    });

    const process = template.forProcess('UpdateAccount', {
      correlationId: 'custom-corr',
      traceId: 'custom-trace',
      accountId: 'acct-123',
      identifiers: { customer_id: 'cust-456' },
    });

    expect(process.correlationId).toBe('custom-corr');
    expect(process.traceId).toBe('custom-trace');
  });
});

describe('ProcessLogger', () => {
  let mock: MockAsyncEventLogger;

  afterEach(() => {
    mock?.reset();
  });

  it('logStart creates a PROCESS_START event', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logStart('Starting process');

    expect(mock.capturedEvents).toHaveLength(1);
    const event = mock.capturedEvents[0];
    expect(event.event_type).toBe(EventType.PROCESS_START);
    expect(event.event_status).toBe(EventStatus.IN_PROGRESS);
    expect(event.step_sequence).toBe(0);
    expect(event.summary).toBe('Starting process');
    expect(event.application_id).toBe('app');
    expect(event.target_system).toBe('target');
    expect(event.originating_system).toBe('origin');
    expect(event.process_name).toBe('TestProcess');
    expect(event.span_id).toBeTruthy(); // auto-generated
  });

  it('logStart accepts EventOptions', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logStart('Starting process', {
      endpoint: '/api/start',
      httpMethod: HttpMethod.POST,
      metadata: { source: 'api' },
      result: 'Initiated',
    });

    const event = mock.capturedEvents[0];
    expect(event.endpoint).toBe('/api/start');
    expect(event.http_method).toBe(HttpMethod.POST);
    expect(event.metadata).toEqual({ source: 'api' });
    expect(event.result).toBe('Initiated');
  });

  it('logStep creates a STEP event with all options', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logStep(1, 'VerifyIdentity', EventStatus.SUCCESS, 'Identity verified', {
      executionTimeMs: 250,
      endpoint: '/api/verify',
      httpStatusCode: 200,
      metadata: { provider: 'experian' },
    });

    expect(mock.capturedEvents).toHaveLength(1);
    const event = mock.capturedEvents[0];
    expect(event.event_type).toBe(EventType.STEP);
    expect(event.step_sequence).toBe(1);
    expect(event.step_name).toBe('VerifyIdentity');
    expect(event.event_status).toBe(EventStatus.SUCCESS);
    expect(event.execution_time_ms).toBe(250);
    expect(event.endpoint).toBe('/api/verify');
    expect(event.metadata).toEqual({ provider: 'experian' });
  });

  it('logStep with idempotencyKey', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logStep(1, 'Payment', EventStatus.SUCCESS, 'Payment sent', {
      idempotencyKey: 'idem-abc-123',
    });

    const event = mock.capturedEvents[0];
    expect(event.idempotency_key).toBe('idem-abc-123');
  });

  it('logEnd creates a PROCESS_END event with stepSequence', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logEnd(5, EventStatus.SUCCESS, 'Process completed', 3500);

    expect(mock.capturedEvents).toHaveLength(1);
    const event = mock.capturedEvents[0];
    expect(event.event_type).toBe(EventType.PROCESS_END);
    expect(event.event_status).toBe(EventStatus.SUCCESS);
    expect(event.execution_time_ms).toBe(3500);
    expect(event.step_sequence).toBe(5);
  });

  it('logEnd accepts EventOptions', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logEnd(3, EventStatus.SUCCESS, 'Done', 2000, {
      endpoint: '/api/complete',
      httpStatusCode: 200,
      metadata: { finalStep: true },
    });

    const event = mock.capturedEvents[0];
    expect(event.endpoint).toBe('/api/complete');
    expect(event.http_status_code).toBe(200);
    expect(event.metadata).toEqual({ finalStep: true });
  });

  it('logError creates an ERROR event', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logError('Failed to verify', 'VERIFY_FAILED', 'Timeout exceeded', {
      stepSequence: 1,
      stepName: 'VerifyIdentity',
    });

    expect(mock.capturedEvents).toHaveLength(1);
    const event = mock.capturedEvents[0];
    expect(event.event_type).toBe(EventType.ERROR);
    expect(event.event_status).toBe(EventStatus.FAILURE);
    expect(event.error_code).toBe('VERIFY_FAILED');
    expect(event.error_message).toBe('Timeout exceeded');
  });

  it('logError accepts full EventOptions', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logError('API call failed', 'HTTP_ERROR', 'Service unavailable', {
      endpoint: '/api/external',
      httpMethod: HttpMethod.POST,
      httpStatusCode: 503,
      requestPayload: '{"id": 1}',
      responsePayload: '{"error": "unavailable"}',
      executionTimeMs: 5000,
    });

    const event = mock.capturedEvents[0];
    expect(event.endpoint).toBe('/api/external');
    expect(event.http_method).toBe(HttpMethod.POST);
    expect(event.http_status_code).toBe(503);
    expect(event.request_payload).toBe('{"id": 1}');
    expect(event.response_payload).toBe('{"error": "unavailable"}');
    expect(event.execution_time_ms).toBe(5000);
  });

  it('all events share the same correlation_id and trace_id', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logStart('Start');
    process.logStep(1, 'Step1', EventStatus.SUCCESS, 'Done');
    process.logEnd(2, EventStatus.SUCCESS, 'End', 1000);

    expect(mock.capturedEvents).toHaveLength(3);
    const corrIds = mock.capturedEvents.map((e) => e.correlation_id);
    const traceIds = mock.capturedEvents.map((e) => e.trace_id);
    expect(new Set(corrIds).size).toBe(1);
    expect(new Set(traceIds).size).toBe(1);
  });

  it('respects accountId and identifiers from template', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
      accountId: 'default-acct',
    });

    const process = template.forProcess('TestProcess', {
      identifiers: { customer_id: 'c123' },
    });
    process.logStart('Start');

    const event = mock.capturedEvents[0];
    expect(event.account_id).toBe('default-acct');
    expect(event.identifiers.customer_id).toBe('c123');
  });

  // ========================================================================
  // Span Tracking
  // ========================================================================

  it('getRootSpanId returns the span from logStart', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    expect(process.getRootSpanId()).toBeUndefined();

    process.logStart('Start');
    const rootSpanId = process.getRootSpanId();
    expect(rootSpanId).toBeTruthy();
    expect(rootSpanId).toBe(mock.capturedEvents[0].span_id);
  });

  it('getLastStepSpanId returns the span from the most recent logStep', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    expect(process.getLastStepSpanId()).toBeUndefined();

    process.logStart('Start');
    process.logStep(1, 'Step1', EventStatus.SUCCESS, 'Done');

    const lastSpanId = process.getLastStepSpanId();
    expect(lastSpanId).toBeTruthy();
    expect(lastSpanId).toBe(mock.capturedEvents[1].span_id);

    process.logStep(2, 'Step2', EventStatus.SUCCESS, 'Done');
    expect(process.getLastStepSpanId()).toBe(mock.capturedEvents[2].span_id);
    expect(process.getLastStepSpanId()).not.toBe(lastSpanId);
  });

  // ========================================================================
  // Persistent Mutators
  // ========================================================================

  it('addIdentifier persists across events', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.addIdentifier('customer_id', 'cust-123');
    process.logStart('Start');
    process.logStep(1, 'Step1', EventStatus.SUCCESS, 'Done');

    expect(mock.capturedEvents[0].identifiers.customer_id).toBe('cust-123');
    expect(mock.capturedEvents[1].identifiers.customer_id).toBe('cust-123');
  });

  it('addMetadata persists across events', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.addMetadata('env', 'production');
    process.logStart('Start');
    process.logStep(1, 'Step1', EventStatus.SUCCESS, 'Done');

    expect(mock.capturedEvents[0].metadata).toEqual({ env: 'production' });
    expect(mock.capturedEvents[1].metadata).toEqual({ env: 'production' });
  });

  it('addMetadata merges with per-event metadata', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.addMetadata('persistent', 'value');
    process.logStep(1, 'Step1', EventStatus.SUCCESS, 'Done', {
      metadata: { perEvent: 'data' },
    });

    expect(mock.capturedEvents[0].metadata).toEqual({
      persistent: 'value',
      perEvent: 'data',
    });
  });

  // ========================================================================
  // Per-Process Overrides
  // ========================================================================

  it('setApplicationId overrides applicationId', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'original-app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.setApplicationId('overridden-app');
    process.logStart('Start');

    expect(mock.capturedEvents[0].application_id).toBe('overridden-app');
  });

  it('setTargetSystem overrides targetSystem', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'original-target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.setTargetSystem('new-target');
    process.logStart('Start');

    expect(mock.capturedEvents[0].target_system).toBe('new-target');
  });

  it('setOriginatingSystem overrides originatingSystem', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'original-origin',
    });

    const process = template.forProcess('TestProcess');
    process.setOriginatingSystem('new-origin');
    process.logStart('Start');

    expect(mock.capturedEvents[0].originating_system).toBe('new-origin');
  });

  // ========================================================================
  // Per-event targetSystem override
  // ========================================================================

  it('per-event targetSystem override via EventOptions does not change default', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'default-target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logStep(1, 'CallVendor', EventStatus.SUCCESS, 'OK', {
      targetSystem: 'vendor-api',
    });
    // Note: per-event targetSystem via EventOptions is not currently wired to
    // override the event's target_system field (it would require special handling).
    // The setTargetSystem method changes the default for all subsequent events.
    // This test documents the current behavior.
    process.logStep(2, 'NextStep', EventStatus.SUCCESS, 'OK');

    expect(mock.capturedEvents[1].target_system).toBe('default-target');
  });
});

describe('MockAsyncEventLogger', () => {
  it('captures events', () => {
    const mock = new MockAsyncEventLogger();
    const event: EventLogEntry = {
      correlation_id: 'c1',
      trace_id: 't1',
      application_id: 'app',
      target_system: 'ts',
      originating_system: 'os',
      process_name: 'P1',
      event_type: EventType.PROCESS_START,
      event_status: EventStatus.IN_PROGRESS,
      identifiers: {},
      summary: 's',
      result: 'r',
      event_timestamp: new Date().toISOString(),
    };

    mock.log(event);
    expect(mock.capturedEvents).toHaveLength(1);
  });

  it('getEventsForProcess filters by process name', () => {
    const mock = new MockAsyncEventLogger();

    mock.log({
      correlation_id: 'c1', trace_id: 't1', application_id: 'app',
      target_system: 'ts', originating_system: 'os', process_name: 'P1',
      event_type: EventType.STEP, event_status: EventStatus.SUCCESS,
      identifiers: {}, summary: 's', result: 'r',
      event_timestamp: new Date().toISOString(),
    });

    mock.log({
      correlation_id: 'c2', trace_id: 't2', application_id: 'app',
      target_system: 'ts', originating_system: 'os', process_name: 'P2',
      event_type: EventType.STEP, event_status: EventStatus.SUCCESS,
      identifiers: {}, summary: 's', result: 'r',
      event_timestamp: new Date().toISOString(),
    });

    expect(mock.getEventsForProcess('P1')).toHaveLength(1);
    expect(mock.getEventsForProcess('P2')).toHaveLength(1);
    expect(mock.getEventsForProcess('P3')).toHaveLength(0);
  });

  it('assertEventLogged throws when not found', () => {
    const mock = new MockAsyncEventLogger();
    expect(() => mock.assertEventLogged('NonExistent')).toThrow('No event found');
  });

  it('assertEventCount passes when count matches', () => {
    const mock = new MockAsyncEventLogger();
    mock.log({} as EventLogEntry);
    mock.log({} as EventLogEntry);
    mock.assertEventCount(2); // Should not throw
  });

  it('assertEventCount throws when count does not match', () => {
    const mock = new MockAsyncEventLogger();
    mock.log({} as EventLogEntry);
    expect(() => mock.assertEventCount(3)).toThrow('Expected 3 events, but got 1');
  });

  it('rejectAll makes log return false', () => {
    const mock = new MockAsyncEventLogger();
    mock.rejectAll();
    expect(mock.log({} as EventLogEntry)).toBe(false);
    mock.acceptAll();
    expect(mock.log({} as EventLogEntry)).toBe(true);
  });

  it('reset clears all state', () => {
    const mock = new MockAsyncEventLogger();
    mock.log({} as EventLogEntry);
    mock.rejectAll();
    mock.reset();
    expect(mock.capturedEvents).toHaveLength(0);
    expect(mock.log({} as EventLogEntry)).toBe(true);
  });

  it('getMetrics includes eventsReplayed', () => {
    const mock = new MockAsyncEventLogger();
    const metrics = mock.getMetrics();
    expect(metrics.eventsReplayed).toBe(0);
  });
});
