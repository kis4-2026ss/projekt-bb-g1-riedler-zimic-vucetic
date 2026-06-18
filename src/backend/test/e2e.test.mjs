import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './helpers.mjs';

const frontendRoot = normalize(fileURLToPath(new URL('../../frontend/', import.meta.url)));

function createStaticFrontendServer() {
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  };

  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = normalize(join(frontendRoot, requestedPath));

    if (!filePath.startsWith(frontendRoot)) {
      response.writeHead(403).end();
      return;
    }

    const stream = createReadStream(filePath);
    stream.on('error', () => {
      response.writeHead(404).end();
    });
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream'
    });
    stream.pipe(response);
  });

  return server;
}

async function startServer(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

test('frontend entrypoint and assets are reachable from a static server', async () => {
  const staticServer = createStaticFrontendServer();

  try {
    const baseUrl = await startServer(staticServer);

    const indexResponse = await fetch(`${baseUrl}/`);
    const indexHtml = await indexResponse.text();
    assert.equal(indexResponse.status, 200);
    assert.match(indexHtml, /<title>WishBox<\/title>/);
    assert.match(indexHtml, /<script src="app\.js"><\/script>/);
    assert.match(indexHtml, /<link rel="stylesheet" href="styles\.css"/);

    const [appResponse, cssResponse] = await Promise.all([
      fetch(`${baseUrl}/app.js`),
      fetch(`${baseUrl}/styles.css`)
    ]);

    assert.equal(appResponse.status, 200);
    assert.equal(cssResponse.status, 200);
    assert.match(await appResponse.text(), /const API_BASE = "http:\/\/localhost:3000"/);
    assert.match(await cssResponse.text(), /\.site-header/);
  } finally {
    await closeServer(staticServer);
  }
});

test('end-to-end wishlist workflow works through the same HTTP API used by the frontend', async () => {
  const backend = await createTestServer();

  try {
    const createdList = await backend.request('/wishlist', {
      method: 'POST',
      body: { title: 'E2E Wishlist' }
    });
    assert.equal(createdList.response.status, 200);

    const listId = createdList.body.id;
    const createdWish = await backend.request(`/wishlist/${listId}/wish`, {
      method: 'POST',
      body: { title: 'E2E Present', quantity: 2 }
    });
    assert.equal(createdWish.body.Wishes.length, 1);

    const renamedList = await backend.request(`/wishlist/${listId}`, {
      method: 'PUT',
      body: { title: 'E2E Wishlist Renamed' }
    });
    assert.equal(renamedList.body.title, 'E2E Wishlist Renamed');

    const wishId = createdWish.body.Wishes[0].id;
    const updatedWish = await backend.request(`/wish/${wishId}`, {
      method: 'PUT',
      body: { title: 'E2E Present Updated', quantity: 5 }
    });
    assert.equal(updatedWish.body.quantity, 5);

    const finalList = await backend.request(`/wishlist/${listId}`);
    assert.equal(finalList.body.title, 'E2E Wishlist Renamed');
    assert.equal(finalList.body.Wishes[0].title, 'E2E Present Updated');

    await backend.request(`/wish/${wishId}`, { method: 'DELETE' });
    await backend.request(`/wishlist/${listId}`, { method: 'DELETE' });

    const remainingWishlists = await backend.request('/wishlist');
    const remainingWishes = await backend.request('/wish');
    assert.equal(remainingWishlists.body.length, 0);
    assert.equal(remainingWishes.body.length, 0);
  } finally {
    await backend.close();
  }
});

test('frontend source contains the controls used for the main user flows', async () => {
  const [indexHtml, appJs] = await Promise.all([
    readFile(new URL('../../frontend/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../frontend/app.js', import.meta.url), 'utf8')
  ]);

  assert.match(indexHtml, /id="btnCreateWishlist"/);
  assert.match(indexHtml, /id="filterTitle"/);
  assert.match(indexHtml, /id="sortBy"/);
  assert.match(indexHtml, /id="btnAddWish"/);

  assert.match(appJs, /async function createWishlist\(\)/);
  assert.match(appJs, /async function addWish\(\)/);
  assert.match(appJs, /async function saveWishlistTitle\(\)/);
  assert.match(appJs, /async function deleteWishlist\(id\)/);
});
