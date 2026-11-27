# ridge-runner

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/giewijaya/ridge-runner/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/giewijaya/ridge-runner/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Ridge Runner — Meridian Flight: a complete flight game you can play offline in a desktop browser. Take off from a mountain-valley runway, bank through glowing rings over the river, mind the mountains, and don't stall. A cockpit-style HUD shows altitude, speed, heading, throttle and an artificial horizon; the game has a title screen, pause, landing, crashes, lives, a best score and WebAudio engine sounds.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, just static files under `game/`.

## How to play

- **← → or A / D** — bank (turn)
- **↑ ↓ or W / S** — climb and dive
- **Shift / Ctrl** — throttle up / down
- **Mouse** — steer by pointing
- **Space or click** — take off / fly again
- **P** — pause

Fly through the orange rings for +100 points each, plus 1 point per 50 m flown. Touch down gently and you land; hit the mountains or the riverbank and you lose a life — three lives per flight.

## Screenshots

The four frames under `screenshots/` are real renders of the game's own code, staged with `?shot=start|play|ring|end&seed=1` (see `shots.json`): the title over the runway, mid-flight chasing a ring, a close pass through a ring, and the flight-over panel.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9dyg1qpe&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
