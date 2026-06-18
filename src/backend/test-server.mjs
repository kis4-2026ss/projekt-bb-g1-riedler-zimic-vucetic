/**
 * Combined HTTP server for Playwright E2E tests.
 * Serves the REST API and static frontend files on a single port using an
 * isolated in-memory SQLite database seeded with default data.
 */
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createBackend } from './app.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const port  = Number(process.env.PORT ?? 3000);

const { app } = await createBackend({ storage: ':memory:', seed: true });

// Static frontend served after API routes – no route conflicts with /wishlist, /wish
app.use(express.static(join(__dir, '../frontend')));

app.listen(port, () => console.log(`Test server ready → http://localhost:${port}`));
