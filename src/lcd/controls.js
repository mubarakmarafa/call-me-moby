import { createDialKit, createDialRoot } from 'dialkit/vanilla';
import 'dialkit/vanilla/styles.css';
import './controls.css';
import { defaults } from './presets.js';

export function mountLcdControls(screen) {
  const root = createDialRoot({ position: 'bottom-right', theme: 'dark', defaultOpen: false });
  const slider = (key, min, max, step = .01) => [defaults[key], min, max, step];
  const kit = createDialKit('LCD screen', {
    preset: { type: 'select', options: ['dmg','dmg-real','pocket','light'], default: defaults.preset },
    cols: slider('cols', 160, 640, 8),
    density: slider('density', 0, 1),
    ghostStrength: slider('ghostStrength', 0, 1),
    gridStrength: slider('gridStrength', 0, 1),
    shadowOpacity: slider('shadowOpacity', 0, .8),
    color: {
      _collapsed: true,
      colorStrength: slider('colorStrength', 0, 1),
      brightness: slider('brightness', .5, 1.5), contrast: slider('contrast', .5, 1.5),
      saturation: slider('saturation', 0, 1.5), panelGamma: slider('panelGamma', .6, 1.6),
      blackLift: slider('blackLift', 0, .4), offTint: slider('offTint', 0, .3), warm: slider('warm', 0, .3),
    },
    pixels: {
      _collapsed: true,
      pixelSize: slider('pixelSize', .35, 1), dither: slider('dither', 0, 1),
      bleed: slider('bleed', 0, .6), gapGain: slider('gapGain', .6, 1.3),
      crosstalk: slider('crosstalk', 0, 1), xtalkEdge: slider('xtalkEdge', 0, 1),
    },
    surface: {
      _collapsed: true,
      shadowOffset: slider('shadowOffset', 0, 4), shadowBlur: slider('shadowBlur', 0, 3),
      paper: slider('paper', 0, .1), grain: slider('grain', 0, .1),
      gradient: slider('gradient', 0, .4), vignette: slider('vignette', 0, .5), ghostGate: slider('ghostGate', 0, .2),
    },
    replay: { type: 'action', label: 'Replay screen build-in' },
    reset: { type: 'action', label: 'Reset LCD defaults' },
  }, { id: 'moby-lcd-v1', persist: true, onAction: action => {
    if (action === 'replay') screen.replay();
    if (action === 'reset') kit.resetValues();
  } });
  const unsubscribe = kit.subscribe(({ color, pixels, surface, ...values }) => screen.setParams({ ...values, ...color, ...pixels, ...surface }));
  return () => { unsubscribe();kit.destroy();root.destroy(); };
}
