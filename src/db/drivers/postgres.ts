import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env } from '../../config/env';

export function createPostgresClient(): NodePgDatabase {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
  });
  return drizzle({ client: pool });
}
