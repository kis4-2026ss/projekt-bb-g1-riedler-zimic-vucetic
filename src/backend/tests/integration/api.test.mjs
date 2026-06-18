/**
 * Integration tests – all API endpoints with a real in-memory SQLite database.
 * Tests verify end-to-end behaviour of the HTTP layer together with Sequelize
 * and SQLite: persistence, associations, cascades, and edge cases.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createBackend } from '../../app.mjs';

let app, sequelize;

// ── Helpers ───────────────────────────────────────────────────────────────────

const createList = (title = 'List') =>
  request(app).post('/wishlist').send({ title }).then(r => r.body);

const addWish = (listId, title = 'Wish', quantity = 1) =>
  request(app).post(`/wishlist/${listId}/wish`).send({ title, quantity })
    .then(r => r.body.Wishes.at(-1));

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeEach(async () => {
  ({ app, sequelize } = await createBackend({
    storage: ':memory:',
    syncOptions: { force: true },
    seed: false,
  }));
});

afterEach(() => sequelize.close());

// ── Wishlist CRUD ─────────────────────────────────────────────────────────────

describe('POST /wishlist', () => {
  it('creates and returns a wishlist with a unique id', async () => {
    const r1 = await createList('A');
    const r2 = await createList('B');
    expect(r1.id).toBeDefined();
    expect(r1.id).not.toBe(r2.id);
  });

  it('stores the title as provided', async () => {
    const wl = await createList('My List');
    const res = await request(app).get(`/wishlist/${wl.id}`);
    expect(res.body.title).toBe('My List');
  });
});

describe('GET /wishlist', () => {
  it('returns an empty array when no wishlists exist', async () => {
    const res = await request(app).get('/wishlist');
    expect(res.body).toEqual([]);
  });

  it('includes a Wishes array with each wishlist', async () => {
    const wl = await createList();
    await addWish(wl.id, 'Item');
    const res = await request(app).get('/wishlist');
    expect(res.body[0].Wishes).toHaveLength(1);
    expect(res.body[0].Wishes[0].title).toBe('Item');
  });
});

describe('GET /wishlist/:id', () => {
  it('returns null for an unknown id', async () => {
    const res = await request(app).get('/wishlist/9999');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns only the targeted wishlist, not its siblings', async () => {
    const wl1 = await createList('One');
    await createList('Two');
    const res = await request(app).get(`/wishlist/${wl1.id}`);
    expect(res.body.title).toBe('One');
  });
});

describe('PUT /wishlist/:id', () => {
  it('persists a title change without affecting associated wishes', async () => {
    const wl = await createList('Before');
    await addWish(wl.id, 'Keep Me');
    await request(app).put(`/wishlist/${wl.id}`).send({ title: 'After' });
    const res = await request(app).get(`/wishlist/${wl.id}`);
    expect(res.body.title).toBe('After');
    expect(res.body.Wishes).toHaveLength(1);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await request(app).put('/wishlist/0').send({ title: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /wishlist/:id', () => {
  it('removes the targeted list and leaves sibling lists intact', async () => {
    const wl1 = await createList('Keep');
    const wl2 = await createList('Delete');
    await request(app).delete(`/wishlist/${wl2.id}`);
    const res = await request(app).get('/wishlist');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(wl1.id);
  });

  it('is idempotent – deleting a non-existent id returns 204', async () => {
    const res = await request(app).delete('/wishlist/9999');
    expect(res.status).toBe(204);
  });
});

// ── Wish CRUD ─────────────────────────────────────────────────────────────────

describe('POST /wishlist/:id/wish', () => {
  it('attaches the wish to the correct wishlist', async () => {
    const wl = await createList();
    const wish = await addWish(wl.id, 'Guitar', 2);
    expect(wish.title).toBe('Guitar');
    expect(wish.quantity).toBe(2);
  });

  it('returns 404 for a non-existent parent wishlist', async () => {
    const res = await request(app)
      .post('/wishlist/0/wish').send({ title: 'Ghost', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });

  it('accumulates multiple wishes correctly', async () => {
    const wl = await createList();
    await addWish(wl.id, 'A');
    await addWish(wl.id, 'B');
    const res = await request(app).get(`/wishlist/${wl.id}`);
    expect(res.body.Wishes).toHaveLength(2);
  });
});

describe('GET /wish', () => {
  it('aggregates wishes from multiple wishlists into a flat list', async () => {
    const wl1 = await createList('L1');
    const wl2 = await createList('L2');
    await addWish(wl1.id, 'Alpha');
    await addWish(wl2.id, 'Beta');
    const res = await request(app).get('/wish');
    expect(res.body).toHaveLength(2);
    expect(res.body.map(w => w.title)).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
  });
});

describe('GET /wish/:id', () => {
  it('returns the wish with correct title and quantity', async () => {
    const wl   = await createList();
    const wish = await addWish(wl.id, 'Piano', 3);
    const res  = await request(app).get(`/wish/${wish.id}`);
    expect(res.body.title).toBe('Piano');
    expect(res.body.quantity).toBe(3);
  });

  it('returns null for an unknown id', async () => {
    const res = await request(app).get('/wish/9999');
    expect(res.body).toBeNull();
  });
});

describe('PUT /wish/:id', () => {
  it('persists both title and quantity changes', async () => {
    const wl   = await createList();
    const wish = await addWish(wl.id, 'Old', 1);
    await request(app).put(`/wish/${wish.id}`).send({ title: 'New', quantity: 10 });
    const res  = await request(app).get(`/wish/${wish.id}`);
    expect(res.body.title).toBe('New');
    expect(res.body.quantity).toBe(10);
  });

  it('updating one wish does not affect its sibling', async () => {
    const wl = await createList();
    const w1 = await addWish(wl.id, 'Sibling A', 1);
    const w2 = await addWish(wl.id, 'Sibling B', 1);
    await request(app).put(`/wish/${w1.id}`).send({ title: 'Changed', quantity: 99 });
    const res = await request(app).get(`/wish/${w2.id}`);
    expect(res.body.title).toBe('Sibling B');
  });

  it('returns 404 for a non-existent wish', async () => {
    const res = await request(app).put('/wish/9999').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /wish/:id', () => {
  it('removes the wish and leaves the parent wishlist intact', async () => {
    const wl   = await createList('Parent');
    const wish = await addWish(wl.id, 'Child');
    await request(app).delete(`/wish/${wish.id}`);
    const res = await request(app).get(`/wishlist/${wl.id}`);
    expect(res.body.title).toBe('Parent');
    expect(res.body.Wishes).toHaveLength(0);
  });

  it('deleting one wish leaves sibling wishes intact', async () => {
    const wl = await createList();
    const w1 = await addWish(wl.id, 'Keep');
    const w2 = await addWish(wl.id, 'Remove');
    await request(app).delete(`/wish/${w2.id}`);
    const res = await request(app).get('/wish');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(w1.id);
  });
});
