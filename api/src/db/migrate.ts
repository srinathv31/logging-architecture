import { getDb } from './client';

export async function runMigrations() {
  const db = await getDb();
  const { migrate } = await import('drizzle-orm/node-mssql/migrator');
  try {
    await migrate(db, { migrationsFolder: './drizzle-mssql' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already an object named') || msg.includes('2714')) {
      console.warn('Migrations skipped — tables already exist');
    } else {
      throw err;
    }
  }
}
