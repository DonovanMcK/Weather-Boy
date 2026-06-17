/* ===========================================================================
   TOTENSTURM — assets/materials.js
   Shared, cached material library for the prop system. One instance per named
   material, reused across every prop so we never spawn a fresh material per
   mesh.

   Why MeshLambert/MeshPhong and not MeshStandard: the renderer runs the legacy
   forward lighting path (useLegacyLights) with hemisphere + point lights and NO
   image-based environment map. MeshStandardMaterial's metalness/roughness needs
   an IBL/env map to read correctly and would render near-black here, so the
   project's justified choice is the legacy Lambert/Phong path — matching the
   look of the existing world geometry. Spec-lit metals/glass use Phong.

   Materials are built lazily (G.tex only exists once a map starts building) and
   reset between map loads so canvas textures are disposed cleanly.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var cache = {};

  function T(name) { return G.tex ? G.tex[name] : null; }
  function lambert(color, texName) {
    var o = { color: color };
    var t = texName && T(texName); if (t) o.map = t;
    return new THREE.MeshLambertMaterial(o);
  }
  function phong(color, texName, shin, spec) {
    var o = { color: color, shininess: shin || 30 };
    var t = texName && T(texName); if (t) o.map = t;
    if (spec != null) o.specular = new THREE.Color(spec);
    return new THREE.MeshPhongMaterial(o);
  }

  // logical name -> factory. Inspired by the gritty industrial-horror palette.
  var defs = {
    paintedMetal: function () { return lambert(0x5b626b, 'metal'); },
    bareSteel:    function () { return phong(0x9aa0a8, 'metal', 42, 0x8a92a4); },
    rustedMetal:  function () { return lambert(0x7c5634, 'metal'); },
    rustDark:     function () { return lambert(0x4f3a26, 'metal'); },
    darkIron:     function () { return phong(0x2b2e34, 'metal', 22, 0x3a3d46); },
    oldWood:      function () { return phong(0x7a5836, 'wood', 8); },
    plankWood:    function () { return lambert(0xc7b193, 'wood'); },
    crateWood:    function () { return phong(0x9a7448, 'wood', 8); },
    concrete:     function () { return lambert(0x8a857c, 'wall'); },
    concreteDark: function () { return lambert(0x5e5a53, 'wall'); },
    rubber:       function () { return lambert(0x1c1e21); },
    bakelite:     function () { return phong(0x241d18, null, 28, 0x4a3a2a); },
    glass:        function () { return new THREE.MeshPhongMaterial({ color: 0x1f3138, transparent: true, opacity: 0.45, shininess: 90, specular: new THREE.Color(0xaaccdd) }); },
    brass:        function () { return new THREE.MeshPhongMaterial({ color: 0xb08828, shininess: 80, specular: new THREE.Color(0xffe0a0) }); },
    gold:         function () { return new THREE.MeshPhongMaterial({ color: 0xc9a030, shininess: 80, specular: new THREE.Color(0xfff0b0) }); },
    copper:       function () { return new THREE.MeshPhongMaterial({ color: 0x9c5a32, shininess: 60, specular: new THREE.Color(0xffba88) }); },
    ceramic:      function () { return phong(0xd7d1c2, null, 55, 0xffffff); },
    fabric:       function () { return lambert(0x6b6048); },
    sandbag:      function () { return lambert(0x6e6347); },
    warningPaint: function () { return lambert(0xcea019); },
    rubberHose:   function () { return lambert(0x26282c); }
  };

  G.MAT = {
    // get/cache a named base material
    get: function (name) {
      if (!cache[name]) { var f = defs[name]; cache[name] = f ? f() : lambert(0x888888); }
      return cache[name];
    },
    // cached emissive material — keyed so identical glows share one instance
    emissive: function (color, intensity, base) {
      var key = 'e:' + color + ':' + (intensity == null ? 0.7 : intensity) + ':' + (base == null ? -1 : base);
      if (!cache[key]) {
        cache[key] = new THREE.MeshLambertMaterial({
          color: base == null ? 0x0e1014 : base,
          emissive: new THREE.Color(color),
          emissiveIntensity: intensity == null ? 0.7 : intensity
        });
      }
      return cache[key];
    },
    // a glassy emissive screen (CRT / vending window)
    screen: function (color, intensity) {
      var key = 's:' + color + ':' + (intensity == null ? 0.7 : intensity);
      if (!cache[key]) {
        cache[key] = new THREE.MeshPhongMaterial({
          color: 0x06121a, emissive: new THREE.Color(color),
          emissiveIntensity: intensity == null ? 0.7 : intensity, shininess: 70,
          specular: new THREE.Color(0x335566)
        });
      }
      return cache[key];
    },
    has: function (name) { return !!defs[name]; },
    names: function () { return Object.keys(defs); },
    _cache: function () { return cache; },
    // dispose + clear between map loads (textures change per map)
    reset: function () {
      Object.keys(cache).forEach(function (k) { var m = cache[k]; if (m && m.dispose) m.dispose(); });
      cache = {};
    }
  };
})();
