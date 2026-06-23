/* Behavioral verification of the REAL Kurhaus 3-floor stack (no hand-built
   geometry — startGame builds all three floors + both stairs). Reports numbers:
     1. Grand Staircase: zombies on Floor 1 climb to the player on Floor 2 (+4)
     2. Service Staircase: zombies on Floor B (-4) climb up to the player on Floor 1
        — both: all reach the target floor, zPhantom=false, no off-edge, stall ~0
     3. Sealed seams: Floor 1 opaque over Floor B, Floor 2 opaque over Floor 1,
        BUT the Atrium shaft open top-to-bottom
   Each climb runs in a FRESH game instance so the two are fully isolated.
   Run:  node tools/test-kurhaus-stack.js                                      */
'use strict';
var path = require('path');
var THREE = require('three');
var smoke = require(path.resolve(__dirname, '..', 'tests', 'smoke.js'));

var pass = true;
function chk(label, cond, detail) { if (!cond) pass = false; console.log('   ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (detail !== undefined ? '   ' + detail : '')); }

function freshGame() {
  var ctx = smoke.createGame(); var G = ctx.G;
  G.startGame('kurhaus');
  Object.keys(G.map.doors).forEach(function (id) { G.map.openDoor(id); });
  G.nav.build();
  G.state = 'playing';
  G.zombies.mode = 'break'; G.zombies.breakTimer = 999; G.zombies.toSpawn = 0;
  return G;
}

// 1. GRAND — Floor 1 (Ballroom, y0) up to the player on Floor 2 (+4)
console.log('1. GRAND STAIRCASE (Floor 1 -> Floor 2):');
(function () {
  var G = freshGame(), Z = G.zombies, P = G.player, map = G.map;
  var st = map.stages.filter(function (s) { return s.deckTop > 2; })[0];
  P.pos.set(st.deckCenter.x, 4, st.deckCenter.z);
  var grp = []; for (var g = 0; g < 6; g++) { var zz = Z.spawnAt(new THREE.Vector3(st.stairBase.x - 3 + g * 1.2, 0, st.stairBase.z)); zz.speed = 2.8; grp.push(zz); }
  var maxStall = 0, lastH = grp.map(function () { return 0; }), stall = grp.map(function () { return 0; }), off = false;
  for (var f = 0; f < 60 * 22; f++) { Z.update(0.016); grp.forEach(function (z, k) { if (z.dead) return; var y = z.mesh.position.y, dy = Math.abs(y - lastH[k]); if (y > 0.3 && y < 3.6) { if (dy < 0.004) { stall[k]++; if (stall[k] > maxStall) maxStall = stall[k]; } else stall[k] = 0; } lastH[k] = y; if (z._void) off = true; }); }
  var reached = grp.filter(function (z) { return !z.dead && z.mesh.position.y > 3.5; }).length;
  console.log('   grand climb:');
  console.log('      heights: ' + JSON.stringify(grp.map(function (z) { return z.dead ? 'D' : +z.mesh.position.y.toFixed(1); })));
  chk('all 6 reached Floor 2 (y>3.5)', reached === 6, reached + '/6');
  chk('zPhantom / off-edge = false', !off, 'offEdge=' + off);
  chk('max stall on the flight ~0', maxStall / 60 < 0.25, (maxStall / 60).toFixed(2) + 's');
})();

// 2. SERVICE — Floor B (-4) up to the player on Floor 1 (y0 at the stair top)
console.log('\n2. SERVICE STAIRCASE (Floor B -> Floor 1):');
(function () {
  var G = freshGame(), Z = G.zombies, P = G.player, map = G.map;
  var st = map.stages.filter(function (s) { return s.deckTop < -2; })[0];
  P.pos.set(st.stairBase.x, 0, st.stairBase.z - 2);
  // spawn on the Cistern (Floor B) floor EAST of the ramp footprint, not in the
  // descend well or a door-separator void
  var cist = map.parsedAtY(-4).rooms.T.center;
  var grp = []; for (var g = 0; g < 6; g++) { var zz = Z.spawnAt(new THREE.Vector3(cist.x - 2 + g * 0.8, -4, cist.z)); zz.mesh.position.y = -4; zz.speed = 2.8; grp.push(zz); }
  var maxStall = 0, lastH = grp.map(function () { return -4; }), stall = grp.map(function () { return 0; }), off = false;
  for (var f = 0; f < 60 * 22; f++) { Z.update(0.016); grp.forEach(function (z, k) { if (z.dead) return; var y = z.mesh.position.y, dy = Math.abs(y - lastH[k]); if (y > -3.6 && y < -0.4) { if (dy < 0.004) { stall[k]++; if (stall[k] > maxStall) maxStall = stall[k]; } else stall[k] = 0; } lastH[k] = y; if (z._void) off = true; }); }
  var reached = grp.filter(function (z) { return !z.dead && z.mesh.position.y > -0.5; }).length;
  console.log('   service climb:');
  console.log('      heights: ' + JSON.stringify(grp.map(function (z) { return z.dead ? 'D' : +z.mesh.position.y.toFixed(1); })));
  chk('all 6 reached Floor 1 (y>-0.5)', reached === 6, reached + '/6');
  chk('zPhantom / off-edge = false', !off, 'offEdge=' + off);
  chk('max stall on the flight ~0', maxStall / 60 < 0.25, (maxStall / 60).toFixed(2) + 's');
})();

// 3. SEALED SEAMS + open shaft (one fresh instance)
console.log('\n3. SEALED SEAMS + ATRIUM SHAFT:');
(function () {
  var G = freshGame(), map = G.map;
  var foyer = map.parsed.rooms.S.center, ball = map.parsed.rooms.B.center, atr = map.parsed.rooms.A.center;
  chk('Floor 1 opaque over Floor B (body at y=-1 under Foyer blocked)', map.bodyBlocked(foyer.x, foyer.z, -1) === true);
  chk('Floor 1 floor holds a body at 0 over the Foyer (no fall to -4)', Math.abs(map.supportAt(foyer.x, foyer.z, 0.2, 0.3) - 0) < 0.06);
  chk('Floor 2 opaque over Floor 1 (body at y=3 under Ballroom blocked)', map.bodyBlocked(ball.x, ball.z, 3) === true);
  chk('Floor 2 floor holds a body at 4 over the Ballroom', Math.abs(map.supportAt(ball.x, ball.z, 4.2, 0.3) - 4) < 0.06);
  chk('ATRIUM shaft OPEN at +3 (no Floor-1 ceiling)', map.bodyBlocked(atr.x, atr.z, 3) === false);
  chk('ATRIUM shaft OPEN at +5 (no Floor-2 floor/ceiling)', map.bodyBlocked(atr.x, atr.z, 5) === false);
  chk('ATRIUM shaft sees Floor 1 from above (support at +4 falls through to 0)', Math.abs(map.supportAt(atr.x, atr.z, 4.5, 0.3) - 0) < 0.06);
})();

// 4. CROSS-ROOM pathing within the newly-subdivided floors (a zombie in one room
// reaches the player across the floor through the doorways)
function crossRoom(label, fy, fromRoom, toRoom) {
  var G = freshGame(), Z = G.zombies, P = G.player, map = G.map;
  var rooms = map.parsedAtY(fy).rooms, a = rooms[fromRoom].center, b = rooms[toRoom].center;
  P.pos.set(b.x, fy, b.z);
  var z = Z.spawnAt(new THREE.Vector3(a.x, fy, a.z)); z.mesh.position.y = fy; z.speed = 3.0;
  var d0 = Math.hypot(a.x - b.x, a.z - b.z);
  for (var f = 0; f < 60 * 34; f++) Z.update(0.016);   // long way around the shaft
  var d = Math.hypot(z.mesh.position.x - P.pos.x, z.mesh.position.z - P.pos.z);
  chk(label + ' (' + fromRoom + ' -> ' + toRoom + ')', !z.dead && !z._void && d < 5 && Math.abs(z.mesh.position.y - fy) < 0.6,
    'start=' + d0.toFixed(0) + 'm end=' + d.toFixed(1) + 'm y=' + z.mesh.position.y.toFixed(1));
}
console.log('\n4. CROSS-ROOM PATHING (subdivided floors):');
crossRoom('   Floor B', -4, 'P', 'T');   // Cold Plunge -> Cistern (via Hot Springs / Core)
crossRoom('   Floor B', -4, 'F', 'C');   // Furnace -> Core
crossRoom('   Floor 2', 4, 'E', 'W');    // Tesla Hall -> Wards (via Galleries / Solarium)
crossRoom('   Floor 2', 4, 'R', 'L');    // Records -> Solarium

console.log('\n' + (pass ? 'ALL KURHAUS STACK CHECKS PASSED' : 'KURHAUS STACK CHECKS FAILED'));
process.exit(pass ? 0 : 1);
