# TOTENSTURM — Undead Protocol

A Black Ops 1/2-style **round-based zombies FPS** with **three maps**, each with
its own wonder weapon. Fully 3D (Three.js), fully offline, zero build step,
zero assets — every texture and sound is generated procedurally at runtime.

## Maps

| Map | Layout | Pack-a-Punch unlock | Wonder weapon |
|---|---|---|---|
| **Nacht der Untoten** | Tight 3-room bunker | Turn on the power | **Thundergun** (wind cone, flings hordes) |
| **Der Riese** | Factory: courtyard mainframe + 3 teleporter wings | Link all 3 teleporters | **Wunderwaffe DG-2** (chain lightning, 10 zombies — 24 upgraded) |
| **Der Wetterjunge** *(custom)* | Storm research station | Link all 3 teleporters | **Wettermacher** *(custom)* — storm orb that spawns a tornado vortex which drags zombies in and zaps them |

Every map's mystery box also carries the **Ray Gun** and **Monkey Bombs**;
other maps' wonder weapons never roll.

![genre](https://img.shields.io/badge/genre-zombies%20FPS-darkred)

## ▶ How to play

**Just open `index.html` in any modern browser.** No server, no internet, no install.

> If your browser blocks `file://` pages for any reason, run
> `python3 -m http.server` (or `npx serve`) in this folder and open
> `http://localhost:8000`.

## Controls

| Key | Action |
|---|---|
| WASD / Mouse | Move / aim |
| LMB / RMB | Fire / aim down sights |
| Shift | Sprint (hold fire to sprint-out and shoot) |
| C | **Slide** while sprinting, crouch otherwise — jump out of a slide to keep the momentum |
| Space | Jump |
| R | Reload |
| F | Buy, use, open doors — **hold** F to rebuild barricades |
| 1 / 2 / 3, Q, mouse wheel | Switch weapons |
| V | Knife |
| G | Frag grenade |
| H | Monkey bomb |
| M | Mute |
| Esc | Pause |

## Features

- **Round-based survival** with the classic count/health curves; zombies tear
  boards off windows, vault in, and flow toward you. **Melee is contact-based**
  — a zombie at a boarded window can't touch you, and running past one makes
  its swing whiff (no hits through barriers or thin air).
- **BO3 health scaling**: 3 swipes to go down, 5 with Juggernog early on;
  zombie melee ramps up at high rounds so they stay deadly.
- **Hellhound rounds every 5th round** — kill the last dog for a guaranteed **Max Ammo**.
- **Points economy**: 10/hit, 60/kill, 100/headshot, 130/knife, 10/board.
- **68-weapon arsenal** drawn from Black Ops 1/2/3 (M14, Olympia, Commando,
  Ray Gun, PPSh-41, Galil, FAL, KN-44, Kuda, Gorgon, Locus and many more) with
  authentic COD-style damage profiles: shotguns and snipers one-shot bodies
  for many rounds, marksman rifles one-shot early, SMGs/ARs are 3-shot, pistols
  are weak. Wall buys on every map; the **mystery box** carries everything else
  (teddy bear moves the box).
- **Two aim modes, auto-detected**: Macs/trackpads default to *simple aim*
  (no ADS needed — tighter hip-fire + bullet magnetism); mouse PCs get full
  right-click ADS with per-gun zoom. Switchable on the start menu.
- **Procedurally textured world**: concrete, tile, wood-grain and brushed-metal
  surfaces, hanging flickering lamps, barrels/crates, a real moon and starfield,
  filmic tone mapping — no asset files, everything generated at runtime.
- **Two-gun limit**, magazine + reserve ammo, per-gun reload/fire characteristics.
- **6 Perk-a-Colas**: Quick Revive (solo self-revive ×3), Juggernog, Speed Cola,
  Double Tap II, Stamin-Up, Mule Kick (max 4 perks).
- **Power switch** in the Radar Dome; **Der Riese-style teleporters** — activate
  a pad, sprint to the courtyard mainframe to link it. Link all three to unlock…
- **Pack-a-Punch**: 5000 points for double-plus damage, bigger mags, a new name
  and an **animated storm camo** on your gun. Linked teleporters double as
  500-point escape hatches back to the mainframe.
- **Power-ups**: Max Ammo, Insta-Kill, Double Points, Nuke, Carpenter, Fire Sale.
- Crawlers, barricade rebuilding, headshots, hit markers, damage vignette,
  best-round tracking in localStorage.

## Development

- `js/config.js` holds *all* tuning data (weapons, perks, round curves, and all
  three map definitions). Maps are ASCII grids — edit one or add a fourth entry
  to `CFG.MAPS` and the world rebuilds itself.
- Tests (no browser needed): `npm install && npm test`
  - `tests/validate-map.js` — for every map: grid integrity, door adjacency,
    reachability, placements, wonder-weapon/box-pool rules.
  - `tests/smoke.js` — boots the entire game headless in node, once per map,
    and plays through rounds, combat, doors, perks, power, teleporter linking,
    Pack-a-Punch, the mystery box, all three wonder weapons, power-ups,
    hellhounds, quick revive and game over.

See `DESIGN.md` for the full design document.
