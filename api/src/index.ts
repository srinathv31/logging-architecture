import { buildApp } from './app';
import { env } from './config/env';
import { initializeDb, closeDb } from './db/client';
import { runMigrations } from './db/migrate';

const app = buildApp();

async function start() {
  try {
    await initializeDb();
    app.log.info('Database connection established');
    await runMigrations();
    app.log.info('Database migrations applied');
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown() {
  app.log.info('Shutting down...');
  await app.close();
  await closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
