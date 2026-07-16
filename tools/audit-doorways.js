#!/usr/bin/env node
/* DOORWAY CLEARANCE AUDIT — machines and solid props must not crowd door
   openings. For every door on every map: interactables within 2.6m (their
   prompt zone fights the door prompt / body blocks the frame) and prop
   colliders (h < wall height) intersecting the 2.2m approach circle. */
'use strict';
var puppeteer = require('puppeteer'), path = require('path');
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');
var ONLY = process.argv[2] || null;
(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  var bad = 0;
  try {
    var maps = ['kurhaus', 'nacht', 'derriese', 'wetterjunge'];
    if (ONLY) maps = maps.filter(function (id) { return id === ONLY; });
    for (var mi = 0; mi < maps.length; mi++) {
      var mapId = maps[mi];
      var p = await b.newPage();
      await p.goto(URL, { waitUntil: 'load' });
      await p.waitForFunction('window.G && G.startGame');
      await p.evaluate(function (m) { G.startGame(m); }, mapId);
      await p.waitForFunction('G.state==="playing"');
      var rep = await p.evaluate(function () {
        var out = [], map = G.map, I = G.interact;
        Object.keys(map.doors).forEach(function (id) {
          var d = map.doors[id];
          I.list.forEach(function (it) {
            if (it.door === id || (it.pos.x === d.pos.x && it.pos.z === d.pos.z)) return;
            var dd = Math.hypot(it.pos.x - d.pos.x, it.pos.z - d.pos.z);
            if (dd < 2.6) {
              var pr = it.prompt && it.prompt();
              out.push({ door: id, kind: 'interactable', d: +dd.toFixed(2), what: pr || '(stage-gated)', x: +it.pos.x.toFixed(1), z: +it.pos.z.toFixed(1) });
            }
          });
          (map.colliders || []).forEach(function (c) {
            var dy = d.pos.y || 0;
            if ((c.y2 || 4) - dy >= 3.9) return;                // full-height = wall/frame
            if ((c.y2 || 4) < dy + 0.3 || (c.y1 || 0) > dy + 2.4) return;  // different storey
            var cx = Math.max(c.x1, Math.min(d.pos.x, c.x2));
            var cz = Math.max(c.z1, Math.min(d.pos.z, c.z2));
            var dd = Math.hypot(cx - d.pos.x, cz - d.pos.z);
            if (dd < 2.2) out.push({ door: id, kind: 'prop-collider', d: +dd.toFixed(2), what: 'solid ' + (c.x2 - c.x1).toFixed(1) + 'x' + (c.z2 - c.z1).toFixed(1) + ' h' + (c.y2 || 0).toFixed(1), x: +((c.x1 + c.x2) / 2).toFixed(1), z: +((c.z1 + c.z2) / 2).toFixed(1) });
          });
        });
        return out;
      });
      console.log('== ' + mapId + ': ' + (rep.length ? rep.length + ' offender(s)' : 'clean'));
      rep.forEach(function (o) { console.log('   door ' + o.door + ' <- ' + o.kind + ' ' + o.d + 'm  [' + o.what + '] @(' + o.x + ',' + o.z + ')'); bad++; });
      await p.close();
    }
  } finally { await b.close(); }
  console.log(bad ? '\n*** ' + bad + ' DOORWAY OFFENDER(S) ***' : '\nDOORWAYS CLEAN');
  process.exit(bad ? 1 : 0);
})();
