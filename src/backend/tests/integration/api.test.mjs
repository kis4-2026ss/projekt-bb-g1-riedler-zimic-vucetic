/**
 * Integration tests – all API endpoints exercised against a real in-memory
 * SQLite database via supertest.  Tests verify persistence, associations,
 * cascade behaviour, and edge cases that require an actual DB.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, createList, addWish } from '../helpers/db.mjs';

let agent, teardown;

beforeEach(async () => {
  const ctx = await setupTestDb();
  agent    = request(ctx.app);
  teardown = ctx.teardown;
});

afterEach(() => teardown());

// ── Wishlist: create ──────────────────────────────────────────────────────────

describe('POST /wishlist', () => {
  it('stores the wishlist and returns it with a generated id', async () => {
    const res = await createList(agent, 'Integration List');
    expect(res.id).toBeDefined();
    expect(res.title).toBe('Integration List');
  });

  it('assigns unique ids to each created wishlist', async () => {
    const a = await createList(agent, 'A');
    const b = await createList(agent, 'B');
    expect(a.id).not.toBe(b.id);
  });

  it('stores a wishlist with an empty string title (no server-side guard)', async () => {
    const res = await agent.post('/wishlist').send({ title: '' });
    expect(res.status).toBe(200);
  });
});

// ── Wishlist: read ────────────────────────────────────────────────────────────

describe('GET /wishlist', () => {
  it('returns an empty array when the database is empty', async () => {
    const res = await agent.get('/wishlist');
    expect(res.body).toEqual([]);
  });

  it('includes a Wishes array for each wishlist, empty when no wishes exist', async () => {
    await createList(agent, 'No Wishes');
    const res = await agent.get('/wishlist');
    expect(res.body[0]).toHaveProperty('Wishes');
    expect(res.body[0].Wishes).toEqual([]);
  });

  it('populates Wishes inline when they exist', async () => {
    const wl = await createList(agent);
    await addWish(agent, wl.id, 'Item A');
    const res = await agent.get('/wishlist');
    expect(res.body[0].Wishes[0].title).toBe('Item A');
  });
});

describe('GET /wishlist/:id', () => {
  it('returns the correct wishlist by id', async () => {
    const wl = await createList(agent, 'Target');
    await createList(agent, 'Other');
    const res = await agent.get(`/wishlist/${wl.id}`);
    expect(res.body.title).toBe('Target');
  });

  it('returns null for a non-existent id (no 404 – by design)', async () => {
    const res = await agent.get('/wishlist/99999');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── Wishlist: update ──────────────────────────────────────────────────────────

describe('PUT /wishlist/:id', () => {
  it('persists the new title and leaves associated wishes intact', async () => {
    const wl = await createList(agent, 'Old Title');
    await addWish(agent, wl.id, 'Keep Me');

    await agent.put(`/wishlist/${wl.id}`).send({ title: 'New Title' });

    const res = await agent.get(`/wishlist/${wl.id}`);
    expect(res.body.title).toBe('New Title');
    expect(res.body.Wishes).toHaveLength(1);
  });

  it('returns 404 for an unknown wishlist id', async () => {
    const res = await agent.put('/wishlist/0').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── Wishlist: delete ──────────────────────────────────────────────────────────

describe('DELETE /wishlist/:id', () => {
  it('removes the wishlist and leaves sibling wishlists untouched', async () => {
    const keep   = await createList(agent, 'Keep');
    const remove = await createList(agent, 'Remove');

    await agent.delete(`/wishlist/${remove.id}`);

    const res = await agent.get('/wishlist');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(keep.id);
  });

  it('returns 204 (idempotent) for a non-existent id', async () => {
    expect((await agent.delete('/wishlist/0')).status).toBe(204);
  });
});

// ── Wish: create ──────────────────────────────────────────────────────────────

describe('POST /wishlist/:id/wish', () => {
  it('attaches the wish with correct title and quantity to the wishlist', async () => {
    const wl   = await createList(agent);
    const wish = await addWish(agent, wl.id, 'Guitar', 2);
    expect(wish.title).toBe('Guitar');
    expect(wish.quantity).toBe(2);
  });

  it('returns the full updated wishlist (id, title, Wishes) after adding', async () => {
    const wl  = await createList(agent);
    const res = await agent.post(`/wishlist/${wl.id}/wish`)
      .send({ title: 'Pen', quantity: 5 });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('Wishes');
  });

  it('returns 404 for a non-existent parent wishlist', async () => {
    const res = await agent.post('/wishlist/0/wish').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Wishlist not found');
  });
});

// ── Wish: read ────────────────────────────────────────────────────────────────

describe('GET /wish', () => {
  it('aggregates wishes from all wishlists into a single flat list', async () => {
    const wl1 = await createList(agent, 'L1');
    const wl2 = await createList(agent, 'L2');
    await addWish(agent, wl1.id, 'Alpha');
    await addWish(agent, wl2.id, 'Beta');

    const res = await agent.get('/wish');
    expect(res.body).toHaveLength(2);
    expect(res.body.map(w => w.title)).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
  });

  it('does not include Wishlist details in the flat response', async () => {
    const wl = await createList(agent);
    await addWish(agent, wl.id, 'Solo');
    const res = await agent.get('/wish');
    expect(res.body[0]).not.toHaveProperty('Wishes');
  });
});

describe('GET /wish/:id', () => {
  it('returns the wish with correct fields', async () => {
    const wl   = await createList(agent);
    const wish = await addWish(agent, wl.id, 'Piano', 3);
    const res  = await agent.get(`/wish/${wish.id}`);
    expect(res.body.title).toBe('Piano');
    expect(res.body.quantity).toBe(3);
  });

  it('returns null for an unknown wish id', async () => {
    const res = await agent.get('/wish/0');
    expect(res.body).toBeNull();
  });
});

// ── Wish: update ──────────────────────────────────────────────────────────────

describe('PUT /wish/:id', () => {
  it('persists both title and quantity changes', async () => {
    const wl   = await createList(agent);
    const wish = await addWish(agent, wl.id, 'Before', 1);
    await agent.put(`/wish/${wish.id}`).send({ title: 'After', quantity: 10 });
    const res  = await agent.get(`/wish/${wish.id}`);
    expect(res.body.title).toBe('After');
    expect(res.body.quantity).toBe(10);
  });

  it('updating one wish does not affect sibling wishes in the same list', async () => {
    const wl = await createList(agent);
    const w1 = await addWish(agent, wl.id, 'Untouched', 1);
    const w2 = await addWish(agent, wl.id, 'Changed',   1);
    await agent.put(`/wish/${w2.id}`).send({ title: 'Updated', quantity: 99 });
    const res = await agent.get(`/wish/${w1.id}`);
    expect(res.body.title).toBe('Untouched');
  });

  it('returns 404 for an unknown wish id', async () => {
    const res = await agent.put('/wish/0').send({ title: 'X', quantity: 1 });
    expect(res.status).toBe(404);
  });
});

// ── Wish: delete ──────────────────────────────────────────────────────────────

describe('DELETE /wish/:id', () => {
  it('removes only the targeted wish and leaves the parent wishlist intact', async () => {
    const wl   = await createList(agent, 'Parent');
    const wish = await addWish(agent, wl.id, 'Child');
    await agent.delete(`/wish/${wish.id}`);

    const listRes = await agent.get(`/wishlist/${wl.id}`);
    expect(listRes.body.title).toBe('Parent');
    expect(listRes.body.Wishes).toHaveLength(0);
  });

  it('leaves sibling wishes in the same list intact after deletion', async () => {
    const wl = await createList(agent);
    const w1 = await addWish(agent, wl.id, 'Keep');
    const w2 = await addWish(agent, wl.id, 'Remove');
    await agent.delete(`/wish/${w2.id}`);
    const res = await agent.get('/wish');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(w1.id);
  });

  it('returns 204 (idempotent) when deleting a non-existent wish', async () => {
    expect((await agent.delete('/wish/0')).status).toBe(204);
  });
});
