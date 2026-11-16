// The valley, its animals, the sun, the film and the field guide — everything the game
// simulates, in fixed 1/60 s steps. The renderer only paints this state; the input only
// steers the camera and asks for a photograph.
import {
  CAMERA, DAY_SECONDS, DAYS, FIELD, FILM_PER_DAY, GOLDEN_HOUR_SECONDS,
  GROUND_Y, SCORE, SPECIES, WORLD_WIDE,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_SHOT = 1 << 0;
export const EVENT_TARGET = 1 << 1;
export const EVENT_DAY_DONE = 1 << 2;
export const EVENT_DAY_FAILED = 1 << 3;

/** The pond's stretch of ground, where herons wade and animals come to drink. */
export const POND = { x0: 1560, x1: 2140 };
/** Trees the owl perches on (world x of the trunk). */
export const TREES = [420, 980, 2480, 3010, 3560];

const BEHAVIOUR_TIME = { min: 2.5, max: 7 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeAnimal(random, speciesKey, x) {
  const spec = SPECIES[speciesKey];
  const y = speciesKey === 'heron' ? GROUND_Y - 6 : GROUND_Y;
  return {
    species: speciesKey,
    x, y, baseY: y,
    dir: random.chance(0.5) ? -1 : 1,
    speed: spec.speed * random.range(0.8, 1.2),
    state: 'wander',
    stateT: random.range(1, 4),
    phase: random.range(0, Math.PI * 2),
    targetX: x,
    hop: 0,
    wing: 0,
    headDown: 0,
    seed: random.next() * 100,
  };
}

/** Where this animal likes to stand, by species, so the valley feels inhabited. */
function homeRange(random, speciesKey) {
  switch (speciesKey) {
    case 'heron': return random.range(POND.x0 + 60, POND.x1 - 60);
    case 'owl': return TREES[Math.floor(random.next() * TREES.length)];
    case 'eagle': return random.range(600, WORLD_WIDE - 600);
    default: return random.range(200, WORLD_WIDE - 200);
  }
}

export function createWorld(random) {
  const state = {
    dayIndex: 0,
    sunT: 0,
    film: FILM_PER_DAY,
    score: 0,
    dayScore: 0,
    targets: [],
    album: [],
    animals: [],
    particles: [],
    camera: { x: 0, zoom: 1, tx: 0, tzoom: 1 },
    dayDone: false,
    dayFailed: false,
    failReason: '',
    lastShot: null,
    cardT: 0,
    time: 0,
    perfectStreak: 0,
  };

  function spawnDay(dayIndex) {
    const day = DAYS[dayIndex];
    state.dayIndex = dayIndex;
    state.sunT = 0;
    state.film = FILM_PER_DAY;
    state.dayScore = 0;
    state.targets = day.targets.map((t) => ({ ...t, done: false }));
    state.album = [];
    state.animals = [];
    state.particles = [];
    state.dayDone = false;
    state.dayFailed = false;
    state.failReason = '';
    state.lastShot = null;
    state.cardT = 0;
    state.perfectStreak = 0;
    const placed = new Set();
    for (const key of day.species) {
      const count = key === 'hare' ? 3 : key === 'deer' ? 2 : 2;
      for (let i = 0; i < count; i += 1) {
        let x = homeRange(random, key);
        let guard = 0;
        while (placed.has(Math.round(x / 120)) && guard < 12) {
          x = homeRange(random, key);
          guard += 1;
        }
        placed.add(Math.round(x / 120));
        const animal = makeAnimal(random, key, x);
        if (key === 'owl') {
          animal.state = 'perch';
          animal.stateT = random.range(4, 9);
        }
        if (key === 'eagle') {
          animal.state = 'soar';
          animal.y = random.range(150, 300);
          animal.baseY = animal.y;
        }
        state.animals.push(animal);
      }
    }
    state.camera.x = 0;
    state.camera.tx = 0;
    state.camera.zoom = 1;
    state.camera.tzoom = 1;
  }

  function sunHeight() {
    return Math.sin(Math.PI * clamp(state.sunT, 0, 1));
  }

  function isGolden() {
    return state.sunT > 1 - GOLDEN_HOUR_SECONDS / DAY_SECONDS;
  }

  function viewRect() {
    const zoom = state.camera.zoom;
    const w = FIELD.width / zoom;
    const h = FIELD.height / zoom;
    return { x: state.camera.x, y: FIELD.height - h, w, h };
  }

  function pickNextState(animal) {
    const roll = random.next();
    if (animal.species === 'owl') {
      if (animal.state === 'perch') {
        animal.state = roll < 0.35 ? 'wings' : roll < 0.6 ? 'flight' : 'perch';
      } else {
        animal.state = 'perch';
      }
    } else if (animal.species === 'eagle') {
      animal.state = roll < 0.45 ? 'soar' : 'dive';
    } else if (animal.species === 'heron') {
      if (animal.state === 'flight') animal.state = 'wade';
      else animal.state = roll < 0.3 ? 'fish' : roll < 0.55 ? 'flight' : 'wade';
    } else {
      if (roll < 0.3) animal.state = 'graze';
      else if (roll < 0.45 && Math.abs(animal.x - (POND.x0 + POND.x1) / 2) < 900) animal.state = 'drink';
      else if (roll < 0.6) animal.state = 'leap';
      else animal.state = 'wander';
    }
    animal.stateT = random.range(BEHAVIOUR_TIME.min, BEHAVIOUR_TIME.max);
    if (animal.state === 'leap') animal.stateT = 0.9;
    if (animal.state === 'wings') animal.stateT = 2.2;
    if (animal.state === 'dive') animal.stateT = 1.6;
    if (animal.state === 'flight') animal.stateT = random.range(3, 5);
    if (animal.state === 'wander') {
      animal.targetX = clamp(
        animal.x + random.range(-500, 500), 120, WORLD_WIDE - 120,
      );
      animal.dir = animal.targetX >= animal.x ? 1 : -1;
    }
    if (animal.state === 'drink' || animal.state === 'fish') {
      animal.targetX = animal.species === 'heron'
        ? clamp(animal.x + random.range(-80, 80), POND.x0 + 40, POND.x1 - 40)
        : clamp((POND.x0 + POND.x1) / 2 + random.range(-160, 160), POND.x0, POND.x1);
      animal.dir = animal.targetX >= animal.x ? 1 : -1;
    }
  }

  function stepAnimal(animal, dt) {
    animal.stateT -= dt;
    animal.phase += dt * (animal.state === 'wander' ? 7 : 2);
    if (animal.stateT <= 0) pickNextState(animal);
    const spec = SPECIES[animal.species];
    switch (animal.state) {
      case 'wander': {
        const dx = animal.targetX - animal.x;
        if (Math.abs(dx) < 8) { animal.stateT = 0; break; }
        animal.x += Math.sign(dx) * animal.speed * dt;
        break;
      }
      case 'drink':
      case 'fish': {
        const dx = animal.targetX - animal.x;
        if (Math.abs(dx) > 6) animal.x += Math.sign(dx) * animal.speed * 0.6 * dt;
        animal.headDown = Math.min(1, animal.headDown + dt * 3);
        break;
      }
      case 'graze': {
        animal.headDown = Math.min(1, animal.headDown + dt * 3);
        break;
      }
      case 'leap': {
        const t = 1 - animal.stateT / 0.9;
        animal.hop = Math.sin(Math.PI * clamp(t, 0, 1)) * 70;
        animal.x += animal.dir * animal.speed * 2.2 * dt;
        break;
      }
      case 'wings': {
        animal.wing = Math.min(1, animal.wing + dt * 2.5);
        break;
      }
      case 'flight': {
        animal.wing = 0.6 + Math.sin(animal.phase * 2) * 0.4;
        animal.x += animal.dir * spec.speed * 3.2 * dt;
        animal.y = animal.baseY - 190 - Math.sin(animal.phase * 0.7) * 40;
        if (animal.x < 100 || animal.x > WORLD_WIDE - 100) {
          animal.dir *= -1;
          animal.stateT = 0;
        }
        break;
      }
      case 'soar': {
        animal.x += animal.dir * spec.speed * dt;
        animal.y = animal.baseY + Math.sin(state.time * 0.5 + animal.seed) * 46;
        animal.wing = 0.15 + Math.sin(animal.phase) * 0.1;
        if (animal.x < 200 || animal.x > WORLD_WIDE - 200) animal.dir *= -1;
        break;
      }
      case 'dive': {
        const t = 1 - animal.stateT / 1.6;
        animal.y = animal.baseY + Math.sin(Math.PI * clamp(t, 0, 1)) * 260;
        animal.x += animal.dir * spec.speed * 2.6 * dt;
        animal.wing = 0.05;
        break;
      }
      default:
        break;
    }
    if (animal.state !== 'graze' && animal.state !== 'drink' && animal.state !== 'fish') {
      animal.headDown = Math.max(0, animal.headDown - dt * 3);
    }
    if (animal.state !== 'leap') animal.hop = 0;
    if (animal.state !== 'wings' && animal.state !== 'flight') {
      animal.wing = Math.max(0, animal.wing - dt * 2);
    }
    if (animal.state === 'perch') {
      animal.y = animal.baseY;
    }
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.next() * Math.PI * 2;
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: random.range(0.6, 1.4), max: 1.4, color,
        size: random.range(2, 5),
      });
    }
  }

  function stepParticles(dt) {
    const day = DAYS[state.dayIndex];
    if (day.weather === 'rain') {
      for (let i = 0; i < 3; i += 1) {
        state.particles.push({
          x: state.camera.x + random.next() * (FIELD.width / state.camera.zoom),
          y: -10, vx: -40, vy: random.range(500, 700),
          life: 1.2, max: 1.2, color: '#9fc4dd', size: 2, rain: true,
        });
      }
    } else if (random.chance(0.25)) {
      const golden = isGolden();
      state.particles.push({
        x: state.camera.x + random.next() * (FIELD.width / state.camera.zoom),
        y: random.range(120, GROUND_Y),
        vx: random.range(-12, 12), vy: random.range(-8, 8),
        life: random.range(2, 4), max: 4,
        color: golden ? '#ffd98a' : '#fff6c9', size: random.range(1.5, 3),
      });
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.y > FIELD.height + 20) state.particles.splice(i, 1);
    }
  }

  /** The best-framed animal right now, for the viewfinder's focus brackets — free. */
  function previewShot() {
    if (state.film <= 0 || state.dayDone || state.dayFailed) return null;
    const view = viewRect();
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    let best = null;
    for (const animal of state.animals) {
      const spec = SPECIES[animal.species];
      const ax = animal.x;
      const ay = animal.y - animal.hop - spec.size * 0.3;
      if (ax < view.x - 40 || ax > view.x + view.w + 40) continue;
      if (ay < view.y - 40 || ay > view.y + view.h + 40) continue;
      const dx = (ax - cx) / (view.w / 2);
      const dy = (ay - cy) / (view.h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const framing = Math.round(SCORE.framingMax * Math.max(0, 1 - dist * 0.85));
      if (!best || framing > best.framing) {
        best = { animal, framing, moment: spec.moments.includes(animal.state) };
      }
    }
    if (!best || best.framing < 25) return null;
    const spec = SPECIES[best.animal.species];
    return {
      x: (best.animal.x - view.x) * state.camera.zoom,
      y: (best.animal.y - best.animal.hop - spec.size * 0.3 - view.y) * state.camera.zoom,
      label: best.moment ? `${spec.name} — ${best.animal.state}!` : spec.name,
      moment: best.moment,
    };
  }

  /** Score one photograph against the camera's current view. */
  function shoot() {
    if (state.film <= 0 || state.dayDone || state.dayFailed) return null;
    state.film -= 1;
    const view = viewRect();
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    let best = null;
    for (const animal of state.animals) {
      const spec = SPECIES[animal.species];
      const ax = animal.x;
      const ay = animal.y - animal.hop - spec.size * 0.3;
      if (ax < view.x - 40 || ax > view.x + view.w + 40) continue;
      if (ay < view.y - 40 || ay > view.y + view.h + 40) continue;
      const dx = (ax - cx) / (view.w / 2);
      const dy = (ay - cy) / (view.h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const framing = Math.round(SCORE.framingMax * Math.max(0, 1 - dist * 0.85));
      const zoomErr = Math.abs(state.camera.zoom - spec.idealZoom) / spec.idealZoom;
      const focus = Math.round(SCORE.focusMax * Math.max(0, 1 - zoomErr * 1.4));
      const moment = spec.moments.includes(animal.state) ? SCORE.momentBonus : 0;
      const total = framing + focus + moment;
      if (!best || total > best.total) {
        best = { animal, framing, focus, moment, total, dist };
      }
    }
    const golden = isGolden();
    let shot;
    if (!best || best.total < 40) {
      shot = {
        species: best ? best.animal.species : null, moment: null,
        framing: best ? best.framing : 0, focus: best ? best.focus : 0,
        momentBonus: 0, points: 0, golden,
        label: best ? 'Out of focus' : 'Empty frame',
        grade: 'miss',
      };
    } else {
      const points = Math.round(best.total * (golden ? 1.5 : 1));
      const grade = points >= SCORE.perfectAt ? 'perfect'
        : points >= SCORE.greatAt ? 'great'
        : points >= SCORE.goodAt ? 'good' : 'fair';
      shot = {
        species: best.animal.species,
        moment: best.animal.state,
        framing: best.framing, focus: best.focus, momentBonus: best.moment,
        points, golden,
        label: grade === 'perfect' ? 'PERFECT SHOT'
          : grade === 'great' ? 'Great shot'
          : grade === 'good' ? 'Good shot' : 'A keeper',
        grade,
      };
    }
    state.score += shot.points;
    state.dayScore += shot.points;
    state.lastShot = shot;
    state.album.unshift({ ...shot, day: state.dayIndex + 1 });
    if (state.album.length > 8) state.album.pop();
    let event = EVENT_SHOT;
    if (shot.grade === 'perfect') {
      state.perfectStreak += 1;
      burst(cx, cy, '#ffd98a', 26, 160);
    } else {
      state.perfectStreak = 0;
    }
    if (shot.species && shot.moment) {
      for (const target of state.targets) {
        if (!target.done && target.species === shot.species
          && target.moment === shot.moment && shot.points >= SCORE.goodAt) {
          target.done = true;
          event |= EVENT_TARGET;
          break;
        }
      }
    }
    if (state.targets.every((t) => t.done)) {
      const timeBonus = Math.round((1 - state.sunT) * DAY_SECONDS) * 5;
      const filmBonus = state.film * 15;
      state.score += timeBonus + filmBonus;
      state.dayScore += timeBonus + filmBonus;
      state.dayDone = true;
      state.lastShot.bonus = { time: timeBonus, film: filmBonus };
      event |= EVENT_DAY_DONE;
    } else if (state.film <= 0) {
      state.dayFailed = true;
      state.failReason = 'Out of film';
      event |= EVENT_DAY_FAILED;
    }
    return { shot, event };
  }

  function step(dt, input) {
    state.time += dt;
    if (!state.dayDone && !state.dayFailed) {
      state.sunT += dt / DAY_SECONDS;
      if (state.sunT >= 1) {
        state.sunT = 1;
        if (!state.targets.every((t) => t.done)) {
          state.dayFailed = true;
          state.failReason = 'The sun has set';
        }
      }
    }
    const view = viewRect();
    const pan = (input.panLeft ? -1 : 0) + (input.panRight ? 1 : 0);
    state.camera.tx = clamp(
      state.camera.tx + pan * CAMERA.panSpeed * dt,
      0, WORLD_WIDE - view.w,
    );
    if (input.mouseX !== null && input.mouseX !== undefined) {
      const edge = CAMERA.mousePanEdge;
      const fx = input.mouseX / FIELD.width;
      if (fx < edge / FIELD.width) {
        state.camera.tx = clamp(state.camera.tx - CAMERA.panSpeed * dt * 1.2, 0, WORLD_WIDE - view.w);
      } else if (fx > 1 - edge / FIELD.width) {
        state.camera.tx = clamp(state.camera.tx + CAMERA.panSpeed * dt * 1.2, 0, WORLD_WIDE - view.w);
      }
    }
    state.camera.tzoom = clamp(
      state.camera.tzoom + (input.zoomDelta || 0), CAMERA.zoomMin, CAMERA.zoomMax,
    );
    const kx = 1 - Math.pow(0.0001, dt);
    state.camera.x += (state.camera.tx - state.camera.x) * kx;
    state.camera.zoom += (state.camera.tzoom - state.camera.zoom) * kx;
    for (const animal of state.animals) stepAnimal(animal, dt);
    stepParticles(dt);
    return EVENT_NONE;
  }

  spawnDay(0);

  return {
    state,
    spawnDay,
    step,
    shoot,
    previewShot,
    sunHeight,
    isGolden,
    viewRect,
  };
}
