// Map a CSS plane through the exact view/projection matrix used by WebGL.
// A single transform avoids browser-specific nested CSS perspective handling.
export function screenProjectionMatrix(elements, width, height) {
  const e = elements;
  const w = e[15];
  return [
    width * .5 * (e[0] + e[3]) / w, height * .5 * (e[3] - e[1]) / w, 0, e[3] / w,
    width * .5 * (e[4] + e[7]) / w, height * .5 * (e[7] - e[5]) / w, 0, e[7] / w,
    0, 0, 1, 0,
    width * .5 * (e[12] + e[15]) / w, height * .5 * (e[15] - e[13]) / w, 0, 1,
  ];
}
