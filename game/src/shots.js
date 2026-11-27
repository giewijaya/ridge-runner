// The screenshot scenes behind ?shot=start|play|ring|end. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot that banks toward
// the next ring and climbs or dives to its altitude, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_HIT, EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 9;
const PLAY_SECONDS = 24;
const RING_LIMIT_SECONDS = 90;
const END_LIMIT_SECONDS = 120;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Steer toward the next ring: bank to its heading, pitch to its altitude. */
function autopilot(state) {
  const plane = state.plane;
  const ring = state.rings[0];
  if (!ring) return { roll: 0, pitch: 0, throttle: 0 };
  const desiredHeading = Math.atan2(ring.x - plane.x, -(ring.z - plane.z));
  const error = wrapAngle(desiredHeading - plane.heading);
  const altError = ring.y - plane.y;
  // Throttle is a delta: hold it near 0.75 instead of winding it to full.
  const throttle = plane.throttle < 0.7 ? 1 : plane.throttle > 0.8 ? -1 : 0;
  return {
    roll: clamp(error * 1.4, -1, 1),
    pitch: clamp(altError / 120, -0.8, 0.8),
    throttle,
  };
}

/**
 * Set `world` to the named scene (start, play, ring or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'ring' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { roll: 0, pitch: 0, throttle: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'ring') {
    // Fly until the next ring fills the view, then hold that frame.
    for (let index = 0; index < RING_LIMIT_SECONDS / STEP; index += 1) {
      const controls = autopilot(world.state);
      world.step(STEP, controls, false);
      const ring = world.state.rings[0];
      const plane = world.state.plane;
      if (ring) {
        const dist = Math.hypot(plane.x - ring.x, plane.y - ring.y, plane.z - ring.z);
        if (dist < 130 && plane.z > ring.z) break;
      }
      if (world.state.lives < 3) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // Fly well (past the first ring, for a score worth showing), then dive into
    // the valley: the frame is the game-over panel.
    for (let index = 0; index < 20 / STEP; index += 1) {
      if (world.step(STEP, autopilot(world.state), false) & EVENT_OVER) break;
    }
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, { roll: 0.2, pitch: -1, throttle: -1 }, false);
      if (events & EVENT_HIT) break;
    }
    // The dive may only cost one life: spend the rest the same way.
    while (world.state.lives > 0) {
      const events = world.step(STEP, { roll: 0.2, pitch: -1, throttle: -1 }, false);
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world.state), false);
    if (events & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
