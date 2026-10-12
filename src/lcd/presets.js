export const presets = {
  dmg: { palette: [[.86,.811,.533],[.48,.57,.32],[.20,.32,.18],[.07,.15,.10]], panelBg: [.93,.85,.586], shadowColor: [.397,.391,.222] },
  'dmg-real': { palette: [[.574,.769,.321],[.269,.708,.279],[.212,.635,.382],[.127,.578,.412]], panelBg: [.74,.673,.329], shadowColor: [.316,.311,.177] },
  pocket: { palette: [[.714,.741,.565],[.541,.573,.408],[.298,.333,.251],[.078,.094,.055]], panelBg: [.812,.855,.675], shadowColor: [.18,.19,.18] },
  light: { palette: [[.569,.918,.816],[.337,.706,.584],[.208,.471,.384],[.039,.11,.082]], panelBg: [.498,.886,.765], shadowColor: [.2,.24,.21] },
};

export const defaults = {
  preset: 'dmg', cols: 400, dither: .15, density: .54, bleed: .08,
  brightness: .95, contrast: 1.12, saturation: 1, colorStrength: .98, panelGamma: 1.1,
  blackLift: .02, offTint: .06, warm: .06,
  gridStrength: .38, pixelSize: .8, gapGain: 1,
  shadowOffset: 1.35, shadowBlur: .85, shadowOpacity: .34,
  crosstalk: .34, xtalkEdge: .4,
  ghostStrength: .52, ghostGate: .05,
  paper: .01, grain: .012, gradient: .08, vignette: .08,
};
