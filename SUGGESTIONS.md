# TOTENSTURM — Curated Backlog (polish / add / remove / new maps)

Maintained alongside the automated `reports/map-audit-latest.md` (objective
metrics + flags). This file is the *curated, judgement* layer: what to polish,
add, remove, and which new maps could be worth building. Re-reviewed on the
3-day audit cadence (`tools/cron-setup.sh`).

Last curated: from a full headless screenshot review (`npm run shots`) + audit.

## POLISH (improve what exists)
- **Rooms are rectangular boxes** (topology). This is the single biggest limit
  on "dimensionality." Real depth wants non-rectangular rooms, alcoves, internal
  half-walls/dividers, and varied ceiling heights. Doable but needs GRID changes
  + re-validating door/window/placement invariants and nav. High effort, high payoff.
- **Floors are one flat tile per room.** Break them up: floor zones, a drain/grate,
  a hatch, painted hazard lanes, rubble/ice patches. Pure decals — cheap, safe.
- **Walls are repeated texture + regular ribs.** Add recessed niches/shelving,
  a sealed window-to-nowhere, varied panel materials, the odd collapsed section.
- **Per-room floor tints are very saturated** (Wetterjunge has a purple room, a
  teal room, a blue room). Reads as identity but slightly fights cohesion — decide:
  pull them ~30% toward the map palette, or lean in as deliberate room identity.
- **2 machines still sit ~2.3–2.5 m off a door** (Der Riese mainframe↔door-6,
  Wetterjunge power↔door-8). Not blocking, but nudge for cleaner thresholds.
- **A few rooms still flag DARK** in the audit (biggest rooms). Add one more fill
  lamp or a brighter bulb in Der Riese's Auto Garage / Courtyard.

## ADD (new content)
- **Spread the verticality.** The catwalk (Der Riese) and loft (Wetterjunge) are
  the most interesting spaces by far. Add low platforms / a gantry spur / a raised
  control booth to 1–2 flat rooms per map.
- **A buildable objective per map** (you already have the shield bench) — e.g. a
  power-coupling or beacon you assemble from parts scattered across rooms.
- **A trap or two** (electric door, furnace flame jet, freezer trap) for gameplay
  texture and a money sink.
- **Window/barricade variety** (boarded / shattered / shuttered) and a couple of
  destructible clutter props.
- **Atmosphere:** localized fog volumes, dust motes, flickering signage, distant
  ambient SFX emitters keyed per room.
- **Outdoor hero landmarks:** a crashed-plane fuselage (Nacht crash site), a
  central teleporter pylon (Der Riese), a half-buried frozen truck (Wetterjunge).

## REMOVE / FIX
- **Decorative clutter has no colliders → bodies phase through crates/barrels.**
  Either give the corner/mid-wall clusters real colliders (free cover, supports
  training chokepoints) or keep them tight to the walls. Pick one and be consistent.
- **Lone central support pillars** in a few rooms (e.g. Wetterjunge Comms) read
  awkward mid-floor — align them to the structural bays or drop them.
- **Walk-through outdoor scatter** is fine (low debris) but audit any piece that
  pokes into a training lane.

## NEW MAPS (if you expand the roster)
- **Asylum (Verrückt-style):** two mirrored wings + central courtyard, mirrored
  perks, power in the middle. Exercises a symmetrical layout vs the current hubs.
- **Frozen trenches:** lean all-in on the arctic palette — outdoor-heavy, trench
  lines as chokepoints, a downed bomber as the centerpiece, blizzard fog.
- **The Tower:** a genuinely vertical map built on the catwalk system — stacked
  floors connected by stairs/ladders, the horde climbing toward you. Plays to the
  engine's multi-layer nav strength.
- **Arena (quick-play):** a tight 1–2 room survival box for fast sessions / testing.

## PROCESS
- `npm run audit` → `reports/map-audit-latest.md` (per-room density, dark rooms,
  door blockers, test pass/fail). Scheduled every 3 days via `tools/cron-setup.sh`
  (or a platform scheduled trigger in an ephemeral/cloud env).
- `npm run shots` → `screenshots/<map>/<viewpoint>.png` (auto-derived cameras:
  spawn, overview, per-room, yard orbit, per-staircase, per-door) for visual review.
