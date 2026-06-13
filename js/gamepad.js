/* ===========================================================================
   TOTENSTURM — gamepad.js
   Optional controller support (Gamepad API). Plug in an Xbox/PS pad and play.
   To avoid fighting keyboard+mouse, the pad only writes neutral "intents" onto
   G.gamepad; an idle, centered controller contributes nothing. Look is applied
   directly to the camera; discrete actions are dispatched as synthetic key
   events so they flow through the existing handlers.

   Standard mapping (Xbox layout):
     Left stick   move        Right stick  look
     RT  fire     LT  ADS      L3  sprint   R3  knife
     A   jump     B   slide/crouch
     X   interact (tap=buy, hold=rebuild)   Y  reload
     LB  frag     RB  monkey bomb
     D-pad Up swap · Left slot 1 · Right slot 2 · Down mute
     Start pause/resume
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  var GP = G.gamepad = {
    connected: false, index: null,
    moveX: 0, moveZ: 0,
    sprint: false, jump: false, crouch: false,
    fire: false, ads: false, interactHeld: false,
    _tap: false
  };
  // one-shot "use/buy" press consumed by interact.js (avoids leaving a synthetic
  // KeyF stuck down, which would continuously rebuild barricades)
  GP.consumeTap = function () { var t = GP._tap; GP._tap = false; return t; };

  var DEAD = 0.26;          // stick deadzone (generous — tolerates worn sticks)
  var LOOK = 3.1;           // look speed (rad/s at full deflection)
  var prev = [];            // previous button states for edge detection

  function hasAPI() {
    return typeof navigator !== 'undefined' && !!navigator.getGamepads;
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('gamepadconnected', function (e) {
      GP.index = e.gamepad.index; GP.connected = true;
      if (G.hud && G.hud.banner) {
        G.hud.banner('CONTROLLER READY', '#6cf', 2.5, (e.gamepad.id || '').slice(0, 30));
      }
    });
    window.addEventListener('gamepaddisconnected', function (e) {
      if (e.gamepad.index === GP.index) { GP.connected = false; GP.index = null; }
    });
  }

  function activePad() {
    if (!hasAPI()) return null;
    var pads = navigator.getGamepads();
    if (GP.index != null && pads[GP.index]) return pads[GP.index];
    for (var i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected !== false) { GP.index = i; return pads[i]; }
    }
    return null;
  }

  function dz(v) { return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD); }

  // radial deadzone: zero the stick unless its overall magnitude clears DEAD,
  // then rescale so you still reach full deflection. Stops drift dead.
  function stick(x, y) {
    var m = Math.hypot(x, y);
    if (m < DEAD) return { x: 0, y: 0, m: 0 };
    var s = (m - DEAD) / (1 - DEAD) / m;
    return { x: x * s, y: y * s, m: (m - DEAD) / (1 - DEAD) };
  }

  function tapKey(code) {
    if (typeof KeyboardEvent === 'undefined') return;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: code }));
  }

  function reset() {
    GP.moveX = GP.moveZ = 0;
    GP.sprint = GP.jump = GP.crouch = GP.fire = GP.ads = GP.interactHeld = false;
  }

  function setIndicator(on) {
    if (GP._ind === on) return;
    GP._ind = on;
    if (typeof document !== 'undefined' && document.getElementById) {
      var ind = document.getElementById('hud-pad');
      if (ind) ind.style.display = on ? 'block' : 'none';
    }
  }

  GP.update = function (dt) {
    var p = activePad();
    if (!p) { GP.connected = false; reset(); setIndicator(false); return; }
    GP.connected = true;
    setIndicator(true);
    var b = p.buttons, a = p.axes, P = G.player;
    function down(i) { return !!(b[i] && b[i].pressed); }
    function val(i) { return b[i] ? b[i].value : (down(i) ? 1 : 0); }
    function edge(i) { var now = down(i); var was = prev[i]; prev[i] = now; return now && !was; }

    var playing = G.state === 'playing';

    // radial deadzone per stick — kills analog drift that would otherwise inject
    // a constant strafe ("stuck drifting") even when you're holding nothing
    var L = stick(a[0] || 0, a[1] || 0);
    var R = stick(a[2] || 0, a[3] || 0);

    // ---- movement intent (left stick) ----
    GP.moveX = playing ? L.x : 0;
    GP.moveZ = playing ? L.y : 0;
    GP.sprint = playing && (down(10) || L.y < -0.85);
    GP.jump = playing && down(0);
    GP.crouch = playing && down(1);

    // ---- look (right stick), squared for fine aim, applied directly ----
    if (P && playing) {
      var sens = LOOK * (G.camera ? G.camera.fov / 75 : 1);
      P.yaw -= R.x * Math.abs(R.x) * sens * dt;
      P.pitch -= R.y * Math.abs(R.y) * sens * dt;
      P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
      P.swayX += R.x * 6; P.swayY += R.y * 6;
    }

    // ---- triggers: RT shoot / LT aim ----
    GP.fire = playing && val(7) > 0.45;
    GP.ads = playing && val(6) > 0.4;

    // ---- held: X drives barricade rebuild ----
    GP.interactHeld = playing && down(2);

    if (playing) {
      // ---- in-game edge-triggered actions (user's layout) ----
      if (edge(2)) {                   // X: buy/use if a prompt is up, else reload
        if (G.hud && G.hud._prompt) GP._tap = true;
        else tapKey('KeyR');
      }
      if (edge(3)) tapKey('KeyQ');     // Y: switch weapon
      if (edge(5)) tapKey('KeyG');     // RB: frag grenade
      if (edge(4)) tapKey('KeyH');     // LB: monkey bomb
      if (edge(12)) tapKey('KeyH');    // D-pad up: monkey bomb
      if (edge(11)) tapKey('KeyV');    // R3: knife
      if (edge(13)) tapKey('KeyM');    // D-pad down: mute
      if (edge(14)) tapKey('Digit1');  // D-pad left: weapon slot 1
      if (edge(15)) tapKey('Digit2');  // D-pad right: weapon slot 2
      GP._stick = 0;
    } else if (G.hud && G.hud.menuActivate) {
      // ---- menu navigation (start / pause / game-over) ----
      // D-pad + left stick (edge-latched) move focus; A activates, B goes back
      var nx = a[0] || 0, ny = a[1] || 0;
      var sd = (nx > 0.5 || ny > 0.5) ? 1 : ((nx < -0.5 || ny < -0.5) ? -1 : 0);
      var move = 0;
      if (edge(12) || edge(14)) move = -1;       // up / left
      if (edge(13) || edge(15)) move = 1;        // down / right
      if (sd !== 0 && GP._stick === 0) move = sd;
      GP._stick = sd;
      if (move) G.hud.menuMove(move);
      if (edge(0)) G.hud.menuActivate();         // A: select
      if (edge(1)) G.hud.menuBack();             // B: back (resume)
      // keep in-game button edges fresh so nothing fires on resume
      [2, 3, 4, 5, 11].forEach(function (i) { prev[i] = down(i); });
    }
    // Start: pause / resume (works in both states)
    if (edge(9) && G.setPaused) {
      if (G.state === 'playing') G.setPaused(true);
      else if (G.state === 'paused') G.setPaused(false);
    }
  };
})();
