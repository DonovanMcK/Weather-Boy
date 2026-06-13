/* ===========================================================================
   DER WETTERJUNGE & FRIENDS — player.js
   BO3-style movement: momentum-based acceleration, sprint with sprint-out,
   slides + slide-hops, crouch, ADS, FOV kicks, strafe lean, landing dips.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  G.keys = {};
  var interactPressed = false;

  var P = G.player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    height: 1.65, radius: 0.42,
    hp: 100, maxHp: 100,
    points: 500,
    kills: 0,
    perks: [],
    qrBuys: 0,
    frags: 2, monkeys: 0, hasMonkeys: false,
    regenTimer: 0,
    onGround: true,
    downed: false, downTimer: 0,
    kickPitch: 0,
    shakeAmt: 0,
    bobT: 0, bobX: 0, bobY: 0, vmBobX: 0, vmBobY: 0,
    locked: false,
    // BO3 movement state
    stance: 'stand',       // stand | crouch | slide
    sprintAmt: 0,          // 0..1, smoothed
    ads: 0,                // 0..1, smoothed
    slideAmt: 0,           // 0..1, smoothed (camera/FOV)
    eyeCur: 1.65,
    slideT: 0, slideCd: 0,
    landDip: 0,
    roll: 0,
    swayX: 0, swayY: 0,
    _prevCrouch: false
  };

  P.spawn = function () {
    var s = G.CFG.PLAYER_SPAWN;
    var w = G.CFG.cellToWorld(s.cell[0], s.cell[1]);
    P.pos.set(w.x + s.off[0], 0, w.z + s.off[1]);
    P.yaw = Math.PI; // face north into the map
  };

  P.hasPerk = function (id) { return P.perks.indexOf(id) >= 0; };

  P.addPerk = function (id) {
    P.perks.push(id);
    if (id === 'jugg') { P.maxHp = G.CFG.JUGG_HP; P.hp = P.maxHp; }
    if (id === 'mule') G.weapons.maxSlots = 3;
    G.hud.setPerks(P.perks);
  };

  P.losePerks = function () {
    P.perks = [];
    P.maxHp = G.CFG.PLAYER_HP;
    P.hp = Math.min(P.hp, P.maxHp);
    G.weapons.maxSlots = 2;
    G.weapons.dropExtraSlots();
    G.hud.setPerks(P.perks);
  };

  P.addPoints = function (n) {
    if (G.powerups.timers.double > 0) n *= 2;
    P.points += n;
    G.hud.setPoints(P.points, n);
  };
  P.spend = function (n) {
    if (P.points < n) { G.audio.deny(); G.hud.flashPoints(); return false; }
    P.points -= n;
    G.hud.setPoints(P.points);
    return true;
  };

  P.damage = function (dmg) {
    if (P.downed || G.state !== 'playing') return;
    P.hp -= dmg;
    P.regenTimer = 0;
    G.audio.hurt();
    P.shake(0.4);
    if (P.hp <= 0) P.down();
  };

  P.down = function () {
    if (P.hasPerk('revive')) {
      P.downed = true;
      P.downTimer = 5;
      G.audio.downed();
      G.hud.showDowned(true);
      P.losePerks();
    } else {
      G.gameOver();
    }
  };

  P.shake = function (amt) { P.shakeAmt = Math.min(1, P.shakeAmt + amt); };
  P.kick = function (deg) { P.kickPitch += deg * Math.PI / 180; };

  /* ------------------------------------------------------------ input */
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    G.keys[e.code] = true;
    if (e.code === 'KeyF') interactPressed = true;
    if (e.code === 'KeyM') {
      var m = G.audio.toggleMute();
      G.hud.banner(m ? 'MUTED' : 'SOUND ON', '#ccc', 1);
    }
    if (G.state === 'playing' && !P.locked && !P.downed) {
      if (e.code === 'KeyR') G.weapons.startReload();
      if (e.code === 'KeyV') G.weapons.knife();
      if (e.code === 'KeyG') G.weapons.throwFrag();
      if (e.code === 'KeyH') G.weapons.throwMonkey();
      if (e.code === 'KeyQ') G.weapons.cycle(1);
      if (e.code === 'Digit1') G.weapons.equip(0);
      if (e.code === 'Digit2') G.weapons.equip(1);
      if (e.code === 'Digit3') G.weapons.equip(2);
    }
  });
  window.addEventListener('keyup', function (e) { G.keys[e.code] = false; });
  window.addEventListener('wheel', function (e) {
    if (G.state === 'playing') G.weapons.cycle(e.deltaY > 0 ? 1 : -1);
  });

  P.consumeInteract = function () {
    var v = interactPressed;
    interactPressed = false;
    return v;
  };

  window.addEventListener('mousemove', function (e) {
    if (!document.pointerLockElement) return;
    // scale sensitivity with zoom so ADS tracking feels 1:1
    var sens = 0.0021 * (G.camera ? G.camera.fov / 75 : 1);
    P.yaw -= e.movementX * sens;
    P.pitch -= e.movementY * sens;
    P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
    // viewmodel sway impulse
    P.swayX = Math.max(-40, Math.min(40, P.swayX + e.movementX));
    P.swayY = Math.max(-40, Math.min(40, P.swayY + e.movementY));
  });

  /* ---------------------------------------------------------- collision */
  function collide() {
    var cols = G.map.colliders;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        if (!c.on) continue;
        var nx = Math.max(c.x1, Math.min(P.pos.x, c.x2));
        var nz = Math.max(c.z1, Math.min(P.pos.z, c.z2));
        var dx = P.pos.x - nx, dz = P.pos.z - nz;
        var d2 = dx * dx + dz * dz;
        if (d2 < P.radius * P.radius) {
          var d = Math.sqrt(d2);
          if (d < 1e-5) {
            var exL = P.pos.x - c.x1 + P.radius, exR = c.x2 - P.pos.x + P.radius;
            var ezT = P.pos.z - c.z1 + P.radius, ezB = c.z2 - P.pos.z + P.radius;
            var m = Math.min(exL, exR, ezT, ezB);
            if (m === exL) P.pos.x = c.x1 - P.radius;
            else if (m === exR) P.pos.x = c.x2 + P.radius;
            else if (m === ezT) P.pos.z = c.z1 - P.radius;
            else P.pos.z = c.z2 + P.radius;
          } else {
            P.pos.x = nx + dx / d * P.radius;
            P.pos.z = nz + dz / d * P.radius;
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------- update */
  P.update = function (dt) {
    var MV = G.CFG.MOVE;
    var W = G.weapons;

    if (P.downed) {
      P.downTimer -= dt;
      if (P.downTimer <= 0) {
        P.downed = false;
        P.hp = P.maxHp;
        G.hud.showDowned(false);
        G.hud.banner('GET UP', '#6f6', 1.5);
      }
    }

    // regen
    P.regenTimer += dt;
    if (P.regenTimer > G.CFG.REGEN_DELAY && P.hp < P.maxHp && !P.downed) {
      P.hp = Math.min(P.maxHp, P.hp + G.CFG.REGEN_RATE * dt);
    }
    G.hud.setVignette(1 - P.hp / P.maxHp);

    var playing = G.state === 'playing' && !P.downed && !P.locked;

    /* ------------------------------------------------------ intent */
    var ix = 0, iz = 0;
    if (playing) {
      if (G.keys.KeyW) iz -= 1;
      if (G.keys.KeyS) iz += 1;
      if (G.keys.KeyA) ix -= 1;
      if (G.keys.KeyD) ix += 1;
    }
    var hasInput = ix !== 0 || iz !== 0;
    var crouchKey = !!G.keys.KeyC && playing;
    var crouchEdge = crouchKey && !P._prevCrouch;
    P._prevCrouch = crouchKey;
    var hSpeed = Math.hypot(P.vel.x, P.vel.z);

    // ADS (cancels sprint; blocked during reload/switch/knife;
    // disabled entirely in simple-aim/trackpad mode)
    var adsAllowed = !G.settings || G.settings.aimMode !== 'simple';
    var adsTarget = (playing && adsAllowed && W.adsHeld && W.reloading <= 0 &&
                     W.switching <= 0 && W.knifing <= 0) ? 1 : 0;
    P.ads += (adsTarget - P.ads) * Math.min(1, dt * MV.adsSpeed);
    if (P.ads < 0.002 && !adsTarget) P.ads = 0;

    // sprint: holding fire or ADS ramps sprint out (sprint-out delay),
    // releasing ramps it back in — BO3 auto-resume
    var wantSprint = playing && G.keys.ShiftLeft && iz < 0 &&
                     P.stance !== 'slide' && !crouchKey &&
                     adsTarget === 0 && !W.mouseDown;
    if (wantSprint && P.stance === 'crouch') P.stance = 'stand';
    P.sprintAmt += ((wantSprint ? 1 : 0) - P.sprintAmt) * Math.min(1, dt * MV.sprintRamp);

    /* ------------------------------------------------- stance / slide */
    P.slideCd -= dt;
    if (P.stance === 'slide') {
      P.slideT -= dt;
      var keep = Math.exp(-MV.slideFrict * dt);
      P.vel.x *= keep;
      P.vel.z *= keep;
      if (hasInput) {
        // light lateral steering only
        var ssin = Math.sin(P.yaw), scos = Math.cos(P.yaw);
        P.vel.x += (ix * scos) * MV.slideSteer * dt;
        P.vel.z += (-ix * ssin) * MV.slideSteer * dt;
      }
      if (P.slideT <= 0 || Math.hypot(P.vel.x, P.vel.z) < MV.crouch * 1.1) {
        P.stance = crouchKey ? 'crouch' : 'stand';
        P.slideCd = MV.slideCd;
      }
    } else {
      var canSlide = crouchEdge && P.onGround && P.slideCd <= 0 &&
                     P.sprintAmt > 0.5 && hSpeed > MV.walk * 1.02;
      if (canSlide) {
        P.stance = 'slide';
        var dx = hSpeed > 0.5 ? P.vel.x / hSpeed : -Math.sin(P.yaw);
        var dz = hSpeed > 0.5 ? P.vel.z / hSpeed : -Math.cos(P.yaw);
        var boost = Math.min(MV.slideMax, hSpeed * MV.slideBoost);
        P.vel.x = dx * boost;
        P.vel.z = dz * boost;
        P.slideT = MV.slideDur * (P.hasPerk('stamin') ? 1.2 : 1);
        G.audio.slide();
      } else {
        P.stance = crouchKey ? 'crouch' : 'stand';
      }
    }

    /* --------------------------------------------------- acceleration */
    if (P.stance !== 'slide') {
      var targetSpeed = P.stance === 'crouch' ? MV.crouch : MV.walk;
      if (P.stance === 'stand') {
        var sprintMult = P.hasPerk('stamin') ? MV.sprintStamin : MV.sprint;
        targetSpeed *= 1 + (sprintMult - 1) * P.sprintAmt;
      }
      targetSpeed *= 1 - (1 - MV.adsMove) * P.ads;
      if (P.downed) targetSpeed = 0;

      var len = Math.hypot(ix, iz) || 1;
      var sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
      var wx = (ix * cos - iz * sin) / len * targetSpeed;
      var wz = (-ix * sin - iz * cos) / len * targetSpeed * -1;

      if (P.onGround) {
        var k = hasInput ? MV.accel : MV.friction;
        P.vel.x += (wx - P.vel.x) * Math.min(1, dt * k);
        P.vel.z += (wz - P.vel.z) * Math.min(1, dt * k);
      } else if (hasInput) {
        // air control redirects velocity but preserves momentum (slide-hops):
        // blend toward the wish, then never drop below a slow-bleed floor
        var sp = Math.hypot(P.vel.x, P.vel.z);
        var t = Math.min(1, dt * MV.airAccel);
        var nx = P.vel.x + (wx - P.vel.x) * t;
        var nz = P.vel.z + (wz - P.vel.z) * t;
        var nsp = Math.hypot(nx, nz) || 1e-6;
        var floor = sp * Math.exp(-0.3 * dt);
        var scale = Math.max(nsp, floor) / nsp;
        P.vel.x = nx * scale;
        P.vel.z = nz * scale;
      } else {
        var drag = Math.exp(-MV.airDrag * dt);
        P.vel.x *= drag;
        P.vel.z *= drag;
      }
    }

    /* ------------------------------------------------- jump / gravity */
    if (G.keys.Space && P.onGround && playing) {
      if (P.stance === 'slide') {
        // slide-hop: keep the boosted momentum
        P.stance = crouchKey ? 'crouch' : 'stand';
        P.slideCd = MV.slideCd * 0.6;
      }
      P.vel.y = MV.jumpV;
      P.onGround = false;
    }
    if (!P.onGround) P.vel.y -= MV.gravity * dt;
    var fallV = P.vel.y;

    P.pos.x += P.vel.x * dt;
    P.pos.z += P.vel.z * dt;
    P.pos.y += P.vel.y * dt;
    if (P.pos.y <= 0) {
      if (!P.onGround && fallV < -5.5) {
        P.landDip = Math.min(0.16, 0.05 + (-fallV - 5.5) * 0.018);
        G.audio.land();
      }
      P.pos.y = 0;
      P.vel.y = 0;
      P.onGround = true;
    }
    collide();

    /* ------------------------------------------------- camera feel */
    hSpeed = Math.hypot(P.vel.x, P.vel.z);
    var moving = hSpeed > 0.5;
    if (moving && P.onGround && P.stance !== 'slide') P.bobT += dt * (5 + hSpeed * 0.95);
    var bobScale = (moving && P.onGround ? 1 : 0) * Math.min(1, hSpeed / 7) * (1 - 0.85 * P.ads);
    // camera bob is near zero (head stays steady); the gun carries the motion
    P.bobX = Math.sin(P.bobT) * MV.bobCam * bobScale;
    P.bobY = Math.sin(P.bobT * 2) * MV.bobCam * 0.55 * bobScale;
    P.vmBobX = Math.sin(P.bobT) * MV.bobGun * bobScale;
    P.vmBobY = Math.sin(P.bobT * 2) * MV.bobGun * 0.55 * bobScale;

    P.slideAmt += ((P.stance === 'slide' ? 1 : 0) - P.slideAmt) * Math.min(1, dt * 11);
    var eyeTarget = P.stance === 'slide' ? 0.72 : (P.stance === 'crouch' ? 1.05 : P.height);
    P.eyeCur += (eyeTarget - P.eyeCur) * Math.min(1, dt * 12);
    P.landDip *= Math.exp(-dt * 6.5);

    // strafe lean + slide roll
    var rollT = -ix * 0.018 * (playing ? 1 : 0) - P.slideAmt * 0.055;
    P.roll += (rollT - P.roll) * Math.min(1, dt * 10);

    // sway decay
    P.swayX *= Math.exp(-dt * 9);
    P.swayY *= Math.exp(-dt * 9);

    // FOV: sprint/slide widen, ADS narrows (ADS wins); snipers zoom deeper
    var fovHip = MV.fov + MV.fovSprint * P.sprintAmt * (1 - P.slideAmt) +
                 MV.fovSlide * P.slideAmt;
    var curGun = W.current && W.current();
    var adsFov = (curGun && G.CFG.WEAPONS[curGun.id].adsFov) || MV.fovAds;
    var fov = fovHip + (adsFov - fovHip) * P.ads;
    if (Math.abs(G.camera.fov - fov) > 0.01) {
      G.camera.fov = fov;
      G.camera.updateProjectionMatrix();
    }

    // recoil + shake decay
    P.kickPitch *= Math.pow(0.001, dt);
    P.shakeAmt *= Math.pow(0.01, dt);
    var shX = (Math.random() - 0.5) * P.shakeAmt * 0.06;
    var shY = (Math.random() - 0.5) * P.shakeAmt * 0.06;

    var camY = P.downed ? 0.6 : P.eyeCur;
    G.camera.position.set(P.pos.x, P.pos.y + camY + P.bobY - P.landDip, P.pos.z);
    G.camera.rotation.order = 'YXZ';
    G.camera.rotation.y = P.yaw + shX;
    G.camera.rotation.x = P.pitch + P.kickPitch + shY + (P.downed ? -0.25 : 0);
    G.camera.rotation.z = P.roll + (P.downed ? 0.4 : 0);
  };
})();
