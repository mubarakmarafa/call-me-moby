import test from 'node:test';
import assert from 'node:assert/strict';
import { preloadPuppyModel } from '../src/puppy/preload.js';

test('background model download is shared with insertion and retries after failure', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 503 }; };
  try {
    const background = preloadPuppyModel();
    assert.equal(preloadPuppyModel(), background);
    await assert.rejects(background, /503/);
    const bytes = new ArrayBuffer(8);
    globalThis.fetch = async () => { calls++; return { ok: true, arrayBuffer: async () => bytes }; };
    assert.equal(await preloadPuppyModel(), bytes);
    assert.equal(await preloadPuppyModel(), bytes);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
