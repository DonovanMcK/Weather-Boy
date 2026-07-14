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
    downed: false, downTimer: 0, invuln: 0, _hb: 0, _widowCd: 0,
    shield: { has: false, owned: false, hp: 0, max: 5 },
    heart: { has: false, ready: false },
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
    P.yaw = 0; // face -z, into the map (spawn rooms sit on the south edge)
    P.maxHp = G.CFG.PLAYER_HP;
    P.hp = P.maxHp;
    P.shield = { has: false, owned: false, hp: 0, max: 5 };
    P.heart = { has: false, ready: false };
  };

  // a hit from behind is eaten by the carried shield until it shatters
  P.shieldBlocks = function (fromX, fromZ) {
    var sh = P.shield;
    if (!sh || !sh.has || sh.hp <= 0) return false;
    var bx = -Math.sin(P.yaw), bz = -Math.cos(P.yaw);   // forward (facing) vector
    var dx = fromX - P.pos.x, dz = fromZ - P.pos.z;
    var len = Math.hypot(dx, dz) || 1;
    var dot = (dx / len) * bx + (dz / len) * bz;         // >0 in front, <0 behind
    if (dot > -0.15) return false;                        // attacker is not behind you
    sh.hp--;
    if (sh.hp <= 0) {
      sh.has = false;
      G.hud.banner('SHIELD SHATTERED', '#fa6', 1.8, 'Rebuild it at the bench');
      G.audio.land();
    } else {
      G.audio.hurt();
    }
    if (G.hud.setShield) G.hud.setShield(P.shield);
    return true;
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

  // attacker bearing in the player's own frame: 0 = dead ahead (screen top),
  // +pi/2 = the player's right, +-pi = directly behind. Drives the HUD arc.
  P.hitBearing = function (fromX, fromZ) {
    var ddx = fromX - P.pos.x, ddz = fromZ - P.pos.z;
    var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    return Math.atan2(ddx * cy - ddz * sy, -ddx * sy - ddz * cy);
  };

  P.damage = function (dmg, fromX, fromZ) {
    if (P.downed || P.invuln > 0 || G.state !== 'playing') return;
    // Heart of the Giant: one lethal hit per round is caught at one health and
    // converted into a factory-wide electrical stun. It is a full-quest reward,
    // not a hidden extra hit baked into the normal health model.
    if (P.heart && P.heart.has && P.heart.ready && P.hp - dmg <= 0) {
      P.heart.ready = false;
      P.hp = 1; P.invuln = Math.max(P.invuln, 2.5); P.regenTimer = 0;
      if (G.zombies && G.zombies.aoe) G.zombies.aoe(P.pos, 0, 18, { slow: 4, boom: true, y: P.pos.y || 0 });
      if (G.weapons && G.weapons.heartBurst) G.weapons.heartBurst(P.pos);
      G.hud.banner('HEART OF THE GIANT', '#7fffd4', 3, 'Fatal damage denied — emergency discharge spent');
      if (G.hud.setHeart) G.hud.setHeart(P.heart);
      return;
    }
    P.hp -= dmg;
    P.regenTimer = 0;
    G.audio.hurt();
    P.shake(0.4);
    // directional hit indicator: point the HUD arc toward the attacker
    if (fromX != null && G.hud.damageFrom) G.hud.damageFrom(P.hitBearing(fromX, fromZ));
    // Widow's Wine: getting hit bursts a web that damages + slows the swarm
    // around you (short cooldown so it's a panic button, not a constant aura)
    if (P.hasPerk('widows') && P._widowCd <= 0) {
      P._widowCd = 3;
      G.weapons.boom(P.pos, 400, 4.5, 0x9a3cea, { slow: 4 });
    }
    if (P.hp <= 0) P.down();
  };

  P.grantGiantHeart = function () {
    P.heart = { has: true, ready: true };
    if (G.hud.setHeart) G.hud.setHeart(P.heart);
  };

  P.giantHeartRoundStart = function () {
    if (!P.heart || !P.heart.has) return;
    P.heart.ready = true;
    // The heart repairs a shield the player has actually assembled; it never
    // grants the buildable for free.
    if (P.shield && P.shield.owned) {
      P.shield.has = true;
      P.shield.hp = P.shield.max;
      if (G.hud.setShield) G.hud.setShield(P.shield);
    }
    if (G.hud.setHeart) G.hud.setHeart(P.heart);
  };

  // shove the player (boss charge impact). Direct positional knockback resolved
  // against world collision, since the movement integrator owns velocity.
  P.knockback = function (dx, dz, dist) {
    if (P.downed || G.state !== 'playing') return;
    var len = Math.hypot(dx, dz) || 1;
    var ux = dx / len, uz = dz / len, total = dist || 2.4;
    // sub-step the shove so it can't leap across a thin wall in one go
    // (each step is well under WALL_T, so collide() always catches the wall)
    var steps = Math.max(1, Math.ceil(total / 0.2));
    for (var s = 0; s < steps; s++) {
      P.pos.x += ux * (total / steps);
      P.pos.z += uz * (total / steps);
      collide();
    }
    P.shake(0.8);
  };

  // Solo Quick Revive rules: 4s blackout with a countdown, then back up at
  // full health with a short mercy window — all perks (QR included) are lost.
  P.down = function () {
    if (P.hasPerk('revive')) {
      P.downed = true;
      P.downTimer = 4;
      P._hb = 0;
      G.audio.downed();
      G.hud.showDowned(true);
      P.losePerks();
      G.zombies.despawnForDown(); // the horde fades out instead of camping you
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
  var STEP = 0.55;   // how tall a ledge you can step straight up / mount onto
  function collide() {
    var cols = G.map.colliders;
    var feet = P.pos.y, head = P.pos.y + P.height;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        if (!c.on) continue;
        // skip colliders we're standing on top of, or that sit entirely
        // overhead (so platforms are walkable and you can pass beneath catwalks)
        if (feet >= c.y2 - STEP) continue;
        if (head <= c.y1 + 0.02) continue;
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
      P._hb -= dt;
      if (P._hb <= 0) { P._hb = 0.95; G.audio.heartbeat(); }
      G.hud.setDownedTimer(P.downTimer);
      if (P.downTimer <= 0) {
        P.downed = false;
        P.hp = P.maxHp;
        P.invuln = 2.5;        // mercy window so the horde can't re-down you instantly
        G.hud.showDowned(false);
        G.hud.banner('BACK ON YOUR FEET', '#6f6', 2, 'All perks lost');
      }
    }
    if (P.invuln > 0) P.invuln -= dt;
    if (P._widowCd > 0) P._widowCd -= dt;

    // regen
    P.regenTimer += dt;
    if (P.regenTimer > G.CFG.REGEN_DELAY && P.hp < P.maxHp && !P.downed) {
      P.hp = Math.min(P.maxHp, P.hp + G.CFG.REGEN_RATE * dt);
    }
    G.hud.setVignette(1 - P.hp / P.maxHp);
    G.hud.setHealth(P.hp, P.maxHp);

    var playing = G.state === 'playing' && !P.downed && !P.locked;

    /* ------------------------------------------------------ intent */
    var ix = 0, iz = 0;
    if (playing) {
      if (G.keys.KeyW) iz -= 1;
      if (G.keys.KeyS) iz += 1;
      if (G.keys.KeyA) ix -= 1;
      if (G.keys.KeyD) ix += 1;
      // gamepad left stick (analog intent; idle pad contributes 0)
      if (G.gamepad && G.gamepad.connected) { ix += G.gamepad.moveX; iz += G.gamepad.moveZ; }
      // phone controller (idle phone contributes 0)
      if (G.remote && G.remote.connected) { ix += G.remote.moveX; iz += G.remote.moveZ; }
    }
    ix = Math.max(-1, Math.min(1, ix));
    iz = Math.max(-1, Math.min(1, iz));
    var gp = G.gamepad;
    var rc = G.remote;
    var hasInput = Math.abs(ix) > 0.01 || Math.abs(iz) > 0.01;
    var crouchKey = ((!!G.keys.KeyC) || (gp && gp.crouch) || (rc && rc.crouch)) && playing;
    var crouchEdge = crouchKey && !P._prevCrouch;
    P._prevCrouch = crouchKey;
    var hSpeed = Math.hypot(P.vel.x, P.vel.z);

    // ADS (cancels sprint; blocked during reload/switch/knife;
    // disabled entirely in simple-aim/trackpad mode)
    var adsAllowed = !G.settings || G.settings.aimMode !== 'simple';
    var adsHeld = W.adsHeld || (gp && gp.ads) || (rc && rc.ads);
    var firing = W.mouseDown || (gp && gp.fire) || (rc && rc.fire);
    var adsTarget = (playing && adsAllowed && adsHeld && W.reloading <= 0 &&
                     W.switching <= 0 && W.knifing <= 0) ? 1 : 0;
    P.ads += (adsTarget - P.ads) * Math.min(1, dt * MV.adsSpeed);
    if (P.ads < 0.002 && !adsTarget) P.ads = 0;

    // sprint: holding fire or ADS ramps sprint out (sprint-out delay),
    // releasing ramps it back in — BO3 auto-resume.
    // Normally you only sprint forward; Stamin-Up lets you sprint any direction
    // (including backpedalling away from a horde).
    var sprintHeld = G.keys.ShiftLeft || (gp && gp.sprint) || (rc && rc.sprint);
    var sprintDir = P.hasPerk('stamin') ? hasInput : (iz < 0);
    var wantSprint = playing && sprintHeld && sprintDir &&
                     P.stance !== 'slide' && !crouchKey &&
                     adsTarget === 0 && !firing;
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
        // PhD Slider: a slide detonates a blast around you
        if (P.hasPerk('phd')) G.weapons.boom(P.pos, 900, 4.8, 0xff8a2a, { boom: true });
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

      // world wish: forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
      var len = Math.hypot(ix, iz) || 1;
      var sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
      var wx = (ix * cos + iz * sin) / len * targetSpeed;
      var wz = (-ix * sin + iz * cos) / len * targetSpeed;

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
    var wasGround = P.onGround;
    if ((G.keys.Space || (gp && gp.jump) || (rc && rc.jump)) && P.onGround && playing) {
      if (P.stance === 'slide') {
        // slide-hop: keep the boosted momentum
        P.stance = crouchKey ? 'crouch' : 'stand';
        P.slideCd = MV.slideCd * 0.6;
      }
      P.vel.y = MV.jumpV;
      P.onGround = false;
      wasGround = false;
    }
    if (!P.onGround) P.vel.y -= MV.gravity * dt;
    var fallV = P.vel.y;

    // integrate horizontal motion in sub-steps capped under the wall
    // thickness, colliding each step — fast falls / hops off a top row or
    // the stairs can no longer punch through a wall in a single frame
    var mdx = P.vel.x * dt, mdz = P.vel.z * dt;
    var mdist = Math.hypot(mdx, mdz);
    var msteps = mdist > 0.2 ? Math.ceil(mdist / 0.2) : 1;
    for (var ms = 0; ms < msteps; ms++) {
      P.pos.x += mdx / msteps;
      P.pos.z += mdz / msteps;
      if (ms < msteps - 1) collide();
    }
    P.pos.y += P.vel.y * dt;

    // ground/support: rest on the highest walkable surface under the feet
    // (floor=0, stairs, decks). Grounded, you step up small ledges and ride
    // gentle slopes; walk off an edge and you fall.
    var climb = wasGround ? STEP : 0.05;
    var support = G.map.supportAt ? G.map.supportAt(P.pos.x, P.pos.z, P.pos.y, climb) : 0;
    // swept landing: a fast fall can move past a thin ELEVATED floor in a single
    // frame (the per-feet support check only sees surfaces within `climb`). Catch
    // any walkable surface the feet crossed between last frame's Y and now, so a
    // body falling onto an upper floor lands on it instead of tunnelling through.
    if (P.vel.y < 0 && G.map.supportAt) {
      var prevY = P.pos.y - P.vel.y * dt;
      var crossed = G.map.supportAt(P.pos.x, P.pos.z, prevY, 0.05);
      if (crossed > support && crossed > P.pos.y && crossed <= prevY + 0.05) support = crossed;
    }
    if (P.pos.y <= support + 1e-3) {
      if (!P.onGround && fallV < -5.5) {
        P.landDip = Math.min(0.16, 0.05 + (-fallV - 5.5) * 0.018);
        G.audio.land();
      }
      P.pos.y = support;
      P.vel.y = 0;
      P.onGround = true;
    } else if (wasGround && P.vel.y <= 0 && (P.pos.y - support) <= STEP) {
      // small step down — stay glued to the floor instead of launching off
      P.pos.y = support;
      P.vel.y = 0;
      P.onGround = true;
    } else {
      P.onGround = false;
    }
    // remember the last solid footing, and recover from a void fall: with no
    // implicit ground plane, walking off a sunk floor / the open atrium edge
    // would otherwise drop you forever. Below the void line, snap back to the
    // last grounded spot (a brief stagger, not a death).
    if (P.onGround) P.lastGround = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
    var voidY = (G.map.minFloorY || 0) - 8;
    if (P.pos.y < voidY) {
      var lg = P.lastGround || { x: P.pos.x, y: 0, z: P.pos.z };
      P.pos.set(lg.x, lg.y, lg.z);
      P.vel.set(0, 0, 0);
      P.onGround = true;
      P.shake(0.6);
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
