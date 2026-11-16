// SHUTTERWILD — a wildlife photography game.
// Every tuning number, colour, species and day in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. The valley the camera pans across is WORLD_WIDE pixels wide.

export const FIELD = { width: 1280, height: 720 };
export const WORLD_WIDE = 3840;
export const GROUND_Y = 596;
export const STEP = 1 / 60;

/** A day lasts this long (seconds of sun) before the light is gone. */
export const DAY_SECONDS = 150;
/** Exposures (shots) a day; a wasted shot is gone for good. */
export const FILM_PER_DAY = 12;
/** The last seconds of a day count as golden hour: light bonus on every shot. */
export const GOLDEN_HOUR_SECONDS = 35;
/** How many checklist targets each day asks for. */
export const TARGETS_PER_DAY = 3;

/** Camera: how fast it pans, and the zoom range (1 = whole valley height in view). */
export const CAMERA = {
  panSpeed: 900,
  mousePanEdge: 90,
  zoomMin: 1,
  zoomMax: 2.4,
  zoomStep: 0.25,
};

/** Scoring bands for one photograph (points before the golden-hour multiplier). */
export const SCORE = {
  framingMax: 100,
  focusMax: 100,
  momentBonus: 100,
  perfectAt: 240,
  greatAt: 170,
  goodAt: 100,
  /** A shot with no animal in frame, or hopelessly out of focus, scores this. */
  emptyShot: 0,
};

/** Sun height (0 = horizon, 1 = noon) at which the light turns golden. */
export const GOLDEN_SUN = 0.32;

export const PALETTE = {
  ink: '#1d2733',
  paper: '#fdf8ec',
  muted: '#6b7280',
  gold: '#f2b544',
  accent: '#e4572e',
  leaf: '#4d7c5f',
  water: '#7fb3c8',
  panel: 'rgba(16, 24, 34, 0.72)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
};

/** Sky gradients keyed by sun height: dawn, day, golden, dusk. */
export const SKIES = [
  { sun: 0.0, top: '#2c3a5e', mid: '#e8907c', low: '#f7c873' },
  { sun: 0.35, top: '#7fb3d9', mid: '#cfe8f2', low: '#f6e3a1' },
  { sun: 0.7, top: '#5ea3d6', mid: '#a8d3e8', low: '#eef3d8' },
  { sun: 1.0, top: '#4a90c4', mid: '#9ccfe6', low: '#dcefc0' },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best expedition score is kept between visits (this browser only). */
export const BEST_KEY = 'shutterwild.best';

/**
 * Species. Each one is drawn procedurally (see render.js) and behaves differently:
 * - move: 'walk' | 'wade' | 'perch' | 'soar' — how it travels the valley.
 * - moments: behaviours worth the moment bonus when photographed mid-act.
 * - idealZoom: the zoom where it fills the frame just right (focus score peaks here).
 * - size: body length in world pixels; rarity: 0 common .. 1 almost never seen.
 */
export const SPECIES = {
  deer: {
    name: 'Deer', plural: 'deer', size: 150, idealZoom: 1.5, rarity: 0.1,
    move: 'walk', speed: 26, moments: ['graze', 'drink', 'leap'], points: 100,
    coat: '#b98a5a', belly: '#e8d3b3', antler: '#6b4a2f',
  },
  hare: {
    name: 'Hare', plural: 'hares', size: 62, idealZoom: 2.1, rarity: 0.05,
    move: 'walk', speed: 70, moments: ['leap', 'graze'], points: 80,
    coat: '#9a8a76', belly: '#e5dccb', antler: null,
  },
  fox: {
    name: 'Fox', plural: 'foxes', size: 110, idealZoom: 1.8, rarity: 0.3,
    move: 'walk', speed: 55, moments: ['leap', 'drink'], points: 140,
    coat: '#d2691e', belly: '#f6ead6', antler: null,
  },
  heron: {
    name: 'Heron', plural: 'herons', size: 120, idealZoom: 1.7, rarity: 0.25,
    move: 'wade', speed: 14, moments: ['fish', 'flight'], points: 150,
    coat: '#dfe6ea', belly: '#ffffff', antler: null,
  },
  owl: {
    name: 'Owl', plural: 'owls', size: 95, idealZoom: 1.9, rarity: 0.45,
    move: 'perch', speed: 0, moments: ['wings', 'flight'], points: 170,
    coat: '#7a5c43', belly: '#d9c7a7', antler: null,
  },
  eagle: {
    name: 'Eagle', plural: 'eagles', size: 170, idealZoom: 1.4, rarity: 0.6,
    move: 'soar', speed: 120, moments: ['soar', 'dive'], points: 200,
    coat: '#4a3226', belly: '#8a6b4a', antler: null,
  },
};

/**
 * The seven days of the expedition. Each day names its light, its weather, the species
 * out in the valley, and the field-guide targets the photographer must bring home.
 * A target is { species, moment } — photograph that animal doing that thing.
 */
export const DAYS = [
  {
    name: 'Day 1 — Meadow Dawn', light: 'dawn', weather: 'clear',
    species: ['deer', 'hare', 'heron'],
    targets: [
      { species: 'deer', moment: 'graze' },
      { species: 'hare', moment: 'leap' },
      { species: 'heron', moment: 'fish' },
    ],
    blurb: 'First light over the meadow. The valley is waking up — learn the camera.',
  },
  {
    name: 'Day 2 — River Light', light: 'day', weather: 'clear',
    species: ['heron', 'deer', 'hare'],
    targets: [
      { species: 'heron', moment: 'flight' },
      { species: 'deer', moment: 'drink' },
      { species: 'hare', moment: 'graze' },
    ],
    blurb: 'The herons work the river. Catch one with its wings open.',
  },
  {
    name: 'Day 3 — Forest Dusk', light: 'dusk', weather: 'clear',
    species: ['fox', 'owl', 'deer'],
    targets: [
      { species: 'fox', moment: 'leap' },
      { species: 'owl', moment: 'wings' },
      { species: 'deer', moment: 'leap' },
    ],
    blurb: 'Dusk belongs to the fox. The owl opens its wings only at last light.',
  },
  {
    name: 'Day 4 — Mountain Air', light: 'day', weather: 'clear',
    species: ['eagle', 'hare', 'fox'],
    targets: [
      { species: 'eagle', moment: 'soar' },
      { species: 'eagle', moment: 'dive' },
      { species: 'fox', moment: 'drink' },
    ],
    blurb: 'High thermals, higher stakes. The eagle dives only when it means it.',
  },
  {
    name: 'Day 5 — Golden Meadow', light: 'golden', weather: 'clear',
    species: ['deer', 'fox', 'heron', 'owl'],
    targets: [
      { species: 'owl', moment: 'flight' },
      { species: 'fox', moment: 'leap' },
      { species: 'heron', moment: 'fish' },
    ],
    blurb: 'Everything glows. Four species share the meadow — choose your moment.',
  },
  {
    name: 'Day 6 — Rain on the Reeds', light: 'day', weather: 'rain',
    species: ['heron', 'owl', 'deer', 'hare'],
    targets: [
      { species: 'heron', moment: 'flight' },
      { species: 'deer', moment: 'drink' },
      { species: 'owl', moment: 'wings' },
    ],
    blurb: 'Rain sharpens the air. Wet feathers, bright eyes — shoot through it.',
  },
  {
    name: 'Day 7 — The Grand Album', light: 'dawn', weather: 'clear',
    species: ['eagle', 'owl', 'fox', 'deer', 'heron'],
    targets: [
      { species: 'eagle', moment: 'dive' },
      { species: 'owl', moment: 'flight' },
      { species: 'deer', moment: 'graze' },
    ],
    blurb: 'The last dawn. Every species is out — fill the album and go home.',
  },
];
