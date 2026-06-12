/* Headless smoke test: boots the whole game in node with a stubbed DOM and a
   stubbed WebGLRenderer, then plays through the core systems — rounds, combat,
   doors, perks, power, teleporters, Pack-a-Punch, mystery box, power-ups,
   hellhounds, and game over.
   Run: npm install && node tests/smoke.js */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('FAIL  ' + msg); fails++; }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ------------------------------------------------------------- DOM stubs */
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
    if (!elements[id]) {
      elements[id] = id === 'game' ? canvasStub() : elemStub();
    }
    return elements[id];
  },
  createElement: function (tag) { return tag === 'canvas' ? canvasStub() : elemStub(); }
});

var rafCb = null;
var windowStub = makeEmitter({
  innerWidth: 1280, innerHeight: 720,
  devicePixelRatio: 1
});

var THREE = require('three');
// stub the GPU-dependent renderer
function FakeRenderer() { this.domElement = canvasStub(); }
FakeRenderer.prototype.setSize = function () {};
FakeRenderer.prototype.setPixelRatio = function () {};
FakeRenderer.prototype.render = function () {};
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
windowStub.G = undefined; // game sets window.G
vm.createContext(sandbox);

['config', 'audio', 'hud', 'map', 'player', 'weapons', 'zombies', 'powerups', 'interact', 'main']
  .forEach(function (name) {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8');
    vm.runInContext(src, sandbox, { filename: name + '.js' });
  });

var G = sandbox.window.G;
ok(!!G && !!G.CFG && !!G.map && !!G.zombies, 'all modules loaded into G namespace');

/* ------------------------------------------------------------- stepping */
var simNow = performance.now();
function step(frames, dtMs) {
  for (var i = 0; i < frames; i++) {
    simNow += (dtMs || 16);
    var cb = rafCb; rafCb = null;
    if (cb) cb(simNow);
  }
}
function pressF() { windowStub.dispatch('keydown', { code: 'KeyF' }); }
function moveTo(pos) { G.player.pos.set(pos.x, 0, pos.z); G.player.vel.set(0, 0, 0); }

(async function run() {
  /* boot checks */
  ok(G.map.windows.length === 10, 'built 10 barricaded windows');
  ok(G.map.colliders.length > 50, 'colliders built (' + G.map.colliders.length + ')');
  ok(Object.keys(G.map.doors).length === 7, '7 doors built');
  ok(G.weapons.slots.length === 1 && G.weapons.slots[0].id === 'm1911', 'starts with M1911');

  /* round 1 begins, zombies spawn and approach */
  G.state = 'playing';
  G.zombies.list.length = 0;
  step(60 * 6); // 6 seconds
  ok(G.zombies.round === 1, 'round 1 started');
  ok(G.zombies.list.length > 0, 'zombies spawned (' + G.zombies.list.length + ')');
  var origDamage = G.player.damage;
  G.player.damage = function () {}; // invulnerable during systems testing
  step(60 * 25);
  var states = {};
  G.zombies.list.forEach(function (z) { states[z.state] = true; });
  ok(G.zombies.list.some(function (z) { return ['tear', 'vault', 'chase', 'attack'].indexOf(z.state) >= 0; }),
     'zombies tearing/vaulting/chasing (' + Object.keys(states) + ')');
  ok(G.map.windows.some(function (w) { return w.boards < 6; }), 'boards were torn off');

  /* combat: kill a zombie with a headshot */
  var pointsBefore = G.player.points;
  var killsBefore = G.player.kills;
  var z0 = G.zombies.list.filter(function (z) { return !z.dead; })[0];
  if (z0) {
    G.zombies.damageZombie(z0, 1e9, { head: true });
    ok(z0.dead, 'zombie killed');
    ok(G.player.kills === killsBefore + 1, 'kill counted');
    ok(G.player.points > pointsBefore, 'points awarded (' + (G.player.points - pointsBefore) + ')');
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

  /* doors */
  G.player.points = 100000;
  var d1 = G.map.doors[1];
  moveTo(d1.pos); pressF(); step(5);
  ok(d1.open, 'door 1 opened');
  [2, 3, 4, 5, 6, 7].forEach(function (id) {
    moveTo(G.map.doors[id].pos); pressF(); step(5);
  });
  ok(Object.keys(G.map.doors).every(function (id) { return G.map.doors[id].open; }), 'all doors opened');
  ok(G.map.reachableRooms.D && G.map.reachableRooms.L, 'reachability recomputed');

  /* wall buy */
  var wbMp40 = G.map.wallbuys.filter(function (w) { return w.gun === 'mp40'; })[0];
  moveTo(wbMp40.pos); pressF(); step(5);
  ok(G.weapons.hasWeapon('mp40'), 'bought MP40 off the wall');
  ok(G.weapons.slots.length === 2, 'two weapon slots used');

  /* perks (power off: only revive allowed) */
  var pmJugg = G.map.perkMachines.filter(function (p) { return p.perk === 'jugg'; })[0];
  moveTo(pmJugg.pos); pressF(); step(5);
  ok(!G.player.hasPerk('jugg'), 'juggernog denied before power');
  var pmQR = G.map.perkMachines.filter(function (p) { return p.perk === 'revive'; })[0];
  moveTo(pmQR.pos); pressF(); step(5);
  ok(G.player.hasPerk('revive'), 'quick revive bought before power');

  /* power */
  moveTo(G.map.powerSwitch.pos); pressF(); step(5);
  ok(G.map.power, 'power turned on');
  moveTo(pmJugg.pos); pressF(); step(5);
  ok(G.player.hasPerk('jugg') && G.player.maxHp === 250, 'juggernog bought, 250 hp');

  /* teleporter linking -> pack-a-punch */
  for (var ti = 0; ti < 3; ti++) {
    var t = G.map.teleporters[ti];
    moveTo(t.pos); pressF(); step(5);
    ok(t.linking, 'teleporter ' + t.id + ' activated');
    moveTo(G.map.mainframe.pos); pressF(); step(5);
    ok(t.linked, 'teleporter ' + t.id + ' linked at mainframe');
  }
  ok(G.map.pap.unlocked, 'pack-a-punch unlocked after 3 links');

  /* teleporter use */
  var tA = G.map.teleporters[0];
  moveTo(tA.pos); pressF(); step(5);
  ok(G.player.pos.distanceTo(G.map.mainframe.pos) < 4, 'teleported to mainframe');

  /* pack-a-punch the current gun */
  G.weapons.equip(0, true); // m1911 -> Mustang & Sally
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
  var gotOffer = !!G.interact.box.offer || G.player.hasMonkeys;
  ok(gotOffer, 'box offered a weapon (or monkeys)');
  if (G.interact.box.offer) {
    var offered = G.interact.box.offer;
    pressF(); step(5);
    ok(G.weapons.hasWeapon(offered), 'took ' + offered + ' from the box');
  }

  /* grenades + explosions make crawlers or kills */
  var aliveBefore = G.zombies.aliveCount();
  if (aliveBefore > 0) {
    var zt = G.zombies.list.filter(function (z) { return !z.dead; })[0];
    G.weapons.explode(zt.mesh.position.clone(), 600, 4.5, { crawlers: true, color: 0xffaa33 });
    step(5);
    ok(G.zombies.aliveCount() < aliveBefore ||
       G.zombies.list.some(function (z) { return z.crawler; }),
       'explosion killed or crawled zombies');
  }

  /* monkey bomb lure */
  G.player.hasMonkeys = true;
  G.player.monkeys = 3;
  windowStub.dispatch('keydown', { code: 'KeyH' });
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
  G.powerups.spawn('nuke', G.player.pos.clone());
  step(10);
  ok(G.zombies.aliveCount() === 0, 'nuke killed everything');

  /* hellhound round: force next round to be round 5 */
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
  // wipe the dogs; last death should drop a max ammo
  G.zombies.toSpawn = 0;
  G.weapons.slots[0].reserve = 0; // sentinel: refilled only if max ammo is grabbed
  var dogs = G.zombies.list.filter(function (z) { return !z.dead; });
  dogs.forEach(function (z) { G.zombies.damageZombie(z, 1e9, {}); });
  step(10);
  var dropped = G.powerups.active.some(function (p) { return p.type === 'maxammo'; });
  var grabbed = G.weapons.slots[0].reserve > 0;
  ok(dropped || grabbed, 'max ammo dropped at the end of the dog round' +
     (grabbed ? ' (grabbed instantly)' : ''));
  ok(G.zombies.mode === 'break', 'round break after dogs');

  /* downed with quick revive, then final death */
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

  console.log(fails ? '\n' + fails + ' FAILURES' : '\nSMOKE TEST PASSED');
  process.exit(fails ? 1 : 0);
})().catch(function (e) {
  console.error('CRASH:', e);
  process.exit(1);
});
