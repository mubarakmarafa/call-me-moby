import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';

test('audio drops pending cues on mute, rotates takes, throttles repeats and stops active sounds', async () => {
  const originals = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  let releaseDownloads;
  const downloaded = new Promise(resolve => { releaseDownloads = resolve; });
  const sources = [];
  globalThis.document = { addEventListener() {} };
  globalThis.fetch = async url => { await downloaded; return { ok: true, arrayBuffer: async () => url }; };
  globalThis.window = { AudioContext: class {
    state = 'running'; currentTime = 0; destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return { gain: { setTargetAtTime() {} }, connect() {} }; }
    decodeAudioData(bytes) { return Promise.resolve(bytes); }
    createBufferSource() {
      const source = { playbackRate: {}, connect() {}, disconnect() {}, start() { sources.push(this); }, stop() { this.stopped = true; } };
      return source;
    }
  } };
  try {
    const audio = createAudio();
    const pending = audio.play('boot');
    audio.setEnabled(false);
    releaseDownloads();
    await pending;
    assert.equal(sources.length, 0, 'muting cancels a cue waiting for decoding');
    audio.setEnabled(true);
    await audio.play('press');
    await audio.play('press');
    assert.equal(sources.length, 1, 'rapid duplicate presses are suppressed');
    await new Promise(resolve => setTimeout(resolve, 50));
    await audio.play('press');
    assert.notEqual(sources[0].buffer, sources[1].buffer, 'consecutive presses use different takes');
    await audio.play('tick', { pitch: 12 });
    assert.equal(sources[2].playbackRate.value, 2);
    audio.setEnabled(false);
    assert.ok(sources.every(source => source.stopped));
    await audio.play('snap');
    assert.equal(sources.length, 3, 'muted interactions stay silent');
  } finally {
    Object.assign(globalThis, originals);
  }
});
