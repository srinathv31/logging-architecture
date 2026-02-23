import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  DRIZZLE_LOG: z.enum(["true", "false"]).default("false"),
  FULLTEXT_ENABLED: z.enum(["true", "false"]).default("true"),
  // MSSQL connection
  DB_SERVER: z.string().optional(),
  DB_NAME: z.string().optional(),
  // Local SQL auth (optional — when set, skips Azure AD MSI)
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  // Azure AD MSI authentication
  MSI_ENDPOINT: z.string().optional(),
  MSI_SECRET: z.string().optional(),
  // DB pool settings
  DB_POOL_MAX: z.coerce.number().int().positive().optional().default(10),
  DB_POOL_MIN: z.coerce.number().int().min(0).optional().default(0),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(30000),
  DB_ACQUIRE_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(15000),
  DB_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(30000),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(30000),
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
