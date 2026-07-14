#!/usr/bin/env node
/* ===========================================================================
   TOTENSTURM — map audit ("manage the maps")
   Loads every map headless (no browser needed — structural metrics only),
   computes health metrics, runs the test suites, and writes a timestamped
   report to reports/map-audit-latest.md (+ a dated copy). Designed to be run
   on a schedule (see tools/cron-setup.sh) so map quality is tracked over time
   and regressions/sparse rooms/dark rooms/door-blockers surface automatically.

   Run:  npm run audit
   =========================================================================== */
'use strict';
var path = require('path');
var fs = require('fs');
var cp = require('child_process');
var ROOT = path.resolve(__dirname, '..');
var smoke = require(path.join(ROOT, 'tests', 'smoke.js'));

function bounds(CFG, room) {
  var CELL = CFG.CELL, minc = 1e9, maxc = -1e9, minr = 1e9, maxr = -1e9;
  room.cells.forEach(function (c) {
    if (c[0] < minc) minc = c[0]; if (c[0] > maxc) maxc = c[0];
    if (c[1] < minr) minr = c[1]; if (c[1] > maxr) maxr = c[1];
  });
  var a = CFG.cellToWorld(minc, minr), b = CFG.cellToWorld(maxc, maxr);
  return { x0: a.x - CELL / 2, x1: b.x + CELL / 2, z0: a.z - CELL / 2, z1: b.z + CELL / 2,
           w: (maxc - minc + 1) * CELL, d: (maxr - minr + 1) * CELL };
}

function auditMap(id) {
  var ctx = smoke.createGame(); var G = ctx.G; G.startGame(id);
  var CFG = G.CFG, P = G.map.parsed, rooms = P.rooms, outdoor = CFG.cur.OUTDOOR || [];
  // props per room
  var propsByRoom = {}, totalProps = 0;
  G.scene.traverse(function (o) {
    if (o.userData && o.userData.propType && o.parent === G.scene) {
      var r = G.map.roomAt(o.position.x, o.position.z); if (!r) return;
      propsByRoom[r] = (propsByRoom[r] || 0) + 1; totalProps++;
    }
  });
  // lamps per room
  var lampsByRoom = {};
  (G.map.roomLights || []).forEach(function (l) {
    var r = G.map.roomAt(l.position.x, l.position.z); if (r) lampsByRoom[r] = (lampsByRoom[r] || 0) + 1;
  });
  var flags = [], rows = [];
  Object.keys(rooms).forEach(function (rid) {
    var bb = bounds(CFG, rooms[rid]), cells = rooms[rid].cells.length;
    var props = propsByRoom[rid] || 0, lamps = lampsByRoom[rid] || 0;
    var area = bb.w * bb.d, density = props / cells;
    var isOut = outdoor.indexOf(rid) >= 0;
    var name = (CFG.ROOMS[rid] && CFG.ROOMS[rid].name) || rid;
    rows.push({ rid: rid, name: name, cells: cells, area: area.toFixed(0), props: props,
                density: density.toFixed(2), lamps: lamps, out: isOut });
    if (!isOut && density < 0.6) flags.push('SPARSE: ' + name + ' (' + rid + ') has ' + props + ' props over ' + cells + ' cells (density ' + density.toFixed(2) + ')');
    if (!isOut && lamps / cells < 0.18) flags.push('DARK: ' + name + ' (' + rid + ') has ' + lamps + ' lamps over ' + cells + ' cells');
  });
  // Door blockers: test the actual standing volume at the threshold on that
  // door's floor. Proximity-only checks falsely flag legitimate frame walls,
  // especially for second-storey doors above ground-floor architecture.
  var doorFlags = [];
  Object.keys(G.map.doors).forEach(function (did) {
    var door = G.map.doors[did], dp = door.pos;
    var feet = (dp.y || 0) + 0.2, lo = feet + 0.25, hi = feet + 1.7;
    var blocked = G.map.colliders.some(function (c) {
      if (!c.on || c === door.collider) return false; // ignore the closed debris itself
      return dp.x >= c.x1 && dp.x <= c.x2 && dp.z >= c.z1 && dp.z <= c.z2 && hi > c.y1 && lo < c.y2;
    });
    if (blocked)
      doorFlags.push('DOOR-BLOCK: threshold blocked at door ' + did);
  });
  // vertical interest: rooms that have a stage/deck over them
  var vertical = (G.map.stages || []).length;
  return { id: id, rooms: Object.keys(rooms).length, totalProps: totalProps, vertical: vertical,
           rows: rows, flags: flags.concat(doorFlags) };
}

function runCmd(cmd) {
  try { cp.execSync(cmd, { cwd: ROOT, stdio: 'pipe' }); return 'PASS'; }
  catch (e) { return 'FAIL'; }
}

function main() {
  var maps = ['nacht', 'derriese', 'wetterjunge'];
  var when = new Date().toISOString();
  var validate = runCmd('node tests/validate-map.js');
  var smokeRes = runCmd('node tests/smoke.js');
  var out = ['# TOTENSTURM — Map Audit', '', '_Generated: ' + when + '_', '',
             '## Test suites', '- validate-map: **' + validate + '**', '- smoke: **' + smokeRes + '**', ''];
  var allFlags = [];
  maps.forEach(function (id) {
    var a = auditMap(id);
    out.push('## ' + id.toUpperCase());
    out.push('- rooms: ' + a.rooms + ' | total props: ' + a.totalProps + ' | staircases/decks: ' + a.vertical);
    out.push('');
    out.push('| room | cells | area m² | props | prop density | lamps | outdoor |');
    out.push('|---|---|---|---|---|---|---|');
    a.rows.forEach(function (r) {
      out.push('| ' + r.name + ' (' + r.rid + ') | ' + r.cells + ' | ' + r.area + ' | ' + r.props + ' | ' + r.density + ' | ' + r.lamps + ' | ' + (r.out ? 'yes' : '') + ' |');
    });
    out.push('');
    if (a.flags.length) { out.push('**Flags:**'); a.flags.forEach(function (f) { out.push('- ' + f); }); out.push(''); }
    else { out.push('_No automatic flags._', ''); }
    a.flags.forEach(function (f) { allFlags.push(id + ': ' + f); });
  });
  out.push('## Summary');
  out.push('- total flags: ' + allFlags.length);
  out.push('- See SUGGESTIONS.md for the curated polish/add/remove backlog.');
  out.push('');

  var dir = path.join(ROOT, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  var body = out.join('\n');
  fs.writeFileSync(path.join(dir, 'map-audit-latest.md'), body);
  fs.writeFileSync(path.join(dir, 'map-audit-' + when.slice(0, 10) + '.md'), body);
  console.log(body);
  console.log('\nWrote reports/map-audit-latest.md (' + allFlags.length + ' flags). validate=' + validate + ' smoke=' + smokeRes);
}
main();
