import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTestBackend, jsonBody, requestJson } from '../helpers/backend-test-utils.mjs';

describe('wishlist API', () => {
  it('supports the full wishlist lifecycle', async () => {
    const { baseUrl } = await createTestBackend();

    const created = await requestJson(baseUrl, '/wishlist', jsonBody('POST', { title: 'Birthday' }));
    assert.equal(created.response.status, 200);
    assert.equal(created.body.title, 'Birthday');
    assert.ok(created.body.id);

    const list = await requestJson(baseUrl, '/wishlist');
    assert.equal(list.response.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].title, 'Birthday');
    assert.deepEqual(list.body[0].Wishes, []);

    const fetched = await requestJson(baseUrl, `/wishlist/${created.body.id}`);
    assert.equal(fetched.response.status, 200);
    assert.equal(fetched.body.id, created.body.id);

    const updated = await requestJson(
      baseUrl,
      `/wishlist/${created.body.id}`,
      jsonBody('PUT', { title: 'Christmas' })
    );
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.title, 'Christmas');

    const deleted = await requestJson(baseUrl, `/wishlist/${created.body.id}`, { method: 'DELETE' });
    assert.equal(deleted.response.status, 204);
    assert.equal(deleted.body, null);

    const afterDelete = await requestJson(baseUrl, `/wishlist/${created.body.id}`);
    assert.equal(afterDelete.response.status, 200);
    assert.equal(afterDelete.body, null);
  });

  it('returns a clear 404 response when updating a missing wishlist', async () => {
    const { baseUrl } = await createTestBackend();

    const result = await requestJson(baseUrl, '/wishlist/999', jsonBody('PUT', { title: 'Missing' }));

    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wishlist not found' });
  });

  it('returns a clear 404 response when adding a wish to a missing wishlist', async () => {
    const { baseUrl } = await createTestBackend();

    const result = await requestJson(
      baseUrl,
      '/wishlist/999/wish',
      jsonBody('POST', { title: 'Socks', quantity: 2 })
    );

    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wishlist not found' });
  });

  it('rejects malformed JSON before route handlers execute', async () => {
    const { baseUrl } = await createTestBackend();

    const response = await fetch(`${baseUrl}/wishlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title":'
    });

    assert.equal(response.status, 400);
  });

  it('disables Express fingerprinting and allows cross-origin browser clients', async () => {
    const { baseUrl } = await createTestBackend();

    const response = await fetch(`${baseUrl}/wishlist`);

    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });
});
