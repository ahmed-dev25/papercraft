# Backlog

Ideas parked deliberately. Nothing here is in progress unless it says so.
Each entry: what it is, why it is worth doing, the next concrete step, and what would kill it.

---

## Now

- **Nothing is building.** The paper-films pipeline is being discussed before implementation.

## Next

- **crease - phase 2.** Phase 1 is committed and live unlisted at `/games/crease/`. Four more
  solver-checked plates (7 total), the specimen margin filling as plates are solved, end card +
  share card, shelf card 03, deploy, X clip.
- **paper films - proposal.** Draft design in `video/PIPELINE.md`; not approved, not built.
- **Inkfold - Chapter 1.** Planned in `implementation_plan.md` (M0-M6). Do not start until crease
  is live and the fold feel is settled; Inkfold reuses that geometry.

---

## Backlog

### Papercraft video series for YouTube (2-3 min)

**What.** Animated short films built with the papercraft skill, written with an LLM from a beat
sheet, rendered deterministically to 1920x1080 (long form) and 1080x1920 (Shorts).

**Why.** The skill already ships the hard part: deterministic clock, `scripts/capture.py` clip
rendering, per-format framing, sound kit. The look is distinctive and calm, and the format is
repeatable once a series bible exists.

**Series options**

| Series | Format | Effort |
|---|---|---|
| Small Lessons (fable, one metaphor) | 2 min, 6-9 shots | low, best first |
| The Paper Almanac (visual explainer) | 2-3 min | medium |
| Bedtime Provinces (kids) | 3 min | low |
| Tiny Histories (one moment) | 2.5 min | medium |
| Loop Poems (no VO, vertical) | 30-45 s | very low, derived |

**Pilot concept.** "The Moth Who Refused the Lamp" - 2:15, 7 shots, one character, one set. A moth
is drawn to a lamp that burns brighter as she nears; the light was never hers to keep, and the moon
asks nothing. Quiet motivation, not hype.

**Pipeline (per episode)**

1. Beat sheet: 8 beats, one visual action and <=25 words of VO each (~350 words total).
2. Shot list: camera, set, action, duration, transition.
3. Scenes: 1 set + 2-4 characters, reused from the series bible.
4. Render: `capture.py <project> clip:video=a,b` at the fixed clock, shot by shot, 30 fps.
5. Sound: narration (TTS or human), licensed/procedural music, paper SFX, -14 LUFS, -1 dBTP.
6. Edit: concat, captions, thumbnail (1280x720 still), title/description.
7. Cut 2-3 vertical Shorts from the same shots.

**Known constraints**

- The style is calm; fast cuts and loud drops fight it.
- Music is the legal risk. Licensed/CC0 or procedural only, never a trending track.
- Disclose synthetic narration where the platform requires it; use a consented voice.
- Render cost is real: 3 min at 30 fps is 5,400 frames. Render per shot and cache.
- One good film a week beats five rushed ones.

**Open questions for discussion**

1. Which series, and is the register "quiet fable" or "explainer"?
2. One channel or separate from the games?
3. Who narrates, and how often can a film realistically ship?
4. Is the goal reach, a portfolio, or a product (e.g., custom films)?

**Next step if approved.** Write only the pilot script + shot list (no build), read it aloud, and
decide if the 8-beat format holds.

**What would kill it.** If the pilot reads better as prose than as pictures, or if narration makes
the paper feel like a slideshow.

---

### Other parked ideas

- **Paper RPG, full three acts.** Planned; see `implementation_plan.md`. Needs Chapter 1 first.
- **crease as a daily plate.** A new free plate every week, no backend: a static JSON per plate.
  Only if the core game retains players.
- **Printable pattern mode.** The skill explicitly excludes real folding instructions; do not
  drift into it.
