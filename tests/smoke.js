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
    return obj;
  }
  function ctx2d() {
    return new Proxy({}, {
      get: function (t, p) {
        if (p in t) return t[p];
        return function () { return { width: 10 }; };
      },
      set: function (t, p, v) { t[p] = v; return true; }
    });
  }
  function canvasStub() {
    var cv = makeEmitter({ width: 300, height: 150, style: {} });
    cv.getContext = function () { return ctx2d(); };
    cv.requestPointerLock = function () {};
    return cv;
  }
  function elemStub() {
    var e = makeEmitter({
      style: {}, textContent: '', innerHTML: '', offsetWidth: 0, title: '',
      classList: { add: function () {}, remove: function () {} },
      children: []
    });
    e.appendChild = function (c) { e.children.push(c); };
    e.remove = function () {};
    e.requestPointerLock = function () {};
    e.parentElement = { style: {} };
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

  ['config', 'audio', 'hud', 'map', 'player', 'weapons', 'zombies', 'powerups', 'interact', 'main']
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
    moveTo: function (pos) { G.player.pos.set(pos.x, 0, pos.z); G.player.vel.set(0, 0, 0); }
  };
}

/* -------------------------------------------------- shared test pieces --- */
function roomCenter(G, room) {
  return G.map.parsed.rooms[room].center;
}

function openAllDoors(ctx) {
  var G = ctx.G;
  G.player.points = 200000;
  Object.keys(G.map.doors).forEach(function (id) {
    ctx.moveTo(G.map.doors[id].pos);
    ctx.pressF();
    ctx.step(5);
  });
  ok(Object.keys(G.map.doors).every(function (id) { return G.map.doors[id].open; }),
     'all doors opened');
  ok(Object.keys(G.map.parsed.rooms).every(function (r) { return G.map.reachableRooms[r]; }),
     'all rooms reachable');
}

function unlockPap(ctx) {
  var G = ctx.G;
  ctx.moveTo(G.map.powerSwitch.pos);
  ctx.pressF();
  ctx.step(5);
  ok(G.map.power, 'power turned on');
  if (G.CFG.cur.papRule === 'power') {
    ok(G.map.pap.unlocked, 'PaP unlocked by power (papRule=power)');
  } else {
    ok(!G.map.pap.unlocked, 'PaP still locked until teleporters linked');
    G.map.teleporters.forEach(function (t) {
      ctx.moveTo(t.pos); ctx.pressF(); ctx.step(5);
      ok(t.linking, 'teleporter ' + t.id + ' activated');
      ctx.moveTo(G.map.mainframe.pos); ctx.pressF(); ctx.step(5);
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
  // stand at spawn room center facing -z with three zombies ahead
  var c = roomCenter(G, 'S');
  ctx.moveTo(c);
  G.player.yaw = 0; G.player.pitch = 0;
  ctx.step(2);
  var zs = [
    G.zombies.spawnAt(new THREE.Vector3(c.x, 0, c.z - 4.5)),
    G.zombies.spawnAt(new THREE.Vector3(c.x + 0.9, 0, c.z - 5.5)),
    G.zombies.spawnAt(new THREE.Vector3(c.x - 0.9, 0, c.z - 6))
  ];
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
    ctx.step(30);
    ok(G.weapons.vortices.length > 0, 'storm vortex spawned');
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
  if (mapId === 'nacht') testMovement(ctx); // big open spawn room
}

async function runFull(mapId) {
  console.log('\n=== full: ' + mapId + ' ===');
  var ctx = createGame();
  var G = ctx.G, step = ctx.step, pressF = ctx.pressF, moveTo = ctx.moveTo;
  bootChecks(ctx, mapId);
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

  /* barricade repair */
  var brokenWin = G.map.windows.filter(function (w) { return w.boards < 6; })[0];
  if (brokenWin) {
    var boardsBefore = brokenWin.boards;
    moveTo(brokenWin.inside);
    G.keys.KeyF = true;
    step(60 * 3);
    G.keys.KeyF = false;
    ok(brokenWin.boards > boardsBefore, 'barricade rebuilt by holding F');
  }

  openAllDoors(ctx);

  /* wall buy */
  var wb = G.map.wallbuys.filter(function (w) { return !w.isFrags; })[0];
  moveTo(wb.pos); pressF(); step(5);
  ok(G.weapons.hasWeapon(wb.gun), 'bought ' + wb.gun + ' off the wall');

  /* perks: gated by power except revive */
  var pmJugg = G.map.perkMachines.filter(function (p) { return p.perk === 'jugg'; })[0];
  moveTo(pmJugg.pos); pressF(); step(5);
  ok(!G.player.hasPerk('jugg'), 'juggernog denied before power');
  var pmQR = G.map.perkMachines.filter(function (p) { return p.perk === 'revive'; })[0];
  moveTo(pmQR.pos); pressF(); step(5);
  ok(G.player.hasPerk('revive'), 'quick revive bought before power');

  unlockPap(ctx);
  moveTo(pmJugg.pos); pressF(); step(5);
  ok(G.player.hasPerk('jugg') && G.player.maxHp === 250, 'juggernog bought, 250 hp');

  /* teleporter travel (teleporter maps) */
  if (G.map.mainframe) {
    var tA = G.map.teleporters[0];
    moveTo(tA.pos); pressF(); step(5);
    ok(G.player.pos.distanceTo(G.map.mainframe.pos) < 4, 'teleported to mainframe');
  }

  /* pack-a-punch */
  G.weapons.equip(0, true);
  moveTo(G.map.pap.pos); pressF(); step(5);
  ok(G.player.locked, 'PaP machine took the gun');
  await sleep(3700);
  step(5);
  ok(G.weapons.slots[0].papped, 'gun came back Pack-a-Punched');
  ok(G.weapons.stats(G.weapons.slots[0]).name === 'Mustang & Sally', 'M1911 became Mustang & Sally');

  /* mystery box */
  var spot = G.map.boxSpots[G.interact.box.spotIdx];
  moveTo(spot.pos); pressF(); step(5);
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
  G.player.hp = 1;
  G.player.damage(50);
  ok(G.player.downed, 'player downed');
  ok(!G.player.hasPerk('jugg'), 'perks lost on down');
  step(60 * 6);
  ok(!G.player.downed && G.player.hp === G.player.maxHp, 'quick revive brought player back');
  G.player.hp = 1;
  G.player.damage(50);
  step(5);
  ok(G.state === 'over', 'game over without quick revive');
}

(async function () {
  await runFull('wetterjunge');
  await runQuick('nacht');
  await runQuick('derriese');
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nSMOKE TEST PASSED');
  process.exit(fails ? 1 : 0);
})().catch(function (e) {
  console.error('CRASH:', e);
  process.exit(1);
});
