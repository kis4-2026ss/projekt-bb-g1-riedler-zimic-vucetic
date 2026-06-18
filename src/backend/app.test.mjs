import request from 'supertest';
import { createBackend, createSequelize, defineModels, initializeDatabase, createApp } from './app.mjs';
import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';

describe('Database Setup & Models', () => {
  const tempDbPath = './db/test-temp.db';

  afterEach(() => {
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch (err) {
        // Ignore
      }
    }
    const dbDir = path.dirname(tempDbPath);
    if (fs.existsSync(dbDir)) {
      try {
        const files = fs.readdirSync(dbDir);
        if (files.length === 0) {
          fs.rmdirSync(dbDir);
        }
      } catch (err) {
        // Ignore
      }
    }
  });

  describe('createSequelize', () => {
    it('should create a Sequelize instance with memory storage', () => {
      const sequelize = createSequelize({ storage: ':memory:' });
      expect(sequelize).toBeInstanceOf(Sequelize);
      expect(sequelize.options.dialect).toBe('sqlite');
      expect(sequelize.options.storage).toBe(':memory:');
    });

    it('should create database directory if using file storage', () => {
      const dbDir = path.dirname(tempDbPath);
      const sequelize = createSequelize({ storage: tempDbPath });
      expect(sequelize).toBeInstanceOf(Sequelize);
      expect(fs.existsSync(dbDir)).toBe(true);
    });
  });

  describe('defineModels', () => {
    it('should define Wishlist and Wish models and their associations', () => {
      const sequelize = createSequelize({ storage: ':memory:' });
      const models = defineModels(sequelize);

      expect(models.Wishlist).toBeDefined();
      expect(models.Wish).toBeDefined();

      expect(models.Wishlist.associations.Wishes).toBeDefined();
      expect(models.Wish.associations.Wishlist).toBeDefined();
    });
  });

  describe('initializeDatabase', () => {
    let sequelize;
    let models;

    beforeEach(() => {
      sequelize = createSequelize({ storage: ':memory:' });
      models = defineModels(sequelize);
    });

    it('should authenticate, sync and seed the database if empty and seed=true', async () => {
      await initializeDatabase({
        sequelize,
        models,
        syncOptions: { force: true },
        seed: true
      });

      const wishlists = await models.Wishlist.findAll({ include: models.Wish });
      expect(wishlists.length).toBe(1);
      expect(wishlists[0].title).toBe('My Fancy Wishlist');
      expect(wishlists[0].Wishes.length).toBe(1);
      expect(wishlists[0].Wishes[0].title).toBe('Leberkaassemmeln');
      expect(wishlists[0].Wishes[0].quantity).toBe(3);
    });

    it('should not seed the database if seed=false', async () => {
      await initializeDatabase({
        sequelize,
        models,
        syncOptions: { force: true },
        seed: false
      });

      const wishlists = await models.Wishlist.findAll();
      expect(wishlists.length).toBe(0);
    });

    it('should not seed the database if it is not empty', async () => {
      await sequelize.sync({ force: true });
      await models.Wishlist.create({ title: 'Existing Wishlist' });

      await initializeDatabase({
        sequelize,
        models,
        syncOptions: { force: false },
        seed: true
      });

      const wishlists = await models.Wishlist.findAll();
      expect(wishlists.length).toBe(1);
      expect(wishlists[0].title).toBe('Existing Wishlist');
    });
  });
});

describe('API Endpoints', () => {
  let app;
  let sequelize;
  let models;

  beforeEach(async () => {
    const backend = await createBackend({
      storage: ':memory:',
      syncOptions: { force: true },
      seed: false
    });
    app = backend.app;
    sequelize = backend.sequelize;
    models = backend.models;
  });

  afterEach(async () => {
    await sequelize.close();
  });

  describe('POST /wishlist', () => {
    it('should create a new wishlist with a title', async () => {
      const response = await request(app)
        .post('/wishlist')
        .send({ title: 'My Holiday Wishlist' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('My Holiday Wishlist');

      const dbWishlist = await models.Wishlist.findByPk(response.body.id);
      expect(dbWishlist).not.toBeNull();
      expect(dbWishlist.title).toBe('My Holiday Wishlist');
    });

    it('should allow creating a wishlist with a missing title', async () => {
      const response = await request(app)
        .post('/wishlist')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.title).toBeUndefined();
    });
  });

  describe('GET /wishlist', () => {
    it('should return an empty array if no wishlists exist', async () => {
      const response = await request(app).get('/wishlist');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all wishlists with their wishes', async () => {
      const wl1 = await models.Wishlist.create({ title: 'List 1' });
      const wl2 = await models.Wishlist.create({ title: 'List 2' });
      await models.Wish.create({ title: 'Wish A', quantity: 1, WishlistId: wl1.id });

      const response = await request(app).get('/wishlist');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);

      const retrievedWl1 = response.body.find(x => x.id === wl1.id);
      expect(retrievedWl1).toBeDefined();
      expect(retrievedWl1.Wishes.length).toBe(1);
      expect(retrievedWl1.Wishes[0].title).toBe('Wish A');
    });
  });

  describe('GET /wishlist/:id', () => {
    it('should return the wishlist with its wishes if it exists', async () => {
      const wl = await models.Wishlist.create({ title: 'List A' });
      await models.Wish.create({ title: 'Wish B', quantity: 2, WishlistId: wl.id });

      const response = await request(app).get(`/wishlist/${wl.id}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(wl.id);
      expect(response.body.title).toBe('List A');
      expect(response.body.Wishes.length).toBe(1);
      expect(response.body.Wishes[0].title).toBe('Wish B');
    });

    it('should return null if the wishlist does not exist', async () => {
      const response = await request(app).get('/wishlist/9999');
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('PUT /wishlist/:id', () => {
    it('should update the wishlist title and return it', async () => {
      const wl = await models.Wishlist.create({ title: 'Old Title' });

      const response = await request(app)
        .put(`/wishlist/${wl.id}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('New Title');

      const dbWl = await models.Wishlist.findByPk(wl.id);
      expect(dbWl.title).toBe('New Title');
    });

    it('should return 404 if updating a non-existent wishlist', async () => {
      const response = await request(app)
        .put('/wishlist/9999')
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Wishlist not found');
    });
  });

  describe('DELETE /wishlist/:id', () => {
    it('should delete the wishlist and return 204', async () => {
      const wl = await models.Wishlist.create({ title: 'To Delete' });

      const response = await request(app).delete(`/wishlist/${wl.id}`);
      expect(response.status).toBe(204);

      const dbWl = await models.Wishlist.findByPk(wl.id);
      expect(dbWl).toBeNull();
    });

    it('should return 204 even if the wishlist does not exist', async () => {
      const response = await request(app).delete('/wishlist/9999');
      expect(response.status).toBe(204);
    });
  });

  describe('POST /wishlist/:id/wish', () => {
    it('should add a wish to the wishlist and return updated wishlist with wishes', async () => {
      const wl = await models.Wishlist.create({ title: 'List A' });

      const response = await request(app)
        .post(`/wishlist/${wl.id}/wish`)
        .send({ title: 'Gift Card', quantity: 5 });

      expect(response.status).toBe(200);
      expect(response.body.Wishes.length).toBe(1);
      expect(response.body.Wishes[0].title).toBe('Gift Card');
      expect(response.body.Wishes[0].quantity).toBe(5);

      const dbWishes = await models.Wish.findAll({ where: { WishlistId: wl.id } });
      expect(dbWishes.length).toBe(1);
      expect(dbWishes[0].title).toBe('Gift Card');
    });

    it('should return 404 if adding a wish to a non-existent wishlist', async () => {
      const response = await request(app)
        .post('/wishlist/9999/wish')
        .send({ title: 'Gift Card', quantity: 5 });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Wishlist not found');
    });
  });

  describe('GET /wish', () => {
    it('should return all wishes', async () => {
      const wl = await models.Wishlist.create({ title: 'List' });
      await models.Wish.create({ title: 'Wish 1', quantity: 1, WishlistId: wl.id });
      await models.Wish.create({ title: 'Wish 2', quantity: 2, WishlistId: wl.id });

      const response = await request(app).get('/wish');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });
  });

  describe('GET /wish/:id', () => {
    it('should return the wish with the specified ID', async () => {
      const wl = await models.Wishlist.create({ title: 'List' });
      const wish = await models.Wish.create({ title: 'Wish A', quantity: 1, WishlistId: wl.id });

      const response = await request(app).get(`/wish/${wish.id}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(wish.id);
      expect(response.body.title).toBe('Wish A');
    });

    it('should return null if the wish does not exist', async () => {
      const response = await request(app).get('/wish/9999');
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('PUT /wish/:id', () => {
    it('should update the wish and return it', async () => {
      const wl = await models.Wishlist.create({ title: 'List' });
      const wish = await models.Wish.create({ title: 'Old Title', quantity: 1, WishlistId: wl.id });

      const response = await request(app)
        .put(`/wish/${wish.id}`)
        .send({ title: 'New Title', quantity: 10 });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('New Title');
      expect(response.body.quantity).toBe(10);

      const dbWish = await models.Wish.findByPk(wish.id);
      expect(dbWish.title).toBe('New Title');
      expect(dbWish.quantity).toBe(10);
    });

    it('should return 404 if updating a non-existent wish', async () => {
      const response = await request(app)
        .put('/wish/9999')
        .send({ title: 'New Title', quantity: 10 });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Wish not found');
    });
  });

  describe('DELETE /wish/:id', () => {
    it('should delete the wish and return 204', async () => {
      const wl = await models.Wishlist.create({ title: 'List' });
      const wish = await models.Wish.create({ title: 'To Delete', quantity: 1, WishlistId: wl.id });

      const response = await request(app).delete(`/wish/${wish.id}`);
      expect(response.status).toBe(204);

      const dbWish = await models.Wish.findByPk(wish.id);
      expect(dbWish).toBeNull();
    });

    it('should return 204 even if the wish does not exist', async () => {
      const response = await request(app).delete('/wish/9999');
      expect(response.status).toBe(204);
    });
  });
});
