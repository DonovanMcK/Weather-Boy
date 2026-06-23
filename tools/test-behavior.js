/* Behavioral pathing proof for the floorY foundation — runs the REAL nav /
   zombie / player code headlessly (no renderer) on a split-level test map
   (Region A@0, Region B@+4, ramp). Reports numbers, not stills:
     1. stair-climb: a GROUP of zombies up the ramp — do they all reach B, with
        no stall/bunching on the steps and no phantom-0 detour?
     2. open-edge: a zombie on B by an UNWALLED ledge, player across the gap —
        does it route AROUND via the ramp, or walk off into the void?

   Run:  node tools/test-behavior.js
   (A staircase/ramp must have its top ceiling lifted for headroom — exactly what
   the engine's buildStage/stairwellAt does for real stairs — or the doorway
   ceiling at the floor transition blocks nav node creation. This test lifts it,
   mirroring real stairs.) */
'use strict';
var path = require('path');
var THREE = require('three');
var smoke = require(path.resolve(__dirname, '..', 'tests', 'smoke.js'));

var TESTMAP = {
  id: '_t2', name: 'BEHAVIOR TEST', sub: '', wonder: 'thunder', papRule: 'power',
  atmos: { sky: 0x12131a, fog: 0x12131a, density: 0, amb: 0x55607a, ambI: 0.6, hemiSky: 0x9aa6c0, hemiGround: 0x33302a },
  palette: { wallA: 0xb0a890, wallB: 0xa09880, wood: 0xc6ad84, plank: 0xd8c098, metal: 0x8e949c, beam: 0x55585e, rust: 0x86603c, conc: 0x8a857c, deck: 0x6b6f78, ceil: 0x6c727d, accent: 0x5fcfe6, lampTint: 0xeae6dc },
  OUTDOOR: [], GRID: ['.BBBBB.', '.BBBBB.', '.BBBBB.', '..111..', '..111..', '.AAAAA.', '.AAAAA.', '.AAAAA.', '.AAAAA.'],
  ROOMS: { A: { name: 'A', floor: 0x6a4a30, light: 0xd8a060, floorY: 0 }, B: { name: 'B', floor: 0x30506a, light: 0x70b0e0, floorY: 4 } },
  DOORS: { 1: { cost: 0 } }, WINDOWS: [{ cell: [3, 8], dir: 'S' }, { cell: [3, 0], dir: 'N' }], RISERS: [], PERK_MACHINES: [], WALLBUYS: [],
  BOX_SPOTS: [{ cell: [3, 6], off: [0, 0] }], TELEPORTERS: [], MAINFRAME: null, PAP: { cell: [3, 1], off: [0, 0] }, POWER: { cell: [3, 6], off: [0, 0] },
  PLAYER_SPAWN: { cell: [3, 7], off: [0, 0] }, RELIC_SPOTS: [], EE_SOULBOX: null, SHIELD_PARTS: {}, SHIELD_BENCH: null
};

function build(openLedge) {
  var ctx = smoke.createGame(); var G = ctx.G;
  G.CFG.MAPS._t2 = TESTMAP; G.startGame('_t2');
  var rx1 = -6, rx2 = 6, rzN = -6, rzS = 2;
  G.map.surfaces = G.map.surfaces.filter(function (s) { return !(s.floor && s.x1 >= rx1 - 0.1 && s.x2 <= rx2 + 0.1 && s.z1 >= rzN - 0.1 && s.z2 <= rzS + 0.1); });
  G.map.addSurface({ x1: rx1, x2: rx2, z1: rzN, z2: rzS, ramp: true, axis: 'z', c1: rzN, c2: rzS, h1: 4, h2: 0 });
  for (var i = 0; i < 8; i++) { var zA = rzN + i, fillH = 4 * (1 - (i + 1) / 8); if (fillH > 0.05) G.map.addCollider(rx1, zA, rx2, rzN + i + 1, 0, fillH); }
  // lift the ceiling over the ramp (stairwell headroom — what buildStage does)
  G.map.colliders.forEach(function (c) { var cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2; if (c.y1 > 3.4 && c.y1 < 4.6 && cx > rx1 - 0.1 && cx < rx2 + 0.1 && cz > rzN - 2.1 && cz < rzS + 0.1) c.on = false; });
  if (openLedge) G.map.colliders.forEach(function (c) { var cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2; if (c.y2 - c.y1 > 3 && c.on && cz > -7 && cz < -5 && cx < -6.5) c.on = false; });
  Object.keys(G.map.doors).forEach(function (id) { G.map.openDoor(id); });
  G.nav.build(); G.state = 'playing';
  G.zombies.mode = 'break'; G.zombies.breakTimer = 999; G.zombies.toSpawn = 0;
  return G;
}

// ---- 1. STAIR-CLIMB GROUP ----
var G = build(false), Z = G.zombies, P = G.player;
P.pos.set(0, 4, -12);
var grp = []; for (var g = 0; g < 6; g++) { var zz = Z.spawnAt(new THREE.Vector3(-4 + g * 1.6, 0, 13)); zz.speed = 2.8; grp.push(zz); }
var lastH = grp.map(function () { return 0; }), stall = grp.map(function () { return 0; }), maxStall = 0, phantom = false;
for (var f = 0; f < 60 * 22; f++) {
  G.zombies.update(0.016);
  grp.forEach(function (z, k) {
    if (z.dead) return; var y = z.mesh.position.y, dy = y - lastH[k];
    if (y > 0.3 && y < 3.6) { if (dy < 0.004) { stall[k]++; if (stall[k] > maxStall) maxStall = stall[k]; } else stall[k] = 0; }
    lastH[k] = y; if (z.mesh.position.z < -6.5 && y < 1.5) phantom = true;
  });
}
var reached = grp.filter(function (z) { return !z.dead && z.mesh.position.y > 3.5; }).length;
console.log('1. STAIR-CLIMB (group of 6):');
console.log('   reached B (y>3.5): ' + reached + '/6   heights: ' + JSON.stringify(grp.map(function (z) { return z.dead ? 'D' : +z.mesh.position.y.toFixed(1); })));
console.log('   max stall mid-ramp: ' + (maxStall / 60).toFixed(2) + 's   zPhantom: ' + phantom);
console.log('   => ' + (reached === 6 && maxStall === 0 && !phantom ? 'PASS' : 'FAIL'));

// ---- 2. OPEN-EDGE ----
var G2 = build(true), Z2 = G2.zombies, P2 = G2.player;
P2.pos.set(-8, 0, 14);                                  // player on A, across the open ledge
var ze = Z2.spawnAt(new THREE.Vector3(-8, 0, -8)); ze.mesh.position.y = 4; ze.speed = 2.6;
var wentVoid = false, route = [];
for (var ef = 0; ef < 60 * 22; ef++) {
  G2.zombies.update(0.016); if (ze._void) wentVoid = true;
  if (ef % 60 === 0 && Z2.list.indexOf(ze) >= 0) route.push([+ze.mesh.position.x.toFixed(1), +ze.mesh.position.y.toFixed(1), +ze.mesh.position.z.toFixed(1)]);
}
var despawned = Z2.list.indexOf(ze) < 0;
var reachedA = !despawned && ze.mesh.position.y < 1 && ze.mesh.position.z > 10;
console.log('\n2. OPEN-EDGE (zombie on B by an unwalled ledge, player on A across the gap):');
console.log('   walked off into void: ' + wentVoid + '   void-despawned: ' + despawned + '   reached player on A: ' + reachedA);
console.log('   route (x,y,z each 1s): ' + JSON.stringify(route));
console.log('   => ' + (!wentVoid && reachedA ? 'PASS (routed around via the ramp)' : 'FAIL'));
