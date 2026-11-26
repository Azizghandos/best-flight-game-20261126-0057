// Nusantara Skies — every tuning number, colour and mission definition in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size. The world is a side-scrolling archipelago:
// x is distance east along the island chain, y is altitude above sea level.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How far east the island chain runs, in world units. */
export const WORLD_LENGTH = 15000;

/** Sea level is y = 0. The horizon line on screen sits this far below the top. */
export const SKY_FRACTION = 0.62;

export const PLANE = {
  /** Top speed at full throttle, world units per second. */
  maxSpeed: 330,
  /** Lowest speed that still flies; below this the plane sinks. */
  stallSpeed: 95,
  /** How fast the engine answers the throttle, per second. */
  accel: 150,
  /** Drag pulling speed toward the throttle's target speed. */
  drag: 0.55,
  /** Pitch rate, radians per second, at full stick. */
  pitchRate: 1.15,
  /** Hardest climb / dive the stick allows, radians. */
  maxPitch: 0.62,
  /** Turn rate, radians per second, at full stick. */
  turnRate: 0.85,
  /** Fuel burnt per second at full throttle: a full tank lasts a whole sortie. */
  fuelBurn: 0.38,
  /** Fuel capacity; the gauge reads 0..100. */
  fuelMax: 100,
  /** Damage taken from one rough (non-runway) touchdown. */
  roughLandingDamage: 26,
  /** Vertical speed, units/s, above which any ground contact is a crash. */
  crashSinkRate: 150,
  /** Airspeed above which any ground contact is a crash. */
  crashSpeed: 260,
};

export const RING = {
  count: 8,
  radius: 48,
  /** Points for flying clean through a ring. */
  points: 150,
  /** Extra points for threading the centre of a ring. */
  centreBonus: 100,
  /** First ring's x; the rest are spaced along the chain. */
  firstX: 2300,
  spacing: 1350,
  minAlt: 130,
  maxAlt: 430,
};

export const RUNWAY = {
  /** Home island runway: x-range and the flat ground height under it. */
  x0: 620,
  x1: 1580,
  ground: 46,
  /** A landing counts when speed and sink rate are under these. */
  maxSpeed: 185,
  maxSink: 95,
};

export const CARGO = {
  /** Crates to drop per sortie. */
  crates: 3,
  /** Points for a crate landing inside the target circle. */
  points: 200,
  /** Points for a bullseye (inner third of the target). */
  bullseyeBonus: 150,
  /** Target circle radius on the ground. */
  targetRadius: 85,
  /** Parachute fall speed, units/s. */
  fallSpeed: 95,
  /** Steady sea breeze pushing falling crates east, units/s. */
  wind: 10,
};

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    short: 'RING RUN',
    timeLimit: 170,
    description: 'Thread all 8 glowing rings over the islands before the clock runs out. Centre hits pay extra.',
    hint: 'Fly through the glowing rings — steer with the arrow keys, throttle with Shift / Ctrl.',
  },
  {
    id: 'landing',
    name: 'Island Landing',
    short: 'ISLAND LANDING',
    timeLimit: 240,
    description: 'Take off from the home runway, fly the circuit past the beacon island, then land back on the runway — slow, level and gentle.',
    hint: 'Line up with the runway, slow below 185, and flare: descend gently for a soft touchdown.',
  },
  {
    id: 'cargo',
    name: 'Cargo Drop',
    short: 'CARGO DROP',
    timeLimit: 240,
    description: 'Three island villages need supplies. Fly over each marked target and press Space to drop a crate — mind the wind.',
    hint: 'Press Space over the white target circle. Crates drift east with the wind, so release a little early.',
  },
];

/** Attempts per mission before the sortie is over. */
export const ATTEMPTS = 3;

/** Score for finishing a mission, plus a bonus per second left on the clock. */
export const MISSION_CLEAR = { base: 500, perSecondLeft: 8 };

export const PALETTE = {
  skyTop: '#1d4e89',
  skyMid: '#5ea3d8',
  skyLow: '#f7c873',
  sun: '#fff3c4',
  sunCore: '#fffbe8',
  seaDeep: '#0d5e8f',
  seaShallow: '#2fa8c9',
  seaSparkle: '#bfefff',
  sand: '#f2dd9e',
  sandWet: '#d9bd72',
  grass: '#3f9e4d',
  grassDark: '#2c7a38',
  jungle: '#1f5c2b',
  palm: '#2e7d32',
  trunk: '#7a5230',
  rock: '#8d8578',
  runway: '#3a3f46',
  runwayLine: '#f5f2e8',
  ringOuter: '#ffd23e',
  ringInner: '#ff9d00',
  ringGlow: 'rgba(255, 210, 62, 0.35)',
  planeBody: '#e8442e',
  planeBelly: '#f6f1e7',
  planeWing: '#c93322',
  planeGlass: '#bfefff',
  planeTrim: '#ffd23e',
  hudPanel: 'rgba(8, 24, 40, 0.72)',
  hudText: '#eef6fb',
  hudAccent: '#ffd23e',
  hudGood: '#7be495',
  hudWarn: '#ffb347',
  hudBad: '#ff6b5e',
  text: '#eef6fb',
  muted: '#a9c4d6',
  panel: '#0e2a3f',
  button: '#e8442e',
  buttonHover: '#f0563f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nusantara-skies.best';
/** Which missions are cleared is kept between visits (this browser only). */
export const CLEARED_KEY = 'nusantara-skies.cleared';
