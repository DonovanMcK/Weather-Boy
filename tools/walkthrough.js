#!/usr/bin/env node
/* WALKTHROUGH — drives the real player through the real movement+collision
   system (G.player.update + collide()), like a bot holding W toward waypoints.
   Catches the things logic/render tests never do: stuck spots, falling through
   the floor, clipping outside the map, blocked doorways, unreachable buys, and
   props/pillars jamming a room's training circle.
   Run: node tools/walkthrough.js [mapId]   (default kurhaus) */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var MAP = process.argv[2] || 'kurhaus';
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');

(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  var bugs = [];
  try {
    var p = await b.newPage();
    p.on('pageerror', function (e) { bugs.push('PAGE ERROR: ' + e.message); });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForFunction('window.G && G.startGame');
    await p.evaluate(function (m) { G.startGame(m); }, MAP);
    await p.waitForFunction('G.state==="playing"');

    // install the driver in-page: open all doors, freeze zombies, give money,
    // and expose a stepping walk function that uses the REAL player update.
    var report = await p.evaluate(function () {
      var G = window.G, CFG = G.CFG, P = G.player;
      G.keys = G.keys || {};
      // open every door so we can roam the whole map (closed-door blocking is
      // covered by the playability test); disable their colliders like a buy
      Object.keys(G.map.doors).forEach(function (id) { try { G.map.openDoor(id); } catch (e) {} });
      G.zombies.list.length = 0;                 // empty arena
      var DT = 1 / 60, bugs = [], path = [];

      function setKeys(o) { G.keys = { KeyW: !!o.W, KeyS: !!o.S, KeyA: !!o.A, KeyD: !!o.D, ShiftLeft: !!o.sprint }; }
      function clearKeys() { G.keys = {}; }
      // map bounds for "escaped the building" detection
      var cols = G.map.floors[0].parsed.cols, rows = G.map.floors[0].parsed.rows;
      var c0 = CFG.cellToWorld(0, 0), c1 = CFG.cellToWorld(cols - 1, rows - 1);
      var minX = c0.x - CFG.CELL, maxX = c1.x + CFG.CELL, minZ = c0.z - CFG.CELL, maxZ = c1.z + CFG.CELL;

      // drive toward (tx,tz) until within reach, stuck, or out of frames.
      function goTo(tx, tz, reach, maxFrames) {
        reach = reach || 1.6; maxFrames = maxFrames || 600;
        var best = 1e9, sinceImprove = 0, startY = P.pos.y;
        for (var f = 0; f < maxFrames; f++) {
          var dx = tx - P.pos.x, dz = tz - P.pos.z, d = Math.hypot(dx, dz);
          if (d < reach) return { reached: true, frames: f, pos: { x: P.pos.x, z: P.pos.z } };
          P.yaw = Math.atan2(-dx, -dz);            // face the target (forward = -sin,-cos)
          setKeys({ W: true, sprint: true });
          G.player.update(DT);
          path.push([+P.pos.x.toFixed(1), +P.pos.z.toFixed(1), +P.pos.y.toFixed(1)]);
          // fall-through-floor
          if (P.pos.y < -1.5) return { reached: false, fell: true, pos: { x: P.pos.x, y: P.pos.y, z: P.pos.z }, frames: f };
          // escaped the building footprint
          if (P.pos.x < minX || P.pos.x > maxX || P.pos.z < minZ || P.pos.z > maxZ)
            return { reached: false, escaped: true, pos: { x: +P.pos.x.toFixed(1), z: +P.pos.z.toFixed(1) }, frames: f };
          if (d < best - 0.05) { best = d; sinceImprove = 0; } else if (++sinceImprove > 110)
            return { reached: false, stuck: true, dist: +d.toFixed(1), pos: { x: +P.pos.x.toFixed(1), z: +P.pos.z.toFixed(1) }, frames: f };
        }
        return { reached: false, timeout: true, dist: +Math.hypot(tx - P.pos.x, tz - P.pos.z).toFixed(1), pos: { x: +P.pos.x.toFixed(1), z: +P.pos.z.toFixed(1) } };
      }
      function tp(x, z) { P.pos.set(x, 0.2, z); P.vel.set(0, 0, 0); G.player.update(DT); }

      var rooms = G.map.floors[0].parsed.rooms;
      function ctr(rid) { return rooms[rid].center; }

      // ---- 1. CRITICAL-PATH WALK: spawn -> through every door -> every room ----
      // hops as [fromRoom, doorId, toRoom]; walk center->door->next center
      var hops = CFG.cur.id === 'kurhaus' ? [['S', 1, 'A'], ['A', 4, 'V'], ['V', 5, 'N'], ['N', 7, 'B'], ['B', 2, 'S'], ['S', 3, 'M'], ['M', 8, 'F'], ['F', 6, 'V']] : [];
      var walk = [];
      hops.forEach(function (h) {
        tp(ctr(h[0]).x, ctr(h[0]).z);            // always start the hop in its from-room
        var dpos = G.map.doors[h[1]].pos;
        var toDoor = goTo(dpos.x, dpos.z, 1.4, 500);
        var toRoom = goTo(ctr(h[2]).x, ctr(h[2]).z, 2.0, 500);
        var ok = toDoor.reached && toRoom.reached;
        walk.push({ seg: h[0] + '->door' + h[1] + '->' + h[2], ok: ok, door: toDoor, room: toRoom });
        if (!ok) bugs.push('WALK ' + h[0] + '->' + h[2] + ' (door ' + h[1] + '): ' + JSON.stringify(toDoor.reached ? toRoom : toDoor));
      });

      // ---- 2. TRAINING CIRCLE in every room (props/pillars must not jam it) ----
      var circles = [];
      Object.keys(rooms).forEach(function (rid) {
        var c = ctr(rid);
        // size the circle to the room so small rooms (catwalks/corners) aren't
        // false-flagged: radius = half the room's short side, minus a margin
        var minc = 99, maxc = -99, minr = 99, maxr = -99;
        rooms[rid].cells.forEach(function (cr) { minc = Math.min(minc, cr[0]); maxc = Math.max(maxc, cr[0]); minr = Math.min(minr, cr[1]); maxr = Math.max(maxr, cr[1]); });
        var shortSide = (Math.min(maxc - minc, maxr - minr) + 1) * CFG.CELL;
        var R = Math.max(2.0, Math.min(5.0, shortSide / 2 - 1.6));
        tp(c.x, c.z + R);
        var pts = 8, doneFrames = 0, jammed = null;
        for (var i = 1; i <= pts && !jammed; i++) {
          var a = i / pts * Math.PI * 2, tx = c.x + Math.sin(a) * R, tz = c.z + Math.cos(a) * R;
          var r = goTo(tx, tz, 1.4, 240);
          doneFrames += r.frames || 0;
          if (!r.reached) jammed = { at: i, r: r };
        }
        circles.push({ room: rid, ok: !jammed, jammed: jammed });
        if (jammed) bugs.push('TRAINING CIRCLE jammed in room ' + rid + ' at point ' + jammed.at + ': ' + JSON.stringify(jammed.r.pos || jammed.r));
      });

      // ---- 3. REACHABILITY of every interactable (walk to it from room centre) --
      function roomAt(x, z) {
        // the room the CELL actually belongs to (not the nearest centre, which
        // mis-assigns edge cells of a big concourse to a neighbouring room)
        var rc = CFG.worldToCell(x, z), grid = G.map.floors[0].parsed.cells;
        if (grid[rc.row] && grid[rc.row][rc.col] && grid[rc.row][rc.col].type === 'room')
          return grid[rc.row][rc.col].room;
        var best = null, bd = 1e9;
        Object.keys(rooms).forEach(function (rid) { var c = ctr(rid), d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = rid; } });
        return best;
      }
      var inter = [];
      function reachCheck(label, cell, off) {
        var w = CFG.cellToWorld(cell[0], cell[1]);
        var tx = w.x + (off ? off[0] : 0), tz = w.z + (off ? off[1] : 0);
        var rid = roomAt(tx, tz), c = ctr(rid);
        tp(c.x, c.z);
        var r = goTo(tx, tz, 2.2, 500);
        inter.push({ label: label, ok: r.reached });
        if (!r.reached) bugs.push('UNREACHABLE ' + label + ' @cell' + JSON.stringify(cell) + ' in room ' + rid + ': ' + JSON.stringify(r));
      }
      (CFG.PERK_MACHINES || []).forEach(function (m) { reachCheck('perk:' + m.perk, m.cell, m.off); });
      (CFG.WALLBUYS || []).forEach(function (m) { reachCheck('wall:' + m.gun, m.cell, m.off); });
      (CFG.BOX_SPOTS || []).forEach(function (m, i) { reachCheck('box' + i, m.cell, m.off); });
      (CFG.TRAPS || []).forEach(function (m) { reachCheck('trap:' + m.type, m.cell, m.off); });
      if (CFG.POWER) reachCheck('POWER', CFG.POWER.cell, CFG.POWER.off);
      if (CFG.PAP) reachCheck('PaP', CFG.PAP.cell, CFG.PAP.off);

      // ---- 4. ZOMBIE NAV: standing in each room, every spawn window must have
      // a finite path to the player (else the horde can't follow you there) ----
      if (G.nav) G.nav.build();   // rebuild with all doors now open (as real play does on each buy)
      var nav = { perRoom: [], issues: [] };
      Object.keys(rooms).forEach(function (rid) {
        var c = ctr(rid);
        G.nav.computeField({ x: c.x, z: c.z, y: 0 });
        var unreached = [];
        G.map.windows.forEach(function (w, wi) {
          var node = G.nav.nearest(w.inside.x, w.inside.z, w.inside.y || 0);
          if (!node || !isFinite(node.dist)) unreached.push(wi);
        });
        nav.perRoom.push({ room: rid, ok: !unreached.length, unreached: unreached });
        if (unreached.length) { var msg = 'NAV: from room ' + rid + ', windows [' + unreached.join(',') + '] cannot reach the player'; nav.issues.push(msg); bugs.push(msg); }
      });

      return { bugs: bugs, walk: walk, circles: circles, inter: inter, nav: nav, pathLen: path.length };
    });

    bugs = bugs.concat(report.bugs);
    console.log('=== WALKTHROUGH: ' + MAP + ' ===');
    console.log('\n1. CRITICAL-PATH WALK (spawn through every door into every room):');
    report.walk.forEach(function (w) { console.log('   ' + (w.ok ? 'PASS' : 'FAIL') + '  ' + w.seg); });
    console.log('\n2. TRAINING CIRCLE (run a 5m loop in each room):');
    report.circles.forEach(function (c) { console.log('   ' + (c.ok ? 'PASS' : 'FAIL') + '  room ' + c.room); });
    console.log('\n3. INTERACTABLE REACHABILITY:');
    var bad = report.inter.filter(function (x) { return !x.ok; });
    console.log('   ' + (report.inter.length - bad.length) + '/' + report.inter.length + ' reachable' + (bad.length ? '  — FAILED: ' + bad.map(function (x) { return x.label; }).join(', ') : ''));
    console.log('\n4. ZOMBIE NAV (horde can reach the player in every room):');
    report.nav.perRoom.forEach(function (r) { console.log('   ' + (r.ok ? 'PASS' : 'FAIL') + '  room ' + r.room + (r.ok ? '' : '  windows ' + JSON.stringify(r.unreached) + ' unreachable')); });
  } finally { await b.close(); }
  console.log('\n' + (bugs.length ? '*** ' + bugs.length + ' ISSUE(S) ***\n - ' + bugs.join('\n - ') : 'NO ISSUES — clean walkthrough'));
  process.exit(bugs.length ? 1 : 0);
})();
