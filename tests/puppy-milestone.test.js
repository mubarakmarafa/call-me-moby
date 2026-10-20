import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayMilestone } from '../src/puppy/play-milestone.js';
test('six throws reveal once, stationary drops and cancelled drags do not count',()=>{
 let shown=0;const observe=createPlayMilestone(()=>shown++);
 observe(undefined);observe(0);
 for(let serial=1;serial<=5;serial++){observe(serial);observe(serial);}
 assert.equal(shown,0);
 observe(6);assert.equal(shown,1);
 observe(6);observe(7);observe(8);assert.equal(shown,1);
});
test('a new cartridge session starts with no play progress',()=>{
 let shown=0;const old=createPlayMilestone(()=>shown++);old(6);
 const fresh=createPlayMilestone(()=>shown++);fresh(1);fresh(5);
 assert.equal(shown,1);fresh(6);assert.equal(shown,2);
});
