import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApp,
  createBackend,
  createSequelize,
  defineModels,
  initializeDatabase
} from '../app.mjs';

async function withBackend(t, options = {}) {
  const backend = await createBackend({
    storage: ':memory:',
    seed: false,
    syncOptions: { force: true },
    ...options
  });

  const server = await new Promise((resolve) => {
    const started = backend.app.listen(0, () => resolve(started));
  });

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await backend.sequelize.close();
  });

  const { port } = server.address();
  return {
    ...backend,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

test('createSequelize and defineModels configure the SQLite models and associations', async () => {
  const sequelize = createSequelize({ storage: ':memory:' });
  const models = defineModels(sequelize);

  assert.equal(models.Wishlist.tableName, 'Wishlists');
  assert.equal(models.Wish.tableName, 'Wishes');
  assert.ok(models.Wishlist.associations.Wishes);
  assert.ok(models.Wish.associations.Wishlist);

  await sequelize.close();
});

test('initializeDatabase seeds the default wishlist only once', async () => {
  const sequelize = createSequelize({ storage: ':memory:' });
  const models = defineModels(sequelize);

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

  await sequelize.close();
});

test('createBackend can start with an empty in-memory database for tests', async () => {
  const backend = await createBackend({
    storage: ':memory:',
    seed: false,
    syncOptions: { force: true }
  });

  const wishlists = await backend.models.Wishlist.findAll();
  assert.deepEqual(wishlists, []);
  assert.equal(typeof backend.app.listen, 'function');

  await backend.sequelize.close();
});

test('createApp disables the x-powered-by header', async (t) => {
  const backend = await withBackend(t);
  const { response } = await requestJson(backend.baseUrl, '/wishlist');

  assert.equal(response.headers.get('x-powered-by'), null);
});

test('wishlist and wish endpoints support a realistic CRUD flow', async (t) => {
  const { baseUrl } = await withBackend(t);

  let result = await requestJson(baseUrl, '/wishlist');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, []);

  result = await requestJson(baseUrl, '/wishlist', {
    method: 'POST',
    body: JSON.stringify({ title: 'Geburtstag' })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.title, 'Geburtstag');
  assert.ok(result.body.id);
  const wishlistId = result.body.id;

  result = await requestJson(baseUrl, `/wishlist/${wishlistId}/wish`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Kopfhörer', quantity: 2 })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.id, wishlistId);
  assert.equal(result.body.Wishes.length, 1);
  assert.equal(result.body.Wishes[0].title, 'Kopfhörer');
  assert.equal(result.body.Wishes[0].quantity, 2);
  const wishId = result.body.Wishes[0].id;

  result = await requestJson(baseUrl, '/wishlist');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.length, 1);
  assert.equal(result.body[0].Wishes.length, 1);

  result = await requestJson(baseUrl, `/wishlist/${wishlistId}`);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.title, 'Geburtstag');
  assert.equal(result.body.Wishes[0].id, wishId);

  result = await requestJson(baseUrl, '/wish');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.length, 1);
  assert.equal(result.body[0].WishlistId, wishlistId);

  result = await requestJson(baseUrl, `/wish/${wishId}`);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.title, 'Kopfhörer');

  result = await requestJson(baseUrl, `/wishlist/${wishlistId}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Weihnachten' })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.title, 'Weihnachten');

  result = await requestJson(baseUrl, `/wish/${wishId}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Tastatur', quantity: 1 })
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.title, 'Tastatur');
  assert.equal(result.body.quantity, 1);

  result = await requestJson(baseUrl, `/wish/${wishId}`, { method: 'DELETE' });
  assert.equal(result.response.status, 204);
  assert.equal(result.body, null);

  result = await requestJson(baseUrl, '/wish');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, []);

  result = await requestJson(baseUrl, `/wishlist/${wishlistId}`, { method: 'DELETE' });
  assert.equal(result.response.status, 204);

  result = await requestJson(baseUrl, '/wishlist');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, []);
});

test('routes return explicit 404 responses for operations that need an existing record', async (t) => {
  const { baseUrl } = await withBackend(t);

  let result = await requestJson(baseUrl, '/wishlist/999', {
    method: 'PUT',
    body: JSON.stringify({ title: 'Nicht vorhanden' })
  });
  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, { message: 'Wishlist not found' });

  result = await requestJson(baseUrl, '/wishlist/999/wish', {
    method: 'POST',
    body: JSON.stringify({ title: 'Wunsch', quantity: 1 })
  });
  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, { message: 'Wishlist not found' });

  result = await requestJson(baseUrl, '/wish/999', {
    method: 'PUT',
    body: JSON.stringify({ title: 'Nicht vorhanden', quantity: 1 })
  });
  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, { message: 'Wish not found' });
});

test('read endpoints preserve the current null response for missing records', async (t) => {
  const { baseUrl } = await withBackend(t);

  let result = await requestJson(baseUrl, '/wishlist/999');
  assert.equal(result.response.status, 200);
  assert.equal(result.body, null);

  result = await requestJson(baseUrl, '/wish/999');
  assert.equal(result.response.status, 200);
  assert.equal(result.body, null);
});
