#!/usr/bin/env node
/* Top-down flow-review capture for a single map (default: kurhaus).
   Renders straight-down, ceiling/roof-culled overheads so the FLOOR layout,
   doorway widths, run lines and training ovals read clearly — the angled
   overview/interior shots in shots.js hide exactly that. Produces one overhead
   of the whole floor plus one overhead per room.

   Run:  node tools/shots-topdown.js [mapId]
   Out:  screenshots/<mapId>-topdown/*.png                                    */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var fs = require('fs');

var MAP = process.argv[2] || 'kurhaus';
var ROOT = path.resolve(__dirname, '..');
var OUT = path.join(ROOT, 'screenshots', MAP + '-topdown');
var URL = 'file://' + path.join(ROOT, 'index.html');
var W = 1280, H = 1000;

(async function () {
  var browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--ignore-gpu-blocklist', '--window-size=' + W + ',' + H]
  });
  try {
    var page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    page.on('pageerror', function (e) { console.log('  [page error] ' + e.message); });
    page.on('console', function (m) { if (m.type() === 'error') console.log('  [console] ' + m.text()); });

    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('window.G && G.CFG && G.map && G.player && G.startGame');
    await page.evaluate(function (m) { G.startGame(m); }, MAP);
    await page.waitForFunction('G.state === "playing" || G.state === "paused"');

    // open every door + hide its debris so thresholds read clean
    await page.evaluate(function () {
      Object.keys(G.map.doors).forEach(function (id) {
        G.map.openDoor(id);
        var d = G.map.doors[id];
        if (d.mesh) d.mesh.visible = false;
        if (d.sprite) { G.scene.remove(d.sprite); d.sprite = null; }
      });
    });

    // build the straight-down viewpoints from room geometry
    var vps = await page.evaluate(function () {
      var G = window.G, CFG = G.CFG, CELL = CFG.CELL, P = G.map.parsed;
      function bounds(room) {
        var minc = 1e9, maxc = -1e9, minr = 1e9, maxr = -1e9;
        room.cells.forEach(function (c) {
          if (c[0] < minc) minc = c[0]; if (c[0] > maxc) maxc = c[0];
          if (c[1] < minr) minr = c[1]; if (c[1] > maxr) maxr = c[1];
        });
        var a = CFG.cellToWorld(minc, minr), b = CFG.cellToWorld(maxc, maxr);
        return { cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2,
                 w: (b.x - a.x) + CELL, d: (b.z - a.z) + CELL };
      }
      var out = [];
      // whole floor
      var g0 = CFG.cellToWorld(0, 0), g1 = CFG.cellToWorld(P.cols - 1, P.rows - 1);
      var fw = Math.abs(g1.x - g0.x) + CELL, fd = Math.abs(g1.z - g0.z) + CELL;
      out.push({ name: '0-floor', cx: (g0.x + g1.x) / 2, cz: (g0.z + g1.z) / 2,
                 span: Math.max(fw, fd) });
      // per room
      Object.keys(P.rooms).forEach(function (rid) {
        var bb = bounds(P.rooms[rid]);
        var nm = (CFG.ROOMS[rid] && CFG.ROOMS[rid].name || rid).replace(/\s+/g, '-');
        out.push({ name: 'room-' + rid + '-' + nm, cx: bb.cx, cz: bb.cz,
                   span: Math.max(bb.w, bb.d) });
      });
      return out;
    });

    // shooter: straight down, ceilings/roofs culled, north (-Z) up in frame
    await page.evaluate(function () {
      window.__td = function (v) {
        var G = window.G, THREE = window.THREE;
        G.state = 'paused';
        if (G.weapons && G.weapons.vmRoot) G.weapons.vmRoot.visible = false;
        if (!window.__roofs) {
          window.__roofs = [];
          G.scene.traverse(function (o) {
            if (!o.isMesh || !o.position) return;
            var ceilPlane = o.geometry && o.geometry.type === 'PlaneGeometry' &&
              o.material && o.material.side === THREE.DoubleSide && o.position.y > 3.5;
            if (ceilPlane || o.position.y > 4.5) window.__roofs.push(o);
          });
        }
        window.__roofs.forEach(function (o) { o.visible = false; });
        Array.prototype.forEach.call(document.body.children, function (el) {
          if (el.id !== 'game') el.style.display = 'none';
        });
        var cam = G.camera;
        cam.fov = 55; cam.updateProjectionMatrix();
        cam.up.set(0, 0, -1);                       // north points up in the image
        cam.position.set(v.cx, v.span * 1.15 + 6, v.cz);
        cam.lookAt(v.cx, 0, v.cz);
        G.renderer.render(G.scene, G.camera);
      };
    });

    fs.mkdirSync(OUT, { recursive: true });
    var canvas = await page.$('#game');
    for (var i = 0; i < vps.length; i++) {
      await page.evaluate('window.__td(' + JSON.stringify(vps[i]) + ')');
      await new Promise(function (r) { setTimeout(r, 80); });
      var file = path.join(OUT, vps[i].name + '.png');
      await canvas.screenshot({ path: file });
      console.log('  wrote ' + path.relative(ROOT, file));
    }
    console.log('\nDone. ' + vps.length + ' top-down PNGs in screenshots/' + MAP + '-topdown/');
  } finally {
    await browser.close();
  }
})();
