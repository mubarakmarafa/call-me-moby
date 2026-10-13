import test from 'node:test';
import assert from 'node:assert/strict';
import { directionalCartridge } from '../src/console-controls.js';
const homes=[{x:3,y:1.55},{x:-3,y:-1.65},{x:-3,y:1.8},{x:3,y:-1.1}];
test('D-pad navigates spatially between cartridges',()=>{
  assert.equal(directionalCartridge(0,'left',homes),2);
  assert.equal(directionalCartridge(0,'down',homes),3);
  assert.equal(directionalCartridge(3,'left',homes),1);
  assert.equal(directionalCartridge(1,'up',homes),2);
  assert.equal(directionalCartridge(2,'right',homes),0);
});
test('D-pad holds selection at an edge instead of jumping diagonally',()=>{
 assert.equal(directionalCartridge(0,'right',homes),0);
 assert.equal(directionalCartridge(0,'up',homes),0);
 assert.equal(directionalCartridge(1,'left',homes),1);
});

test('fifth cartridge is reachable between the left cartridges on desktop and mobile',()=>{
 for (const positions of [
  [{x:3.25,y:1.55},{x:-2.9,y:-2.05},{x:-3.47,y:2.1},{x:3.25,y:-1.1},{x:-3.37,y:0}],
  [{x:1.35,y:2.65},{x:-1.35,y:-2.6},{x:-1.35,y:2.85},{x:1.35,y:-2.95},{x:-1.35,y:.1}],
 ]) {
  assert.equal(directionalCartridge(2,'down',positions),4);
  assert.equal(directionalCartridge(1,'up',positions),4);
  assert.equal(directionalCartridge(4,'up',positions),2);
  assert.equal(directionalCartridge(4,'down',positions),1);
 }
});
