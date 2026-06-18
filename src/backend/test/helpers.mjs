import { once } from 'node:events';
import { createBackend } from '../app.mjs';

export async function createTestServer(options = {}) {
  const backend = await createBackend({
    storage: ':memory:',
    seed: false,
    syncOptions: { force: true },
    ...options
  });

  const server = backend.app.listen(0);
  await once(server, 'listening');

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(path, options = {}) {
    const headers = {
      ...(options.body == null ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers
    };

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      body: options.body == null || typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    return { response, body };
  }

  async function close() {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    await backend.sequelize.close();
  }

  return { ...backend, server, baseUrl, request, close };
}

