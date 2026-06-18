import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './helpers.mjs';

test('wishlist endpoints support create, list, read, update and delete', async () => {
  const backend = await createTestServer();

  try {
    let result = await backend.request('/wishlist', {
      method: 'POST',
      body: { title: 'Christmas' }
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Christmas');
    const wishlistId = result.body.id;

    result = await backend.request('/wishlist');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.length, 1);
    assert.deepEqual(result.body[0].Wishes, []);

    result = await backend.request(`/wishlist/${wishlistId}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.id, wishlistId);

    result = await backend.request(`/wishlist/${wishlistId}`, {
      method: 'PUT',
      body: { title: 'Updated Christmas' }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Updated Christmas');

    result = await backend.request(`/wishlist/${wishlistId}`, { method: 'DELETE' });
    assert.equal(result.response.status, 204);
    assert.equal(result.body, null);

    result = await backend.request('/wishlist');
    assert.equal(result.body.length, 0);
  } finally {
    await backend.close();
  }
});

test('wish endpoints support nested creation and direct CRUD operations', async () => {
  const backend = await createTestServer();

  try {
    const createdWishlist = await backend.request('/wishlist', {
      method: 'POST',
      body: { title: 'Food' }
    });
    const wishlistId = createdWishlist.body.id;

    let result = await backend.request(`/wishlist/${wishlistId}/wish`, {
      method: 'POST',
      body: { title: 'Cookies', quantity: 4 }
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.body.Wishes.length, 1);
    assert.equal(result.body.Wishes[0].title, 'Cookies');
    assert.equal(result.body.Wishes[0].quantity, 4);
    const wishId = result.body.Wishes[0].id;

    result = await backend.request('/wish');
    assert.equal(result.body.length, 1);
    assert.equal(result.body[0].WishlistId, wishlistId);

    result = await backend.request(`/wish/${wishId}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Cookies');

    result = await backend.request(`/wish/${wishId}`, {
      method: 'PUT',
      body: { title: 'Gingerbread', quantity: 8 }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Gingerbread');
    assert.equal(result.body.quantity, 8);

    result = await backend.request(`/wish/${wishId}`, { method: 'DELETE' });
    assert.equal(result.response.status, 204);

    result = await backend.request('/wish');
    assert.equal(result.body.length, 0);
  } finally {
    await backend.close();
  }
});

test('mutating missing resources returns not found for update and nested create', async () => {
  const backend = await createTestServer();

  try {
    let result = await backend.request('/wishlist/999', {
      method: 'PUT',
      body: { title: 'Missing' }
    });
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wishlist not found' });

    result = await backend.request('/wishlist/999/wish', {
      method: 'POST',
      body: { title: 'Missing', quantity: 1 }
    });
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wishlist not found' });

    result = await backend.request('/wish/999', {
      method: 'PUT',
      body: { title: 'Missing', quantity: 1 }
    });
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wish not found' });
  } finally {
    await backend.close();
  }
});

test('read operations for missing resources return null with success status', async () => {
  const backend = await createTestServer();

  try {
    let result = await backend.request('/wishlist/12345');
    assert.equal(result.response.status, 200);
    assert.equal(result.body, null);

    result = await backend.request('/wish/12345');
    assert.equal(result.response.status, 200);
    assert.equal(result.body, null);
  } finally {
    await backend.close();
  }
});

test('API sends JSON responses without x-powered-by and allows CORS', async () => {
  const backend = await createTestServer();

  try {
    const result = await backend.request('/wishlist');

    assert.equal(result.response.status, 200);
    assert.match(result.response.headers.get('content-type'), /application\/json/);
    assert.equal(result.response.headers.get('x-powered-by'), null);
    assert.equal(result.response.headers.get('access-control-allow-origin'), '*');
  } finally {
    await backend.close();
  }
});

