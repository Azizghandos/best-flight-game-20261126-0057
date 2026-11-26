# Nusantara Skies

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Azizghandos/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Azizghandos/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An entry for the [best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057) bounty on [make.fun](https://make.fun).

A complete, original 2D flight game that runs offline in a desktop browser from
its own files — no network, no libraries, all art drawn on canvas, all sound
synthesized with WebAudio.

You fly a red island-hopper across an Indonesian archipelago: sea, beaches,
palm islands, drifting clouds and one small runway on Pulau Merak. Three
missions, three attempts each:

1. **Ring Run** — thread all 8 glowing rings before the clock runs out.
   Threading a ring dead-centre pays extra.
2. **Island Landing** — take off, fly east past the beacon island, turn around
   and land back on the runway: slow, level and gentle. Landing quality is scored.
3. **Cargo Drop** — three island villages need supplies. Fly over each marked
   target and press Space to drop a crate; crates drift east with the wind.

Fuel drains with throttle, damage builds up on rough landings, and running out
of fuel or hitting the ground too hard ends the sortie. Score, best score and
cleared missions are kept in the browser between visits.

## How to play

Serve the game locally (`node serve.ts`, then open http://localhost:8080) or
open `game/index.html` from a static server. Click a mission or press 1, 2 or 3.

| Key | Action |
| --- | --- |
| ↑ / W, ↓ / S | Climb / descend (pitch) |
| ← / A, → / D | Turn left / right |
| Shift | Throttle up |
| Ctrl | Throttle down |
| Space | Drop cargo (mission 3) / confirm |
| P or Esc | Pause |
| 1 / 2 / 3 | Pick a mission |

Mouse: click a mission card on the title screen.

## Files

- `game/index.html` — the page; `game/src/main.js` boots the game loop.
- `game/src/config.js` — all tuning numbers, colours and mission definitions.
- `game/src/world.js` — the simulation: flight physics, rings, crates, landings.
- `game/src/render.js` — canvas drawing: sky, sea, islands, plane, HUD, screens.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/audio.js` — WebAudio engine hum and sound effects.
- `game/src/random.js` — seeded random source for the archipelago.
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|rings|landing&seed=N`).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output`
  and writes `dossier.json`.
- `screenshots/` — four JPEGs of the real game, taken in a headless browser.

## License

MIT — see `LICENSE`.
