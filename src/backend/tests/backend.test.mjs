import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import {
  createBackend,
  createSequelize,
  defineModels,
  initializeDatabase,
} from '../app.mjs';

let app, sequelize, models;

beforeEach(async () => {
  ({ app, sequelize, models } = await createBackend({
    storage: ':memory:',
    syncOptions: { force: true },
    seed: false,
  }));
});

afterEach(async () => {
  await sequelize.close();
});

// ── createSequelize ───────────────────────────────────────────────────────────

describe('createSequelize', () => {
  it('returns a Sequelize instance', () => {
    const seq = createSequelize({ storage: ':memory:' });
    expect(typeof seq.authenticate).toBe('function');
    expect(typeof seq.sync).toBe('function');
  });

  it('defaults to in-memory when storage is :memory:', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    await expect(seq.authenticate()).resolves.toBeUndefined();
    await seq.close();
  });
});

// ── defineModels ──────────────────────────────────────────────────────────────

describe('defineModels', () => {
  it('returns Wishlist and Wish model constructors', () => {
    const seq = createSequelize({ storage: ':memory:' });
    const { Wishlist, Wish } = defineModels(seq);
    expect(typeof Wishlist.findAll).toBe('function');
    expect(typeof Wish.findAll).toBe('function');
  });

  it('Wish belongs to Wishlist (foreign key association)', () => {
    const seq = createSequelize({ storage: ':memory:' });
    const { Wish } = defineModels(seq);
    expect(Wish.associations).toHaveProperty('Wishlist');
  });

  it('Wishlist has many Wishes', () => {
    const seq = createSequelize({ storage: ':memory:' });
    const { Wishlist } = defineModels(seq);
    expect(Wishlist.associations).toHaveProperty('Wishes');
  });
});

// ── initializeDatabase ────────────────────────────────────────────────────────

describe('initializeDatabase', () => {
  it('seeds a default wishlist when db is empty and seed=true', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: true });
    const lists = await m.Wishlist.findAll();
    expect(lists.length).toBeGreaterThan(0);
    await seq.close();
  });

  it('seeds a default wish together with the wishlist', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: true });
    const wishes = await m.Wish.findAll();
    expect(wishes.length).toBeGreaterThan(0);
    await seq.close();
  });

  it('does not seed when seed=false', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: false });
    const lists = await m.Wishlist.findAll();
    expect(lists).toHaveLength(0);
    await seq.close();
  });

  it('does not add a second seed if data already exists', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: true });
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: false }, seed: true });
    const lists = await m.Wishlist.findAll();
    expect(lists).toHaveLength(1);
    await seq.close();
  });
});

// ── POST /wishlist ────────────────────────────────────────────────────────────

describe('POST /wishlist', () => {
  it('creates a wishlist and returns it with an id', async () => {
    const res = await request(app).post('/wishlist').send({ title: 'Birthday' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Birthday');
    expect(res.body.id).toBeDefined();
  });

  it('persists the wishlist so it appears in GET /wishlist', async () => {
    await request(app).post('/wishlist').send({ title: 'Persist Test' });
    const res = await request(app).get('/wishlist');
    expect(res.body.some(wl => wl.title === 'Persist Test')).toBe(true);
  });

  it('creates multiple independent wishlists', async () => {
    await request(app).post('/wishlist').send({ title: 'A' });
    await request(app).post('/wishlist').send({ title: 'B' });
    const res = await request(app).get('/wishlist');
    expect(res.body).toHaveLength(2);
  });
});

// ── GET /wishlist ─────────────────────────────────────────────────────────────

describe('GET /wishlist', () => {
  it('returns an empty array when no wishlists exist', async () => {
    const res = await request(app).get('/wishlist');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('includes the Wishes array for each wishlist', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'With Wishes' });
    await request(app)
      .post(`/wishlist/${list.body.id}/wish`)
      .send({ title: 'Item', quantity: 1 });

    const res = await request(app).get('/wishlist');
    expect(res.body[0]).toHaveProperty('Wishes');
    expect(res.body[0].Wishes).toHaveLength(1);
  });
});

// ── GET /wishlist/:id ─────────────────────────────────────────────────────────

describe('GET /wishlist/:id', () => {
  it('returns the wishlist with its wishes', async () => {
    const created = await request(app).post('/wishlist').send({ title: 'Single' });
    const id = created.body.id;
    const res = await request(app).get(`/wishlist/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body).toHaveProperty('Wishes');
  });

  it('returns null for a non-existent id', async () => {
    const res = await request(app).get('/wishlist/9999');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── PUT /wishlist/:id ─────────────────────────────────────────────────────────

describe('PUT /wishlist/:id', () => {
  it('updates the title', async () => {
    const created = await request(app).post('/wishlist').send({ title: 'Old' });
    const id = created.body.id;
    const res = await request(app).put(`/wishlist/${id}`).send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('persists the update', async () => {
    const created = await request(app).post('/wishlist').send({ title: 'Before' });
    const id = created.body.id;
    await request(app).put(`/wishlist/${id}`).send({ title: 'After' });
    const res = await request(app).get(`/wishlist/${id}`);
    expect(res.body.title).toBe('After');
  });

  it('returns 404 for a non-existent wishlist', async () => {
    const res = await request(app).put('/wishlist/9999').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── DELETE /wishlist/:id ──────────────────────────────────────────────────────

describe('DELETE /wishlist/:id', () => {
  it('returns 204 and removes the wishlist', async () => {
    const created = await request(app).post('/wishlist').send({ title: 'Gone' });
    const id = created.body.id;
    const del = await request(app).delete(`/wishlist/${id}`);
    expect(del.status).toBe(204);
    const check = await request(app).get(`/wishlist/${id}`);
    expect(check.body).toBeNull();
  });

  it('returns 204 even for a non-existent id (idempotent)', async () => {
    const res = await request(app).delete('/wishlist/9999');
    expect(res.status).toBe(204);
  });
});

// ── POST /wishlist/:id/wish ───────────────────────────────────────────────────

describe('POST /wishlist/:id/wish', () => {
  it('adds a wish to the wishlist', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'My List' });
    const id = list.body.id;
    const res = await request(app)
      .post(`/wishlist/${id}/wish`)
      .send({ title: 'Bike', quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.Wishes).toHaveLength(1);
    expect(res.body.Wishes[0].title).toBe('Bike');
    expect(res.body.Wishes[0].quantity).toBe(1);
  });

  it('accumulates multiple wishes', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'Multi' });
    const id = list.body.id;
    await request(app).post(`/wishlist/${id}/wish`).send({ title: 'A', quantity: 1 });
    const res = await request(app)
      .post(`/wishlist/${id}/wish`)
      .send({ title: 'B', quantity: 2 });
    expect(res.body.Wishes).toHaveLength(2);
  });

  it('returns 404 when the wishlist does not exist', async () => {
    const res = await request(app)
      .post('/wishlist/9999/wish')
      .send({ title: 'Ghost', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── GET /wish ─────────────────────────────────────────────────────────────────

describe('GET /wish', () => {
  it('returns an empty array when no wishes exist', async () => {
    const res = await request(app).get('/wish');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all wishes across all wishlists', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'L' });
    const id = list.body.id;
    await request(app).post(`/wishlist/${id}/wish`).send({ title: 'W1', quantity: 1 });
    await request(app).post(`/wishlist/${id}/wish`).send({ title: 'W2', quantity: 2 });
    const res = await request(app).get('/wish');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ── GET /wish/:id ─────────────────────────────────────────────────────────────

describe('GET /wish/:id', () => {
  it('returns a specific wish by id', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'L' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Guitar', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    const res = await request(app).get(`/wish/${wishId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Guitar');
    expect(res.body.quantity).toBe(1);
  });

  it('returns null for a non-existent wish id', async () => {
    const res = await request(app).get('/wish/9999');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── PUT /wish/:id ─────────────────────────────────────────────────────────────

describe('PUT /wish/:id', () => {
  it('updates title and quantity', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'L' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Old', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    const res = await request(app)
      .put(`/wish/${wishId}`)
      .send({ title: 'New', quantity: 99 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.quantity).toBe(99);
  });

  it('persists the update', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'L' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Before', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    await request(app).put(`/wish/${wishId}`).send({ title: 'After', quantity: 5 });
    const res = await request(app).get(`/wish/${wishId}`);
    expect(res.body.title).toBe('After');
    expect(res.body.quantity).toBe(5);
  });

  it('returns 404 for a non-existent wish', async () => {
    const res = await request(app).put('/wish/9999').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wish not found');
  });
});

// ── DELETE /wish/:id ──────────────────────────────────────────────────────────

describe('DELETE /wish/:id', () => {
  it('deletes the wish and returns 204', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'L' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Delete Me', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    const del = await request(app).delete(`/wish/${wishId}`);
    expect(del.status).toBe(204);
    const check = await request(app).get(`/wish/${wishId}`);
    expect(check.body).toBeNull();
  });

  it('returns 204 even for a non-existent wish (idempotent)', async () => {
    const res = await request(app).delete('/wish/9999');
    expect(res.status).toBe(204);
  });

  it('does not delete the parent wishlist when a wish is deleted', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'Parent' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Child', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    await request(app).delete(`/wish/${wishId}`);
    const check = await request(app).get(`/wishlist/${listId}`);
    expect(check.body).not.toBeNull();
    expect(check.body.Wishes).toHaveLength(0);
  });
});
