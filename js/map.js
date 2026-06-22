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
    t.anisotropy = 4;
    return t;
  }

  function wallTexture() {
    var s = 256, cv = makeCanvas(s), c = cv.getContext('2d');
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
    if (opts.collide) {
      mesh.userData.collider = G.map.addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
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

    // highest walkable height at (x,z) that a body with feet at feetY can stand
    // on, given a vertical "climb" tolerance. The base ground plane (0) always
    // qualifies; surfaces above feet+climb are ignored (you're walking under).
    supportAt: function (x, z, feetY, climb, ignoreBridge) {
      var best = 0, ss = this.surfaces, i, s, h;
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

    roomAt: function (x, z) {
      var cr = CFG.worldToCell(x, z);
      var cell = this.cellAt(cr.col, cr.row);
      if (!cell) return null;
      if (cell.type === 'room') return cell.room;
      if (cell.type === 'door') return this.parsed.doors[cell.door].rooms[0];
      return null;
    },
    cellAt: function (col, row) {
      if (row < 0 || row >= this.parsed.rows || col < 0 || col >= this.parsed.cols) return null;
      return this.parsed.cells[row][col];
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
    var P = G.map.parsed = CFG.parseGrid(CFG.GRID);
    var map = G.map;

    // shared textures + materials
    G.tex = {
      wall: wallTexture(), floor: floorTexture(), wood: woodTexture(),
      metal: metalTexture(), blob: blobTexture()
    };
    G.mats = {
      wallA: new THREE.MeshLambertMaterial({ map: G.tex.wall, color: 0xb9b5aa }),
      wallB: new THREE.MeshLambertMaterial({ map: G.tex.wall, color: 0xa8a49a }),
      wood: new THREE.MeshLambertMaterial({ map: G.tex.wood, color: 0xc9b496 }),
      plank: new THREE.MeshLambertMaterial({ map: G.tex.wood, color: 0xdbc8a8 }),
      metal: new THREE.MeshLambertMaterial({ map: G.tex.metal, color: 0x8e949c })
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
      function band(y, h, depth, mm) {
        if (alongX) addBox(CELL + WALL_T, h, WALL_T + depth, cx, y, cz, mm);
        else addBox(WALL_T + depth, h, CELL + WALL_T, cx, y, cz, mm);
      }
      if (!isWindow) {
        if (alongX) addBox(CELL + WALL_T, WALL_H, WALL_T, cx, WALL_H / 2, cz, m, { collide: true, solid: true });
        else addBox(WALL_T, WALL_H, CELL + WALL_T, cx, WALL_H / 2, cz, m, { collide: true, solid: true });
        band(0.22, 0.44, 0.08, baseMat);       // baseboard / lower reinforcement
        band(WALL_H - 0.5, 0.12, 0.05, trimMat); // upper string course
        return null;
      }
      var sillH = 1.0, openTop = 2.6, postW = 0.7;
      if (alongX) {
        addBox(CELL, sillH, WALL_T, cx, sillH / 2, cz, m, { solid: true });
        addBox(postW, WALL_H, WALL_T, cx - CELL / 2 + postW / 2, WALL_H / 2, cz, m, { solid: true });
        addBox(postW, WALL_H, WALL_T, cx + CELL / 2 - postW / 2, WALL_H / 2, cz, m, { solid: true });
        addBox(CELL, WALL_H - openTop, WALL_T, cx, (WALL_H + openTop) / 2, cz, m, { solid: true });
        // framed opening: header lintel + sill cap
        addBox(CELL - postW * 1.4, 0.16, WALL_T + 0.12, cx, openTop + 0.02, cz, trimMat);
        addBox(CELL - postW * 1.4, 0.12, WALL_T + 0.14, cx, sillH - 0.02, cz, trimMat);
      } else {
        addBox(WALL_T, sillH, CELL, cx, sillH / 2, cz, m, { solid: true });
        addBox(WALL_T, WALL_H, postW, cx, WALL_H / 2, cz - CELL / 2 + postW / 2, m, { solid: true });
        addBox(WALL_T, WALL_H, postW, cx, WALL_H / 2, cz + CELL / 2 - postW / 2, m, { solid: true });
        addBox(WALL_T, WALL_H - openTop, CELL, cx, (WALL_H + openTop) / 2, cz, m, { solid: true });
        addBox(WALL_T + 0.12, 0.16, CELL - postW * 1.4, cx, openTop + 0.02, cz, trimMat);
        addBox(WALL_T + 0.14, 0.12, CELL - postW * 1.4, cx, sillH - 0.02, cz, trimMat);
      }
      band(0.22, 0.44, 0.08, baseMat);          // baseboard wraps the window wall too
      map.addCollider(cx - (alongX ? CELL / 2 : WALL_T / 2), cz - (alongX ? WALL_T / 2 : CELL / 2),
                      cx + (alongX ? CELL / 2 : WALL_T / 2), cz + (alongX ? WALL_T / 2 : CELL / 2));
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

    var floorGeo = new THREE.PlaneGeometry(CELL, CELL);
    for (var r = 0; r < P.rows; r++) {
      for (var c = 0; c < P.cols; c++) {
        var cell = P.cells[r][c];
        if (cell.type === 'void') continue;
        var wc = CFG.cellToWorld(c, r);
        var f = new THREE.Mesh(floorGeo, cell.type === 'door' ? doorFloorMat : floorMats[cell.room]);
        f.rotation.x = -Math.PI / 2;
        f.position.set(wc.x, 0, wc.z);
        G.scene.add(f);

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
      var ridge = new THREE.Mesh(new THREE.ConeGeometry(10 + Math.random() * 18, rh, 4), ringMat);
      ridge.position.set(Math.cos(ra) * rdist, rh / 2 - 6, Math.sin(ra) * rdist);
      ridge.rotation.y = Math.random() * Math.PI;
      G.scene.add(ridge);
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
    Object.keys(P.doors).forEach(function (id) {
      var pd = P.doors[id], cd = CFG.DOORS[id];
      var cellCR = pd.cells[0];
      var wc = CFG.cellToWorld(cellCR[0], cellCR[1]);
      var roomDirs = [];
      ['N', 'S', 'E', 'W'].forEach(function (dir) {
        var o = OFF[dir];
        var n = map.cellAt(cellCR[0] + o[0], cellCR[1] + o[1]);
        if (n && n.type === 'room') roomDirs.push(dir);
      });
      var alongZ = roomDirs.indexOf('N') >= 0 || roomDirs.indexOf('S') >= 0;
      var mesh = alongZ
        ? addBox(CELL - 0.2, WALL_H - 0.4, 0.5, wc.x, (WALL_H - 0.4) / 2, wc.z, G.mats.wood, { solid: true })
        : addBox(0.5, WALL_H - 0.4, CELL - 0.2, wc.x, (WALL_H - 0.4) / 2, wc.z, G.mats.wood, { solid: true });
      for (var k = -1; k <= 1; k++) {
        var pm = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? CELL - 0.1 : 0.6, 0.3, alongZ ? 0.6 : CELL - 0.1), G.mats.plank);
        pm.position.set(0, k * 1.0, 0);
        pm.rotation[alongZ ? 'z' : 'x'] = k * 0.15;
        mesh.add(pm);
      }
      var collider = map.addCollider(wc.x - CELL / 2, wc.z - CELL / 2, wc.x + CELL / 2, wc.z + CELL / 2);
      // structural door frame around the opening (decorative, stays after the
      // debris is bought away so the doorway reads as a built threshold)
      var frameMat = G.MAT.get('darkIron');
      if (alongZ) {
        addBox(CELL, 0.32, 0.7, wc.x, WALL_H - 0.3, wc.z, frameMat);                 // lintel
        addBox(0.3, WALL_H, 0.7, wc.x - CELL / 2 + 0.15, WALL_H / 2, wc.z, frameMat); // jambs
        addBox(0.3, WALL_H, 0.7, wc.x + CELL / 2 - 0.15, WALL_H / 2, wc.z, frameMat);
      } else {
        addBox(0.7, 0.32, CELL, wc.x, WALL_H - 0.3, wc.z, frameMat);
        addBox(0.7, WALL_H, 0.3, wc.x, WALL_H / 2, wc.z - CELL / 2 + 0.15, frameMat);
        addBox(0.7, WALL_H, 0.3, wc.x, WALL_H / 2, wc.z + CELL / 2 - 0.15, frameMat);
      }
      // a small glowing cost chip on the debris so you can spot a buyable door;
      // the full "Open X — cost" text shows in the HUD when you look at it
      var chip = costChip(cd.cost);
      chip.position.set(wc.x, 2.05, wc.z);
      G.scene.add(chip);
      map.doors[id] = {
        id: +id, cost: cd.cost, name: cd.name, rooms: pd.rooms, open: false,
        mesh: mesh, collider: collider, sprite: chip, baseY: mesh.position.y,
        pos: new THREE.Vector3(wc.x, 0, wc.z)
      };
    });

    /* ----------------------------------------------------- placed objects */
    function place(spec) {
      var wc = CFG.cellToWorld(spec.cell[0], spec.cell[1]);
      // spec.y lifts an interactable onto an upper floor (catwalk / loft)
      return new THREE.Vector3(wc.x + (spec.off ? spec.off[0] : 0), spec.y || 0, wc.z + (spec.off ? spec.off[1] : 0));
    }
    map.placePos = place;
    var occupied = []; // keep auto props clear of everything interactive
    function occupy(p) { occupied.push(p); }

    function xW(col) { return CFG.cellToWorld(col, 0).x; }
    function zW(row) { return CFG.cellToWorld(0, row).z; }

    // raised catwalks (verticality). Defined up front so their footprint can be
    // reserved before auto-placed machines pick spots — nothing should spawn on
    // or under the deck/stairs.
    map.stages = [];
    var stageSpecs = [];
    var bridgeSpecs = [];
    if (CFG.cur.id === 'derriese') {
      // THE iconic Der Riese upper catwalk: a U of raised walkways wrapping the
      // west, north and east walls of the Mainframe Courtyard (the Teleporter-C
      // "upstairs"), open toward spawn, railed over the central pit. Thin decks
      // so the ground — and the doorways the catwalk crosses — stay walkable
      // beneath; reached by a staircase at each front corner. The nav engine
      // routes the horde up the stairs and around the loop.
      var H = 3.2;
      var westDeck = { x1: xW(3) - CELL / 2, x2: xW(3) + CELL / 2,
                       z1: zW(5) - CELL / 2, z2: zW(7) + CELL / 2, h: H, thin: true, railE: true };
      westDeck.stairs = { x1: westDeck.x1, x2: westDeck.x2, zTop: westDeck.z2, zBase: zW(9), steps: 8 };
      var eastDeck = { x1: xW(12) - CELL / 2, x2: xW(12) + CELL / 2,
                       z1: zW(5) - CELL / 2, z2: zW(7) + CELL / 2, h: H, thin: true, railW: true };
      eastDeck.stairs = { x1: eastDeck.x1, x2: eastDeck.x2, zTop: eastDeck.z2, zBase: zW(9), steps: 8 };
      // rear catwalk widened to two cells deep so the Mainframe has a real
      // focal platform: footprint, a passing lane and zombie approach + turning
      // space (still a thin deck — the courtyard floor stays walkable beneath).
      var northDeck = { x1: xW(3) - CELL / 2, x2: xW(12) + CELL / 2,
                        z1: zW(5) - CELL / 2, z2: zW(6) + CELL / 2, h: H, thin: true, railS: true,
                        supports: true };
      stageSpecs.push(westDeck, eastDeck, northDeck);
    }
    if (CFG.cur.id === 'wetterjunge') {
      // not every upstairs is a catwalk — this is a full enclosed LOFT ROOM
      // above the Storage room's north half (its own walls + vibe), reached by a
      // staircase on the far east side, clear of the doorways. Thin floor keeps
      // the room below fully walkable.
      var loft = { x1: xW(11) - CELL / 2, x2: xW(14) + CELL / 2,
                   z1: zW(5) - CELL / 2, z2: zW(6) + CELL / 2, h: 3.4, thin: true, walls: true,
                   railN: true, railW: true, railE: true, railS: true };
      loft.stairs = { x1: xW(14) - CELL / 2, x2: xW(14) + CELL / 2, zTop: loft.z2, zBase: zW(8), steps: 8 };
      stageSpecs.push(loft);
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

    // --- push interactables against the nearest clear wall so they never block
    //     the middle of a room (zombies need the open centre to train through)
    function roomInner(rid) {
      var cells = P.rooms[rid].cells, minc = 99, maxc = -99, minr = 99, maxr = -99;
      cells.forEach(function (cr) {
        if (cr[0] < minc) minc = cr[0]; if (cr[0] > maxc) maxc = cr[0];
        if (cr[1] < minr) minr = cr[1]; if (cr[1] > maxr) maxr = cr[1];
      });
      var a = CFG.cellToWorld(minc, minr), b = CFG.cellToWorld(maxc, maxr);
      return { x0: a.x - CELL / 2 + WALL_T, x1: b.x + CELL / 2 - WALL_T,
        z0: a.z - CELL / 2 + WALL_T, z1: b.z + CELL / 2 - WALL_T };
    }
    function spotClear(p, dist) {
      var cr = CFG.worldToCell(p.x, p.z), cell = map.cellAt(cr.col, cr.row);
      if (!cell || cell.type !== 'room') return false;
      // stay outside any door's interaction radius so buy-prompts never hijack
      // the door's "open" prompt
      if (!Object.keys(map.doors).every(function (id) {
        return Math.hypot(map.doors[id].pos.x - p.x, map.doors[id].pos.z - p.z) > 3.0; })) return false;
      if (!map.windows.every(function (w) {
        return Math.hypot(w.inside.x - p.x, w.inside.z - p.z) > 1.3; })) return false;
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
      var rid = map.roomAt(pos.x, pos.z);
      if (!rid || !P.rooms[rid]) return pos;
      var bb = roomInner(rid);
      var cands = [
        { x: bb.x0 + hd, z: pos.z, d: pos.x - bb.x0, yaw: WALL_YAW.W },
        { x: bb.x1 - hd, z: pos.z, d: bb.x1 - pos.x, yaw: WALL_YAW.E },
        { x: pos.x, z: bb.z0 + hd, d: pos.z - bb.z0, yaw: WALL_YAW.N },
        { x: pos.x, z: bb.z1 - hd, d: bb.z1 - pos.z, yaw: WALL_YAW.S }
      ].sort(function (a, b) { return a.d - b.d; });
      for (var i = 0; i < cands.length; i++) {
        var np = new THREE.Vector3(cands[i].x, 0, cands[i].z);
        if (spotClear(np, 1.7)) { pos.x = np.x; pos.z = np.z; pos.wallYaw = cands[i].yaw; break; }
      }
      if (pos.wallYaw == null) pos.wallYaw = nearestWallYaw(pos);
      return pos;
    }

    // FLUSH wall mount: pin a prop's BACK against the nearest wall whose front
    // STANDING spot is actually clear (not a window/door/corner), and face it
    // into the room. center = inner wall face + halfDepth + 3cm. baseY = floor
    // height (for elevated catwalk machines). Returns { x, z, yaw }.
    var INWARD = { W: [1, 0], E: [-1, 0], N: [0, 1], S: [0, -1] };
    function wallFlush(pos, halfDepth, baseY) {
      baseY = baseY || 0;
      var rid = map.roomAt(pos.x, pos.z);
      if (!rid || !P.rooms[rid]) return { x: pos.x, z: pos.z, yaw: 0 };
      // roomInner's faces are inset by a full WALL_T; the REAL inner wall
      // surface is WALL_T/2 closer, so add it back or the prop floats ~0.18m.
      var bb = roomInner(rid), gap = halfDepth + 0.03, WT2 = WALL_T / 2;
      var cands = [
        { x: bb.x0 - WT2 + gap, z: pos.z, d: pos.x - bb.x0, yaw: WALL_YAW.W, f: 'W' },
        { x: bb.x1 + WT2 - gap, z: pos.z, d: bb.x1 - pos.x, yaw: WALL_YAW.E, f: 'E' },
        { x: pos.x, z: bb.z0 - WT2 + gap, d: pos.z - bb.z0, yaw: WALL_YAW.N, f: 'N' },
        { x: pos.x, z: bb.z1 + WT2 - gap, d: bb.z1 - pos.z, yaw: WALL_YAW.S, f: 'S' }
      ].sort(function (a, b) { return a.d - b.d; });
      function standClear(cx, cz, f) {
        var io = INWARD[f], sx = cx + io[0] * 0.95, sz = cz + io[1] * 0.95;
        var cr = CFG.worldToCell(sx, sz), cell = map.cellAt(cr.col, cr.row);
        if (!cell || cell.type !== 'room') return false;            // stand spot in the room
        if (map.bodyBlocked(sx, sz, baseY + 0.2)) return false;     // not inside a wall/prop
        if (!Object.keys(map.doors).every(function (id) {
          return Math.hypot(map.doors[id].pos.x - cx, map.doors[id].pos.z - cz) > 2.2; })) return false;
        if (!map.windows.every(function (w) {
          return Math.hypot(w.inside.x - cx, w.inside.z - cz) > 1.4; })) return false;
        return true;
      }
      for (var i = 0; i < cands.length; i++) {
        if (standClear(cands[i].x, cands[i].z, cands[i].f)) return { x: cands[i].x, z: cands[i].z, yaw: cands[i].yaw };
      }
      return { x: cands[0].x, z: cands[0].z, yaw: cands[0].yaw };
    }

    // perk machines: vending cabinets with a lit bottle decal facing the room
    CFG.PERK_MACHINES.forEach(function (pm) {
      var def = CFG.PERKS[pm.perk];
      var pos = place(pm);
      var by = pos.y;                     // floor height this machine sits on
      var fl = wallFlush(pos, 0.4, by);  // pin its back flat to a clear wall
      pos.x = fl.x; pos.z = fl.z;
      occupy(pos);
      var root = G.Props.create('perk_machine', {
        position: new THREE.Vector3(fl.x, by, fl.z),
        rotationY: fl.yaw, variant: pm.perk, def: def
      });
      propSolids(root);
      propCollider(fl.x, fl.z, 0.48, 0.4, by, by + 1.9, fl.yaw);
      var light = new THREE.PointLight(def.color, pm.perk === 'revive' ? 0.8 : 0.25, 7);
      light.position.set(fl.x, by + 2.2, fl.z);
      G.scene.add(light);
      // the interaction point is where you STAND (just in front of the cabinet),
      // not the cabinet centre — so the prompt/buy works flush against a wall
      var fwd = { x: Math.sin(fl.yaw), z: Math.cos(fl.yaw) };
      var stand = new THREE.Vector3(fl.x + fwd.x * 0.95, by, fl.z + fwd.z * 0.95);
      map.perkMachines.push({ perk: pm.perk, pos: stand, mesh: root, light: light,
        setPowered: root.userData.setPowered });
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
      if (!bs.y) pushToWall(p, 0.65);    // box hugs a wall (ground spots only)
      occupy(p);
      map.boxSpots.push({ idx: i, pos: p });
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

    // mainframe — on Der Riese it sits on the widened rear catwalk (elevated);
    // elsewhere it's a ground machine pushed flat to a wall
    map.mainframe = null;
    if (CFG.MAINFRAME) {
      var mf = place(CFG.MAINFRAME);
      var mby = mf.y || 0;
      var mfl = wallFlush(mf, 0.25, mby);  // back flat to a clear wall (deck or ground)
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
    var ppfl = wallFlush(pp, 0.48);
    pp.x = ppfl.x; pp.z = ppfl.z;
    occupy(pp);
    var papYaw = ppfl.yaw;
    var papRoot = G.Props.create('pack_a_punch', { position: new THREE.Vector3(pp.x, 0, pp.z), rotationY: papYaw });
    propSolids(papRoot);
    var pc = papRoot.userData.colliderBox;
    propCollider(pp.x, pp.z, pc.hw, pc.hd, pc.y1, pc.y2, papYaw);
    var papBody = papRoot;
    var field = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3.4, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    field.position.set(pp.x, 1.7, pp.z);
    G.scene.add(field);
    var fieldCol = map.addCollider(pp.x - 1.8, pp.z - 1.8, pp.x + 1.8, pp.z + 1.8);
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

    // power switch
    var pw = place(CFG.POWER);
    var pwfl = wallFlush(pw, 0.12);
    pw.x = pwfl.x; pw.z = pwfl.z;
    occupy(pw);
    var pwRoot = G.Props.create('power_switch', { position: new THREE.Vector3(pw.x, 0, pw.z), rotationY: pwfl.yaw });
    propSolids(pwRoot);
    map.powerSwitch = { pos: pw, mesh: pwRoot, setPowered: pwRoot.userData.setPowered };
    occupy(place(CFG.PLAYER_SPAWN));

    /* ------------------------------------------------- lights + fixtures */
    // designed ceiling fixture per map theme: a caged bunker lamp, an industrial
    // dome, or a cold institutional fixture. The bulb keeps a PRIVATE material so
    // the flicker loop can drive its emissiveIntensity without touching the
    // shared prop material cache.
    function addLamp(x, z, color) {
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
        new THREE.MeshLambertMaterial({ color: 0x222018, emissive: new THREE.Color(0xffe9b0), emissiveIntensity: 0.35 }));
      bulb.position.y = -0.04; fixture.add(bulb);
      fixture.position.set(x, WALL_H - 0.55, z);
      G.scene.add(fixture);
      var light = new THREE.PointLight(color, 0.75, 18, 1);
      light.position.set(x, WALL_H - 0.9, z);
      G.scene.add(light);
      G.map.roomLights.push(light);
      G.map.lamps.push({ light: light, bulb: bulb });
    }

    Object.keys(P.rooms).forEach(function (roomId) {
      var cells = P.rooms[roomId].cells;
      var color = new THREE.Color(CFG.ROOMS[roomId].light).lerp(new THREE.Color(0xffe9c0), 0.5).getHex();
      function avg(list) {
        var cx = 0, cz = 0;
        list.forEach(function (cr) { var w = CFG.cellToWorld(cr[0], cr[1]); cx += w.x; cz += w.z; });
        return { x: cx / list.length, z: cz / list.length };
      }
      var all = avg(cells);
      P.rooms[roomId].center = new THREE.Vector3(all.x, 0, all.z);
      if (cells.length > 6) {
        addLamp(avg(cells.slice(0, Math.floor(cells.length / 2))).x,
                avg(cells.slice(0, Math.floor(cells.length / 2))).z, color);
        addLamp(avg(cells.slice(Math.floor(cells.length / 2))).x,
                avg(cells.slice(Math.floor(cells.length / 2))).z, color);
      } else {
        addLamp(all.x, all.z, color);
      }
    });

    /* -------------------------------------------------- ambient props */
    function clearOf(p, dist) {
      for (var i = 0; i < occupied.length; i++) {
        if (Math.hypot(occupied[i].x - p.x, occupied[i].z - p.z) < dist) return false;
      }
      var doorsOk = Object.keys(map.doors).every(function (id) {
        return Math.hypot(map.doors[id].pos.x - p.x, map.doors[id].pos.z - p.z) > dist;
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
    var dCeil = new THREE.MeshLambertMaterial({ map: G.tex.wall, color: 0x55504a, side: THREE.DoubleSide });
    var dBeam = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: 0x55585e });
    var dRust = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: 0x86603c });
    var dDark = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
    var dPipe = new THREE.MeshLambertMaterial({ color: 0x6b7077 });
    var dConc = new THREE.MeshLambertMaterial({ map: G.tex.wall, color: 0x8a857c });
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
    function placeHero(room, name) {
      var es = wallEdges(room).filter(function (e) { return !e.door && !e.win; });
      for (var i = 0; i < es.length; i++) {
        var e = es[(i * 5 + 2) % es.length];
        var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
        var px = wc.x + e.o[0] * 1.15, pz = wc.z + e.o[1] * 1.15;
        if (!clearOf(new THREE.Vector3(px, 0, pz), 1.5)) continue;
        var g = new THREE.Group();
        g.position.set(px, 0, pz);
        g.rotation.y = Math.atan2(-e.o[0], -e.o[1]);
        G.scene.add(g);
        buildHero(name, g);
        map.addCollider(px - 1.0, pz - 1.0, px + 1.0, pz + 1.0);
        occupied.push({ x: px, z: pz });
        return;
      }
    }

    /* ---- per-room: ceiling/beams, pillars, ribs, hero, debris ---- */
    Object.keys(P.rooms).forEach(function (rid) {
      var room = P.rooms[rid];
      var bb = roomBBox(room);
      var isOut = outdoor.indexOf(rid) >= 0;
      var edges = wallEdges(room);

      if (!isOut) {
        // ceiling tiles + cross beams + a solid ceiling collider so the roof
        // collision matches the visible ceiling (no dropping into a roofed room
        // from above, nothing standing on the roof)
        room.cells.forEach(function (cr) {
          var wc = CFG.cellToWorld(cr[0], cr[1]);
          var cl = new THREE.Mesh(floorGeo, dCeil);
          cl.rotation.x = Math.PI / 2; cl.position.set(wc.x, WALL_H - 0.02, wc.z);
          G.scene.add(cl);
          // solid ceiling — but NOT under a stacked floor (loft/deck), whose own
          // floor is the ceiling and where the player legitimately stands above
          var underDeck = stageSpecs.some(function (sp) {
            return wc.x >= sp.x1 - 0.1 && wc.x <= sp.x2 + 0.1 && wc.z >= sp.z1 - 0.1 && wc.z <= sp.z2 + 0.1;
          });
          if (!underDeck) map.addCollider(wc.x - CELL / 2, wc.z - CELL / 2, wc.x + CELL / 2, wc.z + CELL / 2, WALL_H - 0.12, WALL_H + 0.6);
        });
        var along = bb.w >= bb.d;
        var span = along ? bb.d : bb.w, n = Math.max(1, Math.round(span / 4));
        for (var bj = 0; bj <= n; bj++) {
          var f = bj / n;
          if (along) addBox(bb.w - 0.1, 0.22, 0.22, bb.cx, WALL_H - 0.32,
            Math.min(bb.z1 - 0.11, Math.max(bb.z0 + 0.11, bb.z0 + f * bb.d)), dBeam);
          else addBox(0.22, 0.22, bb.d - 0.1,
            Math.min(bb.x1 - 0.11, Math.max(bb.x0 + 0.11, bb.x0 + f * bb.w)), WALL_H - 0.32, bb.cz, dBeam);
        }
      } else {
        // outdoor: broken parapet chunks on perimeter wall tops
        edges.forEach(function (e, idx) {
          if (idx % 2 || e.door) return;
          var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
          addBox(e.o[0] ? 0.5 : 1.4, 0.4 + Math.random() * 0.6, e.o[0] ? 1.4 : 0.5,
            wc.x + e.o[0] * (CELL / 2 - 0.18), WALL_H + 0.1, wc.z + e.o[1] * (CELL / 2 - 0.18), dConc);
        });
      }

      // corner support pillars — skip any that would land in/near a doorway
      // (they'd block the threshold and read as a pillar in front of the door)
      [[bb.x0 + 0.42, bb.z0 + 0.42], [bb.x1 - 0.42, bb.z0 + 0.42],
       [bb.x0 + 0.42, bb.z1 - 0.42], [bb.x1 - 0.42, bb.z1 - 0.42]].forEach(function (c) {
        var nearDoor = Object.keys(map.doors).some(function (id) {
          return Math.hypot(map.doors[id].pos.x - c[0], map.doors[id].pos.z - c[1]) < 2.2;
        });
        if (nearDoor) return;
        var ph = isOut ? WALL_H + 0.4 : WALL_H;
        addBox(0.46, ph, 0.46, c[0], ph / 2, c[1], dConc, { collide: true });
      });

      // wall ribs / pilasters (skip doors + windows)
      edges.forEach(function (e) {
        if (e.door || e.win || Math.random() > 0.4) return;
        var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
        var alongX = (e.dir === 'N' || e.dir === 'S');
        addBox(alongX ? 0.5 : 0.16, WALL_H - 0.5, alongX ? 0.16 : 0.5,
          wc.x + e.o[0] * (CELL / 2 - 0.1), (WALL_H - 0.5) / 2, wc.z + e.o[1] * (CELL / 2 - 0.1), dBeam);
      });

      // a themed hero structure
      placeHero(room, room.id && CFG.ROOMS[room.id] ? CFG.ROOMS[room.id].name : '');

      // one authored corner cluster per indoor room (replaces uniform debris
      // litter): a themed primary filler + a small supporting piece, tucked into
      // a dead corner out of the circling lane. Deterministic per map load, no
      // colliders (decorative) so navigation is untouched.
      if (!isOut) {
        var clr = G.PU.seeded(G.PU.hashStr('clutter:' + rid));
        var fillers = {
          nacht: ['ammo_crate', 'sandbag_stack', 'wood_crate', 'debris_pile'],
          derriese: ['wood_crate', 'oil_drum', 'pallet', 'debris_pile'],
          wetterjunge: ['wood_crate', 'gas_cylinder', 'field_radio', 'debris_pile']
        }[CFG.cur.id] || ['wood_crate', 'debris_pile'];
        var corners = [[bb.x0 + 0.85, bb.z0 + 0.85], [bb.x1 - 0.85, bb.z0 + 0.85],
                       [bb.x0 + 0.85, bb.z1 - 0.85], [bb.x1 - 0.85, bb.z1 - 0.85]];
        var start = (clr() * 4) | 0;
        for (var ci2 = 0; ci2 < 4; ci2++) {
          var cc = corners[(ci2 + start) % 4], cp = new THREE.Vector3(cc[0], 0, cc[1]);
          if (!clearOf(cp, 1.4)) continue;
          var prim = fillers[(clr() * fillers.length) | 0];
          G.Props.create(prim, { position: cp, rotationY: clr() * 6.28, seed: (G.PU.hashStr(rid + prim) || 1) });
          var o2 = clr() < 0.5 ? [0.75, 0] : [0, 0.75];
          G.Props.create('debris_pile', { position: new THREE.Vector3(cc[0] + o2[0], 0, cc[1] + o2[1]), seed: (G.PU.hashStr(rid) >>> 3) || 2 });
          occupy(cp);
          break;
        }
      }
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
    var deckMat = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: 0x6b6f78 });
    var railMat = G.mats.metal;
    function buildStage(s) {
      var H = s.h, dcx = (s.x1 + s.x2) / 2, dcz = (s.z1 + s.z2) / 2;
      var dw = s.x2 - s.x1, dd = s.z2 - s.z1;
      addBox(dw, 0.3, dd, dcx, H - 0.15, dcz, deckMat);          // floor slab (visual)
      if (s.thin) {
        // mezzanine / upper floor: a THIN slab so the ground beneath stays a
        // fully walkable room — a real stacked floor, not a solid block
        map.addCollider(s.x1, s.z1, s.x2, s.z2, H - 0.25, H + 0.05);
      } else {
        addBox(dw, H, 0.2, dcx, H / 2, s.z2 - 0.1, deckMat);     // solid front fascia
        map.addCollider(s.x1, s.z1, s.x2, s.z2, 0, H);           // solid catwalk block
      }
      map.addSurface({ x1: s.x1, x2: s.x2, z1: s.z1, z2: s.z2, y: H });
      [[s.x1 + 0.3, s.z1 + 0.3], [s.x2 - 0.3, s.z1 + 0.3],
       [s.x1 + 0.3, s.z2 - 0.3], [s.x2 - 0.3, s.z2 - 0.3]].forEach(function (p) {
        addBox(0.22, H, 0.22, p[0], H / 2, p[1], railMat);       // support posts (decorative)
      });
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
          if (noseH > 0.05) map.addCollider(st.x1, zA, st.x2, zN, 0, noseH);
          addBox(sw, 0.14, run + 0.05, scx, noseH + 0.07, zN - run / 2, deckMat);   // tread (visual)
          addBox(sw, H / n + 0.04, 0.06, scx, noseH + (H / n) / 2, zN, deckMat);     // riser (visual)
        }
      }
      map.stages.push({
        deckCenter: new THREE.Vector3(dcx, H, dcz), deckTop: H,
        stairBase: st ? new THREE.Vector3(scx, 0, st.zBase - 0.6) : null
      });
    }
    stageSpecs.forEach(buildStage);

    // elevated railway: walkable on top, open underneath (you pass beneath it).
    // Its surface is flagged bridge:true so ground nav ignores it.
    function buildBridge(b) {
      var H = b.h, cx = (b.x1 + b.x2) / 2, cz = (b.z1 + b.z2) / 2;
      var w = b.x2 - b.x1, d = b.z2 - b.z1;
      addBox(w, 0.22, d, cx, H - 0.11, cz, deckMat);                 // walkway slab
      map.addSurface({ x1: b.x1, x2: b.x2, z1: b.z1, z2: b.z2, y: H, bridge: true });
      // (no railings — open edges by design)
      map.bridges = (map.bridges || []);
      map.bridges.push({ center: new THREE.Vector3(cx, H, cz), top: H });
    }
    bridgeSpecs.forEach(buildBridge);

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
      // give the lab loft its own vibe: a cold console glow + a bank of screens
      if (map.stages[0]) {
        var lc = map.stages[0].deckCenter;
        var ll = new THREE.PointLight(0x44ccff, 0.9, 9);
        ll.position.set(lc.x, lc.y + 1.6, lc.z); G.scene.add(ll);
        addBox(1.6, 0.5, 0.6, lc.x, lc.y + 0.55, lc.z - 0.8, G.mats.metal);   // console desk
        addBox(1.5, 0.7, 0.1, lc.x, lc.y + 1.15, lc.z - 1.05,
          mat(0x0a1a22, { emissive: new THREE.Color(0x2aa0ff), emissiveIntensity: 0.7 }));  // screen bank
      }
    }

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

    map.recomputeReachable();
  };

  G.util = { textSprite: textSprite, mat: mat, addBox: addBox };
})();
