/* Node tool: top-down ASCII placement report per map. Serves as the headless
   verification artifact (this environment has no display/WebGL for screenshots).
   Marks every gameplay object on the grid so placement can be reviewed:
     P=perk  $=Pack-a-Punch  !=power  M=mainframe  B=mystery-box spot
     W=wall-buy  T=teleporter  R=relic  O=soul chest  s=shield part  b=shield bench
   Run: node tools/placement-report.js  (writes blueprints/placement.txt)         */
var fs = require('fs'), path = require('path');
var CFG = require('../js/config.js');

function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

var lines = [];
function out(s) { lines.push(s == null ? '' : s); }

CFG.MAP_IDS.forEach(function (id) {
  CFG.setMap(id);
  var grid = CFG.cur.GRID, rows = grid.length, cols = grid[0].length;
  // base layer: room letters / doors / void
  var cell = [];
  for (var r = 0; r < rows; r++) { cell[r] = grid[r].split(''); }

  var marks = {}; // "c,r" -> char  (overlay)
  function mark(c, r, ch) { if (c == null) return; marks[c + ',' + r] = ch; }

  (CFG.cur.PERK_MACHINES || []).forEach(function (p) { mark(p.cell[0], p.cell[1], p.perk === 'wonderfizz' ? 'F' : 'P'); });
  (CFG.cur.WALLBUYS || []).forEach(function (w) { mark(w.cell[0], w.cell[1], 'W'); });
  (CFG.cur.BOX_SPOTS || []).forEach(function (b) { mark(b[0], b[1], 'B'); });
  (CFG.cur.TELEPORTERS || []).forEach(function (t) { mark(t.cell[0], t.cell[1], 'T'); });
  (CFG.cur.EE_RELICS || []).forEach(function (c) { mark(c[0], c[1], 'R'); });
  if (CFG.cur.EE_SOULBOX) mark(CFG.cur.EE_SOULBOX[0], CFG.cur.EE_SOULBOX[1], 'O');
  if (CFG.cur.PAP) mark(CFG.cur.PAP.cell[0], CFG.cur.PAP.cell[1], '$');
  if (CFG.cur.POWER) mark(CFG.cur.POWER.cell[0], CFG.cur.POWER.cell[1], '!');
  if (CFG.cur.MAINFRAME) mark(CFG.cur.MAINFRAME.cell[0], CFG.cur.MAINFRAME.cell[1], 'M');
  // selected shield parts (deterministic) + bench
  ['frame', 'plate', 'battery'].forEach(function (k) {
    var locs = CFG.SHIELD_PARTS && CFG.SHIELD_PARTS[k]; if (!locs) return;
    var loc = locs[hashStr(id + ':' + k) % locs.length];
    mark(loc.cell[0], loc.cell[1], 's');
  });
  if (CFG.SHIELD_BENCH) mark(CFG.SHIELD_BENCH.cell[0], CFG.SHIELD_BENCH.cell[1], 'b');

  out('============================================================');
  out('  ' + id.toUpperCase() + ' — ' + (CFG.cur.name || ''));
  out('============================================================');
  var header = '    ' + Array.apply(null, { length: cols }).map(function (_, c) { return (c % 10); }).join('');
  out(header);
  for (var r2 = 0; r2 < rows; r2++) {
    var row = '';
    for (var c2 = 0; c2 < cols; c2++) {
      var m = marks[c2 + ',' + r2];
      row += m || (/[A-Z]/.test(cell[r2][c2]) ? cell[r2][c2].toLowerCase() : cell[r2][c2]);
    }
    out(String(r2).padStart(2) + '  ' + row);
  }
  out('');
  out('  rooms: ' + Object.keys(CFG.cur.ROOMS).map(function (k) { return k.toLowerCase() + '=' + CFG.cur.ROOMS[k].name; }).join(', '));
  out('  legend: P=perk F=wunderfizz $=PaP !=power M=mainframe T=teleporter');
  out('          B=box W=wallbuy R=relic O=soulchest s=shieldpart b=shieldbench');
  out('  shield parts selected this seed: ' + ['frame', 'plate', 'battery'].map(function (k) {
    var locs = CFG.SHIELD_PARTS[k]; var loc = locs[hashStr(id + ':' + k) % locs.length];
    return k + '[' + loc.cell.join(',') + ']' + loc.face;
  }).join('  '));
  out('  shield bench: [' + CFG.SHIELD_BENCH.cell.join(',') + ']' + CFG.SHIELD_BENCH.face);
  out('');
});

var report = lines.join('\n');
try { fs.mkdirSync(path.join(__dirname, '..', 'blueprints')); } catch (e) {}
fs.writeFileSync(path.join(__dirname, '..', 'blueprints', 'placement.txt'), report);
console.log(report);
console.log('\nwrote blueprints/placement.txt');
