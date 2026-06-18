import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTestBackend, jsonBody, requestJson } from '../helpers/backend-test-utils.mjs';

describe('end-to-end backend workflow', () => {
  it('covers the user workflow used by the static frontend', async () => {
    const { baseUrl } = await createTestBackend();

    const initial = await requestJson(baseUrl, '/wishlist');
    assert.equal(initial.response.status, 200);
    assert.deepEqual(initial.body, []);

    const created = await requestJson(baseUrl, '/wishlist', jsonBody('POST', { title: 'Frontend Flow' }));
    const wishlistId = created.body.id;

    await requestJson(baseUrl, `/wishlist/${wishlistId}/wish`, jsonBody('POST', { title: 'Candles', quantity: 3 }));
    await requestJson(baseUrl, `/wishlist/${wishlistId}/wish`, jsonBody('POST', { title: 'Tea', quantity: 1 }));

    const details = await requestJson(baseUrl, `/wishlist/${wishlistId}`);
    assert.equal(details.body.title, 'Frontend Flow');
    assert.equal(details.body.Wishes.length, 2);

    const tea = details.body.Wishes.find(wish => wish.title === 'Tea');
    await requestJson(baseUrl, `/wish/${tea.id}`, jsonBody('PUT', { title: 'Green Tea', quantity: 2 }));

    const refreshed = await requestJson(baseUrl, '/wishlist');
    assert.equal(refreshed.body.length, 1);
    assert.deepEqual(
      refreshed.body[0].Wishes.map(wish => [wish.title, wish.quantity]).sort(),
      [['Candles', 3], ['Green Tea', 2]]
    );

    await requestJson(baseUrl, `/wishlist/${wishlistId}`, { method: 'DELETE' });
    const finalState = await requestJson(baseUrl, '/wishlist');
    assert.deepEqual(finalState.body, []);
  });
});
