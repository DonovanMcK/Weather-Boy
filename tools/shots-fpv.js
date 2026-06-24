#!/usr/bin/env node
/* First-person diagnostic shots — eye-level (1.6m) views looking horizontally
   from inside rooms on each Kurhaus floor, NO ceiling cull, so I see exactly
   what the player sees: holes, clipping, see-through floors, scale.
   Run: node tools/shots-fpv.js */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path'), fs = require('fs');
var ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'screenshots', 'kurhaus-fpv');
var URL = 'file://' + path.join(ROOT, 'index.html'), W = 1280, H = 760;

(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    var p = await b.newPage(); await p.setViewport({ width: W, height: H });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForFunction('window.G && G.map && G.startGame');
    await p.evaluate(function () { G.startGame('kurhaus'); });
    await p.waitForFunction('G.state==="playing"||G.state==="paused"');
    await p.evaluate(function () { Object.keys(G.map.doors).forEach(function (id) { G.map.openDoor(id); var d = G.map.doors[id]; if (d.mesh) d.mesh.visible = false; if (d.sprite) { G.scene.remove(d.sprite); d.sprite = null; } }); });
    // eye-level views: stand at a room centre on each floor, look toward the room's far side + up
    var views = await p.evaluate(function () {
      var G = window.G, CFG = G.CFG, out = [];
      function room(rid, y) { var r = G.map.floors.filter(function (f) { return Math.abs(f.floorY - y) < 0.5; })[0]; return r && r.parsed.rooms[rid] && r.parsed.rooms[rid].center; }
      [['S', 0, 'foyer'], ['A', 0, 'atrium'], ['B', 0, 'ballroom'], ['H', -4, 'hotsprings'], ['F', -4, 'furnace'], ['G', 4, 'galleries'], ['E', 4, 'tesla']].forEach(function (q) {
        var c = room(q[0], q[1]); if (!c) return;
        out.push({ name: q[2] + '-fwd', pos: [c.x, q[1] + 1.6, c.z], look: [c.x + 8, q[1] + 1.5, c.z] });
        out.push({ name: q[2] + '-up', pos: [c.x, q[1] + 1.6, c.z], look: [c.x + 4, q[1] + 5, c.z] });
      });
      return out;
    });
    await p.evaluate(function () {
      window.__sh = function (v) { var G = window.G; G.state = 'paused'; if (G.weapons && G.weapons.vmRoot) G.weapons.vmRoot.visible = false; Array.prototype.forEach.call(document.body.children, function (el) { if (el.id !== 'game') el.style.display = 'none'; }); G.camera.position.set(v.pos[0], v.pos[1], v.pos[2]); G.camera.fov = 75; G.camera.updateProjectionMatrix(); G.camera.lookAt(v.look[0], v.look[1], v.look[2]); G.renderer.render(G.scene, G.camera); };
    });
    fs.mkdirSync(OUT, { recursive: true });
    var canvas = await p.$('#game');
    for (var i = 0; i < views.length; i++) { await p.evaluate('window.__sh(' + JSON.stringify(views[i]) + ')'); await new Promise(function (r) { setTimeout(r, 60); }); await canvas.screenshot({ path: path.join(OUT, views[i].name + '.png') }); console.log('  ' + views[i].name); }
  } finally { await b.close(); }
})();
