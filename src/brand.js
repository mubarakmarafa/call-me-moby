import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export async function loadBrandFont() {
  await Promise.all([
    document.fonts.load('900 160px "Montreux Jazz"'),
    document.fonts.load('400 160px "Montreux Jazz Outline"'),
    document.fonts.load('400 18px "Geist Mono"'),
  ]);
}

function fillEnclosedGaps(ctx, canvas) {
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = pixels;
  const outside = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = (index) => {
    if (!outside[index] && data[index * 4 + 3] < 128) {
      outside[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
  // Keep the letter-following outer edge; fill only holes enclosed by that edge.
  for (let i = 0; i < outside.length; i++) {
    if (!outside[i] && data[i * 4 + 3] < 255) {
      data.set([255, 253, 245, 255], i * 4);
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

export function createWordmark(sticker = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 440;
  const ctx = canvas.getContext('2d');
  ctx.font = '900 310px "Montreux Jazz"';
  ctx.textBaseline = 'alphabetic';
  const label = 'moby';
  const textWidth = ctx.measureText(label).width;
  const scale = 860 / (textWidth + 145);
  ctx.translate(66, 42);
  ctx.scale(scale, scale);
  const baseline = 280;
  const dotX = textWidth + 63;
  const dotY = baseline - 39;

  if (sticker) {
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = '#fffdf5';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 72 / scale;
    ctx.strokeText(label, 0, baseline);
    ctx.fillText(label, 0, baseline);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    fillEnclosedGaps(ctx, canvas);
  }
  ctx.fillStyle = '#111210';
  ctx.fillText(label, 0, baseline);
  ctx.fillStyle = '#f6c400';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 50, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function stickerMaterial(texture, renderer, outline) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: .2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    roughness: .98,
    metalness: 0,
    envMapIntensity: .07,
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.stickerOutline={value:outline};
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float stickerOutline;
      float paperNoise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 stickerUv=(vMapUv-.5)*(1.+2.*stickerOutline)+.5;
      vec4 ink=texture2D(map,stickerUv);
      float coverage=ink.a;
      float inner=ink.a;
      for(int i=0;i<32;i++){
        float angle=float(i)*6.2831853/32.;
        vec2 direction=vec2(cos(angle),sin(angle));
        coverage=max(coverage,texture2D(map,stickerUv+direction*stickerOutline).a);
        inner=min(inner,texture2D(map,stickerUv+direction*.003).a);
      }
      vec3 paper=vec3(.88,.82,.67);
      vec3 printed=mix(paper,ink.rgb*vec3(.96,.94,.88),ink.a);
      printed=mix(printed,paper,.035);
      float grain=paperNoise(floor(vMapUv*1024.));
      float scuff=step(.994,paperNoise(floor(vMapUv*vec2(180.,420.))));
      printed=mix(printed,paper,scuff*.28);
      printed*=.97+.03*grain;
      // Small nicks along the cut edge, without punching holes through the lettering.
      float nick=step(.965,paperNoise(floor(vMapUv*180.)))*(1.-inner)*ink.a;
      diffuseColor*=vec4(printed,coverage*(1.-nick*.4));`);
  };
  material.customProgramCacheKey=()=> 'aged-sticker-v1';
  return material;
}

function addSticker(surface, parent, renderer, {texture, name, x, y, width, height, angle=0, tiltX=0, tiltY=0, depth=.12, layer=2, outline=0}) {
  surface.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,y,3),new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObject(surface)[0];
  if(!hit)throw new Error(`Cannot locate the surface for ${name}.`);
  const geometry=new DecalGeometry(surface,hit.point,new THREE.Euler(tiltX,tiltY,angle),new THREE.Vector3(width,height,depth));
  // Give the paper real clearance as well as depth bias, including at grazing angles.
  const positions=geometry.attributes.position,normals=geometry.attributes.normal;
  const clearance=.003+(layer-2)*.002;
  for(let i=0;i<positions.count;i++){
    positions.setXYZ(i,positions.getX(i)+normals.getX(i)*clearance,positions.getY(i)+normals.getY(i)*clearance,positions.getZ(i)+normals.getZ(i)*clearance);
  }
  positions.needsUpdate=true;
  geometry.computeBoundingSphere();
  const material=stickerMaterial(texture,renderer,outline);
  const sticker = new THREE.Mesh(geometry, material);
  sticker.name = name;
  // Glass is transparent: distance-based sorting otherwise lets it paint over the decal.
  sticker.renderOrder=layer;
  parent.add(sticker);
}

export async function addStickers(bezel,shell,parent,renderer) {
  bezel.renderOrder=1;
  addSticker(bezel,parent,renderer,{texture:new THREE.CanvasTexture(createWordmark(true)),name:'Moby die-cut sticker',x:.04,y:.23,width:.9,height:.388,angle:-.025});
  const loader=new THREE.TextureLoader();
  const [flame,crystal]=await Promise.all([loader.loadAsync('/images/stickers/flame.png'),loader.loadAsync('/images/stickers/crystal.png')]);
  addSticker(shell,parent,renderer,{texture:crystal,name:'Crystal die-cut sticker',x:-1.25,y:-1.64,width:1.04,height:1.16,tiltY:-.75,depth:.9,angle:-.16,outline:.04});
  addSticker(shell,parent,renderer,{texture:flame,name:'Flame die-cut sticker',x:-.83,y:-1.95,width:.98,height:1.12,tiltX:.24,tiltY:-.25,depth:.6,angle:.14,outline:.04,layer:3});
}
