# SHUTTERWILD

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/arya161100/shutterwild/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/arya161100/shutterwild/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**SHUTTERWILD — a wildlife photography game.** Pan the camera across a living valley,
wait for the perfect moment, and take the shot. A complete browser game: 7 days, 6 species,
a field guide to fill before the sun sets, limited film, and a golden hour that pays ×1.5.

## How to play

- **Mouse or A / D** — pan the camera across the valley
- **Wheel or + / −** — zoom the lens (each animal has an ideal zoom: focus matters)
- **SPACE or click** — take a photograph (14 exposures a day — a wasted shot is gone)
- **P** — pause, **R** — restart the day, **M** — mute, **Enter** — confirm

Each day the field guide asks for three photographs — a deer grazing, a heron fishing,
an eagle diving. A shot scores on framing, focus and the moment itself; a perfect shot
needs all three. Finish the guide before sunset to complete the day, with bonuses for
time and film left over. After day 7 the album is full and the expedition ends.

## The valley

Six species, each drawn procedurally and behaving differently: deer graze, drink and
leap; hares dart; foxes hunt at dusk; herons wade and fish the pond; owls perch and
spread their wings at last light; eagles soar and dive. Light moves from dawn to dusk,
rain falls on day 6, and fireflies rise in the golden hour. All sound is synthesised
with WebAudio — shutter clicks, chimes, birdsong and wind. No network requests, no
libraries: plain static files under `game/`.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Layout

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `config.js` (tuning, species, days), `random.js` (seeded RNG), `world.js`
  (simulation: animals, sun, film, scoring), `render.js` (valley, animals, HUD,
  screens), `input.js`, `audio.js` (synth sounds), `shots.js` (screenshot scenes),
  `main.js` (boot and the one loop)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json` (`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `shots.json` — the four screenshot scenes (`?shot=start|play|perfect|end&seed=1`)
- `screenshots/` — real renders of the game's own code
- `vendor/makefun-game.ts` — the kit's library, unchanged

MIT licensed. Built for the [make.fun best-game-01 bounty](https://make.fun/bounty/best-game-01).
