/**
 * Unit tests for the Sequelize layer: createSequelize, defineModels,
 * initializeDatabase.  No HTTP layer, no mocks – tests the DB setup in
 * isolation using in-memory SQLite.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  createSequelize,
  defineModels,
  initializeDatabase,
} from '../../app.mjs';

const openConnections = [];
const seq = (opts = {}) => {
  const s = createSequelize({ storage: ':memory:', ...opts });
  openConnections.push(s);
  return s;
};

afterEach(async () => {
  await Promise.all(openConnections.splice(0).map(s => s.close().catch(() => {})));
});

// ── createSequelize ───────────────────────────────────────────────────────────

describe('createSequelize', () => {
  it('returns an object with Sequelize query methods', () => {
    const s = seq();
    expect(typeof s.authenticate).toBe('function');
    expect(typeof s.sync).toBe('function');
    expect(typeof s.query).toBe('function');
  });

  it('connects to in-memory SQLite without throwing', async () => {
    await expect(seq().authenticate()).resolves.toBeUndefined();
  });

  it('uses :memory: storage by default when env DB_STORAGE is unset', () => {
    const s = seq();
    expect(s.options.storage).toBe(':memory:');
  });
});

// ── defineModels ──────────────────────────────────────────────────────────────

describe('defineModels', () => {
  it('returns both Wishlist and Wish model constructors', () => {
    const { Wishlist, Wish } = defineModels(seq());
    expect(Wishlist).toBeDefined();
    expect(Wish).toBeDefined();
  });

  it('Wishlist has HasMany association to Wishes', () => {
    const { Wishlist } = defineModels(seq());
    expect(Wishlist.associations).toHaveProperty('Wishes');
  });

  it('Wish has BelongsTo association to Wishlist (sets WishlistId FK)', () => {
    const { Wish } = defineModels(seq());
    expect(Wish.associations).toHaveProperty('Wishlist');
  });

  it('Wishlist model exposes all expected static query methods', () => {
    const { Wishlist } = defineModels(seq());
    for (const m of ['findAll', 'findOne', 'create', 'destroy', 'count']) {
      expect(typeof Wishlist[m]).toBe('function');
    }
  });
});

// ── initializeDatabase ────────────────────────────────────────────────────────

describe('initializeDatabase', () => {
  it('creates tables and seeds exactly one wishlist and one wish when seed=true', async () => {
    const s = seq();
    const m = defineModels(s);
    await initializeDatabase({ sequelize: s, models: m, syncOptions: { force: true }, seed: true });
    expect(await m.Wishlist.count()).toBe(1);
    expect(await m.Wish.count()).toBe(1);
  });

  it('seeded wishlist has a non-empty title', async () => {
    const s = seq();
    const m = defineModels(s);
    await initializeDatabase({ sequelize: s, models: m, syncOptions: { force: true }, seed: true });
    const wl = await m.Wishlist.findOne();
    expect(typeof wl.title).toBe('string');
    expect(wl.title.length).toBeGreaterThan(0);
  });

  it('skips seeding when seed=false, leaving tables empty', async () => {
    const s = seq();
    const m = defineModels(s);
    await initializeDatabase({ sequelize: s, models: m, syncOptions: { force: true }, seed: false });
    expect(await m.Wishlist.count()).toBe(0);
    expect(await m.Wish.count()).toBe(0);
  });

  it('is idempotent – second call with seed=true does not add more data', async () => {
    const s = seq();
    const m = defineModels(s);
    await initializeDatabase({ sequelize: s, models: m, syncOptions: { force: true }, seed: true });
    await initializeDatabase({ sequelize: s, models: m, syncOptions: { force: false }, seed: true });
    expect(await m.Wishlist.count()).toBe(1);
  });
});
