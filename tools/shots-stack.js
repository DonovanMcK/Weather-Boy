#!/usr/bin/env node
/* Verification stills for the Kurhaus 3-floor stack:
     stack-cutaway   — south half + ceilings hidden, showing Floor B / 1 / 2
                       stacked at the same x,z with the Atrium shaft through them
     floorB-topdown  — straight down into Floor B (everything above y=-0.5 culled)
     floor2-topdown  — straight down onto Floor 2's gallery ring + the shaft hole
     atrium-downview — straight down the Atrium shaft from above Floor 2 to Floor 1
   Run:  node tools/shots-stack.js                                            */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var fs = require('fs');
var ROOT = path.resolve(__dirname, '..');
var OUT = path.join(ROOT, 'screenshots', 'kurhaus-stack');
var URL = 'file://' + path.join(ROOT, 'index.html');
var W = 1280, H = 940;

function shootSrc() {
  window.__shoot = function (v) {
    var G = window.G, THREE = window.THREE;
    G.state = 'paused';
    if (G.weapons && G.weapons.vmRoot) G.weapons.vmRoot.visible = false;
    // restore visibility from a previous shot
    if (window.__hidden) window.__hidden.forEach(function (o) { o.visible = true; });
    window.__hidden = [];
    G.scene.traverse(function (o) {
      if (!o.isMesh || !o.position) return;
      var y = o.position.y, z = o.position.z, hide = false;
      if (v.cullAboveY !== undefined && y > v.cullAboveY) hide = true;     // drop ceilings/upper floors
      if (v.cullSouthOf !== undefined && z > v.cullSouthOf) hide = true;   // cutaway: hide the near (south) half
      if (v.cullEastOf !== undefined && o.position.x > v.cullEastOf) hide = true;  // cutaway: hide the near (east) half
      if (hide) { o.visible = false; window.__hidden.push(o); }
    });
    Array.prototype.forEach.call(document.body.children, function (el) { if (el.id !== 'game') el.style.display = 'none'; });
    var cam = G.camera;
    if (v.up) cam.up.set(v.up[0], v.up[1], v.up[2]); else cam.up.set(0, 1, 0);
    cam.fov = v.fov; cam.updateProjectionMatrix();
    cam.position.set(v.pos[0], v.pos[1], v.pos[2]);
    cam.lookAt(v.look[0], v.look[1], v.look[2]);
    G.renderer.render(G.scene, G.camera);
  };
}

(async function () {
  var browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=' + W + ',' + H] });
  try {
    var page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    page.on('pageerror', function (e) { console.log('  [page error] ' + e.message); });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('window.G && G.CFG && G.map && G.player && G.startGame');
    await page.evaluate(shootSrc);
    await page.evaluate(function () { G.startGame('kurhaus'); });
    await page.waitForFunction('G.state === "playing" || G.state === "paused"');
    await page.evaluate(function () { Object.keys(G.map.doors).forEach(function (id) { G.map.openDoor(id); var d = G.map.doors[id]; if (d.mesh) d.mesh.visible = false; if (d.sprite) { G.scene.remove(d.sprite); d.sprite = null; } }); });
    // map centre + extent (shared across floors)
    var info = await page.evaluate(function () {
      var G = window.G, CFG = G.CFG, P = G.map.parsed;
      var g0 = CFG.cellToWorld(0, 0), g1 = CFG.cellToWorld(P.cols - 1, P.rows - 1);
      return { cx: (g0.x + g1.x) / 2, cz: (g0.z + g1.z) / 2, span: Math.hypot(g1.x - g0.x, g1.z - g0.z) };
    });
    var cx = info.cx, cz = info.cz, span = info.span;

    var views = [
      // stacked hero: high angled view, ceilings culled, showing Floor 2's gallery
      // (+4) sitting directly over Floor 1 at the same x,z with the Atrium shaft
      // cut through both (Floor B verified by floorB-topdown + the seam/stair tests)
      { name: 'stack-hero', pos: [cx + span * 0.42, 15, cz - span * 0.42], look: [cx, 1.5, cz + 2],
        fov: 58, cullAboveY: 8.6 },
      // Floor B straight down (cull everything at/above Floor 1)
      { name: 'floorB-topdown', pos: [cx, 26, cz], look: [cx, -4, cz], fov: 58, up: [0, 0, -1], cullAboveY: -0.5 },
      // Floor 2 straight down (cull its ceiling, keep its floor + walls)
      { name: 'floor2-topdown', pos: [cx, 34, cz], look: [cx, 4, cz], fov: 58, up: [0, 0, -1], cullAboveY: 6.6 },
      // Atrium money-shot: straight down the shaft from above Floor 2 to Floor 1
      { name: 'atrium-downview', pos: [cx, 30, cz], look: [cx, 0, cz], fov: 60, up: [0, 0, -1], cullAboveY: 6.6 }
    ];
    fs.mkdirSync(OUT, { recursive: true });
    var canvas = await page.$('#game');
    for (var i = 0; i < views.length; i++) {
      await page.evaluate('window.__shoot(' + JSON.stringify(views[i]) + ')');
      await new Promise(function (r) { setTimeout(r, 80); });
      var file = path.join(OUT, views[i].name + '.png');
      await canvas.screenshot({ path: file });
      console.log('  wrote ' + path.relative(ROOT, file));
    }
    console.log('\nDone. stills in screenshots/kurhaus-stack/');
  } finally { await browser.close(); }
})();
