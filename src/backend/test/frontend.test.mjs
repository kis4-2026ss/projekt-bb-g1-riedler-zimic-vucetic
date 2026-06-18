import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const frontendRoot = new URL('../../frontend/', import.meta.url);

async function readFrontendFile(name) {
  return readFile(new URL(name, frontendRoot), 'utf8');
}

function getIds(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
}

test('index.html wires the expected frontend assets and application containers', async () => {
  const html = await readFrontendFile('index.html');

  assert.match(html, /<html lang="de"/);
  assert.match(html, /<link rel="stylesheet" href="styles\.css"/);
  assert.match(html, /<script src="app\.js"><\/script>/);
  assert.match(html, /<main id="main" class="main"/);
  assert.match(html, /<dialog class="dialog" id="wishlistDialog"/);
  assert.match(html, /<dialog class="dialog" id="createDialog"/);
});

test('all DOM ids accessed by app.js exist in index.html', async () => {
  const [html, script] = await Promise.all([
    readFrontendFile('index.html'),
    readFrontendFile('app.js')
  ]);
  const ids = getIds(html);
  const accessedIds = [...script.matchAll(/document\.getElementById\("([^"]+)"\)/g)]
    .map((match) => match[1]);

  assert.ok(accessedIds.length > 0);
  for (const id of accessedIds) {
    assert.ok(ids.has(id), `Missing DOM id used by app.js: ${id}`);
  }
});

test('frontend defines the controls needed for the main wishlist workflow', async () => {
  const html = await readFrontendFile('index.html');
  const ids = getIds(html);

  for (const id of [
    'filterTitle',
    'sortBy',
    'btnToggleDir',
    'btnCreateWishlist',
    'wishlistList',
    'emptyState',
    'dlgWishlistTitle',
    'btnSaveWishlistTitle',
    'btnDeleteWishlist',
    'newWishTitle',
    'newWishQty',
    'btnAddWish',
    'createWishlistTitle',
    'btnCreateConfirm',
    'toasts'
  ]) {
    assert.ok(ids.has(id), `Missing required UI control: ${id}`);
  }
});

test('app.js targets the documented backend API and protects generated HTML text', async () => {
  const script = await readFrontendFile('app.js');

  assert.match(script, /const API_BASE = "http:\/\/localhost:3000"/);
  assert.match(script, /function escapeHtml\(str\)/);
  assert.match(script, /\.replaceAll\("&", "&amp;"\)/);
  assert.match(script, /\.replaceAll\("<", "&lt;"\)/);
  assert.match(script, /\.replaceAll\(">", "&gt;"\)/);
  assert.match(script, /\.replaceAll\('"', "&quot;"\)/);
  assert.match(script, /\.replaceAll\("'", "&#039;"\)/);
});

test('styles.css contains responsive layout rules for the mobile UI', async () => {
  const css = await readFrontendFile('styles.css');

  assert.match(css, /@media\s*\(max-width:\s*\d+px\)/);
  assert.match(css, /\.sidebar\.show/);
  assert.match(css, /\.mobile-only/);
  assert.match(css, /\.dialog__frame/);
});
