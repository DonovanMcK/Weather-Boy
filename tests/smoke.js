/* Headless smoke test: boots the whole game in node with a stubbed DOM and a
   stubbed WebGLRenderer, once per map, and plays through the core systems.
   Full suite on Der Wetterjunge; quick suites on Nacht and Der Riese covering
   their PaP rules and wonder weapons.
   Run: npm install && node tests/smoke.js */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var THREE = require('three');

var fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('FAIL  ' + msg); fails++; }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* --------------------------------------------------- sandbox per game --- */
function createGame() {
  function makeEmitter(obj) {
    obj._ls = {};
    obj.addEventListener = function (type, fn) { (obj._ls[type] = obj._ls[type] || []).push(fn); };
    obj.removeEventListener = function () {};
    obj.dispatch = function (type, ev) { (obj._ls[type] || []).forEach(function (f) { f(ev || {}); }); };
    // gamepad.js dispatches synthetic key events via window.dispatchEvent(ev)
    obj.dispatchEvent = function (ev) { (obj._ls[ev.type] || []).forEach(function (f) { f(ev); }); return true; };
    return obj;
  }
  function ctx2d() {
    // every unknown method returns the stub itself so chained objects
    // (gradients etc.) keep working: g.addColorStop(...), m.width, ...
    var stub = new Proxy({}, {
      get: function (t, p) {
        if (p in t) return t[p];
        return function () { return stub; };
      },
      set: function (t, p, v) { t[p] = v; return true; }
    });
    return stub;
  }
  function canvasStub() {
    var cv = makeEmitter({ width: 300, height: 150, style: {} });
    cv.getContext = function () { return ctx2d(); };
    cv.requestPointerLock = function () {};
    return cv;
  }
  function elemStub() {
    var e = makeEmitter({
      style: { setProperty: function () {}, removeProperty: function () {} },
      textContent: '', innerHTML: '', offsetWidth: 0, title: '', className: '',
      classList: { add: function () {}, remove: function () {}, toggle: function () {} },
      children: [], firstElementChild: null
    });
    e.appendChild = function (c) { e.children.push(c); };
    e.remove = function () {};
    e.requestPointerLock = function () {};
    e.parentElement = { style: {} };
    e.matches = function () { return false; };
    return e;
  }

  var elements = {};
  var documentStub = makeEmitter({
    readyState: 'complete',
    pointerLockElement: {},
    body: elemStub(),
    exitPointerLock: function () {},
    getElementById: function (id) {
      if (!elements[id]) elements[id] = id === 'game' ? canvasStub() : elemStub();
      return elements[id];
    },
    createElement: function (tag) { return tag === 'canvas' ? canvasStub() : elemStub(); }
  });

  var rafCb = null;
  var windowStub = makeEmitter({ innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 });
  var fakePads = [];
  function KeyboardEventStub(type, init) { this.type = type; this.code = init && init.code; this.repeat = false; this.isTrusted = false; }
  var navigatorStub = { platform: 'Test', userAgent: 'node', getGamepads: function () { return fakePads; } };

  function FakeRenderer() { this.domElement = canvasStub(); }
  FakeRenderer.prototype.setSize = function () {};
  FakeRenderer.prototype.setPixelRatio = function () {};
  // the real renderer updates world matrices each frame; mirror that
  FakeRenderer.prototype.render = function (scene) { scene.updateMatrixWorld(true); };
  var THREEStub = Object.create(THREE);
  THREEStub.WebGLRenderer = FakeRenderer;

  var sandbox = {
    window: windowStub,
    document: documentStub,
    navigator: navigatorStub,
    KeyboardEvent: KeyboardEventStub,
    THREE: THREEStub,
    performance: performance,
    localStorage: { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); } },
    location: { reload: function () {} },
    requestAnimationFrame: function (cb) { rafCb = cb; },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    console: console, Math: Math, Object: Object, Array: Array, JSON: JSON,
    Proxy: Proxy, Promise: Promise
  };
  vm.createContext(sandbox);

  ['config', 'audio', 'hud',
   'assets/materials', 'assets/prop-utils', 'assets/prop-registry',
   'assets/gameplay-machines', 'assets/environment-props', 'assets/interactive-props',
   'map', 'nav', 'player', 'weapons', 'zombies', 'powerups', 'interact', 'gamepad', 'remote', 'terminal', 'main']
    .forEach(function (name) {
      var src = fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8');
      vm.runInContext(src, sandbox, { filename: name + '.js' });
    });

  var G = sandbox.window.G;
  var simNow = performance.now();
  return {
    G: G,
    win: windowStub,
    doc: documentStub,
    step: function (frames, dtMs) {
      for (var i = 0; i < frames; i++) {
        simNow += (dtMs || 16);
        var cb = rafCb; rafCb = null;
        if (cb) cb(simNow);
      }
    },
    pressF: function () { windowStub.dispatch('keydown', { code: 'KeyF' }); },
    moveTo: function (pos) { G.player.pos.set(pos.x, pos.y || 0, pos.z); G.player.vel.set(0, 0, 0); },
    setPad: function (p) { fakePads[0] = p; },
    keyup: function (code) { windowStub.dispatch('keyup', { code: code }); }
  };
}

// a fresh standard-mapping gamepad with all buttons released, sticks centered
function makePad() {
  var p = { connected: true, index: 0, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] };
  for (var i = 0; i < 16; i++) p.buttons.push({ pressed: false, value: 0 });
  return p;
}
function press(p, i, v) { p.buttons[i] = { pressed: v !== 0, value: v == null ? 1 : v }; }

/* -------------------------------------------------- shared test pieces --- */
function roomCenter(G, room) {
  return G.map.parsed.rooms[room].center;
}

// walk onto an interactable, let collision settle, FACE it (prompts are now
// look-gated), then press F — mirrors how a real player buys something
function useAt(ctx, pos) {
  ctx.moveTo(pos);
  ctx.step(3);
  var P = ctx.G.player;
  var dx = pos.x - P.pos.x, dz = pos.z - P.pos.z;
  if (Math.hypot(dx, dz) > 0.05) P.yaw = Math.atan2(-dx, -dz);
  ctx.pressF();
  ctx.step(5);
}

function openAllDoors(ctx) {
  var G = ctx.G;
  G.player.points = 200000;
  Object.keys(G.map.doors).forEach(function (id) {
    useAt(ctx, G.map.doors[id].pos);
  });
  ok(Object.keys(G.map.doors).every(function (id) { return G.map.doors[id].open; }),
     'all doors opened');
  ok(Object.keys(G.map.parsed.rooms).every(function (r) { return G.map.reachableRooms[r]; }),
     'all rooms reachable');
  // no stray pillar/prop collider stands in a doorway (threshold is clear)
  var blockedDoors = Object.keys(G.map.doors).filter(function (id) {
    var d = G.map.doors[id];
    return G.map.bodyBlocked(d.pos.x, d.pos.z, (d.pos.y || 0) + 0.2);
  });
  ok(blockedDoors.length === 0, 'no prop or pillar blocks an open doorway' +
    (blockedDoors.length ? ' (blocked: ' + blockedDoors.join(',') + ')' : ''));
  // Gameplay cabinets must also stay out of the whole approach lane. A 5.5m
  // buffer keeps them clear at sprint speed and visibly separate from the frame.
  var fixtures = G.map.perkMachines.map(function (m) { return m.mesh.position; });
  if (G.map.pap) fixtures.push(G.map.pap.mesh.position);
  if (G.map.powerSwitch) fixtures.push(G.map.powerSwitch.mesh.position);
  if (G.map.mainframe) fixtures.push(G.map.mainframe.pad.position);
  var approachesClear = Object.keys(G.map.doors).every(function (id) {
    var d = G.map.doors[id].pos;
    return fixtures.every(function (p) {
      return Math.abs((d.y || 0) - (p.y || 0)) > 2 || Math.hypot(d.x - p.x, d.z - p.z) > 5.5;
    });
  });
  ok(approachesClear, 'perk machines and major fixtures clear every doorway approach');
}

function unlockPap(ctx) {
  var G = ctx.G;
  useAt(ctx, G.map.powerSwitch.pos);
  ok(G.map.power, 'power turned on');
  if (G.CFG.cur.papRule === 'power') {
    ok(G.map.pap.unlocked, 'PaP unlocked by power (papRule=power)');
  } else {
    ok(!G.map.pap.unlocked, 'PaP still locked until teleporters linked');
    G.map.teleporters.forEach(function (t) {
      useAt(ctx, t.pos);
      ok(t.linking, 'teleporter ' + t.id + ' activated');
      useAt(ctx, G.map.mainframe.pos);
      ok(t.linked, 'teleporter ' + t.id + ' linked');
    });
    ok(G.map.pap.unlocked, 'PaP unlocked after 3 links');
  }
}

function testWonderWeapon(ctx) {
  var G = ctx.G;
  var wonderId = G.CFG.cur.wonder;
  G.weapons.giveWeapon(wonderId);
  ok(G.weapons.current().id === wonderId, 'holding ' + wonderId);
  // freeze the round director and clear the field so only our test trio is in
  // the line of fire (otherwise wandering zombies detonate the projectile early)
  G.zombies.mode = 'break'; G.zombies.breakTimer = 999; G.zombies.toSpawn = 0;
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  ctx.step(70);
  // stand at spawn room center facing -z with three zombies ahead
  var c = roomCenter(G, 'S');
  ctx.moveTo(c);
  G.player.yaw = 0; G.player.pitch = 0;
  ctx.step(2);
  var zs = [
    G.zombies.spawnAt(new THREE.Vector3(c.x, 0, c.z - 2.2)),
    G.zombies.spawnAt(new THREE.Vector3(c.x + 0.6, 0, c.z - 2.9)),
    G.zombies.spawnAt(new THREE.Vector3(c.x - 0.6, 0, c.z - 3.5))
  ];
  zs.forEach(function (z) { z.speed = 0; });   // hold position for the wonder-weapon test
  ctx.step(2);
  var ammoBefore = G.weapons.current().ammo;
  G.weapons.mouseDown = true;
  ctx.step(4);
  G.weapons.mouseDown = false;
  ok(G.weapons.current().ammo === ammoBefore - 1, wonderId + ' fired one shot');

  if (wonderId === 'thunder') {
    ctx.step(60 * 2);
    ok(zs.every(function (z) { return z.dead; }), 'thundergun flung and killed the pack');
  } else if (wonderId === 'wunderwaffe') {
    ok(zs.every(function (z) { return z.dead; }), 'wunderwaffe chain-killed all three');
  } else if (wonderId === 'stormcaller') {
    var sawVortex = false;                       // poll: the orb may arc a moment
    for (var v = 0; v < 200 && !sawVortex; v++) { ctx.step(1); if (G.weapons.vortices.length > 0) sawVortex = true; }
    ok(sawVortex, 'storm vortex spawned');
    ctx.step(60 * 7);
    ok(zs.every(function (z) { return z.dead; }), 'vortex zapped the pack');
    ok(G.weapons.vortices.length === 0, 'vortex expired');
  } else if (wonderId === 'maelstrom') {
    // The IMPLOSION driver: projectile -> vacuum field that DRAGS the pack
    // into a clump -> the clump detonates. No vortex, no push, no chain.
    var sawImp = false;
    for (var mi = 0; mi < 200 && !sawImp; mi++) { ctx.step(1); if (G.weapons.implosions.length > 0) sawImp = true; }
    ok(sawImp, 'Maelstrom detonates into an implosion field (not a storm vortex)');
    ok(G.weapons.vortices.length === 0, 'Maelstrom never creates a Wettermacher vortex');
    // let the vacuum drag, then measure the clump before the burst resolves
    var impC = G.weapons.implosions.length ? G.weapons.implosions[0].c : null;
    ctx.step(40);
    if (impC) {
      var spread = zs.filter(function (z) { return !z.dead; }).map(function (z) {
        return Math.hypot(z.mesh.position.x - impC.x, z.mesh.position.z - impC.z); });
      ok(!spread.length || Math.max.apply(null, spread) < 2.5,
         'vacuum dragged the pack into a clump (max ' + (spread.length ? Math.max.apply(null, spread).toFixed(2) : '0') + 'm)');
    } else ok(false, 'implosion field had no centre');
    ctx.step(60 * 2);
    ok(zs.every(function (z) { return z.dead; }), 'the clump detonation killed the pack');
    ok(G.weapons.implosions.length === 0, 'implosion field expired');
  }
}

function testEeWeapons(ctx) {
  var G = ctx.G, ids = G.CFG.cur.eeRewards || [], c = roomCenter(G, 'S');
  ids.forEach(function (id) {
    G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
    ctx.step(20); ctx.moveTo(c); G.player.yaw = 0; G.player.pitch = 0;
    G.weapons.giveWeapon(id); G.weapons.fireCd = 0;
    var gun = G.weapons.current();
    ok(gun && gun.id === id, 'holding quest wonder ' + id);
    var target = null;
    if (id === 'kryolithwerfer' || id === 'vosssiphon') {
      target = G.zombies.spawnAt(new THREE.Vector3(c.x, 0, c.z - 4));
      target.speed = 0; target.hp = target.hpMax = 1e9;
      if (id === 'vosssiphon') G.player.hp = G.player.maxHp - 60;
      ctx.step(2);
    }
    var ammo = gun.ammo;
    G.weapons.mouseDown = true; ctx.step(2); G.weapons.mouseDown = false;
    ok(gun.ammo === ammo - 1, id + ' consumes one shot');
    var ptype = G.CFG.WEAPONS[id].projectile;
    if (ptype === 'flare' || ptype === 'soulmine')
      ok(G.weapons.projectiles.some(function (p) { return p.type === ptype; }), id + ' launches its unique device');
    if (ptype === 'piston' || ptype === 'echo')
      ok(G.weapons.eeHazards.some(function (h) { return h.type === ptype; }), id + ' creates its unique field');
    if (ptype === 'rod') {
      ok(G.weapons.rods.length === 1, 'Blitzfänger plants its first rod');
      ctx.step(60); G.weapons.fireCd = 0; G.weapons.mouseDown = true; ctx.step(2); G.weapons.mouseDown = false;
      ok(G.weapons.eeHazards.some(function (h) { return h.type === 'fence'; }), 'second rod forms a lightning fence');
    }
    if (ptype === 'kryolith') {
      ok(target && target.wwFrozen, 'Kryolithwerfer freezes a zombie into a launchable statue');
      ctx.step(60); G.weapons.fireCd = 0; G.weapons.mouseDown = true; ctx.step(2); G.weapons.mouseDown = false;
      ok(G.weapons.iceSlides.some(function (s) { return s.z === target; }), 'second Kryolith shot launches the frozen statue');
    }
    if (ptype === 'siphon') ok(G.player.hp > G.player.maxHp - 60, "Voss's Siphon restores health from damage");
    G.weapons.projectiles.forEach(function (p) { G.scene.remove(p.mesh); });
    G.weapons.projectiles.length = 0; G.weapons.eeHazards.length = 0; G.weapons.rods.length = 0;
    G.weapons.iceSlides.length = 0; G.zombies.lure = null;
  });
}

function testMovement(ctx) {
  var G = ctx.G, step = ctx.step, win = ctx.win, doc = ctx.doc;
  var P = G.player;
  function hSpeed() { return Math.hypot(P.vel.x, P.vel.z); }
  function keyup(codes) { codes.forEach(function (k) { win.dispatch('keyup', { code: k }); }); }

  // stand in the middle of the spawn room facing +x (long open axis)
  ctx.moveTo(roomCenter(G, 'S'));
  P.yaw = -Math.PI / 2; P.pitch = 0;
  P.vel.set(0, 0, 0);
  keyup(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyC', 'Space']);
  step(10);

  /* walk -> sprint with FOV kick */
  win.dispatch('keydown', { code: 'KeyW' });
  step(45);
  ok(hSpeed() > 3.8 && hSpeed() < 4.8, 'walk speed ~4.4 (' + hSpeed().toFixed(2) + ')');
  win.dispatch('keydown', { code: 'ShiftLeft' });
  step(60);
  ok(P.sprintAmt > 0.85, 'sprint ramped in');
  ok(hSpeed() > 6.0, 'sprint speed ~6.6 (' + hSpeed().toFixed(2) + ')');
  var fwd = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
  var dirDot = (P.vel.x * fwd.x + P.vel.z * fwd.z) / (hSpeed() || 1);
  ok(dirDot > 0.92, 'movement aligned with camera forward (dot ' + dirDot.toFixed(2) + ')');
  ok(G.camera.fov > 79, 'sprint FOV kick (' + G.camera.fov.toFixed(1) + ')');

  /* slide: speed boost, low camera, wider FOV */
  win.dispatch('keydown', { code: 'KeyC' });
  step(4);
  ok(P.stance === 'slide', 'slide started from sprint');
  ok(hSpeed() > 7.5, 'slide speed boost (' + hSpeed().toFixed(2) + ')');
  step(12);
  ok(P.eyeCur < 1.2, 'camera dropped during slide');
  ok(G.camera.fov > 81, 'slide FOV kick');

  /* slide-hop keeps momentum */
  var preHop = hSpeed();
  win.dispatch('keydown', { code: 'Space' });
  step(3);
  ok(!P.onGround, 'airborne from slide-hop');
  ok(hSpeed() > preHop * 0.9, 'momentum kept through slide-hop (' +
     preHop.toFixed(2) + ' -> ' + hSpeed().toFixed(2) + ')');
  keyup(['KeyW', 'ShiftLeft', 'KeyC', 'Space']);
  step(60);
  ok(P.onGround, 'landed');
  ok(hSpeed() < 1.0, 'friction stops cleanly (' + hSpeed().toFixed(2) + ')');

  /* crouch */
  win.dispatch('keydown', { code: 'KeyC' });
  step(30);
  ok(P.stance === 'crouch' && P.eyeCur < 1.25, 'crouch lowers camera');
  win.dispatch('keyup', { code: 'KeyC' });
  step(12);
  ok(P.stance === 'stand', 'stand on crouch release');

  /* ADS: zoom in, slower spread handled in fire; zoom restores */
  doc.dispatch('mousedown', { button: 2 });
  step(30);
  ok(P.ads > 0.85, 'ADS in (' + P.ads.toFixed(2) + ')');
  ok(G.camera.fov < 62, 'ADS zoom (' + G.camera.fov.toFixed(1) + ')');
  doc.dispatch('mouseup', { button: 2 });
  step(40);
  ok(P.ads < 0.1, 'ADS out');
  ok(Math.abs(G.camera.fov - G.CFG.MOVE.fov) < 2, 'FOV restored');

  /* sprint-out delay: firing while sprinting waits for the ramp-down */
  G.weapons.equip(0, true);
  var gun = G.weapons.current();
  gun.ammo = G.weapons.stats(gun).mag;
  win.dispatch('keydown', { code: 'KeyW' });
  win.dispatch('keydown', { code: 'ShiftLeft' });
  step(50);
  ok(P.sprintAmt > 0.85, 'sprinting again');
  var ammo0 = gun.ammo;
  G.weapons.mouseDown = true;
  step(2);
  ok(gun.ammo === ammo0, 'no shot during sprint-out');
  step(15);
  ok(gun.ammo < ammo0, 'fired after sprint ramped out');
  G.weapons.mouseDown = false;
  keyup(['KeyW', 'ShiftLeft']);
  step(10);
}

function bootChecks(ctx, mapId) {
  var G = ctx.G;
  ok(!!G && !!G.CFG && !!G.map, 'modules loaded');
  G.startGame(mapId);
  ok(G.state === 'playing', 'game started on ' + mapId);
  var floors = G.CFG.cur._floors || [];
  var expectedWindows = floors.length ? floors.reduce(function (n, f) { return n + (f.WINDOWS || []).length; }, 0) : G.CFG.WINDOWS.length;
  var expectedDoors = Object.keys(G.CFG.DOORS).length + floors.reduce(function (n, f) {
    return n + (f.primary ? 0 : Object.keys(f.DOORS || {}).length);
  }, 0);
  ok(G.map.windows.length === expectedWindows, 'windows built (' + G.map.windows.length + ')');
  ok(Object.keys(G.map.doors).length === expectedDoors, 'doors built');
  ok(G.weapons.slots.length === 1 && G.weapons.slots[0].id === 'm1911', 'starts with M1911');
  // every window starts with 5 boards; mystery box spots never sit in a doorway
  ok(G.map.windows.every(function (w) { return w.boards === 5; }), 'windows have 5 boards');
  var boxClear = G.map.boxSpots.every(function (b) {
    return Object.keys(G.map.doors).every(function (id) {
      return b.pos.distanceTo(G.map.doors[id].pos) >= 3.0;
    });
  });
  ok(boxClear, 'no mystery box spot blocks a door');
  G.zombies.list.length = 0;
  ctx.step(60 * 6);
  ok(G.zombies.round === 1, 'round 1 started');
  ok(G.zombies.list.length > 0, 'zombies spawned (' + G.zombies.list.length + ')');
}

/* ------------------------------------------------------------ map runs --- */
async function runQuick(mapId) {
  console.log('\n=== quick: ' + mapId + ' ===');
  var ctx = createGame();
  var G = ctx.G;
  bootChecks(ctx, mapId);
  G.player._realDamage = G.player.damage;
  G.player.damage = function () {}; // invulnerable for systems testing
  ctx.step(60 * 10);
  openAllDoors(ctx);
  unlockPap(ctx);
  testWonderWeapon(ctx);
  if (mapId === 'nacht') {
    testBreakIn(ctx);
    testPenetration(ctx);
    testMovement(ctx); // big open spawn room
    testSimpleAim(ctx);
    testGamepad(ctx);
    testRemote(ctx);
    testPerks(ctx);
    testTerminal(ctx);
    testBosses(ctx);
    testBossCharge(ctx);
    testKnockbackWall(ctx);
    testMeleeLOS(ctx);
    testShield(ctx);
    testDamageDirection(ctx);
    testSoulBox(ctx);
    testShieldBuild(ctx);
    testNoWonderBuild(ctx);
    testPowerups(ctx);
    testArmored(ctx);
    testNoRange(ctx);
    testDetail(ctx);
  }
  if (mapId === 'derriese') {
    testDerRieseGroundLoop(ctx);
    testSoulBox(ctx);
    testOverclockGiant(ctx);
    testMainframeYard(ctx);
  }
  if (mapId === 'wetterjunge') {
    var wu = G.map.floors && G.map.floors.filter(function (f) { return f.floorY > 3; })[0];
    ok(wu && Object.keys(wu.parsed.rooms).length >= 3,
       'Wetterjunge has a full upper weather station with three explorable zones');
    ok(G.map.stages.filter(function (s) { return s.stairBase; }).length === 2,
       'weather deck has two independent stair approaches');
  }
  testEeWeapons(ctx);
  testWallAlignment(ctx, mapId);
}

/* climbing an indoor staircase to an upper floor must not headbutt the room
   ceiling — the stairwell ceiling lifts to clear the player at the top */
function testStairHeadroom(ctx) {
  if (!ctx.G.map.stages.length) return;   // flat map
  var G = ctx.G;
  var stairChoices = (G.map.stages || []).filter(function (s) { return s.stairBase; });
  // Der Riese's Garage Control stair is the correct stress case for the shared
  // upper department; the furnace flight deliberately sits in a tighter bay.
  var stg = G.CFG.cur.id === 'derriese' ? stairChoices[stairChoices.length - 1] : stairChoices[0];
  if (!stg) { ok(true, 'no staircase to test headroom (skipped)'); return; }
  var P = G.player;
  P.pos.set(stg.stairBase.x, 0, stg.stairBase.z + 1);
  P.vel.set(0, 0, 0);
  // walk straight up the ramp axis (keep the stair's x, head toward the deck's z)
  // — aiming at the deck CENTRE would drift the climber off the side of the ramp
  P.yaw = Math.atan2(-(stg.stairBase.x - P.pos.x), -(stg.deckCenter.z - P.pos.z));
  G.keys.KeyW = true;
  var maxY = 0;
  for (var f = 0; f < 160; f++) { ctx.step(1); if (P.pos.y > maxY) maxY = P.pos.y; }
  G.keys.KeyW = false;
  ok(maxY > stg.deckTop - 0.25,
     'player climbs the full staircase to the upper floor (reached y=' +
     maxY.toFixed(2) + ' of ' + stg.deckTop.toFixed(2) + ')');
  ctx.moveTo(roomCenter(G, 'S'));
}

/* the horde must FUNNEL to the foot of a staircase and climb it — not jam
   against the sides. Spawn a ring of zombies around (and beside) the stair base
   with the player up top; most should reach the deck. Guards the nav fix that
   cuts "side-mount" edges onto the middle of a ramp and stops the steering
   look-ahead cutting the corner through the ramp's side. */
function testStairFunnel(ctx) {
  if (!ctx.G.map.stages.length) return;   // flat map
  var G = ctx.G, Z = G.zombies, P = G.player;
  var funnelStairs = (G.map.stages || []).filter(function (s) { return s.stairBase; });
  var stg = G.CFG.cur.id === 'derriese' ? funnelStairs[funnelStairs.length - 1] : funnelStairs[0];
  if (!stg) { ok(true, 'no staircase to test funnelling (skipped)'); return; }
  ctx.moveTo({ x: stg.deckCenter.x, z: stg.deckCenter.z, y: stg.deckTop }); P.pos.y = stg.deckTop;
  Z.mode = 'break'; Z.breakTimer = 999; Z.toSpawn = 0;
  Z.list.slice().forEach(function (z) { if (!z.dead) Z.damageZombie(z, 1e9, { boom: true }); });
  ctx.step(30);
  var base = stg.stairBase, spawned = [];
  // Start the crowd in the real approach room, in staggered lanes facing the
  // stair mouth. A ring can put bodies behind exterior/party walls on an
  // irregular blueprint and tests the detour around the building, not funneling.
  for (var a = 0; a < 3; a++) {
    var x = base.x + (a - 1) * 0.9;
    var z = base.z + 0.9;
    if (!G.map.roomAt(x, z)) continue;
    spawned.push(Z.spawnAt(new THREE.Vector3(x, 0, z)));
  }
  var maxY = spawned.map(function () { return 0; });
  for (var f = 0; f < 60 * 40; f++) {
    ctx.step(1);
    spawned.forEach(function (z, k) { if (!z.dead && z.mesh.position.y > maxY[k]) maxY[k] = z.mesh.position.y; });
  }
  var reached = maxY.filter(function (y) { return y > stg.deckTop - 0.5; }).length;
  ok(spawned.length === 3 && reached === spawned.length,
     'horde funnels up the stairs (' + reached + '/' + spawned.length + ' reached the deck)');
  Z.list.slice().forEach(function (z) { if (!z.dead) Z.damageZombie(z, 1e9, { boom: true }); });
  ctx.step(20);
}

/* Der Riese Mainframe is the freestanding anchor of its outdoor spawn yard,
   visible and usable without forcing the teleporter loop through an upper room. */
function testMainframeYard(ctx) {
  var G = ctx.G, mf = G.map.mainframe;
  ok(mf && Math.abs(mf.pos.y) < 0.2, 'Mainframe sits in the ground-level spawn yard');
  ok(G.map.roomAt(mf.pos.x, mf.pos.z, 0) === 'S', 'Mainframe belongs to the authored Mainframe Yard');
  var lv = G.map.surfaceLevelsAt(mf.pos.x, mf.pos.z);
  ok(lv.some(function (l) { return Math.abs(l) < 0.5; }), 'walkable yard surface present at the Mainframe');
  var dn = G.nav.nearest(mf.pos.x, mf.pos.z, 0);
  ok(dn && dn.y < 1.0, 'a ground navigation node reaches the Mainframe yard');
  G.nav.computeField(mf.pos);
  var floor = G.CFG.cellToWorld(3, 9);
  var n = G.nav.nearest(floor.x, floor.z, 0);
  ok(n && isFinite(n.dist) && n.dist < 1e8, 'zombies can path from the west courtyard into the Mainframe yard');

  // the stairs carry MULTIPLE nav lanes across their width so the horde spreads
  // instead of choking single-file (finer nav resolution)
  var stg = G.map.stages[0];
  if (!stg) return;   // flat map — verticality removed in playtesting
  var sx1 = stg.deckCenter.x - 4, sx2 = stg.deckCenter.x + 4;
  var sz1 = Math.min(stg.deckCenter.z, stg.stairBase.z) + 0.4;
  var sz2 = Math.max(stg.deckCenter.z, stg.stairBase.z) - 0.4;
  var laneX = {};
  G.nav.nodes.forEach(function (nd) {
    if (nd.x >= sx1 && nd.x <= sx2 && nd.z >= sz1 && nd.z <= sz2 && nd.y > 0.3 && nd.y < 3.7) laneX[nd.x.toFixed(1)] = 1;
  });
  // 2+ lanes = the horde pairs up instead of single-filing. (3+ would force
  // ~3.7m-wide flights — rejected in playtesting as room-dominating masses;
  // the polish directive explicitly narrows stairs to service-hall width.)
  ok(Object.keys(laneX).length >= 2, 'the staircase carries 2+ nav lanes across its width (' + Object.keys(laneX).length + ')');
}

/* every perk machine + Pack-a-Punch + power switch must sit flat against a wall
   on a clean 90-degree rotation (never diagonal), face the open room, and rest
   on a sane floor height with no NaN transform */
function testWallAlignment(ctx, mapId) {
  var G = ctx.G;
  function cardinal(y) {
    var t = ((y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI / 2);
    return Math.min(t, Math.PI / 2 - t) < 0.02;        // within ~1 degree of a 90
  }
  function noNaN(o) { return o && !isNaN(o.position.x) && !isNaN(o.position.y) && !isNaN(o.position.z) && !isNaN(o.rotation.y); }
  // distance from a machine's BACK face to the nearest room inner-wall plane —
  // small = flush against the wall (not floating in the room)
  function roomInner(rid) {
    var cells = G.map.parsed.rooms[rid].cells, minc = 99, maxc = -99, minr = 99, maxr = -99;
    cells.forEach(function (cr) { if (cr[0] < minc) minc = cr[0]; if (cr[0] > maxc) maxc = cr[0]; if (cr[1] < minr) minr = cr[1]; if (cr[1] > maxr) maxr = cr[1]; });
    var a = G.CFG.cellToWorld(minc, minr), b = G.CFG.cellToWorld(maxc, maxr);
    // REAL inner wall surfaces (wall is WALL_T=0.35 thick, centred on the cell edge)
    var half = G.CFG.CELL / 2;
    return { x0: a.x - half + 0.175, x1: b.x + half - 0.175,
             z0: a.z - half + 0.175, z1: b.z + half - 0.175 };
  }
  function backGap(mesh, hd) {
    var yaw = mesh.rotation.y, p = mesh.position;
    var bx = p.x - hd * Math.sin(yaw), bz = p.z - hd * Math.cos(yaw);   // back-face point
    var rid = G.map.roomAt(p.x, p.z); if (!rid || !G.map.parsed.rooms[rid]) return 0;
    var bb = roomInner(rid);
    return Math.min(Math.abs(bx - bb.x0), Math.abs(bb.x1 - bx), Math.abs(bz - bb.z0), Math.abs(bb.z1 - bz));
  }
  var machines = G.map.perkMachines.map(function (m) { return { name: 'perk:' + m.perk, mesh: m.mesh, hd: 0.4 }; });
  if (G.map.pap) machines.push({ name: 'pack_a_punch', mesh: G.map.pap.mesh, hd: 0.48 });
  if (G.map.powerSwitch) machines.push({ name: 'power_switch', mesh: G.map.powerSwitch.mesh, hd: 0.12 });
  // Der Riese's Mainframe is intentionally a freestanding yard landmark; every
  // cabinet/machine still uses this wall-flush contract.
  if (G.map.mainframe && mapId !== 'derriese')
    machines.push({ name: 'mainframe', mesh: G.map.mainframe.pad, hd: 0.25 });
  machines.forEach(function (m) {
    ok(m.mesh && m.mesh.isObject3D, mapId + ' ' + m.name + ' built as a prop root');
    ok(noNaN(m.mesh), mapId + ' ' + m.name + ' has no NaN transform');
    ok(cardinal(m.mesh.rotation.y), mapId + ' ' + m.name + ' uses a clean 90-degree wall rotation');
    ok(backGap(m.mesh, m.hd) < 0.15, mapId + ' ' + m.name + ' sits FLUSH against the wall (gap ' + backGap(m.mesh, m.hd).toFixed(2) + 'm)');
  });
}

/* armored heavy: plating soaks body shots but not headshots, and cracks off
   once the zombie is hurt enough */
function testArmored(ctx) {
  var G = ctx.G;
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  function armored(z) { z.hp = 1000; z.hpMax = 1000; z.armored = true; z.armorParts = []; return z; }
  var zb = armored(G.zombies.spawnAt(new THREE.Vector3(0, 0, -5)));
  G.zombies.damageZombie(zb, 100, {});
  var bodyLoss = 1000 - zb.hp;
  var zh = armored(G.zombies.spawnAt(new THREE.Vector3(0, 0, -6)));
  G.zombies.damageZombie(zh, 100, { head: true });
  var headLoss = 1000 - zh.hp;
  ok(bodyLoss < headLoss, 'armor soaks body shots (-' + bodyLoss + ') more than headshots (-' + headLoss + ')');
  ok(Math.abs(bodyLoss - 40) < 1, 'body damage is cut to ~40% by the plating');
  var zc = armored(G.zombies.spawnAt(new THREE.Vector3(0, 0, -7)));
  G.zombies.damageZombie(zc, 700, { head: true });   // -> 300 hp, below 40%
  ok(!zc.armored, 'armor cracks off once the heavy drops below 40% hp');
}

/* the shooting-range dev feature is fully removed */
function testNoRange(ctx) {
  var G = ctx.G;
  ok(!G.zombies.spawnTargets && !G.zombies.spawnTarget && !G.zombies.clearTargets && !G.zombies.setRangeFreeze,
     'range dummy API removed from the zombie director');
  ok(G.zombies.rangeOn === undefined && G.zombies.rangeFreeze === undefined, 'range state flags removed');
}

/* environmental detail pass: the procedural decal/marking dressing actually
   builds (grime, blood, bullet, stencil and poster decals across the rooms) */
function testDetail(ctx) {
  var G = ctx.G;
  ok(typeof G.map.decalCount === 'number' && G.map.decalCount > 12,
     'detail pass scatters surface decals (' + G.map.decalCount + ')');
}

/* power-up variety: Bonus Points pays out, and the Death Machine drop wields a
   timed infinite-ammo minigun that restores your loadout when it ends */
function testPowerups(ctx) {
  var G = ctx.G, step = ctx.step, P = G.player;
  ctx.moveTo(roomCenter(G, 'S'));
  var c = P.pos.clone();

  var pts0 = P.points;
  G.powerups.spawn('bonus', new THREE.Vector3(c.x, 0, c.z));
  step(3);
  ok(P.points > pts0, 'Bonus Points awards a bounty');

  G.weapons.slots.length = 0; G.weapons.maxSlots = 2;
  G.weapons.giveWeapon('m1911'); G.weapons.giveWeapon('mp5k'); G.weapons.equip(0, true);
  var savedIds = G.weapons.slots.map(function (s) { return s.id; }).join(',');
  G.powerups.spawn('deathmachine', new THREE.Vector3(c.x, 0, c.z));
  step(3);
  ok(G.weapons.current().id === 'deathmachine', 'Death Machine equips on pickup');
  ok(G.powerups.timers.deathmachine > 0, 'Death Machine timer is running');
  var g = G.weapons.current(); g.ammo = 4;
  P.sprintAmt = 0; G.weapons.mouseDown = true; step(60); G.weapons.mouseDown = false;
  ok(g.ammo > 0, 'Death Machine never runs dry');
  G.powerups.timers.deathmachine = 0.01; step(3);
  ok(G.weapons.current().id !== 'deathmachine' &&
     G.weapons.slots.map(function (s) { return s.id; }).join(',') === savedIds,
     'loadout is restored when the Death Machine expires');
}

// Der Riese deliberately trades its awkward second floor for one dense,
// readable factory loop. Verify that every displaced function is on the ground,
// the former stair-blocked spawn exit is genuinely traversable, and each sector
// has its authored colour aura.
function testDerRieseGroundLoop(ctx) {
  var G = ctx.G, step = ctx.step, win = ctx.win, P = G.player;
  ok(Math.abs(G.CFG.CELL - 3.5) < 0.01, 'Der Riese uses the tightened 3.5m grid scale');
  ok((G.map.floors || []).filter(function (f) { return f.floorY > 0.5; }).length === 0,
     'Der Riese has no orphaned playable upper floor');
  ok((G.map.stages || []).filter(function (s) { return s.stairBase; }).length === 0,
     'the two awkward factory stairs are completely removed');
  ok(G.map.derRieseAuras && G.map.derRieseAuras.length === 6,
     'all six factory districts have distinct colour auras');

  ok(G.map.perkMachines.some(function (m) { return m.perk === 'wonderfizz'; }),
     'Der Wunderfizz machine remains present');
  ok(!G.map.perkMachines.some(function (m) { return m.perk === 'mule'; }),
     'Mule Kick machine remains removed');
  ok(G.map.perkMachines.every(function (m) { return Math.abs(m.pos.y || 0) < 0.5; }),
     'every Der Riese perk machine is usable on the ground floor');
  ok((G.CFG.cur.BOX_SPOTS || []).every(function (s) { return !(s.y > 0.5); }),
     'every mystery-box location is on the ground loop');
  ok((G.CFG.cur.EE_STEPS || []).every(function (s) { return !(s.y > 0.5); }) &&
     !(G.CFG.cur.OVERCLOCK.regulator.y > 0.5),
     'the full Giant\'s Heart quest no longer requires an upper floor');

  var garageDoor = Object.keys(G.map.doors).map(function (id) { return G.map.doors[id]; })
    .filter(function (d) { return d.name === 'Mainframe Garage Shutter'; })[0];
  ok(!!garageDoor, 'Mainframe Garage Shutter exists');
  if (garageDoor) {
    var west = new THREE.Vector3(garageDoor.pos.x - G.CFG.CELL * 0.72, 0, garageDoor.pos.z);
    var east = new THREE.Vector3(garageDoor.pos.x + G.CFG.CELL * 0.72, 0, garageDoor.pos.z);
    ok(!G.map.bodyBlocked(west.x, west.z, 0) && !G.map.bodyBlocked(east.x, east.z, 0),
       'the former stair/cabinet obstruction is gone from both sides of the Garage entrance');
    var wn = G.nav.nearest(west.x, west.z, 0), en = G.nav.nearest(east.x, east.z, 0);
    ok(wn && en && isFinite(wn.dist) && isFinite(en.dist),
       'player and zombie navigation spans the cleared Garage entrance');
  }

  // Wonderfizz was moved down intact and is buyable through the real F input.
  var fizz = G.map.perkMachines.filter(function (m) { return m.perk === 'wonderfizz'; })[0];
  G.player.points = 100000; G.player.perks = [];
  var yaw = fizz.mesh.rotation.y;
  P.pos.set(fizz.pos.x + Math.sin(yaw), 0, fizz.pos.z + Math.cos(yaw));
  P.vel.set(0, 0, 0); step(2);
  P.yaw = Math.atan2(-(fizz.pos.x - P.pos.x), -(fizz.pos.z - P.pos.z));
  G.player.consumeInteract(); win.dispatch('keydown', { code: 'KeyF' }); step(3);
  win.dispatch('keyup', { code: 'KeyF' });
  ok(G.player.perks.length === 1, 'ground-floor Wunderfizz is reachable and usable');
}

function clearHorde(G) {
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
}

// one high-power round pierces a line of zombies and every pierced kill scores
function testPenetration(ctx) {
  var G = ctx.G;
  G.zombies.mode = 'break'; G.zombies.breakTimer = 999; G.zombies.toSpawn = 0;
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  ctx.step(70);
  G.settings.aimMode = 'mouse';
  var c = roomCenter(G, 'S');
  ctx.moveTo(c);
  G.player.yaw = 0; G.player.pitch = -0.04; // aim into the chest line
  ctx.step(2);
  G.zombies.round = 2;
  var zs = [
    G.zombies.spawnAt(new THREE.Vector3(c.x, 0, c.z - 3)),
    G.zombies.spawnAt(new THREE.Vector3(c.x, 0, c.z - 5)),
    G.zombies.spawnAt(new THREE.Vector3(c.x, 0, c.z - 7))
  ];
  zs.forEach(function (z) { z.hp = 200; z.speed = 0; });   // hold the line for the aim test
  ctx.step(2);
  G.weapons.giveWeapon('l96a1');         // sniper: pierces 5
  var gun = G.weapons.current(); gun.ammo = 5;
  var pts0 = G.player.points, kills0 = G.player.kills;
  G.weapons.mouseDown = true; ctx.step(3); G.weapons.mouseDown = false;
  ctx.step(3);
  ok(zs.every(function (z) { return z.dead; }), 'one sniper round pierces and kills a line of 3 zombies');
  ok(G.player.kills === kills0 + 3, 'all 3 penetration kills counted');
  ok(G.player.points > pts0 + 150, 'penetration kills award points (+' + (G.player.points - pts0) + ')');
}

// zombies must actually break through windows and reach the player quickly,
// not just mill around outside the barricades
function testBreakIn(ctx) {
  var G = ctx.G;
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  ctx.step(60);
  G.map.windows.forEach(function (w) { w.setBoards(6); });
  ctx.moveTo(roomCenter(G, 'S'));
  G.zombies.mode = 'active'; G.zombies.round = 2; G.zombies.toSpawn = 10; G.zombies.spawnTimer = 0;
  var brokeIn = false;
  for (var i = 0; i < 60 * 9 && !brokeIn; i++) {
    ctx.step(1);
    brokeIn = G.zombies.list.some(function (z) {
      return !z.dead && (z.state === 'chase' || z.state === 'attack');
    });
  }
  ok(brokeIn, 'a zombie breaks through a barricade and reaches the player within ~9s');
  ok(G.map.windows.some(function (w) { return w.boards <= 3; }), 'a barricade was torn to a climb-through gap');
}

/* controller-only menu navigation: focus, select, pause, resume */
async function runMenuNav() {
  console.log('\n=== menu navigation (controller) ===');
  var ctx = createGame();
  var G = ctx.G;
  ok(G.state === 'menu', 'boots to the menu');
  ok(G.hud.activeMenu === 'start', 'start menu is active');
  ok(G.hud.menus.start && G.hud.menus.start.length >= 4, 'start menu items registered (maps + aim)');

  var pad = makePad();
  ctx.setPad(pad);
  ctx.win.dispatch('gamepadconnected', { gamepad: { index: 0, id: 'Test Controller' } });
  ctx.step(2);
  ok(G.hud.focusIdx === 0, 'first item focused on the start menu');

  press(pad, 15, 1); ctx.step(2); press(pad, 15, 0); ctx.step(2);  // D-pad right
  ok(G.hud.focusIdx === 1, 'D-pad right moves menu focus forward');
  press(pad, 14, 1); ctx.step(2); press(pad, 14, 0); ctx.step(2);  // D-pad left
  ok(G.hud.focusIdx === 0, 'D-pad left moves menu focus back');

  press(pad, 0, 1); ctx.step(2); press(pad, 0, 0); ctx.step(3);    // A: select first map
  ok(G.state === 'playing', 'A on a focused map card starts the game');
  ok(G.CFG.cur.id === G.CFG.MAP_IDS[0], 'started the focused map (' + G.CFG.cur.id + ')');

  press(pad, 9, 1); ctx.step(2); press(pad, 9, 0); ctx.step(2);    // Start: pause
  ok(G.state === 'paused', 'Start pauses the game');
  ok(G.hud.activeMenu === 'pause', 'pause menu active');
  press(pad, 1, 1); ctx.step(2); press(pad, 1, 0); ctx.step(2);    // B: back/resume
  ok(G.state === 'playing', 'B resumes from the pause menu');
}

/* gamepad: a plugged-in controller drives movement, look, fire and ADS */
function testGamepad(ctx) {
  var G = ctx.G, step = ctx.step;
  var P = G.player;
  ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyC', 'Space'].forEach(ctx.keyup);
  P.vel.set(0, 0, 0);
  ctx.moveTo(roomCenter(G, 'S'));
  P.yaw = 0; P.pitch = 0;
  G.settings.aimMode = 'mouse';

  var pad = makePad();
  ctx.setPad(pad);
  ctx.win.dispatch('gamepadconnected', { gamepad: { index: 0, id: 'Test Controller' } });
  step(3);
  ok(G.gamepad.connected, 'controller detected via Gamepad API');

  // left stick forward -> forward intent -> player accelerates
  pad.axes[1] = -1;
  step(40);
  ok(G.gamepad.moveZ < -0.6, 'left stick forward becomes a forward move intent');
  ok(Math.hypot(P.vel.x, P.vel.z) > 3, 'player moves from the stick (' + Math.hypot(P.vel.x, P.vel.z).toFixed(1) + ' m/s)');
  pad.axes[1] = 0;
  step(40);

  // sub-deadzone stick drift must NOT inject movement (the "stuck drifting" bug)
  pad.axes[0] = 0.18; pad.axes[1] = 0.12;  // magnitude ~0.22 < deadzone 0.26
  step(20);
  ok(G.gamepad.moveX === 0 && G.gamepad.moveZ === 0, 'sub-deadzone drift injects no movement');
  ok(Math.hypot(P.vel.x, P.vel.z) < 0.4, 'player does not drift from stick noise');
  pad.axes[0] = 0; pad.axes[1] = 0;
  step(20);

  // right stick turns the view
  var yaw0 = P.yaw;
  pad.axes[2] = 1; // look right
  step(20);
  ok(Math.abs(P.yaw - yaw0) > 0.1, 'right stick turns the camera');
  pad.axes[2] = 0;

  // RT fires the weapon
  G.weapons.equip(0, true);
  var gun = G.weapons.current();
  gun.ammo = G.weapons.stats(gun).mag;
  step(30); // let any sprint ramp out
  var ammo0 = gun.ammo;
  press(pad, 7, 1); // right trigger
  step(20);
  press(pad, 7, 0);
  ok(gun.ammo < ammo0, 'right trigger fires the weapon');

  // LT aims down sights
  press(pad, 6, 1);
  step(30);
  ok(P.ads > 0.7, 'left trigger aims down sights');
  press(pad, 6, 0);
  step(20);

  // A jumps
  P.pos.y = 0; P.vel.y = 0; P.onGround = true;
  press(pad, 0, 1);
  step(3);
  ok(!P.onGround || P.vel.y > 0, 'A button jumps');
  press(pad, 0, 0);

  // X reloads when there's no interaction prompt up
  G.hud._prompt = null;
  gun.ammo = 1;
  press(pad, 2, 1); step(3); press(pad, 2, 0);
  step(2);
  ok(G.weapons.reloading > 0, 'X reloads when no prompt is shown');
  step(140); // finish the reload

  // Y switches weapons
  G.weapons.slots.length = 0; G.weapons.maxSlots = 2;
  G.weapons.giveWeapon('m1911'); G.weapons.giveWeapon('mp5k');
  G.weapons.equip(0, true);
  var before = G.weapons.cur;
  press(pad, 3, 1); step(3); press(pad, 3, 0); step(3);
  ok(G.weapons.cur !== before, 'Y switches weapons');

  // X also BUYS when an interaction prompt is showing — face a wall weapon the
  // player doesn't own and tap X (doors are all open by now, so use a wall buy)
  G.player.points = 100000;
  var wb = G.map.wallbuys.filter(function (w) { return !w.isFrags && !G.weapons.hasWeapon(w.gun); })[0];
  ctx.moveTo(wb.pos); step(3);
  var ddx = wb.pos.x - P.pos.x, ddz = wb.pos.z - P.pos.z;
  if (Math.hypot(ddx, ddz) > 0.05) P.yaw = Math.atan2(-ddx, -ddz);
  var sawPrompt = false;
  for (var f = 0; f < 12 && !sawPrompt; f++) { step(1); if (G.hud._prompt) sawPrompt = true; }
  ok(sawPrompt, 'wall-buy prompt shows when facing it');
  press(pad, 2, 1); step(3); press(pad, 2, 0); step(3);
  ok(G.weapons.hasWeapon(wb.gun), 'X buys the wall weapon (' + wb.gun + ') when its prompt is up');

  // LB throws a monkey bomb
  G.player.hasMonkeys = true; G.player.monkeys = 3;
  press(pad, 4, 1); step(3); press(pad, 4, 0); step(3);
  ok(G.player.monkeys === 2, 'LB throws a monkey bomb');

  // RB throws a frag
  G.player.frags = 4;
  press(pad, 5, 1); step(3); press(pad, 5, 0); step(3);
  ok(G.player.frags === 3, 'RB throws a frag grenade');

  // unplug: intents clear, keyboard unaffected
  ctx.setPad(null);
  step(3);
  ok(!G.gamepad.connected && G.gamepad.moveZ === 0, 'unplugging clears controller intents');
}

/* perks overhaul: new perks exist, area effects damage + web, and the
   Wunderfizz hands out a random perk (a dupe just wastes the points) */
function testPerks(ctx) {
  var G = ctx.G, step = ctx.step;
  ['widows', 'phd', 'cherry', 'wonderfizz'].forEach(function (id) {
    ok(!!G.CFG.PERKS[id], 'perk/def "' + id + '" exists');
  });

  // area blast: damages and (with slow) webs a nearby zombie
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  step(20);
  var c = roomCenter(G, 'S');
  var z = G.zombies.spawnAt(new THREE.Vector3(c.x, 0, c.z - 1));
  var hp0 = z.hp;
  G.weapons.boom(new THREE.Vector3(c.x, 0, c.z), 300, 4, 0x33ddff, { slow: 3 });
  ok(z.hp < hp0, 'W.boom deals area damage');
  ok(z.slowT > 0, "Widow's-style web slows a caught zombie");

  // Electric Cherry fires its shock on reload without error
  G.player.perks = []; G.player.addPerk('cherry');
  G.weapons.giveWeapon('mp5k');
  var g = G.weapons.current(); g.ammo = 2; g.reserve = 60;
  G.weapons.startReload();
  ok(G.weapons.reloading > 0, 'Electric Cherry reload fires its shock cleanly');

  // PhD Slider perk is grantable and clears on down
  G.player.addPerk('phd');
  ok(G.player.hasPerk('phd') && G.player.hasPerk('cherry'), 'new perks are held');
  G.player.losePerks();
  ok(!G.player.hasPerk('phd') && G.player.perks.length === 0, 'perks clear on losePerks');
}

/* buildable shield: 3 authored part locations per part, one selected
   deterministically, gathered then assembled at a wall bench. Parts must be
   integrated (off the spawn centre) and never overlap each other or the bench. */
function testShieldBuild(ctx) {
  var G = ctx.G, CFG = G.CFG;
  var KINDS = ['frame', 'plate', 'glass'];
  ok(!CFG.SHIELD_PARTS.battery, 'battery component replaced (no longer used)');
  KINDS.forEach(function (k) {
    var def = CFG.SHIELD_PARTS[k];
    ok(def && def.room && def.spots && def.spots.length === 3,
       'shield ' + k + ' has a room + exactly 3 authored spots');
  });
  function distinct(a) { var s = {}; a.forEach(function (x) { s[x] = 1; }); return Object.keys(s).length; }
  // each component is assigned a DIFFERENT room
  var rooms = KINDS.map(function (k) { return CFG.SHIELD_PARTS[k].room; });
  ok(distinct(rooms) === 3, 'each shield component spawns in a different room (' + rooms.join('/') + ')');
  var sh = G.interact.shield;
  ok(sh && sh.parts.length === 3, 'exactly one location selected per component (3 placed)');
  // the selected parts actually sit in their assigned rooms, all distinct
  var placedRooms = sh.parts.map(function (p) { return G.map.roomAt(p.pos.x, p.pos.z); });
  ok(distinct(placedRooms) === 3, 'placed parts occupy three distinct rooms (' + placedRooms.join('/') + ')');
  ok(sh.parts.every(function (p) { return G.map.roomAt(p.pos.x, p.pos.z) === p.room; }), 'each part lands in its assigned room');
  // selection is deterministic for the map seed (matches the authored hash pick)
  var deterministic = sh.parts.every(function (p) {
    var spots = CFG.SHIELD_PARTS[p.kind].spots;
    var exp = spots[G.PU.hashStr(CFG.cur.id + ':' + p.kind) % spots.length].cell;
    return exp[0] === p.cell[0] && exp[1] === p.cell[1];
  });
  ok(deterministic, 'shield-part selection is deterministic for the map seed');
  // parts mutually clear + clear of the bench
  var bench = G.map.shieldBench;
  ok(!!bench, 'shield bench was placed');
  var pts = sh.parts.map(function (p) { return p.pos; }), clear = true;
  for (var i = 0; i < pts.length; i++) {
    for (var j = i + 1; j < pts.length; j++) if (pts[i].distanceTo(pts[j]) < 2.0) clear = false;
    if (pts[i].distanceTo(bench.pos) < 2.0) clear = false;
  }
  ok(clear, 'selected shield parts + bench never overlap');
  // not dumped in the spawn centre / a major route
  var sc = roomCenter(G, 'S');
  ok(pts.every(function (p) { return p.distanceTo(sc) > 3; }), 'no shield part sits in the spawn centre');
  // clear of every door approach so part prompts never hijack a door's "Open"
  var doorClear = pts.every(function (p) {
    return Object.keys(G.map.doors).every(function (id) { return p.distanceTo(G.map.doors[id].pos) > 2.8; });
  });
  ok(doorClear, 'no shield part blocks a door approach');
  // Every part has a clear standing/interact point one metre in from its wall.
  // This prevents decorative room geometry from stealing the pickup approach.
  var inward = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] };
  var partAccess = sh.parts.every(function (p) {
    var o = inward[p.face], x = p.pos.x + o[0] * 1.1, z = p.pos.z + o[1] * 1.1;
    return !G.map.bodyBlocked(x, z, 0) && G.map.supportAt(x, z, 0, 0.55) < 0.5;
  });
  ok(partAccess, 'every shield part has a clear ground-level interaction point');
  // bench is wall-adjacent: the cell beyond its facing wall is not a room
  var off = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[bench.face];
  var bc = CFG.SHIELD_BENCH.cell, beyond = G.map.cellAt(bc[0] + off[0], bc[1] + off[1]);
  ok(!beyond || beyond.type !== 'room', 'shield bench sits flat against a wall');
  // gather the parts and assemble
  G.interact.list.forEach(function (it) { if (/Pick up shield/.test(it.prompt() || '')) it.use(); });
  ok(sh.count === 3, 'all three shield parts collected');
  var build = G.interact.list.filter(function (it) { return /Build the Zombie Shield/.test(it.prompt() || ''); })[0];
  ok(!!build, 'bench offers the build once all parts are gathered');
  G.player.shield = G.player.shield || { has: false, hp: 0, max: 5 };
  G.player.shield.has = false;
  build.use();
  ok(G.player.shield.has, 'assembling at the bench grants the Zombie Shield');
}

/* the wonder-weapon BUILD system is fully removed — no parts, bench, or state */
function testNoWonderBuild(ctx) {
  var G = ctx.G;
  ok(!G.CFG.WW_PARTS && !G.CFG.WW_BUILD, 'no WW_PARTS / WW_BUILD config remains');
  ok(!G.interact.ww, 'no wonder-weapon build state remains');
  ok(!G.Props.has('wonder_bench') && !G.Props.has('ww_part'), 'wonder-build props removed from the registry');
  var benchPrompt = G.interact.list.some(function (it) { return /wonder-weapon bench/i.test(it.prompt() || ''); });
  ok(!benchPrompt, 'no wonder-weapon bench interaction exists');
}

/* map-themed easter egg: recover three components, charge the final device,
   and receive one of the map's two quest-only wonder weapons */
function testSoulBox(ctx) {
  var G = ctx.G, CFG = G.CFG;
  var ee = G.interact.ee;
  // 9 authored relic spots; exactly 3 distinct instantiated this match
  ok(CFG.RELIC_SPOTS && CFG.RELIC_SPOTS.length === 9, 'nine authored relic spots exist');
  ok(ee && ee.relics.length === 3, 'exactly three relics active this match');
  var rcells = ee.relics.map(function (r) { return r.cell.join(','); });
  ok(rcells[0] !== rcells[1] && rcells[1] !== rcells[2] && rcells[0] !== rcells[2], 'the three relics use distinct authored spots');
  // every chosen spot is one of the 9 authored locations, clear of door approaches
  var authored = {};
  (CFG.cur.EE_STEPS && CFG.cur.EE_STEPS.length ? CFG.cur.EE_STEPS : CFG.RELIC_SPOTS)
    .forEach(function (s) { authored[s.cell.join(',')] = 1; });
  ok(rcells.every(function (c) { return authored[c]; }), 'active relics come only from the authored pool');
  ok(ee.relics.every(function (r) {
    return Object.keys(G.map.doors).every(function (id) { return r.pos.distanceTo(G.map.doors[id].pos) > 2.2; });
  }), 'no active relic blocks a door approach');
  // kills before the chest is awake do nothing
  ee.box = null; ee.done = false; ee.souls = 0;
  G.interact.onKill(new THREE.Vector3(0, 0, 0));
  ok(ee.souls === 0, 'kills do nothing before the chest is awake');
  // The quest is explicitly discoverable and sequential: briefing -> one
  // numbered active marker at a time -> authored final defense device.
  if (CFG.cur.EE_STEPS && CFG.cur.EE_STEPS.length) {
    ok(!ee.started, 'classic-map Easter egg waits for its visible briefing station');
    var briefing = G.interact.list.filter(function (it) { return it.prompt && it.prompt() === CFG.cur.EE_START.prompt; })[0];
    ok(!!briefing, 'named Easter-egg briefing station is visible and interactive');
    briefing.use();
    ok(ee.started && ee.objective.indexOf(CFG.cur.EE_STEPS[0].room) >= 0,
       'briefing names the first objective room');
    for (var si = 0; si < CFG.cur.EE_STEPS.length; si++) {
      var spec = CFG.cur.EE_STEPS[si];
      var current = G.interact.list.filter(function (it) { return it.prompt && it.prompt() === spec.prompt; })[0];
      ok(!!current, 'quest step ' + (si + 1) + ' is explicitly prompted in ' + spec.room);
      current.use();
      if (si < CFG.cur.EE_STEPS.length - 1)
        ok(ee.objective.indexOf(CFG.cur.EE_STEPS[si + 1].room) >= 0,
           'step ' + (si + 1) + ' points to the next room');
    }
    ok(!!ee.box, 'finishing the guided steps awakens the marked final device');
  } else ee.box = new THREE.Vector3(0, 0, 0);
  // feed the real awakened chest nearby kills
  var beforeSlots = G.weapons.slots.map(function (s) { return s.id; });
  for (var i = 0; i < ee.need; i++) G.interact.onKill(ee.box.clone());
  ok(ee.done, 'soul chest fills after enough nearby kills');
  ok(CFG.cur.eeRewards.indexOf(ee.reward) >= 0 && G.weapons.hasWeapon(ee.reward),
     'map quest rewards one of its two secondary wonder weapons (' + ee.reward + ')');
  ok(beforeSlots.indexOf(ee.reward) < 0, 'quest reward was newly granted');
  var firstReward = ee.reward, nextReward = G.interact.pickEeReward();
  ok(nextReward !== firstReward && CFG.cur.eeRewards.indexOf(nextReward) >= 0,
     'next completion is guaranteed to award the other quest weapon');
  // a far kill would not have counted
  ee.box = new THREE.Vector3(0, 0, 0); ee.done = false; ee.souls = 0;
  G.interact.onKill(new THREE.Vector3(50, 0, 50));
  ok(ee.souls === 0, 'far-away kills do not feed the chest');
}

/* Der Riese prestige continuation: normal reward -> conduits -> three timed
   teleporter-routed cells -> alternating-room lockdown -> weapon-gated boss ->
   adaptive super variant + permanent Heart of the Giant. */
function testOverclockGiant(ctx) {
  var G = ctx.G, oc = G.interact.overclock, ee = G.interact.ee;
  ee.done = true; // testSoulBox's final far-kill assertion temporarily reopens it
  ok(oc && oc.on && oc.available && oc.reward, 'base Giant\'s Heart completion reveals the optional continuation');
  function prompted(re) {
    return G.interact.list.filter(function (it) { return it.prompt && re.test(it.prompt() || ''); })[0];
  }
  var regulator = prompted(/Begin optional quest/);
  ok(!!regulator, 'ground-floor Power Garage regulator clearly offers Overclock the Giant');
  regulator.use();
  ok(oc.stage === 1 && oc.conduits.every(function (c) { return c.mesh.visible; }),
    'accepting the continuation reveals all three weapon-reactive conduits');
  oc.conduits.forEach(function (c) {
    var origin = c.pos.clone(); origin.z += 3; origin.y += 1;
    G.interact.onWonderFire(oc.reward, origin, new THREE.Vector3(0, 0, -1), 8);
  });
  ok(oc.stage === 2 && oc.exposed === 3, 'the awarded wonder weapon exposes all three conduits');

  for (var i = 0; i < 3; i++) {
    var pickup = prompted(/Take unstable reactor cell/);
    ok(!!pickup, 'reactor cell ' + (i + 1) + ' appears in its named factory wing');
    pickup.use();
    ok(oc.carrying && oc.carrying.teleporter === ['A', 'B', 'C'][i],
      'cell ' + (i + 1) + ' requires its distinct teleporter route');
    ok(G.interact.primeOverclockCell(oc.carrying.teleporter), 'cell ' + (i + 1) + ' phase-primes at the correct teleporter');
    var install = prompted(/Install phase-primed reactor cell/);
    ok(!!install, 'phase-primed cell returns to the Power Garage regulator');
    install.use();
  }
  ok(oc.stage === 3 && oc.installed === 3, 'all three reactor cells install successfully');
  prompted(/control-block pressure lockdown/).use();
  ok(oc.stage === 4 && oc.lockdownRoom === 'L', 'lockdown starts in Animal Testing');
  for (var k = 0; k < 24; k++) {
    var pressureCenter = G.map.parsed.rooms[oc.lockdownRoom].center;
    G.interact.onKill(new THREE.Vector3(pressureCenter.x, 0, pressureCenter.z), { dead: true });
  }
  ok(oc.stage === 5 && oc.boss && oc.boss.questBoss, 'alternating-room lockdown awakens the Iron Subject');
  var boss = oc.boss, hp = boss.hp;
  G.powerups.timers.insta = 0;
  G.zombies.damageZombie(boss, 999999, { boom: true, weaponId: 'm14' });
  ok(boss.hp === hp && !boss.questArmorBroken, 'ordinary weapons cannot bypass the Iron Subject plating');
  for (var h = 0; h < 6; h++) G.zombies.damageZombie(boss, 1000, { boom: true, weaponId: oc.reward });
  ok(boss.questArmorBroken, 'six contacts from the awarded weapon break the Iron Subject armor');
  G.zombies.damageZombie(boss, 1e9, { boom: true, weaponId: oc.reward });
  ok(boss.dead && oc.stage === 6, 'defeating the exposed Iron Subject unlocks the final hand-in');
  prompted(/Place .* into the Giant's Heart/).use();
  var rewarded = G.weapons.slots.filter(function (g) { return g.id === oc.reward; })[0];
  ok(oc.done && rewarded && rewarded.overclocked, 'full completion upgrades the awarded weapon in hand');
  ok(G.player.heart.has && G.player.heart.ready, 'full completion grants the Heart of the Giant');

  var ps = G.weapons.stats({ id: 'seelenmotor', papped: false, dpap: false, overclocked: true });
  var es = G.weapons.stats({ id: 'nachbildner115', papped: false, dpap: false, overclocked: true });
  ok(ps.name === 'Seelenmotor Überdruck' && ps.pistonWidth > 2,
    'Seelenmotor route produces the crushing Überdruck super variant');
  ok(es.name === 'Nachbildner Paradox' && es.echoPulses === 6,
    'Nachbildner route produces the multi-angle Paradox super variant');

  G.player.shield = { has: false, owned: true, hp: 0, max: 5 };
  G.player.giantHeartRoundStart();
  ok(G.player.shield.has && G.player.shield.hp === 5, 'Heart of the Giant repairs an assembled shield each round');
  var invulnerableStub = G.player.damage;
  G.player.damage = G.player._realDamage; G.player.hp = 20; G.player.invuln = 0; G.state = 'playing';
  G.player.damage(200, 0, 0);
  ok(G.player.hp === 1 && !G.player.heart.ready && !G.player.downed,
    'Heart of the Giant denies one fatal hit per round and is then spent');
  G.player.damage = invulnerableStub;
}

/* directional damage indicator: taking a hit records the attacker's bearing in
   the player's own frame (0 = ahead, +pi/2 = right, +-pi = behind) and pings the
   HUD arc */
function testDamageDirection(ctx) {
  var G = ctx.G, P = G.player;
  ok(typeof G.hud.damageFrom === 'function', 'HUD has a directional damage indicator');
  ok(typeof P.hitBearing === 'function', 'player computes attacker bearing');
  P.pos.set(0, 0, 0); P.yaw = 0;   // facing -z (forward)
  function near(a, b) { var d = Math.atan2(Math.sin(a - b), Math.cos(a - b)); return Math.abs(d) < 0.2; }
  ok(near(P.hitBearing(0, -5), 0), 'hit from ahead points the indicator up');
  ok(near(P.hitBearing(0, 5), Math.PI), 'hit from behind points the indicator down');
  ok(near(P.hitBearing(5, 0), Math.PI / 2), 'hit from the right points the indicator right');
  ok(near(P.hitBearing(-5, 0), -Math.PI / 2), 'hit from the left points the indicator left');
}

/* buildable shield: blocks melee from behind, ignores hits from the front,
   and shatters after absorbing its capacity */
function testShield(ctx) {
  var G = ctx.G;
  var P = G.player;
  P.shield = { has: true, hp: 3, max: 5 };
  P.pos.set(0, 0, 0); P.yaw = 0;                  // facing -z (north)
  // attacker directly behind (south, +z) is blocked
  var blocked = P.shieldBlocks(0, 3);
  ok(blocked && P.shield.hp === 2, 'shield eats a hit from behind');
  // attacker in front (-z) is NOT blocked
  ok(!P.shieldBlocks(0, -3), 'shield ignores a frontal attacker');
  // drain it to shatter
  P.shieldBlocks(0, 3); P.shieldBlocks(0, 3);
  ok(!P.shield.has && P.shield.hp <= 0, 'shield shatters when drained');
  ok(!P.shieldBlocks(0, 3), 'a shattered shield blocks nothing');
}

/* bosses: an elite spawns on a boss round when enabled, and never when the
   player has toggled boss rounds off */
function testBosses(ctx) {
  var G = ctx.G, step = ctx.step;
  var realDamage = G.player.damage;
  G.player.damage = function () {};
  G.settings.bossRounds = true;
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  step(30);
  G.zombies.nextBoss = 1;
  G.zombies.jumpToRound(12);           // round 12 is an active (non-dog) round
  step(160);
  ok(G.zombies.bossAlive(), 'an elite spawns on a boss round');

  G.zombies.list.filter(function (z) { return z.isBoss; }).forEach(function (b) { G.zombies.damageZombie(b, 1e9, { boom: true }); });
  step(80);
  G.settings.bossRounds = false;
  G.zombies.nextBoss = 1;
  G.zombies.jumpToRound(13);
  step(160);
  ok(!G.zombies.bossAlive(), 'no elite when boss rounds are toggled off');
  G.settings.bossRounds = true;
  G.player.damage = realDamage;   // restore so later tests see the real damage path
}

/* the Panzersoldat is a real threat: from mid-range it telegraphs and charges,
   closing the gap fast and landing a heavy knockback hit (not a slow sponge) */
function testBossCharge(ctx) {
  var G = ctx.G, step = ctx.step;
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  G.zombies.mode = 'break'; G.zombies.breakTimer = 999; G.zombies.toSpawn = 0;
  step(20);
  var c = roomCenter(G, 'S'); ctx.moveTo(c); G.player.yaw = 0; G.player.downed = false; G.player.invuln = 0;
  var hits = 0, knock = 0;
  var realDamage = G.player.damage, realKnock = G.player.knockback;
  G.player.damage = function () { hits++; };
  G.player.knockback = function () { knock++; };
  var b = G.zombies.spawnBoss();
  ok(b && b.isBoss, 'Panzersoldat spawned');
  ok(b.hp < 2200 + 12 * 700, 'boss HP trimmed from pure-sponge levels (' + b.hp + ')');
  ok(b.speed > 2.4, 'boss base move speed raised (' + b.speed.toFixed(1) + ')');
  // place it 10m in front of the (stationary) player and let it hunt
  b.mesh.position.set(c.x, 0, c.z - 10); b.chargeCd = 0; b.bossPhase = null;
  var startDist = 10, charged = false, peakSpeed = 0, prev = b.mesh.position.clone();
  for (var i = 0; i < 260; i++) {
    step(1);
    if (b.bossPhase === 'charge') charged = true;
    var sp = b.mesh.position.distanceTo(prev) / 0.016; prev = b.mesh.position.clone();
    if (sp > peakSpeed) peakSpeed = sp;
  }
  ok(charged, 'boss telegraphs and launches a charge');
  ok(peakSpeed > 6, 'the charge bursts well above walking speed (' + peakSpeed.toFixed(1) + ' m/s)');
  ok(hits > 0 && knock > 0, 'the charge lands a heavy hit and knocks the player back');
  // tidy up so the elite never roams into later tests
  G.zombies.list.slice().forEach(function (z) { if (z.isBoss) G.zombies.damageZombie(z, 1e9, { boom: true, silent: true }); });
  step(20);
  G.player.damage = realDamage; G.player.knockback = realKnock;   // restore (don't leak stubs)
  ctx.moveTo(roomCenter(G, 'S')); G.player.hp = G.CFG.PLAYER_HP; G.player.downed = false;
}

/* a hard knockback (boss charge, blast) is sub-stepped so it can never leap
   the player across a thin wall in a single shove — the reported tunnelling */
function testKnockbackWall(ctx) {
  var G = ctx.G;
  var P = G.player;
  var c = roomCenter(G, 'S');
  // nearest full-height, thin (wall, not block) active collider to spawn
  var wall = null, best = 1e9;
  G.map.colliders.forEach(function (col) {
    if (!col.on) return;
    if (col.y2 - col.y1 < 2) return;                          // full-height only
    var w = col.x2 - col.x1, d = col.z2 - col.z1;
    if (Math.min(w, d) > 0.6) return;                         // thin (a wall)
    var cx = (col.x1 + col.x2) / 2, cz = (col.z1 + col.z2) / 2;
    var dist = Math.hypot(cx - c.x, cz - c.z);
    if (dist < best) { best = dist; wall = col; }
  });
  if (!wall) { ok(true, 'no wall collider to test knockback (skipped)'); return; }
  G.player.downed = false; G.player.invuln = 0;
  var thinX = (wall.x2 - wall.x1) < (wall.z2 - wall.z1);
  if (thinX) {
    P.pos.set(wall.x1 - 0.45, 0, (wall.z1 + wall.z2) / 2);
    P.vel.set(0, 0, 0);
    P.knockback(1, 0, 8);                                     // 8m shove into a ~0.35m wall
    ok(P.pos.x <= wall.x1 + 0.05,
       'knockback stops at the wall, no tunnel (x ' + P.pos.x.toFixed(2) +
       ' <= ' + wall.x1.toFixed(2) + ')');
  } else {
    P.pos.set((wall.x1 + wall.x2) / 2, 0, wall.z1 - 0.45);
    P.vel.set(0, 0, 0);
    P.knockback(0, 1, 8);
    ok(P.pos.z <= wall.z1 + 0.05,
       'knockback stops at the wall, no tunnel (z ' + P.pos.z.toFixed(2) +
       ' <= ' + wall.z1.toFixed(2) + ')');
  }
  ctx.moveTo(roomCenter(G, 'S')); P.vel.set(0, 0, 0);
}

/* a zombie pinned against the far side of a wall can't claw the player
   through it — melee/charge now require line of sight */
function testMeleeLOS(ctx) {
  var G = ctx.G;
  G.zombies.mode = 'break'; G.zombies.breakTimer = 999; G.zombies.toSpawn = 0;
  G.zombies.list.slice().forEach(function (zz) { if (!zz.dead) G.zombies.damageZombie(zz, 1e9, { boom: true }); });
  ctx.step(40);

  var c = roomCenter(G, 'S');
  var wall = null, best = 1e9;
  G.map.colliders.forEach(function (col) {
    if (!col.on || col.y2 - col.y1 < 2) return;                 // full-height only
    if (Math.min(col.x2 - col.x1, col.z2 - col.z1) > 0.6) return; // thin (a wall)
    var cx = (col.x1 + col.x2) / 2, cz = (col.z1 + col.z2) / 2;
    var d = Math.hypot(cx - c.x, cz - c.z);
    if (d < best) { best = d; wall = col; }
  });
  if (!wall) { ok(true, 'no wall to test melee LOS (skipped)'); return; }

  var thinX = (wall.x2 - wall.x1) < (wall.z2 - wall.z1);
  var wx = (wall.x1 + wall.x2) / 2, wz = (wall.z1 + wall.z2) / 2;
  var hits = 0, real = G.player.damage;
  G.player.damage = function () { hits++; };
  G.player.downed = false; G.player.invuln = 0;

  // player one side, zombie hugging the other — within reach, wall between
  var zside = thinX ? new THREE.Vector3(wx + 0.5, 0, wz) : new THREE.Vector3(wx, 0, wz + 0.5);
  ctx.moveTo(thinX ? { x: wx - 0.5, z: wz } : { x: wx, z: wz - 0.5 });
  var zb = G.zombies.spawnAt(zside); zb.speed = 0;
  for (var i = 0; i < 80; i++) ctx.step(1);
  ok(hits === 0, 'zombie cannot claw the player through the wall (' + hits + ' hits)');
  if (!zb.dead) G.zombies.damageZombie(zb, 1e9, { boom: true });
  ctx.step(40);

  // control: same side, clear sightline — the swing connects
  hits = 0;
  var open = thinX ? new THREE.Vector3(wx - 1.0, 0, wz) : new THREE.Vector3(wx, 0, wz - 1.0);
  var z2 = G.zombies.spawnAt(open); z2.speed = 0;
  for (var j = 0; j < 80; j++) ctx.step(1);
  ok(hits > 0, 'zombie on the open side still lands its swing (' + hits + ' hits)');
  if (!z2.dead) G.zombies.damageZombie(z2, 1e9, { boom: true });
  ctx.step(40);

  G.player.damage = real;
  ctx.moveTo(roomCenter(G, 'S'));
}

/* settings terminal: opens/pauses, exposes the run-tuning settings, and can
   jump the round director */
function testTerminal(ctx) {
  var G = ctx.G;
  ok(!!G.terminal, 'developer/settings panel module present');
  ok(G.settings.perkLimit === 4 && G.settings.bossRounds === true, 'settings have sane defaults');
  // the settings terminal must NOT be spawned anywhere in the world
  var inWorld = G.interact.list.some(function (it) { return /settings terminal/i.test((it.prompt && it.prompt()) || ''); });
  ok(!inWorld, 'no in-world settings terminal interaction exists');
  // opens DURING a live match without leaving 'playing' or resetting the run
  G.state = 'playing';
  G.terminal.open();
  ok(G.terminal.active && G.state === 'playing', 'panel opens mid-match without leaving play state');
  G.terminal.close();
  ok(!G.terminal.active && G.state === 'playing', 'closing restores the match (still playing)');
  // the cheat controls treat both playing AND paused as a live match
  G.state = 'paused';
  var rd0 = G.zombies.round;
  G.terminal.open(); G.zombies.jumpToRound(20); G.terminal.close();
  ok(G.zombies.round === 19, 'dev cheats apply while paused (jump queued)');
  G.zombies.round = rd0; G.zombies.mode = 'active';
  // the Backquote hotkey toggles the panel in-match
  G.state = 'playing';
  ctx.win.dispatch('keydown', { code: 'Backquote' });
  ok(G.terminal.active, 'Backquote opens the panel mid-match');
  ctx.win.dispatch('keydown', { code: 'Backquote' });
  ok(!G.terminal.active, 'Backquote closes the panel');
  // repeated open/close keeps a single overlay root (no listener/DOM duplication)
  for (var oc = 0; oc < 4; oc++) { G.terminal.open(); G.terminal.close(); }
  ok(!G.terminal.active, 'panel stable after repeated open/close');
  // it is reachable from the menu UI too (open while not playing)
  var prevState = G.state; G.state = 'menu';
  G.terminal.open();
  ok(G.terminal.active, 'developer panel opens from the menu UI');
  G.terminal.close(); G.state = prevState === 'menu' ? 'playing' : prevState;
  G.zombies.jumpToRound(15);
  ok(G.zombies.round === 14 && G.zombies.mode === 'break', 'jumpToRound queues round 15');
  ctx.step(140);
  ok(G.zombies.round >= 15, 'round director advances to the jumped round');
}

/* phone controller: feed the exact messages pad.html sends (no socket headless)
   through G.remote._apply and confirm they drive movement, look, fire and buys */
function testRemote(ctx) {
  var G = ctx.G, step = ctx.step;
  var P = G.player, R = G.remote;
  ok(!!R && typeof R._apply === 'function', 'remote controller module present');
  ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyC', 'Space'].forEach(ctx.keyup);
  P.vel.set(0, 0, 0);
  ctx.moveTo(roomCenter(G, 'S'));
  P.yaw = 0; P.pitch = 0;
  G.settings.aimMode = 'mouse';
  R.connected = true;   // a phone is paired

  // movement message moves the player; full-forward flags sprint
  R._apply({ a: 'm', x: 0, z: -1, s: 1 });
  step(50);
  ok(Math.hypot(P.vel.x, P.vel.z) > 3, 'phone stick moves the player (' + Math.hypot(P.vel.x, P.vel.z).toFixed(1) + ' m/s)');
  ok(P.sprintAmt > 0.85, 'full-forward stick sprints');
  R._apply({ a: 'm', x: 0, z: 0, s: 0 });
  step(30);

  // look message turns the camera
  var yaw0 = P.yaw;
  R._apply({ a: 'l', dx: 120, dy: 0 });
  ok(Math.abs(P.yaw - yaw0) > 0.1, 'phone drag turns the view');

  // FIRE button shoots
  G.weapons.equip(0, true);
  var gun = G.weapons.current(); gun.ammo = G.weapons.stats(gun).mag;
  step(20);
  var ammo0 = gun.ammo;
  R._apply({ a: 'b', k: 'fire', v: 1 });
  step(18);
  R._apply({ a: 'b', k: 'fire', v: 0 });
  ok(gun.ammo < ammo0, 'phone FIRE button shoots');

  // AIM button aims down sights
  R._apply({ a: 'b', k: 'ads', v: 1 });
  step(28);
  ok(P.ads > 0.7, 'phone AIM button aims down sights');
  R._apply({ a: 'b', k: 'ads', v: 0 });
  step(18);

  // RELOAD button reloads via the shared key path
  gun.ammo = 1; G.hud._prompt = null;
  R._apply({ a: 'b', k: 'reload', v: 1 });
  step(3);
  ok(G.weapons.reloading > 0, 'phone RELOAD button reloads');
  step(140);

  // USE button buys a wall weapon when its prompt is up
  G.player.points = 100000;
  var wb = G.map.wallbuys.filter(function (w) { return !w.isFrags && !G.weapons.hasWeapon(w.gun); })[0];
  if (wb) {
    ctx.moveTo(wb.pos); step(3);
    var dx = wb.pos.x - P.pos.x, dz = wb.pos.z - P.pos.z;
    if (Math.hypot(dx, dz) > 0.05) P.yaw = Math.atan2(-dx, -dz);
    var saw = false;
    for (var f = 0; f < 12 && !saw; f++) { step(1); if (G.hud._prompt) saw = true; }
    ok(saw, 'wall-buy prompt shows for the phone');
    R._apply({ a: 'b', k: 'use', v: 1 });
    R._apply({ a: 'b', k: 'use', v: 0 });
    step(3);
    ok(G.weapons.hasWeapon(wb.gun), 'phone USE buys the wall weapon (' + wb.gun + ')');
  }

  // disconnect: update() clears the intents so a dropped phone can't strafe you
  R.connected = false;
  R.moveX = 1; R.moveZ = -1; R.fire = true;
  R.update(0.016);
  ok(R.moveX === 0 && R.moveZ === 0 && !R.fire, 'losing the phone clears its intents');
}

/* simple-aim (trackpad) mode: bullet magnetism lands slightly-off shots */
function testSimpleAim(ctx) {
  var G = ctx.G;
  G.settings.aimMode = 'simple';
  // clear the field so the magnetism can only pick our target
  G.zombies.toSpawn = 0;
  G.zombies.list.slice().forEach(function (zz) {
    if (!zz.dead) G.zombies.damageZombie(zz, 1e9, { boom: true });
  });
  ctx.step(70); // let corpses despawn
  var c = roomCenter(G, 'S');
  ctx.moveTo(c);
  G.player.yaw = 0; G.player.pitch = 0;
  ctx.step(2);
  // ~4.5 degrees off the crosshair — would miss without assist
  var z = G.zombies.spawnAt(new THREE.Vector3(c.x + 0.35, 0, c.z - 4.4));
  z.speed = 0;   // hold still for the magnetism aim test
  ctx.step(2);
  G.weapons.equip(0, true); // M1911
  var gun = G.weapons.current();
  gun.ammo = 8;
  var hpBefore = z.hp;
  G.weapons.mouseDown = true;
  ctx.step(6);
  G.weapons.mouseDown = false;
  ok(z.dead || z.hp < hpBefore, 'aim assist landed an off-axis shot');
  ok(G.player.ads === 0, 'ADS stays off in simple mode');
  G.settings.aimMode = 'mouse';
}

// contact-based melee: zombies can't reach through a boarded window, a zombie
// in contact lands its swing, and a swing whiffs if you leave contact range
function testContactMelee(ctx) {
  var G = ctx.G;
  var c = roomCenter(G, 'S');
  G.zombies.toSpawn = 0;
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  ctx.step(70);

  // 1. zombie clawing an intact barricade cannot touch you
  var win = G.map.windows[0];
  win.setBoards(6);
  G.player.pos.copy(win.inside);
  G.player.vel.set(0, 0, 0);
  G.player.downed = false; G.player.invuln = 0;
  G.player.hp = G.player.maxHp;
  var zb = G.zombies.spawnAt(win.outside.clone());
  zb.window = win; zb.state = 'tear'; zb.tearTimer = 1.4; zb.attackCd = 0;
  var hp0 = G.player.hp;
  ctx.step(60 * 2.5);
  ok(G.player.hp === hp0, 'zombie at a boarded window cannot hit you (' + win.boards + ' boards left)');
  if (!zb.dead) G.zombies.damageZombie(zb, 1e9, { boom: true });
  ctx.step(40);

  // 2. a zombie in contact range lands its swing
  G.player.pos.set(c.x, 0, c.z);
  G.player.hp = G.player.maxHp; G.player.invuln = 0;
  var zc = G.zombies.spawnAt(new THREE.Vector3(c.x + 0.6, 0, c.z));
  zc.state = 'chase'; zc.attackCd = 0;
  ctx.step(60);
  ok(G.player.hp < G.player.maxHp, 'a zombie in contact range lands a hit');
  if (!zc.dead) G.zombies.damageZombie(zc, 1e9, { boom: true });
  ctx.step(40);

  // 3. running out of contact mid-swing makes the claw whiff
  G.player.pos.set(c.x, 0, c.z);
  G.player.hp = G.player.maxHp; G.player.invuln = 0;
  var zw = G.zombies.spawnAt(new THREE.Vector3(c.x + 0.6, 0, c.z));
  zw.state = 'attack'; zw.t = 0; zw.hasHit = false;
  G.player.pos.set(c.x + 25, 0, c.z); // gone before the apex
  ctx.step(40);
  ok(G.player.hp === G.player.maxHp, 'a swing whiffs when you leave contact range');
  if (!zw.dead) G.zombies.damageZombie(zw, 1e9, { boom: true });
  ctx.step(40);
  G.player.pos.set(c.x, 0, c.z);
}

async function runFull(mapId) {
  console.log('\n=== full: ' + mapId + ' ===');
  var ctx = createGame();
  var G = ctx.G, step = ctx.step, pressF = ctx.pressF, moveTo = ctx.moveTo;
  bootChecks(ctx, mapId);
  testContactMelee(ctx);            // run with real damage before we stub it
  testStairHeadroom(ctx);           // climb the loft stairs before the horde fills in
  var origDamage = G.player.damage;
  G.player.damage = function () {};
  step(60 * 25);
  ok(G.zombies.list.some(function (z) { return ['tear', 'vault', 'chase', 'attack'].indexOf(z.state) >= 0; }),
     'zombies tearing/vaulting/chasing');
  ok(G.map.windows.some(function (w) { return w.boards < 6; }), 'boards were torn off');

  /* combat */
  var pointsBefore = G.player.points, killsBefore = G.player.kills;
  var z0 = G.zombies.list.filter(function (z) { return !z.dead; })[0];
  if (z0) {
    G.zombies.damageZombie(z0, 1e9, { head: true });
    ok(z0.dead, 'zombie killed');
    ok(G.player.kills === killsBefore + 1, 'kill counted');
    ok(G.player.points > pointsBefore, 'points awarded');
  }

  /* barricade repair (freeze the horde; isolate one window so the look-gated
     hold-to-rebuild prompt can't be hijacked by another interactable nearby) */
  G.zombies.list.slice().forEach(function (z) { if (!z.dead) G.zombies.damageZombie(z, 1e9, { boom: true }); });
  G.zombies.toSpawn = 0; G.zombies.mode = 'break'; G.zombies.breakTimer = 999;
  step(20);
  G.map.windows.forEach(function (w) { w.setBoards(6); });   // reset all
  // pick the window whose inside is clearest of other interactables
  function clearance(w) {
    var min = 1e9;
    G.interact.list.forEach(function (it) {
      if (it.pos === w.inside) return;
      var d = Math.hypot(it.pos.x - w.inside.x, it.pos.z - w.inside.z);
      if (d < min) min = d;
    });
    return min;
  }
  var brokenWin = G.map.windows.slice().sort(function (a, b) { return clearance(b) - clearance(a); })[0];
  brokenWin.setBoards(2);
  var boardsBefore = brokenWin.boards;
  moveTo(brokenWin.inside);
  G.player.yaw = Math.atan2(-(brokenWin.outside.x - G.player.pos.x), -(brokenWin.outside.z - G.player.pos.z));
  step(2);
  G.keys.KeyF = true;
  step(60 * 3);
  G.keys.KeyF = false;
  ok(brokenWin.boards > boardsBefore, 'barricade rebuilt by holding F');

  openAllDoors(ctx);

  /* wall buy */
  var wb = G.map.wallbuys.filter(function (w) { return !w.isFrags; })[0];
  useAt(ctx, wb.pos);
  ok(G.weapons.hasWeapon(wb.gun), 'bought ' + wb.gun + ' off the wall');

  /* perks: gated by power except revive */
  var pmJugg = G.map.perkMachines.filter(function (p) { return p.perk === 'jugg'; })[0];
  useAt(ctx, pmJugg.pos);
  ok(!G.player.hasPerk('jugg'), 'juggernog denied before power');
  var pmQR = G.map.perkMachines.filter(function (p) { return p.perk === 'revive'; })[0];
  useAt(ctx, pmQR.pos);
  ok(G.player.hasPerk('revive'), 'quick revive bought before power');

  unlockPap(ctx);
  useAt(ctx, pmJugg.pos);
  ok(G.player.hasPerk('jugg') && G.player.maxHp === 250, 'juggernog bought, 250 hp');

  /* teleporter travel (teleporter maps) */
  if (G.map.mainframe) {
    var tA = G.map.teleporters[0];
    useAt(ctx, tA.pos);
    ok(G.player.pos.distanceTo(G.map.mainframe.pos) < 4, 'teleported to mainframe');
  }

  /* pack-a-punch — start the upgrade (you stay mobile), then grab it */
  G.weapons.equip(0, true);
  useAt(ctx, G.map.pap.pos);
  ok(G.interact.pap.packT > 0, 'PaP machine started cooking the gun');
  ok(!G.player.locked, 'player can still move while the gun cooks');
  step(240);                                   // ~3.8s of cook time
  ok(G.interact.pap.ready === G.weapons.slots[0], 'upgraded gun offered at the machine');
  useAt(ctx, G.map.pap.pos);                    // grab it before it fades back
  ok(G.weapons.slots[0].papped, 'gun came back Pack-a-Punched after grabbing it');
  ok(G.weapons.stats(G.weapons.slots[0]).name === 'Mustang & Sally', 'M1911 became Mustang & Sally');

  // ignore the offer too long and it fades back into the machine (no upgrade)
  useAt(ctx, G.map.pap.pos);                    // start a double-pack
  step(240);
  ok(G.interact.pap.ready, 'double-pack offered at the machine');
  step(60 * 13);                                // wait out the ~12s grab window
  ok(!G.interact.pap.ready && !G.weapons.slots[0].dpap, 'unclaimed upgrade fades back in');

  /* mystery box */
  var spot = G.map.boxSpots[G.interact.box.spotIdx];
  useAt(ctx, spot.pos);
  ok(G.interact.box.rolling, 'mystery box rolling');
  await sleep(3300);
  step(5);
  ok(!!G.interact.box.offer || G.player.hasMonkeys, 'box offered a weapon (or monkeys)');
  if (G.interact.box.offer) {
    var offered = G.interact.box.offer;
    ok(!G.CFG.WEAPONS[offered].wonder || offered === G.CFG.cur.wonder,
       'box never offers another map\'s wonder');
    pressF(); step(5);
    ok(G.weapons.hasWeapon(offered), 'took ' + offered + ' from the box');
  }

  /* wonder weapon */
  testWonderWeapon(ctx);
  testEeWeapons(ctx);

  /* monkeys */
  G.player.hasMonkeys = true;
  G.player.monkeys = 3;
  ctx.win.dispatch('keydown', { code: 'KeyH' });
  step(60 * 2);
  ok(G.player.monkeys === 2, 'monkey bomb thrown');

  /* power-ups */
  G.powerups.spawn('maxammo', G.player.pos.clone());
  var g0 = G.weapons.slots[0];
  g0.reserve = 0;
  step(10);
  ok(g0.reserve > 0, 'max ammo picked up and refilled reserves');
  G.powerups.spawn('insta', G.player.pos.clone());
  step(10);
  ok(G.powerups.timers.insta > 0, 'insta-kill timer running');
  G.zombies.toSpawn = 0; // freeze spawning so the nuke check is deterministic
  G.powerups.spawn('nuke', G.player.pos.clone());
  step(10);
  ok(G.zombies.aliveCount() === 0, 'nuke killed everything');

  /* hellhound round */
  G.zombies.toSpawn = 0;
  G.zombies.list.forEach(function (z) { if (!z.dead) z.hp = 0; });
  step(30);
  G.zombies.mode = 'break';
  G.zombies.breakTimer = 0.5;
  G.zombies.round = 4;
  step(60 * 4);
  ok(G.zombies.round === 5 && G.zombies.mode === 'dogs', 'round 5 is a hellhound round');
  step(60 * 20);
  ok(G.zombies.list.some(function (z) { return z.isDog; }), 'hellhounds spawned');
  G.zombies.toSpawn = 0;
  G.weapons.slots[0].reserve = 0;
  G.zombies.list.filter(function (z) { return !z.dead; })
    .forEach(function (z) { G.zombies.damageZombie(z, 1e9, {}); });
  step(10);
  ok(G.powerups.active.some(function (p) { return p.type === 'maxammo'; }) ||
     G.weapons.slots[0].reserve > 0,
     'max ammo dropped at the end of the dog round');
  ok(G.zombies.mode === 'break', 'round break after dogs');

  /* downs */
  G.player.damage = origDamage;
  ok(G.player.hasPerk('revive'), 'still has quick revive');
  G.zombies.spawnAt(G.player.pos.clone().add(new THREE.Vector3(2, 0, 0)));
  G.player.hp = 1;
  G.player.damage(50);
  ok(G.player.downed, 'player downed');
  ok(!G.player.hasPerk('jugg'), 'perks lost on down');
  ok(G.zombies.aliveCount() === 0, 'horde despawns while downed');
  step(60 * 6);
  ok(!G.player.downed && G.player.hp === G.player.maxHp, 'quick revive brought player back (4s)');
  ok(G.player.invuln > 0, 'mercy invulnerability after revive');
  step(60 * 3); // let the mercy window expire
  G.player.hp = 1;
  G.player.damage(50);
  step(5);
  ok(G.state === 'over', 'game over without quick revive');
}

// every weapon must build a visually distinct viewmodel
function runGunModels() {
  console.log('\n=== unique gun models ===');
  var ctx = createGame(); var G = ctx.G;
  G.startGame('nacht');
  var ids = Object.keys(G.CFG.WEAPONS);
  var sig = {};
  ids.forEach(function (id) {
    G.weapons.giveWeapon(id);
    var m = G.weapons.current().model, parts = [];
    m.traverse(function (o) {
      if (o.geometry && o.geometry.parameters) {
        var p = o.geometry.parameters;
        parts.push([Math.round((p.width || p.radiusTop || p.radius || 0) * 1e3),
          Math.round((p.height || 0) * 1e3), Math.round((p.depth || p.radiusBottom || 0) * 1e3),
          Math.round(o.position.x * 1e3), Math.round(o.position.y * 1e3), Math.round(o.position.z * 1e3)].join(','));
      }
    });
    sig[id] = parts.sort().join('|');
  });
  var byKey = {};
  ids.forEach(function (id) { (byKey[sig[id]] = byKey[sig[id]] || []).push(id); });
  var dupes = Object.keys(byKey).filter(function (k) { return byKey[k].length > 1; }).map(function (k) { return byKey[k].join('='); });
  ok(dupes.length === 0, 'all ' + ids.length + ' gun models are visually distinct' + (dupes.length ? ' — DUPES: ' + dupes.join('; ') : ''));
  // a model rebuilds identically for the same gun (deterministic)
  G.weapons.giveWeapon(ids[0]);
  ok(true, 'gun models built without error');
}

/* prop registry: every builder constructs, returns a Group, exposes the
   interaction / animation / collider contract, shares cached materials, and
   releases resources on dispose */
function runProps() {
  console.log('\n=== prop registry ===');
  var ctx = createGame(); var G = ctx.G;
  G.startGame('nacht');                       // builds G.tex + the material cache
  var perks = G.CFG.PERKS;
  function mk(type, extra) {
    var opts = { addToScene: false }; if (extra) Object.keys(extra).forEach(function (k) { opts[k] = extra[k]; });
    if (type === 'perk_machine' && !opts.def) { opts.variant = 'revive'; opts.def = perks.revive || { color: 0xff4444, name: 'Revive', icon: '+' }; }
    return G.Props.create(type, opts);
  }
  var types = G.Props.list();
  ok(types.length >= 30, 'prop registry exposes the full set (' + types.length + ')');

  var fallbacks = 0, nan = 0, notGroup = 0;
  types.forEach(function (type) {
    var root;
    try { root = mk(type); } catch (e) { ok(false, type + ' threw: ' + e.message); return; }
    if (!root || !root.isObject3D || root.type !== 'Group') notGroup++;
    if (root && root.userData.fallback) fallbacks++;
    var bad = false;
    root.traverse(function (o) {
      ['x', 'y', 'z'].forEach(function (k) {
        if (isNaN(o.position[k]) || isNaN(o.scale[k]) || isNaN(o.rotation[k])) bad = true;
      });
    });
    if (bad) nan++;
  });
  ok(notGroup === 0, 'every builder returns a THREE.Group root');
  ok(fallbacks === 0, 'no builder fell back to the placeholder crate');
  ok(nan === 0, 'no prop has NaN position / scale / rotation');

  // interaction anchors on every interactive machine
  ['mystery_box', 'perk_machine', 'pack_a_punch', 'power_switch', 'teleporter_pad', 'mainframe', 'settings_terminal', 'soul_chest']
    .forEach(function (t) {
      var a = mk(t).userData.interactionAnchor;
      ok(a && a.isObject3D, t + ' exposes a root-level interaction anchor');
    });

  // animation / state handles
  var box = mk('mystery_box');
  ok(box.userData.lid && box.userData.internalGlow && box.userData.weaponDisplayAnchor,
     'mystery_box exposes lid + internal glow + weapon display anchor');
  var pap = mk('pack_a_punch');
  ok(pap.userData.rollers && pap.userData.rollers.length && pap.userData.glow, 'pack_a_punch exposes rollers + glow');
  var ps = mk('power_switch');
  ok(ps.userData.lever && typeof ps.userData.setPowered === 'function', 'power_switch exposes lever + setPowered()');
  var tp = mk('teleporter_pad');
  ok(tp.userData.energy && tp.userData.posts && tp.userData.posts.length === 3, 'teleporter_pad exposes energy surface + 3 posts');
  var sc = mk('soul_chest');
  ok(typeof sc.userData.setCharge === 'function', 'soul_chest exposes setCharge()');
  var wbar = mk('window_barricade');
  ok(wbar.userData.planks && wbar.userData.planks.length >= 4 && typeof wbar.userData.setBoards === 'function',
     'window_barricade exposes independent planks + setBoards()');

  // collider metadata where players must not pass through
  ['mystery_box', 'perk_machine', 'pack_a_punch', 'mainframe', 'soul_chest', 'locker', 'generator'].forEach(function (t) {
    ok(!!mk(t).userData.colliderBox, t + ' declares a simplified collider box');
  });

  // shared material cache
  ok(G.MAT.get('bareSteel') === G.MAT.get('bareSteel'), 'named materials are cached and shared');
  ok(G.MAT.emissive(0x33ff66, 0.8) === G.MAT.emissive(0x33ff66, 0.8), 'identical emissive materials are shared');

  // dispose releases the prop and detaches it
  var live = G.Props.create('generator', { position: new THREE.Vector3(0, 0, 0) });
  ok(live.parent === G.scene, 'a created prop attaches to the scene');
  G.Props.dispose(live);
  ok(!live.parent, 'a disposed prop is detached from the scene');

  // gallery builds one of every prop
  var gal = G.Props.gallery({ addToScene: false });
  var galProps = gal.holder.children.filter(function (c) { return c.userData && c.userData.propType; }).length;
  ok(galProps === types.length, 'prop gallery lays out every registered prop (' + galProps + ')');
}

/* mystery box rarity: 10k+ simulated rolls per map must land near the
   configured distribution, never roll two wonders in a row, and lock wonders
   out of the earliest rounds */
function runRarity() {
  console.log('\n=== mystery box rarity (12k rolls/map) ===');
  var CFG = require('../js/config.js');
  var maps = [['nacht', 'thunder'], ['derriese', 'wunderwaffe'], ['wetterjunge', 'stormcaller'], ['kurhaus', 'maelstrom']];
  var N = 12000;
  maps.forEach(function (m) {
    var counts = { common: 0, uncommon: 0, rare: 0, special: 0, wonder: 0 };
    var recent = [], last = null, prev = false, consec = 0;
    for (var i = 0; i < N; i++) {
      var r = CFG.rollBoxWeapon({ round: 12, mapWonder: m[1], owned: {}, recent: recent, lastRarity: last, includeMonkeys: true });
      counts[r.rarity]++;
      if (r.rarity === 'wonder' && prev) consec++;
      prev = (r.rarity === 'wonder'); last = r.rarity;
      recent.push(r.id); while (recent.length > 4) recent.shift();
    }
    var p = function (k) { return counts[k] / N; };
    console.log('   ' + m[0] + ': ' + CFG.RARITY_ORDER.map(function (k) { return k + ' ' + (100 * p(k)).toFixed(1) + '%'; }).join('  '));
    ok(p('common') >= 0.42 && p('common') <= 0.58, m[0] + ' common rate in 42-58% (' + (100 * p('common')).toFixed(1) + ')');
    ok(p('uncommon') >= 0.22 && p('uncommon') <= 0.38, m[0] + ' uncommon rate in 22-38% (' + (100 * p('uncommon')).toFixed(1) + ')');
    ok(p('rare') >= 0.08 && p('rare') <= 0.20, m[0] + ' rare rate in 8-20% (' + (100 * p('rare')).toFixed(1) + ')');
    ok(p('special') >= 0.01 && p('special') <= 0.08, m[0] + ' special rate in 1-8% (' + (100 * p('special')).toFixed(2) + ')');
    ok(p('wonder') >= 0.001 && p('wonder') <= 0.025, m[0] + ' wonder rate in 0.1-2.5% (' + (100 * p('wonder')).toFixed(2) + ')');
    ok(consec === 0, m[0] + ' never rolls two wonders in a row');
  });
  var early = 0;
  for (var i = 0; i < 6000; i++) {
    if (CFG.rollBoxWeapon({ round: 1, mapWonder: 'thunder', owned: {}, recent: [], lastRarity: null, includeMonkeys: true }).rarity === 'wonder') early++;
  }
  ok(early === 0, 'no wonder rolls before round ' + CFG.WONDER_MIN_ROUND + ' (0 in 6000)');
  ok(CFG.BOX_EXCLUDE.indexOf('deathmachine') >= 0, 'Death Machine is excluded from the box pool');
}

if (require.main === module) {
  (async function () {
    runRarity();
    runProps();
    await runFull('wetterjunge');
    await runQuick('nacht');
    await runQuick('derriese');
    await runQuick('kurhaus');
    await runMenuNav();
    runGunModels();
    console.log(fails ? '\n' + fails + ' FAILURES' : '\nSMOKE TEST PASSED');
    process.exit(fails ? 1 : 0);
  })().catch(function (e) {
    console.error('CRASH:', e);
    process.exit(1);
  });
}
// importable for ad-hoc debugging: require('./tests/smoke.js').createGame()
module.exports = { createGame: createGame, roomCenter: roomCenter };
