import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventLogTemplate } from '../client/EventLogTemplate';
import { ProcessLogger } from '../client/ProcessLogger';
import { AsyncEventLogger } from '../client/AsyncEventLogger';
import { EventLogClient } from '../client/EventLogClient';
import { EventType, EventStatus, EventLogEntry } from '../models/types';
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

  it('logEnd creates a PROCESS_END event', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    const process = template.forProcess('TestProcess');
    process.logEnd(EventStatus.SUCCESS, 'Process completed', 3500);

    expect(mock.capturedEvents).toHaveLength(1);
    const event = mock.capturedEvents[0];
    expect(event.event_type).toBe(EventType.PROCESS_END);
    expect(event.event_status).toBe(EventStatus.SUCCESS);
    expect(event.execution_time_ms).toBe(3500);
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
    process.logEnd(EventStatus.SUCCESS, 'End', 1000);

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
});
