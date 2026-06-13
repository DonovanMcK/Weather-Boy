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
  "reload": "reload.wav",
  "explosion": "explosion.wav",
  "perk": "perk_jingle.wav",
  "round": "round_start.wav",
  "box": "mystery_box.wav"
}
```

Missing keys silently fall back to the synthesizer. Note: this requires
serving the game over http (`python3 -m http.server`) — browsers block
`fetch()` on `file://` pages, where the synth is always used.

We can't bundle actual Call of Duty audio — those files are Activision's
copyrighted assets — so use sounds you have the rights to.
