import type { Logger } from 'drizzle-orm/logger';
import { env } from '../config/env';

export const queryLogger: Logger = {
  logQuery(query: string, params: unknown[]): void {
    if (env.NODE_ENV === 'development') {
      console.log('[SQL]', query);
      if (params.length > 0) {
        console.log('[Params]', params);
      }
    }
  },
};
