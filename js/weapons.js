/* ===========================================================================
   DER WETTERJUNGE — weapons.js
   Viewmodels, hitscan + projectiles, reload, Pack-a-Punch camo, knife,
   grenades and monkey bombs.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var CFG = null;

  var W = G.weapons = {
    slots: [], cur: 0, maxSlots: 2,
    reloading: 0, switching: 0, knifing: 0, fireCd: 0,
    mouseDown: false, semiLatch: false, adsHeld: false,
    projectiles: [], tracers: [], flashes: [], vortices: [],
    vmRoot: null, muzzle: null, camoTex: null
  };

  /* ----------------------------------------------------------- materials */
  function makeCamoTexture() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = '#1a0533'; c.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 60; i++) {
      var hue = [275, 290, 190, 160][i % 4];
      c.fillStyle = 'hsl(' + hue + ',90%,' + (35 + Math.random() * 30) + '%)';
      c.beginPath();
      c.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 9, 0, 7);
      c.fill();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function gunMat(papped, color) {
    if (papped) {
      return new THREE.MeshLambertMaterial({
        map: W.camoTex, emissive: new THREE.Color(0x331155), emissiveIntensity: 0.55
      });
    }
    return new THREE.MeshLambertMaterial({ color: color });
  }

  /* ----------------------------------------------------------- viewmodel */
  function buildModel(cls, papped) {
    var g = new THREE.Group();
    var metal = gunMat(papped, 0x3c3f44);
    var dark = gunMat(papped, 0x26282c);
    var wood = gunMat(papped, 0x6b4a2f);
    function part(w, h, d, x, y, z, m) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || metal);
      b.position.set(x, y, z); g.add(b); return b;
    }
    var tipZ = -0.5;
    if (cls === 'pistol') {
      part(0.06, 0.09, 0.26, 0, 0, -0.1);
      part(0.05, 0.13, 0.07, 0, -0.1, 0.02, dark);
      tipZ = -0.25;
    } else if (cls === 'smg') {
      part(0.08, 0.11, 0.42, 0, 0, -0.12);
      part(0.045, 0.045, 0.3, 0, 0.01, -0.45);
      part(0.05, 0.2, 0.07, 0, -0.14, -0.1, dark);
      part(0.05, 0.1, 0.06, 0, -0.08, 0.08, dark);
      tipZ = -0.62;
    } else if (cls === 'rifle') {
      part(0.07, 0.1, 0.5, 0, 0, -0.15);
      part(0.04, 0.04, 0.4, 0, 0.01, -0.55);
      part(0.05, 0.16, 0.06, 0, -0.12, -0.05, dark);
      part(0.06, 0.1, 0.2, 0, -0.02, 0.18, wood);
      tipZ = -0.76;
    } else if (cls === 'shotgun') {
      part(0.08, 0.1, 0.5, 0, 0, -0.18);
      part(0.07, 0.07, 0.5, 0, -0.075, -0.18, dark);
      part(0.07, 0.1, 0.22, 0, -0.02, 0.16, wood);
      tipZ = -0.55;
    } else if (cls === 'lmg') {
      part(0.09, 0.13, 0.55, 0, 0, -0.15);
      part(0.05, 0.05, 0.4, 0, 0.01, -0.6);
      part(0.1, 0.22, 0.16, 0, -0.16, -0.12, dark);
      part(0.06, 0.12, 0.08, 0, -0.1, 0.1, dark);
      tipZ = -0.82;
    } else if (cls === 'raygun') {
      var rg = gunMat(papped, 0x8a1212);
      part(0.1, 0.12, 0.3, 0, 0, -0.08, rg);
      var coil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 8),
        new THREE.MeshLambertMaterial({ color: 0x22ff66, emissive: 0x115522 }));
      coil.rotation.x = Math.PI / 2; coil.position.set(0, 0.02, -0.3); g.add(coil);
      part(0.05, 0.13, 0.07, 0, -0.11, 0.03, dark);
      tipZ = -0.45;
    } else if (cls === 'wunder') {
      part(0.07, 0.12, 0.3, 0, -0.03, 0.12, wood);
      part(0.08, 0.1, 0.44, 0, 0, -0.2);
      for (var ci = 0; ci < 3; ci++) {
        var coilM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8),
          new THREE.MeshLambertMaterial({ color: 0x223344, emissive: 0x33ccff, emissiveIntensity: 0.9 }));
        coilM.position.set(0, 0.085, -0.1 - ci * 0.14);
        g.add(coilM);
      }
      part(0.05, 0.14, 0.07, 0, -0.13, 0.02, dark);
      tipZ = -0.52;
    } else if (cls === 'storm') {
      var st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8),
        gunMat(papped, 0x4a525c));
      st.rotation.x = Math.PI / 2; st.position.set(0, 0, -0.18); g.add(st);
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0x113355, emissive: 0x55ccff, emissiveIntensity: 1.0 }));
      orb.position.set(0, 0.09, -0.05); g.add(orb);
      part(0.05, 0.14, 0.08, 0, -0.12, 0.06, dark);
      tipZ = -0.5;
    } else if (cls === 'thunder') {
      var t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 8),
        gunMat(papped, 0x55585e));
      t1.rotation.x = Math.PI / 2; t1.position.set(0, 0, -0.2); g.add(t1);
      var t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 8),
        new THREE.MeshLambertMaterial({ color: 0x222230, emissive: 0x2244aa, emissiveIntensity: 0.6 }));
      t2.rotation.x = Math.PI / 2; t2.position.set(0, 0, -0.5); g.add(t2);
      part(0.06, 0.14, 0.08, 0, -0.12, 0.05, dark);
      tipZ = -0.62;
    }
    var tip = new THREE.Object3D();
    tip.position.set(0, 0.01, tipZ);
    g.add(tip);
    g.userData.tip = tip;
    return g;
  }

  /* -------------------------------------------------------------- core */
  W.init = function () {
    CFG = G.CFG;
    W.camoTex = makeCamoTexture();
    W.vmRoot = new THREE.Group();
    W.vmRoot.position.set(0.3, -0.28, -0.5);
    G.camera.add(W.vmRoot);
    W.flashLight = new THREE.PointLight(0xffcc77, 0, 8);
    G.scene.add(W.flashLight);
    W.giveWeapon('m1911');
    document.addEventListener('mousedown', function (e) {
      if (e.button === 0 && document.pointerLockElement) { W.mouseDown = true; W.semiLatch = false; }
      if (e.button === 2 && document.pointerLockElement) W.adsHeld = true;
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 0) W.mouseDown = false;
      if (e.button === 2) W.adsHeld = false;
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  W.stats = function (gun) {
    var base = CFG.WEAPONS[gun.id];
    var s = {};
    Object.keys(base).forEach(function (k) { if (k !== 'pap') s[k] = base[k]; });
    if (gun.papped) Object.keys(base.pap).forEach(function (k) { s[k] = base.pap[k]; });
    if (G.player.hasPerk('dtap')) { s.dmg *= 2; s.rpm *= 1.33; }
    return s;
  };

  W.current = function () { return W.slots[W.cur] || null; };
  W.hasWeapon = function (id) {
    return W.slots.some(function (s) { return s.id === id; });
  };

  W.giveWeapon = function (id) {
    var base = CFG.WEAPONS[id];
    var gun = { id: id, papped: false, ammo: base.mag, reserve: base.reserve, model: null };
    if (W.slots.length < W.maxSlots) {
      W.slots.push(gun);
      W.equip(W.slots.length - 1, true);
    } else {
      // replace current
      if (W.current() && W.current().model) W.vmRoot.remove(W.current().model);
      W.slots[W.cur] = gun;
      W.equip(W.cur, true);
    }
    G.hud.setAmmo();
  };

  W.dropExtraSlots = function () {
    while (W.slots.length > W.maxSlots) W.slots.pop();
    if (W.cur >= W.slots.length) W.equip(0, true);
  };

  W.equip = function (i, instant) {
    if (i >= W.slots.length || (i === W.cur && !instant && W.slots[i].model)) return;
    W.reloading = 0;
    W.cur = i;
    while (W.vmRoot.children.length) W.vmRoot.remove(W.vmRoot.children[0]);
    var gun = W.slots[i];
    var cls = CFG.WEAPONS[gun.id].cls;
    gun.model = buildModel(cls, gun.papped);
    W.vmRoot.add(gun.model);
    W.muzzle = gun.model.userData.tip;
    W.switching = instant ? 0 : 0.3;
    G.hud.setAmmo();
  };

  W.cycle = function (dir) {
    if (W.slots.length < 2) return;
    W.equip((W.cur + dir + W.slots.length) % W.slots.length);
  };

  W.papCurrent = function () {
    var gun = W.current();
    if (!gun || gun.papped) return false;
    gun.papped = true;
    var s = W.stats(gun);
    gun.ammo = s.mag;
    gun.reserve = s.reserve;
    W.equip(W.cur, true);
    return true;
  };

  W.maxAmmo = function () {
    W.slots.forEach(function (gun) {
      gun.reserve = W.stats(gun).reserve;
    });
    G.player.frags = CFG.MAX_FRAGS;
    if (G.player.hasMonkeys) G.player.monkeys = CFG.MAX_MONKEYS;
    G.hud.setAmmo();
  };

  W.refillCurrent = function () {
    var gun = W.current();
    if (!gun) return;
    gun.reserve = W.stats(gun).reserve;
    G.hud.setAmmo();
  };

  W.startReload = function () {
    var gun = W.current();
    if (!gun || W.reloading > 0 || W.knifing > 0) return;
    var s = W.stats(gun);
    if (gun.ammo >= s.mag || gun.reserve <= 0) return;
    W.reloading = s.reload * (G.player.hasPerk('speed') ? 0.5 : 1);
    W.reloadTotal = W.reloading;
    G.audio.reload();
  };

  function finishReload() {
    var gun = W.current();
    var s = W.stats(gun);
    var need = s.mag - gun.ammo;
    var take = Math.min(need, gun.reserve);
    gun.ammo += take;
    gun.reserve -= take;
    G.hud.setAmmo();
  }

  /* -------------------------------------------------------------- firing */
  var _ray = new THREE.Raycaster();
  var _dir = new THREE.Vector3();

  function shootRay(spreadDeg, dmg, headMult, range, isKnife) {
    _dir.set(0, 0, -1).applyEuler(G.camera.rotation);
    if (spreadDeg) {
      var sp = spreadDeg * Math.PI / 180;
      _dir.x += (Math.random() - 0.5) * sp;
      _dir.y += (Math.random() - 0.5) * sp;
      _dir.z += (Math.random() - 0.5) * sp * 0.3;
      _dir.normalize();
    }
    _ray.set(G.camera.position, _dir);
    _ray.far = isKnife ? 2.3 : 120;
    var targets = G.zombies.shootables().concat(G.map.solidMeshes);
    var hits = _ray.intersectObjects(targets, false);
    var hit = hits.length ? hits[0] : null;
    var end = hit ? hit.point : G.camera.position.clone().addScaledVector(_dir, 60);
    if (!isKnife) spawnTracer(end);
    if (hit && hit.object.userData.zombie) {
      var z = hit.object.userData.zombie;
      var isHead = hit.object.userData.part === 'head';
      var d = dmg * (isHead ? headMult : 1);
      if (range && hit.distance > range) d *= 0.3;
      G.audio.hitmark(isHead);
      G.hud.hitmarker();
      G.zombies.damageZombie(z, d, { head: isHead, knife: isKnife });
      return true;
    }
    return false;
  }

  function addLine(a, b, color, life, opacity) {
    var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity || 0.7
    }));
    G.scene.add(line);
    W.tracers.push({ mesh: line, life: life });
  }

  function spawnTracer(end) {
    var start = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                         : G.camera.position.clone();
    addLine(start, end, 0xffdd88, 0.07);
  }

  function muzzleFlash() {
    if (!W.muzzle) return;
    var p = W.muzzle.getWorldPosition(new THREE.Vector3());
    W.flashLight.position.copy(p);
    W.flashLight.intensity = 2.5;
    W.flashTimer = 0.05;
  }

  function fire() {
    var gun = W.current();
    var s = W.stats(gun);
    if (gun.ammo <= 0) {
      G.audio.dryFire();
      W.startReload();
      W.fireCd = 0.25;
      return;
    }
    gun.ammo--;
    W.fireCd = 60 / s.rpm;
    G.audio.shoot(s.cls, gun.papped);
    muzzleFlash();
    G.player.kick(s.cls === 'shotgun' || s.cls === 'thunder' ? 1.6 : 0.45);
    if (gun.model) gun.model.position.z = 0.07;
    G.hud.setAmmo();

    if (s.projectile === 'wind') { fireThunder(); return; }
    if (s.projectile === 'chain') { fireWunderwaffe(s); return; }
    if (s.projectile === 'storm') { spawnProjectile('storm', s); return; }
    if (s.projectile === 'ray') { spawnProjectile('ray', s); return; }
    if (s.projectile === 'rocket') { spawnProjectile('rocket', s); return; }

    // ADS tightens spread, sprinting loosens it
    var spreadMult = (1 - 0.7 * G.player.ads) * (1 + 0.5 * G.player.sprintAmt);
    var pellets = s.pellets || 1;
    for (var i = 0; i < pellets; i++) {
      shootRay(s.spread * spreadMult, s.dmg, s.head, s.range, false);
    }
  }

  function fireThunder() {
    G.player.shake(0.8);
    var fwd = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead || z.state === 'flung') return;
      var to = z.mesh.position.clone().sub(G.player.pos);
      var dist = to.length();
      if (dist > 14) return;
      to.normalize();
      var fl = fwd.clone(); fl.y = 0; fl.normalize();
      var toFlat = to.clone(); toFlat.y = 0; toFlat.normalize();
      if (fl.dot(toFlat) < Math.cos(35 * Math.PI / 180)) return;
      G.zombies.fling(z, toFlat);
    });
  }

  /* --------------------------------------------- wunderwaffe (chain bolt) */
  function fireWunderwaffe(s) {
    G.player.shake(0.5);
    _dir.set(0, 0, -1).applyEuler(G.camera.rotation);
    _ray.set(G.camera.position, _dir);
    _ray.far = 90;
    var targets = G.zombies.shootables().concat(G.map.solidMeshes);
    var hits = _ray.intersectObjects(targets, false);
    var end = hits.length ? hits[0].point
                          : G.camera.position.clone().addScaledVector(_dir, 50);
    var start = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                         : G.camera.position.clone();
    addLine(start, end, 0x88eeff, 0.18, 0.95);
    G.audio.zap();
    var first = hits.length && hits[0].object.userData.zombie
      ? hits[0].object.userData.zombie : null;
    if (!first || first.dead) return;
    // chain to nearest neighbors of anything already electrified
    var chained = [first];
    var pool = G.zombies.list.filter(function (z) { return !z.dead && z !== first; });
    while (chained.length < (s.chain || 10)) {
      var bestZ = null, bd = 1e9;
      for (var i = 0; i < pool.length; i++) {
        var z = pool[i];
        if (chained.indexOf(z) >= 0 || z.dead) continue;
        for (var j = 0; j < chained.length; j++) {
          var d = z.mesh.position.distanceTo(chained[j].mesh.position);
          if (d < (s.chainRadius || 5.5) && d < bd) { bd = d; bestZ = z; }
        }
      }
      if (!bestZ) break;
      chained.push(bestZ);
    }
    for (var k = 0; k < chained.length; k++) {
      if (k > 0) {
        var a = chained[k - 1].mesh.position.clone(); a.y += 1.3;
        var b = chained[k].mesh.position.clone(); b.y += 1.3;
        addLine(a, b, 0x88eeff, 0.3, 0.95);
      }
      G.zombies.damageZombie(chained[k], 1e9, { boom: true });
    }
    G.hud.hitmarker(true);
  }

  /* -------------------------------------------- storm vortex (Wettermacher) */
  function spawnVortex(pos, opts) {
    var grp = new THREE.Group();
    var coneMat = new THREE.MeshBasicMaterial({
      color: 0x66ccff, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false
    });
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(opts.storm.radius * 0.55, 5, 12, 1, true), coneMat);
    cone.position.y = 2.5;
    grp.add(cone);
    var inner = new THREE.Mesh(
      new THREE.ConeGeometry(opts.storm.radius * 0.28, 4.4, 10, 1, true),
      coneMat.clone());
    inner.material.opacity = 0.45;
    inner.position.y = 2.2;
    grp.add(inner);
    var light = new THREE.PointLight(0x88ddff, 1.6, opts.storm.radius * 3);
    light.position.y = 2;
    grp.add(light);
    grp.position.set(pos.x, 0, pos.z);
    G.scene.add(grp);
    G.audio.vortex();
    W.vortices.push({
      mesh: grp, cone: cone, inner: inner, light: light,
      t: opts.storm.dur, radius: opts.storm.radius, dmg: opts.dmg, tick: 0
    });
  }

  function updateVortices(dt) {
    for (var i = W.vortices.length - 1; i >= 0; i--) {
      var v = W.vortices[i];
      v.t -= dt;
      v.cone.rotation.y += dt * 7;
      v.inner.rotation.y -= dt * 11;
      v.light.intensity = 1.2 + Math.random() * 1.2;
      // suck zombies in
      G.zombies.list.forEach(function (z) {
        if (z.dead || (z.state !== 'chase' && z.state !== 'attack')) return;
        var dx = v.mesh.position.x - z.mesh.position.x;
        var dz = v.mesh.position.z - z.mesh.position.z;
        var d = Math.hypot(dx, dz);
        if (d > v.radius * 1.5 || d < 0.3) return;
        z.mesh.position.x += dx / d * dt * 4;
        z.mesh.position.z += dz / d * dt * 4;
      });
      // periodic lightning ticks
      v.tick -= dt;
      if (v.tick <= 0) {
        v.tick = 0.45;
        G.audio.vortexTick();
        G.zombies.list.slice().forEach(function (z) {
          if (z.dead) return;
          var d = z.mesh.position.distanceTo(v.mesh.position);
          if (d < v.radius) {
            var a = v.mesh.position.clone(); a.y = 4.5;
            var b = z.mesh.position.clone(); b.y += 1.3;
            addLine(a, b, 0xaaeeff, 0.15, 0.9);
            G.zombies.damageZombie(z, v.dmg, { boom: true });
          }
        });
      }
      if (v.t <= 0) {
        G.scene.remove(v.mesh);
        W.vortices.splice(i, 1);
      }
    }
  }

  /* --------------------------------------------------------- projectiles */
  function spawnProjectile(type, s) {
    var pos = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                       : G.camera.position.clone();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    var mesh, vel, opts;
    if (type === 'ray') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x44ff66 }));
      vel = dir.multiplyScalar(38);
      opts = { dmg: s.dmg, radius: 2.5, gravity: 0, fuse: 3, color: 0x44ff66 };
    } else if (type === 'rocket') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
      vel = dir.multiplyScalar(26).add(new THREE.Vector3(0, 1.5, 0));
      opts = { dmg: s.dmg, radius: 4, gravity: 5, fuse: 4, color: 0xffaa33, crawlers: true };
    } else if (type === 'storm') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x66ccff }));
      vel = dir.multiplyScalar(24).add(new THREE.Vector3(0, 0.5, 0));
      opts = { dmg: s.dmg, radius: 2.5, gravity: 1.5, fuse: 3, color: 0x66ccff,
               storm: { dur: s.stormDur, radius: s.stormRadius } };
    }
    mesh.position.copy(pos);
    G.scene.add(mesh);
    W.projectiles.push({ type: type, mesh: mesh, vel: vel, t: 0, opts: opts });
  }

  W.throwFrag = function () {
    if (G.player.frags <= 0 || W.knifing > 0) return;
    G.player.frags--;
    G.audio.throwSwish();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
      G.util.mat(0x3a4a36));
    mesh.position.copy(G.camera.position).addScaledVector(dir, 0.4);
    G.scene.add(mesh);
    W.projectiles.push({
      type: 'frag', mesh: mesh,
      vel: dir.multiplyScalar(13).add(new THREE.Vector3(0, 3.5, 0)),
      t: 0, opts: { dmg: CFG.GRENADE_DMG, radius: CFG.GRENADE_RADIUS, gravity: 9.8, fuse: 3, color: 0xffaa33, crawlers: true, bounce: true, selfDmg: true }
    });
    G.hud.setAmmo();
  };

  W.throwMonkey = function () {
    if (!G.player.hasMonkeys || G.player.monkeys <= 0 || W.knifing > 0) return;
    G.player.monkeys--;
    G.audio.throwSwish();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    var mesh = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.14), G.util.mat(0x7a5230));
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), G.util.mat(0x8a6240));
    head.position.y = 0.18; mesh.add(body); mesh.add(head);
    mesh.position.copy(G.camera.position).addScaledVector(dir, 0.4);
    G.scene.add(mesh);
    W.projectiles.push({
      type: 'monkey', mesh: mesh,
      vel: dir.multiplyScalar(11).add(new THREE.Vector3(0, 3.5, 0)),
      t: 0, opts: { dmg: CFG.MONKEY_DMG, radius: CFG.MONKEY_RADIUS, gravity: 9.8, fuse: 99, color: 0xffdd55, bounce: true }
    });
    G.hud.setAmmo();
  };

  function pointBlocked(x, z, r) {
    var cols = G.map.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (!c.on) continue;
      if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return c;
    }
    return null;
  }

  W.explode = function (pos, dmg, radius, opts) {
    opts = opts || {};
    G.audio.explosion();
    G.player.shake(0.7);
    // flash
    var flash = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 12, 12),
      new THREE.MeshBasicMaterial({ color: opts.color || 0xffaa33, transparent: true, opacity: 0.85 }));
    flash.position.copy(pos);
    G.scene.add(flash);
    W.flashes.push({ mesh: flash, life: 0.22 });
    var l = new THREE.PointLight(opts.color || 0xffaa33, 3, radius * 4);
    l.position.copy(pos);
    G.scene.add(l);
    W.flashes.push({ mesh: l, life: 0.22, isLight: true });
    // zombies
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead) return;
      var d = z.mesh.position.distanceTo(pos);
      if (d > radius) return;
      var fall = 1 - 0.6 * (d / radius);
      G.zombies.damageZombie(z, dmg * fall, { boom: true, crawlers: opts.crawlers });
    });
    // self damage
    if (opts.selfDmg) {
      var pd = G.player.pos.distanceTo(pos);
      if (pd < radius * 0.8) G.player.damage(Math.round(45 * (1 - pd / radius)));
    }
  };

  function updateProjectiles(dt) {
    for (var i = W.projectiles.length - 1; i >= 0; i--) {
      var p = W.projectiles[i];
      p.t += dt;
      p.vel.y -= (p.opts.gravity || 0) * dt;
      var nx = p.mesh.position.x + p.vel.x * dt;
      var ny = p.mesh.position.y + p.vel.y * dt;
      var nz = p.mesh.position.z + p.vel.z * dt;
      var hitWall = pointBlocked(nx, nz, 0.1);
      var hitFloor = ny <= 0.1;
      var detonate = false;

      if (p.type === 'monkey' && p.landed) {
        // sitting there luring
        p.lure -= dt;
        if (Math.floor(p.lure * 2) !== Math.floor((p.lure + dt) * 2)) G.audio.monkeyJingle();
        if (p.lure <= 0) detonate = true;
      } else if (hitWall || hitFloor) {
        if (p.opts.bounce) {
          if (hitFloor && Math.abs(p.vel.y) < 1.2) {
            // settled
            p.mesh.position.y = 0.1;
            p.vel.set(0, 0, 0);
            if (p.type === 'monkey' && !p.landed) {
              p.landed = true;
              p.lure = 3.2;
              G.audio.monkeyJingle();
              G.zombies.lure = { pos: p.mesh.position.clone(), proj: p };
            }
          } else {
            if (hitFloor) { p.mesh.position.y = 0.12; p.vel.y *= -0.4; p.vel.x *= 0.6; p.vel.z *= 0.6; }
            if (hitWall) { p.vel.x *= -0.4; p.vel.z *= -0.4; }
          }
        } else detonate = true; // rockets and rays pop on contact
      } else {
        p.mesh.position.set(nx, ny, nz);
      }

      // proximity detonation vs zombies for rockets/rays/storm orbs
      if (!detonate && (p.type === 'ray' || p.type === 'rocket' || p.type === 'storm')) {
        for (var j = 0; j < G.zombies.list.length; j++) {
          var z = G.zombies.list[j];
          if (!z.dead && z.mesh.position.distanceTo(p.mesh.position) < 0.9) { detonate = true; break; }
        }
      }
      if (p.t > p.opts.fuse) detonate = true;

      if (detonate) {
        if (p.type === 'monkey' && G.zombies.lure && G.zombies.lure.proj === p) G.zombies.lure = null;
        if (p.opts.storm) spawnVortex(p.mesh.position, p.opts);
        else W.explode(p.mesh.position, p.opts.dmg, p.opts.radius, p.opts);
        G.scene.remove(p.mesh);
        W.projectiles.splice(i, 1);
      }
    }
  }

  /* --------------------------------------------------------------- knife */
  W.knife = function () {
    if (W.knifing > 0 || W.reloading > 0) return;
    W.knifing = 0.45;
    G.audio.knife();
    setTimeout(function () {
      if (G.state !== 'playing') return;
      if (shootRay(0, CFG.KNIFE_DMG, 1, null, true)) G.audio.knifeHit();
    }, 120);
  };

  /* -------------------------------------------------------------- update */
  W.update = function (dt) {
    var gun = W.current();
    if (W.fireCd > 0) W.fireCd -= dt;
    if (W.switching > 0) W.switching -= dt;
    if (W.knifing > 0) W.knifing -= dt;
    if (W.flashTimer > 0) {
      W.flashTimer -= dt;
      if (W.flashTimer <= 0) W.flashLight.intensity = 0;
    }
    W.camoTex.offset.x += dt * 0.13;
    W.camoTex.offset.y += dt * 0.05;

    if (W.reloading > 0) {
      W.reloading -= dt;
      if (W.reloading <= 0) finishReload();
    }

    // trigger (sprint must ramp out first — holding fire drops sprintAmt,
    // so this gate produces the BO3 sprint-out delay automatically)
    if (G.state === 'playing' && !G.player.downed && !G.player.locked &&
        G.player.sprintAmt < 0.45 &&
        gun && W.reloading <= 0 && W.switching <= 0 && W.knifing <= 0 && W.fireCd <= 0) {
      var s = CFG.WEAPONS[gun.id];
      var auto = (gun.papped && s.pap.mode === 'auto') || s.mode === 'auto';
      if (W.mouseDown && (auto || !W.semiLatch)) {
        W.semiLatch = true;
        fire();
      }
    }
    if (!W.mouseDown) W.semiLatch = false;

    // viewmodel animation: hip<->ADS lerp, sprint pose, sway, bob, then the
    // per-gun reload/knife/recoil offsets on the gun model itself
    var Pl = G.player;
    var ads = Pl.ads, sprint = Pl.sprintAmt * (1 - ads);
    var hipX = 0.3, hipY = -0.28, hipZ = -0.5;
    var adsX = 0, adsY = -0.235, adsZ = -0.36;
    W.vmRoot.position.x = hipX + (adsX - hipX) * ads - 0.06 * sprint +
      Pl.vmBobX + Pl.swayX * -0.0006;
    W.vmRoot.position.y = hipY + (adsY - hipY) * ads - 0.05 * sprint +
      Pl.vmBobY + Pl.swayY * 0.0005 - Pl.landDip * 0.4;
    W.vmRoot.position.z = hipZ + (adsZ - hipZ) * ads + 0.04 * sprint;
    W.vmRoot.rotation.y = 0.5 * sprint + Pl.swayX * -0.0009;
    W.vmRoot.rotation.x = 0.3 * sprint + 0.12 * Pl.slideAmt + Pl.swayY * -0.0009;
    W.vmRoot.rotation.z = -Pl.roll * 0.6 - 0.12 * sprint;
    G.hud.setAds(ads);

    if (gun && gun.model) {
      var m = gun.model;
      m.position.z += (0 - m.position.z) * Math.min(1, dt * 10);
      var targetY = 0, targetRX = 0;
      if (W.reloading > 0) { targetY = -0.18; targetRX = 0.5; }
      if (W.switching > 0) { targetY = -0.3; }
      if (W.knifing > 0.2) { m.position.z = -0.25; targetRX = -0.3; }
      m.position.y += (targetY - m.position.y) * Math.min(1, dt * 12);
      m.rotation.x += (targetRX - m.rotation.x) * Math.min(1, dt * 12);
    }

    updateProjectiles(dt);
    updateVortices(dt);

    for (var i = W.tracers.length - 1; i >= 0; i--) {
      var t = W.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { G.scene.remove(t.mesh); W.tracers.splice(i, 1); }
    }
    for (var f = W.flashes.length - 1; f >= 0; f--) {
      var fl = W.flashes[f];
      fl.life -= dt;
      if (fl.isLight) fl.mesh.intensity *= 0.8;
      else { fl.mesh.scale.multiplyScalar(1.08); fl.mesh.material.opacity *= 0.8; }
      if (fl.life <= 0) { G.scene.remove(fl.mesh); W.flashes.splice(f, 1); }
    }
  };
})();
