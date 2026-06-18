import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/load/**/*.test.mjs'],
    testTimeout: 60_000,
    hookTimeout: 15_000,
  },
});
