#!/usr/bin/env node
/* DOOR AUDIT SHOTS — every door, both sides, closed (+ optionally open):
   camera at player height 3.2m back from the door centre on each axis side.
   Run: node tools/shot-doors.js <mapId> [open] */
'use strict';
var puppeteer = require('puppeteer'), path = require('path');
var MAP = process.argv[2] || 'derriese', OPEN = process.argv[3] === 'open';
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');
(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], defaultViewport: { width: 900, height: 560 } });
  var p = await b.newPage();
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction('window.G && G.startGame');
  await p.evaluate(function (m) { G.startGame(m); }, MAP);
  await p.waitForFunction('G.state==="playing"');
  var doors = await p.evaluate(function (open) {
    G.zombies.list.length = 0; G.zombies.toSpawn = 0; G.zombies.mode = 'break'; G.zombies.breakTimer = 1e9;
    document.getElementById('hud') && (document.getElementById('hud').style.display = 'none');
    if (open) Object.keys(G.map.doors).forEach(function (id) { try { G.map.openDoor(id); } catch (e) {} });
    return Object.keys(G.map.doors).map(function (id) {
      var d = G.map.doors[id];
      // door slab orientation: wide on x => faces N/S; wide on z => faces E/W
      var alongZ = d.mesh && d.mesh.geometry && d.mesh.geometry.parameters &&
                   d.mesh.geometry.parameters.width > d.mesh.geometry.parameters.depth;
      return { id: id, x: d.pos.x, y: d.pos.y || 0, z: d.pos.z, alongZ: alongZ };
    });
  }, OPEN);
  for (var i = 0; i < doors.length; i++) {
    var d = doors[i];
    var sides = d.alongZ ? [[0, -3.2, 'N'], [0, 3.2, 'S']] : [[-3.2, 0, 'W'], [3.2, 0, 'E']];
    for (var s = 0; s < 2; s++) {
      await p.evaluate(function (d, off) {
        var P = G.player;
        P.pos.set(d.x + off[0], (d.y || 0) + 0.2, d.z + off[1]); P.vel.set(0, 0, 0);
        P.yaw = Math.atan2(-(d.x - P.pos.x), -(d.z - P.pos.z)); P.pitch = -0.05;
        P.update(1 / 60); G.map.update(1 / 60);
      }, d, sides[s]);
      await new Promise(function (r) { setTimeout(r, 120); });
      await p.screenshot({ path: 'screenshots/doors/' + MAP + '-d' + d.id + '-' + sides[s][2] + (OPEN ? '-open' : '') + '.png' });
    }
  }
  await b.close();
  console.log('shot ' + doors.length + ' doors (' + (OPEN ? 'open' : 'closed') + ')');
})();
