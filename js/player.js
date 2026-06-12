/* ===========================================================================
   DER WETTERJUNGE — player.js
   Pointer-lock FPS controller, collision, health/downs, points.
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
    perks: [],            // perk ids in pickup order
    qrBuys: 0,
    frags: 2, monkeys: 0, hasMonkeys: false,
    regenTimer: 0,
    onGround: true,
    downed: false, downTimer: 0,
    kickPitch: 0,
    shakeAmt: 0,
    bobT: 0,
    locked: false          // input locked (PaP, teleport, drinking)
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
      // QR is consumed along with everything else
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
    P.yaw -= e.movementX * 0.0021;
    P.pitch -= e.movementY * 0.0021;
    P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
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
          if (d < 1e-5) { // inside the box: push along smallest exit
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

    // movement
    var moveX = 0, moveZ = 0;
    if (!P.downed && !P.locked && G.state === 'playing') {
      if (G.keys.KeyW) moveZ -= 1;
      if (G.keys.KeyS) moveZ += 1;
      if (G.keys.KeyA) moveX -= 1;
      if (G.keys.KeyD) moveX += 1;
    }
    var speed = 4.4;
    var sprinting = G.keys.ShiftLeft && moveZ < 0;
    if (sprinting) speed *= P.hasPerk('stamin') ? 1.74 : 1.5;
    if (P.downed) speed = 0;

    var sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    var len = Math.hypot(moveX, moveZ) || 1;
    var vx = (moveX * cos - moveZ * sin) / len * speed;
    var vz = (-moveX * sin - moveZ * cos) / len * speed * -1;
    // smooth accelerate
    P.vel.x += (vx - P.vel.x) * Math.min(1, dt * 12);
    P.vel.z += (vz - P.vel.z) * Math.min(1, dt * 12);

    // jump / gravity
    if (G.keys.Space && P.onGround && !P.downed && !P.locked) { P.vel.y = 4.6; P.onGround = false; }
    if (!P.onGround) P.vel.y -= 11 * dt;

    P.pos.x += P.vel.x * dt;
    P.pos.z += P.vel.z * dt;
    P.pos.y += P.vel.y * dt;
    if (P.pos.y <= 0) { P.pos.y = 0; P.vel.y = 0; P.onGround = true; }
    collide();

    // view bob
    var moving = Math.hypot(P.vel.x, P.vel.z) > 0.5;
    if (moving && P.onGround) P.bobT += dt * (sprinting ? 11 : 8);
    var bob = moving && P.onGround ? Math.sin(P.bobT) * 0.035 : 0;

    // recoil + shake decay
    P.kickPitch *= Math.pow(0.001, dt);
    P.shakeAmt *= Math.pow(0.01, dt);
    var shX = (Math.random() - 0.5) * P.shakeAmt * 0.06;
    var shY = (Math.random() - 0.5) * P.shakeAmt * 0.06;

    var camY = P.downed ? 0.6 : P.height;
    G.camera.position.set(P.pos.x, P.pos.y + camY + bob, P.pos.z);
    G.camera.rotation.order = 'YXZ';
    G.camera.rotation.y = P.yaw + shX;
    G.camera.rotation.x = P.pitch + P.kickPitch + shY + (P.downed ? -0.25 : 0);
    G.camera.rotation.z = P.downed ? 0.4 : 0;
  };
})();
