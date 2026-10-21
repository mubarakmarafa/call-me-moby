import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { preloadPuppyModel } from './preload.js';
import { createDogController } from './dog-controller.js';
import { FetchBehavior } from './fetch-behavior.js';
import { ViewportBall } from './viewport-ball.js';
import { createPlayMilestone } from './play-milestone.js';
import { createPuppyAppearance } from './appearance.js';

export async function createPuppyGame(surface, { onPlayMilestone = () => {}, onChipOffset = () => {} } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8e4cf');
  const camera = new THREE.OrthographicCamera(-2.4,2.4,2.1,-2.1,.1,50);
  camera.position.set(5,3.8,6.8);camera.lookAt(0,.6,0);camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xfff7e6,0xa5ae98,1.5));
  const key=new THREE.DirectionalLight(0xfff3db,2.0);key.position.set(-3,7,5);scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, .6);fill.position.set(4,3,-3);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({color:'#e8e4cf'}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
  const grid=new THREE.GridHelper(20,40,0xaaa990,0xaaa990);grid.material.transparent=true;grid.material.opacity=.18;grid.position.y=-.015;scene.add(grid);
  const bytes = await preloadPuppyModel();
  const gltf = await new GLTFLoader().parseAsync(bytes.slice(0), '/models/puppy/');
  const dog=createDogController(gltf.scene,{targetBounds:null});scene.add(gltf.scene);
  const appearance = createPuppyAppearance(scene, camera, gltf.scene);
  dog.setSpeed(1.5);dog.setMotionBlend(.7);dog.mesh.frustumCulled=false;
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,32),new THREE.MeshBasicMaterial({color:0x615d49,transparent:true,opacity:.13,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.scale.y=1.5;scene.add(shadow);
  const ball=new ViewportBall(camera);scene.add(ball.mesh,ball.shadow);ball.active=true;
  const fetch=new FetchBehavior(dog,ball);
  const chipCanvas=document.createElement('canvas');
  chipCanvas.width=400;chipCanvas.height=128;
  const chipContext=chipCanvas.getContext('2d');
  const chipTexture=new THREE.CanvasTexture(chipCanvas);
  chipTexture.colorSpace=THREE.SRGBColorSpace;
  const chipMaterial=new THREE.MeshBasicMaterial({map:chipTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const chipMesh=new THREE.Mesh(new THREE.PlaneGeometry(200,64),chipMaterial);
  const overlay=new THREE.Scene();overlay.add(chipMesh);
  const overlayCamera=new THREE.OrthographicCamera(-308,308,270.5,-270.5,.1,10);
  overlayCamera.position.z=1;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let showChip=false,chipElapsed=0;
  function drawChip(focused=false){
    chipContext.clearRect(0,0,400,128);
    chipContext.fillStyle=(document.documentElement.dataset.theme === 'dark')?'#454646':'#e9e4cd';chipContext.beginPath();chipContext.roundRect(0,0,400,128,64);chipContext.fill();
    if(focused){chipContext.strokeStyle=(document.documentElement.dataset.theme === 'dark')?'#e6bd85':'#111310';chipContext.lineWidth=4;chipContext.beginPath();chipContext.roundRect(8,8,384,112,56);chipContext.stroke();}
    chipContext.fillStyle=(document.documentElement.dataset.theme === 'dark')?'#e9e6df':'#050605';chipContext.font='700 44px "Geist Mono", monospace';
    chipContext.textAlign='center';chipContext.textBaseline='middle';chipContext.fillText('try now ↗',200,64);
    chipTexture.needsUpdate=true;
  }
  function syncAppearance() {
    const dark = (document.documentElement.dataset.theme === 'dark');
    scene.background.set(dark ? '#303131' : '#e8e4cf');
    floor.material.color.copy(scene.background);
    grid.material.color.set(dark ? '#a6a69e' : '#aaa990');
    drawChip(surface.querySelector('.puppy-try-chip') === document.activeElement);
  }
  syncAppearance();
  const recordPlay=createPlayMilestone(()=>{showChip=true;chipElapsed=0;onPlayMilestone();onChipOffset(reducedMotion.matches?0:96);});
  const target=new THREE.WebGLRenderTarget(616,541);
  const ray=new THREE.Raycaster(),point=new THREE.Vector2();
  const listeners=new AbortController();
  window.addEventListener('appearancechange', syncAppearance, { signal: listeners.signal });
  let groundTap=null;
  let drag=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  dog.setPaused(paused);
  const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const groundPoint=new THREE.Vector3();
  const setRay=e=>{point.set(e.offsetX/surface.clientWidth*2-1,1-e.offsetY/surface.clientHeight*2);ray.setFromCamera(point,camera);};
  const end=(e,cancel=false)=>{
    if(drag===null || e && e.pointerId!==drag)return;
    ball.release(performance.now(),cancel);recordPlay(ball.throwSerial);const id=drag;drag=null;
    if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
  };
  const listen=(type,handler)=>surface.addEventListener(type,handler,{signal:listeners.signal});
  listen('pointerdown',e=>{
    e.stopPropagation();if(e.button!==0||drag!==null)return;
    setRay(e);
    // Enlarge only the picking sphere; keep the visible ball and physics unchanged.
    const picked=ray.ray.intersectsSphere(new THREE.Sphere(ball.position,.32));
    groundTap=null;
    if(!picked){groundTap={id:e.pointerId,x:e.clientX,y:e.clientY};surface.setPointerCapture(e.pointerId);}
    if(picked&&ball.beginDrag(ray.ray,performance.now())){
      e.preventDefault();paused=false;dog.setPaused(false);drag=e.pointerId;surface.setPointerCapture(drag);surface.focus({preventScroll:true});
    }
  });
  listen('pointermove',e=>{if(groundTap&&Math.hypot(e.clientX-groundTap.x,e.clientY-groundTap.y)>8)groundTap=null;setRay(e);if(e.pointerId===drag){e.preventDefault();ball.drag(ray.ray,performance.now());}surface.style.cursor=ray.ray.intersectsSphere(new THREE.Sphere(ball.position,.32))?'grab':'default';});
  listen('pointerup',e=>{
    if(groundTap?.id===e.pointerId){
      setRay(e);
      if(ray.ray.intersectPlane(ground,groundPoint)){
        paused=false;dog.setPaused(false);ball.throwToward(groundPoint);recordPlay(ball.throwSerial);surface.focus({preventScroll:true});
      }
      groundTap=null;if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);
    }
    end(e);
  });
  listen('pointercancel',e=>{groundTap=null;end(e,true);});
  listen('lostpointercapture',e=>{groundTap=null;end(e,true);});
  listen('click',e=>e.stopPropagation());
  listen('keydown',e=>{
    if(e.code==='Space'){e.preventDefault();paused=!paused;dog.setPaused(paused);}
    if(e.key==='Enter'&&!e.repeat){e.preventDefault();paused=false;dog.setPaused(false);ball.nudge(1.5,3);recordPlay(ball.throwSerial);}
  });
  window.addEventListener('blur',()=>{groundTap=null;end(null,true);},{signal:listeners.signal});
  return {
    texture:target.texture,
    setChipFocused:drawChip,
    render(renderer,dt,direct=false){
      const aspect=surface.clientWidth/Math.max(1,surface.clientHeight);
      camera.left=-2.1*aspect;camera.right=2.1*aspect;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      if(!paused){ball.update(dt);fetch.beforeUpdate(dt);dog.update(dt);fetch.afterUpdate();}
      shadow.position.set(gltf.scene.position.x,-.012,gltf.scene.position.z);
      appearance.render(renderer, direct ? null : target, surface.clientWidth);
      if(showChip){
        const w=surface.clientWidth,h=surface.clientHeight;
        overlayCamera.left=-w/2;overlayCamera.right=w/2;overlayCamera.top=h/2;overlayCamera.bottom=-h/2;overlayCamera.updateProjectionMatrix();
        chipElapsed+=dt;
        const progress=reducedMotion.matches?1:Math.min(1,chipElapsed/.38);
        const offset=96*Math.pow(1-progress,3);
        chipMesh.position.set(0,-h/2+22+32-offset,0);
        onChipOffset(offset);
        const autoClear=renderer.autoClear;renderer.autoClear=false;
        renderer.render(overlay,overlayCamera);renderer.autoClear=autoClear;
      }
    },
    dispose(){end(null,true);appearance.dispose();listeners.abort();chipMesh.geometry.dispose();chipMaterial.dispose();chipTexture.dispose();target.dispose();dog.mesh.skeleton.dispose();const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}});resources.forEach(r=>r.dispose());}
  };
}
