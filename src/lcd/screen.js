import * as THREE from 'three';
import { domToCanvas } from 'modern-screenshot';
import { defaults, presets } from './presets.js';
import * as shaders from './shaders.js';

const material = (fragmentShader, uniforms) => new THREE.ShaderMaterial({
  vertexShader: shaders.vertex, fragmentShader, uniforms,
  depthTest: false, depthWrite: false, toneMapped: false,
});
const uniform = value => ({ value });

export class LcdScreen {
  constructor(root) {
    this.root = root;
    this.scroll = root.querySelector('.lcd-scroll');
    this.content = root.querySelector('.lcd-article');
    this.params = { ...defaults };
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.active = false;
    this.frame = 0;
    this.revealStart = 0;
    this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.domElement.className = 'lcd-effect';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    root.prepend(this.renderer.domElement);
    this.imageLayer = document.createElement('div');
    this.imageLayer.className = 'lcd-clear-images';
    this.imageLayer.setAttribute('aria-hidden', 'true');
    this.imageLayer.inert = true;
    this.imageContent = document.createElement('div');
    this.imageLayer.append(this.imageContent);
    root.append(this.imageLayer);
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene.add(this.quad);
    this.qTarget = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.cTarget = this.qTarget.clone();
    this.history = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }));
    this.front = 0;
    const pixels = new Uint8Array(128 * 128 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      const value = Math.floor(Math.random() * 256);
      pixels.set([value, value, value, 255], i);
    }
    this.noise = new THREE.DataTexture(pixels, 128, 128);
    this.noise.wrapS = this.noise.wrapT = THREE.RepeatWrapping;
    this.noise.needsUpdate = true;
    this.quantize = material(shaders.quantize, {
      source: uniform(null), sourceSize: uniform(new THREE.Vector2(1, 1)), viewSize: uniform(new THREE.Vector2(1, 1)),
      grid: uniform(new THREE.Vector2()), scrollY: uniform(0), dither: uniform(defaults.dither), reveal: uniform(1),
    });
    const colors = Object.fromEntries(['palette0','palette1','palette2','palette3','panelBg'].map(key => [key, uniform(new THREE.Vector3())]));
    const numeric = names => Object.fromEntries(names.map(key => [key, uniform(defaults[key])]));
    this.color = material(shaders.color, {
      source: uniform(this.qTarget.texture), grid: uniform(new THREE.Vector2()), ...colors,
      ...numeric(['colorStrength','bleed','density','offTint','crosstalk','xtalkEdge','brightness','contrast','saturation','panelGamma','blackLift','warm']),
    });
    this.composite = material(shaders.composite, {
      source: uniform(this.cTarget.texture), history: uniform(null), noise: uniform(this.noise),
      grid: uniform(new THREE.Vector2()), resolution: uniform(new THREE.Vector2()), lightest: uniform(new THREE.Vector3()), shadowColor: uniform(new THREE.Vector3()),
      ...numeric(['gridStrength','pixelSize','gapGain','shadowOffset','shadowBlur','shadowOpacity','paper','grain','gradient','vignette','ghostStrength','ghostGate']),
      dt: uniform(.016), hasHistory: uniform(0), elGlow: uniform(0),
    });
    this.copy = material(shaders.copy, { source: uniform(null) });
    this.onScroll = () => { this.syncImageScroll(); this.invalidate(); };
    this.scroll.addEventListener('scroll', this.onScroll, { passive: true });
    this.imageGalleries = [];
    this.onGalleryScroll = () => this.syncImageScroll();
    this.content.addEventListener('scroll', this.onGalleryScroll, { capture: true, passive: true });
    this.onFocus = () => this.refresh();
    this.content.addEventListener('focusin', this.onFocus);
    this.content.addEventListener('focusout', this.onFocus);
    this.onVisibility = () => { if (!document.hidden) this.invalidate(); };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.onMotion = () => this.invalidate();
    this.motionQuery.addEventListener('change', this.onMotion);
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.refresh(), 120);
    });
    this.resizeObserver.observe(this.scroll);
    this.resizeObserver.observe(this.content);
    this.mutationObserver = new MutationObserver(() => this.refresh());
    this.mutationObserver.observe(this.content, { childList: true, subtree: true, characterData: true });
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      if (this.onScreen) this.invalidate();
    });
    this.intersectionObserver.observe(root);
    this.onScreen = true;
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();this.lost = true;root.classList.remove('lcd-processed');
      cancelAnimationFrame(this.frame);this.frame = 0;
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.lost = false;this.composite.uniforms.hasHistory.value = 0;this.refresh();
    });
    this.setParams(defaults);
  }

  syncImageScroll() {
    this.imageContent.style.transform = `translateY(${-this.scroll.scrollTop}px)`;
    for (const { source, track } of this.imageGalleries) {
      track.style.transform = `translateX(${-source.scrollLeft}px)`;
    }
  }

  refreshImages() {
    const position = (source, boundary) => {
      let x = 0, y = 0;
      for (let element = source; element && element !== boundary; element = element.offsetParent) {
        x += element.offsetLeft;
        y += element.offsetTop;
      }
      return { left: `${x}px`, top: `${y}px` };
    };
    this.imageContent.replaceChildren();
    this.imageGalleries = [];
    const galleries = new Map();
    for (const source of this.content.querySelectorAll('[data-image-gallery]')) {
      const clip = document.createElement('div');
      clip.className = 'lcd-image-gallery';
      Object.assign(clip.style, position(source, this.scroll), {
        width: `${source.clientWidth}px`, height: `${source.clientHeight}px`,
      });
      const track = document.createElement('div');
      clip.append(track);
      this.imageContent.append(clip);
      galleries.set(source, track);
      this.imageGalleries.push({ source, track });
    }
    for (const source of this.content.querySelectorAll('img:not([data-lcd-effect])')) {
      const image = document.createElement('img');
      image.src = source.currentSrc || source.src;
      image.alt = '';
      const gallery = source.closest('[data-image-gallery]');
      const style = getComputedStyle(source);
      Object.assign(image.style, position(source, gallery || this.scroll), {
        width: `${source.offsetWidth}px`, height: `${source.offsetHeight}px`,
        objectFit: style.objectFit, objectPosition: style.objectPosition, borderRadius: style.borderRadius,
      });
      (galleries.get(gallery) || this.imageContent).append(image);
    }
    this.syncImageScroll();
  }

  async refresh() {
    if (this.disposed) return;
    if (this.capturing) { this.captureAgain = true; return; }
    this.capturing = true;
    try {
      await Promise.all([...this.content.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
      const width = this.scroll.clientWidth;
      const height = this.content.scrollHeight;
      if (!width || !height) return;
      this.refreshImages();
      const canvas = await domToCanvas(this.content, {
        width, height, scale: 1, backgroundColor: '#ffffff',
        style: { opacity: '1', transform: 'none', visibility: 'visible' },
        font: { preferredFormat: 'truetype' },
        onCloneEachNode: node => {
          if (node instanceof HTMLImageElement && !node.hasAttribute('data-lcd-effect')) node.style.opacity = '0';
        },
      });
      if (this.disposed) return;
      this.texture?.dispose();
      this.texture = new THREE.CanvasTexture(canvas);
      this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
      this.quantize.uniforms.source.value = this.texture;
      this.quantize.uniforms.sourceSize.value.set(width, height);
      this.root.classList.add('lcd-processed');
      this.resize();
      this.invalidate();
    } catch (error) {
      this.root.classList.remove('lcd-processed');
      console.warn('LCD rendering unavailable; showing the readable HTML screen.', error);
    } finally {
      this.capturing = false;
      if (this.captureAgain) { this.captureAgain = false; this.refresh(); }
    }
  }

  resize() {
    const width = this.scroll.clientWidth, height = this.scroll.clientHeight;
    const cols = Math.round(this.params.cols), rows = Math.round(cols * height / width);
    const dpr = Math.min(devicePixelRatio, 2);
    this.renderer.setSize(width * dpr, height * dpr, false);
    this.qTarget.setSize(cols, rows);this.cTarget.setSize(cols, rows);
    this.history.forEach(target => target.setSize(width * dpr, height * dpr));
    [this.quantize, this.color, this.composite].forEach(pass => pass.uniforms.grid.value.set(cols, rows));
    this.quantize.uniforms.viewSize.value.set(width, height);
    this.composite.uniforms.resolution.value.set(width * dpr, height * dpr);
    this.composite.uniforms.hasHistory.value = 0;
  }

  setParams(values) {
    const oldCols = this.params.cols;
    Object.assign(this.params, values);
    const preset = presets[this.params.preset] || presets.dmg;
    preset.palette.forEach((color, i) => this.color.uniforms[`palette${i}`].value.fromArray(color));
    this.color.uniforms.panelBg.value.fromArray(preset.panelBg);
    this.composite.uniforms.lightest.value.fromArray(preset.palette[0]);
    this.composite.uniforms.shadowColor.value.fromArray(preset.shadowColor);
    this.composite.uniforms.elGlow.value = this.params.preset === 'light' ? .28 : 0;
    for (const pass of [this.quantize, this.color, this.composite]) {
      for (const [key, value] of Object.entries(this.params)) {
        if (typeof value === 'number' && pass.uniforms[key]) pass.uniforms[key].value = value;
      }
    }
    if (oldCols !== this.params.cols && this.texture) this.resize();
    this.invalidate();
  }

  setActive(active) {
    this.booting = false;
    this.root.classList.remove('is-booting');
    this.active = active;
    this.root.classList.toggle('is-reading', active);
    if (active) {
      this.scroll.scrollTop = 0;
      this.syncImageScroll();
      this.replay();
    } else {
      cancelAnimationFrame(this.frame);this.frame = 0;
    }
  }

  setLiveScene(liveScene) {
    this.liveScene = liveScene;
    this.composite.uniforms.hasHistory.value = 0;
    this.invalidate();
  }

  prepareBoot(logo) {
    this.bootLogo = logo;
    this.bootCanvas = document.createElement('canvas');
    this.bootCanvas.width = 640;
    this.bootCanvas.height = 565;
    this.bootContext = this.bootCanvas.getContext('2d');
    this.bootTexture = new THREE.CanvasTexture(this.bootCanvas);
    this.bootTexture.minFilter = this.bootTexture.magFilter = THREE.LinearFilter;
  }

  showBoot() {
    this.booting = true;
    this.active = true;
    this.root.classList.add('is-booting');
    this.replay();
    // Replace the previous cartridge frame before the screen is revealed.
    cancelAnimationFrame(this.frame);this.frame=0;
    this.render(performance.now(), true);
  }

  drawBoot(elapsed, reduced) {
    const ctx = this.bootContext;
    const progress = reduced ? 1 : Math.min(1, elapsed / 450);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 640, 565);
    ctx.globalAlpha = progress;
    ctx.drawImage(this.bootLogo, 160, 195 - 12 * (1 - progress), 320, 137.5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#111210';
    ctx.fillRect(271, 355, 98 * (reduced ? 1 : Math.min(1, elapsed / 600)), 7);
    this.bootTexture.needsUpdate = true;
  }

  replay() {
    this.revealStart = performance.now();
    this.composite.uniforms.hasHistory.value = 0;
    this.invalidate();
  }

  invalidate() {
    this.dirty = true;
    this.changedAt = performance.now();
    if (!this.frame && this.active && !this.lost && !document.hidden && this.onScreen) {
      this.lastFrame = performance.now();
      this.frame = requestAnimationFrame(time => this.render(time));
    }
  }

  draw(pass, target) {
    this.quad.material = pass;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  render(time, prepareHidden = false) {
    this.frame = 0;
    if (!this.active || (!this.texture && !this.booting) || this.lost || document.hidden || (!this.onScreen && !prepareHidden)) return;
    const reduced = this.motionQuery.matches;
    const elapsed = time - this.revealStart;
    const reveal = reduced || this.booting ? 1 : Math.min(1, elapsed / 180);
    if (this.booting) {
      this.drawBoot(elapsed, reduced);
      this.dirty = true;
    }
    const live = !this.booting && this.liveScene;
    if (live) {
      live.render(this.renderer, Math.min(.04, Math.max(0, (time - this.lastFrame) / 1000)));
      this.dirty = true;
    }
    this.quantize.uniforms.source.value = this.booting ? this.bootTexture : live ? live.texture : this.texture;
    this.quantize.uniforms.sourceSize.value.set(
      this.booting ? 640 : live ? live.texture.image.width : this.texture.image.width,
      this.booting ? 565 : live ? live.texture.image.height : this.texture.image.height,
    );
    this.quantize.uniforms.viewSize.value.set(
      this.booting ? 640 : this.scroll.clientWidth,
      this.booting ? 565 : this.scroll.clientHeight,
    );
    if (this.dirty || this.quantize.uniforms.reveal.value !== reveal) {
      this.quantize.uniforms.reveal.value = reveal;
      this.quantize.uniforms.scrollY.value = this.booting || live ? 0 : this.scroll.scrollTop;
      this.draw(this.quantize, this.qTarget);
      this.draw(this.color, this.cTarget);
      this.dirty = false;
    }
    this.composite.uniforms.ghostStrength.value = reduced ? 0 : this.params.ghostStrength;
    this.composite.uniforms.dt.value = Math.min(.1, Math.max(.001, (time - this.lastFrame) / 1000));
    this.composite.uniforms.history.value = this.history[this.front].texture;
    this.front = 1 - this.front;
    this.draw(this.composite, this.history[this.front]);
    this.copy.uniforms.source.value = this.history[this.front].texture;
    this.draw(this.copy, null);
    this.composite.uniforms.hasHistory.value = 1;
    this.lastFrame = time;
    const settling = reduced ? 0 : 8 * (8 + 102 * this.params.ghostStrength);
    if (live || reveal < 1 || (this.booting && !reduced && elapsed < 600) || time - this.changedAt < settling) this.frame = requestAnimationFrame(next => this.render(next));
  }

  destroy() {
    this.disposed = true;cancelAnimationFrame(this.frame);clearTimeout(this.resizeTimer);
    this.resizeObserver.disconnect();this.mutationObserver.disconnect();this.intersectionObserver.disconnect();
    this.scroll.removeEventListener('scroll', this.onScroll);
    this.content.removeEventListener('scroll', this.onGalleryScroll, true);
    this.content.removeEventListener('focusin', this.onFocus);
    this.content.removeEventListener('focusout', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motionQuery.removeEventListener('change', this.onMotion);
    this.texture?.dispose();this.bootTexture?.dispose();this.noise.dispose();this.quad.geometry.dispose();
    [this.quantize,this.color,this.composite,this.copy].forEach(pass => pass.dispose());
    [this.qTarget,this.cTarget,...this.history].forEach(target => target.dispose());
    this.renderer.dispose();this.renderer.domElement.remove();
    this.imageLayer.remove();
  }
}
