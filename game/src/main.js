// SHUTTERWILD — boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between six screens: title, play, paused, day done,
// day failed, and expedition done (after day 7).
//
// ?seed=N fixes the valley's animals. ?shot=start|play|perfect|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, DAYS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_DAY_DONE, EVENT_DAY_FAILED, EVENT_SHOT, EVENT_TARGET } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_DAY_DONE, SCREEN_DAY_FAILED, SCREEN_EXPEDITION_DONE, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long a photo card stays on screen after a shot (seconds). */
const CARD_SECONDS = 3.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const dayParam = Number.parseInt(params.get('day') ?? '', 10);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, DAYS[world.state.dayIndex], readBest(), null, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const startDay = Number.isInteger(dayParam) && dayParam >= 1 && dayParam <= DAYS.length
    ? dayParam - 1 : 0;
  if (startDay > 0) world.spawnDay(startDay);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let totalStars = 0;
  let accumulator = 0;
  let last = performance.now();
  let chirpT = 4;

  function announce(message) {
    status.textContent = message;
  }

  function startExpedition(day = 0) {
    world.spawnDay(day);
    totalStars = 0;
    screen = SCREEN_PLAY;
    announce(`Day ${day + 1}. ${DAYS[day].blurb}`);
  }

  function nextDay() {
    const next = world.state.dayIndex + 1;
    if (next >= DAYS.length) {
      screen = SCREEN_EXPEDITION_DONE;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Expedition complete. ${world.state.score} points.`);
      return;
    }
    world.spawnDay(next);
    screen = SCREEN_PLAY;
    announce(`${DAYS[next].name}. ${DAYS[next].blurb}`);
  }

  function retryDay() {
    world.spawnDay(world.state.dayIndex);
    screen = SCREEN_PLAY;
    announce(`Retrying ${DAYS[world.state.dayIndex].name}.`);
  }

  function dayStars() {
    const done = world.state.targets.filter((t) => t.done).length;
    if (done === world.state.targets.length && world.state.dayScore >= 1500) return 3;
    if (done === world.state.targets.length) return 2;
    return 1;
  }

  function takeShot() {
    const result = world.shoot();
    if (!result) return;
    audio.unlock();
    audio.shutter();
    world.state.cardT = CARD_SECONDS;
    const { shot: photo, event } = result;
    if (photo.grade === 'perfect' || photo.grade === 'great') audio.chime(photo.grade);
    if (event & EVENT_TARGET) {
      audio.targetDone();
      announce(`Field-guide target complete: ${photo.species} ${photo.moment}.`);
    }
    if (event & EVENT_DAY_DONE) {
      totalStars += dayStars();
      audio.dayDone();
      screen = SCREEN_DAY_DONE;
      announce(`Day complete. ${world.state.dayScore} points.`);
    } else if (event & EVENT_DAY_FAILED) {
      audio.fail();
      screen = SCREEN_DAY_FAILED;
      announce(`Day failed: ${world.state.failReason}.`);
    } else {
      announce(`${photo.label}: ${photo.points} points.`);
    }
    void EVENT_SHOT;
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    input.poll();
    if (input.take(ACTION_MUTE)) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (input.take(ACTION_CONFIRM)) {
        audio.unlock();
        startExpedition(startDay);
      }
    } else if (screen === SCREEN_PLAY) {
      if (input.take(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
      } else if (input.take(ACTION_RESTART)) {
        retryDay();
      } else {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          world.step(STEP, input.state);
          accumulator -= STEP;
          if (world.state.cardT > 0) world.state.cardT -= STEP;
        }
        chirpT -= elapsed;
        if (chirpT <= 0) {
          chirpT = 5 + Math.random() * 9;
          audio.chirp();
        }
        if (input.state.shutter) takeShot();
        if (world.state.dayDone) screen = SCREEN_DAY_DONE;
        else if (world.state.dayFailed) screen = SCREEN_DAY_FAILED;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.take(ACTION_PAUSE)) screen = SCREEN_PLAY;
      else if (input.take(ACTION_RESTART)) retryDay();
    } else if (screen === SCREEN_DAY_DONE) {
      if (input.take(ACTION_CONFIRM)) nextDay();
      else if (input.take(ACTION_RESTART)) retryDay();
    } else if (screen === SCREEN_DAY_FAILED) {
      if (input.take(ACTION_RESTART)) retryDay();
      else if (input.take(ACTION_CONFIRM)) retryDay();
    } else if (screen === SCREEN_EXPEDITION_DONE) {
      if (input.take(ACTION_CONFIRM)) startExpedition();
    }
    input.clearPressed();
    const preview = screen === SCREEN_PLAY ? world.previewShot() : null;
    renderer.draw(world.state, screen, DAYS[world.state.dayIndex], best, preview, totalStars);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
