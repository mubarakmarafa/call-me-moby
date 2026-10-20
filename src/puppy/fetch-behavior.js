import * as THREE from 'three';
const {damp,smoothstep,clamp}=THREE.MathUtils;
const angleBetween=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const carryingStates=new Set(['lifting','returning','presenting','dropping']);

export class FetchBehavior {
  constructor(controller,ball){
    this.dog=controller;this.ball=ball;this.socket=new THREE.Vector3();
    this.standPoint=new THREE.Vector3();this.returnPoint=new THREE.Vector3();this.lookTarget=new THREE.Vector3();this.reset();
  }
  reset(){
    this.throwAge=0;this.throwPower=0;this.pursuit=0;this.state='chase';this.time=0;this.bowTime=this.bow=0;this.rear=this.dip=0;this.cooldown=.4;this.wasGrabbed=false;this.thrownChase=false;this.lastThrow=this.ball.throwSerial||0;
    this.ball.carried=false;this.ball.deliveryPoint(this.returnPoint);this.dog.setInteraction(null);
  }
  updateBow(dt,ready){
    this.bowTime=ready?this.bowTime+dt:0;
    const t=this.bowTime%4.7;
    const amount=ready?smoothstep(t,0,.65)*(1-smoothstep(t,2.1,2.85)):0;
    this.bow=damp(this.bow,amount,ready?8:12,dt);
  }
  beforeUpdate(dt,enabled=true){
    const dog=this.dog,ball=this.ball,s=dog.getState();
    if(s.paused)return;
    if(!enabled||!ball.active||s.mode!=='follow'){
      if(ball.carried){ball.carried=false;ball.velocity.set(0,0,0);}
      this.thrownChase=false;this.pursuit=this.throwPower=0;this.lastThrow=ball.throwSerial||0;this.state='chase';this.dip=damp(this.dip,0,8,dt);this.rear=damp(this.rear,0,8,dt);
      this.updateBow(dt,enabled&&!ball.active&&s.mode==='follow'&&s.velocity<.08);
      dog.setInteraction({bow:this.bow,dip:this.dip,rear:this.rear,lookTarget:ball.active?ball.position:null,attention:ball.grabbed?1:0,excitement:ball.grabbed?1:this.bow});return;
    }
    if((ball.throwSerial||0)!==this.lastThrow){this.lastThrow=ball.throwSerial||0;this.thrownChase=true;this.throwAge=0;this.throwPower=smoothstep(ball.releaseSpeed||0,2.4,6);}
    if(ball.grabbed){this.thrownChase=false;this.throwPower=this.pursuit=0;}
    this.throwAge+=dt;
    if(ball.grabbed&&!this.wasGrabbed){ball.deliveryPoint(this.returnPoint);this.state='chase';this.time=0;this.cooldown=.7;}
    this.wasGrabbed=ball.grabbed;
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(carryingStates.has(this.state)&&!ball.carried){this.state='chase';this.time=0;this.cooldown=.7;}
    if(this.state==='waiting'&&(ball.grabbed||this.thrownChase)){this.state='chase';this.cooldown=.7;}
    const distance=Math.hypot(ball.position.x-s.position[0],ball.position.z-s.position[2]);
    const flightSpeed=Math.hypot(ball.velocity.x,ball.velocity.z);
    const response=this.thrownChase?Math.max(this.throwPower*Math.exp(-this.throwAge/1.6),smoothstep(flightSpeed,2.4,6))*smoothstep(distance,1.1,2.6):0;
    this.pursuit=damp(this.pursuit,response,response>this.pursuit?16:5,dt);
    const angle=Math.abs(angleBetween(Math.atan2(ball.position.x-s.position[0],ball.position.z-s.position[2]),s.heading));
    const grounded=!['crouch','rear-pivot','leap','land'].includes(s.action);
    const reach=ball.grabbed&&ball.position.y>1.55&&distance<1.45&&angle<.65&&grounded;
    this.rear=damp(this.rear,reach?clamp((ball.position.y-1.4)/.55,0,1):0,reach?5:8,dt);
    if(this.state==='lowering'&&(ball.grabbed||distance>1.5||ball.position.y>.45||ball.velocity.length()>1)){
      this.state='chase';this.time=0;this.cooldown=.5;
    }
    if(this.state==='chase'&&!ball.grabbed&&this.cooldown===0&&grounded&&this.rear<.05&&distance<1.12&&distance>.5&&angle<.25&&s.velocity<.12&&ball.position.y<.3&&ball.velocity.length()<.4){this.state='lowering';this.time=0;}
    const towardUser=this.lookTarget.copy(ball.camera.position).sub(this.returnPoint).setY(0).normalize();
    this.standPoint.copy(this.returnPoint).addScaledVector(towardUser,-.98);
    const userHeading=Math.atan2(ball.camera.position.x-s.position[0],ball.camera.position.z-s.position[2]);
    const facingUser=Math.abs(angleBetween(userHeading,s.heading))<.10;
    if(this.state==='returning'&&Math.hypot(this.standPoint.x-s.position[0],this.standPoint.z-s.position[2])<.12&&s.velocity<.12&&grounded){this.state='presenting';this.time=0;}
    if(this.state==='presenting'&&facingUser&&Math.abs(s.turnRate)<.15&&grounded){this.state='dropping';this.time=0;}
    if(this.state==='lowering'||this.state==='dropping'){
      this.time+=dt;this.dip=smoothstep(this.time,0,.75);
    }else if(this.state==='lifting'){
      this.time+=dt;this.dip=1-smoothstep(this.time,0,.8);
      if(this.time>=.8)this.state='returning';
    }else this.dip=damp(this.dip,0,8,dt);
    if(this.state!=='chase'){this.thrownChase=false;this.pursuit=0;}
    const returning=this.state==='returning';
    const carrying=carryingStates.has(this.state),waiting=this.state==='waiting';
    const moving=this.state==='chase'||this.state==='returning';
    const settledBall=!ball.grabbed&&ball.position.y<.3&&ball.velocity.length()<.4;
    const navigation=this.state==='returning'?this.standPoint:this.state==='dropping'?this.returnPoint:settledBall?ball.position:ball.followTarget(this.thrownChase?.08+this.pursuit*.18:0);
    if(moving||this.state==='dropping')dog.setTarget(navigation.x,navigation.z);
    this.lookTarget.copy(waiting||this.state==='presenting'?ball.camera.position:ball.position);
    if(this.state==='returning')this.lookTarget.copy(this.returnPoint).setY(1.2);
    const dropTarget=this.returnPoint.clone().setY(ball.radius);
    this.updateBow(dt,grounded&&this.rear<.05&&s.velocity<.08&&Math.abs(s.turnRate)<.15&&((waiting&&facingUser)||(ball.grabbed&&distance<1.6&&ball.position.y<1.55)));
    const turnToUser=this.state==='presenting'||waiting;
    dog.setInteraction({enabled:true,bow:this.bow,facingYaw:turnToUser?userHeading:undefined,turnInPlace:turnToUser,stopDistance:returning?.05:.98,dip:this.dip,rear:this.rear,locked:!moving||this.rear>.1,
      noHop:carrying&&!returning||waiting,fetchGallop:returning?.9:this.thrownChase?smoothstep(ball.releaseSpeed||0,1.2,3):0,pursuit:this.pursuit,throwId:this.lastThrow,playfulReturn:returning,attention:ball.grabbed?1:waiting?.7:0,excitement:ball.grabbed?1:waiting?1:returning?.9:carrying?.3:this.thrownChase?.8:0,
      lookTarget:this.lookTarget,mouth:this.state==='lowering'||this.state==='dropping'?1:carrying?.58:reach?.9:null,
      target:this.state==='lowering'?ball.position:this.state==='lifting'?this.pickupPoint:this.state==='dropping'?dropTarget:null,
      lookHeight:this.lookTarget.y,carrying});
  }
  afterUpdate(){
    if(this.dog.getState().paused)return;
    this.dog.getMouthPosition(this.socket);
    if(this.state==='lowering'&&this.time>=.78){
      if(this.socket.distanceTo(this.ball.position)<.19){
        this.pickupPoint=this.ball.position.clone();this.gripOffset=this.ball.position.clone().sub(this.socket);
        this.ball.carried=true;this.ball.velocity.set(0,0,0);this.state='lifting';this.time=0;
      }else if(this.time>1.5){this.state='chase';this.cooldown=1;}
    }
    if(this.ball.carried){
      this.ball.position.copy(this.socket);
      if(this.state==='lifting')this.ball.position.addScaledVector(this.gripOffset,1-smoothstep(this.time,0,.12));
      this.ball.updateShadow();
    }
    if(this.state==='dropping'&&this.time>=.8&&(this.socket.y<.4||this.time>1.3)){
      this.ball.carried=false;this.ball.velocity.set(0,0,0);this.state='waiting';this.time=0;
    }
  }
  getState(){return {action:this.rear>.2?'reaching':this.state,dip:this.dip,bow:this.bow,rear:this.rear,carried:!!this.ball.carried,thrownChase:this.thrownChase,pursuit:this.pursuit,throwPower:this.throwPower,returnPoint:this.returnPoint.toArray()};}
}
