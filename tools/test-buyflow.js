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
        // player — teleporting INTO its collider gets pushed out of range. Try a
        // few stand distances/sides; return the first prompt that shows.
        var rid = map.roomAt(pos.x, pos.z, 0), rm = rid && map.parsed.rooms[rid], c = (rm && rm.center) || pos;
        var dx = c.x - pos.x, dz = c.z - pos.z, dd = Math.hypot(dx, dz) || 1;
        var el = document.getElementById('hud-prompt');
        if (!el) return '(missing hud-prompt)';
        var tries = [[dx / dd * 1.0, dz / dd * 1.0], [dx / dd * 1.5, dz / dd * 1.5],
                     [dz / dd * 1.2, -dx / dd * 1.2], [-dz / dd * 1.2, dx / dd * 1.2]];
        for (var ti = 0; ti < tries.length; ti++) {
          at(pos, tries[ti][0], tries[ti][1]); tick(3);
          if (el.style.display !== 'none') return el.textContent;
        }
        return '(no prompt)';
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
      // some maps wall the locked PaP behind a force field (player can't get in
      // prompt range) — the field itself communicates the lock; accept either
      var fieldUp = map.pap.fieldCol && map.pap.fieldCol.on;
      ck(/power|teleport|Core/i.test(papPrompt) || (papPrompt === '(no prompt)' && fieldUp),
         'PaP lock is communicated (prompt or force field)', papPrompt + (fieldUp ? ' +field' : ''));
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

      // -- 11. THE FOUNDER'S BARGAIN — walk the ENTIRE multi-stage quest chain
      // through real interact presses (sigils -> relics -> 4 current trials ->
      // soul chest -> the portrait bargain -> the second wonder)
      if (I.quest && I.quest.on) {
        var KA = G.map.kAnim;
        // stage 0: relics must be cold before the sigils are traced
        var r0 = I.ee.relics[0]; buyAt(r0.pos);
        ck(I.ee.activated === 0, 'relics are COLD before the sigils are lit');
        ck(KA.sigils.length === 4, '4 sigils drawn in the Sanctum');
        KA.sigils.forEach(function (s3) { buyAt({ x: s3.pos.x, y: 0, z: s3.pos.z }); });
        ck(I.quest.stage === 1, 'stage 1: all 4 sigils traced', 'lit=' + I.quest.sigilsLit);
        // stage 1: now the relics wake
        I.ee.relics.forEach(function (r) { buyAt(r.pos); });
        ck(I.quest.stage === 2, 'stage 2: 3 relics activated -> the currents stir', I.ee.activated + '/3');
        ck(I.quest.valves.length === 4, '4 current valves revealed', I.quest.valves.map(function (v) { return v.name.split(' ')[0]; }).join(','));
        function valve(n) { return I.quest.valves.filter(function (v) { return v.name.indexOf(n) === 0; })[0]; }
        // MOLTEN: denied while the trap sleeps; attunes while it fires
        var vm2 = valve('molten');
        var trM = G.map.traps.filter(function (t) { return t.type === 'molten'; })[0];
        trM.active = 0; trM.cooldown = 0;     // step 10 fired it — put the melt to sleep first
        buyAt(vm2.pos);
        ck(!vm2.attuned, 'molten current DENIED while the trap sleeps');
        P.points = 50000;
        buyAt(trM.pos);                       // fire the Molten Pour for real
        buyAt(vm2.pos);
        ck(vm2.attuned, 'MOLTEN attuned while the trap fires');
        // FROZEN: hold F to thaw (real held-key path)
        var vf = valve('frozen');
        at(vf.pos); tick(2);
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
        G.keys.KeyF = true; tick(60 * 3.2);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' })); G.keys.KeyF = false;
        ck(vf.attuned, 'FROZEN thawed by holding F');
        // DROWNED: denied standing; attunes crouched in the spring
        var vd = valve('drowned');
        buyAt(vd.pos);
        ck(!vd.attuned, 'drowned current DENIED while standing');
        at(vd.pos); G.keys.KeyC = true; tick(8); pressF(); tick(2); G.keys.KeyC = false;
        ck(vd.attuned, 'DROWNED attuned while crouched in the spring');
        // BURIED: denied until an explosive cracks the archway
        var vb = valve('buried');
        buyAt(vb.pos);
        ck(!vb.attuned, 'buried current DENIED behind intact brick');
        G.weapons.explode(new THREE.Vector3(KA.arch.pos.x, 1, KA.arch.pos.z), 100, 4, {});
        ck(KA.arch.cracked, 'explosive CRACKED the bricked archway');
        buyAt(vb.pos);
        ck(vb.attuned, 'BURIED attuned through the crack');
        // stage 3: the currents leave offerings — collect all four
        ck(I.quest.stage === 3 && I.quest.offeringItems.length === 4, 'stage 3: currents recede -> 4 offerings revealed',
           I.quest.offeringItems.map(function (o) { return o.name.split(' ')[0]; }).join(','));
        I.quest.offeringItems.forEach(function (o) { buyAt({ x: o.pos.x, y: 0, z: o.pos.z }); });
        ck(I.quest.offerings === 4, 'all 4 offerings gathered', I.quest.offerings + '/4');
        // stage 4: raise the effigy on the Sanctum ring (real held-F path)
        var effItem = I.list.filter(function (it) { return it.holdable && it.prompt && it.prompt() === 'Hold F — raise the effigy'; })[0];
        ck(!!effItem, 'effigy prompt live on the founder\'s ring');
        at(effItem.pos); tick(2);
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
        G.keys.KeyF = true; tick(60 * 2.6);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' })); G.keys.KeyF = false;
        ck(I.quest.stage === 4 && !!I.quest.ghost, 'stage 4: EFFIGY raised -> the ghost walks', 'ghost in ' + (I.quest.ghost && I.quest.ghost.room));
        // the hide-and-seek: corner him three times (proximity via real I.update)
        var visited = [];
        for (var gseek = 0; gseek < 3 && I.quest.ghost; gseek++) {
          visited.push(I.quest.ghost.room);
          at({ x: I.quest.ghost.pos.x, y: 0, z: I.quest.ghost.pos.z }); tick(4);
        }
        ck(I.quest.ghostFinds === 3 && !I.quest.ghost, 'ghost CORNERED 3 times (hide-and-seek)', 'rooms: ' + visited.join('->'));
        ck(I.quest.stage === 5 && !!I.ee.box, 'stage 5: soul chest wakes where he fell');
        for (var k2 = 0; k2 < I.ee.need && I.ee.box && !I.ee.done; k2++) I.onKill(I.ee.box);
        ck(I.ee.done && I.quest.stage === 6, 'stage 6: chest filled -> he is listening');
        ck(!G.weapons.hasWeapon(CFG.cur.eeWonder), 'no prize before the bargain is accepted');
        buyAt(KA.voss.pos);                   // face the founder
        ck(I.quest.done, 'stage 7: bargain ACCEPTED at the portrait');
        ck(G.weapons.hasWeapon(CFG.cur.eeWonder), 'the buried SECOND WONDER granted: ' + CFG.WEAPONS[CFG.cur.eeWonder].name);
      } else if (CFG.RELIC_SPOTS && CFG.RELIC_SPOTS.length && CFG.EE_SOULBOX) {
        // classic mini egg on the other maps
        I.ee.relics.forEach(function (r) { buyAt(r.pos); });
        ck(I.ee.activated === 3, 'all 3 relics activated via [F]', I.ee.activated + '/3');
        ck(!!I.ee.box, 'soul chest awakened in the map');
        for (var k3 = 0; k3 < I.ee.need && I.ee.box && !I.ee.done; k3++) I.onKill(I.ee.box);
        ck(I.ee.done, 'soul chest filled (' + I.ee.need + ' kills)');
      }

      return out;
    });

    console.log('=== BUY-FLOW: ' + MAP + ' ===');
    rows.forEach(function (r) { console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.msg + (r.extra ? '   [' + r.extra + ']' : '')); if (!r.ok) fails++; });
  } finally { await b.close(); }
  console.log(fails ? '\nBUY-FLOW FAILED (' + fails + ')' : '\nBUY-FLOW PASSED');
  process.exit(fails ? 1 : 0);
})();
