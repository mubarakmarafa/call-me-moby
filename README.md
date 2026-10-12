# call me moby — Personal Edition

Moby’s interactive portfolio, built around a yellow Game Boy Color and four cartridges: an introduction, Goodnotes Education, a Config talk, and an essay.

## Run locally

```sh
npm install
npm run dev -- --port 4317
```

Open http://127.0.0.1:4317. For a production build, run `npm run build`; `npm run preview` serves the resulting `dist/` folder.

## Try it

1. Click the Game Boy to wake it up.
2. Drag the Moby cartridge onto the console, or click it to load. Click the empty background or press Escape to tuck the waiting cartridge away; click the Game Boy to bring it back.
3. Scroll inside the Game Boy screen to read the introduction. Mouse wheel, trackpad, touch scrolling, and keyboard scrolling use the same native HTML page.
4. Use **Eject cartridge**, or Escape, to return to the cartridge.

Sound is on by default, with a mute toggle. The **Read about Moby** info button opens a direct reading view without requiring the 3D interaction. Reduced-motion preferences shorten the sequence and turn off idle motion.

## Files

- `index.html`: introduction copy and accessible controls.
- `src/main.js`: Three.js scene, materials, cartridge, interaction states and sound.
- `src/style.css`: page and screen styling.
- `src/cartridge.js`: supplied cartridge geometry, replacement label atlas and slot sizing.
- `src/model-parts.js`: removes only the built-in cartridge island from the rendered plastic mesh.
- `src/lcd/`: LCD presets, shaders, DOM capture, rendering lifecycle, and development-only DialKit controls.
- `src/brand.js`: Montreux Jazz wordmark and projected shell sticker.
- `public/fonts/MontreuxJazz-Black.otf`: local font copied from the supplied desktop installation for this unpublished prototype.
- `public/models/game-boy-color.glb`: supplied console source model, unchanged.
- `public/models/gameboy-cartridge.glb`: supplied cartridge source model, unchanged.

The yellow shell uses soft shading bands, restrained highlights and its original ambient-occlusion map. The Moby decal is projected onto the bezel below the LCD, using the locally installed Montreux Jazz Black font with a white die-cut outline. Surrounding copy is removed; utility controls use icons. The background is near-black. The cartridge uses the supplied low-poly model with a Moby label replacing the original artwork in its texture atlas. The LCD contains one scrolling HTML page with two type sizes. A WebGL pixel pipeline processes a snapshot of that HTML; scrolling changes its texture coordinates, preserving native scrolling and links without repeatedly capturing the DOM. Content is an initial draft for Moby to review.

## Model attribution

**Game Boy Color** by **Wikiti**, licensed under **Creative Commons Attribution 4.0**.

- Original: https://sketchfab.com/3d-models/game-boy-color-03c6fe28d45244d2acd55486e3cfee19
- Creator: https://sketchfab.com/wikiti
- License: https://creativecommons.org/licenses/by/4.0/

Adaptations in this prototype: shell recolouring, material/lighting adjustments, replacement screen, removal of the bezel wordmark, and removal of the built-in cartridge. Attribution is also available in the site's footer. Game Boy and Nintendo branding belong to their respective owners.

**Gameboy Cartridge lowpoly** by **Bob**, licensed under **Creative Commons Attribution 4.0**.

- Original: https://sketchfab.com/3d-models/gameboy-cartridge-lowpoly-8b9728eab16c4056ac2636ae7f0f038f
- Creator: https://sketchfab.com/MeBob
- License: https://creativecommons.org/licenses/by/4.0/

Adaptations: replacement Moby label, material adjustments and normalization to fit the console slot. Original geometry, normal map and ambient occlusion are retained. Both supplied GLB files remain unchanged.

## LCD tuning

In development, open the small DialKit button above the bottom-right model credits. Changes and saved versions persist in this browser. **Reset LCD defaults** restores the checked-in settings; **Replay screen build-in** shows the pixel response again. Copy parameters to share a chosen look. The controls and their styles are excluded from production builds.

| Control | What it changes |
| --- | --- |
| Preset | DMG, DMG Real, Pocket, or Light palette and backing |
| Cols | Horizontal pixel count (160–640); rows follow the screen aspect ratio |
| Density | Ink strength |
| Color → Color Strength | Muted source colour for the portrait and emojis; zero returns to monochrome |
| Ghost Strength / Ghost Gate | Pixel response delay and the threshold below which changes snap cleanly |
| Grid Strength / Pixel Size / Gap Gain | Bright gaps between the pixel dots |
| Shadow Opacity / Offset / Blur | The ink layer's offset shadow on its backing |
| Brightness / Contrast / Saturation / Gamma / Black Lift / Off Tint / Warm | Panel colour response |
| Dither / Bleed / Crosstalk / Edge | Four-shade conversion, neighbouring-pixel mixing, and directional leakage |
| Paper / Grain / Gradient / Vignette | Static surface texture and illumination |

The reference is the supplied `lcd-effect-prompt.md`. This integration implements its four-shade conversion, palettes, bright dot gaps, backing shadows, crosstalk, static grain, and asymmetric gamma-space ghosting. It uses the existing Three.js runtime rather than publishing a separate custom-element library. Optional dead-line defects and border masks are not enabled. Without the effect, the native HTML remains readable and scrollable.

The source is captured on content or size changes; scroll frames reuse the texture. Pixel history settles for a bounded time after interaction; it does not run an idle animation. Rendering pauses when hidden or outside the viewport. Reduced motion skips ghosting and the build-in. This is a visual prototype, not a claim of the reference's 2 ms performance target.

DialKit: https://github.com/joshpuckett/dialkit
DOM capture: https://github.com/qq15725/modern-screenshot

## Later

The static `dist/` output can be deployed on Vercel after the design is reviewed and publication is explicitly requested. This project currently has no GitHub remote or hosting connection. The local prototype includes introduction and Goodnotes Education cartridges.

## Iteration log

- 11 October 2026: reduced reflective washout, added softer bands of shading while retaining texture and AO, darkened the background, removed surrounding captions, and moved the Moby wordmark onto the shell as a sticker. Updated the cartridge to use the same wordmark.

- 11 October 2026: identified and hid the original cartridge (1,089 triangles) from the combined Plastic mesh. The supplied GLB is unchanged. Resized the Moby cartridge to the opening and lowered its seated position. A development-only `?inspect-model=back` view shows the empty slot.

- 11 October 2026: replaced the handmade cartridge with the supplied Gameboy Cartridge lowpoly model, added Moby label artwork, retained its moulded details and contacts, and recalibrated the seated position. Added the cartridge creator to the model credits.

- 11 October 2026: added a damped mouse-follow tilt while the console waits, and a magnetic cartridge insertion with a short pull, shared impact and subtle settling motion. The camera makes room for the cartridge during insertion. Sound-on mode uses a short mechanical click; reduced-motion mode omits the tilt and impact recoil.

- 11 October 2026: added background-click and Escape dismissal for the waiting cartridge. It fades and drifts away as the console recentres, and clicking the Game Boy reveals it again. Clicks on the 3D console and utility controls are excluded.

- 11 October 2026: replaced the cartridge label with white callmimoby lettering on black (Montreux Jazz Outline for callmi, Black for moby). Added the locally installed Geist Mono variable font for the LCD and a roughly 200 ms staggered text reveal, skipped with reduced motion. Adjusted type sizes for the monospaced layout and shortened the screen startup wait.

- 11 October 2026: corrected the cartridge label to outlined “call me” on the first line, with solid “moby” and a yellow dot below.

- 11 October 2026: replaced slides with one native scrolling page, “hi there.”, and two type sizes. Added an LCD texture pipeline with layered shadows and ghosting, plus development-only DialKit controls. Removed the old page counters, navigation buttons, and per-page animations.

- 11 October 2026: switched the LCD to locally installed Geist Pixel Square, added a generated pixel-art portrait based on Moby’s supplied photo, and added country flags and a sketch emoji. Source colour now passes through the LCD pixels, shadows, and ghosting; Color Strength in DialKit blends back to monochrome. The page retains native scrolling and two text sizes.

- 11 October 2026: restored Geist Mono on the screen, deepened the DMG ink palette, reduced black lift, and increased contrast. Portrait and emoji colours retain more of their source hue with lighter panel tinting. Pixel texture, layered shadows, scrolling, and ghosting are unchanged.

- 11 October 2026: replaced the pixel-art bust with a soft animated-style floating head generated from the original supplied photo. The cap now has a simple pen-nib symbol; no shirt or lettering. Removed the sketch emoji, retaining only country flags. The portrait uses smooth source rendering and receives pixel texture through the shared LCD effect.

- 11 October 2026: added deliberate background-click ejection from the reading view (clicks on the console and drags are excluded). Replaced the reverse insertion sequence with a 640 ms front-facing camera return and cartridge pop/turn back to its ready position, with an immediate reduced-motion path. Added a black LCD inset with rounded corners and moved the die-cut Moby sticker below the screen, replacing the original bezel wordmark through a material override.

- 11 October 2026: simplified the cartridge label to “hi 👋🏾”, reduced the Moby sticker by one sixth, and added the supplied flame and crystal emblems as die-cut decals. All stickers share a matte, lightly aged paper treatment. Explicit transparent-layer ordering plus normal clearance fixes the bezel covering the sticker during mouse-follow tilt; the power glow remains above the glass. The flame background was removed with built-in image generation; both decal assets live in `public/images/stickers/`.

- 11 October 2026: corrected the browser title to “call me moby”, halved the cartridge greeting, and moved both emblem stickers into an overlapping lower-left cluster following Moby’s annotation. Enlarged both with thicker paper borders; deeper, angled decal projectors follow the left and bottom shell curves. The flame sits above the crystal with separate surface clearance and draw order. A development-only `?inspect-model=left` view reveals the side wrap.

- 11 October 2026: added deterministic paper grain, fine fibres, and subtle edge ageing to the off-white cartridge label. Added small centred LinkedIn and Twitter footer links. The requested Figma icons are pending connector access to node `245:284` in `NGNo1mgkSA85xf34ixdK3j`; the YouTube link is pending a confirmed channel URL. Footer spacing was checked at desktop and 390px widths.

- 11 October 2026: resolved the social-link asset dependency using Moby’s replacement Figma file (`lgWdTyRzIYrEHsRlAAk5Dq`, node `1:38`). Replaced footer text with the supplied LinkedIn and Twitter SVGs and added the YouTube icon linking to `https://www.youtube.com/@MubarakMarafa`. Assets are saved locally at their original dimensions with 44px click targets and accessible labels. Verified desktop/mobile layout, destinations, and production build.


- 11 October 2026: added a second, independently textured Goodnotes Education cartridge with the official wordmark and education-page turquoise (#45bfdb). Both cartridges retain click/drag insertion, background dismissal, and quick ejection. Added a short scrolling project story covering founding design, answer clustering, Generate Hints, reported teacher benefits, and Moby’s Stanford collaboration. Good Future Foundation is described as part of Goodnotes’ wider education work, without claiming Classroom directly created it. Added on-demand in-screen players for the original launch film and Config talk, with external links and playback cleanup on close/eject. Checked switching, drag insertion, playback, and narrow-screen layout.

## Goodnotes Education sources

- [Official education page](https://www.goodnotes.com/learning/education): current K–12 availability, capabilities, wordmark, turquoise hero background, and answer-clustering image. Local assets: `public/images/goodnotes/`.
- [Original launch announcement — 12 August 2024](https://www.goodnotes.com/blog/introducing-goodnotes-classroom): original workflows, teacher-reported benefits, and [launch film](https://www.youtube.com/watch?v=X_L8WtTl10c).
- [Generate Hints guide](https://goodnoteseducation.zendesk.com/hc/en-us/articles/13939190825871-Using-Goodnotes-AI-to-generate-hints-for-students): teacher editing/approval and student support.
- [Good Future Foundation founding interview](https://www.goodfuture.foundation/podcast/steven-chan-and-minh-tran-preparing-students-for-ai-and-new-technologies): research, access, and school training mission. No personal foundation attribution or unverified impact metrics are claimed.
- [Config recording](https://www.youtube.com/watch?v=fLF8dwbC74o): “Human methods, new material: AI for the classroom” with Mubarak Marafa and Wendy Liao. The embedded player’s title was verified.
- Personal role details draw on the existing approved career materials. Moby directly confirmed the work with Stanford professors on responsible classroom AI in this conversation.

Video is rendered by YouTube’s native player inside the screen, not sampled through the LCD shader. The surrounding article retains the LCD treatment; case-study images are rendered as clear native images above it. Players are only mounted on request and are removed when closed or ejected.

- 11 October 2026: recoloured the introduction cartridge golden orange and the Education cartridge blue, preserving the model’s surface shading, screw and electrical contacts. Both use aged off-white labels; Education now has a larger official wordmark, a thin warm-grey border and larger type underneath. Visually reviewed under the scene lighting; production build passed.

- 11 October 2026: replaced the Education cartridge label with Moby’s supplied turquoise loop artwork and stacked Goodnotes Classroom logo. Both original PNGs are stored locally; the background fills the label and the logo keeps its proportions. Removed the previous label border and additional “education” text. The blue shell and intro cartridge remain unchanged. Visually verified and built successfully.


- 11 October 2026: changed the foundation link to `https://www.goodfuture.foundation/`. Images now bypass the LCD pipeline by default: the text snapshot retains each image’s layout space, while an inert, accessible-hidden native image layer follows the same scroll position and screen clipping. New case-study images inherit this behavior. `data-lcd-effect` opts an image back into the effect; the existing intro portrait uses it. Verified desktop/mobile alignment, scrolling, and cartridge switching; production build passed.

- 11 October 2026: added six original Bett 2026 booth illustrations in a horizontal gallery after the AI feature descriptions. Transparent PNGs come from the supplied [Wall B Figma artwork](https://www.figma.com/design/wlW1i4o01rTTTyxeiCIkxP/Bett-booth-2026?node-id=96-1754): learning `144:10916`, personalise `144:10325`, admin `144:9608`, AI `457:2991`, freeform `144:11723`, and impact `144:11918`. Isolated renders preserve the original artwork, shadows and transparent edges at 1400px width. Extended the clear-image layer to clip and track nested horizontal galleries without applying LCD processing to the artwork. Verified horizontal gestures, keyboard scrolling, mobile proportions, asset loading and production build. Everything remains local.

- 11 October 2026: scattered the orange and Goodnotes cartridges to opposite sides with individual angles and staggered heights. They now enter and dismiss toward their nearest screen edge; the Game Boy stays centred and moves closer in its ready state. Narrow screens use a diagonal arrangement. Ejection and missed drops preserve each cartridge’s home pose. Cancelled competing drag rotation when returning from a missed drop. Checked insertion, return, dismissal, desktop/mobile presentation and production build.

- 12 October 2026: gave each cartridge a separate bobbing speed, amplitude, phase and gentle sway. Mouse hover adds a small forward lift and tilt with stable hit areas; dragging picks up from the lifted depth. Motion remains off under reduced-motion preferences and hover is limited to mouse input. Visually checked both hover states and insertion/ejection; production build passed.

- 12 October 2026: added subtle cursor-relative pitch and yaw to cartridge hover (up to roughly 6–7 degrees). The tilt eases back when the pointer leaves, uses each cartridge’s stable hit area, and pauses during dragging and scene transitions. Existing bobbing and forward lift remain. Disabled for touch and reduced-motion preferences; build and hover presentation checked.

- 12 October 2026: replaced the harsh key/fill directional lights with broad area lights, reduced rim intensity, softened the shell shading transitions and increased bezel roughness. Power LED now uses a shaded red lens with tone mapping disabled so it stays red, plus a smaller, quieter red halo and dark red off state. Reviewed the full object and close-up reading view; production build passed.

- 12 October 2026: retuned the shell to the warmer, saturated golden yellow in Moby’s supplied Pokémon Pinball Game Boy photo. Compared sampled midtones from the photo against rendered previews, compensated for filmic desaturation and gave the plastic a slightly more satin finish. Retained soft lighting, surface texture and ambient occlusion. Visually reviewed; production build passed.

- 12 October 2026: the console now retreats immediately on cartridge pickup and turns into a slightly tilted receiving pose once dragging begins. Disabled idle gaze/bobbing while holding a cartridge. Insertion first clears the top of the shell in the foreground, then moves back to slot depth; the console returns forward after seating. Adjusted approach framing to keep the raised cartridge visible. Checked drag insertion, loaded screen, ejection and missed-drop recovery; production build passed.

- 12 October 2026: added a proximity-weighted magnetic pull toward the projected cartridge slot while dragging, with a release cue and a generous, reversible capture zone. Rechecks the pointer on release to avoid stale snap state. Ejection now detaches into world space, rises vertically as the Game Boy dips down/back, then follows an elevated outward arc before the console returns forward. Checked slot drops and ejection; sampled the return arc against conservative model bounds at desktop and narrow-screen home positions with no intersections. Production build passed.

- 12 October 2026: enabled sound by default, with the existing mute toggle retained. Tuned the insertion contact into a quiet click and added a softer, lower-pass noise/sine pop at the start of ejection. Audio starts through the user's first interaction. Checked insertion, ejection and mute/unmute in the browser with no audio errors; production build passed.

- 12 October 2026: added a small centred “drop a cartridge in” note in light Geist Mono on the black screen while waiting for a cartridge. It follows the actual screen geometry, includes subtle scanlines, disappears during insertion and returns after ejection. Visually checked waiting/reading/ejected states; production build passed.

- 12 October 2026: the boot screen now reuses the sticker's wordmark artwork, matching its Montreux Jazz Black lettering, proportions, cream outline and yellow dot. Removed the separate Geist Mono boot logo. Verified the boot animation visually and the production build passed.

- 12 October 2026: removed the boot logo's paper outline and routed the wordmark and progress animation through the same LCD quantization, colour, texture, shadow and temporal ghosting passes as the article. Kept the Montreux Jazz Black lettering and yellow dot, now on the display's lit LCD background. Case-study images still bypass processing. Verified boot rendering, transition into the article and ejection; production build passed.

- 12 October 2026: added a muted-red Config talk cartridge with the original YouTube thumbnail for `fLF8dwbC74o`, kept uncropped on its lavender label. It floats independently at the lower right and shares magnetic insertion/ejection. Inserting opens the clear native YouTube player directly, with no case-study page or back button; ejection removes the iframe and stops playback. Confirmed embedded playback, all three selectable cartridges and player cleanup; production build passed. Thumbnail source: https://i.ytimg.com/vi/fLF8dwbC74o/maxresdefault.jpg.

- 12 October 2026: replaced Config cover art with Moby's supplied speaker-badge photo. Reduced floating cartridges and their hit areas to 80%, preserving their fitted insertion size. Followed the annotated arrangement: Config upper left, Goodnotes lower left, intro lower right; added the World-building article upper right with the model's original untinted grey shell. Its screen shows the original article hero, a concise summary and an external full-article link. Verified drag insertion, clear hero rendering, scrolling, link destination and return to the smaller home size. Production build passed.
  - Article and summary source: https://mdesign.substack.com/p/agentic-product-design-is-world-building
  - Original hero: https://substack-post-media.s3.amazonaws.com/public/images/1fac904f-c26d-41e9-956f-3b684e1b904f_1672x941.png

- 12 October 2026: nudged Classroom up/right and Config left; swapped intro and article positions and lowered the right-hand pair. Added cached, two-line screen descriptions on cartridge hover and keyboard focus, keeping the default drag prompt otherwise. Replaced the article cover and page hero with Moby's supplied Pokémon image. Visually checked layout and hover descriptions; build passed.

- 12 October 2026: rebuilt the CV as a two-page, selectable-text PDF at `public/cv/mubarak-marafa-cv.pdf`, with editable generation source in `scripts/build-cv.py`. Content combines the supplied Figma CV (My Playground, section 14:189), approved October career/profile notes, and this portfolio conversation; leads with the current Good Systems role and concrete Goodnotes contributions. Added a Montreux Jazz Black “cv” footer link with yellow hover and a new-tab PDF destination. Verified both rendered PDF pages, PDF text/links, the new browser tab and all authored website anchor targets; production build passed. Original Figma source is unchanged; everything remains local.

- 13 October 2026: replaced nested CSS 3D screen positioning with a single transform derived from the WebGL camera, keeping the HTML/LCD surface aligned with the console. Both layers now use the stage dimensions and react to stage resizing. Projection regression checks cover portrait, landscape, desktop, tilted planes, corners and interior points; production build passed. Local browser review was blocked by browser-tool policy; Safari iOS device confirmation remains outstanding.

- 13 October 2026: the console eases behind the cartridges on narrow/touch layouts, with a deeper receiving pose during drag. Added opt-in device-orientation parallax with a phone control beside sound, permission handling, calibration, orientation-aware axes, clamped smoothing, reduced-motion support, and stationary reading/dragging targets. Cartridge hit areas follow their actual positions. Projection/tilt tests and build pass; model bounding boxes retain positive depth clearance at ready-state tilt limits. Physical mobile sensor and visual review remain outstanding.
