import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/db/schema/mssql/event-logs.ts',
    './src/db/schema/mssql/correlation-links.ts',
    './src/db/schema/mssql/process-definitions.ts',
    './src/db/schema/mssql/account-timeline-summary.ts',
  ],
  out: './drizzle-mssql',
  dialect: 'mssql',
  dbCredentials: {
    server: process.env.DB_SERVER!,
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  },
});
