import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockPool, mockDrizzleDb } = vi.hoisted(() => {
  const mockPool = {
    connected: true,
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockDrizzleDb = { __drizzle: true };
  return { mockPool, mockDrizzleDb };
});

vi.mock('mssql', () => {
  const connectFn = vi.fn().mockImplementation(async () => {
    mockPool.connected = true;
    return mockPool;
  });
  return {
    default: { connect: connectFn },
  };
});

vi.mock('drizzle-orm/node-mssql', () => ({
  drizzle: vi.fn().mockReturnValue(mockDrizzleDb),
}));

// Must import AFTER mocks are set up
import { getToken, getDb, closeMssqlConnection } from '@/db/drivers/mssql';

describe('getToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    process.env = {
      ...originalEnv,
      MSI_ENDPOINT: 'https://msi.example.com',
      MSI_SECRET: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('fetches token successfully', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'my-token' }),
    });

    const token = await getToken();

    expect(token).toBe('my-token');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://msi.example.com'),
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-Identity-Header': 'test-secret' },
      }),
    );
  });

  it('throws when MSI_ENDPOINT is missing', async () => {
    delete process.env.MSI_ENDPOINT;

    await expect(getToken()).rejects.toThrow('MSI_ENDPOINT and MSI_SECRET are required');
  });

  it('throws when MSI_SECRET is missing', async () => {
    delete process.env.MSI_SECRET;

    await expect(getToken()).rejects.toThrow('MSI_ENDPOINT and MSI_SECRET are required');
  });

  it('retries on failure with exponential backoff', async () => {
    (fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'retry-token' }),
      });

    const token = await getToken();

    expect(token).toBe('retry-token');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('throws after all retries exhausted', async () => {
    (fetch as any)
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockRejectedValueOnce(new Error('fail-3'));

    await expect(getToken()).rejects.toThrow('Failed to fetch token after 3 attempts');
  });

  it('retries when response is not ok', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'ok-token' }),
      });

    const token = await getToken();

    expect(token).toBe('ok-token');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('getDb', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    process.env = {
      ...originalEnv,
      MSI_ENDPOINT: 'https://msi.example.com',
      MSI_SECRET: 'test-secret',
      DB_SERVER: 'test-server.database.windows.net',
      DB_NAME: 'testdb',
    };
    // Reset module state
    await closeMssqlConnection();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('throws when token fetch fails on getDb', async () => {
    delete process.env.MSI_ENDPOINT;

    await expect(getDb()).rejects.toThrow('MSI_ENDPOINT and MSI_SECRET are required');
  });

  it('throws when DB_SERVER is missing', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'token' }),
    });
    delete process.env.DB_SERVER;

    await expect(getDb()).rejects.toThrow('DB_SERVER and DB_NAME are required');
  });
});

describe('closeMssqlConnection', () => {
  it('resets state without throwing', async () => {
    await expect(closeMssqlConnection()).resolves.not.toThrow();
  });
});
