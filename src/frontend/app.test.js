// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');
const appJsCode = fs.readFileSync(path.resolve(__dirname, 'app.js'), 'utf8');

describe('Frontend App', () => {
  beforeEach(() => {
    // Reset the DOM
    document.documentElement.innerHTML = html.toString();
    
    // Mock global fetch
    window.fetch = vi.fn();
    global.fetch = window.fetch;

    // Log any errors that occur in JSDOM
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      process.stdout.write(`[CONSOLE ERROR] ${args.join(' ')}\n`);
    });

    
    // Mock HTMLDialogElement methods missing in jsdom
    HTMLDialogElement.prototype.showModal = vi.fn(function() { 
      this.open = true; 
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function() { 
      this.open = false; 
      this.removeAttribute('open');
    });

    // Mock window.prompt and window.confirm
    window.prompt = vi.fn();
    window.confirm = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  const loadApp = () => {
    // Remove existing script tags to prevent duplicate execution attempts
    document.querySelectorAll('script').forEach(s => s.remove());

    // Evaluate the application code in the current test context
    // This allows it to natively use the vitest mocked global fetch
    eval(appJsCode);
  };

  it('should fetch and display wishlists on initial load', async () => {
    const mockWishlists = [
      { id: 1, title: 'Birthday', createdAt: new Date().toISOString(), Wishes: [] },
      { id: 2, title: 'Christmas', createdAt: new Date().toISOString(), Wishes: [{ title: 'Socks', quantity: 2 }] }
    ];
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockWishlists
    });

    loadApp();
    
    // Wait for the asynchronous fetchAll to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    const listElement = document.getElementById('wishlistList');
    console.log('LIST HTML:', listElement.outerHTML);
    console.log('EMPTY HTML:', document.getElementById('emptyState').outerHTML);
    expect(listElement.children.length).toBe(2);
    expect(listElement.innerHTML).toContain('Birthday');
    expect(listElement.innerHTML).toContain('Christmas');
    
    const statWishlists = document.getElementById('statWishlists');
    expect(statWishlists.textContent).toBe('2');
    
    const statWishes = document.getElementById('statWishes');
    expect(statWishes.textContent).toBe('1');
  });

  it('should show empty state when no wishlists exist', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    loadApp();
    await new Promise(resolve => setTimeout(resolve, 50));

    const emptyState = document.getElementById('emptyState');
    expect(emptyState.hidden).toBe(false);
  });

  it('should handle backend connection errors gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    loadApp();
    await new Promise(resolve => setTimeout(resolve, 50));

    const statusLine = document.getElementById('statusLine');
    expect(statusLine.textContent).toContain('Backend nicht erreichbar');
    expect(statusLine.style.color).toBe('var(--danger)');
  });

  it('should open create dialog when clicking "Neue Wunschliste"', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    loadApp();
    await new Promise(resolve => setTimeout(resolve, 50));

    const btn = document.getElementById('btnCreateWishlist');
    btn.click();

    const dialog = document.getElementById('createDialog');
    expect(dialog.showModal).toHaveBeenCalled();
  });

  it('should create a new wishlist via dialog and refresh the list', async () => {
    // 1st fetch: initial load
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    loadApp();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Open dialog
    document.getElementById('btnCreateWishlist').click();
    
    // Enter title
    const input = document.getElementById('createWishlistTitle');
    input.value = 'New Awesome List';

    // 2nd fetch: POST new wishlist
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 3, title: 'New Awesome List' })
    });
    
    // 3rd fetch: fetchAll after creation
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 3, title: 'New Awesome List', Wishes: [] }]
    });

    // 4th fetch: fetch newly created wishlist to open its dialog
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 3, title: 'New Awesome List', Wishes: [] })
    });

    const confirmBtn = document.getElementById('btnCreateConfirm');
    confirmBtn.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/wishlist', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'New Awesome List' })
    }));

    const listElement = document.getElementById('wishlistList');
    expect(listElement.innerHTML).toContain('New Awesome List');
  });
});
