import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { ZodError, z } from 'zod';
import { registerErrorHandler } from '../../plugins/error-handler';
import { AppError, NotFoundError, ConflictError } from '../../utils/errors';

function buildTestApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  return app;
}

describe('Error Handler Plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();

    // Route that throws ZodError
    app.get('/zod-error', async () => {
      const schema = z.object({ name: z.string().min(1) });
      schema.parse({ name: '' }); // Will throw ZodError
    });

    // Route that throws AppError
    app.get('/app-error', async () => {
      throw new AppError('Custom app error', 422, 'CUSTOM_CODE');
    });

    // Route that throws AppError without code
    app.get('/app-error-no-code', async () => {
      throw new AppError('App error without code', 400);
    });

    // Route that throws NotFoundError
    app.get('/not-found', async () => {
      throw new NotFoundError('Resource not found');
    });

    // Route that throws ConflictError
    app.get('/conflict', async () => {
      throw new ConflictError('Resource already exists');
    });

    // Route that throws PostgreSQL unique violation
    app.get('/pg-unique', async () => {
      const error = new Error('unique constraint violation') as Error & { code: string };
      error.code = '23505';
      throw error;
    });

    // Route that throws generic error
    app.get('/generic-error', async () => {
      throw new Error('Something went wrong');
    });

    // Route with validation error (Fastify schema validation)
    app.post('/validation', {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
          },
        },
      },
    }, async () => {
      return { success: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ZodError handling', () => {
    it('should return 400 for ZodError', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/zod-error',
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('Validation Error');
      expect(body.details).toBeDefined();
      expect(Array.isArray(body.details)).toBe(true);
    });

    it('should include Zod error details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/zod-error',
      });

      const body = response.json();
      expect(body.details.length).toBeGreaterThan(0);
      expect(body.details[0]).toHaveProperty('code');
      expect(body.details[0]).toHaveProperty('path');
    });
  });

  describe('AppError handling', () => {
    it('should return correct status code for AppError with code', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/app-error',
      });

      expect(response.statusCode).toBe(422);
      const body = response.json();
      expect(body.error).toBe('CUSTOM_CODE');
      expect(body.message).toBe('Custom app error');
    });

    it('should use error name when code is not provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/app-error-no-code',
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('AppError');
      expect(body.message).toBe('App error without code');
    });
  });

  describe('NotFoundError handling', () => {
    it('should return 404 for NotFoundError', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/not-found',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Resource not found');
    });
  });

  describe('ConflictError handling', () => {
    it('should return 409 for ConflictError', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/conflict',
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error).toBe('CONFLICT');
      expect(body.message).toBe('Resource already exists');
    });
  });

  describe('PostgreSQL unique violation handling', () => {
    it('should return 409 for PostgreSQL unique violation (code 23505)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/pg-unique',
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error).toBe('Conflict');
      expect(body.message).toBe('A resource with the given unique constraint already exists.');
    });
  });

  describe('Fastify validation error handling', () => {
    it('should return 400 for Fastify schema validation errors', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/validation',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('Validation Error');
      expect(body.details).toBeDefined();
    });
  });

  describe('Generic error handling', () => {
    it('should return 500 for unknown errors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/generic-error',
      });

      expect(response.statusCode).toBe(500);
      const body = response.json();
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toBe('An unexpected error occurred.');
    });
  });
});
