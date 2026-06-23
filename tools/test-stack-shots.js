#!/usr/bin/env node
/* Visual companion to test-stack.js — builds the SAME _t3 stacked scene in a real
   browser (lower room at 0, upper floor at +4 at the same x,z, joined by a stair,
   with an open-shaft room for the down-view) and writes two stills:
     stacked.png      — angled side view, roofs culled, showing the two floors
                        occupying the same x,z with the stair between them
     shaft-downview.png — straight down, showing the solid upper floor over A and
                        the open shaft (room S) where the lower floor reads below
   Run:  node tools/test-stack-shots.js                                       */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var fs = require('fs');
var ROOT = path.resolve(__dirname, '..');
var OUT = path.join(ROOT, 'screenshots', '_stack');
var URL = 'file://' + path.join(ROOT, 'index.html');
var W = 1280, H = 900;

var TESTMAP = {
  id: '_t3', name: 'STACK TEST', sub: '', wonder: 'thunder', papRule: 'power',
  atmos: { sky: 0x12131a, fog: 0x12131a, density: 0, amb: 0x55607a, ambI: 0.7, hemiSky: 0x9aa6c0, hemiGround: 0x33302a },
  palette: { wallA: 0xb0a890, wallB: 0xa09880, wood: 0xc6ad84, plank: 0xd8c098, metal: 0x8e949c, beam: 0x55585e, rust: 0x86603c, conc: 0x8a857c, deck: 0x6b6f78, ceil: 0x6c727d, accent: 0x5fcfe6, lampTint: 0xeae6dc },
  OUTDOOR: [], OPEN_CEIL: ['S'],
  GRID: ['.AAAAA.', '.AAAAA.', '.AAAAA.', '.AAAAA.', '..111..', '.SSSSS.', '.SSSSS.', '.SSSSS.', '.SSSSS.'],
  ROOMS: { A: { name: 'Upper-stacked', floor: 0x6a4a30, light: 0xd8a060, floorY: 0 }, S: { name: 'Shaft', floor: 0x30506a, light: 0x70b0e0, floorY: 0 } },
  DOORS: { 1: { cost: 0 } }, WINDOWS: [{ cell: [3, 8], dir: 'S' }, { cell: [1, 6], dir: 'W' }],
  RISERS: [], PERK_MACHINES: [], WALLBUYS: [], BOX_SPOTS: [{ cell: [3, 6], off: [0, 0] }], TELEPORTERS: [], MAINFRAME: null,
  PAP: { cell: [3, 6], off: [0, 0] }, POWER: { cell: [3, 7], off: [0, 0] }, PLAYER_SPAWN: { cell: [3, 7], off: [0, 0] },
  RELIC_SPOTS: [], EE_SOULBOX: null, SHIELD_PARTS: {}, SHIELD_BENCH: null
};

// browser-side: build the upper floor + stair as VISIBLE meshes (+ the data
// surfaces/colliders), mirroring test-stack.js buildStack
function buildStackSrc() {
  window.__buildStack = function () {
    var G = window.G, THREE = window.THREE, map = G.map, CFG = G.CFG, CELL = CFG.CELL;
    var cs = map.parsed.rooms.A.cells, mc = 99, Mc = -99, mr = 99, Mr = -99;
    cs.forEach(function (cr) { if (cr[0] < mc) mc = cr[0]; if (cr[0] > Mc) Mc = cr[0]; if (cr[1] < mr) mr = cr[1]; if (cr[1] > Mr) Mr = cr[1]; });
    var a = CFG.cellToWorld(mc, mr), b = CFG.cellToWorld(Mc, Mr);
    var A = { x1: a.x - CELL / 2, x2: b.x + CELL / 2, z1: a.z - CELL / 2, z2: b.z + CELL / 2, cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2 };
    var UY = 4, sx1 = A.cx - 4, sx2 = A.cx + 4, zTop = A.z2, zBase = A.z2 + 8, n = 10;
    var deck = new THREE.MeshLambertMaterial({ color: 0x9a8a64 });
    var wallM = new THREE.MeshLambertMaterial({ color: 0x8c8470 });
    function box(w, h, d, x, y, z, m) { var me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); G.scene.add(me); return me; }
    // upper floor: visible slab + walkable surface
    box(A.x2 - A.x1, 0.3, A.z2 - A.z1, A.cx, UY - 0.15, A.cz, deck);
    map.addSurface({ x1: A.x1, x2: A.x2, z1: A.z1, z2: A.z2, y: UY, floor: true });
    // cap lower ceiling/lintels (seal below, clear above); drop them over the flight
    map.colliders.forEach(function (c) {
      if (!(c.y1 > 3.4 && c.y1 < 4.6)) return;
      var cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2;
      var inFlight = cx > sx1 - 0.1 && cx < sx2 + 0.1 && cz > A.z2 - 4.1 && cz < zBase + 0.1;
      if (inFlight) c.on = false; else { c.y1 = UY - 1.0; c.y2 = UY; }
    });
    // cap lower walls to a finite band [0,4] (what floorAbove() does for real)
    map.colliders.forEach(function (c) {
      if (c.y1 < 0.1 && c.y2 > 50 && (c.x1 + c.x2) / 2 > A.x1 - 0.6 && (c.x1 + c.x2) / 2 < A.x2 + 0.6 && (c.z1 + c.z2) / 2 > A.z1 - 0.6 && (c.z1 + c.z2) / 2 < A.z2 + 0.6) c.y2 = UY;
    });
    // upper perimeter walls [4,8] (visible), south left open for the stair
    var T = 0.35;
    box(A.x2 - A.x1 + T, 4, T, A.cx, UY + 2, A.z1, wallM); map.addCollider(A.x1 - T, A.z1 - T, A.x2 + T, A.z1, UY, UY + 4);
    box(T, 4, A.z2 - A.z1, A.x1, UY + 2, A.cz, wallM); map.addCollider(A.x1 - T, A.z1, A.x1, A.z2, UY, UY + 4);
    box(T, 4, A.z2 - A.z1, A.x2, UY + 2, A.cz, wallM); map.addCollider(A.x2, A.z1, A.x2 + T, A.z2, UY, UY + 4);
    // stair: visible treads + ramp surface + solid fill
    map.addSurface({ x1: sx1, x2: sx2, z1: zTop, z2: zBase, ramp: true, axis: 'z', c1: zTop, c2: zBase, h1: UY, h2: 0 });
    var run = (zBase - zTop) / n;
    for (var i = 1; i <= n; i++) {
      var zA = zTop + (i - 1) * run, zN = zTop + i * run, noseH = UY * (n - i) / n;
      if (noseH > 0.05) map.addCollider(sx1, zA, sx2, zN, 0, noseH);
      box(sx2 - sx1, 0.14, run + 0.05, (sx1 + sx2) / 2, noseH + 0.07, zN - run / 2, deck);
    }
    return { cx: A.cx, cz: A.cz, z1: A.z1, z2: A.z2, sx: (sx1 + sx2) / 2, zBase: zBase };
  };
}

function shootSrc() {
  window.__shoot = function (v) {
    var G = window.G, THREE = window.THREE;
    G.state = 'paused';
    if (G.weapons && G.weapons.vmRoot) G.weapons.vmRoot.visible = false;
    if (!window.__roofs) {
      window.__roofs = [];
      G.scene.traverse(function (o) {
        if (!o.isMesh || !o.position) return;
        var ceilPlane = o.geometry && o.geometry.type === 'PlaneGeometry' && o.material && o.material.side === THREE.DoubleSide && o.position.y > 3.5;
        if ((ceilPlane || o.position.y > 4.5) && o.position.y < 7) window.__roofs.push(o);  // cull ceilings, keep the upper deck/walls
      });
    }
    window.__roofs.forEach(function (o) { o.visible = false; });
    Array.prototype.forEach.call(document.body.children, function (el) { if (el.id !== 'game') el.style.display = 'none'; });
    if (v.up) G.camera.up.set(v.up[0], v.up[1], v.up[2]); else G.camera.up.set(0, 1, 0);
    G.camera.fov = v.fov; G.camera.updateProjectionMatrix();
    G.camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
    G.camera.lookAt(v.look[0], v.look[1], v.look[2]);
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
    await page.evaluate(function (m) { G.CFG.MAPS._t3 = m; }, TESTMAP);
    await page.evaluate(buildStackSrc);
    await page.evaluate(shootSrc);
    await page.evaluate(function () { G.startGame('_t3'); });
    await page.waitForFunction('G.state === "playing" || G.state === "paused"');
    await page.evaluate(function () { Object.keys(G.map.doors).forEach(function (id) { G.map.openDoor(id); var d = G.map.doors[id]; if (d.mesh) d.mesh.visible = false; if (d.sprite) { G.scene.remove(d.sprite); d.sprite = null; } }); });
    var geo = await page.evaluate('window.__buildStack()');

    var views = [
      { name: 'stacked', pos: [geo.cx + 22, 11, geo.zBase + 16], look: [geo.cx, 2.5, geo.cz], fov: 55 },
      { name: 'shaft-downview', pos: [geo.cx, 30, geo.cz + 6], look: [geo.cx, 0, geo.cz + 4], fov: 60, up: [0, 0, -1] }
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
    console.log('\nDone. stills in screenshots/_stack/');
  } finally { await browser.close(); }
})();
