// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

vi.mock('@/lib/constants', () => ({
  STATUS_COLORS: {
    SUCCESS: 'bg-green-100',
    FAILURE: 'bg-red-100',
  },
  STATUS_ICONS: {
    SUCCESS: (props: any) => <span {...props}>SI</span>,
    FAILURE: (props: any) => <span {...props}>FI</span>,
    IN_PROGRESS: (props: any) => <span {...props}>PI</span>,
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
}));

import { EventLogSteps } from '@/components/trace-detail/event-log-steps';

function openDialog(event: ReturnType<typeof makeTraceEvent>) {
  const result = render(<EventLogSteps event={event} />);
  fireEvent.click(screen.getByText('View Details'));
  return result;
}

describe('EventLogSteps', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders "View Details" button', () => {
    const event = makeTraceEvent();
    render(<EventLogSteps event={event} />);
    expect(screen.getByText('View Details')).toBeDefined();
  });

  it('renders dialog with event step name on click', () => {
    const event = makeTraceEvent({ stepName: 'Process Payment' });
    const { container } = openDialog(event);
    // Dialog title contains the step name
    const title = container.ownerDocument.querySelector('[data-slot="dialog-title"]');
    expect(title?.textContent).toBe('Process Payment');
  });

  it('renders process name when stepName is null', () => {
    const event = makeTraceEvent({ stepName: null, processName: 'my-process' });
    const { container } = openDialog(event);
    const title = container.ownerDocument.querySelector('[data-slot="dialog-title"]');
    expect(title?.textContent).toBe('my-process');
  });

  it('renders identifiers section', () => {
    const event = makeTraceEvent({
      executionId: 'exec-abc',
      correlationId: 'corr-def',
    });
    openDialog(event);
    expect(screen.getByText('Identifiers')).toBeDefined();
    expect(screen.getByText('exec-abc')).toBeDefined();
    expect(screen.getByText('corr-def')).toBeDefined();
  });

  it('renders system context', () => {
    const event = makeTraceEvent({
      targetSystem: 'TargetSys',
      originatingSystem: 'OriginSys',
      applicationId: 'app-xyz',
    });
    openDialog(event);
    expect(screen.getByText('System Context')).toBeDefined();
    // These texts appear in both the summary strip and the detail section
    expect(screen.getAllByText('TargetSys').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('OriginSys').length).toBeGreaterThanOrEqual(1);
  });

  it('renders HTTP details when present', () => {
    const event = makeTraceEvent({
      httpMethod: 'POST',
      endpoint: '/api/orders',
      httpStatusCode: 201,
    });
    openDialog(event);
    expect(screen.getByText('HTTP Details')).toBeDefined();
    expect(screen.getAllByText('POST').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('/api/orders')).toBeDefined();
    expect(screen.getByText('201')).toBeDefined();
  });

  it('does not render HTTP section when no HTTP data', () => {
    const event = makeTraceEvent({
      httpMethod: null,
      endpoint: null,
      httpStatusCode: null,
    });
    openDialog(event);
    expect(screen.queryByText('HTTP Details')).toBeNull();
  });

  it('renders error details when present', () => {
    const event = makeTraceEvent({
      errorCode: 'ERR_TIMEOUT',
      errorMessage: 'Connection timed out after 30s',
    });
    openDialog(event);
    expect(screen.getByText('Error Details')).toBeDefined();
    expect(screen.getByText('ERR_TIMEOUT')).toBeDefined();
    expect(screen.getByText('Connection timed out after 30s')).toBeDefined();
  });

  it('does not render error section when no errors', () => {
    const event = makeTraceEvent({
      errorCode: null,
      errorMessage: null,
    });
    openDialog(event);
    expect(screen.queryByText('Error Details')).toBeNull();
  });

  it('renders execution time badge when present', () => {
    const event = makeTraceEvent({ executionTimeMs: 350 });
    openDialog(event);
    expect(screen.getAllByText('350ms').length).toBeGreaterThanOrEqual(1);
  });

  it('renders metadata section when metadata is present', () => {
    const event = makeTraceEvent({ metadata: { key: 'value' } });
    openDialog(event);
    expect(screen.getAllByText('Metadata').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render metadata section when metadata is null', () => {
    const event = makeTraceEvent({ metadata: null });
    openDialog(event);
    expect(screen.queryByText('Metadata')).toBeNull();
  });

  it('renders execution time bar for events with execution time', () => {
    const event = makeTraceEvent({ executionTimeMs: 2500 });
    openDialog(event);
    expect(screen.getByText('Execution')).toBeDefined();
    expect(screen.getAllByText('2500ms').length).toBeGreaterThanOrEqual(1);
  });
});
