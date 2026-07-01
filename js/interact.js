/* ===========================================================================
   DER WETTERJUNGE — interact.js
   Everything bought or pressed with F: doors, wall buys, perks, power,
   mystery box, Pack-a-Punch, teleporters, mainframe, barricade repair.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var CFG = null;

  var I = G.interact = {
    list: [],
    box: null,           // mystery box state
    fireSaleOn: false,
    repairProgress: 0
  };

  function add(item) { I.list.push(item); return item; }

  /* --------------------------------------------------------------- setup */
  I.init = function () {
    CFG = G.CFG;
    var map = G.map;

    // yaw that points a prop's +Z front toward its room centre
    function faceCenter(pos) {
      var rid = map.roomAt(pos.x, pos.z, pos.y), rm = rid && (map.parsedAtY(pos.y).rooms[rid] || map.parsed.rooms[rid]), c = rm && rm.center;
      if (!c) return 0;
      var dx = c.x - pos.x, dz = c.z - pos.z;
      if (Math.hypot(dx, dz) < 0.2) return 0;
      return Math.atan2(dx, dz);
    }

    // doors
    Object.keys(map.doors).forEach(function (id) {
      var d = map.doors[id];
      add({
        pos: d.pos, r: 2.6,
        prompt: function () { return d.open ? null : 'Open ' + d.name + ' — ' + d.cost; },
        use: function () {
          if (d.open) return;
          if (!G.player.spend(d.cost)) return;
          G.audio.buy();
          map.openDoor(d.id);
        }
      });
    });

    // wall buys
    map.wallbuys.forEach(function (wb) {
      add({
        pos: wb.pos, r: 2.2,
        prompt: function () {
          if (wb.isFrags) return 'Buy Frag Grenades — ' + wb.cost;
          var owned = G.weapons.hasWeapon(wb.gun);
          if (!owned) return 'Buy ' + CFG.WEAPONS[wb.gun].name + ' — ' + wb.cost;
          var gun = G.weapons.slots.filter(function (s) { return s.id === wb.gun; })[0];
          var ammoCost = gun.papped ? CFG.PAP_AMMO_COST : Math.round(wb.cost * CFG.WALL_AMMO_FACTOR);
          return 'Buy Ammo — ' + ammoCost;
        },
        use: function () {
          if (wb.isFrags) {
            if (G.player.frags >= CFG.MAX_FRAGS) { G.hud.banner('Grenades full', '#999', 1); return; }
            if (!G.player.spend(wb.cost)) return;
            G.player.frags = CFG.MAX_FRAGS;
            G.audio.buy(); G.hud.setAmmo();
            return;
          }
          var owned = G.weapons.hasWeapon(wb.gun);
          if (!owned) {
            if (!G.player.spend(wb.cost)) return;
            G.audio.buy();
            G.weapons.giveWeapon(wb.gun);
          } else {
            var gun = G.weapons.slots.filter(function (s) { return s.id === wb.gun; })[0];
            var s = G.weapons.stats(gun);
            if (gun.reserve >= s.reserve) { G.hud.banner('Ammo full', '#999', 1); return; }
            var ammoCost = gun.papped ? CFG.PAP_AMMO_COST : Math.round(wb.cost * CFG.WALL_AMMO_FACTOR);
            if (!G.player.spend(ammoCost)) return;
            gun.reserve = s.reserve;
            G.audio.buy(); G.hud.setAmmo();
          }
        }
      });
    });

    // perk machines (and the Der Wunderfizz random-perk vendor)
    map.perkMachines.forEach(function (pm) {
      var def = CFG.PERKS[pm.perk];
      if (def && def.vendor) { addWunderfizz(pm, def); return; }
      add({
        pos: pm.pos, r: 2.2,
        prompt: function () {
          if (G.player.hasPerk(pm.perk)) return null;
          // the Core perk is sealed until the easter egg awakens the Core
          if (pm.ee && !map.coreUnlocked) return def.name + ' — sealed (awaken the Core)';
          if (pm.perk === 'revive' && G.player.qrBuys >= CFG.QR_MAX_BUYS) return null;
          if (!map.power && pm.perk !== 'revive') return def.name + ' — needs power';
          if (G.player.perks.length >= (G.settings.perkLimit || CFG.MAX_PERKS)) return 'Perk limit reached';
          return 'Buy ' + def.name + ' — ' + def.cost;
        },
        use: function () {
          if (G.player.hasPerk(pm.perk)) return;
          if (pm.ee && !map.coreUnlocked) { G.audio.deny(); return; }
          if (!map.power && pm.perk !== 'revive') { G.audio.deny(); return; }
          if (G.player.perks.length >= (G.settings.perkLimit || CFG.MAX_PERKS)) { G.audio.deny(); return; }
          if (pm.perk === 'revive' && G.player.qrBuys >= CFG.QR_MAX_BUYS) { G.audio.deny(); return; }
          if (!G.player.spend(def.cost)) return;
          if (pm.perk === 'revive') G.player.qrBuys++;
          G.audio.drink();
          G.audio.perkJingle();
          G.weapons.switching = 1.1; // lower the gun while drinking
          G.player.addPerk(pm.perk);
          G.hud.banner(def.name + '!', '#' + new THREE.Color(def.color).getHexString(), 2);
        }
      });
    });

    // Der Wunderfizz: pay for a RANDOM perk. A dupe can't stack — it just wastes
    // the points, exactly like the real machine.
    function addWunderfizz(pm, def) {
      add({
        pos: pm.pos, r: 2.2,
        prompt: function () {
          if (!map.power) return def.name + ' — needs power';
          if (G.player.perks.length >= (G.settings.perkLimit || CFG.MAX_PERKS)) return def.name + ' — perk limit reached';
          return def.name + ' — random perk — ' + def.cost;
        },
        use: function () {
          if (!map.power) { G.audio.deny(); return; }
          if (G.player.perks.length >= (G.settings.perkLimit || CFG.MAX_PERKS)) { G.audio.deny(); return; }
          if (!G.player.spend(def.cost)) return;
          G.audio.drink();
          G.weapons.switching = 1.1;
          var pool = CFG.FIZZ_POOL;
          var pick = pool[(Math.random() * pool.length) | 0];
          var pdef = CFG.PERKS[pick];
          if (G.player.hasPerk(pick)) {            // dupe — wasted points, no stacking
            G.audio.deny();
            G.hud.banner(pdef.name + ' — already had it!', '#b86', 2.2, 'Wunderfizz wasted');
          } else {
            G.audio.perkJingle();
            if (pick === 'revive') G.player.qrBuys++;
            G.player.addPerk(pick);
            G.hud.banner(pdef.name + '!', '#' + new THREE.Color(pdef.color).getHexString(), 2.2, 'from Der Wunderfizz');
          }
        }
      });
    }

    // (Developer Tools / settings live in the menu UI now — no in-world terminal)

    // reusable wall-mount: place a prop's BACK flush against the wall in `face`
    // direction of `cell`, then in by halfDepth, with the matching cardinal yaw.
    var SH_YAW = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 };
    var SH_OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    function wallMount(cell, face, halfDepth, y) {
      var wc = CFG.cellToWorld(cell[0], cell[1]), o = SH_OFF[face] || [0, 0];
      var inset = (CFG.CELL / 2) - 0.175 - (halfDepth || 0);   // inner wall face, in by half-depth
      return { pos: new THREE.Vector3(wc.x + o[0] * inset, y || 0, wc.z + o[1] * inset), yaw: SH_YAW[face] || 0 };
    }

    // --- Zombie Shield: scavenge 3 components, each in its OWN room, then
    // assemble at the wall bench. Carried on your back, eats hits from behind.
    var SHIELD_KINDS = ['frame', 'plate', 'glass'];
    I.shield = { have: { frame: false, plate: false, glass: false }, count: 0, total: 3, parts: [] };
    var shieldDefs = CFG.SHIELD_PARTS || {};
    SHIELD_KINDS.forEach(function (kind) {
      var def = shieldDefs[kind]; if (!def || !def.spots || !def.spots.length) return;
      // deterministic seeded pick of one of the three authored spots in this room
      var loc = def.spots[G.PU.hashStr(CFG.cur.id + ':' + kind) % def.spots.length];
      var m = wallMount(loc.cell, loc.face, 0.16, loc.y);
      var mesh = G.Props.create('shield_part', { position: m.pos, rotationY: m.yaw, variant: kind });
      var part = { kind: kind, pos: m.pos, mesh: mesh, taken: false, cell: loc.cell, face: loc.face, room: def.room };
      I.shield.parts.push(part);
      add({
        pos: m.pos, r: 1.7, y: loc.y || 0,
        prompt: function () { return part.taken ? null : 'Pick up shield ' + kind; },
        use: function () {
          if (part.taken) return;
          part.taken = true; I.shield.have[kind] = true; I.shield.count++;
          G.Props.dispose(part.mesh);
          G.audio.buy();
          G.hud.banner('SHIELD PART ' + I.shield.count + '/' + I.shield.total, '#fb8', 2,
            I.shield.count >= I.shield.total ? 'Assemble it at the bench' : 'Find the others…');
        }
      });
    });
    // assembly bench: back flush to its workshop wall, with a tight collider that
    // matches the visible bench (no loose invisible barrier around it)
    var benchDef = CFG.SHIELD_BENCH;
    if (benchDef) {
      var bm = wallMount(benchDef.cell, benchDef.face, 0.4, 0);
      var bpos = bm.pos;
      G.map.shieldBench = { pos: bpos, face: benchDef.face };
      G.Props.create('shield_bench', { position: bpos, rotationY: bm.yaw });
      // tight collider = bench footprint (1.32 x 0.8), swapped when wall-aligned ±X
      var bhw = 0.66, bhd = 0.4;
      if (benchDef.face === 'E' || benchDef.face === 'W') { var bt = bhw; bhw = bhd; bhd = bt; }
      G.map.addCollider(bpos.x - bhw, bpos.z - bhd, bpos.x + bhw, bpos.z + bhd, 0, 1.0);
      add({
        pos: bpos, r: 2.2,
        prompt: function () {
          var sh = G.player.shield;
          if (sh && sh.has) return null;
          if (I.shield.count < I.shield.total) {
            var left = I.shield.total - I.shield.count;
            return 'Shield bench — find ' + left + ' more part' + (left > 1 ? 's' : '');
          }
          return 'Build the Zombie Shield';
        },
        use: function () {
          var sh = G.player.shield;
          if (!sh || sh.has) return;
          if (I.shield.count < I.shield.total) { G.audio.deny(); return; }
          sh.has = true; sh.hp = sh.max;
          G.audio.buy();
          G.hud.banner('ZOMBIE SHIELD', '#fb8', 2, 'Blocks attacks from behind');
          if (G.hud.setShield) G.hud.setShield(sh);
        }
      });
    }

    // --- mini easter egg: activate 3 hidden relics, then fill the soul chest.
    // 3 distinct spots are chosen from 9 authored wall-adjacent locations,
    // deterministically per match; the other 6 are never instantiated.
    I.ee = { relics: [], activated: 0, box: null, boxMesh: null, glow: null,
             souls: 0, need: 30, done: false };
    var relicSpots = (CFG.RELIC_SPOTS || []).slice();
    var relicSeed = G.PU.hashStr((CFG.cur.id || '') + ':relics');
    var chosenRelics = [];
    for (var rPick = 0; rPick < 3 && relicSpots.length; rPick++) {
      var idx = (relicSeed + rPick * 7919) % relicSpots.length;
      chosenRelics.push(relicSpots.splice(idx, 1)[0]);
    }
    chosenRelics.forEach(function (loc) {
      var m = wallMount(loc.cell, loc.face, 0.26, loc.y);   // pedestal flush to wall
      var pos = m.pos;
      var mesh = G.Props.create('relic_pedestal', { position: pos, rotationY: m.yaw });
      var relic = { pos: pos, mesh: mesh, active: false, cell: loc.cell };
      I.ee.relics.push(relic);
      add({
        pos: pos, r: 1.8,
        prompt: function () { return relic.active ? null : 'Activate the relic'; },
        use: function () {
          if (relic.active) return;
          relic.active = true; I.ee.activated++;
          if (relic.mesh.userData.activate) relic.mesh.userData.activate();
          G.audio.perkJingle();
          if (I.ee.activated >= I.ee.relics.length) spawnSoulBox();
          else G.hud.banner('RELIC ' + I.ee.activated + '/' + I.ee.relics.length, '#7fd', 2, 'Find the others…');
        }
      });
    });
    function spawnSoulBox() {
      if (I.ee.box || !CFG.EE_SOULBOX) return;
      var wc = CFG.cellToWorld(CFG.EE_SOULBOX[0], CFG.EE_SOULBOX[1]);
      I.ee.box = new THREE.Vector3(wc.x, 0, wc.z);
      I.ee.boxMesh = G.Props.create('soul_chest', { position: I.ee.box });
      I.ee.glow = null;   // the chest carries its own internal glow light
      G.hud.banner('SOUL CHEST AWAKENED', '#b6f', 3, 'Feed it kills nearby');
    }
    function rewardSoulBox() {
      var ee = I.ee; ee.done = true;
      if (ee.boxMesh) G.scene.remove(ee.boxMesh);
      if (ee.glow) G.scene.remove(ee.glow);
      // a map may bury a SECOND wonder weapon as its quest prize (Kurhaus: the
      // founder's Thundergun) — the only way to hold two wonders at once
      if (CFG.cur.eeWonder && CFG.WEAPONS[CFG.cur.eeWonder] && !G.weapons.hasWeapon(CFG.cur.eeWonder)) {
        G.weapons.giveWeapon(CFG.cur.eeWonder);
        G.audio.perkJingle();
        G.hud.banner('THE FOUNDER\'S BARGAIN', '#b6f', 4, 'His buried prize: the ' + CFG.WEAPONS[CFG.cur.eeWonder].name);
        return;
      }
      var pool = CFG.FIZZ_POOL.filter(function (id) { return !G.player.hasPerk(id); });
      if (pool.length) {
        var pick = pool[(Math.random() * pool.length) | 0];
        G.player.addPerk(pick); G.audio.perkJingle();
        G.hud.banner('SOUL REWARD', '#b6f', 4, 'Free perk: ' + CFG.PERKS[pick].name);
      } else {
        G.weapons.maxAmmo(); G.player.addPoints(2000);
        G.hud.banner('SOUL REWARD', '#b6f', 4, 'Max Ammo + 2000 points');
      }
    }
    // counted from zombies.killZombie — souls collect when kills land near the chest
    I.onKill = function (pos) {
      var ee = I.ee;
      if (!ee || !ee.box || ee.done) return;
      if (Math.hypot(pos.x - ee.box.x, pos.z - ee.box.z) > 6.5) return;
      ee.souls++;
      if (ee.boxMesh && ee.boxMesh.userData.setCharge) ee.boxMesh.userData.setCharge(ee.souls / ee.need);
      if (ee.souls >= ee.need) rewardSoulBox();
      else if (ee.souls % 5 === 0) G.hud.banner('SOULS ' + ee.souls + '/' + ee.need, '#b6f', 1.1);
    };

    // power switch
    add({
      pos: map.powerSwitch.pos, r: 2.4,
      prompt: function () { return map.power ? null : 'Turn on the POWER'; },
      use: function () {
        if (map.power) return;
        map.setPower();
        G.audio.powerOn();
        G.hud.banner('POWER ON', '#ff5', 3, 'The machines hum to life');
        if (map.powerSwitch.setPowered) map.powerSwitch.setPowered(true);
        // a core-gated PaP (Kurhaus) needs power AND the awakened Core, so power
        // alone doesn't drop the field — map.coreUnlocked (set by the EE) does
        if (CFG.cur.papRule === 'power' && !map.pap.unlocked &&
            !(CFG.cur.papCoreGated && !map.coreUnlocked)) map.pap.unlock();
      }
    });

    // teleporters
    map.teleporters.forEach(function (t) {
      add({
        pos: t.pos, r: 2.3,
        prompt: function () {
          if (!map.power) return 'Teleporter ' + t.id + ' — no power';
          if (t.linked) return 'Teleport to mainframe — ' + CFG.TELE_USE_COST;
          if (t.linking) return 'Linking... reach the MAINFRAME! (' + Math.ceil(t.linkTimer) + 's)';
          return 'Activate Teleporter ' + t.id + ' (then link at mainframe)';
        },
        use: function () {
          if (!map.power) { G.audio.deny(); return; }
          if (t.linked) {
            if (!G.player.spend(CFG.TELE_USE_COST)) return;
            G.audio.teleport();
            G.hud.flashWhite();
            // land on the catwalk just in front of the Mainframe (its own floor level)
            G.player.pos.set(map.mainframe.pos.x, map.mainframe.pos.y || 0, map.mainframe.pos.z + 1.5);
            G.player.vel.set(0, 0, 0);
            return;
          }
          if (!t.linking) {
            t.linking = true;
            t.linkTimer = CFG.TELE_LINK_WINDOW;
            G.audio.teleportCharge();
            G.hud.banner('TELEPORTER ' + t.id + ' ACTIVE', '#fc3', 2, 'Link it at the mainframe — ' + CFG.TELE_LINK_WINDOW + 's');
          }
        }
      });
    });

    // mainframe (teleporter maps only)
    if (map.mainframe) add({
      pos: map.mainframe.pos, r: 2.4,
      prompt: function () {
        var linking = map.teleporters.filter(function (t) { return t.linking; });
        if (linking.length) return 'LINK teleporter ' + linking.map(function (t) { return t.id; }).join('+');
        return null;
      },
      use: function () {
        var any = false;
        map.teleporters.forEach(function (t) {
          if (t.linking) {
            t.linking = false;
            t.linked = true;
            any = true;
            G.audio.teleLink();
            G.hud.banner('TELEPORTER ' + t.id + ' LINKED', '#3ef', 2);
          }
        });
        if (!any) return;
        var linkedCount = map.teleporters.filter(function (t) { return t.linked; }).length;
        if (linkedCount === 3 && !map.pap.unlocked) map.pap.unlock();
        else if (linkedCount < 3) G.hud.banner(linkedCount + ' / 3 linked', '#9ef', 1.5);
      }
    });

    // pack-a-punch
    add({
      pos: map.pap.pos, r: 2.4,
      prompt: function () {
        if (!map.pap.unlocked) {
          if (CFG.cur.papCoreGated && !map.coreUnlocked)
            return 'Pack-a-Punch — awaken the Core (power + the four currents)';
          return CFG.cur.papRule === 'power'
            ? 'Pack-a-Punch — turn on the power'
            : 'Pack-a-Punch — link all 3 teleporters';
        }
        if (I.pap.ready) return 'Take ' + I.pap.name + ' (' + Math.ceil(I.pap.grabT) + 's)';
        if (I.pap.packT > 0) return 'Upgrading…';
        var gun = G.weapons.current();
        if (!gun) return null;
        if (gun.dpap) return CFG.WEAPONS[gun.id].pap.name + ' is fully upgraded';
        if (gun.papped) return 'Double Pack-a-Punch ' + CFG.WEAPONS[gun.id].pap.name + ' — ' + CFG.DPAP_COST;
        return 'Pack-a-Punch ' + CFG.WEAPONS[gun.id].name + ' — ' + CFG.PAP_COST;
      },
      use: function () {
        if (!map.pap.unlocked) { G.audio.deny(); return; }
        // collect a finished upgrade (grab it before it fades back in)
        if (I.pap.ready) {
          var collected = G.weapons.slots.indexOf(I.pap.ready) >= 0 && G.weapons.papGun(I.pap.ready);
          if (collected) {
            G.audio.perkJingle();
            G.hud.banner(I.pap.name, '#fb5', 2.5,
              I.pap.dbl ? 'Double-packed — Dead Wire electric rounds' : 'Upgraded — storm camo');
          }
          clearPapOffer();
          return;
        }
        if (I.pap.packT > 0) { G.audio.deny(); return; }   // still in the machine
        var gun = G.weapons.current();
        if (!gun || gun.dpap) { G.audio.deny(); return; }
        var dbl = gun.papped;                              // second pass = double-pack
        if (!G.player.spend(dbl ? CFG.DPAP_COST : CFG.PAP_COST)) return;
        G.audio.papChug();
        // you keep moving (and firing) while it cooks — no lock
        I.pap.packT = 3.5;
        I.pap.pending = gun;
        I.pap.dbl = dbl;
        I.pap.name = CFG.WEAPONS[gun.id].pap.name + (dbl ? ' II' : '');
        G.hud.banner(dbl ? 'DOUBLE-PACKING…' : 'UPGRADING…', '#fb5', 2, 'Grab it from the machine');
      }
    });

    // pack-a-punch grab-offer state (you can move while it cooks; grab the
    // upgraded gun before it fades back into the machine)
    I.pap = { packT: 0, grabT: 0, pending: null, ready: null, dbl: false, name: '', sprite: null };

    // mystery box
    I.box = {
      spotIdx: 0, uses: 0, rolling: false, offer: null, offerTimer: 0,
      mesh: null, offerSprite: null, recent: [], lastRarity: null
    };
    I.moveBox(0, true);
    map.boxSpots.forEach(function (spot, idx) {
      add({
        pos: spot.pos, r: 2.4,
        prompt: function () {
          var atThisSpot = I.box.spotIdx === idx;
          var fs = I.fireSaleOn;
          if (!atThisSpot && !fs) return null;
          if (atThisSpot && I.box.rolling) return null;
          if (atThisSpot && I.box.offer) {
            return 'Take ' + CFG.WEAPONS[I.box.offer].name + ' (' + Math.ceil(I.box.offerTimer) + 's)';
          }
          var cost = fs ? 10 : CFG.BOX_COST;
          return 'Mystery Box — ' + cost;
        },
        use: function () {
          var atThisSpot = I.box.spotIdx === idx;
          if (!atThisSpot && !I.fireSaleOn) return;
          if (!atThisSpot && I.fireSaleOn) {
            // fire sale: box teleports to wherever you bought
            I.moveBox(idx, true);
          }
          if (I.box.rolling) return;
          if (I.box.offer) { takeOffer(); return; }
          var cost = I.fireSaleOn ? 10 : CFG.BOX_COST;
          if (!G.player.spend(cost)) return;
          rollBox();
        }
      });
    });

    // traps — buyable, power-gated zone hazards (no trap fires before power)
    map.traps.forEach(function (tr) {
      add({
        pos: tr.pos, r: 2.4,
        prompt: function () {
          if (!map.power) return tr.name + ' — needs power';
          if (tr.active > 0) return tr.name + ' — ACTIVE (' + Math.ceil(tr.active) + 's)';
          if (tr.cooldown > 0) return tr.name + ' — cooling down (' + Math.ceil(tr.cooldown) + 's)';
          return 'Activate ' + tr.name + ' — ' + tr.cost;
        },
        use: function () {
          if (!map.power) { G.audio.deny(); return; }
          if (tr.active > 0 || tr.cooldown > 0) { G.audio.deny(); return; }
          if (!G.player.spend(tr.cost)) return;
          tr.active = tr.dur;
          G.audio.buy();
          G.hud.banner(tr.name + ' ACTIVE', '#' + new THREE.Color(tr.color).getHexString(), 2);
        }
      });
    });

    // window barricades (hold F)
    map.windows.forEach(function (w) {
      add({
        pos: w.inside, r: 2.4, holdable: true,
        prompt: function () {
          return w.boards < 6 ? 'Hold F to rebuild barrier (+10/board)' : null;
        },
        hold: function (dt) {
          if (w.boards >= 6) return;
          var rate = G.player.hasPerk('speed') ? 2 : 1;
          I.repairProgress += dt * rate;
          if (I.repairProgress >= 0.8) {
            I.repairProgress = 0;
            w.setBoards(w.boards + 1);
            G.audio.boardRepair();
            G.player.addPoints(CFG.PTS.board);
          }
        }
      });
    });
  };

  /* --------------------------------------------------------- mystery box */
  // the Mystery Box is a registered prop (occult supply chest). It exposes the
  // userData.lid contract the roll/settle animation drives (closed y≈0.85,
  // open y≈1.1) plus an internal glow + weapon display anchor.
  function buildBoxMesh(pos) {
    return G.Props.create('mystery_box', { position: pos });
  }

  I.moveBox = function (idx, silent) {
    if (I.box.mesh) G.scene.remove(I.box.mesh);
    if (I.box.offerSprite) { G.scene.remove(I.box.offerSprite); I.box.offerSprite = null; }
    I.box.spotIdx = idx;
    I.box.offer = null;
    I.box.uses = 0;
    I.box.mesh = buildBoxMesh(G.map.boxSpots[idx].pos);
    if (!silent) G.hud.banner('The box has moved...', '#9cf', 2);
  };

  function boxPool(excludeRecent) {
    var recent = (excludeRecent && I.box && I.box.recent) || [];
    var pool = Object.keys(CFG.WEAPONS).filter(function (id) {
      var w = CFG.WEAPONS[id];
      if (!w.box) return false;
      if (w.wonder && id !== CFG.cur.wonder) return false; // map's own wonder only
      if (G.weapons.hasWeapon(id)) return false;
      if (recent.indexOf(id) >= 0) return false;            // no repeats from the last few rolls
      return true;
    });
    // never let the recent-filter empty the pool
    return pool.length ? pool : boxPool(false);
  }

  function rollBox() {
    var box = I.box;
    box.rolling = true;
    box.uses++;
    G.audio.boxOpen();
    box.mesh.userData.lid.position.y = 1.1;
    var spot = G.map.boxSpots[box.spotIdx];
    var cycleSprite = null;
    var elapsed = 0, interval = null;

    interval = setInterval(function () {
      elapsed += 0.18;
      if (cycleSprite) G.scene.remove(cycleSprite);
      var pool = boxPool();
      var name = CFG.WEAPONS[pool[(Math.random() * pool.length) | 0]].name;
      cycleSprite = G.util.textSprite(name, '#cdf', 2.4);
      cycleSprite.position.set(spot.pos.x, 1.6 + elapsed * 0.25, spot.pos.z);
      G.scene.add(cycleSprite);
      if (elapsed >= 2.8) {
        clearInterval(interval);
        if (cycleSprite) G.scene.remove(cycleSprite);
        settleBox();
      }
    }, 180);

    function settleBox() {
      box.rolling = false;
      // teddy bear?
      var teddyChance = box.uses < 3 ? 0 : (box.uses < 5 ? 0.18 : 0.3);
      if (!I.fireSaleOn && Math.random() < teddyChance && G.map.boxSpots.length > 1) {
        G.audio.teddy();
        G.player.addPoints(CFG.BOX_COST); // refund
        G.hud.banner('TEDDY BEAR', '#f9c', 2, 'The box laughs and leaves');
        var next = box.spotIdx;
        while (next === box.spotIdx) next = (Math.random() * G.map.boxSpots.length) | 0;
        I.moveBox(next);
        return;
      }
      // two-stage rarity roll: pick a rarity bucket by the configured odds, then
      // a weapon within it. Normal firearms dominate; special/wonder weapons are
      // genuinely rare, never roll twice in a row, and are gated in early rounds.
      var owned = {};
      G.weapons.slots.forEach(function (s) { owned[s.id] = true; });
      var res = CFG.rollBoxWeapon({
        round: G.zombies ? G.zombies.round : 1,
        mapWonder: CFG.cur.wonder,
        owned: owned,
        recent: box.recent,
        lastRarity: box.lastRarity,
        includeMonkeys: !G.player.hasMonkeys
      }, Math.random);
      var chosen = res.id;
      box.lastRarity = res.rarity;
      box.recent.push(chosen);
      while (box.recent.length > 4) box.recent.shift();   // remember the last 4
      if (chosen === '_monkeys') {
        G.player.hasMonkeys = true;
        G.player.monkeys = CFG.MAX_MONKEYS;
        G.hud.banner('MONKEY BOMBS', '#fd7', 2, 'Throw with H');
        G.audio.monkeyJingle();
        box.mesh.userData.lid.position.y = 0.85;
        G.hud.setAmmo();
        return;
      }
      box.offer = chosen;
      box.offerTimer = 10;
      box.offerSprite = G.util.textSprite(CFG.WEAPONS[chosen].name, '#ffd700', 3.0);
      box.offerSprite.position.set(spot.pos.x, 1.8, spot.pos.z);
      G.scene.add(box.offerSprite);
    }
  }

  function takeOffer() {
    var box = I.box;
    if (!box.offer) return;
    G.weapons.giveWeapon(box.offer);
    G.audio.buy();
    box.offer = null;
    if (box.offerSprite) { G.scene.remove(box.offerSprite); box.offerSprite = null; }
    box.mesh.userData.lid.position.y = 0.85;
  }

  I.fireSale = function (on) {
    I.fireSaleOn = on;
    if (on) G.hud.banner('FIRE SALE', '#5bf', 2.5, 'Every box spot is live — 10 points');
  };

  /* --------------------------------------------------------------- update */
  function clearPapOffer() {
    if (I.pap.sprite) { G.scene.remove(I.pap.sprite); I.pap.sprite = null; }
    I.pap.packT = 0; I.pap.grabT = 0; I.pap.pending = null; I.pap.ready = null;
  }

  I.update = function (dt) {
    if (G.state !== 'playing') { G.player.consumeInteract(); return; }

    // traps: while active, damage zombies in the zone (on this floor only, via the
    // aoe Y-band) every 0.25s; then a cooldown before it can fire again
    (G.map.traps || []).forEach(function (tr) {
      if (tr.active > 0) {
        tr.active -= dt;
        tr._tick = (tr._tick || 0) + dt;
        if (tr._tick >= 0.25) { tr._tick = 0; G.zombies.aoe(tr.zone, tr.dps * 0.25, tr.radius, { y: tr.zone.y, slow: tr.type === 'cryo' ? 1.2 : 0 }); }
        if (tr.active <= 0) { tr.active = 0; tr.cooldown = 8; }
      } else if (tr.cooldown > 0) {
        tr.cooldown -= dt; if (tr.cooldown < 0) tr.cooldown = 0;
      }
    });

    // pack-a-punch: cook the gun (you're free to move), then float the upgraded
    // gun at the machine for a grab window before it fades back in
    if (I.pap.packT > 0) {
      I.pap.packT -= dt;
      if (I.pap.packT <= 0 && I.pap.pending) {
        I.pap.ready = I.pap.pending;
        I.pap.pending = null;
        I.pap.grabT = 12;
        I.pap.sprite = G.util.textSprite(I.pap.name, '#ffd76e', 3.0);
        I.pap.sprite.position.set(G.map.pap.pos.x, 1.9, G.map.pap.pos.z);
        G.scene.add(I.pap.sprite);
        G.audio.perkJingle();
      }
    } else if (I.pap.ready) {
      I.pap.grabT -= dt;
      if (I.pap.sprite) I.pap.sprite.position.y = 1.9 + Math.sin(G.time * 2) * 0.12;
      if (I.pap.grabT <= 0) {
        clearPapOffer();
        G.hud.banner('Upgrade faded back', '#b86', 1.6, 'Too slow — points lost');
      }
    }

    // soul chest idle pulse
    if (I.ee && I.ee.boxMesh && !I.ee.done) {
      var ps = 1 + Math.sin(G.time * 3) * 0.08;
      I.ee.boxMesh.scale.set(ps, ps, ps);
      I.ee.boxMesh.rotation.y += dt * 0.9;
    }

    // teleporter link countdowns
    G.map.teleporters.forEach(function (t) {
      if (t.linking) {
        t.linkTimer -= dt;
        if (t.linkTimer <= 0) {
          t.linking = false;
          G.hud.banner('Link window expired', '#f66', 1.5);
        }
      }
    });

    // mystery box offer countdown
    if (I.box.offer) {
      I.box.offerTimer -= dt;
      if (I.box.offerSprite) I.box.offerSprite.position.y = 1.8 + Math.sin(G.time * 2) * 0.1;
      if (I.box.offerTimer <= 0) {
        I.box.offer = null;
        if (I.box.offerSprite) { G.scene.remove(I.box.offerSprite); I.box.offerSprite = null; }
        I.box.mesh.userData.lid.position.y = 0.85;
      }
    }

    // nearest usable interactable IN VIEW — prompts reveal when you look at
    // an object (camera roughly facing it), with a point-blank fallback so you
    // can always interact when standing right on top of it
    var fwd = G.camera ? new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation) : null;
    var best = null, bd = 1e9;
    for (var i = 0; i < I.list.length; i++) {
      var it = I.list[i];
      var dx = it.pos.x - G.player.pos.x, dz = it.pos.z - G.player.pos.z;
      var d = Math.hypot(dx, dz);
      if (d >= it.r || d >= bd || !it.prompt()) continue;
      // height gate: only interact with things on your own floor (so you can't
      // buy a catwalk perk from the ground below, or vice-versa)
      if (Math.abs((G.player.pos.y || 0) - (it.pos.y || 0)) > 2.0) continue;
      var facing = true;
      if (fwd && d > 1.7) {
        var len = d || 1e-6;
        var dot = (fwd.x * dx + fwd.z * dz) / len;
        facing = dot > 0.4;        // within ~66° of where you're looking
      }
      if (facing) { bd = d; best = it; }
    }
    G.hud.setPrompt(best ? ((best.holdable ? '' : '[F] ') + best.prompt()) : null);

    var pressed = G.player.consumeInteract();
    if (G.gamepad && G.gamepad.consumeTap && G.gamepad.consumeTap()) pressed = true;
    if (G.remote && G.remote.consumeTap && G.remote.consumeTap()) pressed = true;
    if (best && !G.player.downed && !G.player.locked) {
      if (best.holdable) {
        if (G.keys.KeyF || (G.gamepad && G.gamepad.interactHeld) || (G.remote && G.remote.interactHeld)) best.hold(dt);
        else I.repairProgress = 0;
      } else if (pressed) {
        best.use();
      }
    }
  };
})();
