# Pocket sound palette

Nine mono 48 kHz / 16-bit WAVs, generated with Earshot 0.3.0 at commit
925ebe5. Runtime playback lives in src/audio.js; cues are attached in src/main.js.
The site uses only these rendered files, not Python or AI models.

- Three plastic button takes rotate; B is slightly lower, the D-pad higher.
- Cartridge selection and pickup change pitch by cartridge.
- Insertion combines a latch and a body knock 22 ms later.
- Ejection combines a switch release with a short G4 pluck.
- Boot plays C5, G5, D6, E6 with a quiet electronic overtone.

scripts/render-audio.py records the complete recipe. Put the pinned Earshot
checkout on PYTHONPATH and run with a Python environment containing numpy,
scipy, soundfile, librosa and pyloudnorm. Rendering requires no downloaded models.
Every final passes Earshot's model-free SFX audit; levels are intentionally quiet
and the browser applies an additional master gain of 0.65.

EARSHOT-LICENSE.txt contains the upstream MIT notice. EARSHOT-SOURCES.md retains
upstream credits for the CC0 recordings used by the fitted recipes. manifest.json
records the sources, timings and peak levels for this palette.
