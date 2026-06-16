/* ===========================================================================
   TOTENSTURM — nav.js
   Multi-layer navigation engine. Replaces the old single-height-per-cell flow
   field with a true 3D-aware navigation GRAPH:

     - Nodes are sampled on a fine grid AND keyed by layer (x, z, y). Several
       walkable nodes can occupy the same x/z at different heights, so rooms can
       stack over rooms, catwalks over floors, etc.
     - Edges connect adjacent samples whose heights differ by no more than a
       step; staircases/ramps therefore become ordinary gentle edges, acting as
       inter-layer portals — no special-casing.
     - Pathing is a layered flow field: one Dijkstra (SPFA) sweep from the
       player's node fills every node's distance-to-player, and each zombie just
       descends the gradient. Built once per map and rebuilt when a door opens.

   The graph is generated purely from map geometry (surfaces + colliders), so
   any future map gets correct multi-floor pathing with zero map-specific code.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  var NR = 2.0;            // nav sample spacing (m) — finer than the 4m map grid
  // max height change a single edge may span. Sized so a staircase (sampled
  // every NR metres) stays connected as a gentle slope, while a full floor's
  // edge (whole-storey drop) does not — forcing routes through the stairs.
  var STEP = 1.1;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  var N = G.nav = {
    nodes: [], index: {}, res: NR, x0: 0, z0: 0, built: false, dirty: false
  };

  function key(gx, gz) { return gx + ',' + gz; }

  N.build = function () {
    var CFG = G.CFG, map = G.map, P = map.parsed;
    if (!P) return;
    N.nodes = []; N.index = {};
    var x0 = CFG.cellToWorld(0, 0).x - CFG.CELL / 2;
    var x1 = CFG.cellToWorld(P.cols - 1, 0).x + CFG.CELL / 2;
    var z0 = CFG.cellToWorld(0, 0).z - CFG.CELL / 2;
    var z1 = CFG.cellToWorld(0, P.rows - 1).z + CFG.CELL / 2;
    N.x0 = x0; N.z0 = z0;

    // ---- nodes: for every fine sample, one node per distinct walkable height
    for (var wx = x0 + NR / 2; wx <= x1; wx += NR) {
      for (var wz = z0 + NR / 2; wz <= z1; wz += NR) {
        var cr = CFG.worldToCell(wx, wz);
        var cell = map.cellAt(cr.col, cr.row);
        var groundOk = !!cell && (cell.type === 'room' || cell.type === 'door');
        var levels = map.surfaceLevelsAt(wx, wz);
        var heights = [];
        if (groundOk) heights.push(0);
        for (var li = 0; li < levels.length; li++) {
          var dup = false;
          for (var hj = 0; hj < heights.length; hj++) if (Math.abs(heights[hj] - levels[li]) < 0.06) dup = true;
          if (!dup) heights.push(levels[li]);
        }
        for (var hi = 0; hi < heights.length; hi++) {
          var hy = heights[hi];
          // there must be a real surface to stand on, and headroom for the body
          var supported = (hy === 0 && groundOk);
          for (var si = 0; si < levels.length && !supported; si++) if (Math.abs(levels[si] - hy) < 0.06) supported = true;
          if (!supported) continue;
          if (map.bodyBlocked(wx, wz, hy)) continue;
          var node = {
            id: N.nodes.length, x: wx, z: wz, y: hy,
            gx: Math.round((wx - x0) / NR), gz: Math.round((wz - z0) / NR),
            edges: [], dist: Infinity
          };
          N.nodes.push(node);
          var k = key(node.gx, node.gz);
          (N.index[k] = N.index[k] || []).push(node);
        }
      }
    }

    // ---- edges: link neighbouring samples within a step, not through a wall
    for (var ni = 0; ni < N.nodes.length; ni++) {
      var n = N.nodes[ni];
      for (var di = 0; di < DIRS.length; di++) {
        var cand = N.index[key(n.gx + DIRS[di][0], n.gz + DIRS[di][1])];
        if (!cand) continue;
        for (var ci = 0; ci < cand.length; ci++) {
          var m = cand[ci];
          if (Math.abs(m.y - n.y) > STEP) continue;
          var mx = (n.x + m.x) / 2, mz = (n.z + m.z) / 2, hy2 = Math.max(n.y, m.y);
          if (map.bodyBlocked(mx, mz, hy2)) continue;
          n.edges.push({ to: m, cost: Math.hypot(n.x - m.x, n.z - m.z) + Math.abs(n.y - m.y) * 1.6 });
        }
      }
    }
    N.built = true; N.dirty = false;
  };

  // nearest walkable node to a body at (x,z,y): closest sample cell, then the
  // layer whose height best matches the body's feet
  N.nearest = function (x, z, y) {
    if (!N.built) return null;
    var bgx = Math.round((x - N.x0) / NR), bgz = Math.round((z - N.z0) / NR);
    var best = null, bd = Infinity;
    // search a small fixed neighbourhood and take the GLOBAL closest (weighting
    // height heavily) — never stop at the first bucket, since grid-rounding can
    // place the true nearest node one bucket over (else a body on the ground
    // could snap to a stair/upper node beside it)
    for (var dx = -2; dx <= 2; dx++) {
      for (var dz = -2; dz <= 2; dz++) {
        var cand = N.index[key(bgx + dx, bgz + dz)];
        if (!cand) continue;
        for (var i = 0; i < cand.length; i++) {
          var m = cand[i];
          var d = (m.x - x) * (m.x - x) + (m.z - z) * (m.z - z) + (m.y - y) * (m.y - y) * 4;
          if (d < bd) { bd = d; best = m; }
        }
      }
    }
    return best;
  };

  // layered flow field: distance-to-target for every node (SPFA relaxation)
  N.computeField = function (target) {
    if (!N.built) return;
    var start = N.nearest(target.x, target.z, target.y || 0);
    for (var i = 0; i < N.nodes.length; i++) N.nodes[i].dist = Infinity;
    if (!start) return;
    start.dist = 0;
    var q = [start], head = 0, inq = {};
    inq[start.id] = true;
    while (head < q.length) {
      var u = q[head++]; inq[u.id] = false;
      for (var e = 0; e < u.edges.length; e++) {
        var v = u.edges[e].to, nd = u.dist + u.edges[e].cost;
        if (nd < v.dist) {
          v.dist = nd;
          if (!inq[v.id]) { inq[v.id] = true; q.push(v); }
        }
      }
    }
    N.field = true;
  };

  // a committed steering target for a body at (x,z,y): descend the distance
  // gradient several hops (~3m) and return that node. Looking ahead — rather
  // than to the single steepest neighbour — stops zombies sliding along
  // equal-distance contours and makes them commit to stairs/ramps.
  N.nextPoint = function (x, z, y) {
    var here = N.nearest(x, z, y);
    if (!here || here.dist === Infinity) return null;
    var cur = here, acc = 0, hops = 0;
    while (hops < 5 && acc < 3.0) {
      var best = null, bd = cur.dist;
      for (var e = 0; e < cur.edges.length; e++) {
        var v = cur.edges[e].to;
        if (v.dist < bd) { bd = v.dist; best = v; }
      }
      if (!best) break;
      acc += Math.hypot(best.x - cur.x, best.z - cur.z);
      cur = best; hops++;
    }
    return cur;     // === here only if already at the target
  };
})();
