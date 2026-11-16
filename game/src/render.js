// Everything the player sees, painted on one canvas: the valley (sky, sun, mountains,
// pond, trees), the animals drawn procedurally, the particles, the camera's viewfinder
// and HUD, and every screen — title, play, paused, day done, day failed, expedition done.
// The renderer never changes the world; it only reads state.
import { FIELD, FONT, GROUND_Y, PALETTE, SKIES, SPECIES, WORLD_WIDE } from './config.js';
import { POND, TREES } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_DAY_DONE = 'day-done';
export const SCREEN_DAY_FAILED = 'day-failed';
export const SCREEN_EXPEDITION_DONE = 'expedition-done';

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(lerp(ca[0], cb[0], t))},${Math.round(lerp(ca[1], cb[1], t))},${Math.round(lerp(ca[2], cb[2], t))})`;
}

/** Sky palette at this sun height, blended between the keyframes. */
function skyAt(height) {
  let i = 0;
  while (i < SKIES.length - 2 && height > SKIES[i + 1].sun) i += 1;
  const a = SKIES[i];
  const b = SKIES[i + 1];
  const t = clamp((height - a.sun) / (b.sun - a.sun || 1), 0, 1);
  return { top: mixHex(a.top, b.top, t), mid: mixHex(a.mid, b.mid, t), low: mixHex(a.low, b.low, t) };
}

/** Deterministic pseudo-random from an index, so the valley never flickers. */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;

  function fit() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = FIELD.width * dpr;
    canvas.height = FIELD.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'left', weight = 600) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
  }

  // ---- scenery -----------------------------------------------------------

  function drawSky(state, time) {
    const h = Math.sin(Math.PI * clamp(state.sunT, 0, 1));
    const sky = skyAt(h);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, sky.top);
    g.addColorStop(0.55, sky.mid);
    g.addColorStop(1, sky.low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const sunX = lerp(140, FIELD.width - 140, state.sunT);
    const sunY = lerp(560, 130, h);
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 190);
    glow.addColorStop(0, 'rgba(255, 226, 140, 0.9)');
    glow.addColorStop(1, 'rgba(255, 226, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = '#ffdf8a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 6; i += 1) {
      const cx = ((hash(i * 3 + 1) * FIELD.width + time * (4 + i)) % (FIELD.width + 320)) - 160;
      const cy = 60 + hash(i * 7 + 2) * 150;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70 + hash(i) * 60, 16 + hash(i + 9) * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountains(cam) {
    ctx.fillStyle = '#5d6f8e';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= FIELD.width; x += 64) {
      const wx = x + cam.x * 0.25;
      const y = 300 + hash(Math.floor(wx / 180)) * 110 - Math.sin(wx * 0.004) * 40;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(FIELD.width, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6f8264';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= FIELD.width; x += 48) {
      const wx = x + cam.x * 0.5;
      const y = 430 + hash(Math.floor(wx / 150) + 40) * 70 - Math.sin(wx * 0.006) * 26;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(FIELD.width, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround(state, cam, zoom) {
    const sx = (wx) => (wx - cam.x) * zoom;
    const sy = (wy) => (wy - (FIELD.height - FIELD.height / zoom)) * zoom;
    const g = ctx.createLinearGradient(0, sy(GROUND_Y - 40), 0, FIELD.height);
    g.addColorStop(0, '#7ba05b');
    g.addColorStop(1, '#4d7c5f');
    ctx.fillStyle = g;
    ctx.fillRect(0, sy(GROUND_Y - 40), FIELD.width, FIELD.height - sy(GROUND_Y - 40));
    // The pond, with a shimmer that follows the sun.
    const px0 = sx(POND.x0);
    const px1 = sx(POND.x1);
    if (px1 > -50 && px0 < FIELD.width + 50) {
      ctx.fillStyle = '#7fb3c8';
      ctx.beginPath();
      ctx.ellipse((px0 + px1) / 2, sy(GROUND_Y + 26), (px1 - px0) / 2, 34 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const yy = sy(GROUND_Y + 12 + i * 12);
        ctx.beginPath();
        ctx.moveTo(px0 + 30 * zoom, yy);
        ctx.lineTo(px1 - 30 * zoom, yy);
        ctx.stroke();
      }
    }
    // Grass tufts and wildflowers, fixed to the valley by index.
    for (let i = 0; i < 90; i += 1) {
      const wx = hash(i * 13 + 5) * WORLD_WIDE;
      const x = sx(wx);
      if (x < -20 || x > FIELD.width + 20) continue;
      const y = sy(GROUND_Y + 30 + hash(i * 7 + 3) * 80);
      const sway = Math.sin(state.time * 1.2 + i) * 2;
      ctx.strokeStyle = i % 5 === 0 ? '#e8a0b4' : i % 5 === 1 ? '#f2d06b' : '#5d8a5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway, y - 8 * zoom, x + sway * 1.5, y - 14 * zoom);
      ctx.stroke();
    }
    // Trees the owl perches on.
    for (const tx of TREES) {
      const x = sx(tx);
      if (x < -120 || x > FIELD.width + 120) continue;
      const baseY = sy(GROUND_Y + 10);
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(x - 7 * zoom, baseY - 120 * zoom, 14 * zoom, 120 * zoom);
      ctx.fillStyle = '#3f6b3a';
      ctx.beginPath();
      ctx.arc(x, baseY - 150 * zoom, 52 * zoom, 0, Math.PI * 2);
      ctx.arc(x - 38 * zoom, baseY - 120 * zoom, 34 * zoom, 0, Math.PI * 2);
      ctx.arc(x + 38 * zoom, baseY - 120 * zoom, 34 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- animals -----------------------------------------------------------

  function leg(ctx2, x, y, len, swing, color) {
    ctx2.strokeStyle = color;
    ctx2.lineWidth = 5;
    ctx2.lineCap = 'round';
    ctx2.beginPath();
    ctx2.moveTo(x, y);
    ctx2.lineTo(x + Math.sin(swing) * 7, y + len);
    ctx2.stroke();
  }

  function drawDeer(a, x, y, s, time) {
    const spec = SPECIES.deer;
    const duck = a.headDown;
    const hop = a.hop * s;
    ctx.save();
    ctx.translate(x, y - hop);
    ctx.scale(a.dir, 1);
    ctx.fillStyle = spec.coat;
    ctx.beginPath();
    ctx.ellipse(0, -34 * s, 48 * s, 23 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Neck and head: held high when alert, stretched down and forward when grazing.
    const hx = lerp(40 * s, 66 * s, duck);
    const hy = lerp(-58 * s, -4 * s, duck);
    ctx.strokeStyle = spec.coat;
    ctx.lineWidth = 12 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(30 * s, -44 * s);
    ctx.quadraticCurveTo(lerp(44 * s, 62 * s, duck), lerp(-56 * s, -18 * s, duck), hx, hy);
    ctx.stroke();
    ctx.fillStyle = spec.coat;
    ctx.beginPath();
    ctx.ellipse(hx + 6 * s, hy - 2 * s, 14 * s, 10 * s, duck * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.belly;
    ctx.beginPath();
    ctx.ellipse(0, -22 * s, 42 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail.
    ctx.fillStyle = spec.belly;
    ctx.beginPath();
    ctx.ellipse(-48 * s, -40 * s, 8 * s, 6 * s, -0.6, 0, Math.PI * 2);
    ctx.fill();
    if (duck < 0.5) {
      ctx.strokeStyle = spec.antler;
      ctx.lineWidth = 3 * s;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + side * 4 * s, hy - 12 * s);
        ctx.lineTo(hx + side * 8 * s, hy - 32 * s);
        ctx.moveTo(hx + side * 6 * s, hy - 22 * s);
        ctx.lineTo(hx + side * 16 * s, hy - 26 * s);
        ctx.stroke();
      }
    }
    const swing = Math.sin(a.phase) * 0.5;
    leg(ctx, -28 * s, -14 * s, 14 * s, swing, spec.coat);
    leg(ctx, -12 * s, -14 * s, 14 * s, -swing, spec.coat);
    leg(ctx, 16 * s, -14 * s, 14 * s, -swing, spec.coat);
    leg(ctx, 30 * s, -14 * s, 14 * s, swing, spec.coat);
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(hx + 12 * s, hy - 4 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHare(a, x, y, s) {
    const spec = SPECIES.hare;
    ctx.save();
    ctx.translate(x, y - a.hop * s);
    ctx.scale(a.dir, 1);
    ctx.fillStyle = spec.coat;
    ctx.beginPath();
    ctx.ellipse(0, -14 * s, 22 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18 * s, -24 * s, 11 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = spec.coat;
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(14 * s, -32 * s);
    ctx.lineTo(10 * s, -52 * s);
    ctx.moveTo(20 * s, -32 * s);
    ctx.lineTo(20 * s, -54 * s);
    ctx.stroke();
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(23 * s, -26 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFox(a, x, y, s) {
    const spec = SPECIES.fox;
    const duck = a.headDown;
    ctx.save();
    ctx.translate(x, y - a.hop * s);
    ctx.scale(a.dir, 1);
    ctx.fillStyle = spec.coat;
    ctx.beginPath();
    ctx.ellipse(-26 * s, -20 * s, 26 * s, 13 * s, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -24 * s, 34 * s, 17 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const hx = lerp(28 * s, 46 * s, duck);
    const hy = lerp(-34 * s, -2 * s, duck);
    ctx.beginPath();
    ctx.arc(hx, hy, 11 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - 8 * s, hy - 8 * s);
    ctx.lineTo(hx - 5 * s, hy - 20 * s);
    ctx.lineTo(hx, hy - 8 * s);
    ctx.moveTo(hx + 4 * s, hy - 8 * s);
    ctx.lineTo(hx + 8 * s, hy - 20 * s);
    ctx.lineTo(hx + 10 * s, hy - 7 * s);
    ctx.fill();
    ctx.fillStyle = spec.belly;
    ctx.beginPath();
    ctx.ellipse(2 * s, -14 * s, 28 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = Math.sin(a.phase) * 0.5;
    leg(ctx, -18 * s, -12 * s, 12 * s, swing, '#3a2a1c');
    leg(ctx, 16 * s, -12 * s, 12 * s, -swing, '#3a2a1c');
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(hx + 6 * s, hy - 3 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeron(a, x, y, s) {
    const spec = SPECIES.heron;
    const flying = a.state === 'flight';
    ctx.save();
    ctx.translate(x, y - a.hop * s);
    ctx.scale(a.dir, 1);
    const flap = flying ? Math.sin(a.phase * 2.4) * 0.9 : 0;
    if (flying) {
      ctx.fillStyle = spec.coat;
      ctx.beginPath();
      ctx.ellipse(-6 * s, -6 * s, 26 * s, 10 * s, -0.4 + flap * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6 * s, -10 * s, 22 * s, 9 * s, 0.4 - flap * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!flying) {
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 2.5 * s;
      const step = Math.sin(a.phase) * 4 * s;
      ctx.beginPath();
      ctx.moveTo(-6 * s, -8 * s);
      ctx.lineTo(-6 * s + step, 0);
      ctx.moveTo(6 * s, -8 * s);
      ctx.lineTo(6 * s - step, 0);
      ctx.stroke();
    }
    ctx.fillStyle = spec.coat;
    ctx.beginPath();
    ctx.ellipse(0, -16 * s, 24 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const duck = a.headDown;
    const hx = lerp(30 * s, 36 * s, duck);
    const hy = lerp(-44 * s, 2 * s, duck);
    ctx.strokeStyle = spec.coat;
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(16 * s, -24 * s);
    ctx.quadraticCurveTo(34 * s, -46 * s, hx, hy);
    ctx.stroke();
    ctx.fillStyle = spec.coat;
    ctx.beginPath();
    ctx.arc(hx + 4 * s, hy, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2b544';
    ctx.beginPath();
    ctx.moveTo(hx + 9 * s, hy - 2 * s);
    ctx.lineTo(hx + 24 * s, hy + 1 * s);
    ctx.lineTo(hx + 9 * s, hy + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(hx + 5 * s, hy - 2 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawOwl(a, x, y, s) {
    const spec = SPECIES.owl;
    const spread = a.wing;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = spec.coat;
    ctx.beginPath();
    ctx.ellipse(-26 * s, -8 * s, 22 * s, 10 * s, -0.9 - spread * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(26 * s, -8 * s, 22 * s, 10 * s, 0.9 + spread * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -14 * s, 22 * s, 26 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = spec.belly;
    ctx.beginPath();
    ctx.ellipse(0, -8 * s, 14 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -34 * s, 15 * s, 0, Math.PI * 2);
    ctx.fillStyle = spec.coat;
    ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath();
    ctx.arc(-6 * s, -36 * s, 6 * s, 0, Math.PI * 2);
    ctx.arc(6 * s, -36 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(-6 * s, -36 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.arc(6 * s, -36 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2b544';
    ctx.beginPath();
    ctx.moveTo(-3 * s, -30 * s);
    ctx.lineTo(3 * s, -30 * s);
    ctx.lineTo(0, -25 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEagle(a, x, y, s) {
    const spec = SPECIES.eagle;
    const flap = Math.sin(a.phase * 1.6) * 0.35;
    const diving = a.state === 'dive';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(a.dir, 1);
    ctx.fillStyle = spec.coat;
    const wingAngle = diving ? 0.15 : 0.55 + flap;
    ctx.beginPath();
    ctx.ellipse(-30 * s, -6 * s, 44 * s, 12 * s, -wingAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(30 * s, -6 * s, 44 * s, 12 * s, wingAngle, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 30 * s, 11 * s, diving ? 0.5 : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6ead6';
    ctx.beginPath();
    ctx.arc(26 * s, diving ? 8 * s : -4 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2b544';
    ctx.beginPath();
    ctx.moveTo(34 * s, diving ? 6 * s : -6 * s);
    ctx.lineTo(46 * s, diving ? 9 * s : -3 * s);
    ctx.lineTo(34 * s, diving ? 11 * s : -1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(29 * s, diving ? 6 * s : -6 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const DRAW = {
    deer: drawDeer, hare: drawHare, fox: drawFox,
    heron: drawHeron, owl: drawOwl, eagle: drawEagle,
  };

  function drawAnimal(a, cam, zoom, time) {
    const spec = SPECIES[a.species];
    const s = (spec.size / 150) * zoom;
    const viewTop = FIELD.height - FIELD.height / zoom;
    const x = (a.x - cam.x) * zoom;
    const y = (a.y - viewTop) * zoom;
    if (x < -200 || x > FIELD.width + 200 || y < -200 || y > FIELD.height + 200) return;
    if (a.species === 'owl' && a.state === 'perch') {
      const tree = TREES.reduce((best, t) => (Math.abs(t - a.x) < Math.abs(best - a.x) ? t : best), TREES[0]);
      const tx = (tree - cam.x) * zoom;
      const ty = (GROUND_Y + 10 - 128 - viewTop) * zoom;
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(tx - 30 * zoom, ty, 60 * zoom, 6 * zoom);
      DRAW[a.species](a, tx, ty, s, time);
      return;
    }
    DRAW[a.species](a, x, y, s, time);
  }

  // ---- HUD and screens ---------------------------------------------------

  function drawViewfinder(state, preview) {
    // The HUD owns the screen corners, so the viewfinder is just the centre dot and,
    // when something worth shooting is framed, brackets around it.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(FIELD.width / 2, FIELD.height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    if (preview) {
      const c = preview.moment ? '#ffd94d' : 'rgba(255,255,255,0.7)';
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      const w = 110;
      const h = 80;
      const x = preview.x - w / 2;
      const y = preview.y - h / 2;
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * 18, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * 18);
        ctx.stroke();
      }
      text(preview.label, preview.x, y - 10, 15, c, 'center', 700);
    }
  }

  function drawSunDial(state) {
    const cx = FIELD.width / 2;
    const cy = 58;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, Math.PI, 0);
    ctx.stroke();
    const ang = Math.PI * (1 - clamp(state.sunT, 0, 1));
    ctx.fillStyle = state.sunT > 1 - 35 / 150 ? '#ffd94d' : '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * 26, cy - Math.sin(ang) * 26, 6, 0, Math.PI * 2);
    ctx.fill();
    const left = Math.max(0, Math.ceil(150 * (1 - state.sunT)));
    text(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, cx, cy + 48, 14, '#ffffff', 'center', 700);
  }

  function drawHud(state, day, best, preview) {
    panel(16, 14, 300, 64);
    text(day.name, 30, 40, 17, '#ffffff', 'left', 700);
    text(`${state.targets.filter((t) => t.done).length}/${state.targets.length} field-guide targets`, 30, 62, 13, '#cfd8e3');
    panel(FIELD.width - 216, 14, 200, 64);
    text(`SCORE  ${state.score}`, FIELD.width - 30, 40, 17, '#ffffff', 'right', 700);
    text(`BEST  ${Math.max(best, state.score)}`, FIELD.width - 30, 62, 13, '#cfd8e3', 'right');
    drawSunDial(state);
    panel(16, 92, 264, 30 + state.targets.length * 26);
    text('FIELD GUIDE', 30, 114, 12, '#ffd94d', 'left', 700);
    state.targets.forEach((t, i) => {
      const y = 140 + i * 26;
      const spec = SPECIES[t.species];
      ctx.fillStyle = t.done ? '#7ed491' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(30, y - 5, 7, 0, Math.PI * 2);
      ctx.fill();
      if (t.done) {
        ctx.strokeStyle = '#12351d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(26, y - 5);
        ctx.lineTo(29, y - 1);
        ctx.lineTo(35, y - 9);
        ctx.stroke();
      }
      text(`${spec.name} — ${t.moment}`, 46, y, 14, t.done ? '#bfe8c6' : '#ffffff');
    });
    panel(16, FIELD.height - 58, 250, 42);
    text('FILM', 30, FIELD.height - 30, 13, '#cfd8e3', 'left', 700);
    for (let i = 0; i < 12; i += 1) {
      ctx.fillStyle = i < state.film ? '#fdf8ec' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(76 + i * 14, FIELD.height - 40, 10, 20);
    }
    if (state.album.length > 0) {
      const w = 92;
      const total = Math.min(4, state.album.length) * (w + 8);
      panel(FIELD.width - 16 - total, FIELD.height - 66, total, 50);
      state.album.slice(0, 4).forEach((shot, i) => {
        const x = FIELD.width - 16 - total + 8 + i * (w + 8);
        const y = FIELD.height - 58;
        const spec = shot.species ? SPECIES[shot.species] : null;
        ctx.fillStyle = spec ? spec.coat : '#333d4a';
        roundRect(x, y, w, 34, 6);
        ctx.fill();
        // Light coats (heron) need dark text; dark coats take white.
        const [r, g, b] = spec ? hexToRgb(spec.coat) : [51, 61, 74];
        const dark = (r * 0.299 + g * 0.587 + b * 0.114) > 170;
        const fg = dark ? '#1d2733' : '#ffffff';
        const pts = dark ? '#7a5a12' : '#ffe9a8';
        text(spec ? spec.name : '—', x + 8, y + 21, 12, fg, 'left', 700);
        text(`${shot.points} pts`, x + w - 8, y + 21, 12, pts, 'right', 700);
      });
    }
    if (state.lastShot && state.cardT > 0) drawPhotoCard(state);
  }

  function drawPhotoCard(state) {
    const shot = state.lastShot;
    const w = 340;
    const h = shot.bonus ? 250 : 216;
    const x = FIELD.width - w - 24;
    const y = 100;
    panel(x, y, w, h);
    const spec = shot.species ? SPECIES[shot.species] : null;
    ctx.fillStyle = spec ? spec.coat : '#333d4a';
    roundRect(x + 16, y + 16, 64, 64, 10);
    ctx.fill();
    text(spec ? spec.name : 'No subject', x + 96, y + 44, 18, '#ffffff', 'left', 700);
    text(shot.moment ? `caught ${shot.moment}` : 'nothing in frame', x + 96, y + 66, 13, '#cfd8e3');
    const gradeColor = shot.grade === 'perfect' ? '#ffd94d' : shot.grade === 'great' ? '#7ed491' : '#ffffff';
    text(shot.label, x + 16, y + 112, 22, gradeColor, 'left', 800);
    text(`Framing  ${shot.framing}`, x + 16, y + 142, 14, '#ffffff');
    text(`Focus    ${shot.focus}`, x + 16, y + 164, 14, '#ffffff');
    text(`Moment  +${shot.momentBonus}${shot.golden ? '  ×1.5 golden hour' : ''}`, x + 16, y + 186, 14, '#ffffff');
    text(`${shot.points} points`, x + w - 16, y + 112, 22, '#ffe9a8', 'right', 800);
    if (shot.bonus) {
      text(`Time bonus  +${shot.bonus.time}`, x + 16, y + 214, 14, '#bfe8c6');
      text(`Film bonus  +${shot.bonus.film}`, x + 16, y + 234, 14, '#bfe8c6');
    }
  }

  function bigButton(label, y) {
    const w = 340;
    const x = (FIELD.width - w) / 2;
    panel(x, y, w, 54);
    text(label, FIELD.width / 2, y + 35, 18, '#ffffff', 'center', 700);
  }

  function drawTitle(state, day, best) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, 'rgba(20,28,44,0.25)');
    g.addColorStop(1, 'rgba(20,28,44,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('SHUTTERWILD', FIELD.width / 2, 218, 84, '#fdf8ec', 'center', 800);
    text('a wildlife photography game', FIELD.width / 2, 258, 22, '#ffe9a8', 'center', 600);
    text('Pan the valley. Wait for the moment. Take the shot.', FIELD.width / 2, 296, 17, '#ffffff', 'center', 600);
    bigButton('Press ENTER — begin the expedition', 340);
    panel((FIELD.width - 560) / 2, 420, 560, 132);
    text('HOW TO PLAY', FIELD.width / 2, 448, 13, '#ffd94d', 'center', 700);
    text('Mouse or A / D — pan the camera      Wheel or + / − — zoom the lens', FIELD.width / 2, 478, 15, '#ffffff', 'center');
    text('SPACE or click — take a photograph (12 exposures a day)', FIELD.width / 2, 504, 15, '#ffffff', 'center');
    text('Fill the field guide before the sun sets. Golden hour pays ×1.5.', FIELD.width / 2, 530, 15, '#ffffff', 'center');
    if (best > 0) text(`Best expedition: ${best} points`, FIELD.width / 2, 592, 15, '#cfd8e3', 'center');
    text('7 days  ·  6 species  ·  no two dawns alike', FIELD.width / 2, 624, 14, '#cfd8e3', 'center');
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(16,24,34,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 330, 56, '#ffffff', 'center', 800);
    text('P — resume      R — restart the day      M — mute', FIELD.width / 2, 380, 17, '#cfd8e3', 'center');
  }

  function starsFor(state) {
    const done = state.targets.filter((t) => t.done).length;
    if (done === state.targets.length && state.dayScore >= 1500) return 3;
    if (done === state.targets.length) return 2;
    return 1;
  }

  function drawDayDone(state, day, totalStars) {
    ctx.fillStyle = 'rgba(16,24,34,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel((FIELD.width - 560) / 2, 150, 560, 380);
    text('DAY COMPLETE', FIELD.width / 2, 210, 40, '#ffd94d', 'center', 800);
    text(day.name, FIELD.width / 2, 246, 18, '#ffffff', 'center', 600);
    const stars = starsFor(state);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.2)';
      const x = FIELD.width / 2 + (i - 1) * 64;
      ctx.beginPath();
      for (let p = 0; p < 10; p += 1) {
        const r = p % 2 === 0 ? 22 : 9;
        const a = -Math.PI / 2 + (p * Math.PI) / 5;
        ctx[p === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * r, 300 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    text(`Day score  ${state.dayScore}`, FIELD.width / 2, 366, 18, '#ffffff', 'center', 700);
    text(`Expedition score  ${state.score}`, FIELD.width / 2, 394, 15, '#cfd8e3', 'center');
    text(`Stars so far  ${'★'.repeat(totalStars)}  (${totalStars} of 21)`, FIELD.width / 2, 424, 15, '#ffe9a8', 'center');
    bigButton(state.dayIndex >= 6 ? 'ENTER — see the final album' : 'ENTER — next day', 452);
  }

  function drawDayFailed(state, day) {
    ctx.fillStyle = 'rgba(16,24,34,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel((FIELD.width - 560) / 2, 180, 560, 320);
    text('THE LIGHT IS GONE', FIELD.width / 2, 244, 36, '#ffffff', 'center', 800);
    text(state.failReason, FIELD.width / 2, 282, 18, '#ffd94d', 'center', 600);
    const done = state.targets.filter((t) => t.done).length;
    text(`Field guide: ${done} of ${state.targets.length} targets photographed`, FIELD.width / 2, 318, 15, '#cfd8e3', 'center');
    text('The valley keeps its secrets for one more day.', FIELD.width / 2, 348, 15, '#cfd8e3', 'center');
    bigButton('R — try this day again', 400);
  }

  function drawExpeditionDone(state, best, totalStars) {
    ctx.fillStyle = 'rgba(16,24,34,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel((FIELD.width - 620) / 2, 120, 620, 440);
    text('THE ALBUM IS FULL', FIELD.width / 2, 186, 40, '#ffd94d', 'center', 800);
    text('Seven dawns, seven days — the expedition is over.', FIELD.width / 2, 222, 17, '#ffffff', 'center', 600);
    text(`${state.score} points`, FIELD.width / 2, 282, 44, '#ffffff', 'center', 800);
    text(`Stars  ${'★'.repeat(totalStars)}  (${totalStars} of 21)    ·    Best  ${Math.max(best, state.score)}`, FIELD.width / 2, 322, 16, '#ffe9a8', 'center');
    if (state.album.length > 0) {
      const w = 92;
      const total = Math.min(6, state.album.length) * (w + 8);
      state.album.slice(0, 6).forEach((shot, i) => {
        const x = FIELD.width / 2 - total / 2 + 8 + i * (w + 8);
        const y = 352;
        const spec = shot.species ? SPECIES[shot.species] : null;
        ctx.fillStyle = spec ? spec.coat : '#333d4a';
        roundRect(x, y, w, 44, 8);
        ctx.fill();
        text(spec ? spec.name : '—', x + 8, y + 19, 12, '#ffffff', 'left', 700);
        text(`${shot.points} pts`, x + 8, y + 37, 12, '#ffe9a8', 'left');
      });
    }
    bigButton('ENTER — begin a new expedition', 452);
  }

  function drawParticles(state, cam, zoom) {
    const viewTop = FIELD.height - FIELD.height / zoom;
    for (const p of state.particles) {
      const x = (p.x - cam.x) * zoom;
      const y = (p.y - viewTop) * zoom;
      if (x < -10 || x > FIELD.width + 10 || y < -10 || y > FIELD.height + 10) continue;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      if (p.rain) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 12);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,14,22,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  return {
    draw(state, screen, day, best, preview, totalStars) {
      const cam = state.camera;
      const zoom = cam.zoom;
      drawSky(state, state.time);
      drawMountains(cam);
      drawGround(state, cam, zoom);
      const animals = [...state.animals].sort((a, b) => a.y - b.y);
      for (const a of animals) drawAnimal(a, cam, zoom, state.time);
      drawParticles(state, cam, zoom);
      drawVignette();
      if (screen === SCREEN_TITLE) {
        drawTitle(state, day, best);
        return;
      }
      drawViewfinder(state, preview);
      drawHud(state, day, best, preview);
      if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_DAY_DONE) drawDayDone(state, day, totalStars);
      else if (screen === SCREEN_DAY_FAILED) drawDayFailed(state, day);
      else if (screen === SCREEN_EXPEDITION_DONE) drawExpeditionDone(state, best, totalStars);
    },
  };
}
