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

    // perk machines (and the Der Wunderfizz random-perk vendor)
    map.perkMachines.forEach(function (pm) {
      var def = CFG.PERKS[pm.perk];
      if (def && def.vendor) { addWunderfizz(pm, def); return; }
      add({
        pos: pm.pos, r: 2.2,
        prompt: function () {
          if (G.player.hasPerk(pm.perk)) return null;
          if (pm.perk === 'revive' && G.player.qrBuys >= CFG.QR_MAX_BUYS) return null;
          if (!map.power && pm.perk !== 'revive') return def.name + ' — needs power';
          if (G.player.perks.length >= (G.settings.perkLimit || CFG.MAX_PERKS)) return 'Perk limit reached';
          return 'Buy ' + def.name + ' — ' + def.cost;
        },
        use: function () {
          if (G.player.hasPerk(pm.perk)) return;
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

    // Group 935 settings terminal — a console in spawn (no collider, so it
    // never blocks a training lane)
    var tsp = CFG.cellToWorld(CFG.PLAYER_SPAWN.cell[0], CFG.PLAYER_SPAWN.cell[1]);
    var tpos = new THREE.Vector3(tsp.x + 1.9, 0, tsp.z);
    G.util.addBox(0.8, 1.05, 0.55, tpos.x, 0.52, tpos.z, G.util.mat(0x14201c));
    G.util.addBox(0.72, 0.5, 0.1, tpos.x, 1.2, tpos.z,
      G.util.mat(0x0c241d, { emissive: new THREE.Color(0x33d6a0), emissiveIntensity: 0.8 }));
    add({
      pos: tpos, r: 2.2,
      prompt: function () { return G.terminal ? 'Settings terminal' : null; },
      use: function () { if (G.terminal) G.terminal.open(); }
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
      mesh: null, offerSprite: null, recent: []
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
    var woodMat = new THREE.MeshPhongMaterial({ map: G.tex.wood, color: 0x9a7448, shininess: 8 });
    var bandMat = new THREE.MeshPhongMaterial({ map: G.tex.metal, color: 0x6b7079, shininess: 45,
      specular: new THREE.Color(0x888f99) });
    var glowMat = new THREE.MeshPhongMaterial({ color: 0x101830,
      emissive: new THREE.Color(0x3a6bff), emissiveIntensity: 0.6, shininess: 60 });
    function part(w, h, d, x, y, z, m) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z); grp.add(b); return b;
    }
    // crate body + corner posts + steel banding
    part(1.7, 0.8, 0.9, 0, 0.42, 0, woodMat);
    [[-0.82, -0.42], [0.82, -0.42], [-0.82, 0.42], [0.82, 0.42]].forEach(function (c) {
      part(0.1, 0.84, 0.1, c[0], 0.42, c[1], bandMat);
    });
    part(1.74, 0.1, 0.94, 0, 0.18, 0, bandMat);     // lower band
    part(1.74, 0.1, 0.94, 0, 0.66, 0, bandMat);     // upper band
    part(0.22, 0.34, 0.06, 0, 0.42, 0.46, bandMat); // front latch plate
    part(0.1, 0.12, 0.05, 0, 0.3, 0.49, glowMat);   // latch
    // hinged lid (animated open via userData.lid.position.y)
    var lid = part(1.74, 0.16, 0.94, 0, 0.9, 0, woodMat);
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.06, 0.98), bandMat));
    // glowing blue question mark panel on the lid
    var qTex = questionTexture();
    var q = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: qTex, transparent: true }));
    q.position.set(0, 0.09, 0); q.rotation.x = -Math.PI / 2;
    lid.add(q);
    var glow = new THREE.PointLight(0x4a7bff, 0.6, 4);
    glow.position.y = 1.1; grp.add(glow);
    grp.position.copy(pos);
    G.scene.add(grp);
    grp.userData.lid = lid;
    return grp;
  }

  function questionTexture() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = 'rgba(10,20,50,0.85)'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#6ea8ff'; c.lineWidth = 5; c.strokeRect(6, 6, 116, 116);
    c.font = 'bold 96px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#bcd8ff'; c.shadowColor = '#3a6bff'; c.shadowBlur = 18;
    c.fillText('?', 64, 70);
    return new THREE.CanvasTexture(cv);
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
      // weighted weapon pick (monkeys count as a pseudo-roll); recent rolls are
      // excluded so you don't get the same gun two-three times in a row
      var pool = boxPool(true);
      var weights = pool.map(function (id) { return CFG.WEAPONS[id].box; });
      if (!G.player.hasMonkeys && box.recent.indexOf('_monkeys') < 0) {
        pool.push('_monkeys'); weights.push(CFG.MONKEY_BOX_WEIGHT);
      }
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      var pick = Math.random() * total, chosen = pool[0];
      for (var i = 0; i < pool.length; i++) {
        pick -= weights[i];
        if (pick <= 0) { chosen = pool[i]; break; }
      }
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
