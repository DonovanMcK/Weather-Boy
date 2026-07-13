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

    /* ============== THE FOUNDER'S BARGAIN — the full quest chain ==============
       On Kurhaus (any map whose dressing registers kAnim.sigils) the easter egg
       is a seven-stage chain; other maps keep the classic mini egg (relics ->
       soul chest -> free perk). Stages, each gated on the last:
         0. POWER, then trace Voss's four chalk SIGILS in the Sanctum
         1. the marks burn -> his three hidden RELICS can now be woken
         2. relics wake the four elemental CURRENTS — each is its own trial:
              MOLTEN  (Caldera)    attune while the Molten Pour trap is firing
              FROZEN  (Frostworks) hold F and thaw the valve free
              DROWNED (Baths)      kneel (crouch) in the spring to reach it
              BURIED  (Cellar)     crack the bricked archway with an explosive
         3. the currents leave OFFERINGS behind — collect all four (emberstone,
            frostcore, spring pearl, grave brick; spawn spots seeded per match)
         4. raise the EFFIGY on the Sanctum ring (hold F) -> VOSS'S GHOST walks:
            hide-and-seek — corner him and he flees to another wing; find him
            THREE times
         5. where he falls, the SOUL CHEST wakes — feed it 30 kills
         6. he is listening — face the portrait and ACCEPT THE BARGAIN:
            the founder's buried Thundergun. His waltz plays you out.        */
    var KAq = (G.map.kAnim) || {};
    var questOn = !!(KAq.sigils && KAq.sigils.length);
    I.quest = { on: questOn, stage: 0, sigilsLit: 0, currents: 0, valves: [],
                offerings: 0, offeringItems: [], effigy: null, ghost: null, ghostFinds: 0, done: false };
    I.ee = { relics: [], activated: 0, box: null, boxMesh: null, glow: null,
             souls: 0, need: 30, done: false };

    // -- stage 0: the sigils (power-gated; silent until then)
    if (questOn) KAq.sigils.forEach(function (sg, sgi) {
      add({
        pos: sg.pos, r: 1.6,
        prompt: function () {
          if (!map.power || I.quest.stage > 0 || sg.lit) return null;
          return "Trace the founder's mark";
        },
        use: function () {
          if (!map.power || sg.lit || I.quest.stage > 0) return;
          sg.lit = true; I.quest.sigilsLit++;
          sg.mesh.material.color.setHex(0xd9b8ff);
          sg.mesh.scale.setScalar(1.35);
          G.audio.teleportCharge();
          if (I.quest.sigilsLit >= KAq.sigils.length) {
            I.quest.stage = 1;
            G.hud.banner('THE MARKS BURN', '#b790ff', 3.5, 'His treasures wake — find what he hid');
          } else G.hud.banner('The chalk glows… (' + I.quest.sigilsLit + '/4)', '#b790ff', 1.6);
        }
      });
    });

    // -- stage 1: the relics (3 of 9 authored spots, deterministic per match)
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
        prompt: function () {
          if (relic.active) return null;
          if (questOn && I.quest.stage < 1) return 'A cold pedestal — something must wake it';
          return 'Activate the relic';
        },
        use: function () {
          if (relic.active) return;
          if (questOn && I.quest.stage < 1) { G.audio.deny(); return; }
          relic.active = true; I.ee.activated++;
          if (relic.mesh.userData.activate) relic.mesh.userData.activate();
          G.audio.perkJingle();
          if (I.ee.activated >= I.ee.relics.length) {
            if (questOn) { I.quest.stage = 2; revealCurrents(); }
            else spawnSoulBox();
          } else G.hud.banner('RELIC ' + I.ee.activated + '/' + I.ee.relics.length, '#7fd', 2, 'Find the others…');
        }
      });
    });

    // -- stage 2: the four elemental currents, each its own trial
    function makeValve(name, color, pos, condPrompt, condOk, holdSecs) {
      var vg = new THREE.Group(); vg.position.copy(pos); vg.visible = false;
      var vm = new THREE.MeshLambertMaterial({ color: 0x6a6256 });
      var stub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8), vm); stub.position.y = 0.4; vg.add(stub);
      var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 14), new THREE.MeshLambertMaterial({ color: 0x9a7a3a }));
      wheel.position.y = 0.85; wheel.rotation.x = Math.PI / 2; vg.add(wheel);
      var orbM = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.35 });
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), orbM); orb.position.y = 1.05; vg.add(orb);
      G.scene.add(vg);
      var valve = { name: name, pos: pos, attuned: false, mesh: vg, held: 0 };
      I.quest.valves.push(valve);
      function attune() {
        valve.attuned = true; I.quest.currents++;
        orbM.opacity = 1; orb.scale.setScalar(1.8); wheel.rotation.z = 1.1;
        G.audio.teleLink();
        if (I.quest.currents >= 4) {
          I.quest.stage = 3;
          revealOfferings();
          G.hud.banner('THE CURRENTS RECEDE', '#7fd', 3.5, 'They left something behind — gather the offerings');
        } else G.hud.banner('CURRENT ATTUNED — ' + I.quest.currents + '/4', '#7fd', 2.2, name);
      }
      var item = {
        pos: new THREE.Vector3(pos.x, 0, pos.z), r: 1.9,
        prompt: function () {
          if (I.quest.stage !== 2 || valve.attuned) return null;
          return condOk() ? (holdSecs ? 'Hold F — thaw the ' + name : 'Attune the ' + name)
                          : name + ' — ' + condPrompt;
        },
        use: function () {
          if (I.quest.stage !== 2 || valve.attuned || holdSecs) { if (!valve.attuned && !holdSecs) G.audio.deny(); return; }
          if (!condOk()) { G.audio.deny(); return; }
          attune();
        }
      };
      if (holdSecs) {
        item.holdable = true;
        item.use = function () {};
        item.hold = function (dt) {
          if (I.quest.stage !== 2 || valve.attuned || !condOk()) return;
          valve.held += dt;
          if (valve.held >= holdSecs) attune();
        };
      }
      add(item);
      return valve;
    }
    function revealCurrents() {
      I.quest.valves.forEach(function (v) { v.mesh.visible = true; });
      G.hud.banner('THE CURRENTS STIR', '#7fd', 3.5, 'Attune the four currents of the spa');
    }
    if (questOn) {
      var rms = map.parsed.rooms;
      var vC = rms.V.center, fC = rms.F.center, bC = rms.B.center;
      makeValve('molten current', 0xff6a1e, new THREE.Vector3(vC.x + 1.35, 0, vC.z),
        'the melt sleeps (fire the Molten Pour)', function () {
          var tr = (map.traps || []).filter(function (t) { return t.type === 'molten'; })[0];
          return !!(tr && tr.active > 0);
        });
      makeValve('frozen current', 0xbfe7f0, new THREE.Vector3(fC.x - 2.8, 0, fC.z - 7.65),
        'frozen solid', function () { return true; }, 2.5);
      makeValve('drowned current', 0x3fd0c8, new THREE.Vector3(bC.x, 0, bC.z + 2.35),
        'kneel in the spring to reach it', function () {
          return G.player.stance === 'crouch' &&
                 Math.hypot(G.player.pos.x - bC.x, G.player.pos.z - bC.z) < 2.9;
        });
      if (KAq.arch) makeValve('buried current', 0x9c6cf0,
        new THREE.Vector3(KAq.arch.pos.x, 0, KAq.arch.pos.z - 0.85),
        'sealed behind brick (force it open)', function () { return !!KAq.arch.cracked; });
    }
    // explosions report in so the bricked archway can be FORCED open
    I.onBoom = function (pos) {
      if (!questOn || !KAq.arch || KAq.arch.cracked) return;
      if (I.quest.stage < 2) return;
      if (Math.hypot(pos.x - KAq.arch.pos.x, pos.z - KAq.arch.pos.z) > 3.4) return;
      KAq.arch.crack();
      G.audio.boardTear();
      G.hud.banner('The seal splits', '#b6f', 2.5, 'The buried current breathes');
    };

    // -- stage 3: the offerings — one keepsake per current, spawn spot seeded
    // per match (2 candidates each), invisible until the currents recede
    function makeOffering(name, color, spots, buildMesh) {
      var pick3 = spots[G.PU.hashStr(CFG.cur.id + ':off:' + name) % spots.length];
      var og = new THREE.Group(); og.position.set(pick3.x, 0, pick3.z); og.visible = false;
      buildMesh(og);
      var haloM = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4, depthWrite: false });
      var halo = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), haloM); halo.position.y = 0.45; og.add(halo);
      G.scene.add(og);
      var off = { name: name, pos: og.position, mesh: og, taken: false };
      I.quest.offeringItems.push(off);
      add({
        pos: new THREE.Vector3(pick3.x, 0, pick3.z), r: 1.8,
        prompt: function () { return (I.quest.stage === 3 && !off.taken) ? 'Take the ' + name : null; },
        use: function () {
          if (I.quest.stage !== 3 || off.taken) return;
          off.taken = true; I.quest.offerings++;
          og.visible = false;
          G.audio.buy();
          if (I.quest.offerings >= 4)
            G.hud.banner('THE OFFERINGS ARE GATHERED', '#b790ff', 3.5, 'Raise the effigy on the founder\'s ring');
          else G.hud.banner('OFFERING ' + I.quest.offerings + '/4', '#7fd', 2, name);
        }
      });
      return off;
    }
    function revealOfferings() { I.quest.offeringItems.forEach(function (o) { if (!o.taken) o.mesh.visible = true; }); }
    var effigyPos = null;
    if (questOn) {
      var rms2 = map.parsed.rooms;
      var vC2 = rms2.V.center, fC2 = rms2.F.center, bC2 = rms2.B.center, mC2 = rms2.M.center, nC2 = rms2.N.center;
      effigyPos = new THREE.Vector3(nC2.x, 0, nC2.z);
      makeOffering('emberstone', 0xff6a1e,
        [{ x: vC2.x - 7.6, z: vC2.z + 3.4 }, { x: vC2.x + 7.4, z: vC2.z + 3.4 }],   // 2nd spot moved off the trap console (audit)
        function (g2) { var r3 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 7), new THREE.MeshLambertMaterial({ color: 0x2a1c16 })); r3.position.y = 0.2; r3.scale.y = 0.7; g2.add(r3); });
      makeOffering('frostcore', 0xbfe7f0,
        [{ x: fC2.x - 3.7, z: fC2.z - 6.4 }, { x: fC2.x + 6.2, z: fC2.z + 7.2 }],
        function (g2) { var c4 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 7), new THREE.MeshLambertMaterial({ color: 0xbfe7f0 })); c4.position.y = 0.25; g2.add(c4); });
      makeOffering('spring pearl', 0x3fd0c8,
        [{ x: bC2.x - 2.2, z: bC2.z + 1.3 }, { x: bC2.x - 8.2, z: bC2.z - 7.0 }],
        function (g2) { var p4 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 9), new THREE.MeshLambertMaterial({ color: 0xe8e4d8 })); p4.position.y = 0.18; g2.add(p4); });
      makeOffering('grave brick', 0x9c6cf0,
        [{ x: (KAq.arch ? KAq.arch.pos.x : mC2.x) - 3.4, z: mC2.z + 8.2 }, { x: mC2.x - 6.5, z: mC2.z - 5.0 }],   // clear of the buried valve + Mule Kick (audit)
        function (g2) { var b4 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.2), new THREE.MeshLambertMaterial({ color: 0x5a2e26 })); b4.position.y = 0.15; b4.rotation.y = 0.5; g2.add(b4); });

      // -- stage 4: raise the effigy on the Sanctum ring (hold F), then the GHOST
      var effigyG = null;
      add({
        pos: effigyPos, r: 2.2, holdable: true, _held: 0,
        prompt: function () {
          if (I.quest.stage !== 3 || I.quest.offerings < 4) return null;
          return 'Hold F — raise the effigy';
        },
        hold: function (dt) {
          if (I.quest.stage !== 3 || I.quest.offerings < 4) return;
          this._held += dt;
          if (this._held < 2.0) return;
          I.quest.stage = 4;
          // the effigy: plinth, tapered totem, the four offerings set at its feet
          effigyG = new THREE.Group(); effigyG.position.copy(effigyPos);
          var stone = new THREE.MeshLambertMaterial({ color: 0x4a4442 });
          [[1.0, 0.3, 0], [0.62, 0.7, 0.62], [0.4, 0.9, 1.35], [0.24, 0.5, 2.1]].forEach(function (t4) {
            var seg = new THREE.Mesh(new THREE.BoxGeometry(t4[0], t4[1], t4[0]), stone);
            seg.position.y = t4[2] + t4[1] / 2; effigyG.add(seg);
          });
          var crownO = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xb790ff })); crownO.position.y = 2.85; effigyG.add(crownO);
          [0xff6a1e, 0xbfe7f0, 0x3fd0c8, 0x9c6cf0].forEach(function (oc, oi) {
            var oo = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 7), new THREE.MeshBasicMaterial({ color: oc }));
            var oa = oi / 4 * Math.PI * 2; oo.position.set(Math.cos(oa) * 0.65, 0.36, Math.sin(oa) * 0.65); effigyG.add(oo);
          });
          G.scene.add(effigyG);
          G.map.addCollider(effigyPos.x - 0.55, effigyPos.z - 0.55, effigyPos.x + 0.55, effigyPos.z + 0.55, 0, 2.6);
          spawnGhost(true);
          G.audio.ghostWail();
          G.hud.banner('THE EFFIGY STANDS', '#b790ff', 4, 'Something walks the halls — corner him, three times');
        }
      });

      // -- the ghost hunt: he stands in a random wing; get close and he flees.
      // Corner him three times and the soul chest wakes where he fell.
      var ghostRooms = (CFG.cur.SURGE_ROOMS || ['V', 'F', 'N', 'B', 'M', 'A']);
      function ghostSpot(exclude) {
        var pRoom = map.roomAt(G.player.pos.x, G.player.pos.z, 0);
        var pool2 = ghostRooms.filter(function (r5) { return r5 !== exclude && r5 !== pRoom; });
        var pick4 = pool2[(Math.random() * pool2.length) | 0] || ghostRooms[0];
        return { room: pick4, c: map.parsed.rooms[pick4].center };
      }
      function buildGhostMesh() {
        var gg = new THREE.Group();
        var gm = new THREE.MeshBasicMaterial({ color: 0xb790ff, transparent: true, opacity: 0.38, depthWrite: false });
        var body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), gm);
        body.scale.set(0.7, 1.6, 0.7); body.position.y = 1.0; gg.add(body);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 9), gm.clone()); head.material.opacity = 0.5;
        head.position.y = 1.85; gg.add(head);
        var core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 7), new THREE.MeshBasicMaterial({ color: 0xe8dcff }));
        core.position.y = 1.15; gg.add(core);
        return gg;
      }
      function spawnGhost(first) {
        var spot2 = ghostSpot(I.quest.ghost ? I.quest.ghost.room : null);
        if (!I.quest.ghost) {
          I.quest.ghost = { mesh: buildGhostMesh(), room: spot2.room, pos: new THREE.Vector3() };
          G.scene.add(I.quest.ghost.mesh);
        }
        I.quest.ghost.room = spot2.room;
        I.quest.ghost.pos.set(spot2.c.x, 0, spot2.c.z);
        I.quest.ghost.mesh.position.copy(I.quest.ghost.pos);
        if (!first) G.audio.ghostWail();
      }
      I.foundGhost = function () {
        var q2 = I.quest;
        q2.ghostFinds++;
        if (q2.ghostFinds >= 3) {
          var lastPos = q2.ghost.pos.clone();
          G.scene.remove(q2.ghost.mesh); q2.ghost = null;
          q2.stage = 5;
          G.audio.ghostWail();
          G.hud.banner('CORNERED', '#b790ff', 3.5, 'He sinks into the floor — something wakes where he fell');
          spawnSoulBox(lastPos);
        } else {
          G.hud.banner('FOUND HIM — ' + q2.ghostFinds + '/3', '#b790ff', 2.5, 'He flees…');
          spawnGhost(false);
        }
      };
    }

    // -- stage 5: the soul chest (30 kills fed to the machine heart). The quest
    // spawns it where the ghost fell; the classic egg uses the authored cell.
    function spawnSoulBox(atPos) {
      if (I.ee.box || (!atPos && !CFG.EE_SOULBOX)) return;
      if (atPos) I.ee.box = atPos.clone();
      else { var wc = CFG.cellToWorld(CFG.EE_SOULBOX[0], CFG.EE_SOULBOX[1]); I.ee.box = new THREE.Vector3(wc.x, 0, wc.z); }
      I.ee.boxMesh = G.Props.create('soul_chest', { position: I.ee.box });
      I.ee.glow = null;   // the chest carries its own internal glow light
      G.hud.banner('SOUL CHEST AWAKENED', '#b6f', 3, 'Feed it kills nearby');
    }
    function rewardSoulBox() {
      var ee = I.ee; ee.done = true;
      if (ee.boxMesh) G.scene.remove(ee.boxMesh);
      if (ee.glow) G.scene.remove(ee.glow);
      if (questOn) {                       // stage 6: the bargain awaits upstairs
        I.quest.stage = 6;
        G.hud.banner('HE IS LISTENING', '#b790ff', 4, 'Face the founder in his sanctum');
        return;
      }
      if (G.awardFeat) G.awardFeat('ee');
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

    // -- stage 4: accept the bargain at the portrait
    if (questOn && KAq.voss) add({
      pos: KAq.voss.pos, r: 2.2,
      prompt: function () {
        if (I.quest.done) return null;
        if (I.quest.stage !== 6) return null;
        return "Accept the Founder's Bargain";
      },
      use: function () {
        if (I.quest.stage !== 6 || I.quest.done) return;
        I.quest.done = true; I.quest.stage = 5;
        if (G.awardFeat) G.awardFeat('ee');
        if (KAq.face) KAq.face.material.color.setHex(0xffc86a);   // he smiles
        if (CFG.cur.eeWonder && CFG.WEAPONS[CFG.cur.eeWonder] && !G.weapons.hasWeapon(CFG.cur.eeWonder)) {
          G.weapons.giveWeapon(CFG.cur.eeWonder);
          G.hud.banner("THE FOUNDER'S BARGAIN", '#e8c35a', 5, 'His buried prize: the ' + CFG.WEAPONS[CFG.cur.eeWonder].name);
        } else {
          G.weapons.maxAmmo(); G.player.addPoints(5000);
          G.hud.banner("THE FOUNDER'S BARGAIN", '#e8c35a', 5, 'Max Ammo + 5000 points');
        }
        G.audio.vossWaltz();
      }
    });

    // --- musical easter egg (Kurhaus): wind Voss's three gramophone cranks,
    // in any order, and his waltz plays through the halls. Pure secret — no
    // prompt hints exist anywhere else; you find them or you don't.
    if (CFG.cur.id === 'kurhaus') {
      var cranks = { wound: 0, need: 3 };
      var brassM = new THREE.MeshLambertMaterial({ color: 0x9a7a3a });
      var darkM = new THREE.MeshLambertMaterial({ color: 0x2e2620 });
      [{ cell: [11, 15], face: 'S' },     // Foyer, east of the spawn windows
       { cell: [2, 1],   face: 'N' },     // Sanctum, beside the library
       { cell: [14, 11], face: 'S' }      // Cold Cellar, by the bricked archway
      ].forEach(function (loc) {
        var m = wallMount(loc.cell, loc.face, 0.18, 0);
        var g = new THREE.Group();
        g.position.copy(m.pos); g.position.y = 1.05; g.rotation.y = m.yaw;
        var base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.34), darkM); g.add(base);
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 10, 1, true), brassM);
        horn.rotation.x = -Math.PI / 2.6; horn.position.set(0, 0.3, 0.1); g.add(horn);
        var crank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), brassM);
        crank.position.set(0.26, 0, 0); g.add(crank);
        G.scene.add(g);
        var wound = false;
        add({
          pos: new THREE.Vector3(m.pos.x, 0, m.pos.z), r: 1.7,
          prompt: function () { return wound ? null : 'Wind the gramophone'; },
          use: function () {
            if (wound) return;
            wound = true; cranks.wound++;
            crank.rotation.z = 1.2;
            G.audio.buy();
            if (cranks.wound >= cranks.need) {
              G.audio.vossWaltz();
              G.hud.banner("VOSS'S WALTZ", '#e8c35a', 4, 'The house remembers the music');
            } else G.hud.banner('The mechanism clicks…', '#cba', 1.6);
          }
        });
      });
    }

    /* ================== THE ELEMENTAL RITES (Kurhaus) ======================
       Four elemental rooms, four rites — each a 3-step side quest, independent
       of the Founder's Bargain, live once the power is on. Completing a rite
       IGNITES that room's altar; any ignited altar infuses your CURRENT weapon
       with its element (visit another altar to swap at will):
         MOLTEN (Caldera):  pluck a cinder -> cast it into the melt -> 6 kills
         FROZEN (Frostworks): chip the engineer free (hold F) -> close the
                              3 tank valves -> 6 kills
         DROWNED (Baths):   gather 2 mineral salts -> kneel + stir the spring
                            -> 6 kills
         GRAVE (Cellar):    read the warding X -> still the 3 hanging
                            carcasses -> 6 kills
       Element procs (weapons.applyElement): molten ignites, frozen chills,
       drowned scalds the crowd, grave shatters legs.                        */
    if (CFG.cur.id === 'kurhaus' && G.map.kAnim && G.map.kAnim.rite) {
      var RK = G.map.kAnim.rite, KAr = G.map.kAnim;
      var rr3 = map.parsed.rooms;
      var EL = {
        molten:  { room: 'V', color: 0xff6a1e, label: 'Molten' },
        frozen:  { room: 'F', color: 0xbfe7f0, label: 'Frozen' },
        drowned: { room: 'B', color: 0x3fd0c8, label: 'Drowned' },
        grave:   { room: 'M', color: 0x9c6cf0, label: 'Grave' }
      };
      I.rites = {};
      Object.keys(EL).forEach(function (el) { I.rites[el] = { step: 0, sub: 0, kills: 0, done: false }; });
      function riteAdvance(el, line) {
        var r6 = I.rites[el]; r6.step++; r6.sub = 0;
        G.audio.teleportCharge();
        if (r6.step === 2) G.hud.banner(EL[el].label.toUpperCase() + ' RITE', '#' + new THREE.Color(EL[el].color).getHexString(), 2.6, line + ' — now feed it six kills in this room');
        else G.hud.banner(EL[el].label.toUpperCase() + ' RITE', '#' + new THREE.Color(EL[el].color).getHexString(), 2.2, line);
      }
      function riteComplete(el) {
        var r6 = I.rites[el]; r6.done = true;
        if (r6.altarFx) r6.altarFx();
        G.audio.perkJingle();
        G.hud.banner(EL[el].label.toUpperCase() + ' ALTAR IGNITED', '#' + new THREE.Color(EL[el].color).getHexString(), 3.2, 'Infuse your weapon at its altar');
      }
      // rite kill counting rides the same kill sink as the soul chest
      var chestKill = I.onKill;
      I.onKill = function (pos) {
        Object.keys(EL).forEach(function (el) {
          var r6 = I.rites[el];
          if (r6.done || r6.step !== 2) return;
          if (map.roomAt(pos.x, pos.z, 0) !== EL[el].room) return;
          r6.kills++;
          if (r6.kills >= 6) riteComplete(el);
          else if (r6.kills % 2 === 0) G.hud.banner(EL[el].label + ' rite — ' + r6.kills + '/6 kills', '#cba', 1.2);
        });
        chestKill(pos);
      };

      // --- MOLTEN: cinder from a crate -> into the melt -> kills
      if (RK.crates.length) add({
        pos: new THREE.Vector3(RK.crates[0].x, 0, RK.crates[0].z), r: 1.8,
        prompt: function () { return (map.power && I.rites.molten.step === 0) ? 'Pluck a live cinder from the core crate' : null; },
        use: function () { if (map.power && I.rites.molten.step === 0) riteAdvance('molten', 'The cinder sears your palm'); }
      });
      add({
        pos: new THREE.Vector3(rr3.V.center.x, 0, rr3.V.center.z), r: 3.4,
        prompt: function () { return I.rites.molten.step === 1 ? 'Cast the cinder into the melt' : null; },
        use: function () { if (I.rites.molten.step === 1) riteAdvance('molten', 'The melt accepts it'); }
      });

      // --- FROZEN: chip the engineer free (hold) -> close 3 valves -> kills
      if (RK.ice) add({
        pos: new THREE.Vector3(RK.ice.x, 0, RK.ice.z), r: 2.0, holdable: true, _h: 0,
        prompt: function () { return (map.power && I.rites.frozen.step === 0) ? 'Hold F — chip the engineer free' : null; },
        hold: function (dt) {
          if (!map.power || I.rites.frozen.step !== 0) return;
          this._h += dt;
          if (this._h >= 3) riteAdvance('frozen', 'His frozen hand gives up a valve key');
        }
      });
      RK.tanks.forEach(function (tk) {
        var closed = false;
        add({
          pos: new THREE.Vector3(tk.x, 0, tk.z), r: 2.1,
          prompt: function () { return (I.rites.frozen.step === 1 && !closed) ? 'Close the coolant valve (' + I.rites.frozen.sub + '/' + RK.tanks.length + ')' : null; },
          use: function () {
            if (I.rites.frozen.step !== 1 || closed) return;
            closed = true; I.rites.frozen.sub++;
            G.audio.buy();
            if (I.rites.frozen.sub >= RK.tanks.length) riteAdvance('frozen', 'The coolant stills');
          }
        });
      });

      // --- DROWNED: 2 mineral salts -> kneel + stir the spring -> kills
      [{ x: rr3.B.center.x + 2.4, z: rr3.B.center.z + 1.6 }, { x: rr3.B.center.x - 2.6, z: rr3.B.center.z - 1.5 }].forEach(function (sp3) {
        var got = false;
        var pile = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 8),
          new THREE.MeshLambertMaterial({ color: 0xe8e4d8 }));
        pile.position.set(sp3.x, 0.1, sp3.z); G.scene.add(pile);
        add({
          pos: new THREE.Vector3(sp3.x, 0, sp3.z), r: 1.7,
          prompt: function () { return (map.power && I.rites.drowned.step === 0 && !got) ? 'Gather the mineral salt' : null; },
          use: function () {
            if (!map.power || I.rites.drowned.step !== 0 || got) return;
            got = true; I.rites.drowned.sub++; pile.visible = false;
            G.audio.buy();
            if (I.rites.drowned.sub >= 2) riteAdvance('drowned', 'Salt for the water');
          }
        });
      });
      add({
        pos: new THREE.Vector3(rr3.B.center.x, 0, rr3.B.center.z), r: 2.6,
        prompt: function () {
          if (I.rites.drowned.step !== 1) return null;
          return G.player.stance === 'crouch' ? 'Stir the spring' : 'Kneel in the spring (crouch)';
        },
        use: function () {
          if (I.rites.drowned.step !== 1 || G.player.stance !== 'crouch') { if (I.rites.drowned.step === 1) G.audio.deny(); return; }
          riteAdvance('drowned', 'The water remembers');
        }
      });

      // --- GRAVE: read the warding X -> still the 3 carcasses -> kills
      // (offset EAST of the arch centre — the relic pedestal and the buried
      // valve own the centre ground; audit flagged a 0.13m prompt collision)
      if (KAr.arch) add({
        pos: new THREE.Vector3(KAr.arch.pos.x + 2.2, 0, KAr.arch.pos.z - 0.5), r: 1.6,
        prompt: function () { return (map.power && I.rites.grave.step === 0) ? 'Read the warding X' : null; },
        use: function () { if (map.power && I.rites.grave.step === 0) riteAdvance('grave', 'The chalk is a name, written backwards'); }
      });
      RK.hooks.forEach(function (hk) {
        var stilled = false;
        add({
          pos: new THREE.Vector3(hk.x, 0, hk.z), r: 1.9,
          prompt: function () { return (I.rites.grave.step === 1 && !stilled) ? 'Still the hanging meat (' + I.rites.grave.sub + '/' + RK.hooks.length + ')' : null; },
          use: function () {
            if (I.rites.grave.step !== 1 || stilled) return;
            stilled = true; I.rites.grave.sub++;
            G.audio.buy();
            if (I.rites.grave.sub >= RK.hooks.length) riteAdvance('grave', 'The cellar goes quiet');
          }
        });
      });

      // --- the four ALTARS — cold until their rite completes, then infuse at will
      var altarSpots = {
        molten:  { x: rr3.V.center.x - 5.0, z: rr3.V.center.z + 7.8 },
        frozen:  { x: rr3.F.center.x + 6.5, z: rr3.F.center.z + 2.2 },
        drowned: { x: rr3.B.center.x + 6.8, z: rr3.B.center.z + 6.8 },
        grave:   { x: rr3.M.center.x + 6.8, z: rr3.M.center.z + 6.8 }
      };
      Object.keys(EL).forEach(function (el) {
        var spot4 = altarSpots[el], def4 = EL[el];
        var ag = new THREE.Group(); ag.position.set(spot4.x, 0, spot4.z);
        var stone4 = new THREE.MeshLambertMaterial({ color: 0x4a4442 });
        var base4 = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.9, 8), stone4); base4.position.y = 0.45; ag.add(base4);
        var bowl4 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.16, 10), stone4); bowl4.position.y = 0.98; ag.add(bowl4);
        var orbM4 = new THREE.MeshBasicMaterial({ color: def4.color, transparent: true, opacity: 0.18 });
        var orb4 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 9), orbM4); orb4.position.y = 1.18; ag.add(orb4);
        var flame4 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8),
          new THREE.MeshBasicMaterial({ color: def4.color, transparent: true, opacity: 0.65 }));
        flame4.position.y = 1.35; flame4.visible = false; ag.add(flame4);
        G.scene.add(ag);
        I.rites[el].altarFx = function () { orbM4.opacity = 0.95; flame4.visible = true; };
        add({
          pos: new THREE.Vector3(spot4.x, 0, spot4.z), r: 2.0,
          prompt: function () {
            if (!I.rites[el].done) return map.power ? 'A cold altar' : null;
            var gun6 = G.weapons.current();
            if (!gun6) return null;
            if (gun6.element === el) return CFG.WEAPONS[gun6.id].name + ' is ' + def4.label + '-bound';
            return 'Infuse ' + CFG.WEAPONS[gun6.id].name + ' — ' + def4.label;
          },
          use: function () {
            if (!I.rites[el].done) { G.audio.deny(); return; }
            var gun6 = G.weapons.current();
            if (!gun6 || gun6.element === el) return;
            gun6.element = el;
            G.audio.perkJingle();
            G.hud.setAmmo && G.hud.setAmmo();
            G.hud.banner(def4.label.toUpperCase() + '-BOUND', '#' + new THREE.Color(def4.color).getHexString(), 2.6,
              CFG.WEAPONS[gun6.id].name + ' carries the ' + def4.label.toLowerCase() + ' current');
          }
        });
      });
    }

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
        if (gun.dpap) return (gun.variant ? 'Re-roll Ascension' : 'ASCEND') + ' ' +
          CFG.WEAPONS[gun.id].pap.name + ' — ' + CFG.TPAP_COST + ' (variant)';
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
            var vdef2 = I.pap.ready.variant && CFG.PAP_VARIANTS[I.pap.ready.variant];
            G.hud.banner(vdef2 ? I.pap.ready && G.weapons.stats(I.pap.ready).name : I.pap.name, '#fb5', 3,
              vdef2 ? 'ASCENDED — ' + vdef2.desc
                    : I.pap.dbl ? 'Double-packed — Dead Wire electric rounds' : 'Upgraded — storm camo');
          }
          clearPapOffer();
          return;
        }
        if (I.pap.packT > 0) { G.audio.deny(); return; }   // still in the machine
        var gun = G.weapons.current();
        if (!gun) { G.audio.deny(); return; }
        var asc = gun.dpap;                                // third+ pass = Ascension variant
        var dbl = gun.papped && !asc;                      // second pass = double-pack
        if (!G.player.spend(asc ? CFG.TPAP_COST : dbl ? CFG.DPAP_COST : CFG.PAP_COST)) return;
        G.audio.papChug();
        // you keep moving (and firing) while it cooks — no lock
        I.pap.packT = 3.5;
        I.pap.pending = gun;
        I.pap.dbl = dbl;
        I.pap.name = CFG.WEAPONS[gun.id].pap.name + (asc ? ' — ASCENDED' : dbl ? ' II' : '');
        G.hud.banner(asc ? 'ASCENDING…' : dbl ? 'DOUBLE-PACKING…' : 'UPGRADING…', '#fb5', 2, 'Grab it from the machine');
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

    // the ghost hunt: he hovers and sways where he stands; corner him (get
    // close) and he wails away to another wing — I.foundGhost counts it
    if (I.quest && I.quest.ghost) {
      var gh = I.quest.ghost;
      gh.mesh.position.y = 0.15 + Math.sin(G.time * 1.7) * 0.12;
      gh.mesh.rotation.y = Math.sin(G.time * 0.6) * 0.5;
      // he always faces the player — you're being watched
      var gdx = G.player.pos.x - gh.pos.x, gdz = G.player.pos.z - gh.pos.z;
      gh.mesh.rotation.y = Math.atan2(gdx, gdz);
      if (Math.hypot(gdx, gdz) < 4.0) I.foundGhost();
    }

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
