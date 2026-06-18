import assert from 'node:assert/strict';
import { afterEach } from 'node:test';
import { createBackend } from '../../app.mjs';

const openBackends = new Set();

afterEach(async () => {
  const backends = [...openBackends];
  openBackends.clear();
  await Promise.all(backends.map(({ server, sequelize }) => closeBackend({ server, sequelize })));
});

export async function createTestBackend({ seed = false } = {}) {
  const backend = await createBackend({
    storage: ':memory:',
    seed,
    syncOptions: { force: true }
  });

  const server = await new Promise((resolve, reject) => {
    const instance = backend.app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });

  const address = server.address();
  assert.equal(typeof address, 'object');

  const context = {
    ...backend,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };

  openBackends.add(context);
  return context;
}

export async function closeBackend(context) {
  await Promise.allSettled([
    context.server
      ? new Promise((resolve, reject) => context.server.close(error => error ? reject(error) : resolve()))
      : Promise.resolve(),
    context.sequelize?.close()
  ]);
}

export async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body, text };
}

export function jsonBody(method, body) {
  return {
    method,
    body: JSON.stringify(body)
  };
}
