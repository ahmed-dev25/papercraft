# Inkfold — implementation plan

> A paper RPG in three acts, played entirely in the browser.
> Status: **planned, not started.** `crease` ships first.
> Owner: Ahmed. This file is the source of truth for design and build order.

---

## How to use this document

A future session should be able to build the whole game from this file plus `SKILL.md`, without
re-deriving the design. Read in this order:

1. Section 0 (pitch) and 1 (constraints) — what it is and what it must never become.
2. Section 5 (overworld), 6 (battle), 7 (progression) — the game.
3. Section 10 (visual direction) and 11 (audio) — the look and feel.
4. Section 12 (architecture), 13 (schemas), 17 (testing) — the build.
5. Section 18 (milestones) — the order of work.

Rules for the build:

- **Decisions in this file are made.** Change one only with the owner's agreement, and update this file
  in the same commit. Do not silently improvise a mechanic, a palette, or a scope.
- **Never invent kit APIs.** Read `assets/lib/*.js` and the `references/` section named here before using
  a function. The plan cites the section that answers each question.
- **Never copy from another game's art.** Reuse plumbing (`harness.js`, `paper-sound.js`, share code),
  never the countryside world, the carnival cards, or the folk.
- **One milestone, one session, one verification.** Each milestone ends with a playable build and the
  Playwright proof in section 17. No milestone is "done" because the code was written.
- **When in doubt, take something away.** The skill's own owner kept asking for calmer, quieter,
  subtler (SKILL.md section 9). Inkfold is a comedy with a warm heart, not a spectacle.

---

## 0. The one-page pitch

**Inkfold** is a pop-up theatre that performs itself. Every night the book resets; every night the
company plays the same three acts. Then the ink stops: something is eating the page from the back,
leaving blank paper where colour and memory used to be.

The leads have already been erased. The only one left who can go off-script is **Pip**, the page-runner
— a folded paper fox with no lines and a good jump.

You fold the world to get through it, flip flat to slip under it, and take the stage against the
**Understudy**: a blank copy of Pip, cut from the same sheet, who has decided the play is better with
no script at all.

- **Genre:** story-driven RPG with a turn-based, timing-based battle system and a small explorable
  overworld of pop-up sets.
- **Length:** 80-100 minutes, three acts, 19 core rooms + 3 secret rooms, 8 cutscenes.
- **Platform:** browser only. Static files. Phone-first portrait, desktop unchanged in spirit.
- **Cost:** zero. Cloudflare Pages free tier, no backend, no accounts, no analytics.

**The three verbs that make it paper, not a skin:**

| Verb | What it does | Why it is paper |
|---|---|---|
| **Fold** | Fold a floor panel into a ramp, a wall into a bridge, a page corner into a door. | A crease is a hinge; the world is a sheet. |
| **Flip** | Lie flat, become a thin silhouette, slide under a gap or along a printed line. | Paper has no depth from the front. |
| **Perform** | Time your jump, hammer, guard and flourish for the audience. | The world is a stage; applause is a resource. |

---

## 1. Product constraints and non-goals

### Must

- Static HTML/CSS/JS, ES modules, no build step, no network at runtime except the page itself.
- Deployed on the existing Cloudflare Pages site (`play.buildquietly.com`), auto-deploy on push to
  `main`, output directory `skills/papercraft/assets`.
- Portrait phone is the primary target: 390x844 must be fully playable with no rotation, no scrolling,
  no pinch-zoom of the page.
- Desktop 1440x900 must feel authored, not stretched: larger type, wider framing, keyboard controls.
- Saves locally; resuming works after a refresh; the save survives a deploy.
- Deterministic enough to test: fixed-step clock, seeded decoration, no random damage.
- Total payload under ~2.5 MB including fonts, because everything is procedural.

### Must not

- No backend, Workers, database, login, leaderboard, telemetry, cookies, or third-party SDKs.
- No Mario, no Nintendo characters, names, sounds, or art. Original cast only. "Paper RPG" is a genre;
  the plumber is not.
- No random encounters. Every fight is visible on the page and can be avoided or ambushed.
- No missable content, no fail state that erases progress, no grind.
- No flashing, no screen shake, no camera roll beyond a few degrees, no motion that could make a phone
  player queasy.
- No glossy/plastic look: dead matte, cut edges, coloured shadows (SKILL.md section 1).
- No lore dumps. Story is delivered in playable beats, not paragraphs.

### Deliberate cuts (scope discipline)

- No voice acting, no lip sync. Text + expression poses.
- No procedural music generation at first; five composed cues, see section 11.
- No party management beyond one active partner.
- No equipment beyond pins. No crafting. No day/night cycle.
- No sidequest log; secrets are found, not tracked.

---

## 2. The world and the story

### The conceit

The **Folded Provinces** are a travelling pop-up book that stages its own story. Each act is a set; the
company are the characters; the audience is real paper folk who come back every night. The book has a
spine, a colophon, margins, errata, and a prompt box. The stage is the world and the world is the stage —
which is why a diorama camera, a proscenium, and a curtain are not decoration but physics.

### The threat

**The Blank.** Not a monster: a condition. Where it spreads, ink lifts off the page and the paper goes
white. People don't die; they are *unwritten*. The Understudy is its agent and its victim — a blank copy
of Pip who was cut as an understudy and never inked, and who now believes that if the script is erased,
the role is finally theirs.

### Theme

A story is not the script; it is the performance. Pip has no lines and is the lead. The Understudy has
every line and no self. The ending is not "defeat the villain" but "give the blank copy a page of their
own".

### Act structure

| Act | Place | Promise | Boss | Ends with |
|---|---|---|---|---|
| **Prologue — the Empty House** | The theatre, front of house and backstage | Learn to walk, talk, flip, fold; first fight | A rehearsal Prop Rat | The Blank eats the back cover; the company's leads are gone |
| **Act I — the Inkwell Market** | A market town printed in the margins | A hub, a shop, a partner, the first real dungeon | **the Blot**, an ink spill in a costume | Marla joins; the market's ink is restored; the trail leads into the wood |
| **Act II — the Folded Wood** | Origami pines, a crease canyon, the paper mill | The fold verb at world scale; the Understudy | **the Understudy** (first duel) | Quill joins; the Understudy cuts the bridge and flees to the Blank |
| **Act III — the Blank** | The erased page, the prompt box, the spine | The audience as a mechanic; the truth | **the Understudy** (true form) then **the Blank** | The page is folded shut around the Blank; the Understudy gets a blank page of their own |

### Beat sheet (the spine of the writing)

- **P0** The house is empty. The Prompt (a cricket in the prompt box) finds Pip. "You're on."
- **P1** Backstage: the flats are folded shut; learn flip to get under the stage door; learn fold to
  raise a ramp.
- **P2** Rehearsal: a Prop Rat has eaten the cue cards. First battle. The house lights go out. A white
  edge appears at the back of the set and spreads.
- **I0** The company is gone; only Marla the stagehand is left, holding a hammer and a broken flat.
- **I1** The market is half-erased; the shopkeeper's colours are fading. Restore the ink well.
- **I2** The margins: the rules are literal ruled lines; flip under them, fold a footnote into a stair.
- **I3** The Blot is drowning the stage door in ink. Fight it with blotting paper and a set change.
- **I4** The ink returns to the market (a visible set change: colour floods back). Marla joins.
- **II0** The wood is folded shut; paths are creases. Quill the heron is trapped in a footnote.
- **II1** The mill prints the book; the presses still run with no one at them.
- **II2** The Understudy: mirrors Pip's moves, cuts the stage apart, escapes at half health.
- **II3** The bridge is cut; Quill folds a paper crane big enough to carry two. Act III.
- **III0** White page. No ink. Navigation by shadow and sound; the audience is a rumour.
- **III1** The prompt box: the Prompt has been reading the same line for years. "I know how it ends."
- **III2** The spine: climb the binding; the pages above are being erased one by one.
- **III3** The last page: the audience speaks (one line each, twelve voices, the emotional peak).
- **III4** The Understudy, true form: uses your own pins, cuts the audience away, drains applause.
- **III5** The Blank: a puzzle-boss. Fold the page around it. The Understudy is given a blank page.
- **III6** Curtain. The house applauds. The book resets — with one new page in it.

---

## 3. Cast

### Playable

**Pip** — page-runner. A folded fox, cream card, ink mask, coral scarf, one ear dog-eared. Silent
(speaks in gestures and yes/no choices; this is also the animation budget). Verbs: jump, hammer (small),
flip, fold, perform. Arc: from runner to lead.

**Marla** — beetle stagehand. Broad, kind, shy; carries a brass hammer twice her size. Partner 1.
Battle: **Hammer** (heavy, timed), **Rally** (party attack +1), **Brace** (party guard). Arc: stops
apologising for taking up space.

**Quill** — heron scribe. Tall, dry, vain about handwriting. Partner 2. Battle: **Pen Peck**, **Annotate**
(reveal weakness, defence -1), **Mend** (heal 4), **Erase** (strip a buff). Arc: learns that a margin
note can be a kindness.

### Non-playable

- **The Prompt** — a cricket in a prompt box; the tutorial, the guide, and the comic relief. Knows the
  script by heart and is terrified of improvisation.
- **The Understudy** — a blank Pip; scissors; polite, wounded, certain. The antagonist.
- **The Audience** — 12 paper folk in the front row. They gasp, lean, applaud; the applause meter is
  diegetic. One of them (the small one with the jam jar) is the emotional anchor of Act III.
- **The Company** (erased before the game): the Lead, the Villain, the Chorus. Present as empty costume
  cards hanging on a rail; their absence is the mystery.
- **Market NPCs (5):** the Inkwell keeper (fading), the Ticket Taker (sells items), the Prompt's cousin (a
  moth who reads ahead), the Understudy's dresser (guilt), a child who is drawing the missing leads.
- **Mill NPCs (3):** the Pressman (a glove), the Binder (a spool), the Errata (a correction slip with
  opinions).
- **Act III NPCs (3):** the Prompt (again), the Colophon (a tiny printer's mark who is the book's
  memory), the small audience member.

---

## 4. Game structure

### Shape

```
Title (playbill)
  Prologue   3 rooms    ~10 min
  Act I      6 rooms    ~25 min   hub + dungeon + boss
  Act II     5 rooms    ~25 min   fold puzzles + rival
  Act III    5 rooms    ~30 min   escalation + finale
  Curtain    end card, share, new game+
```

19 core rooms, 3 secret rooms. Each room is **one authored set with one fixed camera** (a diorama); doors
and page edges connect them. No streaming open world. This keeps print cost and camera work bounded and
makes every room feel like a stage.

### Room list

| # | Room | Purpose | Mechanic taught | Enemies |
|---|---|---|---|---|
| P1 | The Empty House | Title, movement, talk, first Prompt | walk, talk | — |
| P2 | Backstage | Flats, costumes, the rail of empty leads | **flip**, **fold** | — |
| P3 | Rehearsal | First battle; the Blank appears | battle, guard | Prop Rat x1 |
| I1 | Inkwell Market | Hub: shop, inn, 5 NPCs | shop, save, quest | — |
| I2 | The Queue | Street puzzle: fold an awning into a ramp | fold at room scale | Hand Puppet x2 |
| I3 | The Margins | Ruled-line dungeon entry | flip under rules | Footnote Mite x3 |
| I4 | The Footnote Stacks | Vertical shelves, page-corner secret | fold a page corner | Paper Wasp x2, Mite x2 |
| I5 | The Blot's Dressing Room | Pre-boss puzzle: drain the ink | fold a gutter, timing hazard | Ink Blot x2 |
| I6 | The Stage Door | Boss arena | **Showstopper** tutorial | **the Blot** |
| II1 | The Folded Wood | Forest of origami pines | crease paths | Fold Hound x2 |
| II2 | The Crease | Canyon; fold the wall into a bridge | fold at large scale | Curtain Moth x3 |
| II3 | The Paper Mill | Conveyor + presses | timing, hazards | Set Piece x2, Wasp x2 |
| II4 | The Understudy's Wing | Mirror room, dialogue, a pin | — | — |
| II5 | The Cut Bridge | Rival duel; bridge cut | partner commands | **the Understudy** (flees) |
| III1 | The Blank | White page, no ink; shadow navigation | sound/shadow reading | Eraser Shaving x3 |
| III2 | The Prompt Box | Vertical climb, audience mechanic | applause | Gilt Beetle x2 |
| III3 | The Spine | Binding climb; pages erase above | fold + flip chain | Margin Worm x3 |
| III4 | The Last Page | Audience speaks; all pins available | — | — |
| III5 | The Empty House (again) | Finale, two phases | everything | **Understudy**, **the Blank** |
| S1 | The Dedication | Secret: a pin | flip through a printed line | — |
| S2 | The Errata | Secret: lore + item | fold a misprint | — |
| S3 | The Colophon | Secret: credits room | — | — |

### Cutscenes (8, 15-40 s, skippable, replayable from the program)

1. The house lights / the Blank at the back cover.
2. The rail of empty costumes (Act I opening).
3. Ink returns to the market (Act I victory).
4. The wood unfolds (Act II opening).
5. The Understudy cuts the bridge (Act II exit).
6. The audience speaks (Act III, the peak).
7. The Understudy receives a page (finale).
8. Curtain / the book resets with one new page.

---

## 5. Overworld

### Camera and framing

- One authored camera per room: the kit's macro lens, **pitch 44-50 deg**, **FOV 26-30 deg vertical**,
  the printed set filling the frame with no horizon (the proscenium or a foreground flat cuts the top).
- **Sharp band** across the play space (~0.40 of the frame), blur above and below to 12-16 px at 1080p.
  The audience sits in the blurred foreground at the bottom edge — a signature frame.
- Portrait phones: the harness's vertical framing, camera **12% closer**, band 0.42, blur 10-11 px,
  fewer foreground pieces, per the paperfolk mobile lens (verified numbers there: maxBlur 18 -> 10,
  band 0.3 -> 0.4).
- Room transitions: a **page turn** (the page lifts from the right edge, the new set is already printed
  beneath). Chapter transitions: a **curtain sweep**. No fades to black.

### Movement

Reuse the 3D harness walk (motion.md section 8 numbers):

- Top speed **1.9 H/s** (H = hero height 3.6 units) ~ 6.8 units/s; acceleration reaches 90% in ~0.06 s.
- Heading turns at ~13 rad/s; forward lean 3.5 deg on an under-damped spring; gait from distance, never
  from time; footstep event at every pi of phase.
- No run button. A hold-to-hurry at 1.3x is allowed only if playtests ask for it.
- Height follows decks at ~45 /s so feet never lag a ramp.

### Controls

| Action | Desktop | Phone |
|---|---|---|
| Move | WASD / arrows | floating thumb stick, bottom-left (appears under the thumb, 96 px) |
| Interact / confirm | Space / Enter | A button, bottom-right (64 px) |
| Jump (overworld) | Space (context) | A button (context) |
| Flip | F | B button (56 px) |
| Fold / pull | E (context) | B button (context) |
| Menu | Esc | a tab at the top-left, 44 px |

Context-sensitivity is mandatory: one button does the obvious thing, and a small ink label names it
("talk", "flip", "fold", "read") above the button. No modal verb picker.

### Flip (signature traversal)

- Pip rotates about his base hinge to lie flat over **0.25 s** (one overshoot, no wobble), the camera
  rises toward top-down over 0.5 s, the lens band widens, and the world reads as a printed page.
- Flat Pip is a **thin silhouette** (2-3 px print thickness) that can:
  - slide under a gap lower than his standing height,
  - travel along a **printed line** (a ruled margin, a fold line) at 1.4x speed,
  - pass through a **slot** cut in a flat.
- Some printed things are only visible while flat (a path, a hidden door, a message in the margin).
- Flip back anywhere there is headroom; if there is none, Pip stays flat and a small ink arrow shows
  where to stand up. Never trap the player.

### Fold (signature puzzle)

- Fold points are printed dashed lines with a small **brass tab**, always visible, reversible, never
  timed. Press/drag the tab and the element folds about its crease in 0.4 s.
- Uses: floor panel -> ramp; wall -> bridge; backdrop -> hidden room; gutter -> drain; page corner ->
  secret. **8 fold puzzles** across the game (2 per act, 2 in the prologue).
- The fold is the same geometry as `crease`, promoted to room scale. Reuse `geometry.js` from
  `games/crease/` (reflection, stack, coverage) rather than rewriting it.
- A folded element changes the `WalkField` (mechanisms.md section 14): the walk surface is rebuilt after
  the fold settles, never during.

### Interaction and secrets

- **Talk:** NPCs have 1-3 lines per act, updated by story flags; no branching trees deeper than one
  choice.
- **Read:** footnotes and playbills give hints and jokes; they are the lore delivery.
- **Inspect:** set dressing with one line, only where it is funny or useful.
- **Pick up:** buttons (currency), ink drops (FP refill), heart pieces (HP), pins (envelopes).
- **Secrets:** one page corner per act, flipped through; each opens a secret room. No map marker, no
  checklist; NPCs hint in character.

### Hub behaviour (Inkwell Market)

- Shop: 6 items + 2 pins per act, restocked by act.
- Inn: full heal + save; the innkeeper's line changes with the story.
- Stage door: the act's dungeon entrance.
- 5 NPCs with evolving dialogue; the child's drawing updates as leads are recovered.
- A visible **set change** after the boss: colour floods back into the printed flats, a permanent
  improvement the player caused.

---

## 6. Battle system

The battle is the game's identity. It is a **stage performance**: turn-based commands, real-time timing,
an audience that reacts, and sets that change.

### Flow

```
Encounter (overworld touch or ambush)
  -> Curtain sweep (0.6 s), camera dollies to the arena
  -> ROUND:
       1. Player phase: Pip acts (1 action) + partner acts (1 action, free switch once per round)
       2. Enemy phase: every enemy shows a CUE CARD, then acts in order
       3. Applause resolves, statuses tick
  -> Victory (curtain call) | Defeat (the understudy takes the role; retry)
```

- No speed stat. Player always acts first. Fairness comes from telegraphed enemy cues, not stats.
- One active partner; switching is free once per round, then costs the partner's action.
- Flee: always 100% outside bosses, costs the player phase. No shame.

### Stats

| Stat | Pip start | Cap | Notes |
|---|---|---|---|
| HP (hearts) | 10 | 30 | +5 per act via heart pieces (3 per act) |
| Ink (FP) | 5 | 20 | specials and partner skills cost ink |
| Attack (jump) | 2 | 5 | pins add |
| Hammer | 3 | 6 | Marla only |
| Pin slots | 1 | 3 | +1 at Act II and Act III |
| Applause | 0 | 100 | see below |

Partners have their own HP (Marla 8 -> 16, Quill 6 -> 12); they are downed, not dead, and return at
1 HP after the battle. No permadeath.

### Actions and timing

All windows are expressed at 60 fps and measured on the fixed clock, with an input buffer of 120 ms.

| Action | Input | Perfect | Good | Late/weak | Effect |
|---|---|---|---|---|---|
| **Jump** | press on contact | +-3 frames (50 ms) | +-6 (100 ms) | +-10 (167 ms) | x1.5 / x1.0 / x0.6 damage |
| **Double jump** | second press at apex | +-3 | +-6 | +-10 | extra hit, same multipliers |
| **Hammer** | press on downswing | +-3 | +-6 | +-10 | x1.5, perfect staggers |
| **Guard** | press before impact | +-2 (33 ms) parry | +-6 block | +-12 late | parry = 0 dmg + counter 1; block = 50% |
| **Flourish** | press during the pose window | +-4 | +-8 | — | +6 applause, no damage change |
| **Partner** | each has one timed input | +-3 | +-6 | +-10 | see partner skills |
| **Showstopper** | hold both buttons at 100 applause | — | — | — | 6-8 s set-change attack, 15-20 dmg |

- **Damage:** `max(1, round((atk + pins) * timing * element - def))`. Fixed values, no random variance.
- **Element:** `1.5` weakness, `1.0` neutral, `0.5` resist. Four types: **Ink, Tear, Damp, Gilt**.
- **Enemy cue cards:** at the start of the enemy phase each enemy flips up a card with an icon, a target,
  and a number ("bite 3"). The card is readable for at least 0.5 s before the hit; a pin can extend it.
- **No hidden information:** enemy HP becomes a number with the Cue Card pin; weaknesses fill in a
  discovery log after the first hit of that type.

### Applause and the Showstopper

The audience is the special meter, and it is visible: twelve paper folk in the front row, blurred, who
lean in on perfects.

| Event | Applause |
|---|---|
| Perfect action | +10 |
| Good action | +4 |
| Flourish | +6 |
| Perfect parry | +8 |
| Taking a hit | -8 |
| Partner downed | -12 |
| Confetti item | +30 |
| Start of battle | 0 (+20 with the Understudy's Ribbon pin) |

At **100**, the Showstopper unlocks: the lights narrow, the set folds into a new backdrop, and Pip and the
partner perform a 6-8 s choreographed attack (15-20 damage, an element of the current set). Applause
resets to 0 (25 with the Encore pin). This is the game's spectacle budget: **one per battle, maybe two**.

### Stage sets

Each arena has 2-3 printed **flats** (backdrops). The set determines the Showstopper's element and one
environmental rule:

| Set | Element | Rule |
|---|---|---|
| Theatre stage | Gilt | audience cheers: applause gains +2 |
| Market flat | Ink | puddles: Damp lasts one extra turn |
| Paper mill | Tear | the press: every 3rd round, 2 damage to all |
| The Blank | Damp | no colour: healing -1 |

Set changes are the visual payoff of the Showstopper, and the reason a battle looks different at minute
one and minute three.

### Status

| Status | Icon | Effect | Cleansed by |
|---|---|---|---|
| **Creased** | a fold | def +1, atk -1 | time (2 turns) |
| **Damp** | a drop | takes +50% Tear, atk -1 | Blotter |
| **Smudged** | a thumbprint | 30% chance to miss | Blotter |
| **Torn** | a rip | 2 damage at end of round, 3 turns | Tape (partial) |
| **Gilded** | a star | atk +2, 3 turns | Eraser |
| **Flattened** | a flat card | skips the next action | time (1 turn) |

Statuses are shown as small printed stamps on the character's card, never as floating UI text.

### Victory, defeat, retry

- **Victory:** curtain call; the camera pulls back; the audience stands; rewards are printed onto a
  ticket (buttons, ink, occasionally a pin). No victory fanfare longer than 3 s, skippable.
- **Defeat:** the Understudy steps into your role for one line ("I'll take it from here"), the curtain
  closes, and you may retry the battle or lower the difficulty. **No progress is lost.**
- **Difficulty:** three settings chosen at the title and changeable anytime: *Matinee* (timing assist:
  windows +2 frames, enemy damage -1), *Evening* (authored), *Gala* (windows -1 frame, enemies +1 HP
  per hit taken? no — instead enemies act one extra time every third round). Keep Gala fair, not grindy.

---

## 7. Progression, items, pins

### Progression

No XP, no levels. Growth is found, not farmed (Paper Mario's model, and it keeps balance authored):

- **Heart pieces:** 3 per act, +5 max HP each set of 3 (so +5 per act).
- **Ink wells:** 2 per act, +5 max Ink each.
- **Pins:** 10 total, 3 slots; found in secrets, shops, and boss rewards.
- **Partners:** Marla at the end of Act I, Quill at the end of Act II.
- **Buttons:** currency, ~15-25 per act, spent at the shop.

### Items (shop and finds)

| Item | Cost | Effect |
|---|---|---|
| Tape | 3 | heal 5 HP |
| Spool | 8 | heal 15 HP |
| Inkwell | 5 | +5 Ink |
| Glue | 12 | revive a downed partner at 50% |
| Blotter | 6 | cleanse Damp/Smudged |
| Confetti | 10 | +30 applause |
| Thimble | 14 | party guards next round free |
| Spare Sheet | 20 | auto-revive Pip once at 5 HP |
| Eraser | 9 | strip enemy buffs |
| Dog-ear | — | key item: marks a room on the program (fast travel later) |

Max 8 of each consumable; the shop says "the prop table is full" rather than silently refusing.

### Pins (10)

| Pin | Effect |
|---|---|
| **Spring Heel** | Jump +1 damage |
| **Brass Knuckle** | Hammer perfect window +20 ms |
| **Understudy's Ribbon** | Start battle with 20 applause |
| **Dog-ear** | First hit each battle +2 |
| **Red Thread** | Partner acts twice on the first round |
| **Blotting** | Immune to Damp |
| **Stage Fright** | Enemy's first attack deals -1 |
| **Cue Card** | Enemy HP shown as numbers |
| **Encore** | Showstopper leaves 25 applause |
| **Paper Cut** | Perfects apply Torn |

Pins are physical: a pin cushion screen, each pin a cut-paper object pushed through the card. Equipping is
dragging a pin to one of three holes. No menus within menus.

---

## 8. Enemies and bosses

### Regular enemies (12)

| Enemy | HP | Atk | Def | Weak | Resist | Behaviour |
|---|---|---|---|---|---|---|
| Prop Rat | 4 | 1 | 0 | Tear | Ink | nibbles; flees at 1 HP (comedy) |
| Hand Puppet | 6 | 2 | 0 | Tear | — | slap; hides behind the other hand |
| Footnote Mite | 3 | 1 | 0 | Ink | Damp | swarm: +1 atk per living mite |
| Ink Blot (small) | 5 | 2 | 1 | Damp | Ink | splat applies Damp |
| Paper Wasp | 6 | 3 | 0 | Tear | Gilt | dive; telegraphs one round ahead |
| Curtain Moth | 5 | 2 | 0 | Gilt | Damp | dust applies Smudged |
| Set Piece | 12 | 3 | 3 | Tear | Ink | rams; high def, low HP for its size |
| Stagehand Sprite | 8 | 3 | 1 | Ink | Tear | hammer; guards on odd rounds |
| Fold Hound | 9 | 3 | 1 | Damp | Tear | bite applies Creased |
| Margin Worm | 7 | 2 | 0 | Ink | Damp | burrows; ambush ignores guard once |
| Gilt Beetle | 14 | 2 | 4 | Tear | Gilt | armoured; opens after a perfect parry |
| Eraser Shaving | 6 | 2 | 0 | Ink | Tear | strips one buff per hit |

Encounters are 1-3 enemies, authored per room, never random. An ambush (touching an enemy from behind, or
folding onto it) gives the first strike; being seen gives the enemy a cue-card head start.

### Bosses

**The Blot (Act I)** — 60 HP, 3 phases.
1. *Puddle:* low, immune to jump; must use hammer or ink-damp items; floods the stage (Damp everywhere).
2. *Costume:* rises into a paper costume of the missing Lead; gains a Tear attack; weak to Damp.
3. *Panic:* splits into three small blots; the Showstopper changes the set to the market and dries it.
Teaches the Showstopper. Generous timing.

**The Understudy (Act II)** — 80 HP, 2 phases, flees at 40%.
1. *Mirror:* copies Pip's last action; the player must use the partner to break the mirror.
2. *Scissors:* cuts one platform per round; the arena loses ground (visual, not a fail state).
Scripted escape: at 40% they cut the bridge. Cannot be defeated here.

**The Understudy, true form (Act III)** — 110 HP, 3 phases.
1. *Your pins:* wears copies of the player's equipped pins; each perfect hit knocks one off (visual).
2. *The audience:* cuts the front row away one by one; applause gains halve; the meter becomes precious.
3. *Blank:* stops attacking, starts erasing the set; the player must fold the arena around them (a
   puzzle-boss interlude: 3 fold prompts under time pressure from a slow erase).

**The Blank (finale)** — no HP bar.
- A spreading white field that erases floor, then props, then the audience.
- The player folds four printed corners of the page over the centre, each fold narrowing the field.
- Enemies spawn as "resistances" (Eraser Shavings) that must be cleared between folds.
- Ends with the page folded shut; the Understudy is left on a clean sheet with one line: "write your own."

---

## 9. Content budget and writing

| Content | Target |
|---|---|
| Rooms | 19 core + 3 secret |
| Cutscenes | 8 |
| Battle encounters | 22 authored (no random) |
| Enemy types | 12 + 3 bosses + 1 puzzle-boss |
| Items | 10 |
| Pins | 10 |
| NPCs with dialogue | 12 |
| Dialogue lines | 450-600 |
| Words of story text | 8,000-11,000 |
| Play time | 80-100 min |

### Voice

- **Pip:** silent; gestures, a tilt of the head, a scarf flutter. Choices are two wordless options shown
  as small drawn cards (a jump arrow, a shrug).
- **Marla:** short sentences, apologises, then stops. "Sorry. I'll carry it."
- **Quill:** long sentences, self-corrects in the margin. "As I noted — no. As I *should* have noted."
- **The Prompt:** stage directions as panic. "Enter stage left. ENTER. STAGE. LEFT."
- **The Understudy:** polite, formal, devastating. "You have the lines. I have the timing."
- **The Audience:** one line each at the peak; simple, specific, human.
- **Narration:** almost none. The set does the talking.

Rules: no exposition about the Blank beyond what a character would say; no proper-noun soup; every room
has one joke and one piece of heart; nothing explains the theme out loud until the finale, once.

---

## 10. Visual direction

### The look in one line

A photographed pop-up theatre: cream page, printed flats with real cut edges, dead matte, warm key from
stage left, cool footlight rim from the front, an audience blurred at the bottom edge, and a macro lens
that makes every piece feel six inches tall.

### Palette per act (derived, not copied)

| Role | Act I Market | Act II Wood | Act III Blank |
|---|---|---|---|
| Page / paper | `#f1e6cc` | `#ece3c6` | `#f7f2e4` |
| Ink | `#2e231a` | `#2a2119` | `#2a2119` |
| Lead family | `#35506e` blue | `#5b6b3c` moss | `#fbf8ee` blank |
| Lead light | `#6f8ba3` | `#8a9a5e` | `#ffffff` |
| Accent 1 | `#c99a3f` ochre | `#cf8f3e` amber | `#c8a13a` gilt |
| Accent 2 | `#bf5a42` coral | `#3d7a70` teal | `#d2604a` coral |
| Kraft / back | `#b98b5e` | `#a97c4f` | `#cbb79a` |
| Shadow tint | `#6a4a33` | `#4a3a26` | `#837c8e` |

Ground is always ~0.16-0.22 lighter and less saturated than the pieces; pieces carry the colour. Act III
is the exception the brief names: a white world, so the pieces are pale and the shadows do the work.

### Light

```text
key       #ffd9ae, azimuth -40 deg from camera, elevation 48 deg, intensity 3.0
fill      #efdcc4, 1/3 of key, from camera-right, low
footlight #9fc3d6, a cool rim from below/front, 0.25 (the stage's own light)
shadows   tinted per act (table above), penumbra 0.2-0.3 x gap, contact darkening on every standing piece
```

No glow, no bloom, no vignette, no colour fog. Act III may use a single practical (a work light) as the
key, with the footlight stronger.

### Lens

| | Desktop 16:9 | Portrait phone |
|---|---|---|
| FOV vertical | 27 deg | 30 deg |
| Pitch | 46 deg | 44 deg |
| Camera dist | 66 units | 58 units |
| Sharp band | 0.40 | 0.42 |
| Max blur | 14 px @1080 | 10 px @1080 |
| Foreground | 4-6 audience silhouettes, blurred | 2-3, softer |

### Sets

Every room is a **proscenium set**: a top border (a painted valance or a rope rig), side masking flats,
a printed deck, and a painted backdrop that is clearly paper (visible brush layers, a torn edge where the
set meets the floor). The camera looks down into the set from the house, so the fourth wall is the audience.

- Prologue: bare boards, a single work light, dust.
- Act I: market flats with awnings, crates, a well of ink; warm and busy.
- Act II: origami pines (crossed cards), a canyon of folded strata, the mill with moving belts.
- Act III: white page, pencil marks, a single red thread, the audience as dim shapes.

### Characters

- Cards with thickness 2-3% of height, a dark cut line, a pale highlight on lit edges only.
- Pip: 12-16 cards; readable silhouette (ears, scarf, tail); 6 poses (idle, walk, jump, hammer, hurt,
  flat) + 4 face stamps (neutral, determined, surprised, soft).
- Partners: 10-14 cards each; one signature prop (hammer, pen).
- Enemies: 6-10 cards; one strong silhouette each; bosses 25-40 cards and 2-3 hinge groups.
- Animation law: hinge rotation only; 8-15% overshoot; settle by ~1 s; stagger 0.05-0.1 s; never scale or
  stretch; continuous motion subtle (bob halved from instinct).

### UI as paper

- **Title:** a playbill pasted on the page, torn edge, "INKFOLD", "a paper adventure in three acts",
  *begin / continue*, a small print of the cast.
- **Dialogue:** a speech card with a torn top edge, ink type, a small portrait stamp; advances on tap;
  auto-advance off by default.
- **Battle HUD:** a ticket stub per character (HP punched holes, Ink as a well that empties), cue cards
  above enemies, a spotlight arc for applause.
- **Menus:** a physical sheet sliding over the scene (paper-ui.md section 3), atlas-plate frame, ink rules.
- **Inventory:** a prop table; items as cut-paper objects with a small label.
- **Pins:** a pin cushion; drag pins into three holes.
- **Map:** a stage plan (ground plan) with room names in small caps; only visited rooms.
- **Save:** a ticket with the act, room, time, and a torn number.
- **End card:** a curtain-call card with time, applause peak, pins found, and the share strip.

### Typography

- Vendor two open-licence fonts (OFL) in `games/inkfold/fonts/`: **Fraunces** (display, static 600/700
  subset) and **EB Garamond** (body, 400/400italic). Subset to Latin + punctuation to stay under
  ~220 KB total; include the licence files.
- Fallback stack: Georgia, 'Times New Roman', serif.
- Scale (CSS px): 11 label / 13 small / 15 body / 18 dialogue / 24 subhead / 34 display / 48 title.
- Small caps and 0.14-0.18em tracking for labels; never all-caps body text.
- Ink is `#2e231a`, never black; links and buttons are ink with a hand-drawn underline, not blue.

### Iconography

Cut-paper icons per paper-ui.md section 4: 2-3 layers, one rim, no text inside, readable at 18 px.
Elements: Ink = a drop; Tear = a zigzag rip; Damp = a wavy sheet; Gilt = a four-point star.
Statuses: fold, drop, thumbprint, rip, star, flat card.

---

## 11. Audio

### Direction

Music leads, paper punctuates (sound.md section 1). Soft, dry, low, quiet, sparse. Nothing loops
obviously; nothing plays constantly.

### Music (5 cues, 16-24 bars, loopable)

| Cue | Where | Instrumentation |
|---|---|---|
| *House* | title, prologue | felt piano, room tone, a distant audience |
| *Market* | Act I hub | plucked strings, woodblock, a warm bass |
| *Wood* | Act II | low flute, paper rustle percussion, a slow pad |
| *Battle* | regular battles | pizzicato bass, tap kit, a rising figure |
| *Blank* | Act III, finale | a single sustained tone, breath, reversed piano |

Implementation: carry a small **score data file** (note events: pitch, start, length, velocity, instrument)
and synthesize with WebAudio primitives (the paper-sound chain for paper layers; simple oscillators +
filtered noise for the rest). **No audio files** unless a licensed track is chosen later. Budget: 5 cues x
~24 bars x 2-3 stems. If this slips, ship ambience + stingers and add the battle theme only — but do not
ship silence.

### SFX (procedural, paperkit + paper-sound)

| Sound | Recipe | Level |
|---|---|---|
| Flap / page turn | `synthFlap`, size by element | 0.13 x (0.85 + 0.15 size) |
| Footstep | `synthStep`, deck surface | 16 dB under a flap |
| Stamp / seat | a short low thump + paper tick | -12 dB |
| Scissors snip | two filtered noise transients, bright | rare, -8 dB |
| Tear | 0.3-1 s dense clusters, rising | boss only |
| Ink drip | a sine plop with a pitch drop | -18 dB |
| Applause | 12-20 band-passed noise bursts, 0.6 s | -14 dB, swells with the meter |
| Curtain | a long low rustle, 1.2 s | transitions |

### Mix rules

- One sound per gesture, at least 0.5 s apart; nearest and largest wins (sound.md section 6).
- Music at -18 LUFS-ish; SFX peaks under -6 dB; paper never dominates.
- Mute and volume persist in the save. Audio unlocks on first tap (browser rule); a small ink speaker
  icon shows the state.
- All audio must be generated after a gesture; no autoplay attempts, no console warnings.

---

## 12. Technical architecture

### Stack

- three.js **r187 vendored** (`assets/vendor/three.module.js` + `three.core.js`), importmap as in
  paperfolk: `"three": "../../vendor/three.module.js", "papercraft/": "../../"`.
- `paperkit-3d.js` for cards, prints, hinges, lights, lens (`PaperPost`), walk field.
- `paperkit-2d.js` for sheet textures, torn edges, icon prints, UI art.
- `paper-motion.js` for springs; `paper-sound.js` for SFX.
- `harness.js` copied from `games/paperfolk/harness.js` into `games/inkfold/harness.js`, adapted only
  where marked. Never edit the original.
- No framework. DOM for text and menus (crisp, accessible), canvas/WebGL for the world.

### Module layout

```
games/inkfold/
  index.html            shell, importmap, HUD/menu containers, font faces
  harness.js            copied + adapted (camera, lens, fixed clock, walk)
  main.js               boot, loop, input, scene manager, save/load, hooks
  world.js              room runtime: build, enter/leave, fold/flip, interactions
  battle.js             battle state machine, actions, timing, applause, AI
  ui.js                 DOM screens: dialogue, menus, shop, pins, map, end card
  art/
    prints.js           paint functions per material/character (large, split if needed)
    sets.js             room set builders (flats, decks, dressing)
  data/
    rooms.js            19+3 room definitions (geometry, exits, spawns, props)
    enemies.js          stats, patterns, cue cards
    items.js            items + pins
    dialogue.js         all lines, keyed by flag
    score.js            music note data
  fold.js               room-scale fold geometry (adapted from games/crease/geometry.js)
  save.js               versioned localStorage + export/import
  share.js              score card + links (reuse pattern from paperfair)
  fonts/                Fraunces + EB Garamond subsets + OFL licences
```

Keep each file under ~1,200 lines; split `prints.js` by act if it grows. One global namespace only for
hooks (`window.__inkfold`).

### Update model

- Fixed timestep **1/60 s**, accumulator, clamp dt to [0, 0.05] (SKILL.md section 9). All springs
  sub-step at 1/240.
- Battle timing is frame-indexed, not wall-clock. Inputs are timestamped into a 120 ms buffer and
  resolved at the action frame; never read `performance.now()` inside resolution.
- Room transitions pause the simulation; the page-turn animation runs on the same fixed clock.
- Every random choice (decoration, audience fidget, dust) uses a seeded `rng` from the room id + save
  seed. Combat has no randomness.

### Rendering budget

| Item | Budget |
|---|---|
| Draw calls | < 150 in a gameplay frame, < 220 in a boss frame |
| Print build per room | < 1.2 s on a mid phone, < 0.6 s desktop |
| Texture memory | < 90 MB |
| Frame time | 16.6 ms target, 33 ms floor; tier 2 phones get DPR 2, 1024 shadow map |
| Payload | < 2.5 MB total (JS ~900 KB, fonts ~220 KB, no images) |

Techniques:

- Build a room's prints **lazily** on entry, cache the current + previous room, dispose the rest
  (geometry, materials, textures). Watch canvas memory; prints are large.
- Bake the deck/backdrop into one ground print per room (as the template does), not per tile.
- Far/background pieces print at reduced resolution (`effects: 0` or `res 0.6`); mobile uses 0.85 for
  in-frame pieces (paperfolk's measured fix) and no foreground giants.
- Shadow map 2048 desktop / 1024 phone; one shadow-casting key.
- `PaperPost` lens: desktop authored; mobile softer (section 10).
- Cap DPR at 2. Never render at DPR 3.

### Input

- Pointer events with capture; `touch-action: none` on the canvas; page pinch/double-tap disabled only on
  mobile; keyboard listeners on `window`.
- Virtual stick appears where the thumb lands inside the lower-left quadrant; dead zone 8 px; no
  visible stick until touched (a faint ink ring after 120 ms).
- Context action priority: talk > pull > fold > flip > jump. The label always says which.
- Hold-to-flip is not used (accidental); flip is a tap.
- Menus are DOM; focus trapped while open; Esc/tap-outside closes; state pauses.

### Error handling

- A visible paper "the page tore" card on a fatal error, with a reload button and the error text behind
  a "details" fold. Never a blank screen.
- Try/catch around save/load and audio unlock; failures degrade, never block play.
- Guard against a missing WebGL context: an honest static apology page (the 2D fallback is not worth
  maintaining for this game).

### Hooks (required)

```js
window.__inkfold = {
  state(),                  // { act, room, flags, hp, ink, buttons, pins, partner, playtime }
  warp(roomId, opts),       // load a room at a spawn
  battle(enemyId),          // start an authored encounter
  act(action, quality),     // 'jump'|'hammer'|'guard'|'flourish' with 'perfect'|'good'|'late'
  choose(index),            // dialogue choice
  advance(),                // dialogue advance
  fold(id), flip(),         // traversal
  save(slot), load(slot), resetSave(),
  step(sec), restart(),
  layout,                   // CSS-px rects of buttons/HUD for tests
};
window.__papercraft = { step: (s) => __inkfold.step(s), restart: () => __inkfold.restart() };
```

### Query params

`?room=`, `?battle=`, `?act=`, `?seed=`, `?debug`, `?nofx`, `?still`. Debug shows hitboxes, walk field,
timing windows, and a room warp list; never shipped as the default.

---

## 13. Data schemas

Keep data plain and editable. Shapes (JSDoc, not TypeScript):

```js
/** Room */
{
  id: 'i1-market',
  act: 1,
  name: 'Inkwell Market',
  seed: 101,
  camera: { dist: 66, pitch: 46, target: [2, 1.5, -6], fov: 27 },
  bounds: { x0: -40, x1: 40, z0: -30, z1: 22 },
  walk: { x0: -18, x1: 18, z0: -14, z1: 10 },
  exits: [{ to: 'i2-queue', at: [14, 8], facing: 0, trigger: 'door' }],
  spawns: { default: [0, 6], fromI2: [14, 6] },
  props: [/* { kind, x, z, rot, variant, solid, interact } */],
  folds: [{ id: 'awning', poly: [[..]], crease: [[..]], flap: 1, kind: 'ramp', walkAfter: [] }],
  enemies: [{ id: 'hand', at: [4, -2], patrol: [[..]], seen: false }],
  flagsOnEnter: ['market-visited'],
  music: 'market',
}
```

```js
/** Enemy */
{
  id: 'wasp', name: 'Paper Wasp', hp: 6, atk: 3, def: 0,
  weak: 'tear', resist: 'gilt', size: 0.55, cards: 8,
  pattern: [
    { move: 'hover', tell: 'wasp-hover' },
    { move: 'dive', tell: 'wasp-dive', damage: 3, window: 'guard' },
  ],
  cue: { icon: 'dive', target: 'random' },
  drops: [{ item: 'ink', chance: 1 }],
  tags: ['flying'],
}
```

```js
/** Dialogue node */
{ id: 'marla-first', speaker: 'marla', pose: 'shy',
  lines: ['Sorry. I was under the flat.', 'You need a hammer. I have a hammer.'],
  choices: [{ text: 'nod', next: 'marla-joins' }, { text: 'shrug', next: 'marla-joins' }],
  set: ['marla-joined'], next: null }
```

```js
/** Save (versioned) */
{
  v: 1,
  seed: 20261123,
  act: 1, room: 'i1-market', spawn: 'fromP2',
  flags: { 'marla-joined': true, 'blot-defeated': false },
  stats: { hp: 15, maxHp: 15, ink: 10, maxInk: 10, buttons: 12 },
  pins: ['spring-heel'], slots: 2,
  partner: 'marla', partnerHp: 8,
  items: { tape: 2, inkwell: 1 },
  discovered: { ink: true, tear: false, damp: true, gilt: false },
  settings: { difficulty: 'evening', assist: false, music: 0.7, sfx: 0.8, text: 1 },
  playtime: 1420,
  checkpoint: { room: 'i1-market', at: [0, 6] },
}
```

Save rules:

- Key `inkfold.save.v1`; 3 slots + autosave, all in one JSON object under the key.
- Write on room enter, battle victory, shop purchase, and menu close; never every frame.
- On parse failure or version mismatch: keep the broken string under `inkfold.save.broken`, show a gentle
  "the page was smudged" notice, offer a new page. Never silently wipe.
- Export: base64 of the JSON in a copyable code; import validates shape and version. No server.
- Playtime accumulates in seconds, capped at 10 hours, displayed h:mm.

---

## 14. Performance and mobile

- **Portrait first.** Author the phone layout; the desktop layout is the phone layout with more margin
  and larger type, not a different game.
- Phone layout: canvas full-bleed under the DOM; controls inside `env(safe-area-inset-*)`; page height
  `100dvh`; no scroll; text sizes in section 10; tap targets >= 44 px.
- Desktop: the same stage centered, max content width 1180 px; the page's margins hold the menu/program.
- Test both at every milestone on a real phone if possible; at minimum the Playwright emulation in
  section 17.
- Quality tiers resolved before the harness: tier 1 (desktop, GPU) 2048 shadows, DPR 2, full prints;
  tier 2 (phone) 1024 shadows, DPR 2 capped, 0.85 prints, softer lens, no foreground giants; tier 3
  (weak) 1024 shadows, DPR 1.5, no MSAA, 0.7 prints, fewer audience.
- Never block the first frame on all prints: enter a room with the deck and hero printed, dress in the
  same frame, and let the background fill print over the next 200 ms if needed. The clock does not start
  until the room is ready (a 0.4 s curtain covers it).
- Memory: dispose prints on room change; keep a 2-room cache; log texture count in `?debug`.

---

## 15. Accessibility

- **Timing assist** (Matinee): +2 frames on every window, enemy damage -1, guard window +4 frames. On by
  default on first run on a phone? No — offer it on the title, remember the choice.
- **Reduced motion:** no camera dolly on battle entry, no page-turn rotation (a 120 ms crossfade instead),
  shorter overshoots, no audience sway. Respect `prefers-reduced-motion` and a toggle.
- **Text:** 3 sizes (1.0/1.15/1.3), high-contrast ink option, no text over busy art (all text on cards).
- **Colour:** elements and statuses always carry an icon and a shape, never colour alone; test in
  greyscale.
- **Keyboard:** full play with arrows/WASD, Space, Enter, Esc, F, E; visible focus ring in ink; menus
  navigable; no keyboard trap.
- **Audio:** all cues have a visual counterpart (applause meter, cue cards); captions for non-speech
  sounds? Not needed, but a "sound cues" line in settings.
- **Pause:** any time, including cutscenes; resume from the same frame.
- **No flashing:** nothing strobes; the Blank spreads over seconds, never frames.
- **Readability:** dialogue advances on tap only; no auto-advance; no timers in menus.

---

## 16. Save, share, and the no-backend promise

- Saves are local, private, and exportable as a code. No account, no cloud, no sync.
- A "continue" on the title reads the autosave; slots are for the player's own branches.
- **Share card** (reuse the paperfair pattern): a 1080x1080 PNG, cream, ink neatline, the act crest, the
  time, the peak applause, pins found; caption "I reached the curtain in Inkfold — 1:24:06, 7 pins.
  Beat me:" + `https://play.buildquietly.com/games/inkfold/?ref=share`.
- Native share sheet with the file where supported; X/WhatsApp/Telegram intent links; Instagram routes
  through the native sheet or downloads the card with a toast (documented honestly in the UI).
- No analytics, no beacons, no third-party requests. Fonts are local. The only network is the page load.

---

## 17. Testing protocol

Every milestone runs this, at **390x844 touch** and **1440x900 desktop**, with Playwright (chrome
channel, GPU flags), a fresh context per case, and `?seed` fixed.

### Smoke (every build)

1. Load with no console errors and no page errors.
2. Title -> new game -> Prologue room 1 renders; hero visible; walk 200 px with the harness step clock.
3. Open and close each menu; no focus loss; save roundtrip (save, reload, continue) restores room, HP,
   flags, pins.
4. Resize to 390x844 and 1440x900 mid-room; layout reflows; no scrollbars; no clipped text.
5. Screenshot set: every room, title, battle, menu, end card; review at 100% and 3x crops.

### Mechanic proofs

```js
// flip: Pip goes flat, passes a gap he cannot walk through
warp('p2-backstage'); flip(); step(0.4);
state().flat === true;                       // and walk through the low door -> room flag set
// fold: a floor panel becomes a ramp, the walk field changes
warp('i2-queue'); fold('awning'); step(0.5);
state().folds.awning === 1;                   // hero can now reach the upper deck
// battle timing: a perfect jump
battle('prop-rat'); act('jump','perfect'); step(0.4);
state().battle.lastHit === 'perfect';          // damage = round((2+0)*1.5-0) = 3
// guard: perfect parry counters for 1
battle('hand-puppet'); act('guard','perfect'); step(0.6);
state().battle.lastGuard === 'parry';          // hp unchanged, enemy hp -1
// applause + showstopper
battle('blot'); /* four perfects */ state().battle.applause === 40; ...
// save schema
save(1); const a = state(); reload(); load(1); deepEqual(state(), a);
```

### Content proofs (per act)

- Every room reachable in one continuous run; no soft-lock; no exit without a return path.
- Every fold puzzle reversible; every flip point has headroom to stand.
- Every battle winnable at Matinee with the authored loadout, and not trivial at Gala.
- Every cutscene skippable and replayable.
- All 10 pins obtainable; no pin required to finish.
- No text overflow on a phone (measured DOM bounding boxes), no orphaned lines.
- 60 fps average in the hub and a battle on tier 2; room build under 1.2 s.

### Acceptance per milestone

A milestone is done when: the build is playable start to end of its scope, the smoke tests pass, the
mechanic proofs for anything new pass, the screenshot set is reviewed, and this file is updated with any
changed decision. "It compiles" is not done.

---

## 18. Build milestones

Each milestone is one or two focused sessions, each ends playable and verified, each can ship (unlisted
until the finale). The order front-loads risk.

### M0 — Foundations (1-2 sessions)

- Copy `harness.js`, wire the importmap, fonts, shell, fixed clock, input, save stub, hooks, title.
- One test room with the hero, a deck, a flip, and a fold.
- **Proof:** walk, flip, fold, save roundtrip, 60 fps phone. Nothing else.

### M1 — Vertical slice: the Prologue (2 sessions)

- Rooms P1-P3, the Prompt, dialogue, the first battle (Prop Rat), the Blank cutscene, the end of the
  slice card, save/continue.
- **This is the quality bar.** If the slice does not feel good, stop and fix it before Act I.
- **Proof:** 10-12 minutes playable; battle timing tuned; mobile controls comfortable; screenshots.

### M2 — Act I (3-4 sessions)

- Market hub, 4 dungeon rooms, 4 enemy types, Marla, shop, inn, heart/ink pickups, the Blot boss with
  three phases and the Showstopper, the ink-returns set change.
- **Proof:** 25 minutes from P3 to the Act I curtain; difficulty curve measured; hub NPC lines.

### M3 — Act II (3-4 sessions)

- Wood, Crease, Mill, Understudy's Wing, Cut Bridge; Quill; 4 more enemies; fold puzzles at scale; the
  rival duel that cannot be won; the crane cutscene.
- **Proof:** all fold puzzles reversible; the duel's scripted escape cannot soft-lock.

### M4 — Act III and the finale (3-4 sessions)

- Blank, Prompt Box, Spine, Last Page, finale; 4 enemies; the audience mechanic; the puzzle-boss; the
  ending and the Understudy's page; credits.
- **Proof:** the finale playable at all difficulties; the ending cutscene skippable and replayable.

### M5 — Content complete and polish (2-3 sessions)

- All 3 secret rooms, all 10 pins, all items, the program/map, new game+, balance pass, accessibility
  pass, music cues, mix, performance pass, text proofread.
- **Proof:** full run 80-100 minutes; all section 17 content proofs.

### M6 — Ship (1 session)

- Landing card 04, share card, README, deploy, the X clip (30-45 s) and three short clips.
- **Proof:** live URL on phone and desktop; share links decode; no console errors on a fresh load.

Total: **15-20 focused sessions.** If the schedule slips, cut scope in this order: secret rooms, music
cues (keep one), Act III's fourth enemy type, the Gala difficulty. **Never cut:** the battle timing feel,
the flip/fold traversal, the audience, or the ending.

---

## 19. Risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Scope creep (RPG = content) | The #1 killer; 19 rooms is already a lot | Milestones; each act is shippable; cut order defined; no sidequests |
| Character animation cost | Pip needs to read in 6 poses + flat; partners too | Silence + gesture for Pip; 6 poses only; expression as face stamps; no lip sync |
| Timing feel on touch | The battle lives or dies here | Frame-indexed windows, 120 ms buffer, Matinee assist, test on a real phone at M1 |
| Fold/flip readability | Novel verbs can confuse | One-button context labels; always reversible; first use in a safe room; no timed folds outside the finale |
| Print build cost per room | 19 rooms x hundreds of cards | Lazy build, 2-room cache, low-res background, mobile 0.85 prints |
| Battle balance | Fixed numbers make mistakes obvious | Author a damage table; simulate every encounter at M2; keep def low |
| Story tone | Paper comedy can become twee | Voice guide; one joke + one heart per room; the audience grounds it |
| Music scope | 5 cues is a real composition job | Note-data + synth; ship ambience + battle theme if needed; never silence |
| Save corruption | Losing a 90-minute run is unforgivable | Versioned save, autosave on room enter, broken-save quarantine, export code |
| Phone heat/battery | Long sessions on a 3D scene | Tier 2 caps, no continuous full-screen post, pause when hidden, 60 fps target not 120 |

---

## 20. Promo plan

- **Trailer (30-45 s):** the Empty House; a flip under a door; a floor folding into a ramp; the market
  in colour; the Blot; the Understudy's scissors; the audience; the blank page folding shut. End on the
  title and the URL.
- **Three clips (8-15 s each):** (1) flip through a gap, (2) fold the floor and cross, (3) a Showstopper
  set change. Silent, captioned, vertical 1080x1920 and 16:9 cuts.
- **Share card:** act crest, time, peak applause, pins; the same paper system as the other games.
- **Landing:** card 04 on the shelf, one line: "a pop-up RPG in three acts — fold the world, flip flat,
  take the stage."

---

## 21. Definition of done

- A new player can start, play 80-100 minutes to the curtain, and never see a console error, a soft-lock,
  or a lost save.
- The three verbs are used at least four times each in ways that could not exist in a non-paper game.
- A battle at minute 5 and a battle at minute 80 look and feel different (sets, applause, pins).
- The phone build is the primary build: controls reachable, text readable, 60 fps, no zoom, no scroll.
- The desktop build is the same game with more air, not a port.
- All text proofread; all 10 pins and 10 items obtainable; all 3 secrets findable with in-character hints.
- The share card generates a valid PNG and the links carry the exact caption and `?ref=share`.
- The landing page lists it, the deploy is live, and the trailer exists.
- This document is updated to match what was actually built.

---

## Appendix A — Paper spec per act (fill before building each act)

```text
BRIEF      act, place, time, weather (if any), mood, must-haves, must-nots, references
SUBJECT    the set and its twist; what the player looks at first
STOCK      page cardstock, kraft backs, tissue for light, vellum for the Blank, corrugated for the mill
PALETTE    the act's 8 hexes from section 10, with roles
LIGHT      key, fill, footlight, shadow tint, practicals
LENS       fov, pitch, band, blur, foreground
FORMAT     1920x1080 and 390x844 authored; 1080x1920 for clips
GROUND     the deck: boards, cobbles, forest floor, mill plates, blank page
LAYOUT     leading line, landmarks, hero spawn, groups, clearings, 15-25 piece kinds
MOTION     hinges, rise/fall, stagger, idle sway, camera behaviour, page turns
LIFE       audience, dust, birds, ink drips, paper curls (3-5 kinds)
TYPES      structure types per piece
SOUND      cue, SFX set, levels
BANNED     gloss, glow, horizon, straight ground edges, stamped clones, modern chrome
QA         frames, rooms, sizes, what each must show
```

## Appendix B — Locked numbers

| Thing | Value |
|---|---|
| Hero height | 3.6 units |
| Walk speed | 1.9 H/s (6.8 units/s) |
| Accel | 90% in 0.06 s |
| Turn rate | 13 rad/s |
| Flip duration | 0.25 s (camera 0.5 s) |
| Fold duration | 0.4 s |
| Fold overshoot | 8-15% |
| Springs | sub-step 1/240 s |
| Battle perfect | +-3 frames (50 ms) |
| Battle good | +-6 frames (100 ms) |
| Guard parry | +-2 frames (33 ms) |
| Input buffer | 120 ms |
| Applause max | 100 |
| Perfect applause | +10 |
| Showstopper damage | 15-20 |
| HP cap | 30 |
| Ink cap | 20 |
| Pin slots | 3 |
| Save key | `inkfold.save.v1` |
| Max payload | 2.5 MB |
| Room build | < 1.2 s phone |
| Draw calls | < 150 normal, < 220 boss |

## Appendix C — File layout and ownership

```
papercraft/
  implementation_plan.md                  this file
  skills/papercraft/assets/
    games/crease/                         shipped puzzle; source of fold geometry
    games/inkfold/                        the RPG (new)
    games/paperfair/                      arcade; share + HUD reference
    games/paperfolk/                      hidden object; harness + mobile gating reference
    index.html                            shelf: add card 04 at M6
    vendor/three.*                        untouched
    lib/*                                 untouched
```

Rules: never edit `lib/`, `examples/`, `templates/`, the vendor files, or another game. Copy what you need
into `games/inkfold/` and adapt there.

## Appendix D — Copy and tone guardrails

- Sentence length: short. One idea per line of dialogue.
- No exclamation marks except the Prompt, who is panicking.
- No "as you know"; no explaining the Blank twice.
- The Understudy never sneers. Politeness is the threat.
- The audience's lines are the plainest in the game; they are the emotional floor.
- One joke and one heart per room. If a room has neither, cut the room.
- The last line of the game is not a joke.

## Appendix E — Reference map

| Question | Read |
|---|---|
| Paper laws, spec, workflow | `SKILL.md` sections 1, 3, 5, 8 |
| Character rigs and gait | `references/motion.md` section 8 |
| Hinges, folds, built ground, walk field | `references/mechanisms.md` sections 2, 3, 14 |
| Room composition, density, sizes | `references/worlds.md` sections 8-9 |
| Sets, cuts, edges, prints | `references/procedural-art.md` section 3 |
| Light, lens, shadow, ban list | `references/look.md` sections 8b, 11, 12 |
| UI as paper, icons, dialogs | `references/paper-ui.md` sections 2-6 |
| Phones, dynamic viewport, safe areas | `references/formats.md` section 8 |
| Sound levels, flap recipe, mixing | `references/sound.md` sections 3-6 |
| Scene build cost, lens, prints | `references/three-js.md` sections 8-10 |
| Palettes | `references/palettes.md` section 3 |
| Planning and critique rounds | `references/process.md` sections 2, 6 |

---

*End of plan. Update this file when a decision changes; never let code and plan disagree silently.*
