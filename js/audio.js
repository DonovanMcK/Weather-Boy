/* ===========================================================================
   WEATHER-BOY ZOMBIES — audio.js (engine v2)
   Layered cinematic synthesis: convolution reverb, compression, wave-shaped
   gunshot stacks (click/crack/body/boom), formant-filtered zombie growls.
   No asset files required — but if a sounds/manifest.json exists, real audio
   files are loaded and used instead (see sounds/README.md).
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var ctx = null, master = null, comp = null, reverb = null, muted = false;
  var noiseBuf = null;
  var shapeCache = {};
  var samples = {};       // optional real audio files, keyed by manifest name

  /* ------------------------------------------------------------ plumbing */
  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = 0.65;
      master.connect(comp);
      // generated impulse response: 1.6s exponentially decaying noise
      var sr = ctx.sampleRate, irLen = Math.floor(sr * 1.6);
      var ir = ctx.createBuffer(2, irLen, sr);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < irLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
        }
      }
      reverb = ctx.createConvolver();
      reverb.buffer = ir;
      var rg = ctx.createGain();
      rg.gain.value = 0.5;
      reverb.connect(rg);
      rg.connect(master);
      // 2s reusable white noise
      var nLen = sr * 2;
      noiseBuf = ctx.createBuffer(1, nLen, sr);
      var nd = noiseBuf.getChannelData(0);
      for (var n = 0; n < nLen; n++) nd[n] = Math.random() * 2 - 1;
      tryLoadSamples();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function shaper(amount) {
    // cache the curve, not the node — nodes accumulate connections
    var curve = shapeCache[amount];
    if (!curve) {
      var n = 256;
      curve = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var x = i / (n - 1) * 2 - 1;
        curve[i] = Math.tanh(x * amount);
      }
      shapeCache[amount] = curve;
    }
    var ws = ctx.createWaveShaper();
    ws.curve = curve;
    return ws;
  }

  // filtered, enveloped noise burst
  function noise(o) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (o.when || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    var node = src;
    if (o.drive) { var ws0 = shaper(o.drive); node.connect(ws0); node = ws0; }
    ['hp', 'lp', 'bp'].forEach(function (k) {
      if (!o[k]) return;
      var f = ctx.createBiquadFilter();
      f.type = k === 'hp' ? 'highpass' : (k === 'lp' ? 'lowpass' : 'bandpass');
      f.frequency.setValueAtTime(o[k], t);
      if (o.slide && k !== 'hp') f.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + o.dur);
      f.Q.value = o.q || 0.9;
      node.connect(f);
      node = f;
    });
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol, t + (o.att || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    node.connect(g);
    g.connect(master);
    if (o.send) { var s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(reverb); }
    src.start(t, Math.random());
    src.stop(t + o.dur + 0.1);
  }

  // enveloped oscillator (optionally pitch-sliding, detuned pair)
  function tone(o) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (o.when || 0);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol, t + (o.att || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    var node = g;
    if (o.drive) { var ws = shaper(o.drive); g.connect(ws); node = ws; }
    node.connect(master);
    if (o.send) { var s = ctx.createGain(); s.gain.value = o.send; node.connect(s); s.connect(reverb); }
    [0, o.detune || 0].forEach(function (det, i) {
      if (i === 1 && !o.detune) return;
      var osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq * (1 + det), t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.slideDur || o.dur));
      osc.connect(g);
      osc.start(t);
      osc.stop(t + o.dur + 0.1);
    });
  }

  function pluck(freq, when, vol, dur) {
    tone({ type: 'sine', freq: freq, dur: dur || 0.5, vol: vol || 0.16, when: when, send: 0.5 });
    tone({ type: 'sine', freq: freq * 2.01, dur: (dur || 0.5) * 0.6, vol: (vol || 0.16) * 0.25, when: when, send: 0.5 });
  }
  function melody(notes, step, vol, dur) {
    notes.forEach(function (n, i) { if (n) pluck(n, i * step, vol, dur); });
  }

  /* ----------------------------------------------- optional sample packs */
  function tryLoadSamples() {
    if (typeof fetch === 'undefined') return;
    fetch('sounds/manifest.json').then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (man) {
      if (!man) return;
      Object.keys(man).forEach(function (key) {
        fetch('sounds/' + man[key]).then(function (r) { return r.arrayBuffer(); })
          .then(function (ab) { return ctx.decodeAudioData(ab); })
          .then(function (buf) { samples[key] = buf; })
          .catch(function () {});
      });
    }).catch(function () {});
  }

  function playSample(key, vol, jitter) {
    var buf = samples[key];
    if (!buf || !ctx || muted) return false;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * (jitter || 0);
    var g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(master);
    var s = ctx.createGain();
    s.gain.value = 0.3;
    g.connect(s);
    s.connect(reverb);
    src.start();
    return true;
  }

  /* ------------------------------------------------------------ gunshots */
  // click transient + mid crack + low body + boom tail, tuned per class
  var SHOT = {
    pistol:  { crack: 2400, crackDur: 0.05, crackVol: 0.5, body: 150, bodyTo: 70, bodyDur: 0.09, boom: 500, boomDur: 0.12, boomVol: 0.3 },
    smg:     { crack: 2600, crackDur: 0.045, crackVol: 0.5, body: 160, bodyTo: 80, bodyDur: 0.07, boom: 600, boomDur: 0.1, boomVol: 0.28 },
    rifle:   { crack: 2000, crackDur: 0.06, crackVol: 0.6, body: 130, bodyTo: 60, bodyDur: 0.11, boom: 450, boomDur: 0.16, boomVol: 0.36 },
    shotgun: { crack: 1300, crackDur: 0.09, crackVol: 0.65, body: 110, bodyTo: 42, bodyDur: 0.2, boom: 320, boomDur: 0.3, boomVol: 0.55 },
    lmg:     { crack: 1900, crackDur: 0.06, crackVol: 0.58, body: 125, bodyTo: 58, bodyDur: 0.12, boom: 420, boomDur: 0.16, boomVol: 0.38 },
    sniper:  { crack: 1600, crackDur: 0.12, crackVol: 0.75, body: 100, bodyTo: 38, bodyDur: 0.26, boom: 350, boomDur: 0.45, boomVol: 0.6 },
    minigun: { crack: 2700, crackDur: 0.035, crackVol: 0.42, body: 170, bodyTo: 90, bodyDur: 0.05, boom: 700, boomDur: 0.07, boomVol: 0.22 },
    launcher:{ crack: 900,  crackDur: 0.1, crackVol: 0.4, body: 90, bodyTo: 35, bodyDur: 0.3, boom: 260, boomDur: 0.4, boomVol: 0.55 }
  };

  // a stable per-gun "voice": each weapon id hashes to small, consistent shifts
  // in pitch/length/brightness so two guns of the same class never sound alike,
  // while staying in the believable range for that class of firearm
  function gunHashA(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  var voiceCache = {};
  function gunVoice(id) {
    if (!id) return { pitch: 1, len: 1, bright: 1, tight: 1 };
    if (voiceCache[id]) return voiceCache[id];
    var h = gunHashA(id);
    function u(shift) { return ((h >>> shift) & 0xff) / 255; }   // 0..1
    var v = {
      pitch: 0.86 + u(0) * 0.30,   // ±~15% bore/caliber pitch
      len:   0.82 + u(8) * 0.42,   // barrel length -> tail length
      bright:0.80 + u(16) * 0.45,  // crack brightness (muzzle/gas)
      tight: 0.80 + u(24) * 0.40   // transient sharpness
    };
    voiceCache[id] = v;
    return v;
  }

  function gunshot(p, papped, id) {
    var boost = papped ? 1.15 : 1;
    var v = gunVoice(id);
    noise({ dur: 0.012 * v.tight, hp: 2600 * v.bright, vol: 0.45, att: 0.001 });  // click
    noise({ dur: p.crackDur * v.tight, bp: p.crack * v.bright, q: 0.7, drive: 2.5,
            vol: p.crackVol * boost, send: 0.35 });                               // crack
    tone({ type: 'triangle', freq: p.body * v.pitch, to: p.bodyTo * v.pitch, dur: p.bodyDur * v.len,
           vol: 0.5 * boost, send: 0.25, drive: 1.6 });                           // body
    noise({ dur: p.boomDur * v.len, lp: p.boom * v.pitch, slide: 110, vol: p.boomVol * boost,
            send: 0.55 });                                                        // boom tail
    noise({ dur: 0.03, bp: 4200 * v.bright, q: 2, vol: 0.1, when: 0.05 });        // action
    if (papped) tone({ type: 'sine', freq: 1500, to: 2400, dur: 0.08, vol: 0.05 });
  }

  /* -------------------------------------------------------------- growls */
  // detuned saws + sub through tanh into two formant bandpasses with tremolo
  function growl(o) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var dur = o.dur || (0.7 + Math.random() * 0.7);
    var f0 = o.f0 || (55 + Math.random() * 30);
    var mix = ctx.createGain();
    mix.gain.value = 1;
    [1, 1.012, 0.5].forEach(function (mul, i) {
      var osc = ctx.createOscillator();
      osc.type = i === 2 ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(f0 * mul, t);
      osc.frequency.linearRampToValueAtTime(f0 * mul * (o.bend || (0.85 + Math.random() * 0.3)), t + dur);
      var og = ctx.createGain();
      og.gain.value = i === 2 ? 0.6 : 0.4;
      osc.connect(og);
      og.connect(mix);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
    var ws = shaper(4);
    mix.connect(ws);
    var out = ctx.createGain();
    [o.f1 || 520, o.f2 || 1100].forEach(function (ff, i) {
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(ff * (0.9 + Math.random() * 0.25), t);
      f.frequency.linearRampToValueAtTime(ff * (o.sweep || 0.8), t + dur);
      f.Q.value = i ? 5 : 3.5;
      ws.connect(f);
      f.connect(out);
    });
    // breath
    var br = ctx.createBufferSource();
    br.buffer = noiseBuf; br.loop = true;
    var bf = ctx.createBiquadFilter();
    bf.type = 'lowpass'; bf.frequency.value = 850;
    var bg = ctx.createGain(); bg.gain.value = 0.18;
    br.connect(bf); bf.connect(bg); bg.connect(out);
    br.start(t, Math.random()); br.stop(t + dur + 0.05);
    // tremolo + envelope
    var trem = ctx.createGain();
    trem.gain.value = 0.75;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = o.trem || (7 + Math.random() * 5);
    var lg = ctx.createGain();
    lg.gain.value = 0.25;
    lfo.connect(lg); lg.connect(trem.gain);
    lfo.start(t); lfo.stop(t + dur + 0.05);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(o.vol, t + (o.att || 0.12));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(trem); trem.connect(env); env.connect(master);
    var s = ctx.createGain(); s.gain.value = 0.4; env.connect(s); s.connect(reverb);
  }

  function thump(vol, freq) {
    noise({ dur: 0.09, lp: 320, vol: vol, send: 0.25 });
    tone({ type: 'sine', freq: freq || 95, to: 45, dur: 0.1, vol: vol, send: 0.2 });
  }

  /* ------------------------------------------------------------- the API */
  var A = {
    init: function () { ensure(); },
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.65;
      return muted;
    },

    shoot: function (cls, papped, id) {
      if (!ctx) return;
      if (playSample('shoot_' + cls, 0.8, 0.05)) return;
      if (cls === 'raygun') {
        tone({ type: 'sawtooth', freq: 880, to: 140, dur: 0.22, vol: 0.3, send: 0.4, drive: 2 });
        tone({ type: 'square', freq: 1500, to: 400, dur: 0.1, vol: 0.08 });
        return;
      }
      if (cls === 'thunder') {
        noise({ dur: 0.8, lp: 350, slide: 60, vol: 0.85, send: 0.7 });
        tone({ type: 'sawtooth', freq: 65, to: 18, dur: 0.8, vol: 0.55, send: 0.5, drive: 2 });
        return;
      }
      if (cls === 'wunder') { A.zap(); return; }
      if (cls === 'storm') {
        tone({ type: 'sine', freq: 130, to: 35, dur: 0.5, vol: 0.45, send: 0.5 });
        noise({ dur: 0.5, lp: 800, slide: 150, vol: 0.4, send: 0.5 });
        return;
      }
      gunshot(SHOT[cls] || SHOT.rifle, papped, id);
    },
    dryFire: function () { noise({ dur: 0.025, bp: 2800, q: 2, vol: 0.18 }); },
    reload: function () {
      if (playSample('reload', 0.7, 0.04)) return;
      noise({ dur: 0.03, bp: 1800, q: 2, vol: 0.2 });
      noise({ dur: 0.04, bp: 1100, q: 2, vol: 0.22, when: 0.16 });
      noise({ dur: 0.035, bp: 2400, q: 2, vol: 0.25, when: 0.5 });
    },
    knife: function () { noise({ dur: 0.14, hp: 2400, vol: 0.22, att: 0.01 }); },
    knifeHit: function () { thump(0.4, 110); noise({ dur: 0.1, lp: 900, vol: 0.3 }); },
    hitmark: function (head) { noise({ dur: 0.02, bp: head ? 3200 : 2300, q: 3, vol: 0.08 }); },

    zombieGroan: function (dist) {
      var vol = Math.max(0.02, 0.34 - dist * 0.011);
      if (playSample('growl', vol * 2, 0.15)) return;
      growl({ vol: vol });
    },
    zombieScream: function (dist) {
      var vol = Math.max(0.03, 0.4 - dist * 0.013);
      if (playSample('scream', vol * 2, 0.12)) return;
      growl({ vol: vol, f0: 150 + Math.random() * 70, f1: 880, f2: 1900,
              trem: 17, dur: 0.7 + Math.random() * 0.35, att: 0.05,
              sweep: 1.45, bend: 1.35 });
      noise({ dur: 0.5, hp: 1200, vol: vol * 0.5, att: 0.08, send: 0.5 });
    },
    deathGurgle: function (dist) {
      var vol = Math.max(0.02, 0.3 - dist * 0.012);
      if (playSample('death', vol * 2, 0.15)) return;
      growl({ vol: vol, f0: 75, bend: 0.4, dur: 0.5, f1: 430, f2: 880,
              trem: 21, att: 0.02, sweep: 0.45 });
      noise({ dur: 0.3, lp: 700, vol: vol * 0.6 });
    },
    zombieAttack: function () {
      if (playSample('attack', 0.7, 0.1)) return;
      growl({ vol: 0.4, dur: 0.45, f0: 95, f1: 700, f2: 1500, trem: 14, att: 0.03, sweep: 1.3 });
      noise({ dur: 0.18, lp: 700, vol: 0.25 });
    },
    dogGrowl: function (dist) {
      var vol = Math.max(0.02, 0.36 - dist * 0.013);
      if (playSample('dog', vol * 2, 0.12)) return;
      growl({ vol: vol, f0: 48, f1: 420, f2: 900, trem: 16, dur: 0.5 + Math.random() * 0.4 });
    },
    hurt: function () {
      tone({ type: 'sawtooth', freq: 180, to: 70, dur: 0.2, vol: 0.3, drive: 2 });
      noise({ dur: 0.12, lp: 600, vol: 0.3 });
    },
    heartbeat: function () {
      thump(0.5, 55);
      thump(0.35, 50);
      tone({ type: 'sine', freq: 50, to: 38, dur: 0.1, vol: 0.35, when: 0.22 });
    },

    buy: function () { melody([880, 1175], 0.08, 0.14, 0.3); },
    deny: function () { tone({ type: 'square', freq: 150, to: 105, dur: 0.18, vol: 0.12 }); },
    boardRepair: function () {
      noise({ dur: 0.05, bp: 1400, q: 1.5, vol: 0.3 });
      thump(0.25, 130);
    },
    boardTear: function () {
      noise({ dur: 0.16, bp: 600, q: 1, vol: 0.32, drive: 2 });
      noise({ dur: 0.1, bp: 2000, q: 1, vol: 0.12, when: 0.02 });
    },

    perkJingle: function () {
      if (playSample('perk', 0.8, 0)) return;
      melody([523, 659, 784, 1047, 784, 1047], 0.12, 0.13, 0.6);
      tone({ type: 'sine', freq: 262, dur: 0.9, vol: 0.1, send: 0.6 });
    },
    powerOn: function () {
      tone({ type: 'sawtooth', freq: 45, to: 110, dur: 1.6, vol: 0.4, send: 0.4, drive: 2, att: 0.3 });
      noise({ dur: 0.9, lp: 500, vol: 0.3, send: 0.5 });
      melody([0, 0, 330, 392, 523], 0.18, 0.12, 0.7);
    },
    powerup: function () { melody([784, 988, 1175, 1568], 0.07, 0.14, 0.45); },
    maxAmmo: function () { melody([659, 784, 988, 1319, 1568], 0.09, 0.15, 0.5); },
    nuke: function () {
      noise({ dur: 1.6, lp: 300, slide: 60, vol: 0.8, send: 0.8 });
      tone({ type: 'sine', freq: 48, to: 24, dur: 1.6, vol: 0.6, send: 0.4 });
    },
    explosion: function () {
      if (playSample('explosion', 0.9, 0.08)) return;
      noise({ dur: 0.04, hp: 1200, vol: 0.5 });
      noise({ dur: 0.7, lp: 750, slide: 90, vol: 0.75, send: 0.7, drive: 2 });
      tone({ type: 'sine', freq: 85, to: 28, dur: 0.6, vol: 0.6, send: 0.4 });
      noise({ dur: 0.35, bp: 1800, q: 0.6, vol: 0.18, when: 0.05, send: 0.6 });
    },

    roundSting: function () {
      if (playSample('round', 0.8, 0)) return;
      // low minor swell, cello-ish
      [73.4, 87.3, 110].forEach(function (f) {
        tone({ type: 'sawtooth', freq: f, dur: 2.2, vol: 0.12, att: 0.25, send: 0.7, detune: 0.006 });
      });
      noise({ dur: 2.0, lp: 300, vol: 0.1, att: 0.3, send: 0.7 });
    },
    dogRoundStart: function () {
      A.thunderClap();
      [55, 52, 49].forEach(function (f, i) {
        tone({ type: 'sawtooth', freq: f, dur: 1.2, vol: 0.16, when: 0.5 + i * 0.35, att: 0.1, send: 0.7, drive: 2 });
      });
    },
    thunderClap: function () {
      noise({ dur: 0.08, hp: 800, vol: 0.45 });
      noise({ dur: 1.3, lp: 320, slide: 60, vol: 0.6, send: 0.8 });
      tone({ type: 'sine', freq: 55, to: 22, dur: 1.2, vol: 0.4, send: 0.4 });
    },

    teleportCharge: function () {
      tone({ type: 'sawtooth', freq: 180, to: 900, dur: 1.3, vol: 0.16, att: 0.2, send: 0.5 });
    },
    teleport: function () {
      tone({ type: 'sawtooth', freq: 900, to: 90, dur: 0.5, vol: 0.25, send: 0.5, drive: 2 });
      noise({ dur: 0.5, hp: 2200, vol: 0.2, send: 0.6 });
      melody([1760, 1320, 880, 440], 0.08, 0.1, 0.35);
    },
    teleLink: function () { melody([440, 554, 659, 880], 0.1, 0.15, 0.5); },

    boxOpen: function () {
      if (playSample('box', 0.8, 0)) return;
      melody([392, 494, 587, 740, 880, 740, 587, 494, 392, 494, 587, 740], 0.2, 0.1, 0.5);
    },
    teddy: function () { melody([784, 740, 698, 659, 622, 587], 0.18, 0.12, 0.55); },
    papChug: function () {
      melody([220, 277, 330, 277, 220, 277, 330, 440], 0.32, 0.1, 0.5);
      noise({ dur: 2.4, lp: 450, vol: 0.12, att: 0.4, send: 0.5 });
      tone({ type: 'sawtooth', freq: 55, dur: 2.5, vol: 0.12, att: 0.4, send: 0.4, drive: 2 });
    },
    monkeyJingle: function () { melody([1047, 1175, 1319, 1047, 1319, 1568], 0.13, 0.13, 0.4); },
    throwSwish: function () { noise({ dur: 0.14, hp: 1800, vol: 0.14, att: 0.04 }); },
    drink: function () {
      tone({ type: 'sine', freq: 280, to: 620, dur: 0.45, vol: 0.12, send: 0.4 });
      noise({ dur: 0.3, bp: 900, q: 1.5, vol: 0.08 });
    },
    downed: function () {
      melody([330, 311, 294, 277, 262], 0.3, 0.14, 0.8);
      tone({ type: 'sine', freq: 65, to: 38, dur: 2.2, vol: 0.3, send: 0.5 });
    },
    gameOver: function () {
      melody([262, 247, 233, 220, 0, 175, 165], 0.45, 0.14, 1.0);
      tone({ type: 'sawtooth', freq: 55, to: 28, dur: 3.5, vol: 0.22, att: 0.4, send: 0.8, drive: 2 });
    },
    slide: function () { noise({ dur: 0.35, lp: 500, vol: 0.2, att: 0.05 }); },
    land: function () { thump(0.3, 70); },
    zap: function () {
      noise({ dur: 0.28, hp: 3500, vol: 0.3, drive: 3 });
      tone({ type: 'sawtooth', freq: 2200, to: 120, dur: 0.3, vol: 0.25, send: 0.5, drive: 3 });
      tone({ type: 'square', freq: 90, to: 50, dur: 0.2, vol: 0.25 });
    },
    vortex: function () {
      noise({ dur: 2.4, lp: 650, slide: 200, vol: 0.4, send: 0.6 });
      tone({ type: 'sawtooth', freq: 70, to: 35, dur: 2.4, vol: 0.28, send: 0.4, drive: 2 });
    },
    vortexTick: function () {
      noise({ dur: 0.08, hp: 2800, vol: 0.1, drive: 3 });
      tone({ type: 'sawtooth', freq: 1400 + Math.random() * 800, to: 250, dur: 0.1, vol: 0.07 });
    }
  };

  G.audio = A;
})();
