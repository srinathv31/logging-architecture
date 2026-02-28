import { buildApp } from './app';
import { env } from './config/env';
import { getDb, closeDb } from './db/client';

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });

    // Attempt initial DB connection in background — don't block startup
    getDb()
      .then(() => app.log.info('Database connection established'))
      .catch((err) => app.log.warn({ err }, 'Database not available at startup — will retry on first request'));
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
