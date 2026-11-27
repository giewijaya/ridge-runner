// The valley the game flies through: a deterministic heightfield, so the same seed
// always builds the same mountains, river and airfield. No drawing and no browser
// in it — the renderer asks for heights, the world asks for heights, both get the
// same answer. World axes: x east, z south, y up (metres). The valley runs north,
// so the course flies toward -z, and the river winds along the valley floor.
import { VALLEY } from './config.js';

/** A stable 2D hash: the same integer grid corner always gives the same value. */
export function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise at world (x, z), in cell units of `size`. */
function noise2(x, z, size, seed) {
  const gx = x / size;
  const gz = z / size;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smooth(gx - ix);
  const fz = smooth(gz - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** The river's centreline: the x of the valley floor at a given z. */
export function valleyCentre(z) {
  return (
    VALLEY.centreAmp1 * Math.sin(z * VALLEY.centreFreq1) +
    VALLEY.centreAmp2 * Math.sin(z * VALLEY.centreFreq2 + VALLEY.centrePhase2)
  );
}

/** True while (x, z) is on the flattened airfield beside the runway. */
export function onAirfield(x, z) {
  const cx = valleyCentre(z);
  return z > -260 && z < 520 && Math.abs(x - cx) < 190;
}

export function createTerrain(seed) {
  /** Height of the ground at world (x, z), in metres. */
  function heightAt(x, z) {
    const cx = valleyCentre(z);
    const d = Math.abs(x - cx);
    // Rolling hills over the whole valley, stronger with distance from the river.
    const hills =
      26 * noise2(x, z, 420, seed) +
      14 * noise2(x, z, 170, seed + 7) +
      6 * noise2(x, z, 70, seed + 13);
    // The mountains: flat floor near the river, rising steeply past the foothills.
    const rise = clamp01((d - VALLEY.mountainStart) / (VALLEY.mountainFull - VALLEY.mountainStart));
    const mountains = VALLEY.mountainHeight * rise * rise * (0.75 + 0.5 * noise2(x, z, 900, seed + 29));
    // The river carves a channel down the middle of the floor.
    const channel = 9 * Math.exp(-((d / 55) ** 2));
    let h = VALLEY.floorAlt + hills * (0.35 + rise) + mountains - channel;
    if (onAirfield(x, z)) {
      // Flatten toward the runway strip so take-off is on level ground.
      const t = clamp01((190 - Math.abs(x - cx)) / 60) * clamp01((z + 260) / 120) * clamp01((520 - z) / 120);
      h = h * (1 - t) + (VALLEY.floorAlt + 4) * t;
    }
    return h;
  }

  /** Where the next ring goes: `index` rings ahead of the start, along the valley. */
  function ringAt(index) {
    const z = -900 - index * 700 - 260 * Math.sin(index * 2.399);
    const cx = valleyCentre(z);
    const off = 150 * Math.sin(index * 1.7 + 0.6);
    const alt = 150 + 170 * (0.5 + 0.5 * Math.sin(index * 1.13 + 2.1));
    return { x: cx + off, y: alt, z, heading: Math.PI };
  }

  /** A few fixed clouds, placed over the valley for the renderer. */
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    const z = 400 - hash2(i, 3, seed) * 5200;
    clouds.push({
      x: valleyCentre(z) + (hash2(i, 1, seed) - 0.5) * 2600,
      y: 420 + hash2(i, 2, seed) * 260,
      z,
      r: 90 + hash2(i, 4, seed) * 170,
    });
  }

  /** The village beside the airfield: little houses the renderer draws. */
  const houses = [];
  for (let i = 0; i < 14; i += 1) {
    const z = -120 + hash2(i, 11, seed) * 480;
    const side = hash2(i, 12, seed) > 0.5 ? 1 : -1;
    const x = valleyCentre(z) + side * (120 + hash2(i, 13, seed) * 90);
    houses.push({ x, z, w: 14 + hash2(i, 14, seed) * 12, d: 12 + hash2(i, 15, seed) * 10, h: 8 + hash2(i, 16, seed) * 7 });
  }

  return { heightAt, ringAt, clouds, houses };
}
