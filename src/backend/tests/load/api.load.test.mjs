/**
 * Load tests using autocannon.
 * Each scenario starts its own HTTP server on port 3099 (isolated from the
 * development server on 3000) and tears it down afterward.
 *
 * Thresholds are intentionally conservative – they document minimum
 * acceptable performance rather than benchmarking.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import autocannon from 'autocannon';
import { createBackend } from '../../app.mjs';

const LOAD_PORT = 3099;
const BASE      = `http://localhost:${LOAD_PORT}`;

let server;

beforeAll(async () => {
  const { app } = await createBackend({
    storage: ':memory:',
    seed: true,
  });
  server = await new Promise(resolve => {
    const s = app.listen(LOAD_PORT, () => resolve(s));
  });
}, 15_000);

afterAll(() => new Promise(resolve => server.close(resolve)));

// ── Helper ────────────────────────────────────────────────────────────────────

async function bench(opts) {
  return autocannon({ connections: 5, duration: 3, ...opts });
}

// ── Read endpoints ────────────────────────────────────────────────────────────

describe('Load – GET /wishlist', () => {
  it('handles concurrent read requests with zero errors', async () => {
    const result = await bench({ url: `${BASE}/wishlist` });
    expect(result.errors).toBe(0);
    expect(result.non2xx).toBe(0);
  });

  it('median latency stays below 200 ms under 5 concurrent connections', async () => {
    const result = await bench({ url: `${BASE}/wishlist` });
    expect(result.latency.p50).toBeLessThan(200);
  });
});

describe('Load – GET /wish', () => {
  it('handles concurrent wish-list reads with zero errors', async () => {
    const result = await bench({ url: `${BASE}/wish` });
    expect(result.errors).toBe(0);
    expect(result.non2xx).toBe(0);
  });
});

// ── Write endpoints ───────────────────────────────────────────────────────────

describe('Load – POST /wishlist', () => {
  it('handles concurrent wishlist creation with zero errors', async () => {
    const result = await bench({
      url: `${BASE}/wishlist`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Load Test List' }),
      connections: 3,
    });
    expect(result.errors).toBe(0);
    expect(result.non2xx).toBe(0);
  });
});

// ── Throughput baseline ───────────────────────────────────────────────────────

describe('Load – throughput baseline', () => {
  it('serves at least 5 requests per second on GET /wishlist (SQLite/Windows baseline)', async () => {
    const result = await bench({ url: `${BASE}/wishlist`, duration: 5 });
    expect(result.requests.average).toBeGreaterThan(5);
  });
});
