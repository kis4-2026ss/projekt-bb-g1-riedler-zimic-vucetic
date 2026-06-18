/**
 * Shared database helpers for unit and integration tests.
 * Always uses an isolated in-memory SQLite instance so tests are hermetic.
 */
import { createBackend } from '../../app.mjs';

/**
 * Creates a fresh in-memory backend (app + sequelize + models).
 * Call teardown() in afterEach to close the connection.
 */
export async function setupTestDb(options = {}) {
  const ctx = await createBackend({
    storage: ':memory:',
    syncOptions: { force: true },
    seed: false,
    ...options,
  });

  return {
    app: ctx.app,
    sequelize: ctx.sequelize,
    models: ctx.models,
    teardown: () => ctx.sequelize.close(),
  };
}

/** Creates a wishlist via the HTTP API and returns the response body. */
export const createList = (agent, title = 'Test List') =>
  agent.post('/wishlist').send({ title }).then(r => r.body);

/** Creates a wish on a wishlist and returns the new wish object. */
export const addWish = (agent, listId, title = 'Test Wish', quantity = 1) =>
  agent.post(`/wishlist/${listId}/wish`).send({ title, quantity })
    .then(r => r.body.Wishes.at(-1));
