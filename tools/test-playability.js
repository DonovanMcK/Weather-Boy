#!/usr/bin/env node
/* The verification I should have written the first time. Tests the things the
   PLAYER actually hits — none of which the nav/render tests covered:
     A. Door-flank wall colliders on every floor (missing walls / walk-around doors)
     B. The player physically cannot walk around a closed door (real collide())
     C. Explosives detonate on contact with zombies on Floor B (-4) and Floor 2 (+4)
   Run: node tools/test-playability.js */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');

(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  var fail = 0;
  function ck(cond, msg, extra) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg + (extra ? '   ' + extra : '')); if (!cond) fail++; }
  try {
    var p = await b.newPage();
    p.on('pageerror', function (e) { console.log('  PAGE ERROR: ' + e.message); fail++; });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForFunction('window.G && G.startGame');
    await p.evaluate(function () { G.startGame('kurhaus'); });
    await p.waitForFunction('G.state==="playing"');

    // ---- A. door-flank collider coverage, per floor ----
    console.log('A. DOOR-FLANK WALL COLLIDERS (missing walls / walk-around doors)');
    var aRes = await p.evaluate(function () {
      var G = window.G, CFG = G.CFG, CELL = CFG.CELL, OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      function colAt(x, z, y) {
        return G.map.colliders.some(function (c) {
          return c.on && x >= c.x1 - 0.01 && x <= c.x2 + 0.01 && z >= c.z1 - 0.01 && z <= c.z2 + 0.01 && y >= c.y1 - 0.01 && y <= c.y2 + 0.01;
        });
      }
      var out = [];
      G.map.floors.forEach(function (f) {
        var doors = f.parsed.doors || {}, fy = f.floorY;
        Object.keys(doors).forEach(function (did) {
          var cr = doors[did].cells[0], c = cr[0], r = cr[1];
          var wc = CFG.cellToWorld(c, r);
          ['N', 'S', 'E', 'W'].forEach(function (dir) {
            var o = OFF[dir], row = f.parsed.cells[r + o[1]], n = (row && row[c + o[0]]) || { type: 'void' };
            if (n.type !== 'void') return;  // only the flank (void) sides need a wall
            var ex = wc.x + o[0] * CELL / 2, ez = wc.z + o[1] * CELL / 2;
            out.push({ floor: fy, door: did, dir: dir, ok: colAt(ex, ez, fy + 1) });
          });
        });
      });
      return out;
    });
    var byFloor = {};
    aRes.forEach(function (x) { (byFloor[x.floor] = byFloor[x.floor] || []).push(x); });
    Object.keys(byFloor).sort().forEach(function (fy) {
      var arr = byFloor[fy], bad = arr.filter(function (x) { return !x.ok; });
      ck(bad.length === 0, 'floor y=' + fy + ': all ' + arr.length + ' door-flank edges have a wall collider',
         bad.length ? 'MISSING: ' + bad.map(function (x) { return x.door + '/' + x.dir; }).join(', ') : '');
    });

    // ---- B. a standing body is blocked at every door flank (bodyBlocked) ----
    console.log('B. A BODY IS BLOCKED AT EVERY DOOR FLANK (bodyBlocked())');
    var bBlock = await p.evaluate(function () {
      var G = window.G, CFG = G.CFG, CELL = CFG.CELL, OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      var out = [];
      G.map.floors.forEach(function (f) {
        var doors = f.parsed.doors || {}, fy = f.floorY;
        Object.keys(doors).forEach(function (did) {
          var cr = doors[did].cells[0], c = cr[0], r = cr[1], wc = CFG.cellToWorld(c, r);
          ['N', 'S', 'E', 'W'].forEach(function (dir) {
            var o = OFF[dir], row = f.parsed.cells[r + o[1]], n = (row && row[c + o[0]]) || { type: 'void' };
            if (n.type !== 'void') return;
            // a body straddling the door->flank edge must be blocked
            var ex = wc.x + o[0] * (CELL / 2), ez = wc.z + o[1] * (CELL / 2);
            out.push({ floor: fy, door: did, dir: dir, blocked: G.map.bodyBlocked(ex, ez, fy) });
          });
        });
      });
      return out;
    });
    var bf2 = {};
    bBlock.forEach(function (x) { (bf2[x.floor] = bf2[x.floor] || []).push(x); });
    Object.keys(bf2).sort().forEach(function (fy) {
      var arr = bf2[fy], bad = arr.filter(function (x) { return !x.blocked; });
      ck(bad.length === 0, 'floor y=' + fy + ': a body is blocked at all ' + arr.length + ' door flanks',
         bad.length ? 'NOT BLOCKED: ' + bad.map(function (x) { return x.door + '/' + x.dir; }).join(', ') : '');
    });

    // ---- C. explosives detonate on zombies on every floor ----
    console.log('C. EXPLOSIVES HIT ZOMBIES ON FLOOR B (-4) AND FLOOR 2 (+4)');
    for (var floorY of [0, -4, 4]) {
      var rc = await p.evaluate(function (fy) {
        var G = window.G;
        // a clear room centre on the target floor
        var fl = G.map.floors.filter(function (f) { return Math.abs(f.floorY - fy) < 0.5; })[0];
        var rid = Object.keys(fl.parsed.rooms)[0];
        var ctr = fl.parsed.rooms[rid].center;
        // fake zombie with huge hp so it survives (no killZombie side-effects)
        var zpos = new THREE.Vector3(ctr.x, fy, ctr.z);
        var z = { dead: false, hp: 100000, hpMax: 100000, mesh: { position: zpos }, state: 'chase' };
        G.zombies.list.length = 0; G.zombies.list.push(z);
        // a rocket fired horizontally from 4m away, straight at the zombie's chest
        var start = new THREE.Vector3(ctr.x - 4, fy + 1.2, ctr.z);
        var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
        mesh.position.copy(start); G.scene.add(mesh);
        G.weapons.projectiles.length = 0;
        G.weapons.projectiles.push({ type: 'rocket', mesh: mesh, vel: new THREE.Vector3(26, 0, 0), t: 0,
          opts: { dmg: 500, radius: 4, gravity: 0, fuse: 4, color: 0xffaa33 } });
        var hp0 = z.hp;
        for (var i = 0; i < 40 && G.weapons.projectiles.length; i++) G.weapons.update(0.016);
        return { detonated: G.weapons.projectiles.length === 0, dmg: hp0 - z.hp, projY: mesh.position.y };
      }, floorY);
      ck(rc.detonated && rc.dmg > 0, 'floor y=' + floorY + ': rocket detonated on the zombie and dealt damage',
         'dmg=' + Math.round(rc.dmg) + ' detonated=' + rc.detonated);
    }
  } finally { await b.close(); }
  console.log(fail ? '\nPLAYABILITY TEST FAILED (' + fail + ')' : '\nPLAYABILITY TEST PASSED');
  process.exit(fail ? 1 : 0);
})();
