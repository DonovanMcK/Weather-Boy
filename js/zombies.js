/* ===========================================================================
   DER WETTERJUNGE — zombies.js
   Round director, window spawns, flow-field pathfinding, hellhound rounds.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var CFG = null;

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
  function zombieMaterials() {
    var skins = [0x5a6a4a, 0x6a5a4a, 0x55604f, 0x4f5a62];
    var cloths = [0x3a3a44, 0x44352a, 0x2f3a33, 0x3d2f3a];
    return {
      skin: G.util.mat(skins[(Math.random() * skins.length) | 0]),
      cloth: G.util.mat(cloths[(Math.random() * cloths.length) | 0])
    };
  }

  function buildZombieMesh(z) {
    var g = new THREE.Group();
    var m = zombieMaterials();
    function box(w, h, d, x, y, zz, mt) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt);
      b.position.set(x, y, zz);
      return b;
    }
    var torso = box(0.55, 0.7, 0.32, 0, 1.15, 0, m.cloth);
    var head = box(0.32, 0.34, 0.32, 0, 1.72, 0, m.skin);
    var eyeMat = new THREE.MeshBasicMaterial({ color: z.isDog ? 0xff3300 : 0xffcc33 });
    var e1 = box(0.06, 0.05, 0.02, -0.08, 0.04, -0.17, eyeMat);
    var e2 = box(0.06, 0.05, 0.02, 0.08, 0.04, -0.17, eyeMat);
    head.add(e1); head.add(e2);
    // arms pivoted at the shoulder, reaching forward
    function limb(w, h, d, px, py, mt) {
      var pivot = new THREE.Object3D();
      pivot.position.set(px, py, 0);
      var seg = box(w, h, d, 0, -h / 2, 0, mt);
      pivot.add(seg);
      return pivot;
    }
    var armL = limb(0.16, 0.62, 0.16, -0.36, 1.45, m.skin);
    var armR = limb(0.16, 0.62, 0.16, 0.36, 1.45, m.skin);
    armL.rotation.x = -1.35; armR.rotation.x = -1.35;
    var legL = limb(0.2, 0.78, 0.2, -0.15, 0.8, m.cloth);
    var legR = limb(0.2, 0.78, 0.2, 0.15, 0.8, m.cloth);
    g.add(torso); g.add(head); g.add(armL); g.add(armR); g.add(legL); g.add(legR);
    torso.userData = { zombie: z, part: 'body' };
    head.userData = { zombie: z, part: 'head' };
    z.parts = { torso: torso, head: head, armL: armL, armR: armR, legL: legL, legR: legR };
    z.hitMeshes = [torso, head];
    return g;
  }

  function buildDogMesh(z) {
    var g = new THREE.Group();
    var fire = new THREE.MeshLambertMaterial({ color: 0x331111, emissive: 0xbb3300, emissiveIntensity: 0.7 });
    function box(w, h, d, x, y, zz) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fire);
      b.position.set(x, y, zz);
      return b;
    }
    var body = box(0.42, 0.42, 0.95, 0, 0.62, 0);
    var head = box(0.3, 0.28, 0.4, 0, 0.85, -0.6);
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    var e1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), eyeMat);
    e1.position.set(-0.08, 0.05, -0.21); head.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.08; head.add(e2);
    var legs = [];
    [[-0.15, -0.32], [0.15, -0.32], [-0.15, 0.32], [0.15, 0.32]].forEach(function (p) {
      var pivot = new THREE.Object3D();
      pivot.position.set(p[0], 0.45, p[1]);
      var seg = box(0.1, 0.45, 0.1, 0, -0.22, 0);
      pivot.add(seg);
      g.add(pivot);
      legs.push(pivot);
    });
    g.add(body); g.add(head);
    body.userData = { zombie: z, part: 'body' };
    head.userData = { zombie: z, part: 'head' };
    z.parts = { torso: body, head: head, legs: legs };
    z.hitMeshes = [body, head];
    return g;
  }

  /* ---------------------------------------------------------- flow field */
  var flow = null, flowTimer = 0, flowTarget = null;

  function computeFlow(targetPos) {
    var P = G.map.parsed;
    var cr = CFG.worldToCell(targetPos.x, targetPos.z);
    if (!G.map.passable(cr.col, cr.row)) {
      // find nearest passable cell
      var best = null, bd = 1e9;
      for (var r = 0; r < P.rows; r++) for (var c = 0; c < P.cols; c++) {
        if (!G.map.passable(c, r)) continue;
        var d = (c - cr.col) * (c - cr.col) + (r - cr.row) * (r - cr.row);
        if (d < bd) { bd = d; best = { col: c, row: r }; }
      }
      if (!best) return;
      cr = best;
    }
    var dist = [];
    for (var rr = 0; rr < P.rows; rr++) { dist[rr] = []; for (var cc = 0; cc < P.cols; cc++) dist[rr][cc] = -1; }
    var queue = [[cr.col, cr.row]];
    dist[cr.row][cr.col] = 0;
    var DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (queue.length) {
      var cur = queue.shift();
      var d0 = dist[cur[1]][cur[0]];
      for (var i = 0; i < 4; i++) {
        var nc = cur[0] + DIRS[i][0], nr = cur[1] + DIRS[i][1];
        if (nr < 0 || nr >= P.rows || nc < 0 || nc >= P.cols) continue;
        if (dist[nr][nc] >= 0 || !G.map.passable(nc, nr)) continue;
        dist[nr][nc] = d0 + 1;
        queue.push([nc, nr]);
      }
    }
    flow = dist;
  }

  function nextCellToward(pos) {
    if (!flow) return null;
    var cr = CFG.worldToCell(pos.x, pos.z);
    var P = G.map.parsed;
    if (cr.row < 0 || cr.row >= P.rows || cr.col < 0 || cr.col >= P.cols) return null;
    var here = flow[cr.row] && flow[cr.row][cr.col];
    var best = null, bd = (here === undefined || here < 0) ? 1e9 : here;
    var DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (var i = 0; i < 4; i++) {
      var nc = cr.col + DIRS[i][0], nr = cr.row + DIRS[i][1];
      if (nr < 0 || nr >= P.rows || nc < 0 || nc >= P.cols) continue;
      var d = flow[nr][nc];
      if (d >= 0 && d < bd) { bd = d; best = { col: nc, row: nr }; }
    }
    return best;
  }

  /* ------------------------------------------------------------ spawning */
  function pickWindow() {
    var pool = [];
    G.map.windows.forEach(function (w) {
      if (!G.map.reachableRooms[w.room]) return;
      var d = w.pos.distanceTo(G.player.pos);
      var weight = 1 / (1 + d * 0.06);
      pool.push({ w: w, weight: weight });
    });
    var playerRoom = G.map.roomAt(G.player.pos.x, G.player.pos.z);
    if (playerRoom === 'C') {
      CFG.RISERS.forEach(function (rs) {
        var wc = CFG.cellToWorld(rs[0], rs[1]);
        pool.push({ riser: new THREE.Vector3(wc.x, 0, wc.z), weight: 0.8 });
      });
    }
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
    z.speed = sprint ? 3.4 + Math.random() * 0.9 : 1.5 + Math.random() * 0.8;
    z.mesh = buildZombieMesh(z);
    var spot = pickWindow();
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
    z.mesh.position.y = -1.9;
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

  /* --------------------------------------------------------------- rounds */
  Z.start = function () {
    CFG = G.CFG;
    Z.round = 0;
    Z.mode = 'break';
    Z.breakTimer = 3;
  };

  function beginRound() {
    Z.round++;
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
    }
  }

  function endRound(lastPos) {
    if (Z.mode === 'dogs' && lastPos) {
      G.powerups.spawn('maxammo', lastPos.clone());
    }
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
    if (G.powerups.timers.insta > 0) dmg = 1e9;
    z.hp -= dmg;
    if (!opts.boom) G.player.addPoints(CFG.PTS.hit);
    if (z.hp <= 0) {
      killZombie(z, opts);
    } else if (opts.crawlers && !z.isDog && !z.crawler && Math.random() < 0.5) {
      makeCrawler(z);
    }
  };

  function makeCrawler(z) {
    z.crawler = true;
    z.speed = Math.max(0.7, z.speed * 0.45);
    z.mesh.remove(z.parts.legL);
    z.mesh.remove(z.parts.legR);
    z.crawlOffset = -0.72;
  }

  function killZombie(z, opts) {
    if (z.dead) return;
    z.dead = true;
    z.state = 'dying';
    z.t = 0;
    Z._shootablesDirty = true;
    var pts = CFG.PTS.kill;
    if (opts.knife) pts = CFG.PTS.knifeKill;
    else if (opts.head) pts = CFG.PTS.headKill;
    else if (opts.boom) pts = CFG.PTS.boomKill;
    if (!opts.silent) G.player.addPoints(pts);
    G.player.kills++;
    G.hud.hitmarker(true);
    if (!opts.silent) G.powerups.maybeDrop(z.mesh.position);
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
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (!c.on) continue;
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
    var dir = new THREE.Vector3(target.x - z.mesh.position.x, 0, target.z - z.mesh.position.z);
    var d = dir.length();
    if (d < 0.05) return;
    dir.normalize();
    var sp = z.speed;
    if (z.isDog && d < 6) sp *= 1.35; // lunge burst
    z.mesh.position.addScaledVector(dir, sp * dt);
    var sep = separation(z);
    z.mesh.position.addScaledVector(sep, dt * 4);
    collideZombie(z);
    z.mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
  }

  function animate(z, dt, moving) {
    z.animT += dt * (moving ? z.speed * 2.4 : 1);
    var s = Math.sin(z.animT);
    if (z.isDog) {
      z.parts.legs.forEach(function (leg, i) {
        leg.rotation.x = Math.sin(z.animT * 2 + i * 1.6) * 0.7;
      });
    } else if (!z.crawler) {
      z.parts.legL.rotation.x = s * 0.55;
      z.parts.legR.rotation.x = -s * 0.55;
      if (z.state !== 'tear') {
        z.parts.armL.rotation.x = -1.35 + s * 0.18;
        z.parts.armR.rotation.x = -1.35 - s * 0.18;
      }
    } else {
      z.parts.armL.rotation.x = -1.6 + s * 0.5;
      z.parts.armR.rotation.x = -1.6 - s * 0.5;
    }
    if (z.state === 'attack') {
      var k = Math.sin(z.t * 12);
      if (!z.isDog) {
        z.parts.armL.rotation.x = -1.9 + k * 0.5;
        z.parts.armR.rotation.x = -1.9 - k * 0.5;
      }
    }
    // states below manage their own y; everything else sits on the floor
    var freeY = z.state === 'rise' || z.state === 'dying' || z.state === 'flung' || z.state === 'vault';
    if (!freeY) z.mesh.position.y = z.crawler ? z.crawlOffset : 0;
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
      if (Z.spawnTimer <= 0 && Z.aliveCount() < CFG.MAX_ALIVE) {
        Z.spawnTimer = interval;
        Z.toSpawn--;
        if (Z.mode === 'dogs') spawnDog(); else spawnZombie();
      }
    }

    // flow field refresh
    flowTimer -= dt;
    var target = Z.lure ? Z.lure.pos : G.player.pos;
    if (Z.flowDirty || flowTimer <= 0 || (flowTarget && flowTarget.distanceToSquared(target) > 4)) {
      computeFlow(target);
      flowTarget = target.clone();
      flowTimer = 0.4;
      Z.flowDirty = false;
    }

    // lightning decay (dog rounds)
    if (Z.lightning > 0) {
      Z.lightning -= dt;
      G.hemi.intensity = (G.map.power ? 0.5 : 0.25) + Z.lightning * 6;
    }

    // ambient groans
    Z.groanTimer -= dt;
    if (Z.groanTimer <= 0) {
      Z.groanTimer = 0.8 + Math.random() * 2;
      var alive = Z.list.filter(function (zz) { return !zz.dead; });
      if (alive.length) {
        var zz = alive[(Math.random() * alive.length) | 0];
        var d = zz.mesh.position.distanceTo(G.player.pos);
        if (zz.isDog) G.audio.dogGrowl(d); else G.audio.zombieGroan(d);
      }
    }

    for (i = Z.list.length - 1; i >= 0; i--) {
      z = Z.list[i];
      z.t += dt;
      z.attackCd -= dt;
      var moving = false;

      switch (z.state) {
        case 'rise':
          z.mesh.position.y += dt * 1.7;
          if (z.mesh.position.y >= 0) {
            z.mesh.position.y = 0;
            z.state = z.window ? 'towindow' : 'chase';
          }
          break;

        case 'towindow':
          moving = true;
          moveToward(z, z.window.outside, dt);
          if (z.mesh.position.distanceTo(z.window.outside) < 0.7) {
            z.state = z.window.boards > 0 ? 'tear' : 'vault';
            z.vaultT = 0;
            z.tearTimer = 1.2;
          }
          break;

        case 'tear':
          z.tearTimer -= dt;
          // claw animation
          z.parts.armL.rotation.x = -1.8 + Math.sin(z.t * 8) * 0.6;
          z.parts.armR.rotation.x = -1.8 - Math.sin(z.t * 8) * 0.6;
          if (z.tearTimer <= 0) {
            z.tearTimer = 2.0;
            if (!z.window.tearBoard()) { /* none left */ }
          }
          if (z.window.boards <= 0) { z.state = 'vault'; z.vaultT = 0; }
          break;

        case 'vault':
          z.vaultT += dt;
          var k = Math.min(1, z.vaultT / 1.0);
          z.mesh.position.lerpVectors(z.window.outside, z.window.inside, k);
          z.mesh.position.y = Math.sin(k * Math.PI) * 0.9;
          if (k >= 1) { z.mesh.position.y = 0; z.state = 'chase'; }
          break;

        case 'chase':
          var tpos = Z.lure ? Z.lure.pos : G.player.pos;
          var dist = z.mesh.position.distanceTo(tpos);
          if (!Z.lure && dist < 1.5 && !G.player.downed) {
            z.state = 'attack'; z.t = 0;
          } else if (Z.lure && dist < 1.2) {
            // crowd around the monkey
          } else {
            moving = true;
            var sameRoom = G.map.roomAt(z.mesh.position.x, z.mesh.position.z) ===
                           G.map.roomAt(tpos.x, tpos.z);
            if (dist < 5.5 && sameRoom) moveToward(z, tpos, dt);
            else {
              var nc = nextCellToward(z.mesh.position);
              if (nc) {
                var wc = CFG.cellToWorld(nc.col, nc.row);
                moveToward(z, wc, dt);
              } else moveToward(z, tpos, dt);
            }
          }
          break;

        case 'attack':
          if (z.t > 0.32 && !z.hasHit) {
            z.hasHit = true;
            if (z.mesh.position.distanceTo(G.player.pos) < 1.9 && !G.player.downed) {
              G.player.damage(z.isDog ? 40 : CFG.ZOMBIE_DMG);
              G.audio.zombieAttack();
            }
          }
          if (z.t > 0.7) {
            z.hasHit = false;
            z.state = 'chase';
            z.attackCd = 0.4;
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

  Z.reset = function () {
    Z.list.forEach(function (z) { G.scene.remove(z.mesh); });
    Z.list = [];
    Z._shootablesDirty = true;
  };
})();
