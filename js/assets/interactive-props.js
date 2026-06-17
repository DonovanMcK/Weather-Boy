/* ===========================================================================
   TOTENSTURM — assets/interactive-props.js
   Buyable barriers and the modular window barricade. Built at local origin; a
   barrier's "blocking plane" lies in the X/Y plane (faces +Z). Window barricade
   exposes userData.planks[] so the repair system can show/hide each plank while
   they all belong to one root assembly.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G, PU = G.PU;
  function M(n) { return G.MAT.get(n); }
  function EM(c, i, b) { return G.MAT.emissive(c, i, b); }
  function rng(opts) { return PU.seeded((opts && opts.seed) || 1); }

  // buyable route blocker. opts.variant: 'bunker' | 'factory' | 'research' | 'rubble' | 'wood'
  G.Props.register('buyable_door', function (opts) {
    var r = rng(opts), variant = (opts && opts.variant) || 'wood';
    var g = PU.group('buyable_door_' + variant);
    var W = (opts && opts.width) || 3.6, H = 3.4;

    if (variant === 'rubble') {
      // a collapsed-debris blockade
      var n = 7 + ((r() * 4) | 0);
      for (var i = 0; i < n; i++) {
        var s = 0.4 + r() * 0.7;
        var b = PU.box(g, s, s * (0.6 + r() * 0.6), s, (r() - 0.5) * (W - 0.6), s * 0.4 + r() * 1.4, (r() - 0.5) * 0.4,
          r() < 0.5 ? M('concrete') : M('concreteDark'));
        b.rotation.set(r() * 0.5, r() * 3, r() * 0.5);
      }
      for (var k = 0; k < 3; k++) PU.cyl(g, 0.02, 0.02, 1 + r(), (r() - 0.5) * W, 0.5 + r(), 0, M('rustedMetal'), 5).rotation.set(1.2, r() * 3, r() * 0.6);
    } else if (variant === 'factory') {
      // riveted industrial sliding door + frame
      PU.box(g, W + 0.2, 0.2, 0.4, 0, H, 0, M('darkIron'));            // header rail
      PU.box(g, W, H - 0.2, 0.18, 0, (H - 0.2) / 2, 0, M('paintedMetal'));
      [-0.25, 0.25].forEach(function (f) { PU.box(g, 0.08, H - 0.4, 0.22, f * W, (H - 0.4) / 2, 0, M('rustedMetal')); });
      for (var rx = 0; rx < 4; rx++) for (var ry = 0; ry < 5; ry++)
        PU.sphere(g, 0.04, -W / 2 + 0.3 + rx * (W - 0.6) / 3, 0.4 + ry * (H - 0.8) / 4, 0.1, M('darkIron'), 5);
      PU.box(g, 0.5, 0.4, 0.2, W / 2 - 0.4, H / 2, 0.12, M('warningPaint')); // hazard handle plate
    } else if (variant === 'research') {
      // security blast door with a small window + lock light
      PU.box(g, W + 0.2, H, 0.3, 0, H / 2, -0.05, M('darkIron'));      // frame
      PU.beveledBox(g, W - 0.2, H - 0.3, 0.16, 0.04, M('paintedMetal'), 0, (H - 0.3) / 2, 0.06);
      PU.box(g, W - 0.2, 0.06, 0.18, 0, H / 2, 0.07, M('darkIron'));   // split seam
      PU.panel(g, 0.5, 0.3, -W / 4, H * 0.62, 0.15, M('glass'));
      PU.sphere(g, 0.05, W / 2 - 0.5, H * 0.6, 0.12, EM(0xff3322, 0.8, 0x180404), 8); // lock light
    } else if (variant === 'bunker') {
      // heavy reinforced bunker door
      PU.box(g, W, H, 0.25, 0, H / 2, 0, M('rustedMetal'));
      [-0.3, 0.3].forEach(function (f) { PU.box(g, 0.12, H - 0.2, 0.3, f * W, H / 2, 0, M('darkIron')); });
      PU.torus(g, 0.18, 0.04, 0.2, H / 2, 0.16, M('darkIron'), 6, null); // wheel lock
      [0.3, 0.5, 0.7].forEach(function (fy) { PU.box(g, W - 0.4, 0.1, 0.28, 0, H * fy, 0, M('darkIron')); }); // bracing bands
    } else {
      // boarded wooden barricade (default)
      PU.box(g, 0.2, H, 0.2, -W / 2 + 0.1, H / 2, 0, M('darkIron'));
      PU.box(g, 0.2, H, 0.2, W / 2 - 0.1, H / 2, 0, M('darkIron'));
      for (var p = 0; p < 6; p++) {
        var plank = PU.box(g, W - 0.1, 0.34, 0.1, 0, 0.5 + p * 0.55, 0, M('plankWood'));
        plank.rotation.z = (r() - 0.5) * 0.06; plank.position.x = (r() - 0.5) * 0.1;
      }
    }
    g.userData.interactive = true; g.userData.variant = variant;
    PU.interactionAnchor(g, [0, 1.4, 0.4], { maxDist: 2.6 });
    return g;
  });

  // modular window barricade: frame + sill + glass shards + boards. Each board
  // is independently show/hide-able via userData.planks[i].visible.
  G.Props.register('window_barricade', function (opts) {
    var r = rng(opts), g = PU.group('window_barricade');
    var W = (opts && opts.width) || 1.6, H = (opts && opts.height) || 1.4;
    var frame = M('darkIron'), wood = M('plankWood');
    // frame + damaged sill
    PU.box(g, W + 0.2, 0.12, 0.24, 0, H, 0, M('concreteDark'));
    PU.box(g, W + 0.3, 0.16, 0.28, 0, 0, 0, M('concreteDark'));     // chipped sill
    [-1, 1].forEach(function (s) { PU.box(g, 0.12, H, 0.2, s * W / 2, H / 2, 0, frame); });
    // broken glass remnants in the upper corners
    [[-0.3, 1], [0.32, 1]].forEach(function (q) {
      var shard = PU.panel(g, 0.3, 0.3, q[0], H * 0.8, 0.06, M('glass'));
      shard.rotation.z = q[1] * 0.4;
    });
    // boards (repair planks) at varied angles + nails
    var planks = [];
    var count = (opts && opts.planks) || 6;
    for (var i = 0; i < count; i++) {
      var pl = PU.group('plank');
      var board = PU.box(pl, W + 0.3, 0.22, 0.06, 0, 0, 0, wood);
      board.material = (r() < 0.3) ? M('oldWood') : wood;
      PU.sphere(pl, 0.025, -W / 2, 0, 0.05, frame, 5);
      PU.sphere(pl, 0.025, W / 2, 0, 0.05, frame, 5);
      pl.position.set((r() - 0.5) * 0.1, 0.2 + i * (H - 0.3) / count, 0);
      pl.rotation.z = (r() - 0.5) * 0.14;
      g.add(pl); planks.push(pl);
    }
    g.userData.planks = planks;
    g.userData.setBoards = function (n) { planks.forEach(function (p, i) { p.visible = i < n; }); };
    return g;
  });
})();
