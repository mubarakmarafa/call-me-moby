import './reader.css';

export function createReader({ about, education, worldBuilding, onToggle, onSelect, onExit }) {
  const panel = document.createElement('section');
  panel.id = 'reader-pane';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Reader');
  panel.innerHTML = `
    <div class="reader-topline">
      <div class="reader-shelf" aria-label="Cartridge shelf"><span class="reader-shelf-caption" aria-live="polite">Pick a cartridge</span></div>
      <button class="reader-mode-toggle" aria-label="Read this article on the Game Boy" title="Read on the Game Boy"><svg viewBox="380 379 264 264" aria-hidden="true"><path d="m459 389h106c25 0 45 20 45 45v154c0 25-20 45-45 45h-106c-25 0-45-20-45-45v-154c0-25 20-45 45-45zm2 30.5c-10.2 0-18.5 8.3-18.5 18.5v57c0 10.2 8.3 18.5 18.5 18.5h102c10.2 0 18.5-8.3 18.5-18.5v-57c0-10.2-8.3-18.5-18.5-18.5zm1.5 114.5c-5.4 0-8.3 3.5-8.3 8.5v9.2h-9.2c-5.4 0-8.5 3.6-8.5 8.8v3.2c0 5.3 3.2 8.4 8.5 8.4h9.2v9.4c0 5.4 3.1 8.4 8.3 8.4h3.5c5.4 0 8.4-3.1 8.4-8.4v-9.4h9.3c5.4 0 8.4-3.2 8.4-8.4v-3.3c0-5.4-3.1-8.7-8.4-8.7h-9.3v-9.2c0-5.3-3.1-8.5-8.4-8.5zm124.5 16.8a14.9 14.9 0 1 0-29.8 0 14.9 14.9 0 1 0 29.8 0zm-33.4 24.7a14.9 14.9 0 1 0-29.8 0 14.9 14.9 0 1 0 29.8 0z" fill="currentColor" fill-rule="evenodd"/></svg></button>
      <button class="reader-close" aria-label="Exit article" title="Exit article">×</button>
      <div class="reader-blur" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
    </div>
    <div class="reader-scroll" tabindex="0" aria-label="Reader article">
      <article class="reader-article"></article>
    </div>`;
  document.querySelector('#app').append(panel);
  const stories = [
    { name: 'Moby', html: about },
    { name: 'Goodnotes', html: education },
    { name: 'Config', html: `<h1>Human methods, new material.</h1><p>Designing with AI for the classroom.</p><p>Wendy Liao and I shared the design journey behind Goodnotes Classroom at Figma Config.</p><p><a href="https://www.youtube.com/watch?v=fLF8dwbC74o" target="_blank" rel="noopener noreferrer">Watch the Config talk ↗</a></p>` },
    { name: 'World-building', html: worldBuilding },
    { name: 'Labradoodle', html: '' },
  ];
  let current = -1, open = false;
  const scroll = panel.querySelector('.reader-scroll');
  const article = panel.querySelector('article');
  const triggers = [document.querySelector('#reader-sticker'), document.querySelector('#read-instead')];
  let trigger;
  let paperAnimation;
  function select(index, notify = false) {
    if (current === index) { if (notify) onSelect(index); return; }
    current = index;
    panel.classList.toggle('reader-game', index === 4);
    article.innerHTML = stories[index].html;
    article.querySelectorAll('[data-video]').forEach(button => {
      const link = document.createElement('a');
      link.href = `https://www.youtube.com/watch?v=${button.dataset.video}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'reader-video';
      link.textContent = button.textContent;
      button.replaceWith(link);
    });
    article.querySelectorAll('[data-lcd-effect]').forEach(image => image.removeAttribute('data-lcd-effect'));
    panel.querySelector('.reader-shelf-caption').textContent = `${index === 4 ? "Playing" : "Reading"} ${stories[index].name}`;
    scroll.scrollTop = 0;
    if (notify) onSelect(index);
  }
  function toggle(value, source, { instant = false } = {}) {
    open = value;
    if (source) trigger = source;
    paperAnimation?.cancel();
    panel.hidden = false;
    panel.inert = !open;
    paperAnimation = null;
    if (instant) {
      panel.hidden = !open;
      document.body.classList.remove('reader-closing');
    } else {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      paperAnimation = panel.animate(open ? [
        { opacity: 0, transform: 'translateY(60vh) rotate(2deg)' },
        { opacity: 1, transform: 'translateY(0) rotate(0)' },
      ] : [
        { opacity: 1, transform: 'translateY(0) rotate(0)' },
        { opacity: 0, transform: 'translateY(12vh) rotate(1deg)', offset: .65 },
        { opacity: 0, transform: 'translateY(20vh) rotate(1deg)' },
      ], { delay: reduced || !open ? 0 : 240, duration: reduced ? 0 : open ? 650 : 180, easing: open ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.4,0,1,1)', fill: 'both' });
      document.body.classList.toggle('reader-closing', !open);
      paperAnimation.onfinish = () => {
        if (!open) {
          panel.hidden = true;
          document.body.classList.remove('reader-closing');
        }
        // A retained opacity animation breaks masked backdrop compositing in Chromium.
        paperAnimation.cancel();
        paperAnimation = null;
      };
    }
    document.body.classList.toggle('reader-open', open);
    triggers.forEach(button => button.setAttribute('aria-expanded', String(open)));
    onToggle(open, current, { instant });
    if (open) { scroll.focus({ preventScroll: true }); }
    else trigger?.focus({ preventScroll: true });
  }
  triggers.forEach(button => {
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => toggle(!open, button));
  });
  function exitArticle() { toggle(false); onExit(); }
  panel.querySelector('.reader-close').addEventListener('click', exitArticle);
  panel.querySelector('.reader-mode-toggle').addEventListener('click', () => toggle(false));
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopImmediatePropagation(); exitArticle(); }
  });
  select(0);
  return { select, get gameHost() { return article; }, open: (options) => toggle(true, undefined, options), close: () => toggle(false), get current() { return current; }, get isOpen() { return open; } };
}
