import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSequelize,
  defineModels,
  initializeDatabase
} from '../app.mjs';

test('defineModels creates wishlist and wish associations', async () => {
  const sequelize = createSequelize({ storage: ':memory:' });

  try {
    const models = defineModels(sequelize);
    await initializeDatabase({
      sequelize,
      models,
      syncOptions: { force: true },
      seed: false
    });

    const wishlist = await models.Wishlist.create({ title: 'Birthday' });
    const wish = await wishlist.createWish({ title: 'Book', quantity: 2 });

    const loaded = await models.Wishlist.findByPk(wishlist.id, {
      include: models.Wish
    });

    assert.equal(loaded.title, 'Birthday');
    assert.equal(loaded.Wishes.length, 1);
    assert.equal(loaded.Wishes[0].id, wish.id);
    assert.equal(loaded.Wishes[0].quantity, 2);
  } finally {
    await sequelize.close();
  }
});

test('initializeDatabase seeds default wishlist only when database is empty', async () => {
  const sequelize = createSequelize({ storage: ':memory:' });

  try {
    const models = defineModels(sequelize);
    await initializeDatabase({
      sequelize,
      models,
      syncOptions: { force: true },
      seed: true
    });
    await initializeDatabase({ sequelize, models, seed: true });

    const wishlists = await models.Wishlist.findAll({ include: models.Wish });
    const wishes = await models.Wish.findAll();

    assert.equal(wishlists.length, 1);
    assert.equal(wishlists[0].title, 'My Fancy Wishlist');
    assert.equal(wishlists[0].Wishes.length, 1);
    assert.equal(wishlists[0].Wishes[0].title, 'Leberkaassemmeln');
    assert.equal(wishes.length, 1);
  } finally {
    await sequelize.close();
  }
});

test('initializeDatabase can start without seed data', async () => {
  const sequelize = createSequelize({ storage: ':memory:' });

  try {
    const models = defineModels(sequelize);
    await initializeDatabase({
      sequelize,
      models,
      syncOptions: { force: true },
      seed: false
    });

    assert.equal(await models.Wishlist.count(), 0);
    assert.equal(await models.Wish.count(), 0);
  } finally {
    await sequelize.close();
  }
});

