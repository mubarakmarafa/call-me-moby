import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DoodleOutlinePass } from './doodle-outline.js';
import settings from './appearance.json';

// Original puppy playground's saved crisp toon treatment.
export function createPuppyAppearance(scene, camera, model) {
  const gradient = new THREE.DataTexture(new Uint8Array(256), 256, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.LinearFilter;
  gradient.generateMipmaps = false;
  for (let i = 0; i < 256; i++) {
    let shade = 0;
    const width = settings.softness * .18;
    for (let n = 1; n < settings.bands; n++) {
      const edge = n / settings.bands;
      shade += width > 0 ? THREE.MathUtils.smoothstep(i / 255, edge - width, edge + width) : Number(i / 255 >= edge);
    }
    gradient.image.data[i] = Math.round(255 * (1 / 3 + 2 / 3 * shade / (settings.bands - 1)));
  }
  gradient.needsUpdate = true;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.layers.enable(2);
    const convert = original => {
      const material = new THREE.MeshToonMaterial({
        map: original.map, color: original.color, gradientMap: gradient,
        normalMap: original.normalMap, normalScale: new THREE.Vector2(.12, .12),
      });
      original.dispose();
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
  });
  const base = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const outlined = base.clone();
  const outline = new DoodleOutlinePass(scene, camera);
  outline.model = model;
  outline.setSettings(settings);
  const output = new OutputPass();
  const size = new THREE.Vector2();
  return {
    render(renderer, target, surfaceWidth) {
      if (target) size.set(target.width, target.height);
      else renderer.getDrawingBufferSize(size);
      if (base.width !== size.x || base.height !== size.y) {
        base.setSize(size.x, size.y);
        outlined.setSize(size.x, size.y);
        outline.setSize(size.x, size.y);
      }
      outline.surfaceWidth = surfaceWidth;
      renderer.setRenderTarget(base);
      renderer.render(scene, camera);
      outline.render(renderer, outlined, base);
      output.renderToScreen = !target;
      output.render(renderer, target, outlined);
    },
    dispose() {
      base.dispose(); outlined.dispose(); outline.dispose(); output.dispose(); gradient.dispose();
    },
  };
}
