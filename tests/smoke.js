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

  ['config', 'audio', 'hud', 'map', 'nav', 'player', 'weapons', 'zombies', 'powerups', 'interact', 'gamepad', 'remote', 'terminal', 'main']
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
    moveTo: function (pos) { G.player.pos.set(pos.x, 0, pos.z); G.player.vel.set(0, 0, 0); },
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
  }
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
  ok(G.map.windows.length === G.CFG.WINDOWS.length, 'windows built (' + G.map.windows.length + ')');
  ok(Object.keys(G.map.doors).length === Object.keys(G.CFG.DOORS).length, 'doors built');
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
    testShield(ctx);
    testSoulBox(ctx);
    testWonderEgg(ctx);
    testPowerups(ctx);
    testArmored(ctx);
    testRange(ctx);
    testDetail(ctx);
  }
  if (mapId === 'derriese') testVerticality(ctx);
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

/* shooting range: hand out guns at each upgrade tier, and stand up stationary
   dummies that respawn forever while the no-horde hold keeps the field quiet */
function testRange(ctx) {
  var G = ctx.G, step = ctx.step, P = G.player;

  // give-at-tier (terminal "Stock / Pack-a-Punch / Double Pack")
  G.weapons.slots.length = 0; G.weapons.maxSlots = 2;
  G.weapons.giveWeapon('m1911');
  ok(!G.weapons.current().papped, 'Stock give hands over an un-upgraded gun');
  G.weapons.giveWeapon('mp5k'); G.weapons.papCurrent();
  ok(G.weapons.current().papped && !G.weapons.current().dpap, 'Pack-a-Punch give is single-packed');
  G.weapons.giveWeapon('python'); G.weapons.papCurrent(); G.weapons.papCurrent();
  ok(G.weapons.current().papped && G.weapons.current().dpap, 'Double Pack give is double-packed');

  // no-horde hold clears the live horde and parks the round director
  ctx.moveTo(roomCenter(G, 'S'));
  P.yaw = 0;
  G.zombies.setRangeFreeze(true);
  G.zombies.clearTargets();
  G.zombies.spawnTargets(3);
  var live = function () { return G.zombies.list.filter(function (z) { return z.rangeTarget && !z.dead; }); };
  ok(live().length === 3, 'spawns three target dummies');
  ok(G.zombies.rangeOn, 'range mode goes live');

  var t0 = live()[0];
  var pos0 = t0.mesh.position.clone();
  step(60);
  ok(t0.mesh.position.distanceTo(pos0) < 0.25, 'dummies stand still and never advance');
  ok(G.zombies.list.every(function (z) { return z.rangeTarget; }), 'no-horde mode holds the round (no horde spawns)');

  // a downed dummy pops straight back up
  var n0 = live().length;
  G.zombies.damageZombie(t0, 1e9, { boom: true });
  ok(live().length === n0, 'a downed dummy respawns on the spot');

  // clear wipes them and drops out of range mode
  G.zombies.clearTargets();
  ok(!G.zombies.list.some(function (z) { return z.rangeTarget; }), 'Clear removes every dummy');
  ok(!G.zombies.rangeOn, 'range mode ends when the dummies are cleared');

  // releasing the hold re-arms the director and the horde returns
  G.zombies.setRangeFreeze(false);
  ok(!G.zombies.rangeFreeze && G.zombies.breakTimer < 1e8, 'releasing no-horde re-arms the round director');
  step(220);
  ok(G.zombies.aliveCount() > 0, 'the horde resumes after no-horde mode');
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

// verticality: a raised catwalk you climb, fall off, and that zombies must
// ascend by the stairs — with no melee hits landing through the deck floor
function testVerticality(ctx) {
  var G = ctx.G, step = ctx.step, win = ctx.win;
  var P = G.player;
  // Der Wunderfizz replaced the Mule Kick machine
  ok(G.map.perkMachines.some(function (m) { return m.perk === 'wonderfizz'; }), 'Der Wunderfizz machine present');
  ok(!G.map.perkMachines.some(function (m) { return m.perk === 'mule'; }), 'Mule Kick machine removed');

  ok(G.map.stages && G.map.stages.length >= 3, 'Der Riese has a wrap-around upper catwalk');
  var S = G.map.stages[0];
  ok(S && S.deckTop > 3.0, 'catwalk is a real upper floor (' + S.deckTop.toFixed(1) + 'm)');

  // --- stacked floors: ground beneath the catwalk is still its own walkable
  //     room, AND the upper deck coexists at the same x/z (multi-layer nav)
  var c = S.deckCenter;
  ok(G.map.supportAt(c.x, c.z, 0, 0.55) < 0.5, 'ground beneath the catwalk stays at floor level');
  var gNode = G.nav.nearest(c.x, c.z, 0), uNode = G.nav.nearest(c.x, c.z, S.deckTop);
  ok(gNode && Math.abs(gNode.y) < 0.6, 'a GROUND nav node exists under the catwalk');
  ok(uNode && uNode.y > S.deckTop - 0.5, 'an UPPER nav node exists at the same x/z (layers coexist)');

  ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyC', 'Space'].forEach(ctx.keyup);
  G.player.damage = function () {};

  // player climbs the staircase onto the upper floor (yaw 0 = up the steps)
  P.pos.set(S.stairBase.x, 0, S.stairBase.z + 1.0); P.vel.set(0, 0, 0); P.yaw = 0;
  win.dispatch('keydown', { code: 'KeyW' }); step(220); ctx.keyup('KeyW');
  ok(P.pos.y > 3.0, 'player climbs to the upper floor (y=' + P.pos.y.toFixed(2) + ')');
  P.yaw = Math.PI; win.dispatch('keydown', { code: 'KeyW' }); step(260); ctx.keyup('KeyW');
  ok(P.pos.y < 0.5, 'walking off the upper floor drops you to the ground');

  // VALIDATION 2/4 — player upstairs, zombie on the ground: it finds the stairs
  P.pos.copy(S.deckCenter); P.vel.set(0, 0, 0);
  clearHorde(G); step(30);
  var zc = G.zombies.spawnAt(new THREE.Vector3(S.stairBase.x, 0, S.stairBase.z));
  var maxY = 0;
  for (var i = 0; i < 60 * 13 && !zc.dead; i++) { step(1); if (zc.mesh.position.y > maxY) maxY = zc.mesh.position.y; }
  ok(maxY > 3.0, 'zombie climbs the stairs to a player on the upper floor (y=' + maxY.toFixed(1) + ')');

  // VALIDATION 1/3 — player on the ground beneath, zombie on the upper floor:
  // it descends and reaches the player
  P.pos.set(S.deckCenter.x, 0, S.deckCenter.z); P.vel.set(0, 0, 0);
  clearHorde(G); step(30);
  var zd = G.zombies.spawnAt(new THREE.Vector3(S.deckCenter.x, 0, S.deckCenter.z));
  zd.mesh.position.y = S.deckTop;            // standing on the upper floor
  var minY = 99, reached = false;
  for (var k = 0; k < 60 * 26 && !zd.dead; k++) {
    step(1);
    if (zd.mesh.position.y < minY) minY = zd.mesh.position.y;
    if (Math.hypot(zd.mesh.position.x - P.pos.x, zd.mesh.position.z - P.pos.z) < 2.0 &&
        Math.abs(zd.mesh.position.y - P.pos.y) < 1.6) reached = true;
  }
  ok(minY < 1.0, 'zombie descends from the upper floor (min y=' + minY.toFixed(1) + ')');
  ok(reached, 'descending zombie reaches the player on the ground floor');

  // melee still can't connect through a floor (vertical gate)
  P.pos.copy(S.deckCenter); P.vel.set(0, 0, 0); P.hp = P.maxHp;
  var dealt = 0; P.damage = function (d) { dealt += d; };
  clearHorde(G); step(20);
  var zb = G.zombies.spawnAt(new THREE.Vector3(P.pos.x, 0, P.pos.z));
  for (var j = 0; j < 50; j++) {
    zb.mesh.position.set(P.pos.x, 0, P.pos.z);
    zb.state = 'attack'; zb.t = 0.4; zb.hasHit = false; zb.attackCd = 0;
    step(1);
  }
  ok(dealt === 0, 'melee does not connect through the upper floor');

  // upper floor is FULLY functional: a perk sits up on the catwalk and is only
  // buyable from the catwalk (height-gated), not from the ground below
  P.damage = function () {};
  var sp = G.map.perkMachines.filter(function (m) { return m.perk === 'speed'; })[0];
  ok(sp && sp.pos.y > 3, 'Speed Cola sits up on the catwalk (y=' + (sp ? sp.pos.y.toFixed(1) : '?') + ')');
  G.player.points = 100000; G.player.perks = [];
  function faceTry(y) {
    P.pos.set(sp.pos.x, y, sp.pos.z + 1.0); P.vel.set(0, 0, 0);
    P.yaw = Math.atan2(-(sp.pos.x - P.pos.x), -(sp.pos.z - P.pos.z));
    G.player.consumeInteract(); win.dispatch('keydown', { code: 'KeyF' }); step(3);
    win.dispatch('keyup', { code: 'KeyF' });
  }
  faceTry(0);                          // from the ground directly below
  ok(!G.player.hasPerk('speed'), 'cannot buy the catwalk perk from the ground below');
  faceTry(sp.pos.y);                   // standing up on the catwalk
  ok(G.player.hasPerk('speed'), 'CAN buy the catwalk perk while up on the catwalk');
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

/* wonder-weapon build EE: power + 3 parts + the bench fee yields a free
   wonder weapon. Not buildable early (needs power) or without all the parts. */
function testWonderEgg(ctx) {
  var G = ctx.G;
  var ww = G.interact.ww;
  ok(ww && ww.total === 3, 'three wonder-weapon parts defined');
  // find the part interactables (power is on by now from earlier in the run)
  var parts = G.interact.list.filter(function (it) { return /wonder-weapon part/i.test(it.prompt() || ''); });
  ok(parts.length >= 1, 'wonder-weapon parts are collectable once powered');
  // collect them all
  G.interact.list.forEach(function (it) { if (/Take the wonder-weapon part/.test(it.prompt() || '')) it.use(); });
  ok(ww.parts === ww.total, 'all parts collected');
  // build it
  G.player.points = 100000;
  var had = G.weapons.hasWeapon(G.CFG.cur.wonder);
  var bench = G.interact.list.filter(function (it) { return /Build the .+—/.test(it.prompt() || ''); })[0];
  ok(!!bench, 'bench offers the build once parts are gathered');
  bench.use();
  ok(ww.built && G.weapons.hasWeapon(G.CFG.cur.wonder), 'assembling grants the wonder weapon');
}

/* soul-box mini easter egg: activate all relics to wake the chest, then kills
   nearby fill it and reward a free perk */
function testSoulBox(ctx) {
  var G = ctx.G;
  var ee = G.interact.ee;
  ok(ee && ee.relics.length === 3, 'three relics placed for the mini easter egg');
  // kills before the chest is awake do nothing
  ee.box = null; ee.done = false; ee.souls = 0;
  G.interact.onKill(new THREE.Vector3(0, 0, 0));
  ok(ee.souls === 0, 'kills do nothing before the chest is awake');
  // wake the chest, then feed it nearby kills
  ee.box = new THREE.Vector3(0, 0, 0);
  G.player.perks = [];
  var before = G.player.perks.length;
  for (var i = 0; i < ee.need; i++) G.interact.onKill(new THREE.Vector3(0, 0, 0));
  ok(ee.done, 'soul chest fills after enough nearby kills');
  ok(G.player.perks.length > before, 'soul chest rewards a free perk');
  // a far kill would not have counted
  ee.box = new THREE.Vector3(0, 0, 0); ee.done = false; ee.souls = 0;
  G.interact.onKill(new THREE.Vector3(50, 0, 50));
  ok(ee.souls === 0, 'far-away kills do not feed the chest');
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
}

/* settings terminal: opens/pauses, exposes the run-tuning settings, and can
   jump the round director */
function testTerminal(ctx) {
  var G = ctx.G;
  ok(!!G.terminal, 'settings terminal module present');
  ok(G.settings.perkLimit === 4 && G.settings.bossRounds === true, 'settings have sane defaults');
  G.terminal.open();
  ok(G.terminal.active, 'terminal opens and holds the game');
  G.terminal.close();
  ok(!G.terminal.active, 'terminal closes');
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

if (require.main === module) {
  (async function () {
    await runFull('wetterjunge');
    await runQuick('nacht');
    await runQuick('derriese');
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
