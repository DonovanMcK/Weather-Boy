#!/usr/bin/env node
/* FINISHING AUDIT — the checks that close out the polish pass:
   A. interactable OVERLAP pairs (two prompts fighting for the same ground)
   B. post-quest movement: build the effigy + spawn the chest, then re-run the
      training circle in every room (mid-game colliders must not jam lanes)
   C. perf snapshot: draw calls / triangles / lights vs the legacy maps
   D. dump every live prompt string (copy review)
   E. the points economy curve vs the total sink
   Run: node tools/audit-final.js */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');

(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  var issues = [];
  try {
    // ---- perf snapshot across maps ----
    console.log('C. PERF SNAPSHOT (draw calls / triangles / point lights)');
    for (var mi = 0; mi < 4; mi++) {
      var mapId = ['kurhaus', 'nacht', 'derriese', 'wetterjunge'][mi];
      var pg = await b.newPage();
      await pg.goto(URL, { waitUntil: 'load' });
      await pg.waitForFunction('window.G && G.startGame');
      await pg.evaluate(function (m) { G.startGame(m); }, mapId);
      await pg.waitForFunction('G.state==="playing"');
      var perf = await pg.evaluate(function () {
        G.renderer.render(G.scene, G.camera);
        var lights = 0, meshes = 0;
        G.scene.traverse(function (o) { if (o.isLight) lights++; if (o.isMesh) meshes++; });
        return { calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles, lights: lights, meshes: meshes };
      });
      console.log('   ' + mapId + ': ' + perf.calls + ' calls, ' + (perf.tris / 1000).toFixed(0) + 'k tris, ' + perf.lights + ' lights, ' + perf.meshes + ' meshes');
      // wetterjunge (42 lights) is the proven-playable benchmark; kurhaus is a
      // larger map, so parity-plus-margin is the bar
      if (mapId === 'kurhaus' && perf.lights > 50) issues.push('kurhaus light count high: ' + perf.lights);
      await pg.close();
    }

    var p = await b.newPage();
    p.on('pageerror', function (e) { issues.push('PAGE ERROR: ' + e.message); });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForFunction('window.G && G.startGame');
    await p.evaluate(function () { G.startGame('kurhaus'); });
    await p.waitForFunction('G.state==="playing"');

    var rep = await p.evaluate(function () {
      var G = window.G, CFG = G.CFG, I = G.interact, out = { overlaps: [], prompts: [], circles: [] };
      G.zombies.list.length = 0; G.zombies.toSpawn = 0; G.zombies.mode = 'break'; G.zombies.breakTimer = 1e9;
      // ---- A. overlap pairs: two interactables whose zones overlap enough that
      // a player standing between them gets prompt flicker / the wrong item
      for (var i = 0; i < I.list.length; i++) {
        for (var j = i + 1; j < I.list.length; j++) {
          var a = I.list[i], c = I.list[j];
          var d = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z);
          if (d < Math.min(a.r, c.r) * 0.9) {
            var pa = a.prompt ? a.prompt() : null, pc = c.prompt ? c.prompt() : null;
            out.overlaps.push({ d: +d.toFixed(2), a: pa, b: pc, x: +a.pos.x.toFixed(0), z: +a.pos.z.toFixed(0) });
          }
        }
      }
      // ---- D. every prompt string live right now (power off, quest stage 0)
      I.list.forEach(function (it) { var pr = it.prompt && it.prompt(); if (pr) out.prompts.push(pr); });
      // power on + advance the world, re-dump new prompts
      G.map.setPower(); if (G.map.pap && !G.map.pap.unlocked) G.map.pap.unlock();
      I.list.forEach(function (it) { var pr = it.prompt && it.prompt(); if (pr && out.prompts.indexOf(pr) < 0) out.prompts.push(pr); });
      // ---- B. build the effigy + spawn the chest, then walk circles
      // fast-forward the quest state machinery directly (systems already
      // verified individually by buy-flow; here we only want the COLLIDERS)
      var rms = G.map.parsed.rooms, nC = rms.N.center;
      G.map.addCollider(nC.x - 0.55, nC.z - 0.55, nC.x + 0.55, nC.z + 0.55, 0, 2.6);  // effigy footprint
      var P = G.player, DT = 1 / 60;
      Object.keys(G.map.doors).forEach(function (id) { try { G.map.openDoor(id); } catch (e) {} });
      function circle(rid) {
        var c = rms[rid].center, R = 5.0;
        P.pos.set(c.x + Math.sin(0) * R, 0.2, c.z + Math.cos(0) * R); P.vel.set(0, 0, 0);
        for (var pt = 1; pt <= 8; pt++) {
          var ang = pt / 8 * Math.PI * 2, tx = c.x + Math.sin(ang) * R, tz = c.z + Math.cos(ang) * R;
          var best = 1e9, since = 0;
          for (var f = 0; f < 240; f++) {
            var dx = tx - P.pos.x, dz = tz - P.pos.z, dd = Math.hypot(dx, dz);
            if (dd < 1.4) break;
            P.yaw = Math.atan2(-dx, -dz);
            G.keys = { KeyW: true, ShiftLeft: true };
            P.update(DT);
            if (dd < best - 0.05) { best = dd; since = 0; } else if (++since > 110) return { room: rid, jammedAt: pt };
          }
          if (f >= 240) return { room: rid, timeoutAt: pt };
        }
        return { room: rid, ok: true };
      }
      ['N', 'V', 'F', 'B', 'M', 'A', 'S'].forEach(function (rid) { out.circles.push(circle(rid)); });
      G.keys = {};
      return out;
    });

    console.log('\nA. INTERACTABLE OVERLAPS (zones overlapping > 90% of the smaller radius)');
    if (!rep.overlaps.length) console.log('   none');
    rep.overlaps.forEach(function (o) {
      console.log('   ' + o.d + 'm apart @(' + o.x + ',' + o.z + '): [' + (o.a || '(silent)') + '] vs [' + (o.b || '(silent)') + ']');
      if (o.a && o.b) issues.push('overlap: "' + o.a + '" vs "' + o.b + '" ' + o.d + 'm apart');
    });

    console.log('\nB. POST-QUEST TRAINING CIRCLES (effigy collider up, all doors open)');
    rep.circles.forEach(function (c) {
      console.log('   ' + (c.ok ? 'PASS' : 'FAIL') + '  room ' + c.room + (c.ok ? '' : '  ' + JSON.stringify(c)));
      if (!c.ok) issues.push('post-quest circle jam in ' + c.room + ': ' + JSON.stringify(c));
    });

    console.log('\nD. LIVE PROMPT COPY (' + rep.prompts.length + ' strings)');
    rep.prompts.forEach(function (s) { console.log('   ' + s); });

    // ---- E. economy: income by round vs the full sink
    console.log('\nE. ECONOMY CURVE');
    var eco = await p.evaluate(function () {
      var CFG = window.G.CFG, cum = 0, rows = [];
      for (var r = 1; r <= 25; r++) {
        var n = CFG.zombiesForRound(r);
        cum += n * 90;               // ~90 pts/zombie (hits + kill, mixed)
        if (r % 5 === 0) rows.push({ round: r, cum: cum });
      }
      var doors = Object.keys(CFG.MAPS.kurhaus.DOORS).reduce(function (s, k) { return s + CFG.MAPS.kurhaus.DOORS[k].cost; }, 0);
      return { rows: rows, doors: doors, papLadder: CFG.PAP_COST + CFG.DPAP_COST + CFG.TPAP_COST,
               perks4: 2500 + 3000 + 2000 + 500, box5: 950 * 5 };
    });
    var sink = eco.doors + eco.papLadder + eco.perks4 + eco.box5;
    eco.rows.forEach(function (r) { console.log('   round ' + r.round + ': ~' + (r.cum / 1000).toFixed(1) + 'k cumulative points'); });
    console.log('   full sink (all doors ' + eco.doors + ' + PaP ladder ' + eco.papLadder + ' + 4 perks + 5 box rolls) = ~' + (sink / 1000).toFixed(1) + 'k');
    var r20 = eco.rows.filter(function (r) { return r.round === 20; })[0];
    if (r20 && r20.cum < sink) issues.push('economy: full sink ' + sink + ' not affordable by round 20 (~' + r20.cum + ')');
  } finally { await b.close(); }
  console.log('\n' + (issues.length ? '*** ' + issues.length + ' AUDIT ISSUE(S) ***\n - ' + issues.join('\n - ') : 'AUDIT CLEAN'));
  process.exit(issues.length ? 1 : 0);
})();
