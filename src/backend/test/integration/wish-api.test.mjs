import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTestBackend, jsonBody, requestJson } from '../helpers/backend-test-utils.mjs';

describe('wish API', () => {
  it('supports adding, listing, updating and deleting wishes', async () => {
    const { baseUrl } = await createTestBackend();

    const wishlist = await requestJson(baseUrl, '/wishlist', jsonBody('POST', { title: 'Groceries' }));
    const withWish = await requestJson(
      baseUrl,
      `/wishlist/${wishlist.body.id}/wish`,
      jsonBody('POST', { title: 'Apples', quantity: 4 })
    );

    assert.equal(withWish.response.status, 200);
    assert.equal(withWish.body.Wishes.length, 1);
    assert.equal(withWish.body.Wishes[0].title, 'Apples');
    assert.equal(withWish.body.Wishes[0].quantity, 4);

    const wishId = withWish.body.Wishes[0].id;
    const allWishes = await requestJson(baseUrl, '/wish');
    assert.equal(allWishes.response.status, 200);
    assert.equal(allWishes.body.length, 1);

    const fetchedWish = await requestJson(baseUrl, `/wish/${wishId}`);
    assert.equal(fetchedWish.response.status, 200);
    assert.equal(fetchedWish.body.title, 'Apples');

    const updatedWish = await requestJson(
      baseUrl,
      `/wish/${wishId}`,
      jsonBody('PUT', { title: 'Pears', quantity: 7 })
    );
    assert.equal(updatedWish.response.status, 200);
    assert.equal(updatedWish.body.title, 'Pears');
    assert.equal(updatedWish.body.quantity, 7);

    const deleted = await requestJson(baseUrl, `/wish/${wishId}`, { method: 'DELETE' });
    assert.equal(deleted.response.status, 204);

    const afterDelete = await requestJson(baseUrl, `/wish/${wishId}`);
    assert.equal(afterDelete.response.status, 200);
    assert.equal(afterDelete.body, null);
  });

  it('returns a clear 404 response when updating a missing wish', async () => {
    const { baseUrl } = await createTestBackend();

    const result = await requestJson(baseUrl, '/wish/999', jsonBody('PUT', { title: 'Missing', quantity: 1 }));

    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { message: 'Wish not found' });
  });

  it('keeps wishlist and wish associations intact when fetching a wishlist', async () => {
    const { baseUrl } = await createTestBackend();

    const wishlist = await requestJson(baseUrl, '/wishlist', jsonBody('POST', { title: 'Hardware' }));
    await requestJson(baseUrl, `/wishlist/${wishlist.body.id}/wish`, jsonBody('POST', { title: 'Keyboard', quantity: 1 }));
    await requestJson(baseUrl, `/wishlist/${wishlist.body.id}/wish`, jsonBody('POST', { title: 'Mouse', quantity: 2 }));

    const result = await requestJson(baseUrl, `/wishlist/${wishlist.body.id}`);

    assert.equal(result.response.status, 200);
    assert.equal(result.body.Wishes.length, 2);
    assert.deepEqual(
      result.body.Wishes.map(wish => [wish.title, wish.quantity]).sort(),
      [['Keyboard', 1], ['Mouse', 2]]
    );
  });
});
