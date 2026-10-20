import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// A separate dog-only normal/depth image keeps the floor, grid and skeleton uninked.
export class DoodleOutlinePass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.normalTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType), samples: 4,
    });
    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.occlusionTarget = this.normalTarget.clone();
    this.occlusionTarget.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.occlusionMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
    this.origin = new THREE.Vector3();
    this.clearColor = new THREE.Color();
    this.uniforms = {
      tDiffuse: {value: null}, tNormals: {value: this.normalTarget.texture},
      tOcclusion: {value: this.occlusionTarget.texture},
      tOcclusionDepth: {value: this.occlusionTarget.depthTexture},
      tDepth: {value: this.normalTarget.depthTexture}, resolution: {value: new THREE.Vector2(1, 1)},
      anchor: {value: new THREE.Vector2()}, ink: {value: new THREE.Color()},
      weight: {value: 3}, roundness: {value: 1}, threshold: {value: .6},
      interior: {value: .25}, wobble: {value: .25}, gaps: {value: .12}, gapScale: {value: .5},
      pixelRatio: {value: 1}, depthRange: {value: camera.far - camera.near},
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse, tNormals, tDepth, tOcclusion, tOcclusionDepth;
        uniform vec2 resolution, anchor;
        uniform vec3 ink;
        uniform float weight, roundness, threshold, interior, wobble, gaps, gapScale, pixelRatio, depthRange;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        // Test the depth of the dog surface producing each stroke, at the final
        // output pixel. This also covers ink expanded beyond the silhouette.
        float visibleInk(float dogDepth){
          float coverage=texture2D(tOcclusion,vUv).a;
          float foregroundDepth=texture2D(tOcclusionDepth,vUv).x;
          return 1.-coverage*step(foregroundDepth+.00001,dogDepth);
        }
        void main(){
          vec4 base=texture2D(tDiffuse,vUv);
          vec2 paper=(vUv*resolution-anchor)/pixelRatio;
          // Spatial noise, with no clock: paused strokes never boil or flicker.
          float variation=noise(paper/18.);
          float radius=max(.25,weight*1.35*(1.+wobble*(variation-.5)*1.1))*pixelRatio;
          vec2 uv=vUv+(vec2(noise(paper/40.),noise(paper/40.+43.))-.5)*wobble*2.*pixelRatio/resolution;
          vec4 center=texture2D(tNormals,uv);
          float depth=texture2D(tDepth,uv).x;
          float outside=0.,detail=0.;
          for(int i=0;i<16;i++){
            float angle=float(i)*6.2831853/16.;
            vec2 dir=vec2(cos(angle),sin(angle));
            dir=mix(dir/max(abs(dir.x),abs(dir.y)),dir,roundness);
            vec2 offset=dir*radius/resolution;
            vec4 neighbor=texture2D(tNormals,uv+offset);
            outside=max(outside,(neighbor.a-center.a)*visibleInk(texture2D(tDepth,uv+offset).x));
            // Creases use a narrower pen so dense fur folds do not become solid ink.
            offset=dir*clamp(radius*.45,.5*pixelRatio,1.5*pixelRatio)/resolution;
            neighbor=texture2D(tNormals,uv+offset);
            float normalChange=1.-dot(normalize(center.xyz*2.-1.),normalize(neighbor.xyz*2.-1.));
            vec4 opposite=texture2D(tNormals,uv-offset);
            float depthChange=abs(texture2D(tDepth,uv-offset).x+texture2D(tDepth,uv+offset).x-2.*depth)*depthRange;
            depthChange*=step(.99,neighbor.a*opposite.a*center.a);
            float edge=max(smoothstep(.18+threshold*1.2,.27+threshold*1.2,normalChange),smoothstep(.055+threshold*.3,.085+threshold*.3,depthChange));
            detail=max(detail,edge*center.a*neighbor.a*visibleInk(depth));
          }
          float stroke=max(outside,detail*interior);
          float broken=noise(paper/mix(9.,48.,gapScale)+vec2(12.7,3.1));
          float keep=gaps<.001?1.:smoothstep(gaps*.82,gaps*.82+.09,broken);
          stroke*=keep;
          gl_FragColor=vec4(mix(base.rgb,ink,clamp(stroke,0.,1.)),base.a);
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  setSize(width, height) {
    this.normalTarget.setSize(width, height);
    this.occlusionTarget.setSize(width, height);
    this.uniforms.resolution.value.set(width, height);
  }
  setSettings(s) {
    for (const [uniform, key] of Object.entries({weight:'outlineWeight', roundness:'outlineRoundness', threshold:'outlineThreshold', interior:'outlineInterior', wobble:'outlineWobble', gaps:'outlineGaps', gapScale:'outlineGapScale'})) this.uniforms[uniform].value=s[key];
    this.uniforms.ink.value.set(s.outlineColor);
  }
  render(renderer, writeBuffer, readBuffer) {
    const {scene, camera} = this;
    const background=scene.background, override=scene.overrideMaterial, layers=camera.layers.mask;
    const alpha=renderer.getClearAlpha(), autoClear=renderer.autoClear, shadowAuto=renderer.shadowMap.autoUpdate;
    renderer.getClearColor(this.clearColor);
    try {
      camera.layers.set(2);scene.background=null;scene.overrideMaterial=this.normalMaterial;
      renderer.autoClear=true;renderer.shadowMap.autoUpdate=false;
      renderer.setClearColor(0,0);renderer.setRenderTarget(this.normalTarget);renderer.clear();renderer.render(scene,camera);
      // Layer 3 contains uninked objects that can cover the dog's ink (the ball).
      camera.layers.set(3);scene.overrideMaterial=this.occlusionMaterial;
      renderer.setRenderTarget(this.occlusionTarget);renderer.clear();renderer.render(scene,camera);
    } finally {
      camera.layers.mask=layers;scene.background=background;scene.overrideMaterial=override;
      renderer.setClearColor(this.clearColor,alpha);renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowAuto;
    }
    if(this.model){
      this.model.getWorldPosition(this.origin).project(camera);
      this.uniforms.anchor.value.set((this.origin.x*.5+.5)*this.normalTarget.width,(this.origin.y*.5+.5)*this.normalTarget.height);
    }
    this.uniforms.pixelRatio.value=this.normalTarget.width/(this.surfaceWidth || renderer.domElement.clientWidth);
    this.uniforms.tDiffuse.value=readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);
    this.quad.render(renderer);
  }
  dispose(){this.occlusionTarget.dispose();this.occlusionMaterial.dispose();this.normalTarget.dispose();this.normalMaterial.dispose();this.material.dispose();this.quad.dispose();}
}
