import mssql, { type ConnectionPool } from "mssql";
import { drizzle } from "drizzle-orm/node-mssql";
import type { NodeMsSqlDatabase } from "drizzle-orm/node-mssql";
import { env } from "../../config/env";
import { queryLogger } from "../logger";

const TOKEN_REFRESH_MS = 45 * 60 * 1000; // 45 minutes
const TOKEN_FETCH_MAX_RETRIES = 3;
const TOKEN_FETCH_INITIAL_DELAY_MS = 1000;

// Module-level state
let pool: ConnectionPool | null = null;
let drizzleDb: NodeMsSqlDatabase | null = null;
let tokenTimestamp = 0;
let refreshPromise: Promise<void> | null = null;

const useSqlAuth = !!(env.DB_USER && env.DB_PASSWORD);

/**
 * Fetches an Azure AD access token from the MSI endpoint with retry logic
 */
export async function getToken(): Promise<string> {
  if (!env.MSI_ENDPOINT || !env.MSI_SECRET) {
    throw new Error("MSI_ENDPOINT and MSI_SECRET are required for Azure AD authentication");
  }

  const FULL_MSI_URL = `${env.MSI_ENDPOINT}/?resource=https://database.windows.net/&api-version=2019-08-01`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= TOKEN_FETCH_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(FULL_MSI_URL, {
        method: "GET",
        headers: { "X-Identity-Header": env.MSI_SECRET },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < TOKEN_FETCH_MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = TOKEN_FETCH_INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to fetch token after ${TOKEN_FETCH_MAX_RETRIES} attempts: ${lastError?.message}`,
  );
}

async function getConfig(): Promise<mssql.config> {
  if (!env.DB_SERVER || !env.DB_NAME) {
    throw new Error("DB_SERVER and DB_NAME are required for MSSQL connection");
  }

  const baseConfig: mssql.config = {
    server: env.DB_SERVER,
    pool: {
      max: env.DB_POOL_MAX,
      min: env.DB_POOL_MIN,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
      acquireTimeoutMillis: env.DB_ACQUIRE_TIMEOUT_MS,
    },
    options: {
      database: env.DB_NAME,
      rowCollectionOnRequestCompletion: true,
      requestTimeout: env.DB_REQUEST_TIMEOUT_MS,
      connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
    },
  };

  if (useSqlAuth) {
    return {
      ...baseConfig,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      options: {
        ...baseConfig.options,
        encrypt: false,
        trustServerCertificate: true,
      },
    };
  }

  const token = await getToken();
  tokenTimestamp = Date.now();

  return {
    ...baseConfig,
    options: {
      ...baseConfig.options,
      encrypt: true,
    },
    authentication: {
      type: "azure-active-directory-access-token",
      options: { token },
    },
  };
}

function isTokenExpired(): boolean {
  return Date.now() - tokenTimestamp > TOKEN_REFRESH_MS;
}

/**
 * Refreshes the connection pool with a new token.
 * This is called when the token is expired.
 */
async function refreshConnection(): Promise<void> {
  // Close existing pool if connected
  if (pool?.connected) {
    await pool.close();
  }

  const config = await getConfig();
  pool = await mssql.connect(config);

  // Create new Drizzle instance with the new pool
  drizzleDb = drizzle({
    client: pool,
    logger: env.DRIZZLE_LOG === "true" ? queryLogger : undefined,
  });
}

/**
 * Gets the Drizzle database instance, refreshing the connection if needed.
 * Uses a mutex pattern to prevent race conditions during token refresh.
 */
export async function getDb(): Promise<NodeMsSqlDatabase> {
  // Happy path: return cached instance if pool is connected
  // SQL auth doesn't need token refresh; only Azure AD tokens expire
  if ((useSqlAuth || !isTokenExpired()) && pool?.connected && drizzleDb) {
    return drizzleDb;
  }

  // Token expired or pool not connected: refresh with mutex
  // Reuse in-flight refresh to prevent race conditions
  if (!refreshPromise) {
    refreshPromise = refreshConnection().finally(() => {
      refreshPromise = null;
    });
  }

  await refreshPromise;

  if (!drizzleDb) {
    throw new Error("Failed to initialize database connection");
  }

  return drizzleDb;
}

export async function closeMssqlConnection(): Promise<void> {
  if (pool?.connected) {
    await pool.close();
  }
  pool = null;
  drizzleDb = null;
  tokenTimestamp = 0;
  refreshPromise = null;
}
