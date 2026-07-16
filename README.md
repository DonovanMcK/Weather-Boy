# TOTENSTURM — Undead Protocol

A Black Ops 1/2-style **round-based zombies FPS** with **four maps**, each with
its own wonder weapon and a two-reward Easter egg. Fully 3D (Three.js), fully offline, zero build step,
zero assets — every texture and sound is generated procedurally at runtime.

## Maps

| Map | Layout | Main wonder weapon | Easter egg reward pool |
|---|---|---|---|
| **Nacht der Untoten** | Tight bunker | **Thundergun** | **Nachtlicht** flare or **Minenwerfer 115** soul mine |
| **Der Riese** | Tight single-level three-wing factory loop | **Wunderwaffe DG-2** | **Seelenmotor** piston or **Nachbildner 115** echo cannon |
| **Der Wetterjunge** *(custom)* | Storm station with a two-access rooftop weather deck | **Wettermacher** | **Blitzfanger** lightning fence or **Kryolithwerfer** freeze-and-launch cannon |
| **KurHaus** *(custom)* | Alpine occult spa | **Maelstrom Driver** ricochet bore | **Aether Lance** or **Voss Siphon** |

Completing a map's Easter egg awards one of its two exclusive weapons. The next
completion awards the other, so repeat runs do not endlessly duplicate one gun.

Every Easter egg now begins at a clearly marked briefing and displays one named,
numbered destination at a time. See [EASTER-EGGS.md](EASTER-EGGS.md) for the full
step-by-step routes and reward details.

Der Riese also has an optional prestige continuation, **Overclock the Giant**.
It upgrades the awarded quest weapon into one of two adaptive super variants and
grants the permanent **Heart of the Giant** survival reward.

The rebuilt Der Riese is anchored by the outdoor **Mainframe Yard**. Its west
route crosses the **Cooling Courtyard** to Teleporter C, its north route links
the **Furnace/Teleporter B** wing to the **Auto Garage and Power**, and its south
loop joins **Animal Testing** to the **Teleporter A Laboratory**. Furnace
equipment, power controls, every perk, and the Giant's Heart regulator now sit
on the ground loop. The former upper block and its doorway-blocking stairs were
removed; six colour-coded districts and denser hero machinery provide the
vertical silhouette and room identity without adding dead travel.

Every map's mystery box also carries the **Ray Gun** and **Monkey Bombs**;
other maps' wonder weapons never roll.

![genre](https://img.shields.io/badge/genre-zombies%20FPS-darkred)

## ▶ How to play

**Just open `index.html` in any modern browser.** No server, no internet, no install.

> If your browser blocks `file://` pages for any reason, run
> `python3 -m http.server` (or `npx serve`) in this folder and open
> `http://localhost:8000`.

## 📱 Use your phone as a controller

No gamepad? Turn your phone into one (both devices on the same Wi-Fi):

1. In this folder run **`node server.js`** (or `npm start`). It prints two URLs.
2. On your computer, open the **`http://localhost:8080/`** URL and pick a map.
3. On your phone, open the **`http://<your-lan-ip>:8080/pad`** URL (the start
   screen also shows it). A touch gamepad appears — left half moves (push
   forward to sprint), right half aims, on-screen FIRE / AIM / JUMP / SLIDE /
   USE / RELOAD / SWAP / grenade / monkey / knife / pause buttons.

The phone's input is relayed to the game over a tiny local WebSocket (pure
Node, no dependencies). Keyboard + mouse still work at the same time, and the
game is unaffected if you never start the server.

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
- **78-weapon arsenal** drawn from Black Ops 1/2/3 (M14, Olympia, Commando,
  Ray Gun, PPSh-41, Galil, FAL, KN-44, Kuda, Gorgon, Locus and many more) with
  authentic COD-style damage profiles: shotguns and snipers one-shot bodies
  for many rounds, marksman rifles one-shot early, SMGs/ARs are 3-shot, pistols
  are weak. Wall buys on every map; the **mystery box** carries everything else
  (teddy bear moves the box).
- **Two aim modes, auto-detected**: Macs/trackpads default to *simple aim*
  (no ADS needed — tighter hip-fire + bullet magnetism); mouse PCs get full
  right-click ADS with per-gun zoom. Switchable on the start menu.
- **Controller support** (independent of keyboard/mouse — these are *controller*
  buttons): L-stick move, R-stick aim, RT shoot, LT aim, L3 sprint, A jump,
  B slide, X buy/reload, Y switch gun, RB grenade, LB or D-pad↑ monkey, R3 knife,
  Start pause. Menus are navigable with the stick + A, so it's pad-only end to
  end. An idle plugged-in pad never interferes with keyboard+mouse.
- **Polished HUD**: dynamic crosshair that opens with spread, 4-stroke
  hitmarker, magazine pip bar, segmented health (grows with Juggernog),
  power-up pills with countdown bars, perk discs, key-capped look prompts.
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
  four map definitions). Maps are ASCII grids — edit one or add another entry
  to `CFG.MAPS` and the world rebuilds itself.
- Tests (no browser needed): `npm install && npm test`
  - `tests/validate-map.js` — for every map: grid integrity, door adjacency,
    reachability, placements, wonder-weapon/box-pool rules.
  - `tests/smoke.js` — boots the entire game headless in node, once per map,
    and plays through rounds, combat, doors, perks, power, teleporter linking,
    Pack-a-Punch, the mystery box, all map and Easter-egg wonder weapons, power-ups,
    hellhounds, quick revive and game over.

See `DESIGN.md` for the full design document.
