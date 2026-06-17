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
})();
