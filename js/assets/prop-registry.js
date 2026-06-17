/* ===========================================================================
   TOTENSTURM — assets/prop-registry.js
   Central registry of prop builders. The registry owns VISUALS, visual state
   and animation handles only — gameplay logic stays in the existing systems.

       G.Props.register('mystery_box', createMysteryBox);
       var root = G.Props.create('mystery_box', { position, rotationY, variant });

   Every builder returns one root THREE.Group. If a builder throws (or a future
   GLTF load fails) the registry substitutes a plain fallback crate so the game
   stays playable. Includes opt-in debug visualizers + a prop gallery; all are
   disabled during normal play.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var PU = G.PU;

  var builders = {};

  function fallbackCrate(opts) {
    var g = new THREE.Group();
    g.name = (opts && opts.type ? opts.type : 'prop') + '_fallback';
    var m = (G.MAT && G.MAT.get('crateWood')) || new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    var b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), m);
    b.position.y = 0.4; g.add(b);
    g.userData.fallback = true;
    return g;
  }

  G.Props = {
    register: function (type, fn) { builders[type] = fn; return this; },
    has: function (type) { return !!builders[type]; },
    list: function () { return Object.keys(builders).sort(); },

    // build a prop. opts: { position, rotationY, rotation, scale, variant,
    //   state, mapId, seed, addToScene }
    create: function (type, opts) {
      opts = opts || {};
      var root, fn = builders[type];
      try {
        if (!fn) throw new Error('no builder registered for "' + type + '"');
        root = fn(opts);
        if (!root || !root.isObject3D) throw new Error('builder "' + type + '" did not return an Object3D');
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[Props] build failed for "' + type + '": ' + (e && e.message));
        root = fallbackCrate({ type: type });
      }
      root.userData.propType = root.userData.propType || type;
      root.userData.interactive = !!root.userData.interactive;
      if (opts.position) root.position.copy(opts.position);
      if (opts.rotation) root.rotation.copy(opts.rotation);
      if (opts.rotationY != null) root.rotation.y = opts.rotationY;
      if (opts.scale != null) root.scale.setScalar(opts.scale);
      if (opts.addToScene !== false && G.scene) G.scene.add(root);
      return root;
    },

    // dispose a prop's geometry/owned resources and detach it from the scene.
    // (Shared cached materials are owned by G.MAT.reset, not disposed here.)
    dispose: function (root) {
      if (!root) return;
      root.traverse(function (o) {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        // only dispose materials the prop made privately (one-offs), never the
        // shared cache; one-offs are flagged userData.ownMaterial
        var mat = o.material;
        if (mat && mat.userData && mat.userData.ownMaterial && mat.dispose) mat.dispose();
      });
      if (root.parent) root.parent.remove(root);
    },

    /* ---------------- debug / development helpers (off in play) ---------- */
    showBounds: function (root, color) {
      var b = new THREE.Box3().setFromObject(root);
      var helper = new THREE.Box3Helper(b, new THREE.Color(color || 0x44ff88));
      helper.name = '__debug_bounds'; if (G.scene) G.scene.add(helper); return helper;
    },
    showCollider: function (root) {
      var c = root.userData.colliderBox; if (!c) return null;
      var g = new THREE.Mesh(new THREE.BoxGeometry(c.hw * 2, c.y2 - c.y1, c.hd * 2),
        new THREE.MeshBasicMaterial({ color: 0xff3355, wireframe: true }));
      g.position.set(root.position.x + c.cx, (c.y1 + c.y2) / 2, root.position.z + c.cz);
      g.name = '__debug_collider'; if (G.scene) G.scene.add(g); return g;
    },
    showInteractionAnchor: function (root) {
      var a = root.userData.interactionAnchor; if (!a) return null;
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffee44 }));
      a.add(m); m.name = '__debug_anchor'; return m;
    },

    // lay every registered prop out on a labelled grid for visual inspection
    gallery: function (opts) {
      opts = opts || {};
      var types = this.list(), pitch = opts.pitch || 4, cols = opts.cols || 8;
      var holder = new THREE.Group(); holder.name = 'prop_gallery';
      var perks = G.CFG && G.CFG.PERKS;
      types.forEach(function (type, i) {
        var gx = (i % cols) * pitch, gz = -((i / cols) | 0) * pitch;
        var bopts = { position: new THREE.Vector3(gx, 0, gz), addToScene: false, variant: opts.variant };
        if (type === 'perk_machine' && perks) { bopts.variant = 'revive'; bopts.def = perks.revive; }
        var root;
        try { root = G.Props.create(type, bopts); } catch (e) { return; }
        holder.add(root);
        // floating label so each prop is identifiable in the grid
        if (G.util && G.util.textSprite) {
          var label = G.util.textSprite(type, '#cfe', 2.0);
          label.position.set(gx, 2.6, gz); holder.add(label);
        }
      });
      if (opts.addToScene !== false && G.scene) G.scene.add(holder);
      return { holder: holder, types: types };
    }
  };

  // dev console command: `propGallery()` drops every prop on a labelled grid.
  // Disabled during normal play (only meaningful when called manually).
  if (typeof window !== 'undefined') {
    window.propGallery = function (opts) { return G.Props.gallery(opts || {}); };
  }
})();
