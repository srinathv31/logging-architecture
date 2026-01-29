import mssql from 'mssql';
import { drizzle } from 'drizzle-orm/node-mssql';
import type { NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';
import { env } from '../../config/env';

let pool: mssql.ConnectionPool | null = null;

export async function createMssqlClient(): Promise<NodeMsSqlDatabase> {
  if (!pool) {
    pool = await mssql.connect(env.DATABASE_URL);
  }
  return drizzle({ client: pool });
}

export async function closeMssqlConnection() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
