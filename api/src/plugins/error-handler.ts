import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | Error, _request, reply) => {
    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: error.errors,
      });
    }

    // Custom app errors
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code ?? error.name,
        message: error.message,
      });
    }

    // Fastify validation errors (from schema validation)
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: (error as FastifyError).validation,
      });
    }

    // PostgreSQL unique violation
    if ('code' in error && (error as { code?: string }).code === '23505') {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'A resource with the given unique constraint already exists.',
      });
    }

    // Fallback
    app.log.error(error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
    });
  });
}
