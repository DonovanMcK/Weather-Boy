/* Node test: validates the map grid in js/config.js.
   Run: node tests/validate-map.js */
'use strict';
var CFG = require('../js/config.js');
var fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('FAIL  ' + msg); fails++; }
}

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

// No two different rooms are directly adjacent without a door between them
// (the wall generator puts a wall there, so it would be unreachable by design —
// flag it as suspicious anyway).
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
   'no direct room-to-room adjacency (walls): ' + JSON.stringify(Object.keys(adjacencies)));

// All rooms reachable from spawn with all doors open.
var seen = {}, queue = [['S']];
var roomGraph = {};
Object.keys(P.doors).forEach(function (id) {
  var rs = P.doors[id].rooms;
  if (rs.length === 2) {
    roomGraph[rs[0]] = (roomGraph[rs[0]] || []).concat(rs[1]);
    roomGraph[rs[1]] = (roomGraph[rs[1]] || []).concat(rs[0]);
  }
});
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

// Windows must sit on a room cell with void on the far side.
var OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
CFG.WINDOWS.forEach(function (w, i) {
  var c = w.cell[0], r = w.cell[1];
  var cell = P.cells[r] && P.cells[r][c];
  ok(cell && cell.type === 'room', 'window ' + i + ' on a room cell');
  var o = OFF[w.dir], nr = r + o[1], nc = c + o[0];
  var outside = nr < 0 || nr >= P.rows || nc < 0 || nc >= P.cols ||
                P.cells[nr][nc].type === 'void';
  ok(outside, 'window ' + i + ' faces outside (' + w.dir + ')');
});

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
checkPlacement('mainframe', CFG.MAINFRAME.cell);
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

// Weapon sanity: every weapon has pap data, wall guns priced, box pool nonempty.
var boxPool = 0;
Object.keys(CFG.WEAPONS).forEach(function (id) {
  var w = CFG.WEAPONS[id];
  ok(!!w.pap && !!w.pap.name, 'weapon ' + id + ' has PaP upgrade');
  if (w.box) boxPool++;
});
ok(boxPool >= 8, 'mystery box pool has ' + boxPool + ' guns');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
