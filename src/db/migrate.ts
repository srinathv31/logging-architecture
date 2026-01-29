import { db } from './client';

export async function runMigrations() {
  const { migrate } = await import('drizzle-orm/node-mssql/migrator');
  await migrate(db, { migrationsFolder: './drizzle-mssql' });
}
