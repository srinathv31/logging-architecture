import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

(process.env as Record<string, string>).NODE_ENV = 'test';
