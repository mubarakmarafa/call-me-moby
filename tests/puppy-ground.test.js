import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ViewportBall } from '../src/puppy/viewport-ball.js';
const makeBall=()=>{
 const camera=new THREE.OrthographicCamera(-2.4,2.4,2.1,-2.1,.1,50);
 camera.position.set(5,3.8,6.8);camera.lookAt(0,.6,0);camera.updateMatrixWorld();
 return new ViewportBall(camera);
};
test('ground click aims an impulse without moving the ball to a destination',()=>{
 const ball=makeBall(),start=ball.position.clone();
 ball.carried=true;ball.throwToward(start.clone().add(new THREE.Vector3(-1,0,1)));
 assert.ok(ball.position.equals(start));assert.equal(ball.carried,false);
 assert.ok(ball.velocity.x<0&&ball.velocity.z>0&&ball.velocity.y>0);
 assert.equal(ball.throwSerial,1);
 const velocity=ball.velocity.clone();ball.update(1/60);
 assert.ok(ball.velocity.y<velocity.y);assert.ok(ball.position.y>start.y);
});
test('near clicks do not become exact landing targets and distant clicks cap strength',()=>{
 const ball=makeBall(),start=ball.position.clone();
 const clicked=start.clone().add(new THREE.Vector3(-.1,0,0));
 ball.throwToward(clicked);
 for(let i=0;i<20;i++)ball.update(1/60);
 assert.ok(ball.position.x<clicked.x-.2);
 ball.throwToward(new THREE.Vector3(100,0,100));
 assert.ok(Math.hypot(ball.velocity.x,ball.velocity.z)<=5.50001);
 ball.throwToward(ball.position.clone());
 assert.ok(ball.velocity.toArray().every(Number.isFinite));
});

test('ball remains inside viewport after changing from wide paper to narrow paper', () => {
 const ball=makeBall();
 for(const aspect of [2.2,.65,1.14]) {
  ball.camera.left=-2.1*aspect;ball.camera.right=2.1*aspect;
  ball.camera.updateProjectionMatrix();
  ball.position.set(4,.15,3);ball.velocity.set(5,4,3);
  for(let i=0;i<240;i++) {
   ball.update(1/120);
   const point=ball.position.clone().project(ball.camera);
   assert.ok(Math.abs(point.x)<=1.001 && Math.abs(point.y)<=1.001);
   assert.ok(ball.position.y>=ball.radius);
  }
 }
});
