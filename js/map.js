/* ===========================================================================
   DER WETTERJUNGE & FRIENDS — map.js
   Turns the ASCII grid in config.js into geometry, colliders, doors,
   window barricades, machines, teleporters and lighting.
   Procedural textures + lamp fixtures give rooms a lived-in look.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G, CFG = null;

  var WALL_H = 4, WALL_T = 0.35, CELL = 4;
  var OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  // FLOOR CULLING — the floor whose geometry is currently being built. addBox
  // stamps it on every mesh (and addLamp on every room light) so a stacked map
  // can hide the floors the player isn't on. _multiFloor gates the bookkeeping
  // so flat legacy maps stay byte-identical (nothing is ever tagged or hidden).
  var _fy = 0, _multiFloor = false, _fyByPos = false;

  /* -------------------------------------------------- procedural textures */
  function makeCanvas(s) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = s;
    return cv;
  }
  function speckle(c, s, n, alpha, light) {
    for (var i = 0; i < n; i++) {
      var v = Math.random();
      c.fillStyle = light && v > 0.5
        ? 'rgba(255,255,255,' + alpha * Math.random() + ')'
        : 'rgba(0,0,0,' + alpha * Math.random() + ')';
      var r = 1 + Math.random() * 3;
      c.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
  }
  function tex(cv) {
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // max anisotropic filtering: floors/walls stay crisp at grazing angles.
    // Near-free on any GPU of the last decade (16 is the universal cap).
    t.anisotropy = 16;
    return t;
  }

  function wallTexture() {
    var s = 256, cv = makeCanvas(s), c = cv.getContext('2d');
    if (CFG && CFG.cur && CFG.cur.id === 'derriese') {
      // Der Riese is wartime masonry, not prefab concrete panels. Uneven brick
      // courses, pale mortar, soot and damp streaking keep the factory cohesive
      // from both courtyards and stop the facades reading as clean white boxes.
      c.fillStyle = '#59443a'; c.fillRect(0, 0, s, s);
      var bh = 25, bw = 55;
      for (var br = 0; br <= s / bh; br++) {
        var by = br * bh, shift = br % 2 ? bw / 2 : 0;
        c.fillStyle = br % 3 ? '#684b3e' : '#5d443a';
        c.fillRect(0, by + 2, s, bh - 4);
        c.strokeStyle = 'rgba(190,180,158,0.34)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, by); c.lineTo(s, by); c.stroke();
        for (var bx = -shift; bx < s; bx += bw) {
          c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by + bh); c.stroke();
        }
      }
      speckle(c, s, 950, 0.2, true);
      for (var ds = 0; ds < 18; ds++) {
        var dx = Math.random() * s;
        var dg = c.createLinearGradient(dx, 0, dx, s);
        dg.addColorStop(0, 'rgba(18,18,16,0)');
        dg.addColorStop(1, 'rgba(18,18,16,' + (0.18 + Math.random() * 0.28) + ')');
        c.fillStyle = dg; c.fillRect(dx, 0, 3 + Math.random() * 10, s);
      }
      c.fillStyle = 'rgba(18,20,18,0.62)'; c.fillRect(0, s - 25, s, 25);
      return tex(cv);
    }
    c.fillStyle = '#8d8a82'; c.fillRect(0, 0, s, s);
    // concrete panel lines
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
    c.strokeRect(4, 4, s - 8, s - 8);
    c.beginPath(); c.moveTo(s / 2, 4); c.lineTo(s / 2, s - 4); c.stroke();
    speckle(c, s, 700, 0.16, true);
    // grime streaks
    for (var i = 0; i < 14; i++) {
      var x = Math.random() * s;
      var g = c.createLinearGradient(x, 0, x, s);
      g.addColorStop(0, 'rgba(30,25,20,0)');
      g.addColorStop(1, 'rgba(30,25,20,' + (0.1 + Math.random() * 0.2) + ')');
      c.fillStyle = g;
      c.fillRect(x, 0, 3 + Math.random() * 9, s);
    }
    // baseboard band
    c.fillStyle = 'rgba(20,18,15,0.55)';
    c.fillRect(0, s - 26, s, 26);
    c.fillStyle = 'rgba(255,255,255,0.07)';
    c.fillRect(0, s - 28, s, 3);
    return tex(cv);
  }

  function floorTexture() {
    var s = 256, cv = makeCanvas(s), c = cv.getContext('2d');
    c.fillStyle = '#8b887e'; c.fillRect(0, 0, s, s);
    // 2x2 tiles per 4m cell
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3;
    c.strokeRect(1, 1, s - 2, s - 2);
    c.beginPath();
    c.moveTo(s / 2, 0); c.lineTo(s / 2, s);
    c.moveTo(0, s / 2); c.lineTo(s, s / 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.fillRect(0, 0, s / 2, s / 2); c.fillRect(s / 2, s / 2, s / 2, s / 2);
    speckle(c, s, 900, 0.14, true);
    // cracks
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      c.beginPath();
      var x = Math.random() * s, y = Math.random() * s;
      c.moveTo(x, y);
      for (var j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; c.lineTo(x, y); }
      c.stroke();
    }
    return tex(cv);
  }

  function woodTexture() {
    var s = 256, cv = makeCanvas(s), c = cv.getContext('2d');
    c.fillStyle = '#7a5836'; c.fillRect(0, 0, s, s);
    for (var i = 0; i < 9; i++) {
      c.fillStyle = 'rgba(' + (40 + Math.random() * 40) + ',' + (24 + Math.random() * 26) + ',12,' + (0.25 + Math.random() * 0.3) + ')';
      c.fillRect(0, i * 30 + Math.random() * 6, s, 10 + Math.random() * 14);
    }
    c.strokeStyle = 'rgba(30,18,8,0.5)';
    for (var k = 0; k < 30; k++) {
      c.lineWidth = 1 + Math.random();
      c.beginPath();
      var y = Math.random() * s;
      c.moveTo(0, y);
      c.bezierCurveTo(s * 0.3, y + (Math.random() - 0.5) * 14, s * 0.7, y + (Math.random() - 0.5) * 14, s, y);
      c.stroke();
    }
    speckle(c, s, 250, 0.1);
    return tex(cv);
  }

  function metalTexture() {
    var s = 128, cv = makeCanvas(s), c = cv.getContext('2d');
    c.fillStyle = '#9a9da3'; c.fillRect(0, 0, s, s);
    for (var i = 0; i < 220; i++) {
      c.strokeStyle = 'rgba(' + (Math.random() > 0.5 ? '255,255,255' : '0,0,0') + ',' + Math.random() * 0.09 + ')';
      c.lineWidth = 1;
      var y = Math.random() * s;
      c.beginPath(); c.moveTo(0, y); c.lineTo(s, y + (Math.random() - 0.5) * 4); c.stroke();
    }
    speckle(c, s, 120, 0.12, true);
    return tex(cv);
  }

  function blobTexture() {
    var s = 64, cv = makeCanvas(s), c = cv.getContext('2d');
    var g = c.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    var t = new THREE.CanvasTexture(cv);
    return t;
  }

  function moonTexture() {
    var s = 128, cv = makeCanvas(s), c = cv.getContext('2d');
    var g = c.createRadialGradient(s / 2, s / 2, 8, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(235,240,255,1)');
    g.addColorStop(0.35, 'rgba(210,220,250,0.9)');
    g.addColorStop(0.55, 'rgba(150,170,220,0.25)');
    g.addColorStop(1, 'rgba(120,140,200,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }

  // big inverted gradient dome: deep zenith -> tinted horizon haze + soft clouds
  function skyDome(atmos) {
    var w = 1024, h = 512, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    var zen = new THREE.Color(atmos.sky).multiplyScalar(0.7);
    var hor = new THREE.Color(atmos.fog).lerp(new THREE.Color(0x8a93b5), 0.4);
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#' + zen.getHexString());
    g.addColorStop(0.62, '#' + new THREE.Color(atmos.sky).lerp(hor, 0.5).getHexString());
    g.addColorStop(1, '#' + hor.getHexString());
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // soft cloud bands near the horizon
    for (var i = 0; i < 26; i++) {
      var y = h * (0.45 + Math.random() * 0.5);
      var cw = 60 + Math.random() * 220, ch = 10 + Math.random() * 26;
      var cg = c.createRadialGradient(0, 0, 0, 0, 0, cw);
      var alpha = 0.05 + Math.random() * 0.12;
      cg.addColorStop(0, 'rgba(200,210,235,' + alpha + ')');
      cg.addColorStop(1, 'rgba(200,210,235,0)');
      c.save();
      c.translate(Math.random() * w, y);
      c.scale(1, ch / cw);
      c.fillStyle = cg;
      c.beginPath(); c.arc(0, 0, cw, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    var tex2 = new THREE.CanvasTexture(cv);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 20),
      new THREE.MeshBasicMaterial({ map: tex2, side: THREE.BackSide, fog: false, depthWrite: false }));
    return dome;
  }

  /* ------------------------------------------------------------- helpers */
  function mat(color, opts) {
    var m = new THREE.MeshLambertMaterial({ color: color });
    if (opts) Object.keys(opts).forEach(function (k) { m[k] = opts[k]; });
    return m;
  }

  function addBox(w, h, d, x, y, z, material, opts) {
    opts = opts || {};
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    G.scene.add(mesh);
    // staircases span two floors, so their meshes are tagged by their ACTUAL Y
    // (nearest floor) rather than the build-phase floor — otherwise the grand
    // deck (y=+4) and service landing (y=-4) cull with the wrong floor.
    if (_multiFloor) {
      mesh.userData.fy = _fyByPos ? Math.round(y / WALL_H) * WALL_H : _fy;
      G.map.cullables.push(mesh);
    }
    if (opts.collide) {
      // opts.cy1/cy2 give an explicit collider Y-band (per-floor walls); default
      // [0,99] keeps every existing call (flat maps) unchanged
      mesh.userData.collider = G.map.addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, opts.cy1, opts.cy2);
    }
    if (opts.solid) G.map.solidMeshes.push(mesh);
    return mesh;
  }

  function textSprite(text, color, scale, bg) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    var c = cv.getContext('2d');
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, 512, 128); }
    c.font = 'bold 56px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#000'; c.shadowBlur = 10;
    c.fillStyle = color || '#ffd';
    c.fillText(text, 256, 64);
    var tx = new THREE.CanvasTexture(cv);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
    sp.scale.set((scale || 2.4), (scale || 2.4) / 4, 1);
    return sp;
  }

  // small crisp price chip (just the number) shown over buyable debris doors
  function costChip(cost) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    var c = cv.getContext('2d');
    c.font = 'bold 70px Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 9; c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.strokeText(cost, 128, 64);
    c.fillStyle = '#ffe27a';
    c.fillText(cost, 128, 64);
    var tx = new THREE.CanvasTexture(cv);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
    sp.scale.set(1.6, 0.8, 1);
    return sp;
  }

  function chalkTexture(lines) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var c = cv.getContext('2d');
    c.strokeStyle = '#e8e2cf'; c.fillStyle = '#e8e2cf';
    c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(40, 120); c.lineTo(190, 120); c.lineTo(200, 132); c.lineTo(150, 132);
    c.lineTo(140, 170); c.lineTo(115, 170); c.lineTo(122, 132); c.lineTo(40, 132);
    c.closePath(); c.stroke();
    c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center';
    lines.forEach(function (l, i) { c.fillText(l, 128, 210 + i * 32); });
    return new THREE.CanvasTexture(cv);
  }

  /* --------------------------------------------------------- public state */
  G.map = {
    parsed: null,
    colliders: [],
    surfaces: [],
    cellHeights: null,
    solidMeshes: [],
    doors: {},
    windows: [],
    perkMachines: [],
    wallbuys: [],
    boxSpots: [],
    traps: [],
    teleporters: [],
    roomLights: [],
    lamps: [],
    power: false,
    effects: [],
    decalCount: 0,

    // colliders are XZ boxes with an optional vertical span [y1,y2]. Walls omit
    // the span and read as full height; raised platforms/railings pass one so
    // you can walk on top of (or beneath) them instead of being blocked.
    addCollider: function (x1, z1, x2, z2, y1, y2) {
      var c = { x1: x1, z1: z1, x2: x2, z2: z2,
                y1: y1 == null ? 0 : y1, y2: y2 == null ? 99 : y2, on: true };
      this.colliders.push(c);
      return c;
    },

    // a walkable surface: a flat top (y) or a linear ramp along one axis.
    addSurface: function (s) { this.surfaces.push(s); return s; },

    // ---- Y-as-first-class: a region/room's floor height (single source of
    // truth). Defaults to 0, so every existing flat map is unchanged. Stacked
    // floors (Kurhaus) set ROOMS[rid].floorY (e.g. -4 / 0 / +4).
    floorYOf: function (rid) {
      var R = G.CFG.ROOMS;
      return (rid && R && R[rid] && R[rid].floorY) || 0;
    },
    // is there another floor exactly one storey (WALL_H) above this one? Walls on
    // a floor with a floor above are capped to [floorY, floorY+WALL_H] so the
    // bands tile edge-to-edge; the top/only floor keeps tall walls so jumpers
    // can't clip out. Flat maps -> always false -> walls stay [0,99].
    floorAbove: function (fy) {
      var R = G.CFG.ROOMS, ks = R ? Object.keys(R) : [];
      for (var i = 0; i < ks.length; i++) {
        if (Math.abs((R[ks[i]].floorY || 0) - (fy + WALL_H)) < 0.5) return true;
      }
      return false;
    },

    // highest walkable surface at (x,z) a body with feet at feetY can stand on,
    // within a vertical "climb" tolerance. There is NO implicit ground plane:
    // each floor (and deck/ramp) is an explicit surface, so this returns the
    // correct floor for the body's current Y — including a sub-level below 0.
    // Surfaces above feetY+climb are ignored (you're underneath them). With no
    // surface beneath, returns the void baseline (off-map / fell through).
    supportAt: function (x, z, feetY, climb, ignoreBridge) {
      // ground baseline: 0 for flat maps (unchanged), but a deep void sentinel
      // once a map has sub-zero floors, so a body on a lower floor isn't snapped
      // up to a phantom Y=0 plane. Floors are explicit surfaces below.
      var best = this.minFloorY < 0 ? this.minFloorY - 50 : 0, ss = this.surfaces, i, s, h;
      for (i = 0; i < ss.length; i++) {
        s = ss[i];
        // bridges (e.g. a catwalk over a doorway) are walkable for bodies but
        // are skipped when sampling cell heights, so ground nav still routes
        // under them through the passage below
        if (ignoreBridge && s.bridge) continue;
        if (x < s.x1 || x > s.x2 || z < s.z1 || z > s.z2) continue;
        if (s.ramp) {
          var coord = s.axis === 'x' ? x : z;
          var t = (coord - s.c1) / (s.c2 - s.c1);
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          h = s.h1 + (s.h2 - s.h1) * t;
        } else h = s.y;
        if (h <= feetY + climb + 1e-3 && h > best) best = h;
      }
      return best;
    },
    cellHeightAt: function (col, row) {
      if (!this.cellHeights || row < 0 || col < 0 ||
          row >= this.cellHeights.length || col >= this.cellHeights[0].length) return 0;
      return this.cellHeights[row][col];
    },

    // every distinct walkable surface height at (x,z) — used by the multi-layer
    // nav builder to discover stacked floors (ground is added separately)
    surfaceLevelsAt: function (x, z) {
      var out = [], ss = this.surfaces, i, s, h;
      for (i = 0; i < ss.length; i++) {
        s = ss[i];
        if (x < s.x1 || x > s.x2 || z < s.z1 || z > s.z2) continue;
        if (s.ramp) {
          var coord = s.axis === 'x' ? x : z;
          var t = (coord - s.c1) / (s.c2 - s.c1);
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          h = s.h1 + (s.h2 - s.h1) * t;
        } else h = s.y;
        var dup = false;
        for (var j = 0; j < out.length; j++) if (Math.abs(out[j] - h) < 0.06) { dup = true; break; }
        if (!dup) out.push(h);
      }
      return out;
    },

    // is a standing body (feet at h) crushed by a solid collider here? Used to
    // reject nav nodes/edges that pass through walls, rails or low ceilings —
    // and naturally keeps ground walkable beneath a thin upper floor.
    bodyBlocked: function (x, z, h) {
      var cols = this.colliders, lo = h + 0.25, hi = h + 1.7;
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        if (!c.on) continue;
        if (x < c.x1 || x > c.x2 || z < c.z1 || z > c.z2) continue;
        if (hi > c.y1 && lo < c.y2) return true;
      }
      return false;
    },

    // is the straight line between two ground points cut by a solid wall at
    // body height? sampled finer than the thinnest wall (0.35m) so a zombie or
    // boss can never claw / charge the player through a wall it's pinned against
    losBlocked: function (ax, az, bx, bz, h) {
      var dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
      if (len < 1e-4) return false;
      var steps = Math.max(2, Math.ceil(len / 0.12));
      for (var i = 1; i < steps; i++) {
        var t = i / steps;
        if (this.bodyBlocked(ax + dx * t, az + dz * t, h)) return true;
      }
      return false;
    },

    // the floor a body at height y stands on (the highest floor at/below y). With
    // no y, or before floors are recorded, this resolves to the primary grid —
    // so every legacy 2D caller behaves exactly as before.
    floorAtY: function (y) {
      if (y === undefined || y === null || !this.floors) return null;
      var best = null;
      for (var i = 0; i < this.floors.length; i++) {
        var f = this.floors[i];
        if (f.floorY <= y + 1.0 && (!best || f.floorY > best.floorY)) best = f;
      }
      return best || this.floors[0];
    },
    parsedAtY: function (y) { var f = this.floorAtY(y); return f ? f.parsed : this.parsed; },
    roomAt: function (x, z, y) {
      var cr = CFG.worldToCell(x, z);
      var cell = this.cellAt(cr.col, cr.row, y);
      if (!cell) return null;
      if (cell.type === 'room') return cell.room;
      if (cell.type === 'door') return this.parsedAtY(y).doors[cell.door].rooms[0];
      return null;
    },
    cellAt: function (col, row, y) {
      var P = this.parsedAtY(y);
      if (row < 0 || row >= P.rows || col < 0 || col >= P.cols) return null;
      return P.cells[row][col];
    },
    passable: function (col, row) {
      var cell = this.cellAt(col, row);
      if (!cell) return false;
      if (cell.type === 'room') return true;
      if (cell.type === 'door') return this.doors[cell.door].open;
      return false;
    },

    reachableRooms: { S: true },
    recomputeReachable: function () {
      var seen = { S: true }, stack = ['S'], self = this;
      while (stack.length) {
        var room = stack.pop();
        Object.keys(this.doors).forEach(function (id) {
          var d = self.doors[id];
          if (!d.open) return;
          if (d.rooms.indexOf(room) >= 0) {
            d.rooms.forEach(function (r2) {
              if (!seen[r2]) { seen[r2] = true; stack.push(r2); }
            });
          }
        });
      }
      this.reachableRooms = seen;
    },

    openDoor: function (id) {
      var d = this.doors[id];
      if (d.open) return;
      d.open = true;
      d.collider.on = false;
      var i = this.solidMeshes.indexOf(d.mesh);
      if (i >= 0) this.solidMeshes.splice(i, 1);
      d.anim = 0;
      if (d.sprite) { G.scene.remove(d.sprite); d.sprite = null; }
      this.recomputeReachable();
      if (G.zombies) G.zombies.flowDirty = true;
      if (G.nav) G.nav.dirty = true;   // reconnect the graph through the new opening
    },

    flyingPlank: function (pos, dir) {
      var m = addBox(1.4, 0.22, 0.07, pos.x, pos.y, pos.z, G.mats.plank);
      m.userData.vel = new THREE.Vector3(dir.x * 3 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2,
                                         dir.z * 3 + (Math.random() - 0.5) * 2);
      m.userData.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      m.userData.life = 1.2;
      this.effects.push(m);
    },

    update: function (dt) {
      var self = this;
      // FLOOR CULLING — on a stacked map, hide the geometry/lights of floors more
      // than one level away from the player. The shaft stays correct because the
      // adjacent floor is always shown (so the atrium up/down view never voids),
      // and we only re-walk the cullable list when the shown set actually changes
      // (a floor transition), so per-frame cost is one cheap key comparison.
      if (this.cullables && this.cullables.length) {
        var py = G.player.pos.y, fl = this.floors, key = '|';
        for (var fi = 0; fi < fl.length; fi++) {
          if (Math.abs(fl[fi].floorY - py) <= WALL_H + 2.5)  // current + adjacent
            key += fl[fi].floorY + '|';
        }
        if (key !== this._shownKey) {
          this._shownKey = key;
          for (var ci = 0; ci < this.cullables.length; ci++) {
            var c = this.cullables[ci];
            c.visible = key.indexOf('|' + c.userData.fy + '|') !== -1;
          }
        }
      }
      // keep the sky dome centered on the camera so its far side never crosses
      // the far clip plane (otherwise looking up clips a black hole in the sky)
      if (this.sky && G.camera) this.sky.position.copy(G.camera.position);
      // storm-station ambience: sweep the radar dish, blink the comms beacon
      if (this.radar) this.radar.rotation.y += dt * 0.6;
      if (this.beacon) {
        var on = Math.sin(G.time * 3) > 0;
        this.beacon.material.emissiveIntensity = on ? 1.1 : 0.25;
        if (this.beaconLight) this.beaconLight.intensity = on ? 0.8 : 0.1;
      }
      Object.keys(this.doors).forEach(function (id) {
        var d = self.doors[id];
        if (d.open && d.anim !== undefined && d.anim < 1) {
          d.anim = Math.min(1, d.anim + dt * 0.7);
          d.mesh.position.y = d.baseY - d.anim * (WALL_H - 0.2);
          if (d.anim >= 1) { G.scene.remove(d.mesh); }
        }
      });
      for (var i = this.effects.length - 1; i >= 0; i--) {
        var m = this.effects[i];
        m.userData.life -= dt;
        m.userData.vel.y -= 9.8 * dt;
        m.position.addScaledVector(m.userData.vel, dt);
        m.rotation.x += m.userData.spin.x * dt;
        m.rotation.z += m.userData.spin.z * dt;
        if (m.userData.life <= 0) { G.scene.remove(m); this.effects.splice(i, 1); }
      }
      this.teleporters.forEach(function (t) {
        var s = 1 + Math.sin(G.time * 3 + t.pos.x) * 0.08;
        t.ring.scale.set(s, 1, s);
        var c = !self.power ? 0x331111 : (t.linked ? 0x22ddff : (t.linking ? 0xffaa22 : 0xddbb33));
        t.ring.material.color.setHex(c);
        t.ring.material.emissive = t.ring.material.color;
        if (t.light) t.light.intensity = self.power ? (t.linked ? 1.2 : 0.5) : 0;
      });
      // lamp flicker
      this.lamps.forEach(function (l, i) {
        var base = self.power ? 1.7 : 0.75;
        var fl = 1 + Math.sin(G.time * 9 + i * 7) * 0.04 + Math.sin(G.time * 23 + i * 3) * 0.025;
        l.light.intensity = base * fl;
        l.bulb.material.emissiveIntensity = (self.power ? 1.0 : 0.35) * fl;
      });

      // KURHAUS living-map pass — pure mesh/material animation, no light churn
      var KA = this.kAnim;
      if (KA) {
        for (var ei = 0; ei < KA.embers.length; ei++) {      // embers rise + die
          var e2 = KA.embers[ei], t2 = (G.time * e2.spd + e2.ph) % 3.0;
          e2.m.position.set(e2.x + Math.sin(G.time * 1.3 + e2.ph) * 0.25, 0.25 + t2, e2.z);
          e2.m.scale.setScalar(Math.max(0.15, 1 - t2 / 3.0));
        }
        for (var si = 0; si < KA.steam.length; si++) {       // steam lifts + fades
          var s2 = KA.steam[si], ts = (G.time * s2.spd + s2.ph) % 2.4;
          s2.m.position.y = 0.5 + ts;
          s2.mat.opacity = 0.24 * (1 - ts / 2.4);
          s2.m.scale.setScalar(0.8 + ts * 0.5);
        }
        for (var ci2 = 0; ci2 < KA.candles.length; ci2++)    // candle flicker
          KA.candles[ci2].scale.setScalar(0.75 + 0.45 * Math.abs(Math.sin(G.time * 11 + ci2 * 2.7)));
        if (KA.manifold)                                      // the manifold breathes
          KA.manifold.mat.opacity = this.power ? 0.3 + 0.18 * Math.sin(G.time * 4)
                                               : 0.1 + 0.05 * Math.sin(G.time * 1.2);
        for (var ni = 0; ni < KA.needles.length; ni++)        // gauges twitch on power
          KA.needles[ni].rotation.z = -0.8 + (this.power ? Math.sin(G.time * 8 + ni * 2) * 0.14 : 0);
        if (KA.bucket) KA.bucket.position.x += Math.sin(G.time * 0.9) * 0.0012;  // slow sway
        // Voss notices: once the soul chest wakes, the portrait's face burns aether
        if (KA.face && !this._vossWoke && G.interact && G.interact.ee && G.interact.ee.box) {
          this._vossWoke = true;
          KA.face.material.color.setHex(0x9c6cf0);
          KA.face.material.emissive && KA.face.material.emissive.setHex(0x6a3ab8);
        }
      }

      // AETHER SURGE — pulse the marker ring while a wing is surging
      if (this.surge && this.surgeRing) {
        this.surgeRing.visible = true;
        this.surgeRing.material.opacity = 0.3 + 0.2 * Math.sin(G.time * 5);
        this.surgeRing.scale.setScalar(1 + 0.06 * Math.sin(G.time * 3));
      } else if (this.surgeRing) this.surgeRing.visible = false;
    },

    setPower: function () {
      this.power = true;
      G.hemi.intensity = 0.95;
      if (G.amb) G.amb.intensity = 0.7;
      this.perkMachines.forEach(function (p) { if (p.light) p.light.intensity = 0.9; });
    }
  };

  /* ----------------------------------------------------------- the build */
  G.map.build = function () {
    CFG = G.CFG;
    // adopt this map's grid scale (CFG.CELL is set by setMap, default 4m). The
    // module-level CELL is cached at load, so refresh it for every build.
    CELL = CFG.CELL || 4;
    // floor-culling bookkeeping: only stacked maps (>1 floor) tag/hide geometry
    _multiFloor = (CFG.cur._floors || []).length > 1;
    _fy = 0; G.map.cullables = []; G.map._shownKey = null;
    var P = G.map.parsed = CFG.parseGrid(CFG.GRID);
    var map = G.map;

    // shared textures + materials
    G.tex = {
      wall: wallTexture(), floor: floorTexture(), wood: woodTexture(),
      metal: metalTexture(), blob: blobTexture()
    };
    // per-map surface palette (falls back to a neutral default) — gives each
    // map one coherent material identity instead of every map sharing the same
    // tan concrete and grey steel.
    var pal = CFG.cur.palette || {};
    function palC(key, def) { return pal[key] != null ? pal[key] : def; }
    G.mats = {
      wallA: new THREE.MeshLambertMaterial({ map: G.tex.wall, color: palC('wallA', 0xb9b5aa) }),
      wallB: new THREE.MeshLambertMaterial({ map: G.tex.wall, color: palC('wallB', 0xa8a49a) }),
      wood: new THREE.MeshLambertMaterial({ map: G.tex.wood, color: palC('wood', 0xc9b496) }),
      plank: new THREE.MeshLambertMaterial({ map: G.tex.wood, color: palC('plank', 0xdbc8a8) }),
      metal: new THREE.MeshLambertMaterial({ map: G.tex.metal, color: palC('metal', 0x8e949c) })
    };
    // rebuild the shared prop material cache against this map's fresh textures
    if (G.MAT && G.MAT.reset) G.MAT.reset();

    // per-map atmosphere
    var atmos = CFG.cur.atmos;
    G.scene.background = new THREE.Color(atmos.sky);
    G.scene.fog.color.setHex(atmos.fog);
    G.scene.fog.density = 0;   // no distance fog (player preference) — clear air
    // per-map mood: tint the global fill so each map reads distinctly —
    // warm decay (Nacht), cold steel (Der Riese), frozen blue (Wetterjunge).
    // Falls back to the neutral defaults if a map omits the tint fields.
    G.hemi.intensity = 0.65;
    if (atmos.hemiSky != null) G.hemi.color.setHex(atmos.hemiSky);
    if (atmos.hemiGround != null) G.hemi.groundColor.setHex(atmos.hemiGround);
    if (G.amb) {
      G.amb.intensity = atmos.ambI != null ? atmos.ambI : 0.5;
      if (atmos.amb != null) G.amb.color.setHex(atmos.amb);
    }

    map.risers = (CFG.RISERS || []).map(function (cr) {
      var wc = CFG.cellToWorld(cr[0], cr[1]);
      return { pos: new THREE.Vector3(wc.x, 0, wc.z), room: P.cells[cr[1]][cr[0]].room };
    });

    // room centers up front (machine decals + lights + AI all use them)
    Object.keys(P.rooms).forEach(function (rid) {
      var cx = 0, cz = 0;
      P.rooms[rid].cells.forEach(function (cr) {
        var w = CFG.cellToWorld(cr[0], cr[1]);
        cx += w.x; cz += w.z;
      });
      P.rooms[rid].center = new THREE.Vector3(cx / P.rooms[rid].cells.length, 0,
                                              cz / P.rooms[rid].cells.length);
    });

    // Register every authored floor before placing machines and quest props.
    // Upper-floor objects can therefore resolve their real room/wall immediately
    // instead of being positioned against the ground-floor grid beneath them.
    map.floors = (CFG.cur._floors || [{ id: '1', floorY: 0, GRID: CFG.GRID }]).map(function (f) {
      var parsed = f === CFG.cur._primary ? P : CFG.parseGrid(f.GRID), fyy = f.floorY || 0;
      Object.keys(parsed.rooms).forEach(function (rid) {
        var cells = parsed.rooms[rid].cells, sx = 0, sz = 0;
        cells.forEach(function (cr) { var w = CFG.cellToWorld(cr[0], cr[1]); sx += w.x; sz += w.z; });
        parsed.rooms[rid].center = new THREE.Vector3(sx / cells.length, fyy, sz / cells.length);
      });
      return { id: f.id, floorY: fyy, parsed: parsed };
    });

    // Resolve stacking per cell, rather than merely asking whether the map has
    // any room one storey above. This is the structural seam contract used by
    // walls, doorway headers and ceilings: only the footprint actually covered
    // by an authored upper storey is capped at the shared floor boundary.
    map.floorCellAboveAt = function (col, row, fy) {
      var best = null;
      this.floors.forEach(function (fl) {
        if (fl.floorY <= fy + 0.1) return;
        var rr = fl.parsed.cells[row], cell = rr && rr[col];
        if (!cell || cell.type === 'void') return;
        if (!best || fl.floorY < best.floorY) best = { floor: fl, cell: cell, floorY: fl.floorY };
      });
      return best;
    };

    var winLookup = {};
    CFG.WINDOWS.forEach(function (w, i) { winLookup[w.cell[0] + ',' + w.cell[1] + ',' + w.dir] = i; });

    function wallEdge(col, row, dir, isWindow) {
      var wc = CFG.cellToWorld(col, row);
      var o = OFF[dir];
      var cx = wc.x + o[0] * CELL / 2, cz = wc.z + o[1] * CELL / 2;
      var alongX = (dir === 'N' || dir === 'S');
      var m = (col + row) % 2 ? G.mats.wallA : G.mats.wallB;
      // shallow architectural trim: a base reinforcement band + an upper string
      // course break up the flat wall (flush, no collider). Proud of the wall so
      // only the room-facing side reads.
      var baseMat = G.MAT.get('concreteDark'), trimMat = G.MAT.get('darkIron');
      // this wall belongs to its cell's floor: lift its geometry to floorY and
      // give the collider a finite per-floor band [floorY, floorY+WALL_H] when a
      // floor sits above (so bands tile edge-to-edge), else a tall band so a
      // jumper on the top/only floor can't clip out. Flat maps -> fy 0, tall -> [0,99].
      var fcell = map.cellAt(col, row) || {};
      var fy = fcell.type === 'door' ? doorFloorY(col, row) : map.floorYOf(fcell.room);
      var stackedHere = !!map.floorCellAboveAt(col, row, fy);
      var wallTop = fy + (stackedHere ? WALL_H : 99);
      // Leave a shallow rebate at a stacked seam. The real upper-floor slab
      // fills it, hiding the downstairs wall top instead of z-fighting through
      // the upstairs finish as a room-shaped outline.
      var visualWallH = stackedHere ? WALL_H - 0.28 : WALL_H;
      function band(y, h, depth, mm) {
        if (alongX) addBox(CELL + WALL_T, h, WALL_T + depth, cx, fy + y, cz, mm);
        else addBox(WALL_T + depth, h, CELL + WALL_T, cx, fy + y, cz, mm);
      }
      if (!isWindow) {
        if (alongX) addBox(CELL + WALL_T, visualWallH, WALL_T, cx, fy + visualWallH / 2, cz, m, { collide: true, solid: true, cy1: fy, cy2: wallTop });
        else addBox(WALL_T, visualWallH, CELL + WALL_T, cx, fy + visualWallH / 2, cz, m, { collide: true, solid: true, cy1: fy, cy2: wallTop });
        band(0.22, 0.44, 0.08, baseMat);       // baseboard / lower reinforcement
        band(visualWallH - 0.22, 0.12, 0.05, trimMat); // upper string course
        return null;
      }
      var sillH = 1.0, openTop = 2.6, postW = 0.7;
      if (alongX) {
        addBox(CELL, sillH, WALL_T, cx, fy + sillH / 2, cz, m, { solid: true });
        addBox(postW, visualWallH, WALL_T, cx - CELL / 2 + postW / 2, fy + visualWallH / 2, cz, m, { solid: true });
        addBox(postW, visualWallH, WALL_T, cx + CELL / 2 - postW / 2, fy + visualWallH / 2, cz, m, { solid: true });
        addBox(CELL, visualWallH - openTop, WALL_T, cx, fy + (visualWallH + openTop) / 2, cz, m, { solid: true });
        // framed opening: header lintel + sill cap
        addBox(CELL - postW * 1.4, 0.16, WALL_T + 0.12, cx, fy + openTop + 0.02, cz, trimMat);
        addBox(CELL - postW * 1.4, 0.12, WALL_T + 0.14, cx, fy + sillH - 0.02, cz, trimMat);
      } else {
        addBox(WALL_T, sillH, CELL, cx, fy + sillH / 2, cz, m, { solid: true });
        addBox(WALL_T, visualWallH, postW, cx, fy + visualWallH / 2, cz - CELL / 2 + postW / 2, m, { solid: true });
        addBox(WALL_T, visualWallH, postW, cx, fy + visualWallH / 2, cz + CELL / 2 - postW / 2, m, { solid: true });
        addBox(WALL_T, visualWallH - openTop, CELL, cx, fy + (visualWallH + openTop) / 2, cz, m, { solid: true });
        addBox(WALL_T + 0.12, 0.16, CELL - postW * 1.4, cx, fy + openTop + 0.02, cz, trimMat);
        addBox(WALL_T + 0.14, 0.12, CELL - postW * 1.4, cx, fy + sillH - 0.02, cz, trimMat);
      }
      band(0.22, 0.44, 0.08, baseMat);          // baseboard wraps the window wall too
      map.addCollider(cx - (alongX ? CELL / 2 : WALL_T / 2), cz - (alongX ? WALL_T / 2 : CELL / 2),
                      cx + (alongX ? CELL / 2 : WALL_T / 2), cz + (alongX ? WALL_T / 2 : CELL / 2), fy, wallTop);
      return { cx: cx, cz: cz, alongX: alongX, dirVec: new THREE.Vector3(o[0], 0, o[1]) };
    }

    // one floor material per room (shared by its cells)
    var floorMats = {};
    Object.keys(CFG.ROOMS).forEach(function (rid) {
      floorMats[rid] = new THREE.MeshLambertMaterial({
        map: G.tex.floor,
        color: new THREE.Color(CFG.ROOMS[rid].floor).multiplyScalar(2.4).getHex()
      });
    });
    var doorFloorMat = new THREE.MeshLambertMaterial({ map: G.tex.floor, color: 0x7d7a72 });

    // a door cell sits at the floor height of whichever room it touches (so a
    // threshold lines up with its floor); flat maps -> always 0
    function doorFloorY(c, r) {
      var fs = [[0, -1], [0, 1], [1, 0], [-1, 0]];
      for (var i = 0; i < fs.length; i++) {
        var n = map.cellAt(c + fs[i][0], r + fs[i][1]);
        if (n && n.type === 'room') return map.floorYOf(n.room);
      }
      return 0;
    }
    // lowest floor in the map (drives the supportAt void baseline). 0 for every
    // existing flat map; negative once a sub-level (Underbath) is added.
    map.minFloorY = 0;
    Object.keys(CFG.ROOMS || {}).forEach(function (rid) {
      var fy = map.floorYOf(rid); if (fy < map.minFloorY) map.minFloorY = fy;
    });

    // cells whose ground slab is deliberately cut away (a stairwell descending
    // to the floor below). Default none — every existing flat map keeps its
    // full floor. A descending staircase (buildStage descend:true) fills the gap.
    var floorOmit = {};
    (CFG.cur.FLOOR_OMIT || []).forEach(function (cr) { floorOmit[cr[0] + ',' + cr[1]] = true; });

    var floorGeo = new THREE.PlaneGeometry(CELL, CELL);
    for (var r = 0; r < P.rows; r++) {
      for (var c = 0; c < P.cols; c++) {
        var cell = P.cells[r][c];
        if (cell.type === 'void') continue;
        var wc = CFG.cellToWorld(c, r);
        // a door inherits the floor height of an adjacent room so thresholds line
        // up with whichever floor they connect
        var fy = cell.type === 'door' ? doorFloorY(c, r) : map.floorYOf(cell.room);
        // omitted cells keep their perimeter WALLS (so the stairwell pit can't
        // open out of the map) but drop the floor slab + surface so a descending
        // staircase can pass through to the level below
        if (!(cell.type === 'room' && floorOmit[c + ',' + r])) {
          var f = new THREE.Mesh(floorGeo, cell.type === 'door' ? doorFloorMat : floorMats[cell.room]);
          f.rotation.x = -Math.PI / 2;
          f.position.set(wc.x, fy, wc.z);
          G.scene.add(f);
          // explicit walkable floor SURFACE so supportAt/nav resolve the correct
          // floor per Y (replaces the old implicit infinite ground plane at 0)
          map.addSurface({ x1: wc.x - CELL / 2, x2: wc.x + CELL / 2, z1: wc.z - CELL / 2, z2: wc.z + CELL / 2, y: fy, floor: true });
        }

        ['N', 'S', 'E', 'W'].forEach(function (dir) {
          var o = OFF[dir];
          var nc = c + o[0], nr = r + o[1];
          var n = map.cellAt(nc, nr) || { type: 'void' };
          if (cell.type === 'room') {
            if (n.type === 'void') {
              var wIdx = winLookup[c + ',' + r + ',' + dir];
              var info = wallEdge(c, r, dir, wIdx !== undefined);
              if (info) buildWindow(wIdx, info, cell.room);
            } else if (n.type === 'room' && n.room !== cell.room) {
              if (dir === 'E' || dir === 'S') wallEdge(c, r, dir, false);
            }
          } else if (cell.type === 'door') {
            if (n.type === 'void') wallEdge(c, r, dir, false);
          }
        });
      }
    }

    // --- skybox: a big gradient dome with drifting cloud bands + horizon haze
    var sky = skyDome(atmos);
    G.scene.add(sky);
    map.sky = sky;

    // distant silhouette ring (mountains / structures) for depth + personality
    var ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(atmos.sky).multiplyScalar(1.6),
      fog: true, side: THREE.DoubleSide });
    for (var rg = 0; rg < 46; rg++) {
      var ra = rg / 46 * Math.PI * 2;
      var rdist = 150 + Math.random() * 30;
      var rh = 14 + Math.random() * 40;
      // Der Riese sits inside an industrial complex. Rectangular factory blocks
      // and stacks replace the generic pointed mountain cones whose triangular
      // peaks made every roof gap look like broken geometry.
      var ridge = CFG.cur.id === 'derriese'
        ? new THREE.Mesh(new THREE.BoxGeometry(14 + Math.random() * 24, rh * 0.55, 12 + Math.random() * 16), ringMat)
        : new THREE.Mesh(new THREE.ConeGeometry(10 + Math.random() * 18, rh, 4), ringMat);
      ridge.position.set(Math.cos(ra) * rdist, (CFG.cur.id === 'derriese' ? rh * 0.275 : rh / 2) - 6,
                         Math.sin(ra) * rdist);
      ridge.rotation.y = Math.random() * Math.PI;
      G.scene.add(ridge);
      if (CFG.cur.id === 'derriese' && rg % 6 === 0) {
        var stackSil = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, rh * 0.8, 8), ringMat);
        stackSil.position.set(Math.cos(ra) * (rdist - 7), rh * 0.4 - 6,
                              Math.sin(ra) * (rdist - 7));
        G.scene.add(stackSil);
      }
    }

    // outer ground, stars, moon
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500),
      new THREE.MeshLambertMaterial({ color: 0x232920 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    G.scene.add(ground);
    [1.0, 0.55].forEach(function (sz, gi) {
      var starGeo = new THREE.BufferGeometry();
      var stars = [];
      for (var s = 0; s < 380; s++) {
        var a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.45 + 0.06, rr = 180;
        stars.push(Math.cos(a) * Math.cos(e) * rr, Math.sin(e) * rr, Math.sin(a) * Math.cos(e) * rr);
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
      G.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: gi ? 0x8899bb : 0xccddff, size: sz, fog: false, sizeAttenuation: false
      })));
    });
    var moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTexture(), transparent: true, fog: false, depthWrite: false
    }));
    moon.position.set(80, 110, -120);
    moon.scale.set(38, 38, 1);
    G.scene.add(moon);

    /* ------------------------------------------------------------ windows */
    function buildWindow(idx, info, room) {
      var center = new THREE.Vector3(info.cx, 0, info.cz);
      var win = {
        idx: idx, room: room,
        pos: center,
        dir: info.dirVec,
        outside: center.clone().addScaledVector(info.dirVec, 2.2),
        inside: center.clone().addScaledVector(info.dirVec, -1.4),
        boards: 5, boardMeshes: [], tearer: null
      };
      for (var b = 0; b < 5; b++) {
        var bm = addBox(info.alongX ? 2.6 : 0.09, 0.28, info.alongX ? 0.09 : 2.6,
          info.cx, 1.1 + b * 0.34, info.cz, G.mats.plank);
        bm.rotation.y = (Math.random() - 0.5) * 0.12;
        bm.rotation.z = (Math.random() - 0.5) * 0.08;
        win.boardMeshes.push(bm);
      }
      win.setBoards = function (n) {
        n = Math.max(0, Math.min(5, n));
        this.boards = n;
        for (var i = 0; i < 5; i++) this.boardMeshes[i].visible = i < n;
      };
      win.tearBoard = function () {
        if (this.boards <= 0) return false;
        var bm = this.boardMeshes[this.boards - 1];
        G.map.flyingPlank(bm.position, this.dir.clone().negate());
        this.setBoards(this.boards - 1);
        G.audio.boardTear();
        return true;
      };
      map.windows.push(win);
    }

    /* -------------------------------------------------------------- doors */
    // build one buyable debris door at (wcx,wcz) on the floor at fy. Used for
    // Floor 1's doors AND (via buildExtraFloor / buildStage) for the stacked
    // floors' doors and the stair gates. The collider is a FINITE band
    // [fy, fy+WALL_H] — a tall [0,99] door would block the floor stacked above it.
    function buildBuyDoor(id, cost, name, rooms, wcx, wcz, fy, alongZ) {
      var mesh = alongZ
        ? addBox(CELL - 0.2, WALL_H - 0.4, 0.5, wcx, fy + (WALL_H - 0.4) / 2, wcz, G.mats.wood, { solid: true })
        : addBox(0.5, WALL_H - 0.4, CELL - 0.2, wcx, fy + (WALL_H - 0.4) / 2, wcz, G.mats.wood, { solid: true });
      for (var k = -1; k <= 1; k++) {
        var pm = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? CELL - 0.1 : 0.6, 0.3, alongZ ? 0.6 : CELL - 0.1), G.mats.plank);
        pm.position.set(0, k * 1.0, 0);
        pm.rotation[alongZ ? 'z' : 'x'] = k * 0.15;
        mesh.add(pm);
      }
      var collider = map.addCollider(wcx - CELL / 2, wcz - CELL / 2, wcx + CELL / 2, wcz + CELL / 2, fy, fy + WALL_H);
      var frameMat = G.MAT.get('darkIron');
      if (alongZ) {
        addBox(CELL, 0.32, 0.7, wcx, fy + WALL_H - 0.3, wcz, frameMat);                 // lintel
        addBox(0.3, WALL_H, 0.7, wcx - CELL / 2 + 0.15, fy + WALL_H / 2, wcz, frameMat); // jambs
        addBox(0.3, WALL_H, 0.7, wcx + CELL / 2 - 0.15, fy + WALL_H / 2, wcz, frameMat);
      } else {
        addBox(0.7, 0.32, CELL, wcx, fy + WALL_H - 0.3, wcz, frameMat);
        addBox(0.7, WALL_H, 0.3, wcx, fy + WALL_H / 2, wcz - CELL / 2 + 0.15, frameMat);
        addBox(0.7, WALL_H, 0.3, wcx, fy + WALL_H / 2, wcz + CELL / 2 - 0.15, frameMat);
      }
      var chip = costChip(cost);
      chip.position.set(wcx, fy + 2.05, wcz);
      G.scene.add(chip);
      map.doors[id] = {
        id: id, cost: cost, name: name, rooms: rooms, open: false,
        mesh: mesh, collider: collider, sprite: chip, baseY: mesh.position.y,
        pos: new THREE.Vector3(wcx, fy, wcz)
      };
      return map.doors[id];
    }
    map.buildBuyDoor = buildBuyDoor;
    Object.keys(P.doors).forEach(function (id) {
      var pd = P.doors[id], cd = CFG.DOORS[id];
      var cellCR = pd.cells[0];
      var wc = CFG.cellToWorld(cellCR[0], cellCR[1]);
      // The passage axis is the one whose BOTH neighbours are DIFFERENT rooms
      // (a room wrapping one corner of the junction must not decide the axis —
      // that rotated doors 3 and 6 sideways and left their corridors exposed).
      function nbRoom(dir) {
        var o = OFF[dir];
        var n = map.cellAt(cellCR[0] + o[0], cellCR[1] + o[1]);
        return n && n.type === 'room' ? n.room : null;
      }
      var nr = nbRoom('N'), sr = nbRoom('S'), er = nbRoom('E'), wr = nbRoom('W');
      var alongZ;
      if (nr && sr && nr !== sr) alongZ = true;         // rooms above+below: N-S traffic
      else if (er && wr && er !== wr) alongZ = false;   // rooms left+right: E-W traffic
      else alongZ = !!(nr || sr);                       // dead-simple junctions keep the old rule
      buildBuyDoor(+id, cd.cost, cd.name, pd.rooms, wc.x, wc.z, 0, alongZ);
      // CORNER junctions (a room wraps a perpendicular side of the door cell):
      // the closed door would still leave that flank wide open into the next
      // room. Seal every open perpendicular side with masonry so the door is
      // the only way through.
      (alongZ ? ['E', 'W'] : ['N', 'S']).forEach(function (dir) {
        if (!nbRoom(dir)) return;
        var o = OFF[dir];
        if (dir === 'E' || dir === 'W') {
          var wx = wc.x + o[0] * (CELL / 2 - 0.25);
          addBox(0.5, WALL_H, CELL, wx, WALL_H / 2, wc.z, G.mats.wallA, { solid: true });
          map.addCollider(wx - 0.25, wc.z - CELL / 2, wx + 0.25, wc.z + CELL / 2, 0, WALL_H);
        } else {
          var wz = wc.z + o[1] * (CELL / 2 - 0.25);
          addBox(CELL, WALL_H, 0.5, wc.x, WALL_H / 2, wz, G.mats.wallA, { solid: true });
          map.addCollider(wc.x - CELL / 2, wz - 0.25, wc.x + CELL / 2, wz + 0.25, 0, WALL_H);
        }
      });
    });

    /* ----------------------------------------------------- placed objects */
    function place(spec) {
      var wc = CFG.cellToWorld(spec.cell[0], spec.cell[1]);
      // spec.y lifts an interactable onto an upper floor (catwalk / loft)
      return new THREE.Vector3(wc.x + (spec.off ? spec.off[0] : 0), spec.y || 0, wc.z + (spec.off ? spec.off[1] : 0));
    }
    map.placePos = place;
    var occupied = []; // keep auto props clear of everything interactive
    // Full doorway approach lane, not just the physical threshold. At typical
    // sprint speed this leaves nearly a second of clean movement on both sides
    // and keeps wall fixtures from visually reading as part of the doorway.
    var DOOR_APPROACH = 5.5;
    function occupy(p) { occupied.push(p); }

    function xW(col) { return CFG.cellToWorld(col, 0).x; }
    function zW(row) { return CFG.cellToWorld(0, row).z; }

    // raised catwalks (verticality). Defined up front so their footprint can be
    // reserved before auto-placed machines pick spots — nothing should spawn on
    // or under the deck/stairs.
    map.stages = [];
    var stageSpecs = [];
    var bridgeSpecs = [];
    function interiorStair(col1, col2, topRow, baseRow, openUnder) {
      topRow = topRow == null ? 1 : topRow;
      baseRow = baseRow == null ? 3 : baseRow;
      // 0.42 inset leaves a 3.16m run on a single-cell stair: narrow enough to
      // read as a stair hall, wide enough for 3 parallel nav lanes at NR=1.5
      // (any slimmer and the horde single-files — smoke asserts 3+ lanes)
      var inset = 0.42;
      var x1 = xW(col1) - CELL / 2 + inset, x2 = xW(col2) + CELL / 2 - inset;
      // if the upper slab continues EAST/WEST of the landing (rather than
      // north), kill the wall-clearance inset on that side and overlap the
      // slab by a few centimetres — otherwise the inset leaves a 0.42m void
      // strip between landing and floor that neither feet nor the nav graph
      // can cross (this is what orphaned Der Riese's room K).
      var f2 = (CFG.cur.FLOORS || []).filter(function (f) { return (f.floorY || 0) > 0; })[0];
      function f2cell(c, r) {
        if (!f2 || !f2.GRID || !f2.GRID[r]) return false;
        var ch = f2.GRID[r][c];
        if (!ch || ch === '.') return false;
        return !(f2.FLOOR_OMIT || []).some(function (o) { return o[0] === c && o[1] === r; });
      }
      var runX1 = x1, runX2 = x2;                       // the stair RUN keeps the inset
      if (f2cell(col2 + 1, topRow)) x2 = xW(col2) + CELL / 2 + 0.06;
      if (f2cell(col1 - 1, topRow)) x1 = xW(col1) - CELL / 2 - 0.06;
      var deck = { x1: x1, x2: x2,
        // overlap the authored upper slab by a few centimetres so support/nav
        // sampling cannot find a hairline void between landing and corridor.
        z1: zW(topRow) - CELL / 2 - 0.06, z2: zW(topRow) + CELL / 2 - 0.18,
        h: 4.0, thin: true, openUnder: openUnder !== false, integrated: true, shaft: true };
      deck.stairs = { x1: runX1, x2: runX2, zTop: deck.z2,
        zBase: zW(baseRow) + CELL / 2 - inset, steps: Math.max(18, (baseRow - topRow + 1) * 6) };
      return deck;
    }
    if (CFG.cur.id === 'derriese') {
      // Four enclosed stairs, ONE cell wide, each tucked against a side wall so
      // the room's floor and kite lane stay open (the old two-cell masses cut
      // Furnace, Garage and Animal Testing in half):
      //  - Furnace:      west wall, clear of the Tel-B pad and both doors
      //  - Garage:       northeast corner, clear of POWER, the boxes and door 5
      //  - Animal Test.: east edge of the gallery slab, clear of door 7's lane
      //  - A-Lab:        col 19 line, clear of the Tel-A pad and the east window
      // each shaft pierces its slab from INSIDE the footprint (a slab's
      // perimeter wall would seal off an externally-attached landing)
      // three-row runs: a 4m climb over ~7.5m keeps the slope under the nav
      // engine's step limit (a two-row run reads as a cliff and orphans the slab)
      stageSpecs.push(interiorStair(5, 5, 1, 3, false),
                      interiorStair(17, 17, 2, 4, false),
                      interiorStair(15, 15, 13, 15, false),
                      interiorStair(19, 19, 15, 17, false));
      // Teleporter C keeps one authentic open steel access catwalk along its
      // north wall. It is supported on posts and intentionally does not carry a
      // full second building over the cooling yard.
      var cDeck = { x1: xW(1) - 1.55, x2: xW(6) + 1.55,
        z1: zW(6) - CELL / 2 + 0.3, z2: zW(7) - 0.35,
        h: 4.0, thin: true, openUnder: true, supports: true, railings: true, stairRails: true };
      cDeck.stairs = { x1: xW(6) - 1.35, x2: xW(6) + 1.35,
        zTop: cDeck.z2, zBase: zW(9) + 1.25, steps: 18 };
      stageSpecs.push(cDeck);
      // The narrow service bridge is the only upper crossing above Mainframe.
      // It grows out of Upper Assembly and has visible columns rather than
      // floating as a detached slab.
      bridgeSpecs.push({ x1: xW(17) - 0.85, x2: xW(18) + 0.85,
        z1: zW(6) - 0.2, z2: zW(8) + 1.25, h: 4.0, rails: true, supports: true });
    }
    if (CFG.cur.id === 'wetterjunge') {
      // One narrow stair per northern wing, each tucked against its OUTER wall
      // (the old center-column flights bisected all three rooms and their side
      // rails cut the kite rings). Rows dodge the ground windows at [0,1]/[14,1]
      // and the storm-EE consoles at [0,2]/[14,2].
      stageSpecs.push(interiorStair(5, 5, 1, 3),      // Dome, west wall
                      interiorStair(0, 0, 3, 5),      // Generator, west wall
                      interiorStair(14, 14, 3, 5));   // Comms, east wall
    }
    // reserve the deck and stair footprints (separately, so we don't over-claim
    // the whole bounding box) — machines steer clear of the structure
    function reserveRect(x1, z1, x2, z2) {
      var a = CFG.worldToCell(x1 + 0.1, z1 + 0.1), b = CFG.worldToCell(x2 - 0.1, z2 - 0.1);
      for (var rr = a.row; rr <= b.row; rr++)
        for (var cc = a.col; cc <= b.col; cc++) {
          var w = CFG.cellToWorld(cc, rr);
          occupy(new THREE.Vector3(w.x, 0, w.z));
        }
    }
    stageSpecs.forEach(function (s) {
      reserveRect(s.x1, s.z1, s.x2, s.z2);
      if (s.stairs) reserveRect(s.stairs.x1, s.stairs.zTop, s.stairs.x2, s.stairs.zBase);
    });

    // stairwell footprints: where a staircase climbs to an upper floor, the room
    // ceiling has to lift to clear the climbing player's head — otherwise they
    // headbutt the roof near the top of the stairs and get wedged/shoved. Each
    // rect carries the raised ceiling height for the cells it covers.
    var stairRects = [];
    stageSpecs.forEach(function (s) {
      if (!s.stairs) return;
      var st = s.stairs;
      stairRects.push({ x1: Math.min(st.x1, st.x2), x2: Math.max(st.x1, st.x2),
                        z1: Math.min(st.zTop, st.zBase), z2: Math.max(st.zTop, st.zBase),
                        roofY: Math.max(WALL_H, s.h + 2.0), integrated: !!s.integrated });
    });
    function stairwellAt(x, z) {
      for (var i = 0; i < stairRects.length; i++) {
        var r = stairRects[i];
        if (x >= r.x1 - 0.1 && x <= r.x2 + 0.1 && z >= r.z1 - 0.1 && z <= r.z2 + 0.1) return r;
      }
      return null;
    }

    // --- push interactables against the nearest clear wall so they never block
    //     the middle of a room (zombies need the open centre to train through)
    function roomInner(rid, fp) {
      var cells = (fp || P).rooms[rid].cells, minc = 99, maxc = -99, minr = 99, maxr = -99;
      cells.forEach(function (cr) {
        if (cr[0] < minc) minc = cr[0]; if (cr[0] > maxc) maxc = cr[0];
        if (cr[1] < minr) minr = cr[1]; if (cr[1] > maxr) maxr = cr[1];
      });
      var a = CFG.cellToWorld(minc, minr), b = CFG.cellToWorld(maxc, maxr);
      return { x0: a.x - CELL / 2 + WALL_T, x1: b.x + CELL / 2 - WALL_T,
        z0: a.z - CELL / 2 + WALL_T, z1: b.z + CELL / 2 - WALL_T };
    }
    function spotClear(p, dist, y) {
      y = y || 0;
      var cr = CFG.worldToCell(p.x, p.z), cell = map.cellAt(cr.col, cr.row, y);
      if (!cell || cell.type !== 'room') return false;
      // stay outside any door's interaction radius so buy-prompts never hijack
      // the door's "open" prompt (only doors on THIS floor count)
      if (!Object.keys(map.doors).every(function (id) {
        var d = map.doors[id];
        return Math.abs((d.pos.y || 0) - y) > 2 || Math.hypot(d.pos.x - p.x, d.pos.z - p.z) > DOOR_APPROACH; })) return false;
      if (!map.windows.every(function (w) {
        return Math.abs((w.inside.y || 0) - y) > 2 || Math.hypot(w.inside.x - p.x, w.inside.z - p.z) > 1.3; })) return false;
      for (var i = 0; i < occupied.length; i++) {
        if (Math.hypot(occupied[i].x - p.x, occupied[i].z - p.z) < dist) return false;
      }
      return true;
    }
    // cardinal yaw that rotates a prop's +Z front toward the room interior from
    // each wall (W faces +X, E faces -X, N faces +Z, S faces -Z) — clean 90s
    var WALL_YAW = { W: Math.PI / 2, E: -Math.PI / 2, N: 0, S: Math.PI };
    // nearest-wall cardinal facing (used for elevated machines that skip pushToWall)
    function nearestWallYaw(p) {
      var rid = map.roomAt(p.x, p.z);
      if (!rid || !P.rooms[rid]) return 0;
      var bb = roomInner(rid);
      var d = { W: p.x - bb.x0, E: bb.x1 - p.x, N: p.z - bb.z0, S: bb.z1 - p.z };
      var best = 'N', bv = 1e9;
      Object.keys(d).forEach(function (k) { if (d[k] < bv) { bv = d[k]; best = k; } });
      return WALL_YAW[best];
    }
    // a machine's flat-against-wall facing: the wall pushToWall chose if known,
    // otherwise the nearest wall. Always a clean 90-degree rotation.
    function machineYaw(pos) { return pos.wallYaw != null ? pos.wallYaw : nearestWallYaw(pos); }
    // attach a prop's solid (bullet-stopping) child meshes to the world list
    function propSolids(root) {
      if (root.userData.solids) root.userData.solids.forEach(function (m) { map.solidMeshes.push(m); });
    }
    // a world collider for a prop, swapping half-extents when it faces ±X so the
    // footprint follows the rotated body (machines sit wall-aligned = cardinal)
    function propCollider(cx, cz, hw, hd, y1, y2, yaw) {
      if (Math.abs(Math.sin(yaw || 0)) > 0.5) { var t = hw; hw = hd; hd = t; }
      return map.addCollider(cx - hw, cz - hd, cx + hw, cz + hd, y1, y2);
    }
    // placePropAgainstWall: snap a machine flat against the nearest clear wall,
    // recording the chosen wall's cardinal yaw on the position for the prop +
    // collider to share. Reuses door/window/occupancy avoidance.
    function pushToWall(pos, hd) {
      var y = pos.y || 0, fp = map.parsedAtY(y);
      var rid = map.roomAt(pos.x, pos.z, y);
      if (!rid || !fp.rooms[rid]) return pos;
      var bb = roomInner(rid, fp);
      var cands = [
        { x: bb.x0 + hd, z: pos.z, d: pos.x - bb.x0, yaw: WALL_YAW.W },
        { x: bb.x1 - hd, z: pos.z, d: bb.x1 - pos.x, yaw: WALL_YAW.E },
        { x: pos.x, z: bb.z0 + hd, d: pos.z - bb.z0, yaw: WALL_YAW.N },
        { x: pos.x, z: bb.z1 - hd, d: bb.z1 - pos.z, yaw: WALL_YAW.S }
      ].sort(function (a, b) { return a.d - b.d; });
      for (var i = 0; i < cands.length; i++) {
        var np = new THREE.Vector3(cands[i].x, y, cands[i].z);
        if (spotClear(np, 1.7, y)) { pos.x = np.x; pos.z = np.z; pos.wallYaw = cands[i].yaw; break; }
      }
      if (pos.wallYaw == null) pos.wallYaw = nearestWallYaw(pos);
      return pos;
    }

    // FLUSH wall mount: pin a prop's BACK against the nearest wall whose front
    // STANDING spot is actually clear (not a window/door/corner), and face it
    // into the room. center = inner wall face + halfDepth + 3cm. baseY = floor
    // height (for elevated catwalk machines). Returns { x, z, yaw }.
    var INWARD = { W: [1, 0], E: [-1, 0], N: [0, 1], S: [0, -1] };
    function wallFlush(pos, halfDepth, baseY, reservedSpecs) {
      baseY = baseY || 0;
      var fp = map.parsedAtY(baseY);             // resolve the floor this prop sits on
      var rid = map.roomAt(pos.x, pos.z, baseY);
      if (!rid || !fp.rooms[rid]) return { x: pos.x, z: pos.z, yaw: 0 };
      // roomInner's faces are inset by a full WALL_T; the REAL inner wall
      // surface is WALL_T/2 closer, so add it back or the prop floats ~0.18m.
      var bb = roomInner(rid, fp), gap = halfDepth + 0.03, WT2 = WALL_T / 2;
      var cands = [], seen = {};
      function addCand(x, z, d, yaw, f) {
        var key = x.toFixed(2) + ':' + z.toFixed(2) + ':' + f;
        if (seen[key]) return;
        seen[key] = true;
        cands.push({ x: x, z: z, d: d + Math.hypot(x - pos.x, z - pos.z) * 0.08, yaw: yaw, f: f });
      }
      // Search the requested point first, then the room centre and adjacent
      // wall bays. Previously only four points were tried; if all four were by
      // a doorway the rejected first point was returned anyway, which is why
      // machines could reappear in thresholds after a layout change.
      var xs = [pos.x, (bb.x0 + bb.x1) / 2], zs = [pos.z, (bb.z0 + bb.z1) / 2];
      for (var ox = -2; ox <= 2; ox++) xs.push((bb.x0 + bb.x1) / 2 + ox * CELL);
      for (var oz = -2; oz <= 2; oz++) zs.push((bb.z0 + bb.z1) / 2 + oz * CELL);
      xs.forEach(function (x) {
        x = Math.max(bb.x0 + 0.6, Math.min(bb.x1 - 0.6, x));
        addCand(x, bb.z0 - WT2 + gap, pos.z - bb.z0, WALL_YAW.N, 'N');
        addCand(x, bb.z1 + WT2 - gap, bb.z1 - pos.z, WALL_YAW.S, 'S');
      });
      zs.forEach(function (z) {
        z = Math.max(bb.z0 + 0.6, Math.min(bb.z1 - 0.6, z));
        addCand(bb.x0 - WT2 + gap, z, pos.x - bb.x0, WALL_YAW.W, 'W');
        addCand(bb.x1 + WT2 - gap, z, bb.x1 - pos.x, WALL_YAW.E, 'E');
      });
      cands.sort(function (a, b) { return a.d - b.d; });
      function standClear(cx, cz, f) {
        var io = INWARD[f], sx = cx + io[0] * 0.95, sz = cz + io[1] * 0.95;
        var cr = CFG.worldToCell(sx, sz), cell = map.cellAt(cr.col, cr.row, baseY);
        if (!cell || cell.type !== 'room') return false;            // stand spot in the room
        if (map.bodyBlocked(sx, sz, baseY + 0.2)) return false;     // not inside a wall/prop
        // hard 2.7m floor from any door — flush-mounted machines crowding a
        // doorway is a persistent playability sore (audit-doorways enforces 2.6)
        if (!Object.keys(map.doors).every(function (id) {
          return Math.hypot(map.doors[id].pos.x - cx, map.doors[id].pos.z - cz) > DOOR_APPROACH; })) return false;
        // don't let the machine stare straight down a doorway — even when it's
        // clear of the door it reads as blocking the threshold. Reject a wall
        // with a door roughly AHEAD (within 6m, narrow cone) of the facing.
        if (!Object.keys(map.doors).every(function (id) {
          var dp = map.doors[id].pos, dx = dp.x - cx, dz = dp.z - cz;
          var fwd = dx * io[0] + dz * io[1], side = Math.abs(dx * io[1] - dz * io[0]);
          return !(fwd > 0 && fwd < 6 && side < 1.7);
        })) return false;
        // Wall buys are created after perk machines, so they are not in the
        // occupied list yet. Reserve their authored prompt spots up front or a
        // relocated cabinet can land directly on a chalk-buy interaction.
        if (!CFG.WALLBUYS.every(function (wb) {
          var wp = place(wb);
          return Math.hypot(wp.x - sx, wp.z - sz) > 2.4;
        })) return false;
        if (reservedSpecs && !reservedSpecs.every(function (sp) {
          if (!sp || !sp.cell) return true;
          var rp = place(sp);
          return Math.hypot(rp.x - sx, rp.z - sz) > 2.4;
        })) return false;
        if (!map.windows.every(function (w) {
          return Math.hypot(w.inside.x - cx, w.inside.z - cz) > 1.4; })) return false;
        return true;
      }
      for (var i = 0; i < cands.length; i++) {
        if (standClear(cands[i].x, cands[i].z, cands[i].f)) return { x: cands[i].x, z: cands[i].z, yaw: cands[i].yaw };
      }
      // Tiny/irregular rooms may have no fully ideal bay. Keep a wall mount as
      // a last resort, but choose the point farthest from every doorway rather
      // than resurrecting the nearest rejected candidate.
      cands.sort(function (a, b) {
        function doorGap(c) {
          var best = 1e9;
          Object.keys(map.doors).forEach(function (id) {
            var d = map.doors[id].pos;
            best = Math.min(best, Math.hypot(d.x - c.x, d.z - c.z));
          });
          return best;
        }
        return doorGap(b) - doorGap(a);
      });
      return { x: cands[0].x, z: cands[0].z, yaw: cands[0].yaw };
    }

    // perk machines: vending cabinets with a lit bottle decal facing the room
    CFG.PERK_MACHINES.forEach(function (pm) {
      var def = CFG.PERKS[pm.perk];
      var pos = place(pm);
      var by = pos.y;                     // floor height this machine sits on
      var futureAnchors = [CFG.POWER, CFG.PAP, CFG.MAINFRAME]
        .concat(CFG.BOX_SPOTS || [], CFG.TRAPS || []);
      var fl = wallFlush(pos, 0.4, by, futureAnchors);  // pin its back flat to a clear wall
      pos.x = fl.x; pos.z = fl.z;
      occupy(pos);
      var root = G.Props.create('perk_machine', {
        position: new THREE.Vector3(fl.x, by, fl.z),
        rotationY: fl.yaw, variant: pm.perk, def: def
      });
      propSolids(root);
      propCollider(fl.x, fl.z, 0.48, 0.4, by, by + 1.9, fl.yaw);
      // Kurhaus has nine perk machines plus authored wing lighting. Their prop
      // art already uses emissive signs/bottles, so nine overlapping point
      // lights added cost without changing the silhouette. Keep those machines
      // self-lit and reserve dynamic lights for the room fixtures and altars.
      var light = null;
      if (CFG.cur.id !== 'kurhaus') {
        light = new THREE.PointLight(def.color, pm.perk === 'revive' ? 0.8 : 0.25, 7);
        light.position.set(fl.x, by + 2.2, fl.z);
        G.scene.add(light);
      }
      // the interaction point is where you STAND (just in front of the cabinet),
      // not the cabinet centre — so the prompt/buy works flush against a wall
      var fwd = { x: Math.sin(fl.yaw), z: Math.cos(fl.yaw) };
      var stand = new THREE.Vector3(fl.x + fwd.x * 0.95, by, fl.z + fwd.z * 0.95);
      map.perkMachines.push({ perk: pm.perk, pos: stand, mesh: root, light: light,
        ee: !!pm.ee, setPowered: root.userData.setPowered });
    });

    // wall buys — chalk drawn flush on the inner wall face (was floating in the
    // room before, which read as "showing through" from across the map)
    CFG.WALLBUYS.forEach(function (wb) {
      var pos = place(wb);          // where the player stands to buy
      occupy(pos);
      var o = OFF[wb.face];
      var wc = CFG.cellToWorld(wb.cell[0], wb.cell[1]);
      // keep the tangential part of the offset, pin the wall-normal part to the face
      var off = wb.off || [0, 0];
      var proj = off[0] * o[0] + off[1] * o[1];
      var tx = off[0] - proj * o[0], tz = off[1] - proj * o[1];
      var FACE = CELL / 2 - WALL_T / 2 - 0.03;   // just inside the inner wall surface
      var wallPos = new THREE.Vector3(wc.x + tx + o[0] * FACE, (pos.y || 0) + 1.7, wc.z + tz + o[1] * FACE);
      var isFrags = wb.gun === 'frags';
      var def = isFrags ? { name: 'Frag Grenades' } : CFG.WEAPONS[wb.gun];
      var cost = isFrags ? CFG.FRAGS_COST : def.wall;
      // wall-buy fixture: chalk outline + brackets + price plate + cabling
      var fixture = G.Props.create('wallbuy_fixture', {
        position: new THREE.Vector3(wc.x + tx + o[0] * FACE, (pos.y || 0), wc.z + tz + o[1] * FACE),
        rotationY: Math.atan2(-o[0], -o[1]),
        chalkTex: chalkTexture([def.name, cost + ' pts'])
      });
      map.wallbuys.push({ gun: wb.gun, isFrags: isFrags, cost: cost, pos: pos, mesh: fixture });
    });

    CFG.BOX_SPOTS.forEach(function (bs, i) {
      var p = place(bs);
      pushToWall(p, 0.65);    // box hugs a clear wall on its own floor (Y-aware)
      occupy(p);
      map.boxSpots.push({ idx: i, pos: p });
    });

    // traps: a buyable, power-gated zone hazard (Molten Pour / Cryo Vent / Tesla
    // Gate). The console hugs a clear wall (Y-aware), the damage zone sits in front
    // of it inside the room. The zone is DAMAGE-ONLY (no movement collider) so it
    // can never wall off a path — but it's still kept clear of doorways via the
    // wall-flush + the standing rule.
    (CFG.TRAPS || []).forEach(function (tr) {
      var p = place(tr), by = p.y || 0;
      var fl = wallFlush(p, 0.3, by);
      addBox(0.45, 1.3, 0.45, fl.x, by + 0.65, fl.z, G.MAT.get('darkIron'));   // console (visual, no collider)
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshBasicMaterial({ color: tr.color || 0xffaa33 }));
      lamp.position.set(fl.x, by + 1.45, fl.z); G.scene.add(lamp);
      var fwd = { x: Math.sin(fl.yaw), z: Math.cos(fl.yaw) };
      var stand = new THREE.Vector3(fl.x + fwd.x * 0.95, by, fl.z + fwd.z * 0.95);
      var zone = new THREE.Vector3(fl.x + fwd.x * 3.5, by, fl.z + fwd.z * 3.5);
      occupy(stand);
      map.traps.push({ type: tr.type, name: tr.name, cost: tr.cost, color: tr.color || 0xffaa33,
        radius: tr.radius || 5, dur: tr.dur || 6, dps: tr.dps || 300, pos: stand, zone: zone,
        lamp: lamp, active: 0, cooldown: 0 });
    });

    // teleporters
    CFG.TELEPORTERS.forEach(function (t) {
      var pos = place(t);
      occupy(pos);
      var root = G.Props.create('teleporter_pad', { position: new THREE.Vector3(pos.x, 0, pos.z) });
      propSolids(root);
      // conduit-post colliders, derived from the prop's actual post layout
      (root.userData.posts || []).forEach(function (pp) {
        map.addCollider(pos.x + pp.x - 0.15, pos.z + pp.z - 0.15, pos.x + pp.x + 0.15, pos.z + pp.z + 0.15, 0, 2.6);
      });
      var light = new THREE.PointLight(0x22ddff, 0, 7);
      light.position.set(pos.x, 2, pos.z);
      G.scene.add(light);
      map.teleporters.push({ id: t.id, pos: pos, ring: root.userData.energy, light: light,
        linked: false, linking: false, linkTimer: 0 });
    });

    // Mainframe: Der Riese's is the freestanding anchor in its open spawn yard,
    // matching the recognizable teleporter return pad. Other maps keep the
    // compact wall-mounted treatment.
    map.mainframe = null;
    if (CFG.MAINFRAME) {
      var mf = place(CFG.MAINFRAME);
      var mby = mf.y || 0;
      var mfl = CFG.cur.id === 'derriese'
        ? { x: mf.x, z: mf.z, yaw: 0 }
        : wallFlush(mf, 0.25, mby);
      mf.x = mfl.x; mf.z = mfl.z;
      occupy(mf);
      var mfRoot = G.Props.create('mainframe', {
        position: new THREE.Vector3(mfl.x, mby, mfl.z), rotationY: mfl.yaw
      });
      propSolids(mfRoot);
      var mc = mfRoot.userData.colliderBox;
      propCollider(mfl.x, mfl.z, mc.hw, mc.hd, mby + mc.y1, mby + mc.y2, mfl.yaw);
      map.mainframe = { pos: mf, pad: mfRoot };
    }

    // pack-a-punch: a chunkier machine — base, sloped hopper, glowing feed
    // slot and a gold output tray
    var pp = place(CFG.PAP);
    var ppY = pp.y || 0;                          // PaP may live on any floor (Kurhaus: the Core, -4)
    var ppfl = wallFlush(pp, 0.48, ppY);
    pp.x = ppfl.x; pp.z = ppfl.z;
    occupy(pp);
    var papYaw = ppfl.yaw;
    var papRoot = G.Props.create('pack_a_punch', { position: new THREE.Vector3(pp.x, ppY, pp.z), rotationY: papYaw });
    propSolids(papRoot);
    var pc = papRoot.userData.colliderBox;
    propCollider(pp.x, pp.z, pc.hw, pc.hd, ppY + pc.y1, ppY + pc.y2, papYaw);
    var papBody = papRoot;
    var field = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3.4, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    field.position.set(pp.x, ppY + 1.7, pp.z);
    G.scene.add(field);
    var fieldCol = map.addCollider(pp.x - 1.8, pp.z - 1.8, pp.x + 1.8, pp.z + 1.8, ppY, ppY + 3.4);
    map.pap = {
      pos: pp, mesh: papBody, field: field, fieldCol: fieldCol, unlocked: false,
      unlock: function () {
        this.unlocked = true;
        this.fieldCol.on = false;
        G.scene.remove(this.field);
        G.audio.teleLink();
        G.hud.banner('PACK-A-PUNCH UNLOCKED', '#fb5');
      }
    };

    // power switch (may sit on any floor — e.g. Kurhaus's is the Furnace on Floor B)
    var pw = place(CFG.POWER);
    var pwY = pw.y || 0;
    var pwfl = wallFlush(pw, 0.12, pwY);
    pw.x = pwfl.x; pw.z = pwfl.z;
    occupy(pw);
    var pwRoot = G.Props.create('power_switch', { position: new THREE.Vector3(pw.x, pwY, pw.z), rotationY: pwfl.yaw });
    propSolids(pwRoot);
    map.powerSwitch = { pos: pw, mesh: pwRoot, setPowered: pwRoot.userData.setPowered };
    occupy(place(CFG.PLAYER_SPAWN));

    /* ------------------------------------------------- lights + fixtures */
    // designed ceiling fixture per map theme: a caged bunker lamp, an industrial
    // dome, or a cold institutional fixture. The bulb keeps a PRIVATE material so
    // the flicker loop can drive its emissiveIntensity without touching the
    // shared prop material cache.
    function addLamp(x, z, color, fy) {
      fy = fy || 0;   // hang the fixture + light at the room's floor height
      var theme = CFG.cur.id, iron = G.MAT.get('darkIron'), housing = G.MAT.get('paintedMetal');
      var fixture = new THREE.Group();
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), G.mats.metal);
      rod.position.y = 0.55; fixture.add(rod);
      if (theme === 'derriese') {                       // industrial dome light
        var dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), housing);
        dome.position.y = 0.16; fixture.add(dome);
      } else {                                          // caged bunker lamp
        var cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.18, 12, 1, true),
          new THREE.MeshLambertMaterial({ color: 0x3a3f46, side: THREE.DoubleSide }));
        cap.position.y = 0.16; fixture.add(cap);
        [0.04, -0.08].forEach(function (yy) {
          var ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 14), iron);
          ring.rotation.x = Math.PI / 2; ring.position.y = yy; fixture.add(ring);
        });
        for (var i = 0; i < 4; i++) {
          var a = i / 4 * Math.PI * 2;
          var wire = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.2, 0.012), iron);
          wire.position.set(Math.cos(a) * 0.14, -0.02, Math.sin(a) * 0.14); fixture.add(wire);
        }
      }
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0x222018, emissive: new THREE.Color(palC('lampTint', 0xffe9b0)), emissiveIntensity: 0.35 }));
      bulb.position.y = -0.04; fixture.add(bulb);
      fixture.position.set(x, fy + WALL_H - 0.55, z);
      G.scene.add(fixture);
      var light = new THREE.PointLight(color, 0.75, 18, 1);
      light.position.set(x, fy + WALL_H - 0.9, z);
      G.scene.add(light);
      G.map.roomLights.push(light);
      G.map.lamps.push({ light: light, bulb: bulb });
      // cull only the fixture MESH (toggling mesh.visible is free). Deliberately
      // do NOT cull the PointLight: toggling a light's visibility changes the
      // scene light count, which makes three.js recompile every lit material —
      // a stutter on every floor transition. The light stays lit (it only ever
      // illuminates its own now-hidden floor, so there's nothing visible to see).
      if (_multiFloor) { fixture.userData.fy = fy; G.map.cullables.push(fixture); }
    }

    Object.keys(P.rooms).forEach(function (roomId) {
      var cells = P.rooms[roomId].cells;
      // pull every room's lamp toward this map's tint so the whole map shares one
      // light temperature (warm bunker / cool factory / cold arctic) instead of
      // some rooms glowing warm and others cold
      var color = new THREE.Color(CFG.ROOMS[roomId].light).lerp(new THREE.Color(palC('lampTint', 0xffe9c0)), 0.62).getHex();
      function avg(list) {
        var cx = 0, cz = 0;
        list.forEach(function (cr) { var w = CFG.cellToWorld(cr[0], cr[1]); cx += w.x; cz += w.z; });
        return { x: cx / list.length, z: cz / list.length };
      }
      var rfy = map.floorYOf(roomId);              // this room's floor height
      var all = avg(cells);
      P.rooms[roomId].center = new THREE.Vector3(all.x, rfy, all.z);
      // scale lamp count with floor area so big rooms aren't left with a dark,
      // under-lit ceiling/void — roughly one lamp per ~6 cells (1..4). Kurhaus
      // caps at 3: its wings carry their own accent glows, and forward-rendered
      // point lights are the map's main per-pixel cost (audit: 57 -> ~46)
      var lampCap = CFG.cur.id === 'kurhaus' ? 3 : 4;
      var nL = Math.max(1, Math.min(lampCap, Math.round(cells.length / 6)));
      // sort cells along the room's longer axis, then split into nL contiguous
      // groups and light each group's centre — spreads the lamps evenly
      var w0 = 1e9, w1 = -1e9, d0 = 1e9, d1 = -1e9;
      cells.forEach(function (cr) { var p = CFG.cellToWorld(cr[0], cr[1]);
        if (p.x < w0) w0 = p.x; if (p.x > w1) w1 = p.x; if (p.z < d0) d0 = p.z; if (p.z > d1) d1 = p.z; });
      var alongX = (w1 - w0) >= (d1 - d0);
      var sorted = cells.slice().sort(function (a, b) {
        var pa = CFG.cellToWorld(a[0], a[1]), pb = CFG.cellToWorld(b[0], b[1]);
        return alongX ? pa.x - pb.x : pa.z - pb.z;
      });
      for (var li = 0; li < nL; li++) {
        var grp = sorted.slice(Math.floor(li * cells.length / nL), Math.floor((li + 1) * cells.length / nL));
        if (!grp.length) continue;
        var g = avg(grp);
        addLamp(g.x, g.z, color, rfy);
      }
    });

    /* -------------------------------------------------- ambient props */
    function clearOf(p, dist) {
      for (var i = 0; i < occupied.length; i++) {
        if (Math.hypot(occupied[i].x - p.x, occupied[i].z - p.z) < dist) return false;
      }
      // doorways get a HARD 2.6m floor regardless of the caller's radius —
      // props crowding a door opening is a persistent playability sore
      var doorR = Math.max(dist, 2.6);
      var doorsOk = Object.keys(map.doors).every(function (id) {
        return Math.hypot(map.doors[id].pos.x - p.x, map.doors[id].pos.z - p.z) > Math.max(dist, DOOR_APPROACH);
      });
      if (!doorsOk) return false;
      return map.windows.every(function (w) {
        return Math.hypot(w.inside.x - p.x, w.inside.z - p.z) > dist;
      });
    }
    /* ========================= room dressing (environment art) ==========
       Make rooms read as real places, not boxes: ceilings + beams indoors,
       support pillars, wall ribs, scattered debris, and a distinctive themed
       structure per room (generators, furnace, lab tanks, wrecked truck,
       server racks, sandbags...). Outdoor rooms stay open to the sky.       */
    var outdoor = CFG.cur.OUTDOOR || [];
    // ceilings render from BOTH sides so you can't see down through a roof from
    // the catwalk/above (single-sided planes were invisible from the top)
    var dCeil = new THREE.MeshLambertMaterial({ map: G.tex.wall, color: palC('ceil', 0x55504a), side: THREE.DoubleSide });
    var dBeam = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: palC('beam', 0x55585e) });
    var dRust = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: palC('rust', 0x86603c) });
    var dDark = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
    var dPipe = new THREE.MeshLambertMaterial({ color: 0x6b7077 });
    var dConc = new THREE.MeshLambertMaterial({ map: G.tex.wall, color: palC('conc', 0x8a857c) });
    function pbox(parent, w, h, d, x, y, z, m, rx) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z); if (rx) b.rotation.x = rx;
      parent.add(b); return b;
    }
    function pcyl(parent, r1, r2, h, x, y, z, m, seg, axis) {
      var c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 10), m);
      c.position.set(x, y, z);
      if (axis === 'x') c.rotation.z = Math.PI / 2; else if (axis === 'z') c.rotation.x = Math.PI / 2;
      parent.add(c); return c;
    }
    function roomBBox(room) {
      var minc = 99, maxc = -99, minr = 99, maxr = -99;
      room.cells.forEach(function (cr) {
        if (cr[0] < minc) minc = cr[0]; if (cr[0] > maxc) maxc = cr[0];
        if (cr[1] < minr) minr = cr[1]; if (cr[1] > maxr) maxr = cr[1];
      });
      var a = CFG.cellToWorld(minc, minr), b = CFG.cellToWorld(maxc, maxr);
      return { x0: a.x - CELL / 2, x1: b.x + CELL / 2, z0: a.z - CELL / 2, z1: b.z + CELL / 2,
        cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, w: (maxc - minc + 1) * CELL, d: (maxr - minr + 1) * CELL };
    }
    function wallEdges(room) {
      var es = [];
      room.cells.forEach(function (cr) {
        ['N', 'S', 'E', 'W'].forEach(function (dir) {
          var o = OFF[dir], n = map.cellAt(cr[0] + o[0], cr[1] + o[1]) || { type: 'void' };
          var isDoor = n.type === 'door';
          if (!(n.type === 'void' || isDoor || (n.type === 'room' && n.room !== room.id))) return;
          es.push({ cr: cr, dir: dir, o: o, door: isDoor, win: winLookup[cr[0] + ',' + cr[1] + ',' + dir] !== undefined });
        });
      });
      return es;
    }

    /* ---- themed hero structures: pick a registry prop by room name. The prop
       (front +Z) is added into the wall-facing group placeHero builds, so it
       reads as the room's centrepiece. Collider stays the 2x2 placeHero box. */
    function heroTypeFor(name) {
      var n = (name || '').toLowerCase();
      return /generator|power/.test(n) ? 'generator'
        : /furnace|boiler/.test(n) ? 'pressure_tank'
        : /lab|research|control|test/.test(n) ? 'lab_cabinet'
        : /garage|crash|vehicle/.test(n) ? 'tool_cart'
        : /storage|supply|cargo/.test(n) ? 'electrical_cabinet'
        : /comms|radar|dome|tower|weather/.test(n) ? 'radar_console'
        : /catwalk|pipe|teleporter/.test(n) ? 'pipe_cluster'
        : /courtyard|bunker|help|spawn|yard|entrance/.test(n) ? 'sandbag_stack'
        : 'ammo_crate';
    }
    function buildHero(name, g) {
      var prop = G.Props.create(heroTypeFor(name), { addToScene: false, seed: (G.PU.hashStr(name) || 1) });
      g.add(prop);
    }
    function dropHero(name, px, pz, yaw) {
      var g = new THREE.Group();
      g.position.set(px, 0, pz);
      g.rotation.y = yaw;
      G.scene.add(g);
      buildHero(name, g);
      map.addCollider(px - 1.0, pz - 1.0, px + 1.0, pz + 1.0);
      occupied.push({ x: px, z: pz });
    }
    // set a prop flush along a wall edge with its long axis PARALLEL to the wall
    // (so it hugs the perimeter), offset in by its perpendicular half-depth, with
    // a matching collider. Returns true if it found a clear spot.
    function placeAgainstWall(type, e, rid) {
      var probe = G.Props.create(type, { addToScene: false });
      var cb = probe && probe.userData && probe.userData.colliderBox;
      if (probe && probe.parent) probe.parent.remove(probe);
      var hw = cb ? cb.hw : 0.5, hd = cb ? cb.hd : 0.5;
      var longZ = hd >= hw, wallAlongZ = e.o[0] !== 0;   // E/W wall runs along Z
      // rotate so the prop's long axis lies along the wall
      var yaw = (wallAlongZ === longZ) ? 0 : Math.PI / 2;
      var perp = Math.min(hw, hd) + 0.2;                  // clearance off the wall face
      var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
      var px = wc.x + e.o[0] * (CELL / 2 - perp);
      var pz = wc.z + e.o[1] * (CELL / 2 - perp);
      var p = new THREE.Vector3(px, 0, pz);
      if (!clearOf(p, Math.max(hw, hd) + 0.5)) return false;
      // face into the room, plus the alignment rotation
      var faceYaw = Math.atan2(-e.o[0], -e.o[1]) + yaw;
      G.Props.create(type, { position: p, rotationY: faceYaw, seed: (G.PU.hashStr(rid + type) || 1) });
      if (cb) propCollider(px, pz, hw, hd, cb.y1, cb.y2, faceYaw);
      occupy(p);
      return true;
    }
    function placeHero(room, name) {
      var es = wallEdges(room).filter(function (e) { return !e.door && !e.win; });
      for (var i = 0; i < es.length; i++) {
        var e = es[(i * 5 + 2) % es.length];
        var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
        var px = wc.x + e.o[0] * 1.15, pz = wc.z + e.o[1] * 1.15;
        if (!clearOf(new THREE.Vector3(px, 0, pz), 1.5)) continue;
        dropHero(name, px, pz, Math.atan2(-e.o[0], -e.o[1]));
        return;
      }
      // fallback: every wall edge was crowded — tuck the hero into the clearest
      // corner so a room is never left without its centrepiece
      var bb = roomBBox(room), cands = [
        [bb.x0 + 1.2, bb.z0 + 1.2], [bb.x1 - 1.2, bb.z0 + 1.2],
        [bb.x0 + 1.2, bb.z1 - 1.2], [bb.x1 - 1.2, bb.z1 - 1.2]
      ];
      for (var ci = 0; ci < cands.length; ci++) {
        var cp = new THREE.Vector3(cands[ci][0], 0, cands[ci][1]);
        if (!clearOf(cp, 1.4)) continue;
        dropHero(name, cp.x, cp.z, Math.atan2(bb.cx - cp.x, bb.cz - cp.z));
        return;
      }
    }

    /* ---- KURHAUS per-wing themed decor ----------------------------------
       Each wing gets a flat, WALKABLE emissive floor motif at its centre (lava
       cracks / rune ring / frost / bloodstain / pool — no collider, so the
       training oval stays clear) plus themed props in clearOf-gated corners
       (auto-avoids machines, doors, windows). Modest mesh counts, shared mats. */
    function dressKurhausRoom(rid, room, bb) {
      var TH = dressKurhausRoom, S = G.scene;
      if (!TH._m) {
        var B = function (c) { return new THREE.MeshBasicMaterial({ color: c }); };
        var L = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
        var GL = function (c, o) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }); };
        TH._m = {
          lava: B(0xff5a14), lavaDim: B(0xc0420a), rock: L(0x2a1c16), ember: B(0xffaa3a),
          ice: L(0xbfe7f0), steel: L(0x9aa6b0), frostF: GL(0xcfeefc, 0.18),
          meat: L(0x6e2222), bone: L(0xc9bca0), flesh: L(0x7a2e2e), blood: GL(0x5a1414, 0.55),
          corpse: L(0x3e4636), chead: L(0x6a6a52), rune: B(0xb074ff), runeF: GL(0x7a3aff, 0.5), aether: B(0xc9a6ff),
          water: GL(0x2fd0c8, 0.5), brass: L(0x9a7a3a), pipe: L(0x6a6256), velvet: L(0x6a1f24), gold: L(0xb8923a),
          // storytelling pass
          iron: L(0x3a3a40), carpet: L(0x6e1a1e), trim: B(0x8a6a2a), canvas: L(0x8a7a5c),
          leather: L(0x5a3a24), marble: L(0xcfc8b8), brick: L(0x5a2e26), chalk: B(0xe8e2d0),
          paper: L(0xcfc4a0), candle: L(0xe8e0c8), flame: B(0xffc86a), iceGl: GL(0xbfe7f0, 0.42),
          dark: L(0x14161a), face: L(0xb8a890), haz: B(0x8a6a1a), jar: GL(0x9aa66a, 0.7),
          towel: L(0xd8d4c8), woodD: L(0x3e2c1c)
        };
      }
      var M = TH._m;
      // living-map registry — map.update animates these every frame (embers rise,
      // steam drifts, candles flicker, the manifold breathes, Voss reacts)
      var KA = map.kAnim = map.kAnim || { embers: [], steam: [], candles: [], needles: [], manifold: null, face: null, bucket: null,
        // anchors the elemental RITES (interact.js) hook onto — only spots that
        // actually built (clearOf can skip one) are listed
        rite: { crates: [], tanks: [], ice: null, hooks: [] } };
      function box(w, h, d, x, y, z, m) { return addBox(w, h, d, x, y, z, m); }
      function cyl(r, h, x, y, z, m, sg) { var e = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, sg || 10), m); e.position.set(x, y, z); S.add(e); return e; }
      function coneM(r, h, x, y, z, m) { var e = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), m); e.position.set(x, y, z); S.add(e); return e; }
      function sph(r, x, y, z, m) { var e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), m); e.position.set(x, y, z); S.add(e); return e; }
      function disc(r, x, z, m, y) { var e = new THREE.Mesh(new THREE.CircleGeometry(r, 24), m); e.rotation.x = -Math.PI / 2; e.position.set(x, y || 0.07, z); e.renderOrder = 1; S.add(e); return e; }
      function ring(ro, ri, x, z, m, y) { var e = new THREE.Mesh(new THREE.TorusGeometry(ro, ri, 8, 30), m); e.rotation.x = Math.PI / 2; e.position.set(x, y || 0.08, z); S.add(e); return e; }
      function glow(x, y, z, c, i, dist) { var l = new THREE.PointLight(c, i, dist || 15, 1.6); l.position.set(x, y, z); S.add(l); return l; }
      // make a floor-standing corner prop solid (so you can't clip through it) —
      // only ever called for things tucked in clearOf'd corners, never the
      // walkable floor motifs or overhead hooks/icicles.
      function solid(x, z, hw, hd, h) { map.addCollider(x - hw, z - hd, x + hw, z + hd, 0, h); }
      var cx = bb.cx, cz = bb.cz, x0 = bb.x0, x1 = bb.x1, z0 = bb.z0, z1 = bb.z1;
      // candidate corner anchors (inset), filtered so we never sit on a machine/door/window
      var corners = [[x0 + 1.3, z0 + 1.3], [x1 - 1.3, z0 + 1.3], [x0 + 1.3, z1 - 1.3], [x1 - 1.3, z1 - 1.3]]
        .filter(function (c) { return clearOf(new THREE.Vector3(c[0], 0, c[1]), 1.7); });

      // a floor prop spot is legal if it's clear of machines/doors/windows AND
      // outside the room's training ring (the R~5 kite lane the circles test runs)
      function spotOK(x, z, r) {
        if (!clearOf(new THREE.Vector3(x, 0, z), r || 1.7)) return false;
        var rr = Math.hypot(x - cx, z - cz);
        return rr < 2.4 || rr > 6.6;
      }

      /* ============ THE STORY, wing by wing ============
         1899: spa magnate Aurelius Voss built the Kurhaus over a thermal spring
         whose water carried a current he called the AETHER. The Pump Hall fed it
         to every wing. Chasing a stronger dose he DRILLED too deep (the Caldera),
         hit magma, froze half the plant containing it (Frostworks), and took his
         congregation below to "bargain" with what answered (the Sanctum). The
         kitchens' cold cellar filled with more than meat. The guests never left.
         Voss hid his aether relics behind his sigils; his buried prize waits for
         whoever completes the bargain. */

      if (rid === 'V') {                       // THE CALDERA — the drill that broke through
        disc(2.6, cx, cz, M.lava); disc(3.2, cx, cz, M.lavaDim, 0.05);
        glow(cx, 1.4, cz, 0xff6a1e, 1.7, 18);
        // Voss's drill rig: shaft sunk dead-centre into the melt, four legs to a
        // crown, the drill string still hanging — nobody shut it down
        cyl(0.34, WALL_H - 0.6, cx, (WALL_H - 0.6) / 2, cz, M.iron, 12);
        solid(cx, cz, 0.5, 0.5, WALL_H - 0.6);
        for (var dl = 0; dl < 4; dl++) {
          var da = dl / 4 * Math.PI * 2 + 0.4;
          var lx = Math.cos(da) * 2.0, lz = Math.sin(da) * 2.0;
          var leg = box(0.16, 3.9, 0.16, cx + lx / 2, 1.7, cz + lz / 2, M.iron);
          leg.rotation.z = Math.atan2(lx, 3.4); leg.rotation.x = -Math.atan2(lz, 3.4);
        }
        var crown = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 8, 18), M.iron);
        crown.rotation.x = Math.PI / 2; crown.position.set(cx, WALL_H - 0.55, cz); S.add(crown);
        box(0.7, 0.5, 0.55, cx, WALL_H - 0.28, cz, M.iron);               // motor housing on the crown
        box(0.2, 0.2, 0.7, cx, WALL_H - 0.2, cz + 0.3, M.brass);          // drive shaft + belt guard
        cyl(0.04, 1.1, cx + 0.55, WALL_H - 1.15, cz, M.steel, 6);         // hanging cable
        KA.bucket = box(0.34, 0.4, 0.34, cx + 0.55, WALL_H - 1.85, cz, M.iron);  // swaying sample bucket
        ring(3.5, 0.07, cx, cz, M.haz, 0.06);                             // painted hazard ring
        // embers rise off the melt, cool, and die — the pool never sleeps
        for (var em = 0; em < 6; em++) {
          var ea = em / 6 * Math.PI * 2, er = 0.8 + (em % 3) * 0.55;
          var eb = sph(0.07 + (em % 2) * 0.03, cx + Math.cos(ea) * er, 0.3, cz + Math.sin(ea) * er, M.ember);
          KA.embers.push({ m: eb, x: eb.position.x, z: eb.position.z, spd: 0.55 + (em % 3) * 0.2, ph: em * 1.05 });
        }
        // core-sample crates along the west wall (the relic hides among them) —
        // shipping crates, not cubes: lid boards, rope lashing, stenciled, canted
        // North-wall bays: the former west-wall row sat inside door 5's
        // approach lane. These stay wall-hugging while leaving all three
        // Caldera thresholds completely open.
        [[x0 + 1.2, z0 + 1.2], [cx, z0 + 1.2], [x1 - 1.2, z0 + 1.2]].forEach(function (c, i) {
          if (!spotOK(c[0], c[1], 1.4)) return;
          var cr8 = box(0.9, 0.62, 0.9, c[0], 0.31, c[1], M.woodD); cr8.rotation.y = 0.15 + i * 0.4;
          box(0.96, 0.07, 0.3, c[0], 0.655, c[1] - 0.22, M.leather).rotation.y = cr8.rotation.y;   // lid boards
          box(0.96, 0.07, 0.3, c[0], 0.655, c[1] + 0.22, M.leather).rotation.y = cr8.rotation.y;
          box(0.94, 0.08, 0.94, c[0], 0.31, c[1], M.rust).rotation.y = cr8.rotation.y;             // rope lashing
          solid(c[0], c[1], 0.55, 0.55, 0.72);
          sph(0.2, c[0] - 0.15, 0.75, c[1] + 0.1, i % 2 ? M.rock : M.lava);
          KA.rite.crates.push({ x: c[0], z: c[1] });
        });
        corners.forEach(function (c, i) { box(0.5 + (i % 2) * 0.2, 0.45, 0.5, c[0], 0.22, c[1], M.rock); sph(0.22, c[0], 0.5, c[1], i % 2 ? M.lava : M.ember); });

      } else if (rid === 'F') {                // FROSTWORKS — the plant that froze the breach
        disc(2.8, cx, cz, M.frostF); disc(1.3, cx - 4.8, cz + 3.4, M.frostF, 0.05); disc(1.1, cx + 4.2, cz - 3.8, M.frostF, 0.05);
        glow(cx, 2.4, cz, 0x9fd8ee, 1.0, 16);
        // coolant tank battery along the north wall (skipping the spawn window)
        [[cx - 4.6, z0 + 1.2], [cx - 2.8, z0 + 1.2], [cx + 3.4, z0 + 1.2]].forEach(function (c, ti) {
          if (!spotOK(c[0], c[1], 1.5)) return;
          cyl(0.72, 2.6, c[0], 1.3, c[1], M.steel, 12);
          cyl(0.76, 0.1, c[0], 0.55, c[1], M.iron, 12);                 // riveted bands
          cyl(0.76, 0.1, c[0], 1.85, c[1], M.iron, 12);
          cyl(0.78, 0.3, c[0], 2.75, c[1], M.ice, 12);                  // frost cap
          coneM(0.12, 0.5, c[0] + 0.5, 2.5, c[1], M.ice);               // cap icicle
          cyl(0.1, 1.2, c[0], 3.4, c[1], M.pipe, 6);
          var gv = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12), M.brass);
          gv.position.set(c[0], 1.2, c[1] - 0.74); S.add(gv);           // hand valve
          if (ti === 1) { var tl = cyl(0.72, 2.6, c[0], 1.3, c[1], M.steel, 12); tl.rotation.z = 0.03; } // one sits off-plumb
          solid(c[0], c[1], 0.85, 0.85, 2.9);
          KA.rite.tanks.push({ x: c[0], z: c[1] });
        });
        // THE FROZEN ENGINEER — one of Voss's men, entombed mid-stride in the
        // coolant burst that saved the building. He's still reaching for the door.
        var fw = [x0 + 1.5, z1 - 2.6];
        if (spotOK(fw[0], fw[1], 1.5)) {
          box(0.5, 1.85, 0.42, fw[0], 0.92, fw[1], M.dark);               // the man
          sph(0.17, fw[0], 1.62, fw[1], M.dark);
          box(0.4, 0.14, 0.14, fw[0] + 0.35, 1.35, fw[1], M.dark);        // outstretched arm
          box(1.0, 2.3, 0.9, fw[0], 1.15, fw[1], M.iceGl);                // the ice block
          solid(fw[0], fw[1], 0.55, 0.5, 2.3);
          KA.rite.ice = { x: fw[0], z: fw[1] };
        }
        // burst coolant main on the east wall — the spray froze mid-air
        var bp = [x1 - 0.55, cz + 3.2];
        cyl(0.14, 3.4, bp[0], WALL_H / 2 - 0.3, bp[1], M.pipe, 8);
        var spr = coneM(0.5, 1.6, bp[0] - 0.9, 1.9, bp[1], M.iceGl); spr.rotation.z = Math.PI / 2.3;
        for (var ic = 0; ic < 6; ic++)
          coneM(0.09, 0.5 + (ic % 3) * 0.25, x0 + 2 + ic * (bb.w - 4) / 5, WALL_H - 0.45, cz + (ic % 2 ? 1.6 : -1.6), M.ice);
        corners.forEach(function (c) { cyl(0.5, WALL_H, c[0], WALL_H / 2, c[1], M.steel); cyl(0.62, 0.4, c[0], WALL_H - 0.3, c[1], M.ice); coneM(0.18, 0.9, c[0], WALL_H - 0.9, c[1], M.ice); solid(c[0], c[1], 0.6, 0.6, WALL_H); });

      } else if (rid === 'M') {                // COLD CELLAR — more than meat down here
        disc(2.6, cx, cz, M.blood);
        for (var hi = 0; hi < 3; hi++) {
          var hz = z0 + 1.8 + hi * (bb.d - 3.6) / 2, hx = x0 + 1.2;
          if (!clearOf(new THREE.Vector3(hx, 0, hz), 1.2)) continue;
          cyl(0.05, 1.5, hx, WALL_H - 0.75, hz, M.steel, 6); box(0.45, 1.3, 0.45, hx, WALL_H - 2.05, hz, M.meat); box(0.5, 0.12, 0.5, hx, WALL_H - 1.4, hz, M.bone);
          KA.rite.hooks.push({ x: hx, z: hz });
        }
        // pantry racks — jars of things that shouldn't be jarred
        [[cx - 2.6, z0 + 0.9], [cx - 0.8, z0 + 0.9]].forEach(function (c) {
          if (!spotOK(c[0], c[1], 1.4)) return;
          box(1.5, 2.2, 0.5, c[0], 1.1, c[1], M.woodD); solid(c[0], c[1], 0.8, 0.35, 2.2);
          for (var sh = 0; sh < 3; sh++) { box(1.4, 0.05, 0.46, c[0], 0.6 + sh * 0.65, c[1], M.bone);
            for (var jj = 0; jj < 3; jj++) cyl(0.11, 0.3, c[0] - 0.45 + jj * 0.45, 0.8 + sh * 0.65, c[1], M.jar, 8); }
        });
        // the butcher's station — table, cleaver, and what he was working on
        var bt = [cx + 3.4, z0 + 1.6];
        if (spotOK(bt[0], bt[1], 1.5)) {
          box(1.7, 0.9, 0.9, bt[0], 0.45, bt[1], M.woodD); solid(bt[0], bt[1], 0.9, 0.5, 1.0);
          box(0.34, 0.05, 0.2, bt[0] - 0.3, 0.94, bt[1], M.steel); box(0.5, 0.24, 0.4, bt[0] + 0.35, 1.0, bt[1], M.meat);
        }
        // THE BRICKED-UP ARCHWAY — someone sealed a passage on the south wall,
        // brick by hurried brick (offset courses, mortar gaps, a few laid badly),
        // and chalked a warding X over it. The quest can CRACK it (KA.arch).
        var ax = CFG.cellToWorld(13, 11).x, az = z1 - 0.3;
        var archBricks = [];
        var mortar = box(2.34, 3.0, 0.16, ax, 1.5, az + 0.04, M.dark);   // shadow gap behind
        for (var br = 0; br < 8; br++) {                                  // 8 courses
          var course = 0.355, by2 = 0.19 + br * course, odd = br % 2;
          for (var bc = 0; bc < 4; bc++) {
            var bw3 = 0.52, bx3 = ax - 0.86 + bc * 0.575 + (odd ? 0.28 : 0);
            if (odd && bc === 3) bw3 = 0.26, bx3 -= 0.14;                 // cut end brick
            var hb = G.PU.hashStr('arch' + br + bc);
            var bmm = box(bw3, 0.3, 0.2, bx3, by2, az - (hb % 3) * 0.012, M.brick);
            bmm.rotation.z = ((hb % 5) - 2) * 0.012;                      // hurried coursework
            archBricks.push(bmm);
          }
        }
        box(2.7, 0.4, 0.28, ax, 3.16, az, M.marble);                      // stone lintel
        [-1.24, 1.24].forEach(function (jx) { box(0.24, 3.0, 0.24, ax + jx, 1.5, az, M.marble); }); // jambs
        var xr1 = box(1.8, 0.09, 0.06, ax, 1.6, az - 0.16, M.chalk); xr1.rotation.z = 0.6;
        var xr2 = box(1.8, 0.09, 0.06, ax, 1.6, az - 0.16, M.chalk); xr2.rotation.z = -0.6;
        KA.arch = {
          pos: new THREE.Vector3(ax, 0, az), cracked: false, bricks: archBricks,
          crack: function () {                                            // quest: blast it open a crack
            if (KA.arch.cracked) return; KA.arch.cracked = true;
            var cm = M.brick.clone(); cm.color.multiplyScalar(0.55);
            archBricks.forEach(function (b3, i3) {
              if (i3 % 3 === 0) { b3.rotation.z += (i3 % 2 ? 0.14 : -0.12); b3.position.z -= 0.05; }
              if (i3 % 4 === 0) b3.material = cm;
            });
          }
        };
        [[cx + 4.2, z1 - 1.1], [cx + 4.9, z1 - 1.9]].forEach(function (c) { if (spotOK(c[0], c[1], 1.2)) { cyl(0.42, 0.8, c[0], 0.4, c[1], M.woodD, 10); solid(c[0], c[1], 0.45, 0.45, 0.9); } });
        corners.forEach(function (c) { box(0.7, 1.1, 0.4, c[0], 0.55, c[1], M.corpse); sph(0.26, c[0], 1.2, c[1], M.chead); });
        glow(cx, 2.6, cz, 0x9aa6b0, 0.7, 15);

      } else if (rid === 'N') {                // THE SANCTUM — Voss's bargain room
        ring(2.0, 0.12, cx, cz, M.rune); ring(1.3, 0.08, cx, cz, M.runeF, 0.09);
        for (var gi = 0; gi < 4; gi++) { var ga = gi / 4 * 6.28; box(0.32, 0.32, 0.06, cx + Math.cos(ga) * 2.0, 1.5 + (gi % 2) * 0.4, cz + Math.sin(ga) * 2.0, M.aether); }
        // chalk leads run OUT from the ring toward four floor SIGILS — Voss's
        // diagram is the quest's first stage: the sigils must be lit (interact.js
        // reads KA.sigils and makes each one pressable once the power is on)
        KA.sigils = [];
        for (var ch2 = 0; ch2 < 4; ch2++) {
          var ca = ch2 / 4 * Math.PI * 2 + Math.PI / 4;
          var ln = box(0.07, 0.012, 3.4, cx + Math.cos(ca) * 4.0, 0.06, cz + Math.sin(ca) * 4.0, M.chalk);
          ln.rotation.y = -ca + Math.PI / 2;
          var sgx = cx + Math.cos(ca) * 5.9, sgz = cz + Math.sin(ca) * 5.9;
          var sg = box(0.42, 0.014, 0.42, sgx, 0.06, sgz, M.rune.clone());
          sg.rotation.y = 0.6 + ch2;                       // each mark sits askew
          KA.sigils.push({ mesh: sg, pos: new THREE.Vector3(sgx, 0, sgz), lit: false });
        }
        // the founder's library — shelves of individual, mismatched volumes
        // (deterministic heights/leans, a small spine palette — not one slab)
        var spineC = [M.velvet, M.paper, M.leather, M.woodD, M.brass];
        [[x0 + 0.65, cz - 3.3], [x0 + 0.65, cz - 1.1]].forEach(function (c, si2) {
          if (!spotOK(c[0], c[1], 1.4)) return;
          box(0.5, 2.4, 1.9, c[0], 1.2, c[1], M.woodD); solid(c[0], c[1], 0.35, 1.0, 2.4);
          box(0.56, 0.08, 2.0, c[0], 2.44, c[1], M.brass);            // cornice
          for (var sh2 = 0; sh2 < 3; sh2++) {
            box(0.44, 0.04, 1.8, c[0] + 0.05, 0.32 + sh2 * 0.7, c[1], M.woodD);   // shelf board
            var bz2 = c[1] - 0.78;
            for (var bk = 0; bk < 7; bk++) {
              var hsh = G.PU.hashStr('bk' + si2 + sh2 + bk);
              var bh = 0.3 + (hsh % 5) * 0.045, bw2 = 0.16 + (hsh % 3) * 0.05;
              var bm2 = box(0.34, bh, bw2, c[0] + 0.1, 0.35 + sh2 * 0.7 + bh / 2, bz2 + bw2 / 2, spineC[hsh % spineC.length]);
              if (hsh % 4 === 0) bm2.rotation.x = 0.12;               // the odd leaner
              bz2 += bw2 + 0.03;
            }
          }
        });
        // candle clusters (emissive flames, no lights) just inside the ritual
        // ring — r < 2.4 keeps them off the kite lane
        [[cx - 1.5, cz + 1.5], [cx + 1.6, cz + 1.4], [cx + 1.5, cz - 1.6]].forEach(function (c) {
          if (!spotOK(c[0], c[1], 1.0)) return;
          for (var cn = 0; cn < 3; cn++) { var ccx = c[0] + (cn - 1) * 0.22, ccz = c[1] + (cn % 2) * 0.2;
            cyl(0.05, 0.3 + (cn % 3) * 0.12, ccx, 0.18, ccz, M.candle, 6);
            KA.candles.push(sph(0.045, ccx, 0.4 + (cn % 3) * 0.12, ccz, M.flame)); }
        });
        // VOSS HIMSELF — the portrait hangs over his font (the PaP wall, east),
        // eyes on the ring. Layered frame, canted forward off the wall the way
        // heavy portraits hang; brass nameplate beneath. The face never quite
        // resolves — and it is the quest's final door (interact.js reads KA.voss).
        var vG = new THREE.Group();
        vG.position.set(x1 - 0.3, 2.5, cz + 0.4); vG.rotation.z = 0; vG.rotation.y = -Math.PI / 2;
        vG.rotation.x = 0.1;                                              // leans off the wall
        function vbox(w, h, d, x, y, z, m) { var e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); e.position.set(x, y, z); vG.add(e); return e; }
        vbox(1.6, 2.1, 0.1, 0, 0, 0, M.gold);                             // outer frame
        vbox(1.36, 1.86, 0.1, 0, 0, 0.025, M.woodD);                      // frame step
        vbox(1.2, 1.7, 0.08, 0, 0, 0.05, M.dark);                         // the canvas
        vbox(0.5, 0.65, 0.07, 0, -0.25, 0.09, M.dark);                    // his shoulders
        var vFace = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), M.face.clone());
        vFace.position.set(0, 0.28, 0.1); vFace.scale.set(0.8, 1.1, 0.6); vG.add(vFace);
        vbox(0.7, 0.14, 0.03, 0, -1.18, 0.06, M.brass);                   // nameplate: A. VOSS
        S.add(vG);
        KA.face = vFace;
        KA.voss = { group: vG, pos: new THREE.Vector3(x1 - 0.9, 0, cz + 0.4) };
        // hanging censers, still smoking after all these years
        [[cx - 2.2, cz - 2.2], [cx + 2.2, cz + 2.2]].forEach(function (c) {
          cyl(0.03, 1.4, c[0], WALL_H - 0.7, c[1], M.brass, 6); sph(0.16, c[0], WALL_H - 1.5, c[1], M.brass);
          coneM(0.12, 0.5, c[0], WALL_H - 1.1, c[1], M.iceGl);
        });
        // braziers glow from their emissive orbs alone — four extra PointLights
        // here were the map's single biggest light-count hotspot (audit)
        corners.forEach(function (c) { cyl(0.22, 1.2, c[0], 0.6, c[1], M.brass); sph(0.3, c[0], 1.4, c[1], M.aether); solid(c[0], c[1], 0.35, 0.35, 1.5); });
        glow(cx, 2.4, cz, 0x9c6cf0, 1.2, 16);

      } else if (rid === 'B') {                // MINERAL BATHS — the source, still warm
        disc(2.8, cx, cz, M.water); ring(2.9, 0.16, cx, cz, M.brass, 0.12);
        ring(3.15, 0.06, cx, cz, M.marble, 0.07);       // mineral crust the water left
        glow(cx, 1.6, cz, 0x3fd0c8, 1.0, 16);
        // steam still lifts off the spring water
        for (var sw = 0; sw < 4; sw++) {
          var sa = sw / 4 * Math.PI * 2 + 0.7, sr = 0.7 + (sw % 2) * 1.0;
          var sm = new THREE.MeshBasicMaterial({ color: 0xcfeee8, transparent: true, opacity: 0.22, depthWrite: false });
          var sp2 = sph(0.3 + (sw % 2) * 0.12, cx + Math.cos(sa) * sr, 0.6, cz + Math.sin(sa) * sr, sm);
          KA.steam.push({ m: sp2, mat: sm, spd: 0.35 + (sw % 3) * 0.12, ph: sw * 1.6 });
        }
        // a guest who never got out of the water
        box(0.45, 0.22, 1.3, cx + 1.1, 0.16, cz + 0.5, M.bone);
        sph(0.16, cx + 1.1, 0.24, cz + 1.25, M.bone);
        // changing stalls along the south wall, doors ajar — mid-afternoon, once.
        // Framed panels with a top rail, brass hooks, a towel left over one door.
        [[x1 - 1.1, z1 - 1.0], [x1 - 2.6, z1 - 1.0]].forEach(function (c, i) {
          if (!spotOK(c[0], c[1], 1.3)) return;
          box(0.08, 2.0, 1.5, c[0] - 0.65, 1.0, c[1], M.woodD); box(0.08, 2.0, 1.5, c[0] + 0.65, 1.0, c[1], M.woodD);
          box(1.42, 0.1, 0.1, c[0], 2.05, c[1] - 0.72, M.brass);          // top rail
          box(0.05, 0.16, 0.05, c[0] - 0.55, 1.7, c[1] - 0.7, M.brass);   // hook
          var dr = box(1.1, 1.9, 0.06, c[0] + (i ? 0.3 : -0.2), 0.95, c[1] - 0.8, M.woodD); dr.rotation.y = i ? 0.5 : -0.7;
          box(0.9, 0.06, 0.14, c[0] + (i ? 0.3 : -0.2), 1.92, c[1] - 0.8, M.woodD).rotation.y = dr.rotation.y;  // door cap
          if (i === 0) { var tw2 = box(0.34, 0.5, 0.08, c[0] - 0.25, 1.6, c[1] - 0.82, M.towel); tw2.rotation.y = dr.rotation.y; tw2.rotation.z = 0.05; } // towel over the door
          box(1.2, 0.35, 0.5, c[0], 0.2, c[1] + 0.4, M.marble);           // bench
          box(1.1, 0.06, 0.4, c[0], 0.4, c[1] + 0.4, M.woodD);            // bench slat
          solid(c[0], c[1], 0.75, 0.8, 2.1);
        });
        // pool ladder — brass rails curling over the rim
        [[cx + 2.75, cz - 0.6]].forEach(function (c) {
          [-0.22, 0.22].forEach(function (off2) {
            cyl(0.035, 1.1, c[0], 0.55, c[1] + off2, M.brass, 8);
            var curl = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 10, Math.PI), M.brass);
            curl.position.set(c[0] - 0.14, 1.1, c[1] + off2); curl.rotation.z = -Math.PI / 2; S.add(curl);
          });
          for (var rg2 = 0; rg2 < 3; rg2++) box(0.04, 0.04, 0.44, c[0], 0.25 + rg2 * 0.32, c[1], M.brass);
        });
        // towel shelf by the water — folded, waiting
        var tw = [x0 + 0.7, z0 + 1.5];
        if (spotOK(tw[0], tw[1], 1.3)) {
          box(0.5, 1.6, 1.4, tw[0], 0.8, tw[1], M.woodD); solid(tw[0], tw[1], 0.35, 0.8, 1.7);
          for (var tsh = 0; tsh < 2; tsh++) for (var tt = 0; tt < 2; tt++) box(0.4, 0.14, 0.5, tw[0] + 0.06, 0.55 + tsh * 0.6, tw[1] - 0.35 + tt * 0.7, M.towel);
        }
        corners.forEach(function (c, i) { cyl(0.16, WALL_H, c[0], WALL_H / 2, c[1], M.brass); if (i % 2) cyl(0.16, WALL_H, c[0] + 0.5, WALL_H / 2, c[1], M.brass); });

      } else if (rid === 'A') {                // PUMP HALL — the machine heart of the Kurhaus
        // the aether manifold: a brass heart in the floor, lines feeding every wing.
        // Its glow BREATHES (slow before power, urgent after) — cloned material so
        // the Sanctum's shared rune glow doesn't pulse with it.
        ring(2.2, 0.1, cx, cz, M.brass, 0.05);
        var maniMat = M.runeF.clone();
        KA.manifold = { mat: maniMat };
        disc(0.9, cx, cz, maniMat, 0.04);
        for (var mr = 0; mr < 4; mr++) {
          var ma = mr / 4 * Math.PI * 2 + Math.PI / 4;
          var st2 = box(0.3, 0.018, 5.4, cx + Math.cos(ma) * 4.6, 0.05, cz + Math.sin(ma) * 4.6, M.trim);
          st2.rotation.y = -ma + Math.PI / 2;
        }
        // gauge bank on the north wall — the needles all pinned past red
        for (var gg = 0; gg < 3; gg++) {
          var gx2 = cx - 1.6 + gg * 1.6;
          cyl(0.34, 0.1, gx2, 2.2, z0 + 0.32, M.marble, 14).rotation.x = Math.PI / 2;
          var nd = box(0.05, 0.26, 0.03, gx2 + 0.08, 2.28, z0 + 0.24, M.velvet); nd.rotation.z = -0.8;
          KA.needles.push(nd);
          var vw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 12), M.brass);
          vw.position.set(gx2, 1.35, z0 + 0.3); S.add(vw);
        }
        // piston columns flanking the gauge bank — plinth, shaft, capital, bolted
        // corner flanges, the aether slot still glowing faintly
        [[cx - 3.3, z0 + 0.75], [cx + 3.3, z0 + 0.75]].forEach(function (c) {
          if (!spotOK(c[0], c[1], 1.3)) return;
          box(1.05, 0.25, 1.05, c[0], 0.125, c[1], M.iron);              // plinth
          box(0.8, 3.0, 0.8, c[0], 1.75, c[1], M.iron);                  // shaft
          box(1.0, 0.2, 1.0, c[0], 3.35, c[1], M.brass);                 // capital
          [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]].forEach(function (f2) {
            box(0.1, 2.8, 0.1, c[0] + f2[0], 1.7, c[1] + f2[1], M.brass);  // corner flanges
          });
          box(0.16, 2.4, 0.06, c[0], 1.7, c[1] + 0.44, M.runeF);         // aether slot
          solid(c[0], c[1], 0.55, 0.55, 3.5);
        });
        corners.forEach(function (c) { box(1.0, 1.5, 1.0, c[0], 0.75, c[1], M.brass); cyl(0.5, 0.3, c[0], 1.65, c[1], M.pipe); sph(0.22, c[0] + (c[0] < cx ? 0.55 : -0.55), 1.05, c[1], M.gold); solid(c[0], c[1], 0.55, 0.55, 1.6); });
        [x0 + 0.5, x1 - 0.5].forEach(function (px) { var e = cyl(0.13, bb.d - 1.0, px, WALL_H - 0.5, cz, M.pipe); e.rotation.x = Math.PI / 2; });

      } else if (rid === 'S') {                // GRAND FOYER — the welcome that soured
        glow(cx, 2.8, cz, 0xe0b070, 0.5, 20);
        // the red carpet still runs the length of the concourse (flat, walkable)
        box(bb.w - 3.2, 0.025, 2.2, cx, 0.013, cz, M.carpet);
        box(bb.w - 3.2, 0.02, 0.16, cx, 0.012, cz - 1.25, M.trim);
        box(bb.w - 3.2, 0.02, 0.16, cx, 0.012, cz + 1.25, M.trim);
        // the KURHAUS crest over the north wall, gilt and cracked
        var crest = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 22), M.trim);
        crest.position.set(cx, 3.15, z0 + 0.25); S.add(crest);
        var crestFace = new THREE.Mesh(new THREE.CircleGeometry(0.5, 22), M.gold);
        crestFace.position.set(cx, 3.15, z0 + 0.28); S.add(crestFace);
        // abandoned luggage where the evacuation stalled — tossed, not stacked:
        // every case sits at its own angle, straps and latches still buckled
        [[cx - 5.5, z0 + 1.0], [cx + 6.5, z0 + 1.0], [cx - 7.5, z1 - 1.0]].forEach(function (c, i) {
          if (!spotOK(c[0], c[1], 1.3)) return;
          var big = box(0.9, 0.5, 0.55, c[0], 0.25, c[1], M.leather); big.rotation.y = 0.22 + i * 0.3;
          box(0.1, 0.52, 0.57, c[0] - 0.22, 0.25, c[1], M.woodD).rotation.y = big.rotation.y;   // strap
          box(0.1, 0.52, 0.57, c[0] + 0.22, 0.25, c[1], M.woodD).rotation.y = big.rotation.y;
          var top2 = box(0.66, 0.4, 0.46, c[0] + 0.3, 0.7, c[1] + 0.08, M.canvas); top2.rotation.y = -0.35 - i * 0.2; top2.rotation.z = 0.06;
          box(0.2, 0.06, 0.3, c[0] + 0.28, 0.92, c[1] + 0.08, M.brass).rotation.y = top2.rotation.y;  // latch plate
          if (i === 0) cyl(0.22, 0.16, c[0] - 0.7, 0.08, c[1] + 0.35, M.dark, 12);                     // a dropped hat
          if (i === 1) { var spill = box(0.4, 0.06, 0.3, c[0] - 0.7, 0.03, c[1] + 0.4, M.towel); spill.rotation.y = 0.8; } // spilled linens
          solid(c[0], c[1], 0.6, 0.4, 1.0);
        });
        // the grandfather clock stopped at the hour it happened — crowned,
        // plinthed, door ajar
        var gc = [x1 - 0.75, z0 + 1.1];
        if (spotOK(gc[0], gc[1], 1.3)) {
          box(1.0, 0.18, 0.62, gc[0], 0.09, gc[1], M.woodD);                 // plinth
          box(0.85, 3.0, 0.5, gc[0], 1.59, gc[1], M.woodD); solid(gc[0], gc[1], 0.5, 0.35, 3.2);
          box(1.0, 0.22, 0.6, gc[0], 3.2, gc[1], M.brass);                   // crown
          box(0.98, 0.1, 0.58, gc[0], 3.02, gc[1], M.woodD);                 // cornice step
          cyl(0.3, 0.06, gc[0], 2.55, gc[1] - 0.26, M.marble, 14).rotation.x = Math.PI / 2;
          box(0.04, 0.22, 0.02, gc[0], 2.6, gc[1] - 0.3, M.dark);            // hands, stopped
          box(0.02, 0.16, 0.02, gc[0] + 0.1, 2.52, gc[1] - 0.3, M.dark);
          var cdoor = box(0.5, 1.5, 0.05, gc[0] - 0.28, 1.1, gc[1] - 0.3, M.woodD); cdoor.rotation.y = -0.5;  // door ajar
          box(0.16, 0.9, 0.06, gc[0], 1.3, gc[1] - 0.26, M.brass);           // dead pendulum
        }
        // reception desk (counter top overhang, inset front panels, the guest
        // ledger open on top) + broken column with its fallen drum ring
        corners.forEach(function (c, i) {
          if (i % 2 === 0) {
            box(2.6, 1.0, 0.9, c[0], 0.5, c[1], M.gold);
            box(2.84, 0.1, 1.06, c[0], 1.06, c[1], M.woodD);                 // counter overhang
            box(2.3, 0.5, 0.06, c[0], 0.42, c[1] - 0.46, M.woodD);           // front panel inset
            var ledger = box(0.5, 0.06, 0.35, c[0] - 0.6, 1.14, c[1], M.paper); ledger.rotation.y = 0.35; ledger.rotation.x = 0.04;
            box(0.02, 0.1, 0.35, c[0] - 0.6, 1.16, c[1], M.velvet).rotation.y = 0.35;  // spine
            solid(c[0], c[1], 1.42, 0.53, 1.1);
          } else {
            cyl(0.4, WALL_H - 1.6, c[0], (WALL_H - 1.6) / 2 + 0.3, c[1], M.gold, 12);
            cyl(0.5, 0.3, c[0], 0.15, c[1], M.marble, 12);                   // base
            var drum = cyl(0.38, 0.5, c[0] + 0.8, 0.22, c[1] + 0.5, M.gold, 12); // fallen drum
            drum.rotation.z = Math.PI / 2.2; drum.rotation.y = 0.5;
            var ch = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 6, 16), M.brass);
            ch.position.set(c[0], 0.3, c[1]); ch.rotation.set(0.5, 0, 0.3); S.add(ch);
            solid(c[0], c[1], 0.45, 0.45, WALL_H - 1.0);
          }
        });
      }
    }

    /* ---- per-room: ceiling/beams, pillars, ribs, hero, debris ---- */
    Object.keys(P.rooms).forEach(function (rid) {
      var room = P.rooms[rid];
      var bb = roomBBox(room);
      var isOut = outdoor.indexOf(rid) >= 0;
      var edges = wallEdges(room);
      var rfy = map.floorYOf(rid);    // this room's floor height (B5 offsets)

      // a room flagged OPEN_CEIL (the Atrium's vertical shaft) keeps its walls
      // but has NO ceiling — it reads open all the way up to the floors above
      // (or, until they're built, to the sky). Treated like an indoor room in
      // every other respect (lighting, walls, props).
      var openCeil = (CFG.cur.OPEN_CEIL || []).indexOf(rid) >= 0;

      if (!isOut && !openCeil) {
        // ceiling tiles + cross beams + a solid ceiling collider so the roof
        // collision matches the visible ceiling (no dropping into a roofed room
        // from above, nothing standing on the roof)
        room.cells.forEach(function (cr) {
          var wc = CFG.cellToWorld(cr[0], cr[1]);
          var upperHere = map.floorCellAboveAt(cr[0], cr[1], rfy);
          // The upper storey's structural slab is the ceiling here. In stair
          // shafts that slab is deliberately omitted, leaving honest headroom.
          // Either way, never stack a second coplanar downstairs ceiling at y=4.
          if (upperHere) return;
          // under a stacked floor (loft/deck) the deck IS the ceiling and the
          // player stands up there — skip both the ceiling tile AND collider so we
          // don't slice a phantom plane through the loft interior
          var underDeck = stageSpecs.some(function (sp) {
            return wc.x >= sp.x1 - 0.1 && wc.x <= sp.x2 + 0.1 && wc.z >= sp.z1 - 0.1 && wc.z <= sp.z2 + 0.1;
          });
          if (underDeck) return;
          // a stairwell cell lifts its ceiling to give the climber headroom
          var well = stairwellAt(wc.x, wc.z);
          if (well && well.integrated) return;
          var cy = (well ? well.roofY : WALL_H) + rfy;
          var cl = new THREE.Mesh(floorGeo, dCeil);
          cl.rotation.x = Math.PI / 2; cl.position.set(wc.x, cy - 0.02, wc.z);
          G.scene.add(cl);
          // ceiling collider. STACKING RULE (proved in _t3): when a real floor
          // sits ABOVE this one, the ceiling must seal from BELOW the inter-floor
          // boundary and NOT poke up into the floor above (the default +0.6
          // overhang would collide with a body standing on the upper floor). Cap
          // it to [cy-1, cy] there — a single collider, no redundant upper slab.
          // A lifted stairwell ceiling keeps its overhang (it sits above the
          // upper floor, clearing the climb). Top/only floor: overhang as before.
          var capped = map.floorAbove(rfy) && !well;
          map.addCollider(wc.x - CELL / 2, wc.z - CELL / 2, wc.x + CELL / 2, wc.z + CELL / 2,
                          capped ? cy - 1.0 : cy - 0.12, capped ? cy : cy + 0.6);
        });
        var roomHasIntegratedStair = room.cells.some(function (cr) {
          var rw = CFG.cellToWorld(cr[0], cr[1]), sw = stairwellAt(rw.x, rw.z);
          return sw && sw.integrated;
        });
        if (!roomHasIntegratedStair) {
          var along = bb.w >= bb.d;
          var span = along ? bb.d : bb.w, n = Math.max(1, Math.round(span / 4));
          for (var bj = 0; bj <= n; bj++) {
            var f = bj / n;
            if (along) addBox(bb.w - 0.1, 0.22, 0.22, bb.cx, WALL_H - 0.32,
              Math.min(bb.z1 - 0.11, Math.max(bb.z0 + 0.11, bb.z0 + f * bb.d)), dBeam);
            else addBox(0.22, 0.22, bb.d - 0.1,
              Math.min(bb.x1 - 0.11, Math.max(bb.x0 + 0.11, bb.x0 + f * bb.w)), WALL_H - 0.32, bb.cz, dBeam);
          }
        }
      } else if (isOut) {
        // outdoor: broken parapet chunks on perimeter wall tops (deterministic
        // heights so the silhouette is the same, intentional shape every load)
        edges.forEach(function (e, idx) {
          if (idx % 2 || e.door) return;
          var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
          var ph = 0.4 + G.PU.seeded(G.PU.hashStr('para:' + rid + ':' + e.cr[0] + ':' + e.cr[1] + e.dir))() * 0.6;
          addBox(e.o[0] ? 0.5 : 1.4, ph, e.o[0] ? 1.4 : 0.5,
            wc.x + e.o[0] * (CELL / 2 - 0.18), WALL_H + 0.1, wc.z + e.o[1] * (CELL / 2 - 0.18), dConc);
        });
      }

      // corner support pillars — skip any that would land in/near a doorway
      // (they'd block the threshold and read as a pillar in front of the door).
      // Kurhaus keeps the structural pillars/ribs (rooms read built) but swaps the
      // generic crate clutter + hero for its own per-wing themed decor (below).
      // Der Riese has its own authored factory pass below. Suppress the generic
      // hero/crate algorithm there so the rebuilt rooms stay readable and props
      // remain deliberately against walls rather than filling circulation lanes.
      var minimal = CFG.cur.id === 'kurhaus' || CFG.cur.id === 'derriese';
      var themed = CFG.cur.id === 'kurhaus';
      [[bb.x0 + 0.42, bb.z0 + 0.42], [bb.x1 - 0.42, bb.z0 + 0.42],
       [bb.x0 + 0.42, bb.z1 - 0.42], [bb.x1 - 0.42, bb.z1 - 0.42]].forEach(function (c) {
        var nearDoor = Object.keys(map.doors).some(function (id) {
          return Math.hypot(map.doors[id].pos.x - c[0], map.doors[id].pos.z - c[1]) < DOOR_APPROACH;
        });
        if (nearDoor) return;
        var ph = isOut ? WALL_H + 0.4 : WALL_H;
        addBox(0.46, ph, 0.46, c[0], ph / 2, c[1], dConc, { collide: true });
      });

      // wall ribs / pilasters on a regular rhythm (skip doors + windows) — a
      // deterministic every-other-bay cadence reads as deliberate structure
      // instead of the old random scatter that looked different each load
      edges.forEach(function (e) {
        if (e.door || e.win || (e.cr[0] + e.cr[1]) % 2 !== 0) return;
        var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
        var alongX = (e.dir === 'N' || e.dir === 'S');
        addBox(alongX ? 0.5 : 0.16, WALL_H - 0.5, alongX ? 0.16 : 0.5,
          wc.x + e.o[0] * (CELL / 2 - 0.1), (WALL_H - 0.5) / 2, wc.z + e.o[1] * (CELL / 2 - 0.1), dBeam);
      });

      // a themed hero structure (skipped on Kurhaus — kept clean)
      if (!minimal) placeHero(room, room.id && CFG.ROOMS[room.id] ? CFG.ROOMS[room.id].name : '');

      // outdoor yards: themed landmarks set along the perimeter walls, long axis
      // run PARALLEL to the wall so they hug the edge and never block the open
      // training centre. Deterministic, clear of doors/windows/interactables.
      if (isOut && !minimal) {
        var yardProps = {
          nacht: ['wrecked_car', 'sandbag_wall', 'barrel_cluster', 'crate_stack', 'concrete_barrier', 'cargo_container'],
          derriese: ['cargo_container', 'machinery_unit', 'barrel_cluster', 'concrete_barrier', 'crate_stack'],
          wetterjunge: ['cargo_container', 'crate_stack', 'razor_fence', 'supply_pallet', 'barrel_cluster']
        }[CFG.cur.id] || [];
        // solid landmark props hugging the perimeter walls — iterate ALL clear
        // edges so the themed list reliably lands, but keep it to the wall line
        // so the open training centre stays clear
        var oedges = wallEdges(room).filter(function (e) { return !e.door && !e.win; });
        var placed = 0;
        for (var oi = 0; oi < oedges.length && placed < yardProps.length; oi++) {
          var oe = oedges[(oi * 3 + 1) % oedges.length];
          if (placeAgainstWall(yardProps[placed], oe, rid)) placed++;
        }
        // low WALKABLE debris scattered across the field (no collider) — fills the
        // open yard so it reads as a real, lived-in place without touching the
        // training lanes. Deterministic.
        var scatter = { nacht: ['debris_pile', 'debris_pile', 'sandbag_stack'],
                        derriese: ['debris_pile', 'debris_pile', 'pallet'],
                        wetterjunge: ['snow_drift', 'debris_pile', 'snow_drift'] }[CFG.cur.id] || ['debris_pile'];
        var srng = G.PU.seeded(G.PU.hashStr('scatter:' + rid));
        var sw2 = Math.max(0.5, (bb.x1 - bb.x0) - 3.2), sd2 = Math.max(0.5, (bb.z1 - bb.z0) - 3.2);
        for (var si = 0; si < 8; si++) {
          var ssp = new THREE.Vector3(bb.x0 + 1.6 + srng() * sw2, 0, bb.z0 + 1.6 + srng() * sd2);
          if (!clearOf(ssp, 2.2)) continue;
          G.Props.create(scatter[(srng() * scatter.length) | 0], { position: ssp, rotationY: srng() * 6.28, seed: (G.PU.hashStr(rid + ':sc:' + si) || 1) });
          occupy(ssp);   // reserved so machines avoid it, but no collider (walkable)
        }
        // a perimeter work floodlight for mood (emissive head; no extra light
        // source, so the light budget stays steady)
        var flc = [[bb.x0 + 1.5, bb.z0 + 1.5], [bb.x1 - 1.5, bb.z1 - 1.5], [bb.x1 - 1.5, bb.z0 + 1.5]];
        for (var fi = 0; fi < flc.length; fi++) {
          var fp = new THREE.Vector3(flc[fi][0], 0, flc[fi][1]);
          if (!clearOf(fp, 1.4)) continue;
          G.Props.create('floodlight', { position: fp, rotationY: Math.atan2(bb.cx - fp.x, bb.cz - fp.z), seed: (G.PU.hashStr(rid + ':flood') || 1) });
          map.addCollider(fp.x - 0.35, fp.z - 0.35, fp.x + 0.35, fp.z + 0.35, 0, 0.5);
          occupy(fp);
          break;
        }
      }

      // one authored corner cluster per indoor room (replaces uniform debris
      // litter): a themed primary filler + a small supporting piece, tucked into
      // a dead corner out of the circling lane. Deterministic per map load, no
      // colliders (decorative) so navigation is untouched. (Skipped on Kurhaus —
      // it was littering every room with crates/debris and tanking perf.)
      if (!isOut && !minimal) {
        var clr = G.PU.seeded(G.PU.hashStr('clutter:' + rid));
        var fillers = {
          nacht: ['ammo_crate', 'sandbag_stack', 'wood_crate', 'crate_stack', 'barrel_cluster', 'debris_pile'],
          derriese: ['wood_crate', 'oil_drum', 'pallet', 'machinery_unit', 'crate_stack', 'debris_pile'],
          wetterjunge: ['wood_crate', 'gas_cylinder', 'field_radio', 'crate_stack', 'supply_pallet', 'debris_pile']
        }[CFG.cur.id] || ['wood_crate', 'debris_pile'];
        var smalls = ['debris_pile', 'wood_crate', 'ammo_crate', 'field_radio'];
        // corners PLUS mid-wall spots so big rooms get dressed along their length
        // (corner-only clusters leave large rooms looking bare)
        var corners = [[bb.x0 + 0.9, bb.z0 + 0.9], [bb.x1 - 0.9, bb.z0 + 0.9],
                       [bb.x0 + 0.9, bb.z1 - 0.9], [bb.x1 - 0.9, bb.z1 - 0.9],
                       [bb.cx, bb.z0 + 0.9], [bb.cx, bb.z1 - 0.9],
                       [bb.x0 + 0.9, bb.cz], [bb.x1 - 0.9, bb.cz]];
        // scale cluster count with floor area (~1 per 8 cells), capped
        var want = Math.max(2, Math.min(6, Math.round(room.cells.length / 8) + 1));
        var start = (clr() * corners.length) | 0, placedC = 0;
        // LAYERED corner clusters in 2-3 corners (not just one) — a primary
        // filler with a supporting piece and debris stepped inward along each
        // wall, so rooms read as lived-in with depth, not bare boxes
        for (var ci2 = 0; ci2 < corners.length && placedC < want; ci2++) {
          var cc = corners[(ci2 + start) % corners.length], cp = new THREE.Vector3(cc[0], 0, cc[1]);
          if (!clearOf(cp, 1.5)) continue;
          var inX = cc[0] < bb.cx ? 1 : -1, inZ = cc[1] < bb.cz ? 1 : -1;
          var prim = fillers[(clr() * fillers.length) | 0];
          G.Props.create(prim, { position: cp, rotationY: clr() * 6.28, seed: (G.PU.hashStr(rid + prim + ci2) || 1) });
          G.Props.create(smalls[(clr() * smalls.length) | 0],
            { position: new THREE.Vector3(cc[0] + inX * 0.85, 0, cc[1]), rotationY: clr() * 6.28, seed: (G.PU.hashStr(rid + 's' + ci2) || 2) });
          G.Props.create('debris_pile',
            { position: new THREE.Vector3(cc[0], 0, cc[1] + inZ * 0.85), seed: (G.PU.hashStr(rid + 'd' + ci2) || 3) });
          occupy(cp); placedC++;
        }
      }

      // KURHAUS — per-wing themed decor (the lava caldera, frost vents, meat
      // locker, aether sanctum, mineral baths, brass pump hall, decayed foyer).
      // Hugs the walls/corners, clear of the central training oval, modest mesh
      // counts so it reads rich without lag.
      if (themed) dressKurhausRoom(rid, room, bb);
    });

    // roof the DOORWAYS too: door cells belong to no room, so the room ceiling
    // loop skips them — leaving an open slot to the sky above every threshold.
    // Only roof a doorway that touches an indoor room, and never under a deck.
    for (var dr = 0; dr < P.rows; dr++) {
      for (var dc = 0; dc < P.cols; dc++) {
        if (!P.cells[dr][dc] || P.cells[dr][dc].type !== 'door') continue;
        var touchesIndoor = [[0, -1], [0, 1], [1, 0], [-1, 0]].some(function (o) {
          var n = map.cellAt(dc + o[0], dr + o[1]);
          return n && n.type === 'room' && outdoor.indexOf(n.room) < 0;
        });
        if (!touchesIndoor) continue;
        var dwc = CFG.cellToWorld(dc, dr);
        // A real upper slab spans this threshold. The former +0.6m doorway
        // ceiling overhang was the invisible wall blocking upstairs movement.
        if (map.floorCellAboveAt(dc, dr, 0)) continue;
        var underDeckD = stageSpecs.some(function (sp) {
          return dwc.x >= sp.x1 - 0.1 && dwc.x <= sp.x2 + 0.1 && dwc.z >= sp.z1 - 0.1 && dwc.z <= sp.z2 + 0.1;
        });
        if (underDeckD) continue;
        var dcl = new THREE.Mesh(floorGeo, dCeil);
        dcl.rotation.x = Math.PI / 2; dcl.position.set(dwc.x, WALL_H - 0.02, dwc.z);
        G.scene.add(dcl);
        map.addCollider(dwc.x - CELL / 2, dwc.z - CELL / 2, dwc.x + CELL / 2, dwc.z + CELL / 2, WALL_H - 0.12, WALL_H + 0.6);
        // lintel joist across the threshold so the roofed doorway reads as a
        // framed passage (decorative — matches the room cross-beams)
        var nDoor = map.cellAt(dc, dr - 1), sDoor = map.cellAt(dc, dr + 1);
        var passNS = (nDoor && nDoor.type === 'room') || (sDoor && sDoor.type === 'room');
        if (passNS) addBox(CELL, 0.2, 0.26, dwc.x, WALL_H - 0.34, dwc.z, dBeam);
        else addBox(0.26, 0.2, CELL, dwc.x, WALL_H - 0.34, dwc.z, dBeam);
      }
    }

    /* --------------------------------------------------- raised catwalks */
    var deckMat = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: palC('deck', 0x6b6f78) });
    var railMat = G.mats.metal;
    // ===================================================================
    // STAIRWELL-HEADROOM CONSTRAINT — READ BEFORE BUILDING ANY KURHAUS STAIR
    // -------------------------------------------------------------------
    // Every Kurhaus staircase MUST be built through buildStage (i.e. declared
    // as a stageSpec with a `stairs` block, like the Grand Staircase below),
    // NOT hand-placed. buildStage routes the stair through stairwellAt, which
    // automatically LIFTS the room ceiling over the flight (stairRects, roofY =
    // max(WALL_H, deckH + 2.0)) so a climber gets headroom at the TOP of the
    // run. If a stair is ever hand-placed instead, its top ceiling will sit at
    // the normal WALL_H and the climber/zombie will headbutt the roof and STALL
    // at the top of the stairs — and because the geometry still looks correct,
    // this fails SILENTLY (no error, just a nav body that won't finish the
    // climb). If you must hand-place a stair, you MUST also lift the ceiling
    // over its top cells by hand. (Descending stairs — descend:true — don't hit
    // this: dropping away from the ceiling only gains headroom.)
    // ===================================================================
    function buildStage(s) {
      // descending staircase: cuts down THROUGH an omitted floor slab to a
      // landing at s.baseH (a negative Y — the floor below). Built via buildStage
      // so it shares the stair idiom and is correct to wire to Floor B later; the
      // ground floor over its footprint is removed via the map's FLOOR_OMIT list.
      if (s.descend) {
        var bH = s.baseH, dst = s.stairs;
        var dn = dst.steps, drun = (dst.zBase - dst.zTop) / dn;
        var dsw = dst.x2 - dst.x1, dscx = (dst.x1 + dst.x2) / 2;
        // continuous walkable ramp from the ground-floor edge (y 0, at zTop) down
        // to the landing (y bH, at zBase)
        map.addSurface({ x1: dst.x1, x2: dst.x2,
                         z1: Math.min(dst.zTop, dst.zBase), z2: Math.max(dst.zTop, dst.zBase),
                         ramp: true, axis: 'z', c1: dst.zTop, c2: dst.zBase, h1: 0, h2: bH });
        for (var di = 1; di <= dn; di++) {
          var dzA = dst.zTop + (di - 1) * drun, dzN = dst.zTop + di * drun;
          var dStepH = bH * (di / dn);                 // tread height (descends to bH)
          addBox(dsw, 0.14, Math.abs(drun) + 0.05, dscx, dStepH + 0.07, dzN - drun / 2, deckMat);  // tread
          // solid fill from the landing level up to the tread underside, so there
          // is no gap under the descending flight and it reads as a stair mass
          if (dStepH - bH > 0.05)
            map.addCollider(dst.x1, Math.min(dzA, dzN), dst.x2, Math.max(dzA, dzN), bH, dStepH);
        }
        // bottom landing slab + collider + walkable surface (the future Floor B
        // connection pad)
        addBox(s.x2 - s.x1, 0.3, s.z2 - s.z1, (s.x1 + s.x2) / 2, bH - 0.15, (s.z1 + s.z2) / 2, deckMat);
        map.addCollider(s.x1, s.z1, s.x2, s.z2, bH - 0.25, bH + 0.05);
        map.addSurface({ x1: s.x1, x2: s.x2, z1: s.z1, z2: s.z2, y: bH });
        map.stages.push({
          deckCenter: new THREE.Vector3((s.x1 + s.x2) / 2, bH, (s.z1 + s.z2) / 2), deckTop: bH,
          stairBase: new THREE.Vector3(dscx, 0, dst.zTop)
        });
        return;
      }
      var H = s.h, dcx = (s.x1 + s.x2) / 2, dcz = (s.z1 + s.z2) / 2;
      var dw = s.x2 - s.x1, dd = s.z2 - s.z1;
      addBox(dw, 0.3, dd, dcx, H - 0.15, dcz, deckMat);          // floor slab (visual)
      if (s.thin) {
        // mezzanine / upper floor: a THIN slab so the ground beneath stays a
        // fully walkable room — a real stacked floor, not a solid block
        map.addCollider(s.x1, s.z1, s.x2, s.z2, H - 0.25, H + 0.05);
        // light the space BENEATH the deck — without this the under-mezzanine
        // area (a real walkable room) is pitch black and reads as a void. One
        // fixture below the slab, dimmer than a room lamp, on the power circuit.
        if (!s.integrated) {
          var ux = (Math.abs(s.x2 - s.x1) >= Math.abs(s.z2 - s.z1));
          var nU = Math.max(1, Math.round((ux ? dw : dd) / 6));
          for (var ui = 0; ui < nU; ui++) {
            var t = nU === 1 ? 0.5 : ui / (nU - 1);
            var ulx = ux ? (s.x1 + 1.2 + t * (dw - 2.4)) : dcx;
            var ulz = ux ? dcz : (s.z1 + 1.2 + t * (dd - 2.4));
            var ul = new THREE.PointLight(palC('lampTint', 0xffe9c0), 0.5, 12, 1);
            ul.position.set(ulx, H - 0.7, ulz);
            G.scene.add(ul); G.map.roomLights.push(ul);
          }
        }
      } else {
        addBox(dw, H, 0.2, dcx, H / 2, s.z2 - 0.1, deckMat);     // solid front fascia
        map.addCollider(s.x1, s.z1, s.x2, s.z2, 0, H);           // solid catwalk block
      }
      map.addSurface({ x1: s.x1, x2: s.x2, z1: s.z1, z2: s.z2, y: H });
      if (!s.integrated) {
        [[s.x1 + 0.3, s.z1 + 0.3], [s.x2 - 0.3, s.z1 + 0.3],
         [s.x1 + 0.3, s.z2 - 0.3], [s.x2 - 0.3, s.z2 - 0.3]].forEach(function (p) {
          addBox(0.22, H, 0.22, p[0], H / 2, p[1], railMat);       // support posts (decorative)
        });
      }
      // a widened deck is visibly braced: a row of posts along the back wall, an
      // under-deck cross-beam and angled brackets — decorative (no colliders, so
      // the courtyard route beneath stays clear)
      if (s.supports) {
        var span = s.x2 - s.x1, nP = Math.max(2, Math.round(span / 3.5));
        for (var pi = 1; pi < nP; pi++) {
          var px = s.x1 + span * pi / nP;
          addBox(0.2, H, 0.2, px, H / 2, s.z1 + 0.3, railMat);            // back-wall post
          addBox(0.16, 0.16, dd - 0.6, px, H - 0.4, dcz, dBeam);         // under-deck joist
          var br = addBox(0.5, 0.12, 0.12, px, H - 0.55, s.z2 - 0.45, dBeam); // front bracket
          br.rotation.x = 0.5;
        }
        addBox(span - 0.4, 0.16, 0.16, dcx, H - 0.4, s.z2 - 0.3, dBeam); // front edge beam
      }
      if (s.railings) {
        // Industrial guard rails on authored open catwalks. The staircase mouth
        // stays open, while thin colliders prevent an accidental fall through
        // the long sides during combat.
        function catRail(x1, z1, x2, z2) {
          var horizontal = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
          var len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
          var mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
          addBox(horizontal ? len : 0.1, 0.1, horizontal ? 0.1 : len,
                 mx, H + 1.0, mz, railMat);
          addBox(horizontal ? len : 0.08, 0.08, horizontal ? 0.08 : len,
                 mx, H + 0.52, mz, railMat);
          var posts = Math.max(2, Math.ceil(len / 2.5));
          for (var rp = 0; rp <= posts; rp++) {
            var rt = rp / posts;
            addBox(0.09, 1.05, 0.09, x1 + (x2 - x1) * rt, H + 0.52,
                   z1 + (z2 - z1) * rt, railMat);
          }
          map.addCollider(Math.min(x1, x2) - 0.08, Math.min(z1, z2) - 0.08,
                          Math.max(x1, x2) + 0.08, Math.max(z1, z2) + 0.08,
                          H, H + 1.15);
        }
        catRail(s.x1, s.z1, s.x2, s.z1);
        catRail(s.x1, s.z1, s.x1, s.z2);
        catRail(s.x2, s.z1, s.x2, s.z2);
        if (s.stairs) {
          if (s.stairs.x1 > s.x1 + 0.2) catRail(s.x1, s.z2, s.stairs.x1, s.z2);
          if (s.stairs.x2 < s.x2 - 0.2) catRail(s.stairs.x2, s.z2, s.x2, s.z2);
        } else catRail(s.x1, s.z2, s.x2, s.z2);
      }
      // edge barriers: enclosed upper ROOMS keep full walls; open catwalks have
      // NO railings (you're free to run/drop off the edges)
      if (s.walls) {
        var rh = 2.9, rmat = G.mats.wallA;
        function rail(x1, z1, x2, z2) {
          addBox(Math.max(0.12, x2 - x1), rh, Math.max(0.12, z2 - z1),
                 (x1 + x2) / 2, H + rh / 2, (z1 + z2) / 2, rmat);
          map.addCollider(x1, z1, x2, z2, H, H + rh);
        }
        if (s.railN) rail(s.x1, s.z1, s.x2, s.z1 + 0.12);
        if (s.railW) rail(s.x1, s.z1, s.x1 + 0.12, s.z2);
        if (s.railE) rail(s.x2 - 0.12, s.z1, s.x2, s.z2);
        if (s.railS) {  // wall with a gap where the staircase arrives
          var st0 = s.stairs;
          if (st0 && st0.x1 > s.x1 + 0.2) rail(s.x1, s.z2 - 0.12, st0.x1, s.z2);
          if (st0 && st0.x2 < s.x2 - 0.2) rail(st0.x2, s.z2 - 0.12, s.x2, s.z2);
          if (!st0) rail(s.x1, s.z2 - 0.12, s.x2, s.z2);
        }
        // ROOF the enclosed upper room — without this the loft was open to the
        // night sky (a black void above the room below). Solid slab + collider so
        // nothing drops in from above and the player can't hop out the top.
        addBox(s.x2 - s.x1, 0.22, s.z2 - s.z1, (s.x1 + s.x2) / 2, H + rh, (s.z1 + s.z2) / 2, deckMat);
        map.addCollider(s.x1, s.z1, s.x2, s.z2, H + rh - 0.12, H + rh + 0.5);
      }
      // staircase: a SMOOTH walkable ramp (one continuous slope, no per-step
      // bumps for the player and one clean nav level per cell so the horde
      // streams up it). The visible treads sit just under the ramp so it still
      // reads as a staircase. No railings (per design).
      var st = s.stairs;
      if (st) {
        var n = st.steps, run = (st.zBase - st.zTop) / n, sw = st.x2 - st.x1, scx = (st.x1 + st.x2) / 2;
        map.addSurface({ x1: st.x1, x2: st.x2, z1: st.zTop, z2: st.zBase,
                         ramp: true, axis: 'z', c1: st.zTop, c2: st.zBase, h1: H, h2: 0 });
        for (var i = 1; i <= n; i++) {
          var zA = st.zTop + (i - 1) * run, zN = st.zTop + i * run;  // tread z-span (north..south)
          var noseH = H * (n - i) / n;            // ramp height at the south (nose) edge
          // SOLID fill beneath the ramp, capped at the nose height so it never
          // pokes through the walking surface — this removes the phantom floor
          // nodes under the ramp that made the horde stall trying to path beneath
          // Solid concrete-fill stairs consume the entire volume below them.
          // Authored upper-storey stairs use an open steel frame instead: their
          // ramp remains walkable, but players can cross beneath the high end
          // and reach wall-mounted parts without hitting an invisible wedge.
          if (!s.openUnder && noseH > 0.05) map.addCollider(st.x1, zA, st.x2, zN, 0, noseH);
          addBox(sw, 0.14, run + 0.05, scx, noseH + 0.07, zN - run / 2, deckMat);   // tread (visual)
          // Open-frame stairs use floating steel treads: omitting the broad
          // vertical riser faces is what makes the under-stair route visually
          // honest instead of looking like a solid black wedge.
          if (!s.openUnder)
            addBox(sw, H / n + 0.04, 0.06, scx, noseH + (H / n) / 2, zN, deckMat);   // solid stair riser
        }
        if (s.openUnder) {
          // The floating tread edges themselves describe the incline. Large
          // diagonal box-stringers read as solid wedges from player height, so
          // the open version intentionally uses no broad side panels.
        }
        if (s.stairRails && !s.integrated) {
          // Narrow exterior access stair: two slim handrails and side collision,
          // scaled to the flight instead of throwing a broad frame across the yard.
          var srEdge = 0.1, srTop = H + 1.1;
          map.addCollider(st.x1 - srEdge, st.zTop, st.x1 + srEdge, st.zBase, 0, srTop);
          map.addCollider(st.x2 - srEdge, st.zTop, st.x2 + srEdge, st.zBase, 0, srTop);
          [st.x1 + 0.06, st.x2 - 0.06].forEach(function (rx) {
            addBox(0.09, 1.0, 0.09, rx, H + 0.5, st.zTop, railMat);
            addBox(0.09, 1.0, 0.09, rx, 0.5, st.zBase, railMat);
            var sdz = st.zBase - st.zTop, slen = Math.sqrt(sdz * sdz + H * H);
            var shr = addBox(0.09, 0.09, slen, rx, H / 2 + 0.82,
                             (st.zTop + st.zBase) / 2, railMat);
            shr.rotation.x = -Math.atan2(H, sdz);
          });
        }
        if (s.integrated) {
          var enclosed = s.shaft && !s.openUnder;
          if (enclosed) {
            // Real masonry stair hall: side walls hide the stair mass and its
            // collision volume, while both ends remain open as clean entrances.
            // This prevents diagonal handrails from visually slicing across the
            // room and makes the flight part of the building rather than a prop.
            var shaftLen = st.zBase - st.zTop, shaftMid = (st.zTop + st.zBase) / 2;
            [st.x1 - 0.12, st.x2 + 0.12].forEach(function (sx) {
              addBox(0.24, H, shaftLen, sx, H / 2, shaftMid, G.mats.wallA);
              map.addCollider(sx - 0.12, st.zTop, sx + 0.12, st.zBase, 0, H + 1.1);
              addBox(0.34, 0.34, shaftLen, sx, 0.22, shaftMid, dBeam);
            });
            // Deep lintel over the ground entrance gives the bay a deliberate
            // doorway without reducing player/zombie headroom.
            addBox(st.x2 - st.x1 + 0.48, 0.35, 0.3, (st.x1 + st.x2) / 2,
                   H - 0.2, st.zBase, dBeam);
          } else {
            // Open industrial stair hall (used by the weather station): slim
            // side collision and diagonal rails keep the crowd on the flight.
            var edge = 0.12, railTop = H + 1.0;
            map.addCollider(st.x1 - edge, st.zTop, st.x1 + edge, st.zBase, 0, railTop);
            map.addCollider(st.x2 - edge, st.zTop, st.x2 + edge, st.zBase, 0, railTop);
            [st.x1 + 0.08, st.x2 - 0.08].forEach(function (rx) {
              addBox(0.1, 1.0, 0.1, rx, H + 0.5, st.zTop, railMat);
              addBox(0.1, 1.0, 0.1, rx, 0.5, st.zBase, railMat);
              var dz = st.zBase - st.zTop, len = Math.sqrt(dz * dz + H * H);
              var hand = addBox(0.1, 0.1, len, rx, H / 2 + 0.85, (st.zTop + st.zBase) / 2, railMat);
              hand.rotation.x = -Math.atan2(H, dz);
            });
          }
          // Landing-side balustrades close the exposed omitted slab edges. The
          // north edge remains open, giving a clean, full-width entry upstairs.
          [s.x1 + 0.08, s.x2 - 0.08].forEach(function (rx) {
            addBox(0.1, 1.05, Math.max(0.2, s.z2 - s.z1), rx, H + 0.52, (s.z1 + s.z2) / 2, railMat);
          });
          addBox(st.x2 - st.x1, 1.05, 0.1, (st.x1 + st.x2) / 2, H + 0.52, st.zBase, railMat);
          map.addCollider(st.x1, st.zBase - 0.08, st.x2, st.zBase + 0.08, H, H + 1.2);
        }
      }
      map.stages.push({
        deckCenter: new THREE.Vector3(dcx, H, dcz), deckTop: H,
        stairBase: st ? new THREE.Vector3(scx, 0, st.zBase - 0.6) : null
      });
    }
    _fyByPos = true;   // stair meshes span floors — tag each by its real Y
    stageSpecs.forEach(buildStage);

    // STAIR GATES — a buyable debris barrier across a staircase's Floor-1 entrance
    // (the stair base for an up-flight, the stair top for a descend). Registered in
    // map.doors with cross-floor rooms so recomputeReachable flows spawn -> up/down
    // once bought. Spans the full stair width (a 1-cell door wouldn't block it).
    stageSpecs.forEach(function (s) {
      if (!s.gate || !s.stairs) return;
      var st = s.stairs, gz = s.descend ? st.zTop : st.zBase, gx = (st.x1 + st.x2) / 2;
      var gw = Math.abs(st.x2 - st.x1);
      var mesh = addBox(gw - 0.2, WALL_H - 0.4, 0.5, gx, (WALL_H - 0.4) / 2, gz, G.mats.wood, { solid: true });
      for (var k = -1; k <= 1; k++) {
        var pm = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.1, 0.3, 0.6), G.mats.plank);
        pm.position.set(0, k * 1.0, 0); pm.rotation.z = k * 0.12; mesh.add(pm);
      }
      var collider = map.addCollider(gx - gw / 2, gz - 0.6, gx + gw / 2, gz + 0.6, 0, WALL_H);
      var chip = costChip(s.gate.cost); chip.position.set(gx, 2.05, gz); G.scene.add(chip);
      map.doors['gate:' + s.gate.id] = {
        id: 'gate:' + s.gate.id, cost: s.gate.cost, name: s.gate.name, rooms: s.gate.rooms,
        open: false, mesh: mesh, collider: collider, sprite: chip, baseY: mesh.position.y,
        pos: new THREE.Vector3(gx, 0, gz)
      };
    });
    _fyByPos = false;

    // ---- STACKED FLOORS (B3) — build every non-primary floor at its own floorY,
    // sharing the same x,z footprint. A compact grey-box builder: floor slabs +
    // finite-band walls + capped/opened ceilings. The primary floor is already
    // built by the main path above; the inter-floor seam is sealed by the LOWER
    // floor's ceiling collider (capped to [cy-1, cy] when a floor sits above —
    // a single collider, no redundant second slab). Stairs (buildStage) connect
    // the floors; the Atrium shaft stays open (Floor 1 OPEN_CEIL + Floor 2 grid
    // void) so the down-view runs top to bottom.
    function buildExtraFloor(f) {
      var fp = CFG.parseGrid(f.GRID), fy = f.floorY || 0;
      _fy = fy;   // tag everything this builder adds (via addBox) to floor `fy`
      var omit = {}; (f.FLOOR_OMIT || []).forEach(function (c) { omit[c[0] + ',' + c[1]] = 1; });
      var openC = f.OPEN_CEIL || [], outd = f.OUTDOOR || [];
      var aboveCap = map.floorAbove(fy);          // a real floor sits above this one
      var anyMat = floorMats[Object.keys(floorMats)[0]];
      var fWinLookup = {};
      (f.WINDOWS || []).forEach(function (w) { fWinLookup[w.cell[0] + ',' + w.cell[1] + ',' + w.dir] = 1; });
      // flood-fill the EXTERIOR void from the grid border. Any void NOT reached is
      // an interior opening (the Atrium shaft a gallery rings) — its edge gets a
      // waist-high RAILING (real collider, blocks falling, low enough to see the
      // shaft down-view over) instead of a full wall that would block the sightline.
      var extVoid = {}, RAIL_H = 1.4, st = [];
      for (var cc = 0; cc < fp.cols; cc++) { st.push([cc, 0]); st.push([cc, fp.rows - 1]); }
      for (var rr = 0; rr < fp.rows; rr++) { st.push([0, rr]); st.push([fp.cols - 1, rr]); }
      while (st.length) {
        var p = st.pop(), pc = p[0], pr = p[1];
        if (pc < 0 || pr < 0 || pc >= fp.cols || pr >= fp.rows || extVoid[pc + ',' + pr]) continue;
        if (fp.cells[pr][pc].type !== 'void') continue;
        extVoid[pc + ',' + pr] = 1;
        st.push([pc + 1, pr]); st.push([pc - 1, pr]); st.push([pc, pr + 1]); st.push([pc, pr - 1]);
      }
      for (var r = 0; r < fp.rows; r++) {
        for (var c = 0; c < fp.cols; c++) {
          var cell = fp.cells[r][c];
          if (cell.type === 'void') continue;
          var wc = CFG.cellToWorld(c, r), isDoor = cell.type === 'door';
          // floor slab + walkable surface for ROOM and DOOR cells. Door cells are
          // open thresholds in this grey-box pass (debris/gating is a gameplay-pass
          // concern); they read as doorways via a decorative lintel below.
          if (!omit[c + ',' + r]) {
            var fmat = isDoor ? (floorMats[fp.doors[cell.door].rooms[0]] || anyMat) : (floorMats[cell.room] || anyMat);
            // A load-bearing slab with a visible soffit replaces the old
            // zero-thickness plane. Its 28cm fascia hides lower-wall tops and
            // makes the exterior read as one two-storey building.
            addBox(CELL + 0.04, 0.28, CELL + 0.04, wc.x, fy - 0.14, wc.z, fmat);
            map.addCollider(wc.x - CELL / 2, wc.z - CELL / 2, wc.x + CELL / 2, wc.z + CELL / 2,
                            fy - 0.28, fy + 0.04);
            map.addSurface({ x1: wc.x - CELL / 2, x2: wc.x + CELL / 2, z1: wc.z - CELL / 2, z2: wc.z + CELL / 2, y: fy, floor: true });
          }
          // perimeter / party walls (room cells) AND door-flank walls (door
          // cells) — finite band [fy, fy+WALL_H] so stacked floors tile edge to
          // edge. The door branch mirrors the primary floor (lines 716-717):
          // WITHOUT it a door's void-flanked sides have no wall on floors B/2, so
          // the player walks straight around the door slab and the inter-room
          // void columns read as "missing walls". Room boundaries dedup on E/S.
          if (cell.type === 'room' || isDoor) {
            ['N', 'S', 'E', 'W'].forEach(function (dir) {
              var o = OFF[dir], nc = c + o[0], nr = r + o[1], row2 = fp.cells[nr], n = (row2 && row2[nc]) || { type: 'void' };
              var build = false, rail = false, h = WALL_H;
              if (cell.type === 'room') {
                if (n.type === 'void' || (n.type === 'room' && n.room !== cell.room && (dir === 'E' || dir === 'S'))) {
                  build = true;
                  // a void neighbour the border flood-fill never reached is the
                  // interior shaft — waist-high railing there, full wall elsewhere
                  rail = n.type === 'void' && !extVoid[nc + ',' + nr];
                  h = rail ? RAIL_H : WALL_H;
                }
              } else {  // door cell: seal flanks toward void; passage (the room
                        // neighbours) stays open. Solid wall, never a railing.
                if (n.type === 'void') build = true;
              }
              // An authored up-stair meets the SOUTH edge of this upper floor.
              // Cut a full-width mouth in the perimeter wall; otherwise the
              // staircase reaches the correct height but terminates at a wall.
              if (build && dir === 'S' && n.type === 'void') {
                var edgeZ = wc.z + CELL / 2;
                var stairMouth = stageSpecs.some(function (sp) {
                  return sp.stairs && Math.abs((sp.h || 0) - fy) < 0.2 &&
                    Math.abs(sp.stairs.zTop - edgeZ) < 0.25 &&
                    wc.x >= sp.stairs.x1 - 0.1 && wc.x <= sp.stairs.x2 + 0.1;
                });
                if (stairMouth) build = false;
              }
              if (!build) return;
              var cx = wc.x + o[0] * CELL / 2, cz = wc.z + o[1] * CELL / 2, alongX = (dir === 'N' || dir === 'S');
              var m = rail ? G.mats.metal : ((c + r) % 2 ? G.mats.wallA : G.mats.wallB);
              var framedWindow = !rail && !!fWinLookup[c + ',' + r + ',' + dir];
              if (framedWindow) {
                var sill = 1.0, openingTop = 2.6, post = 0.68;
                if (alongX) {
                  addBox(CELL, sill, WALL_T, cx, fy + sill / 2, cz, m);
                  addBox(post, WALL_H, WALL_T, cx - CELL / 2 + post / 2, fy + WALL_H / 2, cz, m);
                  addBox(post, WALL_H, WALL_T, cx + CELL / 2 - post / 2, fy + WALL_H / 2, cz, m);
                  addBox(CELL, WALL_H - openingTop, WALL_T, cx, fy + (WALL_H + openingTop) / 2, cz, m);
                } else {
                  addBox(WALL_T, sill, CELL, cx, fy + sill / 2, cz, m);
                  addBox(WALL_T, WALL_H, post, cx, fy + WALL_H / 2, cz - CELL / 2 + post / 2, m);
                  addBox(WALL_T, WALL_H, post, cx, fy + WALL_H / 2, cz + CELL / 2 - post / 2, m);
                  addBox(WALL_T, WALL_H - openingTop, CELL, cx, fy + (WALL_H + openingTop) / 2, cz, m);
                }
              } else if (alongX) addBox(CELL + WALL_T, h, WALL_T, cx, fy + h / 2, cz, m);
              else addBox(WALL_T, h, CELL + WALL_T, cx, fy + h / 2, cz, m);
              if (!rail) {
                // Continuous base and cornice courses visually lock the upper
                // façade to the slab below and roof above.
                if (alongX) {
                  addBox(CELL + 0.08, 0.18, WALL_T + 0.08, cx, fy + 0.18, cz, dBeam);
                  addBox(CELL + 0.12, 0.2, WALL_T + 0.1, cx, fy + WALL_H - 0.18, cz, dBeam);
                } else {
                  addBox(WALL_T + 0.08, 0.18, CELL + 0.08, cx, fy + 0.18, cz, dBeam);
                  addBox(WALL_T + 0.1, 0.2, CELL + 0.12, cx, fy + WALL_H - 0.18, cz, dBeam);
                }
              }
              map.addCollider(cx - (alongX ? CELL / 2 : WALL_T / 2), cz - (alongX ? WALL_T / 2 : CELL / 2),
                              cx + (alongX ? CELL / 2 : WALL_T / 2), cz + (alongX ? WALL_T / 2 : CELL / 2), fy, fy + h);
            });
          }
          // a DESCEND staircase punches DOWN through this floor's ceiling — skip
          // the ceiling there or the seam seal blocks the climber's head going up
          var underDescend = stageSpecs.some(function (sp) {
            return sp.descend && wc.x >= sp.x1 - 0.1 && wc.x <= sp.x2 + 0.1 && wc.z >= sp.z1 - 0.1 && wc.z <= sp.z2 + 0.1;
          });
          // ceiling — skipped for an open shaft / outdoor / under a descend
          // stairwell; capped just below the boundary when a floor sits above
          var roomOpen = cell.type === 'room' && (openC.indexOf(cell.room) >= 0 || outd.indexOf(cell.room) >= 0);
          if (!underDescend && !roomOpen) {
            var cy = fy + WALL_H;
            var cl = new THREE.Mesh(floorGeo, dCeil); cl.rotation.x = Math.PI / 2;
            cl.position.set(wc.x, cy - 0.02, wc.z); G.scene.add(cl);
            map.addCollider(wc.x - CELL / 2, wc.z - CELL / 2, wc.x + CELL / 2, wc.z + CELL / 2,
                            aboveCap ? cy - 1.0 : cy - 0.12, aboveCap ? cy : cy + 0.6);
          }
        }
      }
      // Roof mass and eaves. Build contiguous row strips so there are no sky
      // holes, while keeping mesh count modest. The interior ceiling remains at
      // y=fy+WALL_H; this cap sits above it and is visible from every approach.
      var roofMat = G.MAT.get('concreteDark');
      for (var roofRow = 0; roofRow < fp.rows; roofRow++) {
        var runStart = -1;
        for (var roofCol = 0; roofCol <= fp.cols; roofCol++) {
          var rc = roofCol < fp.cols && fp.cells[roofRow][roofCol];
          var roofed = rc && rc.type !== 'void' && !(rc.type === 'room' && outd.indexOf(rc.room) >= 0);
          if (roofed && runStart < 0) runStart = roofCol;
          if ((!roofed || roofCol === fp.cols) && runStart >= 0) {
            var end = roofCol - 1, rw0 = CFG.cellToWorld(runStart, roofRow), rw1 = CFG.cellToWorld(end, roofRow);
            addBox((end - runStart + 1) * CELL + 0.38, 0.32, CELL + 0.38,
              (rw0.x + rw1.x) / 2, fy + WALL_H + 0.14, rw0.z, roofMat);
            runStart = -1;
          }
        }
      }
      // buyable debris doors for this floor — globally-keyed (floorId:localId) so
      // they don't collide with Floor 1's numeric ids, cost from the floor's DOORS
      Object.keys(fp.doors).forEach(function (lid) {
        var pd = fp.doors[lid], cd = (f.DOORS && f.DOORS[lid]) || { cost: 1000, name: 'Door' };
        var cr0 = pd.cells[0], wcd = CFG.cellToWorld(cr0[0], cr0[1]);
        var alongZ = ['N', 'S'].some(function (dir) { var o = OFF[dir], rr2 = fp.cells[cr0[1] + o[1]]; return rr2 && rr2[cr0[0]] && rr2[cr0[0]].type === 'room'; });
        buildBuyDoor(f.id + ':' + lid, cd.cost, cd.name, pd.rooms, wcd.x, wcd.z, fy, alongZ);
      });
      // spawn windows — boarded openings registered for the round director, at fy
      (f.WINDOWS || []).forEach(function (w) {
        var wcw = CFG.cellToWorld(w.cell[0], w.cell[1]), o = OFF[w.dir];
        var cwx = wcw.x + o[0] * CELL / 2, cwz = wcw.z + o[1] * CELL / 2, alongX = (w.dir === 'N' || w.dir === 'S');
        var cw = fp.cells[w.cell[1]] && fp.cells[w.cell[1]][w.cell[0]];
        var dirVec = new THREE.Vector3(o[0], 0, o[1]), center = new THREE.Vector3(cwx, fy, cwz);
        var win = { idx: map.windows.length, room: cw && cw.room, pos: center, dir: dirVec,
          outside: center.clone().addScaledVector(dirVec, 2.2), inside: center.clone().addScaledVector(dirVec, -1.4),
          boards: 5, boardMeshes: [] };
        for (var b = 0; b < 5; b++) win.boardMeshes.push(addBox(alongX ? 2.6 : 0.09, 0.28, alongX ? 0.09 : 2.6, cwx, fy + 1.1 + b * 0.34, cwz, G.mats.plank));
        win.setBoards = function (n) { n = Math.max(0, Math.min(5, n)); this.boards = n; for (var i = 0; i < 5; i++) this.boardMeshes[i].visible = i < n; };
        win.tearBoard = function () { if (this.boards <= 0) return false; G.map.flyingPlank(this.boardMeshes[this.boards - 1].position, this.dir.clone().negate()); this.setBoards(this.boards - 1); G.audio.boardTear(); return true; };
        map.windows.push(win);
      });
    }
    (CFG.cur._floors || []).forEach(function (f) { if (f !== CFG.cur._primary) buildExtraFloor(f); });
    _fy = 0;   // anything built after the floor loop defaults back to the ground floor

    // AETHER SURGE marker — one reusable pulsing floor ring, moved to whichever
    // wing surges (mesh visibility only — no light churn, no per-round allocs)
    if (CFG.cur.SURGE_ROOMS && CFG.cur.SURGE_ROOMS.length) {
      var sRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 8, 36),
        new THREE.MeshBasicMaterial({ color: 0xb790ff, transparent: true, opacity: 0.35, depthWrite: false }));
      sRing.rotation.x = Math.PI / 2; sRing.position.y = 0.09; sRing.visible = false;
      G.scene.add(sRing);
      map.surgeRing = sRing; map.surge = null;
    }
    // record every floor's parsed grid + floorY so roomAt/cellAt can resolve which
    // floor a body at height y is on (Y-aware now that B/2 have real rooms)
    map.floors = (CFG.cur._floors || [{ id: '1', floorY: 0 }]).map(function (f) {
      var parsed = f === CFG.cur._primary ? P : CFG.parseGrid(f.GRID), fyy = f.floorY || 0;
      // room centres at this floor's Y (the primary already has them; the rest need
      // them for interact / spawn weighting)
      Object.keys(parsed.rooms).forEach(function (rid) {
        if (parsed.rooms[rid].center) return;
        var cells = parsed.rooms[rid].cells, sx = 0, sz = 0;
        cells.forEach(function (cr) { var w = CFG.cellToWorld(cr[0], cr[1]); sx += w.x; sz += w.z; });
        parsed.rooms[rid].center = new THREE.Vector3(sx / cells.length, fyy, sz / cells.length);
      });
      return { id: f.id, floorY: fyy, parsed: parsed };
    });

    // elevated railway: walkable on top, open underneath (you pass beneath it).
    // Its surface is flagged bridge:true so ground nav ignores it.
    function buildBridge(b) {
      var H = b.h, cx = (b.x1 + b.x2) / 2, cz = (b.z1 + b.z2) / 2;
      var w = b.x2 - b.x1, d = b.z2 - b.z1;
      addBox(w, 0.22, d, cx, H - 0.11, cz, deckMat);                 // walkway slab
      map.addSurface({ x1: b.x1, x2: b.x2, z1: b.z1, z2: b.z2, y: H, bridge: true });
      if (b.supports) {
        // Load path is visible: edge girders, cross beams and columns landing in
        // the yard below. The bridge reads as factory infrastructure, not a slab
        // suspended in mid-air.
        addBox(w, 0.2, 0.18, cx, H - 0.38, b.z1 + 0.15, dBeam);
        addBox(w, 0.2, 0.18, cx, H - 0.38, b.z2 - 0.15, dBeam);
        [[b.x1 + 0.25, b.z1 + 0.45], [b.x2 - 0.25, b.z1 + 0.45],
         [b.x1 + 0.25, b.z2 - 0.45], [b.x2 - 0.25, b.z2 - 0.45]].forEach(function (p) {
          addBox(0.22, H, 0.22, p[0], H / 2, p[1], dBeam);
        });
        var crossN = Math.max(2, Math.ceil(d / 3.5));
        for (var cb = 1; cb < crossN; cb++)
          addBox(w - 0.3, 0.14, 0.14, cx, H - 0.38, b.z1 + d * cb / crossN, dBeam);
      }
      if (b.rails) {
        function bridgeRail(x) {
          addBox(0.1, 0.1, d, x, H + 1.0, cz, railMat);
          addBox(0.08, 0.08, d, x, H + 0.5, cz, railMat);
          var n = Math.max(2, Math.ceil(d / 2.4));
          for (var i = 0; i <= n; i++) addBox(0.1, 1.05, 0.1, x, H + 0.52, b.z1 + d * i / n, railMat);
          map.addCollider(x - 0.09, b.z1, x + 0.09, b.z2, H, H + 1.15);
        }
        bridgeRail(b.x1); bridgeRail(b.x2);
      }
      map.bridges = (map.bridges || []);
      map.bridges.push({ center: new THREE.Vector3(cx, H, cz), top: H });
    }
    _fyByPos = true;
    bridgeSpecs.forEach(buildBridge);
    _fyByPos = false;

    // sample the support height at every cell centre so the zombie flow-field
    // can treat big elevation jumps (a deck wall) as impassable and only route
    // up the stairs, where the rise per cell is gentle
    var ch = [];
    for (var chr = 0; chr < P.rows; chr++) {
      ch[chr] = [];
      for (var chc = 0; chc < P.cols; chc++) {
        var cw = CFG.cellToWorld(chc, chr);
        ch[chr][chc] = map.supportAt(cw.x, cw.z, 9999, 9999, true);   // ignore bridges
      }
    }
    map.cellHeights = ch;

    /* ----------------------- storm-station ambience (Der Wetterjunge) ----- */
    if (CFG.cur.id === 'wetterjunge') {
      // a slow-sweeping radar dish presiding over the Radar Dome
      if (P.rooms.D) {
        var dc = P.rooms.D.center;
        addBox(0.4, 2.4, 0.4, dc.x, 1.2, dc.z, G.mats.metal);          // mast (decorative)
        var pivot = new THREE.Group(); pivot.position.set(dc.x, 2.5, dc.z); G.scene.add(pivot);
        var dish = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.8, 20, 1, true),
          new THREE.MeshLambertMaterial({ color: 0xaab6c4, side: THREE.DoubleSide }));
        dish.rotation.x = Math.PI * 0.6; dish.position.set(0.7, 0.25, 0); pivot.add(dish);
        var feed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), G.mats.metal);
        feed.rotation.z = Math.PI / 2; feed.position.set(0.35, 0.12, 0); pivot.add(feed);
        map.radar = pivot;
      }
      // comms antenna with a blinking hazard beacon in the Comms Tower
      if (P.rooms.B) {
        var bc = P.rooms.B.center;
        addBox(0.3, 3.2, 0.3, bc.x, 1.6, bc.z, G.mats.metal);
        var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10),
          mat(0x220000, { emissive: new THREE.Color(0xff2200), emissiveIntensity: 0.9 }));
        beacon.position.set(bc.x, 3.3, bc.z); G.scene.add(beacon);
        var bl = new THREE.PointLight(0xff3322, 0.6, 7); bl.position.copy(beacon.position); G.scene.add(bl);
        map.beacon = beacon; map.beaconLight = bl;
      }
      // (the old loft console/screen bank went with the loft — Storage is a
      // plain ground room now)
    }

    /* ---------------- authored room identity + upper-floor storytelling -----
       The quest rooms need to explain their purpose before the player ever sees
       an F prompt. These props are wall-hugging or overhead and non-colliding;
       they give each step a visual language without stealing training space. */
    (function dressClassicQuests() {
      if (CFG.cur.id === 'kurhaus') return;
      var steel = new THREE.MeshLambertMaterial({ color: 0x4a5155 });
      var dark = new THREE.MeshLambertMaterial({ color: 0x25282a });
      var paper = new THREE.MeshLambertMaterial({ color: 0xb9ad89 });
      var cyan = new THREE.MeshBasicMaterial({ color: 0x54c9df });
      var amber = new THREE.MeshBasicMaterial({ color: 0xe59a38 });
      var green = new THREE.MeshBasicMaterial({ color: 0x65d39a });
      function wc(c, r) { return CFG.cellToWorld(c, r); }
      function boxAt(c, r, y, w, h, d, m, ox, oz) {
        var p = wc(c, r); return addBox(w, h, d, p.x + (ox || 0), y, p.z + (oz || 0), m);
      }
      function label(text, c, r, y, color) {
        // Der Riese uses environmental landmarks and wall stencils instead of
        // floating billboard sprites; in a multi-level factory a sprite can be
        // crossed from behind or intersect the camera on the floor above.
        if (CFG.cur.id === 'derriese') return null;
        var p = wc(c, r), s = textSprite(text, color || '#dbe7dc', 3.0, 'rgba(5,8,10,0.62)');
        s.position.set(p.x, y, p.z); G.scene.add(s); return s;
      }
      function screenBank(c, r, baseY, count, glowMat, eastWall) {
        var p = wc(c, r), alongZ = !!eastWall;
        for (var i = 0; i < count; i++) {
          var off = (i - (count - 1) / 2) * 1.15;
          var x = p.x + (alongZ ? 1.55 : off), z = p.z + (alongZ ? off : -1.55);
          addBox(alongZ ? 0.22 : 0.86, 0.66, alongZ ? 0.86 : 0.22, x, baseY + 1.25, z, dark);
          addBox(alongZ ? 0.04 : 0.62, 0.38, alongZ ? 0.62 : 0.04,
                 x + (alongZ ? -0.13 : 0), baseY + 1.3, z + (alongZ ? 0 : 0.13), glowMat);
        }
      }
      function pipeRun(c1, c2, r, y, m) {
        var a = wc(c1, r), b = wc(c2, r);
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, Math.abs(b.x - a.x), 8), m);
        p.rotation.z = Math.PI / 2; p.position.set((a.x + b.x) / 2, y, a.z); G.scene.add(p);
      }

      if (CFG.cur.id === 'nacht') {
        // Help Room: a radio repair bay; Generator: its cable/receiver wall;
        // Crash Site: the broken aerial silhouettes the final alignment step.
        label('DEAD AIR  /  SIGNAL CHAIN', 6, 6, 3.0, '#e5c687');
        screenBank(1, 4, 0, 2, amber, false);
        for (var nr = 0; nr < 3; nr++) boxAt(0, 4 + nr, 1.2, 0.22, 1.7, 0.7, steel, -1.55, 0);
        pipeRun(10, 12, 4, 3.45, dark);
        screenBank(11, 4, 0, 2, green, true);
        var mast = boxAt(6, 0, 2.5, 0.16, 5.0, 0.16, steel, 0, -0.8);
        mast.rotation.z = -0.16;
        addBox(3.8, 0.08, 0.08, mast.position.x, 4.4, mast.position.z, steel).rotation.z = 0.2;
        // Bunker operations desk beneath the marked briefing console.
        boxAt(4, 9, 0.45, 2.1, 0.9, 0.75, dark, 0.5, -1.15);
        for (var np = 0; np < 4; np++) boxAt(4, 9, 0.94, 0.28, 0.03, 0.38, paper, -0.15 + np * 0.34, -1.12);
      }

      if (CFG.cur.id === 'derriese') {
        // GROUND — recognizable functional wings, with props kept to walls or
        // ceilings so every doorway and the main training routes stay open.
        label('FURNACE  /  TELEPORTER B', 7, 2, 3.05, '#ff9a50');
        for (var fc = 1; fc <= 3; fc += 2) {
          var fpp = wc(4, fc);
          var coil = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 8, 18), amber);
          coil.position.set(fpp.x - 1.35, 1.25, fpp.z); coil.rotation.y = Math.PI / 2; G.scene.add(coil);
        }
        pipeRun(5, 11, 0, 3.28, steel);
        label('AUTO GARAGE  /  POWER', 16, 4, 3.0, '#a7d6bd');
        addBox(xW(18) - xW(13), 0.22, 0.28, (xW(13) + xW(18)) / 2, 3.25, zW(4), steel);
        addBox(0.1, 1.35, 0.1, xW(16), 2.55, zW(4), dark);
        var garageHook = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 7, 14, Math.PI * 1.45), steel);
        garageHook.position.set(xW(16), 1.82, zW(4)); G.scene.add(garageHook);
        screenBank(18, 4, 0, 2, green, true);

        label('ANIMAL TESTING', 12, 15, 3.0, '#8ed4df');
        for (var cg = 0; cg < 3; cg++) {
          boxAt(8 + cg * 3, 14, 1.15, 1.6, 2.15, 0.65, steel, 0, -1.35);
          for (var bar = -1; bar <= 1; bar++) boxAt(8 + cg * 3, 14, 1.15, 1.55, 0.04, 0.7, dark, 0, -1.7 + bar * 0.2);
        }
        label('A-LAB  /  TELEPORTER A', 21, 17, 3.0, '#79d5e8');
        screenBank(23, 16, 0, 3, cyan, true);

        // The cooling tower is beyond the west perimeter. Mainframe deliberately
        // has no giant freestanding frame: the only overhead structure is the
        // narrow supported service bridge authored above.
        var towerX = xW(0) - 5.6, towerZ = zW(9);
        var towerMat = new THREE.MeshLambertMaterial({ color: 0x4c514d });
        var tower = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 3.0, 10.5, 20), towerMat);
        tower.position.set(towerX, 5.25, towerZ); G.scene.add(tower);
        for (var tr = 0; tr < 3; tr++) {
          var towerBand = new THREE.Mesh(new THREE.TorusGeometry(2.2 + tr * 0.18, 0.12, 8, 24), steel);
          towerBand.position.set(towerX, 2.0 + tr * 3.1, towerZ); towerBand.rotation.x = Math.PI / 2; G.scene.add(towerBand);
        }
        label('TELEPORTER C  /  COOLING YARD', 3, 9, 3.0, '#b8d2b0');
        label('MAINFRAME', 20, 8, 3.1, '#b9e2bc');

        // UPPER — four contained departments, each supported by its ground wing.
        _fyByPos = true;
        label('FURNACE ADMINISTRATION', 8, 1, 6.75, '#d3a06d');
        screenBank(8, 0, 4, 3, amber, false);
        label('UPPER ASSEMBLY', 16, 5, 6.8, '#8fe5bd');
        screenBank(18, 4, 4, 2, green, true);
        addBox(xW(18) - xW(13), 0.2, 0.2, (xW(13) + xW(18)) / 2, 7.35, zW(6), steel);
        label('TESTING GALLERY', 12, 14, 6.75, '#91bdd0');
        for (var zr = 13; zr <= 17; zr += 2) {
          boxAt(8, zr, 5.15, 0.65, 2.0, 1.7, dark, -1.35, 0);
          for (var sh = 0; sh < 3; sh++) boxAt(8, zr, 4.5 + sh * 0.5, 0.7, 0.05, 1.6, paper, -1.68, 0);
        }
        label('A-LAB OBSERVATION', 21, 17, 6.75, '#82d4e5');
        screenBank(23, 17, 4, 2, cyan, true);

        // Real roof mass: uncovered ground cells receive a thick tar/concrete
        // cap, while every upper department receives a pitched industrial roof.
        // The roof volumes complete the building silhouette without adding any
        // walkable surfaces or navigation collision.
        var roofSkin = new THREE.MeshLambertMaterial({ color: 0x292d2d });
        for (var rr = 0; rr < P.rows; rr++) {
          var run = -1;
          for (var rc = 0; rc <= P.cols; rc++) {
            var pc = rc < P.cols && P.cells[rr][rc];
            var covered = pc && pc.type === 'room' && ['F', 'G', 'L', 'A'].indexOf(pc.room) >= 0 &&
                          !map.floorCellAboveAt(rc, rr, 0);
            if (covered && run < 0) run = rc;
            if ((!covered || rc === P.cols) && run >= 0) {
              var re = rc - 1, rwa = wc(run, rr), rwb = wc(re, rr);
              addBox((re - run + 1) * CELL + 0.32, 0.32, CELL + 0.32,
                     (rwa.x + rwb.x) / 2, 4.14, rwa.z, roofSkin);
              run = -1;
            }
          }
        }
        function gable(c1, c2, r1, r2, rise) {
          var a = wc(c1, r1), b = wc(c2, r2);
          var x0 = a.x - CELL / 2 - 0.18, x1 = b.x + CELL / 2 + 0.18;
          var z0 = a.z - CELL / 2 - 0.18, z1 = b.z + CELL / 2 + 0.18;
          var zm = (z0 + z1) / 2, y0 = 8.3, y1 = y0 + rise;
          var verts = new Float32Array([
            x0,y0,z0, x0,y1,zm, x0,y0,z1,
            x1,y0,z0, x1,y1,zm, x1,y0,z1
          ]);
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
          geo.setIndex([0,1,2, 3,5,4, 0,3,4, 0,4,1, 1,4,5, 1,5,2, 0,2,5, 0,5,3]);
          geo.computeVertexNormals();
          var gm = new THREE.Mesh(geo, roofSkin); G.scene.add(gm);
          if (_multiFloor) { gm.userData.fy = 4; map.cullables.push(gm); }
          addBox(x1 - x0, 0.18, 0.18, (x0 + x1) / 2, y1 + 0.02, zm, steel);
        }
        gable(5, 11, 0, 4, 2.0);
        gable(13, 18, 2, 6, 1.6);
        gable(8, 15, 12, 17, 1.8);
        gable(19, 23, 15, 19, 1.45);
        [5, 10].forEach(function (sc) {
          var stack = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 5.2, 12), dark);
          stack.position.set(xW(sc), 10.6, zW(0)); G.scene.add(stack);
          var cap = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.09, 7, 14), steel);
          cap.position.set(xW(sc), 13.2, zW(0)); cap.rotation.x = Math.PI / 2; G.scene.add(cap);
        });
        _fyByPos = false;
      }

      if (CFG.cur.id === 'wetterjunge') {
        // Ground rooms now read as stages of one weather experiment.
        label('PROJECT TEMPEST  /  PROTOCOL', 1, 7, 3.0, '#8bdcf0');
        for (var gc = 0; gc < 4; gc++) {
          var gp = wc(gc, 2), tor = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 8, 16), cyan);
          tor.position.set(gp.x, 1.35, gp.z - 1.55); G.scene.add(tor);
        }
        label('EMERGENCY FREQUENCY', 13, 3, 3.0, '#82e3d0');
        screenBank(13, 2, 0, 3, cyan, true);
        pipeRun(1, 3, 3, 3.4, steel);

        _fyByPos = true;
        label('UPPER CLIMATE LAB', 1, 4, 6.7, '#8bdcf0');
        for (var jr = 0; jr <= 8; jr += 2) {
          var jp = wc(0, jr);
          var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.7, 10),
            new THREE.MeshLambertMaterial({ color: 0x9ccbd7, transparent: true, opacity: 0.55 }));
          tube.position.set(jp.x - 1.35, 5.0, jp.z); G.scene.add(tube);
        }
        label('EYE DECK', 7, 5, 7.0, '#b0d8ff');
        screenBank(7, 0, 4, 4, cyan, false);
        // weather mast, wind vane and instrument booms dominate the terrace
        boxAt(7, 7, 6.0, 0.16, 4.0, 0.16, steel);
        addBox(4.5, 0.08, 0.08, xW(7), 7.7, zW(7), steel);
        var vane = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.65, 6), cyan);
        vane.rotation.z = -Math.PI / 2; vane.position.set(xW(7) + 2.1, 7.7, zW(7)); G.scene.add(vane);
        label('LIGHTNING CONTROL', 13, 4, 6.7, '#8ff0d4');
        for (var or = 0; or <= 8; or += 2) {
          var op = wc(14, or), coil2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 7, 20), cyan);
          coil2.position.set(op.x + 1.4, 5.2, op.z); coil2.rotation.y = Math.PI / 2; G.scene.add(coil2);
          screenBank(13, or, 4, 1, green, true);
        }
        _fyByPos = false;
      }
    })();

    /* ===================== environmental detail pass =====================
       Translate the art-reference sheets into procedural dressing: grime /
       blood / scorch / bullet decals, hazard markings, stencilled labels,
       vintage posters, lab chalkboards, caged work-lights and themed props
       (oil drums, factory valves, research monitors). Everything here is
       flush to a surface or hangs overhead and adds NO walkable colliders,
       so pathing, spawns and interaction are untouched.                    */
    (function detailPass() {
      map.decalCount = 0;
      var theme = CFG.cur.id;                       // nacht | derriese | wetterjunge
      function pick(a) { return a[(Math.random() * a.length) | 0]; }
      function pool(n, fn) { var a = []; for (var i = 0; i < n; i++) a.push(fn()); return a; }
      function plainTex(cv) { return new THREE.CanvasTexture(cv); }   // clamped (no wrap)
      function decalMat(t, op) {
        return new THREE.MeshBasicMaterial({ map: t, transparent: true,
          depthWrite: false, opacity: op == null ? 1 : op });
      }

      /* ---- decal art (transparent canvases) ---- */
      function bloodTex() {
        var cv = makeCanvas(128), c = cv.getContext('2d');
        var g = c.createRadialGradient(64, 64, 3, 64, 64, 46);
        g.addColorStop(0, 'rgba(86,8,8,0.92)'); g.addColorStop(0.6, 'rgba(64,6,6,0.66)');
        g.addColorStop(1, 'rgba(48,4,4,0)');
        c.fillStyle = g; c.beginPath(); c.arc(64, 64, 46, 0, 7); c.fill();
        for (var i = 0; i < 46; i++) {
          var a = Math.random() * 7, r = 18 + Math.random() * 42;
          c.fillStyle = 'rgba(' + (60 + Math.random() * 40 | 0) + ',6,6,' + (0.35 + Math.random() * 0.5) + ')';
          c.beginPath(); c.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + Math.random() * 4, 0, 7); c.fill();
        }
        return plainTex(cv);
      }
      function scorchTex() {
        var cv = makeCanvas(128), c = cv.getContext('2d');
        var g = c.createRadialGradient(64, 64, 2, 64, 64, 54);
        g.addColorStop(0, 'rgba(8,8,8,0.9)'); g.addColorStop(0.5, 'rgba(22,18,14,0.55)');
        g.addColorStop(1, 'rgba(22,18,14,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128);
        for (var i = 0; i < 11; i++) {
          var a = Math.random() * 7;
          c.strokeStyle = 'rgba(10,8,6,' + (0.3 + Math.random() * 0.3) + ')';
          c.lineWidth = 2 + Math.random() * 4; c.beginPath(); c.moveTo(64, 64);
          c.lineTo(64 + Math.cos(a) * (38 + Math.random() * 24), 64 + Math.sin(a) * (38 + Math.random() * 24)); c.stroke();
        }
        return plainTex(cv);
      }
      function bulletTex() {
        var cv = makeCanvas(128), c = cv.getContext('2d');
        for (var i = 0; i < 7; i++) {
          var x = 22 + Math.random() * 84, y = 22 + Math.random() * 84, r = 3 + Math.random() * 4;
          var g = c.createRadialGradient(x, y, 1, x, y, r * 2.3);
          g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.5, 'rgba(12,12,12,0.55)');
          g.addColorStop(1, 'rgba(120,110,95,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.3, 0, 7); c.fill();
          c.fillStyle = 'rgba(0,0,0,0.92)'; c.beginPath(); c.arc(x, y, r * 0.5, 0, 7); c.fill();
        }
        return plainTex(cv);
      }
      function stencilTex(txt) {
        var cv = makeCanvas(128), c = cv.getContext('2d');
        c.font = 'bold 86px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = 'rgba(212,202,170,0.6)'; c.fillText(txt, 64, 60);
        c.globalCompositeOperation = 'destination-out';
        for (var i = 0; i < 70; i++) { c.fillStyle = '#000'; c.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 2 + Math.random() * 3); }
        return plainTex(cv);
      }
      function posterTex() {
        var cv = document.createElement('canvas'); cv.width = 96; cv.height = 128;
        var c = cv.getContext('2d'); var hue = pick(['#7a2418', '#1d4d3a', '#2a3d6b', '#6b5310']);
        c.fillStyle = hue; c.fillRect(0, 0, 96, 128);
        c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, 0, 96, 128);
        c.strokeStyle = '#d8c9a0'; c.lineWidth = 4; c.strokeRect(6, 6, 84, 116);
        c.fillStyle = 'rgba(230,210,150,0.92)'; c.beginPath(); c.arc(48, 52, 26, 0, 7); c.fill();
        c.fillStyle = hue; c.beginPath(); c.arc(48, 52, 19, 0, 7); c.fill();
        c.fillStyle = '#f0e2bb'; c.font = 'bold 19px Georgia, serif'; c.textAlign = 'center';
        c.fillText(pick(['VICTORY', 'REVIVE', 'RATIONS', 'VITALIS', 'GRUPPE 935']), 48, 108);
        c.fillStyle = 'rgba(0,0,0,0.18)';
        for (var i = 0; i < 60; i++) c.fillRect(Math.random() * 96, Math.random() * 128, 2, 2);
        return plainTex(cv);
      }
      function hazardTex() {
        var cv = makeCanvas(64), c = cv.getContext('2d');
        c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, 64, 64);
        c.fillStyle = '#d2a017';
        for (var i = -64; i < 64; i += 24) {
          c.beginPath(); c.moveTo(i, 64); c.lineTo(i + 12, 64); c.lineTo(i + 12 + 64, 0); c.lineTo(i + 64, 0);
          c.closePath(); c.fill();
        }
        c.fillStyle = 'rgba(0,0,0,0.22)';
        for (var k = 0; k < 50; k++) c.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
        var t = plainTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      }

      var bloodP = pool(3, bloodTex), scorchP = pool(2, scorchTex), bulletP = pool(3, bulletTex), posterP = pool(3, posterTex);
      var hazSrc = hazardTex();

      /* ---- placement helpers ---- */
      function floorDecal(x, z, sz, t, op) {
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), decalMat(t, op));
        pl.rotation.x = -Math.PI / 2; pl.rotation.z = Math.random() * 6.28;
        pl.position.set(x, 0.03, z); pl.renderOrder = 2; G.scene.add(pl); map.decalCount++; return pl;
      }
      // a flat quad pinned to a wall edge, facing into the room
      function wallPlane(e, w, h, y, material, inset) {
        var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
        pl.position.set(wc.x + e.o[0] * (CELL / 2 - (inset == null ? 0.06 : inset)),
                        y, wc.z + e.o[1] * (CELL / 2 - (inset == null ? 0.06 : inset)));
        pl.rotation.y = Math.atan2(-e.o[0], -e.o[1]);
        pl.renderOrder = 2; G.scene.add(pl); map.decalCount++; return pl;
      }
      // a group pinned to a wall edge (its +Z faces into the room)
      function wallGroup(e, y, inset) {
        var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
        var g = new THREE.Group();
        g.position.set(wc.x + e.o[0] * (CELL / 2 - (inset || 0.12)), y, wc.z + e.o[1] * (CELL / 2 - (inset || 0.12)));
        g.rotation.y = Math.atan2(-e.o[0], -e.o[1]); G.scene.add(g); return g;
      }
      // emissive caged work-light hung from the ceiling (no extra PointLight —
      // the glowing bulb reads as a fixture without taxing the light budget)
      function cagedLight(x, z, y) {
        var g = new THREE.Group(); g.position.set(x, y, z); G.scene.add(g);
        pbox(g, 0.03, 0.55, 0.03, 0, 0.3, 0, dDark);
        [-0.13, -0.02].forEach(function (yy) {
          var ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 12), dBeam);
          ring.rotation.x = Math.PI / 2; ring.position.y = yy; g.add(ring);
        });
        for (var i = 0; i < 4; i++) {
          var a = i / 4 * Math.PI * 2;
          pbox(g, 0.014, 0.16, 0.014, Math.cos(a) * 0.12, -0.075, Math.sin(a) * 0.12, dBeam);
        }
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
          mat(0x221c10, { emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 0.7 }));
        bulb.position.y = -0.08; g.add(bulb);
      }
      // reusable oil drum from the prop registry (decorative here — tucked
      // against walls, so no world collider is registered)
      function oilDrum(x, z) {
        G.Props.create('oil_drum', { position: new THREE.Vector3(x, 0, z),
          rotationY: Math.random() * 6.28, seed: ((x * 131 + z * 17) | 0) || 1 });
      }
      function valveOnWall(e) {
        var g = wallGroup(e, 1.4 + Math.random() * 0.7, 0.12);
        g.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 16), dRust));
        for (var i = 0; i < 3; i++) {
          var sp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.03), dRust);
          sp.rotation.z = i * Math.PI / 3; g.add(sp);
        }
        var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), dBeam);
        hub.rotation.x = Math.PI / 2; g.add(hub);
      }
      function monitorOnWall(e) {
        wallPlane(e, 0.74, 0.54, 1.7, dDark, 0.1);
        wallPlane(e, 0.62, 0.42, 1.7, mat(0x06222e, {
          emissive: new THREE.Color(pick([0x2aa0ff, 0x33ff88, 0x33ccff])), emissiveIntensity: 0.7
        }), 0.085);
      }

      var INNER = function (e) { return !e.door && !e.win; };

      /* ---- per-room dressing ---- */
      Object.keys(P.rooms).forEach(function (rid) {
        var room = P.rooms[rid], bb = roomBBox(room);
        var isOut = outdoor.indexOf(rid) >= 0;
        var edges = wallEdges(room), inner = edges.filter(INNER);

        // floor grime: blood pools (interior) / scorch
        var nd = 2 + (Math.random() * 2 | 0);
        for (var d = 0; d < nd; d++) {
          var x = bb.x0 + 0.8 + Math.random() * Math.max(0.4, bb.w - 1.6);
          var z = bb.z0 + 0.8 + Math.random() * Math.max(0.4, bb.d - 1.6);
          if (!clearOf(new THREE.Vector3(x, 0, z), 1.1)) continue;
          var bloody = Math.random() < (theme === 'wetterjunge' ? 0.4 : 0.66);
          floorDecal(x, z, 0.9 + Math.random() * 0.8, bloody ? pick(bloodP) : pick(scorchP), 0.85);
        }

        // wall grime: bullet clusters + blood spatter
        edges.forEach(function (e) {
          if (e.door || e.win || Math.random() > 0.28) return;
          var t = Math.random() < 0.5 ? pick(bulletP) : pick(bloodP);
          wallPlane(e, 0.6 + Math.random() * 0.5, 0.6 + Math.random() * 0.5,
                    0.7 + Math.random() * 1.8, decalMat(t, 0.9));
        });

        // stencilled room label on an interior wall
        if (inner.length) wallPlane(pick(inner), 0.8, 0.8, 2.45, decalMat(stencilTex(rid), 0.75));

        // a vintage poster on an interior wall
        if (inner.length > 1 && Math.random() < 0.6) wallPlane(pick(inner), 0.68, 0.92, 1.95, decalMat(pick(posterP)));

        // overhead caged work-light (indoor rooms only)
        if (!isOut) cagedLight(bb.cx, bb.cz, WALL_H - 0.5);

        // OVERHEAD SERVICES — pipe runs + drop conduits across the ceiling. Fills
        // the empty upper volume so a room reads with vertical depth instead of as
        // a flat box. Indoor only, decorative (no colliders), deterministic.
        if (!isOut) {
          var org = G.PU.seeded(G.PU.hashStr('oh:' + rid));
          var along = bb.w >= bb.d, runL = (along ? bb.w : bb.d) - 0.5;
          var pmat = [dPipe, dRust, dBeam][(org() * 3) | 0];
          var nP = 1 + (org() < 0.55 ? 1 : 0);
          for (var ph = 0; ph < nP; ph++) {
            var frac = nP === 1 ? (0.28 + org() * 0.18) : 0.26 + ph * 0.46;
            var pr = 0.07 + org() * 0.04, py = WALL_H - 0.34 - ph * 0.12;
            var axisPos = along ? (bb.z0 + bb.d * frac) : (bb.x0 + bb.w * frac);
            var pipe = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, runL, 8), pmat);
            if (along) { pipe.rotation.z = Math.PI / 2; pipe.position.set(bb.cx, py, axisPos); }
            else { pipe.rotation.x = Math.PI / 2; pipe.position.set(axisPos, py, bb.cz); }
            G.scene.add(pipe);
            for (var st = 0.18; st < 0.85; st += 0.32) {     // drop straps to the ceiling
              var sx = along ? (bb.x0 + bb.w * st) : axisPos;
              var sz = along ? axisPos : (bb.z0 + bb.d * st);
              addBox(0.035, 0.32, 0.035, sx, WALL_H - 0.18, sz, dDark);
            }
          }
          // a low-hanging conduit bundle + a junction box, tucked off the centre
          if (org() < 0.7) {
            var hx = bb.x0 + 0.9 + org() * Math.max(0.2, bb.w - 1.8);
            var hz = bb.z0 + 0.9 + org() * Math.max(0.2, bb.d - 1.8);
            addBox(0.05, 0.7 + org() * 0.5, 0.05, hx, WALL_H - 0.65, hz, dDark);
            addBox(0.22, 0.26, 0.14, hx, WALL_H - 0.95 - org() * 0.4, hz, dBeam);
          }
        }

        // themed flourishes
        if (theme === 'wetterjunge') {
          if (inner.length && Math.random() < 0.7) monitorOnWall(pick(inner));
          if (inner.length && Math.random() < 0.45) {
            var ce = pick(inner);
            wallPlane(ce, 1.3, 0.92, 1.75, mat(0x18201c), 0.05);
            wallPlane(ce, 1.22, 0.84, 1.75, new THREE.MeshBasicMaterial({
              map: chalkTexture(['E = mc²', 'GRUPPE 935']), transparent: true, depthWrite: false }), 0.044);
          }
        } else {
          if (theme === 'derriese' && inner.length && Math.random() < 0.5) valveOnWall(pick(inner));
          // an oil drum tucked into a corner, clear of traffic and interactables
          if (inner.length && Math.random() < 0.7) {
            var c0 = [[bb.x0 + 0.5, bb.z0 + 0.5], [bb.x1 - 0.5, bb.z0 + 0.5],
                      [bb.x0 + 0.5, bb.z1 - 0.5], [bb.x1 - 0.5, bb.z1 - 0.5]];
            for (var ci = 0; ci < c0.length; ci++) {
              var cp = new THREE.Vector3(c0[(ci + (Math.random() * 4 | 0)) % 4][0], 0, c0[(ci + (Math.random() * 4 | 0)) % 4][1]);
              if (clearOf(cp, 1.3)) { oilDrum(cp.x, cp.z); occupied.push({ x: cp.x, z: cp.z }); break; }
            }
          }
        }
      });

      // painted hazard borders ringing the raised catwalk/loft decks
      stageSpecs.forEach(function (s) {
        var H = s.h, bw = 0.32;
        function strip(x1, z1, x2, z2) {
          var w = Math.max(0.12, x2 - x1), dd = Math.max(0.12, z2 - z1);
          var t = hazSrc.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(Math.max(w, dd) / 0.6, 1);
          var pl = new THREE.Mesh(new THREE.PlaneGeometry(w, dd), decalMat(t, 0.92));
          pl.rotation.x = -Math.PI / 2; pl.position.set((x1 + x2) / 2, H + 0.04, (z1 + z2) / 2);
          pl.renderOrder = 2; G.scene.add(pl);
        }
        strip(s.x1, s.z1, s.x2, s.z1 + bw);
        strip(s.x1, s.z2 - bw, s.x2, s.z2);
        strip(s.x1, s.z1, s.x1 + bw, s.z2);
        strip(s.x2 - bw, s.z1, s.x2, s.z2);
      });
    })();

    /* ---------------- static geometry merge (draw-call collapse) ----------
       Every book spine, brick and trim board is its own mesh (~2400 on
       Kurhaus -> ~1600 draw calls). Everything static that shares a palette
       material gets baked into ONE mesh per material; the originals leave the
       scene but stay alive in solidMeshes so bullet raycasts are unchanged.
       Anything animated or mutated at runtime is skipped via the registries
       (lamps' bulbs, doors, window boards, teleporter rings, the whole kAnim
       living-map set, floor-culled meshes). Look is pixel-identical. */
    (function mergeStatic() {
      var skip = new Set();
      function sk(m) { if (m) skip.add(m); }
      Object.keys(map.doors).forEach(function (id) { sk(map.doors[id].mesh); });
      (map.windows || []).forEach(function (w) { (w.boardMeshes || []).forEach(sk); });
      (map.lamps || []).forEach(function (l) { sk(l.bulb); });
      (map.teleporters || []).forEach(function (t) { sk(t.ring); sk(t.pad); sk(t.mesh); });
      sk(map.sky); sk(map.radar); sk(map.beacon); sk(map.surgeRing);
      var KA = map.kAnim;
      if (KA) {
        KA.embers.forEach(function (e) { sk(e.m); });
        KA.steam.forEach(function (s) { sk(s.m); });
        KA.candles.forEach(sk);
        KA.needles.forEach(sk);
        if (KA.manifold) sk(KA.manifold.m);
        sk(KA.bucket); sk(KA.face);
        (KA.sigils || []).forEach(function (s) { sk(s.mesh); });
        if (KA.arch && KA.arch.bricks) KA.arch.bricks.forEach(sk);
      }
      var MERGE_TYPES = { BoxGeometry: 1, CylinderGeometry: 1, ConeGeometry: 1, SphereGeometry: 1 };
      var groups = new Map();
      G.scene.children.forEach(function (m) {
        if (!m.isMesh || skip.has(m)) return;
        if (m.userData.fy !== undefined) return;             // floor-culled (stacked maps)
        var g = m.geometry, mat = m.material;
        if (!g || !mat || Array.isArray(mat) || mat.transparent) return;
        if (!MERGE_TYPES[g.type]) return;
        if (!groups.has(mat)) groups.set(mat, []);
        groups.get(mat).push(m);
      });
      function concat(arrs) {
        var n = 0; arrs.forEach(function (a) { n += a.length; });
        var out = new Float32Array(n), o = 0;
        arrs.forEach(function (a) { out.set(a, o); o += a.length; });
        return out;
      }
      groups.forEach(function (list, mat) {
        if (list.length < 8) return;                         // not worth a merge
        var pos = [], norm = [], uv = [];
        list.forEach(function (m) {
          m.updateMatrixWorld(true);
          var geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          geo.applyMatrix4(m.matrixWorld);
          var pa = geo.getAttribute('position');
          pos.push(pa.array);
          norm.push(geo.getAttribute('normal').array);
          var u = geo.getAttribute('uv');
          uv.push(u ? u.array : new Float32Array(pa.count * 2));
        });
        var gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.BufferAttribute(concat(pos), 3));
        gg.setAttribute('normal', new THREE.BufferAttribute(concat(norm), 3));
        gg.setAttribute('uv', new THREE.BufferAttribute(concat(uv), 2));
        var big = new THREE.Mesh(gg, mat);
        G.scene.add(big);
        // originals leave the scene; the solid ones keep serving raycasts
        // (matrixWorld is already baked, and Raycaster ignores scene membership)
        list.forEach(function (m) { G.scene.remove(m); });
      });
    })();

    map.recomputeReachable();
  };

  G.util = { textSprite: textSprite, mat: mat, addBox: addBox };
})();
