/* Throwaway split-level proof: Region A @ Y=0, Region B @ Y=+4, ramp between.
   Verifies the floorY foundation (B4/B2/B5) on real pixels. Injects a test map
   at runtime (never touches the shipped map list), builds a ramp, and runs the
   six checks, screenshotting each to screenshots/_2region/. */
'use strict';
var puppeteer = require('puppeteer');
var path = require('path');
var fs = require('fs');
var ROOT = path.resolve(__dirname, '..');
var OUT = path.join(ROOT, 'screenshots', '_2region');
var URL = 'file://' + path.join(ROOT, 'index.html');

// the test map, registered into CFG.MAPS at runtime (not in MAP_IDS)
var TESTMAP = {
  id: '_t2', name: 'SPLIT-LEVEL TEST', sub: 'A@0 / B@+4', wonder: 'thunder', papRule: 'power',
  atmos: { sky: 0x12131a, fog: 0x12131a, density: 0, amb: 0x55607a, ambI: 0.6, hemiSky: 0x9aa6c0, hemiGround: 0x33302a },
  palette: { wallA: 0xb0a890, wallB: 0xa09880, wood: 0xc6ad84, plank: 0xd8c098, metal: 0x8e949c,
             beam: 0x55585e, rust: 0x86603c, conc: 0x8a857c, deck: 0x6b6f78, ceil: 0x6c727d, accent: 0x5fcfe6, lampTint: 0xeae6dc },
  OUTDOOR: [],
  GRID: [
    '.BBBBB.',   // row0  Region B (floorY +4)  — warm-cool distinct
    '.BBBBB.',   // row1
    '.BBBBB.',   // row2
    '..111..',   // row3  door 1 (ramp zone)
    '..111..',   // row4  door 1 (ramp zone)
    '.AAAAA.',   // row5  Region A (floorY 0, spawn)
    '.AAAAA.',   // row6
    '.AAAAA.',   // row7
    '.AAAAA.'    // row8
  ],
  ROOMS: {
    A: { name: 'Region A', floor: 0x6a4a30, light: 0xd8a060, floorY: 0 },
    B: { name: 'Region B', floor: 0x30506a, light: 0x70b0e0, floorY: 4 }
  },
  DOORS: { 1: { cost: 0, name: 'Ramp' } },
  WINDOWS: [{ cell: [3, 8], dir: 'S' }, { cell: [3, 0], dir: 'N' }], RISERS: [], PERK_MACHINES: [], WALLBUYS: [],
  BOX_SPOTS: [{ cell: [3, 6], off: [0, 0] }], TELEPORTERS: [],
  MAINFRAME: null, PAP: { cell: [3, 1], off: [0, 0] }, POWER: { cell: [3, 6], off: [0, 0] },
  PLAYER_SPAWN: { cell: [3, 7], off: [0, 0] }, RELIC_SPOTS: [], EE_SOULBOX: null,
  SHIELD_PARTS: {}, SHIELD_BENCH: null
};

function setupSrc() {
  // runs in-page: register the map, start it, open doors, replace the ramp-zone
  // flat floors with a real ramp, rebuild nav. Returns key coordinates.
  window.__setup = function (tm) {
    var G = window.G, CFG = G.CFG;
    CFG.MAPS._t2 = tm;
    G.startGame('_t2');
    G.state = 'paused';
    if (G.weapons && G.weapons.vmRoot) G.weapons.vmRoot.visible = false;
    Object.keys(G.map.doors).forEach(function (id) {
      G.map.openDoor(id); var d = G.map.doors[id];
      if (d.mesh) d.mesh.visible = false; if (d.sprite) { G.scene.remove(d.sprite); d.sprite = null; }
    });
    // ramp zone in world coords: door cols 2..4 (x -6..6), rows 3..4 (z -6..2),
    // rising from A (south, z=2, y=0) up to B (north, z=-6, y=4)
    var rx1 = -6, rx2 = 6, rzN = -6, rzS = 2;
    // drop the flat door-floor surfaces + meshes in the ramp zone so only the
    // ramp gives support there (no phantom flat step mid-ramp)
    G.map.surfaces = G.map.surfaces.filter(function (s) {
      return !(s.floor && s.x1 >= rx1 - 0.1 && s.x2 <= rx2 + 0.1 && s.z1 >= rzN - 0.1 && s.z2 <= rzS + 0.1);
    });
    G.scene.traverse(function (o) {
      if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && o.rotation.x < -1 &&
          o.position.x > rx1 - 0.1 && o.position.x < rx2 + 0.1 && o.position.z > rzN - 0.1 && o.position.z < rzS + 0.1 && o.position.y < 4.1) o.visible = false;
    });
    // the ramp surface + visible treads + under-ramp solid fill
    G.map.addSurface({ x1: rx1, x2: rx2, z1: rzN, z2: rzS, ramp: true, axis: 'z', c1: rzN, c2: rzS, h1: 4, h2: 0 });
    var THREE = window.THREE, deckMat = new THREE.MeshLambertMaterial({ color: 0x6b6f78 });
    var steps = 8, run = (rzS - rzN) / steps;
    for (var i = 0; i < steps; i++) {
      var zA = rzN + i * run, zNn = rzN + (i + 1) * run;
      var hMid = 4 * (1 - (i + 0.5) / steps);           // ramp height at this step
      var tread = new THREE.Mesh(new THREE.BoxGeometry(rx2 - rx1, 0.14, run + 0.05), deckMat);
      tread.position.set((rx1 + rx2) / 2, hMid + 0.07, (zA + zNn) / 2); G.scene.add(tread);
      // fill capped at the step's LOWEST (south) ramp height so it never pokes
      // above the walking surface and blocks the climb
      var fillH = 4 * (1 - (i + 1) / steps);
      if (fillH > 0.05) G.map.addCollider(rx1, zA, rx2, zNn, 0, fillH);   // solid under-fill
    }
    // open the vertical shaft over the connection: drop ceiling tiles + colliders
    // in the ramp band so the two floors share a clear sightline (atrium-style)
    G.map.colliders.forEach(function (c) {
      if (c.y1 > 3.5 && c.y1 < 4.5 && (c.x1 + c.x2) / 2 > rx1 - 0.1 && (c.x1 + c.x2) / 2 < rx2 + 0.1 && (c.z1 + c.z2) / 2 > rzN - 2.1 && (c.z1 + c.z2) / 2 < rzS + 2.1) c.on = false;
    });
    G.scene.traverse(function (o) {
      // clear overhead geometry (ceiling tiles + the doorway lintel beam) over the
      // shaft so the two floors share an open vertical sightline; keep it to the
      // narrow ramp column so it doesn't touch either floor's own ceiling edges
      if (o.isMesh && o.position.y > 3.4 && o.position.y < 4.7 &&
          o.position.x > rx1 - 0.1 && o.position.x < rx2 + 0.1 && o.position.z > rzN - 1.1 && o.position.z < rzS + 1.1) o.visible = false;
    });
    if (G.nav) G.nav.build();
    return {
      aFloor: [0, 12], bFloor: [-12, 4], rampMidZ: -2,
      spawnA: { x: G.player.pos.x, y: G.player.pos.y, z: G.player.pos.z }
    };
  };
}

function shot() {
  window.__cam = function (px, py, pz, lx, ly, lz, fov) {
    var G = window.G;
    G.camera.position.set(px, py, pz); G.camera.fov = fov || 75; G.camera.updateProjectionMatrix();
    G.camera.lookAt(lx, ly, lz);
    Array.prototype.forEach.call(document.body.children, function (el) { if (el.id !== 'game') el.style.display = 'none'; });
    G.renderer.render(G.scene, G.camera);
  };
}

(async function () {
  fs.mkdirSync(OUT, { recursive: true });
  var browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  var page = await browser.newPage();
  await page.setViewport({ width: 720, height: 460 });
  page.on('pageerror', function (e) { console.log('  [page error] ' + e.message); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction('window.G && G.startGame');
  await page.evaluate(setupSrc); await page.evaluate(shot);
  var coords = await page.evaluate('window.__setup(' + JSON.stringify(TESTMAP) + ')');
  console.log('setup done. spawn A:', JSON.stringify(coords.spawnA));
  var canvas = await page.$('#game');
  async function snap(name) { await new Promise(function (r) { setTimeout(r, 60); }); await canvas.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  wrote ' + name + '.png'); }

  // ---- the six checks (logic results printed, each screenshotted) ----
  var results = await page.evaluate(function () {
    var G = window.G, P = G.player, THREE = window.THREE, out = {};
    G.state = 'playing';   // physics + AI only run when playing

    // 1+2 COLLISION/GRAVITY: drop the player above A (y0) and above B (y4)
    P.pos.set(0, 6, 10); P.vel.set(0, 0, 0);            // above region A
    for (var i = 0; i < 150; i++) G.player.update(0.016);
    out.groundA = +P.pos.y.toFixed(3);
    P.pos.set(0, 10, -12); P.vel.set(0, 0, 0);          // above region B (+4)
    for (var j = 0; j < 200; j++) G.player.update(0.016);
    out.groundB = +P.pos.y.toFixed(3);
    out.supA = +G.map.supportAt(0, 10, 0.2, 0.55).toFixed(2);   // ground under A
    out.supB = +G.map.supportAt(0, -12, 4.2, 0.55).toFixed(2);  // ground under B

    // 1b WALK UP THE RAMP: from A foot, drive forward (north) up the ramp to B
    P.pos.set(0, 0, 4); P.vel.set(0, 0, 0); P.yaw = 0;  // face -z (north / up the ramp)
    G.keys.KeyW = true;
    var rampMax = 0;
    for (var w = 0; w < 60 * 16; w++) { G.player.update(0.016); if (P.pos.y > rampMax) rampMax = P.pos.y; }
    G.keys.KeyW = false;
    out.walkedTo = +rampMax.toFixed(2); out.endPos = [+P.pos.x.toFixed(1), +P.pos.y.toFixed(1), +P.pos.z.toFixed(1)];

    // 5 ZOMBIE PATH up the ramp to a player on B, watching for a phantom-0 detour
    var Z = G.zombies; Z.mode = 'break'; Z.breakTimer = 999; Z.toSpawn = 0;
    Z.list.slice().forEach(function (z) { if (!z.dead) Z.damageZombie(z, 1e9, { boom: true }); });
    P.pos.set(0, 4, -11);                                // player up on B
    var zb = Z.spawnAt(new THREE.Vector3(0, 0, 12)); zb.speed = 2.8;
    var maxY = 0, phantom = false;
    for (var f = 0; f < 60 * 22; f++) {
      G.zombies.update(0.016);
      if (zb.mesh.position.y > maxY) maxY = zb.mesh.position.y;
      if (zb.mesh.position.z < -6 && zb.mesh.position.y < 1.5) phantom = true;   // in B's footprint but at ground
    }
    out.zReachedB = +maxY.toFixed(2); out.zPhantom = phantom;
    out.zFinal = [+zb.mesh.position.x.toFixed(1), +zb.mesh.position.y.toFixed(1), +zb.mesh.position.z.toFixed(1)];

    // 4 HITSCAN both ways through the OPEN air above the ramp (atrium-style line)
    var ray = new THREE.Raycaster();
    var solids = []; G.scene.traverse(function (o) { if (o.isMesh && o.visible && o.geometry) solids.push(o); });
    function shoot(from, to) {
      var dir = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z); var dist = dir.length(); dir.normalize();
      ray.set(new THREE.Vector3(from.x, from.y, from.z), dir); ray.far = dist - 0.4;
      var hits = ray.intersectObjects(solids, false);
      return { clear: hits.length === 0, blockedAt: hits.length ? [+hits[0].point.x.toFixed(1), +hits[0].point.y.toFixed(1), +hits[0].point.z.toFixed(1)] : null };
    }
    // cross-floor hitscan both ways through the open shaft, aimed from near the
    // ramp (minimal clutter between eye and target): a clear line from A up to a
    // point on B and from B down to a point on A proves a 3D ray resolves across Y
    // aim along the open ramp corridor (the door/ramp cells carry no room
    // dressing): A foot just above the ramp up to a B-floor point, and back
    out.shotAtoB = shoot({ x: 0, y: 0.9, z: 1.6 }, { x: 0, y: 4.9, z: -7 });
    out.shotBtoA = shoot({ x: 0, y: 4.9, z: -7 }, { x: 0, y: 0.9, z: 1.6 });


    G.state = 'paused';
    return out;
  });
  console.log('CHECK RESULTS:', JSON.stringify(results, null, 0));

  // screenshots of each scenario
  await page.evaluate('window.__cam(0, 9, 22, 0, 1, 0, 70)');   await snap('1-collision-overview');
  await page.evaluate('window.__cam(0, 1.6, 14, 0, 3, -12, 80)'); await snap('2-gravity-ramp-up');     // eye-level on A looking up the ramp to B
  await page.evaluate('window.__cam(0, 5.6, -11, 0, 0.5, 10, 85)'); await snap('3-pitch-look-down');   // on B looking DOWN into A
  await page.evaluate('window.__cam(0, 1.6, 13, 0, 5, -12, 80)'); await snap('3b-pitch-look-up');      // on A looking UP at B
  await page.evaluate('window.__cam(7, 5, 0, 0, 2, 0, 75)');     await snap('6-zfight-seam');          // side-on at the A/B/ramp seam
  await browser.close();
  console.log('\nDone. screenshots in screenshots/_2region/');
})().catch(function (e) { console.log('FATAL', e.message); process.exit(2); });
