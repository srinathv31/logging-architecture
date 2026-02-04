import { AppError, NotFoundError, ConflictError } from '../../src/utils/errors';

describe('AppError', () => {
  it('should create an error with message and status code', () => {
    const error = new AppError('Test error', 400);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBeUndefined();
    expect(error.name).toBe('AppError');
  });

  it('should create an error with message, status code, and code', () => {
    const error = new AppError('Test error', 422, 'VALIDATION_ERROR');

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should be an instance of Error', () => {
    const error = new AppError('Test error', 500);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have a stack trace', () => {
    const error = new AppError('Test error', 500);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });
});

describe('NotFoundError', () => {
  it('should create a 404 error with default message', () => {
    const error = new NotFoundError();

    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.name).toBe('NotFoundError');
  });

  it('should create a 404 error with custom message', () => {
    const error = new NotFoundError('User not found');

    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should be an instance of AppError and Error', () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe('ConflictError', () => {
  it('should create a 409 error with default message', () => {
    const error = new ConflictError();

    expect(error.message).toBe('Resource already exists');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.name).toBe('ConflictError');
  });

  it('should create a 409 error with custom message', () => {
    const error = new ConflictError('Duplicate entry detected');

    expect(error.message).toBe('Duplicate entry detected');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('should be an instance of AppError and Error', () => {
    const error = new ConflictError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ConflictError);
  });
});
