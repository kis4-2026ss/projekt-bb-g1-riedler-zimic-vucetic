import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createBackend, createSequelize, defineModels, initializeDatabase } from '../app.mjs';

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

// ---------------------------------------------------------------------------
// Unit: createSequelize
// ---------------------------------------------------------------------------
describe('createSequelize', () => {
  it('returns a Sequelize instance with in-memory storage', () => {
    const seq = createSequelize({ storage: ':memory:' });
    expect(seq).toBeDefined();
    expect(typeof seq.authenticate).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Unit: defineModels
// ---------------------------------------------------------------------------
describe('defineModels', () => {
  it('returns Wishlist and Wish models', () => {
    const seq = createSequelize({ storage: ':memory:' });
    const { Wishlist, Wish } = defineModels(seq);
    expect(Wishlist).toBeDefined();
    expect(Wish).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Unit: initializeDatabase – seeding
// ---------------------------------------------------------------------------
describe('initializeDatabase', () => {
  it('seeds a default wishlist when seed=true and db is empty', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: true });
    const lists = await m.Wishlist.findAll();
    expect(lists.length).toBeGreaterThan(0);
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
});

// ---------------------------------------------------------------------------
// Integration: Wishlist CRUD
// ---------------------------------------------------------------------------
describe('POST /wishlist', () => {
  it('creates a wishlist and returns it', async () => {
    const res = await request(app).post('/wishlist').send({ title: 'Birthday' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Birthday');
    expect(res.body.id).toBeDefined();
  });
});

describe('GET /wishlist', () => {
  it('returns an empty array when no wishlists exist', async () => {
    const res = await request(app).get('/wishlist');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all wishlists with their wishes', async () => {
    await request(app).post('/wishlist').send({ title: 'List A' });
    await request(app).post('/wishlist').send({ title: 'List B' });
    const res = await request(app).get('/wishlist');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('Wishes');
  });
});

describe('GET /wishlist/:id', () => {
  it('returns the wishlist with wishes for a valid id', async () => {
    const created = await request(app).post('/wishlist').send({ title: 'My List' });
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

describe('PUT /wishlist/:id', () => {
  it('updates the title of an existing wishlist', async () => {
    const created = await request(app).post('/wishlist').send({ title: 'Old Title' });
    const id = created.body.id;
    const res = await request(app).put(`/wishlist/${id}`).send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  it('returns 404 for a non-existent wishlist', async () => {
    const res = await request(app).put('/wishlist/9999').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

describe('DELETE /wishlist/:id', () => {
  it('deletes an existing wishlist and returns 204', async () => {
    const created = await request(app).post('/wishlist').send({ title: 'To Delete' });
    const id = created.body.id;
    const res = await request(app).delete(`/wishlist/${id}`);
    expect(res.status).toBe(204);
    const check = await request(app).get(`/wishlist/${id}`);
    expect(check.body).toBeNull();
  });

  it('returns 204 even for a non-existent id (idempotent)', async () => {
    const res = await request(app).delete('/wishlist/9999');
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// Integration: Wish CRUD
// ---------------------------------------------------------------------------
describe('POST /wishlist/:id/wish', () => {
  it('adds a wish to an existing wishlist', async () => {
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

  it('returns 404 when adding a wish to a non-existent wishlist', async () => {
    const res = await request(app)
      .post('/wishlist/9999/wish')
      .send({ title: 'Ghost', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

describe('GET /wish', () => {
  it('returns an empty array when no wishes exist', async () => {
    const res = await request(app).get('/wish');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all wishes', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'List' });
    const id = list.body.id;
    await request(app).post(`/wishlist/${id}/wish`).send({ title: 'Book', quantity: 2 });
    await request(app).post(`/wishlist/${id}/wish`).send({ title: 'Pen', quantity: 5 });
    const res = await request(app).get('/wish');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /wish/:id', () => {
  it('returns a specific wish by id', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'List' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Guitar', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    const res = await request(app).get(`/wish/${wishId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Guitar');
  });

  it('returns null for a non-existent wish id', async () => {
    const res = await request(app).get('/wish/9999');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('PUT /wish/:id', () => {
  it('updates title and quantity of an existing wish', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'List' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Old Wish', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    const res = await request(app)
      .put(`/wish/${wishId}`)
      .send({ title: 'New Wish', quantity: 10 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Wish');
    expect(res.body.quantity).toBe(10);
  });

  it('returns 404 for a non-existent wish', async () => {
    const res = await request(app).put('/wish/9999').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wish not found');
  });
});

describe('DELETE /wish/:id', () => {
  it('deletes an existing wish and returns 204', async () => {
    const list = await request(app).post('/wishlist').send({ title: 'List' });
    const listId = list.body.id;
    const wishRes = await request(app)
      .post(`/wishlist/${listId}/wish`)
      .send({ title: 'Delete Me', quantity: 1 });
    const wishId = wishRes.body.Wishes[0].id;
    const res = await request(app).delete(`/wish/${wishId}`);
    expect(res.status).toBe(204);
    const check = await request(app).get(`/wish/${wishId}`);
    expect(check.body).toBeNull();
  });

  it('returns 204 even for a non-existent wish id (idempotent)', async () => {
    const res = await request(app).delete('/wish/9999');
    expect(res.status).toBe(204);
  });
});
