// Ridge Runner — Meridian Flight. Every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. Distances are metres,
// speeds are m/s, altitudes are metres above sea level (the valley floor is ~30).

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Field of view of the chase camera, in degrees. */
export const FOV = 68;

/** Camera chase distance behind the plane, and height above it, in metres. */
export const CAMERA = { behind: 30, above: 8, lookAhead: 46 };

export const PLANE = {
  /** m/s at full throttle, and at idle. */
  minSpeed: 26,
  maxSpeed: 92,
  /** Degrees of pitch the stick commands, and how fast pitch follows. */
  maxPitch: 26,
  pitchRate: 2.6,
  /** Degrees of bank the stick commands, and how fast bank follows. */
  maxBank: 62,
  bankRate: 3.4,
  /** Extra sink (m/s) when slower than the stall speed. */
  stallSpeed: 34,
  stallSink: 14,
  /** Highest the plane may climb. */
  ceiling: 880,
  /** Seconds of grace after a respawn before another crash can happen. */
  invulnerable: 2.5,
};

export const THROTTLE = { start: 0.62, step: 0.45 };

export const LIVES = 3;

/** Points for flying through a ring, and per 50 m of valley flown. */
export const SCORE = { ring: 100, distancePer50m: 1 };

/** Rings: how far apart along the valley, their radius, and altitude band. */
export const RING = { spacing: 700, radius: 34, minAlt: 150, maxAlt: 330, keep: 6 };

/** The valley: the river's winding centreline, and where the mountains start. */
export const VALLEY = {
  centreAmp1: 190,
  centreFreq1: 0.0016,
  centreAmp2: 90,
  centreFreq2: 0.0007,
  centrePhase2: 1.7,
  floorAlt: 30,
  mountainStart: 320,
  mountainFull: 1500,
  mountainHeight: 430,
};

/** Terrain grid cell size (m) and how far the renderer draws it. */
export const TERRAIN = { cell: 60, halfWidth: 24, rowsAhead: 34, rowsBehind: 6 };

export const PALETTE = {
  backdrop: '#0e1a26',
  skyTop: '#2b6cb0',
  skyMid: '#7fb8dd',
  skyLow: '#f6d9a0',
  sun: '#fff3c4',
  sunGlow: 'rgba(255, 236, 170, 0.55)',
  cloud: 'rgba(255, 255, 255, 0.92)',
  cloudShade: 'rgba(226, 238, 246, 0.9)',
  grassLow: '#5d8a4a',
  grassHigh: '#7fae5c',
  field: '#b59a5e',
  rock: '#8a7f74',
  snow: '#eef3f6',
  sand: '#c2b280',
  water: '#3f8fc4',
  waterDeep: '#2b6ea6',
  runway: '#3a3f46',
  runwayLine: '#f2f2e8',
  road: '#a98f66',
  roof: '#b4503c',
  wall: '#e8ddc8',
  ring: '#ff9f1c',
  ringNext: '#ffb703',
  ringDone: '#7dd069',
  planeBody: '#e8edf2',
  planeAccent: '#e4572e',
  planeCanopy: '#1d3557',
  flame: '#ffcf3f',
  hud: '#eef1f5',
  hudDim: '#9fb4c4',
  hudWarn: '#ff5a4e',
  hudGood: '#7dd069',
  panel: 'rgba(16, 26, 38, 0.88)',
  panelEdge: '#4a6b84',
  text: '#eef1f5',
  muted: '#aebfce',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ridge-runner.best';
