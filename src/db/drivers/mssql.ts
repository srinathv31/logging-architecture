import mssql from 'mssql';
import { drizzle } from 'drizzle-orm/node-mssql';
import type { NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';
import { env } from '../../config/env';
import { queryLogger } from '../logger';

let pool: mssql.ConnectionPool | null = null;

export async function createMssqlClient(): Promise<NodeMsSqlDatabase> {
  if (!pool) {
    pool = await mssql.connect(env.DATABASE_URL);
  }
  return drizzle({
    client: pool,
    logger: env.DRIZZLE_LOG === 'true' ? queryLogger : undefined,
  });
}

export async function closeMssqlConnection() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
