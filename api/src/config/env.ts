import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  DRIZZLE_LOG: z.enum(["true", "false"]).default("false"),
  FULLTEXT_ENABLED: z.enum(["true", "false"]).default("true"),
  // MSSQL Azure AD authentication
  DB_SERVER: z.string().optional(),
  DB_NAME: z.string().optional(),
  MSI_ENDPOINT: z.string().optional(),
  MSI_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      result.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
