import { Box3, Mesh, Vector3 } from 'three';

const regions = {
  pad: [-1.16,-.49,-1.14,-.48],
  b: [.35,.70,-1.05,-.70],
  a: [.85,1.21,-.87,-.52],
  select: [-.34,-.06,-1.66,-1.55],
  start: [.06,.34,-1.66,-1.55],
};

// The supplied model combines its controls in one material. Split only whole
// triangles, preserving their UVs/normals and leaving the other plastic intact.
export function splitConsoleControls(geometry, material) {
  const position=geometry.getAttribute('position'), index=geometry.getIndex();
  const buckets=Object.fromEntries([...Object.keys(regions),'rest'].map(key=>[key,[]]));
  const classify=i=>Object.entries(regions).find(([,r])=>position.getX(i)>r[0]&&position.getX(i)<r[1]&&position.getY(i)>r[2]&&position.getY(i)<r[3]&&position.getZ(i)>.35)?.[0]??'rest';
  for(let i=0;i<index.count;i+=3){
    const triangle=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    const key=classify(triangle[0]);
    if(!triangle.every(vertex=>classify(vertex)===key))throw new Error('Control region cuts through model geometry');
    buckets[key].push(...triangle);
  }
  const controls={};
  for(const name of Object.keys(regions)){
    if(!buckets[name].length)throw new Error(`Missing console control: ${name}`);
    const part=geometry.clone();part.setIndex(buckets[name]);
    const box=new Box3();for(const i of buckets[name])box.expandByPoint(new Vector3().fromBufferAttribute(position,i));
    const center=box.getCenter(new Vector3());part.translate(-center.x,-center.y,-center.z);
    part.computeBoundingBox();part.computeBoundingSphere();
    const mesh=new Mesh(part,material);mesh.position.copy(center);mesh.name=`control-${name}`;
    controls[name]={mesh,center};
  }
  geometry.setIndex(buckets.rest);
  return controls;
}

export function directionalCartridge(current, direction, homes) {
  const axes={left:[-1,0],right:[1,0],up:[0,1],down:[0,-1]};
  const [dx,dy]=axes[direction];const origin=homes[current];
  let best=current, score=Infinity;
  homes.forEach((point,index)=>{
    const x=point.x-origin.x,y=point.y-origin.y,forward=x*dx+y*dy;
    const lateral=Math.abs(x*dy-y*dx);
    if(index===current||forward<=Math.max(.2,lateral*.5))return;
    const candidate=Math.hypot(x,y)+lateral*2;
    if(candidate<score){score=candidate;best=index;}
  });
  return best;
}
