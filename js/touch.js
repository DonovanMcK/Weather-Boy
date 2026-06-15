/* ===========================================================================
   TOTENSTURM — touch.js
   Phone / tablet support. Mirrors the gamepad approach: touch only writes
   neutral "intents" onto G.touch (an idle screen contributes nothing), and
   discrete actions are dispatched as synthetic key events so they flow through
   the existing handlers. No pointer-lock is required on touch devices.

   Layout:
     Left half   = floating movement stick (push to edge to sprint)
     Right half  = drag to look
     Buttons     = fire · ADS · jump · slide · reload · use · swap ·
                   frag · monkey · knife · pause
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  var T = G.touch = {
    active: false,
    moveX: 0, moveZ: 0,
    sprint: false, jump: false, crouch: false,
    fire: false, ads: false, interactHeld: false,
    _tap: false
  };
  // one-shot "use/buy" press consumed by interact.js (same contract as the pad)
  T.consumeTap = function () { var t = T._tap; T._tap = false; return t; };
  T.update = function () {};   // intents are event-driven; reserved for symmetry

  function detect() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    var nav = (typeof navigator !== 'undefined') ? navigator : {};
    var hasTouch = ('ontouchstart' in window) ||
                   (nav.maxTouchPoints > 0) ||
                   (nav.msMaxTouchPoints > 0);
    if (!hasTouch) return false;
    // a coarse pointer or a mobile UA confirms this is really a phone/tablet
    // (avoids hijacking touchscreen laptops that are primarily mouse-driven)
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(nav.userAgent || '');
    return coarse || mobileUA;
  }

  if (!detect()) return;
  T.active = true;

  /* ----------------------------------------------------------------- DOM */
  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }

  // styles live here so they only exist on touch devices
  var style = el('style');
  style.textContent = [
    '#touch-zone-move,#touch-zone-look{position:fixed;top:0;bottom:0;z-index:5;}',
    '#touch-zone-move{left:0;right:50%;}',
    '#touch-zone-look{left:50%;right:0;}',
    '#touch-stick{position:fixed;width:120px;height:120px;margin:-60px 0 0 -60px;',
    '  border-radius:50%;border:2px solid rgba(255,255,255,0.28);',
    '  background:radial-gradient(circle,rgba(255,255,255,0.06),rgba(0,0,0,0.18));',
    '  display:none;z-index:6;pointer-events:none;}',
    '#touch-stick .knob{position:absolute;left:50%;top:50%;width:54px;height:54px;',
    '  margin:-27px 0 0 -27px;border-radius:50%;background:rgba(230,240,255,0.45);',
    '  box-shadow:0 0 10px rgba(0,0,0,0.5);}',
    '#touch-btns{position:fixed;inset:0;z-index:7;pointer-events:none;}',
    '.tc{position:absolute;pointer-events:auto;border-radius:50%;',
    '  background:rgba(18,22,32,0.46);border:2px solid rgba(255,255,255,0.32);',
    '  color:#e6f0ff;font:700 12px/1.05 "Rajdhani","Segoe UI",system-ui,sans-serif;',
    '  display:flex;align-items:center;justify-content:center;text-align:center;',
    '  box-shadow:0 2px 8px rgba(0,0,0,0.5);text-shadow:0 1px 2px #000;',
    '  -webkit-user-select:none;user-select:none;touch-action:none;',
    '  -webkit-tap-highlight-color:transparent;}',
    '.tc.on{background:rgba(150,40,40,0.72);border-color:#ff7a7a;color:#fff;}',
    '.tc .sub{display:block;font-size:9px;opacity:0.7;font-weight:600;}',
    'body.touch #hud-points-wrap{bottom:120px;}',
    'body.touch #hud-round{bottom:30px;}',
    'body.touch #hud-health{bottom:152px;}'
  ].join('\n');
  document.head.appendChild(style);

  var zMove = el('div', 'touch-zone-move');
  var zLook = el('div', 'touch-zone-look');
  var stick = el('div', 'touch-stick');
  var knob = el('div', null, 'knob'); stick.appendChild(knob);
  var btnWrap = el('div', 'touch-btns');
  document.body.appendChild(zMove);
  document.body.appendChild(zLook);
  document.body.appendChild(stick);
  document.body.appendChild(btnWrap);

  // button factory: pos is {right,bottom,left,top,size,font}
  function mkBtn(id, label, sub, pos) {
    var b = el('div', id, 'tc');
    b.innerHTML = label + (sub ? '<span class="sub">' + sub + '</span>' : '');
    var s = pos.size;
    b.style.width = b.style.height = s + 'px';
    if (pos.right != null) b.style.right = pos.right + 'px';
    if (pos.left != null) b.style.left = pos.left + 'px';
    if (pos.bottom != null) b.style.bottom = pos.bottom + 'px';
    if (pos.top != null) b.style.top = pos.top + 'px';
    if (pos.font) b.style.fontSize = pos.font + 'px';
    btnWrap.appendChild(b);
    return b;
  }

  var fireBtn   = mkBtn('tc-fire',   'FIRE',  '',     { right: 26,  bottom: 118, size: 96, font: 16 });
  var adsBtn    = mkBtn('tc-ads',    'AIM',   '',     { right: 134, bottom: 176, size: 66 });
  var jumpBtn   = mkBtn('tc-jump',   'JUMP',  '',     { right: 40,  bottom: 226, size: 66 });
  var slideBtn  = mkBtn('tc-slide',  'SLIDE', '',     { right: 138, bottom: 96,  size: 60 });
  var useBtn    = mkBtn('tc-use',    'USE',   'F',    { right: 150, bottom: 256, size: 64 });
  var reloadBtn = mkBtn('tc-reload', 'RELOAD','',     { right: 28,  bottom: 312, size: 62 });
  var swapBtn   = mkBtn('tc-swap',   'SWAP',  '',     { right: 100, bottom: 312, size: 62 });
  var fragBtn   = mkBtn('tc-frag',   'FRAG',  'G',    { right: 24,  bottom: 384, size: 54 });
  var monkeyBtn = mkBtn('tc-monkey', 'MONKEY','H',    { right: 90,  bottom: 384, size: 54 });
  var knifeBtn  = mkBtn('tc-knife',  'KNIFE', 'V',    { right: 156, bottom: 384, size: 54 });
  var pauseBtn  = mkBtn('tc-pause',  '⎉','',     { right: 16,  top: 16,     size: 46, font: 18 });

  /* ----------------------------------------------------------- helpers */
  function playing() { return G.state === 'playing'; }
  function tapKey(code) {
    if (typeof KeyboardEvent === 'undefined' || !window.dispatchEvent) return;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: code }));
  }
  function setOn(b, on) { if (b.classList) b.classList.toggle('on', !!on); }

  // a hold button drives a boolean intent for as long as it is pressed
  function holdBtn(b, onDown, onUp) {
    function down(e) { e.preventDefault(); e.stopPropagation(); setOn(b, true); onDown && onDown(); }
    function up(e) { if (e) { e.preventDefault(); e.stopPropagation(); } setOn(b, false); onUp && onUp(); }
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
  }
  // a tap button fires its action once per press
  function tapBtn(b, action) {
    function down(e) {
      e.preventDefault(); e.stopPropagation(); setOn(b, true);
      if (action) action();
    }
    function up(e) { if (e) { e.preventDefault(); e.stopPropagation(); } setOn(b, false); }
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
  }

  holdBtn(fireBtn,  function () { T.fire = true; },   function () { T.fire = false; });
  holdBtn(adsBtn,   function () { T.ads = true; },     function () { T.ads = false; });
  holdBtn(jumpBtn,  function () { T.jump = true; },     function () { T.jump = false; });
  holdBtn(slideBtn, function () { T.crouch = true; },   function () { T.crouch = false; });
  // USE: a tap registers a buy/use; holding it rebuilds barricades
  holdBtn(useBtn,
    function () { if (playing()) { T._tap = true; T.interactHeld = true; } },
    function () { T.interactHeld = false; });
  tapBtn(reloadBtn, function () { if (playing()) tapKey('KeyR'); });
  tapBtn(swapBtn,   function () { if (playing()) tapKey('KeyQ'); });
  tapBtn(fragBtn,   function () { if (playing()) tapKey('KeyG'); });
  tapBtn(monkeyBtn, function () { if (playing()) tapKey('KeyH'); });
  tapBtn(knifeBtn,  function () { if (playing()) tapKey('KeyV'); });
  tapBtn(pauseBtn,  function () {
    if (!G.setPaused) return;
    if (G.state === 'playing') G.setPaused(true);
    else if (G.state === 'paused') G.setPaused(false);
  });

  /* --------------------------------------------------- movement stick */
  var moveId = null, ox = 0, oy = 0;
  var STICK_R = 56;   // px from origin = full deflection

  zMove.addEventListener('touchstart', function (e) {
    if (moveId !== null || !playing()) return;
    var t = e.changedTouches[0];
    moveId = t.identifier;
    ox = t.clientX; oy = t.clientY;
    stick.style.left = ox + 'px';
    stick.style.top = oy + 'px';
    stick.style.display = 'block';
    knob.style.transform = 'translate(0px,0px)';
    e.preventDefault();
  }, { passive: false });

  zMove.addEventListener('touchmove', function (e) {
    if (moveId === null) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier !== moveId) continue;
      var dx = t.clientX - ox, dy = t.clientY - oy;
      var m = Math.hypot(dx, dy) || 1;
      var clamped = Math.min(m, STICK_R);
      var kx = dx / m * clamped, ky = dy / m * clamped;
      knob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
      // forward (up the screen) is -y, matching W / left-stick-up
      T.moveX = Math.max(-1, Math.min(1, dx / STICK_R));
      T.moveZ = Math.max(-1, Math.min(1, dy / STICK_R));
      T.sprint = T.moveZ < -0.82;   // push the stick fully forward to sprint
      e.preventDefault();
    }
  }, { passive: false });

  function endMove(e) {
    if (moveId === null) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === moveId) {
        moveId = null;
        T.moveX = T.moveZ = 0; T.sprint = false;
        stick.style.display = 'none';
        e.preventDefault();
        return;
      }
    }
  }
  zMove.addEventListener('touchend', endMove, { passive: false });
  zMove.addEventListener('touchcancel', endMove, { passive: false });

  /* -------------------------------------------------------- look drag */
  var lookId = null, lx = 0, ly = 0;
  var LOOK = 0.0046;   // rad per CSS px (scaled by zoom for 1:1 ADS feel)

  zLook.addEventListener('touchstart', function (e) {
    if (lookId !== null || !playing()) return;
    var t = e.changedTouches[0];
    lookId = t.identifier; lx = t.clientX; ly = t.clientY;
    e.preventDefault();
  }, { passive: false });

  zLook.addEventListener('touchmove', function (e) {
    if (lookId === null || !playing()) return;
    var P = G.player;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier !== lookId) continue;
      var dx = t.clientX - lx, dy = t.clientY - ly;
      lx = t.clientX; ly = t.clientY;
      var sens = LOOK * (G.camera ? G.camera.fov / 75 : 1);
      if (P) {
        P.yaw -= dx * sens;
        P.pitch -= dy * sens;
        P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
        P.swayX = Math.max(-40, Math.min(40, P.swayX + dx));
        P.swayY = Math.max(-40, Math.min(40, P.swayY + dy));
      }
      e.preventDefault();
    }
  }, { passive: false });

  function endLook(e) {
    if (lookId === null) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookId) { lookId = null; e.preventDefault(); return; }
    }
  }
  zLook.addEventListener('touchend', endLook, { passive: false });
  zLook.addEventListener('touchcancel', endLook, { passive: false });

  // block the browser pull-to-refresh / pinch-zoom while playing
  document.addEventListener('touchmove', function (e) {
    if (playing() && e.touches && e.touches.length) e.preventDefault();
  }, { passive: false });
})();
