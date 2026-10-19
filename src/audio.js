const takes = {
  press: ['press-1', 'press-2', 'press-3'],
  tick: ['tick'], power: ['power'], pickup: ['pickup'],
  snap: ['snap'], eject: ['eject'], boot: ['boot'],
};

export function createAudio() {
  let context, master, enabled = true, generation = 0;
  const buffers = new Map();
  const lastPlayed = new Map();
  const nextTake = new Map();
  const active = new Set();
  const files = [...new Set(Object.values(takes).flat())];
  const downloads = new Map(files.map(name => [name,
    fetch(`${(import.meta.env?.BASE_URL ?? '/')}audio/${name}.wav`)
      .then(response => {
        if (!response.ok) throw new Error(`Audio ${name}: ${response.status}`);
        return response.arrayBuffer();
      })
      .catch(error => { console.warn(error); return null; }),
  ]));
  let decoding;

  function unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return Promise.resolve();
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = enabled ? 0.65 : 0;
      master.connect(context.destination);
    }
    const resumed = context.resume();
    decoding ??= Promise.all(files.map(async name => {
      const bytes = await downloads.get(name);
      if (bytes) {
        try { buffers.set(name, await context.decodeAudioData(bytes)); }
        catch (error) { console.warn(`Could not decode ${name}`, error); }
      }
    }));
    return Promise.all([resumed, decoding]);
  }

  async function play(type, { pitch = 0 } = {}) {
    if (!enabled || !takes[type]) return;
    const started = performance.now();
    if (started - (lastPlayed.get(type) ?? -Infinity) < (type === 'tick' ? 100 : 45)) return;
    lastPlayed.set(type, started);
    const token = generation;
    try { await unlock(); }
    catch (error) { console.warn('Audio could not start', error); return; }
    // A late click no longer belongs to the gesture that requested it.
    if (!enabled || token !== generation || !context || context.state !== 'running' || performance.now() - started > 180) return;
    const choices = takes[type];
    const index = nextTake.get(type) ?? 0;
    nextTake.set(type, (index + 1) % choices.length);
    const buffer = buffers.get(choices[index]);
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** (pitch / 12);
    source.connect(master);
    active.add(source);
    source.onended = () => { active.delete(source); source.disconnect(); };
    source.start();
  }

  function setEnabled(value) {
    enabled = value;
    generation++;
    if (master) master.gain.setTargetAtTime(enabled ? 0.65 : 0, context.currentTime, 0.008);
    if (!enabled) for (const source of active) source.stop();
  }
  document.addEventListener('pointerdown', () => { void unlock().catch(console.warn); }, { once: true, capture: true });
  document.addEventListener('keydown', () => { void unlock().catch(console.warn); }, { once: true, capture: true });
  return { play, setEnabled };
}
