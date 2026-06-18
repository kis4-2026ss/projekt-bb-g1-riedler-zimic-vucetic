// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(join(__dir, '../../frontend/app.js'), 'utf-8');

// ── DOM fixture ───────────────────────────────────────────────────────────────

const DOM_FIXTURE = `
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

// ── Sample data ────────────────────────────────────────────────────────────────

const WISHLISTS = [
  {
    id: 1,
    title: 'Geburtstag',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    Wishes: [
      { id: 1, title: 'Buch', quantity: 2, WishlistId: 1 },
      { id: 2, title: 'Stift', quantity: 5, WishlistId: 1 },
    ],
  },
  {
    id: 2,
    title: 'Weihnachten',
    createdAt: '2024-12-01T10:00:00.000Z',
    updatedAt: '2024-12-01T10:00:00.000Z',
    Wishes: [
      { id: 3, title: 'Buch', quantity: 1, WishlistId: 2 },
    ],
  },
  {
    id: 3,
    title: 'Ostern',
    createdAt: '2024-04-01T10:00:00.000Z',
    updatedAt: '2024-04-01T10:00:00.000Z',
    Wishes: [],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(data) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(''),
  });
}

// ── One-time setup ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  document.body.innerHTML = DOM_FIXTURE;

  global.confirm = vi.fn().mockReturnValue(true);
  global.prompt = vi.fn().mockReturnValue(null);
  mockFetch(WISHLISTS);

  // Execute app.js in the global (window) scope.
  // Function declarations become window properties; let/const do not.
  window.eval(APP_JS);

  // Wait for the auto-init IIFE (fetchAll) to settle.
  await new Promise(r => setTimeout(r, 100));
});

// ── Per-test reset ─────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Reset filter state
  const filterEl = document.getElementById('filterTitle');
  filterEl.value = '';
  filterEl.dispatchEvent(new Event('input'));

  // Reset sort state
  const sortEl = document.getElementById('sortBy');
  sortEl.value = 'createdAt';
  sortEl.dispatchEvent(new Event('change'));

  // Reload data
  mockFetch(WISHLISTS);
  await window.fetchAll();
});

// ── safeText ──────────────────────────────────────────────────────────────────

describe('safeText', () => {
  it('returns empty string for null', () =>
    expect(window.safeText(null)).toBe(''));

  it('returns empty string for undefined', () =>
    expect(window.safeText(undefined)).toBe(''));

  it('converts a number to its string representation', () =>
    expect(window.safeText(42)).toBe('42'));

  it('returns a string as-is', () =>
    expect(window.safeText('hello')).toBe('hello'));

  it('converts boolean true to "true"', () =>
    expect(window.safeText(true)).toBe('true'));
});

// ── escapeHtml ────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersands', () =>
    expect(window.escapeHtml('a&b')).toBe('a&amp;b'));

  it('escapes less-than and greater-than', () =>
    expect(window.escapeHtml('<div>')).toBe('&lt;div&gt;'));

  it('escapes double quotes', () =>
    expect(window.escapeHtml('"hi"')).toBe('&quot;hi&quot;'));

  it('escapes single quotes', () =>
    expect(window.escapeHtml("it's")).toBe('it&#039;s'));

  it('escapes a full XSS string', () =>
    expect(window.escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    ));

  it('returns empty string for null input', () =>
    expect(window.escapeHtml(null)).toBe(''));

  it('leaves a plain string unchanged', () =>
    expect(window.escapeHtml('hello world')).toBe('hello world'));
});

// ── fmtDate ───────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = window.fmtDate('2024-06-15T12:00:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('–');
  });

  it('returns "–" for null', () =>
    expect(window.fmtDate(null)).toBe('–'));

  it('returns "–" for undefined', () =>
    expect(window.fmtDate(undefined)).toBe('–'));

  it('returns "–" for empty string', () =>
    expect(window.fmtDate('')).toBe('–'));

  it('handles an invalid date string without throwing', () => {
    const result = window.fmtDate('not-a-date');
    expect(typeof result).toBe('string');
  });
});

// ── Rendering – wishlist cards ────────────────────────────────────────────────

describe('render – wishlist cards', () => {
  it('renders one card per wishlist', () => {
    const cards = document.querySelectorAll('.wl');
    expect(cards.length).toBe(WISHLISTS.length);
  });

  it('displays all wishlist titles', () => {
    const titles = [...document.querySelectorAll('.wl__title')].map(el => el.textContent.trim());
    expect(titles).toContain('Geburtstag');
    expect(titles).toContain('Weihnachten');
    expect(titles).toContain('Ostern');
  });

  it('hides the empty state when wishlists exist', () => {
    expect(document.getElementById('emptyState').hidden).toBe(true);
  });

  it('shows wish count badge on each card', () => {
    const badges = [...document.querySelectorAll('.badge--ok')];
    expect(badges.length).toBe(WISHLISTS.length);
  });
});

// ── Rendering – stats ─────────────────────────────────────────────────────────

describe('render – stats', () => {
  it('shows the correct wishlist count', () => {
    expect(document.getElementById('statWishlists').textContent).toBe('3');
  });

  it('shows the correct total wish count (2+1+0 = 3)', () => {
    expect(document.getElementById('statWishes').textContent).toBe('3');
  });

  it('shows the correct average (3 / 3 = 1.0)', () => {
    expect(document.getElementById('statAvg').textContent).toBe('1.0');
  });

  it('lists "Buch" first in top wishes (appears in 2 lists)', () => {
    const first = document.querySelector('#topWishes li');
    expect(first.textContent).toContain('Buch');
  });

  it('shows at most 3 top-wish entries', () => {
    const items = document.querySelectorAll('#topWishes li');
    expect(items.length).toBeLessThanOrEqual(3);
  });
});

// ── Rendering – empty state ───────────────────────────────────────────────────

describe('render – empty state', () => {
  it('shows the empty state when there are no wishlists', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.getElementById('emptyState').hidden).toBe(false);
  });

  it('shows "–" for average when there are no wishlists', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.getElementById('statAvg').textContent).toBe('–');
  });

  it('shows 0 total wishes when there are no wishlists', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.getElementById('statWishes').textContent).toBe('0');
  });

  it('shows a muted placeholder in topWishes when empty', async () => {
    mockFetch([]);
    await window.fetchAll();
    const li = document.querySelector('#topWishes li.muted');
    expect(li).not.toBeNull();
  });
});

// ── Filter ────────────────────────────────────────────────────────────────────

describe('filter', () => {
  it('shows only the matching wishlist when a filter is applied', () => {
    const input = document.getElementById('filterTitle');
    input.value = 'Geburtstag';
    input.dispatchEvent(new Event('input'));

    const cards = document.querySelectorAll('.wl');
    expect(cards.length).toBe(1);
    expect(document.querySelector('.wl__title').textContent.trim()).toBe('Geburtstag');
  });

  it('is case-insensitive', () => {
    const input = document.getElementById('filterTitle');
    input.value = 'weihnachten';
    input.dispatchEvent(new Event('input'));

    expect(document.querySelectorAll('.wl').length).toBe(1);
  });

  it('shows all wishlists when the filter is cleared', () => {
    const input = document.getElementById('filterTitle');
    input.value = 'Geburtstag';
    input.dispatchEvent(new Event('input'));
    input.value = '';
    input.dispatchEvent(new Event('input'));

    expect(document.querySelectorAll('.wl').length).toBe(3);
  });

  it('shows the empty state when no wishlists match the filter', () => {
    const input = document.getElementById('filterTitle');
    input.value = 'ZZZNOMATCH';
    input.dispatchEvent(new Event('input'));

    expect(document.getElementById('emptyState').hidden).toBe(false);
  });

  it('adds a filter chip when a filter is active', () => {
    const input = document.getElementById('filterTitle');
    input.value = 'Test';
    input.dispatchEvent(new Event('input'));

    const chipTexts = [...document.querySelectorAll('.chip')].map(c => c.textContent);
    expect(chipTexts.some(t => t.includes('Test'))).toBe(true);
  });
});

// ── Sort ──────────────────────────────────────────────────────────────────────

describe('sort', () => {
  it('renders all wishlists after switching to title sort', () => {
    document.getElementById('sortBy').value = 'title';
    document.getElementById('sortBy').dispatchEvent(new Event('change'));

    expect(document.querySelectorAll('.wl').length).toBe(3);
  });

  it('renders all wishlists after switching back to createdAt sort', () => {
    document.getElementById('sortBy').value = 'createdAt';
    document.getElementById('sortBy').dispatchEvent(new Event('change'));

    expect(document.querySelectorAll('.wl').length).toBe(3);
  });

  it('reverses order when direction button is clicked', () => {
    const btn = document.getElementById('btnToggleDir');
    const titlesBefore = [...document.querySelectorAll('.wl__title')].map(el => el.textContent.trim());
    btn.click();
    const titlesAfter = [...document.querySelectorAll('.wl__title')].map(el => el.textContent.trim());
    // Not all titles should be in the same position after reversal
    expect(titlesAfter).not.toEqual(titlesBefore);
    // Same set of titles, just different order
    expect([...titlesAfter].sort()).toEqual([...titlesBefore].sort());
    // Reset direction
    btn.click();
  });
});

// ── Status line ───────────────────────────────────────────────────────────────

describe('setStatus / fetchAll', () => {
  it('shows a "connected" status after a successful fetch', async () => {
    await window.fetchAll();
    const text = document.getElementById('statusLine').textContent;
    expect(text).toContain('localhost:3000');
  });

  it('shows an error status when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));
    await window.fetchAll();
    const el = document.getElementById('statusLine');
    expect(el.textContent).toContain('Backend nicht erreichbar');
    expect(el.style.color).toContain('var(--danger)');
  });
});

// ── Chips ──────────────────────────────────────────────────────────────────────

describe('chips', () => {
  it('always shows at least one chip (sort chip)', () => {
    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });

  it('shows a sort chip that includes the sort direction', () => {
    const chipTexts = [...document.querySelectorAll('.chip')].map(c => c.textContent);
    const sortChip = chipTexts.find(t => t.startsWith('Sortierung:'));
    expect(sortChip).toBeDefined();
  });
});
