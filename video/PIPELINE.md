# Paper Films - production pipeline

> Topic in, film out. A local studio for a weekly papercraft short-film series.
> Status: **DRAFT for discussion. Not approved, not built.** Runs entirely on this machine;
> nothing is deployed. Treat every choice below as a proposal to argue with.

---

## 0. The promise

```
python pipeline/plan.py --topic "the boat that refused the harbor"
python pipeline/render.py 002-the-boat
python pipeline/package.py 002-the-boat
```

One human pass: read the script, approve the animatic, watch the film. Target **45 minutes of
human time per episode**, 20-40 minutes of unattended render.

## 1. Non-goals

- No cloud backend, no accounts, no web app to maintain. Local CLI + a static renderer page.
- No per-episode code generation. The LLM never writes JavaScript.
- No stock footage, no AI image generation, no faces on camera.
- No trending music, no quotes from books or speakers. Original parables only.
- No daily cadence. One film a week done well.

## 2. The core idea: the LLM writes data, the engine renders

The planner produces an `episode.json` that only names things the engine already knows how to draw:
a set, a cast member, a shot type, a camera move, an action, a line of text. The validator rejects
anything outside the vocabulary. This is what makes the weekly loop boring, in the best way.

```
topic
  -> LLM planner (strict schema, 3 few-shot examples, one repair pass)
  -> episode.json
  -> validator (schema, duration, word counts, enums, contrast, banned phrases)
  -> animatic (8 stills + 10 s motion, 2 min)
  -> human approve / edit 2-3 lines
  -> render (30 fps, deterministic)
  -> assemble (ffmpeg: cards, SRT, SFX, loudness)
  -> package (16:9, 9:16 cut, thumbnail, title/description/tags)
```

## 3. Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Series | **Small Lessons** - one quiet fable per film | One metaphor, one turn; repeatable |
| Length | **75-100 s** for v1 | No voice; 8 beats; holds attention |
| Voice | **None in v1** | Voice is a brand decision; on-screen lines carry it |
| Music | **None in v1**; room tone + paper SFX | Licensing/Content ID risk; calm is the identity |
| Later music | **one licensed bed for the whole series**, not per film | Sonic identity; one licence to track |
| Later voice | one narrator, picked after 3 films | Never ship a robotic TTS |
| Renderer | Canvas 2D layered paper theatre | Deterministic, fast, no WebGL risk, easy 9:16 |
| Resolution | 1920x1080 30 fps; 1080x1920 vertical cut | YouTube + Shorts/Reels/X |
| LLM | provider-agnostic (OpenAI / Anthropic / Google), plus `--manual` | No lock-in; manual mode works today |
| Cost | ~$0.01-0.05 per episode in LLM tokens; $0 hosting | Zero-cash production |

### Positioning

Motivation is crowded with shouting and stock drone footage. The paper style owns the opposite:
**motivation for people who are tired of being shouted at.** Quiet, handmade, 90 seconds, one
thought. Titles are concrete parables, not abstractions ("The Moth Who Refused the Lamp", not
"STOP CHASING").

## 4. Episode schema (v1)

```json
{
  "version": 1,
  "slug": "001-the-moth-and-the-lamp",
  "series": "Small Lessons",
  "title": "The Moth Who Refused the Lamp",
  "logline": "A moth learns that some light is not hers to keep.",
  "lesson": "You are allowed to leave the room.",
  "seconds": 88,
  "palette": {
    "page": "#f1e6cc", "ink": "#2e231a", "lead": "#35506e",
    "warm": "#c99a3f", "accent": "#bf5a42", "night": "#1f2a33",
    "moon": "#f7f2e4", "shadow": "#6a4a33"
  },
  "set": { "kind": "lamp-room", "window": "shutter", "lamp": "flower", "moon": true },
  "cast": [{ "id": "moth", "kind": "moth", "tint": "#c99a3f", "scale": 1 }],
  "beats": [
    { "shot": "establish", "seconds": 12,
      "text": "She had one rule: stay away from the lamp.",
      "params": { "camera": "wide", "focus": "lamp", "action": "idle" } },
    { "shot": "approach", "seconds": 11,
      "text": "But it was the brightest thing she had ever seen.",
      "params": { "from": [0.2, 0.35], "to": [0.5, 0.58], "arc": 0.3 } },
    { "shot": "closeup", "seconds": 10,
      "text": "Every circle cost her a little wing.",
      "params": { "subject": "wing", "focus": "lamp" } },
    { "shot": "burn", "seconds": 11,
      "text": "The light did not dim for her.",
      "params": { "wing": "right", "embers": true } },
    { "shot": "retreat", "seconds": 11,
      "text": "Some lights only know how to take.",
      "params": { "to": "sill" } },
    { "shot": "fold", "seconds": 11,
      "text": "Then she saw the moon.",
      "params": { "piece": "shutter", "open": 180, "reveal": "night" } },
    { "shot": "reveal", "seconds": 12,
      "text": "It had been there the whole time, asking nothing.",
      "params": { "object": "moon", "light": "moon" } },
    { "shot": "hold", "seconds": 10,
      "text": "You are allowed to leave the room.",
      "params": { "camera": "drift", "titleCard": true } }
  ],
  "meta": {
    "description": "A 90-second paper fable about the light that takes and the light that waits.",
    "tags": ["paper craft", "stop motion", "short film", "parable", "motivation"],
    "thumbText": "the moon asks nothing"
  }
}
```

Rules the validator enforces:

- 6-10 beats; `seconds` sums to 70-110; each beat 6-15 s.
- `text` <= 14 words, one sentence, no quotes, no brand names, no "in this video", no exclamation
  except at most one in the film, no second-person command in more than one beat.
- One visual action per beat; at most 2 cast members; `shot` and `params` keys must be in the enums.
- Palette: page vs ink contrast >= 7:1; accents distinct; no colour from another film by default.
- `title` <= 60 chars; `thumbText` <= 5 words; description 1-2 sentences; 5-8 tags.
- The lesson must appear as the last line, not as a lecture earlier.

## 5. Shot grammar

The engine implements these; the planner only chooses them. Every shot is a pure function of
normalized time, so any frame can be rendered on demand.

| Shot | What it does | Params |
|---|---|---|
| `establish` | set rises and settles; camera wide; title line | camera, focus, action |
| `approach` | subject travels an arc toward a focus; camera follows | from, to, arc |
| `closeup` | shallow depth, object detail, slow push | subject, focus |
| `burn` | a wing/prop singes; embers; light stays cruel | wing, embers |
| `retreat` | subject falls back; camera pulls out | to |
| `fold` | a set piece folds on a real hinge, revealing a layer | piece, open, reveal |
| `reveal` | a new object rises; palette/light shifts | object, light |
| `hold` | slow drift; final line; optional end card | camera, titleCard |

Card library (shared across episodes):

- **Set: lamp-room** - a paper room in cross-section: back wall with a window, a table, a lamp, a
  door, a rug, a shelf; layers at 4 depths for parallax. The shutter is a hinge piece.
- **Set: shore** (episode 2) - a jetty, water bands, a lighthouse silhouette, a boat.
- **Cast: moth** - 2 crossed wing cards on hinges, a body card, antennae; flap cycle, drift, land,
  singe, fold. 6 poses.
- **Props:** lamp (folded paper lantern), moon (layered card), window shutter, dust, embers, thread.
- **Text:** one card at a time, bottom third; ink serif; max 2 lines; fade + 4 px rise.

## 6. Visual rules (the skill's laws, for film)

- Dead matte, no gloss, no glow; light is a warm key from stage-left and a cool night fill.
- Every card has a cut edge (thin dark line + pale highlight on the lit side), a 2-3% thickness,
  and a contact shadow in the world's shadow colour.
- Depth: 4-6 parallax layers; foreground vignette pieces blurred 8-14 px at 1080p; the sharp band
  on the subject.
- Palette per film, derived from the metaphor; page cream and ink are the constants.
- Text is never over busy art; it sits on a cream card with a torn or deckled edge.
- Motion: hinge rotation only; 8-15% overshoot; settle by ~1 s; no scaling, no digital easing.
- No flashing, no screen shake, no zoom punches. The camera moves like a tripod, slowly.

## 7. Audio (v1)

- **No music.** Room tone (very low filtered noise), paper flaps, wing flutter, a lamp hum, one
  soft bell at the turn, embers. All procedural from `paper-sound.js` + simple oscillators.
- Levels: room tone -38 dB, flaps -18 to -12 dB, the bell -14 dB, mix target -18 LUFS (no VO),
  true peak -1.5 dB. One sound per gesture, >=0.4 s apart.
- Export a muted version too, for platforms that prefer silent autoplay previews.
- When a voice is added: -16 LUFS, duck the bed 6 dB under speech, keep the paper SFX.

## 8. Render pipeline

```
render.py <slug> [--preview] [--vertical] [--beat N]
  1. serve repo root on a free port
  2. open stage/index.html?episode=<slug>&w=1920&h=1080
  3. for each beat, for each frame at 30 fps:
       page.evaluate(seek(beat, t)); page.screenshot(jpeg q=92)
  4. ffmpeg: frames -> beat.mp4 (libx264, yuv420p, crf 16, 30 fps)
  5. concat beats (no re-encode) -> picture.mp4
  6. mix SFX (rendered offline to wav) -> film.mp4 (-18 LUFS, faststart)
  7. SRT from beat text + times; poster frame at the emotional peak
  8. --vertical: a 9:16 recompose of 4 beats (30-45 s) at 1080x1920
  9. write out/<slug>/{film.mp4, vertical.mp4, poster.jpg, thumb.jpg, film.srt, meta.json}
```

- Deterministic: seeded decoration, fixed clock, no wall time. Re-rendering one beat is exact.
- Resumable: existing beat frames are reused unless `--force`.
- Frame storage: JPEG q92, 1920x1080 (~200-300 KB each); a 90 s film is ~600-800 MB temp, deleted
  after encode unless `--keep`.
- Estimated: 8 beats / 2,700 frames, 25-45 min on this machine at 1080p; vertical cut ~12 min.
- `--preview` renders 8 stills + a 10 s animatic in ~2 min for approval.

## 9. LLM planner

`pipeline/plan.py --topic "..." [--angle "..."] [--length 90] [--manual]`

- System prompt: the series editor. Original parables only; one concrete metaphor; one turn; no
  quotes; no advice until the last line; exactly 8 beats; every beat must be drawable with the
  card library; JSON only.
- Few-shot: the moth pilot plus one shore episode, both valid.
- Calls the provider with JSON mode / structured output; one repair pass if validation fails;
  then fails loudly with the validator's message.
- `--manual` writes a rich template with the topic and leaves the beats for a human/agent, so the
  pipeline works with no key.
- Providers: `openai` (gpt-4.1-mini or better), `anthropic` (claude-sonnet), `google` (gemini-2.5-flash).
  Model and key from env; never committed.

## 10. Weekly workflow

| When | Step | Human time |
|---|---|---|
| Mon | pick a topic from `topics.md`; run `plan.py` | 1 min |
| Mon | read the JSON; edit 2-3 lines; run `--preview` | 15 min |
| Mon | approve the animatic; run the full render | 5 min |
| Tue | watch the film; `--beat N` if one shot is off | 10 min |
| Tue | `package.py`; schedule YouTube + Shorts + Reels + X | 15 min |
| **Total** | | **~45 min** |

Batch mode for two films a week: plan 2 episodes Monday, render both overnight, package Tuesday.

## 11. Packaging

- **YouTube:** 1920x1080, 30 fps, H.264 high, AAC 192k, -18 LUFS, faststart. Title <=60 chars.
  Description: 1-2 sentences + the lesson + a link to the games. Tags: 5-8. End card 3 s.
- **Shorts/Reels:** 1080x1920, the strongest 4 beats, captions burned, hook in the first second
  (start on the lamp flare, not the title).
- **X:** 16:9 or 1:1 native upload, 30-60 s; the first post is the opening line, the film in reply.
- **Thumbnail:** 1280x720, one object, 3-4 words in the series type, cream/ink, no face.
- **Series identity:** the same title card, the same 1.5 s page-turn sting, the same end card.
- **Disclosure:** if TTS is added, label synthetic narration where the platform requires it.
- **Music licence:** keep a `licences/` folder with the track, source, licence and date.

## 12. Build order

### 0. Look comparison (before the pipeline)

Two 10 s samples of the same beat: a 2D paper puppet theatre and a 3D paper diorama. Same palette,
text, timing and camera move; silent. Compared at 100%, on a phone, and by render time. The winner
becomes the renderer; the loser is not built. No pipeline code until this is decided.

### A. Stage engine + the moth pilot (1-2 sessions)

- `video/stage/` canvas theatre: layer compositor, camera, depth blur, grain, card sprites with
  cut edges, hinge animation, particles, text cards.
- Set `lamp-room`, cast `moth`, all 8 shots, the pilot `episode.json`.
- `pipeline/render.py` producing a 16:9 MP4 + poster + SRT, 30 fps.
- **Proof:** 8 beat stills reviewed at 100%, a 10 s animatic, no console errors, frame-exact seek.

### B. Sound, vertical, package (1 session)

- Procedural room tone + flaps + wing + bell; loudness pass.
- 9:16 recompose for 4 beats; thumbnail generator; `meta.json`; contact sheet.

### C. Planner + validator + one command (1 session)

- `plan.py` with the schema, prompts, repair pass, `--manual`.
- `lint.py` with the rules; `make.py` running plan -> preview -> render -> package.
- **Proof:** a second episode from a new topic, produced without touching code.

### D. Second film, timed (half session)

- Time the full loop; find the slow step; cut it. Only then commit to 2/week.

## 13. Risks

| Risk | Mitigation |
|---|---|
| LLM writes unmakeable shots | Strict enums; validator; one repair pass; preview before render |
| 90 s of paper feels slow | 8 beats, one camera move each; cut on the line; no shot over 15 s |
| Motivational cliché | Original parables; concrete nouns; the lesson only at the end |
| Music licensing | No music v1; then one licensed bed with a recorded licence |
| TTS sounds synthetic | No voice v1; test 3 voices later; one voice for the series |
| Render time | Preview first; per-beat resume; render overnight for batches |
| Style drift | One set grammar, one type system, one palette rule |
| Platform fatigue | 1 flagship + 2 cuts, not 4 originals |
| AI slop perception | Human edit + distinctive craft + no generic quotes |

## 14. Pilot: beat sheet (the first film)

**The Moth Who Refused the Lamp** - 88 s, 8 beats, one room, one moth.

| # | s | Shot | Text |
|---|---|---|---|
| 1 | 12 | establish | She had one rule: stay away from the lamp. |
| 2 | 11 | approach | But it was the brightest thing she had ever seen. |
| 3 | 10 | closeup | Every circle cost her a little wing. |
| 4 | 11 | burn | The light did not dim for her. |
| 5 | 11 | retreat | Some lights only know how to take. |
| 6 | 11 | fold | Then she saw the moon. |
| 7 | 12 | reveal | It had been there the whole time, asking nothing. |
| 8 | 10 | hold | You are allowed to leave the room. |

End card: `SMALL LESSONS` / `a paper fable every week` / the site link.

The full scripts for the first three films are in `video/scripts/` (moth, boat, wall). The gates,
screening questions, metrics and pivot rules are in `video/VALIDATION.md`. Those three films set the
bar and become the planner's few-shot examples.

## 15. Topic bank (the first ten)

1. The Moth Who Refused the Lamp - attention and validation.
2. The Boat That Refused the Harbor - leaving comfort.
3. The Wall That Learned to Open - asking for help.
4. The Kite That Cut Its String - freedom vs drift.
5. The Candle That Wouldn't Burn - rest as discipline.
6. The Bridge That Refused to Carry - boundaries.
7. The Clock That Stopped - presence.
8. The Seed That Wouldn't Sprout - patience.
9. The Door That Opened Inward - self-honesty.
10. The Star That Fell on Purpose - failure as direction.

## 16. Open decisions

- **LLM provider/key.** Until one is provided, `plan.py --manual` is used and the story is written
  in-session. Nothing else is blocked.
- **Series name.** "Small Lessons" is a working title; confirm before the first upload.
- **Music.** Stay silent until retention data says otherwise; then one licensed bed.
- **Voice.** Revisit after three films with data, not before.
