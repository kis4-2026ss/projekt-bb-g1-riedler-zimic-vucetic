import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // run sequentially to avoid SQLite locking issues in tests
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server.mjs',
    url: 'http://localhost:3000/wishlist',
    reuseExistingServer: false,
    env: {
      PORT: '3000',
      DB_STORAGE: ':memory:', // Keep DB storage isolated in memory for clean E2E runs
      SEED_DB: 'true',       // Seed the DB so the page has initial content
    },
    stdout: 'ignore',
    stderr: 'ignore',
    timeout: 10000,
  },
});
