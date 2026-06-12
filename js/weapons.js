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
    mouseDown: false, semiLatch: false,
    projectiles: [], tracers: [], flashes: [],
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
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 0) W.mouseDown = false;
    });
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

  function spawnTracer(end) {
    var start = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                         : G.camera.position.clone();
    var geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffdd88, transparent: true, opacity: 0.7
    }));
    G.scene.add(line);
    W.tracers.push({ mesh: line, life: 0.07 });
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
    if (s.projectile === 'ray') { spawnProjectile('ray', s.dmg); return; }
    if (s.projectile === 'rocket') { spawnProjectile('rocket', s.dmg); return; }

    var pellets = s.pellets || 1;
    for (var i = 0; i < pellets; i++) {
      shootRay(s.spread, s.dmg, s.head, s.range, false);
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

  /* --------------------------------------------------------- projectiles */
  function spawnProjectile(type, dmg) {
    var pos = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                       : G.camera.position.clone();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    var mesh, vel, opts;
    if (type === 'ray') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x44ff66 }));
      vel = dir.multiplyScalar(38);
      opts = { dmg: dmg, radius: 2.5, gravity: 0, fuse: 3, color: 0x44ff66 };
    } else if (type === 'rocket') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
      vel = dir.multiplyScalar(26).add(new THREE.Vector3(0, 1.5, 0));
      opts = { dmg: dmg, radius: 4, gravity: 5, fuse: 4, color: 0xffaa33, crawlers: true };
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

      // proximity detonation vs zombies for rockets/rays
      if (!detonate && (p.type === 'ray' || p.type === 'rocket')) {
        for (var j = 0; j < G.zombies.list.length; j++) {
          var z = G.zombies.list[j];
          if (!z.dead && z.mesh.position.distanceTo(p.mesh.position) < 0.9) { detonate = true; break; }
        }
      }
      if (p.t > p.opts.fuse) detonate = true;

      if (detonate) {
        if (p.type === 'monkey' && G.zombies.lure && G.zombies.lure.proj === p) G.zombies.lure = null;
        W.explode(p.mesh.position, p.opts.dmg, p.opts.radius, p.opts);
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

    // trigger
    if (G.state === 'playing' && !G.player.downed && !G.player.locked &&
        gun && W.reloading <= 0 && W.switching <= 0 && W.knifing <= 0 && W.fireCd <= 0) {
      var s = CFG.WEAPONS[gun.id];
      var auto = (gun.papped && s.pap.mode === 'auto') || s.mode === 'auto';
      if (W.mouseDown && (auto || !W.semiLatch)) {
        W.semiLatch = true;
        fire();
      }
    }
    if (!W.mouseDown) W.semiLatch = false;

    // viewmodel animation
    if (gun && gun.model) {
      var m = gun.model;
      m.position.z += (0 - m.position.z) * Math.min(1, dt * 10);
      var targetY = 0, targetRX = 0;
      if (W.reloading > 0) { targetY = -0.18; targetRX = 0.5; }
      if (W.switching > 0) { targetY = -0.3; }
      if (W.knifing > 0.2) { m.position.z = -0.25; targetRX = -0.3; }
      m.position.y += (targetY - m.position.y) * Math.min(1, dt * 12);
      m.rotation.x += (targetRX - m.rotation.x) * Math.min(1, dt * 12);
      // bob
      m.position.x = Math.sin(G.player.bobT) * 0.012;
    }

    updateProjectiles(dt);

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
