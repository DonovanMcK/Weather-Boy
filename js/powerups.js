/* ===========================================================================
   DER WETTERJUNGE — powerups.js
   Drops: Max Ammo, Insta-Kill, Double Points, Nuke, Carpenter, Fire Sale.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  var COLORS = {
    maxammo: 0x44ff66, insta: 0xffee44, double: 0xff8833,
    nuke: 0x77ff77, carpenter: 0xccaa55, firesale: 0x55bbff
  };
  var LABELS = {
    maxammo: 'MAX AMMO', insta: 'INSTA-KILL', double: 'DOUBLE POINTS',
    nuke: 'NUKE', carpenter: 'CARPENTER', firesale: 'FIRE SALE'
  };

  var PU = G.powerups = {
    active: [],
    timers: { insta: 0, double: 0, firesale: 0 }
  };

  PU.maybeDrop = function (pos) {
    if (Math.random() > G.CFG.POWERUP_CHANCE) return;
    if (PU.active.length >= 4) return;
    var types = G.CFG.POWERUPS;
    var t = types[(Math.random() * types.length) | 0];
    PU.spawn(t, pos.clone());
  };

  PU.spawn = function (type, pos) {
    pos.y = 0;
    var group = new THREE.Group();
    var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32),
      new THREE.MeshBasicMaterial({ color: COLORS[type] }));
    core.position.y = 1.0;
    group.add(core);
    var label = G.util.textSprite(LABELS[type], '#fff', 2.2);
    label.position.y = 1.7;
    group.add(label);
    var light = new THREE.PointLight(COLORS[type], 0.9, 6);
    light.position.y = 1.2;
    group.add(light);
    group.position.copy(pos);
    G.scene.add(group);
    PU.active.push({ type: type, mesh: group, core: core, light: light, life: G.CFG.POWERUP_LIFE });
  };

  function apply(type) {
    G.audio.powerup();
    G.hud.banner(LABELS[type], '#' + new THREE.Color(COLORS[type]).getHexString(), 2);
    switch (type) {
      case 'maxammo':
        G.audio.maxAmmo();
        G.weapons.maxAmmo();
        break;
      case 'insta':
        PU.timers.insta = G.CFG.POWERUP_TIME;
        break;
      case 'double':
        PU.timers.double = G.CFG.POWERUP_TIME;
        break;
      case 'nuke':
        G.audio.nuke();
        G.hud.flashWhite();
        G.zombies.killAll();
        G.player.addPoints(G.CFG.PTS.nuke);
        break;
      case 'carpenter':
        G.map.windows.forEach(function (w) { w.setBoards(6); });
        G.audio.boardRepair();
        G.player.addPoints(G.CFG.PTS.carpenter);
        break;
      case 'firesale':
        PU.timers.firesale = G.CFG.POWERUP_TIME;
        G.interact.fireSale(true);
        break;
    }
    G.hud.setPowerupTimers(PU.timers);
  }

  PU.update = function (dt) {
    for (var i = PU.active.length - 1; i >= 0; i--) {
      var p = PU.active[i];
      p.life -= dt;
      p.core.rotation.y += dt * 2.5;
      p.core.position.y = 1.0 + Math.sin(G.time * 2 + i) * 0.12;
      if (p.life < 8) {
        var blink = Math.sin(p.life * (p.life < 3 ? 14 : 7)) > 0;
        p.mesh.visible = blink;
      }
      if (p.life <= 0) {
        G.scene.remove(p.mesh);
        PU.active.splice(i, 1);
        continue;
      }
      if (G.state === 'playing' &&
          p.mesh.position.distanceTo(G.player.pos) < 1.7) {
        apply(p.type);
        G.scene.remove(p.mesh);
        PU.active.splice(i, 1);
      }
    }

    var fsWas = PU.timers.firesale > 0;
    ['insta', 'double', 'firesale'].forEach(function (k) {
      if (PU.timers[k] > 0) PU.timers[k] = Math.max(0, PU.timers[k] - dt);
    });
    if (fsWas && PU.timers.firesale <= 0) G.interact.fireSale(false);
    G.hud.setPowerupTimers(PU.timers);
  };
})();
