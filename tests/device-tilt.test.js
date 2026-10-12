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
