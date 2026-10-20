import * as THREE from 'three';
import { loadPuppyGame } from './preload.js';

export function createPuppyHost(screen, getLcd) {
  let session = null;
  function stop() {
    if (!session) return;
    const old = session;
    session = null;
    getLcd()?.setLiveScene(null);
    screen.classList.remove('is-puppy');
    cancelAnimationFrame(old.frame);
    old.game?.dispose();
    old.renderer?.dispose();
    old.surface.remove();
  }
  function present(current, host, onPaper) {
    cancelAnimationFrame(current.frame);
    getLcd()?.setLiveScene(null);
    current.onPaper = onPaper;
    host.append(current.surface);
    screen.classList.toggle('is-puppy', !onPaper);
    if (!current.game) return;
    current.surface.dataset.ready = 'true';
    if (onPaper) {
      if (!current.renderer) {
        current.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        current.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        current.renderer.domElement.setAttribute('aria-hidden', 'true');
        current.surface.prepend(current.renderer.domElement);
      }
      current.renderer.domElement.hidden = false;
      let previous = performance.now();
      const draw = time => {
        if (session !== current || !current.onPaper) return;
        const w = current.surface.clientWidth, h = current.surface.clientHeight;
        if (!document.hidden && w && h) {
          if (current.width !== w || current.height !== h) {
            current.renderer.setSize(w, h, false);
            current.width = w; current.height = h;
          }
          current.game.render(current.renderer, Math.min(.04, (time - previous) / 1000), true);
        }
        previous = time;
        current.frame = requestAnimationFrame(draw);
      };
      current.frame = requestAnimationFrame(draw);
    } else {
      if (current.renderer) current.renderer.domElement.hidden = true;
      getLcd()?.setLiveScene(current.game);
    }
  }
  async function show(host, onPaper) {
    if (session) { present(session, host, onPaper); return; }
    const surface = document.createElement('div');
    surface.className = 'puppy-input';
    surface.tabIndex = 0;
    surface.setAttribute('role', 'application');
    surface.setAttribute('aria-label', 'Labradoodle fetch. Tap the floor or drag the ball to throw. Enter throws, Space pauses, Escape exits.');
    const status = document.createElement('span');
    status.className = 'puppy-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Waking the puppy…';
    surface.append(status);
    const current = session = { surface, game: null, frame: 0, onPaper };
    present(current, host, onPaper);
    try {
      const { createPuppyGame } = await loadPuppyGame();
      if (session !== current) return;
      const game = await createPuppyGame(surface, {
        onPlayMilestone() {
          if (session !== current) return;
          const chip = document.createElement('a');
          chip.className = 'puppy-try-chip';
          chip.href = 'https://try.labradoodle.com/yPhhszGC5P';
          chip.target = '_blank'; chip.rel = 'noopener noreferrer';
          chip.textContent = 'try now ↗';
          chip.setAttribute('aria-label', 'Try Labradoodle (opens in a new tab)');
          for (const type of ['pointerdown', 'pointerup', 'click']) chip.addEventListener(type, event => event.stopPropagation());
          chip.addEventListener('focus', () => current.game?.setChipFocused(true));
          chip.addEventListener('blur', () => current.game?.setChipFocused(false));
          current.chip = chip; surface.append(chip);
        },
        onChipOffset(offset) { if (current.chip) current.chip.style.transform = `translate(-50%, ${offset}px)`; },
      });
      if (session !== current) { game.dispose(); return; }
      current.game = game;
      status.remove();
      present(current, surface.parentElement, current.onPaper);
    } catch (error) {
      if (session !== current) return;
      console.error('Puppy scene failed to load', error);
      status.textContent = 'The puppy couldn’t load. ';
      const retry = document.createElement('button');
      retry.textContent = 'Try again';
      retry.addEventListener('click', () => {
        const host = surface.parentElement, paper = current.onPaper;
        stop(); void show(host, paper);
      });
      status.append(retry);
    }
  }
  return { show, stop };
}
