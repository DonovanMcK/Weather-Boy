/* ===========================================================================
   DER WETTERJUNGE & FRIENDS — main.js
   Scene boot, map selection, game loop, state machine.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  G.state = 'menu'; // menu | playing | paused | over
  G.time = 0;
  var started = false;

  G.bestKey = function () { return 'wj_best_' + G.CFG.cur.id; };

  // A map may opt into a lower internal render scale when its authored scene is
  // deliberately dense. This changes pixel workload only — never simulation,
  // controls, light colours, or the CSS size of the game.
  function applyMapRenderScale() {
    var cap = G.CFG && G.CFG.cur && G.CFG.cur.renderPixelRatio;
    cap = cap == null ? 1.5 : cap;
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ------------------------------------------------- input mode detection
     Macs (usually trackpads) default to "simple" aim: no ADS, tighter
     hip-fire and bullet magnetism. Mouse machines get full ADS. The start
     menu button overrides the auto-detect and persists. */
  function detectAimMode() {
    var saved = localStorage.getItem('wj_aim');
    if (saved === 'mouse' || saved === 'simple') return saved;
    var nav = typeof navigator !== 'undefined' ? navigator : {};
    var ua = (nav.platform || '') + ' ' + (nav.userAgent || '');
    return /Mac|iPhone|iPad/i.test(ua) ? 'simple' : 'mouse';
  }
  G.settings = { aimMode: 'mouse', perkLimit: 4, bossRounds: true };

  function refreshAimButton() {
    var btn = document.getElementById('btn-aimmode');
    var desc = document.getElementById('aimmode-desc');
    if (!btn) return;
    if (G.settings.aimMode === 'simple') {
      btn.textContent = 'Aiming: TRACKPAD (auto-aim, no RMB)';
      desc.textContent = 'Tighter hip-fire + bullet magnetism. Best for MacBooks. Click to switch.';
    } else {
      btn.textContent = 'Aiming: MOUSE (RMB to aim)';
      desc.textContent = 'Full aim-down-sights on right mouse button. Click to switch.';
    }
  }

  function boot() {
    var canvas = document.getElementById('game');
    G.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    // r160 defaults to physical light units which crush small point lights —
    // use the classic units and filmic tone mapping for a readable image
    G.renderer.useLegacyLights = true;
    G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    G.renderer.toneMappingExposure = 1.35;

    G.scene = new THREE.Scene();
    G.scene.background = new THREE.Color(0x0c1018);
    G.scene.fog = new THREE.FogExp2(0x0e1320, 0);   // fog disabled (player preference)

    G.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);
    G.scene.add(G.camera);

    // ambient floor guarantees the scene is never pitch black, regardless of
    // how the renderer treats point-light units
    G.amb = new THREE.AmbientLight(0x55607a, 0.5);
    G.scene.add(G.amb);
    G.hemi = new THREE.HemisphereLight(0x8899bb, 0x3a2f24, 0.65);
    G.scene.add(G.hemi);
    var moon = new THREE.DirectionalLight(0xaabbdd, 0.55);
    moon.position.set(30, 50, -20);
    G.scene.add(moon);
    // Maps with a power-state lighting profile can retune this existing fill
    // light. Keeping the reference avoids creating a second directional light.
    G.moon = moon;

    G.hud.init();

    window.addEventListener('resize', function () {
      G.camera.aspect = window.innerWidth / window.innerHeight;
      G.camera.updateProjectionMatrix();
      G.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // map select cards + menu buttons (also registered for controller nav)
    var startItems = [];
    G.CFG.MAP_IDS.forEach(function (id) {
      var card = document.getElementById('map-' + id);
      if (card) {
        card.addEventListener('click', function () { G.startGame(id); });
        startItems.push({ el: card, action: function () { G.startGame(id); } });
      }
      var best = localStorage.getItem('wj_best_' + id);
      var span = document.getElementById('best-' + id);
      if (span && best) span.textContent = 'Best: round ' + best;
      // challenge stars — earned once per map, forever on the card:
      // ★ survive to round 15   ★ complete the easter egg   ★ Pack-a-Punch a gun
      if (card) {
        var feats = [['r15', 'Survive to round 15'], ['ee', 'Complete the easter egg'], ['pap', 'Pack-a-Punch a weapon']];
        var row = document.createElement('div');
        row.style.cssText = 'margin-top:4px;font-size:15px;letter-spacing:5px';
        feats.forEach(function (f) {
          var got = localStorage.getItem('wj_feat_' + id + '_' + f[0]) === '1';
          var s = document.createElement('span');
          s.textContent = '★';
          s.title = f[1] + (got ? ' ✓' : '');
          s.style.color = got ? '#e8c35a' : 'rgba(255,255,255,0.18)';
          row.appendChild(s);
        });
        card.appendChild(row);
      }
    });
    // feats are awarded from gameplay code via G.awardFeat(key)
    G.awardFeat = function (key) {
      var k = 'wj_feat_' + (G.CFG.cur ? G.CFG.cur.id : '?') + '_' + key;
      if (localStorage.getItem(k) === '1') return;
      localStorage.setItem(k, '1');
      var names = { r15: 'ROUND 15 SURVIVOR', ee: 'EASTER EGG COMPLETE', pap: 'FIRST PACK-A-PUNCH' };
      G.hud.banner('★ CHALLENGE: ' + (names[key] || key), '#e8c35a', 3, 'Star earned on the map card');
    };
    G.settings.aimMode = detectAimMode();
    refreshAimButton();
    function toggleAim() {
      G.settings.aimMode = G.settings.aimMode === 'simple' ? 'mouse' : 'simple';
      localStorage.setItem('wj_aim', G.settings.aimMode);
      refreshAimButton();
    }
    var aimBtn = document.getElementById('btn-aimmode');
    aimBtn.addEventListener('click', toggleAim);
    startItems.push({ el: aimBtn, action: toggleAim });
    var reload = function () { location.reload(); };
    document.getElementById('btn-resume').addEventListener('click', resume);
    document.getElementById('btn-restart').addEventListener('click', reload);
    document.getElementById('btn-restart2').addEventListener('click', reload);

    // Developer Tools / settings panel — opened from the menus, never in-world
    var openDev = function () { if (G.terminal) G.terminal.open(); };
    var devStart = document.getElementById('btn-devtools-start');
    var devPause = document.getElementById('btn-devtools-pause');
    if (devStart) devStart.addEventListener('click', openDev);
    if (devPause) devPause.addEventListener('click', openDev);
    if (devStart) startItems.push({ el: devStart, action: openDev });

    G.hud.setMenuItems('start', startItems);
    G.hud.setMenuItems('pause', [
      { el: document.getElementById('btn-resume'), action: resume },
      { el: document.getElementById('btn-restart2'), action: reload },
      { el: devPause, action: openDev }
    ]);
    G.hud.setMenuItems('over', [
      { el: document.getElementById('btn-restart'), action: reload }
    ]);

    // keyboard menu navigation (arrows + Enter), for parity with the pad
    window.addEventListener('keydown', function (e) {
      if (G.state === 'playing') return;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') G.hud.menuMove(-1);
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') G.hud.menuMove(1);
      else if (e.code === 'Enter') G.hud.menuActivate();
    });

    // direct in-match Developer Tools toggle (Backquote `~`). Opens/closes the
    // panel without leaving the match — the panel freezes the sim while open
    // (it never resets the run) and restores mouse-look on close.
    window.addEventListener('keydown', function (e) {
      if (e.code !== 'Backquote' || !G.terminal) return;
      if (G.state !== 'playing' && G.state !== 'paused') return;
      if (G.terminal.active) G.terminal.close(); else G.terminal.open();
    });

    document.addEventListener('pointerlockchange', function () {
      // if you're driving with a phone, losing the mouse lock must not pause you
      if (G.remote && G.remote.connected) return;
      // the settings terminal releases the mouse on purpose — don't pause for it
      if (G.terminal && G.terminal.active) return;
      if (!document.pointerLockElement && G.state === 'playing') {
        G.state = 'paused';
        G.hud.showMenu('pause');
      }
    });

    G.hud.showMenu('start');
    last = performance.now();
    requestAnimationFrame(loop);
  }

  G.startGame = function (mapId) {
    if (started) return;
    started = true;
    G.CFG.setMap(mapId);
    applyMapRenderScale();
    G.map.build();
    G.player.spawn();
    G.weapons.init();
    G.interact.init();
    if (G.nav) G.nav.build();      // multi-layer nav graph (after colliders exist)
    G.zombies.start();
    G.audio.init();
    G.state = 'playing';
    G.hud.showMenu(null);
    G.hud.setPoints(G.player.points);
    G.hud.setAmmo();
    G.hud.setRound(1);
    G.hud.banner(G.CFG.cur.name, '#c11', 3, G.CFG.cur.sub);
    var canvas = document.getElementById('game');
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  };

  function resume() {
    G.state = 'playing';
    G.hud.showMenu(null);
    var canvas = document.getElementById('game');
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  }

  // controller-friendly pause toggle (Start button)
  G.setPaused = function (on) {
    if (on && G.state === 'playing') {
      G.state = 'paused';
      G.hud.showMenu('pause');
      if (document.exitPointerLock) document.exitPointerLock();
    } else if (!on && G.state === 'paused') {
      resume();
    }
  };

  G.gameOver = function () {
    if (G.state === 'over') return;
    G.state = 'over';
    G.audio.gameOver();
    var best = +(localStorage.getItem(G.bestKey()) || 0);
    if (G.zombies.round > best) localStorage.setItem(G.bestKey(), G.zombies.round);
    G.hud.gameOverStats();
    G.hud.showMenu('over');
    document.exitPointerLock();
  };

  var last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.gamepad) G.gamepad.update(dt);   // polled even while paused (Start resumes)
    if (G.remote) G.remote.update(dt);     // phone controller panel + intent reset
    if (G.state === 'paused' || G.state === 'menu' || (G.terminal && G.terminal.active)) {
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
