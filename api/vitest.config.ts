import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    testTimeout: 10000,

    // EDP-compatible reporters
    reporters: [
      'default',
      'junit',
      'html',
      ['vitest-sonar-reporter', {
        outputFile: './test-results.xml',
        onWritePath: (relativePath: string) => {
          return path.resolve(__dirname, relativePath);
        },
      }]
    ],

    // Output file location for junit and html
    outputFile: {
      junit: './nyc_output/junit.xml',
      html: './nyc_output/test-report.html',
    },

    // Coverage configuration (replaces nyc config)
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/db/migrate.ts', 'src/test/**'],
      reporter: ['lcov', 'text'],
      reportsDirectory: './nyc_output',
    },
  },
});
