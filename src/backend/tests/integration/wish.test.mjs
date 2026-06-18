/**
 * Integration tests for /wish endpoints.
 * Uses a real in-memory SQLite database.
 * Focuses on wish lifecycle: creation through a wishlist, retrieval,
 * update persistence, and deletion without affecting siblings or parent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createBackend } from '../../app.mjs';

let app, sequelize;

// Helper: create a wishlist and return its id
async function createList(title = 'Test List') {
  const res = await request(app).post('/wishlist').send({ title });
  return res.body.id;
}

// Helper: add a wish to a list and return the wish object
async function addWish(listId, title = 'Test Wish', quantity = 1) {
  const res = await request(app)
    .post(`/wishlist/${listId}/wish`)
    .send({ title, quantity });
  return res.body.Wishes.at(-1);
}

beforeEach(async () => {
  ({ app, sequelize } = await createBackend({
    storage: ':memory:',
    syncOptions: { force: true },
    seed: false,
  }));
});

afterEach(async () => {
  await sequelize.close();
});

// ── GET /wish ─────────────────────────────────────────────────────────────────

describe('GET /wish – all wishes', () => {
  it('returns wishes from multiple wishlists in one flat list', async () => {
    const idA = await createList('A');
    const idB = await createList('B');
    await addWish(idA, 'Apple');
    await addWish(idB, 'Banana');

    const res = await request(app).get('/wish');
    expect(res.body).toHaveLength(2);
    const titles = res.body.map(w => w.title);
    expect(titles).toContain('Apple');
    expect(titles).toContain('Banana');
  });

  it('does not include wishlist details in the flat wish list', async () => {
    const id = await createList();
    await addWish(id, 'Solo');

    const res = await request(app).get('/wish');
    expect(res.body[0]).not.toHaveProperty('Wishes');
  });
});

// ── GET /wish/:id ─────────────────────────────────────────────────────────────

describe('GET /wish/:id – single wish', () => {
  it('returns the correct wish by id', async () => {
    const id = await createList();
    const wish = await addWish(id, 'Guitar', 2);

    const res = await request(app).get(`/wish/${wish.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Guitar');
    expect(res.body.quantity).toBe(2);
  });

  it('returns null for an id that does not exist', async () => {
    const res = await request(app).get('/wish/99999');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── PUT /wish/:id ─────────────────────────────────────────────────────────────

describe('PUT /wish/:id – update', () => {
  it('persists both title and quantity changes', async () => {
    const id = await createList();
    const wish = await addWish(id, 'Before', 1);

    await request(app).put(`/wish/${wish.id}`).send({ title: 'After', quantity: 7 });

    const res = await request(app).get(`/wish/${wish.id}`);
    expect(res.body.title).toBe('After');
    expect(res.body.quantity).toBe(7);
  });

  it('updating one wish does not affect sibling wishes', async () => {
    const id = await createList();
    const wishA = await addWish(id, 'Sibling A', 1);
    const wishB = await addWish(id, 'Sibling B', 1);

    await request(app).put(`/wish/${wishA.id}`).send({ title: 'Updated A', quantity: 99 });

    const res = await request(app).get(`/wish/${wishB.id}`);
    expect(res.body.title).toBe('Sibling B');
    expect(res.body.quantity).toBe(1);
  });

  it('returns 404 for a non-existent wish id', async () => {
    const res = await request(app).put('/wish/99999').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wish not found');
  });
});

// ── DELETE /wish/:id ──────────────────────────────────────────────────────────

describe('DELETE /wish/:id – removal', () => {
  it('removes the wish from the flat list after deletion', async () => {
    const id = await createList();
    const wish = await addWish(id, 'Temporary');

    await request(app).delete(`/wish/${wish.id}`);

    const res = await request(app).get('/wish');
    expect(res.body).toHaveLength(0);
  });

  it('deleting a wish does not delete the parent wishlist', async () => {
    const listId = await createList('Parent');
    const wish = await addWish(listId, 'Child');

    await request(app).delete(`/wish/${wish.id}`);

    const res = await request(app).get(`/wishlist/${listId}`);
    expect(res.body).not.toBeNull();
    expect(res.body.title).toBe('Parent');
  });

  it('deleting one wish leaves sibling wishes intact', async () => {
    const id = await createList();
    const w1 = await addWish(id, 'Keep Me');
    const w2 = await addWish(id, 'Delete Me');

    await request(app).delete(`/wish/${w2.id}`);

    const res = await request(app).get('/wish');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(w1.id);
  });

  it('is idempotent: deleting a non-existent id returns 204', async () => {
    const res = await request(app).delete('/wish/99999');
    expect(res.status).toBe(204);
  });
});
