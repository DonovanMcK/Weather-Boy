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

    // perk machines
    map.perkMachines.forEach(function (pm) {
      var def = CFG.PERKS[pm.perk];
      add({
        pos: pm.pos, r: 2.2,
        prompt: function () {
          if (G.player.hasPerk(pm.perk)) return null;
          if (pm.perk === 'revive' && G.player.qrBuys >= CFG.QR_MAX_BUYS) return null;
          if (!map.power && pm.perk !== 'revive') return def.name + ' — needs power';
          if (G.player.perks.length >= CFG.MAX_PERKS) return 'Perk limit reached';
          return 'Buy ' + def.name + ' — ' + def.cost;
        },
        use: function () {
          if (G.player.hasPerk(pm.perk)) return;
          if (!map.power && pm.perk !== 'revive') { G.audio.deny(); return; }
          if (G.player.perks.length >= CFG.MAX_PERKS) { G.audio.deny(); return; }
          if (pm.perk === 'revive' && G.player.qrBuys >= CFG.QR_MAX_BUYS) { G.audio.deny(); return; }
          if (!G.player.spend(def.cost)) return;
          if (pm.perk === 'revive') G.player.qrBuys++;
          G.audio.drink();
          G.audio.perkJingle();
          G.player.addPerk(pm.perk);
          G.hud.banner(def.name + '!', '#' + new THREE.Color(def.color).getHexString(), 2);
        }
      });
    });

    // power switch
    add({
      pos: map.powerSwitch.pos, r: 2.4,
      prompt: function () { return map.power ? null : 'Turn on the POWER'; },
      use: function () {
        if (map.power) return;
        map.setPower();
        G.audio.powerOn();
        G.hud.banner('POWER ON', '#ff5', 3, 'The machines hum to life');
        map.powerSwitch.mesh.material.emissive = new THREE.Color(0x115511);
        if (CFG.cur.papRule === 'power' && !map.pap.unlocked) map.pap.unlock();
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
            G.player.pos.set(map.mainframe.pos.x, 0, map.mainframe.pos.z + 1.5);
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
          return CFG.cur.papRule === 'power'
            ? 'Pack-a-Punch — turn on the power'
            : 'Pack-a-Punch — link all 3 teleporters';
        }
        if (I.papBusy) return null;
        var gun = G.weapons.current();
        if (!gun) return null;
        if (gun.papped) return CFG.WEAPONS[gun.id].pap.name + ' is already upgraded';
        return 'Pack-a-Punch ' + CFG.WEAPONS[gun.id].name + ' — ' + CFG.PAP_COST;
      },
      use: function () {
        if (!map.pap.unlocked || I.papBusy) { G.audio.deny(); return; }
        var gun = G.weapons.current();
        if (!gun || gun.papped) { G.audio.deny(); return; }
        if (!G.player.spend(CFG.PAP_COST)) return;
        I.papBusy = true;
        G.player.locked = true;
        G.audio.papChug();
        if (gun.model) gun.model.visible = false;
        G.hud.banner('UPGRADING...', '#fb5', 2);
        setTimeout(function () {
          G.player.locked = false;
          I.papBusy = false;
          if (G.state !== 'playing') return;
          G.weapons.papCurrent();
          var s = G.weapons.stats(G.weapons.current());
          G.audio.perkJingle();
          G.hud.banner(s.name, '#fb5', 2.5, 'Upgraded — engraved with storm camo');
        }, 3500);
      }
    });

    // mystery box
    I.box = {
      spotIdx: 0, uses: 0, rolling: false, offer: null, offerTimer: 0,
      mesh: null, offerSprite: null
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
  function buildBoxMesh(pos) {
    var grp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.9), G.util.mat(0x6b4a2f));
    body.position.y = 0.4;
    grp.add(body);
    var lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 0.9),
      G.util.mat(0x222233, { emissive: new THREE.Color(0x4466ff), emissiveIntensity: 0.4 }));
    lid.position.y = 0.85;
    grp.add(lid);
    var q = G.util.textSprite('?', '#9cf', 1.2);
    q.position.y = 1.4;
    grp.add(q);
    grp.position.copy(pos);
    G.scene.add(grp);
    grp.userData.lid = lid;
    return grp;
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

  function boxPool() {
    return Object.keys(CFG.WEAPONS).filter(function (id) {
      var w = CFG.WEAPONS[id];
      if (!w.box) return false;
      if (w.wonder && id !== CFG.cur.wonder) return false; // map's own wonder only
      if (G.weapons.hasWeapon(id)) return false;
      return true;
    });
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
      // weighted weapon pick (monkeys count as a pseudo-roll)
      var pool = boxPool();
      var weights = pool.map(function (id) { return CFG.WEAPONS[id].box; });
      if (!G.player.hasMonkeys) { pool.push('_monkeys'); weights.push(CFG.MONKEY_BOX_WEIGHT); }
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      var pick = Math.random() * total, chosen = pool[0];
      for (var i = 0; i < pool.length; i++) {
        pick -= weights[i];
        if (pick <= 0) { chosen = pool[i]; break; }
      }
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
  I.update = function (dt) {
    if (G.state !== 'playing') { G.player.consumeInteract(); return; }

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

    // nearest usable interactable
    var best = null, bd = 1e9;
    for (var i = 0; i < I.list.length; i++) {
      var it = I.list[i];
      var d = Math.hypot(it.pos.x - G.player.pos.x, it.pos.z - G.player.pos.z);
      if (d < it.r && d < bd && it.prompt()) { bd = d; best = it; }
    }
    G.hud.setPrompt(best ? ((best.holdable ? '' : '[F] ') + best.prompt()) : null);

    var pressed = G.player.consumeInteract();
    if (best && !G.player.downed && !G.player.locked) {
      if (best.holdable) {
        if (G.keys.KeyF) best.hold(dt);
        else I.repairProgress = 0;
      } else if (pressed) {
        best.use();
      }
    }
  };
})();
