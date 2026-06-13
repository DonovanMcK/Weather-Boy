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
    var dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20),
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

    addCollider: function (x1, z1, x2, z2) {
      var c = { x1: x1, z1: z1, x2: x2, z2: z2, on: true };
      this.colliders.push(c);
      return c;
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
    G.scene.fog.density = atmos.density;
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
      return new THREE.Vector3(wc.x + (spec.off ? spec.off[0] : 0), 0, wc.z + (spec.off ? spec.off[1] : 0));
    }
    map.placePos = place;
    var occupied = []; // keep auto props clear of everything interactive
    function occupy(p) { occupied.push(p); }

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
      occupy(pos);
      var body = addBox(0.95, 1.85, 0.75, pos.x, 0.92, pos.z,
        new THREE.MeshLambertMaterial({ map: G.tex.metal, color: def.color }), { collide: true, solid: true });
      addBox(0.99, 0.12, 0.79, pos.x, 1.9, pos.z, G.mats.metal);
      addBox(0.99, 0.1, 0.79, pos.x, 0.06, pos.z, mat(0x1a1c20));
      // decal on the face pointing toward the room interior
      var roomCtr = P.rooms[map.roomAt(pos.x, pos.z)] ? P.rooms[map.roomAt(pos.x, pos.z)].center : null;
      var dx = roomCtr ? roomCtr.x - pos.x : 0, dz = roomCtr ? roomCtr.z - pos.z : 1;
      var decal = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.5),
        new THREE.MeshLambertMaterial({ map: perkDecalTexture(def), transparent: true,
          emissive: new THREE.Color(def.color), emissiveIntensity: 0.35, emissiveMap: null }));
      if (Math.abs(dx) > Math.abs(dz)) {
        decal.position.set(pos.x + Math.sign(dx) * 0.39, 1.0, pos.z);
        decal.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        decal.position.set(pos.x, 1.0, pos.z + (dz >= 0 ? 0.39 : -0.39));
        decal.rotation.y = dz >= 0 ? 0 : Math.PI;
      }
      G.scene.add(decal);
      var light = new THREE.PointLight(def.color, pm.perk === 'revive' ? 0.8 : 0.25, 7);
      light.position.set(pos.x, 2.2, pos.z);
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
      var wallPos = new THREE.Vector3(wc.x + tx + o[0] * FACE, 1.7, wc.z + tz + o[1] * FACE);
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
      // never let a box sit in a doorway: if it's within 3.2m of any door,
      // push it directly away from that door so it can't block the opening
      Object.keys(map.doors).forEach(function (id) {
        var dp = map.doors[id].pos;
        var dx = p.x - dp.x, dz = p.z - dp.z, d = Math.hypot(dx, dz);
        if (d < 3.2) {
          var push = (3.4 - d) / (d || 1);
          p.x += dx * push; p.z += dz * push;
        }
      });
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
      occupy(mf);
      var mfPad = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.2, 24),
        mat(0x515c66, { emissive: new THREE.Color(0x114455), emissiveIntensity: 0.5 }));
      mfPad.position.set(mf.x, 0.1, mf.z);
      G.scene.add(mfPad);
      addBox(0.5, 2.8, 0.5, mf.x - 2.2, 1.4, mf.z, G.mats.metal, { collide: true, solid: true });
      addBox(0.7, 0.5, 0.2, mf.x - 2.2, 2.0, mf.z, mat(0x111418, { emissive: new THREE.Color(0x22cc66), emissiveIntensity: 0.6 }));
      map.mainframe = { pos: mf, pad: mfPad };
    }

    // pack-a-punch: a chunkier machine — base, sloped hopper, glowing feed
    // slot and a gold output tray
    var pp = place(CFG.PAP);
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
    // sparse dressing only: one prop tucked into a corner of larger non-spawn
    // rooms, hugging the wall so it never blocks a walking lane (keeps the map
    // open). Decorative-only props don't get colliders.
    Object.keys(P.rooms).forEach(function (roomId) {
      if (roomId === 'S') return;                 // keep spawn clear
      var cells = P.rooms[roomId].cells;
      if (cells.length < 6) return;               // only roomy rooms
      var cr = cells[0];
      // shove toward the room edge furthest from the centre
      var wc = CFG.cellToWorld(cr[0], cr[1]);
      var ctr = P.rooms[roomId].center;
      var dx = Math.sign(wc.x - ctr.x) || 1, dz = Math.sign(wc.z - ctr.z) || 1;
      var p = new THREE.Vector3(wc.x + dx * 1.45, 0, wc.z + dz * 1.45);
      if (!clearOf(p, 2.0)) return;
      if ((cr[0] + cr[1]) % 2) {
        var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.95, 12),
          new THREE.MeshLambertMaterial({ map: G.tex.metal, color: 0x6a7a55 }));
        barrel.position.set(p.x, 0.48, p.z);
        G.scene.add(barrel);
        G.map.solidMeshes.push(barrel);
        map.addCollider(p.x - 0.36, p.z - 0.36, p.x + 0.36, p.z + 0.36);
      } else {
        addBox(0.85, 0.85, 0.85, p.x, 0.42, p.z, G.mats.wood, { collide: true, solid: true });
        addBox(0.6, 0.45, 0.6, p.x + 0.2, 1.05, p.z + 0.15, G.mats.plank, { solid: true });
      }
    });

    map.recomputeReachable();
  };

  G.util = { textSprite: textSprite, mat: mat, addBox: addBox };
})();
