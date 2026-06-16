/* Node test: validates every map grid in js/config.js.
   Run: node tests/validate-map.js */
'use strict';
var CFG = require('../js/config.js');
var fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('FAIL  ' + msg); fails++; }
}

var OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

CFG.MAP_IDS.forEach(function (mapId) {
  console.log('\n=== ' + mapId + ' ===');
  var M = CFG.setMap(mapId);
  var P = CFG.parseGrid(CFG.GRID);

  // Every door joins exactly two distinct rooms and exists in CFG.DOORS.
  Object.keys(P.doors).forEach(function (id) {
    var d = P.doors[id];
    ok(d.rooms.length === 2, 'door ' + id + ' joins two rooms (' + d.rooms + ')');
    ok(!!CFG.DOORS[id], 'door ' + id + ' has cost data');
  });
  Object.keys(CFG.DOORS).forEach(function (id) {
    ok(!!P.doors[id], 'door ' + id + ' present in grid');
  });

  // No two different rooms directly adjacent without a door between them.
  var DIRS = [[0, 1], [1, 0]];
  var adjacencies = {};
  for (var r = 0; r < P.rows; r++) {
    for (var c = 0; c < P.cols; c++) {
      var cell = P.cells[r][c];
      if (cell.type !== 'room') continue;
      DIRS.forEach(function (d) {
        var nr = r + d[1], nc = c + d[0];
        if (nr >= P.rows || nc >= P.cols) return;
        var n = P.cells[nr][nc];
        if (n.type === 'room' && n.room !== cell.room) {
          adjacencies[[cell.room, n.room].sort().join('')] = true;
        }
      });
    }
  }
  ok(Object.keys(adjacencies).length === 0,
     'no direct room-to-room adjacency: ' + JSON.stringify(Object.keys(adjacencies)));

  // All rooms reachable from spawn ('S') with all doors open.
  var seen = {}, roomGraph = {};
  Object.keys(P.doors).forEach(function (id) {
    var rs = P.doors[id].rooms;
    if (rs.length === 2) {
      roomGraph[rs[0]] = (roomGraph[rs[0]] || []).concat(rs[1]);
      roomGraph[rs[1]] = (roomGraph[rs[1]] || []).concat(rs[0]);
    }
  });
  ok(!!P.rooms.S, "spawn room 'S' exists");
  var stack = ['S'];
  while (stack.length) {
    var room = stack.pop();
    if (seen[room]) continue;
    seen[room] = true;
    (roomGraph[room] || []).forEach(function (n) { stack.push(n); });
  }
  Object.keys(P.rooms).forEach(function (room) {
    ok(seen[room], 'room ' + room + ' reachable from spawn');
  });

  // Room color/name data for every room letter.
  Object.keys(P.rooms).forEach(function (room) {
    ok(!!CFG.ROOMS[room], 'room ' + room + ' has ROOMS data');
  });

  // Windows must sit on a room cell with void on the far side.
  CFG.WINDOWS.forEach(function (w, i) {
    var c = w.cell[0], rr = w.cell[1];
    var cell = P.cells[rr] && P.cells[rr][c];
    ok(cell && cell.type === 'room', 'window ' + i + ' on a room cell');
    var o = OFF[w.dir], nr = rr + o[1], nc = c + o[0];
    var outside = nr < 0 || nr >= P.rows || nc < 0 || nc >= P.cols ||
                  P.cells[nr][nc].type === 'void';
    ok(outside, 'window ' + i + ' faces outside (' + w.dir + ')');
  });
  ok(CFG.WINDOWS.length >= 6, 'at least 6 windows (' + CFG.WINDOWS.length + ')');

  // Placed objects must be on room cells.
  function checkPlacement(label, cell) {
    var c = P.cells[cell[1]] && P.cells[cell[1]][cell[0]];
    ok(c && c.type === 'room', label + ' on room cell [' + cell + '] (' +
       (c ? c.type : 'oob') + ')');
  }
  CFG.PERK_MACHINES.forEach(function (p) { checkPlacement('perk ' + p.perk, p.cell); });
  CFG.WALLBUYS.forEach(function (w) { checkPlacement('wallbuy ' + w.gun, w.cell); });
  CFG.BOX_SPOTS.forEach(function (b, i) { checkPlacement('box spot ' + i, b.cell); });
  CFG.TELEPORTERS.forEach(function (t) { checkPlacement('teleporter ' + t.id, t.cell); });
  if (CFG.MAINFRAME) checkPlacement('mainframe', CFG.MAINFRAME.cell);
  checkPlacement('pack-a-punch', CFG.PAP.cell);
  checkPlacement('power switch', CFG.POWER.cell);
  checkPlacement('player spawn', CFG.PLAYER_SPAWN.cell);
  CFG.RISERS.forEach(function (rs, i) { checkPlacement('riser ' + i, rs); });

  // Wall buys should face a wall (void or different room beyond their face dir).
  CFG.WALLBUYS.forEach(function (w) {
    var o = OFF[w.face], nr = w.cell[1] + o[1], nc = w.cell[0] + o[0];
    var n = (nr < 0 || nr >= P.rows || nc < 0 || nc >= P.cols)
      ? { type: 'void' } : P.cells[nr][nc];
    var cell = P.cells[w.cell[1]][w.cell[0]];
    var wallThere = n.type === 'void' || (n.type === 'room' && n.room !== cell.room);
    ok(wallThere, 'wallbuy ' + w.gun + ' faces a wall (' + w.face + ')');
  });

  // Teleporter rule integrity.
  if (M.papRule === 'teleporters') {
    ok(CFG.TELEPORTERS.length === 3, '3 teleporters for teleporter-PaP rule');
    ok(!!CFG.MAINFRAME, 'mainframe present for teleporter-PaP rule');
  } else {
    ok(M.papRule === 'power', 'papRule is power or teleporters');
  }

  // Mandatory loot: ray gun, monkeys (implicit), and the map wonder weapon.
  var wonder = CFG.WEAPONS[M.wonder];
  ok(!!wonder && wonder.wonder === true && wonder.box > 0,
     'wonder weapon ' + M.wonder + ' exists, flagged, and rolls in the box');
  var pool = Object.keys(CFG.WEAPONS).filter(function (id) {
    var w = CFG.WEAPONS[id];
    if (!w.box) return false;
    if (w.wonder && id !== M.wonder) return false;
    return true;
  });
  ok(pool.indexOf('raygun') >= 0, 'ray gun in the box pool');
  ok(pool.indexOf(M.wonder) >= 0, 'wonder weapon in the box pool');
  ok(pool.length >= 8, 'box pool has ' + pool.length + ' guns');
  CFG.MAP_IDS.forEach(function (other) {
    if (other === mapId) return;
    var ow = CFG.MAPS[other].wonder;
    if (ow !== M.wonder) {
      ok(pool.indexOf(ow) < 0, "other map's wonder " + ow + ' excluded from box');
    }
  });
});

// Weapon sanity (map-independent).
console.log('\n=== weapons ===');
var ids = Object.keys(CFG.WEAPONS);
ok(ids.length >= 40, 'arsenal has ' + ids.length + ' weapons (>= 40)');
var names = {}, CLASSES = ['pistol', 'smg', 'rifle', 'shotgun', 'lmg', 'sniper',
                           'launcher', 'minigun', 'raygun', 'thunder', 'wunder', 'storm'];
var fails0 = fails;
ids.forEach(function (id) {
  var w = CFG.WEAPONS[id];
  if (!w.pap || !w.pap.name) { ok(false, 'weapon ' + id + ' has PaP upgrade'); }
  if (names[w.name]) ok(false, 'duplicate weapon name ' + w.name);
  names[w.name] = true;
  if (!(w.rpm > 0 && w.mag > 0 && w.reserve > 0 && w.reload > 0)) ok(false, id + ' core stats positive');
  if (['auto', 'semi', 'pump', 'burst'].indexOf(w.mode) < 0) ok(false, id + ' mode valid');
  if (CLASSES.indexOf(w.cls) < 0) ok(false, id + ' class valid (' + w.cls + ')');
  if (w.dmg < 0 || (w.dmg === 0 && w.cls !== 'thunder')) ok(false, id + ' has damage');
});
ok(fails === fails0, 'every weapon has PaP name, unique name, sane stats, valid mode/class');
var dmgs = {};
ids.forEach(function (id) { dmgs[CFG.WEAPONS[id].dmg] = true; });
ok(Object.keys(dmgs).length >= 15, 'damage values are varied (' + Object.keys(dmgs).length + ' distinct)');
ok(new Set(CFG.MAP_IDS.map(function (id) { return CFG.MAPS[id].wonder; })).size === 3,
   'each map has a distinct wonder weapon');

// ---- damage profiles: shots-to-kill follows the COD archetypes ----
console.log('\n=== damage profiles ===');
function shots(id, round, head) {
  var w = CFG.WEAPONS[id];
  var perShot = w.dmg * (w.pellets || 1) * (head ? w.head : 1);
  return Math.ceil(CFG.zombieHealth(round) / perShot);
}
// shotguns one-shot the body deep into the game (close range, all pellets)
ok(shots('olympia', 8) === 1, 'Olympia one-shots a body through round 8 (got r8=' + shots('olympia', 8) + ')');
ok(shots('stakeout', 10) === 1, 'Stakeout one-shots a body through round 10');
ok(shots('olympia', 2) === 1, 'Olympia one-shots a body on round 2 (the reported bug)');
// marksman rifles one-shot the body early, headshots last longer
ok(shots('m14', 1) === 1, 'M14 one-shots a body on round 1');
ok(shots('fal', 2) === 1, 'FAL one-shots a body through round 2');
// snipers one-shot bodies well into double digits
ok(shots('l96a1', 10) === 1, 'L96A1 one-shots a body through round 10');
ok(shots('dsr50', 13) === 1, 'DSR-50 one-shots a body through round 13');
// SMGs/ARs take several body shots early (3-shot archetype)
ok(shots('mp5k', 1) >= 2 && shots('mp5k', 1) <= 4, 'MP5K is a 2-4 shot body on round 1 (got ' + shots('mp5k', 1) + ')');
ok(shots('ppsh', 1) >= 2 && shots('ppsh', 1) <= 4, 'PPSh-41 is a 2-4 shot body on round 1');
// pistols are weak (more shots than an SMG)
ok(shots('m1911', 1) > shots('mp5k', 1), 'starting pistol weaker than an SMG');
// headshots always beat body shots
ok(shots('m16', 3, true) <= shots('m16', 3, false), 'headshots kill at least as fast as body');
// player melee scaling: 3 hits base, 5 with Jugg on early rounds
ok(Math.ceil(CFG.PLAYER_HP / CFG.zombieMeleeDamage(1)) === 3, 'player downs in 3 hits at base');
ok(Math.ceil(CFG.JUGG_HP / CFG.zombieMeleeDamage(1)) === 5, 'player downs in 5 hits with Juggernog');
// melee never scales — 3-hit-down at every round, difficulty is count + speed
ok([1, 10, 25, 50].every(function (r) { return Math.ceil(CFG.PLAYER_HP / CFG.zombieMeleeDamage(r)) === 3; }),
   'always 3 swipes to down — melee damage is constant across all rounds');
ok(CFG.sprinterFraction(1) < CFG.sprinterFraction(15), 'difficulty rises via sprinter fraction instead');
// PPSh present (the requested gun) + 30+ arsenal
ok(!!CFG.WEAPONS.ppsh, 'PPSh-41 is in the arsenal');
ok(ids.length >= 30, 'at least 30 distinct guns (' + ids.length + ')');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
