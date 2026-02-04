import type { FastifyInstance } from 'fastify';

/**
 * Creates a test Fastify app instance without database connection
 * For route integration tests that mock the service layer
 */
export async function createTestApp(): Promise<FastifyInstance> {
  // Dynamic import to avoid loading db during test setup
  const { buildApp } = await import('../../src/app');
  const app = buildApp();
  await app.ready();
  return app;
}

/**
 * Closes the test app instance
 */
export async function closeTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
}
