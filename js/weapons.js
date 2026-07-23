/* ===========================================================================
   DER WETTERJUNGE & FRIENDS — weapons.js
   Data-driven gun factory (56 weapons), hitscan + projectiles, reload,
   Pack-a-Punch camo, knife, grenades, monkey bombs, wonder weapons,
   blood particles, ADS / simple-aim (trackpad) modes.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var CFG = null;

  var W = G.weapons = {
    slots: [], cur: 0, maxSlots: 2,
    reloading: 0, switching: 0, knifing: 0, fireCd: 0,
    mouseDown: false, semiLatch: false, adsHeld: false,
    burstQueue: 0, burstCd: 0,
    projectiles: [], tracers: [], flashes: [], vortices: [], particles: [],
    weaponFx: [], eeHazards: [], rods: [], iceSlides: [], imprints: [],
    shotSeq: 0,
    vmRoot: null, muzzle: null, camoTex: null
  };

  /* ----------------------------------------------------------- materials */
  var matCache = {};
  var camoMat = null;

  function makeCamoTexture() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = '#1a0533'; c.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 60; i++) {
      var hue = [275, 290, 190, 160][i % 4];
      c.fillStyle = 'hsl(' + hue + ',90%,' + (35 + Math.random() * 30) + '%)';
      c.beginPath();
      c.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 9, 0, 7);
      c.fill();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function gm(key, opts) {
    if (matCache[key]) return matCache[key];
    var m = new THREE.MeshPhongMaterial(opts);
    matCache[key] = m;
    return m;
  }
  var camoMat2 = null;
  function papMat(dpap) {
    if (dpap) {
      if (!camoMat2) {
        // double-pack: hot gold body with an electric-cyan glow (Dead Wire)
        camoMat2 = new THREE.MeshPhongMaterial({
          map: W.camoTex, color: 0xc8a83a, emissive: new THREE.Color(0x18546a),
          emissiveIntensity: 0.8, shininess: 90, specular: new THREE.Color(0x9fe8ff)
        });
      }
      return camoMat2;
    }
    if (!camoMat) {
      camoMat = new THREE.MeshPhongMaterial({
        map: W.camoTex, emissive: new THREE.Color(0x331155),
        emissiveIntensity: 0.55, shininess: 30, specular: new THREE.Color(0x555588)
      });
    }
    return camoMat;
  }
  function gunMats(papped, dpap) {
    if (papped) {
      var m = papMat(dpap);
      return { dark: m, mid: m, poly: m, wood: m };
    }
    return {
      dark: gm('dark', { color: 0x2b2e33, map: G.tex.metal, shininess: 40, specular: new THREE.Color(0x666e77) }),
      mid: gm('mid', { color: 0x4a4f57, map: G.tex.metal, shininess: 35, specular: new THREE.Color(0x778088) }),
      poly: gm('poly', { color: 0x232529, shininess: 14, specular: new THREE.Color(0x444a50) }),
      wood: gm('woodg', { color: 0xb89066, map: G.tex.wood, shininess: 10, specular: new THREE.Color(0x553) })
    };
  }
  function accentMat(col, papped, dpap) {
    if (papped) return papMat(dpap);
    return gm('acc' + col, { color: col, map: G.tex.metal, shininess: 25, specular: new THREE.Color(0x667) });
  }
  function sharedGunMaterial(m) {
    if (!m) return false;
    if (m === camoMat || m === camoMat2) return true;
    var keys = Object.keys(matCache);
    for (var i = 0; i < keys.length; i++) if (matCache[keys[i]] === m) return true;
    return false;
  }
  function disposeGunModel(root) {
    if (!root) return;
    root.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (m) { if (!sharedGunMaterial(m) && m.dispose) m.dispose(); });
    });
  }

  /* --------------------------------------------------------- gun factory */
  var CLS_VM = {
    pistol: { len: 1.0, stock: 'none', mag: 'grip' },
    smg: { len: 0.9, stock: 'solid', mag: 'straight' },
    rifle: { len: 1.25, stock: 'solid', mag: 'straight' },
    shotgun: { len: 1.2, stock: 'solid', mag: 'tube' },
    lmg: { len: 1.35, stock: 'solid', mag: 'box' },
    sniper: { len: 1.6, stock: 'solid', mag: 'straight', scope: 1 },
    launcher: { len: 1.0 },
    minigun: { len: 1.0 }
  };

  // every weapon gets a deterministic "DNA" from its id so no two models look
  // the same: proportions, mag/stock/sight style, a coloured accent, a muzzle
  // device and rail accessories all vary per gun (hand-tuned vm overrides win).
  function gunHash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var ACCENTS = [0xb04030, 0x4a6ea0, 0x4f8a4a, 0xb0902c, 0x6a4f8a, 0x2f7d80, 0xa05a2c, 0x808890, 0x9a3c5a, 0x3a8aa0];
  function glowMat2(col) { return gm('glo' + col, { color: 0x0a0a0a, emissive: new THREE.Color(col), emissiveIntensity: 0.9 }); }

  function buildModel(id, papped, dpap) {
    var def = CFG.WEAPONS[id];
    var cls = def.cls;
    var base = CLS_VM[cls] || {}, ov = def.vm || {}, vm = {};
    Object.keys(base).forEach(function (k) { vm[k] = base[k]; });
    Object.keys(ov).forEach(function (k) { vm[k] = ov[k]; });

    var seed = gunHash(id) >>> 0;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    function pick(a) { return a[(rnd() * a.length) | 0]; }
    function has(k) { return ov[k] !== undefined; }
    if (!has('len')) vm.len = (base.len || 1) * (0.86 + rnd() * 0.36);
    if (!has('mag') && (cls === 'smg' || cls === 'rifle' || cls === 'lmg')) vm.mag = pick(['straight', 'curved', 'straight', 'box']);
    if (!has('stock')) vm.stock = pick(['solid', 'solid', 'skeleton']);
    if (!has('scope') && (cls === 'rifle' || cls === 'lmg')) vm.scope = rnd() < 0.16 ? 1 : 0;
    vm.accent = has('col') ? vm.col : ACCENTS[(rnd() * ACCENTS.length) | 0];
    vm.muzzle = (has('supp') && ov.supp) ? 'supp' : pick(['none', 'comp', 'brake', 'none', 'none']);
    vm.dot = (!vm.scope && rnd() < 0.45) ? pick(['red', 'holo', 'red']) : 'none';
    vm.fgrip = (cls === 'rifle' || cls === 'smg' || cls === 'lmg') && rnd() < 0.45;
    vm.ribs = rnd() < 0.5;
    vm.barFac = 0.85 + rnd() * 0.4;
    vm.slideFac = 0.85 + rnd() * 0.35;

    var g = new THREE.Group();
    var M = gunMats(papped, dpap);
    var accent = accentMat(vm.accent, papped, dpap);
    var body = vm.col ? accentMat(vm.col, papped, dpap) : M.dark;
    var furniture = vm.wood ? M.wood : M.poly;

    function box(w, h, d, x, y, z, m, rx, rz) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || M.dark);
      b.position.set(x, y, z);
      if (rx) b.rotation.x = rx;
      if (rz) b.rotation.z = rz;
      g.add(b); return b;
    }
    function cylZ(r1, r2, len, x, y, z, m, seg) {
      var c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg || 10), m || M.mid);
      c.rotation.x = Math.PI / 2;
      c.position.set(x, y, z);
      g.add(c); return c;
    }
    function cylX(r, len, x, y, z, m, seg) {
      var c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 10), m || M.mid);
      c.rotation.z = Math.PI / 2;
      c.position.set(x, y, z);
      g.add(c); return c;
    }

    var tipZ = -0.5;

    // Wonder weapons get a tiny amount of viewmodel-only life: rotating
    // mechanical parts and a breathing emissive core. These are just material
    // tweaks and transforms on the held model — no new scene lights, particles,
    // or per-shot allocations.
    function wonderRotor(mesh, axis, speed, phase) {
      var a = g.userData.wonderMotion || (g.userData.wonderMotion = { rotors: [], glows: [] });
      a.rotors.push({ mesh: mesh, axis: axis || 'z', speed: speed || 1, phase: phase || 0,
        base: mesh.rotation[axis || 'z'] || 0 });
      return mesh;
    }
    function wonderGlow(material, base, amp, speed, phase) {
      var a = g.userData.wonderMotion || (g.userData.wonderMotion = { rotors: [], glows: [] });
      a.glows.push({ material: material, base: base || 0.7, amp: amp || 0.2, speed: speed || 2, phase: phase || 0 });
      return material;
    }
    function wonderBob(mesh, axis, amp, speed, phase) {
      var a = g.userData.wonderMotion || (g.userData.wonderMotion = { rotors: [], glows: [] });
      a.bobs = a.bobs || [];
      a.bobs.push({ mesh: mesh, axis: axis || 'y', amp: amp || 0.01, speed: speed || 2,
        phase: phase || 0, base: mesh.position[axis || 'y'] || 0 });
      return mesh;
    }
    function energyMat(col, intensity) {
      var c = new THREE.Color(col);
      return new THREE.MeshPhongMaterial({
        color: c.clone().multiplyScalar(0.18), emissive: c,
        emissiveIntensity: intensity == null ? 0.92 : intensity,
        shininess: 95, specular: c.clone().lerp(new THREE.Color(0xffffff), 0.55)
      });
    }

    if (cls === 'pistol') {
      var sl = 0.2 * vm.len * vm.slideFac;
      box(0.052, 0.07, sl + 0.06, 0, 0.02, -sl / 2, body);                 // slide
      box(0.054, 0.014, sl - 0.02, 0, 0.058, -sl / 2, accent);            // slide accent rib
      box(0.002, 0.026, 0.07, 0.027, 0.03, -sl * 0.62, M.dark);           // ejection port (dark inset, right side)
      for (var ser = 0; ser < 4; ser++)                                   // rear slide serrations
        box(0.056, 0.05, 0.006, 0, 0.026, -0.012 - ser * 0.016, M.mid);
      box(0.048, 0.05, 0.16, 0, -0.035, -0.03, M.mid);                    // frame
      box(0.014, 0.034, 0.02, 0, 0.05, 0.045, M.dark).rotation.x = 0.5;   // hammer, cocked back
      box(0.042, 0.13, 0.062, 0, -0.115, 0.035, vm.wood ? M.wood : furniture, 0.22); // grip core
      box(0.05, 0.1, 0.05, 0, -0.105, 0.038, vm.wood ? M.wood : furniture, 0.2);     // grip side panels
      box(0.046, 0.016, 0.066, 0, -0.183, 0.035, M.dark);                 // mag baseplate
      box(0.04, 0.02, 0.05, 0, -0.045, -0.045, M.dark);                   // trigger guard
      box(0.008, 0.026, 0.012, 0, -0.038, -0.03, M.mid).rotation.x = 0.25;// trigger blade
      box(0.012, 0.028, 0.012, 0, 0.066, -sl - 0.02, M.dark);             // front sight
      box(0.036, 0.022, 0.014, 0, 0.064, 0.03, M.dark);                   // rear sight
      if (vm.mag === 'cyl') {
        cylZ(0.034, 0.034, 0.085, 0, -0.005, -0.06, M.mid, 8);            // revolver drum
        cylZ(0.018, 0.018, sl + 0.12, 0, 0.02, -sl / 2 - 0.06, body);
        tipZ = -(sl + 0.13);
      } else {
        cylZ(0.013, 0.013, 0.05, 0, 0.018, -sl - 0.04, M.mid);            // muzzle
        tipZ = -(sl + 0.07);
        if (vm.muzzle === 'supp') cylZ(0.03, 0.03, 0.12, 0, 0.018, tipZ + 0.04, M.poly, 12);
        if (vm.mag === 'box') box(0.044, 0.12, 0.06, 0, -0.16, 0.0, M.mid, 0.05); // extended mag
      }
      if (vm.dot === 'red') box(0.014, 0.014, 0.014, 0, 0.085, 0.02, glowMat2(0xff2a14));
    } else if (id === 'nachtlicht') {
      // Nachtlicht: a compact civil-defence signal projector. A faceted
      // receiver, proper firing furniture and a caged flare replace the old
      // red cuboid while keeping the whole silhouette short and light.
      var flareRed = accentMat(0x51231d, papped, dpap);
      var flareSteel = accentMat(0x343d46, papped, dpap);
      var flareTrim = accentMat(0x8b5540, papped, dpap);
      var flareGlow = energyMat(0xff6b37, 0.7);
      wonderGlow(flareGlow, 0.65, 0.13, 3.8, 0.4);

      // Tapered eight-sided receiver with a steel keel and service panels.
      cylZ(0.073, 0.094, 0.28, 0, 0.005, -0.015, flareRed, 8);
      cylZ(0.096, 0.078, 0.07, 0, 0.005, 0.16, flareSteel, 8);
      box(0.105, 0.04, 0.3, 0, -0.055, -0.005, flareSteel);
      [-0.071, 0.071].forEach(function (side) {
        box(0.012, 0.064, 0.17, side, 0.008, -0.025, flareTrim);
      });
      box(0.052, 0.016, 0.22, 0, 0.091, -0.018, M.dark);               // sight rail
      box(0.015, 0.035, 0.015, 0, 0.111, -0.115, flareSteel);
      box(0.046, 0.025, 0.014, 0, 0.104, 0.065, flareSteel);

      // Canted rescue-pistol grip, enclosed guard and separate trigger blade.
      box(0.064, 0.17, 0.076, 0, -0.15, 0.105, M.poly, 0.3);
      box(0.074, 0.022, 0.074, 0, -0.232, 0.135, flareRed, 0.3);
      var flareGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.043, 0.007, 5, 11, Math.PI * 1.55), flareTrim);
      flareGuard.rotation.y = Math.PI / 2;
      flareGuard.rotation.x = -0.27;
      flareGuard.position.set(0, -0.072, 0.024);
      g.add(flareGuard);
      box(0.011, 0.041, 0.011, 0, -0.07, 0.035, M.mid, 0.28);

      // The exposed flare is held by two collars and four vent rails. Its glow
      // is deliberately confined to the small signal cartridge.
      cylZ(0.052, 0.067, 0.12, 0, 0.012, -0.215, flareSteel, 10);
      var flareCell = cylZ(0.027, 0.034, 0.22, 0, 0.012, -0.37, flareGlow, 8);
      wonderBob(flareCell, 'y', 0.005, 4.2, 0.3);
      [-0.285, -0.465].forEach(function (ringZ) {
        var flareRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.062, 0.007, 5, 12), flareTrim);
        flareRing.position.set(0, 0.012, ringZ);
        g.add(flareRing);
      });
      for (var fv = 0; fv < 4; fv++) {
        var va = fv / 4 * Math.PI * 2;
        var vent = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.2), flareSteel);
        vent.position.set(Math.cos(va) * 0.057, 0.012 + Math.sin(va) * 0.057, -0.375);
        vent.rotation.z = va;
        g.add(vent);
      }
      cylZ(0.072, 0.057, 0.065, 0, 0.012, -0.505, flareRed, 10);
      cylZ(0.049, 0.062, 0.04, 0, 0.012, -0.555, flareSteel, 10);

      // Three dark spare cartridges sit in a visible side rack; only their
      // capped tips carry the Nachtlicht's restrained orange signature.
      box(0.018, 0.118, 0.18, -0.092, -0.002, 0.0, M.dark);
      for (var fc = 0; fc < 3; fc++) {
        cylZ(0.014, 0.014, 0.12, -0.106, 0.036 - fc * 0.04, -0.012, flareRed, 7);
        cylZ(0.015, 0.012, 0.022, -0.106, 0.036 - fc * 0.04, -0.083, flareGlow, 7);
      }
      tipZ = -0.59;
    } else if (id === 'minenwerfer115') {
      // Minenwerfer 115: a squat industrial mine projector. The receiver and
      // chamber are faceted machinery, while the exposed five-cell feed drum
      // and forked mortar rails explain how its soul mine is physically loaded.
      var mineBody = accentMat(0x3d4a35, papped, dpap);
      var mineSteel = accentMat(0x30383a, papped, dpap);
      var mineBrass = accentMat(0x8b7648, papped, dpap);
      var soulGreen = energyMat(0x86e76a, 0.62);
      wonderGlow(soulGreen, 0.58, 0.12, 2.6, 1.1);

      // Broad octagonal breech, reinforced lower spine and service ribs.
      cylZ(0.09, 0.115, 0.28, 0, 0, 0.015, mineBody, 8);
      cylZ(0.116, 0.094, 0.075, 0, 0, 0.19, mineSteel, 8);
      box(0.145, 0.042, 0.3, 0, -0.062, 0.015, mineSteel);
      [-0.084, 0.084].forEach(function (side) {
        box(0.016, 0.08, 0.18, side, 0, 0.015, mineBrass);
      });
      for (var mr = 0; mr < 3; mr++)
        box(0.14, 0.013, 0.022, 0, 0.091, 0.09 - mr * 0.07, mineSteel);

      // Canted grip and complete firing group keep it recognisably hand-held.
      box(0.07, 0.18, 0.08, 0, -0.155, 0.12, M.poly, 0.27);
      box(0.082, 0.024, 0.082, 0, -0.242, 0.147, mineBody, 0.27);
      var mineGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.047, 0.008, 5, 12, Math.PI * 1.55), mineBrass);
      mineGuard.rotation.y = Math.PI / 2;
      mineGuard.rotation.x = -0.25;
      mineGuard.position.set(0, -0.078, 0.026);
      g.add(mineGuard);
      box(0.012, 0.043, 0.012, 0, -0.075, 0.038, M.mid, 0.26);

      // Five individually housed soul cells rotate on the exposed left face.
      // Keeping the drum off-axis preserves the firing lane and gives the gun
      // an unmistakable silhouette without the old oversized wheel.
      var drum = new THREE.Group();
      drum.position.set(-0.098, 0.018, -0.075);
      var drumCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.079, 0.079, 0.052, 10), mineSteel);
      drumCore.rotation.z = Math.PI / 2;
      drum.add(drumCore);
      var drumBand = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.007, 5, 12), mineBrass);
      drumBand.rotation.y = Math.PI / 2;
      drumBand.position.x = -0.03;
      drum.add(drumBand);
      for (var mw = 0; mw < 5; mw++) {
        var ma = mw / 5 * Math.PI * 2;
        var cellPod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.018, 0.038, 6), soulGreen);
        cellPod.rotation.z = Math.PI / 2;
        cellPod.position.set(-0.036, Math.sin(ma) * 0.057, Math.cos(ma) * 0.057);
        drum.add(cellPod);
      }
      g.add(drum);
      wonderRotor(drum, 'x', 0.7, 0.2);

      // Paired mortar rails cradle a loaded mine-shaped emitter. Brass collars,
      // a faceted mine body and a dark penetrator keep the green light small.
      [-0.058, 0.058].forEach(function (mx) {
        cylZ(0.016, 0.021, 0.37, mx, 0.008, -0.35, mineSteel, 7);
        for (var mc = 0; mc < 2; mc++) {
          var railBand = new THREE.Mesh(
            new THREE.TorusGeometry(0.025, 0.005, 5, 9), mineBrass);
          railBand.position.set(mx, 0.008, -0.235 - mc * 0.17);
          g.add(railBand);
        }
      });
      box(0.142, 0.03, 0.045, 0, 0.008, -0.515, mineBrass);
      cylZ(0.064, 0.064, 0.07, 0, 0.008, -0.57, mineBody, 8);
      var mineMuzzleBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.067, 0.006, 5, 12), mineBrass);
      mineMuzzleBand.position.set(0, 0.008, -0.605);
      g.add(mineMuzzleBand);
      for (var mf = 0; mf < 4; mf++) {
        var finA = mf / 4 * Math.PI * 2;
        var mineFin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.048, 0.055), mineSteel);
        mineFin.position.set(Math.cos(finA) * 0.062, 0.008 + Math.sin(finA) * 0.062, -0.57);
        mineFin.rotation.z = finA;
        g.add(mineFin);
      }
      var mineNose = new THREE.Mesh(new THREE.ConeGeometry(0.041, 0.08, 8), M.dark);
      mineNose.rotation.x = -Math.PI / 2;
      mineNose.position.set(0, 0.008, -0.65);
      g.add(mineNose);
      cylZ(0.014, 0.019, 0.035, 0, 0.008, -0.695, soulGreen, 7);
      tipZ = -0.72;
    } else if (cls === 'launcher') {
      var tl = 0.6 * vm.len;
      cylZ(0.052, 0.056, tl, 0, 0.02, -tl / 2 + 0.1, body, 12);           // tube
      cylZ(0.062, 0.062, 0.05, 0, 0.02, -tl + 0.12, M.mid, 12);           // muzzle bell
      cylZ(0.06, 0.06, 0.045, 0, 0.02, 0.1, M.mid, 12);                   // breech
      box(0.04, 0.11, 0.06, 0, -0.075, 0.02, furniture, 0.25);            // grip
      box(0.04, 0.09, 0.05, 0, -0.065, -0.16, furniture, 0.1);            // front grip
      box(0.012, 0.06, 0.012, 0, 0.1, -0.1, M.dark);                      // sight frame
      if (vm.pump) box(0.05, 0.045, 0.12, 0, -0.04, -0.22, furniture);
      tipZ = -(tl - 0.08);
    } else if (cls === 'minigun') {
      var bl = 0.5;
      cylZ(0.075, 0.085, 0.26, 0, 0, 0.02, body, 12);                     // motor body
      for (var mb = 0; mb < 6; mb++) {
        var ang = mb / 6 * Math.PI * 2;
        cylZ(0.011, 0.011, bl, Math.cos(ang) * 0.032, Math.sin(ang) * 0.032, -bl / 2 - 0.1, M.mid, 6);
      }
      cylZ(0.045, 0.045, 0.06, 0, 0, -bl - 0.12, M.dark, 12);             // barrel clamp
      box(0.09, 0.13, 0.12, 0, -0.12, 0.06, M.dark);                      // ammo box
      box(0.045, 0.1, 0.06, 0, -0.1, 0.14, furniture, 0.25);              // grip
      tipZ = -(bl + 0.16);
    } else if (cls === 'raygun' && id === 'raygun2') {
      // Ray Gun Mark II: a long, faceted burst-rifle chassis with three
      // independently caged emitters. It shares the original's atomic-power
      // language without inheriting its compact pistol proportions.
      var rg2Steel = accentMat(0x242a32, papped, dpap);
      var rg2Black = accentMat(0x10151a, papped, dpap);
      var rg2Purple = accentMat(0x562e69, papped, dpap);
      var rg2Brass = accentMat(0x806349, papped, dpap);
      var rg2mat = energyMat(0x42e6c1, 0.86);
      wonderGlow(rg2mat, 0.82, 0.15, 4.6, 0.7);

      // Six-sided receiver and inset side armour replace the old neon box.
      cylZ(0.074, 0.105, 0.39, 0, 0, -0.055, rg2Steel, 6);
      cylZ(0.098, 0.088, 0.07, 0, 0, 0.17, rg2Black, 8);
      [-0.082, 0.082].forEach(function (px) {
        for (var pp2 = 0; pp2 < 3; pp2++) {
          box(0.018, 0.067 - pp2 * 0.008, 0.068, px, 0.012 - pp2 * 0.009,
            0.038 - pp2 * 0.086, rg2Purple, pp2 * 0.07);
        }
        box(0.014, 0.032, 0.15, px, -0.055, -0.075, rg2Brass);
      });
      box(0.075, 0.022, 0.31, 0, 0.092, -0.04, rg2Black);              // sight rail
      for (var rs = 0; rs < 3; rs++)
        box(0.09, 0.021, 0.012, 0, 0.113, 0.055 - rs * 0.09, rg2Steel); // rail notches

      // Angled pistol grip, visible trigger loop, and compact forward handstop.
      box(0.072, 0.19, 0.082, 0, -0.15, 0.095, M.poly, 0.25);
      box(0.078, 0.02, 0.075, 0, -0.24, 0.12, rg2Purple);
      var rg2Guard = new THREE.Mesh(
        new THREE.TorusGeometry(0.047, 0.008, 5, 12, Math.PI * 1.55), rg2Brass);
      rg2Guard.rotation.y = Math.PI / 2;
      rg2Guard.rotation.x = -0.25;
      rg2Guard.position.set(0, -0.075, 0.015);
      g.add(rg2Guard);
      box(0.012, 0.042, 0.012, 0, -0.074, 0.025, M.mid, 0.26);
      box(0.09, 0.09, 0.055, 0, -0.085, -0.235, rg2Black, -0.22);       // handstop

      // A small rear power jewel visually relates the rifle to the Ray Gun.
      var rg2Cell = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), rg2mat);
      rg2Cell.scale.set(0.82, 0.82, 1.25);
      rg2Cell.position.set(0, 0.092, 0.13);
      g.add(rg2Cell);
      wonderBob(rg2Cell, 'y', 0.005, 3.0, 0.4);
      var rg2CellCage = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.006, 5, 12), rg2Purple);
      rg2CellCage.position.set(0, 0.092, 0.13);
      g.add(rg2CellCage);

      // Three physically separated coil barrels form the burst emitter.
      var rg2Ports = [
        { x: -0.056, y: -0.004 },
        { x: 0.056, y: -0.004 },
        { x: 0, y: 0.073 }
      ];
      rg2Ports.forEach(function (port) {
        cylZ(0.024, 0.032, 0.25, port.x, port.y, -0.37, rg2Black, 8);
        for (var rc2 = 0; rc2 < 3; rc2++) {
          var coil2 = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.005, 5, 10), rg2mat);
          coil2.position.set(port.x, port.y, -0.29 - rc2 * 0.075);
          g.add(coil2);
        }
        cylZ(0.012, 0.019, 0.07, port.x, port.y, -0.475, rg2mat, 7);
      });
      var rg2Cage = new THREE.Group();
      rg2Cage.position.set(0, 0.023, -0.405);
      [-0.075, 0.075].forEach(function (cz) {
        var cageRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.007, 5, 16), rg2Purple);
        cageRing2.position.z = cz; rg2Cage.add(cageRing2);
      });
      for (var cs2 = 0; cs2 < 3; cs2++) {
        var cageSpoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.01, 0.012), rg2Steel);
        cageSpoke2.rotation.z = cs2 * Math.PI / 3; rg2Cage.add(cageSpoke2);
      }
      g.add(rg2Cage); wonderRotor(rg2Cage, 'z', 1.1, 0.1);
      tipZ = -0.52;
    } else if (cls === 'raygun') {
      // Original Ray Gun: a compact retro-futurist atomic pistol. The faceted
      // tapered receiver, glass rear cell and finned cylindrical muzzle keep
      // the famous silhouette readable without making the whole gun neon.
      var raySteel = accentMat(0x30383a, papped, dpap);
      var rayRed = accentMat(0x762a28, papped, dpap);
      var rayBrass = accentMat(0x8c7045, papped, dpap);
      var rayGlow = energyMat(0x5ce873, 0.84);
      wonderGlow(rayGlow, 0.8, 0.14, 3.8, 0.2);

      cylZ(0.066, 0.098, 0.3, 0, 0.005, -0.035, rayRed, 10);            // tapered receiver
      cylZ(0.098, 0.085, 0.06, 0, 0.005, 0.14, raySteel, 10);           // rear cap
      [-0.071, 0.071].forEach(function (rx) {
        box(0.012, 0.07, 0.22, rx, 0.005, -0.045, rayBrass);             // deco receiver rails
      });

      // Proper pistol furniture rather than a cuboid hanging beneath the body.
      box(0.064, 0.18, 0.074, 0, -0.145, 0.075, M.poly, 0.28);
      box(0.071, 0.02, 0.068, 0, -0.23, 0.105, rayRed);
      var rayGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.043, 0.008, 5, 12, Math.PI * 1.55), rayBrass);
      rayGuard.rotation.y = Math.PI / 2;
      rayGuard.rotation.x = -0.28;
      rayGuard.position.set(0, -0.072, 0.002);
      g.add(rayGuard);
      box(0.011, 0.038, 0.011, 0, -0.07, 0.012, M.mid, 0.28);

      // Restrained rear atomic cell: transparent shell, small green core.
      var rayCellGlass = new THREE.MeshPhongMaterial({
        color: 0xb7d7bd, transparent: true, opacity: 0.3, shininess: 105,
        specular: new THREE.Color(0xffffff), depthWrite: false
      });
      var rayCellMat = new THREE.MeshPhongMaterial({
        color: 0x0b3013, emissive: new THREE.Color(0x43bd58), emissiveIntensity: 0.48,
        transparent: true, opacity: 0.82, shininess: 90,
        specular: new THREE.Color(0xa8e8b2)
      });
      wonderGlow(rayCellMat, 0.46, 0.1, 2.6, 0.3);
      var rayCellShell = cylZ(0.046, 0.046, 0.14, 0, 0.087, 0.065, rayCellGlass, 12);
      var rayCell = cylZ(0.028, 0.033, 0.105, 0, 0.087, 0.065, rayCellMat, 10);
      wonderBob(rayCell, 'y', 0.004, 2.6, 0.3);
      [-0.015, 0.145].forEach(function (rz) {
        cylZ(0.056, 0.056, 0.025, 0, 0.087, rz, rayBrass, 10);
      });
      void rayCellShell;

      // Dark cylindrical barrel with brass compression rings.
      cylZ(0.038, 0.056, 0.28, 0, 0.008, -0.31, raySteel, 12);
      for (var rb = 0; rb < 3; rb++) {
        var rayBand = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.007, 5, 12), rayBrass);
        rayBand.position.set(0, 0.008, -0.225 - rb * 0.08);
        g.add(rayBand);
      }
      cylZ(0.062, 0.048, 0.065, 0, 0.008, -0.455, rayRed, 10);
      cylZ(0.018, 0.026, 0.055, 0, 0.008, -0.482, rayGlow, 8);

      // Four mechanical muzzle fins rotate around the small emitter core.
      var rayRotor = new THREE.Group();
      rayRotor.position.set(0, 0.008, -0.455);
      for (var rr = 0; rr < 4; rr++) {
        var ra = rr / 4 * Math.PI * 2;
        var fin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.065), raySteel);
        fin.position.set(Math.cos(ra) * 0.065, Math.sin(ra) * 0.065, 0);
        fin.rotation.z = ra; rayRotor.add(fin);
      }
      g.add(rayRotor); wonderRotor(rayRotor, 'z', 1.35, 0.5);
      tipZ = -0.5;
    } else if (cls === 'thunder') {
      // Thundergun: a sculpted pneumatic cannon with an armoured pressure
      // receiver, paired reservoirs and a turbine diaphragm. Blue is reserved
      // for pressure gauges and the compressed-air core rather than the shell.
      var thunderSteel = accentMat(0x394147, papped, dpap);
      var thunderDark = accentMat(0x20262a, papped, dpap);
      var thunderTrim = accentMat(0x6f6658, papped, dpap);
      var thunderGlow = energyMat(0x759ce8, 0.7);
      wonderGlow(thunderGlow, 0.67, 0.13, 2.4, 0.3);

      // Faceted receiver, rear pressure cap and proper firing furniture.
      cylZ(0.085, 0.118, 0.34, 0, 0, -0.025, thunderSteel, 10);
      cylZ(0.116, 0.1, 0.075, 0, 0, 0.18, thunderDark, 10);
      box(0.13, 0.028, 0.25, 0, 0.105, -0.015, thunderDark);
      for (var tp = 0; tp < 3; tp++)
        box(0.14, 0.012, 0.024, 0, 0.124, 0.065 - tp * 0.075, thunderTrim);
      box(0.078, 0.19, 0.086, 0, -0.15, 0.095, M.poly, 0.27);
      box(0.086, 0.022, 0.078, 0, -0.24, 0.12, thunderDark);
      var thunderGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.049, 0.009, 5, 12, Math.PI * 1.55), thunderTrim);
      thunderGuard.rotation.y = Math.PI / 2;
      thunderGuard.rotation.x = -0.26;
      thunderGuard.position.set(0, -0.076, 0.01);
      g.add(thunderGuard);
      box(0.013, 0.044, 0.013, 0, -0.075, 0.022, M.mid, 0.25);

      // Twin side tanks, each with a pressure jewel and a curved feed hose.
      [-0.108, 0.108].forEach(function (tx) {
        cylZ(0.042, 0.048, 0.24, tx, 0.018, -0.11, thunderDark, 10);
        [-0.005, -0.215].forEach(function (tz) {
          var tankBand = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.006, 5, 10), thunderTrim);
          tankBand.position.set(tx, 0.018, tz); g.add(tankBand);
        });
        var gauge = new THREE.Mesh(new THREE.SphereGeometry(0.025, 7, 6), thunderGlow);
        gauge.scale.set(1, 0.45, 1);
        gauge.position.set(tx, 0.071, -0.07); g.add(gauge);
        var hosePath = new THREE.CatmullRomCurve3([
          new THREE.Vector3(tx, 0.0, -0.22),
          new THREE.Vector3(tx * 1.2, -0.05, -0.29),
          new THREE.Vector3(tx * 0.72, -0.052, -0.36)
        ]);
        var hose = new THREE.Mesh(new THREE.TubeGeometry(hosePath, 6, 0.009, 5, false), thunderDark);
        g.add(hose);
      });

      // Segmented compression barrel and dark muzzle bell.
      cylZ(0.055, 0.072, 0.29, 0, 0, -0.33, thunderDark, 12);
      for (var tb = 0; tb < 3; tb++) {
        var compressionBand = new THREE.Mesh(
          new THREE.TorusGeometry(0.071 + tb * 0.006, 0.008, 5, 12), thunderTrim);
        compressionBand.position.set(0, 0, -0.225 - tb * 0.095); g.add(compressionBand);
      }
      cylZ(0.108, 0.08, 0.14, 0, 0, -0.535, thunderSteel, 12);
      var muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.109, 0.012, 6, 16), thunderDark);
      muzzleRing.position.set(0, 0, -0.598); g.add(muzzleRing);

      // The turbine is mechanical steel with only its hub and pressure veins
      // glowing, making its rotation legible without a neon muzzle.
      var diaphragm = new THREE.Group(); diaphragm.position.set(0, 0, -0.595);
      var diaphragmHub = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.024, 9), thunderGlow);
      diaphragmHub.rotation.x = Math.PI / 2; diaphragm.add(diaphragmHub);
      for (var df = 0; df < 8; df++) {
        var da = df / 8 * Math.PI * 2;
        var plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.016),
          (df & 1) ? thunderSteel : thunderGlow);
        plate.position.set(Math.cos(da) * 0.058, Math.sin(da) * 0.058, 0);
        plate.rotation.z = da + 0.3; diaphragm.add(plate);
      }
      g.add(diaphragm); wonderRotor(diaphragm, 'z', 0.8, 0);
      wonderBob(diaphragm, 'z', 0.012, 2.8, 0.4);
      tipZ = -0.62;
    } else if (id === 'seelenmotor') {
      // Seelenmotor: a compact dieselpunk soul-pressure engine. A faceted
      // boiler, exposed reciprocating pistons and a caged flywheel replace the
      // generic rifle silhouette; teal is confined to pressure-energy readouts.
      var motorSteel = accentMat(0x263238, papped, dpap);
      var motorIron = accentMat(0x151d20, papped, dpap);
      var motorBrass = accentMat(0x8d6b3e, papped, dpap);
      var motorDial = new THREE.MeshPhongMaterial({
        color: 0xc8bea2, shininess: 45, specular: new THREE.Color(0x756c59)
      });
      var soulMat = new THREE.MeshPhongMaterial({
        color: 0x092b2d, emissive: new THREE.Color(0x22b8ad), emissiveIntensity: 0.62,
        shininess: 90, specular: new THREE.Color(0x85e6dc)
      });
      wonderGlow(soulMat, 0.58, 0.13, 3.2, 0.1);

      // Tapered, low-poly boiler and armoured breech. Three narrow brass hoops
      // break up its mass while keeping the viewmodel compact.
      cylZ(0.102, 0.12, 0.31, 0, -0.005, -0.055, motorSteel, 10);
      cylZ(0.11, 0.086, 0.26, 0, -0.005, -0.335, motorIron, 10);
      [-0.015, -0.17, -0.37].forEach(function (bandZ) {
        var boilerBand = new THREE.Mesh(
          new THREE.TorusGeometry(bandZ === -0.37 ? 0.089 : 0.111, 0.008, 5, 12), motorBrass);
        boilerBand.position.set(0, -0.005, bandZ);
        g.add(boilerBand);
      });
      box(0.15, 0.025, 0.29, 0, 0.095, -0.17, motorIron);
      box(0.105, 0.018, 0.13, 0, -0.115, -0.055, motorBrass);

      // A real firing assembly: canted insulated grip, complete guard loop and
      // separate trigger blade instead of a box suspended under the receiver.
      box(0.074, 0.18, 0.082, 0, -0.155, 0.09, M.wood, 0.3);
      box(0.082, 0.022, 0.075, 0, -0.242, 0.12, motorIron, 0.3);
      var motorGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.046, 0.008, 5, 12, Math.PI * 1.58), motorBrass);
      motorGuard.rotation.y = Math.PI / 2;
      motorGuard.rotation.x = -0.29;
      motorGuard.position.set(0, -0.076, 0.005);
      g.add(motorGuard);
      box(0.011, 0.041, 0.012, 0, -0.073, 0.018, motorIron, 0.3);

      // Twin exposed piston rails run outside the boiler. Their sleeves move
      // out of phase, selling the weapon as a pressure engine at negligible
      // runtime cost (the existing viewmodel transform hook does the work).
      [-0.112, 0.112].forEach(function (x, pi) {
        cylZ(0.012, 0.012, 0.41, x, -0.012, -0.275, motorBrass, 6);
        var piston = cylZ(0.032, 0.027, 0.105, x, -0.012, -0.39, motorSteel, 8);
        wonderBob(piston, 'z', 0.012, 3.6, pi ? Math.PI : 0);
        cylZ(0.035, 0.025, 0.045, x, -0.012, -0.48, motorBrass, 8);
      });

      // Offset caged flywheel: the outer guards stay fixed while a brass wheel
      // and small soul-bearing hub visibly turn between them.
      var motorCage = new THREE.Group();
      motorCage.position.set(-0.07, 0.115, -0.17);
      [-0.018, 0.018].forEach(function (cageZ) {
        var guardRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 5, 14), motorIron);
        guardRing.position.z = cageZ; motorCage.add(guardRing);
      });
      var flywheel = new THREE.Group();
      var wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.009, 5, 12), motorBrass);
      flywheel.add(wheelRim);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.035, 8), soulMat);
      hub.rotation.x = Math.PI / 2; flywheel.add(hub);
      for (var sm = 0; sm < 4; sm++) {
        var blade = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.012, 0.012), motorBrass);
        blade.rotation.z = sm * Math.PI / 2; flywheel.add(blade);
      }
      motorCage.add(flywheel);
      [-0.062, 0.062].forEach(function (cx) {
        var cageBar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.045), motorSteel);
        cageBar.position.x = cx; motorCage.add(cageBar);
      });
      g.add(motorCage);
      wonderRotor(flywheel, 'z', 2.8, 0.2);

      // Rear-facing pressure gauge is readable in first person. The needle is
      // deliberately mechanical ivory/brass, not another glowing disc.
      cylZ(0.047, 0.047, 0.018, 0.076, 0.105, 0.035, motorBrass, 12);
      cylZ(0.038, 0.038, 0.021, 0.076, 0.105, 0.043, motorDial, 12);
      var gaugeNeedle = box(0.007, 0.035, 0.006, 0.076, 0.112, 0.056, motorIron);
      gaugeNeedle.rotation.z = -0.68;

      // Three discrete soul-charge lamps sit in a protected rack on the upper
      // right. Keep these exact meshes in soulCells: gameplay recolours them as
      // charges are earned.
      g.userData.soulCells = [];
      for (var sch = 0; sch < 3; sch++) {
        var cellZ = 0.055 - sch * 0.06;
        var cellSocket = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.005, 4, 9), motorBrass);
        cellSocket.rotation.x = Math.PI / 2;
        cellSocket.position.set(0.11, 0.111, cellZ);
        g.add(cellSocket);
        var chargeCell = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.038, 7),
          new THREE.MeshBasicMaterial({ color: 0x163b3a }));
        chargeCell.position.set(0.11, 0.133, cellZ);
        g.add(chargeCell); g.userData.soulCells.push(chargeCell);
      }
      box(0.046, 0.014, 0.17, 0.11, 0.103, -0.005, motorIron);

      // Layered compression bell: dark steel outer flare, brass throat and only
      // a small teal valve at the muzzle.
      cylZ(0.073, 0.098, 0.15, 0, -0.005, -0.545, motorSteel, 12);
      var bellRing = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.011, 5, 14), motorIron);
      bellRing.position.set(0, -0.005, -0.612); g.add(bellRing);
      cylZ(0.041, 0.058, 0.1, 0, -0.005, -0.665, motorBrass, 10);
      cylZ(0.019, 0.029, 0.04, 0, -0.005, -0.716, soulMat, 8);
      tipZ = -0.73;
    } else if (id === 'nachbildner115') {
      // Nachbildner 115: a compact mirrored replicator. Paired memory rails feed
      // a caged prism and split emitter, replacing the old loose open-frame
      // geometry while retaining its unmistakable violet duplication hardware.
      var mirror = accentMat(0x302a39, papped, dpap);
      var mirrorTrim = accentMat(0x665078, papped, dpap);
      var prismFrame = accentMat(0x796589, papped, dpap);
      var prismMat = new THREE.MeshPhongMaterial({
        color: 0x21102f, emissive: new THREE.Color(0x9a48d7), emissiveIntensity: 0.58,
        shininess: 100, specular: new THREE.Color(0xe0b1ff)
      });
      wonderGlow(prismMat, 0.54, 0.12, 2.4, 1.2);

      // Faceted chassis, rear memory housing and layered mirrored armor.
      cylZ(0.078, 0.103, 0.28, 0, -0.005, 0.045, mirror, 8);
      cylZ(0.098, 0.082, 0.095, 0, -0.005, 0.21, M.dark, 8);
      box(0.145, 0.05, 0.3, 0, -0.045, 0.015, M.dark);
      for (var nr = 0; nr < 3; nr++) {
        box(0.135, 0.012, 0.027, 0, 0.096, 0.1 - nr * 0.07, mirrorTrim);
      }

      // Canted insulated grip with a complete trigger assembly.
      box(0.072, 0.18, 0.08, 0, -0.15, 0.125, M.poly, -0.29);
      box(0.086, 0.025, 0.086, 0, -0.235, 0.15, M.dark, -0.29);
      [-0.039, 0.039].forEach(function (side) {
        box(0.012, 0.056, 0.014, side, -0.075, 0.018, mirrorTrim);
      });
      box(0.09, 0.012, 0.014, 0, -0.104, 0.018, mirrorTrim);
      box(0.012, 0.047, 0.014, 0, -0.071, 0.029, M.mid, -0.28);

      // Two enclosed memory rails flank the chamber. Four mirrored tiles on
      // each side imply recorded afterimages without cluttering the silhouette.
      [-0.093, 0.093].forEach(function (side) {
        box(0.042, 0.055, 0.38, side, 0.035, -0.245, mirror);
        cylZ(0.013, 0.018, 0.32, side, 0.035, -0.245, prismFrame, 7);
        for (var nm = 0; nm < 4; nm++) {
          box(0.052, 0.068, 0.032, side, 0.035, -0.105 - nm * 0.09,
            nm & 1 ? mirrorTrim : prismFrame);
        }
      });

      // Static cage hoops and four short braces make the prism feel mounted.
      // Only the smaller inner prism rotates, keeping motion readable and tidy.
      var prismHousing = new THREE.Group(); prismHousing.position.set(0, 0.075, -0.285);
      [-0.038, 0.038].forEach(function (depth) {
        var prismHoop = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.011, 6, 15),
          depth < 0 ? M.dark : prismFrame);
        prismHoop.position.z = depth; prismHousing.add(prismHoop);
      });
      for (var pn = 0; pn < 4; pn++) {
        var pa = pn / 4 * Math.PI * 2;
        var cageBrace = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.09), mirrorTrim);
        cageBrace.position.set(Math.cos(pa) * 0.1, Math.sin(pa) * 0.1, 0);
        cageBrace.rotation.z = pa; prismHousing.add(cageBrace);
      }
      g.add(prismHousing);
      var prismRotor = new THREE.Group(); prismRotor.position.set(0, 0.075, -0.285);
      var prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.064, 0), prismMat);
      prism.scale.set(0.8, 1.08, 1.28); prismRotor.add(prism);
      for (var ps = 0; ps < 3; ps++) {
        var prismSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.009, 0.014),
          prismFrame);
        prismSpoke.rotation.z = ps * Math.PI / 3; prismRotor.add(prismSpoke);
      }
      g.add(prismRotor); wonderRotor(prismRotor, 'y', 1.55, 0.4);

      // Armored bridge resolves into two independent image emitters. Small
      // violet cores sit inside dark housings rather than becoming neon rails.
      box(0.17, 0.052, 0.09, 0, 0.02, -0.49, M.dark);
      [-0.052, 0.052].forEach(function (side) {
        cylZ(0.026, 0.04, 0.25, side, 0.02, -0.65, mirror, 8);
        cylZ(0.011, 0.016, 0.2, side, 0.02, -0.66, prismMat, 7);
        var emitterCollar = new THREE.Mesh(
          new THREE.TorusGeometry(0.04, 0.007, 5, 9), prismFrame);
        emitterCollar.position.set(side, 0.02, -0.755); g.add(emitterCollar);
      });
      tipZ = -0.86;
    } else if (cls === 'wunder') {
      // Wunderwaffe DG-2: insulated coil rifle, brass guide rails, a visible
      // dynamo and forked muzzle. It stays faithful to the silhouette but now
      // has readable moving electrical hardware from the player's hand.
      var dgBrass = accentMat(0xa77b39, papped, dpap);
      var dgCore = new THREE.MeshPhongMaterial({
        color: 0x0a2b36, emissive: new THREE.Color(0x18bde0), emissiveIntensity: 0.92,
        shininess: 100, specular: new THREE.Color(0xc4f8ff)
      });
      wonderGlow(dgCore, 0.9, 0.22, 3.6, 0.5);
      var dgInsulator = new THREE.MeshPhongMaterial({
        color: 0x18303b, emissive: new THREE.Color(0x16829f), emissiveIntensity: 0.72,
        shininess: 75, specular: new THREE.Color(0x87e7ff)
      });
      wonderGlow(dgInsulator, 0.7, 0.18, 2.2, 2.0);
      box(0.095, 0.14, 0.33, 0, -0.035, 0.13, M.wood);                   // bakelite stock
      box(0.125, 0.12, 0.4, 0, 0, -0.13, accentMat(0x334148, papped, dpap)); // armored chassis
      box(0.08, 0.18, 0.09, 0, -0.14, 0.06, M.wood, 0.22);               // grip
      box(0.1, 0.025, 0.13, 0, -0.055, -0.02, M.dark);                   // trigger spine
      [-0.095, 0.095].forEach(function (x) {
        cylZ(0.018, 0.022, 0.62, x, 0.025, -0.34, dgBrass, 8);           // exposed guide rails
      });
      for (var ci = 0; ci < 4; ci++) {
        var coilM = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.012, 7, 16), dgInsulator);
        coilM.position.set(0, 0.025, -0.12 - ci * 0.13); g.add(coilM);   // barrel coils
      }
      var dynamo = new THREE.Group(); dynamo.position.set(0, 0.09, -0.28);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.067, 10, 10), dgCore);
      bulb.scale.z = 1.2; dynamo.add(bulb);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 6, 18), dgBrass);
      dynamo.add(ring);
      for (var ds = 0; ds < 4; ds++) {
        var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.014, 0.016), dgBrass);
        spoke.rotation.z = ds * Math.PI / 2; dynamo.add(spoke);
      }
      g.add(dynamo); wonderRotor(dynamo, 'z', 2.35, 0.1);
      [-0.065, 0.065].forEach(function (x) {
        cylZ(0.018, 0.027, 0.25, x, 0.005, -0.71, dgCore, 8);            // forked electrodes
      });
      box(0.17, 0.034, 0.055, 0, 0.005, -0.61, M.mid);                   // fork bridge
      tipZ = -0.86;
    } else if (id === 'blitzfanger') {
      // Blitzfänger: a compact twin-coil fence projector. Its cyan charge is
      // confined to capacitor windows, small live arcs and electrode tips;
      // blackened steel, brass channels and insulated hardware carry the form.
      var blitzSteel = accentMat(0x29343a, papped, dpap);
      var blitzBrass = accentMat(0x745b35, papped, dpap);
      var blitzInsulator = accentMat(0x2c343b, papped, dpap);
      var blitzGlow = energyMat(0x66ddff, 0.76);
      wonderGlow(blitzGlow, 0.72, 0.14, 4.4, 0.2);

      // Faceted generator chassis, rear cell housing and armored side cheeks.
      cylZ(0.08, 0.105, 0.28, 0, 0, 0.035, blitzSteel, 8);
      cylZ(0.1, 0.083, 0.095, 0, 0, 0.205, M.dark, 8);
      box(0.15, 0.045, 0.25, 0, -0.045, 0.02, M.dark);
      [-0.09, 0.09].forEach(function (side) {
        box(0.022, 0.105, 0.2, side, 0.015, 0.035, blitzSteel);
      });

      // Insulated, rearward-canted grip with a complete guard and trigger.
      box(0.07, 0.18, 0.078, 0, -0.15, 0.12, blitzInsulator, -0.29);
      for (var bg = 0; bg < 3; bg++) {
        box(0.078, 0.012, 0.082, 0, -0.12 - bg * 0.05, 0.125 + bg * 0.014,
          bg & 1 ? blitzBrass : M.dark, -0.29);
      }
      [-0.038, 0.038].forEach(function (side) {
        box(0.012, 0.055, 0.014, side, -0.075, 0.018, blitzBrass);
      });
      box(0.088, 0.012, 0.014, 0, -0.103, 0.018, blitzBrass);
      box(0.012, 0.046, 0.014, 0, -0.07, 0.028, M.mid, -0.27);

      // Three exposed capacitors sit in a protected side bank. Their narrow
      // windows communicate stored fence charges without flooding the chassis.
      box(0.065, 0.14, 0.2, 0.105, 0.015, 0.035, M.dark);
      for (var bcap = 0; bcap < 3; bcap++) {
        cylZ(0.024, 0.024, 0.052, 0.14, 0.052 - bcap * 0.045,
          0.035, blitzGlow, 7);
        var capCollar = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.006, 5, 8), blitzBrass);
        capCollar.position.set(0.14, 0.052 - bcap * 0.045, 0.008);
        g.add(capCollar);
      }

      // Twin dark electrode channels with alternating brass/steel windings.
      // The channels stay solid and mechanical; only their inner conductors
      // and terminal contacts carry the cyan fence charge.
      [-0.058, 0.058].forEach(function (rx, channelIndex) {
        cylZ(0.022, 0.027, 0.46, rx, 0.045, -0.38, blitzSteel, 8);
        cylZ(0.009, 0.012, 0.4, rx, 0.045, -0.38, blitzGlow, 6);
        for (var bc = 0; bc < 4; bc++) {
          var br = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.007, 5, 9),
            (bc + channelIndex) & 1 ? M.mid : blitzBrass);
          br.position.set(rx, 0.045, -0.22 - bc * 0.1); g.add(br);
        }
      });
      box(0.16, 0.045, 0.07, 0, 0.045, -0.19, M.dark);
      box(0.145, 0.025, 0.075, 0, 0.045, -0.51, blitzBrass);

      // A restrained live arc flickers between the channels. A small commutator
      // behind it provides the in-hand rotor motion without a giant glowing gem.
      var liveArc = new THREE.Group(); liveArc.position.set(0, 0.09, -0.35);
      [-1, 1].forEach(function (sgn) {
        var arcSegment = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.008, 0.014), blitzGlow);
        arcSegment.position.set(sgn * 0.027, sgn * 0.012, 0);
        arcSegment.rotation.z = -sgn * 0.42;
        liveArc.add(arcSegment);
      });
      g.add(liveArc); wonderBob(liveArc, 'y', 0.006, 5.2, 0.3);
      var blitzCommutator = new THREE.Group(); blitzCommutator.position.set(0, 0.105, -0.075);
      var commutatorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.028, 8), blitzGlow);
      commutatorHub.rotation.x = Math.PI / 2; blitzCommutator.add(commutatorHub);
      for (var ba = 0; ba < 3; ba++) {
        var contactArm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.015), blitzBrass);
        contactArm.rotation.z = ba * Math.PI / 3; blitzCommutator.add(contactArm);
      }
      g.add(blitzCommutator); wonderRotor(blitzCommutator, 'z', 2.8, 0.4);

      // Split, slightly splayed fork muzzle plants the two fence poles.
      [-1, 1].forEach(function (sgn) {
        var fork = cylZ(0.016, 0.024, 0.22, sgn * 0.072, 0.045, -0.64,
          blitzSteel, 7);
        fork.rotation.y = sgn * 0.12;
        var forkTip = new THREE.Mesh(new THREE.ConeGeometry(0.029, 0.09, 7), blitzGlow);
        forkTip.rotation.x = -Math.PI / 2;
        forkTip.rotation.z = sgn * 0.12;
        forkTip.position.set(sgn * 0.084, 0.045, -0.765);
        g.add(forkTip);
      });
      tipZ = -0.82;
    } else if (id === 'kryolithwerfer') {
      // Kryolithwerfer: a purpose-built cryogenic pressure cannon. Dark,
      // frosted machinery surrounds a caged coolant crystal and feeds a
      // segmented five-petal nozzle instead of presenting as one blue tube.
      var crySteel = accentMat(0x29383d, papped, dpap);
      var cryFrost = accentMat(0x526b73, papped, dpap);
      var cryTrim = accentMat(0x65787a, papped, dpap);
      var frostGlow = energyMat(0xbfefff, 0.68);
      wonderGlow(frostGlow, 0.64, 0.14, 2.6, 0.8);

      // Faceted receiver, rear pressure cap and lower reinforced backbone.
      cylZ(0.085, 0.11, 0.3, 0, -0.005, 0.04, crySteel, 10);
      cylZ(0.108, 0.088, 0.1, 0, -0.005, 0.215, M.dark, 10);
      box(0.145, 0.055, 0.34, 0, -0.05, -0.02, M.dark);
      [-0.087, 0.087].forEach(function (side) {
        box(0.02, 0.105, 0.235, side, 0.01, 0.04, cryFrost);
      });
      for (var cr = 0; cr < 3; cr++) {
        box(0.135, 0.012, 0.027, 0, 0.095, 0.105 - cr * 0.07, cryTrim);
      }

      // Insulated canted grip with visible heel, guard and trigger.
      box(0.072, 0.18, 0.08, 0, -0.15, 0.125, M.poly, -0.29);
      box(0.086, 0.025, 0.086, 0, -0.235, 0.15, M.dark, -0.29);
      [-0.039, 0.039].forEach(function (side) {
        box(0.012, 0.056, 0.014, side, -0.075, 0.018, cryTrim);
      });
      box(0.09, 0.012, 0.014, 0, -0.104, 0.018, cryTrim);
      box(0.012, 0.047, 0.014, 0, -0.071, 0.029, M.mid, -0.28);

      // Transparent pressure bottle and frosted end collars expose the smaller
      // coolant crystal. Four cage rails keep it visibly mounted to the gun.
      var cryGlass = new THREE.MeshPhongMaterial({
        color: 0xb9d8df, transparent: true, opacity: 0.28, shininess: 105,
        specular: new THREE.Color(0xf3ffff), depthWrite: false
      });
      cylZ(0.078, 0.078, 0.27, 0, 0.08, -0.205, cryGlass, 12);
      [-0.06, -0.35].forEach(function (z) {
        cylZ(0.09, 0.09, 0.038, 0, 0.08, z, cryFrost, 10);
      });
      var cryCage = new THREE.Group(); cryCage.position.set(0, 0.08, -0.205);
      var cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 0), frostGlow);
      cry.scale.set(0.78, 1.05, 1.45); cryCage.add(cry);
      for (var cf = 0; cf < 4; cf++) {
        var ca = cf / 4 * Math.PI * 2;
        var frostFin = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.04, 0.3),
          cf & 1 ? cryTrim : crySteel);
        frostFin.position.set(Math.cos(ca) * 0.087, Math.sin(ca) * 0.087, 0);
        frostFin.rotation.z = ca; cryCage.add(frostFin);
      }
      g.add(cryCage); wonderRotor(cryCage, 'z', 1.35, 0.2);

      // Ribbed pressure throat leading into a mechanically segmented nozzle.
      cylZ(0.052, 0.073, 0.26, 0, 0.02, -0.49, crySteel, 10);
      for (var cb = 0; cb < 3; cb++) {
        var frostBand = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.008, 5, 11),
          cb & 1 ? cryTrim : M.mid);
        frostBand.position.set(0, 0.02, -0.4 - cb * 0.08); g.add(frostBand);
      }
      cylZ(0.09, 0.072, 0.09, 0, 0.02, -0.635, M.dark, 10);

      // Five separate frosted petals frame a restrained ice aperture. Each
      // petal has a small luminous inner vein rather than being fully emissive.
      var cryNozzle = new THREE.Group(); cryNozzle.position.set(0, 0.02, -0.69);
      for (var cn = 0; cn < 5; cn++) {
        var petalA = cn / 5 * Math.PI * 2;
        var petal = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.075, 0.095), cryFrost);
        petal.position.set(Math.cos(petalA) * 0.058, Math.sin(petalA) * 0.058, 0);
        petal.rotation.z = petalA; cryNozzle.add(petal);
        var frostVein = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.042, 0.055),
          frostGlow);
        frostVein.position.set(Math.cos(petalA) * 0.057, Math.sin(petalA) * 0.057, -0.014);
        frostVein.rotation.z = petalA; cryNozzle.add(frostVein);
      }
      var cryAperture = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 0.055, 8),
        frostGlow);
      cryAperture.rotation.x = Math.PI / 2; cryNozzle.add(cryAperture);
      g.add(cryNozzle);
      tipZ = -0.75;
    } else if (id === 'vosssiphon') {
      // Voss's Siphon: a compact biomechanical transfusion pistol. A slim
      // blackened-steel spine carries a glass vitae ampoule into a ribbed
      // barrel and three-pronged extractor, so its silhouette reads as a gun
      // rather than a glowing tank.
      var siphonGlow = energyMat(0x76e6b3, 0.82);
      wonderGlow(siphonGlow, 0.78, 0.14, 3.4, 1.1);
      var siphonBody = accentMat(0x242b29, papped, dpap);
      var siphonBrass = accentMat(0x9a7540, papped, dpap);
      var siphonBakelite = accentMat(0x302820, papped, dpap);

      // Tapered receiver, lower backbone and a properly articulated grip.
      cylZ(0.072, 0.094, 0.25, 0, -0.005, -0.035, siphonBody, 10);
      box(0.086, 0.052, 0.49, 0, -0.045, -0.22, siphonBody);
      cylZ(0.09, 0.078, 0.055, 0, -0.005, 0.105, siphonBrass, 10);
      box(0.072, 0.18, 0.078, 0, -0.14, 0.06, siphonBakelite, 0.24);
      box(0.08, 0.018, 0.07, 0, -0.224, 0.085, siphonBrass);            // grip heel
      var siphonGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.008, 5, 12, Math.PI * 1.55), siphonBrass);
      siphonGuard.rotation.y = Math.PI / 2;
      siphonGuard.rotation.x = -0.25;
      siphonGuard.position.set(0, -0.072, -0.005);
      g.add(siphonGuard);
      box(0.012, 0.04, 0.012, 0, -0.07, 0.005, M.mid, 0.28);            // trigger

      // Transparent glass ampoule with a smaller, restrained vitae column.
      var ampouleGlass = new THREE.MeshPhongMaterial({
        color: 0xb9d8cc, transparent: true, opacity: 0.32, shininess: 110,
        specular: new THREE.Color(0xffffff), depthWrite: false
      });
      var vitae = new THREE.MeshPhongMaterial({
        color: 0x0d4939, emissive: new THREE.Color(0x4bcf96), emissiveIntensity: 0.56,
        transparent: true, opacity: 0.76, shininess: 95,
        specular: new THREE.Color(0xb9ffe2)
      });
      wonderGlow(vitae, 0.54, 0.11, 2.6, 0.3);
      cylZ(0.058, 0.058, 0.27, 0, 0.091, -0.15, ampouleGlass, 14);
      var vitaeColumn = cylZ(0.038, 0.043, 0.22, 0, 0.091, -0.15, vitae, 12);
      wonderBob(vitaeColumn, 'y', 0.004, 2.2, 0.4);
      [-0.005, -0.295].forEach(function (az) {
        cylZ(0.073, 0.073, 0.035, 0, 0.091, az, siphonBrass, 12);        // ampoule caps
      });
      [-0.072, 0.072].forEach(function (ax) {
        box(0.012, 0.038, 0.3, ax, 0.091, -0.15, siphonBrass);           // art-deco cage rails
      });
      var valve = new THREE.Group();
      valve.position.set(0.082, 0.094, -0.15);
      var valveRing = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.006, 5, 12), siphonBrass);
      valveRing.rotation.y = Math.PI / 2; valve.add(valveRing);
      for (var vs = 0; vs < 3; vs++) {
        var valveSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.055, 0.008), siphonBrass);
        valveSpoke.rotation.x = vs * Math.PI / 3; valve.add(valveSpoke);
      }
      g.add(valve); wonderRotor(valve, 'x', 1.25, 0.2);

      // A narrow ribbed barrel bridges the receiver to the extractor crown.
      cylZ(0.038, 0.052, 0.34, 0, -0.008, -0.47, siphonBody, 10);
      for (var sr = 0; sr < 5; sr++) {
        var barrelRib = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 5, 12), siphonBrass);
        barrelRib.position.set(0, -0.008, -0.34 - sr * 0.062);
        g.add(barrelRib);
      }
      cylZ(0.066, 0.054, 0.07, 0, -0.008, -0.655, siphonBrass, 10);

      // Three dark-metal siphon claws surround small mint extraction needles;
      // the glow accents the muzzle without turning it into a luminous blob.
      for (var sc = 0; sc < 3; sc++) {
        var sa = sc / 3 * Math.PI * 2 + Math.PI / 2;
        var claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.17, 7), siphonBody);
        claw.rotation.x = -Math.PI / 2;
        claw.position.set(Math.cos(sa) * 0.056, -0.008 + Math.sin(sa) * 0.056, -0.72);
        g.add(claw);
        cylZ(0.008, 0.012, 0.105, Math.cos(sa) * 0.056,
          -0.008 + Math.sin(sa) * 0.056, -0.735, siphonGlow, 6);
      }
      tipZ = -0.78;
    } else if (cls === 'storm' && vm.lance) {
      // Aether Lance: an occult brass rifle built around a segmented spear
      // rail. A complete receiver, shoulder brace and capacitor keep its long
      // profile from reading as a bare rod.
      var lanceDark = accentMat(0x28242e, papped, dpap);
      var lanceBrass = accentMat(0x92703d, papped, dpap);
      var lancePanel = accentMat(0x4b3659, papped, dpap);
      var lanceGlow = energyMat(0xc18bf0, 0.8);
      wonderGlow(lanceGlow, 0.76, 0.14, 3.2, 0.4);

      // Faceted receiver, rear shoulder yoke and firing furniture.
      cylZ(0.07, 0.105, 0.3, 0, 0, 0.06, lanceDark, 8);
      [-0.073, 0.073].forEach(function (lx) {
        box(0.016, 0.085, 0.23, lx, 0, 0.055, lancePanel);
        box(0.018, 0.045, 0.25, lx, 0.025, 0.255, lanceBrass, -0.12);
      });
      box(0.17, 0.11, 0.025, 0, 0.005, 0.38, lanceDark);                // shoulder brace
      box(0.085, 0.19, 0.082, 0, -0.15, 0.11, M.wood, 0.28);
      box(0.092, 0.022, 0.078, 0, -0.24, 0.14, lanceBrass);
      var lanceGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.048, 0.008, 5, 12, Math.PI * 1.55), lanceBrass);
      lanceGuard.rotation.y = Math.PI / 2;
      lanceGuard.rotation.x = -0.27;
      lanceGuard.position.set(0, -0.076, 0.02);
      g.add(lanceGuard);
      box(0.012, 0.043, 0.012, 0, -0.075, 0.032, M.mid, 0.26);

      // Caged aether capacitor sits above the receiver like an occult reliquary.
      var lanceCapacitor = new THREE.Group();
      lanceCapacitor.position.set(0, 0.083, -0.08);
      var lanceCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), lanceGlow);
      lanceCore.scale.z = 1.22; lanceCapacitor.add(lanceCore);
      var lanceCage = new THREE.Mesh(new THREE.TorusGeometry(0.067, 0.008, 5, 14), lanceBrass);
      lanceCapacitor.add(lanceCage);
      for (var lc = 0; lc < 3; lc++) {
        var cageBarL = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.112, 0.011), lanceBrass);
        cageBarL.rotation.z = lc * Math.PI / 3; lanceCapacitor.add(cageBarL);
      }
      g.add(lanceCapacitor);
      wonderRotor(lanceCapacitor, 'z', 1.15, 0.2);
      wonderBob(lanceCore, 'y', 0.005, 3.5, 0.2);

      // Three interrupted rail sections and twin guides form the spear shaft.
      var lanceSegments = [
        { z: -0.18, len: 0.18, r1: 0.04, r2: 0.048 },
        { z: -0.385, len: 0.18, r1: 0.032, r2: 0.04 },
        { z: -0.585, len: 0.17, r1: 0.024, r2: 0.032 }
      ];
      lanceSegments.forEach(function (segment) {
        cylZ(segment.r1, segment.r2, segment.len, 0, 0.012, segment.z,
          lanceDark, 9);
        var collarL = new THREE.Mesh(
          new THREE.TorusGeometry(segment.r2 + 0.007, 0.007, 5, 11), lanceBrass);
        collarL.position.set(0, 0.012, segment.z - segment.len * 0.43); g.add(collarL);
      });
      [-0.044, 0.044].forEach(function (gx) {
        cylZ(0.009, 0.012, 0.56, gx, 0.012, -0.4, lanceBrass, 6);
      });

      // Forked brass tines frame a restrained violet spear point.
      [-0.047, 0.047].forEach(function (px) {
        var lanceProng = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.17, 7), lanceBrass);
        lanceProng.rotation.x = -Math.PI / 2;
        lanceProng.rotation.z = px < 0 ? -0.09 : 0.09;
        lanceProng.position.set(px, 0.012, -0.72); g.add(lanceProng);
      });
      var prong = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.17, 8), lanceGlow);
      prong.rotation.x = -Math.PI / 2; prong.position.set(0, 0.012, -0.735); g.add(prong);
      box(0.13, 0.025, 0.05, 0, 0.012, -0.645, lanceDark);              // fork bridge
      tipZ = -0.8;
    } else if (cls === 'storm' && vm.driver) {
      // Maelstrom Driver: a compact magnetic pressure-disk launcher. A toothed
      // rotor sits partly buried in a protective cage and feeds a segmented
      // rail muzzle, keeping it visually separate from the Wettermacher's orb.
      var driverSteel = accentMat(0x292a31, papped, dpap);
      var driverBrass = accentMat(0x8a692f, papped, dpap);
      var boreGlow = energyMat(0xb07cff, 0.94);
      wonderGlow(boreGlow, 0.9, 0.22, 3.1, 0.2);

      // Short faceted receiver and rear pressure chamber; these overlap into a
      // single mechanical mass instead of reading as a long rectangular stock.
      cylZ(0.085, 0.105, 0.27, 0, 0, 0.035, driverSteel, 8);
      cylZ(0.105, 0.09, 0.1, 0, 0, 0.205, M.dark, 8);
      box(0.135, 0.035, 0.19, 0, 0.095, 0.025, M.dark);
      for (var ds = 0; ds < 3; ds++) {
        box(0.145, 0.012, 0.026, 0, 0.116, 0.09 - ds * 0.065, driverBrass);
      }
      [-0.083, 0.083].forEach(function (side) {
        box(0.018, 0.11, 0.23, side, 0.005, 0.025, M.dark);
      });

      // Rearward-canted grip, visible trigger and squared guard.
      box(0.07, 0.18, 0.078, 0, -0.15, 0.115, M.poly, -0.3);
      box(0.085, 0.026, 0.085, 0, -0.235, 0.14, M.dark, -0.3);
      [-0.038, 0.038].forEach(function (side) {
        box(0.012, 0.058, 0.014, side, -0.075, 0.015, driverBrass);
      });
      box(0.088, 0.012, 0.014, 0, -0.105, 0.015, driverBrass);
      box(0.012, 0.05, 0.014, 0, -0.071, 0.025, M.mid, -0.28);

      // Side-mounted magnetic coil pack. Brass windings and a narrow violet
      // core make the power source readable without turning the whole gun neon.
      cylZ(0.038, 0.038, 0.17, -0.105, 0.025, 0.035, M.dark, 8);
      cylZ(0.018, 0.024, 0.14, -0.105, 0.025, 0.035, boreGlow, 7);
      for (var dc = 0; dc < 4; dc++) {
        var coilBand = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.007, 5, 9), driverBrass);
        coilBand.position.set(-0.105, 0.025, 0.095 - dc * 0.04);
        g.add(coilBand);
      }

      // Filled, toothed pressure disk: only its hub and six magnetic channels
      // glow. It spins behind a static black/brass cage instead of floating as
      // a naked luminous torus.
      var diskGroup = new THREE.Group(); diskGroup.position.set(0, 0.075, -0.205);
      var disk = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.094, 0.028, 16), driverSteel);
      disk.rotation.x = Math.PI / 2; diskGroup.add(disk);
      var diskRim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.011, 5, 16), driverBrass);
      diskGroup.add(diskRim);
      for (var dt = 0; dt < 10; dt++) {
        var toothA = dt / 10 * Math.PI * 2;
        var tooth = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.018, 0.036), M.mid);
        tooth.position.set(Math.cos(toothA) * 0.105, Math.sin(toothA) * 0.105, 0);
        tooth.rotation.z = toothA;
        diskGroup.add(tooth);
      }
      for (var dg = 0; dg < 6; dg++) {
        var channelA = dg / 6 * Math.PI * 2;
        var channel = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.05, 0.034), boreGlow);
        channel.position.set(Math.cos(channelA) * 0.057, Math.sin(channelA) * 0.057, 0);
        channel.rotation.z = channelA;
        diskGroup.add(channel);
      }
      var diskHub = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.05, 8), boreGlow);
      diskHub.rotation.x = Math.PI / 2; diskGroup.add(diskHub);
      g.add(diskGroup); wonderRotor(diskGroup, 'z', 4.4, 0.2);

      // Twin partial hoops, top bridge, and a deep lower shroud hold the rotor.
      // The open upper-right quadrant leaves enough blade visible to sell the
      // mechanism while the cage remains the dominant silhouette.
      [-0.022, 0.022].forEach(function (depth) {
        var cageHoop = new THREE.Mesh(
          new THREE.TorusGeometry(0.125, 0.012, 5, 15, Math.PI * 1.55),
          depth < 0 ? M.dark : driverBrass
        );
        cageHoop.rotation.z = 0.22;
        cageHoop.position.set(0, 0.075, -0.205 + depth);
        g.add(cageHoop);
      });
      box(0.21, 0.025, 0.065, 0, 0.19, -0.205, M.dark);
      box(0.145, 0.012, 0.073, 0, 0.209, -0.205, driverBrass);
      box(0.235, 0.075, 0.11, 0, -0.005, -0.205, M.dark);
      [-0.105, 0.105].forEach(function (side) {
        box(0.025, 0.16, 0.065, side, 0.055, -0.205, driverSteel);
      });

      // Three staggered magnetic rails surround a dark launch channel. Small
      // glowing couplers carry the violet identity forward to the muzzle.
      cylZ(0.03, 0.038, 0.36, 0, 0.055, -0.49, M.dark, 8);
      [[-0.065, 0.045], [0.065, 0.045], [0, 0.12]].forEach(function (rail, ri) {
        for (var rs = 0; rs < 3; rs++) {
          var railZ = -0.345 - rs * 0.115;
          box(0.023, 0.023, 0.082, rail[0], rail[1], railZ,
            (rs + ri) % 2 ? driverBrass : driverSteel);
          var coupler = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), boreGlow);
          coupler.position.set(rail[0], rail[1], railZ - 0.048);
          g.add(coupler);
        }
      });
      cylZ(0.075, 0.09, 0.075, 0, 0.055, -0.695, driverSteel, 10);
      cylZ(0.03, 0.045, 0.085, 0, 0.055, -0.715, boreGlow, 8);
      tipZ = -0.76;
    } else if (cls === 'storm') {
      // Wettermacher: a weathered storm-harvesting cannon. A restrained plasma
      // column lives inside glass and copper gyroscope rings, feeding a real
      // turbine muzzle rather than floating as a bright orb on a plain tube.
      var weatherSteel = accentMat(0x30393d, papped, dpap);
      var weatherCopper = accentMat(0x745035, papped, dpap);
      var weatherInsulator = accentMat(0x34312d, papped, dpap);
      var weatherGlow = energyMat(0x60d9ff, 0.68);
      wonderGlow(weatherGlow, 0.64, 0.14, 3.6, 0.8);

      // Faceted receiver with a heavy lower spine and armored rear pressure cap.
      cylZ(0.08, 0.105, 0.28, 0, -0.005, 0.05, weatherSteel, 8);
      cylZ(0.105, 0.085, 0.1, 0, -0.005, 0.22, M.dark, 8);
      box(0.145, 0.055, 0.34, 0, -0.045, -0.015, M.dark);
      [-0.086, 0.086].forEach(function (side) {
        box(0.02, 0.11, 0.23, side, 0.01, 0.045, weatherSteel);
      });
      for (var wr = 0; wr < 3; wr++) {
        box(0.13, 0.012, 0.028, 0, 0.095, 0.11 - wr * 0.07, weatherCopper);
      }

      // Rearward-canted insulated grip, heel, guard and physical trigger.
      box(0.072, 0.18, 0.08, 0, -0.15, 0.125, weatherInsulator, -0.29);
      box(0.086, 0.026, 0.086, 0, -0.235, 0.15, M.dark, -0.29);
      [-0.039, 0.039].forEach(function (side) {
        box(0.012, 0.057, 0.014, side, -0.076, 0.018, weatherCopper);
      });
      box(0.09, 0.012, 0.014, 0, -0.105, 0.018, weatherCopper);
      box(0.012, 0.047, 0.014, 0, -0.071, 0.029, M.mid, -0.28);

      // Clear storm chamber with a small contained plasma column. Copper end
      // collars and two static rails visually attach the glass to the receiver.
      var stormGlass = new THREE.MeshPhongMaterial({
        color: 0x9fc4cf, transparent: true, opacity: 0.3, shininess: 110,
        specular: new THREE.Color(0xe9fbff), depthWrite: false
      });
      cylZ(0.078, 0.078, 0.26, 0, 0.075, -0.175, stormGlass, 12);
      var plasmaColumn = cylZ(0.027, 0.045, 0.19, 0, 0.075, -0.175,
        weatherGlow, 8);
      wonderBob(plasmaColumn, 'z', 0.012, 3.1, 0.5);
      [-0.045, -0.305].forEach(function (z) {
        cylZ(0.088, 0.088, 0.035, 0, 0.075, z, weatherCopper, 10);
      });
      [-0.087, 0.087].forEach(function (side) {
        box(0.018, 0.035, 0.31, side, 0.075, -0.175, weatherSteel);
      });

      // Three copper gyroscope rings turn around the glass chamber. Their metal
      // silhouettes do the visual work; only the trapped plasma itself glows.
      var stormGyro = new THREE.Group(); stormGyro.position.set(0, 0.075, -0.175);
      var gyroA = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.009, 6, 16), weatherCopper);
      stormGyro.add(gyroA);
      var gyroB = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.009, 6, 16), weatherCopper);
      gyroB.rotation.x = Math.PI / 2; stormGyro.add(gyroB);
      var gyroC = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.008, 6, 16), M.mid);
      gyroC.rotation.y = Math.PI / 2; stormGyro.add(gyroC);
      g.add(stormGyro); wonderRotor(stormGyro, 'y', 1.65, 0.4);

      // Tapered turbine housing, rotating copper vanes and a dark funnel lip.
      cylZ(0.095, 0.068, 0.18, 0, 0.045, -0.405, weatherSteel, 10);
      var weatherTurbine = new THREE.Group(); weatherTurbine.position.set(0, 0.045, -0.505);
      var turbineHub = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.035, 8),
        weatherGlow);
      turbineHub.rotation.x = Math.PI / 2; weatherTurbine.add(turbineHub);
      for (var wt = 0; wt < 6; wt++) {
        var vane = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.018, 0.026), weatherCopper);
        vane.position.set(Math.cos(wt / 6 * Math.PI * 2) * 0.037,
          Math.sin(wt / 6 * Math.PI * 2) * 0.037, 0);
        vane.rotation.z = wt / 6 * Math.PI * 2 + 0.4;
        weatherTurbine.add(vane);
      }
      g.add(weatherTurbine); wonderRotor(weatherTurbine, 'z', 3.15, 0.1);
      cylZ(0.105, 0.075, 0.11, 0, 0.045, -0.555, M.dark, 12);
      var funnelLip = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.014, 6, 14),
        weatherCopper);
      funnelLip.position.set(0, 0.045, -0.615); g.add(funnelLip);
      cylZ(0.035, 0.052, 0.08, 0, 0.045, -0.625, weatherGlow, 8);
      tipZ = -0.68;
    } else {
      /* ------------------ generic long gun: smg / rifle / shotgun / lmg / sniper */
      var L = vm.len;
      var rl = vm.bullpup ? 0.36 : 0.3;                                   // receiver length
      var rz0 = vm.bullpup ? 0.06 : -0.1;                                 // receiver center
      box(0.07, 0.095, rl, 0, 0, rz0, body);                              // receiver
      box(0.05, 0.018, rl - 0.04, 0, 0.057, rz0, M.mid);                  // top rail
      var bFront = rz0 - rl / 2;
      var bl = 0.3 * L * vm.barFac;                                       // barrel length
      cylZ(0.02, 0.022, bl, 0, 0.012, bFront - bl / 2, M.mid);            // barrel
      tipZ = bFront - bl - 0.02;
      if (vm.twin) {
        cylZ(0.018, 0.018, bl, -0.022, 0.012, bFront - bl / 2, M.mid);
        cylZ(0.018, 0.018, bl, 0.022, 0.012, bFront - bl / 2, M.mid);
      }
      if (vm.supp) cylZ(0.032, 0.032, 0.12, 0, 0.012, tipZ + 0.04, M.poly, 12);
      // handguard
      var hgLen = Math.min(0.2, bl * 0.6);
      box(0.06, 0.068, hgLen, 0, -0.005, bFront - hgLen / 2 + 0.02, furniture);
      // sights
      box(0.012, 0.04, 0.012, 0, 0.085, tipZ + 0.05, M.dark);             // front post
      if (!vm.scope) box(0.04, 0.026, 0.016, 0, 0.082, rz0 + rl / 2 - 0.03, M.dark);
      if (vm.carryHandle) {
        box(0.016, 0.05, 0.16, 0, 0.09, rz0, M.dark);
        box(0.05, 0.016, 0.16, 0, 0.115, rz0, M.dark);
      }
      // grip + trigger guard
      box(0.042, 0.125, 0.065, 0, -0.115, vm.bullpup ? -0.06 : 0.03, furniture, 0.25);
      box(0.04, 0.018, 0.06, 0, -0.052, vm.bullpup ? -0.09 : 0, M.dark);
      // magazine
      var magZ = vm.bullpup ? 0.16 : rz0 + 0.04;
      if (vm.mag === 'straight') {
        box(0.045, 0.14 * (vm.magLen || 1), 0.075, 0, -0.115, magZ, M.mid, 0.06);
      } else if (vm.mag === 'curved') {
        box(0.045, 0.1, 0.075, 0, -0.1, magZ, M.mid, 0.12);
        box(0.045, 0.09, 0.07, 0.0, -0.175, magZ + 0.035, M.mid, 0.5);
      } else if (vm.mag === 'drum') {
        cylX(0.075, 0.06, 0, -0.115, magZ, M.dark, 14);
      } else if (vm.mag === 'box') {
        box(0.085, 0.12, 0.12, 0, -0.115, magZ, M.dark);
      } else if (vm.mag === 'tube') {
        cylZ(0.016, 0.016, bl * 0.85, 0, -0.035, bFront - bl * 0.42, M.mid);
      }
      // pump
      if (vm.pump) box(0.055, 0.05, 0.13, 0, -0.035, bFront - hgLen / 2 - 0.04, furniture);
      // stock
      var stockZ = rz0 + rl / 2;
      if (vm.bullpup) {
        box(0.062, 0.085, 0.1, 0, -0.01, stockZ + 0.04, furniture);       // butt block
      } else if (vm.stock === 'solid') {
        box(0.05, 0.075, 0.17, 0, -0.02, stockZ + 0.08, furniture, 0.06);
        box(0.055, 0.1, 0.03, 0, -0.03, stockZ + 0.165, furniture);
      } else if (vm.stock === 'skeleton') {
        box(0.014, 0.014, 0.16, 0, 0.02, stockZ + 0.08, M.mid);
        box(0.014, 0.014, 0.16, 0, -0.045, stockZ + 0.08, M.mid, 0.12);
        box(0.014, 0.08, 0.014, 0, -0.012, stockZ + 0.16, M.mid);
      }
      // scope
      if (vm.scope) {
        cylZ(0.026, 0.026, 0.15, 0, 0.1, rz0 - 0.02, M.dark, 12);
        cylZ(0.032, 0.026, 0.03, 0, 0.1, rz0 - 0.1, M.dark, 12);
        var lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12),
          new THREE.MeshPhongMaterial({ color: 0x113344, emissive: 0x224466, shininess: 90 }));
        lens.position.set(0, 0.1, rz0 - 0.115);
        lens.rotation.y = Math.PI;
        g.add(lens);
        box(0.012, 0.03, 0.02, 0, 0.075, rz0 + 0.02, M.dark);             // mount
      }
      // ejection port detail
      box(0.004, 0.03, 0.06, 0.037, 0.01, rz0 - 0.02, M.mid);
      // bolt handle
      box(0.03, 0.012, 0.012, 0.05, 0.02, rz0 + 0.05, M.mid);

      /* ---- per-gun signature accessories (make every model unique) ---- */
      box(0.073, 0.018, rl - 0.07, 0, -0.05, rz0, accent);                // accent stripe
      if (vm.muzzle === 'supp') cylZ(0.034, 0.034, 0.14, 0, 0.012, tipZ + 0.05, M.poly, 12);
      else if (vm.muzzle === 'comp') { cylZ(0.03, 0.03, 0.05, 0, 0.012, tipZ + 0.0, M.dark, 8); cylZ(0.035, 0.035, 0.018, 0, 0.012, tipZ - 0.03, M.dark, 8); }
      else if (vm.muzzle === 'brake') box(0.05, 0.05, 0.06, 0, 0.012, tipZ + 0.0, M.dark);
      if (vm.dot === 'red') {
        box(0.05, 0.045, 0.07, 0, 0.105, rz0, M.dark);
        box(0.014, 0.014, 0.014, 0, 0.108, rz0 + 0.02, glowMat2(0xff2a14));
      } else if (vm.dot === 'holo') {
        box(0.06, 0.05, 0.06, 0, 0.108, rz0, M.dark);
        box(0.036, 0.03, 0.006, 0, 0.112, rz0 + 0.028, glowMat2(0x33ff66));
      }
      if (vm.fgrip) box(0.03, 0.1, 0.04, 0, -0.06, bFront - hgLen / 2 + 0.01, furniture, -0.25);
      if (vm.ribs) for (var ri = 0; ri < 5; ri++) box(0.05, 0.012, 0.014, 0, 0.067, rz0 - rl / 2 + 0.05 + ri * 0.05, M.dark);
    }

    var tip = new THREE.Object3D();
    tip.position.set(0, 0.01, tipZ);
    g.add(tip);
    g.userData.tip = tip;
    g.userData.visualId = id;
    g.userData.fxColor = def.fxColor || 0xffcc77;
    return g;
  }

  /* -------------------------------------------------------------- core */
  W.init = function () {
    CFG = G.CFG;
    W.camoTex = makeCamoTexture();
    W.vmRoot = new THREE.Group();
    W.vmRoot.position.set(0.3, -0.28, -0.5);
    G.camera.add(W.vmRoot);
    W.flashLight = new THREE.PointLight(0xffcc77, 0, 8);
    G.scene.add(W.flashLight);
    // explosion-light POOL — added to the scene ONCE and only ever intensity-
    // driven afterward. Adding/removing a light at detonation time changes the
    // scene light count, which makes three.js recompile every lit material — a
    // hard frame hitch on each explosive / wonder-weapon shot. A fixed pool keeps
    // the light count constant so there are zero in-play recompiles.
    W.boomLights = [];
    for (var _bi = 0; _bi < 4; _bi++) { var _bl = new THREE.PointLight(0xffaa33, 0, 10); G.scene.add(_bl); W.boomLights.push(_bl); }
    W.boomIdx = 0;
    W.giveWeapon('m1911');
    document.addEventListener('mousedown', function (e) {
      if (e.button === 0 && document.pointerLockElement) { W.mouseDown = true; W.semiLatch = false; }
      if (e.button === 2 && document.pointerLockElement) W.adsHeld = true;
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 0) W.mouseDown = false;
      if (e.button === 2) W.adsHeld = false;
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  W.stats = function (gun) {
    var base = CFG.WEAPONS[gun.id];
    var s = {};
    Object.keys(base).forEach(function (k) { if (k !== 'pap' && k !== 'vm') s[k] = base[k]; });
    if (gun.papped) {
      // PaP defaults for anything the pap block doesn't override
      s.dmg = Math.round(s.dmg * 2.2);
      s.mag = Math.round(s.mag * 1.6);
      s.reserve = Math.round(s.reserve * 2);
      Object.keys(base.pap).forEach(function (k) { s[k] = base.pap[k]; });
    }
    if (gun.dpap) {
      // Double Pack-a-Punch: harder hits + a Dead-Wire electric proc (in fire)
      s.dmg = Math.round(s.dmg * 1.6);
      s.name = s.name + ' II';
    }
    if (gun.variant && CFG.PAP_VARIANTS[gun.variant]) {
      // tier-3 Ascension: the variant proc rides on top (small extra bite)
      s.dmg = Math.round(s.dmg * 1.15);
      s.name = s.name + ' — ' + CFG.PAP_VARIANTS[gun.variant].name;
    }
    if (gun.element)   // Kurhaus altar infusion
      s.name = s.name + ' [' + gun.element.charAt(0).toUpperCase() + gun.element.slice(1) + ']';
    if (gun.overclocked && gun.id === 'seelenmotor') {
      s.name = 'Seelenmotor Überdruck'; s.dmg = Math.max(s.dmg, 6500);
      s.mag = Math.max(s.mag, 6); s.reserve = Math.max(s.reserve, 24);
      s.pistonDur = 7; s.pistonWidth = 2.8; s.pistonRange = 22; s.superVariant = 'piston';
    } else if (gun.overclocked && gun.id === 'nachbildner115') {
      s.name = 'Nachbildner Paradox'; s.dmg = Math.max(s.dmg, 7200);
      s.mag = Math.max(s.mag, 4); s.reserve = Math.max(s.reserve, 20);
      s.imprintDur = 5.2; s.imprintRadius = 9; s.imprintCap = 24;
      s.paradoxPair = true; s.superVariant = 'replicator';
    }
    if (G.player.hasPerk('dtap')) { s.dmg *= 2; s.rpm *= 1.33; }
    return s;
  };

  W.current = function () { return W.slots[W.cur] || null; };
  W.hasWeapon = function (id) {
    return W.slots.some(function (s) { return s.id === id; });
  };

  W.giveWeapon = function (id) {
    var base = CFG.WEAPONS[id];
    var gun = { id: id, papped: false, dpap: false, ammo: base.mag, reserve: base.reserve, model: null };
    if (W.slots.length < W.maxSlots) {
      W.slots.push(gun);
      W.equip(W.slots.length - 1, true);
    } else {
      if (W.current() && W.current().model) {
        W.vmRoot.remove(W.current().model);
        disposeGunModel(W.current().model);
        W.current().model = null;
      }
      W.slots[W.cur] = gun;
      W.equip(W.cur, true);
    }
    G.hud.setAmmo();
  };

  // temporary power weapon (Death Machine drop): stash the loadout, wield an
  // infinite-ammo minigun, then restore on expiry
  W.givePowerWeapon = function (id) {
    if (!W.power) {
      W.power = { saved: W.slots, savedCur: W.cur };
      while (W.vmRoot.children.length) W.vmRoot.remove(W.vmRoot.children[0]);
    }
    var base = CFG.WEAPONS[id];
    var gun = { id: id, papped: false, dpap: false, ammo: base.mag, reserve: base.reserve, model: null, infinite: true };
    W.slots = [gun]; W.cur = 0;
    W.equip(0, true);
    G.hud.setAmmo();
  };
  W.revertPowerWeapon = function () {
    if (!W.power) return;
    W.slots.forEach(function (g) {
      if (g.model) { disposeGunModel(g.model); g.model = null; }
    });
    while (W.vmRoot.children.length) W.vmRoot.remove(W.vmRoot.children[0]);
    W.slots = W.power.saved; W.cur = Math.min(W.power.savedCur, W.slots.length - 1);
    W.power = null;
    W.equip(W.cur, true);
    G.hud.setAmmo();
  };

  W.dropExtraSlots = function () {
    while (W.slots.length > W.maxSlots) {
      var dropped = W.slots.pop();
      if (dropped && dropped.model) disposeGunModel(dropped.model);
    }
    if (W.cur >= W.slots.length) W.equip(0, true);
  };

  W.equip = function (i, instant) {
    if (i >= W.slots.length || (i === W.cur && !instant && W.slots[i].model)) return;
    W.reloading = 0;
    W.burstQueue = 0;
    W.burstCd = 0;
    W.cur = i;
    while (W.vmRoot.children.length) W.vmRoot.remove(W.vmRoot.children[0]);
    var gun = W.slots[i];
    var modelKey = [gun.id, !!gun.papped, !!gun.dpap, !!gun.overclocked].join('|');
    if (!gun.model || gun._modelKey !== modelKey) {
      if (gun.model) disposeGunModel(gun.model);
      gun.model = buildModel(gun.id, gun.papped, gun.dpap);
      gun._modelKey = modelKey;
      if (gun.overclocked) {
        var oc = gun.id === 'seelenmotor' ? 0x79ffe0 : 0xd8a6ff;
        var halo = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 18),
          new THREE.MeshBasicMaterial({ color: oc, transparent: true, opacity: 0.9 }));
        halo.position.set(0, 0.1, -0.3); halo.rotation.x = Math.PI / 2;
        gun.model.add(halo); gun.model.userData.overclockHalo = halo;
      }
    }
    W.vmRoot.add(gun.model);
    W.muzzle = gun.model.userData.tip;
    W.switching = instant ? 0 : 0.3;
    G.hud.setAmmo();
  };

  W.cycle = function (dir) {
    if (W.slots.length < 2) return;
    W.equip((W.cur + dir + W.slots.length) % W.slots.length);
  };

  // first call upgrades to PaP; a second call double-packs (Dead Wire tier).
  // Works on any gun still in the loadout (the PaP grab-offer may resolve after
  // you've moved away or switched weapons).
  W.papGun = function (gun) {
    if (!gun) return false;
    if (!gun.papped) gun.papped = true;
    else if (!gun.dpap) gun.dpap = true;
    else {
      // tier 3 — ASCENSION: roll one of the variants (re-roll always lands a
      // DIFFERENT one, so paying again is never a dud)
      var keys = Object.keys(CFG.PAP_VARIANTS).filter(function (k) { return k !== gun.variant; });
      gun.variant = keys[(Math.random() * keys.length) | 0];
      gun._variantKills = 0;
    }
    if (G.awardFeat) G.awardFeat('pap');
    var s = W.stats(gun);
    gun.ammo = s.mag;
    gun.reserve = s.reserve;
    if (gun === W.current()) W.equip(W.cur, true);
    return true;
  };

  // tier-3 variant procs — killZombie reports every player kill here; the proc
  // counts kills while the ascended gun is HELD and fires its payload on cadence
  W.variantKill = function (pos, opts) {
    var gun = null;
    if (opts && opts.weaponId) {
      gun = W.slots.filter(function (g) { return g.id === opts.weaponId; })[0] || null;
    } else gun = W.current();
    if (!gun || !gun.variant) return;
    var vdef = CFG.PAP_VARIANTS[gun.variant];
    if (!vdef) return;
    gun._variantKills = (gun._variantKills || 0) + 1;
    if (gun._variantKills < vdef.every) return;
    gun._variantKills = 0;
    if (gun.variant === 'starburst') {
      // a firework climbs from the kill and bursts over the horde
      var burst = new THREE.Vector3(pos.x, (pos.y || 0) + 3.2, pos.z);
      addLine(new THREE.Vector3(pos.x, (pos.y || 0) + 0.5, pos.z), burst, 0xffb84a, 0.12, 0.5);
      W.explode(burst, 900, 4.5, { color: 0xffb84a });
      poolFlash(burst, 0xff5aa2, 2.4, 14);
      G.audio.powerup();
    } else if (gun.variant === 'soulharvest') {
      G.player.addPoints(100);
      G.player.hp = Math.min(G.player.maxHp, G.player.hp + 20);
      G.hud.banner('SOUL HARVEST +100', '#8aff9a', 1.1);
      G.audio.buy();
    } else if (gun.variant === 'concussor') {
      // a concussive nova at the kill flings everything near it
      var c2 = new THREE.Vector3(pos.x, pos.y || 0, pos.z);
      poolFlash(new THREE.Vector3(c2.x, c2.y + 1.5, c2.z), 0x7ac8ff, 2.2, 12);
      G.zombies.list.slice().forEach(function (z2) {
        if (z2.dead || z2.state === 'flung') return;
        var to2 = z2.mesh.position.clone().sub(c2);
        if (to2.length() > 6) return;
        to2.y = 0; to2.normalize();
        G.zombies.fling(z2, to2, { weaponId: gun.id });
      });
      G.audio.thunder ? G.audio.thunder() : G.audio.powerup();
    }
  };
  W.papCurrent = function () { return W.papGun(W.current()); };

  W.maxAmmo = function () {
    W.slots.forEach(function (gun) {
      gun.reserve = W.stats(gun).reserve;
    });
    G.player.frags = CFG.MAX_FRAGS;
    if (G.player.hasMonkeys) G.player.monkeys = CFG.MAX_MONKEYS;
    G.hud.setAmmo();
  };

  W.refillCurrent = function () {
    var gun = W.current();
    if (!gun) return;
    gun.reserve = W.stats(gun).reserve;
    G.hud.setAmmo();
  };

  W.startReload = function () {
    var gun = W.current();
    if (!gun || W.reloading > 0 || W.knifing > 0) return;
    var s = W.stats(gun);
    if (gun.ammo >= s.mag || gun.reserve <= 0) return;
    W.reloading = s.reload * (G.player.hasPerk('speed') ? 0.5 : 1);
    W.reloadTotal = W.reloading;
    G.audio.reload();
    // Electric Cherry: reloading discharges a shock around you (stronger the
    // emptier the mag was)
    if (G.player.hasPerk('cherry')) {
      var charge = 1 - gun.ammo / Math.max(1, s.mag);
      W.boom(G.player.pos, 250 + 550 * charge, 4.2, 0x33ddff, { boom: true });
    }
  };

  function finishReload() {
    var gun = W.current();
    var s = W.stats(gun);
    var need = s.mag - gun.ammo;
    var take = Math.min(need, gun.reserve);
    gun.ammo += take;
    gun.reserve -= take;
    G.hud.setAmmo();
  }

  /* ------------------------------------------------------ blood particles */
  W.blood = function (pos, n) {
    if (W.particles.length > 50) return;
    for (var i = 0; i < (n || 5); i++) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05),
        gm('blood', { color: 0x7a0d0d, shininess: 5 }));
      m.position.copy(pos);
      m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5,
                                         (Math.random() - 0.5) * 3);
      m.userData.life = 0.45;
      G.scene.add(m);
      W.particles.push(m);
    }
  };

  /* -------------------------------------------------------------- firing */
  var _ray = new THREE.Raycaster();
  var _dir = new THREE.Vector3();

  // simple-aim mode (trackpads): nudge the shot toward the closest zombie
  // inside a small cone — bullet magnetism instead of ADS
  function aimAssist(dir) {
    if (!G.settings || G.settings.aimMode !== 'simple') return dir;
    var best = null, bestDot = Math.cos(8 * Math.PI / 180);
    G.zombies.list.forEach(function (z) {
      if (z.dead) return;
      var to = z.mesh.position.clone();
      to.y += 1.35; // chest center
      to.sub(G.camera.position);
      var dist = to.length();
      if (dist > 45) return;
      to.normalize();
      var dot = to.dot(dir);
      if (dot > bestDot) { bestDot = dot; best = to; }
    });
    if (best) dir.lerp(best, 0.65).normalize();
    return dir;
  }

  // pierce = how many zombies one round passes through (penetration). Each
  // pierced zombie is damaged through the normal path, so every penetration
  // kill awards hit + kill points just like a direct hit.
  function shootRay(spreadDeg, dmg, headMult, range, isKnife, pierce, source) {
    pierce = pierce || 1;
    _dir.set(0, 0, -1).applyEuler(G.camera.rotation);
    if (!isKnife) aimAssist(_dir);
    if (spreadDeg) {
      var sp = spreadDeg * Math.PI / 180;
      _dir.x += (Math.random() - 0.5) * sp;
      _dir.y += (Math.random() - 0.5) * sp;
      _dir.z += (Math.random() - 0.5) * sp * 0.3;
      _dir.normalize();
    }
    _ray.set(G.camera.position, _dir);
    _ray.far = isKnife ? 2.3 : 120;
    var curGun = W.current();
    var dpap = !isKnife && curGun && curGun.dpap;
    var targets = G.zombies.shootables().concat(G.map.solidMeshes);
    var hits = _ray.intersectObjects(targets, false);
    var end = G.camera.position.clone().addScaledVector(_dir, 60);
    var seen = [], hitAny = false, struck = 0;
    for (var h = 0; h < hits.length; h++) {
      var hit = hits[h];
      var z = hit.object.userData.zombie;
      if (!z) { end = hit.point; break; }          // solid wall stops the round
      if (z.dead || seen.indexOf(z) >= 0) continue; // a zombie has two hit parts
      seen.push(z);
      var isHead = hit.object.userData.part === 'head';
      var d = dmg * (isHead ? headMult : 1);
      if (range && hit.distance > range) d *= 0.3;
      G.audio.hitmark(isHead);
      G.hud.hitmarker();
      W.blood(hit.point, isHead ? 7 : 4);
      G.zombies.damageZombie(z, d, { head: isHead, knife: isKnife,
        weaponId: source && source.weaponId, shotId: source && source.shotId });
      if (!isKnife) W.applyElement(z, source);       // Kurhaus altar infusions proc per hit
      if (dpap && Math.random() < 0.3) deadWire(z, d, source);   // electric arc proc
      hitAny = true; end = hit.point;
      if (++struck >= pierce) break;                // round absorbed
    }
    if (!isKnife) spawnTracer(end);
    return hitAny;
  }

  // Dead Wire: a double-packed round chains electricity to nearby zombies
  function deadWire(from, d, source) {
    var origin = from.mesh.position;
    var near = [];
    for (var i = 0; i < G.zombies.list.length; i++) {
      var zz = G.zombies.list[i];
      if (zz === from || zz.dead) continue;
      var dist = zz.mesh.position.distanceTo(origin);
      if (dist < 5.0) near.push({ z: zz, dist: dist });
    }
    near.sort(function (a, b) { return a.dist - b.dist; });
    var a0 = origin.clone(); a0.y += 1.1;
    for (var k = 0; k < near.length && k < 3; k++) {
      var b0 = near[k].z.mesh.position.clone(); b0.y += 1.1;
      addLine(a0, b0, 0x9fe8ff, 0.13, 0.95);
      G.zombies.damageZombie(near[k].z, d, { boom: false,
        weaponId: source && source.weaponId, shotId: source && source.shotId });
    }
    if (near.length) G.audio.hitmark(false);
  }

  function disposeTracer(t) {
    if (!t || !t.mesh) return;
    G.scene.remove(t.mesh);
    if (t.dispose) {
      if (t.mesh.geometry && t.mesh.geometry.dispose) t.mesh.geometry.dispose();
      if (t.mesh.material && t.mesh.material.dispose) t.mesh.material.dispose();
    }
  }
  function pushTracer(t) {
    while (W.tracers.length >= 96) disposeTracer(W.tracers.shift());
    W.tracers.push(t);
  }
  function addLine(a, b, color, life, opacity) {
    var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity || 0.7
    }));
    G.scene.add(line);
    pushTracer({ mesh: line, life: life, dispose: true });
    return line;
  }

  // Small, bounded world-effect library shared by every wonder weapon. These
  // meshes are unlit, create no new PointLights, and expire quickly. Geometry
  // is shared; only the tiny fading materials are per effect.
  var fxRingGeo = null, fxSphereGeo = null;
  function fxOpacity(root, opacity) {
    root.traverse(function (o) {
      if (o.material && o.material.transparent) o.material.opacity = opacity;
    });
  }
  function addWeaponFx(mesh, life, opts) {
    opts = opts || {};
    while (W.weaponFx.length >= 72) {
      var old = W.weaponFx.shift();
      G.scene.remove(old.mesh);
      old.mesh.traverse(function (o) { if (o.material && o.material.dispose) o.material.dispose(); });
    }
    G.scene.add(mesh);
    W.weaponFx.push({ mesh: mesh, life: life, total: life, grow: opts.grow || 0,
      spin: opts.spin || 0, drift: opts.drift || null, baseOpacity: opts.opacity == null ? 0.82 : opts.opacity });
    return mesh;
  }
  function addPulseRing(pos, normal, color, radius, life, grow, opacity) {
    if (!fxRingGeo) fxRingGeo = new THREE.TorusGeometry(1, 0.045, 6, 28);
    var ring = new THREE.Mesh(fxRingGeo, new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity == null ? 0.82 : opacity,
      depthWrite: false, side: THREE.DoubleSide
    }));
    ring.position.copy(pos);
    ring.scale.setScalar(radius || 1);
    var n = normal.clone().normalize();
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    return addWeaponFx(ring, life || 0.28, { grow: grow || 0, opacity: opacity, spin: 2.5 });
  }
  function addCorona(pos, color, radius, life) {
    if (!fxSphereGeo) fxSphereGeo = new THREE.IcosahedronGeometry(1, 1);
    var shell = new THREE.Mesh(fxSphereGeo, new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0.72, wireframe: true, depthWrite: false
    }));
    shell.position.copy(pos); shell.scale.setScalar(radius || 0.5);
    return addWeaponFx(shell, life || 0.25, { grow: radius || 0.5, opacity: 0.72, spin: 3.5 });
  }
  function addJaggedLine(a, b, color, life, opacity, bends) {
    bends = bends || 5;
    var dir = b.clone().sub(a), len = dir.length() || 1;
    var flat = dir.clone().normalize();
    var side = new THREE.Vector3(-flat.z, 0, flat.x);
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    var up = new THREE.Vector3().crossVectors(flat, side).normalize();
    var pts = [a.clone()];
    for (var i = 1; i < bends; i++) {
      var t = i / bends;
      var amp = Math.min(0.38, len * 0.025) * Math.sin(t * Math.PI);
      pts.push(a.clone().lerp(b, t)
        .addScaledVector(side, (Math.random() - 0.5) * amp * 2)
        .addScaledVector(up, (Math.random() - 0.5) * amp));
    }
    pts.push(b.clone());
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity == null ? 0.9 : opacity
    }));
    G.scene.add(line); pushTracer({ mesh: line, life: life || 0.18, dispose: true });
    return line;
  }
  function makeArc(color, opacity, points) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((points || 7) * 3), 3));
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity == null ? 0.8 : opacity
    }));
    return line;
  }
  function updateArc(line, a, b, amp, phase) {
    var attr = line.geometry.attributes.position, count = attr.count;
    var dir = b.clone().sub(a), flat = dir.clone().normalize();
    var side = new THREE.Vector3(-flat.z, 0, flat.x);
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    for (var i = 0; i < count; i++) {
      var t = count <= 1 ? 0 : i / (count - 1);
      var p = a.clone().lerp(b, t);
      if (i > 0 && i < count - 1)
        p.addScaledVector(side, Math.sin(phase + i * 3.1) * amp * Math.sin(t * Math.PI))
         .add(new THREE.Vector3(0, Math.cos(phase * 1.3 + i * 2.7) * amp * 0.35, 0));
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
  }

  function spawnTracer(end) {
    var start = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                         : G.camera.position.clone();
    addLine(start, end, 0xffdd88, 0.07);
  }

  // shared area blast used by perks (PhD Slider, Electric Cherry, Widow's Wine),
  // buildable traps and bosses: AoE damage + a starburst flash + boom
  W.boom = function (pos, dmg, radius, color, opts) {
    color = color || 0xffaa55;
    opts = opts || {};
    if (opts.y == null) opts.y = pos.y || 0;   // explosions hit only their own floor
    G.zombies.aoe(pos, dmg, radius, opts);
    var c = new THREE.Vector3(pos.x, (pos.y || 0) + 0.4, pos.z);
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      addLine(c, new THREE.Vector3(c.x + Math.cos(a) * radius, c.y, c.z + Math.sin(a) * radius),
              color, 0.2, 0.85);
    }
    G.audio.explosion();
  };

  W.heartBurst = function (pos) {
    var c = new THREE.Vector3(pos.x, (pos.y || 0) + 0.8, pos.z);
    for (var i = 0; i < 16; i++) {
      var a = i / 16 * Math.PI * 2;
      addLine(c, new THREE.Vector3(c.x + Math.cos(a) * 18, c.y, c.z + Math.sin(a) * 18),
        0x79ffe0, 0.35, 0.9);
    }
    poolFlash(c, 0x79ffe0, 3.0, 20); G.audio.zap(); G.player.shake(0.6);
  };

  W.superKill = function (pos, opts) {
    if (!opts || opts.weaponId !== 'seelenmotor') return;
    var gun = W.slots.filter(function (slot) {
      return slot.id === 'seelenmotor' && slot.overclocked;
    })[0];
    if (!gun) return;
    gun.soulCharges = Math.min(3, (gun.soulCharges || 0) + 1);
  };

  function muzzleFlash(gun) {
    if (!W.muzzle) return;
    var p = W.muzzle.getWorldPosition(new THREE.Vector3());
    W.flashLight.position.copy(p);
    var wonderColor = gun && CFG.WEAPONS[gun.id] && CFG.WEAPONS[gun.id].fxColor
      ? CFG.WEAPONS[gun.id].fxColor : 0xffcc77;
    W.flashLight.color.setHex(wonderColor);
    W.flashLight.intensity = gun && CFG.WEAPONS[gun.id].wonder ? 3.4 : 2.5;
    W.flashTimer = 0.05;
  }

  function fire() {
    var gun = W.current();
    var s = W.stats(gun);
    if (gun.ammo <= 0) {
      G.audio.dryFire();
      W.startReload();
      W.fireCd = 0.25;
      return;
    }
    gun.ammo--;
    if (gun.infinite) { gun.ammo = s.mag; gun.reserve = s.reserve; }   // power weapon never runs dry
    W.fireCd = 60 / s.rpm;
    G.audio.shoot(s.cls, gun.papped, gun.id, gun.dpap);
    muzzleFlash(gun);
    var heavy = s.cls === 'shotgun' || s.cls === 'thunder' || s.cls === 'sniper' || s.cls === 'launcher';
    G.player.kick(heavy ? 1.6 : 0.45);
    if (gun.model) gun.model.position.z = heavy ? 0.1 : 0.06;
    G.hud.setAmmo();

    // akimbo (e.g. PaP'd Mustang & Sally) discharges both barrels on one trigger
    var barrels = s.akimbo ? 2 : 1;
    for (var b = 0; b < barrels; b++) discharge(gun, s);
  }

  // one barrel's worth of output: routes to the right projectile/hitscan path
  function discharge(gun, s) {
    var source = { weaponId: gun.id, element: gun.element || null, dpap: !!gun.dpap,
      shotId: ++W.shotSeq, fxColor: s.fxColor || 0xffcc77, overclocked: !!gun.overclocked };
    if (s.projectile === 'wind') { fireThunder(s, source); return; }
    if (s.projectile === 'chain') { fireWunderwaffe(s, source); return; }
    if (s.projectile === 'lance') { fireLance(s, source); return; }
    if (s.projectile === 'bore') { spawnProjectile('bore', s, source); return; }
    if (s.projectile === 'flare') { spawnProjectile('flare', s, source); return; }
    if (s.projectile === 'soulmine') { spawnProjectile('soulmine', s, source); return; }
    if (s.projectile === 'piston') { firePiston(s, gun, source); return; }
    if (s.projectile === 'imprint') { fireReplicator(s, gun, source); return; }
    if (s.projectile === 'rod') { fireRod(s, source); return; }
    if (s.projectile === 'kryolith') { fireKryolith(s, source); return; }
    if (s.projectile === 'siphon') { fireSiphon(s, source); return; }
    if (s.projectile === 'storm') { spawnProjectile('storm', s, source); return; }
    if (s.projectile === 'ray') { spawnProjectile('ray', s, source); return; }
    if (s.projectile === 'rocket') { spawnProjectile('rocket', s, source); return; }

    // ADS tightens spread, sprinting loosens it; simple-aim gets a flat bonus
    var spreadMult = (1 - 0.7 * G.player.ads) * (1 + 0.5 * G.player.sprintAmt);
    if (G.settings && G.settings.aimMode === 'simple') spreadMult *= 0.55;
    if (G.player.hasPerk('deadshot')) spreadMult *= 0.5;   // Deadshot Daiquiri: steadier aim
    // penetration: high-power rounds punch through a line of zombies (each
    // pierced kill is scored normally). PaP'd guns pierce one extra.
    var pierce = ({ rifle: 2, lmg: 3, sniper: 5, minigun: 2 }[s.cls] || 1) + (gun.papped ? 1 : 0);
    var pellets = s.pellets || 1;
    for (var i = 0; i < pellets; i++) {
      shootRay(s.spread * spreadMult, s.dmg, s.head * (G.player.hasPerk('deadshot') ? 1.5 : 1),
        s.range, false, pierce, source);
    }
  }

  function fireThunder(s, source) {
    G.player.shake(0.8);
    var fwd = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    fwd.y = 0; fwd.normalize();
    var reach = lineReach(G.camera.position, fwd, 14);
    var muzzle = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3()) : G.camera.position.clone();
    for (var wr = 0; wr < 4; wr++) {
      var wd = Math.min(reach, 2.2 + wr * 3.1);
      if (wd <= 0.5) continue;
      addPulseRing(muzzle.clone().addScaledVector(fwd, wd), fwd, source.fxColor,
        0.55 + wd * 0.12, 0.22 + wr * 0.035, 0.95 + wr * 0.2, 0.55);
    }
    addCorona(muzzle.clone().addScaledVector(fwd, Math.min(reach, 1.4)), source.fxColor, 0.5, 0.2);
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead || z.state === 'flung') return;
      var to = z.mesh.position.clone().sub(G.player.pos);
      var dist = to.length();
      if (dist > reach || Math.abs(z.mesh.position.y - G.player.pos.y) > 2.5) return;
      to.normalize();
      var toFlat = to.clone(); toFlat.y = 0; toFlat.normalize();
      if (fwd.dot(toFlat) < Math.cos(35 * Math.PI / 180)) return;
      if (G.map.losBlocked && G.map.losBlocked(G.player.pos.x, G.player.pos.z,
          z.mesh.position.x, z.mesh.position.z, G.player.pos.y + 1.1)) return;
      addCorona(z.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0)), source.fxColor, 0.42, 0.2);
      W.applyElement(z, source);
      if (z.questBoss && !z.questArmorBroken) {
        G.zombies.damageZombie(z, 0, {
          weaponId: source.weaponId, shotId: source.shotId
        });
        return;
      }
      G.zombies.fling(z, toFlat, source);
    });
  }

  /* ---------------------- elemental infusions (Kurhaus altar rites) -------
     A gun carries at most one element (gun.element), swapped at will at any
     ignited altar. Procs land per bullet hit:
       molten  30%  ignite — a burn that ticks for 2s
       frozen 100%  chill  — webbed-speed slow for 1.2s (stacks with nothing)
       drowned 20%  scald  — a steam burst scalds everything around the target
       grave   20%  shatter— the legs give out (crawler chance) + rot damage  */
  W.applyElement = function (z, source) {
    var gun = W.current();
    var el = source ? source.element : (gun && gun.element);
    if (!el || !z || z.dead) return;
    var p = z.mesh.position;
    if (el === 'molten') {
      if (Math.random() < 0.3) {
        z.burnT = 2; z.burnDps = 240; z.burnSource = source || null;
        poolFlash(new THREE.Vector3(p.x, p.y + 1.2, p.z), 0xff6a1e, 1.1, 6);
      }
    } else if (el === 'frozen') {
      z.slowT = Math.max(z.slowT || 0, 1.2);
    } else if (el === 'drowned') {
      if (Math.random() < 0.2) {
        G.zombies.aoe({ x: p.x, z: p.z }, 220, 2.6, {
          y: p.y,
          weaponId: source && source.weaponId,
          shotId: source && source.shotId
        });
        poolFlash(new THREE.Vector3(p.x, p.y + 1.4, p.z), 0x3fd0c8, 1.2, 7);
      }
    } else if (el === 'grave') {
      if (Math.random() < 0.2) G.zombies.damageZombie(z, 120, {
        boom: true, crawlers: true,
        weaponId: source && source.weaponId,
        shotId: source && source.shotId
      });
    }
  };

  /* ------------------------------------------- aether lance (line pierce) */
  // The founder's weapon: a thrown line of aether that SKEWERS every zombie
  // along its path — no chaining, no vortex; pure impalement down a corridor.
  function fireLance(s, source) {
    G.player.shake(0.6);
    _dir.set(0, 0, -1).applyEuler(G.camera.rotation);
    aimAssist(_dir);
    // the lance stops at the first wall
    _ray.set(G.camera.position, _dir);
    _ray.far = s.lanceRange || 45;
    var wallHits = _ray.intersectObjects(G.map.solidMeshes, false);
    var reach = wallHits.length ? wallHits[0].distance : (s.lanceRange || 45);
    var start = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                         : G.camera.position.clone();
    var end = G.camera.position.clone().addScaledVector(_dir, reach);
    // skewer EVERYTHING within pierceRadius of the line
    var pr = s.pierceRadius || 1.3, skewered = 0;
    var _v = new THREE.Vector3();
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead) return;
      _v.copy(z.mesh.position); _v.y += 1.2;
      _v.sub(G.camera.position);
      var t = _v.dot(_dir);
      if (t < 0 || t > reach) return;
      var perp2 = _v.lengthSq() - t * t;
      if (perp2 > pr * pr) return;
      skewered++;
      G.zombies.damageZombie(z, s.dmg, { boom: true,
        weaponId: source.weaponId, shotId: source.shotId });
      W.applyElement(z, source);            // an infused lance carries its element down the line
      addCorona(z.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), source.fxColor, 0.38, 0.2);
    });
    addLine(start, end, 0x9b62df, 0.28, 0.82);         // the aether shaft
    addJaggedLine(start, end, 0xf0e8ff, 0.15, 0.95, 5); // white-hot living core
    addPulseRing(end, _dir, source.fxColor, 0.35, 0.24, 0.9, 0.75);
    poolFlash(end, 0xb790ff, 1.6, 8);
    G.audio.lanceFire();
    if (skewered) G.hud.hitmarker(true);
  }

  // Quest-only wonder weapons deliberately use different spatial verbs: a
  // crushing lane, delayed echoes, a player-drawn fence, a launched frozen
  // body and a close-range life drain. None reuse the map's box wonder.
  function lineReach(origin, dir, range) {
    _ray.set(origin, dir); _ray.far = range;
    var wh = _ray.intersectObjects(G.map.solidMeshes, false);
    return wh.length ? wh[0].distance : range;
  }
  function damageLine(origin, dir, range, width, dmg, color, weaponId, source) {
    var reach = lineReach(origin, dir, range), end = origin.clone().addScaledVector(dir, reach);
    addLine(origin, end, color, Math.max(0.08, width * 0.12), 0.8);
    var hit = false, v = new THREE.Vector3();
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead || Math.abs(z.mesh.position.y - origin.y) > 2.5) return;
      v.copy(z.mesh.position).sub(origin); var t = v.x * dir.x + v.z * dir.z;
      if (t < 0 || t > reach) return;
      var qx = origin.x + dir.x * t, qz = origin.z + dir.z * t;
      if (Math.hypot(z.mesh.position.x - qx, z.mesh.position.z - qz) > width) return;
      hit = true; G.zombies.damageZombie(z, dmg, { boom: true, crawlers: true,
        weaponId: weaponId, shotId: source && source.shotId });
      W.applyElement(z, source);
    });
    if (hit) G.hud.hitmarker(true);
  }
  function reportOverclockShot(gun, dir, range) {
    if (G.interact && G.interact.onWonderFire)
      G.interact.onWonderFire(gun.id, G.camera.position.clone(), dir.clone(), range);
  }
  function firePiston(s, gun, source) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); dir.y = 0; dir.normalize();
    var reach = lineReach(G.camera.position, dir, s.pistonRange);
    reportOverclockShot(gun, dir, reach);
    var pressureStart = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3()) : G.camera.position.clone();
    poolFlash(pressureStart, 0x9fe8ff, 1.35, 8);
    var charges = gun.overclocked ? (gun.soulCharges || 0) : 0;
    if (charges) { gun.soulCharges = 0; G.hud.banner('SOUL PRESSURE ×' + charges, '#79ffe0', 1.2); }
    W.eeHazards.push({ type: 'piston', pos: G.player.pos.clone(), dir: dir,
      t: s.pistonDur, tick: 0, dmg: s.dmg * (1 + charges * 0.4), width: s.pistonWidth,
      range: reach, weaponId: gun.id, source: source, super: !!gun.overclocked, gateT: 0 });
    var left = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(s.pistonWidth);
    addLine(pressureStart.clone().add(left), pressureStart.clone().add(left).addScaledVector(dir, reach),
      0x79ffe0, 0.5, 0.7);
    addLine(pressureStart.clone().sub(left), pressureStart.clone().sub(left).addScaledVector(dir, reach),
      0x79ffe0, 0.5, 0.7);
    G.hud.banner(gun.overclocked ? 'ÜBERDRUCK ASSEMBLY LINE' : 'SOUL ASSEMBLY LINE', '#9fe8ff', 1.2);
  }
  function fireReplicator(s, gun, source) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); dir.y = 0; dir.normalize();
    var questReach = lineReach(G.camera.position, dir, 45);
    reportOverclockShot(gun, dir, questReach);
    var active = W.imprints.filter(function (im) {
      return im.phase === 'record' && im.source && im.source.weaponId === gun.id;
    })[0];
    if (active) {
      active.phase = 'collapse'; active.collapseT = 0; active.collapseIndex = active.marked.length - 1;
      G.hud.banner(gun.overclocked ? 'PARADOX COLLAPSE' : 'IMPRINT COLLAPSE',
        '#d8a6ff', 1.2, active.marked.length + ' afterimages replaying');
      return;
    }
    source.paradoxPair = !!s.paradoxPair;
    spawnProjectile('imprint', s, source);
    G.hud.banner(gun.overclocked ? 'PARADOX CORES DEPLOYED' : 'IMPRINT CORE DEPLOYED',
      '#c582ff', 1.2, 'Record the horde — fire again to collapse');
  }
  function createRodMesh(p, color) {
    var grp = new THREE.Group();
    var metal = new THREE.MeshPhongMaterial({ color: 0x27343d, shininess: 65,
      specular: new THREE.Color(0x8aa6b2) });
    var glow = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.15, 8), metal);
    shaft.position.y = 0.58; grp.add(shaft);
    for (var i = 0; i < 3; i++) {
      var ins = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 6, 12), glow);
      ins.rotation.x = Math.PI / 2; ins.position.y = 0.38 + i * 0.24; grp.add(ins);
    }
    var tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), glow);
    tip.position.y = 1.24; grp.add(tip);
    grp.position.copy(p); G.scene.add(grp);
    return grp;
  }
  function removeRodMesh(r) {
    if (!r || !r.mesh) return;
    G.scene.remove(r.mesh);
    r.mesh.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
    r.mesh = null;
  }
  function fireRod(s, source) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); dir.y = 0; dir.normalize();
    var reach = lineReach(G.camera.position, dir, 16);
    // Keep the fence authored by the player instead of automatically pinning
    // every rod to a far wall. A bounded throw also prevents a rod from being
    // planted just inside wall geometry, which made otherwise clear links fail.
    // A short, repeatable throw is easier to author into a useful fence than
    // two rods unpredictably pinning themselves to distant room geometry.
    var maxPlantDist = Math.min(4.5, Math.max(0.5, reach - 0.25));
    var playerFloor = G.map.supportAt(G.player.pos.x, G.player.pos.z, G.player.pos.y, 0.65);
    var plantDist = 0.5, plantY = playerFloor;
    for (var pd = 0.5; pd <= maxPlantDist; pd += 0.2) {
      var px = G.camera.position.x + dir.x * pd, pz = G.camera.position.z + dir.z * pd;
      var py = G.map.supportAt(px, pz, playerFloor, 0.65);
      var cr = CFG.worldToCell(px, pz), cell = G.map.cellAt(cr.col, cr.row, playerFloor);
      if (!cell || cell.type === 'void' || Math.abs(py - playerFloor) > 0.8 ||
          (G.map.bodyBlocked && G.map.bodyBlocked(px, pz, py))) break;
      plantDist = pd; plantY = py;
    }
    var p = G.camera.position.clone().addScaledVector(dir, plantDist);
    p.y = plantY;
    var rod = { pos: p, dmg: s.dmg, t: s.rodDur, radius: s.rodRadius,
      source: source, mesh: createRodMesh(p, source.fxColor) };
    W.rods.push(rod);
    poolFlash(new THREE.Vector3(p.x, p.y + 0.8, p.z), 0x66ddff, 1.4, 8);
    if (W.rods.length >= 2) {
      var b = W.rods.pop(), a = W.rods.pop();
      var dist = a.pos.distanceTo(b.pos), sameFloor = Math.abs(a.pos.y - b.pos.y) <= 2.2;
      var d = b.pos.clone().sub(a.pos); d.y = 0; var flatDist = d.length(); if (flatDist) d.normalize();
      var clear = sameFloor && flatDist >= 2 && flatDist <= 20 &&
        lineReach(a.pos.clone().add(new THREE.Vector3(0, 0.75, 0)), d, flatDist) >= flatDist - 0.35 &&
        (!G.map.losBlocked || !G.map.losBlocked(a.pos.x, a.pos.z, b.pos.x, b.pos.z,
          (a.pos.y + b.pos.y) * 0.5));
      if (!clear) {
        removeRodMesh(a);
        W.rods.push(b);
        G.hud.banner('FENCE LINK BLOCKED', '#ff8a6a', 1.4, 'Keep both rods in one clear room');
        return;
      }
      var arcs = [];
      for (var ar = 0; ar < 3; ar++) {
        var arc = makeArc(source.fxColor, 0.7 - ar * 0.12, 8);
        G.scene.add(arc); arcs.push(arc);
      }
      W.eeHazards.push({ type: 'fence', a: a.pos, b: b.pos, t: s.rodDur,
        tick: 0, arcTimer: 0, arcs: arcs, nodes: [a, b],
        dmg: s.dmg, width: s.rodRadius, source: source });
      G.hud.banner('LIGHTNING FENCE ACTIVE', '#66ddff', 1.5, dist.toFixed(0) + 'm circuit');
    } else G.hud.banner('FIRST ROD PLANTED', '#66ddff', 1.2, 'Place the second rod');
  }
  function freezeZombie(z) {
    if (z.wwIceShell) return;
    var shell = new THREE.Group();
    var ice = new THREE.MeshBasicMaterial({
      color: 0xbfefff, transparent: true, opacity: 0.34,
      wireframe: true, depthWrite: false
    });
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.4, 1.5, 8), ice);
    torso.position.y = 0.95; shell.add(torso);
    var crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), ice);
    crown.position.y = 1.75; shell.add(crown);
    z.mesh.add(shell); z.wwIceShell = shell;
  }
  function thawZombie(z) {
    if (!z) return;
    z.wwFrozen = false;
    if (z.wwIceShell) {
      z.mesh.remove(z.wwIceShell);
      z.wwIceShell.traverse(function (o) {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        if (o.material && o.material.dispose) o.material.dispose();
      });
      z.wwIceShell = null;
    }
  }
  W.thawFrozen = thawZombie;
  function fireKryolith(s, source) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); aimAssist(dir);
    _ray.set(G.camera.position, dir); _ray.far = 45;
    var hits = _ray.intersectObjects(G.zombies.shootables().concat(G.map.solidMeshes), false);
    var z = null;
    var end = G.camera.position.clone().addScaledVector(dir, 45);
    for (var i = 0; i < hits.length; i++) {
      end.copy(hits[i].point);
      if (!hits[i].object.userData.zombie) break;
      z = hits[i].object.userData.zombie; if (!z.dead) break;
    }
    var start = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3()) : G.camera.position.clone();
    addJaggedLine(start, end, source.fxColor, 0.22, 0.92, 4);
    addPulseRing(end, dir, source.fxColor, 0.24, 0.22, 0.5, 0.65);
    if (!z || z.dead) return;
    if (!z.wwFrozen) {
      z.wwFrozen = true; z.wwFrozenT = 9;
      freezeZombie(z);
      W.applyElement(z, source);
      poolFlash(z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xbfefff, 1.4, 7);
      addCorona(z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), source.fxColor, 0.75, 0.45);
      G.hud.hitmarker(true);
    } else if (!W.iceSlides.some(function (slide) { return slide.z === z; })) {
      z.wwFrozenT = 3;
      var flat = dir.clone(); flat.y = 0; flat.normalize();
      W.iceSlides.push({ z: z, dir: flat, speed: s.iceSpeed, dmg: s.dmg,
        radius: s.iceRadius, t: 2.5, hit: [], source: source, trailT: 0 });
    }
  }
  function fireSiphon(s, source) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); aimAssist(dir);
    _ray.set(G.camera.position, dir); _ray.far = 18;
    var hits = _ray.intersectObjects(G.zombies.shootables().concat(G.map.solidMeshes), false);
    var first = null;
    for (var i = 0; i < hits.length; i++) {
      if (!hits[i].object.userData.zombie) break;
      if (!hits[i].object.userData.zombie.dead) { first = hits[i].object.userData.zombie; break; }
    }
    if (!first) return;
    var targets = [first];
    G.zombies.list.forEach(function (z) {
      if (targets.length >= s.siphonTargets || z.dead || z === first) return;
      if (Math.abs(z.mesh.position.y - first.mesh.position.y) > 2.2) return;
      if (z.mesh.position.distanceTo(first.mesh.position) >= 4) return;
      if (G.map.losBlocked && G.map.losBlocked(first.mesh.position.x, first.mesh.position.z,
          z.mesh.position.x, z.mesh.position.z, first.mesh.position.y + 1.1)) return;
      targets.push(z);
    });
    var start = W.muzzle.getWorldPosition(new THREE.Vector3());
    var healed = 0;
    targets.forEach(function (z) {
      var end = z.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      addJaggedLine(start, end, 0x173b32, 0.18, 0.8, 4);
      addJaggedLine(end, start, source.fxColor, 0.24, 0.95, 5);
      var hpBefore = z.hp;
      G.zombies.damageZombie(z, s.dmg, { boom: true,
        weaponId: source.weaponId, shotId: source.shotId });
      W.applyElement(z, source);
      if (z.hp < hpBefore) healed += s.siphonHeal;
      addCorona(end, source.fxColor, 0.28, 0.18);
    });
    if (healed > 0) {
      G.player.hp = Math.min(G.player.maxHp, G.player.hp + healed);
      poolFlash(G.player.pos.clone().add(new THREE.Vector3(0, 1, 0)), source.fxColor, 0.65, 5);
      G.hud.hitmarker(true);
    }
  }

  /* --------------------------------------------- wunderwaffe (chain bolt) */
  function fireWunderwaffe(s, source) {
    G.player.shake(0.5);
    _dir.set(0, 0, -1).applyEuler(G.camera.rotation);
    aimAssist(_dir);
    _ray.set(G.camera.position, _dir);
    _ray.far = 90;
    var targets = G.zombies.shootables().concat(G.map.solidMeshes);
    var hits = _ray.intersectObjects(targets, false);
    var end = hits.length ? hits[0].point
                          : G.camera.position.clone().addScaledVector(_dir, 50);
    var start = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                         : G.camera.position.clone();
    addJaggedLine(start, end, 0x72dfff, 0.28, 0.98, 7);
    addLine(start, end, 0xf1ffff, 0.09, 0.96);
    poolFlash(start, 0x88eeff, 1.55, 9);
    G.audio.zap();
    var first = hits.length && hits[0].object.userData.zombie
      ? hits[0].object.userData.zombie : null;
    if (!first || first.dead) return;
    var chained = [{ z: first, parent: null }];
    var pool = G.zombies.list.filter(function (z) { return !z.dead && z !== first; });
    while (chained.length < (s.chain || 10)) {
      var bestZ = null, bestParent = null, bd = 1e9;
      for (var i = 0; i < pool.length; i++) {
        var z = pool[i];
        if (chained.some(function (n) { return n.z === z; }) || z.dead) continue;
        for (var j = 0; j < chained.length; j++) {
          var parent = chained[j].z;
          if (Math.abs(z.mesh.position.y - parent.mesh.position.y) > 2.2) continue;
          var d = z.mesh.position.distanceTo(parent.mesh.position);
          if (d >= (s.chainRadius || 5.5) || d >= bd) continue;
          if (G.map.losBlocked && G.map.losBlocked(parent.mesh.position.x, parent.mesh.position.z,
              z.mesh.position.x, z.mesh.position.z, parent.mesh.position.y + 1.1)) continue;
          bd = d; bestZ = z; bestParent = parent;
        }
      }
      if (!bestZ) break;
      chained.push({ z: bestZ, parent: bestParent });
    }
    for (var k = 0; k < chained.length; k++) {
      var node = chained[k], target = node.z;
      if (node.parent) {
        var a = node.parent.mesh.position.clone(); a.y += 1.3;
        var b = target.mesh.position.clone(); b.y += 1.3;
        addJaggedLine(a, b, 0x88eeff, 0.32, 0.95, 5);
      }
      addCorona(target.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), source.fxColor, 0.42, 0.22);
      // The DG-2 remains a true lethal chain wonder at arbitrarily high
      // rounds; its balance lever is ammunition and chain count, not HP falloff.
      G.zombies.damageZombie(target, 1e9, { boom: true,
        weaponId: source.weaponId, shotId: source.shotId });
      W.applyElement(target, source);
    }
    G.hud.hitmarker(true);
  }

  /* --------------------------- Nachbildner 115 imprint replicator ---------
     A physical core records bodies which cross its field. The second trigger
     (or the timer) collapses those afterimages in reverse order. Paradox uses
     two linked cores, turning a route between them into the recording volume. */
  function createImprintNode(pos, radius, color) {
    var grp = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0.78, depthWrite: false
    });
    var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat);
    core.position.y = 0.72; grp.add(core);
    var halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 18), mat.clone());
    halo.position.y = 0.72; halo.rotation.x = Math.PI / 2; grp.add(halo);
    var field = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.055, 6, 36), mat.clone());
    field.rotation.x = Math.PI / 2; field.position.y = 0.06; field.material.opacity = 0.36;
    grp.add(field); grp.position.copy(pos); G.scene.add(grp);
    return { mesh: grp, core: core, halo: halo, field: field, pos: pos.clone() };
  }
  function removeImprint(im) {
    (im.marked || []).forEach(function (m) {
      if (m.ring) {
        G.scene.remove(m.ring);
        if (m.ring.geometry) m.ring.geometry.dispose();
        if (m.ring.material) m.ring.material.dispose();
      }
    });
    (im.nodes || []).forEach(function (n) {
      G.scene.remove(n.mesh);
      n.mesh.traverse(function (o) {
        if (o.material && o.material.dispose) o.material.dispose();
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      });
    });
    (im.links || []).forEach(function (l) {
      G.scene.remove(l); if (l.geometry) l.geometry.dispose(); if (l.material) l.material.dispose();
    });
  }
  function spawnImprintField(pos, o) {
    var floorY = G.map.supportAt(pos.x, pos.z, pos.y, 0);
    var center = new THREE.Vector3(pos.x, floorY, pos.z);
    var centers = [center], dir = o.dir.clone(); dir.y = 0; dir.normalize();
    if (o.pair) {
      var back = dir.clone().multiplyScalar(-1);
      var start = center.clone().addScaledVector(back, 0.35); start.y += 0.75;
      var gap = Math.min(6, lineReach(start, back, 6));
      if (gap > 2.5) centers.push(new THREE.Vector3(
        center.x + back.x * gap, floorY, center.z + back.z * gap));
    }
    var nodes = centers.map(function (c) {
      return createImprintNode(c, o.radius, o.source.fxColor || 0xc582ff);
    });
    var links = [];
    if (nodes.length === 2) {
      for (var li = 0; li < 2; li++) {
        var link = makeArc(o.source.fxColor || 0xc582ff, 0.58 - li * 0.15, 8);
        updateArc(link, nodes[0].pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
          nodes[1].pos.clone().add(new THREE.Vector3(0, 0.72, 0)), 0.16 + li * 0.08, li);
        G.scene.add(link); links.push(link);
      }
    }
    W.imprints.push({ nodes: nodes, links: links, marked: [], source: o.source,
      dmg: o.dmg, radius: o.radius, cap: o.cap, t: o.dur, scanT: 0,
      phase: 'record', collapseT: 0, collapseIndex: -1 });
    nodes.forEach(function (n) {
      addCorona(n.pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
        o.source.fxColor || 0xc582ff, 0.65, 0.35);
    });
  }
  function updateImprints(dt) {
    for (var ii = W.imprints.length - 1; ii >= 0; ii--) {
      var im = W.imprints[ii];
      im.nodes.forEach(function (n, ni) {
        n.core.rotation.y += dt * (2.2 + ni * 0.6);
        n.halo.rotation.z -= dt * (1.8 + ni * 0.4);
        var pulse = 1 + Math.sin(G.time * 4 + ni) * 0.08;
        n.field.scale.set(pulse, pulse, pulse);
      });
      im.links.forEach(function (l, li) {
        if (((G.time * 12) | 0) % 2 === 0)
          updateArc(l, im.nodes[0].pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
            im.nodes[1].pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
            0.15 + li * 0.08, G.time * 8 + li);
      });
      im.marked.forEach(function (m) {
        if (m.ring && m.z && !m.z.dead) {
          m.ring.position.copy(m.z.mesh.position); m.ring.position.y += 1.05;
          m.ring.rotation.z += dt * 2.5;
        }
      });
      if (im.phase === 'record') {
        im.t -= dt; im.scanT -= dt;
        if (im.scanT <= 0) {
          im.scanT = 0.08;
          G.zombies.list.forEach(function (z) {
            if (z.dead || im.marked.length >= im.cap ||
                im.marked.some(function (m) { return m.z === z; })) return;
            var node = null;
            for (var ni = 0; ni < im.nodes.length; ni++) {
              var n = im.nodes[ni];
              if (Math.abs(z.mesh.position.y - n.pos.y) > 2.2) continue;
              if (Math.hypot(z.mesh.position.x - n.pos.x, z.mesh.position.z - n.pos.z) > im.radius) continue;
              if (G.map.losBlocked && G.map.losBlocked(n.pos.x, n.pos.z,
                  z.mesh.position.x, z.mesh.position.z, n.pos.y + 0.8)) continue;
              node = n; break;
            }
            if (!node) return;
            var ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 16),
              new THREE.MeshBasicMaterial({ color: im.source.fxColor || 0xc582ff,
                transparent: true, opacity: 0.72, depthWrite: false }));
            ring.rotation.x = Math.PI / 2; G.scene.add(ring);
            im.marked.push({ z: z, ring: ring, node: node });
            addJaggedLine(node.pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
              z.mesh.position.clone().add(new THREE.Vector3(0, 1.05, 0)),
              im.source.fxColor || 0xc582ff, 0.22, 0.78, 4);
          });
        }
        if (im.t <= 0) {
          im.phase = 'collapse'; im.collapseT = 0; im.collapseIndex = im.marked.length - 1;
        }
      } else {
        im.collapseT -= dt;
        if (im.collapseT <= 0 && im.collapseIndex >= 0) {
          im.collapseT = 0.13;
          var mark = im.marked[im.collapseIndex--];
          if (mark.ring) {
            G.scene.remove(mark.ring);
            if (mark.ring.geometry) mark.ring.geometry.dispose();
            if (mark.ring.material) mark.ring.material.dispose();
            mark.ring = null;
          }
          if (mark.z && !mark.z.dead) {
            var zp = mark.z.mesh.position.clone();
            addJaggedLine(mark.node.pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
              zp.clone().add(new THREE.Vector3(0, 1.05, 0)),
              0xf1ddff, 0.26, 0.95, 5);
            addCorona(zp.clone().add(new THREE.Vector3(0, 1.0, 0)),
              im.source.fxColor || 0xc582ff, 0.36, 0.18);
            W.explode(zp, im.dmg, 2.25, {
              color: im.source.fxColor || 0xc582ff, source: im.source, y: zp.y,
              silent: true, noShake: true, noFlash: true, noWorldBoom: true
            });
          }
        }
        if (im.collapseIndex < 0 && im.collapseT <= 0) {
          im.nodes.forEach(function (n) {
            addCorona(n.pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
              im.source.fxColor || 0xc582ff, 0.9, 0.34);
            poolFlash(n.pos.clone().add(new THREE.Vector3(0, 0.72, 0)),
              im.source.fxColor || 0xc582ff, 1.4, 8);
          });
          G.audio.replicaCollapse();
          G.player.shake(0.25);
          removeImprint(im); W.imprints.splice(ii, 1);
        }
      }
    }
  }

  /* -------------------------------------------- storm vortex (Wettermacher) */
  function spawnVortex(pos, opts) {
    var grp = new THREE.Group();
    var coneMat = new THREE.MeshBasicMaterial({
      color: 0x66ccff, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false
    });
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(opts.storm.radius * 0.55, 5, 12, 1, true), coneMat);
    cone.position.y = 2.5;
    grp.add(cone);
    var inner = new THREE.Mesh(
      new THREE.ConeGeometry(opts.storm.radius * 0.28, 4.4, 10, 1, true),
      coneMat.clone());
    inner.material.opacity = 0.45;
    inner.position.y = 2.2;
    grp.add(inner);
    var bands = [];
    for (var bi = 0; bi < 3; bi++) {
      var band = new THREE.Mesh(
        new THREE.TorusGeometry(opts.storm.radius * (0.22 + bi * 0.1), 0.045, 5, 22),
        new THREE.MeshBasicMaterial({ color: 0x9eeeff, transparent: true,
          opacity: 0.48 - bi * 0.08, depthWrite: false }));
      band.rotation.x = Math.PI / 2; band.position.y = 1.0 + bi * 1.3;
      grp.add(band); bands.push(band);
    }
    // plant the vortex on the floor it detonated over (supportAt -> 0 on flat
    // maps) instead of the hardcoded base plane, so the storm works on every floor
    var fy = G.map.supportAt(pos.x, pos.z, pos.y, 0);
    grp.position.set(pos.x, fy, pos.z);
    G.scene.add(grp);
    // a pooled flash at spawn instead of a persistent PointLight on the group:
    // adding/removing the group's light each storm forced a shader recompile. The
    // cones are unlit MeshBasicMaterial, so the vortex still reads as glowing.
    poolFlash(new THREE.Vector3(pos.x, fy + 2, pos.z), 0x88ddff, 2.2, opts.storm.radius * 3);
    G.audio.vortex();
    W.vortices.push({
      mesh: grp, cone: cone, inner: inner, bands: bands, source: opts.storm.source || opts.source,
      t: opts.storm.dur, radius: opts.storm.radius, dmg: opts.dmg, tick: 0
    });
  }

  function updateVortices(dt) {
    for (var i = W.vortices.length - 1; i >= 0; i--) {
      var v = W.vortices[i];
      v.t -= dt;
      v.cone.rotation.y += dt * 7;
      v.inner.rotation.y -= dt * 11;
      v.bands.forEach(function (band, bi) {
        band.rotation.z += dt * (3 + bi * 1.6) * (bi & 1 ? -1 : 1);
        band.scale.setScalar(0.92 + Math.sin(G.time * 4 + bi) * 0.08);
      });
      v.cone.material.opacity = 0.22 + Math.random() * 0.12;  // flicker (was the light)
      G.zombies.list.forEach(function (z) {
        if (z.dead || (z.state !== 'chase' && z.state !== 'attack')) return;
        if (Math.abs(z.mesh.position.y - v.mesh.position.y) > 2.5) return;  // own floor only
        var dx = v.mesh.position.x - z.mesh.position.x;
        var dz = v.mesh.position.z - z.mesh.position.z;
        var d = Math.hypot(dx, dz);
        if (d > v.radius * 1.5 || d < 0.3) return;
        var pnx = z.mesh.position.x + dx / d * dt * 4;
        var pnz = z.mesh.position.z + dz / d * dt * 4;
        if (!G.map.bodyBlocked || !G.map.bodyBlocked(pnx, pnz, z.mesh.position.y + 0.2)) {
          z.mesh.position.x = pnx; z.mesh.position.z = pnz;
        }
      });
      v.tick -= dt;
      if (v.tick <= 0) {
        v.tick = 0.45;
        G.audio.vortexTick();
        G.zombies.list.slice().forEach(function (z) {
          if (z.dead) return;
          // confine to the vortex's own floor (floors are 4 apart) so it doesn't
          // bleed damage through the ceiling/floor to the level above or below
          if (Math.abs(z.mesh.position.y - v.mesh.position.y) > 2.5) return;
          var d = z.mesh.position.distanceTo(v.mesh.position);
          if (d < v.radius) {
            if (G.map.losBlocked && G.map.losBlocked(v.mesh.position.x, v.mesh.position.z,
                z.mesh.position.x, z.mesh.position.z, v.mesh.position.y + 1.0)) return;
            var a = v.mesh.position.clone(); a.y += 4.5;
            var b = z.mesh.position.clone(); b.y += 1.3;
            addJaggedLine(a, b, 0xaaeeff, 0.18, 0.9, 5);
            G.zombies.damageZombie(z, v.dmg, { boom: true,
              weaponId: v.source && v.source.weaponId, shotId: v.source && v.source.shotId });
            W.applyElement(z, v.source);
          }
        });
      }
      if (v.t <= 0) {
        G.scene.remove(v.mesh);
        v.mesh.traverse(function (o) {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
        W.vortices.splice(i, 1);
      }
    }
  }

  /* --------------------------------------------------------- projectiles */
  function spawnProjectile(type, s, source) {
    source = source || {};
    var pos = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                       : G.camera.position.clone();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    aimAssist(dir);
    var mesh, vel, opts;
    if (type === 'ray') {
      var rayCol = source.fxColor || 0x52ff73;
      mesh = new THREE.Group();
      var rayCore = new THREE.Mesh(new THREE.SphereGeometry(source.weaponId === 'raygun2' ? 0.075 : 0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: rayCol }));
      if (source.weaponId === 'raygun2') rayCore.scale.z = 2.4;
      mesh.add(rayCore);
      for (var rh = 0; rh < 2; rh++) {
        var halo = new THREE.Mesh(new THREE.TorusGeometry(0.14 + rh * 0.06, 0.018, 5, 12),
          new THREE.MeshBasicMaterial({ color: rayCol, transparent: true, opacity: 0.7 - rh * 0.18 }));
        mesh.add(halo);
      }
      vel = dir.multiplyScalar(source.weaponId === 'raygun2' ? 48 : 38);
      opts = { dmg: s.dmg, radius: source.weaponId === 'raygun2' ? 1.8 : 2.5,
        gravity: 0, fuse: 3, color: rayCol, source: source, trailColor: rayCol };
    } else if (type === 'rocket') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
      vel = dir.multiplyScalar(26).add(new THREE.Vector3(0, 1.5, 0));
      opts = { dmg: s.dmg, radius: 4, gravity: 5, fuse: 4, color: 0xffaa33,
        crawlers: true, source: source };
    } else if (type === 'storm') {
      mesh = new THREE.Group();
      var stormOrb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshBasicMaterial({ color: source.fxColor || 0x66ccff }));
      mesh.add(stormOrb);
      for (var sh = 0; sh < 2; sh++) {
        var stormHalo = new THREE.Mesh(new THREE.TorusGeometry(0.22 + sh * 0.08, 0.018, 5, 14),
          new THREE.MeshBasicMaterial({ color: 0xb7f1ff, transparent: true, opacity: 0.58 }));
        stormHalo.rotation.x = sh ? Math.PI / 2 : 0; mesh.add(stormHalo);
      }
      vel = dir.multiplyScalar(24).add(new THREE.Vector3(0, 0.5, 0));
      opts = { dmg: s.dmg, radius: 2.5, gravity: 1.5, fuse: 3, color: 0x66ccff,
               source: source, trailColor: source.fxColor,
               storm: { dur: s.stormDur, radius: s.stormRadius, source: source } };
    } else if (type === 'bore') {
      // A razor-thin pressure wheel: no blast, no pull, no lightning. It keeps
      // its energy through bodies and rebounds from the room shell.
      mesh = new THREE.Group();
      var boreMat = new THREE.MeshBasicMaterial({ color: source.fxColor || 0xc78cff,
        transparent: true, opacity: 0.94 });
      var boreDisk = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 7, 20), boreMat);
      boreDisk.rotation.x = Math.PI / 2; mesh.add(boreDisk);
      for (var bs = 0; bs < 4; bs++) {
        var boreSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.38), boreMat);
        boreSpoke.rotation.y = bs * Math.PI / 4; mesh.add(boreSpoke);
      }
      var boreCore = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf1ddff }));
      mesh.add(boreCore);
      vel = dir.multiplyScalar(s.boreSpeed || 38);
      opts = { dmg: s.dmg, radius: 0, gravity: 0, fuse: s.boreLife || 2.8,
               color: source.fxColor || 0xc78cff, bounces: s.boreBounces || 3,
               source: source, trailColor: source.fxColor };
    } else if (type === 'flare') {
      mesh = new THREE.Group();
      var flareBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.24, 8),
        new THREE.MeshBasicMaterial({ color: 0xff5522 }));
      flareBody.rotation.x = Math.PI / 2; mesh.add(flareBody);
      var flareTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 7),
        new THREE.MeshBasicMaterial({ color: 0xffc06b }));
      flareTip.position.z = -0.12; mesh.add(flareTip);
      vel = dir.multiplyScalar(15).add(new THREE.Vector3(0, 2.2, 0));
      opts = { dmg: s.dmg, radius: 4.5, gravity: 7, fuse: 99, color: 0xff5522,
               bounce: true, flareDur: s.flareDur, flareRadius: s.flareRadius,
               source: source, trailColor: source.fxColor };
    } else if (type === 'soulmine') {
      mesh = new THREE.Group();
      var mineBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.1, 10),
        new THREE.MeshLambertMaterial({ color: 0x384633, emissive: 0x273311 }));
      mesh.add(mineBase);
      var segments = [];
      for (var ms = 0; ms < s.mineNeed; ms++) {
        var msa = ms / s.mineNeed * Math.PI * 2;
        var seg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.04),
          new THREE.MeshBasicMaterial({ color: 0x263326 }));
        seg.position.set(Math.cos(msa) * 0.14, 0.07, Math.sin(msa) * 0.14);
        seg.rotation.y = -msa; mesh.add(seg); segments.push(seg);
      }
      vel = dir.multiplyScalar(12).add(new THREE.Vector3(0, 3.0, 0));
      opts = { dmg: s.dmg, radius: s.mineRadius, gravity: 9, fuse: 99, color: 0x9cff72,
               bounce: true, mineNeed: s.mineNeed, chargeSegments: segments, source: source };
    } else if (type === 'imprint') {
      mesh = new THREE.Group();
      var imprintMat = new THREE.MeshBasicMaterial({
        color: source.fxColor || 0xc582ff, transparent: true, opacity: 0.9
      });
      var imprintCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), imprintMat);
      mesh.add(imprintCore);
      for (var ir = 0; ir < 2; ir++) {
        var imprintRing = new THREE.Mesh(new THREE.TorusGeometry(0.24 + ir * 0.08, 0.018, 5, 14), imprintMat);
        imprintRing.rotation.x = ir ? Math.PI / 2 : 0; mesh.add(imprintRing);
      }
      vel = dir.multiplyScalar(17).add(new THREE.Vector3(0, 0.4, 0));
      opts = { dmg: 0, radius: 0, gravity: 0.8, fuse: 3.5,
        color: source.fxColor || 0xc582ff, source: source, trailColor: source.fxColor,
        imprint: { dmg: s.dmg, dur: s.imprintDur, radius: s.imprintRadius,
          cap: s.imprintCap, pair: !!s.paradoxPair, dir: dir.clone(), source: source } };
    }
    mesh.position.copy(pos);
    G.scene.add(mesh);
    W.projectiles.push({ type: type, mesh: mesh, vel: vel, t: 0, trailT: 0, opts: opts, hit: [] });
  }

  W.throwFrag = function () {
    if (G.player.frags <= 0 || W.knifing > 0) return;
    G.player.frags--;
    G.audio.throwSwish();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
      G.util.mat(0x3a4a36));
    mesh.position.copy(G.camera.position).addScaledVector(dir, 0.4);
    G.scene.add(mesh);
    W.projectiles.push({
      type: 'frag', mesh: mesh,
      vel: dir.multiplyScalar(13).add(new THREE.Vector3(0, 3.5, 0)),
      t: 0, opts: { dmg: CFG.GRENADE_DMG, radius: CFG.GRENADE_RADIUS, gravity: 9.8, fuse: 3, color: 0xffaa33, crawlers: true, bounce: true, selfDmg: true }
    });
    G.hud.setAmmo();
  };

  W.throwMonkey = function () {
    if (!G.player.hasMonkeys || G.player.monkeys <= 0 || W.knifing > 0) return;
    G.player.monkeys--;
    G.audio.throwSwish();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    var mesh = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.14), G.util.mat(0x7a5230));
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), G.util.mat(0x8a6240));
    head.position.y = 0.18; mesh.add(body); mesh.add(head);
    mesh.position.copy(G.camera.position).addScaledVector(dir, 0.4);
    G.scene.add(mesh);
    W.projectiles.push({
      type: 'monkey', mesh: mesh,
      vel: dir.multiplyScalar(11).add(new THREE.Vector3(0, 3.5, 0)),
      t: 0, opts: { dmg: CFG.MONKEY_DMG, radius: CFG.MONKEY_RADIUS, gravity: 9.8, fuse: 99, color: 0xffdd55, bounce: true }
    });
    G.hud.setAmmo();
  };

  function pointBlocked(x, y, z, r) {
    var cols = G.map.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (!c.on) continue;
      if (y < c.y1 - 0.1 || y > c.y2 + 0.1) continue;   // only collide at the projectile's height
      if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return c;
    }
    return null;
  }
  function sweepWorld(from, to, radius) {
    var dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 0.1));
    var safe = from.clone(), floorH = G.map.supportAt(from.x, from.z, from.y, 0);
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var p = new THREE.Vector3(from.x + dx * t, from.y + dy * t, from.z + dz * t);
      floorH = G.map.supportAt(p.x, p.z, p.y, 0);
      var wall = pointBlocked(p.x, p.y, p.z, radius || 0.1);
      var floor = p.y <= floorH + (radius || 0.1);
      if (wall || floor) return { pos: safe, wall: wall, floor: floor, floorH: floorH, impact: p };
      safe.copy(p);
    }
    return { pos: to.clone(), wall: null, floor: false, floorH: floorH, impact: to.clone() };
  }
  function sweptZombie(from, to, radius) {
    var dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    var len2 = dx * dx + dy * dy + dz * dz;
    var best = null, bestT = 2;
    G.zombies.list.forEach(function (z) {
      if (z.dead) return;
      var chest = z.mesh.position.clone(); chest.y += 1.05;
      var t = len2 > 0.0001
        ? ((chest.x - from.x) * dx + (chest.y - from.y) * dy + (chest.z - from.z) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      var cx = from.x + dx * t, cy = from.y + dy * t, cz = from.z + dz * t;
      var horiz = Math.hypot(chest.x - cx, chest.z - cz);
      if (horiz <= radius && cy > z.mesh.position.y - 0.3 && cy < z.mesh.position.y + 2.4 && t < bestT) {
        best = z; bestT = t;
      }
    });
    return best ? {
      z: best,
      t: bestT,
      pos: from.clone().lerp(to, bestT)
    } : null;
  }

  // light a transient flash from the pool (no scene add/remove -> no recompile)
  function poolFlash(pos, color, intensity, dist) {
    var L = W.boomLights[W.boomIdx]; W.boomIdx = (W.boomIdx + 1) % W.boomLights.length;
    L.position.copy(pos); L.color.setHex(color); L.intensity = intensity; L.distance = dist;
    W.flashes.push({ mesh: L, life: 0.22, isLight: true, pooled: true });
  }

  W.explode = function (pos, dmg, radius, opts) {
    opts = opts || {};
    if (!opts.silent) G.audio.explosion();
    if (!opts.noShake) G.player.shake(0.7);
    if (!opts.noFlash) {
      var flash = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 12, 12),
        new THREE.MeshBasicMaterial({ color: opts.color || 0xffaa33, transparent: true, opacity: 0.85 }));
      flash.position.copy(pos);
      G.scene.add(flash);
      W.flashes.push({ mesh: flash, life: 0.22 });
      poolFlash(pos, opts.color || 0xffaa33, 3, radius * 4);
      addPulseRing(new THREE.Vector3(pos.x, (pos.y || 0) + 0.12, pos.z),
        new THREE.Vector3(0, 1, 0), opts.color || 0xffaa33,
        Math.max(0.35, radius * 0.22), 0.28, radius * 0.75, 0.72);
    }
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead || z === opts.ignore) return;
      if (Math.abs(z.mesh.position.y - (opts.y == null ? pos.y : opts.y)) > 2.5) return;
      var d = Math.hypot(z.mesh.position.x - pos.x, z.mesh.position.z - pos.z);
      if (d > radius) return;
      if (opts.los !== false && G.map.losBlocked &&
          G.map.losBlocked(pos.x, pos.z, z.mesh.position.x, z.mesh.position.z, (pos.y || 0) + 0.5)) return;
      var fall = 1 - 0.6 * (d / radius);
      W.blood(z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 3);
      G.zombies.damageZombie(z, dmg * fall, { boom: true, crawlers: opts.crawlers,
        weaponId: opts.source && opts.source.weaponId, shotId: opts.source && opts.source.shotId });
      W.applyElement(z, opts.source);
    });
    // the world reacts to blasts too (quest: cracking the Cellar's bricked arch)
    if (!opts.noWorldBoom && G.interact && G.interact.onBoom) G.interact.onBoom(pos);
    if (opts.selfDmg) {
      var pd = G.player.pos.distanceTo(pos);
      if (pd < radius * 0.8) G.player.damage(Math.round(45 * (1 - pd / radius)));
    }
  };

  function updateProjectiles(dt) {
    for (var i = W.projectiles.length - 1; i >= 0; i--) {
      var p = W.projectiles[i];
      p.t += dt;
      p.vel.y -= (p.opts.gravity || 0) * dt;
      var nx = p.mesh.position.x + p.vel.x * dt;
      var ny = p.mesh.position.y + p.vel.y * dt;
      var nz = p.mesh.position.z + p.vel.z * dt;
      // floor under the projectile at its CURRENT height — not the hardcoded
      // base plane. On a stacked map this lets a grenade land/bounce/detonate on
      // Floor B (-4) or Floor 2 (+4); supportAt returns 0 on flat maps, so legacy
      // behaviour is unchanged.
      var floorH = G.map.supportAt(nx, nz, ny, 0);
      var hitWall = pointBlocked(nx, ny, nz, 0.1);
      var hitFloor = ny <= floorH + 0.1;
      var detonate = false;
      var fromPos = p.mesh.position.clone();
      if (p.type !== 'bore') {
        var swept = sweepWorld(fromPos, new THREE.Vector3(nx, ny, nz), 0.1);
        nx = swept.pos.x; ny = swept.pos.y; nz = swept.pos.z;
        floorH = swept.floorH; hitWall = swept.wall; hitFloor = swept.floor;
        if (hitWall || hitFloor) p.mesh.position.set(nx, ny, nz);
      }
      p.trailT = (p.trailT || 0) - dt;
      if (p.opts.trailColor && !p.landed && p.trailT <= 0) {
        p.trailT = p.type === 'bore' ? 0.035 : 0.07;
        var trailDir = p.vel.clone().normalize();
        addPulseRing(p.mesh.position.clone(), trailDir, p.opts.trailColor,
          p.type === 'bore' ? 0.2 : 0.12, 0.18, 0.24, 0.45);
      }
      if (p.mesh.children && p.mesh.children.length) {
        if (p.type === 'bore') p.mesh.rotation.y += dt * 20;
        else p.mesh.rotation.z += dt * 5;
      }

      if (p.type === 'bore') {
        // The bore is fast enough to cross a thin wall between rendered
        // frames. Sweep the whole travelled segment in small increments so a
        // ricochet can never tunnel through architecture. Keep the last clear
        // point for both the bounce and the zombie hit test below.
        var ox = p.mesh.position.x, oy = p.mesh.position.y, oz = p.mesh.position.z;
        var dx = nx - ox, dy = ny - oy, dz = nz - oz;
        var sweepSteps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 0.1));
        var wallX = nx, wallY = ny, wallZ = nz;
        var safeX = ox, safeY = oy, safeZ = oz;
        hitWall = false; hitFloor = false;
        for (var ss = 1; ss <= sweepSteps; ss++) {
          var st = ss / sweepSteps;
          var sx = ox + dx * st, sy = oy + dy * st, sz = oz + dz * st;
          var sweepFloor = G.map.supportAt(sx, sz, sy, 0);
          var sweepWall = pointBlocked(sx, sy, sz, 0.1);
          if (sweepWall || sy <= sweepFloor + 0.1) {
            wallX = sx; wallY = sy; wallZ = sz;
            hitWall = !!sweepWall;
            hitFloor = sy <= sweepFloor + 0.1;
            floorH = sweepFloor;
            break;
          }
          safeX = sx; safeY = sy; safeZ = sz;
        }
        nx = safeX; ny = safeY; nz = safeZ;
        p.mesh.position.set(nx, ny, nz);

        // Sweep through zombie body columns as well. Otherwise a disk that can
        // no longer cross walls could still skip a zombie between two frames.
        var segDX = nx - ox, segDY = ny - oy, segDZ = nz - oz;
        var segLen2 = segDX * segDX + segDZ * segDZ;
        for (var bz = 0; bz < G.zombies.list.length; bz++) {
          var boreZ = G.zombies.list[bz];
          if (boreZ.dead || p.hit.indexOf(boreZ) >= 0) continue;
          var bp = boreZ.mesh.position;
          var along = segLen2 > 0.0001
            ? ((bp.x - ox) * segDX + (bp.z - oz) * segDZ) / segLen2 : 0;
          along = Math.max(0, Math.min(1, along));
          var contactX = ox + segDX * along;
          var contactY = oy + segDY * along;
          var contactZ = oz + segDZ * along;
          if (Math.hypot(bp.x - contactX, bp.z - contactZ) < 0.95 &&
              contactY > bp.y - 0.3 && contactY < bp.y + 2.4) {
            p.hit.push(boreZ);
            G.zombies.damageZombie(boreZ, p.opts.dmg, { boom: true,
              weaponId: p.opts.source && p.opts.source.weaponId,
              shotId: p.opts.source && p.opts.source.shotId });
            W.applyElement(boreZ, p.opts.source);
            addCorona(boreZ.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
              p.opts.color, 0.34, 0.18);
            G.hud.hitmarker(true);
          }
        }

        if (hitWall || hitFloor) {
          p.opts.bounces--;
          if (p.opts.bounces < 0) detonate = true;
          else {
            // Probe all three axes independently for a stable reflection.
            // Ceiling slabs are ordinary colliders, so a vertical probe is
            // essential; treating them as horizontal walls leaves an upward
            // disk pinned under the roof until it burns every bounce.
            if (hitFloor) p.vel.y = Math.abs(p.vel.y || 1);
            if (hitWall) {
              var blockX = pointBlocked(wallX, safeY, safeZ, 0.1);
              var blockY = !hitFloor && pointBlocked(safeX, wallY, safeZ, 0.1);
              var blockZ = pointBlocked(safeX, safeY, wallZ, 0.1);
              if (blockY) p.vel.y *= -1;
              // A pure floor/ceiling hit must preserve horizontal momentum.
              // At a wall/roof edge, reflect every blocked component.
              if (blockX || blockZ || (!blockY && !hitFloor)) {
                if (blockX || !blockZ) p.vel.x *= -1;
                if (blockZ || !blockX) p.vel.z *= -1;
              }
            }
            poolFlash(p.mesh.position, p.opts.color, 0.55, 4);
            addPulseRing(p.mesh.position.clone(), p.vel.clone().normalize(), p.opts.color,
              0.28, 0.2, 0.5, 0.66);
          }
        }
      } else

      if (p.type === 'flare' && p.landed) {
        if (p.stuckZ && !p.stuckZ.dead) {
          p.mesh.position.copy(p.stuckZ.mesh.position); p.mesh.position.y += 1.0;
        }
        if (!p.lureRing) {
          p.lureRing = new THREE.Mesh(new THREE.TorusGeometry(p.opts.flareRadius, 0.06, 6, 40),
            new THREE.MeshBasicMaterial({ color: 0xff5b2e, transparent: true, opacity: 0.34, depthWrite: false }));
          p.lureRing.rotation.x = Math.PI / 2; G.scene.add(p.lureRing);
        }
        p.lureRing.position.copy(p.mesh.position); p.lureRing.position.y = p.mesh.position.y + 0.04;
        var lurePulse = 1 + Math.sin(G.time * 5.5) * 0.045;
        p.lureRing.scale.set(lurePulse, lurePulse, lurePulse);
        p.lure -= dt;
        G.zombies.lure = { pos: p.mesh.position, proj: p, radius: p.opts.flareRadius };
        if (Math.floor(p.lure * 3) !== Math.floor((p.lure + dt) * 3))
          poolFlash(p.mesh.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff5522, 1.0, p.opts.flareRadius);
        if (p.lure <= 0) detonate = true;
      } else if (p.type === 'soulmine' && p.landed) {
        var standing = 0;
        G.zombies.list.forEach(function (mz) {
          if (!mz.dead && Math.abs(mz.mesh.position.y - p.mesh.position.y) < 2.2 &&
              Math.hypot(mz.mesh.position.x - p.mesh.position.x, mz.mesh.position.z - p.mesh.position.z) < p.opts.radius &&
              (!G.map.losBlocked || !G.map.losBlocked(p.mesh.position.x, p.mesh.position.z,
                mz.mesh.position.x, mz.mesh.position.z, p.mesh.position.y + 0.5)))
            standing++;
        });
        if (p.opts.chargeSegments) p.opts.chargeSegments.forEach(function (seg, si) {
          seg.material.color.setHex(si < standing ? 0x9cff72 : 0x263326);
        });
        if (standing !== p._standing) {
          p._standing = standing;
          addPulseRing(p.mesh.position.clone().add(new THREE.Vector3(0, 0.05, 0)),
            new THREE.Vector3(0, 1, 0), 0x9cff72, 0.28 + standing * 0.04, 0.2, 0.35, 0.48);
        }
        if (standing >= p.opts.mineNeed) detonate = true;
      } else if (p.type === 'monkey' && p.landed) {
        p.lure -= dt;
        if (Math.floor(p.lure * 2) !== Math.floor((p.lure + dt) * 2)) G.audio.monkeyJingle();
        if (p.lure <= 0) detonate = true;
      } else if (p.type === 'flare' && (hitWall || hitFloor)) {
        p.landed = true; p.lure = p.opts.flareDur; p.vel.set(0, 0, 0);
        if (hitFloor) p.mesh.position.y = floorH + 0.1;
      } else if (hitWall || hitFloor) {
        if (p.opts.bounce) {
          if (hitFloor && Math.abs(p.vel.y) < 1.2) {
            p.mesh.position.y = floorH + 0.1;
            p.vel.set(0, 0, 0);
            if ((p.type === 'monkey' || p.type === 'flare' || p.type === 'soulmine') && !p.landed) {
              p.landed = true;
              p.lure = p.type === 'flare' ? p.opts.flareDur : 3.2;
              if (p.type === 'monkey') {
                G.audio.monkeyJingle();
                G.zombies.lure = { pos: p.mesh.position.clone(), proj: p };
              }
            }
          } else {
            if (hitFloor) { p.mesh.position.y = floorH + 0.12; p.vel.y *= -0.4; p.vel.x *= 0.6; p.vel.z *= 0.6; }
            if (hitWall) { p.vel.x *= -0.4; p.vel.z *= -0.4; }
          }
        } else detonate = true;
      } else {
        p.mesh.position.set(nx, ny, nz);
      }

      if (!detonate && (p.type === 'ray' || p.type === 'rocket' || p.type === 'storm' ||
          p.type === 'imprint')) {
        // Sweep the full travelled segment, so a fast plasma/storm/imprint orb
        // cannot pass between frames without touching a zombie.
        var sweptHit = sweptZombie(fromPos, p.mesh.position, 0.85);
        if (sweptHit) {
          p.mesh.position.copy(sweptHit.pos);
          detonate = true;
        }
      }
      if (!detonate && p.type === 'flare' && !p.landed) {
        var flareHit = sweptZombie(fromPos, p.mesh.position, 0.8);
        if (flareHit) {
          p.mesh.position.copy(flareHit.pos);
          p.landed = true; p.stuckZ = flareHit.z; p.lure = p.opts.flareDur; p.vel.set(0, 0, 0);
        }
      }
      if (p.t > p.opts.fuse) detonate = true;

      if (detonate) {
        if ((p.type === 'monkey' || p.type === 'flare') && G.zombies.lure && G.zombies.lure.proj === p) G.zombies.lure = null;
        if (p.lureRing) {
          G.scene.remove(p.lureRing);
          if (p.lureRing.geometry) p.lureRing.geometry.dispose();
          if (p.lureRing.material) p.lureRing.material.dispose();
        }
        if (p.opts.imprint) spawnImprintField(p.mesh.position, p.opts.imprint);
        else if (p.type === 'bore') poolFlash(p.mesh.position, p.opts.color, 0.75, 5);
        else if (p.opts.storm) spawnVortex(p.mesh.position, p.opts);
        else W.explode(p.mesh.position, p.opts.dmg, p.opts.radius, p.opts);
        G.scene.remove(p.mesh);
        p.mesh.traverse(function (o) {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
        W.projectiles.splice(i, 1);
      }
    }
  }

  function updateEeHazards(dt) {
    for (var ri = W.rods.length - 1; ri >= 0; ri--) {
      var loose = W.rods[ri]; loose.t -= dt;
      if (loose.mesh) {
        loose.mesh.rotation.y += dt * 0.7;
        var tip = loose.mesh.children[loose.mesh.children.length - 1];
        if (tip) tip.scale.setScalar(1 + Math.sin(G.time * 7) * 0.12);
      }
      if (loose.t <= 0) {
        addCorona(loose.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 0x66ddff, 0.4, 0.22);
        removeRodMesh(loose); W.rods.splice(ri, 1);
      }
    }
    for (var i = W.eeHazards.length - 1; i >= 0; i--) {
      var h = W.eeHazards[i]; h.t -= dt; h.tick -= dt;
      if (h.type === 'piston' && h.tick <= 0) {
        h.tick = 0.48;
        damageLine(h.pos, h.dir, h.range, h.width, h.dmg, 0x9fe8ff, h.weaponId, h.source);
        h.gateT = ((h.gateT || 0) + 3.4) % Math.max(3.5, h.range);
        var gatePos = h.pos.clone().add(new THREE.Vector3(0, 1.05, 0)).addScaledVector(h.dir, h.gateT);
        addPulseRing(gatePos, h.dir, 0x79ffe0, Math.max(0.55, h.width * 0.72),
          0.38, h.width * 0.35, 0.68);
        G.player.shake(0.18);
      } else if (h.type === 'fence') {
        h.arcTimer -= dt;
        if (h.arcTimer <= 0) {
          h.arcTimer = 0.075;
          h.arcs.forEach(function (arc, ai) {
            updateArc(arc, h.a.clone().add(new THREE.Vector3(0, 0.48 + ai * 0.25, 0)),
              h.b.clone().add(new THREE.Vector3(0, 0.48 + ai * 0.25, 0)),
              0.14 + ai * 0.07, G.time * 12 + ai * 1.7);
            arc.material.opacity = 0.55 + Math.random() * 0.35;
          });
        }
        if (h.tick <= 0) {
          h.tick = 0.4;
          var dx = h.b.x - h.a.x, dz = h.b.z - h.a.z, len2 = dx * dx + dz * dz;
          G.zombies.list.slice().forEach(function (z) {
            if (z.dead || Math.abs(z.mesh.position.y - h.a.y) > 2.2) return;
            var q = len2 ? ((z.mesh.position.x - h.a.x) * dx + (z.mesh.position.z - h.a.z) * dz) / len2 : 0;
            q = Math.max(0, Math.min(1, q));
            if (Math.hypot(z.mesh.position.x - (h.a.x + dx * q), z.mesh.position.z - (h.a.z + dz * q)) <= h.width) {
              G.zombies.damageZombie(z, h.dmg, { boom: true,
                weaponId: h.source && h.source.weaponId, shotId: h.source && h.source.shotId });
              W.applyElement(z, h.source);
              z.slowT = Math.max(z.slowT || 0, 0.8);
            }
          });
        }
      }
      if (h.t <= 0) {
        if (h.type === 'fence') {
          h.arcs.forEach(function (arc) {
            G.scene.remove(arc); if (arc.geometry) arc.geometry.dispose(); if (arc.material) arc.material.dispose();
          });
          h.nodes.forEach(removeRodMesh);
        }
        W.eeHazards.splice(i, 1);
      }
    }

    for (var j = W.iceSlides.length - 1; j >= 0; j--) {
      var s = W.iceSlides[j], iz = s.z; s.t -= dt;
      if (!iz || iz.dead) { if (iz) thawZombie(iz); W.iceSlides.splice(j, 1); continue; }
      var oldX = iz.mesh.position.x, oldZ = iz.mesh.position.z;
      var nx = iz.mesh.position.x + s.dir.x * s.speed * dt;
      var nz = iz.mesh.position.z + s.dir.z * s.speed * dt;
      var slideFrom = new THREE.Vector3(oldX, iz.mesh.position.y + 0.8, oldZ);
      var slideTo = new THREE.Vector3(nx, iz.mesh.position.y + 0.8, nz);
      var slideSweep = sweepWorld(slideFrom, slideTo, 0.42);
      if (slideSweep.wall || slideSweep.floor || s.t <= 0) {
        var shatter = iz.mesh.position.clone();
        thawZombie(iz);
        G.zombies.damageZombie(iz, s.dmg, { boom: true,
          weaponId: s.source && s.source.weaponId, shotId: s.source && s.source.shotId });
        W.explode(shatter, s.dmg, s.radius + 1.2, {
          color: 0xbfefff, source: s.source, ignore: iz, y: shatter.y
        });
        addCorona(shatter.clone().add(new THREE.Vector3(0, 0.9, 0)), 0xbfefff, 1.0, 0.35);
        W.iceSlides.splice(j, 1); continue;
      }
      iz.mesh.position.x = nx; iz.mesh.position.z = nz;
      s.trailT -= dt;
      if (s.trailT <= 0) {
        s.trailT = 0.06;
        addPulseRing(new THREE.Vector3(nx, iz.mesh.position.y + 0.08, nz),
          new THREE.Vector3(0, 1, 0), 0xbfefff, 0.28, 0.28, 0.5, 0.42);
      }
      G.zombies.list.slice().forEach(function (other) {
        if (other.dead || other === iz || s.hit.indexOf(other) >= 0) return;
        if (Math.abs(other.mesh.position.y - iz.mesh.position.y) > 2.2) return;
        var segX = nx - oldX, segZ = nz - oldZ, segLen2 = segX * segX + segZ * segZ;
        var q = segLen2 ? ((other.mesh.position.x - oldX) * segX +
          (other.mesh.position.z - oldZ) * segZ) / segLen2 : 0;
        q = Math.max(0, Math.min(1, q));
        if (Math.hypot(other.mesh.position.x - (oldX + segX * q),
            other.mesh.position.z - (oldZ + segZ * q)) < s.radius) {
          s.hit.push(other);
          G.zombies.damageZombie(other, s.dmg, { boom: true, crawlers: true,
            weaponId: s.source && s.source.weaponId, shotId: s.source && s.source.shotId });
          W.applyElement(other, s.source);
          addCorona(other.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xbfefff, 0.45, 0.2);
        }
      });
    }
  }

  /* --------------------------------------------------------------- knife */
  W.knife = function () {
    if (W.knifing > 0 || W.reloading > 0) return;
    W.knifing = 0.45;
    G.audio.knife();
    setTimeout(function () {
      if (G.state !== 'playing') return;
      if (shootRay(0, CFG.KNIFE_DMG, 1, null, true)) G.audio.knifeHit();
    }, 120);
  };

  /* -------------------------------------------------------------- update */
  W.update = function (dt) {
    var gun = W.current();
    if (W.fireCd > 0) W.fireCd -= dt;
    if (W.switching > 0) W.switching -= dt;
    if (W.knifing > 0) W.knifing -= dt;
    if (W.flashTimer > 0) {
      W.flashTimer -= dt;
      if (W.flashTimer <= 0) W.flashLight.intensity = 0;
    }
    W.camoTex.offset.x += dt * 0.13;
    W.camoTex.offset.y += dt * 0.05;

    if (W.reloading > 0) {
      W.reloading -= dt;
      if (W.reloading <= 0) finishReload();
    }

    // burst processor: drives the extra rounds of a PaP burst weapon, spaced
    // tighter than the base fire rate and independent of the trigger
    var canShoot = G.state === 'playing' && !G.player.downed && !G.player.locked &&
                   gun && W.reloading <= 0 && W.switching <= 0 && W.knifing <= 0;
    if (W.burstQueue > 0) {
      W.burstCd -= dt;
      if (W.burstCd <= 0 && canShoot) {
        if (gun.ammo > 0) { fire(); W.burstQueue--; W.burstCd = 0.075; }
        else W.burstQueue = 0;
      }
    }

    // trigger (mouse OR gamepad RT; sprint must ramp out first — sprint-out delay)
    var firing = W.mouseDown || (G.gamepad && G.gamepad.fire) || (G.remote && G.remote.fire);
    if (canShoot && G.player.sprintAmt < 0.45 && W.fireCd <= 0 && W.burstQueue <= 0) {
      var s = CFG.WEAPONS[gun.id];
      var papOv = gun.papped ? s.pap : null;
      var mode = (papOv && papOv.mode) || s.mode;
      var auto = mode === 'auto';
      if (firing && (auto || !W.semiLatch)) {
        W.semiLatch = true;
        if (mode === 'burst') { W.burstQueue = (papOv && papOv.burst) || s.burst || 3; W.burstCd = 0; }
        else fire();
      }
    }
    if (!firing) W.semiLatch = false;

    // viewmodel composition: hip<->ADS, sprint pose, sway, bob
    var Pl = G.player;
    var ads = Pl.ads, sprint = Pl.sprintAmt * (1 - ads);
    var hipX = 0.3, hipY = -0.28, hipZ = -0.5;
    var adsX = 0, adsY = -0.235, adsZ = -0.36;
    W.vmRoot.position.x = hipX + (adsX - hipX) * ads - 0.06 * sprint +
      Pl.vmBobX + Pl.swayX * -0.0006;
    W.vmRoot.position.y = hipY + (adsY - hipY) * ads - 0.05 * sprint +
      Pl.vmBobY + Pl.swayY * 0.0005 - Pl.landDip * 0.4;
    W.vmRoot.position.z = hipZ + (adsZ - hipZ) * ads + 0.04 * sprint;
    W.vmRoot.rotation.y = 0.5 * sprint + Pl.swayX * -0.0009;
    W.vmRoot.rotation.x = 0.3 * sprint + 0.12 * Pl.slideAmt + Pl.swayY * -0.0009;
    W.vmRoot.rotation.z = -Pl.roll * 0.6 - 0.12 * sprint;
    G.hud.setAds(ads);
    // sniper scope overlay when fully aimed
    var scoped = gun && CFG.WEAPONS[gun.id].cls === 'sniper' && ads > 0.75;
    G.hud.setScope(!!scoped);
    if (gun && gun.model) gun.model.visible = !scoped && gun.model.userData.show !== false;

    if (gun && gun.model) {
      var m = gun.model;
      m.position.z += (0 - m.position.z) * Math.min(1, dt * 10);
      var targetY = 0, targetRX = 0;
      if (W.reloading > 0) { targetY = -0.18; targetRX = 0.5; }
      if (W.switching > 0) { targetY = -0.3; }
      if (W.knifing > 0.2) { m.position.z = -0.25; targetRX = -0.3; }
      m.position.y += (targetY - m.position.y) * Math.min(1, dt * 12);
      m.rotation.x += (targetRX - m.rotation.x) * Math.min(1, dt * 12);

      // Keep the three Der Riese wonders alive in-hand without adding any
      // world effects: only their own mechanical groups and emissive materials
      // move. This remains invisible to the map's light and particle budgets.
      var motion = m.userData.wonderMotion;
      if (motion) {
        motion.rotors.forEach(function (r) {
          r.mesh.rotation[r.axis] = r.base + G.time * r.speed + r.phase;
        });
        motion.glows.forEach(function (q) {
          if (q.material && q.material.emissive)
            q.material.emissiveIntensity = Math.max(0, q.base + Math.sin(G.time * q.speed + q.phase) * q.amp);
        });
        (motion.bobs || []).forEach(function (q) {
          q.mesh.position[q.axis] = q.base + Math.sin(G.time * q.speed + q.phase) * q.amp;
        });
      }
      if (m.userData.overclockHalo) {
        var halo = m.userData.overclockHalo;
        halo.rotation.z = G.time * 1.6;
        halo.scale.setScalar(1 + Math.sin(G.time * 3.4) * 0.08);
      }
      if (m.userData.soulCells) m.userData.soulCells.forEach(function (cell, ci) {
        cell.material.color.setHex(ci < (gun.soulCharges || 0) ? 0x79ffe0 : 0x163b3a);
      });
    }

    updateProjectiles(dt);
    updateVortices(dt);
    updateEeHazards(dt);
    updateImprints(dt);

    for (var wf = W.weaponFx.length - 1; wf >= 0; wf--) {
      var fx = W.weaponFx[wf]; fx.life -= dt;
      var fade = Math.max(0, fx.life / Math.max(0.001, fx.total));
      if (fx.grow) fx.mesh.scale.multiplyScalar(1 + fx.grow * dt);
      if (fx.spin) fx.mesh.rotation.z += fx.spin * dt;
      if (fx.drift) fx.mesh.position.addScaledVector(fx.drift, dt);
      fxOpacity(fx.mesh, fx.baseOpacity * fade);
      if (fx.life <= 0) {
        G.scene.remove(fx.mesh);
        fx.mesh.traverse(function (o) { if (o.material && o.material.dispose) o.material.dispose(); });
        W.weaponFx.splice(wf, 1);
      }
    }

    for (var i = W.tracers.length - 1; i >= 0; i--) {
      var t = W.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        disposeTracer(t);
        W.tracers.splice(i, 1);
      }
    }
    for (var f = W.flashes.length - 1; f >= 0; f--) {
      var fl = W.flashes[f];
      fl.life -= dt;
      if (fl.isLight) fl.mesh.intensity *= 0.8;
      else { fl.mesh.scale.multiplyScalar(1.08); fl.mesh.material.opacity *= 0.8; }
      if (fl.life <= 0) {
        // pooled lights stay in the scene (constant light count) — just dim them;
        // everything else is a throwaway mesh and gets removed
        if (fl.pooled) fl.mesh.intensity = 0;
        else {
          G.scene.remove(fl.mesh);
          if (fl.mesh.geometry && fl.mesh.geometry.dispose) fl.mesh.geometry.dispose();
          if (fl.mesh.material && fl.mesh.material.dispose) fl.mesh.material.dispose();
        }
        W.flashes.splice(f, 1);
      }
    }
    for (var b = W.particles.length - 1; b >= 0; b--) {
      var pa = W.particles[b];
      pa.userData.life -= dt;
      pa.userData.vel.y -= 9 * dt;
      pa.position.addScaledVector(pa.userData.vel, dt);
      if (pa.userData.life <= 0 || pa.position.y < 0) {
        G.scene.remove(pa);
        W.particles.splice(b, 1);
      }
    }
  };
})();
