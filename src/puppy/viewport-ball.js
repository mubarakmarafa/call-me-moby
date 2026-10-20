import * as THREE from 'three';

// World-space physics; the four side planes come from the current camera viewport.
export class ViewportBall {
  constructor(camera) {
    this.camera=camera;
    this.radius=.15;
    this.mesh=new THREE.Mesh(new THREE.SphereGeometry(this.radius,32,24),new THREE.MeshStandardMaterial({color:'#ffc107',roughness:.48,metalness:.02}));
    this.mesh.name='Fetch ball';this.mesh.castShadow=true;
    const seamMaterial=new THREE.MeshStandardMaterial({color:'#db9e00',roughness:.65});
    for(const rotation of [0,Math.PI/2]){
      const seam=new THREE.Mesh(new THREE.TorusGeometry(this.radius*.994,.0035,6,64),seamMaterial);
      seam.rotation.x=rotation;this.mesh.add(seam);
    }
    this.mesh.traverse(object=>object.layers.enable(3));
    this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.19,32),new THREE.MeshBasicMaterial({color:'#242422',transparent:true,opacity:.15,depthWrite:false}));
    this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=-.011;
    this.position=this.mesh.position;this.velocity=new THREE.Vector3();
    this.grabbed=false;this.bounces=0;this.active=false;
    this.frustum=new THREE.Frustum();this.matrix=new THREE.Matrix4();
    this.dragPlane=new THREE.Plane();this.dragOffset=new THREE.Vector3();
    this.hit=new THREE.Vector3();this.axis=new THREE.Vector3();this.up=new THREE.Vector3(0,1,0);
    this.samples=[];this.projected=new THREE.Vector3();this.target=new THREE.Vector3();
    this.ray=new THREE.Raycaster();this.screen=new THREE.Vector2();
    this.reset();
  }
  syncBounds(){
    this.camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
  }
  constrain(reflect=true){
    // Repeat at floor/wall corners: a tilted viewport wall can push toward the floor.
    for(let iteration=0;iteration<6;iteration++){
      for(const plane of this.frustum.planes){
        const penetration=this.radius+.015-plane.distanceToPoint(this.position);
        if(penetration>0){
          if(this.position.y+plane.normal.y*penetration<this.radius){
            this.position.y=this.radius;
            const horizontal=plane.normal.x**2+plane.normal.z**2;
            if(horizontal>1e-8){
              const slide=(this.radius+.015-plane.distanceToPoint(this.position))/horizontal;
              this.position.x+=plane.normal.x*slide;this.position.z+=plane.normal.z*slide;
            }
          }else this.position.addScaledVector(plane.normal,penetration);
          const approach=this.velocity.dot(plane.normal);
          if(reflect&&approach<0){this.velocity.addScaledVector(plane.normal,-1.78*approach);this.bounces++;}
        }
      }
      if(this.position.y<this.radius){
        this.position.y=this.radius;
        if(reflect&&this.velocity.y<0){
          if(this.velocity.y<-.45){this.velocity.y*=-.56;this.bounces++;}
          else this.velocity.y=0;
        }
      }
    }
  }
  reset(origin=new THREE.Vector3()){
    this.releaseSpeed=0;this.carried=false;this.grabbed=false;this.active=false;this.samples=[];this.velocity.set(0,0,0);this.bounces=0;
    this.position.copy(origin).add(new THREE.Vector3(.9,this.radius,.6));
    this.syncBounds();this.constrain(false);this.updateShadow();
  }
  pick(ray){return ray.intersectsSphere(new THREE.Sphere(this.position,this.radius*1.65));}
  beginDrag(ray,time){
    this.camera.getWorldDirection(this.axis);
    this.dragPlane.setFromNormalAndCoplanarPoint(this.axis,this.position);
    if(!ray.intersectPlane(this.dragPlane,this.hit))return false;
    this.dragOffset.copy(this.position).sub(this.hit);
    this.carried=false;this.grabbed=true;this.active=true;this.velocity.set(0,0,0);this.samples=[{time,position:this.position.clone()}];
    return true;
  }
  drag(ray,time){
    if(!this.grabbed||!ray.intersectPlane(this.dragPlane,this.hit))return;
    this.position.copy(this.hit).add(this.dragOffset);this.syncBounds();this.constrain(false);
    this.samples.push({time,position:this.position.clone()});
    this.samples=this.samples.filter(s=>time-s.time<=120).slice(-12);this.updateShadow();
  }
  release(time,cancel=false){
    if(!this.grabbed)return;
    this.grabbed=false;this.velocity.set(0,0,0);
    const recent=this.samples.filter(s=>time-s.time<=120);
    if(!cancel&&recent.length>=2){
      const first=recent[0],last=recent.at(-1),dt=(time-first.time)/1000;
      if(dt>.008)this.velocity.copy(last.position).sub(first.position).divideScalar(dt).clampLength(0,9);
    }
    this.releaseSpeed=cancel?0:this.velocity.length();
    if(this.releaseSpeed>.8)this.throwSerial=(this.throwSerial||0)+1;
    this.samples=[];
  }
  nudge(dx,dy){
    this.carried=false;this.syncBounds();this.active=true;
    this.camera.updateMatrixWorld();
    this.axis.setFromMatrixColumn(this.camera.matrixWorld,0);this.velocity.addScaledVector(this.axis,dx);
    this.axis.setFromMatrixColumn(this.camera.matrixWorld,1);this.velocity.addScaledVector(this.axis,dy);
    this.velocity.clampLength(0,9);
    this.releaseSpeed=this.velocity.length();
    this.throwSerial=(this.throwSerial||0)+1;
  }
  throwToward(destination){
    this.carried=false;this.grabbed=false;this.active=true;this.samples=[];
    const direction=new THREE.Vector3().subVectors(destination,this.position).setY(0);
    const distance=direction.length();
    if(distance<.001)direction.set(0,0,-1);else direction.divideScalar(distance);
    const strength=THREE.MathUtils.clamp(2.2+distance*.75,2.2,5.5);
    this.velocity.copy(direction).multiplyScalar(strength);
    this.velocity.y=2.3;
    this.releaseSpeed=this.velocity.length();
    this.throwSerial=(this.throwSerial||0)+1;
  }
  update(dt){
    if(this.carried){this.updateShadow();return;}
    this.syncBounds();
    if(!this.grabbed){
      const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
      for(let i=0;i<steps;i++){
        this.velocity.y-=6*h;
        const drag=this.position.y<=this.radius+.002?.85:.12;
        this.velocity.x*=Math.exp(-drag*h);this.velocity.z*=Math.exp(-drag*h);
        this.position.addScaledVector(this.velocity,h);this.constrain();
        if(this.position.y<=this.radius+.002&&this.velocity.length()<.035)this.velocity.set(0,0,0);
      }
      this.axis.set(this.velocity.z,0,-this.velocity.x);
      if(this.axis.lengthSq()>.0001)this.mesh.rotateOnWorldAxis(this.axis.normalize(),Math.hypot(this.velocity.x,this.velocity.z)*dt/this.radius);
    }else this.constrain(false);
    this.updateShadow();
  }
  updateShadow(){
    this.shadow.position.x=this.position.x;this.shadow.position.z=this.position.z;
    const height=this.position.y-this.radius;
    this.shadow.material.opacity=.16/(1+height*1.6);this.shadow.scale.setScalar(1+height*.18);
  }
  deliveryPoint(out=new THREE.Vector3()){
    this.syncBounds();
    this.ray.setFromCamera(new THREE.Vector2(0,-.32),this.camera);
    const ground=new THREE.Plane(this.up,0);
    if(!this.ray.ray.intersectPlane(ground,out))out.copy(this.position).setY(0);
    return out;
  }
  followTarget(lookAhead=0){
    // Reserve room above the paws for the puppy's body when the ball reaches an edge.
    this.target.copy(this.position).addScaledVector(this.velocity,lookAhead).setY(0).project(this.camera);
    this.screen.set(THREE.MathUtils.clamp(this.target.x,-.77,.77),THREE.MathUtils.clamp(this.target.y,-.68,.12));
    this.ray.setFromCamera(this.screen,this.camera);
    this.ray.ray.intersectPlane(new THREE.Plane(this.up,0),this.target);
    return this.target;
  }
  getState(){
    this.projected.copy(this.position).project(this.camera);
    return {releaseSpeed:this.releaseSpeed,throwSerial:this.throwSerial||0,position:this.position.toArray(),velocity:this.velocity.toArray(),screen:this.projected.toArray(),carried:!!this.carried,grabbed:this.grabbed,active:this.active,bounces:this.bounces};
  }
}
