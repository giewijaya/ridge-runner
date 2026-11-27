// Ridge Runner — Meridian Flight, handed in by this program (Node 22, standard
// library only). The game itself is this directory's game/ folder: plain static
// files a desktop browser loads offline (game/index.html and its ES modules, no
// library and no network request). This program copies game/ and screenshots/ from
// beside this file to /output, checks the screenshots against the scorer's caps
// first (so a bad frame fails loudly here instead of silently at grading), and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The scorer refuses more than this many screenshots, or any one over this size. */
const SHOT_LIMITS = { max: 4, min: 3, maxBytes: 262144 };

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Refuse a screenshot set the scorer would refuse, naming the offending file. */
function checkScreenshots(dir) {
  if (!existsSync(dir)) throw new Error('screenshots/ is missing: take 3 or 4 renders of the game first');
  const shots = readdirSync(dir)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort();
  if (shots.length < SHOT_LIMITS.min || shots.length > SHOT_LIMITS.max) {
    throw new Error(`screenshots/ holds ${shots.length} images, the scorer takes ${SHOT_LIMITS.min} to ${SHOT_LIMITS.max}`);
  }
  for (const name of shots) {
    const size = statSync(join(dir, name)).size;
    if (size > SHOT_LIMITS.maxBytes) {
      throw new Error(`screenshots/${name} is ${size} bytes, over the scorer's ${SHOT_LIMITS.maxBytes} cap`);
    }
  }
  return shots;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
const shots = checkScreenshots(join(out, 'screenshots'));

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: SHOT_LIMITS.max, max_bytes: SHOT_LIMITS.maxBytes },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Ridge Runner handed in: game/ + ${shots.length} screenshots (${shots[0]} is the cover) + dossier.json (${dossier.length} bytes)`);
