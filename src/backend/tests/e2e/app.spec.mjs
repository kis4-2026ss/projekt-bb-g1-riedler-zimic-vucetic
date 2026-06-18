/**
 * End-to-end tests using Playwright (Chromium).
 * The webServer in playwright.config.mjs starts test-server.mjs which serves
 * both the REST API and the static frontend on http://localhost:3000.
 * Tests run sequentially (workers: 1) and share a single in-memory DB.
 * Each mutating test cleans up its data via the API to keep state stable.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

// ── API helpers ───────────────────────────────────────────────────────────────

const apiPost   = (r, path, data) => r.post(`${API}${path}`, { data }).then(res => res.json());
const apiDelete = (r, path)       => r.delete(`${API}${path}`);
const apiGet    = (r, path)       => r.get(`${API}${path}`).then(res => res.json());

// ── Page load ────────────────────────────────────────────────────────────────

test('page loads with the seeded wishlist visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.wl__title').first()).toContainText('My Fancy Wishlist');
  await expect(page.locator('#statusLine')).toContainText('localhost:3000');
});

test('statistics panel reflects the seeded data correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#statWishlists')).toHaveText('1');
  await expect(page.locator('#statWishes')).toHaveText('1');
  await expect(page.locator('#statAvg')).toHaveText('1.0');
});

// ── Create wishlist ───────────────────────────────────────────────────────────

test('creates a wishlist via the modal dialog – click', async ({ page, request }) => {
  await page.goto('/');
  await page.click('#btnCreateWishlist');
  await expect(page.locator('#createDialog')).toBeVisible();

  await page.fill('#createWishlistTitle', 'E2E: Click Create');
  await page.click('#btnCreateConfirm');

  await expect(page.locator('.wl__title', { hasText: 'E2E: Click Create' })).toBeVisible();

  const lists   = await apiGet(request, '/wishlist');
  const created = lists.find(wl => wl.title === 'E2E: Click Create');
  if (created) await apiDelete(request, `/wishlist/${created.id}`);
});

test('creates a wishlist via the modal dialog – Enter key', async ({ page, request }) => {
  await page.goto('/');
  await page.click('#btnCreateWishlist');
  await page.fill('#createWishlistTitle', 'E2E: Enter Create');
  await page.press('#createWishlistTitle', 'Enter');

  await expect(page.locator('.wl__title', { hasText: 'E2E: Enter Create' })).toBeVisible();

  const lists   = await apiGet(request, '/wishlist');
  const created = lists.find(wl => wl.title === 'E2E: Enter Create');
  if (created) await apiDelete(request, `/wishlist/${created.id}`);
});

// ── Wishlist dialog – add wish ────────────────────────────────────────────────

test('opens a wishlist dialog and adds a new wish', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'E2E: Add Wish List' });
  await page.goto('/');

  await page.click(`[data-open="${wl.id}"]`);
  await expect(page.locator('#wishlistDialog')).toBeVisible();

  await page.fill('#newWishTitle', 'E2E Wish');
  await page.fill('#newWishQty',   '4');
  await page.click('#btnAddWish');

  await expect(page.locator('#dlgWishes .wish')).toHaveCount(1);
  await expect(page.locator('#dlgWishes .wish input[type="text"]').first()).toHaveValue('E2E Wish');

  await apiDelete(request, `/wishlist/${wl.id}`);
});

// ── Wishlist dialog – update wish ─────────────────────────────────────────────

test('updates a wish title inside the dialog and shows a toast', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'E2E: Update Wish List' });
  await apiPost(request, `/wishlist/${wl.id}/wish`, { title: 'Original', quantity: 1 });

  await page.goto('/');
  await page.click(`[data-open="${wl.id}"]`);
  await expect(page.locator('#wishlistDialog')).toBeVisible();

  await page.locator('#dlgWishes .wish input[type="text"]').first().fill('Updated');
  await page.locator('#dlgWishes .wish [data-save]').first().click();

  await expect(page.locator('.toast')).toBeVisible();

  await apiDelete(request, `/wishlist/${wl.id}`);
});

// ── Wishlist dialog – rename via dialog title input ───────────────────────────

test('renames a wishlist via the title input inside the dialog', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'E2E: Old Name' });
  await page.goto('/');

  await page.click(`[data-open="${wl.id}"]`);
  await expect(page.locator('#wishlistDialog')).toBeVisible();

  await page.fill('#dlgWishlistTitle', 'E2E: New Name');
  await page.click('#btnSaveWishlistTitle');

  await expect(page.locator('.toast')).toBeVisible();

  await apiDelete(request, `/wishlist/${wl.id}`);
});

// ── Filter ────────────────────────────────────────────────────────────────────

test('filter input narrows visible cards and is case-insensitive', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'FilterTarget XYZ' });
  await page.goto('/');

  await page.fill('#filterTitle', 'filtertarget');
  await expect(page.locator('.wl')).toHaveCount(1);
  await expect(page.locator('.wl__title')).toContainText('FilterTarget XYZ');

  await apiDelete(request, `/wishlist/${wl.id}`);
});

test('empty state is visible when no wishlist matches the filter', async ({ page }) => {
  await page.goto('/');
  await page.fill('#filterTitle', 'ZZZNOMATCH999');
  await expect(page.locator('#emptyState')).toBeVisible();
});

// ── Sort ──────────────────────────────────────────────────────────────────────

test('toggling sort direction reverses the card order', async ({ page, request }) => {
  const wlA = await apiPost(request, '/wishlist', { title: 'Zzz Last' });
  const wlB = await apiPost(request, '/wishlist', { title: 'Aaa First' });
  await page.goto('/');

  await page.selectOption('#sortBy', 'title');
  const before = await page.locator('.wl__title').allTextContents();

  await page.click('#btnToggleDir');
  const after = await page.locator('.wl__title').allTextContents();

  expect(after).not.toEqual(before);
  expect([...after].sort()).toEqual([...before].sort());

  await apiDelete(request, `/wishlist/${wlA.id}`);
  await apiDelete(request, `/wishlist/${wlB.id}`);
});

// ── Delete wishlist ───────────────────────────────────────────────────────────

test('deletes a wishlist after the browser confirm dialog is accepted', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'E2E: Delete Me' });
  await page.goto('/');

  page.once('dialog', dialog => dialog.accept());
  await page.click(`[data-delete="${wl.id}"]`);

  await expect(page.locator(`.wl__title:text("E2E: Delete Me")`)).toHaveCount(0);
});
