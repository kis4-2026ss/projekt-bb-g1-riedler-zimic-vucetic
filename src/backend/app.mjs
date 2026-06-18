import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { Sequelize, DataTypes } from 'sequelize';

export function createSequelize({
  storage = process.env.DB_STORAGE || './db/main.db',
  logging = false
} = {}) {
  if (storage !== ':memory:') {
    mkdirSync(dirname(storage), { recursive: true });
  }

  return new Sequelize({
    dialect: 'sqlite',
    storage,
    logging
  });
}

export function defineModels(sequelize) {
  const Wishlist = sequelize.define('Wishlist', {
    title: DataTypes.STRING,
  });

  const Wish = sequelize.define('Wish', {
    title: DataTypes.STRING,
    quantity: DataTypes.NUMBER,
  });

  Wish.belongsTo(Wishlist);
  Wishlist.hasMany(Wish);

  return { Wishlist, Wish };
}

export async function initializeDatabase({
  sequelize,
  models,
  syncOptions = { force: false },
  seed = true
}) {
  await sequelize.authenticate();
  await sequelize.sync(syncOptions);

  if (seed) {
    const wishlists = await models.Wishlist.findAll();
    if (wishlists.length === 0) {
      const wishlist = await models.Wishlist.create({ title: 'My Fancy Wishlist' });
      await wishlist.createWish({ title: 'Leberkaassemmeln', quantity: 3 });
    }
  }
}

export function createApp({ models }) {
  const { Wishlist, Wish } = models;
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: '*' }));
  app.use(bodyParser.json());

  /**
   * Adds a wishlist
   */
  app.post('/wishlist', async (req, res) => {
    const wishlist = await Wishlist.create({ title: req.body.title });
    return res.json(wishlist);
  });

  /**
   * Gets all wishlists (including all their wishes)
   */
  app.get('/wishlist', async (req, res) => {
    const wishlists = await Wishlist.findAll({ include: Wish });
    return res.json(wishlists);
  });

  /**
   * Gets the wishlist with the specified ID (including all its wishes)
   */
  app.get('/wishlist/:id', async (req, res) => {
    const id = req.params.id;
    const wishlist = await Wishlist.findOne({ where: { id: id }, include: Wish });
    return res.json(wishlist);
  });

  /**
   * Updates the wishlist with the specified ID
   */
  app.put('/wishlist/:id', async (req, res) => {
    const id = req.params.id;
    const wishlist = await Wishlist.findOne({ where: { id: id } });
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    wishlist.title = req.body.title;
    await wishlist.save();

    return res.json(wishlist);
  });

  /**
   * Deletes the wishlist with the specified ID
   */
  app.delete('/wishlist/:id', async (req, res) => {
    const id = req.params.id;
    await Wishlist.destroy({ where: { id: id } });
    return res.status(204).send();
  });

  /**
   * Adds a wish to the wishlist with the specified ID
   */
  app.post('/wishlist/:id/wish', async (req, res) => {
    const id = req.params.id;
    let wishlist = await Wishlist.findOne({ where: { id: id }, include: Wish });
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    await wishlist.createWish({
      title: req.body.title,
      quantity: req.body.quantity
    });

    wishlist = await Wishlist.findOne({ where: { id: id }, include: Wish });
    return res.json(wishlist);
  });

  /**
   * Gets all wishes
   */
  app.get('/wish', async (req, res) => {
    const wishes = await Wish.findAll();
    return res.json(wishes);
  });

  /**
   * Gets the wish with the specified ID
   */
  app.get('/wish/:id', async (req, res) => {
    const id = req.params.id;
    const wish = await Wish.findOne({ where: { id: id } });
    return res.json(wish);
  });

  /**
   * Updates the wish with the specified ID
   */
  app.put('/wish/:id', async (req, res) => {
    const id = req.params.id;
    const wish = await Wish.findOne({ where: { id: id } });
    if (!wish) {
      return res.status(404).json({ message: 'Wish not found' });
    }

    wish.title = req.body.title;
    wish.quantity = req.body.quantity;
    await wish.save();

    return res.json(wish);
  });

  /**
   * Deletes the wish with the specified ID
   */
  app.delete('/wish/:id', async (req, res) => {
    const id = req.params.id;
    await Wish.destroy({ where: { id: id } });
    return res.status(204).send();
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Invalid JSON payload' });
    }

    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({ message: status === 500 ? 'Internal server error' : error.message });
  });

  return app;
}

export async function createBackend({
  storage = process.env.DB_STORAGE || './db/main.db',
  logging = false,
  syncOptions = { force: false },
  seed = true
} = {}) {
  const sequelize = createSequelize({ storage, logging });
  const models = defineModels(sequelize);
  await initializeDatabase({ sequelize, models, syncOptions, seed });
  const app = createApp({ models });

  return { app, sequelize, models };
}
