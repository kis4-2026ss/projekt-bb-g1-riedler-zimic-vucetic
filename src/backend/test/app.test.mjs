import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, beforeEach, describe, it } from 'node:test';
import {
  createApp,
  createBackend,
  createSequelize,
  defineModels,
  initializeDatabase
} from '../app.mjs';

const openBackends = new Set();
const openServers = new Set();

async function makeBackend(options = {}) {
  const backend = await createBackend({
    storage: ':memory:',
    seed: false,
    syncOptions: { force: true },
    ...options
  });
  openBackends.add(backend);
  return backend;
}

async function closeBackend(backend) {
  if (backend && openBackends.delete(backend)) {
    await backend.sequelize.close();
  }
}

async function listen(app) {
  const server = app.listen(0);
  openServers.add(server);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      if (!openServers.delete(server)) return;
      await new Promise((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

afterEach(async () => {
  await Promise.all([...openServers].map(server => new Promise(resolve => server.close(resolve))));
  openServers.clear();
  await Promise.all([...openBackends].map(backend => backend.sequelize.close()));
  openBackends.clear();
});

after(async () => {
  assert.equal(openBackends.size, 0);
  assert.equal(openServers.size, 0);
});

describe('database factories', () => {
  it('createSequelize creates missing directories for file-backed sqlite storage', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wishlist-db-'));
    const storage = join(dir, 'nested', 'main.sqlite');
    const sequelize = createSequelize({ storage });

    try {
      assert.equal(existsSync(join(dir, 'nested')), true);
      await sequelize.authenticate();
    } finally {
      await sequelize.close();
    }
  });

  it('defineModels registers Wishlist and Wish models with their association helpers', async () => {
    const sequelize = createSequelize({ storage: ':memory:' });
    const models = defineModels(sequelize);

    try {
      assert.deepEqual(Object.keys(models).sort(), ['Wish', 'Wishlist']);
      assert.equal(typeof models.Wishlist.prototype.createWish, 'function');
      assert.equal(typeof models.Wish.prototype.getWishlist, 'function');
    } finally {
      await sequelize.close();
    }
  });

  it('initializeDatabase creates empty tables when seeding is disabled', async () => {
    const sequelize = createSequelize({ storage: ':memory:' });
    const models = defineModels(sequelize);

    try {
      await initializeDatabase({
        sequelize,
        models,
        syncOptions: { force: true },
        seed: false
      });

      assert.equal(await models.Wishlist.count(), 0);
      assert.equal(await models.Wish.count(), 0);
    } finally {
      await sequelize.close();
    }
  });

  it('initializeDatabase seeds the default wishlist once when requested', async () => {
    const sequelize = createSequelize({ storage: ':memory:' });
    const models = defineModels(sequelize);

    try {
      await initializeDatabase({
        sequelize,
        models,
        syncOptions: { force: true },
        seed: true
      });
      await initializeDatabase({ sequelize, models, seed: true });

      const wishlists = await models.Wishlist.findAll({ include: models.Wish });
      assert.equal(wishlists.length, 1);
      assert.equal(wishlists[0].title, 'My Fancy Wishlist');
      assert.equal(wishlists[0].Wishes.length, 1);
      assert.equal(wishlists[0].Wishes[0].title, 'Leberkaassemmeln');
      assert.equal(wishlists[0].Wishes[0].quantity, 3);
    } finally {
      await sequelize.close();
    }
  });

  it('createApp disables the X-Powered-By header and enables permissive CORS', async () => {
    const backend = await makeBackend();
    const app = createApp({ models: backend.models });
    const server = await listen(app);

    const { response } = await request(server.baseUrl, '/wishlist');

    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });

  it('createBackend returns an initialized app, sequelize instance, and models', async () => {
    const backend = await makeBackend();

    assert.equal(typeof backend.app.get, 'function');
    assert.equal(typeof backend.sequelize.authenticate, 'function');
    assert.equal(typeof backend.models.Wishlist.create, 'function');
    assert.equal(typeof backend.models.Wish.create, 'function');
  });
});

describe('wishlist routes', () => {
  let backend;
  let server;

  beforeEach(async () => {
    backend = await makeBackend();
    server = await listen(backend.app);
  });

  it('creates, lists, fetches, updates, and deletes wishlists', async () => {
    let result = await request(server.baseUrl, '/wishlist', {
      method: 'POST',
      body: JSON.stringify({ title: 'Birthday' })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Birthday');
    const wishlistId = result.body.id;

    result = await request(server.baseUrl, '/wishlist');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.length, 1);
    assert.equal(result.body[0].title, 'Birthday');
    assert.deepEqual(result.body[0].Wishes, []);

    result = await request(server.baseUrl, `/wishlist/${wishlistId}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.id, wishlistId);
    assert.deepEqual(result.body.Wishes, []);

    result = await request(server.baseUrl, `/wishlist/${wishlistId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Christmas' })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Christmas');

    result = await request(server.baseUrl, `/wishlist/${wishlistId}`, { method: 'DELETE' });
    assert.equal(result.response.status, 204);
    assert.equal(result.body, null);

    result = await request(server.baseUrl, '/wishlist');
    assert.equal(result.body.length, 0);
  });

  it('returns null for a missing wishlist and 404 when updating one', async () => {
    let result = await request(server.baseUrl, '/wishlist/9999');
    assert.equal(result.response.status, 200);
    assert.equal(result.body, null);

    result = await request(server.baseUrl, '/wishlist/9999', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Missing' })
    });
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wishlist not found' });
  });

  it('deleting a missing wishlist is idempotent', async () => {
    const result = await request(server.baseUrl, '/wishlist/9999', { method: 'DELETE' });

    assert.equal(result.response.status, 204);
    assert.equal(result.body, null);
  });
});

describe('wish routes', () => {
  let backend;
  let server;
  let wishlistId;

  beforeEach(async () => {
    backend = await makeBackend();
    server = await listen(backend.app);
    const result = await request(server.baseUrl, '/wishlist', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hardware' })
    });
    wishlistId = result.body.id;
  });

  it('adds wishes to a wishlist and includes them when fetching the wishlist', async () => {
    const result = await request(server.baseUrl, `/wishlist/${wishlistId}/wish`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Keyboard', quantity: 2 })
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.body.id, wishlistId);
    assert.equal(result.body.Wishes.length, 1);
    assert.equal(result.body.Wishes[0].title, 'Keyboard');
    assert.equal(result.body.Wishes[0].quantity, 2);
  });

  it('returns 404 when adding a wish to a missing wishlist', async () => {
    const result = await request(server.baseUrl, '/wishlist/9999/wish', {
      method: 'POST',
      body: JSON.stringify({ title: 'Keyboard', quantity: 1 })
    });

    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wishlist not found' });
  });

  it('lists, fetches, updates, and deletes wishes', async () => {
    let result = await request(server.baseUrl, `/wishlist/${wishlistId}/wish`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Mouse', quantity: 1 })
    });
    const wishId = result.body.Wishes[0].id;

    result = await request(server.baseUrl, '/wish');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.length, 1);
    assert.equal(result.body[0].title, 'Mouse');

    result = await request(server.baseUrl, `/wish/${wishId}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.id, wishId);
    assert.equal(result.body.quantity, 1);

    result = await request(server.baseUrl, `/wish/${wishId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Ergonomic mouse', quantity: 3 })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Ergonomic mouse');
    assert.equal(result.body.quantity, 3);

    result = await request(server.baseUrl, `/wish/${wishId}`, { method: 'DELETE' });
    assert.equal(result.response.status, 204);
    assert.equal(result.body, null);

    result = await request(server.baseUrl, '/wish');
    assert.equal(result.body.length, 0);
  });

  it('returns null for a missing wish and 404 when updating one', async () => {
    let result = await request(server.baseUrl, '/wish/9999');
    assert.equal(result.response.status, 200);
    assert.equal(result.body, null);

    result = await request(server.baseUrl, '/wish/9999', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Missing', quantity: 1 })
    });
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wish not found' });
  });

  it('deleting a missing wish is idempotent', async () => {
    const result = await request(server.baseUrl, '/wish/9999', { method: 'DELETE' });

    assert.equal(result.response.status, 204);
    assert.equal(result.body, null);
  });
});
