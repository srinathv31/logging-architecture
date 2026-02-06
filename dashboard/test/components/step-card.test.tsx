// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

vi.mock('@/lib/constants', () => ({
  STATUS_ICONS: {
    SUCCESS: (props: any) => <span {...props}>SI</span>,
    FAILURE: (props: any) => <span {...props}>FI</span>,
    IN_PROGRESS: (props: any) => <span {...props}>PI</span>,
    SKIPPED: (props: any) => <span {...props}>KI</span>,
  },
  EVENT_TYPE_COLORS: {
    API_CALL: 'bg-blue-100',
    STEP: 'bg-purple-100',
  },
  EVENT_TYPE_ICONS: {
    API_CALL: (props: any) => <span {...props}>ETI</span>,
    STEP: (props: any) => <span {...props}>STI</span>,
  },
  HTTP_METHOD_COLORS: {
    GET: 'bg-green-100',
    POST: 'bg-blue-100',
  },
  STATUS_COLORS: {},
}));

import { StepCard } from '@/components/trace-detail/step-card';

describe('StepCard', () => {
  it('renders step name', () => {
    const event = makeTraceEvent({ stepName: 'Initialize Connection' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('Initialize Connection');
  });

  it('renders process name when stepName is null', () => {
    const event = makeTraceEvent({ stepName: null, processName: 'test-process' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('test-process');
  });

  it('renders step sequence number', () => {
    const event = makeTraceEvent({ stepSequence: 3 });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('Step 3');
  });

  it('renders index+1 when stepSequence is null', () => {
    const event = makeTraceEvent({ stepSequence: null });

    const { container } = render(
      <StepCard event={event} index={4} isLast={false} />
    );

    expect(container.textContent).toContain('Step 5');
  });

  it('renders event type badge', () => {
    const event = makeTraceEvent({ eventType: 'API_CALL' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('API_CALL');
  });

  it('renders HTTP method badge when present', () => {
    const event = makeTraceEvent({ httpMethod: 'POST' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('POST');
  });

  it('does not render HTTP method when null', () => {
    const event = makeTraceEvent({ httpMethod: null });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).not.toContain('GET');
    expect(container.textContent).not.toContain('POST');
  });

  it('renders HTTP status code when present', () => {
    const event = makeTraceEvent({ httpStatusCode: 200 });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('200');
  });

  it('renders destructive badge for 4xx+ status code', () => {
    const event = makeTraceEvent({ httpStatusCode: 500 });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('500');
  });

  it('renders target system badge', () => {
    const event = makeTraceEvent({ targetSystem: 'PaymentGateway' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('PaymentGateway');
  });

  it('renders summary text', () => {
    const event = makeTraceEvent({ summary: 'Payment processed successfully' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('Payment processed successfully');
  });

  it('renders endpoint when present', () => {
    const event = makeTraceEvent({ endpoint: '/api/v1/payments' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('/api/v1/payments');
  });

  it('renders execution time when present', () => {
    const event = makeTraceEvent({ executionTimeMs: 250 });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('250ms');
  });

  it('renders error callout when errorMessage present', () => {
    const event = makeTraceEvent({
      errorMessage: 'Connection refused',
      errorCode: 'CONN_ERR',
    });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).toContain('Connection refused');
    expect(container.textContent).toContain('CONN_ERR');
  });

  it('does not render error callout when errorMessage is null', () => {
    const event = makeTraceEvent({ errorMessage: null });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} />
    );

    expect(container.textContent).not.toContain('Connection refused');
  });

  it('renders status badge in compact mode with hideTimelineIndicator', () => {
    const event = makeTraceEvent({ eventStatus: 'SUCCESS' });

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} compact hideTimelineIndicator />
    );

    expect(container.textContent).toContain('SUCCESS');
  });

  it('renders timeDiff when provided', () => {
    const event = makeTraceEvent();

    const { container } = render(
      <StepCard event={event} index={0} isLast={false} timeDiff="+500ms" />
    );

    expect(container.textContent).toContain('+500ms');
  });
});
