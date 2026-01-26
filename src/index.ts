import { buildApp } from './app';
import { env } from './config/env';
import { pool } from './db/client';
import { runMigrations } from './db/migrate';

const app = buildApp();

async function start() {
  try {
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
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
