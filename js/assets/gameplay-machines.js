/* ===========================================================================
   TOTENSTURM — assets/gameplay-machines.js
   Priority-1 hero machines as reusable root-group props. Visuals + visual
   state + animation handles only; gameplay logic stays in interact.js / map.js.
   Convention: built at local origin, feet on y=0, FRONT facing +Z.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G, PU = G.PU;
  function M(n) { return G.MAT.get(n); }
  function EM(c, i, b) { return G.MAT.emissive(c, i, b); }
  function SCR(c, i) { return G.MAT.screen(c, i); }

  // a private (per-instance) tinted metal — flagged so dispose() can free it
  function tinted(color, tex) {
    var m = new THREE.MeshLambertMaterial({ color: color, map: tex !== false && G.tex ? G.tex.metal : null });
    m.userData.ownMaterial = true; return m;
  }
  function canvasTex(w, h, draw) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(cv); t.userData = { own: true }; return t;
  }
  function labelTex(text, color) {
    return canvasTex(256, 64, function (c) {
      c.fillStyle = '#0b0d10'; c.fillRect(0, 0, 256, 64);
      c.fillStyle = color || '#ffe9b0'; c.font = 'bold 32px Georgia, serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 128, 34);
    });
  }
  function bottleTex(color, icon) {
    return canvasTex(128, 192, function (c) {
      c.fillStyle = '#0c0f14'; c.fillRect(0, 0, 128, 192);
      c.fillStyle = color; c.fillRect(54, 40, 20, 14);
      c.beginPath(); c.moveTo(46, 54); c.lineTo(82, 54); c.lineTo(88, 78);
      c.lineTo(88, 160); c.lineTo(40, 160); c.lineTo(40, 78); c.closePath(); c.fill();
      c.fillStyle = '#0c0f14'; c.fillRect(46, 98, 36, 30);
      c.fillStyle = '#fff'; c.font = 'bold 26px Georgia, serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(icon || '?', 64, 116);
    });
  }
  function emblemMat(color) {
    var m = new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, function (c) {
      c.clearRect(0, 0, 128, 128);
      c.strokeStyle = color; c.lineWidth = 8; c.strokeRect(12, 12, 104, 104);
      c.fillStyle = color; c.font = 'bold 92px Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = color; c.shadowBlur = 22; c.fillText('?', 64, 70);
    }), transparent: true });
    m.userData.ownMaterial = true; return m;
  }

  /* ===================== Mystery Box — occult supply chest ============== */
  G.Props.register('mystery_box', function () {
    var g = PU.group('mystery_box');
    var wood = M('crateWood'), iron = M('darkIron'), steel = M('bareSteel');
    // reinforced body
    PU.beveledBox(g, 1.7, 0.78, 0.92, 0.05, wood, 0, 0.42, 0);
    // corner brackets + feet
    [[-0.82, -0.43], [0.82, -0.43], [-0.82, 0.43], [0.82, 0.43]].forEach(function (c) {
      PU.box(g, 0.1, 0.82, 0.1, c[0], 0.42, c[1], iron);
      PU.box(g, 0.16, 0.1, 0.16, c[0], 0.05, c[1], iron);
    });
    // steel banding
    PU.box(g, 1.76, 0.09, 0.97, 0, 0.2, 0, steel);
    PU.box(g, 1.76, 0.09, 0.97, 0, 0.64, 0, steel);
    // side handles
    PU.torus(g, 0.12, 0.025, -0.88, 0.5, 0, iron, 5, 'x');
    PU.torus(g, 0.12, 0.025, 0.88, 0.5, 0, iron, 5, 'x');
    // front latch + glowing emblem
    PU.box(g, 0.24, 0.34, 0.05, 0, 0.46, 0.47, steel);
    var latch = PU.box(g, 0.1, 0.14, 0.05, 0, 0.32, 0.49, EM(0x3a6bff, 0.7, 0x101830));
    // hinged lid (contract: userData.lid.position.y 0.85 closed / 1.1 open)
    var lid = PU.group('lid');
    PU.beveledBox(lid, 1.74, 0.16, 0.96, 0.04, wood, 0, 0.09, 0);
    PU.box(lid, 1.8, 0.05, 1.0, 0, 0.18, 0, steel);
    PU.box(lid, 0.5, 0.04, 0.5, 0, 0.2, 0, EM(0x1830ff, 0.5, 0x0a1020));   // recessed glow tray
    var q = PU.panel(lid, 0.46, 0.46, 0, 0.205, 0, emblemMat('#9ec2ff')); q.rotation.x = -Math.PI / 2;
    var qf = PU.panel(lid, 0.4, 0.34, 0, 0.0, 0.49, emblemMat('#9ec2ff'));  // front emblem
    lid.position.y = 0.85; g.add(lid);
    // hinges along the back rim
    PU.cyl(g, 0.05, 0.05, 0.18, -0.45, 0.78, -0.46, iron, 8, 'x');
    PU.cyl(g, 0.05, 0.05, 0.18, 0.45, 0.78, -0.46, iron, 8, 'x');
    // interior glow (dim until opening) + weapon display anchor
    var innerGlow = PU.box(g, 1.4, 0.04, 0.7, 0, 0.8, 0, EM(0x2a4cff, 0.2, 0x0a1226));
    var glowLight = new THREE.PointLight(0x4a7bff, 0.55, 4); glowLight.position.y = 1.05; g.add(glowLight);
    var wAnchor = new THREE.Object3D(); wAnchor.position.set(0, 0.6, 0); g.add(wAnchor);
    g.userData.lid = lid;
    g.userData.internalGlow = glowLight;
    g.userData.innerPanel = innerGlow;
    g.userData.weaponDisplayAnchor = wAnchor;
    g.userData.interactive = true;
    PU.colliderSpec(g, 0.88, 0.5, 0, 0.95);
    PU.interactionAnchor(g, [0, 0.7, 0.55], { maxDist: 2.2 });
    return g;
  });

  /* ===================== Perk vending machines ========================= */
  function perkBase(g, color) {
    var iron = M('darkIron'), steel = M('bareSteel'), body = tinted(color);
    // base plinth + feet
    PU.beveledBox(g, 0.98, 0.14, 0.78, 0.03, iron, 0, 0.07, 0);
    [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(function (c) {
      PU.box(g, 0.1, 0.06, 0.1, c[0], 0.02, c[1], iron);
    });
    // cabinet
    var cab = PU.beveledBox(g, 0.9, 1.5, 0.7, 0.06, body, 0, 0.88, 0);
    PU.markSolid(g, cab);
    // side vents
    [-0.42, 0.42].forEach(function (sx) {
      for (var i = 0; i < 4; i++) PU.box(g, 0.04, 0.04, 0.36, sx, 0.7 + i * 0.12, 0, iron);
    });
    // dispensing tray (recessed near base front)
    PU.box(g, 0.5, 0.12, 0.12, 0, 0.42, 0.34, iron);
    PU.box(g, 0.46, 0.02, 0.1, 0, 0.43, 0.37, EM(0x111316, 0.0, 0x111316));
    // coin slot + button
    PU.box(g, 0.14, 0.2, 0.05, 0.28, 1.0, 0.36, steel);
    PU.box(g, 0.06, 0.01, 0.02, 0.28, 1.05, 0.39, M('bakelite'));
    return { body: body, iron: iron, steel: steel };
  }
  function perkBuilder(opts) {
    var def = opts.def || { color: 0x33aaff, name: 'Tonic', icon: '+' };
    var variant = opts.variant || 'perk';
    var color = def.color;
    var g = PU.group('perk_' + variant);
    var p = perkBase(g, color);
    // illuminated top sign (marquee)
    PU.beveledBox(g, 0.96, 0.34, 0.34, 0.03, p.iron, 0, 1.78, 0);
    var signMat = SCR(color, 0.85);
    var sign = PU.panel(g, 0.84, 0.26, 0, 1.78, 0.18, signMat);
    var signLabel = PU.panel(g, 0.8, 0.2, 0, 1.78, 0.181, new THREE.MeshBasicMaterial({
      map: labelTex((def.name || 'PERK').split(' ')[0].toUpperCase(), '#' + new THREE.Color(color).getHexString()),
      transparent: true }));
    signLabel.material.userData.ownMaterial = true;
    // product window: glass over an emissive bottle silhouette
    PU.box(g, 0.66, 0.84, 0.04, 0, 1.06, 0.35, M('darkIron'));
    var bottle = PU.panel(g, 0.56, 0.78, 0, 1.06, 0.37, new THREE.MeshBasicMaterial({
      map: bottleTex('#' + new THREE.Color(color).getHexString(), def.icon || '?'), transparent: true }));
    bottle.material.userData.ownMaterial = true;
    PU.panel(g, 0.6, 0.8, 0, 1.06, 0.385, M('glass'));
    // emissive indicator bulbs
    var b1 = PU.sphere(g, 0.04, -0.3, 1.62, 0.36, EM(color, 0.9, 0x070707), 8);
    var b2 = PU.sphere(g, 0.04, 0.3, 1.62, 0.36, EM(color, 0.9, 0x070707), 8);

    // Wunderfizz: taller, domed, more mechanical + multi-hue
    if (variant === 'wonderfizz') {
      PU.lathe(g, [[0.0, 0], [0.42, 0], [0.48, 0.14], [0.4, 0.3], [0.22, 0.42], [0.0, 0.5]],
        EM(0x9b30ff, 0.5, 0x120726), 14).position.y = 1.96;
      PU.torus(g, 0.46, 0.04, 0, 1.96, 0, M('brass'), 6, 'flat');
      // fortune-machine pipes
      [-0.36, 0.36].forEach(function (sx) {
        PU.tube(g, [[sx, 0.3, 0.3], [sx + Math.sign(sx) * 0.18, 0.9, 0.34], [sx, 1.6, 0.3]], 0.04, M('copper'), 10, 6);
      });
      PU.sphere(g, 0.1, 0, 2.5, 0, EM(0xff44dd, 1.0, 0x200818), 10);
    }

    g.userData.interactive = true;
    g.userData.sign = sign; g.userData.signLabel = signLabel;
    g.userData.indicators = [b1, b2];
    g.userData.perk = variant;
    g.userData.setPowered = function (on) {
      [b1, b2].forEach(function (b) { b.material = on ? EM(color, 1.0, 0x070707) : EM(color, 0.25, 0x070707); });
    };
    PU.colliderSpec(g, 0.48, 0.38, 0, 1.9);
    PU.interactionAnchor(g, [0, 1.0, 0.5], { maxDist: 2.4 });
    return g;
  }
  G.Props.register('perk_machine', perkBuilder);

  /* ===================== Pack-a-Punch ================================== */
  G.Props.register('pack_a_punch', function () {
    var g = PU.group('pack_a_punch');
    var dark = M('darkIron'), steel = M('bareSteel'), gold = M('gold');
    PU.beveledBox(g, 1.62, 0.18, 1.06, 0.04, dark, 0, 0.09, 0);            // plinth
    var bodyM = PU.beveledBox(g, 1.5, 1.18, 0.95, 0.06, dark, 0, 0.78, 0); // body
    PU.markSolid(g, bodyM);
    // sloped hopper
    var hop = PU.cyl(g, 0.36, 0.64, 0.72, 0, 1.62, 0, dark, 4); hop.rotation.y = Math.PI / 4;
    // large glowing insertion slot (front)
    PU.box(g, 0.98, 0.5, 0.1, 0, 0.95, 0.46, steel);
    var glow = PU.box(g, 0.86, 0.4, 0.06, 0, 0.95, 0.5, EM(0x7a33ff, 0.85, 0x140a2a));
    // rollers / conveyor inside the slot
    var rollers = [];
    [-0.26, 0, 0.26].forEach(function (rx) {
      rollers.push(PU.cyl(g, 0.07, 0.07, 0.7, rx, 0.95, 0.46, steel, 8, 'x'));
    });
    // mechanical clamps flanking the mouth
    PU.box(g, 0.12, 0.36, 0.28, -0.5, 0.95, 0.5, steel).rotation.x = 0.2;
    PU.box(g, 0.12, 0.36, 0.28, 0.5, 0.95, 0.5, steel).rotation.x = 0.2;
    // gold trims + output tray
    PU.box(g, 1.56, 0.08, 1.0, 0, 1.2, 0, gold);
    PU.box(g, 0.72, 0.1, 0.46, 0, 0.42, 0.62, gold);
    // illuminated marquee
    PU.box(g, 1.2, 0.26, 0.18, 0, 1.74, 0.2, dark);
    var marquee = PU.panel(g, 1.06, 0.18, 0, 1.74, 0.3, new THREE.MeshBasicMaterial({
      map: labelTex('PACK·A·PUNCH', '#ffcf6a'), transparent: true })); marquee.material.userData.ownMaterial = true;
    // side pipes + cables
    [-0.83, 0.83].forEach(function (sx) {
      PU.cyl(g, 0.06, 0.06, 1.1, sx, 0.85, -0.2, M('copper'), 8);
      PU.tube(g, [[sx, 0.2, -0.3], [sx * 0.7, 0.6, -0.45], [sx * 0.5, 1.1, -0.3]], 0.035, M('rubberHose'), 8, 5);
    });
    // control panel
    PU.box(g, 0.34, 0.24, 0.06, 0.5, 0.6, 0.49, M('bakelite'));
    PU.sphere(g, 0.03, 0.43, 0.6, 0.53, EM(0x33ff66, 0.9, 0x061206), 6);
    PU.sphere(g, 0.03, 0.57, 0.6, 0.53, EM(0xff3322, 0.9, 0x120606), 6);
    var pl = new THREE.PointLight(0x8844ff, 0.7, 6); pl.position.set(0, 0.95, 0.55); g.add(pl);
    var grab = new THREE.Object3D(); grab.position.set(0, 1.0, 0.7); g.add(grab);
    g.userData.interactive = true;
    g.userData.glow = glow; g.userData.rollers = rollers; g.userData.marquee = marquee;
    g.userData.light = pl; g.userData.weaponGrabAnchor = grab;
    PU.colliderSpec(g, 0.75, 0.48, 0, 1.4);
    PU.interactionAnchor(g, [0, 1.0, 0.6], { maxDist: 2.4 });
    return g;
  });

  /* ===================== Power switch (wall assembly) ================== */
  G.Props.register('power_switch', function () {
    var g = PU.group('power_switch');
    var dark = M('darkIron'), steel = M('bareSteel'), ceramic = M('ceramic');
    var jbox = PU.beveledBox(g, 0.62, 0.86, 0.2, 0.03, dark, 0, 1.3, -0.02);
    PU.markSolid(g, jbox);
    // ceramic insulators
    [[-0.18, 1.62], [0.18, 1.62]].forEach(function (p) {
      PU.cyl(g, 0.05, 0.06, 0.12, p[0], p[1], 0.1, ceramic, 8);
    });
    // analog gauge
    PU.cyl(g, 0.1, 0.1, 0.03, -0.18, 1.18, 0.12, steel, 12, 'z');
    var needle = PU.box(g, 0.01, 0.08, 0.005, -0.18, 1.21, 0.14, EM(0xffaa22, 0.8, 0x1a1206));
    // warning label
    PU.panel(g, 0.28, 0.16, 0.12, 1.0, 0.11, new THREE.MeshBasicMaterial({
      map: labelTex('⚠ HIGH VOLTAGE', '#e0b020'), transparent: true })).material.userData.ownMaterial = true;
    // big throw lever on a pivot — userData.lever rotates up when powered
    var lever = PU.group('lever'); lever.position.set(0.16, 1.42, 0.12);
    PU.cyl(lever, 0.04, 0.04, 0.5, 0, -0.18, 0, steel, 8); // shaft pointing down (off)
    PU.sphere(lever, 0.06, 0, -0.36, 0, M('bakelite'), 8); // handle knob
    lever.rotation.x = 0.5; g.add(lever);
    PU.box(g, 0.12, 0.16, 0.06, 0.16, 1.42, 0.1, steel); // lever housing
    // heavy cables down the wall
    PU.tube(g, [[-0.2, 0.9, 0.0], [-0.26, 0.4, 0.06], [-0.2, 0.0, 0.0]], 0.04, M('rubberHose'), 8, 6);
    PU.tube(g, [[0.2, 0.9, 0.0], [0.28, 0.4, 0.06], [0.22, 0.0, 0.0]], 0.04, M('rubberHose'), 8, 6);
    // indicator bulbs (red off / green on)
    var bulb = PU.sphere(g, 0.05, -0.18, 0.95, 0.12, EM(0xff2200, 0.5, 0x120303), 8);
    g.userData.interactive = true;
    g.userData.lever = lever; g.userData.indicator = bulb; g.userData.needle = needle;
    g.userData.powered = false;
    g.userData.setPowered = function (on) {
      g.userData.powered = !!on;
      lever.rotation.x = on ? -0.5 : 0.5;
      bulb.material = on ? EM(0x33ff44, 1.0, 0x031203) : EM(0xff2200, 0.5, 0x120303);
      if (on) { var sp = new THREE.PointLight(0x66ff88, 0.0, 3); }
    };
    PU.interactionAnchor(g, [0, 1.3, 0.4], { maxDist: 2.4 });
    return g;
  });

  /* ===================== Teleporter pad ================================ */
  G.Props.register('teleporter_pad', function () {
    var g = PU.group('teleporter_pad');
    var steel = M('bareSteel'), dark = M('darkIron'), copper = M('copper');
    // layered circular base
    PU.cyl(g, 1.6, 1.62, 0.12, 0, 0.06, 0, dark, 24);
    PU.cyl(g, 1.42, 1.5, 0.1, 0, 0.16, 0, steel, 24);
    // radial metal segments
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      var seg = PU.box(g, 0.18, 0.04, 0.9, Math.cos(a) * 0.85, 0.22, Math.sin(a) * 0.85, dark);
      seg.rotation.y = -a;
    }
    // central energized surface (gameplay animates this — own material)
    var energyMat = new THREE.MeshLambertMaterial({ color: 0x331111, emissive: new THREE.Color(0x111111) });
    energyMat.userData.ownMaterial = true;
    var energy = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 24), energyMat);
    energy.position.y = 0.2; g.add(energy);
    // 3 conduit posts with emitters + coils
    var posts = [];
    for (var p = 0; p < 3; p++) {
      var ang = p / 3 * Math.PI * 2, px = Math.cos(ang) * 1.5, pz = Math.sin(ang) * 1.5;
      var post = PU.box(g, 0.26, 2.6, 0.26, px, 1.3, pz, steel); PU.markSolid(g, post); posts.push({ x: px, z: pz, mesh: post });
      PU.cyl(g, 0.18, 0.18, 0.18, px, 2.62, pz, dark, 10);
      PU.sphere(g, 0.13, px, 2.74, pz, EM(0x2288cc, 0.6, 0x06121a), 10);
      // copper coil wrap
      for (var k = 0; k < 3; k++) PU.torus(g, 0.17, 0.02, px, 0.6 + k * 0.25, pz, copper, 5, 'flat');
    }
    g.userData.interactive = true;
    g.userData.energy = energy; g.userData.posts = posts;
    PU.interactionAnchor(g, [0, 0.5, 0], { maxDist: 2.3 });
    return g;
  });

  /* ===================== Mainframe terminal ============================ */
  G.Props.register('mainframe', function () {
    var g = PU.group('mainframe');
    var steel = M('bareSteel'), dark = M('darkIron');
    // raised pad
    PU.cyl(g, 1.5, 1.6, 0.2, 0, 0.1, 0, EM(0x114455, 0.5, 0x515c66), 24);
    // angled operator console
    var consoleBody = PU.beveledBox(g, 0.9, 1.2, 0.5, 0.04, dark, 0, 0.7, 0); PU.markSolid(g, consoleBody);
    var deck = PU.box(g, 0.9, 0.1, 0.4, 0, 1.18, 0.12, steel); deck.rotation.x = -0.5; // sloped keydeck
    // CRT / oscilloscope screens
    PU.box(g, 0.7, 0.5, 0.12, 0, 1.2, 0.22, dark);
    var scr = PU.panel(g, 0.6, 0.4, 0, 1.2, 0.29, SCR(0x22cc66, 0.7)); scr.material = SCR(0x22cc66, 0.7);
    // switch banks + keypad + lamps
    for (var r = 0; r < 3; r++) for (var c2 = 0; c2 < 5; c2++)
      PU.box(g, 0.05, 0.03, 0.05, -0.18 + c2 * 0.09, 1.12 - r * 0.06, 0.3 + r * 0.03, M('bakelite'));
    var lamps = [];
    [-0.3, -0.18, -0.06].forEach(function (lx, i) {
      lamps.push(PU.sphere(g, 0.03, lx, 1.42, 0.18, EM([0x33ff66, 0xffaa22, 0x33ccff][i], 0.8, 0x070707), 6));
    });
    // cable bundle + rear housing + legs
    PU.tube(g, [[0.3, 0.4, -0.2], [0.4, 0.1, -0.3], [0.1, 0.0, -0.35]], 0.05, M('rubberHose'), 8, 6);
    PU.box(g, 0.7, 0.9, 0.3, 0, 0.55, -0.35, dark);
    [[-0.38, 0.2], [0.38, 0.2], [-0.38, -0.3], [0.38, -0.3]].forEach(function (lp) {
      PU.cyl(g, 0.04, 0.04, 0.3, lp[0], 0.16, lp[1], steel, 6);
    });
    g.userData.interactive = true; g.userData.screen = scr; g.userData.lamps = lamps;
    PU.colliderSpec(g, 0.45, 0.3, 0, 1.4);
    PU.interactionAnchor(g, [0, 1.0, 0.4], { maxDist: 2.4 });
    return g;
  });

  /* ===================== Settings terminal ============================= */
  G.Props.register('settings_terminal', function () {
    var g = PU.group('settings_terminal');
    var dark = M('darkIron'), steel = M('bareSteel');
    PU.box(g, 0.6, 0.08, 0.5, 0, 0.04, 0, dark);                 // base plate
    PU.cyl(g, 0.08, 0.1, 0.7, 0, 0.43, 0, steel, 10);            // stand
    var head = PU.beveledBox(g, 0.7, 0.5, 0.3, 0.03, dark, 0, 1.0, 0); head.rotation.x = -0.35;
    var screen = PU.panel(g, 0.56, 0.34, 0, 1.06, 0.2, SCR(0x33d6a0, 0.85)); screen.rotation.x = -0.35;
    // physical buttons + rotary
    PU.box(g, 0.5, 0.06, 0.16, 0, 0.78, 0.14, M('bakelite'));
    for (var i = 0; i < 4; i++) PU.sphere(g, 0.02, -0.16 + i * 0.1, 0.81, 0.2, EM(0x33d6a0, 0.7, 0x061410), 6);
    PU.cyl(g, 0.04, 0.04, 0.04, 0.2, 0.8, 0.2, steel, 8, 'z');
    PU.tube(g, [[0.2, 0.4, -0.1], [0.25, 0.1, -0.2], [0.0, 0.0, -0.2]], 0.03, M('rubberHose'), 8, 5);
    g.userData.interactive = true; g.userData.screen = screen;
    PU.interactionAnchor(g, [0, 1.0, 0.35], { maxDist: 2.2 });
    return g;
  });

  /* ===================== Soul chest (occult containment) =============== */
  G.Props.register('soul_chest', function () {
    var g = PU.group('soul_chest');
    var iron = M('darkIron'), wood = M('crateWood');
    PU.beveledBox(g, 0.9, 0.62, 0.9, 0.05, wood, 0, 0.31, 0);     // altar base
    [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].forEach(function (c) {
      PU.box(g, 0.08, 0.66, 0.08, c[0], 0.33, c[1], iron);        // frame posts
      PU.cyl(g, 0.06, 0.06, 0.5, c[0], 0.85, c[1], iron, 6);      // soul intake emitters
      PU.sphere(g, 0.06, c[0], 1.12, c[1], EM(0x9933ff, 0.8, 0x14081f), 8);
    });
    PU.box(g, 0.96, 0.08, 0.96, 0, 0.66, 0, iron);                // lid rim
    // glowing core in a reservoir
    var core = PU.sphere(g, 0.26, 0, 0.9, 0, EM(0x8822ff, 0.9, 0x12001f), 12);
    PU.torus(g, 0.3, 0.04, 0, 0.66, 0, M('brass'), 6, 'flat');    // ring around the reservoir
    // ritual conduits
    [0, 1, 2, 3].forEach(function (i) {
      var a = i / 4 * Math.PI * 2 + 0.4;
      PU.tube(g, [[Math.cos(a) * 0.3, 0.66, Math.sin(a) * 0.3], [Math.cos(a) * 0.4, 0.4, Math.sin(a) * 0.4], [Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42]], 0.025, M('copper'), 8, 5);
    });
    var glow = new THREE.PointLight(0x9933ff, 0.9, 9); glow.position.y = 1.2; g.add(glow);
    g.userData.interactive = true; g.userData.core = core; g.userData.glow = glow;
    g.userData.setCharge = function (frac) {
      core.scale.setScalar(0.7 + 0.6 * Math.min(1, frac));
      if (glow) glow.intensity = 0.6 + 1.0 * Math.min(1, frac);
    };
    PU.colliderSpec(g, 0.5, 0.5, 0, 1.0);
    PU.interactionAnchor(g, [0, 0.9, 0.5], { maxDist: 2.2 });
    return g;
  });

  /* ===================== Relic pedestal (mini-EE) ====================== */
  G.Props.register('relic_pedestal', function () {
    var g = PU.group('relic_pedestal');
    var iron = M('darkIron'), stone = M('concreteDark');
    PU.cyl(g, 0.22, 0.26, 0.14, 0, 0.07, 0, stone, 10);
    PU.cyl(g, 0.14, 0.18, 0.34, 0, 0.31, 0, stone, 8);
    var relicMat = new THREE.MeshLambertMaterial({ color: 0x20140a, emissive: new THREE.Color(0x6a3a10), emissiveIntensity: 0.4 });
    relicMat.userData.ownMaterial = true;
    var relic = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), relicMat);
    relic.position.y = 0.62; PU.shadow(relic); g.add(relic);
    g.userData.interactive = true; g.userData.relic = relic;
    g.userData.activate = function () {
      relic.material.emissive = new THREE.Color(0x33ddaa); relic.material.emissiveIntensity = 1.0;
    };
    PU.interactionAnchor(g, [0, 0.6, 0.4], { maxDist: 1.8 });
    return g;
  });

  /* ===================== Wonder-weapon part pickup ===================== */
  G.Props.register('ww_part', function () {
    var g = PU.group('ww_part');
    var steel = M('bareSteel');
    PU.beveledBox(g, 0.3, 0.18, 0.24, 0.03, steel, 0, 0.12, 0);
    PU.cyl(g, 0.05, 0.05, 0.3, 0, 0.32, 0, M('copper'), 8);
    PU.torus(g, 0.09, 0.02, 0, 0.36, 0, EM(0x1f6fa0, 0.7, 0x06141c), 5, 'flat');
    PU.sphere(g, 0.05, 0, 0.46, 0, EM(0x33ccff, 0.8, 0x06141c), 8);
    g.userData.interactive = true;
    PU.interactionAnchor(g, [0, 0.3, 0.3], { maxDist: 1.8 });
    return g;
  });

  /* ===================== Workbenches =================================== */
  function benchFrame(g) {
    var iron = M('darkIron'), wood = M('oldWood');
    var top = PU.beveledBox(g, 1.3, 0.12, 0.78, 0.02, wood, 0, 0.86, 0); PU.markSolid(g, top);
    [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(function (lp) {
      PU.box(g, 0.08, 0.8, 0.08, lp[0], 0.4, lp[1], iron);
    });
    PU.box(g, 1.2, 0.06, 0.5, 0, 0.28, 0, wood);        // lower shelf
    // vise on the corner
    PU.box(g, 0.16, 0.14, 0.2, -0.5, 0.99, 0.2, iron);
    PU.cyl(g, 0.03, 0.03, 0.22, -0.5, 0.99, 0.34, M('bareSteel'), 8, 'z');
    return { iron: iron, wood: wood };
  }
  G.Props.register('shield_bench', function () {
    var g = PU.group('shield_bench');
    var f = benchFrame(g);
    // scrap metal + shield part mounts on the back board
    PU.box(g, 1.2, 0.6, 0.06, 0, 1.3, -0.34, M('rustedMetal'));
    PU.box(g, 0.4, 0.5, 0.05, -0.3, 1.3, -0.3, M('paintedMetal'));   // a riveted plate
    PU.box(g, 0.35, 0.04, 0.18, 0.4, 0.94, -0.1, M('bareSteel'));    // wrench-ish tool
    // work lamp
    PU.cyl(g, 0.02, 0.02, 0.5, 0.5, 1.2, -0.2, M('darkIron'), 6);
    PU.cone(g, 0.1, 0.12, 0.5, 1.42, -0.1, EM(0xffdca0, 0.6, 0x221a10), 10, false);
    g.userData.interactive = true;
    g.userData.partMounts = [
      (function () { var o = new THREE.Object3D(); o.position.set(0.2, 1.3, -0.3); g.add(o); return o; })(),
      (function () { var o = new THREE.Object3D(); o.position.set(-0.05, 1.3, -0.3); g.add(o); return o; })()
    ];
    PU.colliderSpec(g, 0.68, 0.4, 0, 1.0);
    PU.interactionAnchor(g, [0, 0.9, 0.45], { maxDist: 2.2 });
    return g;
  });
  G.Props.register('wonder_bench', function (opts) {
    var g = PU.group('wonder_bench');
    var f = benchFrame(g);
    // weapon cradle + electrical coils + schematic
    PU.box(g, 0.7, 0.06, 0.2, 0, 0.95, 0.1, M('darkIron'));
    PU.box(g, 0.08, 0.1, 0.2, -0.34, 1.0, 0.1, M('bareSteel'));
    PU.box(g, 0.08, 0.1, 0.2, 0.34, 1.0, 0.1, M('bareSteel'));
    for (var k = 0; k < 4; k++) PU.torus(g, 0.08, 0.02, 0.42, 1.0 + k * 0.03, -0.1, M('copper'), 5, 'x');
    PU.panel(g, 0.5, 0.4, 0, 1.32, -0.34, SCR(opts && opts.tint ? opts.tint : 0x2a8adf, 0.5)); // schematic glow
    PU.sphere(g, 0.03, -0.3, 0.99, 0.18, EM(0x33ccff, 0.8, 0x06141c), 6);
    PU.sphere(g, 0.03, 0.3, 0.99, 0.18, EM(0xff8822, 0.8, 0x1a0e06), 6);
    g.userData.interactive = true;
    PU.colliderSpec(g, 0.68, 0.4, 0, 1.0);
    PU.interactionAnchor(g, [0, 0.9, 0.45], { maxDist: 2.2 });
    return g;
  });

  /* ===================== Wall-buy fixture ============================== */
  G.Props.register('wallbuy_fixture', function (opts) {
    var g = PU.group('wallbuy_fixture');
    var steel = M('bareSteel'), dark = M('darkIron');
    // chalk/painted weapon outline plane (caller supplies the texture)
    if (opts && opts.chalkTex) {
      var chalk = PU.panel(g, 1.5, 1.4, 0, 1.7, 0.02, new THREE.MeshBasicMaterial({
        map: opts.chalkTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      g.userData.chalk = chalk;
    }
    // mounting brackets
    [[-0.6, 1.95], [0.6, 1.95], [-0.6, 1.45], [0.6, 1.45]].forEach(function (p) {
      PU.box(g, 0.1, 0.08, 0.08, p[0], p[1], 0.04, steel);
    });
    // ammo price plate + subtle electrical box
    PU.box(g, 0.5, 0.18, 0.05, 0, 1.05, 0.04, dark);
    PU.box(g, 0.2, 0.3, 0.12, 0.62, 1.0, 0.06, dark);
    PU.tube(g, [[0.62, 1.15, 0.04], [0.5, 1.4, 0.04], [0.3, 1.55, 0.02]], 0.02, M('rubberHose'), 8, 5);
    var glow = PU.sphere(g, 0.03, 0.62, 1.1, 0.1, EM(0xffcc55, 0.5, 0x1a1404), 6);
    g.userData.interactive = true; g.userData.glow = glow;
    PU.interactionAnchor(g, [0, 1.4, 0.5], { maxDist: 2.2 });
    return g;
  });
})();
