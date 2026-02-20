import type { NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';

/**
 * Gets the MSSQL Drizzle database instance.
 * This function handles token refresh automatically and returns the current connection.
 */
export async function getDb(): Promise<NodeMsSqlDatabase> {
  const { getDb: getMssqlDb } = await import('./drivers/mssql');
  return getMssqlDb();
}

export async function closeDb(): Promise<void> {
  const { closeMssqlConnection } = await import('./drivers/mssql');
  await closeMssqlConnection();
}
