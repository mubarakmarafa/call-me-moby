// The source GLB merges the inserted cartridge and controls into one Plastic mesh.
// Its cartridge is a disconnected island in these source-model coordinates.
export function removeBuiltInCartridge(geometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const belongsToCartridge = (i) =>
    position.getX(i) > -.46 && position.getX(i) < .57 &&
    position.getY(i) > -.20 && position.getY(i) < -.04 &&
    position.getZ(i) > .32 && position.getZ(i) < .90;
  const retained = [];
  let removedTriangles = 0;
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const selected = triangle.filter(belongsToCartridge).length;
    if (selected === 3) {
      removedTriangles++;
    } else if (selected === 0) {
      retained.push(...triangle);
    } else {
      throw new Error('Cartridge selection intersects another part of the model.');
    }
  }
  if (!removedTriangles || retained.length === 0) {
    throw new Error('The source model does not contain the expected cartridge island.');
  }
  geometry.setIndex(retained);
  return removedTriangles;
}
