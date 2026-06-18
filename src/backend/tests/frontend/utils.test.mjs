// @vitest-environment jsdom
/**
 * Unit tests for frontend utility functions in src/frontend/app.js.
 * app.js is a browser script without ES-module exports; evaluating it in the
 * jsdom global scope exposes its function declarations on window.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const APP_SRC = readFileSync(join(__dir, '../../../frontend/app.js'), 'utf-8');

// ── Minimal DOM fixture ───────────────────────────────────────────────────────

const DOM = `
  <ul id="wishlistList"></ul><div id="emptyState" hidden></div>
  <span id="statusLine"></span><div id="chips"></div>
  <nav class="sidebar"></nav>
  <input id="filterTitle" type="text" />
  <select id="sortBy"><option value="createdAt">D</option><option value="title">T</option></select>
  <button id="btnToggleDir">↓ Absteigend</button>
  <button id="btnBurger">☰</button>
  <button id="btnCreateWishlist"></button>
  <button id="btnCreateWishlistMobile"></button>
  <span id="statWishlists">0</span><span id="statWishes">0</span><span id="statAvg">–</span>
  <ul id="topWishes"></ul>
  <dialog id="wishlistDialog"></dialog>
  <h2 id="dlgTitle"></h2><p id="dlgMeta"></p>
  <input id="dlgWishlistTitle" /><button id="btnSaveWishlistTitle"></button>
  <button id="btnDeleteWishlist"></button><ul id="dlgWishes"></ul>
  <input id="newWishTitle" /><input id="newWishQty" type="number" value="1" />
  <button id="btnAddWish"></button>
  <dialog id="createDialog"></dialog>
  <input id="createWishlistTitle" /><button id="btnCreateConfirm"></button>
  <div id="toasts"></div>
`;

const WISHLISTS = [
  {
    id: 1, title: 'Alpha', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    Wishes: [{ id: 1, title: 'Buch', quantity: 2 }, { id: 2, title: 'Stift', quantity: 1 }],
  },
  {
    id: 2, title: 'Beta', createdAt: '2024-06-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z',
    Wishes: [{ id: 3, title: 'Buch', quantity: 1 }],
  },
  {
    id: 3, title: 'Gamma', createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-01T00:00:00Z',
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

beforeAll(async () => {
  document.body.innerHTML = DOM;
  global.confirm = vi.fn().mockReturnValue(true);
  global.prompt  = vi.fn().mockReturnValue(null);
  mockFetch(WISHLISTS);
  window.eval(APP_SRC);
  await new Promise(r => setTimeout(r, 100));
});

beforeEach(async () => {
  const filterEl = document.getElementById('filterTitle');
  filterEl.value = '';
  filterEl.dispatchEvent(new Event('input'));

  const sortEl = document.getElementById('sortBy');
  sortEl.value = 'createdAt';
  sortEl.dispatchEvent(new Event('change'));

  mockFetch(WISHLISTS);
  await window.fetchAll();
});

// ── safeText ──────────────────────────────────────────────────────────────────

describe('safeText', () => {
  it('returns "" for null',      () => expect(window.safeText(null)).toBe(''));
  it('returns "" for undefined', () => expect(window.safeText(undefined)).toBe(''));
  it('coerces 0 to "0"',        () => expect(window.safeText(0)).toBe('0'));
  it('coerces number to string', () => expect(window.safeText(42)).toBe('42'));
  it('returns string as-is',    () => expect(window.safeText('hi')).toBe('hi'));
});

// ── escapeHtml ────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  const cases = [
    ['& → &amp;',   'a&b',                         'a&amp;b'],
    ['< → &lt;',    '<p>',                         '&lt;p&gt;'],
    ['" → &quot;',  '"val"',                       '&quot;val&quot;'],
    ["' → &#039;",  "it's",                        'it&#039;s'],
    ['full XSS tag','<script>alert("x")</script>', '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'],
    ['null → ""',   null,                          ''],
    ['plain text',  'hello',                       'hello'],
  ];
  it.each(cases)('%s', (_label, input, expected) => {
    expect(window.escapeHtml(input)).toBe(expected);
  });
});

// ── fmtDate ───────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('formats a valid ISO timestamp to a localised string', () => {
    const r = window.fmtDate('2024-06-15T12:00:00.000Z');
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
    expect(r).not.toBe('–');
  });
  it.each([null, undefined, ''])('returns "–" for %s', v => {
    expect(window.fmtDate(v)).toBe('–');
  });
  it('does not throw for a completely invalid date string', () => {
    expect(() => window.fmtDate('not-a-date')).not.toThrow();
  });
});

// ── Rendering – cards ────────────────────────────────────────────────────────

describe('render – wishlist cards', () => {
  it('renders one card per wishlist in the data', () => {
    expect(document.querySelectorAll('.wl')).toHaveLength(3);
  });

  it('card titles match the wishlist data', () => {
    const titles = [...document.querySelectorAll('.wl__title')].map(e => e.textContent.trim());
    expect(titles).toEqual(expect.arrayContaining(['Alpha', 'Beta', 'Gamma']));
  });

  it('hides the empty-state element when wishlists exist', () => {
    expect(document.getElementById('emptyState').hidden).toBe(true);
  });
});

// ── Rendering – stats ────────────────────────────────────────────────────────

describe('render – statistics', () => {
  it('shows the correct wishlist count',              () => expect(document.getElementById('statWishlists').textContent).toBe('3'));
  it('shows the correct total wish count (2+1+0=3)',  () => expect(document.getElementById('statWishes').textContent).toBe('3'));
  it('shows the correct average (3/3=1.0)',           () => expect(document.getElementById('statAvg').textContent).toBe('1.0'));
  it('"Buch" is listed first in top wishes (2×)',     () => expect(document.querySelector('#topWishes li').textContent).toContain('Buch'));
});

// ── Rendering – empty state ───────────────────────────────────────────────────

describe('render – empty state', () => {
  it('shows empty-state element when no data is returned', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.getElementById('emptyState').hidden).toBe(false);
  });

  it('shows "–" for average when there are no wishlists', async () => {
    mockFetch([]);
    await window.fetchAll();
    expect(document.getElementById('statAvg').textContent).toBe('–');
  });
});

// ── Filter ────────────────────────────────────────────────────────────────────

describe('filter', () => {
  const type = value => {
    const el = document.getElementById('filterTitle');
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };

  it('narrows cards to the matching title',             () => { type('Alpha');    expect(document.querySelectorAll('.wl')).toHaveLength(1); });
  it('is case-insensitive',                            () => { type('beta');     expect(document.querySelectorAll('.wl')).toHaveLength(1); });
  it('shows empty state when nothing matches',         () => { type('ZZZMATCH'); expect(document.getElementById('emptyState').hidden).toBe(false); });
  it('restores all cards when filter is cleared',      () => { type('Alpha'); type(''); expect(document.querySelectorAll('.wl')).toHaveLength(3); });
});

// ── Sort ──────────────────────────────────────────────────────────────────────

describe('sort', () => {
  it('keeps all cards visible when sort field changes', () => {
    document.getElementById('sortBy').value = 'title';
    document.getElementById('sortBy').dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('.wl')).toHaveLength(3);
  });

  it('reverses the card order when direction is toggled', () => {
    const btn    = document.getElementById('btnToggleDir');
    const before = [...document.querySelectorAll('.wl__title')].map(e => e.textContent.trim());
    btn.click();
    const after  = [...document.querySelectorAll('.wl__title')].map(e => e.textContent.trim());
    expect(after).not.toEqual(before);
    expect([...after].sort()).toEqual([...before].sort());
    btn.click(); // restore
  });
});

// ── Status line ───────────────────────────────────────────────────────────────

describe('status line', () => {
  it('shows a connected message after a successful fetch', async () => {
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
