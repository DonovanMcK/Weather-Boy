# DER WETTERJUNGE ("The Weather Boy") — Design Document / Revised Build Prompt

> This is the revised, fully-specified version of the original request:
> *"Build a Black Ops 1/2 style zombies first-person shooter, playable locally, in 3D,
> with wall buys, rounds, rebuildable barriers, magazines, two guns, perk colas,
> Pack-a-Punch (with camos), a mystery box, Der Riese-style teleporters, monkey bombs,
> power-ups, and a special zombie round every ~5 rounds that ends in a Max Ammo."*

---

## 1. Vision

A faithful, self-contained homage to Treyarch's round-based Zombies mode
(Black Ops 1 era: Kino der Toten / Der Riese pacing and economy), built as a
browser game with Three.js. Zero build step, zero network dependency, zero assets —
**double-click `index.html` and play**. Visuals are deliberately low-poly
("PS1 night-time bunker" aesthetic): box-people zombies with glowing eyes, fog,
colored point lights, procedural textures. All audio is synthesized with WebAudio.

**Theme:** an abandoned mountaintop weather research station (a nod to the repo
name *Weather-Boy*), Group-935 style. Map name: **Der Wetterjunge**.

## 2. Platform & Constraints

- Single-player, local, offline. Plain ES5/ES2017 scripts (no modules) so the
  game runs from `file://`. Three.js r160 (UMD) vendored in `lib/`.
- 60 FPS target on integrated graphics: ≤ 24 zombies alive, no shadow maps,
  merged/simple geometry, pooled effects.
- Pointer Lock API for mouselook; DOM overlay for HUD.

## 3. The Map (Der Riese-style layout)

Grid-built (4 m cells), 8 zones connected by purchasable debris doors:

```
            [RADAR DOME]  ← power switch + Teleporter C + Stamin-Up
                 |d7 1750
[LAB]──d5──[ COURTYARD ]──d6──[STORAGE]
 Tele-A     Mainframe pad      Tele-B
 Speed Cola  Pack-a-Punch       Double Tap
 1250        (force-field)      1250
                 |
        d3 1250 / \ d4 1250
        [HALL A]   [HALL B]   ← L-shaped corridors, Mule Kick in B
        750 d1 \   / d2 1000
            [ SPAWN ROOM ]    ← Quick Revive, M14 + Olympia walls
```

- **10 barricaded windows** (6 boards each) + ground "riser" spawns in the courtyard.
- **Doors**: wooden debris slabs; pay once, they sink away permanently; opening a
  door adds its rooms to the zombie spawn pool.
- **Power**: switch in the Radar Dome. Before power: dim blue emergency light, perks
  (except Quick Revive) and teleporters are dead. After: warm lights, machines hum.

### Teleporters & Pack-a-Punch (Der Riese flow)
1. Turn on power.
2. At any teleporter pad, press F (free) → 30-second link window starts.
3. Sprint to the **mainframe pad** in the courtyard, press F → teleporter LINKED (permanent).
4. Link **all three** → the force field around Pack-a-Punch drops for the rest of the game.
5. Any linked teleporter can be used for **500 points** to instantly zap back to the
   mainframe (escape tool).

## 4. Player

| Stat | Value |
|---|---|
| Health | 100 (250 with Juggernog), regen after 3.5 s out of combat |
| Walk / sprint | 4.4 m/s / ×1.5 (Stamin-Up ×1.16 more) |
| Hits to down | 2 (5 with Juggernog) — zombies hit for 50 |
| Knife | V key, 150 dmg, 130 points per kill |
| Frags | G key, max 4, arc + bounce + 3 s fuse, can make crawlers |

**Down / Quick Revive (solo rules):** with Quick Revive you black out ~5 s, get
back up with full health but **lose all perks** (QR consumed; purchasable 3
times per game). Without it: Game Over screen (round, kills, points, best-round
saved to localStorage).

## 5. Economy (classic point values)

+10 per bullet hit · +60 bullet kill · +100 headshot kill · +130 knife kill ·
+50 explosive/wonder kill · +10 per board rebuilt. Costs: doors 750–1750,
wall guns 500–1500, box 950, perks 500–4000, Pack-a-Punch 5000, teleport 500.

## 6. Weapons

- **Two-gun limit** (three with Mule Kick), magazine + reserve ammo, per-gun
  reload times (halved by Speed Cola), hip spread, headshot multipliers,
  semi/auto/pump trigger types, viewmodel bob/recoil/muzzle-flash/tracers.
- **Starting loadout:** M1911 + knife + 2 frags.
- **Wall buys** (chalk outline, buy once then half-price ammo refills; 4500 for
  ammo once upgraded): M14 500, Olympia 500, MP40 1000 (Hall A), MP5K 1000
  (Hall B), AK-74u 1200 (Courtyard), Frags 250 (Courtyard), Stakeout 1500 (Lab),
  M16 1200 (Storage).
- **Mystery Box** (950/spin): Commando, Galil, FAMAS, AUG, SPAS-12, Python,
  RPK, HK21, **Monkey Bombs**, **Ray Gun** (projectile + splash), **Thundergun**
  (wind cone, flings whole hordes — fits the weather theme). Teddy bear chance
  rises with use → refund + box flies to another of 7 spots.
- **Pack-a-Punch (5000):** ×2–3 damage, bigger mags, more reserve, renamed gun
  (MP5K → *MP115 Kollider*, M1911 → *Mustang & Sally*, which becomes explosive),
  and an **animated galactic camo** (procedural scrolling purple/cyan texture +
  emissive glow) on the viewmodel.

## 7. Perk-a-Colas (max 4, jingle on purchase, HUD icons)

| Perk | Cost | Effect |
|---|---|---|
| Quick Revive | 500 (solo) | Self-revive, 3 uses |
| Juggernog | 2500 | 250 HP |
| Speed Cola | 3000 | ×2 reload & board-repair speed |
| Double Tap II | 2000 | +33% fire rate, ×2 bullet damage |
| Stamin-Up | 2000 | Faster sprint, longer sprint |
| Mule Kick | 4000 | Third weapon slot |

## 8. Zombies & Rounds

- **Counts:** rounds 1–9 use the classic table (6, 8, 13, 18, 24, 27, 28, 28, 29);
  round ≥ 10 uses `0.15 × round × 24`. Max 24 alive; spawn interval shrinks with round.
- **Health:** `150 + 100·(r−1)` through round 9, then ×1.1 per round.
- **Speed mix:** walkers early; sprinter fraction grows ~7%/round (all sprint by ~20).
- **Behavior:** spawn rising at windows in *reachable* rooms (weighted toward the
  player) → tear one board every 2 s → vault in → chase via BFS flow-field over
  the map grid (re-pathing as doors open), with separation so hordes flow around
  corners like water. Explosions can sever legs → **crawlers**.
- **Round transitions:** 8 s breather, blood-red round number sting/flicker.

### Special round (every 5th round)
**Hellhounds**: thunder + lightning flashes, fog thickens, fiery quadruped dogs
spawn in bolts of lightning near the player — fast, low HP, lunge attack.
Killing the last hound **always drops a Max Ammo**. Round counter then advances.

## 9. Power-Ups (3% drop on kill, 30 s lifetime, blink before despawn)

Max Ammo (refills reserves, frags, monkeys) · Insta-Kill 30 s · Double Points 30 s ·
Nuke (+400, wipes the board) · Carpenter (rebuilds every barrier, +200) ·
Fire Sale 30 s (mystery box at every location for 10 points). Rendered as glowing
spinning emblems with floating labels; HUD countdown timers.

## 10. Monkey Bombs

Box-only tactical (H key, 3 per acquisition, restocked by Max Ammo). Thrown with
an arc; on landing plays a jingle, every zombie within 25 m re-targets it, then it
detonates (1000 dmg, radius 5 m). The panic button the original request asked for.

## 11. HUD / UX

Points with floating "+60" ticker (left), blood-red round numeral (bottom-left),
ammo `MAG / RESERVE` + weapon name (bottom-right), perk icons (top-left),
power-up timers (top-center), context prompt ("Press F to buy …"), hitmarkers,
damage vignette, crosshair, pause menu, start menu with controls, game-over stats.

## 12. Controls

WASD move · mouse look · LMB fire · R reload · F interact / hold-F rebuild boards ·
1/2/3 + Q/wheel swap weapons · Shift sprint · Space jump · V knife · G frag ·
H monkey bomb · M mute · Esc pause.

## 13. Architecture

```
index.html        boot + HUD DOM + script ordering
lib/three.min.js  vendored Three.js r160 (UMD)
js/config.js      ALL tuning data (weapons, perks, rounds, map grid) + pure map parser
js/audio.js       WebAudio synth (shots, growls, jingles, stings, thunder)
js/map.js         grid → geometry, colliders, doors, windows, machines, lights
js/player.js      pointer-lock controller, collision, health/downs, points
js/weapons.js     viewmodels, firing, reload, projectiles, PaP camo
js/zombies.js     round director, spawning, flow-field AI, dogs, crawlers
js/powerups.js    drops, timers, effects
js/interact.js    doors, wall buys, perks, box, PaP, teleporters, power, barriers
js/hud.js         DOM HUD + menus
js/main.js        scene/loop/state machine
tests/validate-map.js   node test: grid integrity, door adjacency, reachability
```

Everything hangs off one `G` namespace; data lives in `config.js` so the whole
game is tunable from one file.

---

## 14. Multi-Map Update (v2)

The game now ships **three maps**, selected from the start menu. All map data
lives in `CFG.MAPS` (config.js); each entry defines its own grid, rooms, doors,
windows, risers, machines, box spots, teleporters, atmosphere, PaP unlock rule
and wonder weapon. The spawn room is always letter `S`.

| Map | PaP rule | Wonder weapon |
|---|---|---|
| Nacht der Untoten | `power` — flipping the switch drops the PaP force field | Thundergun (authentic to BO1 Nacht) |
| Der Riese | `teleporters` — link 3 pads at the courtyard mainframe | Wunderwaffe DG-2 → *DG-3 JZ* (chains 10 → 24) |
| Der Wetterjunge | `teleporters` | **Wettermacher** → *Auge des Sturms* (custom) |

**Wonder-weapon rules:** every map's box carries the Ray Gun, Monkey Bombs and
exactly one wonder weapon; wonder weapons flagged `wonder: true` never roll on
another map.

**Wunderwaffe DG-2** — instant lightning bolt; first zombie struck electrifies
the nearest zombie within 5.5 m of *any* electrified zombie, repeating up to 10
links (24 / 7.5 m upgraded). Visualized as cyan arcs between victims. 3/15 ammo.

**Wettermacher** (custom) — lobs a storm orb that detonates into a stationary
tornado vortex (4 s, radius 5.5 m; 6.5 s / 7.5 m upgraded). The vortex drags
nearby zombies toward its eye and strikes everything inside with lightning
every 0.45 s. 4/16 ammo.

## 15. BO3 Movement Update (v3)

Momentum-based movement modeled on Black Ops 3's feel. All constants in `CFG.MOVE`.

- **Acceleration model:** exponential approach on ground (accel 14/s, friction
  11/s); in the air, input *redirects* velocity but never bleeds it below a slow
  decay floor (0.3/s) — momentum carries, COD-style.
- **Sprint** (Shift, unlimited): ×1.5 speed (×1.74 Stamin-Up), +6° FOV, weapon
  tilts into a sprint pose. Holding fire or ADS ramps sprint out (the BO3
  sprint-out delay, ~0.1 s via the 8/s ramp) and it auto-resumes after.
- **Slide** (C while sprinting): entry boost ×1.4 (cap 11 m/s), ~1 s duration
  (×1.2 Stamin-Up), low camera (0.72 m), +10° FOV, slight roll, limited lateral
  steering, can fire/ADS throughout. 0.35 s re-slide cooldown.
- **Slide-hop:** jumping out of a slide keeps the boosted velocity — chainable.
- **Crouch** (C held): 1.05 m eye height, 2.1 m/s.
- **ADS** (RMB): gun centers, FOV 58, spread ×0.3, move ×0.65, crosshair fades,
  mouse sensitivity scales with zoom. Blocked during reload/switch/knife.
- **Camera juice:** figure-8 view bob, strafe lean, landing dip scaled to fall
  speed, slide roll, viewmodel mouse-sway with 9/s recovery.
- Jump v=5.2, gravity 14 (snappier arc than v1).

Crouch is bound to **C** only — Ctrl+W (slide while running) would close the
browser tab.

## 16. Deep Visual Polish + Arsenal Update (v4)

- **Lighting root-cause fix:** three.js r160 defaults to physical light units
  which crushed the point lights — the renderer now uses classic units with
  ACES filmic tone mapping (exposure 1.25). Rooms are lit by visible hanging
  lamp fixtures (cone + emissive bulb, subtle flicker), two per large room;
  hemisphere 0.55 pre-power → 0.8 post; thinner fog; moon sprite + dual
  starfield layers.
- **Procedural textures** (zero asset files): concrete walls with panel lines,
  grime streaks and baked baseboards; 2×2 tile floors with cracks, tinted per
  room; wood grain for doors/boards/crates; brushed metal for machines.
  Auto-placed barrels and crates dress rooms (kept clear of interactables).
- **Character models v2:** zombies with hunched chests, two-segment arms/legs
  (elbows + knees flex in the gait), chattering jaws, lolling heads, gore
  patches, glowing eyes, size variation, blob shadows, blood particles on hits.
  Hellhounds with necks, snouts, burning spines/ears/paws, galloping gait and
  wagging tails.
- **Gun factory:** every weapon's viewmodel is assembled from a parts spec —
  receivers, rails, barrels, handguards, iron sights, curved/straight/drum/
  tube mags, pumps, wood/polymer/skeleton stocks, scopes with emissive lenses,
  bullpup layouts, twin barrels, revolver drums, a six-barrel minigun cluster —
  with specular Phong materials and per-gun accents.
- **Arsenal: 56 weapons** across 8 classes with 29 distinct damage values;
  PaP names for all (defaults: ×2.2 dmg, ×1.6 mag, ×2 reserve when not
  hand-tuned). Snipers get deep ADS zoom + scope overlay; launchers fire
  rockets; the Death Machine spits 1400 rpm.
- **Input modes:** auto-detects Macs → "simple aim" (no ADS; 0.55× hip spread
  + 8° bullet-magnetism cone toward chest center); mouse machines keep full
  ADS. Menu button overrides, persisted in localStorage.

## 17. Combat Realism + Arsenal Pass (v5) — "TOTENSTURM"

Renamed the game **TOTENSTURM** ("death storm" — Group 935 / storm theme).

- **Authentic COD damage profiles** (web-checked against BO1 zombies values):
  shotguns (Olympia 8×160, Stakeout 8×200) one-shot bodies into rounds 8–12;
  snipers (L96 1500, DSR-50 2000) one-shot into the teens; marksman rifles
  (M14 150, FAL 250) one-shot the body early; SMGs/ARs are 3-shot archetypes;
  pistols are weak. Verified by deterministic shots-to-kill assertions.
- **68-weapon arsenal** spanning Black Ops 1/2/3, now including the **PPSh-41**
  (71-round drum, 1000 rpm) plus BO3 guns (KN-44, ICR-1, Man-O-War, Sheiva,
  HVK-30, Kuda, VMP, Weevil, Gorgon, Locus, Drakon).
- **Contact-based melee** (no more hits through barriers): a zombie only damages
  you when it's in `attack` state AND still within ~1.4 m horizontally at the
  swing's apex. Zombies clawing an intact barricade can't reach you; a swing
  whiffs if you leave contact range mid-animation. Window-swipe-through removed.
- **BO3 player scaling**: 150 HP (3 swipes to down), 250 with Juggernog (5);
  `zombieMeleeDamage(round)` holds 50 early then climbs to a 2-hit-down by ~r20.
- **Readable, look-gated prompts**: removed the always-floating 3D labels that
  clipped through walls; door cost now shows as a crisp chip, and the full
  "Open X — cost" / perk / PaP text appears in the HUD only when you look at the
  object (facing-gated, with a point-blank fallback).
- **Asset polish**: mystery box rebuilt (steel-banded crate, corner posts,
  latch, hinged lid, glowing ? panel + light); Pack-a-Punch rebuilt (plinth,
  sloped hopper, glowing feed slot, gold output tray); perk machines wear lit
  bottle decals.
- **Zombie vocals**: sprinters scream on approach, every death gurgles, groans
  fire more often — all synthesized (wave-shaped saws through vocal formant
  filters). Drop-in real SFX still supported via `sounds/`.
