// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. A chase camera follows the plane over the valley: the terrain is
// a projected heightfield, the rings are hoops across the course, and the plane is
// drawn as a vector jet banking with the stick. Text that holds a number is rebuilt
// only when the number changes, so a frame allocates nothing.
import { CAMERA, FIELD, FONT, FOV, LIVES, PALETTE, PLANE, RING, TERRAIN } from './config.js';
import { onAirfield, valleyCentre } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const DEG = Math.PI / 180;
/** Panel width; its height grows with its lines. */
const PANEL = { width: 680, top: 150, line: 34, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const focal = (FIELD.height / 2) / Math.tan((FOV / 2) * DEG);
  const altLabel = cachedLabel('ALT ');
  const spdLabel = cachedLabel('SPD ');
  const hdgLabel = cachedLabel('HDG ');
  const scoreLabel = cachedLabel('SCORE ');
  const ringsLabel = cachedLabel('RINGS ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  // ---- 3D camera -----------------------------------------------------------
  // Basis vectors, rebuilt each frame from the plane and the screen.
  const cam = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, ux: 0, uy: 0, uz: 0 };
  function setupCamera(state, screen) {
    const plane = state.plane;
    let lookX;
    let lookY;
    let lookZ;
    if (screen === SCREEN_TITLE) {
      // Attract mode: slow orbit around the parked plane on the runway.
      const a = state.elapsed * 0.12;
      cam.x = plane.x + Math.sin(a) * 85;
      cam.y = plane.y + 30 + 12 * Math.sin(a * 0.7);
      cam.z = plane.z + Math.cos(a) * 85;
      lookX = plane.x;
      // Look well above the plane so it sits below the title panel, in the open.
      lookY = plane.y + 34;
      lookZ = plane.z - 60;
    } else {
      const fx = Math.sin(plane.heading);
      const fz = -Math.cos(plane.heading);
      cam.x = plane.x - fx * CAMERA.behind;
      cam.y = plane.y + CAMERA.above;
      cam.z = plane.z - fz * CAMERA.behind;
      lookX = plane.x + fx * CAMERA.lookAhead;
      lookY = plane.y + 1.5 - plane.pitch * 22;
      lookZ = plane.z + fz * CAMERA.lookAhead;
    }
    let dx = lookX - cam.x;
    let dy = lookY - cam.y;
    let dz = lookZ - cam.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    cam.fx = dx;
    cam.fy = dy;
    cam.fz = dz;
    // right = forward x world-up (0,1,0) = (-fz, 0, fx); up = right x forward.
    let rx = -dz;
    let rz = dx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    cam.rx = rx;
    cam.ry = 0;
    cam.rz = rz;
    cam.ux = cam.ry * cam.fz - cam.rz * cam.fy;
    cam.uy = cam.rz * cam.fx - cam.rx * cam.fz;
    cam.uz = cam.rx * cam.fy - cam.ry * cam.fx;
  }

  /** Project a world point to logical screen coords, or null when behind the camera. */
  function project(x, y, z) {
    const vx = x - cam.x;
    const vy = y - cam.y;
    const vz = z - cam.z;
    const cz = vx * cam.fx + vy * cam.fy + vz * cam.fz;
    if (cz < 2) return null;
    const cx = vx * cam.rx + vy * cam.ry + vz * cam.rz;
    const cy = vx * cam.ux + vy * cam.uy + vz * cam.uz;
    return { x: FIELD.width / 2 + (cx / cz) * focal, y: FIELD.height / 2 - (cy / cz) * focal, depth: cz };
  }

  // ---- sky -----------------------------------------------------------------
  function drawSky(state) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(0.78, PALETTE.skyLow);
    grad.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Sun: fixed in the west sky, low and warm.
    const sun = project(cam.x - 2600, cam.y + 900, cam.z - 3400);
    if (sun && sun.x > -200 && sun.x < FIELD.width + 200 && sun.y > -200 && sun.y < FIELD.height + 200) {
      const glow = context.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 190);
      glow.addColorStop(0, PALETTE.sunGlow);
      glow.addColorStop(1, 'rgba(255, 236, 170, 0)');
      context.fillStyle = glow;
      context.fillRect(sun.x - 190, sun.y - 190, 380, 380);
      context.fillStyle = PALETTE.sun;
      context.beginPath();
      context.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
      context.fill();
    }
    // Clouds drift over the valley.
    for (const cloud of state.terrain.clouds) {
      const p = project(cloud.x, cloud.y, cloud.z);
      if (!p || p.depth < 30 || p.x < -260 || p.x > FIELD.width + 260 || p.y < -80 || p.y > FIELD.height * 0.7) continue;
      const s = (cloud.r / p.depth) * focal;
      context.fillStyle = PALETTE.cloudShade;
      context.beginPath();
      context.ellipse(p.x, p.y + s * 0.08, s, s * 0.34, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.cloud;
      context.beginPath();
      context.ellipse(p.x - s * 0.42, p.y, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
      context.ellipse(p.x + s * 0.4, p.y - s * 0.05, s * 0.66, s * 0.32, 0, 0, Math.PI * 2);
      context.ellipse(p.x, p.y - s * 0.14, s * 0.7, s * 0.34, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  // ---- terrain ---------------------------------------------------------------
  function terrainColor(h, slope, x, z) {
    // Patchy fields on the valley floor: a cheap hash picks a field or grass.
    const patch = ((Math.sin(x * 0.021 + z * 0.017) + Math.sin(x * 0.008 - z * 0.013)) * 0.5);
    if (h < 31.5) return PALETTE.water;
    if (h < 32 && Math.abs(x - valleyCentre(z)) < 45) return PALETTE.sand;
    if (h < 150) return patch > 0.45 ? PALETTE.field : PALETTE.grassLow;
    if (h < 280) return PALETTE.grassHigh;
    if (h < 430) return PALETTE.rock;
    if (h < 520) return slope > 0.55 ? PALETTE.rock : PALETTE.snow;
    return PALETTE.snow;
  }

  function drawTerrain(state) {
    const terrain = state.terrain;
    const cell = TERRAIN.cell;
    const plane = state.plane;
    const x0 = Math.floor((cam.x - TERRAIN.halfWidth * cell) / cell) * cell;
    const zFar = Math.floor((cam.z - TERRAIN.rowsAhead * cell) / cell) * cell;
    const zNear = Math.floor((cam.z + TERRAIN.rowsBehind * cell) / cell) * cell;
    // Far rows first so near ground overdraws them.
    for (let z = zFar; z <= zNear; z += cell) {
      for (let x = x0; x < x0 + TERRAIN.halfWidth * 2 * cell; x += cell) {
        const h00 = terrain.heightAt(x, z);
        const h10 = terrain.heightAt(x + cell, z);
        const h01 = terrain.heightAt(x, z + cell);
        const h11 = terrain.heightAt(x + cell, z + cell);
        const p00 = project(x, h00, z);
        const p10 = project(x + cell, h10, z);
        const p01 = project(x, h01, z + cell);
        const p11 = project(x + cell, h11, z + cell);
        if (!p00 || !p10 || !p01 || !p11) continue;
        const avg = (h00 + h10 + h01 + h11) / 4;
        const slope = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00)) / cell;
        let color = terrainColor(avg, slope, x + cell / 2, z + cell / 2);
        // The runway: a dark strip with a pale centreline on the airfield.
        const cx = valleyCentre(z + cell / 2);
        if (onAirfield(x + cell / 2, z + cell / 2) && Math.abs(x + cell / 2 - cx) < 13) {
          color = PALETTE.runway;
          if (Math.abs(x + cell / 2 - cx) < 1.6 && Math.floor((z / 36) % 2) === 0) color = PALETTE.runwayLine;
        }
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(p00.x, p00.y);
        context.lineTo(p10.x, p10.y);
        context.lineTo(p11.x, p11.y);
        context.lineTo(p01.x, p01.y);
        context.closePath();
        context.fill();
      }
    }
    // The river: a brighter ribbon where the channel runs, skipping the airfield.
    context.strokeStyle = PALETTE.waterDeep;
    context.lineWidth = 2;
    context.beginPath();
    let started = false;
    for (let z = zFar; z <= zNear; z += cell / 2) {
      const cx = valleyCentre(z);
      if (onAirfield(cx, z) || terrain.heightAt(cx, z) >= 32) {
        started = false;
        continue;
      }
      const p = project(cx, 30.5, z);
      if (!p) {
        started = false;
        continue;
      }
      if (!started) {
        context.moveTo(p.x, p.y);
        started = true;
      } else context.lineTo(p.x, p.y);
    }
    context.stroke();
    // Village houses beside the airfield.
    for (const house of terrain.houses) {
      const base = project(house.x, terrain.heightAt(house.x, house.z), house.z);
      if (!base || base.depth > 1500) continue;
      const s = (10 / base.depth) * focal;
      if (s < 2) continue;
      context.fillStyle = PALETTE.wall;
      context.fillRect(base.x - s * 0.5, base.y - s * 0.55, s, s * 0.55);
      context.fillStyle = PALETTE.roof;
      context.beginPath();
      context.moveTo(base.x - s * 0.62, base.y - s * 0.55);
      context.lineTo(base.x, base.y - s * 0.9);
      context.lineTo(base.x + s * 0.62, base.y - s * 0.55);
      context.closePath();
      context.fill();
    }
  }

  // ---- rings -----------------------------------------------------------------
  function drawRings(state) {
    const rings = state.rings;
    for (let index = 0; index < rings.length; index += 1) {
      const ring = rings[index];
      const next = index === 0;
      const points = [];
      let visible = 0;
      for (let a = 0; a < 26; a += 1) {
        const t = (a / 26) * Math.PI * 2;
        const p = project(ring.x + Math.cos(t) * RING.radius, ring.y + Math.sin(t) * RING.radius, ring.z);
        if (p) {
          points.push(p);
          visible += 1;
        } else points.push(null);
      }
      if (visible < 8) continue;
      const dist = Math.hypot(state.plane.x - ring.x, state.plane.y - ring.y, state.plane.z - ring.z);
      context.strokeStyle = next ? PALETTE.ringNext : PALETTE.ring;
      context.globalAlpha = next ? 1 : clamp(1.15 - dist / 1400, 0.25, 0.7);
      context.lineWidth = next ? 7 : 5;
      context.beginPath();
      let pen = false;
      for (const p of points) {
        if (!p) {
          pen = false;
          continue;
        }
        if (!pen) {
          context.moveTo(p.x, p.y);
          pen = true;
        } else context.lineTo(p.x, p.y);
      }
      context.closePath();
      context.stroke();
      if (next) {
        const c = project(ring.x, ring.y, ring.z);
        if (c) {
          const s = (RING.radius / c.depth) * focal;
          context.fillStyle = PALETTE.ringNext;
          context.beginPath();
          context.moveTo(c.x, c.y - s * 0.45);
          context.lineTo(c.x - s * 0.22, c.y - s * 0.1);
          context.lineTo(c.x + s * 0.22, c.y - s * 0.1);
          context.closePath();
          context.fill();
          text(`${Math.round(dist)} m`, c.x, c.y + s + 26, 22, PALETTE.hud, 'center');
        }
      }
      context.globalAlpha = 1;
    }
  }

  // ---- the plane ---------------------------------------------------------------
  function drawPlane(state, screen) {
    const plane = state.plane;
    // Blink while invulnerable after a crash.
    if (plane.invulnerable > 0 && Math.floor(plane.invulnerable * 10) % 2 === 0 && screen !== SCREEN_TITLE) return;
    let sx;
    let sy;
    let scale;
    if (screen === SCREEN_TITLE) {
      const p = project(plane.x, plane.y + 4, plane.z);
      if (!p) return;
      sx = p.x;
      sy = p.y;
      scale = clamp((46 / p.depth) * focal / 90, 0.35, 1.4);
    } else {
      sx = FIELD.width / 2;
      sy = FIELD.height / 2 + 78 - plane.pitch * 130;
      scale = 1;
    }
    const bank = screen === SCREEN_TITLE ? 0 : plane.bank;
    context.save();
    context.translate(sx, sy);
    context.rotate(bank);
    context.scale(scale, scale);
    // Engine flame.
    if (!plane.parked && plane.throttle > 0.45) {
      const flick = 0.75 + 0.25 * Math.sin(state.elapsed * 31);
      context.fillStyle = PALETTE.flame;
      context.beginPath();
      context.moveTo(-7, 26);
      context.lineTo(0, 26 + 26 * flick * plane.throttle);
      context.lineTo(7, 26);
      context.closePath();
      context.fill();
    }
    // Wings: swept, with accent tips.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-14, 2);
    context.lineTo(-86, 30);
    context.lineTo(-78, 38);
    context.lineTo(-10, 16);
    context.lineTo(10, 16);
    context.lineTo(78, 38);
    context.lineTo(86, 30);
    context.lineTo(14, 2);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeAccent;
    context.fillRect(-86, 30, 12, 5);
    context.fillRect(74, 30, 12, 5);
    // Tail fins.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-10, 22);
    context.lineTo(-26, 44);
    context.lineTo(-18, 46);
    context.lineTo(-4, 26);
    context.closePath();
    context.moveTo(10, 22);
    context.lineTo(26, 44);
    context.lineTo(18, 46);
    context.lineTo(4, 26);
    context.closePath();
    context.fill();
    // Fuselage: nose to tail, tapering.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(0, -64);
    context.quadraticCurveTo(10, -30, 11, 8);
    context.lineTo(9, 34);
    context.lineTo(-9, 34);
    context.lineTo(-11, 8);
    context.quadraticCurveTo(-10, -30, 0, -64);
    context.closePath();
    context.fill();
    // Accent stripe down the fuselage.
    context.fillStyle = PALETTE.planeAccent;
    context.beginPath();
    context.moveTo(0, -58);
    context.lineTo(4, -20);
    context.lineTo(4, 30);
    context.lineTo(-4, 30);
    context.lineTo(-4, -20);
    context.closePath();
    context.fill();
    // Canopy, lit.
    context.fillStyle = PALETTE.planeCanopy;
    context.beginPath();
    context.ellipse(0, -34, 6.5, 15, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.65)';
    context.beginPath();
    context.ellipse(-2, -40, 2.2, 6, 0.2, 0, Math.PI * 2);
    context.fill();
    // Wingtip lights.
    context.fillStyle = '#ff5a4e';
    context.beginPath();
    context.arc(-84, 33, 3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#7dd069';
    context.beginPath();
    context.arc(84, 33, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // ---- HUD ---------------------------------------------------------------------
  function drawHud(state) {
    const plane = state.plane;
    const altFt = Math.round(plane.y * 3.28084);
    const spdKt = Math.round(plane.speed * 1.94384);
    const hdg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
    context.textBaseline = 'top';
    // Left instrument stack: ALT / SPD on the left, HDG / THR on the right.
    context.fillStyle = 'rgba(10, 18, 28, 0.55)';
    context.fillRect(16, 14, 300, 108);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(16, 14, 300, 108);
    text('ALT', 30, 24, 15, PALETTE.hudDim, 'left');
    text(altLabel(altFt) + ' ft', 30, 42, 26, PALETTE.hud, 'left');
    text('SPD', 30, 74, 15, PALETTE.hudDim, 'left');
    text(spdLabel(spdKt) + ' kt', 30, 92, 26, PALETTE.hud, 'left');
    text('HDG', 186, 24, 15, PALETTE.hudDim, 'left');
    text(hdgLabel(hdg) + '°', 186, 42, 26, PALETTE.hud, 'left');
    text('THR', 186, 74, 15, PALETTE.hudDim, 'left');
    context.fillStyle = 'rgba(255,255,255,0.16)';
    context.fillRect(186, 96, 116, 10);
    context.fillStyle = PALETTE.gold;
    context.fillRect(186, 96, 116 * plane.throttle, 10);
    // Artificial horizon: sky and ground halves, rolled with the plane.
    const hx = FIELD.width / 2;
    const hy = 66;
    const hr = 42;
    context.save();
    context.beginPath();
    context.arc(hx, hy, hr, 0, Math.PI * 2);
    context.clip();
    context.translate(hx, hy);
    context.rotate(-plane.bank);
    context.translate(0, clamp(plane.pitch * 90, -hr, hr));
    context.fillStyle = '#7fb8dd';
    context.fillRect(-hr, -hr * 2, hr * 2, hr * 2);
    context.fillStyle = '#8a6a45';
    context.fillRect(-hr, 0, hr * 2, hr * 2);
    context.fillStyle = PALETTE.hud;
    context.fillRect(-hr, -1, hr * 2, 2);
    context.restore();
    context.strokeStyle = PALETTE.hud;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(hx, hy, hr, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.moveTo(hx, hy - hr - 8);
    context.lineTo(hx - 5, hy - hr - 1);
    context.lineTo(hx + 5, hy - hr - 1);
    context.closePath();
    context.fill();
    // Right: score, rings, lives.
    context.fillStyle = 'rgba(10, 18, 28, 0.55)';
    context.fillRect(FIELD.width - 266, 14, 250, 108);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(FIELD.width - 266, 14, 250, 108);
    text(scoreLabel(state.score), FIELD.width - 30, 26, 26, PALETTE.hud, 'right');
    text(ringsLabel(state.ringsPassed), FIELD.width - 30, 62, 26, PALETTE.hud, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      const lx = FIELD.width - 252 + life * 26;
      context.fillStyle = life < state.lives ? PALETTE.planeAccent : 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.moveTo(lx + 8, 96);
      context.lineTo(lx + 16, 112);
      context.lineTo(lx, 112);
      context.closePath();
      context.fill();
    }
    // Centre reticle.
    const cx = FIELD.width / 2;
    const cy = FIELD.height / 2 + 78 - plane.pitch * 130;
    context.strokeStyle = 'rgba(238, 241, 245, 0.8)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(cx, cy, 12, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(238, 241, 245, 0.8)';
    context.beginPath();
    context.arc(cx, cy, 2, 0, Math.PI * 2);
    context.fill();
    // Warnings, flashing.
    const flash = Math.floor(state.elapsed * 4) % 2 === 0;
    const ground = state.terrain.heightAt(plane.x, plane.z);
    if (flash && !plane.onGround) {
      if (plane.speed < PLANE.stallSpeed + 4) text('STALL', cx, 150, 30, PALETTE.hudWarn, 'center');
      else if (plane.y - ground < 45) text('TERRAIN — PULL UP', cx, 150, 30, PALETTE.hudWarn, 'center');
      else if (plane.y > PLANE.ceiling - 30) text('CEILING', cx, 150, 30, PALETTE.hudWarn, 'center');
    }
    if (state.message && state.elapsed < state.messageUntil) {
      text(state.message, cx, 190, 30, PALETTE.hudGood, 'center');
    }
    // Controls hint, bottom.
    text('← → bank · ↑ ↓ pitch · Shift / Ctrl throttle · mouse steers · P pause', cx, FIELD.height - 18, 16, PALETTE.hudDim, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent ?? PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Fly the Meridian valley. Thread the glowing rings.',
    'Take off from the runway, mind the mountains, mind the river.',
    '← → or A D to bank · ↑ ↓ or W S to climb and dive',
    'Shift / Ctrl for throttle · move the mouse to steer · P pauses',
    '',
  ];
  const PAUSED_LINES = ['The valley will wait for you.'];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: sky, terrain, rings, plane, then the HUD or a panel. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    setupCamera(state, screen);
    drawSky(state);
    drawTerrain(state);
    drawRings(state);
    drawPlane(state, screen);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('RIDGE RUNNER', TITLE_LINES, 'Press Space or click to take off', PALETTE.gold);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = `Rings ${state.ringsPassed} · Distance ${Math.round(state.distance)} m`;
      OVER_LINES[2] = bestLabel(best);
      drawPanel('Flight over', OVER_LINES, 'Press Space or click to fly again', PALETTE.hudWarn);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
