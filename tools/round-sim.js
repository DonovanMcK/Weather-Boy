#!/usr/bin/env node
/* ROUND SIM — runs the REAL game loop with the horde actually spawning,
   navigating and dying, to prove rounds clear and nobody gets stuck. The
   player is pinned (invincible) at a spot and "defends" by killing any zombie
   that reaches melee range — so if a round never ends, it's because zombies
   couldn't path to the player (a real bug), which we report with positions.
   Run: node tools/round-sim.js [mapId] [targetRound] [spawnRoom] */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var MAP = process.argv[2] || 'kurhaus';
var TARGET = +(process.argv[3] || 4);
var ROOM = process.argv[4] || null;
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

    var res = await p.evaluate(function (target, roomId) {
      var G = window.G, CFG = G.CFG, P = G.player, Z = G.zombies;
      G.keys = {};
      // pin the player, invincible, at the chosen room (default spawn)
      var rooms = G.map.floors[0].parsed.rooms;
      var c = roomId && rooms[roomId] ? rooms[roomId].center
            : (CFG.PLAYER_SPAWN ? CFG.cellToWorld(CFG.PLAYER_SPAWN.cell[0], CFG.PLAYER_SPAWN.cell[1]) : rooms.S.center);
      P.pos.set(c.x, 0.2, c.z); P.vel.set(0, 0, 0);
      P.maxHp = 1e9; P.hp = 1e9;
      // defending anywhere but spawn implies the map is unlocked — open all doors
      // so the horde can actually path to the player (and spawns use every window)
      if (roomId) { Object.keys(G.map.doors).forEach(function (id) { try { G.map.openDoor(id); } catch (e) {} }); G.nav.dirty = true; }

      var DT = 1 / 30, maxFrames = 30 * 220, roundStartFrame = 0;
      var reached = Z.round, downedAt = null, roundTimes = [];
      var STILL_S = 9;                               // immobile this long while chasing = stuck on geometry

      for (var f = 0; f < maxFrames; f++) {
        try {
          P.update(DT); G.weapons.update(DT); Z.update(DT);
          G.powerups.update(DT); G.map.update(DT);
        } catch (e) { return { error: 'tick threw: ' + e.message, frame: f, round: Z.round }; }

        var alive = 0;
        for (var i = 0; i < Z.list.length; i++) {
          var z = Z.list[i]; if (z.dead) continue; alive++;
          var d = Math.hypot(z.mesh.position.x - P.pos.x, z.mesh.position.z - P.pos.z);
          if (d < 2.6) { Z.damageZombie(z, 1e9, { boom: true }); continue; }
          // immobility tracking: a chasing zombie that barely moves is stuck
          var moved = z._lp ? Math.hypot(z.mesh.position.x - z._lp.x, z.mesh.position.z - z._lp.z) : 1;
          z._lp = { x: z.mesh.position.x, z: z.mesh.position.z };
          if ((z.state === 'chase' || z.state === 'attack') && moved < 0.012) z._still = (z._still || 0) + 1; else z._still = 0;
        }

        if (P.downed && !downedAt) downedAt = { frame: f, round: Z.round };
        if (Z.round > reached) { roundTimes.push({ round: reached, sec: +((f - roundStartFrame) / 30).toFixed(1) }); reached = Z.round; roundStartFrame = f; }
        if (Z.round >= target) break;

        // REAL bug: a zombie wedged on geometry (immobile while chasing, not at the player)
        if ((f % 30) === 0) {
          var stuck = [];
          for (var k = 0; k < Z.list.length; k++) {
            var zz = Z.list[k];
            if (!zz.dead && zz._still > 30 * STILL_S) stuck.push({ x: +zz.mesh.position.x.toFixed(1), z: +zz.mesh.position.z.toFixed(1), state: zz.state, d: +Math.hypot(zz.mesh.position.x - P.pos.x, zz.mesh.position.z - P.pos.z).toFixed(1), stillS: +(zz._still / 30).toFixed(0) });
          }
          if (stuck.length) return { round: Z.round, reached: reached, target: target, roundTimes: roundTimes, downedAt: downedAt, stuckZombies: stuck, framesRun: f, room: roomId || 'spawn' };
        }
      }
      return { round: Z.round, reached: reached, target: target, roundTimes: roundTimes, downedAt: downedAt, framesRun: f, room: roomId || 'spawn' };
    }, TARGET, ROOM);

    console.log('=== ROUND SIM: ' + MAP + (res.room ? ' (defending in ' + res.room + ')' : '') + ' ===');
    if (res.error) { bugs.push(res.error); }
    console.log('reached round ' + res.round + ' / target ' + res.target + '   (' + (res.framesRun) + ' frames)');
    (res.roundTimes || []).forEach(function (r) { console.log('   round ' + r.round + ' cleared in ' + r.sec + 's'); });
    if (res.downedAt) bugs.push('PLAYER DOWNED despite invincibility at frame ' + res.downedAt.frame + ' (round ' + res.downedAt.round + ')');
    if (res.stuckZombies) bugs.push('STUCK ZOMBIE(S) wedged on geometry (immobile while chasing): ' + JSON.stringify(res.stuckZombies));
  } finally { await b.close(); }
  console.log('\n' + (bugs.length ? '*** ' + bugs.length + ' ISSUE(S) ***\n - ' + bugs.join('\n - ') : 'CLEAN — rounds clear, horde reaches the player, no downs'));
  process.exit(bugs.length ? 1 : 0);
})();
