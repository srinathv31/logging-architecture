import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/db/schema/postgres/event-logs.ts',
    './src/db/schema/postgres/correlation-links.ts',
    './src/db/schema/postgres/process-definitions.ts',
    './src/db/schema/postgres/account-timeline-summary.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
