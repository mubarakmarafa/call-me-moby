import { createAudio } from './audio.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { splitConsoleControls, directionalCartridge } from './console-controls.js';
import { setupDeviceTilt } from './device-tilt.js';
import { screenProjectionMatrix } from './screen-projection.js';
import { gsap } from 'gsap';
import { inject } from '@vercel/analytics';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './style.css';
import { loadBrandFont, addStickers, createWordmark } from './brand.js';
import { removeBuiltInCartridge } from './model-parts.js';
import { createCartridge, CARTRIDGE_INSERT_SCALE } from './cartridge.js';
import { LcdScreen } from './lcd/screen.js';
import { educationArticle, mountEducationVideo } from './education.js';
import { worldBuildingArticle } from './world-building.js';
import { createReader } from './reader.js';
import { readRoute, createRouteHistory } from './routes.js';
import { createPuppyHost } from './puppy/host.js';
import { preloadPuppy } from './puppy/preload.js';

inject({ mode: import.meta.env.PROD ? 'production' : 'development', debug: false });

const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const powerHit = $('#power-hit');
let cartHit = $('#cartridge-hit');
const educationHit = document.createElement('button');
educationHit.id = 'education-cartridge-hit';
educationHit.className = 'object-hit';
educationHit.setAttribute('aria-label', 'Insert the Goodnotes education cartridge');
educationHit.hidden = true;
cartHit.after(educationHit);
const configHit = document.createElement('button');
configHit.id = 'config-cartridge-hit';
configHit.className = 'object-hit';
configHit.setAttribute('aria-label', 'Insert the Config talk cartridge');
configHit.hidden = true;
educationHit.after(configHit);
const articleHit = document.createElement('button');
articleHit.id = 'article-cartridge-hit';
articleHit.className = 'object-hit';
articleHit.setAttribute('aria-label', 'Insert the World-building article cartridge');
articleHit.hidden = true;
configHit.after(articleHit);
const soonHit = document.createElement('button');
soonHit.id = 'soon-cartridge-hit';
soonHit.className = 'object-hit';
soonHit.setAttribute('aria-label', 'Insert the Labradoodle fetch cartridge');
soonHit.hidden = true;
articleHit.after(soonHit);
const cartHits = [cartHit, educationHit, configHit, articleHit, soonHit];
const FLOATING_CARTRIDGE_SCALE = .68;
const cartridgeNames = ['Moby', 'Goodnotes education', 'Config talk', 'World-building article', 'Labradoodle'];
const cartridges = [];
const cartridgeMotion = cartHits.map(() => ({ hovered: false, lift: 0, cursorX: 0, cursorY: 0, tiltX: 0, tiltY: 0, spin: 0 }));
let activeCartridge = 0;
let controlSelection = -1;
const consoleControls = {};
const instruction = $('#instruction-text');
const screenElement = $('#screen-content');
const aboutArticle = screenElement.querySelector('.lcd-article').innerHTML;
const readerSticker = document.createElement('button');
readerSticker.id = 'reader-sticker';
readerSticker.className = 'object-hit';
readerSticker.hidden = true;
readerSticker.setAttribute('aria-label', 'Toggle reader mode');
readerSticker.title = 'Reader mode';
$('#stage').append(readerSticker);
function animateReaderCurl(flatten) {
  const curl = rig?.getObjectByName('Reader sticker')?.userData.curl;
  if (!curl) return;
  gsap.to(curl, { value: reader.isOpen || flatten ? 0 : 1, duration: reducedMotion ? 0 : flatten ? .24 : .36, ease: 'power2.out', overwrite: true });
}
readerSticker.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') animateReaderCurl(true); });
readerSticker.addEventListener('pointerleave', () => animateReaderCurl(false));
readerSticker.addEventListener('focus', () => animateReaderCurl(true));
readerSticker.addEventListener('blur', () => animateReaderCurl(false));

const routeHistory = createRouteHistory(window);

const reader = createReader({ about: aboutArticle, education: educationArticle, worldBuilding: worldBuildingArticle, onSelect: swapReaderCartridge, onExit: exitReaderArticle, onToggle: (open, index, { instant }) => {
  routeHistory.write({ index, mode: open ? 'reader' : 'gameboy' });
  if (!instant) animateReaderCurl(false);
  readerEntrance?.kill();
  readerEntering = open;
  if (state === 'reading' && (!open || index === activeCartridge)) { showCartridgeContent(); activateCartridgeContent(); }
  if (open) {
    enterReader(index, { instant });
    return;
  }
  gsap.to(readerFrameMotion, { value: 0, duration: reducedMotion ? 0 : .7, ease: 'power3.inOut', overwrite: true });
  cartHits.forEach(hit => { hit.hidden = true; hit.style.zIndex = ''; });
  cartridges.forEach((cart, i) => {
    if (i === activeCartridge) return;
    gsap.killTweensOf([cart.position, cart.rotation, cart.scale]);
    cart.visible = false;
  });
  if (state === 'ready') {
    cartridges.forEach((cart, i) => { cart.visible = true; cartHits[i].hidden = false; });
  }
  if (state === 'reading') $('.reader-tools').hidden = false;
  requestAnimationFrame(() => {
    animateReaderCurl(false);
    resizeScene(true);
    if (state === 'reading') screenElement.querySelector('.lcd-scroll').focus({preventScroll:true});
  });
} });
const videoPlayer = mountEducationVideo(screenElement);
const closeVideo = videoPlayer.close;
const puppy = createPuppyHost(screenElement, () => lcdScreen);
function selectCartridge(index) {
  activeCartridge = index;
  cartridge = cartridges[index];
  cartHit = cartHits[index];
}
function showCartridgeContent() {
  routeHistory.write({ index: activeCartridge, mode: reader.isOpen ? 'reader' : 'gameboy' });
  closeVideo();
  if (activeCartridge !== 4) puppy.stop();
  reader.select(activeCartridge);
  screenElement.querySelector('.lcd-article').classList.toggle('soon-content', activeCartridge === 4);
  screenElement.querySelector('.lcd-article').innerHTML = activeCartridge === 4 ? '<img data-lcd-effect src="/images/soon-logo.png" alt="Yellow logo" /><p>let’s play fetch</p>' : activeCartridge === 3 ? worldBuildingArticle : activeCartridge === 1 ? educationArticle : aboutArticle;
  screenElement.querySelector('.lcd-scroll').setAttribute('aria-label', activeCartridge === 4 ? 'Labradoodle fetch' : activeCartridge === 3 ? 'agentic product design is world-building' : activeCartridge === 1 ? 'goodnotes education' : 'about moby');
  const article = screenElement.querySelector('.lcd-article');
  article.classList.toggle('cartridge-artwork', reader.isOpen);
  if (reader.isOpen) {
    article.classList.remove('soon-content');
    const artwork = document.createElement('img');
    artwork.src = cartridges[activeCartridge].userData.labelArtwork;
    artwork.alt = `${cartridgeNames[activeCartridge]} cartridge artwork`;
    artwork.dataset.lcdEffect = '';
    article.replaceChildren(artwork);
  }
  screenElement.querySelector('.lcd-scroll').scrollTop = 0;
  lcdScreen?.refresh();
}
function activateCartridgeContent() {
  lcdScreen?.setActive(reader.isOpen || activeCartridge !== 2);
  if (activeCartridge === 4) {
    void puppy.show(reader.isOpen ? reader.gameHost : screenElement, reader.isOpen);
    instruction.textContent = 'Tap the floor or drag the ball to play fetch. Enter throws, Space pauses, Escape exits.';
  } else if (activeCartridge === 2 && !reader.isOpen) {
    videoPlayer.open('fLF8dwbC74o', 'Human methods, new material — Config', { standalone: true });
  }
}
const pose = { x: 0, y: 0, z: 0, rx: .09, ry: -.30, rz: -.085 };
const cameraTarget = new THREE.Vector3();
let readerFraming = 0;
const readerFrameMotion = { value: 0 };
let readerDrag = null;
let readerEntering = false;
let readerEntrance = null;
let state = 'loading';
let renderer, scene, camera, rig, cartridge, screenObject, screenPosition, screenWidth, screenHeight, ledMaterial;
let hovered = false, hoverAmount = 0, soundEnabled = true;
const portfolioAudio = createAudio();
let pointer = null, transition = null;
let lcdScreen, destroyLcdControls;
let width = $('#stage').clientWidth, height = $('#stage').clientHeight;
const screenClipMatrix = new THREE.Matrix4();
const screenLocalMatrix = new THREE.Matrix4();
let screenBlack, cartridgePrompt, updateCartridgePrompt, flashSpeaker;
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const pointerNdc = new THREE.Vector2();
const canHover = matchMedia('(hover: hover) and (pointer: fine)');
const gazeTarget = new THREE.Vector2();
const gaze = new THREE.Vector2();
const deviceTarget = new THREE.Vector2();
const deviceGaze = new THREE.Vector2();
const deviceTilt = setupDeviceTilt($('#tilt-status'), (x,y) => deviceTarget.set(x,y));
const duration = (n) => reducedMotion ? Math.min(n, .06) : n;
const setState = (next) => {
  if(next!=='ready')cartridgeMotion.forEach(motion=>{gsap.killTweensOf(motion,'spin');motion.spin=0;});
  state = next;
  document.body.dataset.state = next;
  if (cartridgePrompt) cartridgePrompt.visible = ['waking', 'ready', 'dragging', 'returning'].includes(next);
};
const mobile = () => width < 600;
const needsDepthSeparation = () => mobile() || matchMedia('(pointer: coarse)').matches;

function sound(type, options) {
  void portfolioAudio.play(type, options);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  portfolioAudio.setEnabled(soundEnabled);
  $('.sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
  $('.sound-toggle').setAttribute('aria-label', `Turn sound ${soundEnabled ? 'off' : 'on'}`);
  $('.sound-toggle').title = `Turn sound ${soundEnabled ? 'off' : 'on'}`;
  if (soundEnabled) sound('press');
  flashSpeaker?.();
}
$('.sound-toggle').addEventListener('click', toggleSound);

function cameraDistance() { if (reader.isOpen) return width <= 700 ? 42 : Math.max(17, 8.6 / camera.aspect); return mobile() ? Math.max(13.5, 6.4 / camera.aspect) : Math.max(14.4, 12.8 / camera.aspect); }
function homePose() { return { x:0, y:mobile()?-.1:0, z:0, rx:.09, ry:-.30, rz:-.085 }; }
function cartHome(index = activeCartridge) {
  const side = index === 1 || index === 2 || index === 4 ? -1 : 1;
  const halfWidth = (cameraDistance() - .75) * Math.tan(THREE.MathUtils.degToRad(16)) * (width / height);
  const x = side * (mobile() ? Math.min(1.35, halfWidth - .85) : Math.min(3.25, halfWidth - 1.15));
  const offset = mobile() ? 0 : [0, .35, -.22, 0, -.12][index];
  let y = mobile() ? [2.65, -2.6, 2.85, -2.95, .3][index] * .82 : [1.55, -2.05, 2.1, -1.1, 0][index];
  if (mobile()) {
    const pixelsPerUnit = width / (2 * halfWidth);
    // Reserve the footer and the cartridge's rotated half-height plus its bobbing motion.
    y = Math.max(y, (120 - height / 2) / pixelsPerUnit + .9);
  }
  return new THREE.Vector3(x + offset, y, .75);
}
function cartRotation(index = activeCartridge) {
  return [{ x: .08, y: -.20, z: -.16 }, { x: -.07, y: .20, z: .20 }, { x: .06, y: .16, z: .12 }, { x: -.04, y: -.18, z: -.12 }, { x: .04, y: .18, z: -.1 }][index];
}
function cartEdge(index) {
  const home = cartHome(index);
  const halfWidth = (cameraDistance() - home.z) * Math.tan(THREE.MathUtils.degToRad(16)) * (width / height);
  home.x = Math.sign(home.x) * (halfWidth + 1.3);
  return home;
}
function readyPose() { return {x:0,y:0,z:needsDepthSeparation()?-2:1.25,rx:.07,ry:-.16,rz:-.035}; }
const receivingDepth = -1.5;
function receivingPose() {
  const side=activeCartridge===1||activeCartridge===2||activeCartridge===4?-1:1;
  return {x:0,y:-.06,z:needsDepthSeparation()?-2.6:receivingDepth,rx:.16,ry:Math.PI-side*.12,rz:side*.025};
}

async function init() {
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));renderer.setSize(width,height);renderer.setClearColor(0x090a0b,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  $('#webgl').appendChild(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,width/height,.1,100);camera.position.z=cameraDistance();
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=new RoomEnvironment();scene.environment=pmrem.fromScene(environment,.12).texture;scene.environmentIntensity=.22;environment.dispose();pmrem.dispose();
  RectAreaLightUniformsLib.init();
  scene.add(new THREE.AmbientLight(0xffffff,.95));
  const key=new THREE.RectAreaLight(0xfff8eb,3.2,8,10);key.position.set(-3,5,7);key.lookAt(0,0,0);scene.add(key);
  const fill=new THREE.RectAreaLight(0xf2f4ff,1.1,6,8);fill.position.set(4,1,5);fill.lookAt(0,0,0);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xfff3cf,.45);rim.position.set(0,3,-5);scene.add(rim);
  rig=new THREE.Group();scene.add(rig);
  $('#html-scene').appendChild(screenElement);
  await loadBrandFont();
  $('.boot-logo').replaceChildren(createWordmark(false));
  const loader = new GLTFLoader();
  const [gltf, cartridgeGltf] = await Promise.all([
    loader.loadAsync('/models/game-boy-color.glb'),
    loader.loadAsync('/models/gameboy-cartridge.glb'),
  ]);
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene);const center=bounds.getCenter(new THREE.Vector3());const normalize=4.8/bounds.getSize(new THREE.Vector3()).y;
  let glassOriginal, bezel, shell;
  gltf.scene.traverse((object)=>{
    if(!object.isMesh)return;
    const geometry=object.geometry.clone();
    if(object.material.name==='Plastic')removeBuiltInCartridge(geometry);
    geometry.applyMatrix4(object.matrixWorld);geometry.translate(-center.x,-center.y,-center.z);geometry.scale(normalize,normalize,normalize);
    const mat=object.material.clone();
    if(mat.map)mat.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    if(mat.name==='Case'){
      mat.metalness=0;mat.roughness=.86;mat.roughnessMap=null;mat.metalnessMap=null;mat.envMapIntensity=.12;mat.normalScale.setScalar(.65);
      mat.onBeforeCompile=(shader)=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float cyan = smoothstep(0.02, 0.14, min(diffuseColor.g, diffuseColor.b) - diffuseColor.r);
        vec3 yellow = vec3(diffuseColor.g * 1.7, diffuseColor.g * 0.385, diffuseColor.r * 0.055 + diffuseColor.g * 0.0025);
        diffuseColor.rgb = mix(diffuseColor.rgb, yellow, cyan);
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
          vec3 lighting = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb, vec3(0.001));
          float lightLevel = dot(lighting, vec3(0.2126, 0.7152, 0.0722));
          float softBands = 0.57 + 0.17 * smoothstep(0.18, 0.58, lightLevel) + 0.20 * smoothstep(0.52, 1.12, lightLevel);
          outgoingLight = diffuseColor.rgb * softBands + min(totalSpecular, vec3(0.012));
          #ifdef USE_AOMAP
            outgoingLight *= mix(0.64, 1.0, ambientOcclusion);
          #endif
          #include <opaque_fragment>
        `);
        // Keep the photographed amber pigment saturated through the filmic colour transform.
        shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>', `
          #include <tonemapping_fragment>
          gl_FragColor.rgb *= mix(vec3(1.0), vec3(1.0, 0.97, 0.4), cyan);
        `);
      };
      mat.customProgramCacheKey=()=> 'yellow-case-soft-bands-v4';
    }
    if(mat.name==='Glass'){
      glassOriginal=object;mat.emissive.set(0x000000);mat.emissiveIntensity=0;mat.transparent=true;mat.roughness=.82;mat.metalness=0;mat.metalnessMap=null;mat.roughnessMap=null;
      // Replace the printed logo with the adjacent unprinted bezel texels.
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          float logoMask = smoothstep(.415, .43, vMapUv.x) * (1. - smoothstep(.49, .51, vMapUv.x))
            * smoothstep(.115, .135, vMapUv.y) * (1. - smoothstep(.47, .49, vMapUv.y));
          vec3 cleanBezel = texture2D(map, vec2(.425, vMapUv.y)).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * cleanBezel, logoMask);`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          normal = normalize(mix(normal, nonPerturbedNormal, logoMask));`);
      };
      mat.customProgramCacheKey=()=> 'unprinted-glass-bezel-v1';
    }
    if(mat.name==='Plastic'){mat.roughness=.94;mat.metalness=0;mat.envMapIntensity=.18;}
    if(mat.name==='Plastic'){
      Object.assign(consoleControls,splitConsoleControls(geometry,mat));
      for(const control of Object.values(consoleControls))rig.add(control.mesh);
    }
    const mesh=new THREE.Mesh(geometry,mat);
    rig.add(mesh);
    if(mat.name==='Glass')bezel=mesh;
    if(mat.name==='Case')shell=mesh;
  });
  setupConsoleControls();
  await addStickers(bezel,shell,rig,renderer);
  const originalPoint=new THREE.Vector3(.03858,-.35803,.34718).applyMatrix4(glassOriginal.matrixWorld);
  screenPosition=originalPoint.sub(center).multiplyScalar(normalize);screenPosition.z+=.009;
  const transformedA=new THREE.Vector3(-.38406,-.35803,-.02597).applyMatrix4(glassOriginal.matrixWorld);
  const transformedB=new THREE.Vector3(.46122,-.35803,.72033).applyMatrix4(glassOriginal.matrixWorld);
  screenWidth=Math.abs(transformedB.x-transformedA.x)*normalize;screenHeight=Math.abs(transformedB.y-transformedA.y)*normalize;
  screenBlack=new THREE.Mesh(new THREE.PlaneGeometry(screenWidth,screenHeight),new THREE.MeshBasicMaterial({color:0x0b0e0b}));screenBlack.position.copy(screenPosition);rig.add(screenBlack);
  setupSpeakerFlash();
  await document.fonts.load('400 36px "Geist Mono"');
  const promptCanvas=document.createElement('canvas');
  promptCanvas.width=640;promptCanvas.height=565;
  const promptContext=promptCanvas.getContext('2d');
  const promptTexture=new THREE.CanvasTexture(promptCanvas);
  promptTexture.colorSpace=THREE.SRGBColorSpace;
  const descriptions=[['a little','about me'],['designing','goodnotes classroom'],['my talk at','figma config'],['agentic design','as world-building'],['coming soon']];
  let lastPrompt;
  updateCartridgePrompt=(index=-1)=>{
    if(index===lastPrompt)return;
    lastPrompt=index;
    const lines=descriptions[index] || ['drag and drop','a cartridge in'];
    promptContext.fillStyle='#0b0e0b';
    promptContext.fillRect(0,0,640,565);
    promptContext.fillStyle='#c9ccba';
    promptContext.font='400 36px "Geist Mono", monospace';
    promptContext.textAlign='center';promptContext.textBaseline='middle';
    lines.forEach((line,i)=>promptContext.fillText(line,320,260+i*48));
    promptContext.fillStyle='rgba(11,14,11,.12)';
    for(let y=0;y<565;y+=4)promptContext.fillRect(0,y,640,1);
    promptTexture.needsUpdate=true;
  };
  updateCartridgePrompt();
  cartridgePrompt=new THREE.Mesh(screenBlack.geometry,new THREE.MeshBasicMaterial({map:promptTexture,toneMapped:false}));
  cartridgePrompt.position.copy(screenPosition);cartridgePrompt.position.z+=.002;
  cartridgePrompt.visible=false;rig.add(cartridgePrompt);
  screenObject=new THREE.Object3D();screenObject.position.copy(screenPosition);screenObject.position.z+=.004;rig.add(screenObject);updateScreenSize();
  try {
    lcdScreen=new LcdScreen(screenElement);
    lcdScreen.prepareBoot($('.boot-logo canvas'));
    await lcdScreen.refresh();
    if(import.meta.env.DEV){
      const { mountLcdControls }=await import('./lcd/controls.js');
      destroyLcdControls=mountLcdControls(lcdScreen);
    }
  } catch(error) {
    console.warn('LCD effect unavailable; keeping the native scrolling page.',error);
  }
  const lensCanvas=document.createElement('canvas');lensCanvas.width=lensCanvas.height=64;
  const lensContext=lensCanvas.getContext('2d');
  const lensGradient=lensContext.createRadialGradient(25,23,3,32,32,32);
  lensGradient.addColorStop(0,'#ffffff');lensGradient.addColorStop(.6,'#e5e5e5');lensGradient.addColorStop(1,'#777777');
  lensContext.fillStyle=lensGradient;lensContext.fillRect(0,0,64,64);
  const lensTexture=new THREE.CanvasTexture(lensCanvas);lensTexture.colorSpace=THREE.SRGBColorSpace;
  ledMaterial=new THREE.MeshBasicMaterial({color:0x351017,map:lensTexture,toneMapped:false});
  const led=new THREE.Mesh(new THREE.CircleGeometry(.034,32),ledMaterial);led.position.set(screenPosition.x-screenWidth/2-.254,screenPosition.y+.13,screenPosition.z+.092);rig.add(led);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
  const gc=glowCanvas.getContext('2d');const grad=gc.createRadialGradient(32,32,0,32,32,32);
  grad.addColorStop(0,'#ff102c80');grad.addColorStop(.35,'#e6002026');grad.addColorStop(1,'#d9002000');gc.fillStyle=grad;gc.fillRect(0,0,64,64);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
  glow.position.copy(led.position);glow.position.z+=.01;glow.scale.setScalar(.14);glow.name='power-glow';glow.renderOrder=3;rig.add(glow);
  const educationCover = new Image();
  educationCover.src = '/images/cartridges/education.png';
  const configCover = new Image();
  configCover.src = '/images/cartridges/config.png';
  const bulbasaurSprite = new Image();
  bulbasaurSprite.src = '/images/cartridges/bulbasaur.png';
  const soonLogo = new Image();
  soonLogo.src = '/images/soon-logo.png';
  await Promise.all([soonLogo.decode(), educationCover.decode(), configCover.decode(), bulbasaurSprite.decode()]);
  for (const appearance of [{ shellColor: '#e57c18' }, { cover: educationCover, shellColor: '#2073ca' }, { cover: configCover, shellColor: '#a84f50' }, { thumbnail: bulbasaurSprite, shellColor: '#9dce82' }, { cover: soonLogo, shellColor: '#171717' }]) {
    const cart = createCartridge(cartridgeGltf, renderer, appearance);
    cart.position.copy(cartHome(cartridges.length));cart.scale.setScalar(FLOATING_CARTRIDGE_SCALE);
    const rotation=cartRotation(cartridges.length);cart.rotation.set(rotation.x,rotation.y,rotation.z);cart.visible=false;scene.add(cart);cartridges.push(cart);
  }
  selectCartridge(0);
  Object.assign(pose,homePose());
  const inspection=import.meta.env.DEV ? new URLSearchParams(location.search).get('inspect-model') : null;
  if(inspection==='left')Object.assign(pose,{rx:.1,ry:.7,rz:0});
  if(inspection==='back'||inspection==='seated-back')Object.assign(pose,{rx:-.15,ry:Math.PI+.25,rz:0});
  if(inspection==='seated-back'){rig.add(cartridge);cartridge.visible=true;cartridge.position.copy(cartridge.userData.seatedPosition);cartridge.rotation.set(0,Math.PI,0);cartridge.scale.setScalar(CARTRIDGE_INSERT_SCALE);}
  setState('idle');powerHit.disabled=false;
  if (readRoute(location).index !== null) applyRoute({ instant: true });
  else if (reader.isOpen) swapReaderCartridge(reader.current);
  if (readRoute(location).index !== null) $('.loading').hidden = true;
  else gsap.to('.loading',{opacity:0,duration:.25,onComplete:()=>$('.loading').hidden=true});
  animate();
  const warmPuppy = () => { void preloadPuppy().catch(() => {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(warmPuppy, { timeout: 2000 });
  else setTimeout(warmPuppy, 500);
}

function project(position) {const p=position.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
function positionHit(element, object, w,h, anchor) {
  const middle=anchor || object.getWorldPosition(new THREE.Vector3());const p=project(middle);const a=project(middle.clone().add(new THREE.Vector3(w/2,h/2,0)));const b=project(middle.clone().add(new THREE.Vector3(-w/2,-h/2,0)));
  element.style.left=`${p.x}px`;element.style.top=`${p.y}px`;element.style.width=`${Math.abs(a.x-b.x)}px`;element.style.height=`${Math.abs(a.y-b.y)}px`;
}

function animate() {
  requestAnimationFrame(animate);
  if(document.hidden)return;
  const delta = Math.min(clock.getDelta(), .05);
  const elapsed=clock.elapsedTime;
  if (readerFraming !== readerFrameMotion.value) {
    readerFraming = readerFrameMotion.value;
    camera.setViewOffset(width, height, width > 700 ? width * .28 * readerFraming : 0, width <= 700 ? height * .36 * readerFraming : 0, width, height);
  }
  const resting=state==='idle'||state==='ready'||(reader.isOpen&&state==='reading');
  const attentive=resting&&!pointer&&!reducedMotion&&canHover.matches;
  const follow=1-Math.exp(-9*delta);
  gaze.x=THREE.MathUtils.lerp(gaze.x,attentive?gazeTarget.x:0,follow);
  gaze.y=THREE.MathUtils.lerp(gaze.y,attentive?gazeTarget.y:0,follow);
  hoverAmount=THREE.MathUtils.lerp(hoverAmount,attentive&&hovered?.25:0,follow);
  const bob=resting&&!pointer&&!reducedMotion ? Math.sin(elapsed*1.25)*.055 : 0;
  const deviceAttentive=resting&&!pointer&&!reducedMotion;
  deviceGaze.x=THREE.MathUtils.lerp(deviceGaze.x,deviceAttentive?deviceTarget.x:0,follow);
  deviceGaze.y=THREE.MathUtils.lerp(deviceGaze.y,deviceAttentive?deviceTarget.y:0,follow);
  rig.position.set(pose.x-deviceGaze.x*.044,pose.y+bob+deviceGaze.y*.031,pose.z+hoverAmount);
  rig.rotation.set(pose.rx+gaze.y*.11+deviceGaze.y*.08-hoverAmount*.10,pose.ry+gaze.x*.20+deviceGaze.x*.11,pose.rz-gaze.x*.018);
  camera.lookAt(cameraTarget);camera.updateMatrixWorld();rig.updateMatrixWorld();

  cartridges.forEach((cart,index)=>{
    const motion=cartridgeMotion[index];
    if (readerEntering && index !== activeCartridge) return;
    const readerFloating = reader.isOpen && state === 'reading' && index !== activeCartridge && cart.visible;
    if(state!=='ready' && !readerFloating) { motion.hovered=false;motion.lift=0;motion.tiltX=0;motion.tiltY=0;return; }
    if(pointer || readerDrag?.index === index)return;
    const home=readerFloating?readerCartridgeHome(index):cartHome(index), rotation=readerFloating?readerCartridgeRotation(index):cartRotation(index);
    if(readerFloating) {
      cart.scale.setScalar(readerCartridgeScale());
      const highlighted = (canHover.matches && motion.hovered) || document.activeElement === cartHits[index];
      motion.lift = THREE.MathUtils.lerp(motion.lift, highlighted ? 1 : 0, reducedMotion ? 1 : follow);
      const pixelsPerUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - home.z));
      home.y += motion.lift * 8 / pixelsPerUnit;
      cart.position.lerp(home, reducedMotion ? 1 : follow);
      if(cart.position.distanceToSquared(home) < .0000001) cart.position.copy(home);
      cart.rotation.set(rotation.x, rotation.y, rotation.z);
      return;
    }
    const phase=[.65,3.1,5.2,1.8,4.2][index];
    const speed=[1.04,1.37,.91,1.17,1.12][index];
    const amplitude=[.10,.085,.095,.09,.08][index];
    const moving=!reducedMotion;
    motion.lift=THREE.MathUtils.lerp(motion.lift,moving&&((canHover.matches&&motion.hovered)||controlSelection===index||(readerFloating&&document.activeElement===cartHits[index]))?1:0,follow);
    const tracking=moving&&canHover.matches&&motion.hovered;
    motion.tiltX=THREE.MathUtils.lerp(motion.tiltX,tracking?motion.cursorY*.10:0,follow);
    motion.tiltY=THREE.MathUtils.lerp(motion.tiltY,tracking?motion.cursorX*.12:0,follow);
    const drift=moving?Math.sin(elapsed*speed+phase)*amplitude:0;
    const sway=moving?Math.sin(elapsed*speed*.58+phase)*.028:0;
    cart.position.x=THREE.MathUtils.lerp(cart.position.x,home.x+sway+deviceGaze.x*.16,follow);
    cart.position.y=THREE.MathUtils.lerp(cart.position.y,home.y+drift+motion.lift*(readerFloating?.32:.09)-deviceGaze.y*.125,follow);
    cart.position.z=THREE.MathUtils.lerp(cart.position.z,home.z+motion.lift*.7,follow);
    cart.rotation.x=rotation.x-motion.lift*.05+motion.tiltX+deviceGaze.y*.031;
    cart.rotation.y=rotation.y+motion.tiltY+deviceGaze.x*.05+motion.spin;
    cart.rotation.z=rotation.z+(moving?Math.sin(elapsed*speed*.7+phase)*.032:0);
  });
  if(cartridgePrompt?.visible){
    const hoverIndex=cartridgeMotion.findIndex(motion=>motion.hovered);
    const focusIndex=cartHits.findIndex(hit=>hit===document.activeElement&&hit.matches(':focus-visible'));
    updateCartridgePrompt(pointer?activeCartridge:state==='ready'?(hoverIndex>=0?hoverIndex:focusIndex>=0?focusIndex:controlSelection):-1);
  }
  if(state==='dragging'&&pointer?.dragged)updateMagneticDrag(delta);
  if(state==='idle'||state==='ready')positionHit(powerHit,rig,2.85,4.8);
  if(reader.isOpen && state==='reading' && !readerEntering){
    cartridges.forEach((cart,index)=>{ cartHits[index].hidden = index === activeCartridge; cartHits[index].style.zIndex = String(cartridgeMotion[index].hovered || document.activeElement === cartHits[index] ? 20 : 13 + index); if(index !== activeCartridge) positionHit(cartHits[index],cart,1.85*readerCartridgeScale(),2.1*readerCartridgeScale()); });
  }
  if(state==='ready'){
    cartridges.forEach((cart,index)=>positionHit(cartHits[index],cart,1.85*FLOATING_CARTRIDGE_SCALE,2.1*FLOATING_CARTRIDGE_SCALE));
  }
  const sticker = rig.getObjectByName('Reader sticker');
  if (sticker) {
    const facing = new THREE.Vector3(0, 0, 1).transformDirection(rig.matrixWorld).dot(camera.position.clone().sub(rig.position).normalize());
    readerSticker.hidden = facing < .4 || !['idle', 'ready', 'reading'].includes(state);
    positionHit(readerSticker, rig, .26, .26, rig.localToWorld(sticker.userData.anchor.clone()));
  }
  updateConsoleControls();
  renderer.render(scene,camera);updateScreenProjection();
}



function setupSpeakerFlash(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const context=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const icon=new THREE.Mesh(new THREE.PlaneGeometry(.45,.45),material);
  icon.position.copy(screenPosition);icon.position.z+=.006;rig.add(icon);
  flashSpeaker=()=>{
    context.clearRect(0,0,128,128);
    context.fillStyle='#c9ccba';context.strokeStyle='#c9ccba';context.lineWidth=7;context.lineCap='round';context.lineJoin='round';
    context.beginPath();context.moveTo(22,50);context.lineTo(43,50);context.lineTo(65,31);context.lineTo(65,97);context.lineTo(43,78);context.lineTo(22,78);context.closePath();context.fill();
    context.beginPath();
    if(soundEnabled){context.arc(65,64,23,-.8,.8);context.moveTo(93,36);context.arc(65,64,40,-.8,.8);}
    else{context.moveTo(82,51);context.lineTo(108,77);context.moveTo(108,51);context.lineTo(82,77);}
    context.stroke();texture.needsUpdate=true;
    gsap.killTweensOf(material);material.opacity=1;
    // Place it above the prompt; the reading screen is not interrupted.
    icon.position.y=screenPosition.y+screenHeight*.3;
    gsap.to(material,{opacity:0,delay:.42,duration:duration(.22)});
  };
}

function setupConsoleControls() {
  for(const [name,control] of Object.entries(consoleControls)){
    const hit=document.createElement('button');
    hit.className='console-hit';hit.hidden=true;
    if(name==='start'||name==='select')hit.classList.add('console-hit-small');
    hit.setAttribute('aria-label',name==='pad'?'D-pad: choose a cartridge with arrow keys':{a:'A: insert selected cartridge',b:'B: dismiss cartridges or eject loaded cartridge',start:'Start: wake Game Boy and show cartridges',select:'Select: toggle sound'}[name]);
    $('#stage').appendChild(hit);control.hit=hit;
    const press=()=>{
      gsap.killTweensOf(control.mesh.position);
      gsap.to(control.mesh.position,{z:control.center.z-.045,duration:reducedMotion?0:.055,overwrite:true});
    };
    const release=()=>gsap.to(control.mesh.position,{z:control.center.z,duration:reducedMotion?0:.14,ease:'back.out(1.4)',overwrite:true});
    hit.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();hit.setPointerCapture(e.pointerId);press();});
    hit.addEventListener('pointerup',release);hit.addEventListener('pointercancel',release);hit.addEventListener('lostpointercapture',release);
    hit.addEventListener('click',e=>{
      e.stopPropagation();
      if(pointer||!['idle','ready','reading'].includes(state))return;
      if(e.detail===0){press();gsap.delayedCall(.07,release);}
      if(name!=='select')sound('press', { pitch: name==='b' ? -2 : name==='pad' ? 2 : 0 });
      if(name==='start'){
        if(state==='idle')powerOn();
      }else if(name==='select'){
        toggleSound();
      }else if(name==='a'){
        if(state==='idle')powerOn();else if(state==='ready')loadCartridge();
      }else if(name==='b'){
        if(state==='reading')eject();
        else if(state==='ready')dismissCartridge(e.detail===0);
      }else if(state!=='reading'){
        const r=hit.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
        chooseWithPad(e.detail===0?'right':Math.abs(x)>Math.abs(y)?x>0?'right':'left':y>0?'down':'up');
      }
    });
    if(name==='pad')hit.addEventListener('keydown',e=>{
      const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];
      if(!direction||!['idle','ready'].includes(state)||pointer)return;
      e.preventDefault();e.stopPropagation();press();gsap.delayedCall(.07,release);sound('press');chooseWithPad(direction);
    });
  }
}
function chooseWithPad(direction){
  if(state==='idle'){powerOn();controlSelection=activeCartridge;return;}
  if(state!=='ready')return;
  const index=directionalCartridge(activeCartridge,direction,cartridges.map((_,i)=>cartHome(i)));
  const changed=controlSelection!==index;
  selectCartridge(index);controlSelection=index;
  if(changed)sound('tick', { pitch: index * 1.5 });
  if(changed&&!reducedMotion){
    const motion=cartridgeMotion[index];
    gsap.to(motion,{spin:(Math.floor(motion.spin/(Math.PI*2))+1)*Math.PI*2,duration:.48,ease:'power2.inOut',overwrite:'auto',onComplete:()=>motion.spin=0});
  }
  instruction.textContent=`${cartridgeNames[index]} selected. Press A to insert.`;
}
function updateConsoleControls(){
  for(const [name,control] of Object.entries(consoleControls)){
    if(!control.hit)continue;
    const visible=!pointer&&(['idle','ready'].includes(state)||(state==='reading'&&name==='b'));
    const world=rig.localToWorld(control.center.clone());const p=project(world);
    control.hit.hidden=!visible||p.x<0||p.x>width||p.y<0||p.y>height;
    if(!control.hit.hidden)positionHit(control.hit,control.mesh,name==='pad'?.65:.34,name==='pad'?.65:.34,world);
  }
  // Separate neighboring controls while keeping each physical button in its hit area.
  const pairs = [[consoleControls.start?.hit, consoleControls.select?.hit]];
  if (mobile() || matchMedia('(pointer: coarse)').matches) pairs.push([consoleControls.a?.hit, consoleControls.b?.hit]);
  for (const [first, second] of pairs) {
    if (!first || first.hidden || !second || second.hidden) continue;
    const x1 = parseFloat(first.style.left), y1 = parseFloat(first.style.top);
    const x2 = parseFloat(second.style.left), y2 = parseFloat(second.style.top);
    const dx = x1 - x2, dy = y1 - y2;
    const separation = Math.max(Math.abs(dx), Math.abs(dy));
    if (separation > 0 && separation < 52) {
      const offset = (52 / separation - 1) / 2;
      first.style.left = `${x1 + dx * offset}px`; first.style.top = `${y1 + dy * offset}px`;
      second.style.left = `${x2 - dx * offset}px`; second.style.top = `${y2 - dy * offset}px`;
    }
  }
  if (mobile() || matchMedia('(pointer: coarse)').matches) {
    const upper = ['pad', 'a', 'b'].map(name => consoleControls[name]?.hit).filter(hit => hit && !hit.hidden);
    const lowerTop = Math.max(...upper.map(hit => parseFloat(hit.style.top) + Math.max(48, parseFloat(hit.style.height)) / 2)) + 4;
    for (const name of ['start', 'select']) {
      const hit = consoleControls[name]?.hit;
      if (hit && !hit.hidden && upper.length) hit.style.top = `${Math.max(parseFloat(hit.style.top), lowerTop + 24)}px`;
    }
  }
}

function powerOn() {
  if(state!=='idle')return;
  void deviceTilt.request();
  setState('waking');sound('power');powerHit.disabled=true;
  ledMaterial.color.set(0xff1428);rig.getObjectByName('power-glow').material.opacity=.5;
  instruction.textContent='Choose a cartridge: Moby, Goodnotes education, Config talk, World-building or Labradoodle. Drag it onto the Game Boy, or press Enter to insert.';
  transition=gsap.timeline({onComplete:()=>{setState('ready');cartHits.forEach(hit=>hit.hidden=false);powerHit.hidden=true;cartHit.focus({preventScroll:true});}});
  transition.to(pose,{...readyPose(),duration:reducedMotion?0:needsDepthSeparation()?.7:.45,ease:'power3.inOut'},0);
  cartridges.forEach((cart,index)=>{
    const rotation=cartRotation(index);
    cart.visible=true;cart.scale.setScalar(FLOATING_CARTRIDGE_SCALE);
    cart.position.copy(reducedMotion?cartHome(index):cartEdge(index));
    cart.rotation.set(rotation.x,rotation.y,rotation.z+(reducedMotion?0:Math.sign(cartHome(index).x)*.12));
    transition.to(cart.position,{...cartHome(index),duration:reducedMotion?0:.48,ease:'power3.out'},needsDepthSeparation()&&!reducedMotion?.18:0);
    transition.to(cart.rotation,{...rotation,duration:reducedMotion?0:.48,ease:'power3.out'},needsDepthSeparation()&&!reducedMotion?.18:0);
  });
}

function dismissCartridge(fromKeyboard=false) {
  if(state!=='ready'||pointer)return;
  const restoreFocus=fromKeyboard||document.activeElement===cartHit;
  setState('dismissing');cartHits.forEach(hit=>hit.hidden=true);hovered=false;
  const materials=[];
  cartridges.forEach(cart=>cart.traverse((object)=>{
    if(!object.isMesh)return;
    const material=object.material;
    materials.push({material,opacity:material.opacity,transparent:material.transparent});
    material.transparent=true;material.needsUpdate=true;
  }));
  const fade={opacity:1};
  const idleLed=new THREE.Color(0x351017);
  transition=gsap.timeline({onComplete:()=>{
    cartridges.forEach(cart=>{cart.visible=false;});
    for(const entry of materials){
      entry.material.opacity=entry.opacity;entry.material.transparent=entry.transparent;entry.material.needsUpdate=true;
    }
    setState('idle');powerHit.hidden=false;powerHit.disabled=false;
    instruction.textContent='Cartridge tucked away. Click the Game Boy to bring it back.';
    if(restoreFocus)powerHit.focus({preventScroll:true});
  }});
  const exitTime=reducedMotion?0:.24;
  transition.to(fade,{opacity:0,duration:exitTime,ease:'power2.in',onUpdate:()=>{
    for(const entry of materials)entry.material.opacity=entry.opacity*fade.opacity;
  }},0);
  cartridges.forEach((cart,index)=>transition.to(cart.position,{...cartEdge(index),duration:exitTime,ease:'power2.in'},0));
  transition.to(pose,{...homePose(),duration:reducedMotion?0:.38,ease:'power3.inOut'},0);
  transition.to(ledMaterial.color,{r:idleLed.r,g:idleLed.g,b:idleLed.b,duration:exitTime},0);
  transition.to(rig.getObjectByName('power-glow').material,{opacity:0,duration:exitTime},0);
}

function isBackdrop(e) {
  if(!renderer||e.target!==renderer.domElement&&e.target!==$('#webgl')&&e.target!==$('#stage'))return false;
  pointerNdc.set(e.clientX/width*2-1,-e.clientY/height*2+1);
  raycaster.setFromCamera(pointerNdc,camera);
  return raycaster.intersectObjects([rig,...cartridges.filter(cart=>cart.visible)],true).length===0;
}
let backdropPress=null;
$('#stage').addEventListener('pointerdown',e=>{
  backdropPress=null;
  if(e.button===0&&(state==='ready'||state==='reading')&&!pointer&&!reader.isOpen&&isBackdrop(e)){
    backdropPress={x:e.clientX,y:e.clientY,state};
  }
});
$('#stage').addEventListener('pointermove',e=>{
  if(backdropPress&&Math.hypot(e.clientX-backdropPress.x,e.clientY-backdropPress.y)>6)backdropPress=null;
});
$('#stage').addEventListener('pointercancel',()=>backdropPress=null);
$('#stage').addEventListener('click',e=>{
  const press=backdropPress;backdropPress=null;
  if(!press||press.state!==state||pointer||reader.isOpen||!isBackdrop(e))return;
  if(state==='reading')eject();else if(state==='ready')dismissCartridge();
});

powerHit.addEventListener('click',powerOn);
powerHit.addEventListener('pointerenter',(e)=>{hovered=e.pointerType==='mouse'&&canHover.matches;});
powerHit.addEventListener('pointerleave',()=>hovered=false);
window.addEventListener('pointermove',(e)=>{
  if(e.pointerType!=='mouse'||!canHover.matches||reducedMotion)return;
  gazeTarget.set(THREE.MathUtils.clamp(e.clientX/width*2-1,-1,1),THREE.MathUtils.clamp(e.clientY/height*2-1,-1,1));
},{passive:true});
const resetGaze=()=>{gazeTarget.set(0,0);hovered=false;cartridgeMotion.forEach(motion=>motion.hovered=false);};
document.documentElement.addEventListener('pointerleave',resetGaze);
window.addEventListener('blur',resetGaze);

function pointerWorld(e,z=.75) {
  pointerNdc.set(e.clientX/width*2-1,-e.clientY/height*2+1);raycaster.setFromCamera(pointerNdc,camera);
  const result=new THREE.Vector3();raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),result);return result;
}
function nearConsole(position=cartridge.position) {return Math.hypot(position.x-pose.x,position.y-pose.y)<(mobile()?2:2.25);}
function updateMagneticDrag(delta) {
  const slot=rig.localToWorld(new THREE.Vector3(0,2.7,-.3)).project(camera);
  raycaster.setFromCamera(new THREE.Vector2(slot.x,slot.y),camera);
  const target=new THREE.Vector3();
  raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-pointer.depth),target);
  const distance=pointer.raw.distanceTo(target);
  const strength=(1-THREE.MathUtils.smoothstep(distance,.25,1.6))*.86;
  const latched=distance<(pointer.magnetized?1.5:1.2);
  if(latched!==pointer.magnetized) {
    pointer.magnetized=latched;
    instruction.textContent=latched?'Release to snap the cartridge in.':'Bring the cartridge to the Game Boy';
    if(latched)sound('tick');
  }
  const destination=pointer.raw.clone().lerp(target,strength);
  if(reducedMotion||strength===0)cartridge.position.copy(destination);
  else cartridge.position.lerp(destination,1-Math.exp(-20*delta));
}

cartHits.forEach((hit,index)=>{
const trackCursor=e=>{
  if(e.pointerType!=='mouse'||!canHover.matches||reducedMotion||!(state==='ready'||reader.isOpen&&state==='reading')||pointer)return;
  const bounds=hit.getBoundingClientRect();
  const motion=cartridgeMotion[index];
  motion.cursorX=THREE.MathUtils.clamp((e.clientX-bounds.left)/bounds.width*2-1,-1,1);
  motion.cursorY=THREE.MathUtils.clamp((e.clientY-bounds.top)/bounds.height*2-1,-1,1);
};
hit.title = cartridgeNames[index];
hit.addEventListener('click',e=>{if(e.detail===0&&reader.isOpen&&state==='reading')swapReaderCartridge(index);});
hit.addEventListener('pointerenter',e=>{cartridgeMotion[index].hovered=e.pointerType==='mouse'&&canHover.matches;trackCursor(e);});
hit.addEventListener('pointerleave',()=>{cartridgeMotion[index].hovered=false;});
hit.addEventListener('pointerdown',(e)=>{
  if(reader.isOpen && state==='reading' && e.button===0) {
    const cart = cartridges[index];
    readerDrag = { index, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, offset: cart.position.clone().sub(pointerWorld(e, .75)) };
    hit.setPointerCapture(e.pointerId);
    hit.style.cursor = 'grabbing';
    return;
  }
  if(state!=='ready' ||e.button!==0)return;
  controlSelection=-1;
  selectCartridge(index);
  sound('pickup', { pitch: index * 1.5 });
  const depth=cartridge.position.z;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,depth,offset:cartridge.position.clone().sub(pointerWorld(e,depth)),raw:cartridge.position.clone(),magnetized:false,dragged:false};
  cartHit.setPointerCapture(e.pointerId);
  gsap.killTweensOf(pose);
  gsap.to(pose,{z:receivingPose().z,duration:reducedMotion?0:.24,ease:'power3.out'});
});
hit.addEventListener('pointermove',(e)=>{
  trackCursor(e);
  if(readerDrag?.index===index && readerDrag.id===e.pointerId) {
    if(Math.hypot(e.clientX-readerDrag.x,e.clientY-readerDrag.y)>6) readerDrag.moved=true;
    if(readerDrag.moved) cartridges[index].position.copy(pointerWorld(e,.75).add(readerDrag.offset));
    return;
  }
  if(!pointer||e.pointerId!==pointer.id)return;
  if(!pointer.dragged&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6){
    pointer.dragged=true;setState('dragging');cartHit.style.cursor='grabbing';
    instruction.textContent='Bring the cartridge to the Game Boy';
    const {z,...angle}=receivingPose();
    gsap.to(pose,{...angle,duration:reducedMotion?0:.48,delay:reducedMotion?0:.08,ease:'power2.inOut'});
    gsap.to(cartridge.rotation,{x:0,y:0,z:0,duration:duration(.4),ease:'power2.out'});
  }
  if(pointer.dragged){pointer.raw.copy(pointerWorld(e,pointer.depth).add(pointer.offset));cartHit.style.left=`${e.clientX}px`;cartHit.style.top=`${e.clientY}px`;}
});
hit.addEventListener('pointerup',(e)=>{
  if(readerDrag?.index===index && readerDrag.id===e.pointerId) {
    const load = !readerDrag.moved || nearConsole(cartridges[index].position);
    readerDrag = null;
    hit.releasePointerCapture(e.pointerId); hit.style.cursor = 'grab';
    if(load) swapReaderCartridge(index);
    return;
  }
  if(!pointer||e.pointerId!==pointer.id)return;
  const wasDrag=pointer.dragged;
  if(wasDrag){pointer.raw.copy(pointerWorld(e,pointer.depth).add(pointer.offset));updateMagneticDrag(0);}
  const canLoad=!wasDrag||pointer.magnetized||nearConsole(pointer.raw);pointer=null;cartHit.releasePointerCapture(e.pointerId);cartHit.style.cursor='grab';
  if(canLoad)loadCartridge(wasDrag);else returnCartridge();
});
hit.addEventListener('lostpointercapture',()=>{if(readerDrag?.index===index){readerDrag=null;hit.style.cursor='grab';}});
hit.addEventListener('pointercancel',()=>{if(readerDrag?.index===index){readerDrag=null;hit.style.cursor='grab';}if(pointer){pointer=null;returnCartridge();}});
hit.addEventListener('click',(e)=>{if(e.detail===0&&state==='ready'){selectCartridge(index);loadCartridge(false);}});
});

function returnCartridge() {
  gsap.killTweensOf([pose,cartridge.position,cartridge.rotation]);
  setState('returning');
  gsap.to(pose,{...readyPose(),duration:duration(.5),ease:'power3.out'});
  gsap.to(cartridge.rotation,{...cartRotation(),duration:duration(.45)});
  gsap.to(cartridge.position,{...cartHome(),duration:duration(.5),ease:'power3.out',onComplete:()=>{setState('ready');instruction.textContent='Drag the cartridge in. Or click to load.';}});
}

function updateScreenSize() {
  const compact = mobile();
  screenElement.classList.toggle('compact',compact);
  screenLocalMatrix.set(
    screenWidth/(compact?420:640),0,0,-screenWidth/2,
    0,-screenHeight/(compact?371:565),0,screenHeight/2,
    0,0,1,0,
    0,0,0,1,
  );
}

function updateScreenProjection() {
  if (!screenObject || screenElement.style.opacity !== '1') return;
  screenClipMatrix.copy(camera.projectionMatrix)
    .multiply(camera.matrixWorldInverse)
    .multiply(screenObject.matrixWorld)
    .multiply(screenLocalMatrix);
  screenElement.style.transform = `matrix3d(${screenProjectionMatrix(screenClipMatrix.elements,width,height).join(',')})`;
}

function readingView() {
  if (reader.isOpen) return { distance: cameraDistance(), target: new THREE.Vector3() };
  if (width <= 700 || (width <= 900 && height < 500)) {
    // Fit the complete shell, including the README sticker and lower controls.
    const pixelsPerUnit = Math.min((width - 24) / 3.4, Math.max(160, height - 180) / 5.3);
    const distance = height / (2 * pixelsPerUnit * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    return { distance: distance + .5, target: new THREE.Vector3(0, .12, 0) };
  }
  const usableWidth=Math.min(width*.60,660);
  const usableHeight=Math.min(height*.66,600);
  const pixelsPerUnit=Math.min(usableWidth/screenWidth,usableHeight/screenHeight);
  const distance=(height/2)/(pixelsPerUnit*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  return {distance:distance+screenPosition.z,target:screenPosition.clone().add(new THREE.Vector3(0,-.12,0))};
}

function readerShelfLayout() {
  const rect = $('#reader-pane').getBoundingClientRect();
  const cardWidth = Math.min(108, (rect.width - 74) / 3.9);
  return { rect, cardWidth, spacing: cardWidth * .70 };
}
function readerCartridgeScale() {
  const { cardWidth } = readerShelfLayout();
  const pixelsPerUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - .75));
  return cardWidth / (1.85 * pixelsPerUnit);
}
function readerCartridgeHome(index) {
  const { rect, spacing, cardWidth } = readerShelfLayout();
  const slot = index > activeCartridge ? index - 1 : index;
  const x = rect.left + rect.width / 2 + (slot - 1.5) * spacing;
  const y = rect.top + cardWidth * .10;
  const point = new THREE.Vector3(x/width*2-1,1-y/height*2,.5).unproject(camera);
  const direction = point.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(direction, (.75 + slot * .025-camera.position.z)/direction.z);
}
function readerCartridgeRotation(index) {
  return { x: 0, y: -.52, z: 0 };
}

function enterReader(index, { instant = false } = {}) {
  if (instant) {
    readerFraming = readerFrameMotion.value = 1;
    const curl = rig.getObjectByName('Reader sticker')?.userData.curl;
    if (curl) curl.value = 0;
    swapReaderCartridge(index, { instant: true });
    camera.lookAt(cameraTarget);
    settleReaderShelf({ instant: true });
    return;
  }
  cartHits.forEach(hit => hit.hidden = true);
  readerEntrance = gsap.timeline();
  cartridges.forEach((cart, i) => {
    if (i === index || !cart.visible) return;
    scene.attach(cart);
    gsap.killTweensOf([cart.position, cart.rotation, cart.scale]);
    const exitY = camera.position.y + Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - cart.position.z) + 4;
    readerEntrance.to(cart.position, { y: exitY, duration: reducedMotion ? 0 : .24, ease: 'power2.in', onComplete: () => { cart.visible = false; } }, 0);
  });
  readerEntrance.call(() => {
    gsap.to(readerFrameMotion, { value: 1, duration: reducedMotion ? 0 : .7, ease: 'power3.inOut', overwrite: true });
    resizeScene(true);
    swapReaderCartridge(index);
  }, null, reducedMotion ? 0 : .24);
  readerEntrance.call(settleReaderShelf, null, reducedMotion ? 0 : .98);
}

function settleReaderShelf({ instant = false } = {}) {
  if (!reader.isOpen || !readerEntering) return;
  if (state !== 'reading') {
    readerEntrance = gsap.delayedCall(.05, settleReaderShelf);
    return;
  }
  camera.updateMatrixWorld(true);
  if (instant) readerEntering = false;
  else readerEntrance = gsap.timeline({ onComplete: () => { readerEntering = false; } });
  let slot = 0;
  cartridges.forEach((cart, i) => {
    if (i === activeCartridge) return;
    scene.attach(cart);
    const home = readerCartridgeHome(i);
    const rotation = readerCartridgeRotation(i);
    const scale = readerCartridgeScale();
    cart.position.copy(home);
    if (!instant) cart.position.y += scale * 3.8;
    cart.rotation.set(rotation.x, rotation.y, rotation.z);
    cart.scale.setScalar(scale);
    cart.visible = instant;
    if (instant) return;
    const at = reducedMotion ? 0 : slot++ * .045;
    readerEntrance.set(cart, { visible: true }, at);
    readerEntrance.to(cart.position, { ...home, duration: reducedMotion ? 0 : .4, ease: 'power3.out' }, at);
  });
}

function swapReaderCartridge(index, { instant = false } = {}) {
  if (!cartridges.length || state === 'loading' || state === 'error') return;
  if (['reading', 'swapping'].includes(state) && activeCartridge === index) {
    if (state === 'reading' && reader.isOpen && !readerEntering) cartridges.forEach((cart, i) => {
      if (i === index || cart.visible) return;
      scene.attach(cart); cart.position.copy(readerCartridgeHome(i));
      cart.scale.setScalar(readerCartridgeScale()); cart.visible = true;
    });
    return;
  }
  const previous = cartridges.find(cart => cart.parent === rig && cart.visible);
  transition?.kill();
  gsap.killTweensOf([pose, camera.position, cameraTarget]);
  cartridges.forEach(cart => gsap.killTweensOf([cart.position, cart.rotation, cart.scale]));
  closeVideo();
  pointer = null;
  setState('swapping');
  cartHits.forEach(hit => hit.hidden = true);
  powerHit.hidden = true;
  $('.reader-tools').hidden = true;
  screenElement.inert = true;
  screenElement.style.opacity = '0';
  lcdScreen?.setActive(false);
  selectCartridge(index);
  showCartridgeContent();
  const incoming = cartridge;
  const seat = incoming.userData.seatedPosition;
  rig.updateMatrixWorld(true);
  cartridges.forEach((cart, i) => {
    if (cart.parent !== scene) scene.attach(cart);
    if (!cart.visible) {
      cart.position.copy(readerCartridgeHome(i));
      const rotation = readerCartridgeRotation(i);
      cart.rotation.set(rotation.x, rotation.y, rotation.z);
      cart.scale.setScalar(readerCartridgeScale());
    }
    cart.visible = !readerEntering || cart === incoming;
  });
  const finish = () => {
    rig.add(incoming);
    incoming.position.copy(seat);
    incoming.rotation.set(0, Math.PI, 0);
    incoming.scale.setScalar(CARTRIDGE_INSERT_SCALE);
    Object.assign(pose, { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });
    ledMaterial.color.set(0xff1428);
    rig.getObjectByName('power-glow').material.opacity = .5;
    setState('reading');
    screenElement.style.opacity = '1';
    screenElement.classList.add('is-reading');
    screenElement.inert = false;
    gsap.set('.boot', { opacity: 0 });
    showCartridgeContent();
    activateCartridgeContent();
    $('.reader-tools').hidden = reader.isOpen;
    if (!reader.isOpen) cartridges.forEach((cart, i) => { cart.visible = i === activeCartridge; });
    instruction.textContent = `${cartridgeNames[index]} loaded.`;
    resizeScene();
  };
  if (instant) { finish(); return; }
  pose.ry = THREE.MathUtils.euclideanModulo(pose.ry + Math.PI, Math.PI * 2) - Math.PI;
  transition = gsap.timeline({ onComplete: finish });
  transition.to(pose, { x: 0, y: 0, z: 0, rx: .08, ry: -.22, rz: -.025, duration: duration(.18), ease: 'power2.out' }, 0);
  transition.to(camera.position, { x: 0, y: 0, z: cameraDistance(), duration: duration(.25), ease: 'power2.out' }, 0);
  transition.to(cameraTarget, { x: 0, y: 0, z: 0, duration: duration(.25) }, 0);
  cartridges.forEach((cart, i) => {
    if (cart === incoming || readerEntering) return;
    const home = readerCartridgeHome(i);
    if (cart !== previous && cart.position.distanceTo(home) < .001) return;
    const rotation = readerCartridgeRotation(i);
    if (cart !== previous) {
      transition.to(cart.position, { ...home, duration: duration(.25), ease: 'power2.out' }, 0);
      transition.to(cart.rotation, { ...rotation, duration: duration(.25), ease: 'power2.out' }, 0);
      const scale = readerCartridgeScale();
      transition.to(cart.scale, { x: scale, y: scale, z: scale, duration: duration(.25) }, 0);
      return;
    }
    const motion = { progress: 0 };
    let path;
    const departure = cart === previous ? duration(.24) : 0;
    if (cart === previous) {
      sound('eject');
      transition.to(cart.position, { y: cart.position.y + 2.6, duration: departure, ease: 'power2.out' }, 0);
    }
    transition.call(() => {
      const start = cart.position.clone();
      const side = i % 2 ? -1 : 1;
      path = new THREE.CubicBezierCurve3(start,
        new THREE.Vector3(side * 1.8, start.y + .3, 1.1),
        new THREE.Vector3(side * 1.8, home.y + .8, 1.1), home);
    }, null, departure);
    transition.to(motion, { progress: 1, duration: duration(.55), ease: 'power2.inOut',
      onUpdate: () => cart.position.copy(path.getPoint(motion.progress)) }, departure);
    transition.to(cart.rotation, { ...rotation, duration: duration(.55), ease: 'power2.inOut' }, departure);
    transition.to(cart.scale, { x: readerCartridgeScale(), y: readerCartridgeScale(), z: readerCartridgeScale(), duration: duration(.55) }, departure);
  });
  const arrival = { progress: 0 };
  let arrivalPath, arrivalStart, arrivalEnd;
  const approachAt = duration(previous ? .35 : .12);
  transition.call(() => {
    rig.updateMatrixWorld(true);
    const aboveSlot = rig.localToWorld(seat.clone().add(new THREE.Vector3(0, 2.6, 0)));
    const start = incoming.position.clone();
    const side = start.x < 0 ? -1 : 1;
    arrivalPath = new THREE.CubicBezierCurve3(start,
      new THREE.Vector3(side * 1.8, start.y + 1.3, 1.3),
      new THREE.Vector3(side * 1.8, aboveSlot.y + .5, 1.0), aboveSlot);
    arrivalStart = incoming.quaternion.clone();
    arrivalEnd = rig.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)));
  }, null, approachAt);
  transition.to(arrival, { progress: 1, duration: duration(.55), ease: 'power2.inOut', onUpdate: () => {
    incoming.position.copy(arrivalPath.getPoint(arrival.progress));
    incoming.quaternion.slerpQuaternions(arrivalStart, arrivalEnd, arrival.progress);
  } }, approachAt);
  transition.to(incoming.scale, { x: CARTRIDGE_INSERT_SCALE, y: CARTRIDGE_INSERT_SCALE, z: CARTRIDGE_INSERT_SCALE, duration: duration(.55) }, approachAt);
  transition.call(() => rig.attach(incoming));
  transition.to(incoming.position, { x: seat.x, y: seat.y, z: seat.z, duration: duration(.24), ease: 'power2.in' });
  transition.call(() => sound('snap'));
  transition.to(pose, { y: -.055, duration: duration(.045) });
  transition.to(pose, { y: 0, rx: 0, ry: 0, rz: 0, duration: duration(.14), ease: 'power2.out' });
}

function loadCartridge(fromDrag=false) {
  if(state!=='ready'&&state!=='dragging')return;
  if (reader.isOpen) { swapReaderCartridge(activeCartridge); return; }
  setState('inserting');pointer=null;cartHits.forEach(hit=>hit.hidden=true);
  showCartridgeContent();
  cartridges.forEach((cart,index)=>{if(index!==activeCartridge)gsap.to(cart.position,{...cartEdge(index),duration:reducedMotion?0:.22,ease:'power2.in',onComplete:()=>cart.visible=false});});
  instruction.textContent=`Loading ${cartridgeNames[activeCartridge]} cartridge.`;
  gsap.killTweensOf([pose,cartridge.position,cartridge.rotation,cartridge.scale]);
  transition=gsap.timeline();
  const alignTime=duration(fromDrag?.34:.50);
  transition.to(camera.position,{z:Math.max(cameraDistance(),19.5),duration:alignTime,ease:'power3.out'},0);
  transition.to(pose,{x:0,y:0,z:receivingDepth,rx:0,ry:Math.PI,rz:0,duration:alignTime,ease:'power3.inOut'},0);
  transition.to(cartridge.rotation,{x:0,y:0,z:0,duration:alignTime,ease:'power3.inOut'},0);
  const seat = cartridge.userData.seatedPosition;
  transition.to(cartridge.position,{x:0,y:3.75,z:Math.max(cartridge.position.z,1.5),duration:alignTime,ease:'power3.out'},0);
  transition.to(cartridge.scale,{x:CARTRIDGE_INSERT_SCALE,y:CARTRIDGE_INSERT_SCALE,z:CARTRIDGE_INSERT_SCALE,duration:alignTime,ease:'power3.out'},0);
  // Clear the shell before moving from the foreground into the slot's depth.
  transition.to(cartridge.position,{z:receivingDepth-seat.z,duration:reducedMotion?0:.18,ease:'power2.inOut'});
  const docking={progress:0};
  let dockingStart;
  const dockingEnd=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI,0));
  // Enter the console's coordinate space before the pull so impact moves both objects together.
  transition.call(()=>{rig.attach(cartridge);dockingStart=cartridge.quaternion.clone();});
  transition.to(cartridge.position,{x:seat.x,y:seat.y+.42,z:seat.z,duration:duration(.20),ease:'power2.inOut'});
  transition.to(docking,{progress:1,duration:duration(.20),ease:'power2.out',onUpdate:()=>cartridge.quaternion.slerpQuaternions(dockingStart,dockingEnd,docking.progress)},'<');
  transition.to(cartridge.position,{y:seat.y,duration:duration(.105),ease:'power3.in'},`>+${reducedMotion?0:.035}`);
  transition.addLabel('contact');
  transition.call(()=>{
    sound('snap');
    cartridge.position.copy(seat);cartridge.rotation.set(0,Math.PI,0);
  });
  if(!reducedMotion){
    transition.to(pose,{y:-.075,rx:-.022,duration:.045,ease:'power2.out'},'contact');
    transition.to(cartridge.position,{y:seat.y-.025,duration:.045,ease:'power2.out'},'contact');
    transition.to(cartridge.position,{y:seat.y,duration:.13,ease:'power2.out'},'contact+=.045');
    transition.to(pose,{y:.014,rx:.006,duration:.075,ease:'sine.inOut'},'contact+=.045');
    transition.to(pose,{y:0,rx:0,duration:.15,ease:'power2.out'},'contact+=.12');
  }
  transition.to(pose,{z:0,rx:0,ry:Math.PI*2,rz:0,duration:duration(.65),ease:'power3.inOut'},`>+${reducedMotion?0:.10}`);
  transition.to(camera.position,{z:cameraDistance(),duration:duration(.65),ease:'power3.inOut'},'<');
  transition.call(()=>{
    setState('booting');screenElement.style.opacity='1';sound('boot');
    lcdScreen?.showBoot();
    gsap.fromTo('.boot-logo',{opacity:0,y:-12},{opacity:1,y:0,duration:duration(.45),ease:'steps(6)'});
    gsap.fromTo('.boot-progress',{scaleX:0},{scaleX:1,duration:duration(.6),ease:'steps(8)'});
  },null,'>');
  transition.call(()=>{
    const view=readingView();gsap.to(camera.position,{x:view.target.x,y:view.target.y,z:view.distance,duration:duration(1.1),ease:'power3.inOut'});gsap.to(cameraTarget,{x:view.target.x,y:view.target.y,z:view.target.z,duration:duration(1.1),ease:'power3.inOut'});
  },null,'>');
  transition.to('.boot',{opacity:0,duration:reducedMotion?0:.10},'>.65');
  transition.call(()=>{
    setState('reading');$('.reader-tools').hidden=false;screenElement.inert=false;
    instruction.textContent=`${cartridgeNames[activeCartridge]} loaded. ${activeCartridge===2?'Press play to watch.':'Scroll to explore.'}`;
    screenElement.classList.add('is-reading');
    const scroll=screenElement.querySelector('.lcd-scroll');scroll.scrollTop=0;
    showCartridgeContent();
    activateCartridgeContent();
    if (activeCartridge !== 2 && activeCartridge !== 4) scroll.focus({preventScroll:true});
  });
}

window.addEventListener('keydown',(e)=>{
  if(e.defaultPrevented || e.target.closest?.('#reader-pane') || (import.meta.env.DEV&&e.target.closest?.('.dialkit-root')))return;
  if(e.key==='Escape'&&state==='ready'){
    e.preventDefault();dismissCartridge(true);return;
  }
  if(state==='reading'){
    if(e.key==='Escape')eject();
  }
});
function exitReaderArticle() {
  if (!cartridges.length || state === 'loading' || state === 'error') return;
  readerDrag = null;
  if (state === 'swapping') {
    transition?.kill();
    gsap.killTweensOf([pose, camera.position, cameraTarget]);
    cartridges.forEach(cart => {
      gsap.killTweensOf([cart.position, cart.rotation, cart.scale]);
      if(cart !== cartridge && cart.parent === rig) scene.attach(cart);
    });
    rig.add(cartridge);
    cartridge.position.copy(cartridge.userData.seatedPosition);
    cartridge.rotation.set(0, Math.PI, 0);
    cartridge.scale.setScalar(CARTRIDGE_INSERT_SCALE);
    cartridge.visible = true;
    setState('reading');
  }
  if (state === 'reading') eject();
}

function eject() {
  if(state!=='reading')return;
  if (reader.isOpen) reader.close();
  routeHistory.write({ index: null });
  puppy.stop();
  closeVideo();
  transition?.kill();
  gsap.killTweensOf([camera.position,cameraTarget,pose,cartridge.position,cartridge.rotation,cartridge.scale]);
  setState('ejecting');screenElement.inert=true;$('.reader-tools').hidden=true;screenElement.style.opacity='0';
  lcdScreen?.setActive(false);screenElement.classList.remove('is-reading');
  gsap.set('.boot',{opacity:1});
  const home=readyPose();sound('eject');
  const finish=()=>{setState('ready');cartridges.forEach((cart,index)=>{cart.visible=true;cart.position.copy(cartHome(index));cart.scale.setScalar(FLOATING_CARTRIDGE_SCALE);cartHits[index].hidden=false;});instruction.textContent='Cartridge ejected. Choose a cartridge to keep exploring.';cartHit.focus({preventScroll:true});};
  // Insertion ends at 2π; use its equivalent front-facing angle for the short return.
  pose.ry=THREE.MathUtils.euclideanModulo(pose.ry+Math.PI,Math.PI*2)-Math.PI;
  if(reducedMotion){
    scene.attach(cartridge);cartridge.position.copy(cartHome());const rotation=cartRotation();cartridge.rotation.set(rotation.x,rotation.y,rotation.z);cartridge.scale.setScalar(FLOATING_CARTRIDGE_SCALE);
    camera.position.set(0,0,cameraDistance());cameraTarget.set(0,0,0);Object.assign(pose,home);finish();return;
  }
  scene.attach(cartridge);
  const startRotation=cartridge.quaternion.clone();
  const rotation=cartRotation();
  const endRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x,rotation.y,rotation.z));
  const destination=cartHome();
  const flight={progress:0};let arc;
  transition=gsap.timeline({onComplete:finish});
  transition.to(camera.position,{x:0,y:0,z:cameraDistance(),duration:.66,ease:'power3.out'},0);
  transition.to(cameraTarget,{x:0,y:0,z:0,duration:.66,ease:'power3.out'},0);
  // Separate along the slot before allowing any sideways motion or cartridge rotation.
  transition.to(pose,{x:0,y:-.65,z:-1,rx:0,ry:0,rz:0,duration:.24,ease:'power2.out'},0);
  transition.to(cartridge.position,{y:4.1,duration:.24,ease:'power2.out'},0);
  transition.call(()=>{
    arc=new THREE.CubicBezierCurve3(
      cartridge.position.clone(),
      new THREE.Vector3(destination.x*1.3,5,1.8),
      new THREE.Vector3(destination.x*1.15,destination.y+2.1,1.8),
      destination,
    );
  },null,.24);
  transition.to(flight,{progress:1,duration:.42,ease:'power2.inOut',onUpdate:()=>{
    cartridge.position.copy(arc.getPoint(flight.progress));
    cartridge.quaternion.slerpQuaternions(startRotation,endRotation,flight.progress);
  }},.24);
  transition.to(cartridge.scale,{x:FLOATING_CARTRIDGE_SCALE,y:FLOATING_CARTRIDGE_SCALE,z:FLOATING_CARTRIDGE_SCALE,duration:.42,ease:'power2.out'},.24);
  transition.to(pose,{...home,duration:.18,ease:'power2.out'},.66);
  cartridges.forEach((cart,index)=>{
    if(index===activeCartridge)return;
    cart.position.copy(cartEdge(index));cart.scale.setScalar(FLOATING_CARTRIDGE_SCALE);
    transition.call(()=>cart.visible=true,null,.40);
    transition.to(cart.position,{...cartHome(index),duration:.30,ease:'power3.out'},.40);
  });
}
$('#eject').addEventListener('click',eject);
function resizeScene(animateCamera = false){
  width=$('#stage').clientWidth;height=$('#stage').clientHeight;
  if(!renderer)return;
  renderer.setSize(width,height);if(screenObject)updateScreenSize();camera.aspect=width/height;
  if(reader.isOpen || readerFraming > .0001) camera.setViewOffset(width,height,width > 700 ? width*.28*readerFraming : 0,width <= 700 ? height*.36*readerFraming : 0,width,height);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  if(state==='reading'){
    const view=readingView();
    if(animateCamera === true && !reducedMotion) {
      gsap.to(camera.position,{x:view.target.x,y:view.target.y,z:view.distance,duration:.7,ease:'power3.inOut',overwrite:'auto'});
      gsap.to(cameraTarget,{x:view.target.x,y:view.target.y,z:view.target.z,duration:.7,ease:'power3.inOut',overwrite:'auto'});
    } else {
      gsap.killTweensOf([camera.position,cameraTarget]);
      camera.position.set(view.target.x,view.target.y,view.distance);cameraTarget.copy(view.target);
    }
  }else if(state==='idle'||state==='ready'){
    camera.position.set(0,0,cameraDistance());Object.assign(pose,state==='idle'?homePose():readyPose());if(state==='ready')cartridges.forEach((cart,index)=>cart.position.copy(cartHome(index)));
  }
}
window.addEventListener('resize',resizeScene);
const stageObserver=new ResizeObserver(resizeScene);
stageObserver.observe($('#stage'));

function applyRoute({ instant = false } = {}) {
  const route = readRoute(location);
  if (route.index === null) {
    if (reader.isOpen) reader.close();
    exitReaderArticle();
    return;
  }
  if (route.mode === 'reader') {
    if (reader.isOpen) swapReaderCartridge(route.index, { instant });
    else {
      reader.select(route.index);
      reader.open({ instant });
    }
  } else {
    if (reader.isOpen) reader.close();
    swapReaderCartridge(route.index, { instant });
  }
}
window.addEventListener('popstate', () => {
  if (state !== 'loading' && state !== 'error') applyRoute();
});

init().catch((error)=>{
  console.error('Could not load the Game Boy:',error);
  setState('error');$('#loading-label').textContent='The Game Boy couldn’t load. You can still read about me below.';
  $('.loading-pixel').style.display='none';$('#read-instead').hidden=false;
});

if(import.meta.hot){
  import.meta.hot.dispose(()=>{lcdScreen?.destroy();destroyLcdControls?.();deviceTilt.destroy();stageObserver.disconnect();window.removeEventListener('resize',resizeScene);});
}
