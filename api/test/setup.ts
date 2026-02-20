// Test environment setup

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.HOST = '127.0.0.1';
process.env.LOG_LEVEL = 'error';
process.env.DRIZZLE_LOG = 'false';
process.env.FULLTEXT_ENABLED = 'false';
