# Duskmail Atoll
[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/yuumu2/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/yuumu2/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Fly a mail seaplane around a sunset atoll, clear ten rings in order, and return to the shore strip. A prompt return and a smooth, aligned landing earn bonus points.

## How to play

- **Space / Enter / click** starts or restarts a run.
- **W / S** raises or lowers throttle. **Shift / Control** also work.
- **↑ / ↓** climbs or descends. Hold **W** to build speed on the runway, then hold **↑** to lift off.
- **← / →** or **A / D** banks the plane and turns it.
- **P / Esc** pauses or resumes.
- Follow the cyan marker through the rings. When the HUD says **LAND**, line up with the strip, reduce speed, and descend gently with the wings level.

## Run locally

With Node 22.18 or later, run `node serve.ts` and open [http://localhost:8080](http://localhost:8080) in desktop Chrome. The local server supplies the ES modules and vendored Three.js. Internet access and a build step are unnecessary.

Add `?seed=7` to choose a terrain seed. The screenshot queries in `shots.json` stage four views and set `window.__shotReady` after rendering.

## Hand in the entry

Save the four staged browser captures in `screenshots/` with the filenames in `shots.json` and keep each JPEG at or below 256 KiB. Run `MAKEFUN_OUTPUT_DIR=out node main.ts` to copy the game and screenshots into `out/` and write `dossier.json`. The default output directory is `/output`.
