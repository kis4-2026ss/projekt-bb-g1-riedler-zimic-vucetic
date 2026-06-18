import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const frontendRoot = resolve(import.meta.dirname, '..', '..', '..', 'frontend');

describe('static frontend contract', () => {
  it('contains every DOM hook required by app.js', async () => {
    const [html, js] = await Promise.all([
      readFile(resolve(frontendRoot, 'index.html'), 'utf8'),
      readFile(resolve(frontendRoot, 'app.js'), 'utf8')
    ]);

    const requiredIds = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map(match => match[1]);
    assert.ok(requiredIds.length > 0, 'test setup should discover DOM ids from app.js');

    const missingIds = requiredIds.filter(id => !html.includes(`id="${id}"`));
    assert.deepEqual(missingIds, []);
  });

  it('targets the backend base URL documented for local development', async () => {
    const js = await readFile(resolve(frontendRoot, 'app.js'), 'utf8');

    assert.match(js, /const API_BASE = "http:\/\/localhost:3000";/);
  });
});
