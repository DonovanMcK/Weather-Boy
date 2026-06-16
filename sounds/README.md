# Drop-in real audio (optional)

The game synthesizes every sound at runtime, but if you own real sound files
(e.g. a royalty-free zombie/weapon SFX pack), drop them in this folder and the
game will use them automatically — no code changes.

1. Copy your `.wav` / `.mp3` / `.ogg` files into `sounds/`.
2. Create `sounds/manifest.json` mapping sound keys to filenames (any subset):

```json
{
  "growl": "zombie_growl.wav",
  "attack": "zombie_attack.wav",
  "dog": "hellhound.wav",
  "shoot_pistol": "pistol.wav",
  "shoot_smg": "smg.wav",
  "shoot_rifle": "rifle.wav",
  "shoot_shotgun": "shotgun.wav",
  "shoot_sniper": "sniper.wav",
  "shoot_lmg": "lmg.wav",
  "shoot_minigun": "minigun.wav",
  "shoot_launcher": "launcher.wav",

  "shoot_raygun": "raygun.wav",
  "shoot_ak74u": "ak74u.wav",

  "growl2": "zombie_growl_2.wav",
  "growl3": "zombie_growl_3.wav",
  "scream": "zombie_scream.wav",
  "death": "zombie_death.wav",

  "reload": "reload.wav",
  "explosion": "explosion.wav",
  "perk": "perk_jingle.wav",
  "round": "round_start.wav",
  "box": "mystery_box.wav"
}
```

**Per-gun override:** `shoot_<weaponId>` (e.g. `shoot_raygun`, `shoot_ak74u`,
`shoot_python`) is tried before the per-class `shoot_<cls>` key, so you can give
individual guns their own report. Weapon ids are the keys in `CFG.WEAPONS`
(config.js).

Missing keys silently fall back to the synthesizer. Note: this requires
serving the game over http (`node server.js`, or `python3 -m http.server`) —
browsers block `fetch()` on `file://` pages, where the synth is always used.

We can't bundle actual Call of Duty audio — those files are Activision's
copyrighted assets, and that's true of "replica"/ripped copies from YouTube,
Reddit, etc. too (still Activision's IP). Use sounds you have the rights to
(royalty-free SFX packs, ones you recorded/made, or your own legally-obtained
files) and the game will pick them up automatically.
