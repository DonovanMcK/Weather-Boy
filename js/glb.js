/* ===========================================================================
   DER WETTERJUNGE — glb.js
   Minimal GLB (binary glTF) parser for the Blender-authored set pieces.
   Supports what our pipeline exports: non-skinned meshes, POSITION/NORMAL
   attributes, indexed geometry, node TRS, baseColorFactor + emissive.
   Models ship base64-embedded in js/models-data.js (G.MODELS) so loading
   works from file:// with zero fetches.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  function b64ToBuf(b64) {
    var bin = atob(b64), n = bin.length, u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  }

  var CTYPE = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  var NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

  function parseGLB(buf) {
    var dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not GLB');
    var len = dv.getUint32(8, true), off = 12, json = null, bin = null;
    while (off < len) {
      var clen = dv.getUint32(off, true), ctype = dv.getUint32(off + 4, true);
      var body = buf.slice(off + 8, off + 8 + clen);
      if (ctype === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(body));
      else if (ctype === 0x004E4942) bin = body;
      off += 8 + clen + (clen % 4 ? 4 - clen % 4 : 0);
    }
    return { json: json, bin: bin };
  }

  function accessor(g, idx) {
    var acc = g.json.accessors[idx];
    var bv = g.json.bufferViews[acc.bufferView];
    var T = CTYPE[acc.componentType], n = NCOMP[acc.type];
    var stride = bv.byteStride || 0, elemBytes = T.BYTES_PER_ELEMENT * n;
    var base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    if (!stride || stride === elemBytes)
      return new T(g.bin.slice(base, base + acc.count * elemBytes));
    var out = new T(acc.count * n);                     // strided copy
    var src = new DataView(g.bin);
    for (var i = 0; i < acc.count; i++)
      for (var c = 0; c < n; c++)
        out[i * n + c] = T === Float32Array
          ? src.getFloat32(base + i * stride + c * 4, true)
          : src['getUint' + (T.BYTES_PER_ELEMENT * 8)](base + i * stride + c * T.BYTES_PER_ELEMENT, true);
    return out;
  }

  function material(g, idx) {
    var m = (g.json.materials || [])[idx] || {};
    var pbr = m.pbrMetallicRoughness || {};
    var col = pbr.baseColorFactor || [0.8, 0.8, 0.8, 1];
    var c = new THREE.Color(col[0], col[1], col[2]);   // linear, as three expects
    var es = (m.extensions && m.extensions.KHR_materials_emissive_strength &&
              m.extensions.KHR_materials_emissive_strength.emissiveStrength) || 0;
    var ef = m.emissiveFactor || [0, 0, 0];
    if (es > 0.5 || ef[0] + ef[1] + ef[2] > 0.5)        // glowing part -> unlit
      return new THREE.MeshBasicMaterial({ color: c });
    var lm = new THREE.MeshLambertMaterial({ color: c });
    if (col[3] < 0.99) { lm.transparent = true; lm.opacity = col[3]; }
    return lm;
  }

  function build(g) {
    var mats = {};
    function matFor(i) { return mats[i] || (mats[i] = material(g, i)); }
    var root = new THREE.Group();
    var scene = g.json.scenes[g.json.scene || 0];

    function addNode(ni, parent) {
      var nd = g.json.nodes[ni], obj = new THREE.Group();
      if (nd.translation) obj.position.fromArray(nd.translation);
      if (nd.rotation) obj.quaternion.fromArray(nd.rotation);
      if (nd.scale) obj.scale.fromArray(nd.scale);
      if (nd.matrix) { var mm = new THREE.Matrix4().fromArray(nd.matrix); mm.decompose(obj.position, obj.quaternion, obj.scale); }
      if (nd.mesh !== undefined) {
        g.json.meshes[nd.mesh].primitives.forEach(function (pr) {
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(accessor(g, pr.attributes.POSITION), 3));
          if (pr.attributes.NORMAL !== undefined)
            geo.setAttribute('normal', new THREE.BufferAttribute(accessor(g, pr.attributes.NORMAL), 3));
          else geo.computeVertexNormals();
          if (pr.indices !== undefined) geo.setIndex(new THREE.BufferAttribute(accessor(g, pr.indices), 1));
          obj.add(new THREE.Mesh(geo, matFor(pr.material || 0)));
        });
      }
      (nd.children || []).forEach(function (ci) { addNode(ci, obj); });
      parent.add(obj);
    }
    scene.nodes.forEach(function (ni) { addNode(ni, root); });
    return root;
  }

  var cache = {};
  G.GLB = {
    // returns a THREE.Group clone of the named embedded model, or null
    get: function (name) {
      if (!window.G.MODELS || !G.MODELS[name]) return null;
      if (!cache[name]) cache[name] = build(parseGLB(b64ToBuf(G.MODELS[name])));
      return cache[name].clone();
    },
    // place into the scene: authored models are Z-up-authored/Y-up-exported,
    // ground at y=0; rotY spins, s scales uniformly
    place: function (name, x, y, z, rotY, s) {
      var m = G.GLB.get(name);
      if (!m) return null;
      m.rotation.y = rotY || 0;
      if (s) m.scale.setScalar(s);
      // auto-ground: whatever the authoring origin, the model's lowest point
      // lands exactly on y (no floaters, no buried bases)
      m.updateMatrixWorld(true);
      var bb = new THREE.Box3().setFromObject(m);
      m.position.set(x, y - bb.min.y, z);
      G.scene.add(m);
      return m;
    }
  };
})();
