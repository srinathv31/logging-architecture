import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
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

    // Coverage configuration
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'test/**',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/components/ui/**',
        'src/db/schema/**',
      ],
      reporter: ['lcov', 'text'],
      reportsDirectory: './nyc_output',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
