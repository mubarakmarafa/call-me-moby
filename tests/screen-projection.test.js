import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { screenProjectionMatrix } from '../src/screen-projection.js';

for (const [width,height] of [[390,664],[390,844],[844,390],[1440,900]]) {
  test(`CSS screen matches WebGL corners and interior at ${width}×${height}`, () => {
    const camera = new PerspectiveCamera(32,width/height,.1,100);
    camera.position.set(.2,.4,7);
    camera.lookAt(0,.3,0);
    camera.updateMatrixWorld();
    for (const angle of [0,.09,.3]) {
      const world = new Matrix4().makeRotationY(angle);
      world.setPosition(.1,.7,.5);
      const plane = new Matrix4().set(2.8/420,0,0,-1.4,0,-2.47/371,0,1.235,0,0,1,0,0,0,0,1);
      const worldPlane = world.clone().multiply(plane);
      const clip = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).multiply(worldPlane);
      const css = screenProjectionMatrix(clip.elements,width,height);
      for (const [x,y] of [[0,0],[420,0],[420,371],[0,371],[210,185.5],[40,300]]) {
        const expected = new Vector3(x,y,0).applyMatrix4(worldPlane).project(camera);
        const divisor = css[3]*x+css[7]*y+css[15];
        const actualX = (css[0]*x+css[4]*y+css[12])/divisor;
        const actualY = (css[1]*x+css[5]*y+css[13])/divisor;
        assert.ok(Math.abs(actualX-(expected.x+1)*width/2)<1e-8);
        assert.ok(Math.abs(actualY-(1-expected.y)*height/2)<1e-8);
      }
    }
  });
}
