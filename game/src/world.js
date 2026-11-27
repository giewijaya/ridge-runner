// The game's rules and state, with no drawing and no browser in it: the plane over the
// valley, the ring course, the score, lives and crashes. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld returns.
import { LIVES, PLANE, RING, SCORE, THROTTLE } from './config.js';
import { createTerrain, valleyCentre } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;

const G = 9.81;
const DEG = Math.PI / 180;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function approach(value, target, rate, dt) {
  const diff = target - value;
  const step = rate * dt;
  if (diff > step) return value + step;
  if (diff < -step) return value - step;
  return target;
}

export function createWorld(random) {
  const seed = Math.floor(random() * 4294967296);
  const terrain = createTerrain(seed);
  const plane = {
    x: 0, y: 0, z: 0,
    heading: 0, pitch: 0, bank: 0,
    speed: 0, throttle: THROTTLE.start,
    invulnerable: 0, onGround: true, parked: true, airTime: 0,
  };
  const rings = [];
  for (let index = 0; index < RING.keep; index += 1) {
    rings.push({ ...terrain.ringAt(index), passed: false, missed: false });
  }
  const state = {
    plane, rings, terrain,
    score: 0, lives: LIVES, ringsPassed: 0, ringsMissed: 0,
    distance: 0, elapsed: 0, ringIndex: 0,
    lastSafe: { x: 0, y: 0, z: 0, heading: 0 },
    message: '', messageUntil: 0,
  };

  function placeAt(x, y, z, heading) {
    plane.x = x;
    plane.y = y;
    plane.z = z;
    plane.heading = heading;
    plane.pitch = 0;
    plane.bank = 0;
    plane.speed = PLANE.minSpeed + 12;
    plane.throttle = THROTTLE.start;
    plane.onGround = false;
    plane.invulnerable = PLANE.invulnerable;
    plane.airTime = 0;
    state.lastSafe = { x, y, z, heading };
  }

  function reset() {
    const cx = valleyCentre(200);
    const ground = terrain.heightAt(cx, 200);
    plane.x = cx;
    plane.y = ground + 2;
    plane.z = 200;
    plane.heading = 0;
    plane.pitch = 0;
    plane.bank = 0;
    plane.speed = 0;
    plane.throttle = THROTTLE.start;
    plane.invulnerable = 0;
    plane.onGround = true;
    plane.parked = true;
    plane.airTime = 0;
    rings.length = 0;
    for (let index = 0; index < RING.keep; index += 1) {
      rings.push({ ...terrain.ringAt(index), passed: false, missed: false });
    }
    state.score = 0;
    state.lives = LIVES;
    state.ringsPassed = 0;
    state.ringsMissed = 0;
    state.distance = 0;
    state.elapsed = 0;
    state.ringIndex = 0;
    state.lastSafe = { x: cx, y: ground + 120, z: 200, heading: 0 };
    state.message = '';
    state.messageUntil = 0;
  }

  function crash() {
    state.lives -= 1;
    plane.invulnerable = PLANE.invulnerable;
    if (state.lives === 0) return EVENT_HIT | EVENT_OVER;
    const safe = state.lastSafe;
    placeAt(safe.x, safe.y, safe.z, safe.heading);
    return EVENT_HIT;
  }

  /**
   * One fixed step. `controls` is { roll, pitch, throttle } with roll/pitch in -1..1
   * (roll right / pull up are positive) and throttle -1/0/1. With `harmless` set (the
   * title screen's backdrop) the plane sits parked and nothing scores or crashes.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (harmless) return events;
    plane.parked = false;

    if (plane.invulnerable > 0) plane.invulnerable = Math.max(0, plane.invulnerable - dt);
    plane.throttle = clamp(plane.throttle + controls.throttle * THROTTLE.step * dt, 0, 1);

    const targetBank = plane.onGround ? 0 : controls.roll * PLANE.maxBank * DEG;
    const targetPitch = controls.pitch * PLANE.maxPitch * DEG;
    plane.bank = approach(plane.bank, targetBank, PLANE.bankRate, dt);
    plane.pitch = approach(plane.pitch, plane.onGround ? 0 : targetPitch, PLANE.pitchRate, dt);

    // Bank turns the plane: a coordinated turn at this bank and speed.
    plane.heading += (G * Math.tan(plane.bank) / Math.max(plane.speed, 12)) * dt;

    const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    plane.speed = approach(plane.speed, targetSpeed, plane.onGround ? 14 : 7, dt);

    const forwardX = Math.sin(plane.heading);
    const forwardZ = -Math.cos(plane.heading);
    let vspeed = plane.speed * Math.sin(plane.pitch);
    if (!plane.onGround && plane.speed < PLANE.stallSpeed) vspeed -= PLANE.stallSink;
    if (plane.onGround) {
      // Rolling down the runway: steer gently, lift off when fast and pulling up.
      // Liftoff starts with pitch already up and a short grace period, so the plane
      // climbs away instead of touching down again on the next rise.
      plane.heading += controls.roll * 0.25 * dt;
      plane.x += forwardX * plane.speed * dt;
      plane.z += forwardZ * plane.speed * dt;
      plane.y = terrain.heightAt(plane.x, plane.z) + 2;
      if (plane.speed > PLANE.stallSpeed + 6 && controls.pitch > 0.25) {
        plane.onGround = false;
        plane.pitch = 10 * DEG;
        plane.airTime = 0;
        plane.invulnerable = Math.max(plane.invulnerable, 1.2);
      }
    } else {
      plane.airTime += dt;
      plane.x += forwardX * plane.speed * dt;
      plane.z += forwardZ * plane.speed * dt;
      plane.y += vspeed * dt;
      if (plane.y > PLANE.ceiling) {
        plane.y = PLANE.ceiling;
        plane.pitch = Math.min(plane.pitch, 0);
      }
      state.distance += plane.speed * dt;
      state.score += (plane.speed * dt * SCORE.distancePer50m) / 50;
    }

    // Rings: the next ring is the target; fly through its hoop to score.
    const next = rings[0];
    if (next) {
      const dz = plane.z - next.z;
      if (Math.abs(dz) < 28) {
        const dx = plane.x - next.x;
        const dy = plane.y - next.y;
        if (dx * dx + dy * dy < RING.radius * RING.radius) {
          next.passed = true;
          state.ringsPassed += 1;
          state.score += SCORE.ring;
          state.lastSafe = { x: next.x, y: next.y, z: next.z, heading: plane.heading };
          state.message = `RING +${SCORE.ring}`;
          state.messageUntil = state.elapsed + 1.6;
          events |= EVENT_RING;
        }
      }
      if (!next.passed && plane.z < next.z - 60) {
        next.missed = true;
        state.ringsMissed += 1;
      }
      if (next.passed || next.missed) {
        rings.shift();
        state.ringIndex += 1;
        rings.push({ ...terrain.ringAt(state.ringIndex + RING.keep - 1), passed: false, missed: false });
      }
    }

    // Terrain: a gentle touchdown on the runway is a landing, anything else is a crash.
    // Only after the plane has been airborne a while: a fresh liftoff climbs through
    // the first rises instead of touching down on them.
    const ground = terrain.heightAt(plane.x, plane.z);
    if (!plane.onGround && plane.airTime > 1.5 && plane.y <= ground + 2.5 && plane.invulnerable === 0) {
      if (vspeed > -8 && plane.speed > PLANE.stallSpeed * 0.8 && Math.abs(plane.bank) < 0.35) {
        plane.onGround = true;
        plane.y = ground + 2;
        state.message = 'TOUCHDOWN';
        state.messageUntil = state.elapsed + 1.6;
      } else {
        events |= crash();
      }
    }
    state.score = Math.floor(state.score);
    return events;
  }

  reset();
  return { state, reset, step, terrain, placeAt };
}
