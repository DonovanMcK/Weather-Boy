/* ===========================================================================
   DER WETTERJUNGE — zombies.js
   Round director, window spawns, flow-field pathfinding, hellhound rounds.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var CFG = null;

  // melee contact ranges (horizontal metres). Player radius ~0.42 + zombie
  // body ~0.35 + a short arm reach. A zombie must be this close to start a
  // swing, and still this close at the swing's apex for it to land.
  var MELEE_START = 1.25;
  var MELEE_HIT = 1.4;
  var MELEE_VERT = 1.7;   // a swipe only lands on the same level (no hits through floors)
  var STEP_MAX = 1.2;     // max cell-to-cell elevation the flow-field will path across
  // zombies climb in once a barricade is torn down to this many boards (of 6)
  var BREAK_GAP = 0;   // zombies only climb in once ALL boards are torn off

  var Z = G.zombies = {
    list: [],
    lure: null,            // {pos, proj} monkey bomb override
    flowDirty: true,
    round: 0,
    mode: 'break',         // break | active | dogs
    toSpawn: 0,
    spawnTimer: 0,
    breakTimer: 2.5,
    groanTimer: 1,
    lightning: 0,
    _shootables: [],
    _shootablesDirty: true
  };

  /* ------------------------------------------------------------- models */
  var zmats = null;
  function zombiePalette() {
    if (!zmats) {
      var mk = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
      zmats = {
        skins: [0x7d8a62, 0x8a7a62, 0x6f8068, 0x6a7a85].map(mk),
        cloths: [0x4f4f66, 0x655036, 0x40554a, 0x584358, 0x5a4a3a].map(mk),
        pants: [0x3b3e48, 0x474038, 0x363f3b, 0x44363a].map(mk),
        gore: mk(0x6a1212),
        dark: mk(0x23262b)
      };
      zmats.gore.emissive = new THREE.Color(0x220404);
    }
    function pick(a) { return a[(Math.random() * a.length) | 0]; }
    return { skin: pick(zmats.skins), cloth: pick(zmats.cloths), pants: pick(zmats.pants) };
  }

  function shadowBlob(scale) {
    var sp = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale),
      new THREE.MeshBasicMaterial({ map: G.tex.blob, transparent: true, depthWrite: false }));
    sp.rotation.x = -Math.PI / 2;
    sp.position.y = 0.02;
    return sp;
  }

  function buildZombieMesh(z) {
    var g = new THREE.Group();
    var m = zombiePalette();
    function box(w, h, d, x, y, zz, mt) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt);
      b.position.set(x, y, zz);
      return b;
    }
    function pivotAt(x, y, zz) {
      var p = new THREE.Object3D();
      p.position.set(x, y, zz);
      g.add(p);
      return p;
    }
    // hips + hunched chest
    g.add(box(0.42, 0.24, 0.27, 0, 0.97, 0, m.pants));
    var chest = box(0.55, 0.56, 0.32, 0, 1.32, -0.03, m.cloth);
    chest.rotation.x = 0.14;
    g.add(chest);
    // torn collar + gore patches
    chest.add(box(0.57, 0.08, 0.34, 0, 0.26, 0, m.skin));
    for (var gp = 0; gp < 2; gp++) {
      chest.add(box(0.12 + Math.random() * 0.12, 0.1 + Math.random() * 0.14, 0.02,
        (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, -0.165, zmats.gore));
    }
    // head with jaw + glowing eyes
    var headPivot = pivotAt(0, 1.66, -0.1);
    var skull = box(0.3, 0.27, 0.3, 0, 0.1, 0, m.skin);
    headPivot.add(skull);
    headPivot.add(box(0.31, 0.07, 0.31, 0, 0.25, 0.01, zmats.dark));
    var jaw = box(0.26, 0.09, 0.26, 0, -0.07, -0.02, m.skin);
    headPivot.add(jaw);
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
    skull.add(box(0.06, 0.045, 0.02, -0.08, 0.02, -0.155, eyeMat));
    skull.add(box(0.06, 0.045, 0.02, 0.08, 0.02, -0.155, eyeMat));
    // two-segment arms reaching forward
    function arm(side) {
      var sh = pivotAt(side * 0.345, 1.5, -0.02);
      sh.add(box(0.14, 0.34, 0.14, 0, -0.17, 0, m.cloth));
      var elbow = new THREE.Object3D();
      elbow.position.set(0, -0.34, 0);
      sh.add(elbow);
      elbow.add(box(0.12, 0.3, 0.12, 0, -0.15, 0, m.skin));
      elbow.add(box(0.13, 0.1, 0.15, 0, -0.34, -0.01, m.skin));
      sh.rotation.x = -1.3;
      elbow.rotation.x = -0.25;
      return { sh: sh, elbow: elbow };
    }
    var aL = arm(-1), aR = arm(1);
    // two-segment legs
    function leg(side) {
      var hip = pivotAt(side * 0.14, 0.95, 0);
      hip.add(box(0.18, 0.4, 0.2, 0, -0.2, 0, m.pants));
      var knee = new THREE.Object3D();
      knee.position.set(0, -0.4, 0);
      hip.add(knee);
      knee.add(box(0.15, 0.42, 0.16, 0, -0.21, 0, m.pants));
      knee.add(box(0.16, 0.09, 0.27, 0, -0.46, -0.05, zmats.dark));
      return { hip: hip, knee: knee };
    }
    var lL = leg(-1), lR = leg(1);
    g.add(shadowBlob(1.2));
    g.scale.setScalar(0.94 + Math.random() * 0.14);
    chest.userData = { zombie: z, part: 'body' };
    skull.userData = { zombie: z, part: 'head' };
    z.parts = {
      torso: chest, head: skull, headPivot: headPivot, jaw: jaw,
      armL: aL.sh, armR: aR.sh, elbL: aL.elbow, elbR: aR.elbow,
      legL: lL.hip, legR: lR.hip, kneeL: lL.knee, kneeR: lR.knee
    };
    z.hitMeshes = [chest, skull];
    return g;
  }

  function buildDogMesh(z) {
    var g = new THREE.Group();
    var hide = new THREE.MeshLambertMaterial({ color: 0x2c1a12 });
    var lava = new THREE.MeshLambertMaterial({ color: 0x441505, emissive: 0xcc3300, emissiveIntensity: 0.85 });
    function box(w, h, d, x, y, zz, mt) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt || hide);
      b.position.set(x, y, zz);
      return b;
    }
    var body = box(0.4, 0.4, 0.85, 0, 0.62, 0.05);
    g.add(body);
    body.add(box(0.42, 0.1, 0.6, 0, 0.18, -0.05, lava));
    g.add(box(0.46, 0.44, 0.32, 0, 0.64, -0.42));
    var neck = new THREE.Object3D();
    neck.position.set(0, 0.78, -0.55);
    g.add(neck);
    var skull = box(0.26, 0.24, 0.28, 0, 0.05, -0.08);
    neck.add(skull);
    skull.add(box(0.15, 0.12, 0.22, 0, -0.04, -0.22));
    var jaw = box(0.13, 0.05, 0.2, 0, -0.12, -0.2);
    skull.add(jaw);
    skull.add(box(0.06, 0.1, 0.04, -0.09, 0.16, 0.02, lava));
    skull.add(box(0.06, 0.1, 0.04, 0.09, 0.16, 0.02, lava));
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    skull.add(box(0.05, 0.04, 0.02, -0.07, 0.04, -0.22, eyeMat));
    skull.add(box(0.05, 0.04, 0.02, 0.07, 0.04, -0.22, eyeMat));
    var tail = new THREE.Object3D();
    tail.position.set(0, 0.72, 0.48);
    g.add(tail);
    tail.add(box(0.06, 0.06, 0.3, 0, 0.05, 0.15, lava));
    var legs = [];
    [[-0.15, -0.3], [0.15, -0.3], [-0.15, 0.34], [0.15, 0.34]].forEach(function (p) {
      var pivot = new THREE.Object3D();
      pivot.position.set(p[0], 0.48, p[1]);
      pivot.add(box(0.1, 0.42, 0.11, 0, -0.2, 0));
      pivot.add(box(0.11, 0.07, 0.15, 0, -0.44, -0.02, lava));
      g.add(pivot);
      legs.push(pivot);
    });
    g.add(shadowBlob(1.3));
    body.userData = { zombie: z, part: 'body' };
    skull.userData = { zombie: z, part: 'head' };
    z.parts = { torso: body, body: body, head: skull, neck: neck, jaw: jaw, tail: tail, legs: legs };
    z.hitMeshes = [body, skull];
    return g;
  }

  /* ---------------------------------------------------------- flow field */
  var flowTimer = 0, flowTarget = null;
  // pathfinding now lives in the multi-layer nav engine (js/nav.js). These
  // wrappers keep the round-director code tidy and rebuild the graph lazily
  // when a door opens.
  function refreshField(target) {
    if (G.nav.dirty) G.nav.build();
    G.nav.computeField(target);
  }
  function navTarget(z) {
    return G.nav.nextPoint(z.mesh.position.x, z.mesh.position.z, z.mesh.position.y);
  }

  /* ------------------------------------------------------------ spawning */
  function pickWindow() {
    var pool = [];
    // zombies come from the barriers (windows) — i.e. from OUTSIDE the play
    // space — wherever a reachable one exists
    G.map.windows.forEach(function (w) {
      if (!G.map.reachableRooms[w.room]) return;
      var d = w.pos.distanceTo(G.player.pos);
      var weight = 1 / (1 + d * 0.06);
      if (w.boards <= BREAK_GAP) weight *= 2.5;   // funnel through already-open holes
      pool.push({ w: w, weight: weight });
    });
    // ground risers are a FALLBACK ONLY: used when the player is somewhere with
    // no reachable window to feed from (otherwise zombies always come from the
    // barriers, never out of the middle of the floor)
    if (pool.length === 0) {
      var playerRoom = G.map.roomAt(G.player.pos.x, G.player.pos.z, G.player.pos.y);
      (G.map.risers || []).forEach(function (rs) {
        if (rs.room === playerRoom) pool.push({ riser: rs.pos, weight: 1 });
      });
      if (pool.length === 0) (G.map.risers || []).forEach(function (rs) { pool.push({ riser: rs.pos, weight: 1 }); });
    }
    // last resort: any window at all, so a round can never stall for lack of a spot
    if (pool.length === 0) G.map.windows.forEach(function (w) { pool.push({ w: w, weight: 1 }); });
    if (pool.length === 0) return null;
    var total = 0;
    pool.forEach(function (p) { total += p.weight; });
    var pick = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      pick -= pool[i].weight;
      if (pick <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function spawnZombie() {
    var z = {
      isDog: false, dead: false, crawler: false,
      hp: CFG.zombieHealth(Z.round),
      speed: 0, state: 'rise', t: 0,
      attackCd: 0, tearTimer: 0, vaultT: 0,
      animT: Math.random() * 9
    };
    var sprint = Math.random() < CFG.sprinterFraction(Z.round);
    var roundBump = Math.min(1.1, Z.round * 0.045); // rounds get progressively faster
    z.speed = (sprint ? 3.4 + Math.random() * 0.9 : 1.5 + Math.random() * 0.8) + roundBump;
    z.mesh = buildZombieMesh(z);
    // from round 6 on, the OCCASIONAL armored heavy joins — kept rare (a low
    // per-spawn chance) and capped at a few alive at once so they never swarm
    var armoredAlive = 0;
    for (var ai = 0; ai < Z.list.length; ai++) if (Z.list[ai].armored && !Z.list[ai].dead) armoredAlive++;
    if (Z.round >= 6 && armoredAlive < 3 &&
        Math.random() < Math.min(0.1, 0.03 + Z.round * 0.004)) {
      z.hp = Math.round(z.hp * 1.25);
      z.speed *= 0.9;
      addArmor(z);
    }
    var spot = pickWindow();
    if (!spot) return;
    if (spot.riser) {
      z.mesh.position.copy(spot.riser);
      z.mesh.position.x += (Math.random() - 0.5) * 2;
      z.mesh.position.z += (Math.random() - 0.5) * 2;
      z.window = null;
      z.state = 'rise';
    } else {
      z.window = spot.w;
      z.mesh.position.copy(spot.w.outside);
      z.mesh.position.x += (Math.random() - 0.5) * 1.5;
      z.mesh.position.z += (Math.random() - 0.5) * 1.5;
      z.state = 'rise';
    }
    // the floor this zombie spawns onto (0 for flat maps; the window/riser's Y on
    // a stacked map) — drives rise/vault so it surfaces on the RIGHT floor and so
    // the void-despawn doesn't kill it while it's outside the window in the void
    z._spawnY = spot.riser ? (spot.riser.y || 0) : (spot.w.outside.y || 0);
    z.mesh.position.y = z._spawnY - 1.9;
    G.scene.add(z.mesh);
    Z.list.push(z);
    Z._shootablesDirty = true;
  }

  function spawnDog() {
    var z = {
      isDog: true, dead: false, crawler: false,
      hp: Math.min(1600, 100 + Z.round * 60),
      speed: 5.4, state: 'chase', t: 0,
      attackCd: 0, animT: Math.random() * 9
    };
    z.mesh = buildDogMesh(z);
    // spawn at a far passable cell in a reachable room
    var P = G.map.parsed, options = [];
    Object.keys(P.rooms).forEach(function (rid) {
      if (!G.map.reachableRooms[rid]) return;
      P.rooms[rid].cells.forEach(function (cr) {
        var wc = CFG.cellToWorld(cr[0], cr[1]);
        var d = Math.hypot(wc.x - G.player.pos.x, wc.z - G.player.pos.z);
        if (d > 9) options.push(wc);
      });
    });
    var wc = options[(Math.random() * options.length) | 0] || { x: G.player.pos.x + 10, z: G.player.pos.z };
    z.mesh.position.set(wc.x, 0, wc.z);
    G.scene.add(z.mesh);
    Z.list.push(z);
    Z._shootablesDirty = true;
    // lightning strike effect at spawn
    Z.lightning = 0.25;
    G.audio.thunderClap();
    var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 14, 6),
      new THREE.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.9 }));
    bolt.position.set(wc.x, 7, wc.z);
    G.scene.add(bolt);
    G.map.effects.push(Object.assign(bolt, { userData: { vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0.25 } }));
  }

  // a single tanky elite that actively HUNTS: beelines the horde flow-field,
  // and from mid-range telegraphs and CHARGES — a heavy hit that knocks you
  // back. Less of a slow bullet-sponge, more of a threat you must juke.
  function spawnBoss() {
    var z = {
      isDog: false, isBoss: true, dead: false, crawler: false,
      hp: Math.round(1800 + Z.round * 550),
      speed: 2.7 + Math.min(1.0, Z.round * 0.02),
      state: 'chase', t: 0, attackCd: 0, animT: Math.random() * 9,
      bossPhase: null, phT: 0, chargeCd: 3.5, chargeHit: false
    };
    z.mesh = buildZombieMesh(z);
    z.mesh.scale.set(1.7, 1.85, 1.7);          // looms over the horde
    z.bossLight = new THREE.PointLight(0xff3311, 1.6, 9);
    z.bossLight.position.set(0, 2.4, 0);
    z.mesh.add(z.bossLight);
    var P = G.map.parsed, options = [];
    Object.keys(P.rooms).forEach(function (rid) {
      if (!G.map.reachableRooms[rid]) return;
      P.rooms[rid].cells.forEach(function (cr) {
        var wc = CFG.cellToWorld(cr[0], cr[1]);
        if (Math.hypot(wc.x - G.player.pos.x, wc.z - G.player.pos.z) > 9) options.push(wc);
      });
    });
    var wc = options[(Math.random() * options.length) | 0] || { x: G.player.pos.x + 10, z: G.player.pos.z };
    z.mesh.position.set(wc.x, 0, wc.z);
    G.scene.add(z.mesh);
    Z.list.push(z);
    Z._shootablesDirty = true;
    Z.lightning = 0.3;
    G.audio.thunderClap();
    G.hud.banner('PANZERSOLDAT', '#f64', 3, 'An elite stalks the storm');
    return z;
  }
  Z.spawnBoss = spawnBoss;     // exposed for the director + tests
  Z.spawnQuestBoss = function (weaponId) {
    var z = spawnBoss();
    z.questBoss = true; z.questRequiredWeapon = weaponId;
    z.questArmorHits = 6; z.questArmorBroken = false;
    z.hp = Math.max(14000, Math.round(6000 + Z.round * 650)); z.hpMax = z.hp;
    z.speed = 3.15; z.mesh.scale.set(2.0, 2.15, 2.0);
    addArmor(z);
    if (z.bossLight) z.bossLight.color.setHex(0x79ffe0);
    var core = CFG.cellToWorld(8, 8);
    z.mesh.position.set(core.x, 0, core.z);
    G.hud.banner('THE IRON SUBJECT', '#79ffe0', 4,
      'Break its plating with ' + (CFG.WEAPONS[weaponId] ? CFG.WEAPONS[weaponId].name : 'the quest weapon'));
    return z;
  };
  Z.bossAlive = function () { return Z.list.some(function (z) { return z.isBoss && !z.dead; }); };

  // Panzersoldat AI. Returns true (z.bossBusy) on frames it drives its own
  // motion (telegraph / charge / recover), so the normal chase state is skipped.
  function bossThink(z, dt) {
    z.bossBusy = false;
    if (G.player.downed) { z.bossPhase = null; return; }
    var dx = G.player.pos.x - z.mesh.position.x, dz = G.player.pos.z - z.mesh.position.z;
    var dist = Math.hypot(dx, dz);
    z.chargeCd -= dt;

    if (z.bossPhase === 'tele') {            // wind-up: lock on, glow flares, roar
      z.bossBusy = true; z.phT -= dt;
      if (z.bossLight) z.bossLight.intensity = 1.4 + Math.abs(Math.sin(z.t * 18)) * 2.0;
      z.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
      if (z.phT <= 0) {
        z.bossPhase = 'charge'; z.phT = 1.5; z.chargeHit = false;
        var L = dist || 1; z.chargeDir = { x: dx / L, z: dz / L };
        G.audio.zombieScream(dist);
      }
      return;
    }
    if (z.bossPhase === 'charge') {          // barrel forward; heavy hit + knockback
      z.bossBusy = true; z.phT -= dt;
      var bx = z.mesh.position.x, bz = z.mesh.position.z, sp = 9.5;
      z.mesh.position.x += z.chargeDir.x * sp * dt;
      z.mesh.position.z += z.chargeDir.z * sp * dt;
      collideZombie(z);
      z.mesh.rotation.y = Math.atan2(z.chargeDir.x, z.chargeDir.z) + Math.PI;
      var moved = Math.hypot(z.mesh.position.x - bx, z.mesh.position.z - bz);
      if (!z.chargeHit && dist < 2.4 &&
          !G.map.losBlocked(z.mesh.position.x, z.mesh.position.z, G.player.pos.x, G.player.pos.z, z.mesh.position.y)) {
        z.chargeHit = true;
        if (G.player.shieldBlocks && G.player.shieldBlocks(z.mesh.position.x, z.mesh.position.z)) {
          G.audio.zombieAttack();
        } else {
          G.player.damage(Math.round(CFG.zombieMeleeDamage(Z.round) * 1.8), z.mesh.position.x, z.mesh.position.z);
          if (G.player.knockback) G.player.knockback(z.chargeDir.x, z.chargeDir.z, 2.6);
          G.audio.zombieAttack();
        }
      }
      if (z.phT <= 0 || z.chargeHit || moved < sp * dt * 0.3) { z.bossPhase = 'recover'; z.phT = 1.0; }
      return;
    }
    if (z.bossPhase === 'recover') {         // brief stagger before it can hunt again
      z.bossBusy = true; z.phT -= dt;
      if (z.bossLight) z.bossLight.intensity = 1.6;
      if (z.phT <= 0) { z.bossPhase = null; z.chargeCd = 5 + Math.random() * 3; }
      return;
    }
    // idle hunting: launch a charge from mid-range
    if (z.chargeCd <= 0 && dist > 4.5 && dist < 18) {
      z.bossPhase = 'tele'; z.phT = 0.8; z.bossBusy = true;
      G.audio.thunderClap();
    }
  }

  /* --------------------------------------------------------------- rounds */
  Z.start = function () {
    CFG = G.CFG;
    Z.round = 0;
    Z.nextBoss = 8 + ((Math.random() * 5) | 0);   // first elite around round 8-12
    Z.mode = 'break';
    Z.breakTimer = 3;
  };

  // jump the round director (settings terminal): clear the field and queue
  // round n to begin on the next break tick
  Z.jumpToRound = function (n) {
    n = Math.max(1, Math.floor(n || 1));
    Z.list.slice().forEach(function (z) { G.scene.remove(z.mesh); });
    Z.list = [];
    Z._shootablesDirty = true;
    Z.round = n - 1;
    Z.toSpawn = 0;
    Z.mode = 'break';
    Z.breakTimer = 1.2;
  };

  function beginRound() {
    Z.round++;
    if (G.player.giantHeartRoundStart) G.player.giantHeartRoundStart();
    G.hud.setRound(Z.round);
    var isDogRound = Z.round % CFG.DOG_EVERY === 0;
    if (isDogRound) {
      Z.mode = 'dogs';
      Z.toSpawn = CFG.dogsForRound(Z.round);
      Z.spawnTimer = 2;
      G.audio.dogRoundStart();
      G.hud.banner('HELLHOUNDS', '#f44', 3, 'The storm unleashes its dogs...');
    } else {
      Z.mode = 'active';
      Z.toSpawn = CFG.zombiesForRound(Z.round);
      Z.spawnTimer = 1;
      G.audio.roundSting();
      G.hud.banner('ROUND ' + Z.round, '#c11', 2.5);
      if (Z.round >= 15 && G.awardFeat) G.awardFeat('r15');
      // AETHER SURGE — on maps that declare surge rooms, some rounds a random
      // wing lights up: double points for kills inside it until the round ends.
      // Pulls players OFF their groove to chase the bonus — per-match variation.
      G.map.surge = null;
      var sr = CFG.cur.SURGE_ROOMS;
      if (sr && sr.length && Z.round >= 4 && Math.random() < 0.4) {
        var pick2 = sr[(Math.random() * sr.length) | 0];
        var room2 = G.map.parsed.rooms[pick2];
        if (room2 && room2.center) {
          G.map.surge = { room: pick2, center: room2.center };
          if (G.map.surgeRing) G.map.surgeRing.position.set(room2.center.x, 0.09, room2.center.z);
          var rname = (CFG.ROOMS[pick2] && CFG.ROOMS[pick2].name) || pick2;
          G.hud.banner('AETHER SURGE', '#b790ff', 3.2, 'Double points in ' + rname + ' this round');
          G.audio.powerup();
        }
      }
      // boss round: drop one elite into the mix (player-toggleable)
      var bossOn = !G.settings || G.settings.bossRounds !== false;
      if (bossOn && Z.round >= Z.nextBoss && !Z.bossAlive()) {
        spawnBoss();
        Z.nextBoss = Z.round + 8 + ((Math.random() * 5) | 0);
      }
    }
  }

  function endRound(lastPos) {
    if (Z.mode === 'dogs' && lastPos) {
      G.powerups.spawn('maxammo', lastPos.clone());
    }
    G.map.surge = null;                     // an aether surge lasts one round
    Z.mode = 'break';
    Z.breakTimer = CFG.ROUND_BREAK;
    G.hud.banner('Round ' + (Z.round + 1) + ' incoming...', '#999', 2);
  }

  Z.aliveCount = function () {
    var n = 0;
    Z.list.forEach(function (z) { if (!z.dead) n++; });
    return n;
  };

  /* --------------------------------------------------------------- damage */
  Z.shootables = function () {
    if (Z._shootablesDirty) {
      Z._shootables = [];
      Z.list.forEach(function (z) {
        if (!z.dead) Z._shootables.push.apply(Z._shootables, z.hitMeshes);
      });
      Z._shootablesDirty = false;
    }
    return Z._shootables;
  };

  Z.damageZombie = function (z, dmg, opts) {
    if (z.dead) return;
    opts = opts || {};
    var insta = G.powerups.timers.insta > 0;
    if (insta) dmg = 1e9;
    // The Iron Subject's sealed plating only responds to the wonder weapon
    // awarded by the base quest. Six solid contacts crack it; after that the
    // player may finish the exposed experiment normally.
    if (z.questBoss && !z.questArmorBroken && !insta) {
      if (opts.weaponId !== z.questRequiredWeapon) {
        if (!z._wrongWeaponT || G.time > z._wrongWeaponT) {
          z._wrongWeaponT = G.time + 1.2;
          G.hud.banner('PLATING REJECTS THE HIT', '#f88', 1.1, 'Use the Giant\'s awarded weapon');
        }
        return;
      }
      z.questArmorHits--;
      if (z.questArmorHits > 0) {
        G.hud.banner('IRON PLATING ' + z.questArmorHits + '/6', '#9fe8ff', 0.8);
        return;
      }
      z.questArmorBroken = true;
      breakArmor(z);
      G.hud.banner('THE ARMOR SPLITS', '#79ffe0', 2.5, 'Finish the Iron Subject');
      dmg *= 0.35;
    }
    // armored "heavy": plating shrugs off body shots; headshots, knife and
    // explosives bypass it. Sustained damage cracks the armor off at ~40% hp.
    if (z.armored && !insta && !opts.head && !opts.knife && !opts.boom) dmg *= 0.4;
    z.hp -= dmg;
    if (!opts.boom) G.player.addPoints(CFG.PTS.hit);
    if (z.hp <= 0) {
      killZombie(z, opts);
    } else {
      if (z.armored && z.hp <= z.hpMax * 0.4) breakArmor(z);
      if (opts.crawlers && !z.isDog && !z.crawler && Math.random() < 0.5) makeCrawler(z);
    }
  };

  function breakArmor(z) {
    z.armored = false;
    (z.armorParts || []).forEach(function (m) { z.mesh.remove(m); });
    z.armorParts = null;
    G.hud.hitmarker(true);
    G.audio.hitmark(true);
  }

  // strap salvaged plating onto a zombie: a chest plate, shoulder pads, helmet
  function addArmor(z) {
    z.armored = true;
    z.hpMax = z.hp;
    var mat = new THREE.MeshPhongMaterial({ map: G.tex.metal, color: 0x55585f, shininess: 35,
      specular: new THREE.Color(0x888d96) });
    z.armorParts = [];
    function piece(w, h, d, x, y, zz, ry) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, zz); if (ry) m.rotation.y = ry;
      z.mesh.add(m); z.armorParts.push(m); return m;
    }
    piece(0.66, 0.58, 0.42, 0, 1.02, 0.02);     // chest plate
    piece(0.26, 0.2, 0.34, -0.42, 1.28, 0);      // left pauldron
    piece(0.26, 0.2, 0.34, 0.42, 1.28, 0);       // right pauldron
    piece(0.46, 0.34, 0.46, 0, 1.66, 0);         // helmet
  }

  // area-of-effect damage (perks, shields, traps, bosses). Optionally slows
  // (webs) survivors. Returns how many zombies were caught.
  Z.aoe = function (pos, dmg, radius, opts) {
    opts = opts || {};
    // optional Y-band: an explosion / trap only hits zombies on its OWN floor, so
    // a Floor-B blast can't damage zombies stacked above it (default: hit any Y,
    // which is unchanged for flat maps where every zombie is at y~0)
    var yb = opts.y == null ? null : opts.y;
    var n = 0;
    for (var i = Z.list.length - 1; i >= 0; i--) {
      var z = Z.list[i];
      if (z.dead) continue;
      if (yb !== null && Math.abs(z.mesh.position.y - yb) > 2.5) continue;
      var d = Math.hypot(z.mesh.position.x - pos.x, z.mesh.position.z - pos.z);
      if (d > radius) continue;
      if (opts.slow) z.slowT = Math.max(z.slowT || 0, opts.slow);
      Z.damageZombie(z, dmg, { boom: !!opts.boom });
      n++;
    }
    return n;
  };

  function makeCrawler(z) {
    z.crawler = true;
    z.speed = Math.max(0.7, z.speed * 0.45);
    z.mesh.remove(z.parts.legL);
    z.mesh.remove(z.parts.legR);
    z.crawlOffset = -0.8;
  }

  function killZombie(z, opts) {
    if (z.dead) return;
    if (!opts.silent) G.audio.deathGurgle(z.mesh.position.distanceTo(G.player.pos));
    z.dead = true;
    z.state = 'dying';
    z.t = 0;
    Z._shootablesDirty = true;
    var pts = CFG.PTS.kill;
    if (opts.knife) pts = CFG.PTS.knifeKill;
    else if (opts.head) pts = CFG.PTS.headKill;
    else if (opts.boom) pts = CFG.PTS.boomKill;
    if (z.isBoss) pts = 1000;
    // AETHER SURGE: kills inside the surging wing pay double for the round
    if (G.map.surge && G.map.roomAt &&
        G.map.roomAt(z.mesh.position.x, z.mesh.position.z, z.mesh.position.y) === G.map.surge.room) pts *= 2;
    if (!opts.silent) G.player.addPoints(pts);
    G.player.kills++;
    G.hud.hitmarker(true);
    if (z.isBoss) {
      // an elite always drops a Max Ammo and clears its red glow
      if (z.bossLight) z.mesh.remove(z.bossLight);
      G.powerups.spawn('maxammo', z.mesh.position.clone());
      G.hud.banner('ELITE DOWN', '#f84', 2.5, 'Max Ammo dropped');
    } else if (!opts.silent) {
      G.powerups.maybeDrop(z.mesh.position);
    }
    if (G.interact && G.interact.onKill) G.interact.onKill(z.mesh.position, z, opts);
    if (!opts.silent && G.weapons.variantKill) G.weapons.variantKill(z.mesh.position);  // tier-3 PaP procs
    if (!opts.silent && G.weapons.superKill) G.weapons.superKill(z.mesh.position);
    checkRoundEnd(z);
  }

  function checkRoundEnd(lastZ) {
    if (Z.toSpawn <= 0 && Z.aliveCount() === 0 && (Z.mode === 'active' || Z.mode === 'dogs')) {
      endRound(lastZ ? lastZ.mesh.position : null);
    }
  }

  Z.fling = function (z, dir) {
    if (z.dead) return;
    z.state = 'flung';
    z.flingVel = new THREE.Vector3(dir.x * 11, 6.5, dir.z * 11);
    G.player.addPoints(CFG.PTS.hit);
  };

  // when the player goes down, the horde fades out and respawns after the
  // revive instead of camping the body
  Z.despawnForDown = function () {
    var n = 0;
    Z.list.forEach(function (z) {
      if (!z.dead) {
        z.dead = true;
        z.state = 'dying';
        z.t = 0;
        n++;
      }
    });
    Z.toSpawn += n;
    Z._shootablesDirty = true;
  };

  Z.killAll = function () {
    Z.list.forEach(function (z) {
      if (!z.dead) killZombie(z, { boom: true, silent: true });
    });
  };

  /* --------------------------------------------------------------- update */
  function separation(z) {
    var push = new THREE.Vector3();
    for (var i = 0; i < Z.list.length; i++) {
      var o = Z.list[i];
      if (o === z || o.dead) continue;
      var dx = z.mesh.position.x - o.mesh.position.x;
      var dz = z.mesh.position.z - o.mesh.position.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-6) {
        var d = Math.sqrt(d2);
        push.x += dx / d * (0.8 - d);
        push.z += dz / d * (0.8 - d);
      }
    }
    return push;
  }

  function collideZombie(z) {
    var cols = G.map.colliders, r = 0.35;
    var feet = z.mesh.position.y, head = feet + 1.7;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (!c.on) continue;
      // mirror the player rules: stand on tops, pass beneath overhead colliders,
      // and treat low steps as mountable instead of blocking
      if (feet >= c.y2 - 0.55) continue;
      if (head <= c.y1 + 0.02) continue;
      var nx = Math.max(c.x1, Math.min(z.mesh.position.x, c.x2));
      var nz = Math.max(c.z1, Math.min(z.mesh.position.z, c.z2));
      var dx = z.mesh.position.x - nx, dz = z.mesh.position.z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) {
        var d = Math.sqrt(d2);
        z.mesh.position.x = nx + dx / d * r;
        z.mesh.position.z = nz + dz / d * r;
      }
    }
  }

  function moveToward(z, target, dt) {
    var dx = target.x - z.mesh.position.x, dz = target.z - z.mesh.position.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.04) return;
    var desX = dx / d, desZ = dz / d;
    if (!z.heading) z.heading = { x: desX, z: desZ };
    // stall detection: if a chasing zombie has barely moved (pinned on a corner
    // or stuck sliding a contour), commit hard to the nav direction with a
    // perpendicular nudge so it peels off and rounds the obstacle
    var moved = z._ppos ? Math.hypot(z.mesh.position.x - z._ppos.x, z.mesh.position.z - z._ppos.z) : 1;
    if (!z._ppos) z._ppos = { x: 0, z: 0 };
    z._ppos.x = z.mesh.position.x; z._ppos.z = z.mesh.position.z;
    z._stall = (moved < 0.012 && z.slowT <= 0) ? (z._stall || 0) + dt : 0;
    if (z._stall > 0.4) {
      if (z._jit === undefined) z._jit = Math.random() < 0.5 ? -0.6 : 0.6;
      z.heading.x = desX - desZ * z._jit;
      z.heading.z = desZ + desX * z._jit;
    } else {
      // smooth the heading so turns are continuous, not 90-degree grid snaps
      var turn = Math.min(1, dt * 11);
      z.heading.x += (desX - z.heading.x) * turn;
      z.heading.z += (desZ - z.heading.z) * turn;
    }
    var hl = Math.hypot(z.heading.x, z.heading.z) || 1;
    var hx = z.heading.x / hl, hz = z.heading.z / hl;
    var sp = z.speed;
    if (z.isDog && d < 6) sp *= 1.35; // lunge burst
    if (z.slowT > 0) sp *= 0.3;       // webbed (Widow's Wine) — crawl speed
    z.mesh.position.x += hx * sp * dt;
    z.mesh.position.z += hz * sp * dt;
    var sep = separation(z);
    z.mesh.position.addScaledVector(sep, dt * 4);
    collideZombie(z);
    z.mesh.rotation.y = Math.atan2(hx, hz) + Math.PI;
  }

  function animate(z, dt, moving) {
    z.animT += dt * (moving ? z.speed * 2.4 : 1);
    var s = Math.sin(z.animT);
    var P = z.parts;
    if (z.isDog) {
      // gallop: front pair and back pair alternate, body bounces, tail wags
      P.legs.forEach(function (leg, i) {
        leg.rotation.x = Math.sin(z.animT * 2 + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.5) * 0.75;
      });
      if (P.body) P.body.position.y = 0.62 + Math.abs(Math.sin(z.animT * 2)) * 0.06;
      if (P.tail) P.tail.rotation.y = Math.sin(z.animT * 4) * 0.5;
      if (P.neck) P.neck.rotation.x = Math.sin(z.animT * 2) * 0.08;
      if (P.jaw) P.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(z.animT * 3)) * 0.4;
    } else {
      // shamble: thighs swing, knees flex on the back-swing, head lolls
      if (!z.crawler) {
        P.legL.rotation.x = s * 0.55;
        P.legR.rotation.x = -s * 0.55;
        P.kneeL.rotation.x = Math.max(0, -s) * 0.85;
        P.kneeR.rotation.x = Math.max(0, s) * 0.85;
      }
      if (z.state !== 'tear' && z.state !== 'attack') {
        var reach = z.crawler ? -1.6 : -1.3;
        var sway = z.crawler ? 0.5 : 0.16;
        P.armL.rotation.x = reach + s * sway;
        P.armR.rotation.x = reach - s * sway;
        P.elbL.rotation.x = -0.25 + Math.max(0, s) * 0.2;
        P.elbR.rotation.x = -0.25 + Math.max(0, -s) * 0.2;
      }
      if (P.headPivot) {
        P.headPivot.rotation.z = Math.sin(z.animT * 0.7) * 0.08;
        P.headPivot.rotation.x = 0.1 + Math.sin(z.animT * 0.45) * 0.06;
      }
      if (P.jaw) P.jaw.rotation.x = 0.1 + Math.max(0, Math.sin(z.animT * 1.7)) * 0.35;
    }
    if (z.state === 'attack' && !z.isDog) {
      var k = Math.sin(z.t * 12);
      P.armL.rotation.x = -1.9 + k * 0.5;
      P.armR.rotation.x = -1.9 - k * 0.5;
      P.elbL.rotation.x = -0.5 - k * 0.3;
      P.elbR.rotation.x = -0.5 + k * 0.3;
      if (P.jaw) P.jaw.rotation.x = 0.5;
    }
    // states below manage their own y; everything else rests on the support
    // height under the zombie (floor, stairs or a deck) so they climb catwalks
    // spawn states (rise/towindow/tear/vault) manage their own Y at the window's
    // floor — exempt them from the support-snap AND the void-despawn (a zombie
    // outside its window stands over the void until it vaults in)
    var freeY = z.state === 'rise' || z.state === 'dying' || z.state === 'flung' ||
                z.state === 'vault' || z.state === 'towindow' || z.state === 'tear';
    if (!freeY) {
      var base = G.map.supportAt
        ? G.map.supportAt(z.mesh.position.x, z.mesh.position.z, z.mesh.position.y, 0.6) : 0;
      // void fall (off a sunk floor / atrium edge): no floor beneath -> supportAt
      // returns the deep void baseline. Flag for relocate/respawn rather than
      // letting the body sink forever.
      if (base < (G.map.minFloorY || 0) - 8) { z._void = true; return; }
      z.mesh.position.y = base + (z.crawler ? z.crawlOffset : 0);
    }
  }

  Z.update = function (dt) {
    if (G.state !== 'playing') return;
    var i, z;

    // round director
    if (Z.mode === 'break') {
      Z.breakTimer -= dt;
      if (Z.breakTimer <= 0) beginRound();
    } else if (Z.toSpawn > 0) {
      Z.spawnTimer -= dt;
      var interval = Z.mode === 'dogs' ? 1.6 : CFG.spawnInterval(Z.round);
      if (Z.spawnTimer <= 0 && Z.aliveCount() < CFG.MAX_ALIVE && !G.player.downed) {
        Z.spawnTimer = interval;
        Z.toSpawn--;
        if (Z.mode === 'dogs') spawnDog(); else spawnZombie();
      }
    }

    // layered flow-field refresh (multi-floor pathing toward the player/lure)
    flowTimer -= dt;
    var target = Z.lure ? Z.lure.pos : G.player.pos;
    if (Z.flowDirty || G.nav.dirty || flowTimer <= 0 || (flowTarget && flowTarget.distanceToSquared(target) > 4)) {
      refreshField(target);
      flowTarget = target.clone();
      flowTimer = 0.4;
      Z.flowDirty = false;
    }

    // lightning decay (dog rounds)
    if (Z.lightning > 0) {
      Z.lightning -= dt;
      G.hemi.intensity = (G.map.power ? 0.8 : 0.55) + Z.lightning * 6;
    }

    // ambient vocals: a single zombie groans / growls / (rarely) screams every
    // so often — spaced out so it never floods the mix
    Z.groanTimer -= dt;
    if (Z.groanTimer <= 0) {
      Z.groanTimer = 1.6 + Math.random() * 2.6;     // ~1.6–4.2s between vocals
      var alive = Z.list.filter(function (zz) { return !zz.dead; });
      if (alive.length) {
        var zz = alive[(Math.random() * alive.length) | 0];
        var d = zz.mesh.position.distanceTo(G.player.pos);
        if (zz.isDog) { G.audio.dogGrowl(d); }
        else {
          var r = Math.random();
          // a scream only from a sprinter that's closing in, and uncommon
          if (zz.speed > 3 && d < 16 && r < 0.15) G.audio.zombieScream(d);
          else if (r < 0.55) G.audio.zombieGrowl(d);   // throaty growl
          else G.audio.zombieGroan(d);                  // airy groan
        }
      }
    }

    for (i = Z.list.length - 1; i >= 0; i--) {
      z = Z.list[i];
      z.t += dt;
      z.attackCd -= dt;
      if (z.slowT > 0) z.slowT -= dt;
      if (z.pullT > 0) z.pullT -= dt;   // Maelstrom drag flag (weapons.js moves them)
      // molten infusion burn — ticks damage for its duration
      if (z.burnT > 0 && !z.dead) {
        z.burnT -= dt;
        z._burnAcc = (z._burnAcc || 0) + dt;
        if (z._burnAcc >= 0.5) { z._burnAcc = 0; Z.damageZombie(z, (z.burnDps || 200) * 0.5, { boom: true }); }
      }
      var moving = false;

      // void fall: a zombie that walked off a sunk floor / atrium edge has no
      // floor beneath it — despawn and re-queue it so the round count is kept
      if (z._void && !z.dead && !z.isBoss) {
        G.scene.remove(z.mesh);
        Z.list.splice(i, 1);
        Z.toSpawn++;
        Z._shootablesDirty = true;
        continue;
      }
      // Kryolithwerfer statues are genuine frozen bodies. The weapon system
      // moves them only after the player launches them; normal AI must not
      // fight that motion or claw through the ice state.
      if (z.wwFrozen && !z.dead) {
        z.wwFrozenT -= dt;
        if (z.wwFrozenT <= 0) z.wwFrozen = false;
        else { animate(z, dt, false); continue; }
      }
      // failsafe: a zombie that hasn't moved for ~15s (and isn't busy at a
      // window or on the player) respawns so rounds can never stall
      z._chk = (z._chk || 0) + dt;
      if (z._chk > 5) {
        z._chk = 0;
        var movedD = z._anchor ? z.mesh.position.distanceTo(z._anchor) : 99;
        if (movedD < 0.6 && z.state !== 'tear' && !z.dead && !z.isBoss &&
            z.mesh.position.distanceTo(G.player.pos) > 6) z._stuck = (z._stuck || 0) + 1;
        else z._stuck = 0;
        z._anchor = z.mesh.position.clone();
        if (z._stuck >= 3) {
          G.scene.remove(z.mesh);
          Z.list.splice(i, 1);
          Z.toSpawn++;
          Z._shootablesDirty = true;
          continue;
        }
      }

      // boss special behaviour overrides the normal state machine while it
      // telegraphs / charges / recovers
      if (z.isBoss && z.state !== 'dying' && z.state !== 'flung' &&
          z.state !== 'rise' && z.state !== 'vault') {
        bossThink(z, dt);
        if (z.bossBusy) { animate(z, dt, z.bossPhase === 'charge'); continue; }
      }

      switch (z.state) {
        case 'rise':
          z.mesh.position.y += dt * 1.7;
          if (z.mesh.position.y >= (z._spawnY || 0)) {
            z.mesh.position.y = z._spawnY || 0;
            z.state = z.window ? 'towindow' : 'chase';
          }
          break;

        case 'towindow':
          moving = true;
          moveToward(z, z.window.outside, dt);
          if (z.mesh.position.distanceTo(z.window.outside) < 0.7) {
            // climb straight in if there's already a gap, otherwise tear first
            z.state = z.window.boards > BREAK_GAP ? 'tear' : 'vault';
            z.vaultT = 0;
            z.tearTimer = 0.6;
          }
          break;

        case 'tear':
          // tear boards until there's a gap big enough to climb through
          z.tearTimer -= dt;
          z.parts.armL.rotation.x = -1.8 + Math.sin(z.t * 8) * 0.6;
          z.parts.armR.rotation.x = -1.8 - Math.sin(z.t * 8) * 0.6;
          if (z.tearTimer <= 0) {
            z.tearTimer = 0.75;
            z.window.tearBoard();
          }
          if (z.window.boards <= BREAK_GAP) { z.state = 'vault'; z.vaultT = 0; }
          break;

        case 'vault':
          z.vaultT += dt;
          var k = Math.min(1, z.vaultT / 0.7);
          var wy = z._spawnY || 0;                 // vault over the window onto its OWN floor
          z.mesh.position.lerpVectors(z.window.outside, z.window.inside, k);
          z.mesh.position.y = wy + Math.sin(k * Math.PI) * 0.9;
          if (k >= 1) { z.mesh.position.y = wy; z.state = 'chase'; }
          break;

        case 'chase':
          var tpos = Z.lure ? Z.lure.pos : G.player.pos;
          // horizontal distance only (a vaulting/airborne zombie shouldn't
          // count as "reaching" you)
          var dist = Math.hypot(z.mesh.position.x - tpos.x, z.mesh.position.z - tpos.z);
          var dyT = Math.abs(z.mesh.position.y - tpos.y);
          var sameLevel = dyT < MELEE_VERT;
          // a tighter gate for beelining: a body part-way down a ramp is within
          // 1.7m of a ground target but must keep following the nav slope, not
          // cut straight toward the player and stall against the incline
          var sameFloor = dyT < 0.7;
          if (!Z.lure && dist < MELEE_START && sameLevel && !G.player.downed && z.attackCd <= 0 &&
              !G.map.losBlocked(z.mesh.position.x, z.mesh.position.z, tpos.x, tpos.z, z.mesh.position.y)) {
            z.state = 'attack'; z.t = 0; z.hasHit = false;
          } else if (Z.lure && dist < 1.2) {
            // crowd around the monkey
          } else {
            moving = true;
            // close and truly on the same floor: beeline. Otherwise descend the
            // multi-layer nav gradient (it routes up/down ramps across floors).
            if (dist < 4 && sameFloor) moveToward(z, tpos, dt);
            else {
              var np = navTarget(z);
              moveToward(z, np || tpos, dt);
            }
          }
          break;

        case 'attack':
          // the swing only connects if the zombie is STILL in contact range at
          // the apex — run past it and the claw whiffs (no hit through air)
          moveToward(z, G.player.pos, dt * 0.35); // small lunge into the swipe
          if (z.t > 0.34 && !z.hasHit) {
            z.hasHit = true;
            var hd = Math.hypot(z.mesh.position.x - G.player.pos.x,
                                z.mesh.position.z - G.player.pos.z);
            var hv = Math.abs(z.mesh.position.y - G.player.pos.y);
            var walled = G.map.losBlocked(z.mesh.position.x, z.mesh.position.z,
                                          G.player.pos.x, G.player.pos.z, z.mesh.position.y);
            if (hd < MELEE_HIT && hv < MELEE_VERT && !walled && !G.player.downed) {
              // the carried shield eats hits that land on your back
              if (G.player.shieldBlocks && G.player.shieldBlocks(z.mesh.position.x, z.mesh.position.z)) {
                G.audio.zombieAttack();
              } else {
                G.player.damage(z.isBoss ? Math.round(CFG.zombieMeleeDamage(Z.round) * 1.5)
                                : z.isDog ? Math.round(CFG.zombieMeleeDamage(Z.round) * 0.8)
                                : CFG.zombieMeleeDamage(Z.round), z.mesh.position.x, z.mesh.position.z);
                G.audio.zombieAttack();
              }
            }
          }
          if (z.t > 0.62) {
            z.state = 'chase';
            z.attackCd = 0.55;       // recovery before it can swing again
          }
          break;

        case 'flung':
          z.flingVel.y -= 13 * dt;
          z.mesh.position.addScaledVector(z.flingVel, dt);
          z.mesh.rotation.x += dt * 6;
          if (z.mesh.position.y <= 0 && z.flingVel.y < 0) {
            killZombie(z, { boom: true });
          }
          break;

        case 'dying':
          z.mesh.rotation.x += dt * 2.2;
          z.mesh.position.y -= dt * 1.4;
          if (z.t > 0.9) {
            G.scene.remove(z.mesh);
            Z.list.splice(i, 1);
          }
          continue;
      }
      animate(z, dt, moving);
    }
  };

  // Direct spawn at a position, already chasing (debug / headless tests).
  Z.spawnAt = function (pos) {
    var z = {
      isDog: false, dead: false, crawler: false,
      hp: CFG.zombieHealth(Math.max(1, Z.round)),
      speed: 1.6, state: 'chase', t: 0, attackCd: 0, animT: Math.random() * 9
    };
    z.mesh = buildZombieMesh(z);
    z.mesh.position.set(pos.x, 0, pos.z);
    G.scene.add(z.mesh);
    Z.list.push(z);
    Z._shootablesDirty = true;
    return z;
  };

  Z.reset = function () {
    Z.list.forEach(function (z) { G.scene.remove(z.mesh); });
    Z.list = [];
    Z._shootablesDirty = true;
  };
})();
