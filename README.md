# DER WETTERJUNGE — Weather-Boy Zombies

A Black Ops 1/2-style **round-based zombies FPS** set in an abandoned mountaintop
weather research station. Fully 3D (Three.js), fully offline, zero build step,
zero assets — every texture and sound is generated procedurally at runtime.

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
| LMB | Fire |
| R | Reload |
| F | Buy, use, open doors — **hold** F to rebuild barricades |
| 1 / 2 / 3, Q, mouse wheel | Switch weapons |
| Shift | Sprint |
| Space | Jump |
| V | Knife |
| G | Frag grenade |
| H | Monkey bomb |
| M | Mute |
| Esc | Pause |

## Features

- **Round-based survival** with the classic count/health curves; zombies tear
  boards off windows, vault in, and flow through the map toward you.
- **Hellhound rounds every 5th round** — kill the last dog for a guaranteed **Max Ammo**.
- **Points economy**: 10/hit, 60/kill, 100/headshot, 130/knife, 10/board.
- **8 wall buys**, **mystery box** (16 guns including the **Ray Gun**,
  **Thundergun** and **Monkey Bombs**; teddy bear moves the box).
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

## Map

```
            [RADAR DOME]  power · Teleporter C · Stamin-Up
                 |1750
[LAB]────[ COURTYARD ]────[STORAGE]      Courtyard: mainframe, Pack-a-Punch,
 TeleA     1250 · 1250      TeleB        Juggernog, mystery box start
   \           |  |            /
   [WEST HALL]      [EAST HALL]          L-shaped halls: MP40 / MP5K, Mule Kick
      750 \            / 1000
           [SPAWN ROOM]                  Quick Revive, M14, Olympia
```

## Development

- `js/config.js` holds *all* tuning data (weapons, perks, round curves, map grid).
  The map is an ASCII grid — edit it and the world rebuilds itself.
- Tests (no browser needed): `npm install && npm test`
  - `tests/validate-map.js` — grid integrity, door adjacency, reachability, placements.
  - `tests/smoke.js` — boots the entire game headless in node and plays through
    rounds, combat, doors, perks, power, teleporter linking, Pack-a-Punch, the
    mystery box, power-ups, hellhounds, quick revive and game over.

See `DESIGN.md` for the full design document.
