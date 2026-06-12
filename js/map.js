/* ===========================================================================
   DER WETTERJUNGE — map.js
   Turns the ASCII grid in config.js into geometry, colliders, doors,
   window barricades, machines, teleporters and lighting.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G, CFG = null;

  var WALL_H = 4, WALL_T = 0.35, CELL = 4;
  var OFF = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

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

  function chalkTexture(lines) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var c = cv.getContext('2d');
    c.strokeStyle = '#e8e2cf'; c.fillStyle = '#e8e2cf';
    c.lineWidth = 5; c.lineCap = 'round';
    // crude chalk gun outline
    c.beginPath();
    c.moveTo(40, 120); c.lineTo(190, 120); c.lineTo(200, 132); c.lineTo(150, 132);
    c.lineTo(140, 170); c.lineTo(115, 170); c.lineTo(122, 132); c.lineTo(40, 132);
    c.closePath(); c.stroke();
    c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center';
    lines.forEach(function (l, i) { c.fillText(l, 128, 210 + i * 32); });
    var t = new THREE.CanvasTexture(cv);
    return t;
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
      var m = addBox(1.4, 0.22, 0.07, pos.x, pos.y, pos.z, mat(0x7a5a33));
      m.userData.vel = new THREE.Vector3(dir.x * 3 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2,
                                         dir.z * 3 + (Math.random() - 0.5) * 2);
      m.userData.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      m.userData.life = 1.2;
      this.effects.push(m);
    },

    update: function (dt) {
      var self = this;
      // door sink animation
      Object.keys(this.doors).forEach(function (id) {
        var d = self.doors[id];
        if (d.open && d.anim !== undefined && d.anim < 1) {
          d.anim = Math.min(1, d.anim + dt * 0.7);
          d.mesh.position.y = d.baseY - d.anim * (WALL_H - 0.2);
          if (d.anim >= 1) { G.scene.remove(d.mesh); }
        }
      });
      // flying debris
      for (var i = this.effects.length - 1; i >= 0; i--) {
        var m = this.effects[i];
        m.userData.life -= dt;
        m.userData.vel.y -= 9.8 * dt;
        m.position.addScaledVector(m.userData.vel, dt);
        m.rotation.x += m.userData.spin.x * dt;
        m.rotation.z += m.userData.spin.z * dt;
        if (m.userData.life <= 0) { G.scene.remove(m); this.effects.splice(i, 1); }
      }
      // teleporter pulse
      this.teleporters.forEach(function (t) {
        var s = 1 + Math.sin(G.time * 3 + t.pos.x) * 0.08;
        t.ring.scale.set(s, 1, s);
        var c = !self.power ? 0x331111 : (t.linked ? 0x22ddff : (t.linking ? 0xffaa22 : 0xddbb33));
        t.ring.material.color.setHex(c);
        t.ring.material.emissive = t.ring.material.color;
        if (t.light) t.light.intensity = self.power ? (t.linked ? 1.2 : 0.5) : 0;
      });
    },

    setPower: function () {
      this.power = true;
      this.roomLights.forEach(function (l) { l.intensity = 1.1; });
      G.hemi.intensity = 0.5;
      this.perkMachines.forEach(function (p) { if (p.light) p.light.intensity = 0.8; });
    }
  };

  /* ----------------------------------------------------------- the build */
  G.map.build = function () {
    CFG = G.CFG;
    var P = G.map.parsed = CFG.parseGrid(CFG.GRID);
    var map = G.map;

    // per-map atmosphere
    var atmos = CFG.cur.atmos;
    G.scene.background = new THREE.Color(atmos.sky);
    G.scene.fog.color.setHex(atmos.fog);
    G.scene.fog.density = atmos.density;

    // riser spawn points (room-tagged; active when the player is in that room)
    map.risers = (CFG.RISERS || []).map(function (cr) {
      var wc = CFG.cellToWorld(cr[0], cr[1]);
      return { pos: new THREE.Vector3(wc.x, 0, wc.z), room: P.cells[cr[1]][cr[0]].room };
    });

    var wallMat = mat(0x4a4540);
    var wallMat2 = mat(0x3e3a36);
    var woodMat = mat(0x6b4a2f);
    var plankMat = mat(0x8a6a3f);

    // window lookup by "col,row,dir"
    var winLookup = {};
    CFG.WINDOWS.forEach(function (w, i) { winLookup[w.cell[0] + ',' + w.cell[1] + ',' + w.dir] = i; });

    function wallEdge(col, row, dir, isWindow) {
      var wc = CFG.cellToWorld(col, row);
      var o = OFF[dir];
      var cx = wc.x + o[0] * CELL / 2, cz = wc.z + o[1] * CELL / 2;
      var alongX = (dir === 'N' || dir === 'S'); // wall runs along x axis
      var m = (col + row) % 2 ? wallMat : wallMat2;
      if (!isWindow) {
        if (alongX) addBox(CELL + WALL_T, WALL_H, WALL_T, cx, WALL_H / 2, cz, m, { collide: true, solid: true });
        else addBox(WALL_T, WALL_H, CELL + WALL_T, cx, WALL_H / 2, cz, m, { collide: true, solid: true });
        return null;
      }
      // window wall: sill + posts + lintel, with a boarded opening
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
      // one full-height collider keeps players in; zombies vault via scripted lerp
      map.addCollider(cx - (alongX ? CELL / 2 : WALL_T / 2), cz - (alongX ? WALL_T / 2 : CELL / 2),
                      cx + (alongX ? CELL / 2 : WALL_T / 2), cz + (alongX ? WALL_T / 2 : CELL / 2));
      return { cx: cx, cz: cz, alongX: alongX, dirVec: new THREE.Vector3(o[0], 0, o[1]) };
    }

    // floors + walls
    var floorGeo = new THREE.PlaneGeometry(CELL, CELL);
    for (var r = 0; r < P.rows; r++) {
      for (var c = 0; c < P.cols; c++) {
        var cell = P.cells[r][c];
        if (cell.type === 'void') continue;
        var wc = CFG.cellToWorld(c, r);
        var color = cell.type === 'door' ? 0x35322f
          : CFG.ROOMS[cell.room].floor;
        var shade = ((c + r) % 2) ? 1.0 : 0.88;
        var fm = mat(new THREE.Color(color).multiplyScalar(shade).getHex());
        var f = new THREE.Mesh(floorGeo, fm);
        f.rotation.x = -Math.PI / 2;
        f.position.set(wc.x, 0, wc.z);
        G.scene.add(f);

        // walls on edges
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
              if (dir === 'E' || dir === 'S') wallEdge(c, r, dir, false); // build once
            }
            // door neighbor: opening, the door slab handles it
          } else if (cell.type === 'door') {
            if (n.type === 'void') wallEdge(c, r, dir, false);
          }
        });
      }
    }

    // outer ground + sky
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x171a14));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    G.scene.add(ground);
    var starGeo = new THREE.BufferGeometry();
    var stars = [];
    for (var s = 0; s < 350; s++) {
      var a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.45 + 0.08, rr = 180;
      stars.push(Math.cos(a) * Math.cos(e) * rr, Math.sin(e) * rr, Math.sin(a) * Math.cos(e) * rr);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    G.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbbccff, size: 0.7, fog: false })));

    /* ------------------------------------------------------------ windows */
    function buildWindow(idx, info, room) {
      var w = CFG.WINDOWS[idx];
      var center = new THREE.Vector3(info.cx, 0, info.cz);
      var win = {
        idx: idx, room: room,
        pos: center,
        dir: info.dirVec,
        outside: center.clone().addScaledVector(info.dirVec, 2.2),
        inside: center.clone().addScaledVector(info.dirVec, -1.4),
        boards: 6, boardMeshes: [], tearer: null
      };
      for (var b = 0; b < 6; b++) {
        var bm = addBox(info.alongX ? 2.6 : 0.09, 0.26, info.alongX ? 0.09 : 2.6,
          info.cx, 1.15 + b * 0.28, info.cz, plankMat);
        bm.rotation.y = (Math.random() - 0.5) * 0.12;
        bm.rotation.z = (Math.random() - 0.5) * 0.08;
        win.boardMeshes.push(bm);
      }
      win.setBoards = function (n) {
        n = Math.max(0, Math.min(6, n));
        this.boards = n;
        for (var i = 0; i < 6; i++) this.boardMeshes[i].visible = i < n;
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
      // passage axis: rooms are N/S or E/W of the door cell
      var roomDirs = [];
      ['N', 'S', 'E', 'W'].forEach(function (dir) {
        var o = OFF[dir];
        var n = map.cellAt(cellCR[0] + o[0], cellCR[1] + o[1]);
        if (n && n.type === 'room') roomDirs.push(dir);
      });
      var alongZ = roomDirs.indexOf('N') >= 0 || roomDirs.indexOf('S') >= 0; // passage along z
      var mesh = alongZ
        ? addBox(CELL - 0.2, WALL_H - 0.4, 0.5, wc.x, (WALL_H - 0.4) / 2, wc.z, woodMat, { solid: true })
        : addBox(0.5, WALL_H - 0.4, CELL - 0.2, wc.x, (WALL_H - 0.4) / 2, wc.z, woodMat, { solid: true });
      // plank detailing
      for (var k = -1; k <= 1; k++) {
        var pm = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? CELL - 0.1 : 0.6, 0.3, alongZ ? 0.6 : CELL - 0.1), plankMat);
        pm.position.set(0, k * 1.0, 0);
        pm.rotation[alongZ ? 'z' : 'x'] = k * 0.15;
        mesh.add(pm);
      }
      var collider = map.addCollider(wc.x - CELL / 2, wc.z - CELL / 2, wc.x + CELL / 2, wc.z + CELL / 2);
      var sprite = textSprite(cd.name + ' — ' + cd.cost, '#ffe9a0', 3.4);
      sprite.position.set(wc.x, 2.6, wc.z);
      G.scene.add(sprite);
      map.doors[id] = {
        id: +id, cost: cd.cost, name: cd.name, rooms: pd.rooms, open: false,
        mesh: mesh, collider: collider, sprite: sprite, baseY: mesh.position.y,
        pos: new THREE.Vector3(wc.x, 0, wc.z)
      };
    });

    /* ----------------------------------------------------- placed objects */
    function place(spec) {
      var wc = CFG.cellToWorld(spec.cell[0], spec.cell[1]);
      return new THREE.Vector3(wc.x + (spec.off ? spec.off[0] : 0), 0, wc.z + (spec.off ? spec.off[1] : 0));
    }
    map.placePos = place;

    // perk machines
    CFG.PERK_MACHINES.forEach(function (pm) {
      var def = CFG.PERKS[pm.perk];
      var pos = place(pm);
      var body = addBox(0.9, 1.9, 0.7, pos.x, 0.95, pos.z, mat(def.color), { collide: true, solid: true });
      addBox(0.7, 0.5, 0.72, pos.x, 1.45, pos.z, mat(0x222222, { emissive: new THREE.Color(def.color), emissiveIntensity: 0.5 }));
      var label = textSprite(def.name + ' — ' + def.cost, '#fff', 2.6);
      label.position.set(pos.x, 2.4, pos.z);
      G.scene.add(label);
      var light = new THREE.PointLight(def.color, pm.perk === 'revive' ? 0.7 : 0, 7);
      light.position.set(pos.x, 2.2, pos.z);
      G.scene.add(light);
      map.perkMachines.push({ perk: pm.perk, pos: pos, mesh: body, light: light });
    });

    // wall buys (chalk outlines)
    CFG.WALLBUYS.forEach(function (wb) {
      var pos = place(wb);
      var o = OFF[wb.face];
      // sit the decal just inside the wall's inner face (wall face is at ±1.825
      // from the cell center, anchors are at ±1.7)
      var wallPos = pos.clone();
      wallPos.x += o[0] * 0.095; wallPos.z += o[1] * 0.095;
      var isFrags = wb.gun === 'frags';
      var def = isFrags ? { name: 'Frag Grenades' } : CFG.WEAPONS[wb.gun];
      var cost = isFrags ? CFG.FRAGS_COST : def.wall;
      var plane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8),
        new THREE.MeshBasicMaterial({ map: chalkTexture([def.name, cost + ' pts']), transparent: true }));
      plane.position.set(wallPos.x, 1.7, wallPos.z);
      plane.rotation.y = { N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2 }[wb.face];
      // face into the room (normal opposite of outward dir)
      plane.rotation.y += Math.PI;
      G.scene.add(plane);
      map.wallbuys.push({ gun: wb.gun, isFrags: isFrags, cost: cost, pos: pos, mesh: plane });
    });

    // mystery box spots
    CFG.BOX_SPOTS.forEach(function (bs, i) {
      map.boxSpots.push({ idx: i, pos: place(bs) });
    });

    // teleporters
    CFG.TELEPORTERS.forEach(function (t) {
      var pos = place(t);
      var ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.18, 20),
        mat(0x331111, { emissive: new THREE.Color(0x111111) }));
      ring.position.set(pos.x, 0.09, pos.z);
      G.scene.add(ring);
      for (var p = 0; p < 3; p++) {
        var ang = p / 3 * Math.PI * 2;
        addBox(0.3, 2.6, 0.3, pos.x + Math.cos(ang) * 1.7, 1.3, pos.z + Math.sin(ang) * 1.7,
          mat(0x555566), { collide: true, solid: true });
      }
      var light = new THREE.PointLight(0x22ddff, 0, 7);
      light.position.set(pos.x, 2, pos.z);
      G.scene.add(light);
      var label = textSprite('Teleporter ' + t.id, '#9ef', 2.4);
      label.position.set(pos.x, 3.1, pos.z);
      G.scene.add(label);
      map.teleporters.push({ id: t.id, pos: pos, ring: ring, light: light, linked: false, linking: false, linkTimer: 0 });
    });

    // mainframe (maps with teleporters only)
    map.mainframe = null;
    if (CFG.MAINFRAME) {
      var mf = place(CFG.MAINFRAME);
      var mfPad = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.2, 24),
        mat(0x44505a, { emissive: new THREE.Color(0x113344) }));
      mfPad.position.set(mf.x, 0.1, mf.z);
      G.scene.add(mfPad);
      addBox(0.5, 2.8, 0.5, mf.x - 2.2, 1.4, mf.z, mat(0x39424d), { collide: true, solid: true });
      var mfLabel = textSprite('MAINFRAME', '#9ef', 2.6);
      mfLabel.position.set(mf.x, 2.6, mf.z);
      G.scene.add(mfLabel);
      map.mainframe = { pos: mf, pad: mfPad };
    }

    // pack-a-punch + force field
    var pp = place(CFG.PAP);
    var papBody = addBox(1.7, 1.1, 0.9, pp.x, 0.55, pp.z, mat(0x222233, { emissive: new THREE.Color(0x4411aa), emissiveIntensity: 0.4 }), { collide: true, solid: true });
    addBox(0.5, 0.4, 0.95, pp.x, 1.25, pp.z, mat(0xb09020));
    var papLabel = textSprite('Pack-a-Punch — 5000', '#fb5', 3.0);
    papLabel.position.set(pp.x, 2.3, pp.z);
    G.scene.add(papLabel);
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
    var lever = addBox(0.8, 1.4, 0.3, pw.x, 1.3, pw.z, mat(0x662222, { emissive: new THREE.Color(0x330000) }), { solid: true });
    var pwLabel = textSprite('POWER', '#f66', 2.0);
    pwLabel.position.set(pw.x, 2.4, pw.z);
    G.scene.add(pwLabel);
    map.powerSwitch = { pos: pw, mesh: lever, label: pwLabel };

    /* ------------------------------------------------------------ lights */
    Object.keys(P.rooms).forEach(function (roomId) {
      var cells = P.rooms[roomId].cells;
      var cx = 0, cz = 0;
      cells.forEach(function (cr) { var w = CFG.cellToWorld(cr[0], cr[1]); cx += w.x; cz += w.z; });
      cx /= cells.length; cz /= cells.length;
      var l = new THREE.PointLight(CFG.ROOMS[roomId].light, roomId === 'S' ? 0.9 : 0.15, 16);
      l.position.set(cx, 3.4, cz);
      G.scene.add(l);
      G.map.roomLights.push(l);
      var center = new THREE.Vector3(cx, 0, cz);
      P.rooms[roomId].center = center;
    });

    map.recomputeReachable();
  };

  G.util = { textSprite: textSprite, mat: mat, addBox: addBox };
})();
