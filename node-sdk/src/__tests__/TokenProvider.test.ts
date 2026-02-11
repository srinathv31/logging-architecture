import { describe, it, expect, vi } from 'vitest';
import {
  OAuthTokenProvider,
  StaticTokenProvider,
  OAuthError,
  createStaticTokenProvider,
} from '../client/TokenProvider';

// ============================================================================
// StaticTokenProvider
// ============================================================================

describe('StaticTokenProvider', () => {
  it('returns the static token', async () => {
    const provider = new StaticTokenProvider('my-token');
    expect(await provider.getToken()).toBe('my-token');
  });

  it('throws if token is empty', () => {
    expect(() => new StaticTokenProvider('')).toThrow('token is required');
  });
});

describe('createStaticTokenProvider', () => {
  it('creates a working provider', async () => {
    const provider = createStaticTokenProvider('abc');
    expect(await provider.getToken()).toBe('abc');
  });
});

// ============================================================================
// OAuthTokenProvider
// ============================================================================

function createMockTokenFetch(
  responses: Array<{ status: number; body: unknown; ok?: boolean }>
) {
  let callIndex = 0;
  return vi.fn(async () => {
    const resp = responses[Math.min(callIndex++, responses.length - 1)];
    return {
      ok: resp.ok ?? (resp.status >= 200 && resp.status < 300),
      status: resp.status,
      json: async () => resp.body,
      text: async () => JSON.stringify(resp.body),
    } as Response;
  });
}

describe('OAuthTokenProvider', () => {
  it('throws if required config is missing', () => {
    expect(
      () => new OAuthTokenProvider({ tokenUrl: '', clientId: 'id', clientSecret: 'secret' })
    ).toThrow('tokenUrl is required');
  });

  it('fetches and caches a token', async () => {
    const mockFetch = createMockTokenFetch([
      {
        status: 200,
        body: { access_token: 'tok-123', expires_in: 3600 },
      },
    ]);

    const provider = new OAuthTokenProvider({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: 'eventlog:write',
      fetch: mockFetch as typeof fetch,
      logger: 'silent',
    });

    const token1 = await provider.getToken();
    expect(token1).toBe('tok-123');

    // Second call should use cache
    const token2 = await provider.getToken();
    expect(token2).toBe('tok-123');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests', async () => {
    const mockFetch = createMockTokenFetch([
      {
        status: 200,
        body: { access_token: 'tok-dedup', expires_in: 3600 },
      },
    ]);

    const provider = new OAuthTokenProvider({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      fetch: mockFetch as typeof fetch,
      logger: 'silent',
    });

    const [t1, t2, t3] = await Promise.all([
      provider.getToken(),
      provider.getToken(),
      provider.getToken(),
    ]);

    expect(t1).toBe('tok-dedup');
    expect(t2).toBe('tok-dedup');
    expect(t3).toBe('tok-dedup');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws OAuthError on failure', async () => {
    const mockFetch = createMockTokenFetch([
      { status: 401, body: { error: 'invalid_client' }, ok: false },
    ]);

    const provider = new OAuthTokenProvider({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'bad',
      clientSecret: 'bad',
      fetch: mockFetch as typeof fetch,
      logger: 'silent',
    });

    await expect(provider.getToken()).rejects.toThrow(OAuthError);
  });

  it('invalidateToken forces refresh on next call', async () => {
    const mockFetch = createMockTokenFetch([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      { status: 200, body: { access_token: 'tok-2', expires_in: 3600 } },
    ]);

    const provider = new OAuthTokenProvider({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      fetch: mockFetch as typeof fetch,
      logger: 'silent',
    });

    const t1 = await provider.getToken();
    expect(t1).toBe('tok-1');

    provider.invalidateToken();

    const t2 = await provider.getToken();
    expect(t2).toBe('tok-2');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sends correct OAuth request format', async () => {
    const mockFetch = createMockTokenFetch([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
    ]);

    const provider = new OAuthTokenProvider({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'my-client',
      clientSecret: 'my-secret',
      scope: 'eventlog:write',
      fetch: mockFetch as typeof fetch,
      logger: 'silent',
    });

    await provider.getToken();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://auth.example.com/token');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(opts.headers['Authorization']).toMatch(/^Basic /);
    expect(opts.body).toContain('grant_type=client_credentials');
    expect(opts.body).toContain('scope=eventlog%3Awrite');
  });
});
