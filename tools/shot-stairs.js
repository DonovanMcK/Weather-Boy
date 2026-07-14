#!/usr/bin/env node
/* STAIR AUDIT SHOTS — each stage: entrance (base, looking up), side flank,
   underside area, and upper landing looking down. Player-height camera.
   Run: node tools/shot-stairs.js <mapId> */
'use strict';
var puppeteer = require('puppeteer'), path = require('path');
var MAP = process.argv[2] || 'derriese';
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');
(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 900, height: 560 } });
  var p = await b.newPage();
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction('window.G && G.startGame');
  await p.evaluate(function (m) { G.startGame(m); }, MAP);
  await p.waitForFunction('G.state==="playing"');
  var stages = await p.evaluate(function () {
    G.zombies.list.length = 0; G.zombies.toSpawn = 0; G.zombies.mode = 'break'; G.zombies.breakTimer = 1e9;
    var hud = document.getElementById('hud'); if (hud) hud.style.display = 'none';
    return (G.map.stages || []).map(function (s, i) {
      return { i: i, dc: { x: s.deckCenter.x, y: s.deckCenter.y || 4, z: s.deckCenter.z },
               sb: { x: s.stairBase.x, y: 0, z: s.stairBase.z } };
    });
  });
  async function shot(name, px, py, pz, tx, ty, tz) {
    await p.evaluate(function (a) {
      var P = G.player;
      P.pos.set(a[0], a[1], a[2]); P.vel.set(0, 0, 0);
      P.yaw = Math.atan2(-(a[3] - a[0]), -(a[5] - a[2]));
      var dh = Math.hypot(a[3] - a[0], a[5] - a[2]);
      P.pitch = Math.atan2(a[4] - (a[1] + 1.5), dh);
      P.update(1 / 60); G.map.update(1 / 60);
    }, [px, py, pz, tx, ty, tz]);
    await new Promise(function (r) { setTimeout(r, 100); });
    await p.screenshot({ path: 'screenshots/stairs/' + MAP + '-s' + name + '.png' });
  }
  for (var i = 0; i < stages.length; i++) {
    var s = stages[i];
    var dirx = s.dc.x - s.sb.x, dirz = s.dc.z - s.sb.z;   // base -> landing direction
    var dl = Math.hypot(dirx, dirz) || 1; dirx /= dl; dirz /= dl;
    var mid = { x: (s.dc.x + s.sb.x) / 2, z: (s.dc.z + s.sb.z) / 2 };
    // entrance: 3m outside the base looking up the flight
    await shot(i + '-entrance', s.sb.x - dirx * 3, 0.2, s.sb.z - dirz * 3, s.dc.x, s.dc.y, s.dc.z);
    // side: 4.5m perpendicular from the run midpoint
    await shot(i + '-side', mid.x + dirz * 4.5, 0.2, mid.z - dirx * 4.5, mid.x, 2, mid.z);
    await shot(i + '-side2', mid.x - dirz * 4.5, 0.2, mid.z + dirx * 4.5, mid.x, 2, mid.z);
    // landing: on the deck looking back down
    await shot(i + '-landing', s.dc.x + dirx * 1.2, s.dc.y + 0.2, s.dc.z + dirz * 1.2, s.sb.x, 0, s.sb.z);
  }
  await b.close();
  console.log('shot ' + stages.length + ' stages x4 views');
})();
