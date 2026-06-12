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
    H.round = el('hud-round');
    H.ammo = el('hud-ammo');
    H.gun = el('hud-gun');
    H.equip = el('hud-equip');
    H.perksEl = el('hud-perks');
    H.prompt = el('hud-prompt');
    H.bannerEl = el('hud-banner');
    H.bannerSub = el('hud-banner-sub');
    H.hitEl = el('hud-hitmarker');
    H.vig = el('hud-vignette');
    H.flash = el('hud-flash');
    H.pu = el('hud-powerups');
    H.downedEl = el('hud-downed');
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
    H.round.textContent = r;
    H.round.classList.remove('pulse');
    void H.round.offsetWidth;
    H.round.classList.add('pulse');
  };

  H.setAmmo = function () {
    var gun = G.weapons.current();
    if (!gun) { H.ammo.textContent = ''; H.gun.textContent = ''; return; }
    var s = G.weapons.stats(gun);
    H.ammo.textContent = gun.ammo + ' / ' + gun.reserve;
    H.ammo.style.color = gun.ammo === 0 ? '#f55' : '#eee';
    H.gun.textContent = s.name;
    H.gun.style.color = gun.papped ? '#d9f' : '#ccc';
    H.equip.textContent = 'Frags ' + G.player.frags +
      (G.player.hasMonkeys ? '  |  Monkeys ' + G.player.monkeys : '');
  };

  H.setPerks = function (perks) {
    H.perksEl.innerHTML = '';
    perks.forEach(function (id) {
      var def = G.CFG.PERKS[id];
      var d = document.createElement('div');
      d.className = 'perk';
      d.textContent = def.icon;
      d.style.background = '#' + new THREE.Color(def.color).getHexString();
      d.title = def.name;
      H.perksEl.appendChild(d);
    });
  };

  H.setPrompt = function (text) {
    H.prompt.textContent = text || '';
    H.prompt.style.display = text ? 'block' : 'none';
  };

  H.banner = function (text, color, secs, sub) {
    H.bannerEl.textContent = text;
    H.bannerEl.style.color = color || '#c11';
    H.bannerSub.textContent = sub || '';
    H.bannerEl.parentElement.style.opacity = 1;
    H.bannerTimer = secs || 2;
  };

  H.hitmarker = function (kill) {
    H.hitEl.style.opacity = 1;
    H.hitEl.style.color = kill ? '#f33' : '#fff';
    clearTimeout(H._hm);
    H._hm = setTimeout(function () { H.hitEl.style.opacity = 0; }, 90);
  };

  H.setAds = function (ads) {
    if (Math.abs((H._ads || 0) - ads) < 0.02) return;
    H._ads = ads;
    var cross = document.getElementById('hud-cross');
    cross.style.opacity = 0.75 * (1 - 0.85 * ads);
    cross.style.transform = 'translate(-50%, -50%) scale(' + (1 - 0.35 * ads) + ')';
  };

  H.setVignette = function (level) {
    H.vig.style.opacity = Math.max(0, Math.min(0.92, level * 1.1));
  };

  H.flashWhite = function () {
    H.flash.style.transition = 'none';
    H.flash.style.opacity = 0.9;
    void H.flash.offsetWidth;
    H.flash.style.transition = 'opacity 0.6s';
    H.flash.style.opacity = 0;
  };

  H.setPowerupTimers = function (timers) {
    var names = { insta: 'INSTA-KILL', double: 'DOUBLE POINTS', firesale: 'FIRE SALE' };
    var html = '';
    Object.keys(names).forEach(function (k) {
      if (timers[k] > 0) {
        html += '<span class="pu">' + names[k] + ' ' + Math.ceil(timers[k]) + 's</span>';
      }
    });
    H.pu.innerHTML = html;
  };

  H.showDowned = function (on) {
    H.downedEl.style.display = on ? 'flex' : 'none';
  };

  H.update = function (dt) {
    if (H.bannerTimer > 0) {
      H.bannerTimer -= dt;
      if (H.bannerTimer <= 0) H.bannerEl.parentElement.style.opacity = 0;
    }
  };

  /* ---------------------------------------------------------------- menus */
  H.showMenu = function (which) {
    el('menu-start').style.display = which === 'start' ? 'flex' : 'none';
    el('menu-pause').style.display = which === 'pause' ? 'flex' : 'none';
    el('menu-over').style.display = which === 'over' ? 'flex' : 'none';
    el('hud').style.display = which ? 'none' : 'block';
  };

  H.gameOverStats = function () {
    el('over-stats').innerHTML =
      G.CFG.cur.name + '<br>' +
      'You survived to round <b>' + G.zombies.round + '</b><br>' +
      'Kills: <b>' + G.player.kills + '</b> &nbsp; Points earned: <b>' + G.player.points + '</b><br>' +
      'Best round: <b>' + (localStorage.getItem(G.bestKey()) || G.zombies.round) + '</b>';
  };
})();
