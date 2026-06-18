/**
 * Unit tests for Express route handlers in app.mjs (createApp).
 * All Sequelize model methods are replaced with vi.fn() stubs so each test
 * verifies a single responsibility of the HTTP layer in isolation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.mjs';

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeStubs() {
  const wishlistRecord = (overrides = {}) => ({
    id: 1, title: 'Stub List',
    createdAt: new Date(), updatedAt: new Date(),
    save: vi.fn().mockResolvedValue(undefined),
    createWish: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const wishRecord = (overrides = {}) => ({
    id: 10, title: 'Stub Wish', quantity: 1,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const Wishlist = {
    create:  vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    destroy: vi.fn(),
  };

  const Wish = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    destroy: vi.fn(),
  };

  return { Wishlist, Wish, wishlistRecord, wishRecord };
}

let app, Wishlist, Wish, wishlistRecord, wishRecord;

beforeEach(() => {
  ({ Wishlist, Wish, wishlistRecord, wishRecord } = makeStubs());
  app = createApp({ models: { Wishlist, Wish } });
});

// ── POST /wishlist ────────────────────────────────────────────────────────────

describe('POST /wishlist', () => {
  it('calls Wishlist.create with the request body title and echoes the result', async () => {
    const stub = { id: 1, title: 'My List' };
    Wishlist.create.mockResolvedValueOnce(stub);

    const res = await request(app).post('/wishlist').send({ title: 'My List' });

    expect(Wishlist.create).toHaveBeenCalledWith({ title: 'My List' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stub);
  });

  it('passes undefined title when body is empty (no server-side validation)', async () => {
    Wishlist.create.mockResolvedValueOnce({ id: 2, title: null });
    await request(app).post('/wishlist').send({});
    expect(Wishlist.create).toHaveBeenCalledWith({ title: undefined });
  });
});

// ── GET /wishlist ─────────────────────────────────────────────────────────────

describe('GET /wishlist', () => {
  it('calls findAll with Wish model included and returns the result', async () => {
    const stubs = [{ id: 1, title: 'A', Wishes: [] }];
    Wishlist.findAll.mockResolvedValueOnce(stubs);

    const res = await request(app).get('/wishlist');

    expect(Wishlist.findAll).toHaveBeenCalledWith({ include: Wish });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stubs);
  });
});

// ── GET /wishlist/:id ─────────────────────────────────────────────────────────

describe('GET /wishlist/:id', () => {
  it('returns 200 with the found wishlist', async () => {
    const stub = { id: 3, title: 'Found', Wishes: [] };
    Wishlist.findOne.mockResolvedValueOnce(stub);
    const res = await request(app).get('/wishlist/3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stub);
  });

  it('returns 200 with null body for an unknown id', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get('/wishlist/0');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── PUT /wishlist/:id ─────────────────────────────────────────────────────────

describe('PUT /wishlist/:id', () => {
  it('mutates title, calls save(), and returns the updated wishlist', async () => {
    const record = wishlistRecord({ title: 'Old' });
    Wishlist.findOne.mockResolvedValueOnce(record);

    const res = await request(app).put('/wishlist/1').send({ title: 'New' });

    expect(record.title).toBe('New');
    expect(record.save).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('returns 404 with message when wishlist is not found', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);
    const res = await request(app).put('/wishlist/0').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── DELETE /wishlist/:id ──────────────────────────────────────────────────────

describe('DELETE /wishlist/:id', () => {
  it('calls Wishlist.destroy with the route id and responds 204 (no body)', async () => {
    Wishlist.destroy.mockResolvedValueOnce(1);
    const res = await request(app).delete('/wishlist/7');
    expect(Wishlist.destroy).toHaveBeenCalledWith({ where: { id: '7' } });
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });
});

// ── POST /wishlist/:id/wish ───────────────────────────────────────────────────

describe('POST /wishlist/:id/wish', () => {
  it('calls createWish, reloads the wishlist, and returns the updated record', async () => {
    const record    = wishlistRecord();
    const reloaded  = { ...record, Wishes: [{ id: 20, title: 'Bike', quantity: 1 }] };

    Wishlist.findOne
      .mockResolvedValueOnce(record)    // existence check
      .mockResolvedValueOnce(reloaded); // reload after createWish

    const res = await request(app)
      .post('/wishlist/1/wish')
      .send({ title: 'Bike', quantity: 1 });

    expect(record.createWish).toHaveBeenCalledWith({ title: 'Bike', quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.Wishes).toHaveLength(1);
  });

  it('returns 404 with message when the parent wishlist is missing', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/wishlist/0/wish')
      .send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── GET /wish ─────────────────────────────────────────────────────────────────

describe('GET /wish', () => {
  it('returns the flat wish list from Wish.findAll', async () => {
    const stubs = [{ id: 1, title: 'Book', quantity: 2 }];
    Wish.findAll.mockResolvedValueOnce(stubs);
    const res = await request(app).get('/wish');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stubs);
  });
});

// ── GET /wish/:id ─────────────────────────────────────────────────────────────

describe('GET /wish/:id', () => {
  it('returns 200 with the found wish', async () => {
    const stub = { id: 5, title: 'Piano', quantity: 1 };
    Wish.findOne.mockResolvedValueOnce(stub);
    const res = await request(app).get('/wish/5');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stub);
  });

  it('returns 200 with null body for an unknown id', async () => {
    Wish.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get('/wish/0');
    expect(res.body).toBeNull();
  });
});

// ── PUT /wish/:id ─────────────────────────────────────────────────────────────

describe('PUT /wish/:id', () => {
  it('mutates title and quantity, calls save(), returns the updated wish', async () => {
    const record = wishRecord({ title: 'Old', quantity: 1 });
    Wish.findOne.mockResolvedValueOnce(record);

    const res = await request(app).put('/wish/10').send({ title: 'New', quantity: 9 });

    expect(record.title).toBe('New');
    expect(record.quantity).toBe(9);
    expect(record.save).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('returns 404 with message when wish is not found', async () => {
    Wish.findOne.mockResolvedValueOnce(null);
    const res = await request(app).put('/wish/0').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wish not found');
  });
});

// ── DELETE /wish/:id ──────────────────────────────────────────────────────────

describe('DELETE /wish/:id', () => {
  it('calls Wish.destroy with the route id and responds 204', async () => {
    Wish.destroy.mockResolvedValueOnce(1);
    const res = await request(app).delete('/wish/10');
    expect(Wish.destroy).toHaveBeenCalledWith({ where: { id: '10' } });
    expect(res.status).toBe(204);
  });
});
