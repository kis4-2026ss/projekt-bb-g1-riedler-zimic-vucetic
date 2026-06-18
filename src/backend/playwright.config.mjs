import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'node test-server.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
