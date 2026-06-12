/* ===========================================================================
   DER WETTERJUNGE — audio.js
   All sound is synthesized with WebAudio: no audio assets.
   =========================================================================== */
(function () {
  'use strict';
  var G = window.G;
  var ctx = null, master = null, muted = false;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // One-shot oscillator with exponential decay envelope.
  function tone(freq, dur, type, vol, slideTo, when) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Filtered noise burst.
  function noise(dur, filterFreq, vol, type, when) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (when || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterFreq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  function melody(notes, step, type, vol) {
    notes.forEach(function (n, i) {
      if (n) tone(n, step * 1.8, type || 'square', vol || 0.12, null, i * step);
    });
  }

  var A = {
    init: function () { ensure(); },
    toggleMute: function () { muted = !muted; return muted; },

    shoot: function (cls, papped) {
      if (!ctx) return;
      var v = papped ? 0.5 : 0.4;
      if (cls === 'shotgun') { noise(0.28, 900, v + 0.15); tone(90, 0.2, 'triangle', 0.3, 40); }
      else if (cls === 'pistol') { noise(0.12, 2200, v); tone(180, 0.08, 'square', 0.15, 70); }
      else if (cls === 'lmg') { noise(0.16, 1300, v); tone(110, 0.1, 'sawtooth', 0.2, 50); }
      else if (cls === 'raygun') { tone(900, 0.18, 'sawtooth', 0.25, 120); tone(1400, 0.12, 'square', 0.1, 300); }
      else if (cls === 'thunder') {
        noise(0.7, 300, 0.8); tone(60, 0.7, 'sawtooth', 0.5, 20); tone(45, 0.9, 'triangle', 0.5, 15);
      } else if (cls === 'wunder') {
        tone(1500, 0.35, 'sawtooth', 0.3, 90); noise(0.3, 5000, 0.25, 'highpass');
      } else if (cls === 'storm') {
        tone(130, 0.55, 'sine', 0.4, 35); noise(0.5, 700, 0.35);
      } else { noise(0.13, 1700, v); tone(150, 0.08, 'square', 0.16, 60); }
      if (papped && cls !== 'thunder') tone(1200, 0.05, 'sine', 0.06, 2000);
    },
    dryFire: function () { tone(700, 0.05, 'square', 0.08); },
    reload: function () {
      tone(500, 0.05, 'square', 0.1); tone(350, 0.06, 'square', 0.1, null, 0.12);
      tone(620, 0.05, 'square', 0.12, null, 0.45);
    },
    knife: function () { noise(0.15, 4000, 0.2, 'highpass'); },
    knifeHit: function () { noise(0.12, 700, 0.35); tone(120, 0.1, 'triangle', 0.2, 60); },
    hitmark: function (head) { tone(head ? 1100 : 800, 0.04, 'square', 0.07); },

    zombieGroan: function (dist) {
      var vol = Math.max(0.02, 0.25 - dist * 0.008);
      var f = 70 + Math.random() * 60;
      tone(f, 0.7 + Math.random() * 0.5, 'sawtooth', vol, f * (0.6 + Math.random() * 0.3));
    },
    zombieAttack: function () { tone(120, 0.3, 'sawtooth', 0.3, 60); noise(0.2, 600, 0.2); },
    dogGrowl: function (dist) {
      var vol = Math.max(0.02, 0.3 - dist * 0.01);
      tone(95, 0.35, 'sawtooth', vol, 55); noise(0.3, 500, vol * 0.7);
    },
    hurt: function () { tone(200, 0.25, 'sawtooth', 0.35, 80); noise(0.15, 500, 0.3); },
    heartbeat: function () { tone(55, 0.12, 'sine', 0.4); tone(50, 0.1, 'sine', 0.3, null, 0.18); },

    buy: function () { melody([880, 1175], 0.07, 'square', 0.15); },
    deny: function () { tone(160, 0.18, 'square', 0.18, 110); },
    boardRepair: function () { noise(0.08, 1500, 0.25); tone(220, 0.06, 'square', 0.12); },
    boardTear: function () { noise(0.18, 800, 0.3); tone(140, 0.12, 'square', 0.12, 70); },

    perkJingle: function () {
      melody([523, 659, 784, 1047, 784, 1047], 0.11, 'square', 0.13);
      tone(262, 0.7, 'triangle', 0.1);
    },
    powerOn: function () {
      tone(50, 1.6, 'sawtooth', 0.4, 110); noise(0.8, 400, 0.3);
      melody([0, 0, 330, 392, 523], 0.16, 'triangle', 0.15);
    },
    powerup: function () { melody([784, 988, 1175, 1568], 0.06, 'square', 0.15); },
    maxAmmo: function () { melody([659, 784, 988, 1319, 1568], 0.08, 'square', 0.16); },
    nuke: function () { noise(1.4, 250, 0.8); tone(45, 1.4, 'sine', 0.6, 25); },
    explosion: function () { noise(0.8, 350, 0.7); tone(55, 0.6, 'triangle', 0.5, 25); },

    roundSting: function () {
      tone(98, 1.6, 'sawtooth', 0.25, 49);
      tone(123, 1.4, 'sawtooth', 0.18, 62);
      tone(147, 1.2, 'sawtooth', 0.12, 73);
    },
    dogRoundStart: function () {
      noise(1.8, 200, 0.7);
      tone(40, 2.0, 'sawtooth', 0.4, 20);
      melody([0, 0, 110, 104, 98], 0.3, 'sawtooth', 0.2);
    },
    thunderClap: function () { noise(1.0, 300, 0.5); tone(50, 0.9, 'triangle', 0.35, 22); },

    zap: function () {
      tone(1800, 0.3, 'sawtooth', 0.28, 110); noise(0.28, 5500, 0.22, 'highpass');
      tone(2400, 0.12, 'square', 0.1, 400);
    },
    vortex: function () { noise(2.4, 600, 0.4); tone(70, 2.4, 'sawtooth', 0.3, 35); },
    vortexTick: function () { tone(900 + Math.random() * 900, 0.1, 'sawtooth', 0.09, 200); },

    teleportCharge: function () { tone(220, 1.2, 'sawtooth', 0.2, 880); },
    teleport: function () {
      tone(880, 0.5, 'sawtooth', 0.3, 110); noise(0.5, 3000, 0.25, 'highpass');
      melody([1760, 1320, 880, 440], 0.07, 'sine', 0.12);
    },
    teleLink: function () { melody([440, 554, 659, 880], 0.09, 'triangle', 0.16); },

    boxOpen: function () {
      melody([392, 494, 587, 740, 880, 740, 587, 494, 392, 494, 587, 740], 0.18, 'triangle', 0.1);
    },
    teddy: function () { melody([784, 740, 698, 659, 622, 587], 0.16, 'sine', 0.14); },
    papChug: function () {
      melody([220, 277, 330, 277, 220, 277, 330, 440], 0.3, 'sawtooth', 0.12);
      noise(2.4, 500, 0.12);
    },
    monkeyJingle: function () { melody([1047, 1175, 1319, 1047, 1319, 1568], 0.12, 'square', 0.14); },
    throwSwish: function () { noise(0.15, 2500, 0.12, 'highpass'); },
    drink: function () { tone(300, 0.4, 'sine', 0.15, 600); noise(0.3, 900, 0.1); },
    downed: function () {
      melody([330, 311, 294, 277, 262], 0.25, 'sawtooth', 0.2);
      tone(65, 2.0, 'sine', 0.3, 40);
    },
    gameOver: function () {
      melody([262, 247, 233, 220, 0, 175, 165], 0.4, 'sawtooth', 0.2);
      tone(55, 3.5, 'triangle', 0.3, 30);
    }
  };

  G.audio = A;
})();
