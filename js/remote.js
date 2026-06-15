/* ===========================================================================
   TOTENSTURM — remote.js
   Phone-as-controller. When the game is served by server.js (http://…, not
   file://), this opens a WebSocket and turns messages from the phone into the
   same neutral "intents" the gamepad uses — an idle phone contributes nothing,
   and keyboard/mouse keep working alongside it. Look (aim) is applied straight
   to the camera; discrete actions flow through the existing key handlers.

   Inert with no server (plain file:// play is unaffected).
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  var R = G.remote = {
    connected: false, padConnected: false,
    moveX: 0, moveZ: 0,
    sprint: false, jump: false, crouch: false,
    fire: false, ads: false, interactHeld: false,
    _tap: false
  };
  R.consumeTap = function () { var t = R._tap; R._tap = false; return t; };

  function playing() { return G.state === 'playing'; }
  function clamp(v) { v = +v || 0; return v < -1 ? -1 : (v > 1 ? 1 : v); }
  function tapKey(code) {
    if (typeof KeyboardEvent === 'undefined' || !window.dispatchEvent) return;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: code }));
  }

  function handleBtn(k, on) {
    on = !!on;
    if (k === 'fire') { R.fire = on; return; }
    if (k === 'ads') { R.ads = on; return; }
    if (k === 'jump') { R.jump = on; return; }
    if (k === 'crouch') { R.crouch = on; return; }
    if (k === 'use') {                       // tap = buy/use, hold = rebuild
      if (on) { if (playing()) R._tap = true; R.interactHeld = true; }
      else R.interactHeld = false;
      return;
    }
    if (!on) return;                         // the rest fire once on press
    if (k === 'reload') tapKey('KeyR');
    else if (k === 'swap') tapKey('KeyQ');
    else if (k === 'frag') tapKey('KeyG');
    else if (k === 'monkey') tapKey('KeyH');
    else if (k === 'knife') tapKey('KeyV');
    else if (k === 'pause' && G.setPaused) {
      if (G.state === 'playing') G.setPaused(true);
      else if (G.state === 'paused') G.setPaused(false);
    }
  }

  // process one decoded message from the phone (exposed for headless tests)
  R._apply = function (m) {
    if (!m || !m.a) return;
    if (m.a === 'm') { R.moveX = clamp(m.x); R.moveZ = clamp(m.z); R.sprint = !!m.s; return; }
    if (m.a === 'l') {
      if (!playing()) return;
      var P = G.player; if (!P) return;
      var sens = 0.0042 * (G.camera ? G.camera.fov / 75 : 1);
      P.yaw -= (m.dx || 0) * sens;
      P.pitch -= (m.dy || 0) * sens;
      P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
      P.swayX = Math.max(-40, Math.min(40, P.swayX + (m.dx || 0)));
      P.swayY = Math.max(-40, Math.min(40, P.swayY + (m.dy || 0)));
      return;
    }
    if (m.a === 'b') { handleBtn(m.k, m.v); return; }
    if (m.a === 'peers') { R.padConnected = !!m.pad; refreshPanel(); return; }
  };

  function reset() {
    R.moveX = R.moveZ = 0;
    R.sprint = R.jump = R.crouch = R.fire = R.ads = R.interactHeld = false;
  }

  /* ----------------------------------------------------- info panel + WS */
  var panel = null, padUrl = '';
  function buildPanel() {
    if (panel || typeof document === 'undefined' || !document.body) return;
    panel = document.createElement('div');
    panel.id = 'remote-panel';
    panel.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);' +
      'z-index:20;background:rgba(8,10,16,0.82);border:1px solid #2a3550;border-radius:8px;' +
      'padding:10px 18px;color:#cfe;font:14px/1.5 "Rajdhani","Segoe UI",system-ui,sans-serif;' +
      'text-align:center;letter-spacing:0.5px;box-shadow:0 6px 24px rgba(0,0,0,0.6);display:none;';
    document.body.appendChild(panel);
    refreshPanel();
  }
  function refreshPanel() {
    if (!panel) return;
    var dot = R.padConnected ? '<span style="color:#6f6">●</span> phone connected'
      : '<span style="color:#fd6">●</span> waiting for phone…';
    panel.innerHTML = '📱 <b>Use your phone as a controller</b> &nbsp; ' + dot +
      (padUrl ? '<br><span style="color:#9ab">open on your phone:</span> <b style="color:#ffd76e">' + padUrl + '</b>' : '');
  }

  R.update = function () {
    if (!R.connected) reset();      // a dropped phone must not keep strafing you
    if (!panel) return;
    // only clutter the screen on the menus, not mid-fight
    panel.style.display = (G.state === 'menu' || G.state === 'paused') ? 'block' : 'none';
  };

  // connect only in a browser served over http(s) — file:// and headless skip
  if (typeof WebSocket !== 'undefined' && typeof location !== 'undefined' &&
      /^https?:$/.test(location.protocol)) {
    buildPanel();
    if (typeof fetch === 'function') {
      fetch('/info').then(function (r) { return r.json(); })
        .then(function (j) { padUrl = j.padUrl || ''; refreshPanel(); })
        .catch(function () {});
    }
    var ws = null, retry = null;
    var connect = function () {
      var proto = location.protocol === 'https:' ? 'wss' : 'ws';
      try { ws = new WebSocket(proto + '://' + location.host + '/ws'); }
      catch (e) { return schedule(); }
      ws.onopen = function () { R.connected = true; ws.send(JSON.stringify({ a: 'hello', role: 'game' })); refreshPanel(); };
      ws.onmessage = function (ev) { try { R._apply(JSON.parse(ev.data)); } catch (e) {} };
      ws.onclose = function () { R.connected = false; R.padConnected = false; reset(); refreshPanel(); schedule(); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    };
    var schedule = function () { if (retry) return; retry = setTimeout(function () { retry = null; connect(); }, 1500); };
    connect();
  }
})();
