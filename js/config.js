/* ===========================================================================
   DER WETTERJUNGE — config.js
   All tuning data + the pure map-grid parser (also loadable in node tests).
   =========================================================================== */
(function (root) {
  'use strict';

  var CFG = {};

  /* ------------------------------------------------------------------ map */
  // 4m grid cells. Letters = rooms, digits = doors, '.' = void (outside).
  // Coordinate mapping: x = (col - 6) * 4, z = (row - 5.5) * 4.
  CFG.CELL = 4;
  CFG.GRID = [
    '.....DDD.....', // r0   D = Radar Dome (power, Teleporter C, Stamin-Up)
    '.....DDD.....', // r1
    '......7......', // r2   door 7: Dome <-> Courtyard (1750)
    'LLL.CCCCC.RRR', // r3   L = Lab (Tele A), C = Courtyard, R = Storage (Tele B)
    'LLL5CCCCC6RRR', // r4   door 5: Lab<->C (1250), door 6: Storage<->C (1250)
    'LLL.CCCCC.RRR', // r5
    '...CCCCCCC...', // r6
    '...3.....4...', // r7   door 3: HallA<->C (1250), door 4: HallB<->C (1250)
    '.AAA.....BBB.', // r8   A/B = L-shaped corridors
    '.A.........B.', // r9
    '.AAA1SSS2BBB.', // r10  door 1: Spawn<->A (750), door 2: Spawn<->B (1000)
    '.....SSS.....'  // r11  S = Spawn room
  ];

  CFG.ROOMS = {
    S: { name: 'Spawn Room',  floor: 0x3a3530, light: 0x886655 },
    A: { name: 'West Hall',   floor: 0x2f3338, light: 0x667788 },
    B: { name: 'East Hall',   floor: 0x33302f, light: 0x778866 },
    C: { name: 'Courtyard',   floor: 0x2c3a2e, light: 0x99aabb },
    L: { name: 'Laboratory',  floor: 0x2e3640, light: 0x66ccdd },
    R: { name: 'Storage',     floor: 0x3b3328, light: 0xddaa66 },
    D: { name: 'Radar Dome',  floor: 0x342e3e, light: 0xbb88ff }
  };

  CFG.DOORS = {
    1: { cost: 750,  name: 'Spawn → West Hall' },
    2: { cost: 1000, name: 'Spawn → East Hall' },
    3: { cost: 1250, name: 'West Hall → Courtyard' },
    4: { cost: 1250, name: 'East Hall → Courtyard' },
    5: { cost: 1250, name: 'Laboratory' },
    6: { cost: 1250, name: 'Storage' },
    7: { cost: 1750, name: 'Radar Dome' }
  };

  // Windows: barricades on outer walls. {cell:[col,row], dir:'N'|'S'|'E'|'W'}
  CFG.WINDOWS = [
    { cell: [5, 11], dir: 'S' },
    { cell: [7, 11], dir: 'S' },
    { cell: [1, 9],  dir: 'W' },
    { cell: [11, 9], dir: 'E' },
    { cell: [4, 3],  dir: 'N' },
    { cell: [8, 3],  dir: 'N' },
    { cell: [0, 4],  dir: 'W' },
    { cell: [12, 4], dir: 'E' },
    { cell: [5, 0],  dir: 'N' },
    { cell: [7, 0],  dir: 'N' }
  ];

  // Ground risers (courtyard only), used when the player is in 'C'.
  CFG.RISERS = [[5, 5], [7, 5], [6, 6]];

  /* ------------------------------------------------------- placed objects */
  // pos given as [col,row] cell + optional [ox,oz] offset in meters.
  CFG.PERK_MACHINES = [
    { perk: 'revive',  cell: [7, 11], off: [1.2, 1.2] },
    { perk: 'jugg',    cell: [4, 5],  off: [-1.5, 0] },
    { perk: 'speed',   cell: [0, 3],  off: [-1.2, -1.2] },
    { perk: 'dtap',    cell: [12, 3], off: [1.2, -1.2] },
    { perk: 'stamin',  cell: [5, 1],  off: [-1.2, 0.8] },
    { perk: 'mule',    cell: [11, 8], off: [1.2, -1.2] }
  ];

  CFG.WALLBUYS = [
    { gun: 'm14',      cell: [7, 11], off: [1.7, -1.0], face: 'E' },
    { gun: 'olympia',  cell: [5, 11], off: [-1.7, -1.0], face: 'W' },
    { gun: 'mp40',     cell: [1, 8],  off: [0, -1.7], face: 'N' },
    { gun: 'mp5k',     cell: [11, 10], off: [0, 1.7], face: 'S' },
    { gun: 'ak74u',    cell: [5, 6],  off: [0, 1.7],  face: 'S' },
    { gun: 'frags',    cell: [7, 6],  off: [0, 1.7],  face: 'S' },
    { gun: 'stakeout', cell: [0, 5],  off: [0, 1.7],  face: 'S' },
    { gun: 'm16',      cell: [12, 5], off: [0, 1.7],  face: 'S' }
  ];

  CFG.BOX_SPOTS = [
    { cell: [4, 6],  off: [0, -1] },   // courtyard (starting spot)
    { cell: [6, 11], off: [-1.4, 0.8] },
    { cell: [1, 8],  off: [0.8, 0.8] },
    { cell: [11, 10], off: [-0.8, -0.8] },
    { cell: [0, 5],  off: [-0.8, -0.8] },
    { cell: [12, 5], off: [0.8, -0.8] },
    { cell: [7, 1],  off: [1.0, 0.5] }
  ];

  CFG.TELEPORTERS = [
    { id: 'A', cell: [1, 4],  off: [-0.5, 0] },
    { id: 'B', cell: [11, 4], off: [0.5, 0] },
    { id: 'C', cell: [6, 0],  off: [0, -0.5] }
  ];
  CFG.MAINFRAME = { cell: [6, 4], off: [0, 0] };
  CFG.PAP = { cell: [6, 5], off: [0, 1.0] };
  CFG.POWER = { cell: [5, 0], off: [-1.4, -1.4] };
  CFG.PLAYER_SPAWN = { cell: [6, 10], off: [0, 0.5] };

  CFG.TELE_LINK_WINDOW = 30;   // seconds to reach the mainframe
  CFG.TELE_USE_COST = 500;
  CFG.PAP_COST = 5000;

  /* ---------------------------------------------------------------- perks */
  CFG.PERKS = {
    revive: { name: 'Quick Revive', cost: 500,  color: 0x55ccff, icon: 'QR' },
    jugg:   { name: 'Juggernog',    cost: 2500, color: 0xff3344, icon: 'JG' },
    speed:  { name: 'Speed Cola',   cost: 3000, color: 0x44ee66, icon: 'SC' },
    dtap:   { name: 'Double Tap II', cost: 2000, color: 0xffaa22, icon: 'DT' },
    stamin: { name: 'Stamin-Up',    cost: 2000, color: 0xeeee44, icon: 'SU' },
    mule:   { name: 'Mule Kick',    cost: 4000, color: 0x44ff88, icon: 'MK' }
  };
  CFG.MAX_PERKS = 4;
  CFG.QR_MAX_BUYS = 3;

  /* -------------------------------------------------------------- weapons */
  // dmg per bullet (pellets multiply), rpm, mag, reserve, reload (s),
  // mode: 'auto' | 'semi' | 'pump', spread in degrees, cls drives the viewmodel.
  CFG.WEAPONS = {
    m1911: {
      name: 'M1911', cls: 'pistol', dmg: 30, head: 3, rpm: 360, mag: 8,
      reserve: 32, reload: 1.4, mode: 'semi', spread: 1.6,
      pap: { name: 'Mustang & Sally', dmg: 900, mag: 6, reserve: 36,
             projectile: 'rocket', rpm: 200, spread: 0.5 }
    },
    m14: {
      name: 'M14', cls: 'rifle', dmg: 100, head: 2.5, rpm: 300, mag: 8,
      reserve: 96, reload: 1.9, mode: 'semi', spread: 0.9, wall: 500,
      pap: { name: 'Mnesia', dmg: 220, mag: 16, reserve: 192 }
    },
    olympia: {
      name: 'Olympia', cls: 'shotgun', dmg: 30, head: 1.5, pellets: 8, rpm: 120,
      mag: 2, reserve: 38, reload: 1.8, mode: 'semi', spread: 5.5, wall: 500,
      range: 14,
      pap: { name: 'Hades', dmg: 65, mag: 4, reserve: 60, range: 18 }
    },
    mp40: {
      name: 'MP40', cls: 'smg', dmg: 40, head: 2, rpm: 520, mag: 32,
      reserve: 192, reload: 2.1, mode: 'auto', spread: 2.4, wall: 1000,
      pap: { name: 'The Afterburner', dmg: 80, mag: 64, reserve: 256 }
    },
    mp5k: {
      name: 'MP5K', cls: 'smg', dmg: 35, head: 2, rpm: 750, mag: 30,
      reserve: 120, reload: 1.9, mode: 'auto', spread: 2.6, wall: 1000,
      pap: { name: 'MP115 Kollider', dmg: 70, mag: 40, reserve: 200 }
    },
    ak74u: {
      name: 'AK-74u', cls: 'smg', dmg: 45, head: 2.2, rpm: 700, mag: 20,
      reserve: 160, reload: 2.2, mode: 'auto', spread: 2.5, wall: 1200,
      pap: { name: 'AK74fu2', dmg: 90, mag: 40, reserve: 280 }
    },
    m16: {
      name: 'M16', cls: 'rifle', dmg: 60, head: 3, rpm: 460, mag: 30,
      reserve: 120, reload: 2.0, mode: 'semi', spread: 1.1, wall: 1200,
      pap: { name: 'Skullcrusher', dmg: 130, mag: 30, reserve: 270, mode: 'auto' }
    },
    stakeout: {
      name: 'Stakeout', cls: 'shotgun', dmg: 40, head: 1.5, pellets: 8, rpm: 70,
      mag: 6, reserve: 54, reload: 2.6, mode: 'pump', spread: 4.6, wall: 1500,
      range: 16,
      pap: { name: 'Raid', dmg: 80, mag: 10, reserve: 90, range: 22 }
    },
    commando: {
      name: 'Commando', cls: 'rifle', dmg: 45, head: 2.6, rpm: 750, mag: 30,
      reserve: 270, reload: 2.0, mode: 'auto', spread: 1.7, box: 1,
      pap: { name: 'Predator', dmg: 90, mag: 40, reserve: 360 }
    },
    galil: {
      name: 'Galil', cls: 'rifle', dmg: 50, head: 2.6, rpm: 750, mag: 35,
      reserve: 315, reload: 2.3, mode: 'auto', spread: 1.8, box: 1,
      pap: { name: 'Lamentation', dmg: 100, mag: 35, reserve: 490 }
    },
    famas: {
      name: 'FAMAS', cls: 'rifle', dmg: 40, head: 2.4, rpm: 900, mag: 30,
      reserve: 270, reload: 2.2, mode: 'auto', spread: 2.0, box: 1,
      pap: { name: 'G16-GL35', dmg: 80, mag: 45, reserve: 360 }
    },
    aug: {
      name: 'AUG', cls: 'rifle', dmg: 50, head: 2.6, rpm: 720, mag: 30,
      reserve: 270, reload: 2.1, mode: 'auto', spread: 1.6, box: 1,
      pap: { name: 'AUG-50M3', dmg: 100, mag: 40, reserve: 360 }
    },
    spas12: {
      name: 'SPAS-12', cls: 'shotgun', dmg: 35, head: 1.5, pellets: 8, rpm: 180,
      mag: 8, reserve: 56, reload: 2.4, mode: 'semi', spread: 4.2, box: 1,
      range: 15,
      pap: { name: 'SPAZ-24', dmg: 70, mag: 24, reserve: 96, range: 20 }
    },
    python: {
      name: 'Python', cls: 'pistol', dmg: 150, head: 4, rpm: 240, mag: 6,
      reserve: 84, reload: 2.2, mode: 'semi', spread: 1.0, box: 1,
      pap: { name: 'Cobra', dmg: 300, mag: 12, reserve: 96 }
    },
    rpk: {
      name: 'RPK', cls: 'lmg', dmg: 50, head: 2.4, rpm: 650, mag: 100,
      reserve: 400, reload: 3.4, mode: 'auto', spread: 2.2, box: 1,
      pap: { name: 'R115 Resonator', dmg: 100, mag: 125, reserve: 500 }
    },
    hk21: {
      name: 'HK21', cls: 'lmg', dmg: 55, head: 2.4, rpm: 600, mag: 125,
      reserve: 500, reload: 3.8, mode: 'auto', spread: 2.3, box: 1,
      pap: { name: 'H115 Oscillator', dmg: 110, mag: 150, reserve: 750 }
    },
    raygun: {
      name: 'Ray Gun', cls: 'raygun', dmg: 1000, head: 1, rpm: 180, mag: 20,
      reserve: 160, reload: 3.0, mode: 'semi', spread: 0.4, box: 0.45,
      projectile: 'ray',
      pap: { name: "Porter's X2 Ray Gun", dmg: 2000, mag: 40, reserve: 200 }
    },
    thunder: {
      name: 'Thundergun', cls: 'thunder', dmg: 0, head: 1, rpm: 90, mag: 2,
      reserve: 12, reload: 3.0, mode: 'semi', spread: 0, box: 0.3,
      projectile: 'wind',
      pap: { name: 'Zeus Cannon', mag: 4, reserve: 24 }
    }
  };
  // Mystery box also rolls monkey bombs as a pseudo-weapon entry.
  CFG.BOX_COST = 950;
  CFG.MONKEY_BOX_WEIGHT = 0.6;
  CFG.WALL_AMMO_FACTOR = 0.5;     // refill = wall cost / 2
  CFG.PAP_AMMO_COST = 4500;       // wall refill once upgraded
  CFG.FRAGS_COST = 250;

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
  CFG.PLAYER_HP = 100;
  CFG.JUGG_HP = 250;
  CFG.REGEN_DELAY = 3.5;
  CFG.REGEN_RATE = 60;        // hp/s
  CFG.ZOMBIE_DMG = 50;
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
  CFG.POWERUPS = ['maxammo', 'insta', 'double', 'nuke', 'carpenter', 'firesale'];

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
    return { x: (col - 6) * CFG.CELL, z: (row - 5.5) * CFG.CELL };
  };
  CFG.worldToCell = function (x, z) {
    return { col: Math.round(x / CFG.CELL + 6), row: Math.round(z / CFG.CELL + 5.5) };
  };

  /* ----------------------------------------------------------------------- */
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
  else {
    root.G = root.G || {};
    root.G.CFG = CFG;
  }
})(typeof window !== 'undefined' ? window : globalThis);
