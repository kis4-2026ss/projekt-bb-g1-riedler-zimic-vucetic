import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import { createBackend, createSequelize } from '../../app.mjs';

describe('database initialization', () => {
  it('starts with no data when seeding is disabled', async () => {
    const { sequelize, models } = await createBackend({
      storage: ':memory:',
      seed: false,
      syncOptions: { force: true }
    });

    try {
      assert.equal(await models.Wishlist.count(), 0);
      assert.equal(await models.Wish.count(), 0);
    } finally {
      await sequelize.close();
    }
  });

  it('creates exactly one sample wishlist with one sample wish when seeding is enabled', async () => {
    const { sequelize, models } = await createBackend({
      storage: ':memory:',
      seed: true,
      syncOptions: { force: true }
    });

    try {
      const wishlists = await models.Wishlist.findAll({ include: models.Wish });

      assert.equal(wishlists.length, 1);
      assert.equal(wishlists[0].title, 'My Fancy Wishlist');
      assert.equal(wishlists[0].Wishes.length, 1);
      assert.equal(wishlists[0].Wishes[0].title, 'Leberkaassemmeln');
      assert.equal(wishlists[0].Wishes[0].quantity, 3);
    } finally {
      await sequelize.close();
    }
  });

  it('creates the parent directory for file based SQLite storage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wishlist-db-'));
    const storage = join(root, 'nested', 'main.db');
    const sequelize = createSequelize({ storage });

    try {
      await sequelize.authenticate();
      assert.equal(existsSync(join(root, 'nested')), true);
    } finally {
      await sequelize.close();
    }
  });
});
