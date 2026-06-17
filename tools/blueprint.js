/* Blueprint generator — renders a top-down SVG schematic of each TOTENSTURM
   map from the game config + the upper-floor (catwalk/loft) definitions.
   Run: node tools/blueprint.js   ->   writes blueprints/<map>.svg            */
'use strict';
var fs = require('fs');
var path = require('path');
var CFG = require('../js/config.js');

var CELL = 44, PAD = 70, LEG = 250;

// upper-floor (stage) footprints per map: cells of the deck/loft + stair cells
var UPPER = {
  derriese: {
    label: 'UPPER CATWALK  +3.2m  (open, no rails)',
    deck: cellsOf([[3, 5], [3, 6], [3, 7], [12, 5], [12, 6], [12, 7]])
      .concat(rangeRow(5, 3, 12)),                 // W strip, E strip, N strip
    stairs: [[3, 8], [3, 9], [12, 8], [12, 9]]
  },
  wetterjunge: {
    label: 'STORAGE LOFT  +3.4m  (enclosed room)',
    deck: rect(11, 5, 14, 6),
    stairs: [[14, 7], [14, 8]]
  },
  nacht: null
};
function cellsOf(a) { return a.slice(); }
function rangeRow(r, c0, c1) { var o = []; for (var c = c0; c <= c1; c++) o.push([c, r]); return o; }
function rect(c0, r0, c1, r1) { var o = []; for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) o.push([c, r]); return o; }

function roomColor(hex) {
  var c = new IntColor(hex).mul(2.2);
  return c.css();
}
function IntColor(h) { this.r = (h >> 16) & 255; this.g = (h >> 8) & 255; this.b = h & 255; }
IntColor.prototype.mul = function (k) {
  this.r = Math.min(255, this.r * k); this.g = Math.min(255, this.g * k); this.b = Math.min(255, this.b * k); return this;
};
IntColor.prototype.css = function () { return 'rgb(' + (this.r | 0) + ',' + (this.g | 0) + ',' + (this.b | 0) + ')'; };

var PERK_ABBR = { revive: 'Quick Revive', jugg: 'Juggernog', speed: 'Speed Cola', dtap: 'Double Tap',
  stamin: 'Stamin-Up', mule: 'Mule Kick', widows: "Widow's Wine", phd: 'PhD Slider',
  cherry: 'Electric Cherry', wonderfizz: 'Der Wunderfizz' };

function px(col) { return PAD + col * CELL; }

function build(id) {
  CFG.setMap(id);
  var grid = CFG.GRID, rows = grid.length, cols = grid[0].length;
  var P = CFG.parseGrid(grid);
  var W = PAD * 2 + cols * CELL + LEG, H = PAD * 2 + rows * CELL + 40;
  var s = [];
  s.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" font-family="Consolas,monospace">');
  s.push('<rect width="' + W + '" height="' + H + '" fill="#0b1016"/>');
  // blueprint grid lines
  for (var gx = 0; gx <= cols; gx++) s.push('<line x1="' + px(gx) + '" y1="' + px(0) + '" x2="' + px(gx) + '" y2="' + (px(0) + rows * CELL) + '" stroke="#15314a" stroke-width="1"/>');
  for (var gy = 0; gy <= rows; gy++) s.push('<line x1="' + px(0) + '" y1="' + (PAD + gy * CELL) + '" x2="' + (px(0) + cols * CELL) + '" y2="' + (PAD + gy * CELL) + '" stroke="#15314a" stroke-width="1"/>');

  // room fills
  for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
    var cell = P.cells[r][c];
    if (cell.type === 'room') {
      s.push('<rect x="' + px(c) + '" y="' + (PAD + r * CELL) + '" width="' + CELL + '" height="' + CELL + '" fill="' + roomColor(CFG.ROOMS[cell.room].floor) + '" opacity="0.5"/>');
    } else if (cell.type === 'door') {
      s.push('<rect x="' + (px(c) + 6) + '" y="' + (PAD + r * CELL + 6) + '" width="' + (CELL - 12) + '" height="' + (CELL - 12) + '" fill="none" stroke="#e0c060" stroke-width="2" stroke-dasharray="4 3"/>');
      s.push(txt(px(c) + CELL / 2, PAD + r * CELL + CELL / 2 + 5, cell.door, '#ffd76e', 16, 'middle', 700));
    }
  }
  // room name labels (centroid)
  Object.keys(P.rooms).forEach(function (rid) {
    var cs = P.rooms[rid].cells, cx = 0, cy = 0;
    cs.forEach(function (cc) { cx += cc[0]; cy += cc[1]; });
    cx = px(cx / cs.length) + CELL / 2; cy = PAD + (cy / cs.length) * CELL + CELL / 2;
    s.push(txt(cx, cy - 6, CFG.ROOMS[rid].name.toUpperCase(), '#cfe8ff', 11, 'middle', 700));
    s.push(txt(cx, cy + 8, '"' + rid + '"', '#5f87a8', 10, 'middle'));
  });

  // marker helper at a cell
  function marker(cell, fill, label, sub) {
    var x = px(cell[0]) + CELL / 2, y = PAD + cell[1] * CELL + CELL / 2;
    s.push('<circle cx="' + x + '" cy="' + y + '" r="9" fill="' + fill + '" stroke="#06121c" stroke-width="2"/>');
    s.push(txt(x, y + 3.5, label, '#06121c', 9, 'middle', 800));
    if (sub) s.push(txt(x, y + 22, sub, fill, 9, 'middle', 700));
  }
  (CFG.PERK_MACHINES || []).forEach(function (pm) {
    var x = px(pm.cell[0]) + CELL / 2, y = PAD + pm.cell[1] * CELL + CELL / 2;
    s.push('<circle cx="' + x + '" cy="' + y + '" r="10" fill="' + colHex(CFG.PERKS[pm.perk].color) + '" stroke="#06121c" stroke-width="2"/>');
    s.push(txt(x, y + 3, CFG.PERKS[pm.perk].icon, '#06121c', 8, 'middle', 800));
    s.push(txt(x, y + 23, PERK_ABBR[pm.perk] + (pm.y ? ' (UP)' : ''), colHex(CFG.PERKS[pm.perk].color), 9, 'middle', 700));
  });
  (CFG.WALLBUYS || []).forEach(function (wb) {
    var x = px(wb.cell[0]) + CELL / 2, y = PAD + wb.cell[1] * CELL + CELL / 2;
    s.push('<rect x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14" fill="#8a8f98" stroke="#06121c"/>');
    s.push(txt(x, y + 20, (wb.gun === 'frags' ? 'Frags' : wb.gun) + (wb.y ? ' (UP)' : ''), '#b9c0ca', 9, 'middle', 700));
  });
  (CFG.BOX_SPOTS || []).forEach(function (bs) {
    var x = px(bs.cell[0]) + CELL / 2, y = PAD + bs.cell[1] * CELL + CELL / 2;
    s.push('<rect x="' + (x - 8) + '" y="' + (y - 8) + '" width="16" height="16" fill="#1c3a6e" stroke="#6ea8ff" stroke-width="2" rx="2"/>');
    s.push(txt(x, y + 4, '?', '#9ec5ff', 12, 'middle', 800) + (bs.y ? txt(x, y + 21, '(UP)', '#6ea8ff', 8, 'middle', 700) : ''));
  });
  (CFG.TELEPORTERS || []).forEach(function (t) { marker2(t.cell, '#22ddff', 'TELE ' + t.id); });
  if (CFG.MAINFRAME) marker2(CFG.MAINFRAME.cell, '#22cc66', 'MAINFRAME');
  if (CFG.PAP) marker2(CFG.PAP.cell, '#9a55ff', 'PACK-A-PUNCH');
  if (CFG.POWER) marker2(CFG.POWER.cell, '#ffdd44', 'POWER');
  marker2(CFG.PLAYER_SPAWN.cell, '#ffffff', 'SPAWN');
  (CFG.EE_RELICS || []).forEach(function (cl) { diamond(cl, '#33ddaa', 'relic'); });
  if (CFG.EE_SOULBOX) diamond(CFG.EE_SOULBOX, '#9933ff', 'soul chest');
  (CFG.WW_PARTS || []).forEach(function (cl) { diamond(cl, '#1f9fd0', 'WW part'); });
  if (CFG.WW_BUILD) diamond(CFG.WW_BUILD, '#2a6f9a', 'WW bench');

  function marker2(cell, fill, label) {
    var x = px(cell[0]) + CELL / 2, y = PAD + cell[1] * CELL + CELL / 2;
    s.push('<circle cx="' + x + '" cy="' + y + '" r="10" fill="none" stroke="' + fill + '" stroke-width="3"/>');
    s.push(txt(x, y + 22, label, fill, 9, 'middle', 700));
  }
  function diamond(cell, fill, label) {
    var x = px(cell[0]) + CELL / 2, y = PAD + cell[1] * CELL + CELL / 2;
    s.push('<rect x="' + (x - 6) + '" y="' + (y - 6) + '" width="12" height="12" fill="' + fill + '" transform="rotate(45 ' + x + ' ' + y + ')"/>');
    s.push(txt(x, y + 20, label, fill, 8, 'middle', 600));
  }

  // windows on the room perimeter
  var OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  (CFG.WINDOWS || []).forEach(function (w) {
    var o = OFF[w.dir], x = px(w.cell[0]) + CELL / 2 + o[0] * CELL / 2, y = PAD + w.cell[1] * CELL + CELL / 2 + o[1] * CELL / 2;
    s.push('<rect x="' + (x - (o[0] ? 3 : 10)) + '" y="' + (y - (o[1] ? 3 : 10)) + '" width="' + (o[0] ? 6 : 20) + '" height="' + (o[1] ? 6 : 20) + '" fill="#b07a3a"/>');
  });

  // ---- upper-floor overlay ----
  var up = UPPER[id];
  if (up) {
    s.push('<defs><pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="8" stroke="#ff9a3c" stroke-width="2" opacity="0.5"/></pattern></defs>');
    up.deck.forEach(function (cl) {
      s.push('<rect x="' + px(cl[0]) + '" y="' + (PAD + cl[1] * CELL) + '" width="' + CELL + '" height="' + CELL + '" fill="url(#hatch)" stroke="#ff9a3c" stroke-width="2" opacity="0.9"/>');
    });
    up.stairs.forEach(function (cl) {
      var x = px(cl[0]), y = PAD + cl[1] * CELL;
      s.push('<rect x="' + x + '" y="' + y + '" width="' + CELL + '" height="' + CELL + '" fill="#5a3a18" stroke="#ff9a3c" stroke-width="1.5" opacity="0.85"/>');
      for (var k = 1; k < 4; k++) s.push('<line x1="' + x + '" y1="' + (y + k * CELL / 4) + '" x2="' + (x + CELL) + '" y2="' + (y + k * CELL / 4) + '" stroke="#ff9a3c" stroke-width="1.2"/>');
    });
    var sc = up.stairs[0];
    s.push(txt(px(sc[0]) + CELL / 2, PAD + sc[1] * CELL + CELL + 14, 'STAIRS', '#ff9a3c', 9, 'middle', 700));
  }

  // title + legend
  s.push(txt(PAD, 40, 'TOTENSTURM  ·  ' + CFG.cur.name, '#ff5a5a', 24, 'start', 900));
  s.push(txt(PAD, 58, CFG.cur.sub, '#8fa9c0', 12, 'start'));
  var lx = px(0) + cols * CELL + 24, ly = PAD + 6;
  function leg(col, label, shape) {
    s.push(shape === 'sq' ? '<rect x="' + lx + '" y="' + (ly - 9) + '" width="14" height="14" fill="' + col + '"/>'
      : shape === 'di' ? '<rect x="' + (lx + 1) + '" y="' + (ly - 7) + '" width="11" height="11" fill="' + col + '" transform="rotate(45 ' + (lx + 6) + ' ' + (ly - 1) + ')"/>'
        : '<circle cx="' + (lx + 7) + '" cy="' + (ly - 2) + '" r="7" fill="' + col + '"/>');
    s.push(txt(lx + 22, ly + 2, label, '#cfe', 11, 'start', 600)); ly += 24;
  }
  s.push(txt(lx, ly - 18, 'LEGEND', '#ffd76e', 13, 'start', 800)); ly += 14;
  leg('#ff9a3c', 'Upper floor (catwalk/loft)', 'sq');
  leg('#5a3a18', 'Stairs up', 'sq');
  leg('#ff3344', 'Perk machine', 'c');
  leg('#8a8f98', 'Wall buy', 'sq');
  leg('#1c3a6e', 'Mystery box spawn', 'sq');
  leg('#22ddff', 'Teleporter', 'c');
  leg('#9a55ff', 'Pack-a-Punch', 'c');
  leg('#22cc66', 'Mainframe / Power', 'c');
  leg('#ffffff', 'Player spawn', 'c');
  leg('#33ddaa', 'Easter-egg relic', 'di');
  leg('#1f9fd0', 'Wonder-weapon part', 'di');
  leg('#b07a3a', 'Window (barrier)', 'sq');
  if (up) { ly += 6; s.push(txt(lx, ly, up.label, '#ff9a3c', 11, 'start', 700)); }

  s.push('</svg>');
  return s.join('\n');
}
function colHex(h) { return '#' + ('000000' + h.toString(16)).slice(-6); }
function txt(x, y, t, fill, size, anchor, weight) {
  return '<text x="' + x + '" y="' + y + '" fill="' + fill + '" font-size="' + size + '" text-anchor="' + (anchor || 'start') + '"' + (weight ? ' font-weight="' + weight + '"' : '') + '>' + String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
}

var outDir = path.join(__dirname, '..', 'blueprints');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
['nacht', 'derriese', 'wetterjunge'].forEach(function (id) {
  fs.writeFileSync(path.join(outDir, id + '.svg'), build(id));
  console.log('wrote blueprints/' + id + '.svg');
});
