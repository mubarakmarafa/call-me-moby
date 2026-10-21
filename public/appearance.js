(() => {
  const storageKey = 'moby-appearance';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch { /* Appearance still works when browser storage is unavailable. */ }

  function apply() {
    const theme = preference ?? (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#090a0b' : '#f5f4ef';
    const button = document.querySelector('#appearance-toggle');
    if (button) {
      const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    window.dispatchEvent(new Event('appearancechange'));
  }

  apply();
  system.addEventListener('change', () => { if (preference === null) apply(); });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('#appearance-toggle').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, preference); }
      catch { /* Keep the selection for this visit when storage is blocked. */ }
      apply();
    });
  }, { once: true });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
    apply();
  });
})();
