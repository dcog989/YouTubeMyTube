import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/shared/**/*.ts',
        'src/options/backfill.ts',
        'src/options/conflict.ts',
        'src/options/data.ts',
        'src/options/tester.ts',
      ],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        statements: 78,
        branches: 75,
        functions: 55,
      },
    },
  },
});
