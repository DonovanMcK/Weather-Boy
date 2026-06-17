/* ===========================================================================
   TOTENSTURM — assets/prop-utils.js
   Construction helpers shared by every prop builder: a logical group root,
   shadow-aware mesh primitives, a real beveled box, lathe / tube / torus
   helpers for rounded silhouettes, deterministic per-instance variation, and
   the interaction-anchor + collider-spec contract the gameplay layer reads.

   Convention: every prop is built at LOCAL origin with its feet on y=0 and its
   "front" facing +Z. The caller positions / yaws the root.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  function shadow(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

  function group(name) { var g = new THREE.Group(); if (name) g.name = name; return g; }

  // axis-aligned box
  function box(parent, w, h, d, x, y, z, m) {
    var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); shadow(b); if (parent) parent.add(b); return b;
  }
  // cylinder; axis 'y' (default), 'x' or 'z'
  function cyl(parent, r1, r2, h, x, y, z, m, seg, axis) {
    var c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 12), m);
    c.position.set(x, y, z);
    if (axis === 'x') c.rotation.z = Math.PI / 2; else if (axis === 'z') c.rotation.x = Math.PI / 2;
    shadow(c); if (parent) parent.add(c); return c;
  }
  function sphere(parent, r, x, y, z, m, seg) {
    var s = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 10, seg || 10), m);
    s.position.set(x, y, z); shadow(s); if (parent) parent.add(s); return s;
  }
  function torus(parent, r, tube, x, y, z, m, seg, axis) {
    var t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, seg || 6, (seg ? seg * 2 : 16)), m);
    t.position.set(x, y, z);
    if (axis === 'x') t.rotation.y = Math.PI / 2; else if (axis === 'flat') t.rotation.x = Math.PI / 2;
    shadow(t); if (parent) parent.add(t); return t;
  }
  function cone(parent, r, h, x, y, z, m, seg, open) {
    var c = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 10, 1, !!open), m);
    c.position.set(x, y, z); shadow(c); if (parent) parent.add(c); return c;
  }
  // thin flat panel (decal / label / screen face)
  function panel(parent, w, h, x, y, z, m, ry) {
    var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z); if (ry != null) p.rotation.y = ry;
    if (parent) parent.add(p); return p;
  }

  function roundedRectShape(w, h, r) {
    r = Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3));
    var x = -w / 2, y = -h / 2, s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // a genuine chamfered/beveled box — rounded silhouette without stacked cubes
  function beveledBox(parent, w, h, d, bevel, m, x, y, z) {
    bevel = Math.max(0.005, Math.min(bevel == null ? 0.05 : bevel, Math.min(w, h, d) / 2 - 0.01));
    var shape = roundedRectShape(w, h, Math.min(bevel * 2.2, Math.min(w, h) / 2 - 0.01));
    var depth = Math.max(0.01, d - bevel * 2);
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 2, steps: 1, curveSegments: 3
    });
    geo.translate(0, 0, -(d / 2 - bevel));
    var mesh = new THREE.Mesh(geo, m);
    if (x != null) mesh.position.set(x, y || 0, z || 0);
    shadow(mesh); if (parent) parent.add(mesh); return mesh;
  }

  // lathe a profile (array of [r,y]) into a revolved solid — drums, gauges, feet
  function lathe(parent, profile, m, seg) {
    var pts = profile.map(function (p) { return new THREE.Vector2(Math.max(1e-4, p[0]), p[1]); });
    var mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, seg || 16), m);
    shadow(mesh); if (parent) parent.add(mesh); return mesh;
  }

  // a smooth tube through points (array of [x,y,z]) — pipes, cables, conduits
  function tube(parent, points, radius, m, tubular, seg) {
    var v = points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
    var curve = new THREE.CatmullRomCurve3(v);
    var mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular || 14, radius, seg || 6, false), m);
    shadow(mesh); if (parent) parent.add(mesh); return mesh;
  }

  // deterministic per-instance variation (so repeated props differ but a given
  // map always loads identically). mulberry32.
  function seeded(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---- gameplay contract: anchors + collider specs live on the root ---- */
  // a dedicated interaction anchor object at a local offset from the root.
  // gameplay reads root.userData.interactionAnchor (never a child mesh).
  function interactionAnchor(root, local, opts) {
    opts = opts || {};
    var a = new THREE.Object3D();
    a.position.set(local[0] || 0, local[1] || 0, local[2] || 0);
    a.userData.maxDist = opts.maxDist != null ? opts.maxDist : 2.2;
    a.userData.heightTol = opts.heightTol != null ? opts.heightTol : 2.0;
    a.userData.faceRequired = !!opts.faceRequired;
    root.add(a);
    root.userData.interactionAnchor = a;
    return a;
  }
  // record a simplified collider as LOCAL half-extents; the map integration
  // converts it to a world AABB (keeps nav/collision logic out of the prop).
  function colliderSpec(root, hw, hd, y1, y2, cx, cz) {
    var spec = { hw: hw, hd: hd, y1: y1 == null ? 0 : y1, y2: y2 == null ? 2 : y2, cx: cx || 0, cz: cz || 0 };
    root.userData.colliderBox = spec;
    return spec;
  }
  // meshes that should stop bullets (added to map.solidMeshes by integration)
  function markSolid(root, mesh) {
    if (!root.userData.solids) root.userData.solids = [];
    root.userData.solids.push(mesh);
    return mesh;
  }
  function emissiveChildren(root) {
    var out = [];
    root.traverse(function (o) { if (o.material && o.material.emissive && o.material.emissiveIntensity > 0.05) out.push(o); });
    return out;
  }

  G.PropUtils = G.PU = {
    shadow: shadow, group: group, box: box, cyl: cyl, sphere: sphere, torus: torus,
    cone: cone, panel: panel, beveledBox: beveledBox, lathe: lathe, tube: tube,
    roundedRectShape: roundedRectShape, seeded: seeded, hashStr: hashStr,
    interactionAnchor: interactionAnchor, colliderSpec: colliderSpec,
    markSolid: markSolid, emissiveChildren: emissiveChildren
  };
})();
