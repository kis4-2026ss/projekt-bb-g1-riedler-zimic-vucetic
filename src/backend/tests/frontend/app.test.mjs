// @vitest-environment jsdom
/**
 * Frontend tests for src/frontend/app.js.
 * app.js is a browser script (no ES-module exports), so it is evaluated in the
 * jsdom window scope.  Function declarations become window properties and can
 * be called directly in tests.  let/const module-level state is controlled
 * indirectly through the mocked fetch responses and DOM events.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const APP_SRC = readFileSync(join(__dir, '../../../frontend/app.js'), 'utf-8');

// ── DOM fixture ───────────────────────────────────────────────────────────────

const DOM = `
  <ul id="wishlistList"></ul>
  <div id="emptyState" hidden></div>
  <span id="statusLine"></span>
  <div id="chips"></div>
  <nav class="sidebar"></nav>
  <input id="filterTitle" type="text" />
  <select id="sortBy">
    <option value="createdAt">Datum</option>
    <option value="title">Titel</option>
  </select>
  <button id="btnToggleDir">↓ Absteigend</button>
  <button id="btnBurger">☰</button>
  <button id="btnCreateWishlist">Neu</button>
  <button id="btnCreateWishlistMobile">Neu</button>
  <span id="statWishlists">0</span>
  <span id="statWishes">0</span>
  <span id="statAvg">–</span>
  <ul id="topWishes"></ul>
  <dialog id="wishlistDialog"></dialog>
  <h2 id="dlgTitle"></h2>
  <p id="dlgMeta"></p>
  <input id="dlgWishlistTitle" />
  <button id="btnSaveWishlistTitle"></button>
  <button id="btnDeleteWishlist"></button>
  <ul id="dlgWishes"></ul>
  <input id="newWishTitle" />
  <input id="newWishQty" type="number" value="1" />
  <button id="btnAddWish"></button>
  <dialog id="createDialog"></dialog>
  <input id="createWishlistTitle" />
  <button id="btnCreateConfirm"></button>
  <div id="toasts"></div>
`;

// ── Test data ─────────────────────────────────────────────────────────────────

const WISHLISTS = [
  {
    id: 1, title: 'Geburtstag',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    Wishes: [
      { id: 1, title: 'Buch',  quantity: 2, WishlistId: 1 },
      { id: 2, title: 'Stift', quantity: 5, WishlistId: 1 },
    ],
  },
  {
    id: 2, title: 'Weihnachten',
    createdAt: '2024-12-01T10:00:00.000Z',
    updatedAt: '2024-12-01T10:00:00.000Z',
    Wishes: [
      { id: 3, title: 'Buch', quantity: 1, WishlistId: 2 },
    ],
  },
  {
    id: 3, title: 'Ostern',
    createdAt: '2024-04-01T10:00:00.000Z',
    updatedAt: '2024-04-01T10:00:00.000Z',
    Wishes: [],
  },
];

function mockFetch(data) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(''),
  });
}

// ── One-time setup ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  document.body.innerHTML = DOM;
  global.confirm = vi.fn().mockReturnValue(true);
  global.prompt  = vi.fn().mockReturnValue(null);
  mockFetch(WISHLISTS);

  // Execute app.js in the global (window) scope.
  // Function declarations become window properties.
  window.eval(APP_SRC);

  // Allow the async IIFE (fetchAll) to complete.
  await new Promise(r => setTimeout(r, 100));
});

beforeEach(async () => {
  // Reset filter and sort state via DOM events (same path as real user actions).
  const filterEl = document.getElementById('filterTitle');
  filterEl.value = '';
  filterEl.dispatchEvent(new Event('input'));

  const sortEl = document.getElementById('sortBy');
  sortEl.value = 'createdAt';
  sortEl.dispatchEvent(new Event('change'));

  mockFetch(WISHLISTS);
  await window.fetchAll();
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('safeText – null / falsy safety', () => {
  it('returns "" for null', () => expect(window.safeText(null)).toBe(''));
  it('returns "" for undefined', () => expect(window.safeText(undefined)).toBe(''));
  it('converts 0 to "0"', () => expect(window.safeText(0)).toBe('0'));
  it('converts a positive number to its string form', () => expect(window.safeText(42)).toBe('42'));
  it('returns a string unchanged', () => expect(window.safeText('ok')).toBe('ok'));
});

describe('escapeHtml – XSS prevention', () => {
  it('escapes & → &amp;', () => expect(window.escapeHtml('a&b')).toBe('a&amp;b'));
  it('escapes < and > → &lt; &gt;', () => expect(window.escapeHtml('<p>')).toBe('&lt;p&gt;'));
  it('escapes " → &quot;', () => expect(window.escapeHtml('"x"')).toBe('&quot;x&quot;'));
  it("escapes ' → &#039;", () => expect(window.escapeHtml("it's")).toBe('it&#039;s'));
  it('escapes a full script tag', () =>
    expect(window.escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'));
  it('returns "" for null (via safeText)', () => expect(window.escapeHtml(null)).toBe(''));
  it('leaves plain text unchanged', () => expect(window.escapeHtml('hello')).toBe('hello'));
});

describe('fmtDate – date formatting', () => {
  it('returns a non-empty string for a valid ISO timestamp', () => {
    const r = window.fmtDate('2024-06-15T12:00:00.000Z');
    expect(typeof r).toBe('string');
    expect(r).not.toBe('–');
  });
  it('returns "–" for null', () => expect(window.fmtDate(null)).toBe('–'));
  it('returns "–" for undefined', () => expect(window.fmtDate(undefined)).toBe('–'));
  it('returns "–" for an empty string', () => expect(window.fmtDate('')).toBe('–'));
  it('does not throw for an invalid date string', () => {
    expect(() => window.fmtDate('not-a-date')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe('render – wishlist cards', () => {
  it('renders exactly one card per wishlist', () => {
    expect(document.querySelectorAll('.wl')).toHaveLength(WISHLISTS.length);
  });

  it('displays each wishlist title in a card heading', () => {
    const titles = [...document.querySelectorAll('.wl__title')].map(el => el.textContent.trim());
    expect(titles).toContain('Geburtstag');
    expect(titles).toContain('Weihnachten');
    expect(titles).toContain('Ostern');
  });

  it('hides the empty-state element when wishlists exist', () => {
    expect(document.getElementById('emptyState').hidden).toBe(true);
  });
});

describe('render – statistics', () => {
  it('shows the correct wishlist count (3)', () => {
    expect(document.getElementById('statWishlists').textContent).toBe('3');
  });

  it('shows the correct total wish count (2+1+0 = 3)', () => {
    expect(document.getElementById('statWishes').textContent).toBe('3');
  });

  it('shows the correct average (3 / 3 = 1.0)', () => {
    expect(document.getElementById('statAvg').textContent).toBe('1.0');
  });

  it('ranks "Buch" first in top wishes (appears in 2 lists)', () => {
    expect(document.querySelector('#topWishes li').textContent).toContain('Buch');
  });

  it('shows at most 3 top-wish items', () => {
    expect(document.querySelectorAll('#topWishes li').length).toBeLessThanOrEqual(3);
  });
});

describe('render – empty state', () => {
  it('shows the empty-state element when there are no wishlists', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.getElementById('emptyState').hidden).toBe(false);
  });

  it('shows "–" for the average when the list is empty', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.getElementById('statAvg').textContent).toBe('–');
  });

  it('shows a muted placeholder in the top-wishes list', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.querySelector('#topWishes li.muted')).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER
// ═══════════════════════════════════════════════════════════════════════════════

describe('filter – behaviour', () => {
  function setFilter(value) {
    const el = document.getElementById('filterTitle');
    el.value = value;
    el.dispatchEvent(new Event('input'));
  }

  it('narrows the list to the matching wishlist', () => {
    setFilter('Geburtstag');
    expect(document.querySelectorAll('.wl')).toHaveLength(1);
    expect(document.querySelector('.wl__title').textContent.trim()).toBe('Geburtstag');
  });

  it('is case-insensitive (lower-case filter matches mixed-case title)', () => {
    setFilter('weihnachten');
    expect(document.querySelectorAll('.wl')).toHaveLength(1);
  });

  it('shows the empty state when no items match', () => {
    setFilter('ZZZNOMATCH');
    expect(document.getElementById('emptyState').hidden).toBe(false);
  });

  it('restores all items when the filter is cleared', () => {
    setFilter('Geburtstag');
    setFilter('');
    expect(document.querySelectorAll('.wl')).toHaveLength(3);
  });

  it('adds a chip that reflects the active filter term', () => {
    setFilter('Test');
    const chipTexts = [...document.querySelectorAll('.chip')].map(c => c.textContent);
    expect(chipTexts.some(t => t.includes('Test'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SORT
// ═══════════════════════════════════════════════════════════════════════════════

describe('sort – behaviour', () => {
  it('keeps all cards visible when switching to title sort', () => {
    document.getElementById('sortBy').value = 'title';
    document.getElementById('sortBy').dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('.wl')).toHaveLength(3);
  });

  it('reverses card order when the direction button is toggled', () => {
    const btn = document.getElementById('btnToggleDir');
    const before = [...document.querySelectorAll('.wl__title')].map(e => e.textContent.trim());
    btn.click();
    const after = [...document.querySelectorAll('.wl__title')].map(e => e.textContent.trim());
    // Same titles, different order
    expect([...after].sort()).toEqual([...before].sort());
    expect(after).not.toEqual(before);
    btn.click(); // restore
  });

  it('always shows a sort chip in the chips bar', () => {
    const chips = document.querySelectorAll('.chip');
    const sortChip = [...chips].find(c => c.textContent.startsWith('Sortierung:'));
    expect(sortChip).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS LINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('fetchAll – status line', () => {
  it('shows a "connected" message after a successful fetch', async () => {
    await window.fetchAll();
    expect(document.getElementById('statusLine').textContent).toContain('localhost:3000');
  });

  it('shows an error message and applies danger colour on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));
    await window.fetchAll();
    const el = document.getElementById('statusLine');
    expect(el.textContent).toContain('Backend nicht erreichbar');
    expect(el.style.color).toContain('var(--danger)');
  });
});
