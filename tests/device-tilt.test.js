import test from 'node:test';
import assert from 'node:assert/strict';
import { relativeTilt } from '../src/device-tilt.js';

test('calibrates to a comfortable holding angle', () => {
  assert.deepEqual(relativeTilt(64,8,{beta:64,gamma:8}),{x:0,y:0});
});
test('maps tilt to the current landscape orientation', () => {
  const result=relativeTilt(64,30,{beta:64,gamma:8},90);
  assert.ok(Math.abs(result.x)<1e-10);
  assert.equal(result.y,-1);
});
test('limits extremes and handles angle wraparound', () => {
  assert.deepEqual(relativeTilt(150,80,{beta:30,gamma:0}),{x:1,y:1});
  const result=relativeTilt(-179,0,{beta:179,gamma:0});
  assert.ok(Math.abs(result.y-2/22)<1e-10);
});

import { setupDeviceTilt } from '../src/device-tilt.js';

function motionEnvironment(t, permission, { reduced = false, coarse = true, supported = true } = {}) {
  let requests = 0;
  const listeners = new Map();
  const orientation = { requestPermission() { requests++; return Promise.resolve(permission); } };
  const values = {
    matchMedia: query => ({ matches: query.includes('reduced') ? reduced : coarse, addEventListener() {}, removeEventListener() {} }),
    window: { isSecureContext: true, ...(supported ? { DeviceOrientationEvent: orientation } : {}),
      addEventListener: (name,fn) => listeners.set(name,fn), removeEventListener: name => listeners.delete(name) },
    DeviceOrientationEvent: orientation,
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    screen: { orientation: { angle: 0 } },
  };
  for (const [key,value] of Object.entries(values)) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
  }
  return { listeners, requests:()=>requests };
}

test('requests synchronously from the gesture, once, and starts on approval',async t=>{
  let control; t.after(()=>control?.destroy());
  const env=motionEnvironment(t,'granted');
  const changes=[];
  control=setupDeviceTilt({},(x,y)=>changes.push([x,y]));
  assert.equal(env.requests(),0);
  const pending=control.request();
  assert.equal(env.requests(),1);
  await pending;
  await control.request();
  assert.equal(env.requests(),1);
  const receive=env.listeners.get('deviceorientation');
  receive({beta:50,gamma:0});receive({beta:61,gamma:11});
  assert.deepEqual(changes.at(-1),[.5,.5]);
  control.destroy();assert.equal(env.listeners.size,0);
});
test('declining permission leaves motion off and does not ask again',async t=>{
  let control; t.after(()=>control?.destroy());
  const env=motionEnvironment(t,'denied');
  control=setupDeviceTilt({},()=>{});
  await control.request();await control.request();
  assert.equal(env.requests(),1);assert.equal(env.listeners.size,0);
});
for (const options of [{reduced:true},{coarse:false},{supported:false}]) {
  test(`does not ask for motion when ${JSON.stringify(options)}`,async t=>{
    let control; t.after(()=>control?.destroy());
    const env=motionEnvironment(t,'granted',options);
    control=setupDeviceTilt({},()=>{});
    await control.request();assert.equal(env.requests(),0);assert.equal(env.listeners.size,0);
  });
}
