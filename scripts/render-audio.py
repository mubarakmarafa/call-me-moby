"""Render with Earshot 0.3.0 (925ebe5) on PYTHONPATH. No AI models required.

PYTHONPATH=/path/to/earshot /path/to/venv/bin/python scripts/render-audio.py
Dependencies: numpy scipy soundfile librosa pyloudnorm.
"""
import json
from pathlib import Path
import numpy as np
import soundfile as sf
from earshot.forge import bank, sfx

SR = 48000
OUT = Path(__file__).resolve().parents[1] / 'public' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
report = {}


def take(sound_id, seed=7, **kwargs):
    y, meta = bank.render(sound_id, seed=seed, sr=SR, **kwargs)
    if y.ndim == 2:
        y = y.mean(axis=1)
    return y


def mix(*layers):
    y = np.zeros(max(round(offset * SR) + len(x) for x, offset, gain in layers))
    for x, offset, gain in layers:
        start = round(offset * SR)
        y[start:start + len(x)] += x * gain
    return y


def save(name, y, peak, recipe):
    # Remove inaudible leading/trailing padding, retaining a short natural decay.
    audible = np.flatnonzero(np.abs(y) > max(np.max(np.abs(y)) * 0.001, 1e-7))
    if len(audible):
        y = y[max(0, audible[0] - 96):min(len(y), audible[-1] + 481)]
    fade = min(144, len(y) // 4)
    y[:fade] *= np.linspace(0, 1, fade)
    tail = min(round(.035 * SR), len(y) // 3)
    y[-tail:] *= np.linspace(1, 0, tail) ** 3
    y *= 10 ** (peak / 20) / max(np.max(np.abs(y)), 1e-9)
    audit = sfx.check(y, sr=SR)
    if not audit['ok']:
        raise ValueError(f'{name}: {audit["warnings"]}')
    sf.write(OUT / f'{name}.wav', y, SR, subtype='PCM_16')
    report[name] = {'recipe': recipe, 'duration': round(len(y) / SR, 3), 'peak_dbfs': peak}
    print(name, report[name], flush=True)


for i, seed in enumerate([7, 19, 31], 1):
    save(f'press-{i}', take('fit/click/floss_lid', seed), -17, f'fit/click/floss_lid seed={seed}')
save('tick', take('fit/tick/domino'), -23, 'fit/tick/domino seed=7')
save('power', take('fit/snap/switch_flip'), -15, 'fit/snap/switch_flip seed=7')
save('pickup', take('fit/pop/lip_pop'), -24, 'fit/pop/lip_pop seed=7')
save('snap', mix((take('toggle/latch'), 0, 0.75), (take('fit/hit/bamboo_tok'), .022, .5)), -13, 'toggle/latch + bamboo_tok at 22ms')
save('eject', mix((take('toggle/off'), 0, .7), (take('pluck/kalimba_soft', pitch='G4', dur=.22), .045, .22)), -17, 'toggle/off + short G4 pluck at 45ms')
notes = [('C5', 0, .55), ('G5', .095, .44), ('D6', .19, .32), ('E6', .285, .4)]
layers = [(take('pluck/kalimba_soft', pitch=note, dur=.55), start, gain) for note, start, gain in notes]
# A tiny octave shimmer gives the acoustic motif its handheld-console character.
t = np.arange(round(.23 * SR)) / SR
pixel = np.sin(2*np.pi*1318.51*t) + .16*np.sin(2*np.pi*3955.53*t)
pixel *= (1-np.exp(-t*500))*np.exp(-t*26)
layers.append((pixel, .285, .025))
save('boot', mix(*layers), -18, 'kalimba_soft C5 G5 D6 E6 at 0/95/190/285ms + quiet E6 overtone')
(OUT / 'manifest.json').write_text(json.dumps({'earshot_commit':'925ebe5', 'sample_rate':SR, 'sounds':report}, indent=2)+'\n')
