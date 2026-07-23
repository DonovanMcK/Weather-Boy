#!/usr/bin/env node
/* ===========================================================================
   WONDER-WEAPON VISUAL QA

   Captures every wonder weapon in a deterministic first-person inspection bay:
     <weapon>-idle.png  — the complete viewmodel at rest
     <weapon>-fire.png  — the same view immediately after one shot
     manifest.json      — weapon identity, projectile type, model complexity,
                          live firing-effect counts, and any browser errors

   The list is discovered from CFG.WEAPONS. Ray Gun and Ray Gun Mark II are
   included because they are universal box wonders even though their config does
   not carry the map-specific `wonder` flag.

   Uses the project's existing Puppeteer/Chromium screenshot dependency.

   Run:
     node tools/shots-weapons.js
     node tools/shots-weapons.js --only thunder,wunderwaffe
     node tools/shots-weapons.js --map nacht --no-fire
     node tools/shots-weapons.js --out screenshots/wonder-weapons-review
   =========================================================================== */
'use strict';

var puppeteer = require('puppeteer');
var path = require('path');
var fs = require('fs');

var ROOT = path.resolve(__dirname, '..');
var URL = 'file://' + path.join(ROOT, 'index.html');
var W = 1440;
var H = 900;

function usage() {
  console.log([
    'Usage: node tools/shots-weapons.js [options]',
    '',
    'Options:',
    '  --map <id>           Map used for collision context (default: nacht)',
    '  --only <id,id,...>   Capture only the listed weapon ids',
    '  --out <directory>    Output directory, relative to the repo by default',
    '  --no-fire            Capture idle viewmodels only',
    '  --help               Show this message'
  ].join('\n'));
}

function parseArgs(argv) {
  var opts = {
    map: 'nacht',
    only: null,
    out: path.join(ROOT, 'screenshots', 'wonder-weapons'),
    fire: true
  };
  for (var i = 0; i < argv.length; i++) {
    var arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--map') {
      if (!argv[i + 1]) throw new Error('--map requires a value');
      opts.map = argv[++i];
    } else if (arg === '--only') {
      if (!argv[i + 1]) throw new Error('--only requires a comma-separated value');
      opts.only = argv[++i].split(',').map(function (id) { return id.trim(); }).filter(Boolean);
    } else if (arg === '--out') {
      if (!argv[i + 1]) throw new Error('--out requires a value');
      var out = argv[++i];
      opts.out = path.isAbsolute(out) ? out : path.join(ROOT, out);
    } else if (arg === '--no-fire') {
      opts.fire = false;
    } else {
      throw new Error('Unknown option: ' + arg);
    }
  }
  return opts;
}

function safeName(id) {
  return id.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
}

// This function is serialized into the browser. Keep all dependencies inside it.
function setupInspectionBay(weaponId) {
  var G = window.G;
  var THREE = window.THREE;
  var def = G.CFG.WEAPONS[weaponId];
  if (!def) throw new Error('Unknown weapon: ' + weaponId);

  // Stop the round and clear every actor before constructing the neutral bay.
  G.state = 'paused';
  G.weapons.mouseDown = false;
  G.weapons.semiLatch = false;
  G.weapons.fireCd = 0;
  G.weapons.switching = 0;
  G.zombies.mode = 'break';
  G.zombies.breakTimer = 999;
  G.zombies.toSpawn = 0;
  G.zombies.reset();

  // The map remains alive for collision/raycast context, but its rendered
  // geometry and lights are hidden so every gun gets the exact same backdrop.
  G.scene.children.slice().forEach(function (child) {
    if (child !== G.camera) child.visible = false;
  });
  G.scene.background = new THREE.Color(0x080c13);
  if (G.scene.fog) G.scene.fog.density = 0;

  // Position the camera at the spawn-room centre. Choose the compass direction
  // with the longest unobstructed firing lane so projectiles have room to read.
  var room = G.map.parsed && G.map.parsed.rooms && G.map.parsed.rooms.S;
  var base = room ? room.center : G.player.pos;
  var feetY = G.player.pos.y || 0;
  var eye = new THREE.Vector3(base.x, feetY + 1.62, base.z);
  var ray = new THREE.Raycaster();
  var best = { yaw: 0, reach: 0 };
  for (var i = 0; i < 16; i++) {
    var yaw = i * Math.PI / 8;
    var dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    ray.set(eye, dir);
    ray.far = 24;
    var hits = ray.intersectObjects(G.map.solidMeshes || [], false);
    var reach = hits.length ? hits[0].distance : 24;
    if (reach > best.reach) best = { yaw: yaw, reach: reach };
  }

  G.player.pos.set(base.x, feetY, base.z);
  G.player.yaw = best.yaw;
  // A tiny downward pitch crosses the centre of a zombie torso at test range
  // instead of the narrow gap between this game's chest and head hitboxes.
  G.player.pitch = -0.035;
  G.player.ads = 0;
  G.player.sprintAmt = 0;
  G.player.vmBobX = 0;
  G.player.vmBobY = 0;
  G.player.swayX = 0;
  G.player.swayY = 0;
  G.player.roll = 0;
  G.player.landDip = 0;
  G.camera.position.copy(eye);
  G.camera.rotation.order = 'YXZ';
  G.camera.rotation.set(-0.035, best.yaw, 0);
  G.camera.fov = 72;
  G.camera.updateProjectionMatrix();

  var forward = new THREE.Vector3(-Math.sin(best.yaw), 0, -Math.cos(best.yaw));
  var right = new THREE.Vector3(Math.cos(best.yaw), 0, -Math.sin(best.yaw));

  // Neutral first-person inspection bay. MeshBasic backdrop/floor give stable
  // exposure; dedicated fill lights make the Phong viewmodels readable.
  var studio = new THREE.Group();
  studio.userData.weaponInspectionBay = true;

  var wall = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 10),
    new THREE.MeshBasicMaterial({ color: 0x151e2b })
  );
  wall.position.copy(eye).addScaledVector(forward, 10);
  wall.lookAt(eye);
  studio.add(wall);

  var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: 0x080d15 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.copy(eye).addScaledVector(forward, 5);
  floor.position.y = feetY - 0.02;
  studio.add(floor);

  // Subtle rails supply scale and contrast without competing with weapon color.
  var railMat = new THREE.MeshBasicMaterial({ color: 0x26384c });
  [-3.2, 3.2].forEach(function (offset) {
    var rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 4.8, 0.08), railMat);
    rail.position.copy(eye).addScaledVector(forward, 9.9).addScaledVector(right, offset);
    rail.position.y = feetY + 2.25;
    rail.rotation.y = best.yaw;
    studio.add(rail);
  });
  [-1.5, 0.2, 1.9].forEach(function (height) {
    var strip = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.025, 0.08), railMat);
    strip.position.copy(eye).addScaledVector(forward, 9.88);
    strip.position.y = eye.y + height;
    strip.rotation.y = best.yaw;
    studio.add(strip);
  });

  var grid = new THREE.GridHelper(18, 18, 0x34506b, 0x172536);
  grid.position.copy(floor.position);
  grid.position.y += 0.01;
  grid.rotation.y = best.yaw;
  studio.add(grid);

  var ambient = new THREE.AmbientLight(0xc9d7f2, 1.15);
  var key = new THREE.DirectionalLight(0xeaf2ff, 1.1);
  key.position.copy(eye).addScaledVector(right, -3).add(new THREE.Vector3(0, 4, 0));
  key.target.position.copy(eye).addScaledVector(forward, 4);
  studio.add(ambient);
  studio.add(key);
  studio.add(key.target);
  G.scene.add(studio);

  // Re-enable the fixed light pool used by weapon flashes. It was hidden with
  // the map, and keeping it visible lets firing frames exercise the real path.
  if (G.weapons.flashLight) G.weapons.flashLight.visible = true;
  (G.weapons.boomLights || []).forEach(function (light) { light.visible = true; });

  // Hide all HTML overlays; only the WebGL canvas belongs in QA stills.
  Array.prototype.forEach.call(document.body.children, function (el) {
    if (el.id !== 'game') el.style.display = 'none';
  });

  G.weapons.giveWeapon(weaponId);
  var gun = G.weapons.current();
  gun.ammo = Math.max(gun.ammo, 8);
  G.weapons.switching = 0;
  G.time = 12.375; // deterministic rotor/glow pose
  G.weapons.update(1 / 60);
  G.renderer.render(G.scene, G.camera);

  var meshes = 0;
  var triangles = 0;
  var emissive = 0;
  gun.model.traverse(function (obj) {
    if (!obj.isMesh) return;
    meshes++;
    var geo = obj.geometry;
    if (geo) {
      if (geo.index) triangles += geo.index.count / 3;
      else if (geo.attributes && geo.attributes.position) triangles += geo.attributes.position.count / 3;
    }
    var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(function (mat) {
      if (mat && mat.emissive && mat.emissive.getHex() !== 0) emissive++;
    });
  });

  window.__wwShot = {
    weaponId: weaponId,
    yaw: best.yaw,
    reach: best.reach,
    forward: forward,
    eye: eye,
    studio: studio
  };
  return {
    id: weaponId,
    name: def.name,
    projectile: def.projectile || 'hitscan',
    fxColor: '#' + new THREE.Color(def.fxColor || 0xffcc77).getHexString(),
    meshes: meshes,
    triangles: Math.round(triangles),
    emissiveMeshes: emissive,
    visualId: gun.model.userData.visualId || null,
    clearLane: +best.reach.toFixed(2)
  };
}

// Also serialized into the browser.
function stageFiringFrame() {
  var G = window.G;
  var THREE = window.THREE;
  var shot = window.__wwShot;
  if (!shot) throw new Error('Inspection bay was not initialized');

  // Three invisible high-health targets exercise chains, tethers and impact
  // effects without putting zombie geometry in front of the weapon.
  var maxTarget = Math.max(3.4, Math.min(8.2, shot.reach - 1.0));
  var targets = [];
  [0.48, 0.7, 0.9].forEach(function (fraction, index) {
    var dist = Math.max(2.8, maxTarget * fraction);
    var lateral = index === 1 ? 0.6 : (index === 2 ? -0.7 : 0);
    var pos = shot.eye.clone().addScaledVector(shot.forward, dist);
    var right = new THREE.Vector3(shot.forward.z, 0, -shot.forward.x);
    pos.addScaledVector(right, lateral);
    pos.y = G.player.pos.y || 0;
    var zombie = G.zombies.spawnAt(pos);
    zombie.speed = 0;
    zombie.hp = zombie.hpMax = 1e9;
    targets.push(zombie);
  });
  // Raycasters consume matrixWorld directly; freshly inserted targets have not
  // passed through a renderer tick yet, so publish their transforms now.
  G.scene.updateMatrixWorld(true);

  var gun = G.weapons.current();
  var ammoBefore = gun.ammo;
  G.state = 'playing';
  G.player.locked = false;
  G.player.downed = false;
  G.player.sprintAmt = 0;
  G.weapons.reloading = 0;
  G.weapons.switching = 0;
  G.weapons.knifing = 0;
  G.weapons.fireCd = 0;
  G.weapons.semiLatch = false;
  G.weapons.mouseDown = true;
  G.weapons.update(1 / 120);
  G.weapons.mouseDown = false;

  // Burst weapons queue their first projectile on the trigger tick; process one
  // additional live tick so the firing still always contains an actual round.
  if (gun.ammo === ammoBefore && G.weapons.burstQueue > 0) {
    G.weapons.update(1 / 120);
  }
  // Targets must be visible during raycasting, then disappear before the render
  // so tethers/chains remain readable without zombie silhouettes in the still.
  targets.forEach(function (zombie) { zombie.mesh.visible = false; });
  G.state = 'paused';

  // Advance just far enough to separate physical projectiles from the muzzle
  // while preserving short-lived arcs, beams, shock rings and muzzle light.
  for (var i = 0; i < 3; i++) {
    G.time += 1 / 120;
    G.weapons.update(1 / 120);
  }
  G.renderer.render(G.scene, G.camera);

  var result = {
    ammoConsumed: ammoBefore - gun.ammo,
    projectiles: G.weapons.projectiles.length,
    tracers: G.weapons.tracers.length,
    weaponFx: G.weapons.weaponFx.length,
    vortices: G.weapons.vortices.length,
    hazards: G.weapons.eeHazards.length,
    rods: G.weapons.rods.length,
    iceSlides: G.weapons.iceSlides.length,
    imprints: G.weapons.imprints.length
  };
  result.visibleEffects = result.projectiles + result.tracers + result.weaponFx +
    result.vortices + result.hazards + result.rods + result.iceSlides + result.imprints;
  return result;
}

async function startMap(page, mapId) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction('window.G && G.CFG && G.startGame && G.weapons && G.zombies');
  var exists = await page.evaluate(function (id) {
    return G.CFG.MAP_IDS.indexOf(id) >= 0;
  }, mapId);
  if (!exists) throw new Error('Unknown map "' + mapId + '"');
  await page.evaluate(function (id) { G.startGame(id); }, mapId);
  await page.waitForFunction('G.state === "playing" || G.state === "paused"');
}

async function discoverWeapons(page, only) {
  var ids = await page.evaluate(function () {
    return Object.keys(G.CFG.WEAPONS).filter(function (id) {
      return G.CFG.WEAPONS[id].wonder || id === 'raygun' || id === 'raygun2';
    });
  });
  if (!only) return ids;
  var missing = only.filter(function (id) { return ids.indexOf(id) < 0; });
  if (missing.length) throw new Error('Not configured as wonder weapons: ' + missing.join(', '));
  return ids.filter(function (id) { return only.indexOf(id) >= 0; });
}

(async function main() {
  var opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exit(2);
  }

  fs.mkdirSync(opts.out, { recursive: true });
  var browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--window-size=' + W + ',' + H
    ]
  });

  var manifest = {
    generatedAt: new Date().toISOString(),
    map: opts.map,
    viewport: { width: W, height: H },
    firingFrames: opts.fire,
    weapons: [],
    failures: []
  };

  try {
    var page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await startMap(page, opts.map);
    var ids = await discoverWeapons(page, opts.only);
    console.log('Wonder weapons discovered (' + ids.length + '): ' + ids.join(', '));

    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var pageErrors = [];
      page.removeAllListeners('pageerror');
      page.on('pageerror', function (err) { pageErrors.push(err.message); });
      try {
        // A fresh page per gun guarantees that persistent fields/projectiles from
        // one firing frame cannot contaminate the next weapon's still.
        await startMap(page, opts.map);
        var info = await page.evaluate(setupInspectionBay, id);
        var canvas = await page.$('#game');
        var stem = safeName(id);
        var idlePath = path.join(opts.out, stem + '-idle.png');
        await canvas.screenshot({ path: idlePath });
        info.idle = path.relative(ROOT, idlePath);

        if (opts.fire) {
          info.firing = await page.evaluate(stageFiringFrame);
          var firePath = path.join(opts.out, stem + '-fire.png');
          await canvas.screenshot({ path: firePath });
          info.fire = path.relative(ROOT, firePath);
          if (info.firing.ammoConsumed < 1 || info.firing.visibleEffects < 1) {
            manifest.failures.push({
              id: id,
              error: 'Firing contract failed (ammo=' + info.firing.ammoConsumed +
                ', visibleEffects=' + info.firing.visibleEffects + ')'
            });
          }
        }
        info.pageErrors = pageErrors.slice();
        manifest.weapons.push(info);
        console.log('  wrote ' + info.idle + (info.fire ? ' + ' + info.fire : ''));
        if (pageErrors.length) {
          manifest.failures.push({ id: id, error: pageErrors.join(' | ') });
          console.error('    page error: ' + pageErrors.join(' | '));
        }
      } catch (err) {
        manifest.failures.push({ id: id, error: err.stack || err.message });
        console.error('  FAILED ' + id + ': ' + err.message);
      }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(opts.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }

  console.log('\nManifest: ' + path.relative(ROOT, path.join(opts.out, 'manifest.json')));
  if (manifest.failures.length) {
    console.error('Visual capture completed with ' + manifest.failures.length + ' failure(s).');
    process.exitCode = 1;
  } else {
    console.log('Visual capture complete: ' + manifest.weapons.length + ' weapons, zero browser errors.');
  }
})().catch(function (err) {
  console.error(err.stack || err.message);
  process.exit(1);
});
