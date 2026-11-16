// Keyboard and mouse, read fresh every frame. The camera pans with the mouse near the
// screen edges or with A/D and the arrow keys; the wheel (or + / -) zooms the lens;
// Space or a click fires the shutter; Enter confirms, P pauses, R restarts the day,
// M mutes, and Esc closes a photo card.
import { CAMERA } from './config.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MUTE = 'mute';
export const ACTION_SHUTTER = 'shutter';

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    panLeft: false,
    panRight: false,
    zoomDelta: 0,
    mouseX: null,
    mouseY: null,
    shutter: false,
    pressed: new Set(),
  };
  let wheel = 0;

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyOf(event);
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      if (key === ' ') state.pressed.add(ACTION_SHUTTER);
      if (key === 'Enter') state.pressed.add(ACTION_CONFIRM);
      if (key === 'p' || key === 'P') state.pressed.add(ACTION_PAUSE);
      if (key === 'r' || key === 'R') state.pressed.add(ACTION_RESTART);
      if (key === 'm' || key === 'M') state.pressed.add(ACTION_MUTE);
      if (key === 'Escape') state.pressed.add('escape');
    }
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyOf(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    state.mouseY = ((event.clientY - rect.top) / rect.height) * 720;
  });
  canvas.addEventListener('mouseleave', () => { state.mouseX = null; state.mouseY = null; });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) state.pressed.add(ACTION_SHUTTER);
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    wheel += event.deltaY < 0 ? CAMERA.zoomStep : -CAMERA.zoomStep;
  }, { passive: false });

  return {
    state,
    /** Refresh the held-key state; call once per frame before the world steps. */
    poll() {
      state.panLeft = keys.has('a') || keys.has('A') || keys.has('ArrowLeft');
      state.panRight = keys.has('d') || keys.has('D') || keys.has('ArrowRight');
      if (keys.has('+') || keys.has('=')) wheel += CAMERA.zoomStep;
      if (keys.has('-') || keys.has('_')) wheel -= CAMERA.zoomStep;
      state.zoomDelta = wheel;
      wheel = 0;
      state.shutter = state.pressed.has(ACTION_SHUTTER);
    },
    /** True once for a key pressed since the last frame; call after poll(). */
    take(action) {
      if (!state.pressed.has(action)) return false;
      state.pressed.delete(action);
      return true;
    },
    clearPressed() {
      state.pressed.clear();
    },
  };
}
