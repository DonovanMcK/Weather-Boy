/* ===========================================================================
   TOTENSTURM — assets/environment-props.js
   Reusable environmental prop families (bunker / factory / research). Built at
   local origin, feet on y=0. Deterministic per-instance variation via opts.seed
   so repeated props differ but a map always loads identically. Decorative props
   set a colliderSpec only when they meaningfully occupy player space.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G, PU = G.PU;
  function M(n) { return G.MAT.get(n); }
  function EM(c, i, b) { return G.MAT.emissive(c, i, b); }
  function SCR(c, i) { return G.MAT.screen(c, i); }
  function rng(opts) { return PU.seeded((opts && opts.seed) || 1); }

  /* ---- bunker / shared ---- */
  G.Props.register('oil_drum', function (opts) {
    var r = rng(opts), g = PU.group('oil_drum');
    var body = r() < 0.5 ? M('rustedMetal') : M('paintedMetal');
    PU.lathe(g, [[0, 0], [0.28, 0], [0.29, 0.05], [0.27, 0.1], [0.27, 0.78], [0.29, 0.83], [0.28, 0.88], [0, 0.9]], body, 14);
    [0.16, 0.45, 0.74].forEach(function (yy) { PU.torus(g, 0.285, 0.018, 0, yy, 0, M('darkIron'), 5, 'flat'); });
    PU.cyl(g, 0.27, 0.27, 0.03, 0, 0.905, 0, M('darkIron'), 14);
    if (r() < 0.4) PU.box(g, 0.12, 0.06, 0.12, 0.1, 0.93, 0.05, M('darkIron')); // bung cap
    PU.colliderSpec(g, 0.3, 0.3, 0, 0.95);
    return g;
  });
  G.Props.register('fuel_drum', function (opts) {
    var g = G.Props.create('oil_drum', { addToScene: false, seed: (opts && opts.seed) || 7 });
    PU.panel(g, 0.34, 0.34, 0, 0.5, 0.31, new THREE.MeshBasicMaterial({ color: 0xcea019 })).material.userData = { ownMaterial: true };
    g.name = 'fuel_drum'; return g;
  });
  G.Props.register('ammo_crate', function (opts) {
    var r = rng(opts), g = PU.group('ammo_crate');
    var w = M('oldWood'), iron = M('darkIron');
    PU.beveledBox(g, 0.9, 0.5, 0.56, 0.03, w, 0, 0.27, 0);
    PU.box(g, 0.94, 0.06, 0.6, 0, 0.52, 0, w);              // lid
    [[-0.4, 0], [0.4, 0]].forEach(function (p) { PU.box(g, 0.06, 0.5, 0.6, p[0], 0.27, 0, iron); });
    PU.box(g, 0.2, 0.1, 0.04, 0, 0.3, 0.29, iron);           // latch
    PU.panel(g, 0.4, 0.16, 0, 0.34, 0.285, new THREE.MeshBasicMaterial({ color: 0x6b5a2a })).material.userData = { ownMaterial: true };
    PU.colliderSpec(g, 0.47, 0.3, 0, 0.55);
    return g;
  });
  G.Props.register('wood_crate', function (opts) {
    var r = rng(opts), s = 0.6 + r() * 0.3, g = PU.group('wood_crate');
    var w = M('crateWood');
    PU.beveledBox(g, s, s, s, 0.02, w, 0, s / 2, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      PU.box(g, 0.05, s, 0.05, c[0] * (s / 2 - 0.02), s / 2, c[1] * (s / 2 - 0.02), M('darkIron'));
    });
    PU.colliderSpec(g, s / 2, s / 2, 0, s);
    return g;
  });
  G.Props.register('pallet', function (opts) {
    var g = PU.group('pallet'); var w = M('oldWood');
    for (var i = 0; i < 4; i++) PU.box(g, 1.0, 0.04, 0.1, 0, 0.12, -0.4 + i * 0.27, w);
    [-0.4, 0, 0.4].forEach(function (zx) { PU.box(g, 1.0, 0.06, 0.06, 0, 0.05, zx, w); });
    [-0.45, 0, 0.45].forEach(function (xx) { PU.box(g, 0.08, 0.1, 0.95, xx, 0.05, 0, w); });
    return g;
  });
  G.Props.register('sandbag_stack', function (opts) {
    var r = rng(opts), g = PU.group('sandbag_stack');
    for (var row = 0; row < 3; row++) {
      var n = 4 - (row > 1 ? 1 : 0), off = (row % 2) * 0.21;
      for (var i = 0; i < n; i++) {
        var bag = PU.box(g, 0.5, 0.26, 0.4, -0.72 + i * 0.42 + off, 0.14 + row * 0.25,
          (r() - 0.5) * 0.06, r() < 0.5 ? M('sandbag') : M('fabric'));
        bag.rotation.y = (r() - 0.5) * 0.2; bag.scale.set(1, 1, 1 - r() * 0.12);
      }
    }
    PU.colliderSpec(g, 0.9, 0.28, 0, 0.7);
    return g;
  });
  G.Props.register('locker', function (opts) {
    var r = rng(opts), g = PU.group('locker'), m = M('paintedMetal'), iron = M('darkIron');
    var doors = 2;
    PU.beveledBox(g, 0.7, 1.7, 0.42, 0.02, m, 0, 0.85, 0);
    for (var d = 0; d < doors; d++) {
      var dx = -0.17 + d * 0.34;
      PU.box(g, 0.3, 1.6, 0.02, dx, 0.86, 0.215, r() < 0.3 ? M('rustedMetal') : m); // door (some rusted)
      for (var v = 0; v < 3; v++) PU.box(g, 0.2, 0.02, 0.01, dx, 1.4 - v * 0.08, 0.22, iron); // vents
      PU.box(g, 0.03, 0.12, 0.03, dx + 0.1, 0.9, 0.23, iron);   // handle
    }
    PU.box(g, 0.72, 0.06, 0.44, 0, 1.72, 0, iron);              // top
    PU.colliderSpec(g, 0.36, 0.22, 0, 1.7);
    return g;
  });
  G.Props.register('field_radio', function (opts) {
    var g = PU.group('field_radio'), m = M('paintedMetal');
    PU.beveledBox(g, 0.4, 0.3, 0.28, 0.02, m, 0, 0.15, 0);
    PU.panel(g, 0.16, 0.1, -0.08, 0.18, 0.145, SCR(0x33ff66, 0.5));
    PU.cyl(g, 0.02, 0.02, 0.4, 0.14, 0.45, -0.05, M('darkIron'), 6); // antenna
    PU.sphere(g, 0.03, 0.05, 0.2, 0.145, M('bakelite'), 6);
    PU.sphere(g, 0.03, 0.12, 0.2, 0.145, M('bakelite'), 6);
    return g;
  });
  G.Props.register('generator', function (opts) {
    var r = rng(opts), g = PU.group('generator'), iron = M('darkIron'), rust = M('rustedMetal'), pipe = M('paintedMetal');
    PU.box(g, 1.5, 0.2, 0.8, 0, 0.1, 0, iron);                 // skid base
    PU.beveledBox(g, 1.2, 0.7, 0.66, 0.04, rust, 0, 0.55, 0);  // engine block
    PU.lathe(g, [[0, 0], [0.22, 0], [0.24, 0.5], [0, 0.55]], iron, 12).position.set(0.4, 0.55, 0); // exhaust drum
    PU.cyl(g, 0.06, 0.06, 0.6, 0.4, 1.1, 0, pipe, 8);           // exhaust pipe
    PU.box(g, 0.4, 0.3, 0.04, -0.3, 0.7, 0.34, EM(0xffaa33, r() < 0.5 ? 0.6 : 0.2, 0x1a1206)); // control gauge panel
    for (var i = 0; i < 3; i++) PU.cyl(g, 0.04, 0.04, 0.5, -0.5 + i * 0.12, 0.9, -0.2, pipe, 6); // pipes
    PU.colliderSpec(g, 0.78, 0.42, 0, 1.0);
    return g;
  });
  G.Props.register('pipe_cluster', function (opts) {
    var r = rng(opts), g = PU.group('pipe_cluster');
    var mats = [M('paintedMetal'), M('rustedMetal'), M('copper')];
    [-0.32, -0.11, 0.11, 0.32].forEach(function (ox, i) {
      PU.cyl(g, 0.08, 0.08, 2.4, ox, 1.3, -0.2, mats[i % 3], 8);
      PU.torus(g, 0.1, 0.025, ox, 0.5 + (i % 2) * 0.4, -0.2, M('darkIron'), 5, 'flat'); // flange
    });
    PU.box(g, 1.3, 0.4, 0.4, 0, 0.32, -0.18, M('darkIron'));    // junction box
    PU.cyl(g, 0.13, 0.13, 0.3, 0, 0.55, 0.05, M('rustedMetal'), 8, 'z'); // valve stub
    return g;
  });
  G.Props.register('debris_pile', function (opts) {
    var r = rng(opts), g = PU.group('debris_pile');
    var n = 4 + ((r() * 4) | 0);
    for (var i = 0; i < n; i++) {
      var s = 0.18 + r() * 0.4;
      var b = PU.box(g, s, s * (0.4 + r() * 0.5), s, (r() - 0.5) * 1.2, s * 0.25, (r() - 0.5) * 1.0,
        r() < 0.5 ? M('concrete') : M('rustDark'));
      b.rotation.set(r() * 0.4, r() * 3, r() * 0.4);
    }
    if (r() < 0.6) for (var k = 0; k < 3; k++) PU.cyl(g, 0.02, 0.02, 0.6 + r() * 0.4, (r() - 0.5), 0.1, (r() - 0.5), M('rustedMetal'), 5).rotation.set(1.4, r() * 3, r()); // rebar
    return g;
  });
  G.Props.register('ventilation_unit', function (opts) {
    var g = PU.group('ventilation_unit'), m = M('paintedMetal');
    PU.beveledBox(g, 0.9, 0.9, 0.5, 0.04, m, 0, 0.45, 0);
    PU.torus(g, 0.3, 0.05, 0, 0.45, 0.26, M('darkIron'), 6, 'flat');
    for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; PU.box(g, 0.5, 0.04, 0.06, 0, 0.45, 0.26, M('darkIron')).rotation.z = a; }
    return g;
  });

  /* ---- factory ---- */
  G.Props.register('electrical_cabinet', function (opts) {
    var r = rng(opts), g = PU.group('electrical_cabinet'), m = M('paintedMetal'), iron = M('darkIron');
    PU.beveledBox(g, 0.9, 1.8, 0.5, 0.03, m, 0, 0.9, 0);
    PU.box(g, 0.42, 1.7, 0.02, 0, 0.9, 0.255, r() < 0.4 ? M('rustedMetal') : m); // door
    PU.box(g, 0.03, 0.2, 0.03, 0.2, 0.9, 0.27, iron);          // handle
    for (var i = 0; i < 4; i++) PU.sphere(g, 0.025, -0.25 + i * 0.12, 1.5, 0.27, EM([0x33ff66, 0xffaa22, 0xff3322, 0x33ccff][i], r() < 0.5 ? 0.7 : 0.2, 0x070707), 6);
    PU.panel(g, 0.3, 0.2, -0.15, 0.8, 0.27, new THREE.MeshBasicMaterial({ color: 0xcea019 })).material.userData = { ownMaterial: true };
    PU.colliderSpec(g, 0.46, 0.27, 0, 1.8);
    return g;
  });
  G.Props.register('pressure_tank', function (opts) {
    var r = rng(opts), g = PU.group('pressure_tank'), rust = M('rustedMetal'), iron = M('darkIron');
    PU.lathe(g, [[0, 0], [0.45, 0.0], [0.5, 0.15], [0.5, 1.4], [0.45, 1.6], [0, 1.7]], rust, 16);
    PU.torus(g, 0.5, 0.04, 0, 0.4, 0, iron, 6, 'flat');
    PU.torus(g, 0.5, 0.04, 0, 1.2, 0, iron, 6, 'flat');
    PU.cyl(g, 0.06, 0.06, 0.5, 0.0, 1.9, 0, M('copper'), 8);    // top pipe
    PU.cyl(g, 0.1, 0.1, 0.04, 0.35, 1.0, 0.4, iron, 12, 'z');   // gauge
    PU.box(g, 0.01, 0.07, 0.005, 0.35, 1.03, 0.42, EM(0xffaa22, 0.7, 0x1a1206));
    PU.colliderSpec(g, 0.52, 0.52, 0, 1.7);
    return g;
  });
  G.Props.register('valve_wheel', function (opts) {
    var g = PU.group('valve_wheel'), rust = M('rustedMetal'), iron = M('darkIron');
    PU.torus(g, 0.22, 0.035, 0, 0, 0, rust, 6, null);
    for (var i = 0; i < 3; i++) PU.box(g, 0.42, 0.03, 0.03, 0, 0, 0, rust).rotation.z = i * Math.PI / 3;
    PU.cyl(g, 0.05, 0.05, 0.16, 0, 0, 0, iron, 8, 'z');
    return g;
  });
  G.Props.register('tool_cart', function (opts) {
    var r = rng(opts), g = PU.group('tool_cart'), m = M('paintedMetal'), iron = M('darkIron');
    PU.box(g, 0.7, 0.04, 0.45, 0, 0.8, 0, m);                  // top
    PU.box(g, 0.66, 0.5, 0.42, 0, 0.52, 0, m);                 // drawers
    [0.4, 0.55, 0.7].forEach(function (yy) { PU.box(g, 0.6, 0.02, 0.02, 0, yy, 0.21, iron); }); // drawer handles
    [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]].forEach(function (p) {
      PU.cyl(g, 0.06, 0.06, 0.08, p[0], 0.08, p[1], M('rubber'), 8, 'x');
    });
    if (r() < 0.6) PU.box(g, 0.3, 0.04, 0.04, 0.1, 0.84, 0, iron); // a wrench on top
    PU.colliderSpec(g, 0.36, 0.24, 0, 0.82);
    return g;
  });
  G.Props.register('hoist', function (opts) {
    var g = PU.group('hoist'), iron = M('darkIron');
    PU.box(g, 0.3, 0.3, 0.3, 0, 2.4, 0, iron);
    PU.tube(g, [[0, 2.3, 0], [0.02, 1.6, 0.05], [0, 1.0, 0]], 0.015, M('bareSteel'), 8, 5); // chain-ish cable
    PU.box(g, 0.2, 0.25, 0.12, 0, 0.9, 0, iron);               // hook block
    PU.torus(g, 0.08, 0.02, 0, 0.78, 0, iron, 5, null);        // hook
    return g;
  });

  /* ---- research ---- */
  G.Props.register('server_rack', function (opts) {
    var r = rng(opts), g = PU.group('server_rack'), iron = M('darkIron');
    PU.beveledBox(g, 0.62, 1.8, 0.66, 0.02, iron, 0, 0.9, 0);
    for (var u = 0; u < 7; u++) {
      var blade = PU.box(g, 0.5, 0.18, 0.04, 0, 0.4 + u * 0.21, 0.33, M('paintedMetal'));
      if (r() < 0.7) PU.sphere(g, 0.015, 0.2, 0.4 + u * 0.21, 0.36, EM(r() < 0.5 ? 0x33ff66 : 0x33ccff, 0.8, 0x070707), 5);
    }
    PU.colliderSpec(g, 0.32, 0.34, 0, 1.8);
    return g;
  });
  G.Props.register('crt_bank', function (opts) {
    var r = rng(opts), g = PU.group('crt_bank'), iron = M('darkIron');
    PU.beveledBox(g, 1.0, 1.2, 0.6, 0.03, iron, 0, 0.6, 0);
    for (var i = 0; i < 4; i++) {
      var sx = -0.24 + (i % 2) * 0.48, sy = 0.45 + ((i / 2) | 0) * 0.45;
      PU.box(g, 0.4, 0.34, 0.08, sx, sy, 0.3, iron);
      PU.panel(g, 0.32, 0.26, sx, sy, 0.345, SCR([0x33ccff, 0x33ff88, 0x2aa0ff, 0x44ddaa][i], 0.6 + r() * 0.2));
    }
    PU.colliderSpec(g, 0.52, 0.32, 0, 1.2);
    return g;
  });
  G.Props.register('radar_console', function (opts) {
    var g = PU.group('radar_console'), iron = M('darkIron');
    PU.beveledBox(g, 0.9, 1.0, 0.6, 0.03, iron, 0, 0.5, 0);
    var dish = PU.cyl(g, 0.34, 0.28, 0.06, 0, 0.85, 0, M('paintedMetal'), 20); dish.rotation.x = 0.5;
    var scope = PU.panel(g, 0.4, 0.4, 0, 0.6, 0.31, SCR(0x33ff88, 0.7));
    PU.box(g, 0.7, 0.08, 0.2, 0, 0.5, 0.2, M('bakelite')); // control deck
    g.userData.dish = dish; g.userData.scope = scope;
    PU.colliderSpec(g, 0.46, 0.32, 0, 1.0);
    return g;
  });
  G.Props.register('gas_cylinder', function (opts) {
    var r = rng(opts), g = PU.group('gas_cylinder');
    var col = [0x3a7a4a, 0x7a3a3a, 0x3a4a7a][((r() * 3) | 0)];
    PU.lathe(g, [[0, 0], [0.16, 0], [0.16, 1.1], [0.13, 1.25], [0.06, 1.32], [0, 1.34]], (function () { var m = new THREE.MeshLambertMaterial({ color: col }); m.userData.ownMaterial = true; return m; })(), 12);
    PU.cyl(g, 0.04, 0.04, 0.08, 0, 1.38, 0, M('brass'), 8);    // valve
    PU.colliderSpec(g, 0.18, 0.18, 0, 1.35);
    return g;
  });
  G.Props.register('lab_cabinet', function (opts) {
    var r = rng(opts), g = PU.group('lab_cabinet'), m = M('paintedMetal');
    PU.beveledBox(g, 0.9, 1.5, 0.45, 0.02, m, 0, 0.75, 0);
    for (var d = 0; d < 3; d++) { PU.box(g, 0.8, 0.42, 0.02, 0, 0.35 + d * 0.46, 0.23, m); PU.box(g, 0.2, 0.03, 0.02, 0, 0.35 + d * 0.46, 0.24, M('darkIron')); }
    PU.colliderSpec(g, 0.46, 0.24, 0, 1.5);
    return g;
  });

  /* ---- lighting fixtures (mesh + optional emissive; lights added by caller) -- */
  G.Props.register('ceiling_lamp', function (opts) {
    var variant = (opts && opts.variant) || 'caged';
    var g = PU.group('ceiling_lamp_' + variant), iron = M('darkIron');
    PU.cyl(g, 0.03, 0.03, 0.5, 0, 0.25, 0, iron, 6);            // cord/stem
    if (variant === 'dome') {
      PU.lathe(g, [[0, 0], [0.22, -0.02], [0.2, -0.16], [0.0, -0.2]], M('paintedMetal'), 14).position.y = 0;
      PU.sphere(g, 0.08, 0, -0.12, 0, EM(0xffe6b0, 0.7, 0x221a10), 8);
    } else if (variant === 'red') {
      PU.lathe(g, [[0, 0], [0.16, -0.02], [0.14, -0.14], [0.0, -0.16]], iron, 12).position.y = 0;
      PU.sphere(g, 0.08, 0, -0.1, 0, EM(0xff2a14, 0.9, 0x200404), 8);
    } else if (variant === 'fluoro') {
      PU.box(g, 0.9, 0.08, 0.18, 0, 0, 0, iron);
      PU.box(g, 0.84, 0.04, 0.12, 0, -0.04, 0, EM(0xcfe6ff, 0.7, 0x101418));
    } else { // caged bunker lamp
      [-0.13, -0.02].forEach(function (yy) { PU.torus(g, 0.13, 0.012, 0, yy, 0, iron, 6, 'flat'); });
      for (var i = 0; i < 4; i++) { var a = i / 4 * Math.PI * 2; PU.box(g, 0.014, 0.16, 0.014, Math.cos(a) * 0.12, -0.075, Math.sin(a) * 0.12, iron); }
      PU.sphere(g, 0.07, 0, -0.08, 0, EM(0xffd9a0, 0.7, 0x221c10), 8);
    }
    return g;
  });

  /* =========================================================================
     ADDITIVE SET-DRESSING — large landmark & defensive props for the three map
     themes (bombed bunker/warzone, industrial factory, arctic station). Built
     at local origin, feet on y=0, front facing +Z; seeded variation; colliders
     only where they meaningfully occupy player space.
     ========================================================================= */

  /* ---- warzone: burnt-out vehicle frame (~3.6m long) ---- */
  G.Props.register('wrecked_car', function (opts) {
    var r = rng(opts), g = PU.group('wrecked_car');
    var burnt = M('rustDark'), iron = M('darkIron'), rust = M('rustedMetal'), glass = M('glass');
    // chassis / floor pan
    PU.box(g, 1.7, 0.18, 3.4, 0, 0.42, 0, iron);
    // lower body tub (scorched)
    PU.beveledBox(g, 1.78, 0.55, 3.5, 0.05, burnt, 0, 0.72, 0);
    // hood + engine bay (front = +Z)
    PU.box(g, 1.7, 0.14, 1.0, 0, 1.02, 1.18, burnt);
    PU.box(g, 1.4, 0.3, 0.6, 0, 0.95, 1.55, r() < 0.5 ? rust : iron); // exposed engine block
    // cabin frame: A/B/C pillars (windows missing/broken)
    [[-0.82, 0.3], [0.82, 0.3], [-0.82, -0.6], [0.82, -0.6]].forEach(function (p) {
      PU.box(g, 0.1, 0.62, 0.1, p[0], 1.3, p[1], iron);
    });
    PU.box(g, 1.78, 0.1, 1.7, 0, 1.62, -0.15, burnt);   // roof (sagging rear cab)
    // a few shards of broken window glass clinging to the frame
    if (r() < 0.7) PU.box(g, 0.08, 0.3, 0.5, -0.86, 1.32, -0.15, glass);
    if (r() < 0.5) PU.box(g, 0.5, 0.28, 0.06, 0.2, 1.34, 0.65, glass); // cracked windscreen sliver
    // rear cargo bed lip (jeep-ish)
    PU.box(g, 1.7, 0.4, 0.12, 0, 0.85, -1.72, rust);
    // wheels missing: bare hubs + one slumped flat tyre
    [[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]].forEach(function (h, i) {
      PU.cyl(g, 0.16, 0.16, 0.12, h[0], 0.32, h[1], iron, 8, 'x'); // hub stub
      if (i === ((r() * 4) | 0)) { var t = PU.cyl(g, 0.32, 0.32, 0.18, h[0] - 0.18, 0.18, h[1], M('rubber'), 12, 'x'); t.scale.set(1, 0.7, 1); } // one flat tyre on the ground
    });
    // burnt detail: bullet-pocked door panels
    PU.box(g, 0.06, 0.5, 0.9, 0.9, 0.75, 0.1, burnt);
    PU.box(g, 0.06, 0.5, 0.9, -0.9, 0.75, 0.1, burnt);
    PU.colliderSpec(g, 0.95, 1.8, 0, 1.7);
    return g;
  });

  /* ---- shipping/supply container (~4m long landmark) ---- */
  G.Props.register('cargo_container', function (opts) {
    var r = rng(opts), g = PU.group('cargo_container');
    var skins = ['paintedMetal', 'rustedMetal', 'rustDark'];
    var skin = M(skins[(r() * skins.length) | 0]), iron = M('darkIron');
    var L = 4.0, W = 1.9, H = 2.2;
    // main body
    PU.beveledBox(g, W, H, L, 0.04, skin, 0, H / 2, 0);
    // corrugated side ribs (riveted panels)
    for (var rib = -8; rib <= 8; rib++) {
      var rz = rib * (L / 18);
      PU.box(g, W + 0.04, H - 0.2, 0.04, 0, H / 2, rz, skin);
    }
    // corner castings (top + bottom, all 4 corners)
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      [0.12, H - 0.12].forEach(function (cy) {
        PU.box(g, 0.22, 0.2, 0.22, c[0] * (W / 2 - 0.06), cy, c[1] * (L / 2 - 0.06), iron);
      });
    });
    // door end (front = +Z): twin doors with locking rods + handles
    var dz = L / 2 + 0.01;
    [-0.46, 0.46].forEach(function (dx) {
      PU.box(g, 0.9, H - 0.18, 0.05, dx, H / 2, dz, r() < 0.4 ? M('rustedMetal') : skin);
      [-0.28, 0.28].forEach(function (rod) {
        PU.cyl(g, 0.025, 0.025, H - 0.3, dx + rod, H / 2, dz + 0.04, iron, 6); // vertical locking rod
        PU.box(g, 0.1, 0.14, 0.05, dx + rod, H / 2 - 0.1, dz + 0.07, iron);     // handle
      });
    });
    // stencilled placard
    PU.panel(g, 0.7, 0.4, 0.0, H * 0.62, dz + 0.03, new THREE.MeshBasicMaterial({ color: 0xcea019 })).material.userData = { ownMaterial: true };
    PU.colliderSpec(g, W / 2 + 0.03, L / 2 + 0.05, 0, H);
    return g;
  });

  /* ---- stacked wooden/ammo crates (2-4, seeded, ~1.2m tall) ---- */
  G.Props.register('crate_stack', function (opts) {
    var r = rng(opts), g = PU.group('crate_stack');
    var woods = ['crateWood', 'oldWood', 'plankWood'], iron = M('darkIron');
    var n = 2 + ((r() * 3) | 0);     // 2..4 crates
    var y = 0;
    for (var i = 0; i < n; i++) {
      var s = 0.5 + r() * 0.32;      // crate edge length
      var w = M(woods[(r() * woods.length) | 0]);
      var ox = (r() - 0.5) * 0.18, oz = (r() - 0.5) * 0.18; // slight stagger
      PU.beveledBox(g, s, s, s, 0.02, w, ox, y + s / 2, oz);
      // corner battens
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        PU.box(g, 0.045, s, 0.045, ox + c[0] * (s / 2 - 0.02), y + s / 2, oz + c[1] * (s / 2 - 0.02), iron);
      });
      if (r() < 0.4) PU.panel(g, s * 0.5, s * 0.22, ox, y + s * 0.55, oz + s / 2 + 0.001, new THREE.MeshBasicMaterial({ color: 0x6b5a2a })).material.userData = { ownMaterial: true };
      y += s - 0.01;
    }
    PU.colliderSpec(g, 0.45, 0.45, 0, Math.min(y, 1.4));
    return g;
  });

  /* ---- oil/fuel drum cluster on a pallet (3-4, seeded) ---- */
  G.Props.register('barrel_cluster', function (opts) {
    var r = rng(opts), g = PU.group('barrel_cluster');
    var w = M('oldWood');
    // small pallet base
    for (var i = 0; i < 3; i++) PU.box(g, 1.2, 0.04, 0.1, 0, 0.12, -0.45 + i * 0.45, w);
    [-0.5, 0, 0.5].forEach(function (zx) { PU.box(g, 1.2, 0.06, 0.06, 0, 0.05, zx, w); });
    [-0.55, 0, 0.55].forEach(function (xx) { PU.box(g, 0.08, 0.1, 1.1, xx, 0.05, 0, w); });
    function drum(parent) {
      var body = r() < 0.5 ? M('rustedMetal') : M('paintedMetal');
      var d = PU.group('drum');
      PU.lathe(d, [[0, 0], [0.28, 0], [0.29, 0.05], [0.27, 0.1], [0.27, 0.78], [0.29, 0.83], [0.28, 0.88], [0, 0.9]], body, 12);
      [0.16, 0.45, 0.74].forEach(function (yy) { PU.torus(d, 0.285, 0.018, 0, yy, 0, M('darkIron'), 5, 'flat'); });
      PU.cyl(d, 0.27, 0.27, 0.03, 0, 0.905, 0, M('darkIron'), 12);
      parent.add(d); return d;
    }
    // 2-3 upright drums on the pallet
    var spots = [[-0.32, -0.28], [0.32, -0.28], [0, 0.3]];
    var upright = 2 + ((r() * 2) | 0); // 2..3
    for (var s = 0; s < upright; s++) { var u = drum(g); u.position.set(spots[s][0], 0.16, spots[s][1]); }
    // one drum tipped on its side beside the pallet
    if (r() < 0.85) {
      var side = drum(g);
      side.rotation.z = Math.PI / 2;
      side.position.set(-0.95, 0.3, 0.5 + (r() - 0.5) * 0.3);
    }
    PU.colliderSpec(g, 0.66, 0.66, 0, 1.06);
    return g;
  });

  /* ---- jersey / anti-tank concrete barrier (~1.1m tall) ---- */
  G.Props.register('concrete_barrier', function (opts) {
    var r = rng(opts), g = PU.group('concrete_barrier');
    var c = r() < 0.5 ? M('concrete') : M('concreteDark');
    var L = 2.4;
    // tapered jersey profile via stacked widening tiers
    PU.box(g, 0.6, 0.22, L, 0, 0.11, 0, c);    // wide foot
    PU.box(g, 0.32, 0.36, L, 0, 0.4, 0, c);    // sloped lower body (approx with narrower mid)
    PU.box(g, 0.46, 0.18, L, 0, 0.31, 0, c);   // haunch
    PU.box(g, 0.2, 0.5, L, 0, 0.8, 0, c);      // upright cap
    // chamfered top
    PU.box(g, 0.16, 0.08, L, 0, 1.06, 0, c);
    // end-link lifting eyes + a painted hazard stripe
    [-L / 2 + 0.06, L / 2 - 0.06].forEach(function (ez) { PU.torus(g, 0.05, 0.015, 0, 1.12, ez, M('darkIron'), 5, null); });
    PU.panel(g, 0.16, 0.5, 0.101, 0.55, (r() - 0.5) * L * 0.6, new THREE.MeshBasicMaterial({ color: 0xcea019 }), Math.PI / 2).material.userData = { ownMaterial: true };
    PU.colliderSpec(g, 0.3, L / 2, 0, 1.1);
    return g;
  });

  /* ---- defensive sandbag wall (3-4 segments, ~3m long, ~0.9m tall) ---- */
  G.Props.register('sandbag_wall', function (opts) {
    var r = rng(opts), g = PU.group('sandbag_wall');
    var rows = 4, perRow = 7;
    var bw = 0.46, by = 0.22;
    for (var row = 0; row < rows; row++) {
      var off = (row % 2) * (bw / 2);
      var taper = row >= 2 ? 1 : 0;   // upper rows slightly shorter -> bermed top
      for (var i = taper; i < perRow - taper; i++) {
        var bx = -((perRow - 1) * bw) / 2 + i * bw + off;
        var bag = PU.box(g, bw, by, 0.42, bx, by / 2 + row * (by * 0.86),
          (r() - 0.5) * 0.07, r() < 0.5 ? M('sandbag') : M('fabric'));
        bag.rotation.y = (r() - 0.5) * 0.18;
        bag.scale.set(1, 1, 1 - r() * 0.12);
      }
    }
    // a couple of support stakes
    [-1.0, 1.0].forEach(function (sx) { PU.cyl(g, 0.03, 0.03, 1.0, sx, 0.5, 0.22, M('oldWood'), 6); });
    PU.colliderSpec(g, ((perRow - 1) * bw) / 2 + bw / 2, 0.26, 0, 0.9);
    return g;
  });

  /* ---- chain-link / barbed fence section on posts (~2m tall, thin) ---- */
  G.Props.register('razor_fence', function (opts) {
    var r = rng(opts), g = PU.group('razor_fence'), iron = M('darkIron'), steel = M('bareSteel');
    var L = 2.6, H = 2.0;
    // posts
    [-L / 2, 0, L / 2].forEach(function (px) {
      PU.cyl(g, 0.05, 0.05, H, px, H / 2, 0, iron, 8);
      PU.box(g, 0.1, 0.1, 0.1, px, H + 0.02, 0, iron); // post cap
    });
    // top + bottom rails
    [0.12, H - 0.1].forEach(function (ry) { PU.cyl(g, 0.03, 0.03, L, 0, ry, 0, iron, 6, 'z'); });
    // chain-link mesh as a faint translucent panel (cheap stand-in for wire)
    var mesh = new THREE.MeshLambertMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    mesh.userData.ownMaterial = true;
    PU.panel(g, L, H - 0.25, 0, H / 2, 0, mesh);
    // a few diagonal wire strands for read
    for (var i = 0; i < 4; i++) {
      var wx = -L / 2 + (i + 0.5) * (L / 4);
      PU.cyl(g, 0.006, 0.006, H * 1.3, wx, H / 2, 0.005, steel, 4).rotation.z = (i % 2 ? 1 : -1) * 0.5;
    }
    // razor coil along the top
    for (var c = 0; c < 6; c++) {
      var cz = -L / 2 + (c + 0.5) * (L / 6);
      PU.torus(g, 0.08, 0.012, cz, H + 0.06, 0, steel, 5, 'x').rotation.z = r() * 3;
    }
    PU.colliderSpec(g, L / 2, 0.08, 0, H);
    return g;
  });

  /* ---- arctic: low mounded snow drift (decorative, no collider) ---- */
  G.Props.register('snow_drift', function (opts) {
    var r = rng(opts), g = PU.group('snow_drift');
    var snow = new THREE.MeshLambertMaterial({ color: 0xeef3f7 });
    snow.userData.ownMaterial = true;
    // a soft low berm built from a few overlapping flattened spheres
    var n = 3 + ((r() * 3) | 0);
    for (var i = 0; i < n; i++) {
      var rad = 0.5 + r() * 0.6;
      var s = PU.sphere(g, rad, (r() - 0.5) * 2.4, 0, (r() - 0.5) * 0.9, snow, 10);
      s.scale.set(1, 0.32 + r() * 0.18, 1);          // flattened mound
      s.position.y = -rad * 0.5;                       // sink so only the cap shows
    }
    // a wind-sculpted ridge along the top
    var ridge = PU.sphere(g, 1.4, 0, 0, 0, snow, 12);
    ridge.scale.set(1.3, 0.22, 0.55); ridge.position.y = -0.15;
    // no collider — meant to be walked over / decorative
    return g;
  });

  /* ---- wrapped supply/cargo pallet with boxes + strapping (~1m) ---- */
  G.Props.register('supply_pallet', function (opts) {
    var r = rng(opts), g = PU.group('supply_pallet'), w = M('oldWood'), iron = M('darkIron');
    // pallet
    for (var i = 0; i < 4; i++) PU.box(g, 1.1, 0.04, 0.1, 0, 0.12, -0.45 + i * 0.3, w);
    [-0.45, 0, 0.45].forEach(function (zx) { PU.box(g, 1.1, 0.06, 0.06, 0, 0.05, zx, w); });
    [-0.5, 0, 0.5].forEach(function (xx) { PU.box(g, 0.08, 0.1, 1.0, xx, 0.05, 0, w); });
    // a wrapped block of boxes on top (shrink-wrap = faint translucent skin)
    var boxMat = [M('crateWood'), M('plankWood'), M('oldWood')];
    var by = 0.16;
    for (var bz = -1; bz <= 1; bz++) for (var bx = -1; bx <= 1; bx += 2) {
      var bh = 0.4 + r() * 0.3;
      PU.box(g, 0.42, bh, 0.42, bx * 0.24, by + bh / 2, bz * 0.3, boxMat[(r() * 3) | 0]);
    }
    // translucent shrink-wrap shell
    var wrap = new THREE.MeshPhongMaterial({ color: 0xbfd6e0, transparent: true, opacity: 0.18, shininess: 60, side: THREE.DoubleSide });
    wrap.userData.ownMaterial = true;
    PU.box(g, 1.0, 0.78, 1.0, 0, 0.16 + 0.4, 0, wrap);
    // strapping bands
    [-0.32, 0.32].forEach(function (sx) {
      PU.box(g, 0.04, 0.82, 1.04, sx, 0.55, 0, iron);
    });
    PU.box(g, 1.04, 0.04, 0.82, 0, 0.85, 0, iron);
    PU.colliderSpec(g, 0.55, 0.55, 0, 0.95);
    return g;
  });

  /* ---- wall pipes with valves/brackets (flush on a wall; thin collider) ---- */
  G.Props.register('wall_pipes', function (opts) {
    var r = rng(opts), g = PU.group('wall_pipes');
    var mats = [M('paintedMetal'), M('rustedMetal'), M('copper')];
    var L = 3.0;
    // a run of horizontal pipes hugging a wall (wall is behind, -Z); pipes sit
    // just in front so the prop reads when set flush against a surface.
    [0.6, 1.2, 1.8].forEach(function (py, i) {
      var rad = 0.05 + (i % 2) * 0.02;
      PU.cyl(g, rad, rad, L, 0, py, 0.12, mats[i % 3], 8, 'z');
      // elbow up at one end
      PU.torus(g, rad + 0.02, rad, (i % 2 ? -1 : 1) * (L / 2 - 0.1), py, 0.12, M('darkIron'), 5, null);
      // mounting brackets clamping each pipe to the wall
      [-L / 2 + 0.3, 0, L / 2 - 0.3].forEach(function (bz) {
        PU.box(g, 0.05, rad * 2.4, 0.14, bz, py, 0.06, M('darkIron'));
      });
    });
    // a couple of inline valves (wheel + body)
    [[-0.6, 1.2], [0.7, 0.6]].forEach(function (v) {
      PU.cyl(g, 0.09, 0.09, 0.16, v[0], v[1], 0.12, M('rustedMetal'), 8, 'z');
      PU.torus(g, 0.13, 0.022, v[0], v[1], 0.26, M('darkIron'), 6, null);
    });
    // gauge
    if (r() < 0.7) { PU.cyl(g, 0.07, 0.07, 0.04, 0.0, 1.8, 0.24, M('darkIron'), 10, 'z'); PU.box(g, 0.008, 0.05, 0.005, 0.0, 1.81, 0.27, EM(0xffaa22, 0.6, 0x1a1206)); }
    // very thin collider (meant to sit flush; only the pipe depth occupies space)
    PU.colliderSpec(g, L / 2, 0.16, 0, 2.0);
    return g;
  });

  /* ---- chunky generic factory machine (~1.4m) ---- */
  G.Props.register('machinery_unit', function (opts) {
    var r = rng(opts), g = PU.group('machinery_unit');
    var m = M('paintedMetal'), iron = M('darkIron'), rust = M('rustedMetal');
    // skid base + main housing
    PU.box(g, 1.5, 0.14, 1.0, 0, 0.07, 0, iron);
    PU.beveledBox(g, 1.3, 1.1, 0.86, 0.05, r() < 0.4 ? rust : m, 0, 0.69, 0);
    // bolted access hatch on the front (+Z)
    PU.box(g, 0.6, 0.6, 0.04, 0, 0.7, 0.44, iron);
    for (var b = 0; b < 4; b++) { var ba = b / 4 * Math.PI * 2; PU.cyl(g, 0.02, 0.02, 0.02, Math.cos(ba) * 0.24, 0.7 + Math.sin(ba) * 0.24, 0.46, M('bareSteel'), 6, 'z'); }
    // round gauge with needle (lit)
    PU.cyl(g, 0.12, 0.12, 0.04, 0.42, 0.95, 0.45, iron, 12, 'z');
    PU.panel(g, 0.18, 0.18, 0.42, 0.95, 0.47, EM(0xffaa33, r() < 0.5 ? 0.6 : 0.25, 0x1a1206));
    PU.box(g, 0.008, 0.08, 0.005, 0.42, 0.97, 0.48, M('darkIron'));
    // top vent grille
    PU.box(g, 0.7, 0.06, 0.5, 0, 1.27, 0, iron);
    for (var v = 0; v < 5; v++) PU.box(g, 0.6, 0.02, 0.03, 0, 1.31, -0.18 + v * 0.09, M('darkIron'));
    // exhaust pipes off the back
    PU.cyl(g, 0.05, 0.05, 0.7, -0.4, 1.5, -0.3, M('copper'), 8);
    PU.cyl(g, 0.05, 0.05, 0.5, 0.4, 1.4, -0.3, M('copper'), 8);
    // side conduit
    PU.cyl(g, 0.04, 0.04, 0.8, -0.6, 0.6, 0.3, M('rubberHose'), 6, 'x');
    PU.colliderSpec(g, 0.66, 0.45, 0, 1.34);
    return g;
  });

  /* ---- tall tripod/pole work floodlight (~2.4m, emissive lens, no light) ---- */
  G.Props.register('floodlight', function (opts) {
    var r = rng(opts), g = PU.group('floodlight'), iron = M('darkIron'), m = M('paintedMetal');
    var H = 2.2;   // pole height (lamp head sits a touch above -> ~2.4m total)
    // central pole
    PU.cyl(g, 0.05, 0.06, H, 0, H / 2, 0, iron, 10);
    // tripod legs
    for (var i = 0; i < 3; i++) {
      var a = i / 3 * Math.PI * 2;
      var lx = Math.cos(a) * 0.55, lz = Math.sin(a) * 0.55;
      var leg = PU.cyl(g, 0.03, 0.03, 1.05, lx / 2, 0.45, lz / 2, iron, 6);
      leg.rotation.x = -Math.atan2(lz, 0.9); leg.rotation.z = Math.atan2(lx, 0.9);
      PU.box(g, 0.1, 0.04, 0.1, lx, 0.02, lz, iron); // foot pad
    }
    // collar / clamp where the head mounts
    PU.cyl(g, 0.07, 0.07, 0.12, 0, H, 0, iron, 8);
    // lamp head (yoke + housing + emissive lens) tilted slightly down
    var head = PU.group('floodhead');
    PU.box(head, 0.08, 0.3, 0.08, -0.24, 0, 0, iron); // yoke arm
    PU.box(head, 0.08, 0.3, 0.08, 0.24, 0, 0, iron);
    PU.beveledBox(head, 0.56, 0.4, 0.2, 0.03, m, 0, 0, 0); // housing
    // emissive lens face (no real THREE.Light — caller adds light if wanted)
    PU.panel(head, 0.46, 0.3, 0, 0, 0.11, EM(0xfff2cc, r() < 0.5 ? 0.9 : 0.5, 0x2a2618));
    // hood / glare shield over the lens
    PU.box(head, 0.5, 0.06, 0.18, 0, 0.21, 0.06, iron);
    head.position.set(0, H + 0.1, 0.06);
    head.rotation.x = 0.25;        // tilt down toward +Z
    g.add(head);
    g.userData.lens = head;        // contract: caller may attach a light to the head
    PU.colliderSpec(g, 0.3, 0.3, 0, 0.5);   // only the tripod footprint stops the player
    return g;
  });
})();
