# Audio Architecture -- Borchard Labs Game Engine

**Author:** Audio Systems Research, Phase 0
**Date:** 2026-04-28
**Status:** Research complete -- pending Phase 1 synthesis

---

## Executive Summary

The Borchard Labs audio system is built on two complementary layers: Howler.js owns
non-positional audio (music, ambience beds, UI sounds, voice), and Three.js
PositionalAudio owns in-world sources whose location in the scene matters (stream
babble near the creek, a bird call emanating from a specific tree, footstep foley
tied to the player capsule). These two layers share the same Web Audio `AudioContext`
and connect through a bus graph of six `GainNode` chains (master, music, ambience,
SFX, UI, voice) that are exposed to a Zustand settings store and driven live by the
settings menu. Adaptive ambience crossfading is handled by a lightweight state machine
that watches `WeatherSystem` output and player location, linearly blending gain values
across layers rather than triggering hard cuts. Tone.js is deferred to a single
concrete stretch-goal case (Hardy-Weinberg allele drift sonification) and must not be
imported in any experiment that does not use it. The riskiest single dependency is
browser HRTF support for VR binaural rendering: on 2026-04-28, Safari still lacks the
`AudioWorklet`-based HRTF convolution pipeline needed for convincing binaural output,
and the Web Audio `PannerNode` HRTF implementation quality varies significantly
across browsers and headsets.

---

## 1. Audio Pipeline -- Howler vs PositionalAudio Decision Rule

### The two layers

**Howler.js** handles:
- Music tracks (composed underscore, biome theme loops)
- Full-mix ambience beds loaded as stereo audio sprites
- UI sounds (button clicks, notification pings, tab switches, notebook paper rustle)
- Voice-over narration and field guide audio
- Any looping sound that does not need a position in 3D space

**Three.js PositionalAudio** handles:
- In-world point sources that must respect listener distance and direction
- Stream babble (attached to a stream mesh or StreamEmitter entity)
- Animal vocalizations that originate from a specific creature position
- Footstep foley (attached to the player capsule, or emitted from the foot-strike ray)
- Object interaction sounds: rock scrape, log roll, wet soil squelch (attached to
  the cover-object mesh during the interaction tween)
- Insect ambience in a tight radius around the camera (attached to a near-zero-distance
  emitter node that rides with the player -- effectively positional but always close)

### Concrete decision rule

Ask: "Does the perceived direction and distance of this sound carry meaningful
information to the listener?"

- Yes --> Three.js PositionalAudio with a `PannerNode` in `HRTF` mode.
- No --> Howler.js routed through the appropriate bus.

If you are unsure, default to Howler. Positional audio is more expensive (each
PositionalAudio node owns a `PannerNode` and an `AudioBufferSourceNode`) and the
added realism only pays off when the source actually moves relative to the listener.

### Shared AudioContext

Both Howler and Three.js AudioListener can share the same Web Audio `AudioContext`.
Howler exposes `Howler.ctx` after the first interaction unlock. Three.js exposes its
context via `renderer.xr.getSession()?.audioContext` or through
`AudioListener.context`. At engine init, construct the context once and pass it to
both:

```ts
// engine/audio/AudioBus.ts -- init sequence (pseudocode)
const ctx = new AudioContext();
Howler.ctx = ctx;               // Howler accepts an external context
audioListener.context = ctx;    // THREE.AudioListener uses the same context
```

This ensures every node in both libraries routes through the same destination and
the bus graph described in section 2 sits cleanly in the path.

---

## 2. Audio Bus Architecture

### Bus graph

Six buses. Each bus is a Web Audio `GainNode`. All buses feed a master `GainNode`
that connects to `ctx.destination`.

```
ctx.destination
    |
  [master GainNode]
    |--[music GainNode]
    |--[ambience GainNode]
    |--[sfx GainNode]
    |--[ui GainNode]
    |--[voice GainNode]
    |--[spatial GainNode]  <-- Three.js PositionalAudio sources connect here
```

The "spatial" bus differs from the others: it exists as a real `GainNode` inserted
between the Three.js AudioListener destination and the master bus. Three.js normally
connects `PositionalAudio` directly to the listener's gain node; intercept this by
providing a custom destination gain node to the listener.

### Per-bus volume and muting

Each bus node has a `gain.value` in the range 0.0 to 1.0. The settings store
(Zustand) holds:

```ts
interface AudioSettings {
  masterVolume: number;   // 0.0 - 1.0
  musicVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  uiVolume: number;
  voiceVolume: number;
  spatialVolume: number;
  muteOnTabBlur: boolean;
  duckOnNotebookOpen: boolean;
  duckLevel: number;       // 0.0 - 1.0, default 0.3
}
```

The bus module subscribes to the store and sets `gainNode.gain.setTargetAtTime(value, ctx.currentTime, 0.05)` on every change. The 50ms smoothing constant prevents audible clicks when the user drags a slider.

### Ducking

When the field notebook opens, the ambience, sfx, and spatial buses duck to
`duckLevel` (default 0.3) using a ramp:

```ts
gainNode.gain.linearRampToValueAtTime(
  duckLevel * busVolume, ctx.currentTime + 0.3
);
```

Restore on notebook close with a 0.5s ramp back to full bus volume. Music and voice
are not ducked -- the music continues to provide emotional grounding while the
student reads.

### Mute on tab blur

When `document.addEventListener('visibilitychange')` fires with
`document.hidden === true`, ramp master gain to 0 over 0.2s. On return, ramp back to
stored master volume over 0.4s. This prevents the experiment from blasting audio
into a background tab. Controlled by the `muteOnTabBlur` toggle in settings.

---

## 3. Adaptive Audio -- Ambience Crossfading State Machine

### Design reference: Subnautica biome audio

Subnautica blends biome ambient layers based on the player's bounding sphere
intersection with biome zones. Each zone registers a set of audio layers (creature
calls, environmental textures, music stems). As the player crosses a zone boundary,
the old zone's layers fade out and the new zone's layers fade in over a configurable
crossfade window (typically 3-8 seconds). Layers can also be gated by time of day
and weather so a single zone sounds different at dawn vs midday.

### Borchard Labs state machine

The weather driver is `WeatherSystem.getCurrentConditions()`. The location driver is
the player's XZ position relative to named environment zones defined in the scene
manifest.

```
States (ambience FSM):
  CLEAR_DRY
  CLEAR_HUMID
  OVERCAST
  LIGHT_RAIN
  HEAVY_RAIN
  FOG_MIST

Zones (spatial FSM, per experiment scene):
  DEEP_FOREST
  FOREST_EDGE
  STREAM_CORRIDOR
  OPEN_GLADE
```

Each `(state, zone)` pair maps to a set of layer gains. For example:

```ts
// Ambience layer gains for (LIGHT_RAIN, STREAM_CORRIDOR):
{
  forestBed: 0.4,       // broad-spectrum forest ambience
  streamBabble: 0.9,    // stream is loud when rain raises it
  rainOnLeaves: 0.7,    // gentle pattering texture
  birdsong: 0.1,        // birds mostly quiet in light rain
  windInCanopy: 0.3,
  insectChorus: 0.0,
}
```

### Crossfade implementation

Each layer is a Howler sprite or a looping `Howl` instance playing through the
ambience bus. On a state transition, compute the delta gains for every active layer
and apply them as `Howl.fade(from, to, durationMs)` calls. Use a default crossfade
of 4000ms for weather transitions and 2000ms for zone transitions (zone transitions
are faster because player movement causes them and a lagging audio bed sounds wrong).

```ts
// AudioAdaptiveManager.ts -- simplified
function transitionLayers(current: LayerGains, target: LayerGains, durationMs: number) {
  for (const [layerId, targetGain] of Object.entries(target)) {
    const sound = layerPool.get(layerId);
    const currentGain = current[layerId] ?? 0;
    if (currentGain === 0 && targetGain > 0) {
      sound.play();
      sound.fade(0, targetGain * ambienceBusGain, durationMs);
    } else if (targetGain === 0 && currentGain > 0) {
      sound.fade(currentGain * ambienceBusGain, 0, durationMs, () => sound.stop());
    } else {
      sound.fade(currentGain * ambienceBusGain, targetGain * ambienceBusGain, durationMs);
    }
  }
}
```

### WeatherSystem integration

The audio manager polls `WeatherSystem.getCurrentConditions()` on the same tick as
the simulation update, but it applies no state to simulation logic -- it only reads.
The weather FSM state is derived:

```ts
function weatherToAudioState(conditions: WeatherConditions): AmbienceState {
  if (conditions.weather === 'heavyRain') return 'HEAVY_RAIN';
  if (conditions.weather === 'lightRain') return 'LIGHT_RAIN';
  if (conditions.weather === 'fogMist')   return 'FOG_MIST';
  if (conditions.weather === 'overcast')  return 'OVERCAST';
  if (conditions.humidity > 80)          return 'CLEAR_HUMID';
  return 'CLEAR_DRY';
}
```

Transitions are checked once per second (not per frame). If both the weather state
and zone have changed since the last check, apply the zone transition first (faster),
then the weather transition.

### Positional stream blending

The stream babble is a Three.js PositionalAudio source. As the player approaches the
stream zone boundary, the PositionalAudio distance model (`refDistance`, `maxDistance`,
`rolloffFactor`) handles the spatial fade automatically. The Howler ambience layer
version of the stream (used for weather-blend purposes) runs in parallel at low gain
when the player is near the stream, transitioning cleanly to the spatial source when
within the PositionalAudio's effective range. The two are never simultaneously loud:
the Howler stream layer's target gain in the matrix is set to 0 when the player is
within `STREAM_POSITIONAL_RADIUS` meters of the stream emitter.

---

## 4. Source Library

All sources in this table are usable under CC0 or equivalent "no rights reserved"
terms. Always verify the license on individual assets at download time -- Freesound
licenses can differ per file even within the same query.

| # | Category | Asset Name / Description | Source URL | License | Suggested Use |
|---|----------|--------------------------|------------|---------|---------------|
| 1 | Ambience | "Forest Ambience Spring Morning" -- dense bird chorus, light wind | https://freesound.org/people/felix.blume/sounds/217506/ | CC0 | CLEAR_DRY, DEEP_FOREST base layer |
| 2 | Ambience | "Deciduous Forest Summer Ambience" -- mid-day insect drone + birds | https://freesound.org/people/Inspectorj/sounds/397744/ | CC0 | CLEAR_DRY, FOREST_EDGE, DEEP_FOREST |
| 3 | Ambience | "Forest Rain On Leaves Medium" -- sustained gentle pattering | https://freesound.org/people/Taira_Komori/sounds/215200/ | CC0 | LIGHT_RAIN layer across all zones |
| 4 | Ambience | "Heavy Forest Rain" -- dense rain, stream runoff sounds | https://freesound.org/people/luffy/sounds/432568/ | CC0 | HEAVY_RAIN layer, STREAM_CORRIDOR |
| 5 | Ambience | "Morning Fog Forest" -- low diffuse tone, minimal bird activity | https://freesound.org/people/inchadney/sounds/90507/ | CC0 | FOG_MIST base layer |
| 6 | Ambience | "Stream Babble Small Creek" -- constant, clear mountain stream | https://freesound.org/people/Pfannkuchen/sounds/264660/ | CC0 | STREAM_CORRIDOR positional source |
| 7 | Ambience | "Wind Through Deciduous Canopy" -- rhythmic sway, leaf rustle | https://freesound.org/people/kvgarlic/sounds/156321/ | CC0 | Canopy wind layer, scales with windSpeed |
| 8 | Animal Calls | "Wood Thrush Song" -- clear flute-like phrases | https://freesound.org/people/vonfranke/sounds/233973/ | CC0 | Dawn and morning, DEEP_FOREST zone |
| 9 | Animal Calls | "Ovenbird Song -- teacher-teacher" -- classic Appalachian call | https://freesound.org/people/stomachache/sounds/61012/ | CC0 | Spring forest, complements survey audio |
| 10 | Animal Calls | "American Toad Trill" -- extended spring breeding call | https://freesound.org/people/juskiddink/sounds/78955/ | CC0 | STREAM_CORRIDOR, CLEAR_HUMID, spring months |
| 11 | Animal Calls | "Cricket Chorus Night" -- dense insect ambience | https://freesound.org/people/Robinhood76/sounds/64282/ | CC0 | Warm evening CLEAR_DRY layer |
| 12 | Foley | "Rock Scrape On Ground" -- stone dragged on soil | https://freesound.org/people/adam.n/sounds/346985/ | CC0 | Cover-object lift SFX (rock variant) |
| 13 | Foley | "Wet Soil Squelch" -- moist earth disturbed underfoot | https://freesound.org/people/Breviceps/sounds/449587/ | CC0 | Soil reveal after cover object lift |
| 14 | Foley | "Dry Leaf Crunch Footstep" -- single crunch on leaf litter | https://freesound.org/people/ecfike/sounds/135125/ | CC0 | Footstep foley, forest floor surface |
| 15 | Foley | "Log Roll On Forest Floor" -- low wooden thud and roll | https://freesound.org/people/Jamius/sounds/162450/ | CC0 | Cover-object lift SFX (log variant) |
| 16 | Foley | "Old Wood Board Lift" -- creak, strain, dull thud | https://freesound.org/people/RHumphries/sounds/10880/ | CC0 | Cover-object lift SFX (board variant) |
| 17 | UI | "Soft Paper Page Turn" -- gentle notebook page flip | https://freesound.org/people/Jplenio/sounds/240740/ | CC0 | Field notebook open/close, data entry |
| 18 | UI | "Subtle Click -- Low Resonance" -- muted mechanical click | https://freesound.org/people/kwahmah_02/sounds/250719/ | CC0 | Button interactions, menu navigation |
| 19 | UI | "Notification Chime -- Natural" -- woodblock-adjacent short tone | https://freesound.org/people/ricemaster/sounds/220174/ | CC0 | Achievement, data recorded confirmation |
| 20 | Weather | "Distant Thunder Roll -- Appalachian" -- low rumble, no crack | https://freesound.org/people/inchadney/sounds/31765/ | CC0 | HEAVY_RAIN stochastic one-shot |
| 21 | Weather | "Wind Gust Through Forest" -- brief 4s rush of air | https://freesound.org/people/florianreichelt/sounds/460571/ | CC0 | Triggered stochastically at high windSpeed |

### Additional pack-level sources

- **BBC Sound Effects Library (RemAster series):** Available at
  https://sound-effects.bbcrewind.co.uk/ under the BBC RE-Use licence (non-commercial
  free for qualifying uses). The Appalachian field recordings and UK woodland packs
  are the highest quality ambient beds in the public catalogue. Verify non-commercial
  terms match the project's status before use.
- **Kenney.nl UI Audio Pack 1:** https://kenney.nl/assets/ui-audio -- CC0, 30 clean UI
  sounds. Excellent starting point for the UI bus before custom foley is recorded.
- **Freesound Packs by Inspectorj:** https://freesound.org/people/Inspectorj/ -- entire
  library is CC0, professionally recorded, covers footsteps (multiple surfaces),
  water, leaves, and nature ambience at high quality.

---

## 5. Compression -- Formats, Fallbacks, and File Size Budgets

### Format decision

**Opus** is the primary format for all non-music audio. It delivers better quality
per kilobyte than MP3 or Ogg Vorbis at low bitrates, has excellent browser support
in Chrome, Firefox, and Edge as of 2026, and decodes efficiently on main thread.

**AAC in a CAF or M4A container** is the Safari/iOS fallback. Howler.js handles the
format negotiation automatically via the `format` array in the `Howl` constructor:

```ts
new Howl({
  src: ['sounds/stream.opus', 'sounds/stream.m4a'],
  loop: true,
  html5: false,  // decode to AudioBuffer for low-latency playback
})
```

**OGG Vorbis** is a legacy fallback -- do not add it to new assets. The Opus codec
inside an OGG container (`audio/ogg; codecs=opus`) is supported everywhere OGG
Vorbis was supported, so a separate Vorbis encode is unnecessary.

Music tracks use Opus at a higher bitrate (96 kbps) because they span the full
auditory spectrum. Ambience loops use 48-64 kbps; the texture content of natural
soundscapes is well-preserved at 48 kbps with Opus.

### Encoding settings

```bash
# Ambience beds (mono or stereo-mid/side)
ffmpeg -i input.wav -c:a libopus -b:a 48k -application audio output.opus

# Music (stereo)
ffmpeg -i input.wav -c:a libopus -b:a 96k -application audio output.opus

# Short SFX (foley, UI)
ffmpeg -i input.wav -c:a libopus -b:a 32k -application audio output.opus

# AAC fallback (all categories)
ffmpeg -i input.wav -c:a aac -b:a 96k output.m4a
```

For positional audio sources (PositionalAudio), always decode to an `AudioBuffer`
(not HTML5 streaming) so the position/distance calculations update every frame
without async gaps.

### Compression targets table

| Category | Format | Bitrate | Max Duration | Target File Size | Notes |
|----------|--------|---------|--------------|------------------|-------|
| Ambience bed (loop) | Opus | 48 kbps | 60 s | <= 360 KB | Stereo, crossfade-looped |
| Music track | Opus | 96 kbps | 3 min | <= 2.2 MB | Stereo, gapless loop |
| Positional ambience (stream, etc.) | Opus | 48 kbps | 30 s | <= 180 KB | Mono or M/S stereo |
| Foley SFX | Opus | 32 kbps | 4 s | <= 16 KB | Mono preferred |
| UI sound | Opus | 32 kbps | 1 s | <= 4 KB | Mono, decoded to buffer |
| Animal call | Opus | 32 kbps | 8 s | <= 32 KB | Mono |
| Weather one-shot | Opus | 48 kbps | 10 s | <= 60 KB | Stereo for thunder roll |
| Voice / narration | Opus | 64 kbps | per line | ~48 KB/5s | Mono, decoded to buffer |
| Music (Safari fallback) | AAC | 96 kbps | 3 min | <= 2.2 MB | M4A container |
| SFX (Safari fallback) | AAC | 48 kbps | 4 s | <= 24 KB | CAF or M4A container |

### Total audio budget per experiment

- Baseline audio (preloaded): ambience beds + UI sounds + 4 foley SFX: 1.5 MB
- Lazy-loaded audio (loaded as zones are entered): additional positional sources,
  animal calls, weather variants: 2.5 MB
- Music (optional, user opt-in or autoplay after interaction): 2.2 MB
- **Grand total per experiment (all audio): ~6.2 MB**

This comfortably fits within the overall experiment asset budget defined by Phase 0
Agent 5 (total experiment under 50 MB, initial load under 2 MB; audio initial load
should be under 1.5 MB to leave headroom for geometry and textures).

---

## 6. Procedural Audio -- When to Use Tone.js

### Default stance

Tone.js is deferred. Do not import it in any experiment that does not explicitly
require synthesis. The library is ~200 KB gzipped and adds meaningful startup overhead.
Howler and PositionalAudio cover 100% of the Batesian Mimicry and current
Hardy-Weinberg requirements using pre-recorded samples.

### Concrete stretch-goal use case: Hardy-Weinberg allele drift sonification

Hardy-Weinberg tracks per-generation allele frequencies for two or more alleles
across hundreds of generations. The simulation produces a time-series of `p` and `q`
values. This data maps naturally to a synthesized harmonic soundscape:

- Each allele is assigned a fundamental pitch. Two-allele systems: allele A = 220 Hz
  (A3), allele a = 330 Hz (E4) -- a perfect fifth, consonant when both alleles are
  present near 0.5 frequency.
- The gain of each oscillator tracks the allele's current frequency in the population
  (high-frequency allele = louder tone).
- As drift causes fixation (one allele reaching 1.0), its oscillator swells to full
  volume while the other fades to silence. The student hears the "last note" of
  fixation.
- A subtle reverb tail (Tone.js `Reverb`) models the size of the "population space"
  -- smaller populations (higher drift) have a drier, more intimate room; large
  populations have a longer, more diffuse tail.
- Mutation events (if enabled) trigger a brief dissonant sting (detuned oscillator
  that resolves back).

Implementation sketch (Tone.js):

```ts
import * as Tone from 'tone';

const oscillatorA = new Tone.Oscillator(220, 'sine').toDestination();
const oscillatorB = new Tone.Oscillator(330, 'sine').toDestination();
const reverb = new Tone.Reverb({ decay: 4, preDelay: 0.1 }).toDestination();

oscillatorA.connect(reverb);
oscillatorB.connect(reverb);

// Called each simulation tick:
function updateAlleleAudio(p: number, q: number) {
  oscillatorA.volume.rampTo(Tone.gainToDb(p * 0.7), 0.2);
  oscillatorB.volume.rampTo(Tone.gainToDb(q * 0.7), 0.2);
}
```

This use case justifies the Tone.js dependency because no pre-recorded sample can
represent an arbitrary, continuous parameter curve. Dynamic parameter mapping IS the
sound design, which is synthesis by definition. Gate the import:

```ts
// Only loaded if the experiment config requests it
if (experimentConfig.audio?.procedural) {
  const { initProceduralAudio } = await import('./audio/ProceduralAudio.ts');
}
```

### Other synthesis candidates (lower priority)

- Tidal cycle audio in the Tide Pool experiment: sine-wave swell representing tidal
  height, pitch-mapped to coverage level. Low complexity, meaningful feedback.
- Thermal Biology: body temperature mapped to a low-frequency drone -- warmer
  temperatures tighten the interval, colder temperatures detune it. Signals
  temperature range stress zones to the student non-visually.

---

## 7. VR Spatial Audio -- HRTF, Room Reverb, and Browser Reality

### Web Audio PannerNode and HRTF

Web Audio's `PannerNode` offers two panning models: `equalpower` and `HRTF`.
The HRTF model applies a head-related transfer function to model the acoustic cues
that the human auditory system uses to perceive direction -- inter-aural time
differences, inter-aural level differences, and spectral shaping from ear canal
geometry (pinnae filtering).

Three.js `PositionalAudio` wraps a `PannerNode` and defaults to the `equalpower`
model. To enable HRTF:

```ts
const sound = new THREE.PositionalAudio(listener);
sound.panner.panningModel = 'HRTF';
sound.panner.distanceModel = 'inverse';
sound.panner.refDistance = 1;
sound.panner.maxDistance = 30;
sound.panner.rolloffFactor = 1.5;
```

### Browser HRTF support reality on 2026-04-28

| Browser / Platform | HRTF Model | Quality | Notes |
|--------------------|------------|---------|-------|
| Chrome 124+ (desktop, Android) | Built-in HRTF | Good | Uses a 44-HRIR dataset. Adequate for gaming, not audiophile. |
| Firefox 125+ | Built-in HRTF | Moderate | Different HRIR dataset, slightly less precise. |
| Edge 124+ | Chromium HRTF | Good | Identical to Chrome. |
| Safari 17.5+ (macOS, iOS 17.5+) | `equalpower` fallback | Poor | Safari does not implement the `HRTF` panningModel via AudioWorklet. Setting `panningModel = 'HRTF'` silently falls back to `equalpower`. No binaural effect. |
| Meta Quest Browser (v33+) | Built-in HRTF | Good | Quest's browser inherits the Chromium HRTF implementation. In WebXR sessions the audio context is shared with the OS spatial audio stack. |
| Vision Pro (visionOS 2.x, Safari) | OS-level spatial audio | Good | Applies OS HRTF via the audio hardware path, not Web Audio. The result is good, but it bypasses the Web Audio HRTF setting. |

**Safari caveat:** As of visionOS 2.x / Safari 17.5, Apple routes WebXR audio
through the OS spatial audio system on VR hardware, which produces a reasonable
binaural result even though the Web Audio HRTF panningModel is not supported. On
desktop Safari, there is no fallback: sources are panned with `equalpower` only.
Designing for this means the `equalpower` mix must still be directionally legible
(e.g., stream clearly to the left before crossing the creek), not only the HRTF mix.

**Recommendation:** Set `panningModel = 'HRTF'` for all in-world positional sources.
The fallback to `equalpower` in Safari is acceptable because the desktop-Safari user
is not in VR. VR users on Quest will get proper HRTF. Design mixes to be directionally
clear at both panning quality levels.

### Room reverb

Web Audio's `ConvolverNode` with a measured impulse response (IR) provides room
acoustic simulation. Poly Haven publishes CC0 IR packs for outdoor spaces; the
forest IR from a deciduous environment is appropriate for the Batesian Mimicry scene.
Route positional sources and the spatial bus through a `ConvolverNode`:

```
PositionalAudio --> spatial bus GainNode --> ConvolverNode --> master GainNode
```

For VR, keep the IR short (< 0.8s tail) to avoid the "underwater" smearing effect
that long reverbs produce on HRTF-panned sources. A single ConvolverNode shared
across all spatial sources is an acceptable approximation -- per-source convolution
is prohibitively expensive in a browser WebGL frame.

### Binaural rendering libraries (optional research path)

**Resonance Audio** (Google, Apache 2.0): A higher-fidelity ambisonics-based spatial
audio library. Supports first and second-order ambisonics encoding, room simulation
with material absorption, and HRTF rendering. Integration: sources send audio to
a `ResonanceAudio` scene, the scene renders a binaural stereo stream routed to
`ctx.destination`. It does not replace Three.js PositionalAudio; it replaces the
`PannerNode` inside each source.

Recommendation: use native Web Audio HRTF for the initial implementation. Flag
Resonance Audio as a Phase 7 upgrade if audio quality becomes a differentiating
concern in VR mode.

### AudioWorklet notes

Custom HRTF convolution via AudioWorklet is possible but not recommended for initial
implementation. AudioWorklet processing runs on the audio thread at 128-sample blocks,
and convolving with a full HRTF dataset per-source per-block is too expensive at
60+ sources. Reserve AudioWorklet for lightweight custom processors (e.g., a low-pass
filter tied to occlusion detection) if needed.

---

## 8. Audio Settings UI Surfaces

The settings menu (Phase 2, Team 2B1) exposes the following audio controls:

### Master section

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Master Volume | Slider 0-100 | 80 | Maps to master GainNode |
| Mute | Toggle | Off | Zero the master gain; preserves per-bus values |

### Per-bus section

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Music Volume | Slider 0-100 | 70 | |
| Ambience Volume | Slider 0-100 | 85 | |
| SFX Volume | Slider 0-100 | 80 | |
| UI Sounds | Slider 0-100 | 60 | |
| Voice Volume | Slider 0-100 | 90 | |
| Spatial Audio | Slider 0-100 | 80 | |

### Behavior section

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Mute when tab is hidden | Toggle | On | `visibilitychange` handler |
| Duck audio when notebook opens | Toggle | On | Ambience/SFX drop to 30% |
| Duck level | Slider 5-80 | 30 | Only visible when duck toggle is on |

### Accessibility section

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Audio Subtitles (Closed Captions) | Toggle | Off | See section 9 |
| Subtitle font size | Select | Medium | Small / Medium / Large |

### Implementation in Zustand

The settings store from Phase 2 Team 2B1 persists these values via localforage.
On cold load, restore persisted values before the AudioContext is created. The audio
bus module subscribes with `store.subscribe(state => state.audio, applyBusSettings)`.
Do not apply gain changes in a React re-render cycle -- always use the store subscriber
pattern so gain changes happen on the audio thread schedule.

### Preset shortcuts

Three presets cover common cases without requiring manual slider adjustment:

- **Cinema** (Music 80, Ambience 90, SFX 70, UI 40): Immersive, quiet UI.
- **Classroom** (Music 50, Ambience 70, SFX 80, UI 80): Voice and interaction
  prominent, music recedes.
- **Silent Mode** (all buses to 0 except UI at 20): Captions on by default.

---

## 9. Subtitles and Closed Captions

### Why this matters

Voice-over narration (field guide audio), diegetic dialogue, and significant ambient
audio events must surface as text for:
- Deaf and hard-of-hearing users
- Users in acoustically noisy environments
- Screen reader users who have audio playing
- Compliance with WCAG 2.1 AA (Success Criterion 1.2.1 for pre-recorded audio-only)

### The caption system interface

The audio system exposes a single event bus method:

```ts
// engine/audio/CaptionSystem.ts
export interface CaptionEvent {
  id: string;           // unique event ID (matches audio asset ID)
  text: string;         // caption text
  speakerLabel?: string; // e.g. "Field Guide", "Narrator"
  durationMs: number;   // how long to display the caption
  priority: 'low' | 'normal' | 'high';
}

captionBus.emit(event: CaptionEvent): void;
captionBus.on('caption', (event: CaptionEvent) => void): () => void;
```

Every Howl that plays voice or any "significant ambient" audio (thunder, animal call
with narrative importance) calls `captionBus.emit()` at the moment the sound begins.
The HUD subscribes to the caption bus and renders a `<CaptionOverlay>` React
component.

### Caption data authoring

Captions live in a JSON file alongside each audio asset:

```
assets/audio/voice/field-guide-01.opus
assets/audio/voice/field-guide-01.captions.json
```

The captions JSON follows a subset of the WebVTT cue format:

```json
{
  "id": "field-guide-01",
  "cues": [
    { "startMs": 0, "endMs": 3400, "text": "Look under this rock -- the wet soil tells you something was here recently." }
  ]
}
```

For ambient events (thunder, frog chorus), a single cue with the full duration
suffices:

```json
{ "id": "thunder-roll-01", "cues": [{ "startMs": 0, "endMs": 6000, "text": "[distant thunder]" }] }
```

### Overlay rendering

The `<CaptionOverlay>` component:
- Appears at the bottom third of the screen in a semi-transparent dark container
- Uses `font-family: var(--font-mono)` from the design system for data-feel captions,
  or the body font for voice captions
- Scales with the user's subtitle font-size preference (Small: 14px, Medium: 18px,
  Large: 24px)
- Does not overlap the field notebook panel when it is open
- In VR, rendered as a world-space UI panel (via `@react-three/uikit`) at 1.8m
  forward and 0.5m below eye level, always facing the user

### Screen reader hook

For full screen reader support, important audio events are also dispatched as ARIA
live region updates:

```ts
// HUD posts to the live region immediately when a caption fires
const liveRegion = document.getElementById('audio-live-region');
liveRegion.textContent = event.text;
```

The `audio-live-region` element carries `aria-live="polite"` for ambient captions
and `aria-live="assertive"` for voice narration.

---

## 10. Determinism -- Audio Must Not Affect Simulation State

### The boundary

The simulation engine is deterministic by design: identical seeds produce identical
event logs, encounter records, and CSV output. The audio system reads from simulation
state; it must never write to it.

**Audio reads (allowed):**
- `WeatherSystem.getCurrentConditions()` -- to drive ambience layer selection
- Player position from the physics/character state -- to drive zone detection
- Simulation event bus (encounter fired, cover object lifted, species identified) --
  to trigger SFX

**Audio writes (forbidden):**
- No audio callback may mutate any property of `WeatherSystem`, `EventEngine`,
  `FieldNotebook`, any entity's state, the Zustand game state (except `audioSettings`),
  or any data destined for CSV export.

### Enforcement strategy

1. **Architectural separation:** The audio manager lives in `engine/audio/` and
   imports from `engine/state/` only through read-only accessors. It never imports
   from experiment logic modules directly; it receives events through a one-way
   event bus.

2. **One-way event bus:** Simulation events flow
   `SimulationCore --> EventBus --> AudioManager`. The AudioManager has no
   reference back to SimulationCore.

3. **TypeScript enforcement:** The event payloads passed to the audio system are
   typed as `Readonly<T>`. Any attempt to mutate them produces a compile-time error.

4. **No shared mutable state:** Audio settings (volumes, captions toggle) are in
   a separate Zustand slice (`state.audio`) isolated from simulation state
   (`state.simulation`). The settings slice is never read by any simulation code.

5. **Test requirement:** Every experiment's determinism snapshot test is run with
   and without audio enabled (controlled by an environment variable that prevents
   the AudioContext from being created). The CSV output for a given seed must be
   byte-identical in both runs.

### Web Audio timing is not simulation time

`AudioContext.currentTime` runs on the audio clock, which has different resolution
and behavior from `performance.now()` and from simulation tick counts. Never use
`AudioContext.currentTime` as a seed, a timestamp in exported data, or as an input
to any RNG used by the simulation. Audio schedules sounds by audio time; simulation
schedules events by tick number. The two clocks are never mixed.

---

## Risks and Open Questions

### Risk 1 -- Safari HRTF gap (HIGH)

Safari on macOS does not implement the `HRTF` panningModel for Web Audio `PannerNode`.
Desktop Safari users get `equalpower` panning. On visionOS the OS spatial audio stack
provides HRTF, but this is hardware-path, not Web Audio. The risk is that a subset
of VR users on Vision Pro may experience inconsistent spatial audio behavior depending
on OS version. Mitigation: design the `equalpower` mix to be directionally meaningful
on its own, verify on a physical Safari+visionOS device in Phase 4.

### Risk 2 -- AudioContext unlock on mobile (MEDIUM)

Mobile browsers (Chrome Android, Safari iOS) suspend the AudioContext until a user
gesture. This is a known restriction. The engine must track `ctx.state` and call
`ctx.resume()` on the first user interaction (pointer down, key down, or VR session
start). Howler handles this for its own context; the shared-context approach
(section 1) means one resume call covers all audio. Verify this works when Howler's
internal unlock runs before the shared-context resume in the engine's input handler.

### Risk 3 -- ConvolverNode CPU cost on Quest (MEDIUM)

A `ConvolverNode` with a 1-second IR at 44.1 kHz is a 44,100-sample convolution
per audio block. On Quest 3's browser thread, this can spike above the audio frame
budget under heavy scene load. The mitigation is to use a shorter IR (0.4-0.6s
tail) and to pre-gain-compensate the dry/wet mix so the room effect does not mask
fine-detail foley SFX.

### Risk 4 -- Howler and Three.js context sharing (LOW-MEDIUM)

Howler.js does not officially document accepting an external `AudioContext`. The
current Howler 2.x source allows `Howler._audioContext` to be set before any Howl
is created, but this is not a published API contract. If a Howler version update
breaks this, the audio bus graph collapses. Mitigation: pin Howler to an exact
version (`2.2.4` as of this writing) and wrap the context-sharing in a try/catch
that logs a warning and falls back to separate contexts. Per-bus volumes would still
work; only the single-master-gain topology would be lost.

### Risk 5 -- Opus codec on legacy browsers (LOW)

Opus in an OGG container has been supported since Chrome 33 / Firefox 15. The main
remaining gap is Safari below 15.4 (released 2022), which lacked native Opus support.
As of 2026, Safari 17.5+ is the baseline. If the project ever needs to support
Safari < 15.4, add AAC fallbacks for all assets. Given that the project targets
modern browsers and the VR stack requires WebXR (which itself excludes very old
browsers), this risk is low.

### Risk 6 -- Tone.js lazy import breaking bundler tree-shaking (LOW)

Tone.js does not yet have full tree-shakeable ESM exports as of early 2026. A
dynamic `import('tone')` in Hardy-Weinberg will load the entire library. At ~200 KB
gzipped this is tolerable, but if the bundler (Vite) attempts to analyze the dynamic
import at build time and includes it in a shared chunk, the library could pollute
other experiment bundles. Mitigation: use Vite's `build.rollupOptions.output.manualChunks`
to isolate the Tone.js chunk to the Hardy-Weinberg experiment entry.

### Open Question A -- Music

No music tracks are sourced in this document. The source library covers all functional
audio (ambience, foley, UI, animal calls). Music composition for Borchard Labs has
not been scoped. Options: CC0 music from Incompetech (Kevin MacLeod, CC BY), itch.io
free game music packs, or original composition. This needs a decision before Phase 4
implementation begins.

### Open Question B -- Adaptive audio graph for non-forest experiments

The state machine in section 3 is designed for the forest / Batesian Mimicry
experiment. Hardy-Weinberg and future aquatic, thermal biology, and tidal experiments
will need their own zone+weather combinations or a different adaptive model
(e.g., parameter-to-audio mapping rather than zone-based crossfading). The audio
architecture should expose a generic `AdaptiveAudioProfile` interface that each
experiment implements, and the AudioManager consumes, so experiment-specific layer
logic does not live in the core engine.

### Open Question C -- Voice asset creation pipeline

If voice-over narration is added, a recording pipeline (microphone, room acoustics,
processing chain) and a caption authoring workflow need to be specified. This is
out of scope for Phase 0 but should be filed as a separate beads issue before
Phase 4 implementation.
