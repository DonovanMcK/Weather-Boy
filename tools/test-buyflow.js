#!/usr/bin/env node
/* BUY-FLOW — plays the actual purchase progression through the REAL interact
   system (I.update + consumeInteract via real KeyF keydown events): denied
   buys, doors, power, perks (pre/post power), wall weapons + ammo, the mystery
   box roll->take (real wall-clock spin), Pack-a-Punch cook->grab, Wunderfizz,
   and a trap. The one layer walkthrough/round-sim never exercised.
   Run: node tools/test-buyflow.js [mapId]   (default kurhaus) */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var MAP = process.argv[2] || 'kurhaus';
var URL = 'file://' + path.join(path.resolve(__dirname, '..'), 'index.html');

(async function () {
  var b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  var fails = 0;
  try {
    var p = await b.newPage();
    p.on('pageerror', function (e) { console.log('  PAGE ERROR: ' + e.message); fails++; });
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForFunction('window.G && G.startGame');
    await p.evaluate(function (m) { G.startGame(m); }, MAP);
    await p.waitForFunction('G.state==="playing"');

    var rows = await p.evaluate(async function () {
      var G = window.G, CFG = G.CFG, P = G.player, I = G.interact, out = [];
      function ck(cond, msg, extra) { out.push({ ok: !!cond, msg: msg, extra: extra || '' }); }
      // freeze the round director; empty arena
      G.zombies.list.length = 0; G.zombies.toSpawn = 0;
      G.zombies.mode = 'break'; G.zombies.breakTimer = 1e9;
      function pressF() { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' })); }
      function at(pos, dx, dz) { P.pos.set(pos.x + (dx || 0), (pos.y || 0) + 0.1, pos.z + (dz || 0)); P.vel.set(0, 0, 0); }
      function tick(n) { for (var i = 0; i < (n || 1); i++) { P.update(1 / 60); G.weapons.update(1 / 60); G.interact.update(1 / 60); G.map.update(1 / 60); } }
      function buyAt(pos) { at(pos); tick(2); pressF(); tick(2); }
      // approach a door like a player would — from each side until it opens
      function buyDoor(d) {
        var offs = [[0, 1.4], [0, -1.4], [1.4, 0], [-1.4, 0], [0, 0]];
        for (var i = 0; i < offs.length && !d.open; i++) { at(d.pos, offs[i][0], offs[i][1]); tick(2); pressF(); tick(2); }
      }
      function promptAt(pos) {
        // stand a step in FRONT of the machine (toward its room centre) like a
        // player — teleporting INTO its collider gets pushed out of range
        var rid = map.roomAt(pos.x, pos.z, 0), rm = rid && map.parsed.rooms[rid], c = (rm && rm.center) || pos;
        var dx = c.x - pos.x, dz = c.z - pos.z, dd = Math.hypot(dx, dz) || 1;
        at(pos, dx / dd * 1.3, dz / dd * 1.3); tick(3);
        var el = document.getElementById('hud-prompt');
        if (!el) return '(missing hud-prompt)';
        return el.style.display === 'none' ? '(no prompt)' : el.textContent;
      }
      function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
      var map = G.map;

      // -- 1. doors closed at start; a broke player can't open one
      var d1 = map.doors[1];
      ck(!d1.open, 'door 1 starts closed');
      P.points = 100;
      buyDoor(d1);
      ck(!d1.open && P.points === 100, 'broke player denied (door stays closed, points kept)', 'pts=' + P.points);

      // -- 2. fund and open every door through the real buy
      P.points = 50000;
      var failedDoors = [];
      Object.keys(map.doors).forEach(function (id) { buyDoor(map.doors[id]); if (!map.doors[id].open) failedDoors.push(id); });
      ck(!failedDoors.length, 'all ' + Object.keys(map.doors).length + ' doors bought open via [F]', failedDoors.length ? 'FAILED: ' + failedDoors.join(',') : '');

      // -- 3. PaP + perks correctly gated BEFORE power
      var papPrompt = promptAt(map.pap.pos);
      ck(!map.pap.unlocked, 'PaP locked pre-power', papPrompt);
      ck(/power|teleport|Core/i.test(papPrompt), 'PaP prompt explains the unlock', papPrompt);
      var jug = map.perkMachines.filter(function (m) { return m.perk === 'jugg'; })[0];
      if (jug) {
        var before = P.points; buyAt(jug.pos);
        ck(!P.hasPerk('jugg') && P.points === before, 'Juggernog denied before power', promptAt(jug.pos));
      }
      var rev = map.perkMachines.filter(function (m) { return m.perk === 'revive'; })[0];
      if (rev) { buyAt(rev.pos); ck(P.hasPerk('revive'), 'Quick Revive buyable BEFORE power'); }

      // -- 4. power on via the real switch
      buyAt(map.powerSwitch.pos);
      ck(map.power, 'power switch turned on via [F]');
      ck(map.pap.unlocked || CFG.cur.papRule !== 'power', 'PaP unlocked by power (papRule=power)');

      // -- 5. perks after power
      if (jug) { buyAt(jug.pos); ck(P.hasPerk('jugg'), 'Juggernog bought after power'); }

      // -- 6. wall weapon then ammo refill
      var wb = map.wallbuys.filter(function (w) { return !w.isFrags; })[0];
      var beforeW = P.points;
      buyAt(wb.pos);
      ck(G.weapons.hasWeapon(wb.gun), 'wall weapon ' + wb.gun + ' bought', 'cost=' + (beforeW - P.points));
      var gun = G.weapons.slots.filter(function (s) { return s.id === wb.gun; })[0];
      if (gun) { gun.reserve = 0; buyAt(wb.pos); ck(gun.reserve > 0, 'wall AMMO refill works'); }

      // -- 7. mystery box: roll (REAL wall-clock spin), then take the offer.
      // Legit outcomes: a weapon offer, monkey bombs (no offer), or a teddy
      // (box refunds + relocates) — retry after a teddy, accept monkeys.
      ck(!!I.box && I.box.spotIdx != null, 'mystery box exists', 'spot ' + I.box.spotIdx + '/' + map.boxSpots.length);
      var boxResult = null;
      for (var attempt = 0; attempt < 3 && !boxResult; attempt++) {
        var spotBefore = I.box.spotIdx;
        buyAt(map.boxSpots[I.box.spotIdx].pos);
        if (!I.box.rolling && !I.box.offer) { boxResult = 'no-roll'; break; }
        for (var w8 = 0; w8 < 80 && (I.box.rolling || (!I.box.offer && I.box.spotIdx === spotBefore && !G.player.hasMonkeys)); w8++) { tick(3); await sleep(100); }
        if (I.box.offer) boxResult = 'offer';
        else if (G.player.hasMonkeys) boxResult = 'monkeys';
        else if (I.box.spotIdx !== spotBefore) { /* teddy — box moved; loop retries at the new spot */ }
        else boxResult = 'nothing';
      }
      ck(boxResult === 'offer' || boxResult === 'monkeys', 'box roll resolved (' + boxResult + ')', 'offer=' + I.box.offer);
      if (boxResult === 'offer') {
        var slotsBefore = G.weapons.slots.length, offered = I.box.offer;
        buyAt(map.boxSpots[I.box.spotIdx].pos);
        ck(G.weapons.hasWeapon(offered) || G.weapons.slots.length > slotsBefore, 'took the box weapon: ' + offered);
      }

      // -- 8. Pack-a-Punch: pay, cook, grab
      P.points = 20000;
      buyAt(map.pap.pos);
      ck(I.pap.packT > 0 || I.pap.ready, 'PaP accepted the gun (cooking)');
      tick(60 * 4.5);
      ck(!!I.pap.ready, 'PaP offer ready to grab');
      buyAt(map.pap.pos);
      var cur = G.weapons.current();
      ck(cur && cur.papped, 'gun is PACKED after grabbing', cur && CFG.WEAPONS[cur.id].name);

      // -- 9. Wunderfizz (random perk) if this map has one
      var fizz = map.perkMachines.filter(function (m) { return m.perk === 'wonderfizz'; })[0];
      if (fizz) {
        var perksBefore = P.perks.length, ptsBefore = P.points;
        buyAt(fizz.pos);
        ck(P.points < ptsBefore, 'Wunderfizz took payment');
        ck(P.perks.length >= perksBefore, 'Wunderfizz resolved (perk or dupe-waste)', 'perks=' + P.perks.join(','));
      }

      // -- 10. a trap, if this map has traps
      if (map.traps && map.traps.length) {
        var tr = map.traps[0];
        buyAt(tr.pos);
        ck(tr.active > 0, 'trap "' + tr.name + '" activated via [F]', 'active=' + (+tr.active).toFixed(1) + 's');
      }

      return out;
    });

    console.log('=== BUY-FLOW: ' + MAP + ' ===');
    rows.forEach(function (r) { console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.msg + (r.extra ? '   [' + r.extra + ']' : '')); if (!r.ok) fails++; });
  } finally { await b.close(); }
  console.log(fails ? '\nBUY-FLOW FAILED (' + fails + ')' : '\nBUY-FLOW PASSED');
  process.exit(fails ? 1 : 0);
})();
