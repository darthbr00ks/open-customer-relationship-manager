import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The suite exercises real Postgres and Redis, so files run serially.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
