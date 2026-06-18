/**
 * End-to-end tests for the Wishlist application using Playwright.
 * The test server (test-server.mjs) serves both the REST API and the
 * static frontend from http://localhost:3000.
 *
 * Tests run sequentially (workers: 1) and share the same in-memory DB.
 * Each test that mutates data cleans up via the API to keep state stable.
 */
import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiGet(request, path) {
  const res = await request.get(`http://localhost:3000${path}`);
  return res.json();
}

async function apiPost(request, path, data) {
  const res = await request.post(`http://localhost:3000${path}`, { data });
  return res.json();
}

async function apiDelete(request, path) {
  await request.delete(`http://localhost:3000${path}`);
}

// ── Page load & seeded data ───────────────────────────────────────────────────

test('page loads and displays the seeded wishlist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.wl__title').first()).toBeVisible();
  await expect(page.locator('.wl__title').first()).toContainText('My Fancy Wishlist');
});

test('statistics reflect the seeded data (1 list, 1 wish, avg 1.0)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#statWishlists')).toHaveText('1');
  await expect(page.locator('#statWishes')).toHaveText('1');
  await expect(page.locator('#statAvg')).toHaveText('1.0');
});

test('status line shows connection to backend', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#statusLine')).toContainText('localhost:3000');
});

// ── Create wishlist ───────────────────────────────────────────────────────────

test('creates a new wishlist via the dialog and shows it in the list', async ({ page, request }) => {
  await page.goto('/');

  await page.click('#btnCreateWishlist');
  await expect(page.locator('#createDialog')).toBeVisible();

  await page.fill('#createWishlistTitle', 'E2E Test List');
  await page.click('#btnCreateConfirm');

  await expect(page.locator('.wl__title', { hasText: 'E2E Test List' })).toBeVisible();

  // Cleanup
  const lists = await apiGet(request, '/wishlist');
  const created = lists.find(wl => wl.title === 'E2E Test List');
  if (created) await apiDelete(request, `/wishlist/${created.id}`);
});

test('pressing Enter in the create-title input submits the form', async ({ page, request }) => {
  await page.goto('/');

  await page.click('#btnCreateWishlist');
  await page.fill('#createWishlistTitle', 'Enter Submit List');
  await page.press('#createWishlistTitle', 'Enter');

  await expect(page.locator('.wl__title', { hasText: 'Enter Submit List' })).toBeVisible();

  // Cleanup
  const lists = await apiGet(request, '/wishlist');
  const created = lists.find(wl => wl.title === 'Enter Submit List');
  if (created) await apiDelete(request, `/wishlist/${created.id}`);
});

// ── Open wishlist dialog & add wish ──────────────────────────────────────────

test('opens the wishlist dialog and adds a new wish', async ({ page, request }) => {
  // Create a fresh list for this test
  const wl = await apiPost(request, '/wishlist', { title: 'Dialog Test List' });

  await page.goto('/');
  await page.click(`[data-open="${wl.id}"]`);
  await expect(page.locator('#wishlistDialog')).toBeVisible();

  await page.fill('#newWishTitle', 'New Wish Item');
  await page.fill('#newWishQty', '3');
  await page.click('#btnAddWish');

  // Dialog refreshes – new wish should appear
  const wishItems = page.locator('#dlgWishes .wish');
  await expect(wishItems).toHaveCount(1);

  const titleInput = wishItems.locator('input[type="text"]').first();
  await expect(titleInput).toHaveValue('New Wish Item');

  // Cleanup
  await apiDelete(request, `/wishlist/${wl.id}`);
});

test('updates a wish title inside the dialog', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'Update Wish List' });
  await apiPost(request, `/wishlist/${wl.id}/wish`, { title: 'Original', quantity: 1 });

  await page.goto('/');
  await page.click(`[data-open="${wl.id}"]`);
  await expect(page.locator('#wishlistDialog')).toBeVisible();

  const titleInput = page.locator('#dlgWishes .wish input[type="text"]').first();
  await titleInput.fill('Updated Wish');
  await page.locator('#dlgWishes .wish [data-save]').first().click();

  // Toast confirms save
  await expect(page.locator('.toast')).toBeVisible();

  // Cleanup
  await apiDelete(request, `/wishlist/${wl.id}`);
});

// ── Filter ────────────────────────────────────────────────────────────────────

test('filter narrows the visible wishlist cards', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'FilterMe XYZ' });

  await page.goto('/');
  await page.fill('#filterTitle', 'FilterMe');

  await expect(page.locator('.wl')).toHaveCount(1);
  await expect(page.locator('.wl__title')).toContainText('FilterMe XYZ');

  // Cleanup
  await apiDelete(request, `/wishlist/${wl.id}`);
});

test('filter shows empty state when nothing matches', async ({ page }) => {
  await page.goto('/');
  await page.fill('#filterTitle', 'ZZZNOMATCH999');
  await expect(page.locator('#emptyState')).toBeVisible();
});

// ── Sort ──────────────────────────────────────────────────────────────────────

test('sort direction toggle reverses the card order', async ({ page, request }) => {
  // Create two lists with predictable titles for ordering
  const wl2 = await apiPost(request, '/wishlist', { title: 'Zebra List' });
  const wl3 = await apiPost(request, '/wishlist', { title: 'Apple List' });

  await page.goto('/');

  // Switch to title sort
  await page.selectOption('#sortBy', 'title');
  const titlesBefore = await page.locator('.wl__title').allTextContents();

  // Toggle direction
  await page.click('#btnToggleDir');
  const titlesAfter = await page.locator('.wl__title').allTextContents();

  expect(titlesAfter).not.toEqual(titlesBefore);
  expect([...titlesAfter].sort()).toEqual([...titlesBefore].sort()); // same items

  // Cleanup
  await apiDelete(request, `/wishlist/${wl2.id}`);
  await apiDelete(request, `/wishlist/${wl3.id}`);
});

// ── Delete wishlist ───────────────────────────────────────────────────────────

test('deletes a wishlist after confirming the browser dialog', async ({ page, request }) => {
  const wl = await apiPost(request, '/wishlist', { title: 'Delete Me E2E' });

  await page.goto('/');

  // Accept the confirm() dialog
  page.once('dialog', dialog => dialog.accept());
  await page.click(`[data-delete="${wl.id}"]`);

  await expect(page.locator('.wl__title', { hasText: 'Delete Me E2E' })).toHaveCount(0);
});
