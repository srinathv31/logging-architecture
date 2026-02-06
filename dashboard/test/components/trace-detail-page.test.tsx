// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderServerComponent } from '../util/render-server-component';
import { makeTraceDetail } from '../util/fixtures';

const getTraceDetailMock = vi.fn();

vi.mock('@/data/queries', () => ({
  getTraceDetail: (...args: any[]) => getTraceDetailMock(...args),
}));

const notFoundMock = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: (...args: any[]) => {
    notFoundMock(...args);
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('nuqs', () => ({
  useQueryState: () => [null, vi.fn()],
  parseAsInteger: { withDefault: () => ({}) },
  parseAsString: { withDefault: () => ({}) },
}));

import TraceDetailPage from '@/app/trace/[traceId]/page';

describe('TraceDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trace detail when data exists', async () => {
    const detail = makeTraceDetail({
      processName: 'order_processing',
      systemsInvolved: ['Gateway', 'PaymentService'],
      events: [
        {
          eventLogId: 1,
          executionId: 'exec-1',
          correlationId: 'corr-1',
          accountId: 'acc-1',
          traceId: 'trace-1',
          spanId: null,
          parentSpanId: null,
          batchId: null,
          applicationId: 'app-1',
          targetSystem: 'Gateway',
          originatingSystem: 'Client',
          processName: 'order_processing',
          stepSequence: 1,
          stepName: 'init',
          eventType: 'API_CALL',
          eventStatus: 'SUCCESS',
          identifiers: null,
          summary: 'Process started',
          result: 'OK',
          metadata: null,
          eventTimestamp: '2025-01-01T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z',
          executionTimeMs: 100,
          endpoint: null,
          httpStatusCode: null,
          httpMethod: null,
          errorCode: null,
          errorMessage: null,
          requestPayload: null,
          responsePayload: null,
        },
      ],
    });
    getTraceDetailMock.mockResolvedValue(detail);

    const { container } = await renderServerComponent(
      <TraceDetailPage params={Promise.resolve({ traceId: 'trace-1' })} />
    );

    expect(container.textContent).toContain('Order Processing');
    expect(container.textContent).toContain('Gateway');
    expect(container.textContent).toContain('PaymentService');
  });

  it('calls notFound when trace is null', async () => {
    getTraceDetailMock.mockResolvedValue(null);

    await expect(
      renderServerComponent(
        <TraceDetailPage params={Promise.resolve({ traceId: 'nonexistent' })} />
      )
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalled();
  });

  it('decodes URL-encoded traceId', async () => {
    getTraceDetailMock.mockResolvedValue(makeTraceDetail());

    await renderServerComponent(
      <TraceDetailPage params={Promise.resolve({ traceId: 'trace%2F123' })} />
    );

    expect(getTraceDetailMock).toHaveBeenCalledWith('trace/123');
  });
});
