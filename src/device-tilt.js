const clamp = value => Math.max(-1, Math.min(1, value));
const angleDelta = (angle, origin) => ((angle - origin + 540) % 360) - 180;

export function relativeTilt(beta, gamma, origin, angle = 0) {
  const x = angleDelta(gamma, origin.gamma) / 22;
  const y = angleDelta(beta, origin.beta) / 22;
  const radians = angle * Math.PI / 180;
  return { x: clamp(x * Math.cos(radians) + y * Math.sin(radians)),
    y: clamp(y * Math.cos(radians) - x * Math.sin(radians)) };
}

export function setupDeviceTilt(button, status, onChange) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(pointer: coarse)');
  const supported = window.isSecureContext && 'DeviceOrientationEvent' in window;
  let enabled = false, origin = null, timeout;
  const reset = () => { origin = null; onChange(0, 0); };
  const updateButton = () => {
    button.hidden = !supported || !touch.matches || reduced.matches;
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Turn device tilt off' : 'Enable device tilt');
    button.title = enabled ? 'Turn device tilt off' : 'Enable device tilt';
  };
  function receive(event) {
    if (document.hidden || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    clearTimeout(timeout);
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    if (!origin || origin.angle !== angle) origin = { beta: event.beta, gamma: event.gamma, angle };
    const tilt = relativeTilt(event.beta, event.gamma, origin, angle);
    onChange(tilt.x, tilt.y);
  }
  function stop() {
    enabled = false;
    clearTimeout(timeout);
    window.removeEventListener('deviceorientation', receive);
    reset(); updateButton();
  }
  async function toggle() {
    if (enabled) { stop(); return; }
    button.disabled = true;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          status.textContent = 'Device tilt is off. You can still tap or drag the cartridges.';
          return;
        }
      }
      if (reduced.matches || !touch.matches) return;
      enabled = true; reset(); updateButton();
      window.addEventListener('deviceorientation', receive, { passive: true });
      status.textContent = 'Device tilt on. Hold your phone comfortably and tilt gently.';
      timeout = setTimeout(() => {
        stop(); status.textContent = 'No motion sensor available. You can still tap or drag the cartridges.';
      }, 3000);
    } catch {
      stop(); status.textContent = 'Device tilt is unavailable. You can still tap or drag the cartridges.';
    } finally { button.disabled = false; }
  }
  const preferencesChanged = () => { if (reduced.matches || !touch.matches) stop(); updateButton(); };
  const visibilityChanged = () => reset();
  button.addEventListener('click', toggle);
  document.addEventListener('visibilitychange', visibilityChanged);
  reduced.addEventListener('change', preferencesChanged);
  touch.addEventListener('change', preferencesChanged);
  updateButton();
  return () => {
    stop(); button.removeEventListener('click', toggle);
    document.removeEventListener('visibilitychange', visibilityChanged);
    reduced.removeEventListener('change', preferencesChanged);
    touch.removeEventListener('change', preferencesChanged);
  };
}
