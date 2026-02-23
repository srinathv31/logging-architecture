import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Only applies to src/ files (not server.ts or logger.ts at root)
    // Excludes src/lib/logger.ts — that file IS the re-export bridge
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/logger.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["pino", "pino/*", "pino-roll", "pino-pretty"],
            message: "Import the logger from '@/lib/logger' instead of using pino directly.",
          },
          {
            group: ["../../logger", "../../../logger"],
            message: "Import the logger from '@/lib/logger' instead of relative paths to root logger.ts.",
          },
        ],
      }],
    },
  },
]);

export default eslintConfig;
