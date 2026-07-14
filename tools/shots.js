#!/usr/bin/env node
/* ===========================================================================
   TOTENSTURM — headless screenshot system
   Loads every map in a real (headless) browser with SwiftShader WebGL, derives
   camera viewpoints PURELY from each map's geometry (spawn point, room bounds,
   outdoor yard, staircases — read live from G.map, so new rooms are picked up
   automatically), freezes the world, and writes a PNG per viewpoint to
   screenshots/<map>/<viewpoint>.png.

   Run:  npm run shots
   =========================================================================== */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var fs = require('fs');

var ROOT = path.resolve(__dirname, '..');
var OUT = path.join(ROOT, 'screenshots');
var URL = 'file://' + path.join(ROOT, 'index.html');
var W = 1280, H = 800;
var ONLY = process.argv[2] || null;
var ONLY_VIEW = process.argv[3] || null;

// derived IN the page (has access to the live game globals). Returns an array of
// { name, pos:[x,y,z], look:[x,y,z], fov } computed from map geometry only.
function deriveViewpointsSrc() {
  window.__viewpoints = function () {
    var G = window.G, CFG = G.CFG, CELL = CFG.CELL, P = G.map.parsed;
    var vps = [];
    function bounds(room) {
      var minc = 1e9, maxc = -1e9, minr = 1e9, maxr = -1e9;
      room.cells.forEach(function (c) {
        if (c[0] < minc) minc = c[0]; if (c[0] > maxc) maxc = c[0];
        if (c[1] < minr) minr = c[1]; if (c[1] > maxr) maxr = c[1];
      });
      var a = CFG.cellToWorld(minc, minr), b = CFG.cellToWorld(maxc, maxr);
      return { x0: a.x - CELL / 2, x1: b.x + CELL / 2, z0: a.z - CELL / 2, z1: b.z + CELL / 2,
               cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2 };
    }
    // SPAWN — player-eye view from the spawn coordinate toward the room centre
    var sp = G.player.pos, sroom = G.map.roomAt(sp.x, sp.z);
    var sc = (sroom && P.rooms[sroom]) ? P.rooms[sroom].center : sp;
    vps.push({ name: 'spawn', pos: [sp.x, sp.y + 1.6, sp.z], look: [sc.x, sp.y + 1.45, sc.z], fov: 75 });

    // OVERVIEW — a steep angled top-down of the WHOLE map with ceilings hidden,
    // to read layout, room shapes, prop distribution and doorways at a glance
    var g0 = CFG.cellToWorld(0, 0), g1 = CFG.cellToWorld(P.cols - 1, P.rows - 1);
    var gcx = (g0.x + g1.x) / 2, gcz = (g0.z + g1.z) / 2, gdiag = Math.hypot(g1.x - g0.x, g1.z - g0.z);
    vps.push({ name: 'overview', pos: [gcx, gdiag * 0.92, gcz + gdiag * 0.34], look: [gcx, 0, gcz], fov: 60, hideCeil: true });

    var outdoor = CFG.cur.OUTDOOR || [];
    Object.keys(P.rooms).forEach(function (rid) {
      var bb = bounds(P.rooms[rid]);
      var diag = Math.hypot(bb.x1 - bb.x0, bb.z1 - bb.z0);
      var dist = diag * 0.62, h = Math.max(5.0, diag * 0.5);
      if (outdoor.indexOf(rid) >= 0) {
        // YARD — a 4-angle orbit (tighter/lower than a room so prop placement +
        // scale are judgeable), looking down at the yard centre
        var yd = diag * 0.42, yh = Math.max(6, diag * 0.34);
        for (var k = 0; k < 4; k++) {
          var ang = Math.PI / 4 + k * Math.PI / 2;
          vps.push({ name: 'yard-' + (k + 1),
                     pos: [bb.cx + Math.cos(ang) * yd, yh, bb.cz + Math.sin(ang) * yd],
                     look: [bb.cx, 1.0, bb.cz], fov: 72 });
        }
      } else {
        // ROOM — an INTERIOR shot looking down the room's long axis from one end
        // (camera under the 4m ceiling), so walls, far wall and props all read
        var w = bb.x1 - bb.x0, d = bb.z1 - bb.z0;
        var pos = (w >= d) ? [bb.x0 + 1.0, 2.3, bb.cz] : [bb.cx, 2.3, bb.z0 + 1.0];
        var look = (w >= d) ? [bb.x1, 1.2, bb.cz] : [bb.cx, 1.2, bb.z1];
        vps.push({ name: 'room-' + rid, pos: pos, look: look, fov: 82 });
      }
    });
    // UPPER ROOMS — inspect every authored second-floor zone from inside.  These
    // are separate parsed grids, so they are not present in P.rooms above.
    (G.map.floors || []).forEach(function (floor, fi) {
      if (!floor || !floor.parsed || !floor.floorY) return;
      Object.keys(floor.parsed.rooms).forEach(function (rid) {
        var bb = bounds(floor.parsed.rooms[rid]);
        var w = bb.x1 - bb.x0, d = bb.z1 - bb.z0, y = floor.floorY;
        var pos = (w >= d) ? [bb.x0 + 1.0, y + 2.3, bb.cz] : [bb.cx, y + 2.3, bb.z0 + 1.0];
        var look = (w >= d) ? [bb.x1, y + 1.2, bb.cz] : [bb.cx, y + 1.2, bb.z1];
        vps.push({ name: 'upper-' + (fi + 1) + '-' + rid, pos: pos, look: look, fov: 82 });
      });
    });
    // STAIRCASES — a side 3/4 of the flight (perpendicular to the stair axis) so
    // the steps and the funnel read; pick whichever perpendicular side sits in an
    // actual room (not buried in a perimeter wall)
    (G.map.stages || []).forEach(function (s, i) {
      if (!s.stairBase) return;
      var base = s.stairBase, deck = s.deckCenter;
      var dx = deck.x - base.x, dz = deck.z - base.z, L = Math.hypot(dx, dz) || 1;
      var ux = dx / L, uz = dz / L, px = -uz, pz = ux;     // unit + perpendicular
      var mx = (base.x + deck.x) / 2, mz = (base.z + deck.z) / 2, my = (base.y + deck.y) / 2;
      // eye level on whichever perpendicular side keeps the camera in open room
      // and FURTHEST from the perimeter (maps are centred on the origin, so the
      // side closer to (0,0) is the interior one) — avoids burying the cam in a
      // wall or the upper structure. Backed off the foot, looking up the flight.
      var off = 7.5;   // clear the new full-width flights instead of filming from inside their tread span
      function camFor(sg) { return [mx + sg * px * off - ux * 2.0, 1.9, mz + sg * pz * off - uz * 2.0]; }
      var cP = camFor(1), cM = camFor(-1);
      var okP = G.map.roomAt(cP[0], cP[2]), okM = G.map.roomAt(cM[0], cM[2]);
      var pos;
      if (okP && (!okM || Math.hypot(cP[0], cP[2]) <= Math.hypot(cM[0], cM[2]))) pos = cP; else pos = cM;
      vps.push({ name: 'stairs-' + (i + 1), pos: pos, look: [deck.x, deck.y + 0.4, deck.z], fov: 78 });
    });
    // DOORWAYS — eye level a few metres to one side of each threshold, looking
    // straight through it, so anything crowding/blocking a door is obvious
    Object.keys(G.map.doors).forEach(function (did) {
      var dp = G.map.doors[did].pos, cell = CFG.worldToCell(dp.x, dp.z);
      function room(dc, dr) { var c = G.map.cellAt(dc, dr); return c && c.type === 'room'; }
      // passage axis = the axis whose opposite neighbours are rooms
      var ax = (room(cell.col, cell.row - 1) || room(cell.col, cell.row + 1)) ? 0 : 1;
      var az = ax ? 0 : 1;
      vps.push({ name: 'door-' + did, pos: [dp.x - ax * 4.0, 1.7, dp.z - az * 4.0],
                 look: [dp.x + ax * 3, 1.55, dp.z + az * 3], fov: 78 });
    });
    return vps;
  };
}

function shoot() {
  window.__shoot = function (v) {
    var G = window.G;
    G.state = 'paused';                       // freeze world + player camera control
    if (G.weapons && G.weapons.vmRoot) G.weapons.vmRoot.visible = false;   // hide the gun
    G.camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
    G.camera.fov = v.fov; G.camera.updateProjectionMatrix();
    G.camera.lookAt(v.look[0], v.look[1], v.look[2]);
    // hide every DOM overlay (HUD/menus) so the PNG is just the rendered world
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el.id !== 'game') el.style.display = 'none';
    });
    // ceilings/roofs occlude a top-down overview — toggle them off for those shots
    if (!window.__roofs) {
      window.__roofs = [];
      G.scene.traverse(function (o) {
        if (!o.isMesh || !o.position) return;
        var ceilPlane = o.geometry && o.geometry.type === 'PlaneGeometry' && o.material && o.material.side === THREE.DoubleSide && o.position.y > 3.5;
        if (ceilPlane || o.position.y > 4.5) window.__roofs.push(o);
      });
    }
    window.__roofs.forEach(function (o) { o.visible = !v.hideCeil; });
    G.renderer.render(G.scene, G.camera);
  };
}

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

    // discover the map list from the game config
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('window.G && G.CFG && G.CFG.MAP_IDS && G.map && G.player');
    var maps = await page.evaluate('G.CFG.MAP_IDS.slice()');
    if (ONLY) maps = maps.filter(function (m) { return m === ONLY; });
    console.log('Maps discovered: ' + maps.join(', '));

    var plan = {};
    for (var mi = 0; mi < maps.length; mi++) {
      var map = maps[mi];
      // fresh page per map (startGame only runs once per load)
      await page.goto(URL, { waitUntil: 'load' });
      await page.waitForFunction('window.G && G.CFG && G.map && G.player && G.startGame');
      await page.evaluate(deriveViewpointsSrc);
      await page.evaluate(shoot);
      await page.evaluate(function (m) { G.startGame(m); }, map);
      await page.waitForFunction('G.state === "playing" || G.state === "paused"');
      var vps = await page.evaluate('window.__viewpoints()');
      plan[map] = vps.map(function (v) { return v.name; });
    }

    // self-documenting: print the full discovered plan before capturing
    console.log('\nViewpoints discovered per map:');
    maps.forEach(function (m) { console.log('  ' + m + ' (' + plan[m].length + '): ' + plan[m].join(', ')); });
    console.log('');

    // capture
    for (var ci = 0; ci < maps.length; ci++) {
      var mapId = maps[ci];
      var dir = path.join(OUT, mapId);
      fs.mkdirSync(dir, { recursive: true });
      await page.goto(URL, { waitUntil: 'load' });
      await page.waitForFunction('window.G && G.CFG && G.map && G.player && G.startGame');
      await page.evaluate(deriveViewpointsSrc);
      await page.evaluate(shoot);
      await page.evaluate(function (m) { G.startGame(m); }, mapId);
      await page.waitForFunction('G.state === "playing" || G.state === "paused"');
      // open every door (and hide the debris panel) so thresholds read clean and
      // any asset crowding a doorway is visible
      await page.evaluate(function () {
        Object.keys(G.map.doors).forEach(function (id) {
          G.map.openDoor(id);
          var d = G.map.doors[id];
          if (d.mesh) d.mesh.visible = false;
          if (d.sprite) { G.scene.remove(d.sprite); d.sprite = null; }
        });
      });
      var views = await page.evaluate('window.__viewpoints()');
      if (ONLY_VIEW) views = views.filter(function (v) { return v.name === ONLY_VIEW; });
      var canvas = await page.$('#game');
      for (var vi = 0; vi < views.length; vi++) {
        var v = views[vi];
        await page.evaluate('window.__shoot(' + JSON.stringify(v) + ')');
        await new Promise(function (r) { setTimeout(r, 60); });
        var file = path.join(dir, v.name + '.png');
        await canvas.screenshot({ path: file });
        console.log('  wrote ' + path.relative(ROOT, file));
      }
    }
    console.log('\nDone. PNGs in screenshots/<map>/<viewpoint>.png');
  } finally {
    await browser.close();
  }
})();
