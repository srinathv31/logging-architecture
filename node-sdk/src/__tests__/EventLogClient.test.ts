import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventLogClient, EventLogError } from '../client/EventLogClient';
import { EventLogEntry, EventType, EventStatus } from '../models/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFetch(responses: Array<{ status: number; body: unknown; ok?: boolean }>) {
  let callIndex = 0;
  const fn = vi.fn(async () => {
    const resp = responses[Math.min(callIndex++, responses.length - 1)];
    return {
      ok: resp.ok ?? (resp.status >= 200 && resp.status < 300),
      status: resp.status,
      json: async () => resp.body,
      text: async () => JSON.stringify(resp.body),
    } as Response;
  });
  return fn;
}

function makeEvent(overrides?: Partial<EventLogEntry>): EventLogEntry {
  return {
    correlation_id: 'corr-123',
    trace_id: 'trace-abc',
    application_id: 'test-app',
    target_system: 'target',
    originating_system: 'origin',
    process_name: 'TestProcess',
    event_type: EventType.STEP,
    event_status: EventStatus.SUCCESS,
    identifiers: {},
    summary: 'Test',
    result: 'OK',
    event_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('EventLogClient', () => {
  describe('constructor', () => {
    it('throws if baseUrl is missing', () => {
      expect(() => new EventLogClient({ baseUrl: '' })).toThrow('baseUrl is required');
    });

    it('strips trailing slash from baseUrl', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { success: true, execution_ids: ['e1'], correlation_id: 'c1' } },
      ]);
      const client = new EventLogClient({
        baseUrl: 'https://api.example.com/',
        apiKey: 'key',
        fetch: mockFetch as typeof fetch,
      });
      await client.createEvent(makeEvent());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/api\.example\.com\/api/),
        expect.anything()
      );
    });
  });

  describe('createEvent', () => {
    it('sends POST to /api/v1/events', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { success: true, execution_ids: ['e1'], correlation_id: 'c1' } },
      ]);
      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key',
        fetch: mockFetch as typeof fetch,
      });

      const result = await client.createEvent(makeEvent());
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/events');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Authorization']).toBe('Bearer test-key');
    });
  });

  describe('createEvents', () => {
    it('sends POST to /api/v1/events/batch', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { success: true, total_received: 2, total_inserted: 2, execution_ids: ['e1', 'e2'] } },
      ]);
      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        fetch: mockFetch as typeof fetch,
      });

      const result = await client.createEvents([makeEvent(), makeEvent()]);
      expect(result.total_received).toBe(2);
    });
  });

  describe('retry logic', () => {
    it('retries on 500 with exponential backoff', async () => {
      const mockFetch = createMockFetch([
        { status: 500, body: { error: 'Server Error' }, ok: false },
        { status: 500, body: { error: 'Server Error' }, ok: false },
        { status: 200, body: { success: true, execution_ids: ['e1'], correlation_id: 'c1' } },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        maxRetries: 3,
        fetch: mockFetch as typeof fetch,
      });

      const result = await client.createEvent(makeEvent());
      expect(result.success).toBe(true);
      // Original attempt + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries on 429 (rate limited)', async () => {
      const mockFetch = createMockFetch([
        { status: 429, body: { error: 'Rate Limited' }, ok: false },
        { status: 200, body: { success: true, execution_ids: ['e1'], correlation_id: 'c1' } },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        maxRetries: 3,
        fetch: mockFetch as typeof fetch,
      });

      const result = await client.createEvent(makeEvent());
      expect(result.success).toBe(true);
    });

    it('does not retry on 400 (client error)', async () => {
      const mockFetch = createMockFetch([
        { status: 400, body: { error: 'Bad Request' }, ok: false },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        maxRetries: 3,
        fetch: mockFetch as typeof fetch,
      });

      await expect(client.createEvent(makeEvent())).rejects.toThrow(EventLogError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws after exhausting retries', async () => {
      const mockFetch = createMockFetch([
        { status: 500, body: { error: 'fail' }, ok: false },
        { status: 500, body: { error: 'fail' }, ok: false },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        maxRetries: 1,
        fetch: mockFetch as typeof fetch,
      });

      await expect(client.createEvent(makeEvent())).rejects.toThrow(EventLogError);
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 + 1 retry
    });
  });

  describe('authentication', () => {
    it('sends Bearer token from tokenProvider', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { success: true, execution_ids: ['e1'], correlation_id: 'c1' } },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        tokenProvider: { getToken: async () => 'my-oauth-token' },
        fetch: mockFetch as typeof fetch,
      });

      await client.createEvent(makeEvent());
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer my-oauth-token');
    });

    it('sends X-Application-Id header when configured', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { success: true, execution_ids: ['e1'], correlation_id: 'c1' } },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        applicationId: 'my-app',
        fetch: mockFetch as typeof fetch,
      });

      await client.createEvent(makeEvent());
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['X-Application-Id']).toBe('my-app');
    });
  });

  describe('retryDelay config', () => {
    it('uses custom retryDelay for backoff', async () => {
      const start = Date.now();
      const mockFetch = createMockFetch([
        { status: 500, body: { error: 'fail' }, ok: false },
        { status: 200, body: { success: true, execution_ids: ['e1'], correlation_id: 'c1' } },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        maxRetries: 1,
        retryDelay: 100, // 100ms instead of default 500ms
        fetch: mockFetch as typeof fetch,
      });

      await client.createEvent(makeEvent());
      const elapsed = Date.now() - start;
      // With retryDelay=100, first retry delay is 100 * 2^1 = 200ms
      // Much less than default 500 * 2^1 = 1000ms
      expect(elapsed).toBeLessThan(800);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('query endpoints', () => {
    it('getEventsByCorrelation sends GET with encoded ID', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { correlation_id: 'c1', events: [], is_linked: false } },
      ]);

      const client = new EventLogClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
        fetch: mockFetch as typeof fetch,
      });

      await client.getEventsByCorrelation('corr/special');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('corr%2Fspecial');
      expect(opts.method).toBe('GET');
    });
  });
});
