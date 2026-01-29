import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';

// MSSQL is primary (used by services)
let db: NodeMsSqlDatabase;

// Postgres is standalone (requires manual import to use)
let dbPg: NodePgDatabase;

export async function initializeDb(): Promise<void> {
  const { createMssqlClient } = await import('./drivers/mssql');
  db = await createMssqlClient();
}

export async function initializeDbPg(): Promise<void> {
  const { createPostgresClient } = await import('./drivers/postgres');
  dbPg = createPostgresClient();
}

export async function closeDb(): Promise<void> {
  const { closeMssqlConnection } = await import('./drivers/mssql');
  await closeMssqlConnection();
}

export { db, dbPg };
