/**
 * Combined test server for Playwright E2E tests.
 * Serves the backend REST API AND the static frontend files from a single
 * Express instance on port 3000 (or $PORT), using an in-memory SQLite DB.
 */
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createBackend } from './app.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const port  = Number(process.env.PORT ?? 3000);

const { app } = await createBackend({
  storage: ':memory:',
  seed: true,
});

// Serve frontend static files AFTER the API routes so API takes priority.
app.use(express.static(join(__dir, '../frontend')));

app.listen(port, () => {
  console.log(`Test server ready at http://localhost:${port}`);
});
