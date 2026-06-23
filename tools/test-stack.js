/* B3 MINIMAL STACKED PROOF (_t3) — true same-x,z stacking on the verified
   foundation, with ZERO changes to nav.js / player.js. Two regions share one
   x,z footprint: a lower room (floorY 0) and an upper floor (floorY +4) directly
   above it, joined by a buildStage-style staircase. An adjacent open-shaft room
   (OPEN_CEIL, no upper floor) gives the down-view.

   This is the gate before migrating Kurhaus to FLOORS: it must DEMONSTRATE (not
   assert) that the real nav / zombie / player code already handle a stacked
   building. Reports numbers, not stills:
     1. per-(x,z) support: supportAt -> 0 for feet near 0, 4 for feet near 4
     2. sealed underside: a body at y~3 under the +4 slab is bodyBlocked (can't
        pop up), and a body on +4 is held at 4 (can't fall through to 0)
     3. cross-floor stair group: all reach y~4 via the stairs, zPhantom=false,
        nobody routes off the edge, max stall ~0

   The upper floor is added with the SAME primitives the B3 build() loop will
   emit (floor SURFACE at +4 + perimeter wall colliders [4,8]); the inter-floor
   seal is the LOWER room's ceiling collider at +4 (already built by startGame) —
   no second collider, per the approved design. The staircase mirrors buildStage
   (ramp surface 0->4 + solid fill + a stairwell ceiling lift for headroom).

   Run:  node tools/test-stack.js                                            */
'use strict';
var path = require('path');
var THREE = require('three');
var smoke = require(path.resolve(__dirname, '..', 'tests', 'smoke.js'));

// minimal base map: lower room A (rows 0-3) stacked under the upper floor, and
// an open-shaft room S (rows 5-8, OPEN_CEIL) for the down-view; door 1 joins them
var TESTMAP = {
  id: '_t3', name: 'STACK TEST', sub: '', wonder: 'thunder', papRule: 'power',
  atmos: { sky: 0x12131a, fog: 0x12131a, density: 0, amb: 0x55607a, ambI: 0.6, hemiSky: 0x9aa6c0, hemiGround: 0x33302a },
  palette: { wallA: 0xb0a890, wallB: 0xa09880, wood: 0xc6ad84, plank: 0xd8c098, metal: 0x8e949c, beam: 0x55585e, rust: 0x86603c, conc: 0x8a857c, deck: 0x6b6f78, ceil: 0x6c727d, accent: 0x5fcfe6, lampTint: 0xeae6dc },
  OUTDOOR: [], OPEN_CEIL: ['S'],
  GRID: ['.AAAAA.', '.AAAAA.', '.AAAAA.', '.AAAAA.', '..111..', '.SSSSS.', '.SSSSS.', '.SSSSS.', '.SSSSS.'],
  ROOMS: { A: { name: 'Upper-stacked', floor: 0x6a4a30, light: 0xd8a060, floorY: 0 },
           S: { name: 'Shaft', floor: 0x30506a, light: 0x70b0e0, floorY: 0 } },
  DOORS: { 1: { cost: 0 } },
  WINDOWS: [{ cell: [3, 8], dir: 'S' }, { cell: [1, 6], dir: 'W' }],
  RISERS: [], PERK_MACHINES: [], WALLBUYS: [],
  BOX_SPOTS: [{ cell: [3, 6], off: [0, 0] }], TELEPORTERS: [], MAINFRAME: null,
  PAP: { cell: [3, 6], off: [0, 0] }, POWER: { cell: [3, 7], off: [0, 0] },
  PLAYER_SPAWN: { cell: [3, 7], off: [0, 0] }, RELIC_SPOTS: [], EE_SOULBOX: null,
  SHIELD_PARTS: {}, SHIELD_BENCH: null
};

function roomBBox(G, rid) {
  var CFG = G.CFG, CELL = CFG.CELL, cells = G.map.parsed.rooms[rid].cells;
  var minc = 99, maxc = -99, minr = 99, maxr = -99;
  cells.forEach(function (cr) {
    if (cr[0] < minc) minc = cr[0]; if (cr[0] > maxc) maxc = cr[0];
    if (cr[1] < minr) minr = cr[1]; if (cr[1] > maxr) maxr = cr[1];
  });
  var a = CFG.cellToWorld(minc, minr), b = CFG.cellToWorld(maxc, maxr);
  return { x1: a.x - CELL / 2, x2: b.x + CELL / 2, z1: a.z - CELL / 2, z2: b.z + CELL / 2,
           cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2 };
}

// add the upper floor over room A + the staircase down to room S — the same
// primitives the B3 build() loop will emit. Returns the geometry the checks use.
function buildStack(G) {
  var map = G.map, A = roomBBox(G, 'A'), UY = 4;
  // flight aligned to the 3-cell-wide doorway (x[-6,6]) and a gentle 8m run for a
  // ~0.5 slope — steep/narrow flights make nav edges fragile (the real stairs
  // must follow the same rule), so build the proof stair the way a stair should be
  var sx1 = A.cx - 4, sx2 = A.cx + 4, zTop = A.z2, zBase = A.z2 + 8, n = 10;
  // upper floor: a walkable SURFACE at +4 over A's footprint (no collider — the
  // inter-floor seal is A's own ceiling collider, capped just below, no second slab)
  map.addSurface({ x1: A.x1, x2: A.x2, z1: A.z1, z2: A.z2, y: UY, floor: true });
  // B3 wall rule (B2's finite bands, here triggered manually): when a real floor
  // sits above, the lower room's walls cap to [floorY, floorY+WALL_H] instead of
  // the tall [0,99] — otherwise the lower wall stays body-tall at +4 and blocks
  // the climber stepping onto the upper floor. In the real build floorAbove() does
  // this because the upper floor is a genuine room at floorY=4; the test hand-adds
  // the upper floor as a surface, so floorAbove can't see it — cap A's walls here.
  map.colliders.forEach(function (c) {
    if (c.y1 < 0.1 && c.y2 > 50 &&
        (c.x1 + c.x2) / 2 > A.x1 - 0.6 && (c.x1 + c.x2) / 2 < A.x2 + 0.6 &&
        (c.z1 + c.z2) / 2 > A.z1 - 0.6 && (c.z1 + c.z2) / 2 < A.z2 + 0.6) {
      c.y2 = UY;                                          // finite lower-floor wall band [0,4]
    }
  });
  // B3 ceiling rule: where a floor sits ABOVE, the lower room's ceiling collider
  // must seal from BELOW the boundary and NOT extend up into the floor above (its
  // default [cy-0.12, cy+0.6] overhang would collide with a body standing on the
  // upper floor — including the player's own target node). Cap it to [UY-1, UY].
  // Over the stair flight, the ceiling/lintels are the inter-floor OPENING — drop
  // them so the climber has headroom the whole way up (mirrors stairwellAt).
  map.colliders.forEach(function (c) {
    if (!(c.y1 > 3.4 && c.y1 < 4.6)) return;             // lower ceiling/lintel band only
    var cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2;
    var inFlight = cx > sx1 - 0.1 && cx < sx2 + 0.1 && cz > A.z2 - 4.1 && cz < zBase + 0.1;
    if (inFlight) c.on = false;                          // inter-floor opening over the flight
    else { c.y1 = UY - 1.0; c.y2 = UY; }                 // seal below, clear the floor above
  });
  // upper perimeter walls (finite band [4,8]) so a body on the upper floor is
  // contained, leaving the south edge open where the stair arrives
  var T = 0.35;
  map.addCollider(A.x1 - T, A.z1 - T, A.x2 + T, A.z1, UY, UY + 4);          // north
  map.addCollider(A.x1 - T, A.z1, A.x1, A.z2, UY, UY + 4);                  // west
  map.addCollider(A.x2, A.z1, A.x2 + T, A.z2, UY, UY + 4);                  // east
  // staircase: ramp from the upper floor south edge (z=A.z2, y=4) down to the
  // lower floor in room S (y=0), centred on x, two cells wide
  map.addSurface({ x1: sx1, x2: sx2, z1: zTop, z2: zBase, ramp: true, axis: 'z', c1: zTop, c2: zBase, h1: UY, h2: 0 });
  var run = (zBase - zTop) / n;
  for (var i = 1; i <= n; i++) {
    var zA = zTop + (i - 1) * run, zN = zTop + i * run, noseH = UY * (n - i) / n;
    if (noseH > 0.05) map.addCollider(sx1, zA, sx2, zN, 0, noseH);          // solid fill under the flight
  }
  return { A: A, UY: UY, stair: { x1: sx1, x2: sx2, zTop: zTop, zBase: zBase } };
}

var ctx = smoke.createGame(); var G = ctx.G;
G.CFG.MAPS._t3 = TESTMAP; G.startGame('_t3');
var geo = buildStack(G);
Object.keys(G.map.doors).forEach(function (id) { G.map.openDoor(id); });
G.nav.build();
G.state = 'playing';
var Z = G.zombies, P = G.player;
Z.mode = 'break'; Z.breakTimer = 999; Z.toSpawn = 0;

var A = geo.A, pass = true;
function chk(label, cond, detail) { if (!cond) pass = false; console.log('   ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (detail !== undefined ? '   ' + detail : '')); }

// ---- 1. per-(x,z) support: same column resolves both floors ----
var s0 = G.map.supportAt(A.cx, A.cz, 0.5, 0.6);   // feet near 0
var s4 = G.map.supportAt(A.cx, A.cz, 4.5, 0.6);   // feet near 4
console.log('1. PER-(x,z) SUPPORT at A centre (' + A.cx.toFixed(1) + ',' + A.cz.toFixed(1) + '):');
chk('feet near 0 -> floor 0', Math.abs(s0 - 0) < 0.06, 'got ' + s0.toFixed(2));
chk('feet near 4 -> floor +4', Math.abs(s4 - 4) < 0.06, 'got ' + s4.toFixed(2));

// ---- 2. sealed underside ----
var blockedUnder = G.map.bodyBlocked(A.cx, A.cz, 3.0);          // body under the +4 slab
var held = G.map.supportAt(A.cx, A.cz, 4.2, 0.3);              // a body on +4 is held at 4, not dropped to 0
console.log('2. SEALED UNDERSIDE at A centre:');
chk('body at y~3 is bodyBlocked (cannot pop up through +4)', blockedUnder === true, 'bodyBlocked=' + blockedUnder);
chk('body on +4 is held at 4 (cannot fall through to 0)', Math.abs(held - 4) < 0.06, 'support=' + held.toFixed(2));

// ---- 3. cross-floor stair group ----
// player stands on the UPPER floor at the far (north) end of A; zombies start on
// the lower floor in room S and must climb the stairs to reach them
P.pos.set(A.cx, 4, A.z1 + 2);
var grp = [];
for (var g = 0; g < 6; g++) { var zz = Z.spawnAt(new THREE.Vector3(A.cx - 4 + g * 1.6, 0, A.z2 + 11)); zz.speed = 2.8; grp.push(zz); }
var lastH = grp.map(function () { return 0; }), stall = grp.map(function () { return 0; }), maxStall = 0;
var phantom = false, offEdge = false;
for (var f = 0; f < 60 * 24; f++) {
  Z.update(0.016);
  grp.forEach(function (z, k) {
    if (z.dead) return;
    var y = z.mesh.position.y, x = z.mesh.position.x, zz2 = z.mesh.position.z, dy = y - lastH[k];
    if (y > 0.3 && y < 3.6) { if (dy < 0.004) { stall[k]++; if (stall[k] > maxStall) maxStall = stall[k]; } else stall[k] = 0; }
    lastH[k] = y;
    // phantom: airborne over the stack (under the upper floor but not on a real surface near 0 or on the ramp)
    if (zz2 < A.z2 + 0.1 && y > 0.6 && y < 3.4) phantom = true;
    // off-edge: outside the whole footprint (fell out of the world sideways)
    if (z._void || x < A.x1 - 3 || x > A.x2 + 3) offEdge = true;
  });
}
var reached = grp.filter(function (z) { return !z.dead && z.mesh.position.y > 3.5; }).length;
console.log('3. CROSS-FLOOR STAIR GROUP (6 zombies, floor 0 -> player on +4):');
console.log('      heights: ' + JSON.stringify(grp.map(function (z) { return z.dead ? 'D' : +z.mesh.position.y.toFixed(1); })));
chk('all 6 reached the upper floor (y>3.5)', reached === 6, reached + '/6');
chk('zPhantom=false (no floating under the stack)', phantom === false, 'phantom=' + phantom);
chk('nobody routed off the edge / into the void', offEdge === false, 'offEdge=' + offEdge);
chk('max stall mid-flight ~0', maxStall / 60 < 0.2, (maxStall / 60).toFixed(2) + 's');

console.log('\n' + (pass ? 'ALL STACK CHECKS PASSED' : 'STACK CHECKS FAILED'));
process.exit(pass ? 0 : 1);
