import test from 'node:test';
import assert from 'node:assert/strict';
import { pages, readRoute, routeUrl, createRouteHistory } from '../src/routes.js';

test('every page and view has a distinct URL that restores its state', () => {
  const urls = new Set();
  for (const [index] of pages.entries()) {
    for (const mode of ['reader', 'gameboy']) {
      const route = { index, mode };
      const path = routeUrl(route, new URL('https://example.com/'));
      urls.add(path);
      assert.deepEqual(readRoute(new URL(path, 'https://example.com')), route);
    }
  }
  assert.equal(urls.size, 10);
});

test('reader is the default, trailing slashes work, and unknown pages fall back home', () => {
  assert.deepEqual(readRoute(new URL('https://example.com/goodnotes/')), { index: 1, mode: 'reader' });
  for (const path of ['/', '/missing']) assert.equal(readRoute(new URL(path, 'https://example.com')).index, null);
});

test('switching views preserves campaign parameters and removes stale fragments', () => {
  const url = new URL('https://example.com/about?mode=gameboy&utm_source=email#old');
  assert.equal(routeUrl({ index: 1, mode: 'reader' }, url), '/goodnotes?utm_source=email');
  assert.equal(routeUrl({ index: null }, url), '/?utm_source=email');
});

test('history coalesces exit actions and never duplicates the current URL', async () => {
  const visits = [];
  const browser = { location: new URL('https://example.com/goodnotes'), history: {
    pushState(_state, _title, path) { visits.push(path); browser.location = new URL(path, browser.location); },
  } };
  const history = createRouteHistory(browser);
  history.write({ index: 1, mode: 'reader' });
  await Promise.resolve();
  assert.deepEqual(visits, []);
  history.write({ index: 1, mode: 'gameboy' });
  history.write({ index: null });
  await Promise.resolve();
  assert.deepEqual(visits, ['/']);
});
