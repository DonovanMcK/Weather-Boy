/* ===========================================================================
   DER WETTERJUNGE & FRIENDS — config.js
   All tuning data + the pure map-grid parser (also loadable in node tests).
   Three maps: Nacht der Untoten, Der Riese, Der Wetterjunge.
   Convention: the spawn room is ALWAYS room letter 'S'.
   =========================================================================== */
(function (root) {
  'use strict';

  var CFG = {};
  CFG.CELL = 4;

  /* ===================================================================== */
  /* MAPS — 4m grid cells. Letters = rooms, digits = doors, '.' = outside. */
  /* ===================================================================== */
  CFG.MAPS = {};

  /* ----------------------------------------------- NACHT DER UNTOTEN --- */
  CFG.MAPS.nacht = {
    id: 'nacht',
    name: 'NACHT DER UNTOTEN',
    sub: 'Bombed-out bunker. Complete Dead Air for the Nachtlicht or Minenwerfer 115.',
    wonder: 'thunder',
    papRule: 'power',          // Pack-a-Punch unlocks when the power goes on
    atmos: { sky: 0x14110c, fog: 0x16130d, density: 0.02,
             amb: 0x4a4030, ambI: 0.55, hemiSky: 0xc2a274, hemiGround: 0x2a2016 },
    // surface palette — warm, decayed bombed-out bunker (amber/sepia concrete,
    // weathered timber, rusted iron). Shared by every wall/floor/prop so the
    // map reads as one place.
    palette: { wallA: 0xb8ab97, wallB: 0xa89b86, wood: 0xc6ad84, plank: 0xd8c098,
               metal: 0x938b80, beam: 0x5a5048, rust: 0x8a5f34, conc: 0x9a8f7e,
               deck: 0x726a5e, ceil: 0x726658, accent: 0xd98a2a, lampTint: 0xffe0a8 },
    OUTDOOR: ['Y'],            // open-air rooms (no ceiling, show sky)
    GRID: [
      '...YYYYYYY...', // Y = Crash Site (outdoor, debris field)
      '...YYYYYYY...',
      '...YYYYYYY...',
      '......1......', // 1: Crash Site <-> Spawn
      'HHH.SSSSS.GGG', // H = Help Room   S = Spawn (main room)   G = Generator
      'HHH2SSSSS3GGG', // 2: Help <-> Spawn   3: Spawn <-> Generator
      'HHH.SSSSS.GGG',
      'HHH.SSSSS.GGG',
      '......4......', // 4: Spawn <-> Bunker
      '...UUUUUUU...', // U = Bunker (power + Pack-a-Punch)
      '...UUUUUUU...',
      '...UUUUUUU...',
      '.............'
    ],
    ROOMS: {
      S: { name: 'Spawn Room',     floor: 0x3a3328, light: 0xb08858 },
      Y: { name: 'Crash Site',     floor: 0x2d2a22, light: 0x8895aa },
      H: { name: 'Help Room',      floor: 0x332e2a, light: 0xaa8866 },
      G: { name: 'Generator Room', floor: 0x2e2c26, light: 0x88aa77 },
      U: { name: 'Lower Bunker',   floor: 0x282520, light: 0xcc8844 }
    },
    DOORS: {
      1: { cost: 1000, name: 'Crash Site' },
      2: { cost: 750,  name: 'Help Room' },
      3: { cost: 1000, name: 'Generator Room' },
      4: { cost: 1250, name: 'Lower Bunker' }
    },
    WINDOWS: [
      { cell: [3, 0],  dir: 'N' },   // Crash Site
      { cell: [9, 0],  dir: 'N' },
      { cell: [0, 5],  dir: 'W' },   // Help
      { cell: [1, 4],  dir: 'N' },
      { cell: [12, 5], dir: 'E' },   // Generator
      { cell: [11, 4], dir: 'N' },
      { cell: [4, 4],  dir: 'N' },   // Spawn (cracked ceiling)
      { cell: [3, 11], dir: 'S' },   // Bunker
      { cell: [9, 11], dir: 'S' }
    ],
    RISERS: [],
    PERK_MACHINES: [
      { perk: 'revive', cell: [5, 7],  off: [0, 0] },
      { perk: 'jugg',   cell: [1, 5],  off: [0, 0] },
      { perk: 'speed',  cell: [11, 5], off: [0, 0] },
      { perk: 'dtap',   cell: [6, 1],  off: [0, 0] }
    ],
    WALLBUYS: [
      { gun: 'm14',      cell: [4, 7],  off: [0, 1.6],  face: 'S' },
      { gun: 'olympia',  cell: [8, 7],  off: [0, 1.6],  face: 'S' },
      { gun: 'mp5k',     cell: [0, 6],  off: [-1.6, 0], face: 'W' },
      { gun: 'stakeout', cell: [12, 6], off: [1.6, 0],  face: 'E' },
      { gun: 'mp40',     cell: [4, 0],  off: [0, -1.6], face: 'N' },
      { gun: 'frags',    cell: [4, 11], off: [0, 1.6],  face: 'S' }
    ],
    BOX_SPOTS: [
      { cell: [4, 5],  off: [0, 0] },
      { cell: [8, 1],  off: [0, 0] },
      { cell: [4, 10], off: [0, 0] }
    ],
    TELEPORTERS: [],
    MAINFRAME: null,
    PAP: { cell: [6, 10], off: [0, 0] },
    POWER: { cell: [8, 10], off: [0, 0] },
    PLAYER_SPAWN: { cell: [6, 6], off: [0, 0.5] },
    // 9 authored wall-adjacent relic spots; 3 distinct are chosen per match
    RELIC_SPOTS: [{ cell: [5, 0], face: 'N' }, { cell: [0, 4], face: 'W' }, { cell: [5, 4], face: 'N' }, { cell: [10, 4], face: 'N' }, { cell: [4, 9], face: 'N' }, { cell: [6, 0], face: 'N' }, { cell: [2, 4], face: 'N' }, { cell: [7, 4], face: 'N' }, { cell: [12, 4], face: 'E' }],
    EE_SOULBOX: [6, 5],
    eeName: 'DEAD AIR',
    eeNode: 'field radio',
    eeRewards: ['nachtlicht', 'minenwerfer115'],
    EE_START: { cell: [4, 9], face: 'N', title: 'USAAF EMERGENCY FREQUENCY',
      prompt: 'Play the damaged emergency broadcast',
      intro: 'HELP ROOM — Find the radio answering this signal' },
    EE_STEPS: [
      { cell: [0, 4], face: 'W', room: 'Help Room', kind: 'field radio',
        prompt: 'Tune the Help Room field radio', clue: 'GENERATOR — Follow the cable to the second receiver' },
      { cell: [12, 4], face: 'E', room: 'Generator Room', kind: 'vacuum receiver',
        prompt: 'Install the live vacuum receiver', clue: 'CRASH SITE — Align the broken field antenna' },
      { cell: [6, 0], face: 'N', room: 'Crash Site', kind: 'field antenna',
        prompt: 'Align the crash-site field antenna', clue: 'SPAWN — The central transmitter is calling' }
    ],
    // authored shield-part spawns — 3 wall-adjacent maintenance spots per part
    // each shield component lives in its OWN room (3 authored wall spots each);
    // one is picked per match. Rooms: frame=Crash Site, plate=Lower Bunker,
    // glass=Help Room. Bench in the Generator Room.
    SHIELD_PARTS: {
      frame: { room: 'Y', spots: [{ cell: [4, 2], face: 'S' }, { cell: [7, 2], face: 'S' }, { cell: [9, 2], face: 'S' }] },
      plate: { room: 'U', spots: [{ cell: [3, 9], face: 'N' }, { cell: [5, 9], face: 'N' }, { cell: [7, 9], face: 'N' }] },
      glass: { room: 'H', spots: [{ cell: [2, 6], face: 'E' }, { cell: [1, 7], face: 'S' }, { cell: [2, 7], face: 'S' }] }
    },
    SHIELD_BENCH: { cell: [11, 7], face: 'S' }
  };

  /* ------------------------------------------------------- DER RIESE --- */
  // Ground-up blueprint replacement. None of the previous Der Riese grid,
  // stairs, prop coordinates or room proportions are retained. The Mainframe
  // anchors an open east yard and three looping factory routes terminate at A,
  // B and C. The playable route is intentionally one floor: the former upper
  // control block added travel without improving the loop and obstructed the
  // Garage entrance, so its functions now live in distinct ground-floor bays.
  CFG.MAPS.derriese = {
    id: 'derriese',
    name: 'DER RIESE',
    sub: "The Giant rebuilt — a tight three-wing factory loop with distinct furnace, power, cooling, and testing districts.",
    // Keep the full three-wing loop, but tighten the prior 3.2m grid one more
    // safe step. 3.0m removes another 12% of the footprint while leaving a
    // generous one-cell doorway and every authored set piece clear.
    cellSize: 3.0,
    // This map is the densest of the four. Native-resolution rendering avoids
    // Retina supersampling here, cutting its GPU heat/load dramatically without
    // changing gameplay, lighting colours, or the visual asset set.
    renderPixelRatio: 1.0,
    wonder: 'wunderwaffe',
    papRule: 'teleporters',
    atmos: { sky: 0x101714, fog: 0x172018, density: 0.011,
             amb: 0x3e4b42, ambI: 0.62, hemiSky: 0x82998d, hemiGround: 0x252e28 },
    // Der Riese deliberately starts in emergency power: low red ceiling lamps
    // and the coloured department glows do the storytelling.  Throwing the
    // switch restores clean factory fill, but leaves each sector's colour as a
    // restrained stain on its walls and floor instead of erasing its identity.
    // These values only retune the existing lights; they never add to the
    // renderer's light budget.
    lighting: {
      emergency: { amb: 0.36, hemi: 0.47, moon: 0.16,
                   lamp: 0.32, bulb: 0.58, lampColor: 0xb63732,
                   aura: 1.00, pool: 0.16, work: 0.86 },
      factory:   { amb: 0.54, hemi: 0.80, moon: 0.32,
                   lamp: 1.12, bulb: 0.96, lampColor: 0xffe3bd,
                   aura: 0.30, pool: 0.045, work: 0.28 }
    },
    palette: { wallA: 0x675044, wallB: 0x574942, wood: 0x826447, plank: 0x9b7a54,
               metal: 0x606b69, beam: 0x2c3434, rust: 0x70462e, conc: 0x666862,
               deck: 0x414a4b, ceil: 0x383d3b, accent: 0x47bca4, lampTint: 0xffc47b },
    OUTDOOR: ['S', 'C'],
    GRID: [
      '....FFFFFFF.................',
      '...FFFFFFFF.................',
      '...FFFFFFFF.GGGGGGGG........',
      '...FFFFFFFF5GGGGGGGG........',
      '...FFFFFFFF.GGGGGGGG........',
      '...FFFFFFFF.GGGGGGGG........',
      '......1.....GGGGGGGG........',
      'CCCCCCCCC.GGGGGGGGGG.SSSSSSS',
      'CCCCCCCCC2GGGGGGGGGG6SSSSSSS',
      'CCCCCCCCC.GGGGGGGGGG.SSSSSSS',
      'CCCCCCCCC.GGGGGGGGGG.SSSSSSS',
      'CCCCCCCCC............SSSSSSS',
      'CCCCCCCCC.LLLLLLLLL.SSSSSSSS',
      'CCCCCCCCC.LLLLLLLLL8SSSSSSSS',
      'CCCCCCCCC.LLLLLLLLL.SSSSSSSS',
      'CCCCCCCCC3LLLLLLLLL.SSSSSSSS',
      '..........LLLLLLLLL.....4...',
      '........LLLLLLLLLLLL.AAAAAAA',
      '........LLLLLLLLLLLL.AAAAAAA',
      '........LLLLLLLLLLLL7AAAAAAA',
      '........LLLLLLLLLLLL.AAAAAAA',
      '........LLLLLLLLLLLL.AAAAAAA',
      '.........LLLLLLLLLL..AAAAAAA',
      '.....................AAAAAAA'
    ],
    ROOMS: {
      S: { name: 'Mainframe Yard',           floor: 0x3e3a2b, light: 0xe7b85d },
      C: { name: 'Cooling Courtyard',        floor: 0x263b39, light: 0x68c3ae },
      L: { name: 'Animal Testing Complex',   floor: 0x402b31, light: 0xd96370 },
      A: { name: 'Teleporter A Laboratory',  floor: 0x243947, light: 0x66c7e7 },
      F: { name: 'Furnace and Teleporter B', floor: 0x48271c, light: 0xff6d31 },
      G: { name: 'Auto Garage and Power',    floor: 0x293b31, light: 0x72d39b }
    },
    DOORS: {
      1: { cost: 1000, name: 'Furnace Courtyard Gate' },
      2: { cost: 750,  name: 'Cooling Garage Shutter' },
      3: { cost: 1000, name: 'Animal Testing West Gate' },
      4: { cost: 1250, name: 'Mainframe A-Lab Gate' },
      5: { cost: 1250, name: 'Furnace Power Passage' },
      6: { cost: 1000, name: 'Mainframe Garage Shutter' },
      7: { cost: 1000, name: 'Animal Testing A-Lab Door' },
      8: { cost: 1000, name: 'Mainframe Testing Gate' }
    },
    WINDOWS: [
      { cell: [5, 0], dir: 'N' }, { cell: [9, 0], dir: 'N' }, { cell: [3, 2], dir: 'W' },
      { cell: [13, 2], dir: 'N' }, { cell: [19, 5], dir: 'E' },
      { cell: [0, 9], dir: 'W' }, { cell: [4, 7], dir: 'N' }, { cell: [0, 14], dir: 'W' },
      { cell: [27, 9], dir: 'E' }, { cell: [27, 14], dir: 'E' },
      { cell: [8, 17], dir: 'W' }, { cell: [15, 22], dir: 'S' },
      { cell: [27, 18], dir: 'E' }, { cell: [24, 23], dir: 'S' }
    ],
    RISERS: [[6, 12], [26, 13]],
    PERK_MACHINES: [
      { perk: 'revive', cell: [21, 13], off: [0, 0] },
      { perk: 'jugg', cell: [19, 21], off: [0, 0] },
      { perk: 'speed', cell: [19, 4], off: [0, 0] },
      { perk: 'dtap', cell: [0, 15], off: [0, 0] },
      { perk: 'wonderfizz', cell: [4, 0], off: [0, 0] },
      { perk: 'stamin', cell: [18, 10], off: [0, 0] }
    ],
    WALLBUYS: [
      { gun: 'm14', cell: [27, 8], off: [1.6, 0], face: 'E' },
      // Kept on the Mainframe's east exterior wall, clear of the boarded
      // window at [27,14] and the nearby A-Lab gate.
      { gun: 'olympia', cell: [27, 10], off: [1.6, 0], face: 'E' },
      { gun: 'mp5k', cell: [0, 13], off: [-1.6, 0], face: 'W' },
      { gun: 'mp40', cell: [14, 10], off: [0, 1.25], face: 'S' },
      { gun: 'ak74u', cell: [7, 0], off: [0, -1.6], face: 'N' },
      { gun: 'm16', cell: [16, 2], off: [0, -1.6], face: 'N' },
      { gun: 'stakeout', cell: [8, 19], off: [-1.6, 0], face: 'W' },
      { gun: 'frags', cell: [12, 22], off: [0, 1.6], face: 'S' }
    ],
    BOX_SPOTS: [
      { cell: [8, 2], off: [0, 0] }, { cell: [15, 8], off: [0, 0] },
      { cell: [2, 12], off: [0, 0] }, { cell: [24, 12], off: [0, 0] },
      { cell: [12, 18], off: [0, 0] }, { cell: [24, 20], off: [0, 0] },
      { cell: [7, 4], off: [0, 0] }, { cell: [16, 7], off: [0, 0] }
    ],
    TELEPORTERS: [
      { id: 'A', cell: [24, 20], off: [0, 0] },
      { id: 'B', cell: [7, 2], off: [0, 0] },
      { id: 'C', cell: [3, 11], off: [0, 0] }
    ],
    // Slightly west of the yard's geometric centre: it keeps the iconic
    // Mainframe sightline clear while preserving a full north-south train lane.
    MAINFRAME: { cell: [23, 11], off: [0, 0] },
    PAP: { cell: [25, 11], off: [0, 0] },
    POWER: { cell: [16, 4], off: [0, 0] },
    PLAYER_SPAWN: { cell: [24, 13], off: [0, 0.5] },
    RELIC_SPOTS: [
      { cell: [4, 0], face: 'N' }, { cell: [3, 5], face: 'W' }, { cell: [19, 6], face: 'E' },
      { cell: [0, 12], face: 'W' }, { cell: [7, 7], face: 'N' }, { cell: [8, 21], face: 'W' },
      { cell: [17, 22], face: 'S' }, { cell: [27, 21], face: 'E' }, { cell: [22, 23], face: 'S' }
    ],
    EE_SOULBOX: [14, 19],
    eeName: "THE GIANT'S HEART",
    eeNode: 'factory identification card',
    eeRewards: ['seelenmotor', 'nachbildner115'],
    EE_START: { cell: [27, 12], face: 'E', title: 'GRUPPE 935 SHUTDOWN ORDER',
      prompt: "Read the Giant's shutdown order", intro: 'ANIMAL TESTING — Recover the marked subject tag' },
    EE_STEPS: [
      { cell: [8, 19], face: 'W', room: 'Animal Testing', kind: 'subject tag',
        prompt: 'Recover the marked subject tag', clue: 'FURNACE — Temper it beside Teleporter B' },
      { cell: [10, 1], face: 'E', room: 'Furnace Room', kind: 'heat stamp',
        prompt: 'Temper the tag in the furnace stamp', clue: 'POWER GARAGE — Carry it to the Giant regulator' },
      { cell: [19, 6], face: 'E', room: 'Power Garage', kind: 'heart regulator',
        prompt: "Install the tag in the Giant's regulator", clue: 'ANIMAL TESTING — The buried reactor is awake below' }
    ],
    OVERCLOCK: {
      regulator: { cell: [19, 6], face: 'E' },
      conduits: [
        { cell: [14, 22], face: 'S', y: 0, room: 'Animal Testing' },
        { cell: [3, 4], face: 'W', y: 0, room: 'Furnace Room' },
        { cell: [14, 2], face: 'N', y: 0, room: 'Power Garage' }
      ],
      cells: [
        { cell: [24, 20], y: 0, room: 'Teleporter A Laboratory', teleporter: 'A' },
        { cell: [7, 2], y: 0, room: 'Furnace Room', teleporter: 'B' },
        { cell: [3, 11], y: 0, room: 'Cooling Courtyard', teleporter: 'C' }
      ],
      lockdownKills: 24,
      cellTime: 60
    },
    SHIELD_PARTS: {
      frame: { room: 'G', spots: [{ cell: [19, 3], face: 'E' }, { cell: [18, 10], face: 'S' }, { cell: [12, 6], face: 'W' }] },
      plate: { room: 'C', spots: [{ cell: [0, 13], face: 'W' }, { cell: [2, 7], face: 'N' }, { cell: [8, 10], face: 'E' }] },
      glass: { room: 'L', spots: [{ cell: [8, 18], face: 'W' }, { cell: [10, 22], face: 'S' }, { cell: [19, 20], face: 'E' }] }
    },
    SHIELD_BENCH: { cell: [19, 17], face: 'E' }
  };

  /* -------------------------------------------------- DER WETTERJUNGE --- */
  // Showpiece custom map: a huge OUTDOOR courtyard hub (C) ringed by indoor
  // rooms — Radar Dome (D, N), Generator (A, NW), Comms Tower (B, NE),
  // Laboratory (L, W), Storage (R, E), Spawn (S, S). Rooms are real spaces
  // separated by walls with doored gaps + catwalk loops, not corridors.
  CFG.MAPS.wetterjunge = {
    id: 'wetterjunge',
    name: 'DER WETTERJUNGE',
    sub: 'Storm station with a dual-access radar weather deck and the Eye of the Storm quest.',
    wonder: 'stormcaller',
    papRule: 'teleporters',
    atmos: { sky: 0x10131f, fog: 0x121726, density: 0.014,
             amb: 0x3c4660, ambI: 0.5, hemiSky: 0x8298c8, hemiGround: 0x202838 },
    // surface palette — frozen arctic research station (cold blue-grey concrete,
    // frosted steel, ice-cyan accents).
    palette: { wallA: 0xb0b6c0, wallB: 0xa0a6b2, wood: 0xb0a48f, plank: 0xc2b6a0,
               metal: 0x8a9098, beam: 0x515861, rust: 0x6f6a5e, conc: 0x95999f,
               deck: 0x666c74, ceil: 0x6c727d, accent: 0x5fcfe6, lampTint: 0xc6dcf4 },
    OUTDOOR: ['C'],
    OPEN_CEIL: ['D'],              // open radar aperture beneath the weather deck
    GRID: [
      'AAAA.DDDDD.BBBB', // A=Generator  D=Radar Dome  B=Comms Tower
      'AAAA6DDDDD8BBBB', // 6: Gen↔Dome catwalk   8: Dome↔Comms catwalk
      'AAAA.DDDDD.BBBB',
      'AAAA.DDDDD.BBBB',
      '..2....79...5..', // broad 7+9 Dome stair hall entry
      'LLLL.CCCCC.RRRR', // L=Laboratory  C=COURTYARD (outdoor)  R=Storage
      'LLLL.CCCCC.RRRR',
      'LLLL3CCCCC4RRRR', // 3: Lab↔Courtyard   4: Courtyard↔Storage
      'LLLL.CCCCC.RRRR',
      'LLLL.CCCCC.RRRR',
      '.......1.......', // 1: Courtyard↔Spawn
      '.....SSSSS.....', // S=Spawn
      '.....SSSSS.....',
      '.....SSSSS.....',
      '...............'
    ],
    ROOMS: {
      S: { name: 'Spawn',         floor: 0x3a3530, light: 0x9a8866 },
      C: { name: 'Courtyard',     floor: 0x32392e, light: 0x9fb6c8 },
      L: { name: 'Laboratory',    floor: 0x2e3640, light: 0x66ccdd },
      R: { name: 'Storage',       floor: 0x3b3328, light: 0xddaa66 },
      D: { name: 'Radar Dome',    floor: 0x342e3e, light: 0xbb88ff },
      A: { name: 'Generator',     floor: 0x33302a, light: 0xffaa55 },
      B: { name: 'Comms Tower',   floor: 0x2c3436, light: 0x66ddcc }
    },
    DOORS: {
      1: { cost: 750,  name: 'Courtyard' },
      2: { cost: 1000, name: 'Laboratory' },
      3: { cost: 1000, name: 'Laboratory' },
      4: { cost: 1000, name: 'Storage' },
      5: { cost: 1000, name: 'Storage' },
      6: { cost: 1250, name: 'Radar Dome' },
      7: { cost: 1500, name: 'Radar Dome' },
      8: { cost: 1250, name: 'Radar Dome' },
      9: { cost: 1500, name: 'Radar Stair Hall' }
    },
    WINDOWS: [
      { cell: [0, 1],  dir: 'W' },   // Generator
      { cell: [2, 0],  dir: 'N' },
      { cell: [7, 0],  dir: 'N' },   // Dome
      { cell: [12, 0], dir: 'N' },   // Comms
      { cell: [14, 1], dir: 'E' },
      { cell: [0, 7],  dir: 'W' },   // Lab
      { cell: [14, 7], dir: 'E' },   // Storage
      { cell: [5, 9],  dir: 'S' },   // Courtyard (outdoor)
      { cell: [9, 9],  dir: 'S' },
      { cell: [5, 13], dir: 'S' },   // Spawn
      { cell: [9, 13], dir: 'S' }
    ],
    RISERS: [[7, 7], [9, 7]],
    PERK_MACHINES: [
      { perk: 'revive', cell: [6, 12], off: [-1.0, 0] },
      { perk: 'jugg',   cell: [13, 7], off: [1.0, 0] },
      { perk: 'speed',  cell: [1, 7],  off: [-1.0, 0] },
      { perk: 'dtap',   cell: [12, 5], off: [0, 0.5] },   // Storage
      { perk: 'stamin', cell: [1, 3],  off: [0, 0], y: 4 },
      { perk: 'wonderfizz', cell: [13, 2], off: [0, 1.0], y: 4 }
    ],
    WALLBUYS: [
      { gun: 'm14',      cell: [6, 13], off: [0, 1.6],  face: 'S' },
      { gun: 'olympia',  cell: [8, 13], off: [0, 1.6],  face: 'S' },
      { gun: 'mp5k',     cell: [0, 5],  off: [-1.6, 0], face: 'W' },
      { gun: 'mp40',     cell: [14, 5], off: [1.6, 0],  face: 'E' },
      { gun: 'ak74u',    cell: [5, 0],  off: [0, -1.6], face: 'N' },
      { gun: 'm16',      cell: [13, 0], off: [0, -1.6], face: 'N' },
      { gun: 'stakeout', cell: [0, 8],  off: [-1.6, 0], face: 'W' },
      { gun: 'frags',    cell: [0, 2],  off: [-1.6, 0], face: 'W' },
      { gun: 'rpk',      cell: [13, 5], off: [0, -1.6], face: 'N' }   // Storage, north wall
    ],
    BOX_SPOTS: [
      { cell: [1, 2],  off: [0, 0] },
      { cell: [13, 3], off: [0, 0] },
      { cell: [2, 8],  off: [0, 0] },
      { cell: [13, 8], off: [0, 0] },
      { cell: [9, 3],  off: [0, 0.6], y: 4 },
      { cell: [7, 12], off: [0, 0] },
      { cell: [7, 8],  off: [0, 0] }
    ],
    TELEPORTERS: [
      { id: 'A', cell: [1, 8],  off: [0, 0] },
      { id: 'B', cell: [13, 6], off: [0, 0] },
      { id: 'C', cell: [6, 2],  off: [0, 0] }
    ],
    MAINFRAME: { cell: [6, 6], off: [0, 0] },
    PAP: { cell: [8, 6], off: [0, 0] },
    POWER: { cell: [13, 1], off: [0, 0] },
    PLAYER_SPAWN: { cell: [7, 11], off: [0, 0.5] },
    RELIC_SPOTS: [{ cell: [0, 0], face: 'W' }, { cell: [6, 0], face: 'N' }, { cell: [11, 0], face: 'N' }, { cell: [1, 5], face: 'N' }, { cell: [5, 5], face: 'N' }, { cell: [11, 5], face: 'N' }, { cell: [5, 11], face: 'N' }, { cell: [1, 0], face: 'W' }, { cell: [8, 0], face: 'N' }],
    EE_SOULBOX: [7, 7],
    eeName: 'EYE OF THE STORM',
    eeNode: 'weather probe',
    eeRewards: ['blitzfanger', 'kryolithwerfer'],
    EE_START: { cell: [0, 6], face: 'W', title: 'PROJECT TEMPEST PROTOCOL',
      prompt: 'Read the emergency storm protocol',
      intro: 'GENERATOR — Restore the blue capacitor bank' },
    EE_STEPS: [
      { cell: [0, 2], face: 'W', room: 'Generator', kind: 'storm capacitor',
        prompt: 'Charge the blue storm capacitor', clue: 'COMMS — Match the emergency frequency' },
      { cell: [14, 2], face: 'E', room: 'Comms Tower', kind: 'frequency dial',
        prompt: 'Tune the emergency storm frequency', clue: 'WEATHER DECK — Align the rooftop probe' },
      { cell: [9, 2], face: 'N', y: 4, room: 'Eye Observation Deck', kind: 'weather probe',
        prompt: 'Align the rooftop weather probe', clue: 'COURTYARD — Enter the Eye of the Storm' }
    ],
    // frame=Radar Dome, plate=Laboratory, glass=Storage. Bench in the Generator.
    SHIELD_PARTS: {
      frame: { room: 'D', spots: [{ cell: [5, 3], face: 'S' }, { cell: [8, 3], face: 'S' }, { cell: [9, 3], face: 'S' }] },
      plate: { room: 'L', spots: [{ cell: [3, 5], face: 'N' }, { cell: [3, 6], face: 'E' }, { cell: [3, 9], face: 'S' }] },
      glass: { room: 'R', spots: [{ cell: [11, 6], face: 'W' }, { cell: [11, 8], face: 'W' }, { cell: [14, 9], face: 'S' }] }
    },
    SHIELD_BENCH: { cell: [3, 3], face: 'S' }
  };

  // The weather station's upper level spans the Generator annex, central Eye
  // deck and Comms control room, then projects south over the courtyard as a
  // broad observation terrace. Two open-frame stairs join that terrace below.
  CFG.MAPS.wetterjunge.FLOORS = [
    { id: '1', floorY: 0, primary: true, GRID: CFG.MAPS.wetterjunge.GRID,
      ROOMS: CFG.MAPS.wetterjunge.ROOMS, OUTDOOR: CFG.MAPS.wetterjunge.OUTDOOR,
      OPEN_CEIL: CFG.MAPS.wetterjunge.OPEN_CEIL, WINDOWS: CFG.MAPS.wetterjunge.WINDOWS,
      RISERS: CFG.MAPS.wetterjunge.RISERS },
    { id: '2', floorY: 4, OUTDOOR: [],
      FLOOR_OMIT: [[0, 3], [0, 4], [0, 5],
        [5, 1], [5, 2], [5, 3],
        [14, 3], [14, 4], [14, 5]], GRID: [
      'JJJJ.KKKKK.OOOO',
      'JJJJ2KKKKK3OOOO',
      'JJJJ.KKKKK.OOOO',
      'JJJJ.KKKKK.OOOO',
      'JJJJ.KKKKK.OOOO',
      'JJJJ4KKKKK5OOOO',
      '....KKKKKKK....',
      '....KKKKKKK....',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............'
    ], ROOMS: {
      J: { name: 'Upper Climate Lab', floor: 0x303b45, light: 0x77c8df },
      K: { name: 'Eye Observation Deck', floor: 0x333947, light: 0x94b8df },
      O: { name: 'Lightning Control', floor: 0x303b3d, light: 0x74d6c8 }
    }, DOORS: {
      2: { cost: 750, name: 'Climate Lab — North' },
      3: { cost: 750, name: 'Lightning Control — North' },
      4: { cost: 750, name: 'Climate Lab — South' },
      5: { cost: 750, name: 'Lightning Control — South' }
    }, WINDOWS: [
      { cell: [0, 3], dir: 'W' }, { cell: [14, 3], dir: 'E' },
      { cell: [6, 0], dir: 'N' }, { cell: [8, 0], dir: 'N' }
    ] }
  ];

  /* ===================================================================
     KURHAUS — "The Aether Baths"  (single flat floor, no verticality)
     Seven themed wings in ONE outer loop around a central Pump Hall hub,
     8 doors, no dead-ends: Grand Foyer (spawn concourse, S) -> Mineral
     Baths (power, B) -> Sanctum (Pack-a-Punch, N) -> Caldera (lava, V) ->
     Frostworks (cold vents, F) -> Cold Cellar (meat locker, M) -> back to
     the Foyer; Pump Hall (A) bridges Foyer<->Caldera. Every room is a
     clean ~5x5 training oval with >=2 exits; per-wing themed decor lives
     in dressKurhausRoom (map.js).
     PLACEMENT RULE (learned the hard way): perk/power/PaP cells are
     wall-flushed to the NEAREST clear wall of their room — author each
     cell so its nearest wall is free of doors, spawn-window barricades
     AND wall-buy chalk (wallFlush checks doors/windows but not wallbuys).
     =================================================================== */
  CFG.MAPS.kurhaus = {
    id: 'kurhaus',
    name: 'KURHAUS',
    sub: 'The Aether Baths — complete the Founder’s Bargain for one of two buried weapons.',
    wonder: 'maelstrom',
    papRule: 'power',
    atmos: { sky: 0x2a2620, fog: 0x241f18, density: 0.01,
             amb: 0x6a5238, ambI: 0.9, hemiSky: 0xd8c49a, hemiGround: 0x463a2a },
    // warm, opulent, decayed spa-resort. Each WING carries its own floor/light
    // family (gold foyer, molten caldera, icy frostworks, aether sanctum, teal
    // baths, cold meat cellar) so a glance tells you which room you're in.
    palette: { wallA: 0xb8a06a, wallB: 0xa8905c, wood: 0x6e4a2e, plank: 0x855a36,
               metal: 0x9a8a5a, beam: 0x5a4a32, rust: 0x7a5a3a, conc: 0x9c9080,
               deck: 0x7a6a4a, ceil: 0x5e5240, accent: 0xc9a24b, lampTint: 0xffd9a0 },
    // ---- SINGLE FLOOR. Seven distinct themed wings joined in ONE big outer loop
    // around a central Pump Hall (A), with a hub shortcut. Outer ring:
    // Foyer(S) -> Baths(B) -> Sanctum(N) -> Caldera(V) -> Frostworks(F) ->
    // Cold Cellar(M) -> Foyer. Hub A bridges Caldera<->Foyer. 8 doors. Every
    // room has >=2 exits (no dead-ends); each room is a clean ~5x5 training oval
    // and the Foyer is a wide grand concourse (spawn). Power in the Baths,
    // Pack-a-Punch in the Sanctum. (rows are 19 wide, 17 tall)
    GRID: [
      '...................', // 0
      '.NNNNN.VVVVV.FFFFF.', // 1  N=Sanctum  V=Caldera  F=Frostworks
      '.NNNNN.VVVVV.FFFFF.', // 2
      '.NNNNN5VVVVV6FFFFF.', // 3  5:Sanctum-Caldera  6:Caldera-Frostworks
      '.NNNNN.VVVVV.FFFFF.', // 4
      '.NNNNN.VVVVV.FFFFF.', // 5
      '...7.....4.....8...', // 6  7:Sanctum-Baths  4:Caldera-PumpHall  8:Frostworks-Cellar
      '.BBBBB.AAAAA.MMMMM.', // 7  B=Mineral Baths  A=Pump Hall (hub)  M=Cold Cellar
      '.BBBBB.AAAAA.MMMMM.', // 8
      '.BBBBB.AAAAA.MMMMM.', // 9
      '.BBBBB.AAAAA.MMMMM.', // 10
      '.BBBBB.AAAAA.MMMMM.', // 11
      '...2.....1.....3...', // 12 2:Baths-Foyer  1:PumpHall-Foyer  3:Cellar-Foyer
      '.SSSSSSSSSSSSSSSSS.', // 13 S=Grand Foyer concourse (spawn)
      '.SSSSSSSSSSSSSSSSS.', // 14
      '.SSSSSSSSSSSSSSSSS.', // 15
      '...................'  // 16
    ],
    ROOMS: {
      S: { name: 'Grand Foyer',   floor: 0x4a3826, light: 0xe0b070 },
      A: { name: 'Pump Hall',     floor: 0x3a3a30, light: 0xc8b486 },
      V: { name: 'The Caldera',   floor: 0x3a1a10, light: 0xff6a1e },
      F: { name: 'Frostworks',    floor: 0x223e46, light: 0xbfe7f0 },
      N: { name: 'The Sanctum',   floor: 0x2a1a38, light: 0x9c6cf0 },
      B: { name: 'Mineral Baths', floor: 0x163a38, light: 0x4ad0c8 },
      M: { name: 'Cold Cellar',   floor: 0x2c2422, light: 0x9aa6b0 }
    },
    OUTDOOR: [],
    DOORS: {
      1: { cost: 750,  name: 'Pump Hall' },      // Foyer -> Hub (spawn primary)
      2: { cost: 1000, name: 'Mineral Baths' },  // Foyer -> Baths (power)
      3: { cost: 1000, name: 'Cold Cellar' },    // Foyer -> Meat locker
      4: { cost: 1250, name: 'The Caldera' },    // Hub -> Caldera
      6: { cost: 1000, name: 'Frostworks' },     // Caldera -> Frostworks
      5: { cost: 1250, name: 'The Sanctum' },    // Caldera -> Sanctum
      7: { cost: 1250, name: 'The Sanctum' },    // Baths -> Sanctum
      8: { cost: 1000, name: 'Cold Cellar' }     // Frostworks -> Cellar
    },
    WINDOWS: [
      { cell: [3, 1],  dir: 'N' }, { cell: [1, 3], dir: 'W' },   // Sanctum
      { cell: [9, 1],  dir: 'N' },                                // Caldera
      { cell: [15, 1], dir: 'N' }, { cell: [17, 3], dir: 'E' },  // Frostworks
      { cell: [1, 9],  dir: 'W' },                                // Baths
      { cell: [17, 9], dir: 'E' },                                // Cold Cellar
      { cell: [5, 15], dir: 'S' }, { cell: [9, 15], dir: 'S' }, { cell: [13, 15], dir: 'S' },
      { cell: [1, 14], dir: 'W' }, { cell: [17, 14], dir: 'E' }  // Foyer concourse
    ],
    RISERS: [[7, 14], [11, 14]],
    // 8 perks + Der Wunderfizz, spread one-ish per wing so the map forces
    // movement. All power-gated except Quick Revive.
    PERK_MACHINES: [
      { perk: 'revive',     cell: [3, 14],  off: [0, 0] },    // Foyer (spawn)
      { perk: 'stamin',     cell: [15, 14], off: [0, 0] },    // Foyer
      { perk: 'jugg',       cell: [9, 2],   off: [0, 0] },    // Caldera
      { perk: 'speed',      cell: [2, 9],   off: [0, 0] },    // Baths
      { perk: 'mule',       cell: [16, 9],  off: [0, 0] },    // Cold Cellar
      { perk: 'dtap',       cell: [14, 5],  off: [0, 0] },    // Frostworks — biased to the S wall;
                                              // authored at [16,4] it wall-flushed E onto the ak74u wall-buy segment
      { perk: 'deadshot',   cell: [5, 4],   off: [0, 0] },    // Sanctum — biased to the E wall;
                                              // authored at [2,4] it wall-flushed W onto the m16 wall-buy segment
      { perk: 'widows',     cell: [11, 8],  off: [0, 0] },    // Pump Hall
      { perk: 'wonderfizz', cell: [14, 10], off: [0, 0] }     // Cold Cellar vendor
    ],
    WALLBUYS: [
      { gun: 'olympia',  cell: [4, 15],  off: [0, 1.6],  face: 'S' },   // Foyer starter
      { gun: 'mp5k',     cell: [14, 15], off: [0, 1.6],  face: 'S' },   // Foyer
      { gun: 'm14',      cell: [8, 1],   off: [0, -1.6], face: 'N' },   // Caldera — col 8, NOT 9:
                                              // the [9,1] N wall segment is the spawn window's barricade
      { gun: 'mp40',     cell: [1, 8],   off: [-1.6, 0], face: 'W' },   // Baths
      { gun: 'stakeout', cell: [17, 10], off: [1.6, 0],  face: 'E' },   // Cold Cellar
      { gun: 'ak74u',    cell: [17, 4],  off: [1.6, 0],  face: 'E' },   // Frostworks
      { gun: 'm16',      cell: [1, 4],   off: [-1.6, 0], face: 'W' }    // Sanctum
    ],
    BOX_SPOTS: [
      { cell: [9, 9],  off: [0, 0] },    // Pump Hall (start)
      { cell: [15, 8], off: [0, 0] },    // Cold Cellar
      { cell: [9, 4],  off: [0, 0] },    // Caldera
      { cell: [12, 14], off: [0, 0] },   // Foyer concourse — col 12, NOT 11 (the [11,14] cell is a zombie riser)
      { cell: [4, 8], off: [0, 0] }      // Baths — biases to the E wall; authored at
                                         // [3,10] it wall-flushed onto the POWER SWITCH segment
    ],
    TRAPS: [
      { type: 'molten', name: 'Molten Pour', cell: [11, 2], cost: 1000, radius: 5.5, dur: 6, dps: 320, color: 0xe8821e },  // Caldera
      { type: 'cryo',   name: 'Cryo Vent',   cell: [13, 2], cost: 1000, radius: 5.5, dur: 6, dps: 300, color: 0xbfe7f0 },  // Frostworks
      { type: 'tesla',  name: 'Tesla Gate',  cell: [4, 10], cost: 1250, radius: 5.5, dur: 6, dps: 400, color: 0x3a6ce0 }   // Baths
    ],
    TELEPORTERS: [],
    MAINFRAME: null,
    PAP: { cell: [4, 2], off: [0, 0] },       // the Sanctum (aether font) — power-gated; wall-flushes
                                              // to the EAST wall (W/E/N/S tie order), clear of door 5
    POWER: { cell: [1, 10], off: [0, 0] },    // Mineral Baths, WEST wall — a room-centre
                                              // cell wall-flushed to the north wall right in
                                              // front of door 7 (buyable by accident); the
                                              // west wall is door-free (window is on row 9)
    PLAYER_SPAWN: { cell: [9, 14], off: [0, 0] },
    // ---- EASTER EGG — "The Founder's Bargain". 3 of these 9 aether-relic
    // pedestals spawn per match (deterministic pick in interact.js), tucked
    // against out-of-the-way walls in different wings. Activate all 3 to wake
    // the SOUL CHEST in the Pump Hall (the resort's machine heart), feed it 30
    // kills, and it yields the founder's buried prize: a SECOND wonder weapon
    // (eeWonder below). Spots deliberately avoid doors/windows/wallbuys and
    // every wall-flushed machine landing.
    RELIC_SPOTS: [
      { cell: [1, 13],  face: 'W' },   // Foyer, west end behind the reception desk
      { cell: [17, 13], face: 'E' },   // Foyer, east end by the broken column
      { cell: [7, 11],  face: 'S' },   // Pump Hall, south wall behind the pumps
      { cell: [7, 4],   face: 'W' },   // Caldera, west wall among the core crates
      { cell: [17, 2],  face: 'E' },   // Frostworks, behind the coolant tanks
      { cell: [1, 1],   face: 'W' },   // Sanctum, dark north-west corner shelves
      { cell: [5, 7],   face: 'E' },   // Mineral Baths, east wall by the stalls
      { cell: [17, 7],  face: 'E' },   // Cold Cellar, north-east dark corner
      { cell: [13, 11], face: 'S' }    // Cold Cellar, by the bricked-up archway
    ],
    EE_SOULBOX: [9, 8],                // the Pump Hall's heart — feed the machine
    eeName: "THE FOUNDER'S BARGAIN",
    eeRewards: ['aetherlance', 'vosssiphon'],
    eeWonder: 'aetherlance',           // legacy alias; reward now comes from eeRewards
    // wings eligible for the AETHER SURGE round event (double points inside,
    // announced by banner + a pulsing floor ring) — not the spawn concourse
    SURGE_ROOMS: ['V', 'F', 'N', 'B', 'M', 'A'],
    // Zombie Shield scavenger hunt — frame from the drill scaffolds, plate from
    // the coolant plant, glass from the bath stalls' mirror. Assemble in the
    // Foyer. (Walls chosen clear of machines/wallbuys/windows/relics.)
    SHIELD_PARTS: {
      frame: { room: 'V', spots: [{ cell: [10, 1], face: 'N' }, { cell: [11, 5], face: 'S' }, { cell: [7, 5], face: 'W' }] },
      plate: { room: 'F', spots: [{ cell: [13, 1], face: 'W' }, { cell: [16, 5], face: 'S' }, { cell: [17, 1], face: 'E' }] },   // [13,3] crowded door 6
      glass: { room: 'B', spots: [{ cell: [4, 7], face: 'N' }, { cell: [5, 9], face: 'E' }, { cell: [1, 11], face: 'S' }] }
    },
    SHIELD_BENCH: { cell: [7, 15], face: 'S' }
  };
  CFG.MAP_IDS = ['nacht', 'derriese', 'wetterjunge', 'kurhaus'];

  // Copies the chosen map's data onto CFG.* so the rest of the code keeps a
  // single source. Also sets the grid->world centering offsets.
  CFG.setMap = function (id) {
    var m = CFG.MAPS[id];
    if (!m) throw new Error('unknown map ' + id);
    CFG.cur = m;
    // Resolve the floor list. A stacked map declares FLOORS (each its own grid at
    // a floorY, sharing the x,z footprint); a legacy flat map is wrapped as a
    // single ground floor so its build path is byte-identical to before.
    var floors = m.FLOORS || [{ id: '1', floorY: 0, primary: true, GRID: m.GRID, ROOMS: m.ROOMS,
      OUTDOOR: m.OUTDOOR, OPEN_CEIL: m.OPEN_CEIL, FLOOR_OMIT: m.FLOOR_OMIT, WINDOWS: m.WINDOWS, RISERS: m.RISERS }];
    var primary = floors.filter(function (f) { return f.primary; })[0] ||
                  floors.filter(function (f) { return (f.floorY || 0) === 0; })[0] || floors[0];
    m._floors = floors; m._primary = primary;
    // merge every floor's rooms into one lookup (globally-unique letters), each
    // tagged with its floorY so floorYOf / floorAbove / floor materials resolve it
    var rooms = {};
    floors.forEach(function (f) {
      Object.keys(f.ROOMS || {}).forEach(function (rid) {
        var src = f.ROOMS[rid], r = {};
        Object.keys(src).forEach(function (k) { r[k] = src[k]; });
        if (r.floorY === undefined) r.floorY = f.floorY || 0;
        r._floorId = f.id;
        rooms[rid] = r;
      });
    });
    // the primary floor drives the legacy single-grid build (floor slabs, walls,
    // ceilings, doors, machines, props); extra floors are built by buildExtraFloor
    CFG.GRID = primary.GRID;
    CFG.ROOMS = rooms;
    CFG.WINDOWS = primary.WINDOWS || m.WINDOWS || [];
    CFG.RISERS = primary.RISERS || m.RISERS || [];
    ['DOORS', 'PERK_MACHINES', 'WALLBUYS', 'BOX_SPOTS', 'TRAPS', 'TELEPORTERS', 'MAINFRAME',
     'PAP', 'POWER', 'PLAYER_SPAWN', 'RELIC_SPOTS', 'EE_SOULBOX', 'SHIELD_PARTS', 'SHIELD_BENCH']
      .forEach(function (k) { CFG[k] = m[k]; });
    // the main build reads CFG.cur.OUTDOOR / OPEN_CEIL / FLOOR_OMIT — point them at
    // the primary floor (a no-op for a wrapped legacy map)
    m.OUTDOOR = primary.OUTDOOR || m.OUTDOOR || [];
    m.OPEN_CEIL = primary.OPEN_CEIL || m.OPEN_CEIL || [];
    m.FLOOR_OMIT = primary.FLOOR_OMIT || m.FLOOR_OMIT || [];
    CFG._cx = primary.GRID[0].length / 2 - 0.5;
    CFG._cz = primary.GRID.length / 2 - 0.5;
    // per-map grid scale: a map may shrink its footprint without re-authoring
    // grids/placements by declaring a smaller cellSize (default 4m). WALL_H
    // (inter-floor height) stays fixed so floors don't get cramped vertically.
    CFG.CELL = m.cellSize || 4;
    return m;
  };

  CFG.TELE_LINK_WINDOW = 30;
  CFG.TELE_USE_COST = 500;
  CFG.PAP_COST = 5000;
  CFG.DPAP_COST = 10000;  // re-Pack-a-Punch an upgraded gun for the Dead-Wire tier
  CFG.TPAP_COST = 10000;  // ASCEND a double-packed gun: rolls one of the three
                          // tier-3 variants below (pap again to re-roll a new one)
  // tier-3 PaP variants — each a kill-driven proc layered on top of Dead Wire.
  // 'every' = kills between procs while the gun is held.
  CFG.PAP_VARIANTS = {
    starburst:  { name: 'Starburst',    every: 5, color: 0xffb84a,
                  desc: 'every 5th kill launches a firework that bursts over the horde' },
    soulharvest:{ name: 'Soul Harvest', every: 8, color: 0x8aff9a,
                  desc: 'every 8th kill pays +100 points and knits 20 health' },
    concussor:  { name: 'Concussor',    every: 6, color: 0x7ac8ff,
                  desc: 'every 6th kill detonates a concussive nova that flings the horde' }
  };

  /* ---------------------------------------------------------------- perks */
  CFG.PERKS = {
    revive: { name: 'Quick Revive', cost: 500,  color: 0x55ccff, icon: 'QR' },
    jugg:   { name: 'Juggernog',    cost: 2500, color: 0xff3344, icon: 'JG' },
    speed:  { name: 'Speed Cola',   cost: 3000, color: 0x44ee66, icon: 'SC' },
    dtap:   { name: 'Double Tap II', cost: 2000, color: 0xffaa22, icon: 'DT' },
    stamin: { name: 'Stamin-Up',    cost: 2000, color: 0xeeee44, icon: 'SU' },
    mule:   { name: 'Mule Kick',    cost: 4000, color: 0x44ff88, icon: 'MK' },
    widows: { name: "Widow's Wine", cost: 4000, color: 0x8a2be2, icon: 'WW' },
    phd:    { name: 'PhD Slider',   cost: 2000, color: 0xcc6a1f, icon: 'PhD' },
    cherry: { name: 'Electric Cherry', cost: 2000, color: 0x33ddff, icon: 'EC' },
    deadshot: { name: 'Deadshot Daiquiri', cost: 1500, color: 0xb98a3a, icon: 'DS' },
    // Der Wunderfizz: a mystery-box-style perk vendor (not an ownable perk)
    wonderfizz: { name: 'Der Wunderfizz', cost: 1500, color: 0xc59b3a, icon: '?', vendor: true }
  };
  CFG.MAX_PERKS = 4;
  CFG.WONDERFIZZ_COST = 1500;
  // perks the Wunderfizz can roll (everything ownable; vendor entries excluded)
  CFG.FIZZ_POOL = ['revive', 'jugg', 'speed', 'dtap', 'stamin', 'mule', 'widows', 'phd', 'cherry', 'deadshot'];
  CFG.QR_MAX_BUYS = 3;

  /* -------------------------------------------------------------- weapons */
  // dmg per bullet (pellets multiply), rpm, mag, reserve, reload (s),
  // mode: 'auto' | 'semi' | 'pump', spread in degrees, cls drives the
  // viewmodel template + sound; vm:{} overrides model parts (see weapons.js).
  // PaP defaults (if not overridden): dmg x2.2, mag x1.6, reserve x2.
  // wonder:true guns only appear in the box on the map whose wonder they are.
  CFG.WEAPONS = {
    /* ----------------------------------------------------------- pistols */
    m1911: {
      name: 'M1911', cls: 'pistol', dmg: 25, head: 4, rpm: 360, mag: 8,
      reserve: 32, reload: 1.4, mode: 'semi', spread: 1.6,
      pap: { name: 'Mustang & Sally', dmg: 900, mag: 12, reserve: 72,
             projectile: 'rocket', rpm: 200, spread: 0.5, akimbo: true }
    },
    makarov: {
      name: 'Makarov', cls: 'pistol', dmg: 30, head: 4, rpm: 320, mag: 8,
      reserve: 64, reload: 1.5, mode: 'semi', spread: 1.5, box: 0.7,
      pap: { name: '9mm Mauler' }
    },
    python: {
      name: 'Python', cls: 'pistol', dmg: 150, head: 4, rpm: 240, mag: 6,
      reserve: 84, reload: 2.2, mode: 'semi', spread: 1.0, box: 1,
      vm: { mag: 'cyl', len: 1.4 },
      pap: { name: 'Cobra', dmg: 350, mag: 12, reserve: 96, akimbo: true }
    },
    cz75: {
      name: 'CZ75', cls: 'pistol', dmg: 40, head: 3, rpm: 750, mag: 15,
      reserve: 120, reload: 1.6, mode: 'auto', spread: 2.2, box: 0.9,
      pap: { name: 'Calamity' }
    },
    fiveseven: {
      name: 'Five-Seven', cls: 'pistol', dmg: 45, head: 3, rpm: 450, mag: 20,
      reserve: 140, reload: 1.5, mode: 'semi', spread: 1.3, box: 0.9,
      pap: { name: 'Ultra' }
    },
    b23r: {
      name: 'B23R', cls: 'pistol', dmg: 45, head: 3, rpm: 850, mag: 15,
      reserve: 135, reload: 1.6, mode: 'auto', spread: 2.0, box: 0.9,
      pap: { name: 'B34R' }
    },
    executioner: {
      name: 'Executioner', cls: 'pistol', dmg: 100, head: 1.5, pellets: 5,
      rpm: 150, mag: 5, reserve: 40, reload: 2.4, mode: 'semi', spread: 4.0,
      range: 10, box: 0.7, vm: { mag: 'cyl', len: 1.1 },
      pap: { name: 'Voice of Justice', dmg: 65, range: 14 }
    },
    kap40: {
      name: 'KAP-40', cls: 'pistol', dmg: 45, head: 3, rpm: 800, mag: 12,
      reserve: 108, reload: 1.5, mode: 'auto', spread: 2.1, box: 0.8,
      pap: { name: 'KAP-Punisher' }
    },
    /* -------------------------------------------------------------- SMGs */
    mp5k: {
      name: 'MP5K', cls: 'smg', dmg: 60, head: 3, rpm: 750, mag: 30,
      reserve: 120, reload: 1.9, mode: 'auto', spread: 2.6, wall: 1000,
      pap: { name: 'MP115 Kollider', dmg: 120, mag: 40, reserve: 200 }
    },
    mp40: {
      name: 'MP40', cls: 'smg', dmg: 70, head: 3, rpm: 520, mag: 32,
      reserve: 192, reload: 2.1, mode: 'auto', spread: 2.4, wall: 1000,
      vm: { mag: 'straight', magLen: 1.4, col: 0x3d3a33 },
      pap: { name: 'The Afterburner', dmg: 140, mag: 64, reserve: 256, akimbo: true }
    },
    ak74u: {
      name: 'AK-74u', cls: 'smg', dmg: 90, head: 3, rpm: 700, mag: 20,
      reserve: 160, reload: 2.2, mode: 'auto', spread: 2.5, wall: 1200,
      vm: { mag: 'curved', wood: 1 },
      pap: { name: 'AK74fu2', dmg: 180, mag: 40, reserve: 280 }
    },
    pm63: {
      name: 'PM63', cls: 'smg', dmg: 45, head: 3, rpm: 900, mag: 20,
      reserve: 180, reload: 1.7, mode: 'auto', spread: 2.8, box: 0.8,
      vm: { len: 0.7, stock: 'none' },
      pap: { name: 'Tokyo & Rose', mag: 40 }
    },
    mpl: {
      name: 'MPL', cls: 'smg', dmg: 55, head: 3, rpm: 750, mag: 24,
      reserve: 144, reload: 1.8, mode: 'auto', spread: 2.5, box: 0.9,
      pap: { name: 'MPL-LF' }
    },
    spectre: {
      name: 'Spectre M4', cls: 'smg', dmg: 55, head: 3, rpm: 850, mag: 30,
      reserve: 180, reload: 1.9, mode: 'auto', spread: 2.6, box: 0.9,
      pap: { name: 'Phantom' }
    },
    thompson: {
      name: 'M1A1 Thompson', cls: 'smg', dmg: 65, head: 3, rpm: 700, mag: 30,
      reserve: 210, reload: 2.0, mode: 'auto', spread: 2.5, box: 0.9,
      vm: { wood: 1, mag: 'drum', len: 1.1 },
      pap: { name: 'Chicago Typewriter', mag: 50 }
    },
    pdw57: {
      name: 'PDW-57', cls: 'smg', dmg: 70, head: 3, rpm: 850, mag: 50,
      reserve: 200, reload: 2.2, mode: 'auto', spread: 2.4, box: 0.9,
      vm: { bullpup: 1 },
      pap: { name: 'Predictive Death Wish', mag: 75 }
    },
    msmc: {
      name: 'MSMC', cls: 'smg', dmg: 75, head: 3, rpm: 800, mag: 30,
      reserve: 150, reload: 1.9, mode: 'auto', spread: 2.3, box: 0.9,
      pap: { name: 'Micro Sonic Massacre' }
    },
    vector: {
      name: 'Vector K10', cls: 'smg', dmg: 60, head: 3, rpm: 1100, mag: 25,
      reserve: 150, reload: 1.8, mode: 'auto', spread: 2.7, box: 0.85,
      pap: { name: 'Insurrection', mag: 40 }
    },
    uzi: {
      name: 'Uzi', cls: 'smg', dmg: 55, head: 3, rpm: 780, mag: 25,
      reserve: 175, reload: 1.9, mode: 'auto', spread: 2.8, box: 0.8,
      vm: { len: 0.65, stock: 'skeleton' },
      pap: { name: 'Uncle Gal' }
    },
    ppsh: {
      name: 'PPSh-41', cls: 'smg', dmg: 70, head: 3, rpm: 1000, mag: 71,
      reserve: 213, reload: 2.3, mode: 'auto', spread: 2.7, box: 0.7,
      vm: { wood: 1, mag: 'drum', len: 1.0 },
      pap: { name: 'The Reaper', dmg: 130, mag: 71, reserve: 355 }
    },
    kuda: {
      name: 'Kuda', cls: 'smg', dmg: 65, head: 3, rpm: 690, mag: 40,
      reserve: 200, reload: 2.0, mode: 'auto', spread: 2.3, box: 0.85,
      pap: { name: 'Predikta' }
    },
    vmp: {
      name: 'VMP', cls: 'smg', dmg: 60, head: 3, rpm: 800, mag: 40,
      reserve: 200, reload: 1.9, mode: 'auto', spread: 2.5, box: 0.85,
      pap: { name: 'Facelift' }
    },
    weevil: {
      name: 'Weevil', cls: 'smg', dmg: 62, head: 3, rpm: 750, mag: 48,
      reserve: 192, reload: 2.1, mode: 'auto', spread: 2.4, box: 0.8,
      vm: { bullpup: 1 },
      pap: { name: 'Tinder' }
    },
    /* ------------------------------------------------------------ rifles */
    m14: {
      name: 'M14', cls: 'rifle', dmg: 150, head: 2.5, rpm: 300, mag: 8,
      reserve: 96, reload: 1.9, mode: 'semi', spread: 0.9, wall: 500,
      vm: { wood: 1 },
      pap: { name: 'Mnesia', dmg: 320, mag: 24, reserve: 240, mode: 'burst', burst: 3, rpm: 420 }
    },
    m16: {
      name: 'M16', cls: 'rifle', dmg: 90, head: 3, rpm: 460, mag: 30,
      reserve: 120, reload: 2.0, mode: 'semi', spread: 1.1, wall: 1200,
      vm: { carryHandle: 1 },
      pap: { name: 'Skullcrusher', dmg: 190, mag: 30, reserve: 270, mode: 'auto' }
    },
    commando: {
      name: 'Commando', cls: 'rifle', dmg: 110, head: 2.8, rpm: 750, mag: 30,
      reserve: 270, reload: 2.0, mode: 'auto', spread: 1.7, box: 1,
      pap: { name: 'Predator', dmg: 90, mag: 40, reserve: 360 }
    },
    galil: {
      name: 'Galil', cls: 'rifle', dmg: 110, head: 2.8, rpm: 750, mag: 35,
      reserve: 315, reload: 2.3, mode: 'auto', spread: 1.8, box: 1,
      vm: { mag: 'curved', wood: 1 },
      pap: { name: 'Lamentation', dmg: 230, mag: 50, reserve: 490 }
    },
    famas: {
      name: 'FAMAS', cls: 'rifle', dmg: 90, head: 2.8, rpm: 900, mag: 30,
      reserve: 270, reload: 2.2, mode: 'auto', spread: 2.0, box: 1,
      vm: { bullpup: 1 },
      pap: { name: 'G16-GL35', dmg: 80, mag: 45, reserve: 360 }
    },
    aug: {
      name: 'AUG', cls: 'rifle', dmg: 110, head: 2.8, rpm: 720, mag: 30,
      reserve: 270, reload: 2.1, mode: 'auto', spread: 1.6, box: 1,
      vm: { bullpup: 1, scope: 1, col: 0x4a523e },
      pap: { name: 'AUG-50M3', dmg: 100, mag: 40, reserve: 360 }
    },
    fal: {
      name: 'FN FAL', cls: 'rifle', dmg: 250, head: 2.5, rpm: 420, mag: 20,
      reserve: 160, reload: 2.1, mode: 'semi', spread: 1.0, box: 0.9,
      vm: { wood: 1, len: 1.15 },
      pap: { name: 'EPC WN', mode: 'auto' }
    },
    g11: {
      name: 'G11', cls: 'rifle', dmg: 110, head: 3, rpm: 600, mag: 48,
      reserve: 144, reload: 2.5, mode: 'semi', spread: 0.8, box: 0.85,
      vm: { bullpup: 1, scope: 1, col: 0x35383d },
      pap: { name: 'G115 Generator', mode: 'auto' }
    },
    an94: {
      name: 'AN-94', cls: 'rifle', dmg: 105, head: 2.8, rpm: 900, mag: 30,
      reserve: 270, reload: 2.2, mode: 'auto', spread: 1.6, box: 0.9,
      vm: { mag: 'curved' },
      pap: { name: 'Actuated Neutralizer 94000' }
    },
    type25: {
      name: 'Type 25', cls: 'rifle', dmg: 95, head: 2.8, rpm: 950, mag: 30,
      reserve: 270, reload: 2.1, mode: 'auto', spread: 1.9, box: 0.9,
      vm: { bullpup: 1 },
      pap: { name: 'Strain 25' }
    },
    mtar: {
      name: 'MTAR', cls: 'rifle', dmg: 105, head: 2.8, rpm: 750, mag: 30,
      reserve: 270, reload: 2.0, mode: 'auto', spread: 1.6, box: 0.9,
      vm: { bullpup: 1 },
      pap: { name: 'Malevolent Taxonomic Anodized Redeemer' }
    },
    scarh: {
      name: 'SCAR-H', cls: 'rifle', dmg: 120, head: 2.8, rpm: 650, mag: 30,
      reserve: 240, reload: 2.1, mode: 'auto', spread: 1.4, box: 0.85,
      vm: { col: 0x6e5f3f },
      pap: { name: 'Agonizer' }
    },
    m27: {
      name: 'M27', cls: 'rifle', dmg: 95, head: 2.8, rpm: 800, mag: 30,
      reserve: 300, reload: 2.0, mode: 'auto', spread: 1.7, box: 0.9,
      pap: { name: 'Mystifier' }
    },
    m8a1: {
      name: 'M8A1', cls: 'rifle', dmg: 100, head: 2.8, rpm: 1000, mag: 32,
      reserve: 256, reload: 2.0, mode: 'auto', spread: 1.8, box: 0.85,
      vm: { bullpup: 1 },
      pap: { name: 'Master of Anarchy' }
    },
    kn44: {
      name: 'KN-44', cls: 'rifle', dmg: 115, head: 2.8, rpm: 600, mag: 30,
      reserve: 270, reload: 2.1, mode: 'auto', spread: 1.5, box: 0.9,
      pap: { name: 'KN-Undead' }
    },
    icr1: {
      name: 'ICR-1', cls: 'rifle', dmg: 100, head: 2.8, rpm: 638, mag: 30,
      reserve: 270, reload: 2.0, mode: 'auto', spread: 1.3, box: 0.9,
      pap: { name: 'ICR-X9' }
    },
    manowar: {
      name: 'Man-O-War', cls: 'rifle', dmg: 140, head: 2.8, rpm: 500, mag: 30,
      reserve: 240, reload: 2.3, mode: 'auto', spread: 1.4, box: 0.85,
      vm: { mag: 'curved', wood: 1 },
      pap: { name: 'Stallion O-War' }
    },
    hvk30: {
      name: 'HVK-30', cls: 'rifle', dmg: 95, head: 2.8, rpm: 750, mag: 40,
      reserve: 280, reload: 2.0, mode: 'auto', spread: 1.6, box: 0.85,
      pap: { name: 'HVK-Reckoning' }
    },
    sheiva: {
      name: 'Sheiva', cls: 'rifle', dmg: 200, head: 3, rpm: 400, mag: 28,
      reserve: 196, reload: 2.2, mode: 'semi', spread: 0.9, box: 0.85,
      vm: { bullpup: 1 },
      pap: { name: 'Sheiva-Ultiva' }
    },
    /* ---------------------------------------------------------- shotguns */
    olympia: {
      name: 'Olympia', cls: 'shotgun', dmg: 160, head: 1.5, pellets: 8, rpm: 120,
      mag: 2, reserve: 38, reload: 1.8, mode: 'semi', spread: 5.5, wall: 500,
      range: 14, vm: { twin: 1, wood: 1 },
      pap: { name: 'Hades', dmg: 300, mag: 4, reserve: 60, range: 18 }
    },
    stakeout: {
      name: 'Stakeout', cls: 'shotgun', dmg: 200, head: 1.5, pellets: 8, rpm: 70,
      mag: 6, reserve: 54, reload: 2.6, mode: 'pump', spread: 4.6, wall: 1500,
      range: 16, vm: { pump: 1, wood: 1 },
      pap: { name: 'Raid', dmg: 400, mag: 10, reserve: 90, range: 22 }
    },
    spas12: {
      name: 'SPAS-12', cls: 'shotgun', dmg: 150, head: 1.5, pellets: 8, rpm: 180,
      mag: 8, reserve: 56, reload: 2.4, mode: 'semi', spread: 4.2, box: 1,
      range: 15, vm: { stock: 'skeleton' },
      pap: { name: 'SPAZ-24', dmg: 300, mag: 24, reserve: 96, range: 20 }
    },
    hs10: {
      name: 'HS10', cls: 'shotgun', dmg: 140, head: 1.5, pellets: 6, rpm: 220,
      mag: 4, reserve: 36, reload: 2.2, mode: 'semi', spread: 4.0, box: 0.8,
      range: 13, vm: { len: 0.75, stock: 'none' },
      pap: { name: 'Typhoid & Mary', mag: 8 }
    },
    r870: {
      name: 'R870 MCS', cls: 'shotgun', dmg: 190, head: 1.5, pellets: 8, rpm: 65,
      mag: 7, reserve: 49, reload: 2.7, mode: 'pump', spread: 4.4, box: 0.9,
      range: 17, vm: { pump: 1 },
      pap: { name: 'Refitted 870', dmg: 90, range: 24 }
    },
    ksg: {
      name: 'KSG', cls: 'shotgun', dmg: 1500, head: 2.5, rpm: 100, mag: 12,
      reserve: 48, reload: 2.5, mode: 'pump', spread: 1.2, box: 0.8,
      range: 30, vm: { pump: 1, bullpup: 1 },
      pap: { name: 'Krakatoa', dmg: 650, range: 45 }
    },
    m1216: {
      name: 'M1216', cls: 'shotgun', dmg: 100, head: 1.5, pellets: 6, rpm: 300,
      mag: 16, reserve: 64, reload: 2.8, mode: 'semi', spread: 4.5, box: 0.8,
      range: 13, vm: { mag: 'drum' },
      pap: { name: 'Sweeper', mag: 32 }
    },
    /* -------------------------------------------------------------- LMGs */
    rpk: {
      name: 'RPK', cls: 'lmg', dmg: 130, head: 2.8, rpm: 650, mag: 100,
      reserve: 400, reload: 3.4, mode: 'auto', spread: 2.2, box: 1,
      vm: { mag: 'drum', wood: 1 },
      pap: { name: 'R115 Resonator', dmg: 100, mag: 125, reserve: 500 }
    },
    hk21: {
      name: 'HK21', cls: 'lmg', dmg: 140, head: 2.8, rpm: 600, mag: 125,
      reserve: 500, reload: 3.8, mode: 'auto', spread: 2.3, box: 1,
      pap: { name: 'H115 Oscillator', dmg: 110, mag: 150, reserve: 750 }
    },
    lsat: {
      name: 'LSAT', cls: 'lmg', dmg: 130, head: 2.8, rpm: 750, mag: 100,
      reserve: 400, reload: 3.6, mode: 'auto', spread: 2.1, box: 0.9,
      pap: { name: 'FSIRT' }
    },
    hamr: {
      name: 'HAMR', cls: 'lmg', dmg: 135, head: 2.8, rpm: 650, mag: 75,
      reserve: 375, reload: 3.3, mode: 'auto', spread: 2.0, box: 0.9,
      vm: { scope: 1 },
      pap: { name: 'SLDG HAMR' }
    },
    qbb: {
      name: 'QBB LSW', cls: 'lmg', dmg: 125, head: 2.8, rpm: 800, mag: 75,
      reserve: 300, reload: 3.2, mode: 'auto', spread: 2.2, box: 0.85,
      vm: { bullpup: 1, mag: 'drum' },
      pap: { name: 'The Heavy Water' }
    },
    gorgon: {
      name: 'Gorgon', cls: 'lmg', dmg: 180, head: 2.8, rpm: 480, mag: 75,
      reserve: 375, reload: 4.0, mode: 'auto', spread: 1.9, box: 0.8,
      vm: { scope: 1, mag: 'box' },
      pap: { name: 'Petrifier' }
    },
    deathmachine: {
      name: 'Death Machine', cls: 'minigun', dmg: 1000, head: 2.5, rpm: 1400,
      mag: 150, reserve: 600, reload: 4.5, mode: 'auto', spread: 3.6, box: 1.6,
      pap: { name: 'Meat Grinder', dmg: 2400 }
    },
    /* ----------------------------------------------------------- snipers */
    l96a1: {
      name: 'L96A1', cls: 'sniper', dmg: 1500, head: 5, rpm: 45, mag: 5,
      reserve: 45, reload: 2.8, mode: 'pump', spread: 0.3, box: 0.7,
      adsFov: 28, vm: { scope: 1, wood: 1 },
      pap: { name: 'L115 Isolator', dmg: 1100 }
    },
    dragunov: {
      name: 'Dragunov', cls: 'sniper', dmg: 1000, head: 4, rpm: 220, mag: 10,
      reserve: 60, reload: 2.6, mode: 'semi', spread: 0.5, box: 0.7,
      adsFov: 30, vm: { scope: 1, wood: 1, mag: 'straight' },
      pap: { name: 'D115 Disassembler', dmg: 880 }
    },
    dsr50: {
      name: 'DSR 50', cls: 'sniper', dmg: 2000, head: 6, rpm: 40, mag: 6,
      reserve: 42, reload: 2.9, mode: 'pump', spread: 0.25, box: 0.65,
      adsFov: 26, vm: { scope: 1, bullpup: 1 },
      pap: { name: 'Dead Specimen Reactor 5000', dmg: 1800 }
    },
    ballista: {
      name: 'Ballista', cls: 'sniper', dmg: 1700, head: 5, rpm: 55, mag: 7,
      reserve: 49, reload: 2.7, mode: 'pump', spread: 0.3, box: 0.7,
      adsFov: 28, vm: { scope: 1 },
      pap: { name: 'B115 Accelerator', dmg: 1350 }
    },
    locus: {
      name: 'Locus', cls: 'sniper', dmg: 1800, head: 6, rpm: 50, mag: 5,
      reserve: 45, reload: 2.8, mode: 'pump', spread: 0.25, box: 0.7,
      adsFov: 26, vm: { scope: 1, bullpup: 1 },
      pap: { name: 'Lukos' }
    },
    drakon: {
      name: 'Drakon', cls: 'sniper', dmg: 1100, head: 4.5, rpm: 280, mag: 10,
      reserve: 70, reload: 2.5, mode: 'semi', spread: 0.5, box: 0.7,
      adsFov: 32, vm: { scope: 1 },
      pap: { name: 'Serpent' }
    },
    /* --------------------------------------------------------- launchers */
    m72law: {
      name: 'M72 LAW', cls: 'launcher', dmg: 1000, head: 1, rpm: 60, mag: 1,
      reserve: 20, reload: 3.0, mode: 'semi', spread: 0.6, box: 0.5,
      adsFov: 50, projectile: 'rocket',
      pap: { name: 'M72 Anarchy', dmg: 1800, mag: 3, reserve: 30 }
    },
    chinalake: {
      name: 'China Lake', cls: 'launcher', dmg: 800, head: 1, rpm: 45, mag: 2,
      reserve: 20, reload: 3.2, mode: 'pump', spread: 0.8, box: 0.5,
      adsFov: 52, projectile: 'rocket', vm: { pump: 1 },
      pap: { name: 'China Beach', dmg: 1400, mag: 4, reserve: 40 }
    },
    /* ----------------------------------------------------------- wonders */
    raygun: {
      name: 'Ray Gun', cls: 'raygun', dmg: 1000, head: 1, rpm: 180, mag: 20,
      reserve: 160, reload: 3.0, mode: 'semi', spread: 0.4, box: 3.0,
      projectile: 'ray',
      pap: { name: "Porter's X2 Ray Gun", dmg: 2000, mag: 40, reserve: 200 }
    },
    // universal box wonder weapon — a 3-round burst splitting ray (no map
    // 'wonder' flag, so it can roll on every map like the Ray Gun)
    raygun2: {
      name: 'Ray Gun Mark II', cls: 'raygun', dmg: 620, head: 1, rpm: 380, mag: 21,
      reserve: 189, reload: 3.0, mode: 'burst', burst: 3, spread: 1.3, box: 1.6,
      projectile: 'ray',
      pap: { name: 'GL Ray Gun Mark II', dmg: 1300, mag: 42, reserve: 252, spread: 1.0 }
    },
    thunder: {
      name: 'Thundergun', cls: 'thunder', dmg: 0, head: 1, rpm: 90, mag: 2,
      reserve: 12, reload: 3.0, mode: 'semi', spread: 0, box: 2.5,
      projectile: 'wind', wonder: true,
      pap: { name: 'Zeus Cannon', mag: 4, reserve: 24 }
    },
    wunderwaffe: {
      name: 'Wunderwaffe DG-2', cls: 'wunder', dmg: 999999, head: 1, rpm: 100,
      mag: 3, reserve: 15, reload: 3.0, mode: 'semi', spread: 0, box: 2.5,
      projectile: 'chain', wonder: true, chain: 10, chainRadius: 5.5,
      pap: { name: 'Wunderwaffe DG-3 JZ', mag: 6, reserve: 30,
             chain: 24, chainRadius: 7.5 }
    },
    stormcaller: {
      name: 'Wettermacher', cls: 'storm', dmg: 2500, head: 1, rpm: 80,
      mag: 4, reserve: 16, reload: 3.2, mode: 'semi', spread: 0, box: 2.5,
      projectile: 'storm', wonder: true, stormDur: 4, stormRadius: 5.5,
      pap: { name: 'Auge des Sturms', dmg: 5000, mag: 8, reserve: 24,
             stormDur: 6.5, stormRadius: 7.5 }
    },
    // Kurhaus wonder weapon — the IMPLOSION driver, the anti-Thundergun: the
    // projectile detonates into a vacuum that DRAGS every zombie nearby into a
    // clump at the point, then the clump detonates. Nothing else in the
    // arsenal pulls. Flagged wonder:true so it only rolls on Kurhaus.
    maelstrom: {
      name: 'Maelstrom Driver', cls: 'storm', dmg: 3200, head: 1, rpm: 75,
      mag: 4, reserve: 16, reload: 3.2, mode: 'semi', spread: 0, box: 2.5,
      vm: { driver: 1 },
      projectile: 'implode', wonder: true,
      pullDur: 1.3, pullRadius: 8, burstRadius: 4,
      pap: { name: 'Maelstrom Driver — Event Horizon', dmg: 7000, mag: 8, reserve: 24,
             pullDur: 1.7, pullRadius: 11, burstRadius: 5.5 }
    },
    // Kurhaus's SECOND wonder — the founder's own weapon, granted ONLY by
    // completing the Founder's Bargain quest (never rolls in any box: wonder
    // weapons roll only where they're the map wonder, and no map claims it).
    // A piercing aether lance: skewers every zombie along its line.
    aetherlance: {
      name: 'Aether Lance', cls: 'storm', dmg: 4200, head: 1, rpm: 55,
      mag: 2, reserve: 8, reload: 2.8, mode: 'semi', spread: 0, box: 0,
      vm: { lance: 1 },
      projectile: 'lance', wonder: true, lanceRange: 45, pierceRadius: 1.3,
      pap: { name: "Voss's Judgement", dmg: 9500, mag: 3, reserve: 12,
             lanceRange: 60, pierceRadius: 2.1 }
    },
    nachtlicht: {
      name: 'Nachtlicht', cls: 'launcher', dmg: 2400, head: 1, rpm: 45,
      mag: 1, reserve: 5, reload: 2.5, mode: 'semi', spread: 0, box: 0,
      vm: { len: 0.72, col: 0x7a2d18 }, projectile: 'flare', wonder: true,
      flareDur: 7, flareRadius: 13,
      pap: { name: 'Letztes Signal', dmg: 5200, mag: 2, reserve: 8, flareDur: 9, flareRadius: 16 }
    },
    minenwerfer115: {
      name: 'Minenwerfer 115', cls: 'launcher', dmg: 3600, head: 1, rpm: 50,
      mag: 2, reserve: 8, reload: 2.8, mode: 'semi', spread: 0, box: 0,
      vm: { len: 0.88, drum: 1, col: 0x3f4a35 }, projectile: 'soulmine', wonder: true,
      mineNeed: 5, mineRadius: 4.5,
      pap: { name: 'Totenfeld', dmg: 7600, mag: 3, reserve: 12, mineNeed: 4, mineRadius: 6 }
    },
    seelenmotor: {
      name: 'Seelenmotor', cls: 'wunder', dmg: 1900, head: 1, rpm: 55,
      mag: 3, reserve: 12, reload: 3.0, mode: 'semi', spread: 0, box: 0,
      vm: { motor: 1, len: 0.95 }, projectile: 'piston', wonder: true,
      pistonDur: 4, pistonWidth: 1.5, pistonRange: 16,
      pap: { name: 'Ewige Schicht', dmg: 3900, mag: 5, reserve: 20, pistonDur: 6, pistonWidth: 2.2 }
    },
    nachbildner115: {
      name: 'Nachbildner 115', cls: 'wunder', dmg: 2600, head: 1, rpm: 50,
      mag: 2, reserve: 10, reload: 2.8, mode: 'semi', spread: 0, box: 0,
      vm: { prism: 1, len: 0.8 }, projectile: 'echo', wonder: true,
      echoPulses: 2, echoRange: 38,
      pap: { name: 'Massenkopie', dmg: 5200, mag: 3, reserve: 15, echoPulses: 4, echoRange: 50 }
    },
    blitzfanger: {
      name: 'Blitzfänger', cls: 'storm', dmg: 1100, head: 1, rpm: 70,
      mag: 2, reserve: 10, reload: 2.6, mode: 'semi', spread: 0, box: 0,
      vm: { rods: 1, len: 0.84 }, projectile: 'rod', wonder: true,
      rodDur: 12, rodRadius: 1.0,
      pap: { name: 'Himmelszaun', dmg: 2400, mag: 4, reserve: 16, rodDur: 18, rodRadius: 1.4 }
    },
    kryolithwerfer: {
      name: 'Kryolithwerfer', cls: 'storm', dmg: 2800, head: 1, rpm: 65,
      mag: 4, reserve: 16, reload: 2.8, mode: 'semi', spread: 0, box: 0,
      vm: { cryo: 1, len: 0.9 }, projectile: 'kryolith', wonder: true,
      iceSpeed: 18, iceRadius: 1.3,
      pap: { name: 'Absoluter Nullpunkt', dmg: 5900, mag: 6, reserve: 24, iceSpeed: 24, iceRadius: 2.0 }
    },
    vosssiphon: {
      name: "Voss's Siphon", cls: 'storm', dmg: 900, head: 1, rpm: 240,
      mag: 12, reserve: 48, reload: 2.6, mode: 'auto', spread: 0, box: 0,
      vm: { siphon: 1, len: 0.78 }, projectile: 'siphon', wonder: true,
      siphonHeal: 18, siphonTargets: 1,
      pap: { name: 'Fountain of Voss', dmg: 1900, mag: 20, reserve: 80, siphonHeal: 28, siphonTargets: 3 }
    }
  };
  // Mystery box also rolls monkey bombs as a pseudo-weapon entry.
  CFG.BOX_COST = 950;
  CFG.MONKEY_BOX_WEIGHT = 2.2;
  CFG.WALL_AMMO_FACTOR = 0.5;     // refill = wall cost / 2
  CFG.PAP_AMMO_COST = 4500;       // wall refill once upgraded
  CFG.FRAGS_COST = 250;

  /* ===================== weapon rarity + Mystery Box odds ================
     Two-stage box selection: pick a RARITY bucket by these target shares, then
     a weapon within it (weighted by the per-weapon `box` value). This keeps
     normal firearms the overwhelming majority regardless of how many weapons
     live in each bucket, and makes special/wonder weapons genuinely rare.
     Death Machine stays a power-up (never boxed).                          */
  CFG.RARITY_TARGET = { common: 0.50, uncommon: 0.30, rare: 0.14, special: 0.05, wonder: 0.025 };
  CFG.WONDER_MIN_ROUND = 5;              // wonder weapons can't roll before round 5
  CFG.POST_SPECIAL_SPECIAL_MULT = 0.30;  // dampen special right after a special/wonder
  CFG.POST_SPECIAL_WONDER_MULT = 0.0;    // never two wonders/specials back-to-back at full odds
  CFG.BOX_EXCLUDE = ['deathmachine'];    // power-up only — never in the box pool

  // default bucket by weapon class; specific guns can override below
  CFG.CLASS_RARITY = {
    pistol: 'common', smg: 'uncommon', shotgun: 'uncommon', rifle: 'uncommon',
    lmg: 'rare', sniper: 'rare', launcher: 'rare', minigun: 'special',
    raygun: 'special', thunder: 'wonder', wunder: 'wonder', storm: 'wonder'
  };
  // promote dependable, basic full-autos / pump shotguns to the common pool
  CFG.RARITY_COMMON = ['mp5k', 'mp40', 'pm63', 'mpl', 'uzi', 'ppsh', 'm16', 'famas', 'type25', 'olympia', 'stakeout'];
  // explicit per-weapon overrides (strong semis, power/utility, ray guns, wonders)
  CFG.RARITY_OVERRIDE = {
    python: 'uncommon', executioner: 'uncommon',
    fal: 'rare', m14: 'rare', sheiva: 'rare', g11: 'rare',
    m72law: 'rare', chinalake: 'rare',
    raygun: 'special', raygun2: 'special', deathmachine: 'special',
    thunder: 'wonder', wunderwaffe: 'wonder', stormcaller: 'wonder'
  };
  CFG.weaponRarity = function (id) {
    var w = CFG.WEAPONS[id]; if (!w) return 'common';
    if (CFG.RARITY_OVERRIDE[id]) return CFG.RARITY_OVERRIDE[id];
    if (CFG.RARITY_COMMON.indexOf(id) >= 0) return 'common';
    return CFG.CLASS_RARITY[w.cls] || 'uncommon';
  };
  CFG.RARITY_ORDER = ['common', 'uncommon', 'rare', 'special', 'wonder'];

  // pure, deterministic Mystery Box roll. state: { round, mapWonder, owned{},
  // recent[], lastRarity, includeMonkeys }. rng defaults to Math.random.
  // returns { id, rarity } where id may be '_monkeys' (a rare tactical pseudo-roll).
  CFG.rollBoxWeapon = function (state, rng) {
    state = state || {}; rng = rng || Math.random;
    function buildBuckets(useRecent, useOwned) {
      var b = { common: [], uncommon: [], rare: [], special: [], wonder: [] };
      Object.keys(CFG.WEAPONS).forEach(function (id) {
        var w = CFG.WEAPONS[id];
        if (!w.box) return;
        if (CFG.BOX_EXCLUDE.indexOf(id) >= 0) return;
        if (w.wonder && id !== state.mapWonder) return;     // only this map's wonder
        if (useOwned && state.owned && state.owned[id]) return;
        if (useRecent && state.recent && state.recent.indexOf(id) >= 0) return;
        b[CFG.weaponRarity(id)].push(id);
      });
      if (state.includeMonkeys && !(useRecent && state.recent && state.recent.indexOf('_monkeys') >= 0)) {
        b.rare.push('_monkeys');
      }
      return b;
    }
    var buckets = buildBuckets(true, true);
    if (!CFG.RARITY_ORDER.some(function (k) { return buckets[k].length; })) buckets = buildBuckets(false, true);
    if (!CFG.RARITY_ORDER.some(function (k) { return buckets[k].length; })) buckets = buildBuckets(false, false);

    var w = {}; Object.keys(CFG.RARITY_TARGET).forEach(function (k) { w[k] = CFG.RARITY_TARGET[k]; });
    if ((state.round || 1) < CFG.WONDER_MIN_ROUND) w.wonder = 0;
    if (state.lastRarity === 'special' || state.lastRarity === 'wonder') {
      w.special *= CFG.POST_SPECIAL_SPECIAL_MULT;
      w.wonder *= CFG.POST_SPECIAL_WONDER_MULT;
    }
    if (state.lastRarity === 'wonder') w.wonder = 0;        // no consecutive wonder rolls

    var avail = [], tot = 0;
    CFG.RARITY_ORDER.forEach(function (k) { if (buckets[k].length && w[k] > 0) { avail.push(k); tot += w[k]; } });
    if (!tot) { avail = CFG.RARITY_ORDER.filter(function (k) { return buckets[k].length; }); tot = avail.length; avail.forEach(function () {}); }
    var pick = rng() * (tot || 1), rarity = avail[0] || 'common';
    for (var i = 0; i < avail.length; i++) { pick -= (w[avail[i]] || 1); if (pick <= 0) { rarity = avail[i]; break; } }

    var list = buckets[rarity] || [];
    if (!list.length) return { id: Object.keys(CFG.WEAPONS)[0], rarity: 'common' };
    var iw = list.map(function (id) { return id === '_monkeys' ? CFG.MONKEY_BOX_WEIGHT : (CFG.WEAPONS[id].box || 1); });
    var itot = iw.reduce(function (a, b2) { return a + b2; }, 0), ip = rng() * itot, id = list[0];
    for (var j = 0; j < list.length; j++) { ip -= iw[j]; if (ip <= 0) { id = list[j]; break; } }
    return { id: id, rarity: rarity };
  };


  /* --------------------------------------------------------------- rounds */
  CFG.zombiesForRound = function (r) {
    var early = [6, 8, 13, 18, 24, 27, 28, 28, 29];
    if (r <= 9) return early[r - 1];
    return Math.round(0.15 * r * 24);
  };
  CFG.zombieHealth = function (r) {
    if (r <= 9) return 150 + 100 * (r - 1);
    return Math.round(950 * Math.pow(1.1, r - 9));
  };
  CFG.sprinterFraction = function (r) {
    return Math.min(1, r * 0.07);
  };
  CFG.spawnInterval = function (r) {
    return Math.max(0.45, 2.2 - r * 0.08);
  };
  CFG.MAX_ALIVE = 24;
  CFG.DOG_EVERY = 5;
  CFG.dogsForRound = function (r) {
    return Math.min(12, 5 + Math.floor(r / 5) * 2);
  };
  CFG.ROUND_BREAK = 8;        // seconds between rounds

  /* --------------------------------------------------------------- combat */
  CFG.PLAYER_HP = 150;   // BO3 scaling: 3 zombie swipes to down, 5 with Juggernog

  /* ------------------------------------------------- movement (BO3 feel) */
  CFG.MOVE = {
    walk: 4.4,
    sprint: 1.5,          // sprint speed multiplier
    sprintStamin: 1.74,   // with Stamin-Up
    crouch: 2.1,
    adsMove: 0.65,        // move speed multiplier at full ADS
    accel: 14,            // ground acceleration response (1/s)
    friction: 11,         // ground stop response (1/s)
    airAccel: 4.5,        // air steering response (1/s)
    airDrag: 0.35,        // air decay with no input (1/s)
    jumpV: 5.2,
    gravity: 14,
    slideBoost: 1.4,      // entry speed = current speed * boost
    slideMax: 11,
    slideDur: 1.0,        // seconds (×1.2 with Stamin-Up)
    slideFrict: 1.6,      // exponential decay during slide
    slideSteer: 5,        // lateral steering force while sliding
    slideCd: 0.35,        // re-slide cooldown
    bobCam: 0.005,        // camera bob amplitude (near zero — no head bob)
    bobGun: 0.018,        // viewmodel bob amplitude
    adsSpeed: 13,         // ADS in/out response (1/s)
    sprintRamp: 8,        // sprint in/out response (1/s); drives sprint-out delay
    fov: 75, fovSprint: 6, fovSlide: 10, fovAds: 58
  };
  CFG.JUGG_HP = 250;
  CFG.REGEN_DELAY = 3.5;
  CFG.REGEN_RATE = 60;        // hp/s
  CFG.ZOMBIE_DMG = 50;        // every swipe, every round
  // Melee damage is CONSTANT — always 3 swipes to down (5 with Juggernog).
  // Difficulty comes from zombie COUNT and SPEED, never from harder hits.
  CFG.zombieMeleeDamage = function () { return CFG.ZOMBIE_DMG; };
  CFG.KNIFE_DMG = 150;
  CFG.GRENADE_DMG = 600;
  CFG.GRENADE_RADIUS = 4.5;
  CFG.MONKEY_DMG = 1000;
  CFG.MONKEY_RADIUS = 5;
  CFG.MONKEY_LURE = 25;
  CFG.MAX_FRAGS = 4;
  CFG.MAX_MONKEYS = 3;

  CFG.PTS = { hit: 10, kill: 60, headKill: 100, knifeKill: 130,
              boomKill: 50, board: 10, nuke: 400, carpenter: 200 };

  CFG.POWERUP_CHANCE = 0.031;
  CFG.POWERUP_LIFE = 30;
  CFG.POWERUP_TIME = 30;      // insta / double points / fire sale duration
  CFG.DEATHMACHINE_TIME = 30; // timed Death Machine drop
  CFG.POWERUPS = ['maxammo', 'insta', 'double', 'nuke', 'carpenter', 'firesale', 'bonus', 'deathmachine'];

  /* -------------------------------------------------- pure map-grid parser */
  // Returns { cells, cols, rows, doors, rooms } where cells[row][col] =
  // { type:'room'|'door'|'void', room?, door? }. Used by map.js and tests.
  CFG.parseGrid = function (grid) {
    var rows = grid.length, cols = grid[0].length;
    var cells = [], doors = {}, rooms = {};
    var r, c, ch, cell;
    for (r = 0; r < rows; r++) {
      cells[r] = [];
      if (grid[r].length !== cols) throw new Error('ragged grid row ' + r);
      for (c = 0; c < cols; c++) {
        ch = grid[r][c];
        if (ch === '.') cell = { type: 'void' };
        else if (ch >= '1' && ch <= '9') {
          cell = { type: 'door', door: +ch };
          doors[+ch] = doors[+ch] || { id: +ch, cells: [] };
          doors[+ch].cells.push([c, r]);
        } else {
          cell = { type: 'room', room: ch };
          rooms[ch] = rooms[ch] || { id: ch, cells: [] };
          rooms[ch].cells.push([c, r]);
        }
        cells[r][c] = cell;
      }
    }
    // Annotate each door with the two rooms it joins.
    var DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    Object.keys(doors).forEach(function (id) {
      var d = doors[id], joins = {};
      d.cells.forEach(function (cr) {
        DIRS.forEach(function (dd) {
          var nc = cr[0] + dd[0], nr = cr[1] + dd[1];
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
          var n = cells[nr][nc];
          if (n.type === 'room') joins[n.room] = true;
        });
      });
      d.rooms = Object.keys(joins);
    });
    return { cells: cells, cols: cols, rows: rows, doors: doors, rooms: rooms };
  };

  CFG.cellToWorld = function (col, row) {
    return { x: (col - CFG._cx) * CFG.CELL, z: (row - CFG._cz) * CFG.CELL };
  };
  CFG.worldToCell = function (x, z) {
    return { col: Math.round(x / CFG.CELL + CFG._cx),
             row: Math.round(z / CFG.CELL + CFG._cz) };
  };

  /* ----------------------------------------------------------------------- */
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
  else {
    root.G = root.G || {};
    root.G.CFG = CFG;
  }
})(typeof window !== 'undefined' ? window : globalThis);
