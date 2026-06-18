/**
 * Unit tests for all Express route handlers in app.mjs.
 * All Sequelize model methods are replaced with vi.fn() stubs so tests run
 * without a database and verify route logic in isolation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.mjs';

// ── Stub factory ──────────────────────────────────────────────────────────────

function makeModels() {
  const wishlistInstance = () => ({
    id: 1,
    title: 'List',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: vi.fn().mockResolvedValue(undefined),
    createWish: vi.fn(),
  });

  const wishInstance = () => ({
    id: 10,
    title: 'Wish',
    quantity: 1,
    save: vi.fn().mockResolvedValue(undefined),
  });

  const Wishlist = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    destroy: vi.fn(),
  };

  const Wish = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    destroy: vi.fn(),
  };

  return { Wishlist, Wish, wishlistInstance, wishInstance };
}

let app, Wishlist, Wish, wishlistInstance, wishInstance;

beforeEach(() => {
  ({ Wishlist, Wish, wishlistInstance, wishInstance } = makeModels());
  app = createApp({ models: { Wishlist, Wish } });
});

// ── POST /wishlist ────────────────────────────────────────────────────────────

describe('POST /wishlist', () => {
  it('calls Wishlist.create with the request title and returns the result', async () => {
    const created = { id: 1, title: 'Birthday' };
    Wishlist.create.mockResolvedValueOnce(created);

    const res = await request(app).post('/wishlist').send({ title: 'Birthday' });

    expect(Wishlist.create).toHaveBeenCalledWith({ title: 'Birthday' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

});

// ── GET /wishlist ─────────────────────────────────────────────────────────────

describe('GET /wishlist', () => {
  it('returns the list returned by Wishlist.findAll', async () => {
    const lists = [{ id: 1, title: 'A', Wishes: [] }];
    Wishlist.findAll.mockResolvedValueOnce(lists);

    const res = await request(app).get('/wishlist');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(lists);
  });

  it('calls findAll with Wish included', async () => {
    Wishlist.findAll.mockResolvedValueOnce([]);
    await request(app).get('/wishlist');

    expect(Wishlist.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ include: Wish })
    );
  });

});

// ── GET /wishlist/:id ─────────────────────────────────────────────────────────

describe('GET /wishlist/:id', () => {
  it('returns the wishlist when found', async () => {
    const wl = { id: 2, title: 'Found', Wishes: [] };
    Wishlist.findOne.mockResolvedValueOnce(wl);

    const res = await request(app).get('/wishlist/2');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(wl);
  });

  it('returns null (200) when the wishlist is not found', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);

    const res = await request(app).get('/wishlist/9999');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── PUT /wishlist/:id ─────────────────────────────────────────────────────────

describe('PUT /wishlist/:id', () => {
  it('updates and saves the wishlist, returns updated data', async () => {
    const wl = wishlistInstance();
    Wishlist.findOne.mockResolvedValueOnce(wl);

    const res = await request(app).put('/wishlist/1').send({ title: 'New Title' });

    expect(wl.save).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  it('returns 404 when the wishlist does not exist', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);

    const res = await request(app).put('/wishlist/9999').send({ title: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── DELETE /wishlist/:id ──────────────────────────────────────────────────────

describe('DELETE /wishlist/:id', () => {
  it('calls Wishlist.destroy with the correct id and returns 204', async () => {
    Wishlist.destroy.mockResolvedValueOnce(1);

    const res = await request(app).delete('/wishlist/5');

    expect(Wishlist.destroy).toHaveBeenCalledWith({ where: { id: '5' } });
    expect(res.status).toBe(204);
  });
});

// ── POST /wishlist/:id/wish ───────────────────────────────────────────────────

describe('POST /wishlist/:id/wish', () => {
  it('creates a wish and returns the updated wishlist', async () => {
    const wl = wishlistInstance();
    const updatedWl = { ...wl, Wishes: [{ id: 10, title: 'Bike', quantity: 1 }] };

    Wishlist.findOne
      .mockResolvedValueOnce(wl)       // first call: check wishlist exists
      .mockResolvedValueOnce(updatedWl); // second call: reload after createWish

    wl.createWish.mockResolvedValueOnce({ id: 10, title: 'Bike', quantity: 1 });

    const res = await request(app)
      .post('/wishlist/1/wish')
      .send({ title: 'Bike', quantity: 1 });

    expect(wl.createWish).toHaveBeenCalledWith({ title: 'Bike', quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.Wishes).toHaveLength(1);
  });

  it('returns 404 when the parent wishlist does not exist', async () => {
    Wishlist.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/wishlist/9999/wish')
      .send({ title: 'Ghost', quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── GET /wish ─────────────────────────────────────────────────────────────────

describe('GET /wish', () => {
  it('returns all wishes from Wish.findAll', async () => {
    const wishes = [{ id: 1, title: 'Book', quantity: 2 }];
    Wish.findAll.mockResolvedValueOnce(wishes);

    const res = await request(app).get('/wish');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(wishes);
  });

});

// ── GET /wish/:id ─────────────────────────────────────────────────────────────

describe('GET /wish/:id', () => {
  it('returns the wish when found', async () => {
    const wish = { id: 7, title: 'Piano', quantity: 1 };
    Wish.findOne.mockResolvedValueOnce(wish);

    const res = await request(app).get('/wish/7');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(wish);
  });

  it('returns null (200) when the wish is not found', async () => {
    Wish.findOne.mockResolvedValueOnce(null);

    const res = await request(app).get('/wish/9999');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── PUT /wish/:id ─────────────────────────────────────────────────────────────

describe('PUT /wish/:id', () => {
  it('updates title and quantity, calls save, returns updated wish', async () => {
    const wish = wishInstance();
    Wish.findOne.mockResolvedValueOnce(wish);

    const res = await request(app).put('/wish/10').send({ title: 'Updated', quantity: 5 });

    expect(wish.save).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.quantity).toBe(5);
  });

  it('returns 404 when the wish does not exist', async () => {
    Wish.findOne.mockResolvedValueOnce(null);

    const res = await request(app).put('/wish/9999').send({ title: 'X', quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wish not found');
  });
});

// ── DELETE /wish/:id ──────────────────────────────────────────────────────────

describe('DELETE /wish/:id', () => {
  it('calls Wish.destroy with the correct id and returns 204', async () => {
    Wish.destroy.mockResolvedValueOnce(1);

    const res = await request(app).delete('/wish/10');

    expect(Wish.destroy).toHaveBeenCalledWith({ where: { id: '10' } });
    expect(res.status).toBe(204);
  });
});
