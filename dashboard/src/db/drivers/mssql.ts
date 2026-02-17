import "server-only";

import mssql, { type ConnectionPool } from "mssql";
import { drizzle } from "drizzle-orm/node-mssql";
import type { NodeMsSqlDatabase } from "drizzle-orm/node-mssql";
import { createLogger } from "@/lib/logger";

const log = createLogger("mssql");

const TOKEN_REFRESH_MS = 45 * 60 * 1000; // 45 minutes
const TOKEN_FETCH_MAX_RETRIES = 3;
const TOKEN_FETCH_INITIAL_DELAY_MS = 1000;

// Module-level state
let pool: ConnectionPool | null = null;
let drizzleDb: NodeMsSqlDatabase | null = null;
let tokenTimestamp = 0;
let refreshPromise: Promise<void> | null = null;

const useSqlAuth = !!(process.env.DB_USER && process.env.DB_PASSWORD);

/**
 * Fetches an Azure AD access token from the MSI endpoint with retry logic
 */
export async function getToken(): Promise<string> {
  if (!process.env.MSI_ENDPOINT || !process.env.MSI_SECRET) {
    throw new Error("MSI_ENDPOINT and MSI_SECRET are required for Azure AD authentication");
  }

  const FULL_MSI_URL = `${process.env.MSI_ENDPOINT}/?resource=https://database.windows.net/&api-version=2019-08-01`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= TOKEN_FETCH_MAX_RETRIES; attempt++) {
    try {
      log.info({ attempt }, "Fetching Azure AD access token from MSI endpoint");

      const response = await fetch(FULL_MSI_URL, {
        method: "GET",
        headers: { "X-Identity-Header": process.env.MSI_SECRET },
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
        log.warn({ attempt, delay, error: lastError.message }, "Token fetch failed, retrying");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  log.error(
    { attempts: TOKEN_FETCH_MAX_RETRIES, error: lastError?.message },
    "Token fetch exhausted all retries",
  );
  throw new Error(
    `Failed to fetch token after ${TOKEN_FETCH_MAX_RETRIES} attempts: ${lastError?.message}`,
  );
}

async function getConfig(): Promise<mssql.config> {
  if (!process.env.DB_SERVER || !process.env.DB_NAME) {
    throw new Error("DB_SERVER and DB_NAME are required for MSSQL connection");
  }

  log.info(
    { server: process.env.DB_SERVER, database: process.env.DB_NAME, useSqlAuth },
    "Building MSSQL connection config",
  );

  const baseConfig: mssql.config = {
    server: process.env.DB_SERVER,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 15000,
    },
    options: {
      database: process.env.DB_NAME,
      rowCollectionOnRequestCompletion: true,
      requestTimeout: 30000,
      connectTimeout: 30000,
    },
  };

  if (useSqlAuth) {
    return {
      ...baseConfig,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
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
    log.info("Closing existing MSSQL connection pool");
    await pool.close();
  }

  const config = await getConfig();
  pool = await mssql.connect(config);

  log.info("MSSQL connection pool established");

  // Create new Drizzle instance with the new pool
  drizzleDb = drizzle({ client: pool });
}

/**
 * Gets the Drizzle database instance, refreshing the connection if needed.
 * Uses a mutex pattern to prevent race conditions during token refresh.
 */
export async function getDb(): Promise<NodeMsSqlDatabase> {
  // Happy path: return cached instance if pool is connected
  // SQL auth doesn't need token refresh; only Azure AD tokens expire
  if ((useSqlAuth || !isTokenExpired()) && pool?.connected && drizzleDb) {
    log.debug("Returning cached database instance");
    return drizzleDb;
  }

  // Token expired or pool not connected: refresh with mutex
  log.info("Token expired or pool disconnected, initiating connection refresh");

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
  log.info("Closing MSSQL connection and clearing state");
  if (pool?.connected) {
    await pool.close();
  }
  pool = null;
  drizzleDb = null;
  tokenTimestamp = 0;
  refreshPromise = null;
}
