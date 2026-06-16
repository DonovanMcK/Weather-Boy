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

    // per-map atmosphere
    var atmos = CFG.cur.atmos;
    G.scene.background = new THREE.Color(atmos.sky);
    G.scene.fog.color.setHex(atmos.fog);
    G.scene.fog.density = 0;   // no distance fog (player preference) — clear air
    G.hemi.intensity = 0.65;
    if (G.amb) G.amb.intensity = 0.5;

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
      if (!isWindow) {
        if (alongX) addBox(CELL + WALL_T, WALL_H, WALL_T, cx, WALL_H / 2, cz, m, { collide: true, solid: true });
        else addBox(WALL_T, WALL_H, CELL + WALL_T, cx, WALL_H / 2, cz, m, { collide: true, solid: true });
        return null;
      }
      var sillH = 1.0, openTop = 2.6, postW = 0.7;
      if (alongX) {
        addBox(CELL, sillH, WALL_T, cx, sillH / 2, cz, m, { solid: true });
        addBox(postW, WALL_H, WALL_T, cx - CELL / 2 + postW / 2, WALL_H / 2, cz, m, { solid: true });
        addBox(postW, WALL_H, WALL_T, cx + CELL / 2 - postW / 2, WALL_H / 2, cz, m, { solid: true });
        addBox(CELL, WALL_H - openTop, WALL_T, cx, (WALL_H + openTop) / 2, cz, m, { solid: true });
      } else {
        addBox(WALL_T, sillH, CELL, cx, sillH / 2, cz, m, { solid: true });
        addBox(WALL_T, WALL_H, postW, cx, WALL_H / 2, cz - CELL / 2 + postW / 2, m, { solid: true });
        addBox(WALL_T, WALL_H, postW, cx, WALL_H / 2, cz + CELL / 2 - postW / 2, m, { solid: true });
        addBox(WALL_T, WALL_H - openTop, CELL, cx, (WALL_H + openTop) / 2, cz, m, { solid: true });
      }
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
      var northDeck = { x1: xW(3) - CELL / 2, x2: xW(12) + CELL / 2,
                        z1: zW(5) - CELL / 2, z2: zW(5) + CELL / 2, h: H, thin: true, railS: true };
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
    function pushToWall(pos, hd) {
      var rid = map.roomAt(pos.x, pos.z);
      if (!rid || !P.rooms[rid]) return pos;
      var bb = roomInner(rid);
      var cands = [
        { x: bb.x0 + hd, z: pos.z, d: pos.x - bb.x0 },
        { x: bb.x1 - hd, z: pos.z, d: bb.x1 - pos.x },
        { x: pos.x, z: bb.z0 + hd, d: pos.z - bb.z0 },
        { x: pos.x, z: bb.z1 - hd, d: bb.z1 - pos.z }
      ].sort(function (a, b) { return a.d - b.d; });
      for (var i = 0; i < cands.length; i++) {
        var np = new THREE.Vector3(cands[i].x, 0, cands[i].z);
        if (spotClear(np, 1.7)) { pos.x = np.x; pos.z = np.z; break; }
      }
      return pos;
    }

    // perk machines: vending cabinets with a lit bottle decal facing the room
    function perkDecalTexture(def) {
      var cv = document.createElement('canvas');
      cv.width = 128; cv.height = 256;
      var c = cv.getContext('2d');
      c.fillStyle = '#101216'; c.fillRect(0, 0, 128, 256);
      var col = '#' + new THREE.Color(def.color).getHexString();
      c.strokeStyle = col; c.lineWidth = 4;
      c.strokeRect(8, 8, 112, 240);
      // bottle silhouette
      c.fillStyle = col;
      c.fillRect(54, 60, 20, 16);   // neck
      c.beginPath();
      c.moveTo(48, 76); c.lineTo(80, 76); c.lineTo(86, 96); c.lineTo(86, 170);
      c.lineTo(42, 170); c.lineTo(42, 96); c.closePath();
      c.fill();
      c.fillStyle = '#101216';
      c.fillRect(48, 110, 32, 26);  // label band
      c.fillStyle = '#fff';
      c.font = 'bold 26px Georgia, serif'; c.textAlign = 'center';
      c.fillText(def.icon, 64, 131);
      c.fillStyle = col;
      c.font = 'bold 17px Georgia, serif';
      c.fillText(def.name.split(' ')[0].toUpperCase(), 64, 212);
      return new THREE.CanvasTexture(cv);
    }

    CFG.PERK_MACHINES.forEach(function (pm) {
      var def = CFG.PERKS[pm.perk];
      var pos = place(pm);
      if (!pm.y) pushToWall(pos, 0.55);   // elevated machines stay where placed
      occupy(pos);
      var by = pos.y;                     // floor height this machine sits on
      var body = addBox(0.95, 1.85, 0.75, pos.x, by + 0.92, pos.z,
        new THREE.MeshLambertMaterial({ map: G.tex.metal, color: def.color }), { solid: true });
      map.addCollider(pos.x - 0.48, pos.z - 0.38, pos.x + 0.48, pos.z + 0.38, by, by + 1.9);
      addBox(0.99, 0.12, 0.79, pos.x, by + 1.9, pos.z, G.mats.metal);
      addBox(0.99, 0.1, 0.79, pos.x, by + 0.06, pos.z, mat(0x1a1c20));
      // decal on the face pointing toward the room interior
      var roomCtr = P.rooms[map.roomAt(pos.x, pos.z)] ? P.rooms[map.roomAt(pos.x, pos.z)].center : null;
      var dx = roomCtr ? roomCtr.x - pos.x : 0, dz = roomCtr ? roomCtr.z - pos.z : 1;
      var decal = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.5),
        new THREE.MeshLambertMaterial({ map: perkDecalTexture(def), transparent: true,
          emissive: new THREE.Color(def.color), emissiveIntensity: 0.35, emissiveMap: null }));
      if (Math.abs(dx) > Math.abs(dz)) {
        decal.position.set(pos.x + Math.sign(dx) * 0.39, by + 1.0, pos.z);
        decal.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        decal.position.set(pos.x, by + 1.0, pos.z + (dz >= 0 ? 0.39 : -0.39));
        decal.rotation.y = dz >= 0 ? 0 : Math.PI;
      }
      G.scene.add(decal);
      var light = new THREE.PointLight(def.color, pm.perk === 'revive' ? 0.8 : 0.25, 7);
      light.position.set(pos.x, by + 2.2, pos.z);
      G.scene.add(light);
      map.perkMachines.push({ perk: pm.perk, pos: pos, mesh: body, light: light });
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
      var plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshBasicMaterial({ map: chalkTexture([def.name, cost + ' pts']),
          transparent: true, depthWrite: false, side: THREE.FrontSide,
          polygonOffset: true, polygonOffsetFactor: -2 }));
      plane.position.copy(wallPos);
      plane.rotation.y = { N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2 }[wb.face] + Math.PI;
      G.scene.add(plane);
      map.wallbuys.push({ gun: wb.gun, isFrags: isFrags, cost: cost, pos: pos, mesh: plane });
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
      var ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.18, 20),
        mat(0x331111, { emissive: new THREE.Color(0x111111) }));
      ring.position.set(pos.x, 0.09, pos.z);
      G.scene.add(ring);
      for (var p = 0; p < 3; p++) {
        var ang = p / 3 * Math.PI * 2;
        var px = pos.x + Math.cos(ang) * 1.7, pz = pos.z + Math.sin(ang) * 1.7;
        addBox(0.3, 2.6, 0.3, px, 1.3, pz, G.mats.metal, { collide: true, solid: true });
        addBox(0.36, 0.2, 0.36, px, 2.7, pz, mat(0x222230, { emissive: new THREE.Color(0x2288cc), emissiveIntensity: 0.5 }));
      }
      var light = new THREE.PointLight(0x22ddff, 0, 7);
      light.position.set(pos.x, 2, pos.z);
      G.scene.add(light);
      map.teleporters.push({ id: t.id, pos: pos, ring: ring, light: light, linked: false, linking: false, linkTimer: 0 });
    });

    // mainframe
    map.mainframe = null;
    if (CFG.MAINFRAME) {
      var mf = place(CFG.MAINFRAME);
      pushToWall(mf, 1.1);
      occupy(mf);
      var mfPad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.2, 24),
        mat(0x515c66, { emissive: new THREE.Color(0x114455), emissiveIntensity: 0.5 }));
      mfPad.position.set(mf.x, 0.1, mf.z);
      G.scene.add(mfPad);
      // link terminal sits on the pad (no stray collider in the open room)
      addBox(0.55, 1.2, 0.45, mf.x, 0.7, mf.z, G.mats.metal, { collide: true, solid: true });
      addBox(0.62, 0.42, 0.16, mf.x, 1.15, mf.z + 0.26, mat(0x111418, { emissive: new THREE.Color(0x22cc66), emissiveIntensity: 0.6 }));
      map.mainframe = { pos: mf, pad: mfPad };
    }

    // pack-a-punch: a chunkier machine — base, sloped hopper, glowing feed
    // slot and a gold output tray
    var pp = place(CFG.PAP);
    pushToWall(pp, 1.0);
    occupy(pp);
    var papDark = new THREE.MeshPhongMaterial({ map: G.tex.metal, color: 0x26262f, shininess: 30,
      specular: new THREE.Color(0x44447a) });
    var papGlow = mat(0x140a2a, { emissive: new THREE.Color(0x7a33ff), emissiveIntensity: 0.7 });
    var papGold = new THREE.MeshPhongMaterial({ color: 0xc9a030, shininess: 80, specular: new THREE.Color(0xfff0b0) });
    var papBody = addBox(1.5, 1.2, 0.95, pp.x, 0.6, pp.z, papDark, { collide: true, solid: true });
    addBox(1.6, 0.18, 1.05, pp.x, 0.09, pp.z, papDark);             // base plinth
    // sloped hopper on top
    var hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.62, 0.7, 4),
      papDark);
    hopper.rotation.y = Math.PI / 4;
    hopper.position.set(pp.x, 1.55, pp.z);
    G.scene.add(hopper);
    addBox(0.95, 0.5, 0.12, pp.x, 0.85, pp.z + 0.5, papGlow);       // glowing feed slot
    addBox(0.7, 0.1, 0.45, pp.x, 0.38, pp.z + 0.62, papGold);       // output tray
    addBox(1.56, 0.1, 1.0, pp.x, 1.18, pp.z, papGold);              // gold trim band
    var papL = new THREE.PointLight(0x8844ff, 0.7, 6);
    papL.position.set(pp.x, 1.3, pp.z + 0.6);
    G.scene.add(papL);
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
    pushToWall(pw, 0.35);
    occupy(pw);
    var lever = addBox(0.8, 1.4, 0.3, pw.x, 1.3, pw.z, mat(0x7c2a22, { emissive: new THREE.Color(0x330000) }), { solid: true });
    addBox(0.16, 0.5, 0.12, pw.x, 1.55, pw.z + 0.18, G.mats.metal);
    map.powerSwitch = { pos: pw, mesh: lever };
    occupy(place(CFG.PLAYER_SPAWN));

    /* ------------------------------------------------- lights + fixtures */
    function addLamp(x, z, color) {
      var fixture = new THREE.Group();
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 10, 1, true),
        new THREE.MeshLambertMaterial({ color: 0x3a3f46, side: THREE.DoubleSide }));
      cone.position.y = 0.1;
      fixture.add(cone);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0x222018, emissive: new THREE.Color(0xffe9b0), emissiveIntensity: 0.35 }));
      bulb.position.y = -0.04;
      fixture.add(bulb);
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), G.mats.metal);
      rod.position.y = 0.55;
      fixture.add(rod);
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
    var dCeil = new THREE.MeshLambertMaterial({ map: G.tex.wall, color: 0x55504a });
    var dBeam = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: 0x55585e });
    var dRust = new THREE.MeshLambertMaterial({ map: G.tex.metal, color: 0x86603c });
    var dDark = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
    var dPipe = new THREE.MeshLambertMaterial({ color: 0x6b7077 });
    var dConc = new THREE.MeshLambertMaterial({ map: G.tex.wall, color: 0x8a857c });
    var dGlass = new THREE.MeshLambertMaterial({ color: 0x1b3a30, transparent: true, opacity: 0.55,
      emissive: new THREE.Color(0x33ff88), emissiveIntensity: 0.35 });
    function glowMat(col, i) {
      return new THREE.MeshLambertMaterial({ color: 0x0e1014, emissive: new THREE.Color(col), emissiveIntensity: i || 0.7 });
    }
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

    /* ---- themed hero structures (built local to a group, back toward -z) -- */
    function heroGenerators(g) {
      [-0.55, 0.55].forEach(function (ox) {
        pbox(g, 0.9, 1.3, 0.7, ox, 0.65, -0.15, dRust);
        pbox(g, 0.96, 0.18, 0.76, ox, 1.45, -0.15, dBeam);
        pbox(g, 0.5, 0.32, 0.05, ox, 0.95, 0.2, glowMat(0xffaa33, 0.7));
        pcyl(g, 0.07, 0.07, 1.1, ox + 0.3, 2.05, -0.25, dPipe, 8);
      });
      pcyl(g, 0.06, 0.06, 1.3, 0, 1.0, -0.32, dPipe, 8, 'x');
    }
    function heroFurnace(g) {
      pcyl(g, 0.72, 0.72, 1.9, 0, 1.05, -0.2, dRust, 16);
      pbox(g, 1.0, 0.75, 0.12, 0, 0.62, 0.46, glowMat(0xff4410, 1.1));
      pcyl(g, 0.18, 0.18, 1.4, 0.42, 2.4, -0.2, dPipe, 10);
      pbox(g, 1.7, 0.3, 0.7, 0, 0.15, -0.1, dDark);
      var fl = new THREE.PointLight(0xff5a1e, 0.9, 7); fl.position.set(0, 0.7, 0.6); g.add(fl);
    }
    function heroLab(g) {
      pbox(g, 1.7, 0.85, 0.6, 0, 0.42, -0.1, dDark);
      [-0.55, 0, 0.55].forEach(function (ox) {
        pcyl(g, 0.22, 0.22, 0.95, ox, 1.32, -0.1, dGlass, 12);
        pcyl(g, 0.25, 0.25, 0.1, ox, 0.9, -0.1, dBeam, 12);
        pcyl(g, 0.25, 0.25, 0.1, ox, 1.82, -0.1, dBeam, 12);
      });
      var ll = new THREE.PointLight(0x33ff88, 0.5, 6); ll.position.set(0, 1.5, 0.2); g.add(ll);
    }
    function heroTruck(g) {
      pbox(g, 1.1, 0.5, 2.1, 0, 0.55, 0.1, dRust);
      pbox(g, 1.0, 0.62, 0.95, 0, 0.85, -0.7, dRust);
      pbox(g, 0.9, 0.4, 0.75, 0, 1.05, -0.66, dDark);
      [[-0.58, -0.72], [0.58, -0.72], [-0.58, 0.75], [0.58, 0.75]].forEach(function (w) {
        pcyl(g, 0.3, 0.3, 0.26, w[0], 0.3, w[1], dDark, 12, 'x');
      });
    }
    function heroShelves(g) {
      [-0.9, 0.9].forEach(function (ox) { pbox(g, 0.09, 2.1, 0.62, ox, 1.05, -0.1, dBeam); });
      [0.45, 1.1, 1.75].forEach(function (y) { pbox(g, 1.85, 0.08, 0.6, 0, y, -0.1, dBeam); });
      [[-0.55, 0.75, dRust], [0.4, 0.75, G.mats.wood], [0.0, 1.4, G.mats.plank], [0.55, 1.4, dRust], [-0.4, 2.05, G.mats.wood]]
        .forEach(function (c) { pbox(g, 0.5, 0.46, 0.46, c[0], c[1], -0.1, c[2]); });
    }
    function heroServers(g) {
      [-0.6, 0, 0.6].forEach(function (ox) {
        pbox(g, 0.5, 1.7, 0.55, ox, 0.85, -0.12, dDark);
        pbox(g, 0.44, 1.5, 0.04, ox, 0.85, 0.16, glowMat(0x33ccff, 0.55));
      });
      var dish = pcyl(g, 0.62, 0.5, 0.12, 0, 2.35, -0.15, dConc, 18); dish.rotation.x = 0.6;
      pcyl(g, 0.05, 0.05, 0.6, 0, 2.05, -0.15, dBeam, 6);
    }
    function heroPipes(g) {
      [-0.32, -0.11, 0.11, 0.32].forEach(function (ox, i) {
        pcyl(g, 0.08, 0.08, 2.5, ox, 1.4, -0.25, i % 2 ? dRust : dPipe, 8);
      });
      pbox(g, 1.3, 0.42, 0.42, 0, 0.32, -0.22, dDark);
      pcyl(g, 0.13, 0.13, 0.3, 0.0, 0.55, 0.05, dRust, 8, 'z');
    }
    function heroSandbags(g) {
      for (var rr = 0; rr < 3; rr++) {
        for (var i = 0; i < 4; i++) {
          var off = (rr % 2) * 0.21;
          pbox(g, 0.5, 0.28, 0.42, -0.72 + i * 0.42 + off, 0.14 + rr * 0.26, -0.1,
            new THREE.MeshLambertMaterial({ color: i % 2 ? 0x756a4e : 0x645a40 }));
        }
      }
    }
    function heroCrates(g) {
      pbox(g, 0.85, 0.85, 0.85, -0.3, 0.43, -0.12, dRust);
      pbox(g, 0.72, 0.72, 0.72, 0.45, 0.37, 0.08, G.mats.wood);
      pbox(g, 0.6, 0.6, 0.6, -0.18, 1.16, -0.12, G.mats.plank);
    }
    function buildHero(name, g) {
      var n = name.toLowerCase();
      if (/generator|power/.test(n)) heroGenerators(g);
      else if (/furnace/.test(n)) heroFurnace(g);
      else if (/lab/.test(n)) heroLab(g);
      else if (/garage/.test(n)) heroTruck(g);
      else if (/storage/.test(n)) heroShelves(g);
      else if (/comms|radar|dome/.test(n)) heroServers(g);
      else if (/catwalk/.test(n)) heroPipes(g);
      else if (/courtyard|crash|bunker|help|spawn/.test(n)) heroSandbags(g);
      else heroCrates(g);
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
        // ceiling tiles + cross beams
        room.cells.forEach(function (cr) {
          var wc = CFG.cellToWorld(cr[0], cr[1]);
          var cl = new THREE.Mesh(floorGeo, dCeil);
          cl.rotation.x = Math.PI / 2; cl.position.set(wc.x, WALL_H - 0.02, wc.z);
          G.scene.add(cl);
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

      // corner support pillars
      [[bb.x0 + 0.42, bb.z0 + 0.42], [bb.x1 - 0.42, bb.z0 + 0.42],
       [bb.x0 + 0.42, bb.z1 - 0.42], [bb.x1 - 0.42, bb.z1 - 0.42]].forEach(function (c) {
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

      // scattered floor debris hugging walls (decorative, no collider)
      edges.filter(function (e) { return !e.door && !e.win; }).forEach(function (e, idx) {
        if (idx % 3) return;
        var wc = CFG.cellToWorld(e.cr[0], e.cr[1]);
        var px = wc.x + e.o[0] * (CELL / 2 - 0.5) + (e.o[0] ? 0 : (Math.random() - 0.5) * 1.5);
        var pz = wc.z + e.o[1] * (CELL / 2 - 0.5) + (e.o[1] ? 0 : (Math.random() - 0.5) * 1.5);
        if (!clearOf(new THREE.Vector3(px, 0, pz), 1.0)) return;
        var s = 0.25 + Math.random() * 0.35;
        addBox(s, s * 0.6, s, px, s * 0.3, pz, idx % 2 ? dDark : dConc);
      });
    });

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
      // edge barriers: waist-high railings (open balcony) OR full walls (an
      // enclosed upper ROOM) — both clear the ground beneath, so you walk under
      var rh = s.walls ? 2.9 : 1.0;
      var rmat = s.walls ? G.mats.wallA : railMat;
      function rail(x1, z1, x2, z2) {
        addBox(Math.max(0.12, x2 - x1), rh, Math.max(0.12, z2 - z1),
               (x1 + x2) / 2, H + rh / 2, (z1 + z2) / 2, rmat);
        map.addCollider(x1, z1, x2, z2, H, H + rh);
      }
      if (s.railN) rail(s.x1, s.z1, s.x2, s.z1 + 0.12);
      if (s.railW) rail(s.x1, s.z1, s.x1 + 0.12, s.z2);
      if (s.railE) rail(s.x2 - 0.12, s.z1, s.x2, s.z2);
      if (s.railS) {  // overlook rail with a gap where the staircase arrives
        var st0 = s.stairs;
        if (st0 && st0.x1 > s.x1 + 0.2) rail(s.x1, s.z2 - 0.12, st0.x1, s.z2);
        if (st0 && st0.x2 < s.x2 - 0.2) rail(st0.x2, s.z2 - 0.12, s.x2, s.z2);
        if (!st0) rail(s.x1, s.z2 - 0.12, s.x2, s.z2);
      }
      // staircase: nested boxes descending south, each tread a flat surface
      var st = s.stairs;
      if (st) {
        var n = st.steps, run = (st.zBase - st.zTop) / n, sw = st.x2 - st.x1, scx = (st.x1 + st.x2) / 2;
        for (var i = 1; i <= n; i++) {
          var top = H * (n + 1 - i) / (n + 1);
          var z2 = st.zTop + i * run;
          addBox(sw, top, z2 - st.zTop, scx, top / 2, (st.zTop + z2) / 2, deckMat);
          map.addCollider(st.x1, st.zTop, st.x2, z2, 0, top);
          map.addSurface({ x1: st.x1, x2: st.x2, z1: st.zTop + (i - 1) * run, z2: z2, y: top });
        }
        addBox(0.12, 1.0, st.zBase - st.zTop, st.x1 + 0.06, H * 0.5 + 0.3, (st.zTop + st.zBase) / 2, railMat);
        addBox(0.12, 1.0, st.zBase - st.zTop, st.x2 - 0.06, H * 0.5 + 0.3, (st.zTop + st.zBase) / 2, railMat);
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
      // waist rails on both long sides (block falling off, clear underneath)
      [b.z1 + 0.06, b.z2 - 0.06].forEach(function (rz) {
        addBox(w, 1.0, 0.12, cx, H + 0.5, rz, railMat);
        map.addCollider(b.x1, rz - 0.06, b.x2, rz + 0.06, H, H + 1.0);
      });
      // slim decorative end posts (no collider — never block the passage below)
      [b.x1 + 0.2, b.x2 - 0.2].forEach(function (px) {
        addBox(0.16, H, 0.16, px, H / 2, cz, railMat);
      });
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

    map.recomputeReachable();
  };

  G.util = { textSprite: textSprite, mat: mat, addBox: addBox };
})();
