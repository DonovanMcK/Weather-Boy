#!/usr/bin/env node
/* Floor-culling check: place the player on each floor, run map.update, and
   confirm the far floor's tagged meshes/lights go hidden while the current +
   adjacent floors stay visible. Also confirms legacy maps tag nothing.
   Run: node tools/test-cull.js */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');

function countByFloor() {
  var G = window.G, out = { '-4': { vis: 0, hid: 0 }, '0': { vis: 0, hid: 0 }, '4': { vis: 0, hid: 0 } };
  G.map.cullables.forEach(function (c) {
    var b = out[c.userData.fy]; if (!b) return;
    if (c.visible) b.vis++; else b.hid++;
  });
  return { total: G.map.cullables.length, byFloor: out };
}

(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  var fail = 0;
  function ck(cond, msg, extra) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg + (extra ? '   ' + extra : '')); if (!cond) fail++; }
  try {
    var p = await b.newPage();
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForFunction('window.G && G.startGame');

    // legacy map tags nothing
    await p.evaluate(function () { G.startGame('nacht'); });
    await p.waitForFunction('G.state==="playing"');
    var legacy = await p.evaluate(function () { return G.map.cullables.length; });
    ck(legacy === 0, 'legacy (nacht) tags zero cullables (no culling)', 'n=' + legacy);

    // kurhaus (fresh load — switching maps mid-session isn't supported)
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForFunction('window.G && G.startGame');
    await p.evaluate(function () { G.startGame('kurhaus'); });
    await p.waitForFunction('G.state==="playing"');
    var tagged = await p.evaluate(function () { return G.map.cullables.length; });
    ck(tagged > 200, 'kurhaus tags a meaningful pile of cullables', 'n=' + tagged);

    // each floor: set player feet Y, force a re-cull, read counts
    for (var fy of [0, -4, 4]) {
      var r = await p.evaluate(function (y) {
        G.player.pos.y = y; G.map._shownKey = null; G.map.update(0.016);
        var G2 = window.G, out = { '-4': { vis: 0, hid: 0 }, '0': { vis: 0, hid: 0 }, '4': { vis: 0, hid: 0 } };
        G2.map.cullables.forEach(function (c) { var bb = out[c.userData.fy]; if (!bb) return; if (c.visible) bb.vis++; else bb.hid++; });
        return out;
      }, fy);
      console.log('  floor y=' + fy + '  ' + JSON.stringify(r));
      if (fy === 0) {
        ck(r['-4'].hid === 0 && r['0'].hid === 0 && r['4'].hid === 0, '  on F1 (middle): all floors shown');
      } else if (fy === -4) {
        ck(r['-4'].hid === 0 && r['0'].hid === 0, '  on FB: FB + F1 shown');
        ck(r['4'].vis === 0 && r['4'].hid > 0, '  on FB: F2 hidden', 'F2 hidden=' + r['4'].hid);
      } else if (fy === 4) {
        ck(r['4'].hid === 0 && r['0'].hid === 0, '  on F2: F2 + F1 shown');
        ck(r['-4'].vis === 0 && r['-4'].hid > 0, '  on F2: FB hidden', 'FB hidden=' + r['-4'].hid);
      }
    }
  } finally { await b.close(); }
  console.log(fail ? '\nCULL TEST FAILED (' + fail + ')' : '\nCULL TEST PASSED');
  process.exit(fail ? 1 : 0);
})();
