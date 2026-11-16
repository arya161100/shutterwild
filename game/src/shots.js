// The screenshot scenes behind ?shot=start|play|perfect|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot:
// pan the camera onto the animal the scene needs, zoom to its ideal framing, and fire the
// shutter the moment it does the thing the field guide asks for — so every frame is what a
// short game really looks like, and the same seed always gives the same frame.
import { FIELD, SPECIES, STEP, WORLD_WIDE } from './config.js';
import { EVENT_DAY_DONE, EVENT_TARGET } from './world.js';
import { SCREEN_DAY_DONE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const SAMPLE = STEP;
/** Longest a scene may play forward (seconds of game time). */
const SCENE_LIMIT = 140;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Point the camera at an animal and zoom to its ideal framing. */
function aimAt(world, animal) {
  const spec = SPECIES[animal.species];
  const cam = world.state.camera;
  cam.tzoom = spec.idealZoom;
  const viewW = FIELD.width / cam.tzoom;
  cam.tx = clamp(animal.x - viewW / 2, 0, WORLD_WIDE - viewW);
}

/** The animal of this species doing this moment right now, if any. */
function findMoment(world, species, moment) {
  for (const animal of world.state.animals) {
    if (animal.species === species && animal.state === moment) return animal;
  }
  return null;
}

function idleInput() {
  return { panLeft: false, panRight: false, zoomDelta: 0, mouseX: null, mouseY: null };
}

/**
 * Play forward until the named target is photographed (or the limit runs out), aiming
 * the camera at the right animal the whole way. Returns true when the target is done.
 */
function photographTarget(world, target, limitSeconds) {
  const steps = Math.floor(limitSeconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const animal = findMoment(world, target.species, target.moment);
    if (animal) {
      aimAt(world, animal);
      const view = world.viewRect();
      const centred = Math.abs(animal.x - (view.x + view.w / 2)) < 60;
      if (centred && world.state.camera.zoom > SPECIES[target.species].idealZoom - 0.15) {
        const result = world.shoot();
        if (result && (result.event & EVENT_TARGET)) return true;
        if (world.state.dayDone || world.state.dayFailed) return false;
      }
    }
    world.step(SAMPLE, idleInput());
    if (world.state.dayDone || world.state.dayFailed) return false;
  }
  return world.state.targets.some((t) => t.done && t.species === target.species && t.moment === target.moment);
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  world.spawnDay(0);
  if (name !== 'play' && name !== 'perfect' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / SAMPLE; i += 1) {
      world.step(SAMPLE, idleInput());
    }
    world.state.camera.tx = 1200;
    world.state.camera.x = 1200;
    world.state.camera.tzoom = 1;
    world.state.camera.zoom = 1;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    // One good photograph of a grazing deer, then the valley at play.
    photographTarget(world, { species: 'deer', moment: 'graze' }, 60);
    world.state.cardT = 0;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'perfect') {
    // A perfect shot, card still on screen: deer, grazing, dead centre, ideal zoom.
    photographTarget(world, { species: 'deer', moment: 'graze' }, 60);
    world.state.cardT = 30;
    return { screen: SCREEN_PLAY };
  }
  // 'end': complete the whole field guide, day one, for the day-complete screen.
  const day = world.state;
  for (const target of [...day.targets]) {
    if (world.state.dayDone || world.state.dayFailed) break;
    photographTarget(world, target, SCENE_LIMIT / 3);
  }
  world.state.cardT = 0;
  return { screen: world.state.dayDone ? SCREEN_DAY_DONE : SCREEN_PLAY, event: EVENT_DAY_DONE };
}
