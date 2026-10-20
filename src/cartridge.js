import * as THREE from 'three';

export const CARTRIDGE_INSERT_SCALE = 1.45;

function paintPaper(ctx, width, height) {
  let seed = 481;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const paper = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const age = Math.exp(-edge / 26) * 7;
      const grain = (random() - .5) * 12;
      const mottle = Math.sin(x * .041 + Math.sin(y * .019)) * Math.sin(y * .033) * 2;
      const i = (y * width + x) * 4;
      paper.data[i] = 242 + grain + mottle - age * .55;
      paper.data[i + 1] = 236 + grain + mottle - age * .85;
      paper.data[i + 2] = 222 + grain + mottle - age;
      paper.data[i + 3] = 255;
    }
  }
  ctx.putImageData(paper, 0, 0);
  ctx.lineWidth = .8;
  for (let i = 0; i < 1600; i++) {
    const x = random() * width;
    const y = random() * height;
    ctx.strokeStyle = i % 3 ? 'rgba(96, 77, 49, .045)' : 'rgba(255, 252, 239, .3)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - .5) * 7, y + random() * 3 + 1);
    ctx.stroke();
  }
}

function replaceLabel(source, anisotropy, artwork, shellColor, background, thumbnail, cover) {
  const label = document.createElement('canvas');
  label.width = 768;
  label.height = 720;
  const ctx = label.getContext('2d');
  paintPaper(ctx, label.width, label.height);
  if (cover) {
    const scale = Math.max(label.width / cover.naturalWidth, label.height / cover.naturalHeight);
    const w = cover.naturalWidth * scale, h = cover.naturalHeight * scale;
    ctx.drawImage(cover, (label.width-w)/2, (label.height-h)/2, w, h);
  } else if (thumbnail) {
    const height = label.width * thumbnail.naturalHeight / thumbnail.naturalWidth;
    ctx.drawImage(thumbnail, 0, (label.height - height) / 2, label.width, height);
  } else if (artwork) {
    if (background) {
      const scale = Math.max(label.width / background.naturalWidth, label.height / background.naturalHeight);
      const w = background.naturalWidth * scale;
      const h = background.naturalHeight * scale;
      ctx.drawImage(background, (label.width - w) / 2, (label.height - h) / 2, w, h);
    }
    const logoWidth = 570;
    const logoHeight = logoWidth * artwork.naturalHeight / artwork.naturalWidth;
    ctx.drawImage(artwork, (label.width - logoWidth) / 2, (label.height - logoHeight) / 2, logoWidth, logoHeight);
  } else {
  ctx.save();
  ctx.translate(192, 180);
  ctx.scale(.5, .5);
  ctx.fillStyle = '#111210';
  ctx.font = '900 300px "Montreux Jazz"';
  ctx.textBaseline = 'middle';
  const wordWidth = ctx.measureText('hi').width;
  const handSize = 230;
  const gap = 35;
  const left = (768 - wordWidth - handSize - gap) / 2;
  ctx.fillText('hi', left, 360);
  ctx.font = `${handSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.fillText('👋🏾', left + wordWidth + gap, 356);
  ctx.restore();
  }

  const atlas = document.createElement('canvas');
  atlas.width = source.image.width;
  atlas.height = source.image.height;
  const paint = atlas.getContext('2d');
  paint.drawImage(source.image, 0, 0);
  const pixels = paint.getImageData(0, 0, atlas.width, atlas.height);
  const tint = shellColor?.match(/\w\w/g).map(value => parseInt(value, 16));
  for (let y = 0; tint && y < atlas.height; y++) {
    for (let x = 0; x < atlas.width; x++) {
      // Keep the original metal screw and electrical contacts.
      if ((x > 520 && x < 920 && y > 686 && y < 760)
        || (x > 206 && x < 262 && y > 225 && y < 285)) continue;
      const i = (y * atlas.width + x) * 4;
      const shade = (pixels.data[i] * .2126 + pixels.data[i + 1] * .7152 + pixels.data[i + 2] * .0722) / 98;
      for (let c = 0; c < 3; c++) pixels.data[i + c] = tint[c] * shade;
    }
  }
  paint.putImageData(pixels, 0, 0);
  // This model packs its front label upside down in the 1024px texture atlas.
  paint.save();
  paint.beginPath();
  paint.roundRect(522, 173, 348, 331, 10);
  paint.clip();
  paint.translate(522, 504);
  paint.scale(1, -1);
  paint.drawImage(label, 0, 0, 348, 331);
  paint.restore();

  const texture = source.clone();
  texture.source = new THREE.Source(atlas);
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  texture.userData.labelArtwork = label.toDataURL();
  return texture;
}

export function createCartridge(gltf, renderer, { artwork, background, thumbnail, cover, shellColor = '#e57c18' } = {}) {
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 1.48 / size.x;
  const group = new THREE.Group();
  group.name = 'Moby cartridge';
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(scale, scale, scale);
    const material = object.material.clone();
    material.map = replaceLabel(material.map, Math.min(8, renderer.capabilities.getMaxAnisotropy()), artwork, shellColor, background, thumbnail, cover);
    group.userData.labelArtwork = material.map.userData.labelArtwork;
    material.roughness = .9;
    material.envMapIntensity = .18;
    group.add(new THREE.Mesh(geometry, material));
  });
  size.multiplyScalar(scale);
  group.userData.seatedPosition = new THREE.Vector3(
    0,
    2.394 - size.y * CARTRIDGE_INSERT_SCALE / 2,
    -.267 + size.z * CARTRIDGE_INSERT_SCALE / 2,
  );
  return group;
}
