import { getDb } from './client';

export async function runMigrations() {
  const db = await getDb();
  const { migrate } = await import('drizzle-orm/node-mssql/migrator');
  await migrate(db, { migrationsFolder: './drizzle-mssql' });
}
