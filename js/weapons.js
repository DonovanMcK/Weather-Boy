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
    eeHazards: [], rods: [], iceSlides: [],
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
      // Ray Gun Mark II: chunkier rifle-pistol body, TWIN emitters, curved mag
      box(0.13, 0.15, 0.34, 0, 0, -0.06, accentMat(0x6a1f7a, papped, dpap));
      var rg2mat = new THREE.MeshPhongMaterial({ color: 0x22ffaa, emissive: 0x115544, shininess: 60 });
      [-0.04, 0.04].forEach(function (ox) {
        var em = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.28, 9), rg2mat);
        em.rotation.x = Math.PI / 2; em.position.set(ox, 0.03, -0.32); g.add(em);
      });
      box(0.07, 0.18, 0.08, 0.0, -0.13, 0.05, M.poly, 0.18);          // grip
      box(0.06, 0.2, 0.07, 0.08, -0.05, -0.02, accentMat(0x22aa66, papped, dpap), 0, 0.5); // angled side mag
      var d2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshPhongMaterial({ color: 0x88ffcc, emissive: 0x1a6644 }));
      d2.position.set(0, 0.1, 0.04); g.add(d2);
      tipZ = -0.52;
    } else if (cls === 'raygun') {
      box(0.1, 0.12, 0.3, 0, 0, -0.08, accentMat(0x8a1212, papped, dpap));
      var coil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 10),
        new THREE.MeshPhongMaterial({ color: 0x22ff66, emissive: 0x115522, shininess: 60 }));
      coil.rotation.x = Math.PI / 2; coil.position.set(0, 0.02, -0.3); g.add(coil);
      cylZ(0.02, 0.03, 0.1, 0, 0.02, -0.45, M.mid);
      box(0.05, 0.13, 0.07, 0, -0.11, 0.03, M.poly, 0.2);
      var dial = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0x66ff88, emissive: 0x114422 }));
      dial.position.set(0, 0.08, 0.02); g.add(dial);
      tipZ = -0.5;
    } else if (cls === 'thunder') {
      var t1 = cylZ(0.07, 0.09, 0.6, 0, 0, -0.2, accentMat(0x55585e, papped, dpap), 12);
      cylZ(0.11, 0.13, 0.2, 0, 0, -0.5, gm('tg', {
        color: 0x222230, emissive: new THREE.Color(0x2244aa), emissiveIntensity: 0.6, shininess: 40
      }), 12);
      cylZ(0.05, 0.05, 0.18, 0, 0.085, -0.1, M.mid);                      // top tank
      cylZ(0.05, 0.05, 0.18, 0, -0.085, -0.1, M.mid);                     // bottom tank
      box(0.06, 0.14, 0.08, 0, -0.12, 0.08, furniture, 0.25);
      tipZ = -0.62;
      void t1;
    } else if (id === 'seelenmotor') {
      box(0.16, 0.16, 0.48, 0, 0, -0.14, accentMat(0x384b52, papped, dpap));
      for (var sm = 0; sm < 3; sm++) cylZ(0.055, 0.055, 0.16, (sm - 1) * 0.07, 0.09, -0.38, accentMat(0x9fe8ff, papped, dpap), 10);
      box(0.07, 0.18, 0.09, 0, -0.14, 0.02, M.wood, 0.2); tipZ = -0.55;
    } else if (id === 'nachbildner115') {
      box(0.11, 0.14, 0.5, 0, 0, -0.16, accentMat(0x4a315d, papped, dpap));
      var prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), accentMat(0xb78cff, papped, dpap));
      prism.position.set(0, 0.11, -0.28); prism.scale.z = 1.5; g.add(prism);
      cylZ(0.025, 0.05, 0.25, 0, 0, -0.52, M.mid, 8); tipZ = -0.68;
    } else if (cls === 'wunder') {
      box(0.07, 0.12, 0.3, 0, -0.03, 0.12, M.wood);                       // stock
      box(0.08, 0.1, 0.44, 0, 0, -0.2, body);                             // body
      for (var ci = 0; ci < 3; ci++) {
        var coilM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 10),
          new THREE.MeshPhongMaterial({ color: 0x223344, emissive: 0x33ccff, emissiveIntensity: 0.9, shininess: 80 }));
        coilM.position.set(0, 0.085, -0.1 - ci * 0.14);
        g.add(coilM);
      }
      cylZ(0.018, 0.018, 0.12, 0, 0.0, -0.48, M.mid);
      box(0.05, 0.14, 0.07, 0, -0.13, 0.02, M.wood, 0.2);
      tipZ = -0.56;
    } else if (id === 'blitzfanger') {
      box(0.13, 0.13, 0.4, 0, 0, -0.12, accentMat(0x28566b, papped, dpap));
      [-0.055, 0.055].forEach(function (rx) { cylZ(0.018, 0.025, 0.62, rx, 0.04, -0.4, accentMat(0x66ddff, papped, dpap), 8); });
      box(0.05, 0.16, 0.07, 0, -0.13, 0.02, M.poly, 0.2); tipZ = -0.74;
    } else if (id === 'kryolithwerfer') {
      cylZ(0.1, 0.13, 0.52, 0, 0, -0.2, accentMat(0x7bbdcc, papped, dpap), 12);
      var cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), accentMat(0xd8f8ff, papped, dpap));
      cry.position.set(0, 0.12, -0.25); g.add(cry);
      cylZ(0.04, 0.075, 0.28, 0, 0, -0.58, M.mid, 10); tipZ = -0.75;
    } else if (id === 'vosssiphon') {
      box(0.14, 0.17, 0.42, 0, 0, -0.1, accentMat(0x94733e, papped, dpap));
      cylZ(0.07, 0.09, 0.38, 0, 0.1, -0.18, accentMat(0x76f2ba, papped, dpap), 12);
      cylZ(0.035, 0.06, 0.34, 0, 0, -0.48, M.mid, 10);
      box(0.06, 0.17, 0.08, 0, -0.14, 0.03, M.wood, 0.25); tipZ = -0.68;
    } else if (cls === 'storm' && vm.lance) {
      // Aether Lance: a long tapered rail spear — no orb, no funnel. Brass
      // haft, three aether coil rings marching up the shaft, a glowing prong
      // tip. Reads as a couched lance, unlike anything else in the arsenal.
      box(0.06, 0.1, 0.26, 0, -0.02, 0.14, M.wood);                      // haft grip
      cylZ(0.028, 0.045, 0.85, 0, 0.01, -0.24, accentMat(0x9a7a3a, papped, dpap), 10);  // tapered rail
      for (var lr = 0; lr < 3; lr++) {
        var ringL = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12),
          new THREE.MeshPhongMaterial({ color: 0x2a1a3a, emissive: 0xb790ff, emissiveIntensity: 0.95, shininess: 85 }));
        ringL.position.set(0, 0.01, -0.12 - lr * 0.18); g.add(ringL);
      }
      var prong = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 8),
        new THREE.MeshPhongMaterial({ color: 0x3a2a4a, emissive: 0xe8dcff, emissiveIntensity: 1.0, shininess: 95 }));
      prong.rotation.x = -Math.PI / 2; prong.position.set(0, 0.01, -0.72); g.add(prong);
      box(0.05, 0.12, 0.07, 0, -0.11, 0.05, M.poly, 0.25);               // under-grip
      tipZ = -0.8;
    } else if (cls === 'storm' && vm.driver) {
      // Maelstrom Driver: a compact industrial bore, built around a visible
      // spinning pressure wheel rather than the Wettermacher's orb/funnel.
      box(0.13, 0.13, 0.42, 0, 0, -0.16, accentMat(0x3f3430, papped, dpap));
      var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 7, 18),
        new THREE.MeshPhongMaterial({ color: 0x8b6434, emissive: 0xff6a1e, emissiveIntensity: 0.65, shininess: 80 }));
      wheel.rotation.x = Math.PI / 2; wheel.position.set(0, 0.105, -0.18); g.add(wheel);
      for (var dr = 0; dr < 3; dr++) {
        var spoke = box(0.025, 0.025, 0.18, 0, 0.105, -0.18, M.mid);
        spoke.rotation.y = dr * Math.PI / 3;
      }
      cylZ(0.045, 0.09, 0.38, 0, 0, -0.48, accentMat(0xb07cff, papped, dpap), 10);
      cylZ(0.12, 0.07, 0.11, 0, 0, -0.69, M.mid, 12);
      box(0.06, 0.15, 0.09, 0, -0.13, 0.04, M.poly, 0.25);
      tipZ = -0.76;
    } else if (cls === 'storm') {
      var st = cylZ(0.06, 0.08, 0.55, 0, 0, -0.18, accentMat(0x4a525c, papped, dpap), 12);
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12),
        new THREE.MeshPhongMaterial({ color: 0x113355, emissive: 0x55ccff, emissiveIntensity: 1.0, shininess: 90 }));
      orb.position.set(0, 0.09, -0.05); g.add(orb);
      cylZ(0.09, 0.02, 0.12, 0, 0, -0.5, M.mid, 12);                      // funnel muzzle
      box(0.05, 0.14, 0.08, 0, -0.12, 0.06, M.poly, 0.25);
      box(0.04, 0.05, 0.18, 0, -0.07, -0.25, M.poly);
      tipZ = -0.56;
      void st;
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
      s.echoPulses = 6; s.echoRange = 60; s.echoWidth = 1.15; s.superVariant = 'echo';
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
      if (W.current() && W.current().model) W.vmRoot.remove(W.current().model);
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
    while (W.vmRoot.children.length) W.vmRoot.remove(W.vmRoot.children[0]);
    W.slots = W.power.saved; W.cur = Math.min(W.power.savedCur, W.slots.length - 1);
    W.power = null;
    W.equip(W.cur, true);
    G.hud.setAmmo();
  };

  W.dropExtraSlots = function () {
    while (W.slots.length > W.maxSlots) W.slots.pop();
    if (W.cur >= W.slots.length) W.equip(0, true);
  };

  W.equip = function (i, instant) {
    if (i >= W.slots.length || (i === W.cur && !instant && W.slots[i].model)) return;
    W.reloading = 0;
    W.cur = i;
    while (W.vmRoot.children.length) W.vmRoot.remove(W.vmRoot.children[0]);
    var gun = W.slots[i];
    gun.model = buildModel(gun.id, gun.papped, gun.dpap);
    if (gun.overclocked) {
      var oc = gun.id === 'seelenmotor' ? 0x79ffe0 : 0xd8a6ff;
      var halo = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 18),
        new THREE.MeshBasicMaterial({ color: oc, transparent: true, opacity: 0.9 }));
      halo.position.set(0, 0.1, -0.3); halo.rotation.x = Math.PI / 2;
      gun.model.add(halo); gun.model.userData.overclockHalo = halo;
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
  W.variantKill = function (pos) {
    var gun = W.current();
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
        G.zombies.fling(z2, to2);
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
  function shootRay(spreadDeg, dmg, headMult, range, isKnife, pierce) {
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
      G.zombies.damageZombie(z, d, { head: isHead, knife: isKnife });
      if (!isKnife) W.applyElement(z);       // Kurhaus altar infusions proc per hit
      if (dpap && Math.random() < 0.3) deadWire(z, d);   // electric arc proc
      hitAny = true; end = hit.point;
      if (++struck >= pierce) break;                // round absorbed
    }
    if (!isKnife) spawnTracer(end);
    return hitAny;
  }

  // Dead Wire: a double-packed round chains electricity to nearby zombies
  function deadWire(from, d) {
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
      G.zombies.damageZombie(near[k].z, d, { boom: false });
    }
    if (near.length) G.audio.hitmark(false);
  }

  function addLine(a, b, color, life, opacity) {
    var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity || 0.7
    }));
    G.scene.add(line);
    W.tracers.push({ mesh: line, life: life });
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

  W.superKill = function () {
    var gun = W.current();
    if (!gun || !gun.overclocked || gun.id !== 'seelenmotor') return;
    gun.soulCharges = Math.min(3, (gun.soulCharges || 0) + 1);
  };

  function muzzleFlash() {
    if (!W.muzzle) return;
    var p = W.muzzle.getWorldPosition(new THREE.Vector3());
    W.flashLight.position.copy(p);
    W.flashLight.intensity = 2.5;
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
    muzzleFlash();
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
    if (s.projectile === 'wind') { fireThunder(); return; }
    if (s.projectile === 'chain') { fireWunderwaffe(s); return; }
    if (s.projectile === 'lance') { fireLance(s); return; }
    if (s.projectile === 'bore') { spawnProjectile('bore', s); return; }
    if (s.projectile === 'flare') { spawnProjectile('flare', s); return; }
    if (s.projectile === 'soulmine') { spawnProjectile('soulmine', s); return; }
    if (s.projectile === 'piston') { firePiston(s, gun); return; }
    if (s.projectile === 'echo') { fireEcho(s, gun); return; }
    if (s.projectile === 'rod') { fireRod(s); return; }
    if (s.projectile === 'kryolith') { fireKryolith(s); return; }
    if (s.projectile === 'siphon') { fireSiphon(s); return; }
    if (s.projectile === 'storm') { spawnProjectile('storm', s); return; }
    if (s.projectile === 'implode') { spawnProjectile('implode', s); return; }
    if (s.projectile === 'ray') { spawnProjectile('ray', s); return; }
    if (s.projectile === 'rocket') { spawnProjectile('rocket', s); return; }

    // ADS tightens spread, sprinting loosens it; simple-aim gets a flat bonus
    var spreadMult = (1 - 0.7 * G.player.ads) * (1 + 0.5 * G.player.sprintAmt);
    if (G.settings && G.settings.aimMode === 'simple') spreadMult *= 0.55;
    if (G.player.hasPerk('deadshot')) spreadMult *= 0.5;   // Deadshot Daiquiri: steadier aim
    // penetration: high-power rounds punch through a line of zombies (each
    // pierced kill is scored normally). PaP'd guns pierce one extra.
    var pierce = ({ rifle: 2, lmg: 3, sniper: 5, minigun: 2 }[s.cls] || 1) + (gun.papped ? 1 : 0);
    var pellets = s.pellets || 1;
    for (var i = 0; i < pellets; i++) {
      shootRay(s.spread * spreadMult, s.dmg, s.head * (G.player.hasPerk('deadshot') ? 1.5 : 1), s.range, false, pierce);
    }
  }

  function fireThunder() {
    G.player.shake(0.8);
    var fwd = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead || z.state === 'flung') return;
      var to = z.mesh.position.clone().sub(G.player.pos);
      var dist = to.length();
      if (dist > 14) return;
      to.normalize();
      var fl = fwd.clone(); fl.y = 0; fl.normalize();
      var toFlat = to.clone(); toFlat.y = 0; toFlat.normalize();
      if (fl.dot(toFlat) < Math.cos(35 * Math.PI / 180)) return;
      G.zombies.fling(z, toFlat);
    });
  }

  /* ---------------------- elemental infusions (Kurhaus altar rites) -------
     A gun carries at most one element (gun.element), swapped at will at any
     ignited altar. Procs land per bullet hit:
       molten  30%  ignite — a burn that ticks for 2s
       frozen 100%  chill  — webbed-speed slow for 1.2s (stacks with nothing)
       drowned 20%  scald  — a steam burst scalds everything around the target
       grave   20%  shatter— the legs give out (crawler chance) + rot damage  */
  W.applyElement = function (z) {
    var gun = W.current();
    var el = gun && gun.element;
    if (!el || !z || z.dead) return;
    var p = z.mesh.position;
    if (el === 'molten') {
      if (Math.random() < 0.3) {
        z.burnT = 2; z.burnDps = 240;
        poolFlash(new THREE.Vector3(p.x, p.y + 1.2, p.z), 0xff6a1e, 1.1, 6);
      }
    } else if (el === 'frozen') {
      z.slowT = Math.max(z.slowT || 0, 1.2);
    } else if (el === 'drowned') {
      if (Math.random() < 0.2) {
        G.zombies.aoe({ x: p.x, z: p.z }, 220, 2.6, { y: p.y });
        poolFlash(new THREE.Vector3(p.x, p.y + 1.4, p.z), 0x3fd0c8, 1.2, 7);
      }
    } else if (el === 'grave') {
      if (Math.random() < 0.2) G.zombies.damageZombie(z, 120, { boom: true, crawlers: true });
    }
  };

  /* ------------------------------------------- aether lance (line pierce) */
  // The founder's weapon: a thrown line of aether that SKEWERS every zombie
  // along its path — no chaining, no vortex; pure impalement down a corridor.
  function fireLance(s) {
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
      G.zombies.damageZombie(z, s.dmg, { boom: true });
      W.applyElement(z);            // an infused lance carries its element down the line
    });
    addLine(start, end, 0xb790ff, 0.26, 0.9);         // the aether shaft
    addLine(start, end, 0xf0e8ff, 0.09, 0.7);         // white-hot core
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
  function damageLine(origin, dir, range, width, dmg, color, weaponId) {
    var reach = lineReach(origin, dir, range), end = origin.clone().addScaledVector(dir, reach);
    addLine(origin, end, color, Math.max(0.08, width * 0.12), 0.8);
    var hit = false, v = new THREE.Vector3();
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead || Math.abs(z.mesh.position.y - origin.y) > 2.5) return;
      v.copy(z.mesh.position).sub(origin); var t = v.x * dir.x + v.z * dir.z;
      if (t < 0 || t > reach) return;
      var qx = origin.x + dir.x * t, qz = origin.z + dir.z * t;
      if (Math.hypot(z.mesh.position.x - qx, z.mesh.position.z - qz) > width) return;
      hit = true; G.zombies.damageZombie(z, dmg, { boom: true, crawlers: true, weaponId: weaponId });
    });
    if (hit) G.hud.hitmarker(true);
  }
  function reportOverclockShot(gun, dir, range) {
    if (G.interact && G.interact.onWonderFire)
      G.interact.onWonderFire(gun.id, G.camera.position.clone(), dir.clone(), range);
  }
  function firePiston(s, gun) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); dir.y = 0; dir.normalize();
    reportOverclockShot(gun, dir, s.pistonRange);
    var charges = gun.overclocked ? (gun.soulCharges || 0) : 0;
    if (charges) { gun.soulCharges = 0; G.hud.banner('SOUL PRESSURE ×' + charges, '#79ffe0', 1.2); }
    W.eeHazards.push({ type: 'piston', pos: G.player.pos.clone(), dir: dir,
      t: s.pistonDur, tick: 0, dmg: s.dmg * (1 + charges * 0.4), width: s.pistonWidth,
      range: s.pistonRange, weaponId: gun.id, super: !!gun.overclocked });
    G.hud.banner(gun.overclocked ? 'ÜBERDRUCK ASSEMBLY LINE' : 'SOUL ASSEMBLY LINE', '#9fe8ff', 1.2);
  }
  function fireEcho(s, gun) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); dir.y = 0; dir.normalize();
    reportOverclockShot(gun, dir, s.echoRange);
    var angles = gun.overclocked ? [-0.24, 0, 0.24] : [0];
    angles.forEach(function (a, ai) {
      var d = dir.clone(); var x = d.x * Math.cos(a) - d.z * Math.sin(a);
      d.z = d.x * Math.sin(a) + d.z * Math.cos(a); d.x = x;
      W.eeHazards.push({ type: 'echo', pos: G.camera.position.clone(), dir: d,
        t: 3.4, tick: 0.3 + ai * 0.1, pulses: s.echoPulses, dmg: s.dmg,
        width: s.echoWidth || 0.8, range: s.echoRange, weaponId: gun.id,
        super: !!gun.overclocked, superCore: !!gun.overclocked && ai === 1 });
    });
    if (gun.overclocked) G.hud.banner('PARADOX ECHO', '#d8a6ff', 1.3, 'The echoes draw the horde inward');
    poolFlash(G.camera.position.clone().addScaledVector(dir, 2.5), 0xb78cff, 1.2, 8);
  }
  function fireRod(s) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); dir.y = 0; dir.normalize();
    var reach = lineReach(G.camera.position, dir, 16);
    var p = G.camera.position.clone().addScaledVector(dir, Math.max(2, reach - 0.25));
    p.y = G.map.supportAt(p.x, p.z, p.y, 0);
    W.rods.push({ pos: p, dmg: s.dmg, dur: s.rodDur, radius: s.rodRadius });
    poolFlash(new THREE.Vector3(p.x, p.y + 0.8, p.z), 0x66ddff, 1.4, 8);
    if (W.rods.length >= 2) {
      var b = W.rods.pop(), a = W.rods.pop();
      W.eeHazards.push({ type: 'fence', a: a.pos, b: b.pos, t: s.rodDur,
        tick: 0, dmg: s.dmg, width: s.rodRadius });
      G.hud.banner('LIGHTNING FENCE ACTIVE', '#66ddff', 1.5);
    } else G.hud.banner('FIRST ROD PLANTED', '#66ddff', 1.2, 'Place the second rod');
  }
  function fireKryolith(s) {
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation); aimAssist(dir);
    _ray.set(G.camera.position, dir); _ray.far = 45;
    var hits = _ray.intersectObjects(G.zombies.shootables().concat(G.map.solidMeshes), false);
    var z = null;
    for (var i = 0; i < hits.length; i++) {
      if (!hits[i].object.userData.zombie) break;
      z = hits[i].object.userData.zombie; if (!z.dead) break;
    }
    if (!z || z.dead) return;
    if (!z.wwFrozen) {
      z.wwFrozen = true; z.wwFrozenT = 9;
      z.mesh.traverse(function (o) { if (o.material && o.material.color) o.material.color.offsetHSL(0.5, 0.1, 0.18); });
      poolFlash(z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xbfefff, 1.4, 7);
      G.hud.hitmarker(true);
    } else {
      z.wwFrozenT = 3;
      var flat = dir.clone(); flat.y = 0; flat.normalize();
      W.iceSlides.push({ z: z, dir: flat, speed: s.iceSpeed, dmg: s.dmg,
        radius: s.iceRadius, t: 2.5, hit: [] });
    }
  }
  function fireSiphon(s) {
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
      if (z.mesh.position.distanceTo(first.mesh.position) < 4) targets.push(z);
    });
    var start = W.muzzle.getWorldPosition(new THREE.Vector3());
    targets.forEach(function (z) {
      var end = z.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      addLine(start, end, 0x76f2ba, 0.11, 0.9);
      G.zombies.damageZombie(z, s.dmg, { boom: true });
    });
    G.player.hp = Math.min(G.player.maxHp + 50, G.player.hp + s.siphonHeal * targets.length);
    G.hud.hitmarker(true);
  }

  /* --------------------------------------------- wunderwaffe (chain bolt) */
  function fireWunderwaffe(s) {
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
    addLine(start, end, 0x88eeff, 0.18, 0.95);
    G.audio.zap();
    var first = hits.length && hits[0].object.userData.zombie
      ? hits[0].object.userData.zombie : null;
    if (!first || first.dead) return;
    var chained = [first];
    var pool = G.zombies.list.filter(function (z) { return !z.dead && z !== first; });
    while (chained.length < (s.chain || 10)) {
      var bestZ = null, bd = 1e9;
      for (var i = 0; i < pool.length; i++) {
        var z = pool[i];
        if (chained.indexOf(z) >= 0 || z.dead) continue;
        for (var j = 0; j < chained.length; j++) {
          var d = z.mesh.position.distanceTo(chained[j].mesh.position);
          if (d < (s.chainRadius || 5.5) && d < bd) { bd = d; bestZ = z; }
        }
      }
      if (!bestZ) break;
      chained.push(bestZ);
    }
    for (var k = 0; k < chained.length; k++) {
      if (k > 0) {
        var a = chained[k - 1].mesh.position.clone(); a.y += 1.3;
        var b = chained[k].mesh.position.clone(); b.y += 1.3;
        addLine(a, b, 0x88eeff, 0.3, 0.95);
      }
      G.zombies.damageZombie(chained[k], 1e9, { boom: true });
    }
    G.hud.hitmarker(true);
  }

  /* ---------------------------------- implosion field (Maelstrom Driver) ----
     The anti-Thundergun. For pullDur seconds every zombie inside pullRadius is
     DRAGGED toward the point (zombies.js honours z.pullT/z.pullPt, wall-safe),
     visualized by a shrinking violet ring and inward light-streaks; then the
     clump detonates. Element infusions ride the burst. */
  W.implosions = [];
  function spawnImplosion(pos, o) {
    var fy = G.map.supportAt(pos.x, pos.z, pos.y, 0);
    var c = new THREE.Vector3(pos.x, fy, pos.z);
    var ringM = new THREE.Mesh(new THREE.TorusGeometry(o.pullRadius * 0.85, 0.12, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x8a5cf0, transparent: true, opacity: 0.75, depthWrite: false }));
    ringM.rotation.x = Math.PI / 2; ringM.position.set(c.x, fy + 1.1, c.z);
    G.scene.add(ringM);
    var core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xd9c8ff }));
    core.position.set(c.x, fy + 1.1, c.z); G.scene.add(core);
    poolFlash(new THREE.Vector3(c.x, fy + 1.5, c.z), 0x8a5cf0, 1.6, o.pullRadius * 1.5);
    G.audio.implodeCharge(o.pullDur);
    W.implosions.push({ c: c, t: 0, o: o, ring: ringM, core: core, streakT: 0 });
  }
  W._implode = spawnImplosion;   // exposed for the test harness
  function updateImplosions(dt) {
    for (var i = W.implosions.length - 1; i >= 0; i--) {
      var im = W.implosions[i];
      im.t += dt; im.streakT += dt;
      var k = Math.max(0.12, 1 - im.t / im.o.pullDur);
      im.ring.scale.set(k, k, k);
      im.ring.rotation.z += dt * 5;
      im.core.scale.setScalar(1 + (1 - k) * 1.6);
      var pulled = [];
      G.zombies.list.forEach(function (z) {
        if (z.dead) return;
        var plx = im.c.x - z.mesh.position.x, plz = im.c.z - z.mesh.position.z;
        var pld = Math.hypot(plx, plz);
        if (pld > im.o.pullRadius) return;
        z.pullT = 0.3;                       // flags the AI: it is being taken
        // drag at 7m/s (beats any walk speed); a wall-blocked step is skipped
        if (pld > 0.45) {
          var pstep = Math.min(pld - 0.35, 7 * dt);
          var pnx = z.mesh.position.x + plx / pld * pstep, pnz = z.mesh.position.z + plz / pld * pstep;
          if (!G.map.bodyBlocked || !G.map.bodyBlocked(pnx, pnz, z.mesh.position.y + 0.2)) {
            z.mesh.position.x = pnx; z.mesh.position.z = pnz;
          }
        }
        pulled.push(z);
      });
      if (im.streakT > 0.12 && pulled.length) {          // inward light-streaks
        im.streakT = 0;
        var zs = pulled[(Math.random() * pulled.length) | 0];
        var a = zs.mesh.position.clone(); a.y += 1.3;
        addLine(a, new THREE.Vector3(im.c.x, im.c.y + 1.1, im.c.z), 0xb790ff, 0.1, 0.3);
      }
      if (im.t < im.o.pullDur) continue;
      // BURST — the clump detonates
      G.scene.remove(im.ring); G.scene.remove(im.core);
      W.implosions.splice(i, 1);
      poolFlash(new THREE.Vector3(im.c.x, im.c.y + 1.5, im.c.z), 0xd9c8ff, 3, im.o.burstRadius * 3.5);
      G.audio.implodeBurst();
      G.player.shake(0.5);
      var any = false;
      G.zombies.list.slice().forEach(function (z) {
        if (z.dead) return;
        var d = Math.hypot(z.mesh.position.x - im.c.x, z.mesh.position.z - im.c.z);
        if (d > im.o.burstRadius * 1.2) return;
        any = true;
        W.blood(z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 4);
        G.zombies.damageZombie(z, im.o.dmg, { boom: true });
        W.applyElement(z);                                 // infused Maelstrom
      });
      if (any) G.hud.hitmarker(true);
      if (G.interact && G.interact.onBoom) G.interact.onBoom(im.c);
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
      mesh: grp, cone: cone, inner: inner,
      t: opts.storm.dur, radius: opts.storm.radius, dmg: opts.dmg, tick: 0
    });
  }

  function updateVortices(dt) {
    for (var i = W.vortices.length - 1; i >= 0; i--) {
      var v = W.vortices[i];
      v.t -= dt;
      v.cone.rotation.y += dt * 7;
      v.inner.rotation.y -= dt * 11;
      v.cone.material.opacity = 0.22 + Math.random() * 0.12;  // flicker (was the light)
      G.zombies.list.forEach(function (z) {
        if (z.dead || (z.state !== 'chase' && z.state !== 'attack')) return;
        if (Math.abs(z.mesh.position.y - v.mesh.position.y) > 2.5) return;  // own floor only
        var dx = v.mesh.position.x - z.mesh.position.x;
        var dz = v.mesh.position.z - z.mesh.position.z;
        var d = Math.hypot(dx, dz);
        if (d > v.radius * 1.5 || d < 0.3) return;
        z.mesh.position.x += dx / d * dt * 4;
        z.mesh.position.z += dz / d * dt * 4;
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
            var a = v.mesh.position.clone(); a.y += 4.5;
            var b = z.mesh.position.clone(); b.y += 1.3;
            addLine(a, b, 0xaaeeff, 0.15, 0.9);
            G.zombies.damageZombie(z, v.dmg, { boom: true });
            W.applyElement(z);      // an infused Maelstrom's storm carries its element
          }
        });
      }
      if (v.t <= 0) {
        G.scene.remove(v.mesh);
        W.vortices.splice(i, 1);
      }
    }
  }

  /* --------------------------------------------------------- projectiles */
  function spawnProjectile(type, s) {
    var pos = W.muzzle ? W.muzzle.getWorldPosition(new THREE.Vector3())
                       : G.camera.position.clone();
    var dir = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
    aimAssist(dir);
    var mesh, vel, opts;
    if (type === 'ray') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x44ff66 }));
      vel = dir.multiplyScalar(38);
      opts = { dmg: s.dmg, radius: 2.5, gravity: 0, fuse: 3, color: 0x44ff66 };
    } else if (type === 'rocket') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
      vel = dir.multiplyScalar(26).add(new THREE.Vector3(0, 1.5, 0));
      opts = { dmg: s.dmg, radius: 4, gravity: 5, fuse: 4, color: 0xffaa33, crawlers: true };
    } else if (type === 'storm') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x66ccff }));
      vel = dir.multiplyScalar(24).add(new THREE.Vector3(0, 0.5, 0));
      opts = { dmg: s.dmg, radius: 2.5, gravity: 1.5, fuse: 3, color: 0x66ccff,
               storm: { dur: s.stormDur, radius: s.stormRadius } };
    } else if (type === 'implode') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x8a5cf0 }));
      vel = dir.multiplyScalar(24).add(new THREE.Vector3(0, 0.5, 0));
      opts = { dmg: s.dmg, radius: 2.5, gravity: 1.5, fuse: 3, color: 0x8a5cf0,
               implode: { pullDur: s.pullDur, pullRadius: s.pullRadius,
                          burstRadius: s.burstRadius, dmg: s.dmg } };
    } else if (type === 'bore') {
      // A razor-thin pressure wheel: no blast, no pull, no lightning. It keeps
      // its energy through bodies and rebounds from the room shell.
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.065, 7, 18),
        new THREE.MeshBasicMaterial({ color: 0xc78cff }));
      mesh.rotation.x = Math.PI / 2;
      vel = dir.multiplyScalar(s.boreSpeed || 38);
      opts = { dmg: s.dmg, radius: 0, gravity: 0, fuse: s.boreLife || 2.8,
               color: 0xc78cff, bounces: s.boreBounces || 3 };
    } else if (type === 'flare') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.24, 8),
        new THREE.MeshBasicMaterial({ color: 0xff5522 }));
      mesh.rotation.x = Math.PI / 2;
      vel = dir.multiplyScalar(15).add(new THREE.Vector3(0, 2.2, 0));
      opts = { dmg: s.dmg, radius: 4.5, gravity: 7, fuse: 99, color: 0xff5522,
               bounce: true, flareDur: s.flareDur, flareRadius: s.flareRadius };
    } else if (type === 'soulmine') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.1, 10),
        new THREE.MeshLambertMaterial({ color: 0x384633, emissive: 0x273311 }));
      vel = dir.multiplyScalar(12).add(new THREE.Vector3(0, 3.0, 0));
      opts = { dmg: s.dmg, radius: s.mineRadius, gravity: 9, fuse: 99, color: 0x9cff72,
               bounce: true, mineNeed: s.mineNeed };
    }
    mesh.position.copy(pos);
    G.scene.add(mesh);
    W.projectiles.push({ type: type, mesh: mesh, vel: vel, t: 0, opts: opts, hit: [] });
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

  // light a transient flash from the pool (no scene add/remove -> no recompile)
  function poolFlash(pos, color, intensity, dist) {
    var L = W.boomLights[W.boomIdx]; W.boomIdx = (W.boomIdx + 1) % W.boomLights.length;
    L.position.copy(pos); L.color.setHex(color); L.intensity = intensity; L.distance = dist;
    W.flashes.push({ mesh: L, life: 0.22, isLight: true, pooled: true });
  }

  W.explode = function (pos, dmg, radius, opts) {
    opts = opts || {};
    G.audio.explosion();
    G.player.shake(0.7);
    var flash = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 12, 12),
      new THREE.MeshBasicMaterial({ color: opts.color || 0xffaa33, transparent: true, opacity: 0.85 }));
    flash.position.copy(pos);
    G.scene.add(flash);
    W.flashes.push({ mesh: flash, life: 0.22 });
    poolFlash(pos, opts.color || 0xffaa33, 3, radius * 4);
    G.zombies.list.slice().forEach(function (z) {
      if (z.dead) return;
      var d = z.mesh.position.distanceTo(pos);
      if (d > radius) return;
      var fall = 1 - 0.6 * (d / radius);
      W.blood(z.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 3);
      G.zombies.damageZombie(z, dmg * fall, { boom: true, crawlers: opts.crawlers });
    });
    // the world reacts to blasts too (quest: cracking the Cellar's bricked arch)
    if (G.interact && G.interact.onBoom) G.interact.onBoom(pos);
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

      if (p.type === 'bore') {
        p.mesh.rotation.z += dt * 24;

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
            G.zombies.damageZombie(boreZ, p.opts.dmg, { boom: true });
            W.applyElement(boreZ);
            G.hud.hitmarker(true);
          }
        }

        if (hitWall || hitFloor) {
          p.opts.bounces--;
          if (p.opts.bounces < 0) detonate = true;
          else {
            // Probe each horizontal axis independently for a stable reflection.
            // Corners flip both axes; floor/ceiling flips vertical travel.
            if (hitFloor) p.vel.y = Math.abs(p.vel.y || 1);
            if (hitWall) {
              var blockX = pointBlocked(wallX, safeY, safeZ, 0.1);
              var blockZ = pointBlocked(safeX, safeY, wallZ, 0.1);
              if (blockX || !blockZ) p.vel.x *= -1;
              if (blockZ || !blockX) p.vel.z *= -1;
            }
            poolFlash(p.mesh.position, 0xc78cff, 0.55, 4);
          }
        }
      } else

      if (p.type === 'flare' && p.landed) {
        if (p.stuckZ && !p.stuckZ.dead) {
          p.mesh.position.copy(p.stuckZ.mesh.position); p.mesh.position.y += 1.0;
        }
        p.lure -= dt;
        G.zombies.lure = { pos: p.mesh.position, proj: p };
        if (Math.floor(p.lure * 3) !== Math.floor((p.lure + dt) * 3))
          poolFlash(p.mesh.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xff5522, 1.0, p.opts.flareRadius);
        if (p.lure <= 0) detonate = true;
      } else if (p.type === 'soulmine' && p.landed) {
        var standing = 0;
        G.zombies.list.forEach(function (mz) {
          if (!mz.dead && Math.abs(mz.mesh.position.y - p.mesh.position.y) < 2.2 &&
              Math.hypot(mz.mesh.position.x - p.mesh.position.x, mz.mesh.position.z - p.mesh.position.z) < p.opts.radius)
            standing++;
        });
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

      if (!detonate && (p.type === 'ray' || p.type === 'rocket' || p.type === 'storm')) {
        // height-aware contact: the orb flies at chest/eye height while a
        // zombie's origin is at its feet, so test horizontal range + a body
        // column (otherwise the shot sails straight over open-map hordes)
        for (var j = 0; j < G.zombies.list.length; j++) {
          var z = G.zombies.list[j];
          if (z.dead) continue;
          var zp = z.mesh.position;
          var horiz = Math.hypot(zp.x - p.mesh.position.x, zp.z - p.mesh.position.z);
          // body column is RELATIVE to the zombie's feet (zp.y), so the orb
          // contacts hordes on Floor B / Floor 2 too — not just the base floor
          if (horiz < 0.85 && p.mesh.position.y > zp.y - 0.3 && p.mesh.position.y < zp.y + 2.4) {
            detonate = true; break;
          }
        }
      }
      if (!detonate && p.type === 'flare' && !p.landed) {
        for (var fj = 0; fj < G.zombies.list.length; fj++) {
          var fz = G.zombies.list[fj]; if (fz.dead) continue;
          if (Math.hypot(fz.mesh.position.x - p.mesh.position.x, fz.mesh.position.z - p.mesh.position.z) < 0.8 &&
              p.mesh.position.y > fz.mesh.position.y && p.mesh.position.y < fz.mesh.position.y + 2.2) {
            p.landed = true; p.stuckZ = fz; p.lure = p.opts.flareDur; p.vel.set(0, 0, 0); break;
          }
        }
      }
      if (p.t > p.opts.fuse) detonate = true;

      if (detonate) {
        if ((p.type === 'monkey' || p.type === 'flare') && G.zombies.lure && G.zombies.lure.proj === p) G.zombies.lure = null;
        if (p.opts.implode) spawnImplosion(p.mesh.position, p.opts.implode);
        else if (p.type === 'bore') poolFlash(p.mesh.position, 0xc78cff, 0.75, 5);
        else if (p.opts.storm) spawnVortex(p.mesh.position, p.opts);
        else W.explode(p.mesh.position, p.opts.dmg, p.opts.radius, p.opts);
        G.scene.remove(p.mesh);
        W.projectiles.splice(i, 1);
      }
    }
  }

  function updateEeHazards(dt) {
    for (var i = W.eeHazards.length - 1; i >= 0; i--) {
      var h = W.eeHazards[i]; h.t -= dt; h.tick -= dt;
      if (h.type === 'piston' && h.tick <= 0) {
        h.tick = 0.48;
        damageLine(h.pos, h.dir, h.range, h.width, h.dmg, 0x9fe8ff, h.weaponId);
        G.player.shake(0.18);
      } else if (h.type === 'echo' && h.tick <= 0 && h.pulses > 0) {
        h.tick = 0.42; h.pulses--;
        damageLine(h.pos, h.dir, h.range, h.width, h.dmg, 0xb78cff, h.weaponId);
        if (h.superCore) {
          var lurePos = h.pos.clone().addScaledVector(h.dir, Math.min(12, h.range * 0.35));
          lurePos.y = h.pos.y - 1.2;
          G.zombies.lure = { pos: lurePos, proj: h };
          if (h.pulses <= 0) {
            G.zombies.lure = null;
            W.boom(lurePos, h.dmg * 0.8, 6, 0xd8a6ff, { boom: true, y: lurePos.y });
          }
        }
      } else if (h.type === 'fence') {
        addLine(h.a.clone().add(new THREE.Vector3(0, 0.7, 0)),
                h.b.clone().add(new THREE.Vector3(0, 0.7, 0)), 0x66ddff, 0.09, 0.45);
        if (h.tick <= 0) {
          h.tick = 0.4;
          var dx = h.b.x - h.a.x, dz = h.b.z - h.a.z, len2 = dx * dx + dz * dz;
          G.zombies.list.slice().forEach(function (z) {
            if (z.dead || Math.abs(z.mesh.position.y - h.a.y) > 2.2) return;
            var q = len2 ? ((z.mesh.position.x - h.a.x) * dx + (z.mesh.position.z - h.a.z) * dz) / len2 : 0;
            q = Math.max(0, Math.min(1, q));
            if (Math.hypot(z.mesh.position.x - (h.a.x + dx * q), z.mesh.position.z - (h.a.z + dz * q)) <= h.width) {
              G.zombies.damageZombie(z, h.dmg, { boom: true }); z.slowT = Math.max(z.slowT || 0, 0.8);
            }
          });
        }
      }
      if (h.t <= 0 || (h.type === 'echo' && h.pulses <= 0)) W.eeHazards.splice(i, 1);
    }

    for (var j = W.iceSlides.length - 1; j >= 0; j--) {
      var s = W.iceSlides[j], iz = s.z; s.t -= dt;
      if (!iz || iz.dead) { W.iceSlides.splice(j, 1); continue; }
      var nx = iz.mesh.position.x + s.dir.x * s.speed * dt;
      var nz = iz.mesh.position.z + s.dir.z * s.speed * dt;
      if (pointBlocked(nx, iz.mesh.position.y + 0.8, nz, 0.4) || s.t <= 0) {
        W.explode(iz.mesh.position.clone(), s.dmg, s.radius + 1.2, { color: 0xbfefff });
        iz.wwFrozen = false; G.zombies.damageZombie(iz, s.dmg, { boom: true });
        W.iceSlides.splice(j, 1); continue;
      }
      iz.mesh.position.x = nx; iz.mesh.position.z = nz;
      G.zombies.list.slice().forEach(function (other) {
        if (other.dead || other === iz || s.hit.indexOf(other) >= 0) return;
        if (other.mesh.position.distanceTo(iz.mesh.position) < s.radius) {
          s.hit.push(other); G.zombies.damageZombie(other, s.dmg, { boom: true, crawlers: true });
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
    }

    updateProjectiles(dt);
    updateVortices(dt);
    updateImplosions(dt);
    updateEeHazards(dt);

    for (var i = W.tracers.length - 1; i >= 0; i--) {
      var t = W.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { G.scene.remove(t.mesh); W.tracers.splice(i, 1); }
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
        else G.scene.remove(fl.mesh);
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
