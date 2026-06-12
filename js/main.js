/* ===========================================================================
   DER WETTERJUNGE — main.js
   Scene boot, game loop, state machine.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  G.state = 'menu'; // menu | playing | paused | over
  G.time = 0;

  function boot() {
    var canvas = document.getElementById('game');
    G.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    G.scene = new THREE.Scene();
    G.scene.background = new THREE.Color(0x07090f);
    G.scene.fog = new THREE.FogExp2(0x0a0d14, 0.03);

    G.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);
    G.scene.add(G.camera);

    G.hemi = new THREE.HemisphereLight(0x445577, 0x1a1410, 0.25);
    G.scene.add(G.hemi);
    var moon = new THREE.DirectionalLight(0x8899cc, 0.35);
    moon.position.set(30, 50, -20);
    G.scene.add(moon);

    G.hud.init();
    G.map.build();
    G.player.spawn();
    G.weapons.init();
    G.interact.init();
    G.zombies.start();

    window.addEventListener('resize', function () {
      G.camera.aspect = window.innerWidth / window.innerHeight;
      G.camera.updateProjectionMatrix();
      G.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // start / resume buttons
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-resume').addEventListener('click', resume);
    document.getElementById('btn-restart').addEventListener('click', function () { location.reload(); });
    document.getElementById('btn-restart2').addEventListener('click', function () { location.reload(); });

    document.addEventListener('pointerlockchange', function () {
      if (!document.pointerLockElement && G.state === 'playing') {
        G.state = 'paused';
        G.hud.showMenu('pause');
      }
    });

    var best = localStorage.getItem('wj_best');
    if (best) document.getElementById('start-best').textContent = 'Best round: ' + best;

    G.hud.showMenu('start');
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function startGame() {
    G.audio.init();
    G.state = 'playing';
    G.hud.showMenu(null);
    G.hud.setPoints(G.player.points);
    G.hud.setAmmo();
    G.hud.setRound(1);
    document.body.requestPointerLock ? document.getElementById('game').requestPointerLock() : null;
  }

  function resume() {
    G.state = 'playing';
    G.hud.showMenu(null);
    document.getElementById('game').requestPointerLock();
  }

  G.gameOver = function () {
    if (G.state === 'over') return;
    G.state = 'over';
    G.audio.gameOver();
    var best = +(localStorage.getItem('wj_best') || 0);
    if (G.zombies.round > best) localStorage.setItem('wj_best', G.zombies.round);
    G.hud.gameOverStats();
    G.hud.showMenu('over');
    document.exitPointerLock();
  };

  var last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.state === 'paused' || G.state === 'menu') {
      G.renderer.render(G.scene, G.camera);
      return;
    }
    G.time += dt;
    G.player.update(dt);
    G.weapons.update(dt);
    G.zombies.update(dt);
    G.powerups.update(dt);
    G.interact.update(dt);
    G.map.update(dt);
    G.hud.update(dt);
    G.renderer.render(G.scene, G.camera);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
