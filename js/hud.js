/* ===========================================================================
   DER WETTERJUNGE — hud.js
   DOM overlay: points, round, ammo, perks, prompts, banners, menus.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;

  function el(id) { return document.getElementById(id); }

  var H = G.hud = {};

  H.init = function () {
    H.points = el('hud-points');
    H.ticker = el('hud-ticker');
    H.roundNum = el('hud-round-num');
    H.mag = el('hud-mag');
    H.res = el('hud-res');
    H.ammoLine = el('hud-ammo-line');
    H.magbar = el('hud-magbar');
    H.gun = el('hud-gun');
    H.equip = el('hud-equip');
    H.perksEl = el('hud-perks');
    H.prompt = el('hud-prompt');
    H.bannerEl = el('hud-banner');
    H.bannerSub = el('hud-banner-sub');
    H.hitEl = el('hud-hitmarker');
    H.cross = el('hud-cross');
    H.vig = el('hud-vignette');
    H.flash = el('hud-flash');
    H.dmg = el('hud-dmg');
    H.pu = el('hud-powerups');
    H.downedEl = el('hud-downed');
    H.health = el('hud-health');
    H.shield = el('hud-shield');
    H.bannerTimer = 0;
  };

  H.setPoints = function (pts, delta) {
    H.points.textContent = pts;
    if (delta) {
      var t = document.createElement('div');
      t.className = 'tick ' + (delta > 0 ? 'plus' : 'minus');
      t.textContent = (delta > 0 ? '+' : '') + delta;
      H.ticker.appendChild(t);
      setTimeout(function () { t.remove(); }, 1100);
    }
  };
  H.flashPoints = function () {
    H.points.classList.remove('deny');
    void H.points.offsetWidth;
    H.points.classList.add('deny');
  };

  H.setRound = function (r) {
    H.roundNum.textContent = r;
    H.roundNum.classList.remove('pulse');
    void H.roundNum.offsetWidth;
    H.roundNum.classList.add('pulse');
  };

  H.setAmmo = function () {
    var gun = G.weapons.current();
    if (!gun) { H.mag.textContent = '0'; H.res.textContent = ''; H.gun.textContent = ''; return; }
    var s = G.weapons.stats(gun);
    H.mag.textContent = gun.ammo;
    H.res.textContent = '/ ' + gun.reserve;
    H.ammoLine.className = (gun.ammo === 0 || gun.ammo / s.mag <= 0.25) ? 'low' : '';
    H.gun.textContent = s.name;
    H.gun.style.color = gun.papped ? '#e0a8ff' : '#d8d8d8';
    // magazine pips (cap the count so huge drums don't overflow the screen)
    var pips = Math.min(s.mag, 40);
    if (H._magPips !== pips) {
      H._magPips = pips;
      var html = '';
      for (var i = 0; i < pips; i++) html += '<i></i>';
      H.magbar.innerHTML = html;
    }
    var loaded = Math.round(gun.ammo / s.mag * pips);
    var kids = H.magbar.children;
    for (var k = 0; k < kids.length; k++) {
      kids[k].className = k < loaded ? '' : 'spent';
    }
    var eq = '✊ ' + G.player.frags;
    if (G.player.hasMonkeys) eq += '   🐵 ' + G.player.monkeys;
    H.equip.textContent = eq;
  };

  H.setPerks = function (perks) {
    H.perksEl.innerHTML = '';
    perks.forEach(function (id) {
      var def = G.CFG.PERKS[id];
      var col = new THREE.Color(def.color);
      var d = document.createElement('div');
      d.className = 'perk pop';
      d.textContent = def.icon;
      d.style.background = 'radial-gradient(circle at 38% 32%, ' +
        '#' + col.clone().lerp(new THREE.Color(0xffffff), 0.35).getHexString() + ', ' +
        '#' + col.getHexString() + ' 65%, ' +
        '#' + col.clone().multiplyScalar(0.55).getHexString() + ')';
      d.title = def.name;
      H.perksEl.appendChild(d);
    });
  };

  H.setShield = function (sh) {
    if (!H.shield) return;
    if (!sh || !sh.has) { H.shield.style.display = 'none'; return; }
    H.shield.style.display = 'flex';
    var pips = '';
    for (var i = 0; i < sh.max; i++) pips += '<i' + (i < sh.hp ? '' : ' class="spent"') + '></i>';
    H.shield.innerHTML = '<span class="sh-label">SHIELD</span>' + pips;
  };

  H.setPrompt = function (text) {
    if (!text) { H.prompt.style.display = 'none'; H._prompt = null; return; }
    if (H._prompt === text) { H.prompt.style.display = 'block'; return; }
    H._prompt = text;
    // turn a leading "[F] " into a styled key-cap
    var m = text.match(/^\[(\w)\]\s*(.*)$/);
    if (m) H.prompt.innerHTML = '<span class="key">' + m[1] + '</span>' + escapeHtml(m[2]);
    else H.prompt.textContent = text;
    H.prompt.style.display = 'block';
  };

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
    });
  }

  H.banner = function (text, color, secs, sub) {
    H.bannerEl.textContent = text;
    H.bannerEl.style.color = color || '#c11';
    H.bannerSub.textContent = sub || '';
    H.bannerEl.parentElement.style.opacity = 1;
    H.bannerTimer = secs || 2;
  };

  H.hitmarker = function (kill) {
    H.hitEl.style.opacity = 1;
    H.hitEl.style.color = kill ? '#ff3a3a' : '#fff';
    if (H.cross) {
      H.cross.classList.add('hit');
      clearTimeout(H._chm);
      H._chm = setTimeout(function () { H.cross.classList.remove('hit'); }, 110);
    }
    clearTimeout(H._hm);
    H._hm = setTimeout(function () { H.hitEl.style.opacity = 0; }, 90);
  };

  // crosshair ADS response is handled in updateCrosshair (reads player.ads)
  H.setAds = function (ads) { H._ads = ads; };

  H.setScope = function (on) {
    if (H._scope === on) return;
    H._scope = on;
    document.getElementById('hud-scope').style.display = on ? 'block' : 'none';
  };

  H.setVignette = function (level) {
    H.vig.style.opacity = Math.max(0, Math.min(0.92, level * 1.1));
  };

  // directional damage indicator: rad is the attacker's bearing relative to
  // where the player faces (0 = dead ahead). Points the red arc that way, fades.
  H.damageFrom = function (rad) {
    if (!H.dmg) return;
    H.dmg.style.transition = 'none';
    H.dmg.style.transform = 'rotate(' + rad + 'rad)';
    H.dmg.style.opacity = 0.85;
    void H.dmg.offsetWidth;                 // restart the fade
    H.dmg.style.transition = 'opacity 0.55s ease-out';
    H.dmg.style.opacity = 0;
  };

  H.flashWhite = function () {
    H.flash.style.transition = 'none';
    H.flash.style.opacity = 0.9;
    void H.flash.offsetWidth;
    H.flash.style.transition = 'opacity 0.6s';
    H.flash.style.opacity = 0;
  };

  H.setPowerupTimers = function (timers) {
    var names = { insta: 'INSTA-KILL', double: 'DOUBLE POINTS', firesale: 'FIRE SALE', deathmachine: 'DEATH MACHINE' };
    var cols = { insta: '#ffe24a', double: '#ff8a33', firesale: '#55bbff', deathmachine: '#7fff8a' };
    var full = G.CFG.POWERUP_TIME || 30;
    var html = '';
    Object.keys(names).forEach(function (k) {
      if (timers[k] > 0) {
        var frac = Math.max(0, Math.min(1, timers[k] / full));
        html += '<span class="pu" style="color:' + cols[k] + '">' +
          names[k] + ' ' + Math.ceil(timers[k]) + 's' +
          '<i class="bar" style="width:' + (frac * 100) + '%;background:' + cols[k] + '"></i></span>';
      }
    });
    if (H._puHtml !== html) { H._puHtml = html; H.pu.innerHTML = html; }
  };

  H.showDowned = function (on) {
    H.downedEl.style.display = on ? 'flex' : 'none';
  };
  H.setDownedTimer = function (t) {
    H.downedEl.textContent = 'QUICK REVIVE — ' + Math.max(0, t).toFixed(1) + 's';
  };

  // health bar: width scales with max HP so Juggernog visibly grows it
  H.setHealth = function (hp, maxHp) {
    var key = Math.round(hp) + '/' + maxHp;
    if (H._hpKey === key) return;
    H._hpKey = key;
    var fill = H.health.firstElementChild || el('hud-health-fill');
    H.health.style.width = Math.round(80 + maxHp / 250 * 90) + 'px';
    var frac = Math.max(0, hp / maxHp);
    fill.style.width = (frac * 100) + '%';
    fill.style.background = frac > 0.55 ? '#d6ead6' : (frac > 0.28 ? '#e3b94f' : '#e23b3b');
    if (frac <= 0.28) H.health.classList.add('low'); else H.health.classList.remove('low');
  };

  // dynamic crosshair gap: opens with movement, sprint and recent fire; the
  // dot stays put. Hidden when scoped.
  function updateCrosshair() {
    if (!H.cross) return;
    var P = G.player, W = G.weapons;
    if (!P || !W) return;
    var speed = Math.hypot(P.vel.x || 0, P.vel.z || 0);
    var gap = 4 + speed * 0.7 + P.sprintAmt * 7;
    if (W.fireCd > 0) gap += Math.min(10, W.fireCd * 30); // bloom right after a shot
    gap *= (1 - 0.7 * P.ads);                              // tighten at ADS
    H.cross.style.setProperty('--gap', gap.toFixed(1) + 'px');
    H.cross.style.opacity = (H._scope ? 0 : 0.85 * (1 - 0.55 * P.ads)).toFixed(2);
  }

  H.update = function (dt) {
    if (H.bannerTimer > 0) {
      H.bannerTimer -= dt;
      if (H.bannerTimer <= 0) H.bannerEl.parentElement.style.opacity = 0;
    }
    updateCrosshair();
  };

  /* ---------------------------------------------------------------- menus */
  // controller/keyboard menu focus: each menu is a list of {el, action}
  H.menus = {};
  H.activeMenu = null;
  H.focusIdx = 0;
  H.setMenuItems = function (which, items) { H.menus[which] = items; };

  function applyFocus() {
    var items = H.menus[H.activeMenu];
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      var el2 = items[i] && items[i].el;
      if (el2 && el2.classList) el2.classList.toggle('focused', i === H.focusIdx);
    }
  }

  H.menuMove = function (dir) {
    var items = H.menus[H.activeMenu];
    if (!items || !items.length) return;
    H.focusIdx = (H.focusIdx + dir + items.length) % items.length;
    applyFocus();
  };
  H.menuActivate = function () {
    var items = H.menus[H.activeMenu];
    if (!items || !items.length) return;
    var it = items[H.focusIdx];
    if (it && it.action) it.action();
  };
  H.menuBack = function () {
    if (H.activeMenu === 'pause' && G.setPaused) G.setPaused(false);
  };

  H.showMenu = function (which) {
    el('menu-start').style.display = which === 'start' ? 'flex' : 'none';
    el('menu-pause').style.display = which === 'pause' ? 'flex' : 'none';
    el('menu-over').style.display = which === 'over' ? 'flex' : 'none';
    el('hud').style.display = which ? 'none' : 'block';
    H.activeMenu = which;
    H.focusIdx = 0;
    applyFocus();
  };

  H.gameOverStats = function () {
    el('over-stats').innerHTML =
      G.CFG.cur.name + '<br>' +
      'You survived to round <b>' + G.zombies.round + '</b><br>' +
      'Kills: <b>' + G.player.kills + '</b> &nbsp; Points earned: <b>' + G.player.points + '</b><br>' +
      'Best round: <b>' + (localStorage.getItem(G.bestKey()) || G.zombies.round) + '</b>';
  };
})();
