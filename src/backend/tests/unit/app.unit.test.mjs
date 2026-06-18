/**
 * Unit tests for app.mjs.
 * Database interactions are replaced with vi.fn() stubs so each test
 * verifies a single unit of logic in complete isolation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import {
  createSequelize,
  defineModels,
  initializeDatabase,
  createApp,
} from '../../app.mjs';

// ── createSequelize ───────────────────────────────────────────────────────────

describe('createSequelize', () => {
  it('returns a Sequelize instance with authenticate and sync methods', () => {
    const seq = createSequelize({ storage: ':memory:' });
    expect(typeof seq.authenticate).toBe('function');
    expect(typeof seq.sync).toBe('function');
  });

  it('connects successfully to an in-memory SQLite database', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    await expect(seq.authenticate()).resolves.toBeUndefined();
    await seq.close();
  });
});

// ── defineModels ──────────────────────────────────────────────────────────────

describe('defineModels', () => {
  it('exposes findAll and findOne on both Wishlist and Wish', () => {
    const seq = createSequelize({ storage: ':memory:' });
    const { Wishlist, Wish } = defineModels(seq);
    ['findAll', 'findOne', 'create', 'destroy'].forEach(m => {
      expect(typeof Wishlist[m]).toBe('function');
      expect(typeof Wish[m]).toBe('function');
    });
  });

  it('sets up a BelongsTo association on Wish → Wishlist', () => {
    const seq = createSequelize({ storage: ':memory:' });
    const { Wish } = defineModels(seq);
    expect(Wish.associations).toHaveProperty('Wishlist');
  });

  it('sets up a HasMany association on Wishlist → Wishes', () => {
    const seq = createSequelize({ storage: ':memory:' });
    const { Wishlist } = defineModels(seq);
    expect(Wishlist.associations).toHaveProperty('Wishes');
  });
});

// ── initializeDatabase ────────────────────────────────────────────────────────

describe('initializeDatabase', () => {
  it('creates a seeded wishlist and wish when the DB is empty and seed=true', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m   = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: true });
    expect(await m.Wishlist.count()).toBe(1);
    expect(await m.Wish.count()).toBe(1);
    await seq.close();
  });

  it('skips seeding when seed=false', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m   = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: false });
    expect(await m.Wishlist.count()).toBe(0);
    await seq.close();
  });

  it('does not add a second seed if data already exists (idempotent)', async () => {
    const seq = createSequelize({ storage: ':memory:' });
    const m   = defineModels(seq);
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: true }, seed: true });
    await initializeDatabase({ sequelize: seq, models: m, syncOptions: { force: false }, seed: true });
    expect(await m.Wishlist.count()).toBe(1);
    await seq.close();
  });
});

// ── Route handler unit tests (mocked Sequelize models) ────────────────────────

function buildMocks() {
  const inst = (extra = {}) => ({
    id: 1, title: 'Mock', createdAt: new Date(), updatedAt: new Date(),
    save: vi.fn().mockResolvedValue(undefined),
    createWish: vi.fn(),
    ...extra,
  });

  const Wishlist = { create: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), destroy: vi.fn() };
  const Wish     = { findAll: vi.fn(), findOne: vi.fn(), destroy: vi.fn() };
  return { Wishlist, Wish, inst };
}

let app, Wishlist, Wish, inst;

beforeEach(() => {
  ({ Wishlist, Wish, inst } = buildMocks());
  app = createApp({ models: { Wishlist, Wish } });
});

// POST /wishlist
describe('POST /wishlist', () => {
  it('calls Wishlist.create with the body title and returns the created object', async () => {
    const created = { id: 1, title: 'Test' };
    Wishlist.create.mockResolvedValueOnce(created);
    const res = await request(app).post('/wishlist').send({ title: 'Test' });
    expect(Wishlist.create).toHaveBeenCalledWith({ title: 'Test' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });
});

// GET /wishlist
describe('GET /wishlist', () => {
  it('returns the list from Wishlist.findAll and passes Wish as include', async () => {
    Wishlist.findAll.mockResolvedValueOnce([]);
    await request(app).get('/wishlist');
    expect(Wishlist.findAll).toHaveBeenCalledWith(expect.objectContaining({ include: Wish }));
  });

  it('responds with 200 and the array returned by findAll', async () => {
    const data = [{ id: 1, title: 'A', Wishes: [] }];
    Wishlist.findAll.mockResolvedValueOnce(data);
    const res = await request(app).get('/wishlist');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });
});

// GET /wishlist/:id
describe('GET /wishlist/:id', () => {
  it('returns the found wishlist', async () => {
    const wl = { id: 3, title: 'Found', Wishes: [] };
    Wishlist.findOne.mockResolvedValueOnce(wl);
    const res = await request(app).get('/wishlist/3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(wl);
  });

  it('returns null body when wishlist is not found', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get('/wishlist/9999');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// PUT /wishlist/:id
describe('PUT /wishlist/:id', () => {
  it('updates title, calls save, and returns the updated record', async () => {
    const wl = inst();
    Wishlist.findOne.mockResolvedValueOnce(wl);
    const res = await request(app).put('/wishlist/1').send({ title: 'New' });
    expect(wl.save).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('returns 404 with message when wishlist is missing', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);
    const res = await request(app).put('/wishlist/0').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// DELETE /wishlist/:id
describe('DELETE /wishlist/:id', () => {
  it('calls Wishlist.destroy with the correct where clause and returns 204', async () => {
    Wishlist.destroy.mockResolvedValueOnce(1);
    const res = await request(app).delete('/wishlist/5');
    expect(Wishlist.destroy).toHaveBeenCalledWith({ where: { id: '5' } });
    expect(res.status).toBe(204);
  });
});

// POST /wishlist/:id/wish
describe('POST /wishlist/:id/wish', () => {
  it('creates a wish and returns the refreshed wishlist', async () => {
    const wl      = inst({ createWish: vi.fn().mockResolvedValue(undefined) });
    const updated = { ...wl, Wishes: [{ id: 10, title: 'Bike', quantity: 1 }] };
    Wishlist.findOne.mockResolvedValueOnce(wl).mockResolvedValueOnce(updated);
    const res = await request(app).post('/wishlist/1/wish').send({ title: 'Bike', quantity: 1 });
    expect(wl.createWish).toHaveBeenCalledWith({ title: 'Bike', quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.Wishes).toHaveLength(1);
  });

  it('returns 404 when the parent wishlist does not exist', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);
    const res = await request(app).post('/wishlist/0/wish').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// GET /wish
describe('GET /wish', () => {
  it('returns the flat wish list from Wish.findAll', async () => {
    const wishes = [{ id: 1, title: 'Book', quantity: 2 }];
    Wish.findAll.mockResolvedValueOnce(wishes);
    const res = await request(app).get('/wish');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(wishes);
  });
});

// GET /wish/:id
describe('GET /wish/:id', () => {
  it('returns the wish when found', async () => {
    Wish.findOne.mockResolvedValueOnce({ id: 7, title: 'Piano', quantity: 1 });
    const res = await request(app).get('/wish/7');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Piano');
  });

  it('returns null when wish is not found', async () => {
    Wish.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get('/wish/9999');
    expect(res.body).toBeNull();
  });
});

// PUT /wish/:id
describe('PUT /wish/:id', () => {
  it('updates title and quantity, calls save, returns updated wish', async () => {
    const wish = { id: 10, title: 'Old', quantity: 1, save: vi.fn().mockResolvedValue(undefined) };
    Wish.findOne.mockResolvedValueOnce(wish);
    const res = await request(app).put('/wish/10').send({ title: 'New', quantity: 5 });
    expect(wish.save).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.quantity).toBe(5);
  });

  it('returns 404 with message when wish is missing', async () => {
    Wish.findOne.mockResolvedValueOnce(null);
    const res = await request(app).put('/wish/0').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wish not found');
  });
});

// DELETE /wish/:id
describe('DELETE /wish/:id', () => {
  it('calls Wish.destroy with the correct id and returns 204', async () => {
    Wish.destroy.mockResolvedValueOnce(1);
    const res = await request(app).delete('/wish/10');
    expect(Wish.destroy).toHaveBeenCalledWith({ where: { id: '10' } });
    expect(res.status).toBe(204);
  });
});
