/* ===========================================================================
   TOTENSTURM — terminal.js
   Dr. Maxis-style settings terminal. Walk up to the console in spawn and press
   use: the game pauses and an overlay lets you tune the run live — perk limit,
   cash, jump to a round, hand yourself a gun, and toggle boss rounds.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  var T = G.terminal = { active: false, built: false };
  var root = null;

  function css() {
    if (typeof document === 'undefined' || document.getElementById('terminal-style')) return;
    var s = document.createElement('style');
    s.id = 'terminal-style';
    s.textContent = [
      '#terminal{position:fixed;inset:0;z-index:30;display:none;align-items:center;',
      '  justify-content:center;background:rgba(2,6,10,0.86);',
      '  font-family:"Rajdhani","Segoe UI",system-ui,sans-serif;color:#bfe;}',
      '#terminal .box{width:min(560px,92vw);background:#070d12;border:1px solid #1d5a4a;',
      '  border-radius:10px;padding:22px 26px;box-shadow:0 0 40px rgba(0,255,180,0.12),inset 0 0 30px rgba(0,40,30,0.5);}',
      '#terminal h2{margin:0 0 4px;color:#3ad6a0;letter-spacing:3px;font-size:24px;text-shadow:0 0 10px #0a5;}',
      '#terminal .sub{color:#5a8;font-size:13px;margin-bottom:18px;letter-spacing:1px;}',
      '#terminal .row{display:flex;align-items:center;justify-content:space-between;',
      '  padding:9px 0;border-bottom:1px solid rgba(40,120,90,0.18);}',
      '#terminal .row label{font-size:16px;color:#cfe;}',
      '#terminal .ctl{display:flex;align-items:center;gap:8px;}',
      '#terminal button{font-family:inherit;background:#0c2a22;color:#7fe;border:1px solid #2a7;',
      '  border-radius:5px;padding:5px 12px;font-size:15px;cursor:pointer;}',
      '#terminal button:hover{background:#13453a;}',
      '#terminal .val{min-width:64px;text-align:center;font-size:17px;font-weight:700;color:#fff;}',
      '#terminal input,#terminal select{font-family:inherit;background:#0a1a16;color:#cff;',
      '  border:1px solid #2a7;border-radius:5px;padding:5px 8px;font-size:15px;}',
      '#terminal input{width:110px;text-align:right;}',
      '#terminal .toggle.on{background:#1f7a4a;color:#dfffe9;border-color:#5fd;}',
      '#terminal .foot{display:flex;gap:12px;margin-top:20px;justify-content:flex-end;}',
      '#terminal .foot button{padding:9px 26px;font-size:17px;}',
      '#terminal .apply{background:#155;border-color:#3cc;color:#cff;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function build() {
    if (T.built || typeof document === 'undefined' || !document.body) return;
    css();
    root = document.createElement('div');
    root.id = 'terminal';
    var guns = Object.keys(G.CFG.WEAPONS)
      .filter(function (id) { return id !== 'frags'; })
      .map(function (id) { return '<option value="' + id + '">' + G.CFG.WEAPONS[id].name + '</option>'; })
      .join('');
    root.innerHTML =
      '<div class="box">' +
      '<h2>GROUP 935 TERMINAL</h2>' +
      '<div class="sub">Maxis override console — tune this run</div>' +
      '<div class="row"><label>Perk limit</label><div class="ctl">' +
        '<button data-act="perk-">−</button><span class="val" id="t-perk"></span><button data-act="perk+">+</button></div></div>' +
      '<div class="row"><label>Cash</label><div class="ctl">' +
        '<input id="t-cash" type="number" min="0" step="500"><button class="apply" data-act="cash">Set</button></div></div>' +
      '<div class="row"><label>Jump to round</label><div class="ctl">' +
        '<input id="t-round" type="number" min="1" step="1"><button class="apply" data-act="round">Go</button></div></div>' +
      '<div class="row"><label>Give weapon</label><div class="ctl">' +
        '<select id="t-gun">' + guns + '</select></div></div>' +
      '<div class="row"><label>&nbsp;&nbsp;at tier</label><div class="ctl">' +
        '<button class="apply" data-act="give">Stock</button>' +
        '<button class="apply" data-act="give-pap">Pack-a-Punch</button>' +
        '<button class="apply" data-act="give-dpap">Double Pack</button></div></div>' +
      '<div class="row"><label>Boss rounds (every 8–12)</label><div class="ctl">' +
        '<button class="toggle" id="t-boss" data-act="boss"></button></div></div>' +
      '<div class="sub" style="margin:14px 0 2px;color:#3ad6a0;letter-spacing:2px;">▌ TEST RANGE</div>' +
      '<div class="row"><label>Target dummies</label><div class="ctl">' +
        '<button data-act="targets">Spawn ×3</button>' +
        '<button data-act="targets1">+1</button>' +
        '<button data-act="clear-targets">Clear</button></div></div>' +
      '<div class="row"><label>No-horde mode</label><div class="ctl">' +
        '<button class="toggle" id="t-nohorde" data-act="nohorde"></button></div></div>' +
      '<div class="row"><label>Refill all ammo</label><div class="ctl">' +
        '<button class="apply" data-act="maxammo">Max Ammo</button></div></div>' +
      '<div class="foot"><button data-act="close">RESUME</button></div>' +
      '</div>';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    T.built = true;
  }

  function refresh() {
    if (!root) return;
    document.getElementById('t-perk').textContent = G.settings.perkLimit;
    var boss = document.getElementById('t-boss');
    boss.textContent = G.settings.bossRounds ? 'ON' : 'OFF';
    boss.classList.toggle('on', !!G.settings.bossRounds);
    var nh = document.getElementById('t-nohorde');
    if (nh && G.zombies) {
      nh.textContent = G.zombies.rangeFreeze ? 'ON' : 'OFF';
      nh.classList.toggle('on', !!G.zombies.rangeFreeze);
    }
    if (G.player) document.getElementById('t-cash').value = G.player.points;
    if (G.zombies) document.getElementById('t-round').value = Math.max(1, G.zombies.round);
  }

  function onClick(e) {
    var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
    if (!act) return;
    e.stopPropagation();
    var playing = G.state === 'playing';   // cheat controls only act in a live game
    // --- player settings (apply any time, persist into the run) ---
    if (act === 'perk-') G.settings.perkLimit = Math.max(1, G.settings.perkLimit - 1);
    else if (act === 'perk+') G.settings.perkLimit = Math.min(9, G.settings.perkLimit + 1);
    else if (act === 'boss') G.settings.bossRounds = !G.settings.bossRounds;
    // --- developer / cheat controls (need a live game) ---
    else if (act === 'cash') { if (playing && G.player) { var c = +document.getElementById('t-cash').value || 0; G.player.points = Math.max(0, c | 0); G.hud.setPoints(G.player.points); } }
    else if (act === 'round') { if (playing && G.zombies) { var r = +document.getElementById('t-round').value || 1; G.zombies.jumpToRound(r); G.hud.setRound(Math.max(1, r | 0)); } }
    else if (act === 'give' || act === 'give-pap' || act === 'give-dpap') {
      if (playing && G.weapons) {
        var id = document.getElementById('t-gun').value;
        if (id) {
          G.weapons.giveWeapon(id);
          var tiers = act === 'give-pap' ? 1 : act === 'give-dpap' ? 2 : 0;
          for (var k = 0; k < tiers; k++) G.weapons.papCurrent();
        }
      }
    }
    else if (act === 'targets') { if (playing && G.zombies) G.zombies.spawnTargets(3); }
    else if (act === 'targets1') { if (playing && G.zombies) G.zombies.spawnTargets(1); }
    else if (act === 'clear-targets') { if (playing && G.zombies) G.zombies.clearTargets(); }
    else if (act === 'nohorde') { if (playing && G.zombies) G.zombies.setRangeFreeze(!G.zombies.rangeFreeze); }
    else if (act === 'maxammo') { if (playing && G.weapons) { G.weapons.maxAmmo(); G.weapons.refillCurrent(); } }
    else if (act === 'close') { T.close(); return; }
    refresh();
  }

  // openable from the main menu, the pause menu, or mid-game (Developer Tools)
  T.open = function () {
    if (G.state === 'over') return;
    build();
    if (!root) return;
    T._fromState = G.state;
    T.active = true;
    root.style.display = 'flex';
    // grey out the cheat controls that need a live game
    var live = G.state === 'playing';
    if (root.setAttribute) root.setAttribute('data-live', live ? '1' : '0');
    refresh();
    if (typeof document !== 'undefined' && document.exitPointerLock) document.exitPointerLock();
  };

  T.close = function () {
    T.active = false;
    if (root) root.style.display = 'none';
    // only grab the mouse back when we were mid-game; menu/pause keep the cursor
    if (T._fromState === 'playing' && !(G.remote && G.remote.connected) && typeof document !== 'undefined') {
      var canvas = document.getElementById('game');
      if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
    }
  };
})();
