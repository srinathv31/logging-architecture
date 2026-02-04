import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';

// Postgres is standalone (requires manual import to use)
let dbPg: NodePgDatabase;

/**
 * Gets the MSSQL Drizzle database instance.
 * This function handles token refresh automatically and returns the current connection.
 */
export async function getDb(): Promise<NodeMsSqlDatabase> {
  const { getDb: getMssqlDb } = await import('./drivers/mssql');
  return getMssqlDb();
}

export async function initializeDbPg(): Promise<void> {
  const { createPostgresClient } = await import('./drivers/postgres');
  dbPg = createPostgresClient();
}

export async function closeDb(): Promise<void> {
  const { closeMssqlConnection } = await import('./drivers/mssql');
  await closeMssqlConnection();
}

export { dbPg };
