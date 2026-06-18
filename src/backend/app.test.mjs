import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createBackend } from './app.mjs';

describe('Backend API', () => {
  let app;
  let sequelize;
  let models;
  let request;

  beforeAll(async () => {
    // Start backend with in-memory DB and disable default seed
    const backend = await createBackend({ storage: ':memory:', logging: false, seed: false });
    app = backend.app;
    sequelize = backend.sequelize;
    models = backend.models;
    request = supertest(app);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await sequelize.sync({ force: true });
  });

  describe('Wishlists', () => {
    it('should create a new wishlist', async () => {
      const response = await request.post('/wishlist').send({ title: 'Birthday' });
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Birthday');
      expect(response.body.id).toBeDefined();
    });

    it('should retrieve all wishlists', async () => {
      await models.Wishlist.create({ title: 'List 1' });
      await models.Wishlist.create({ title: 'List 2' });

      const response = await request.get('/wishlist');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body[0].title).toBe('List 1');
    });

    it('should get a specific wishlist by id', async () => {
      const wl = await models.Wishlist.create({ title: 'My List' });
      const response = await request.get(`/wishlist/${wl.id}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(wl.id);
      expect(response.body.title).toBe('My List');
    });

    it('should update a wishlist', async () => {
      const wl = await models.Wishlist.create({ title: 'Old Title' });
      const response = await request.put(`/wishlist/${wl.id}`).send({ title: 'New Title' });
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('New Title');

      const updated = await models.Wishlist.findByPk(wl.id);
      expect(updated.title).toBe('New Title');
    });

    it('should return 404 when updating non-existent wishlist', async () => {
      const response = await request.put('/wishlist/999').send({ title: 'Title' });
      expect(response.status).toBe(404);
    });

    it('should delete a wishlist', async () => {
      const wl = await models.Wishlist.create({ title: 'To Delete' });
      const response = await request.delete(`/wishlist/${wl.id}`);
      expect(response.status).toBe(204);

      const found = await models.Wishlist.findByPk(wl.id);
      expect(found).toBeNull();
    });
  });

  describe('Wishes', () => {
    let wishlist;
    beforeEach(async () => {
      wishlist = await models.Wishlist.create({ title: 'Main List' });
    });

    it('should add a wish to a wishlist', async () => {
      const response = await request.post(`/wishlist/${wishlist.id}/wish`).send({
        title: 'Bike',
        quantity: 1
      });
      expect(response.status).toBe(200);
      expect(response.body.Wishes.length).toBe(1);
      expect(response.body.Wishes[0].title).toBe('Bike');
      expect(response.body.Wishes[0].quantity).toBe(1);
    });

    it('should return 404 when adding a wish to non-existent wishlist', async () => {
      const response = await request.post('/wishlist/999/wish').send({ title: 'Bike', quantity: 1 });
      expect(response.status).toBe(404);
    });

    it('should retrieve all wishes', async () => {
      await wishlist.createWish({ title: 'Car', quantity: 1 });
      await wishlist.createWish({ title: 'House', quantity: 1 });

      const response = await request.get('/wish');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('should get a specific wish by id', async () => {
      const wish = await wishlist.createWish({ title: 'Pen', quantity: 5 });
      const response = await request.get(`/wish/${wish.id}`);
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Pen');
      expect(response.body.quantity).toBe(5);
    });

    it('should update a wish', async () => {
      const wish = await wishlist.createWish({ title: 'Book', quantity: 1 });
      const response = await request.put(`/wish/${wish.id}`).send({
        title: 'Notebook',
        quantity: 2
      });
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Notebook');
      expect(response.body.quantity).toBe(2);
    });

    it('should return 404 when updating non-existent wish', async () => {
      const response = await request.put('/wish/999').send({ title: 'A', quantity: 1 });
      expect(response.status).toBe(404);
    });

    it('should delete a wish', async () => {
      const wish = await wishlist.createWish({ title: 'Eraser', quantity: 1 });
      const response = await request.delete(`/wish/${wish.id}`);
      expect(response.status).toBe(204);

      const found = await models.Wish.findByPk(wish.id);
      expect(found).toBeNull();
    });
  });
});