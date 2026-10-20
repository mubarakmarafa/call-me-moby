import * as THREE from 'three';

const {clamp, damp, lerp, smoothstep} = THREE.MathUtils;
const TAU = Math.PI * 2;
const deltaAngle = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
const ease = t => t*t*(3-2*t);
function spring(s,target,frequency,damping,dt) {
  const steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps;
  for(let i=0;i<steps;i++){s.v+=(frequency*frequency*(target-s.x)-2*damping*frequency*s.v)*h;s.x+=s.v*h;}
  return s.x;
}
const stateSpring = () => ({x:0,v:0});

export function createDogController(model, {targetBounds={x:2.8,z:2.1}}={}) {
  const bones={};let mesh;
  model.traverse(n=>{if(n.isBone)bones[n.name]=n;if(n.isSkinnedMesh&&!mesh)mesh=n;});
  if(!mesh||!bones.spine_front||!bones.spine_rear||!bones.neck_base)throw new Error('This controller needs the version 3 dog rig.');
  const rest=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,b.position.clone()]));
  const restScale=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,b.scale.clone()]));
  const target=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),jawAxis=new THREE.Vector3(.934,0,-.356);
  const temp=new THREE.Vector3(),q=new THREE.Quaternion(),yawQ=new THREE.Quaternion();
  let interaction={},attentionYaw=0,attentionPitch=0,excitement=0,tailClock=0;
  const mouthSocket=new THREE.Vector3(.12,.015,.39),mouthWorld=new THREE.Vector3();
  function getMouthPosition(out=new THREE.Vector3()){bones.head.updateWorldMatrix(true,false);return out.copy(mouthSocket).applyMatrix4(bones.head.matrixWorld);}
  let motionBlend=.7;
  const poseHistory={};
  function blendBone(name,dt){
    const bone=bones[name];
    const previous=poseHistory[name];
    if(previous&&dt>0){
      const alpha=motionBlend===0?1:1-Math.exp(-dt/(motionBlend*.06));
      bone.position.lerpVectors(previous.position,bone.position,alpha);
      previous.quaternion.slerp(bone.quaternion,alpha);
      bone.quaternion.copy(previous.quaternion);
    }
    if(previous){previous.position.copy(bone.position);previous.quaternion.copy(bone.quaternion);}
    else poseHistory[name]={position:bone.position.clone(),quaternion:bone.quaternion.clone()};
  }
  let mode='follow',speed=1,wag=.7,bounce=.7,flop=.75,headTracking=true,autoFace=true,paused=false;
  let elapsed=0,phase=0,velocity=0,turnRate=0,motion=0,trot=0,headYaw=0,previousHeadYaw=0,idleTime=0;
  let mouth=.35,tongue=.35,blinkValue=0,blinkStart=-10,nextBlink=2.8,shakeStart=-10,manual={};
  let blinkOverride=null;
  let mouthValue=.35,tongueValue=.35,gazeX=0,gazeY=0,lastAcceleration=0;
  const heave=stateSpring(),pitch=stateSpring(),roll=stateSpring(),weightShift=stateSpring();
  const frontTurn=stateSpring(),rearTurn=stateSpring(),tailTurn=stateSpring();
  let turnFlow=1,pivotWeight=0;
  const turnPivots={};
  const frontChain=[['chest',.3],['spine_front',.45],['spine',.25]];
  const rearChain=[['pelvis',.3],['spine_rear',.7]];
  const earSprings=Object.fromEntries(['left','right'].map(side=>[side,{pitch:stateSpring(),roll:stateSpring(),tip:stateSpring()}]));
  let maxFloorError=0;
  let hopTurns=true,hop=null,hopHeight=0,hopCompression=0,hopTuck=0,hopTilt=0,hopPitch=0;
  let nextHop=0,burstUntil=0,gallop=0,hopCount=0,skipCount=0,pursuit=0,lastSprintThrow=-1,sprintCount=0;
  function replantFeet(){
    for(const leg of legs){homeWorld(leg,leg.anchor);leg.start.copy(leg.anchor);leg.end.copy(leg.anchor);leg.goal.copy(leg.anchor);leg.swing=false;leg.lift=0;leg.yaw=leg.landYaw=model.rotation.y;leg.wasSwingPhase=false;}
  }
  const legNames=['hind_left','front_left','hind_right','front_right'];
  const legs=legNames.map((name,index)=>({name,index,upper:bones[`${name}_upper`],lower:bones[`${name}_lower`],paw:bones[`${name}_paw`],home:new THREE.Vector3(),anchor:new THREE.Vector3(),start:new THREE.Vector3(),end:new THREE.Vector3(),goal:new THREE.Vector3(),swing:false,t:0,duration:.25,lift:0,yaw:0,landYaw:0,sole:[],wasSwingPhase:false}));
  const position=mesh.geometry.attributes.position,weights=mesh.geometry.attributes.skinWeight,joints=mesh.geometry.attributes.skinIndex;
  for(let i=0;i<position.count;i++)if(position.getY(i)<.13){
    let best=-1,largest=0;
    for(let li=0;li<legs.length;li++){let total=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[joints.array[i*4+k]].name.startsWith(legs[li].name))total+=weights.array[i*4+k];if(total>largest){largest=total;best=li;}}
    if(best>=0&&largest>.45)legs[best].sole.push(i);
  }
  function poseReset(){for(const [name,b]of Object.entries(bones)){b.quaternion.identity();b.position.copy(rest[name]);b.scale.copy(restScale[name]);}}
  function initializeFeet(){
    poseReset();model.updateMatrixWorld(true);
    for(const name of ['spine','spine_front','chest','spine_rear','pelvis']){
      turnPivots[name]=model.worldToLocal(bones[name].getWorldPosition(new THREE.Vector3()));
    }
    for(const leg of legs){leg.paw.getWorldPosition(leg.anchor);leg.home.copy(leg.anchor);model.worldToLocal(leg.home);
      // Bring the ankle beneath the hip while retaining the knee/hock bend.
      if(leg.name.startsWith('hind'))leg.home.z+=.18;
      homeWorld(leg,leg.anchor);leg.start.copy(leg.anchor);leg.end.copy(leg.anchor);leg.goal.copy(leg.anchor);leg.swing=false;leg.t=0;leg.yaw=model.rotation.y;leg.landYaw=leg.yaw;leg.wasSwingPhase=false;}
  }
  function setMode(value){if(!['follow','stay','walk'].includes(value))throw new Error('Mode must be follow, stay, or walk.');mode=value;burstUntil=0;if(hop){hop.freezeTranslation=true;hop.travel=0;}target.copy(model.position).setY(0);manual={};}
  function setTarget(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))throw new Error('Target coordinates must be finite.');target.set(targetBounds?clamp(x,-targetBounds.x,targetBounds.x):x,0,targetBounds?clamp(z,-targetBounds.z,targetBounds.z):z);}
  function homeWorld(leg,out,future=0){
    out.copy(leg.home);out.z+=future;
    const front=leg.name.startsWith('front');
    // Follow the curved torso in the ground plane without moving planted anchors.
    const chain=front?frontChain:rearChain;
    for(const [name,share] of chain)if(turnPivots[name]){
      out.sub(turnPivots[name]).applyAxisAngle(up,(front?frontTurn.x:rearTurn.x)*share).add(turnPivots[name]);
    }
    out.applyAxisAngle(up,model.rotation.y);out.add(model.position);out.y=leg.home.y;return out;
  }
  function launchStep(leg,duration,recover=false,pivot=false){
    leg.swing=true;leg.t=0;leg.duration=duration;leg.start.copy(leg.anchor);
    const translation=mode==='walk'?1:clamp(velocity/.25,0,1);
    const anticipation=recover?0:(.125+.065*pursuit)*translation;
    homeWorld(leg,leg.end,anticipation);
    if(!recover){leg.end.sub(model.position).applyAxisAngle(up,turnRate*duration*(pivot?1.35:.65)).add(model.position);leg.end.y=leg.home.y;}
    if(!recover&&mode!=='walk')leg.end.addScaledVector(new THREE.Vector3(Math.sin(model.rotation.y),0,Math.cos(model.rotation.y)),velocity*duration*.45);
    leg.landYaw=model.rotation.y+turnRate*duration*.35+(pivot?(leg.name.startsWith('front')?frontTurn.x:rearTurn.x):0);
    leg.recover=recover;leg.pivot=pivot;
  }
  function solveLeg(leg){
    leg.upper.parent.updateWorldMatrix(true,false);
    temp.copy(leg.goal);leg.upper.parent.worldToLocal(temp);temp.sub(leg.upper.position);
    const a=rest[`${leg.name}_lower`],b=rest[`${leg.name}_paw`];
    const l1=Math.hypot(a.y,a.z),l2=Math.hypot(b.y,b.z),restA=Math.atan2(a.z,a.y),bend=deltaAngle(Math.atan2(b.z,b.y),restA);
    const lateral=Math.atan2(temp.x,-temp.y),gy=-Math.hypot(temp.x,temp.y),gz=temp.z;
    const r=clamp(Math.hypot(gy,gz),Math.abs(l1-l2)+.001,l1+l2-.0002);
    const elbow=Math.acos(clamp((r*r-l1*l1-l2*l2)/(2*l1*l2),-1,1))*Math.sign(bend||-1);
    const shoulder=Math.atan2(gz,gy)-Math.atan2(l2*Math.sin(elbow),l1+l2*Math.cos(elbow));
    leg.upper.quaternion.setFromEuler(new THREE.Euler(deltaAngle(shoulder,restA),0,lateral,'ZXY'));
    leg.lower.rotation.x=deltaAngle(elbow,bend);
    leg.lower.updateWorldMatrix(true,false);leg.lower.getWorldQuaternion(q).invert();
    yawQ.setFromAxisAngle(up,leg.yaw);leg.paw.quaternion.copy(q).multiply(yawQ);
  }
  function update(dt){
    if(paused)return;dt=clamp(dt,0,.04);elapsed+=dt;poseReset();
    const dx=target.x-model.position.x,dz=target.z-model.position.z,distance=Math.hypot(dx,dz);
    const heading=interaction.facingYaw??(distance>.03?Math.atan2(dx,dz):model.rotation.y);
    const turn=deltaAngle(heading,model.rotation.y),remaining=Math.max(0,distance-(interaction.stopDistance??.30));
    let reachStress=0;for(const leg of legs)if(!leg.swing){homeWorld(leg,temp);reachStress=Math.max(reachStress,Math.hypot(temp.x-leg.anchor.x,temp.z-leg.anchor.z));}
    const turnFreedom=1-clamp((reachStress-lerp(.22,.11,pivotWeight))/lerp(.22,.16,pivotWeight),0,.85);
    pursuit=!interaction.locked&&mode==='follow'?clamp(interaction.pursuit||0,0,1):0;
    const sprintLaunch=pursuit>.45&&remaining>1.3&&velocity>.55&&Math.abs(turn)<.3&&interaction.throwId!==lastSprintThrow;
    const skip=interaction.playfulReturn&&remaining>1.05&&velocity>.55&&Math.abs(turn)<.3;
    if(!interaction.noHop&&!interaction.locked&&hopTurns&&mode==='follow'&&!hop&&elapsed>nextHop&&((distance>.95&&Math.abs(turn)>1.22)||skip||sprintLaunch)){
      const support=turn>0?2:0;
      const pivot=legs[support].anchor.clone().setY(0);
      const sprint=(sprintLaunch||pursuit>.45)&&interaction.throwId!==lastSprintThrow;
      if(sprint){lastSprintThrow=interaction.throwId;sprintCount++;}
      hop={time:0,sprint,skip:!!skip,yaw:model.rotation.y,angle:skip||sprintLaunch?0:turn,support,pivot,blend:motionBlend,entrySpeed:velocity,entryPosition:model.position.clone(),
        pivotLocal:pivot.clone().sub(model.position).applyAxisAngle(up,-model.rotation.y),
        travel:Math.min(sprint?.78:skip?.46:.34,remaining*(sprint?.38:skip?.32:.22)),feet:legs.map(l=>({anchor:l.anchor.clone(),lift:l.lift}))};
      hopCount++;if(skip)skipCount++;burstUntil=0;
    }
    if(hop&&!hop.skip&&!hop.sprint&&!hop.freezeTranslation&&hop.time<.5&&pursuit>.45&&interaction.throwId!==lastSprintThrow){
      hop.sprint=true;hop.travel=Math.min(.78,remaining*.38);
      lastSprintThrow=interaction.throwId;sprintCount++;
    }
    hopHeight=hopCompression=hopTuck=hopTilt=hopPitch=0;
    if(hop){
      hop.time+=dt*(hop.sprint?1.5:hop.skip?1.55:1);
      const t=hop.time,pivotProgress=clamp((t-.14)/.36,0,1),air=clamp((t-.50)/.27,0,1);
      const rearLoad=ease(clamp(t/.20,0,1));
      hopCompression=t<.50?-.065*rearLoad:t<.77?-.065*(1-air)**2:-.045*Math.sin(clamp((t-.77)/.14,0,1)*Math.PI);
      hopPitch=t<.50?-.18*rearLoad:-.18*(1-air)+.045*Math.sin(Math.PI*air);
      hopHeight=(hop.sprint?.17:hop.skip?.08:.115)*4*air*(1-air);
      hopTuck=.045*Math.sin(Math.PI*air);
      hopTilt=Math.sign(hop.angle)*Math.sin(Math.PI*pivotProgress)*.045;
      const previousYaw=model.rotation.y;
      if(t<.14&&mode==='follow'&&!hop.freezeTranslation){
        const u=t/.14,carry=hop.entrySpeed*hop.blend*.14*(u-u**3+.5*u**4);
        model.position.x=hop.entryPosition.x+Math.sin(hop.yaw)*carry;
        model.position.z=hop.entryPosition.z+Math.cos(hop.yaw)*carry;
      }
      if(t>=.14&&!hop.pivotStarted){
        hop.pivotStarted=true;
        hop.pivotLocal.copy(hop.pivot).sub(model.position).applyAxisAngle(up,-hop.yaw);
      }
      if(t>=.14&&t<.50){
        model.rotation.y=hop.yaw+hop.angle*ease(pivotProgress);
        // Turn over one planted hind paw; the other takes a small balancing step.
        if(mode==='follow'&&!hop.freezeTranslation){
          temp.copy(hop.pivotLocal).applyAxisAngle(up,model.rotation.y);
          model.position.copy(hop.pivot).sub(temp).setY(0);
        }
      }
      if(t>=.50){
        if(!hop.launch){
          hop.launch=model.position.clone();hop.launchYaw=model.rotation.y;
          hop.leapYaw=mode==='follow'?Math.atan2(target.x-model.position.x,target.z-model.position.z):model.rotation.y;
        }
        if(!hop.landed)model.rotation.y=hop.launchYaw+deltaAngle(hop.leapYaw,hop.launchYaw)*ease(air);
        if(mode==='follow'&&!hop.freezeTranslation&&!hop.landed){
          const travel=hop.travel*lerp(air,air*air*(2-air),hop.blend);
          model.position.x=hop.launch.x+Math.sin(hop.leapYaw)*travel;
          model.position.z=hop.launch.z+Math.cos(hop.leapYaw)*travel;
        }
        if(!hop.landed&&t>=.77){
          hop.landed=true;replantFeet();heave.v-=.28;
          if(mode==='follow'&&!hop.freezeTranslation){velocity=hop.blend*hop.travel/.27;burstUntil=elapsed+.42;}
        }
      }
      turnRate=dt?(model.rotation.y-previousYaw)/dt:0;
      if(t>=.91){const cooldown=interaction.playfulReturn?(hop.skip?1.4:.4):1.25;hop=null;nextHop=elapsed+cooldown;if(mode!=='follow')burstUntil=0;if(motionBlend===0)phase=0;turnRate=0;}
    }
    const landingOverlap=!!hop&&hop.landed&&hop.blend>0;
    const canMove=!hop||landingOverlap;
    const wantedTurn=(!interaction.locked||interaction.turnInPlace)&&mode==='follow'&&(interaction.turnInPlace||remaining>.025||interaction.enabled&&distance>.1)?clamp(turn*3.2,-1.3,1.3)*turnFreedom:0;
    if(canMove){turnRate=damp(turnRate,wantedTurn,7,dt);model.rotation.y+=turnRate*dt;}
    const alignment=Math.max(0,Math.cos(turn));
    if(hop?.landed&&Math.abs(turn)<.25)burstUntil=Math.min(burstUntil,elapsed+.14);
    const chase=mode==='follow'&&canMove&&elapsed<burstUntil&&remaining>.22;
    const urgency=smoothstep(remaining,.45,2.6);
    const fetchGallop=!interaction.locked&&mode==='follow'&&canMove?(interaction.fetchGallop||0)*smoothstep(remaining,.18,.9)*smoothstep(alignment,.35,.85):0;
    const wantedGallop=Math.max(chase?1:0,fetchGallop);
    gallop=damp(gallop,wantedGallop,wantedGallop>gallop?lerp(14,6,motionBlend):12,dt);
    const pace=Math.min(2+1.2*pursuit,speed*Math.max(lerp(.46,1.35,urgency),chase?1.12:0,fetchGallop*1.55,2.15*pursuit));
    const wantedSpeed=!interaction.locked&&mode==='follow'&&canMove?Math.min(pace,Math.sqrt(2*(1.3+1.3*pursuit)*remaining))*alignment*alignment:0;
    const oldVelocity=velocity;
    const acceleration=clamp((wantedSpeed-velocity)*(4+3*pursuit),-1.8-1.6*pursuit,lerp(.75,2.6,Math.max(gallop,urgency))+2.8*pursuit);
    velocity=Math.max(0,velocity+acceleration*dt);
    if(remaining<.015&&mode==='follow')velocity=damp(velocity,0,14,dt);
    if(hop&&!landingOverlap)velocity=hop.time<.14?hop.entrySpeed*(1-ease(hop.time/.14))*hop.blend:0;
    if(!interaction.locked&&mode==='follow'&&canMove){
      const step=Math.min(velocity*dt,remaining);
      model.position.x+=Math.sin(model.rotation.y)*step;model.position.z+=Math.cos(model.rotation.y)*step;
    }
    const turningInPlace=!hop&&mode==='follow'&&velocity<.22&&Math.abs(turnRate)>.06;
    pivotWeight=damp(pivotWeight,turningInPlace?1:0,8,dt);
    const activity=hop&&!landingOverlap?clamp(hop.entrySpeed/.5,0,1)*(1-ease(clamp(hop.time/.5,0,1)))*hop.blend:mode==='walk'?1:clamp(velocity/.22,0,1);
    motion=damp(motion,activity,lerp(activity>motion?9:6,3,motionBlend),dt);
    const gaitSpeed=mode==='walk'?speed*.46:velocity;
    trot=damp(trot,smoothstep(gaitSpeed,.63,.86),lerp(10,3,motionBlend),dt);
    const frequency=mode==='walk'?speed*1.12:lerp(Math.max(.65,velocity/.32),Math.max(2.25,velocity/(.42+.12*pursuit)),gallop);
    if(activity>.03)phase+=frequency*dt;
    idleTime=activity<.04?idleTime+dt:0;
    lastAcceleration=dt>0?(velocity-oldVelocity)/dt:0;
    const cyclic=phase*TAU;
    const bobAmplitude=lerp(.030,.047,trot)*bounce*motion;
    const bob=lerp(Math.sin(cyclic*2-.7)*bobAmplitude,Math.sin(cyclic-1.1)*(.043+.025*pursuit)*bounce,gallop);
    const bodyY=spring(heave,-(.045+.025*gallop)*motion+bob-Math.max(0,lastAcceleration)*.013,23,.74,dt);
    bones.body.position.y+=bodyY+hopHeight+hopCompression+Math.sin(elapsed*2)*.003*(1-motion);
    bones.body.rotation.x=spring(pitch,clamp(-lastAcceleration*.075,-.065,.085)+Math.sin(cyclic*2)*.012*motion,14,.7,dt)+Math.sin(cyclic+.4)*.055*gallop+hopPitch;
    const turnLoad=clamp(turnRate/1.3,-1,1)*turnFlow*(hop?0:1);
    const supports=legs.filter(leg=>leg.home.x*turnLoad<0&&!leg.swing).length;
    const supportWeight=supports===2?1:supports===1?.65:0;
    // Load the outside legs while the chest banks into the turn.
    const lateralShift=spring(weightShift,-turnLoad*.045*supportWeight,10,.9,dt);
    bones.body.position.x+=lateralShift;
    bones.body.position.y-=Math.abs(lateralShift)*.35;
    bones.body.rotation.z=spring(roll,-turnLoad*clamp(velocity*.14+pivotWeight*.15,0,.23)+Math.sin(cyclic)*.021*motion*(1-trot),12,.8,dt)+hopTilt;
    const focus=interaction.lookTarget;
    const focusHeading=focus?Math.atan2(focus.x-model.position.x,focus.z-model.position.z):heading;
    const focusDistance=focus?Math.hypot(focus.x-model.position.x,focus.z-model.position.z):distance;
    const attention=headTracking?(interaction.attention||0):0;
    attentionYaw=damp(attentionYaw,clamp(deltaAngle(focusHeading,model.rotation.y),-.9,.9)*attention,5,dt);
    attentionPitch=damp(attentionPitch,focus?-clamp(Math.atan2(focus.y-1.16,Math.max(.5,focusDistance)),-.4,.6)*attention:0,7,dt);
    excitement=damp(excitement,interaction.excitement||0,5,dt);
    tailClock+=dt*(5+wag*5+excitement*6);
    const leadTarget=mode==='follow'&&(distance>.35||interaction.turnInPlace)?clamp(turn*lerp(.45,.8,pivotWeight),-lerp(.34,.55,pivotWeight),lerp(.34,.55,pivotWeight))*turnFlow:0;
    const frontBend=spring(frontTurn,leadTarget,18,.85,dt);
    const rearBend=spring(rearTurn,clamp(-turnRate*lerp(.12,.27,pivotWeight),-.38,.38)*turnFlow,8,.85,dt);
    const tailBend=spring(tailTurn,clamp(-turnRate*.13,-.32,.32)*turnFlow,6,.82,dt);
    bones.body.position.y-=Math.min(.04,(Math.abs(frontBend)+Math.abs(rearBend))*.075);
    bones.spine_rear.rotation.y=rearBend*.7;
    bones.pelvis.rotation.y=rearBend*.3+Math.sin(cyclic+.45)*.032*motion*(1-trot*.65);
    bones.pelvis.rotation.z=Math.sin(cyclic+.7)*.017*motion+turnLoad*.025;
    bones.spine.rotation.y=frontBend*.25;
    bones.spine_front.rotation.y=frontBend*.45;
    bones.chest.rotation.y=frontBend*.3-Math.sin(cyclic+.2)*.021*motion;
    bones.chest.rotation.x=-bones.body.rotation.x*.25;
    bones.chest.rotation.z=-turnLoad*.025;
    bones.spine.rotation.x=Math.sin(cyclic)*(.045+.04*pursuit)*gallop;
    bones.pelvis.rotation.x=-Math.sin(cyclic)*(.035+.03*pursuit)*gallop;
    const dip=interaction.dip||0,rear=interaction.rear||0,bow=interaction.bow||0;
    bones.body.position.y-=.18*dip+.025*rear+.11*bow;
    bones.body.position.z-=.16*rear;
    bones.body.rotation.x+=.32*dip-.52*rear+.48*bow;
    bones.spine_front.rotation.x+=.15*dip+attentionPitch*.18+.12*bow;
    bones.chest.position.y-=.12*bow;
    bones.spine_front.rotation.y+=attentionYaw*.18;
    bones.chest.rotation.y+=attentionYaw*.12;
    bones.chest.rotation.x+=attentionPitch*.15;
    bones.pelvis.rotation.z+=Math.sin(tailClock)*excitement*.018;
    bones.chest.position.y+=Math.sin(elapsed*3.8)*excitement*.007;
    for(const name of ['body','spine_rear','pelvis','spine','spine_front','chest'])blendBone(name,dt);
    model.updateMatrixWorld(true);
    const duty=lerp(lerp(.77,.58,trot),.28,gallop),walkOffsets=[0,.25,.5,.75],trotOffsets=[0,.5,.5,0],gallopOffsets=[0,.43,.08,.51];
    for(const leg of legs){
      const release=hop?.landed&&hop.blend>0&&hop.time>=.77+.14*(1-hop.blend)+(leg.name.startsWith('hind')?.018:0);
      if(hop&&!release){
        const t=hop.time,isFront=leg.name.startsWith('front'),pivotProgress=clamp((t-.14)/.36,0,1);
        if(t<.14){
          leg.lift=hop.feet[leg.index].lift*(1-ease(t/.14));leg.swing=leg.lift>.005;
        }else if(t<.50){
          if(leg.index===hop.support){leg.anchor.copy(hop.feet[leg.index].anchor);leg.lift=0;leg.swing=false;}
          else{
            homeWorld(leg,temp);
            leg.anchor.lerpVectors(hop.feet[leg.index].anchor,temp,ease(clamp(pivotProgress*3,0,1)));
            leg.lift=isFront?(hop.skip?.17:.24)*ease(clamp(pivotProgress*3,0,1)):.045*Math.sin(Math.PI*pivotProgress);
            leg.swing=true;
          }
          leg.yaw=model.rotation.y;
        }else if(t<.77){
          const air=(t-.50)/.27;
          homeWorld(leg,leg.anchor,hop.sprint?(isFront?.22:-.16)*Math.sin(Math.PI*air):0);leg.yaw=model.rotation.y;leg.swing=true;
          leg.lift=hopHeight+hopTuck+(isFront?(hop.skip?.17:.24)*(1-air)**2:0);
        }else{leg.swing=false;leg.lift=0;}
        leg.goal.copy(leg.anchor);leg.goal.y=leg.home.y+leg.lift;
        continue;
      }
      if(mode==='walk'&&!leg.swing){const treadmill=frequency*.25/duty;leg.anchor.x-=Math.sin(model.rotation.y)*treadmill*dt;leg.anchor.z-=Math.cos(model.rotation.y)*treadmill*dt;}
      const offset=lerp(lerp(walkOffsets[leg.index],trotOffsets[leg.index],trot),gallopOffsets[leg.index],gallop);
      const p=((phase-offset)%1+1)%1,inSwing=p>duty;
      if(!turningInPlace&&activity>.05&&inSwing&&!leg.wasSwingPhase&&!leg.swing)launchStep(leg,(1-duty)/frequency);
      leg.wasSwingPhase=inSwing;
      if(leg.swing){
        leg.t=Math.min(1,leg.t+dt/leg.duration);const t=ease(leg.t);
        leg.anchor.lerpVectors(leg.start,leg.end,t);leg.lift=Math.sin(Math.PI*leg.t)**1.25*(leg.pivot?.065:leg.recover?.045:lerp(lerp(.105,.145,trot),.18+.035*pursuit,gallop));
        leg.yaw+=deltaAngle(leg.landYaw,leg.yaw)*Math.min(1,dt*14);
        if(leg.t>=1){leg.swing=false;leg.lift=0;leg.anchor.copy(leg.end);leg.yaw=leg.landYaw;}
      }else leg.lift=0;
      leg.goal.copy(leg.anchor);leg.goal.y=leg.home.y+leg.lift;
    }
    if(!hop&&Math.abs(turnRate)>.06&&legs.filter(l=>l.swing).length<(turningInPlace?1:2)){
      let urgent,drift=turningInPlace?.16:.19;
      for(const leg of legs)if(!leg.swing){homeWorld(leg,temp);const d=Math.hypot(temp.x-leg.anchor.x,temp.z-leg.anchor.z);if(d>drift){urgent=leg;drift=d;}}
      if(urgent)launchStep(urgent,turningInPlace?.26:.17,false,turningInPlace);
    }
    // A changing gait must not leave a stance paw behind when its phase offset shifts.
    if(!hop&&velocity>.18)for(const leg of legs)if(!leg.swing){
      homeWorld(leg,temp);temp.sub(leg.anchor);
      const behind=temp.x*Math.sin(model.rotation.y)+temp.z*Math.cos(model.rotation.y);
      if(behind>.20)launchStep(leg,.18);
    }
    // Let the last step finish, then settle the remaining paws one at a time.
    if(!hop&&Math.abs(turnRate)<.06&&idleTime>.18&&!legs.some(l=>l.swing)){
      let furthest,excess=.045;
      for(const leg of legs){homeWorld(leg,temp);const d=Math.hypot(temp.x-leg.anchor.x,temp.z-leg.anchor.z);if(d>excess){furthest=leg;excess=d;}}
      if(furthest)launchStep(furthest,.22,true);
    }
    if(rear>.01)for(const leg of legs){
      homeWorld(leg,leg.anchor);leg.swing=leg.name.startsWith('front');leg.lift=leg.swing?(.48+.015*Math.sin(elapsed*5+leg.index))*rear:0;
      leg.goal.copy(leg.anchor);leg.goal.y+=leg.lift;leg.yaw=model.rotation.y;
      if(leg.swing)leg.goal.addScaledVector(new THREE.Vector3(Math.sin(model.rotation.y),0,Math.cos(model.rotation.y)),-.10*rear);
    }
    for(const leg of legs)solveLeg(leg);
    const desiredHead=headTracking&&(distance>.04||interaction.turnInPlace)?clamp(deltaAngle(focusHeading,model.rotation.y),-.95,.95)-frontBend-attentionYaw*.3:0;
    previousHeadYaw=headYaw;headYaw=damp(headYaw,desiredHead,8,dt);
    const shaking=elapsed-shakeStart,shake=shaking>=0&&shaking<.65?Math.sin(shaking*22)*Math.sin(Math.PI*shaking/.65)*.20:0;
    bones.neck_base.rotation.y=headYaw*.18;
    bones.neck.rotation.y=headYaw*.27+shake*.3;bones.head.rotation.y=headYaw*.55+shake*.7;
    bones.head.rotation.x=-bones.body.rotation.x*.65-Math.sin(cyclic*2-.3)*.027*motion+Math.sin(elapsed*1.4)*.018*(1-motion);
    bones.head.rotation.z=Math.sin(elapsed*.9)*.025*(1-motion)-bones.body.rotation.z*.4;
    bones.neck_base.rotation.x+=.38*dip-.12*rear;
    bones.neck.rotation.x+=.35*dip;
    bones.head.rotation.x+=.45*dip-.10*rear+attentionPitch*.5;
    bones.neck.rotation.x+=attentionPitch*.17;
    bones.head.rotation.z+=attentionYaw*.06;
    for(const name of ['neck_base','neck','head'])blendBone(name,dt);
    const headRate=dt? (headYaw-previousHeadYaw)/dt:0;
    for(const [side,es]of Object.entries(earSprings)){
      const sign=side==='left'?1:-1;
      const inertial=clamp(-lastAcceleration*.13-heave.v*.65+Math.sin(cyclic*2+.2)*.055*motion,-.28,.28)*flop;
      const rx=spring(es.pitch,inertial,15,.27,dt);
      const rz=spring(es.roll,clamp(headRate*.09+turnRate*.05+shake*1.7,-.6,.6)*flop+sign*Math.abs(heave.v)*.10*flop,13,.25,dt);
      bones[`ear_${side}`].rotation.set(rx,0,rz);
      bones[`ear_${side}_tip`].rotation.x=spring(es.tip,rx*1.3-heave.v*.35*flop,11,.24,dt);
      bones[`ear_${side}_tip`].rotation.z=rz*.65;
    }
    for(const[i,name]of ['tail_base','tail_mid','tail_tip'].entries()){
      bones[name].rotation.y=tailBend*[.6,.3,.1][i];
      bones[name].rotation.z=Math.sin(tailClock-i*.65)*wag*(1+excitement*.8)*[.28,.20,.14][i]-clamp(turnRate,-2,2)*.06*(i+1)/3;
      bones[name].rotation.x=Math.sin(cyclic*2-i*.6)*.035*motion+pitch.x*.7;
    }
    if(autoFace&&elapsed>nextBlink){blinkStart=elapsed;nextBlink=elapsed+3.1+(Math.sin(elapsed*17)+1)*1.15;}
    const bt=elapsed-blinkStart;
    blinkValue=blinkOverride??(bt>=0&&bt<.26?(bt<.085?ease(bt/.085):1-ease((bt-.085)/.175)):0);
    const pant=autoFace?(.12+motion*.48+Math.sin(elapsed*8)*.05*motion):mouth;
    mouthValue=damp(mouthValue,interaction.mouth??pant,12,dt);tongueValue=damp(tongueValue,interaction.mouth!=null?0:autoFace?motion*.62:tongue,10,dt);
    bones.jaw.quaternion.setFromAxisAngle(jawAxis,-.64*(1-mouthValue));
    bones.tongue.position.y+=(1-tongueValue)*.020;bones.tongue.position.z-=(1-tongueValue)*.085;
    bones.tongue.scale.set(.08+.92*tongueValue,.08+.92*tongueValue,.08+.92*tongueValue);
    bones.tongue_tip.scale.set(1,.20+.80*tongueValue,.30+.70*tongueValue);
    bones.tongue_tip.rotation.x=Math.sin(elapsed*8)*.07*tongueValue;
    gazeX=damp(gazeX,headTracking?clamp(deltaAngle(focusHeading,model.rotation.y)-headYaw,-.6,.6)*.022:0,18,dt);
    gazeY=damp(gazeY,headTracking?(interaction.lookHeight!=null?clamp((interaction.lookHeight-1.2)*.02,-.012,.02):distance>.4?-.004:0):0,12,dt);
    for(const side of ['left','right']){const eye=bones[`eye_${side}`];eye.scale.y=1-.985*blinkValue;eye.position.x+=gazeX*.934;eye.position.z-=gazeX*.356;eye.position.y+=gazeY;}
    for(const[name,r]of Object.entries(manual))bones[name].rotation.set(...r);
    // Correct each sole independently; translating the whole dog here would cancel the body bob.
    for(let iteration=0;iteration<2;iteration++){
      model.updateMatrixWorld(true);mesh.skeleton.update();maxFloorError=0;
      for(const leg of legs){let minimum=Infinity;for(const i of leg.sole){mesh.getVertexPosition(i,temp).applyMatrix4(mesh.matrixWorld);minimum=Math.min(minimum,temp.y);}if(!Number.isFinite(minimum))continue;
        const error=leg.lift-minimum;maxFloorError=Math.max(maxFloorError,Math.abs(error));leg.goal.y+=clamp(error,-.07,.07);solveLeg(leg);
      }
    }
    if(interaction.target&&dip>.01){
      const goal=getMouthPosition(mouthWorld).clone().lerp(interaction.target,dip);
      const joint=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),rotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion();
      for(let i=0;i<8;i++)for(const name of ['head','neck','neck_base']){
        const bone=bones[name];bone.getWorldPosition(joint);getMouthPosition(mouthWorld);
        from.copy(mouthWorld).sub(joint).normalize();to.copy(goal).sub(joint).normalize();
        rotation.setFromUnitVectors(from,to);rotation.slerp(new THREE.Quaternion(),.45);
        bone.parent.getWorldQuaternion(parentRotation);
        rotation.premultiply(parentRotation.clone().invert()).multiply(parentRotation);
        bone.quaternion.premultiply(rotation);bone.updateWorldMatrix(false,true);
      }
    }
    model.updateMatrixWorld(true);
  }
  function reset(){
    interaction={};attentionYaw=attentionPitch=excitement=tailClock=pivotWeight=0;motionBlend=.7;turnFlow=1;for(const name of Object.keys(poseHistory))delete poseHistory[name];
    model.position.set(0,0,0);model.rotation.set(0,-.35,0);target.set(0,0,0);
    hop=null;hopHeight=hopCompression=hopTuck=hopTilt=hopPitch=nextHop=burstUntil=gallop=hopCount=skipCount=0;hopTurns=true;pursuit=sprintCount=0;lastSprintThrow=-1;
    elapsed=phase=velocity=turnRate=motion=trot=headYaw=previousHeadYaw=idleTime=lastAcceleration=0;
    mode='follow';speed=1;wag=.7;bounce=.7;flop=.75;headTracking=autoFace=true;paused=false;manual={};
    mouth=mouthValue=.35;tongue=tongueValue=.35;blinkValue=0;blinkOverride=null;blinkStart=shakeStart=-10;nextBlink=2.8;gazeX=gazeY=0;
    for(const s of [heave,pitch,roll,weightShift,frontTurn,rearTurn,tailTurn,...Object.values(earSprings).flatMap(e=>Object.values(e))]){s.x=0;s.v=0;}
    initializeFeet();update(0);
  }
  function getState(){return {mode,paused,bow:interaction.bow||0,excitement,attentionYaw,attentionPitch,motionBlend,turnFlow,pivotWeight,turnBends:{front:frontTurn.x,rear:rearTurn.x,tail:tailTurn.x},blendWeights:{idle:1-motion,walk:motion*(1-gallop)*(1-trot),trot:motion*(1-gallop)*trot,gallop:motion*gallop,turn:hop?1:0,landing:hop?.landed?1-ease(clamp((hop.time-.77)/.14,0,1)):0},hopTurns,hopCount,skipCount,sprintCount,pursuit,sprintBound:!!hop?.sprint,skipping:!!hop?.skip,action:hop?(hop.time<.14?'crouch':hop.time<.50?'rear-pivot':hop.time<.77?'leap':'land'):gallop>.25?'gallop':trot>.3&&motion>.2?'run':'grounded',hopHeight,gallop,speed,wag,bounce,flop,headTracking,autoFace,position:model.position.toArray(),target:target.toArray(),heading:model.rotation.y,velocity,stride:motion,phase,trot,turnRate,bodyHeight:bones.body.position.y-rest.body.y,bodyPitch:bones.body.rotation.x,bodyLean:bones.body.rotation.z,weightShift:weightShift.x,mouth:mouthValue,tongue:tongueValue,blink:blinkValue,gaze:[gazeX,gazeY],boneCount:Object.keys(bones).length,floorCorrection:0,maxFloorError,feet:legs.map(l=>({name:l.name,swing:l.swing,lift:l.lift,anchor:l.anchor.toArray()})),bones:Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.rotation.toArray().slice(0,3)]))};}
  reset();
  const finite=(v,name)=>{if(!Number.isFinite(v))throw new Error(`${name} must be finite.`);return v;};
  return {model,bones,mesh,update,reset,setMode,setTarget,getState,getMouthPosition,setInteraction(value){interaction=value||{};},
    setTurnFlow(v){turnFlow=clamp(finite(v,'Turn flow'),0,1.5);},
    setMotionBlend(v){motionBlend=clamp(finite(v,'Motion blend'),0,1);},
    setHopTurns(v){hopTurns=!!v;if(!hopTurns)burstUntil=0;},
    setSpeed(v){speed=clamp(finite(v,'Speed'),.3,2);},setWag(v){wag=clamp(finite(v,'Wag'),0,1);},
    setBounce(v){bounce=clamp(finite(v,'Bounce'),0,1.5);},setFlop(v){flop=clamp(finite(v,'Flop'),0,1.5);},
    setMouth(v){mouth=clamp(finite(v,'Mouth'),0,1);autoFace=false;},setTongue(v){tongue=clamp(finite(v,'Tongue'),0,1);autoFace=false;},
    setAutoFace(v){autoFace=!!v;blinkOverride=null;},setBlink(v){blinkOverride=clamp(finite(v,'Blink'),0,1);},blink(){blinkOverride=null;blinkStart=elapsed;},shake(){shakeStart=elapsed;},
    setHeadTracking(v){headTracking=!!v;},setPaused(v){paused=!!v;},
    setBoneRotation(name,x=0,y=0,z=0){if(!bones[name]||![x,y,z].every(Number.isFinite))throw new Error('Invalid bone or rotation.');manual[name]=[x,y,z].map(n=>clamp(n,-.65,.65));},clearBoneOverrides(){manual={};}
  };
}
