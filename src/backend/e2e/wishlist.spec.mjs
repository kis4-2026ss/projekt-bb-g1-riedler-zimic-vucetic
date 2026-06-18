import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('WishBox End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the index.html file using the file:// protocol
    const htmlPath = path.resolve('../frontend/index.html');
    await page.goto(`file://${htmlPath}`);
  });

  test('should display page title and loaded seeded stats', async ({ page }) => {
    // Verify the page title
    await expect(page.locator('.brand__title')).toHaveText('WishBox');

    // Wait for the status line to show that backend connection is ok
    await expect(page.locator('#statusLine')).toContainText('Verbunden mit Backend');

    // Verify seeded stats (with DB seeded in the webServer background)
    await expect(page.locator('#statWishlists')).toHaveText('1');
    await expect(page.locator('#statWishes')).toHaveText('1');
    await expect(page.locator('#statAvg')).toHaveText('1.0');

    // Verify wishlist title in the list
    await expect(page.locator('.wl__title', { hasText: 'My Fancy Wishlist' })).toBeVisible();
  });

  test('should create a new wishlist and automatically open its dialog', async ({ page }) => {
    // Click button to open create dialog
    await page.locator('#btnCreateWishlist').click();

    // The dialog #createDialog should be visible
    const createDlg = page.locator('#createDialog');
    await expect(createDlg).toBeVisible();

    // Fill in the title
    await page.locator('#createWishlistTitle').fill('My E2E Wishlist');

    // Click confirm button
    await page.locator('#btnCreateConfirm').click();

    // The create dialog should close
    await expect(createDlg).not.toBeVisible();

    // Creating a wishlist automatically opens the details dialog for it
    const detailsDlg = page.locator('#wishlistDialog');
    await expect(detailsDlg).toBeVisible();

    // Verify details dialog title
    await expect(page.locator('#dlgTitle')).toContainText('Wunschliste #');
    await expect(page.locator('#dlgWishlistTitle')).toHaveValue('My E2E Wishlist');

    // Clean up: Delete this wishlist directly from the dialog to leave DB clean
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('#btnDeleteWishlist').click();
    await expect(detailsDlg).not.toBeVisible();

    // Verify it is no longer in the list
    await expect(page.locator('.wl__title', { hasText: 'My E2E Wishlist' })).not.toBeVisible();
  });

  test('should filter the wishlist list by title', async ({ page }) => {
    // Create a second wishlist first to test filtering
    await page.locator('#btnCreateWishlist').click();
    await page.locator('#createWishlistTitle').fill('Christmas List');
    await page.locator('#btnCreateConfirm').click();
    await page.locator('#btnCloseDialog').click();

    // Verify that "My Fancy Wishlist" (seeded) and "Christmas List" are visible
    await expect(page.locator('.wl__title', { hasText: 'Christmas List' })).toBeVisible();
    await expect(page.locator('.wl__title', { hasText: 'My Fancy Wishlist' })).toBeVisible();

    // Type "Christmas" in the filter input
    await page.locator('#filterTitle').fill('Christmas');

    // Only "Christmas List" should be shown
    await expect(page.locator('.wl__title', { hasText: 'Christmas List' })).toBeVisible();
    await expect(page.locator('.wl__title', { hasText: 'My Fancy Wishlist' })).not.toBeVisible();

    // Type a title that doesn't exist
    await page.locator('#filterTitle').fill('Non-existent-xyz');
    await expect(page.locator('#emptyState')).toBeVisible();

    // Clear filter
    await page.locator('#filterTitle').fill('');

    // Clean up: delete "Christmas List"
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('.wl', { has: page.locator('.wl__title', { hasText: 'Christmas List' }) })
              .locator('text=Löschen').click();

    // Verify it is removed
    await expect(page.locator('.wl__title', { hasText: 'Christmas List' })).not.toBeVisible();
  });

  test('should add, update, and delete wishes in a wishlist', async ({ page }) => {
    // Open "My Fancy Wishlist" dialog specifically
    await page.locator('.wl', { has: page.locator('.wl__title', { hasText: 'My Fancy Wishlist' }) })
              .locator('text=Öffnen').click();

    const detailsDlg = page.locator('#wishlistDialog');
    await expect(detailsDlg).toBeVisible();

    // Check if the seeded wish "Leberkaassemmeln (3)" is shown
    await expect(page.locator('#dlgWishes >> li')).toHaveCount(1);
    const wishTitleInput = page.locator('#dlgWishes >> li >> input[aria-label="Wunsch Titel"]');
    const wishQtyInput = page.locator('#dlgWishes >> li >> input[aria-label="Menge"]');
    await expect(wishTitleInput).toHaveValue('Leberkaassemmeln');
    await expect(wishQtyInput).toHaveValue('3');

    // Add a new wish
    await page.locator('#newWishTitle').fill('PlayStation 5');
    await page.locator('#newWishQty').fill('1');
    await page.locator('#btnAddWish').click();

    // Check that there are now 2 wishes
    await expect(page.locator('#dlgWishes >> li')).toHaveCount(2);

    // Update the quantity of the newly added wish (the second one)
    const secondQtyInput = page.locator('#dlgWishes >> li >> input[aria-label="Menge"]').nth(1);
    await secondQtyInput.fill('2');
    await page.locator('#dlgWishes >> li >> text=Speichern').nth(1).click();

    // Close the dialog and open it again to verify persistence
    await page.locator('#btnCloseDialog').click();
    await page.locator('.wl', { has: page.locator('.wl__title', { hasText: 'My Fancy Wishlist' }) })
              .locator('text=Öffnen').click();
    await expect(page.locator('#dlgWishes >> li')).toHaveCount(2);
    await expect(page.locator('#dlgWishes >> li >> input[aria-label="Menge"]').nth(1)).toHaveValue('2');

    // Delete the second wish to restore the DB to original seeded state
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('#dlgWishes >> li >> text=Löschen').nth(1).click();
    await expect(page.locator('#dlgWishes >> li')).toHaveCount(1);

    // Close the dialog
    await page.locator('#btnCloseDialog').click();
  });

  test('should rename and delete a wishlist', async ({ page }) => {
    // Create a new wishlist to rename and delete
    await page.locator('#btnCreateWishlist').click();
    await page.locator('#createWishlistTitle').fill('List to Delete');
    await page.locator('#btnCreateConfirm').click();

    const detailsDlg = page.locator('#wishlistDialog');
    await expect(detailsDlg).toBeVisible();

    // Rename the wishlist
    const titleInput = page.locator('#dlgWishlistTitle');
    await titleInput.fill('Renamed Delete List');
    await page.locator('#btnSaveWishlistTitle').click();

    // Close dialog and verify rename in list
    await page.locator('#btnCloseDialog').click();
    await expect(page.locator('.wl__title', { hasText: 'Renamed Delete List' })).toBeVisible();

    // Delete the wishlist
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.locator('.wl', { has: page.locator('.wl__title', { hasText: 'Renamed Delete List' }) })
              .locator('text=Löschen').click();

    // Verify it is removed
    await expect(page.locator('.wl__title', { hasText: 'Renamed Delete List' })).not.toBeVisible();
  });
});
