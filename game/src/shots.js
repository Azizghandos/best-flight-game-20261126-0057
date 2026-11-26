// The screenshot scenes behind ?shot=start|play|rings|landing. Each one plays the
// real rules forward from a fresh sortie for a fixed number of steps, steered by a
// simple autopilot (throttle toward a target speed, pitch toward a target altitude,
// turn toward the next objective), so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { RUNWAY, STEP } from './config.js';
import { EVENT_CRASH, EVENT_MISSION_CLEAR } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const RING_SECONDS = 55;
const LANDING_SECONDS = 170;

/** Shortest signed turn from `from` to `to`, in radians. */
function angleDelta(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Fly the plane toward a point: throttle toward `targetSpeed`, pitch toward the
 * target altitude, turn toward the target's side. Returns a live input frame.
 */
function flyToward(state, targetX, targetY, targetSpeed) {
  const plane = state.plane;
  const dx = targetX - plane.x;
  const desiredHeading = dx >= 0 ? 0 : Math.PI;
  const turnError = angleDelta(plane.heading, desiredHeading);
  const turn = Math.abs(turnError) < 0.05 ? 0 : turnError > 0 ? 1 : -1;
  const pitch = Math.max(-1, Math.min(1, (targetY - plane.y) / 90));
  return {
    pitch,
    turn,
    throttleUp: plane.speed < targetSpeed,
    throttleDown: plane.speed > targetSpeed + 30,
    action: false,
  };
}

function nextRingTarget(state) {
  const ring = state.rings.find((r) => !r.hit);
  if (!ring) return { x: state.plane.x + 1500, y: 300 };
  return { x: ring.x, y: ring.y };
}

/** Step the world with the autopilot until `stop` says so, or the time runs out. */
function flyFor(world, seconds, stop) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    let input;
    if (state.missionIndex === 1) input = landingPilot(state);
    else input = flyToward(state, nextRingTarget(state).x, nextRingTarget(state).y, 250);
    const events = world.step(STEP, input, false);
    if (events & EVENT_CRASH) break;
    if (events & EVENT_MISSION_CLEAR) break;
    if (stop && stop(state)) break;
  }
}

/**
 * The landing sortie's pilot: take off, climb, fly east past the beacon island,
 * turn around, then ride a shallow glide slope back down to the runway.
 */
function landingPilot(state) {
  const plane = state.plane;
  if (!state.beaconPassed) {
    return flyToward(state, 10200, 300, 250);
  }
  // Homebound: glide slope — altitude about a fifth of the distance left, and
  // below ground level when very close so the plane keeps descending onto the strip.
  const runwayCentre = (RUNWAY.x0 + RUNWAY.x1) / 2;
  const distance = Math.abs(plane.x - runwayCentre);
  const targetAlt = Math.max(20, Math.min(380, distance * 0.2));
  const targetSpeed = distance < 500 ? 150 : 210;
  return flyToward(state, runwayCentre - 100, targetAlt, targetSpeed);
}

/**
 * Set `world` to the named scene (start, play, rings or landing; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play' || name === 'rings') {
    world.resetSortie(0);
    if (name === 'play') {
      flyFor(world, PLAY_SECONDS, null);
    } else {
      flyFor(world, RING_SECONDS, (state) => {
        const next = state.rings.find((r) => !r.hit);
        return state.ringsHit >= 1 && next !== undefined && Math.abs(state.plane.x - next.x) < 420;
      });
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'landing') {
    world.resetSortie(1);
    flyFor(world, LANDING_SECONDS, (state) => {
      const plane = state.plane;
      const runwayCentre = (RUNWAY.x0 + RUNWAY.x1) / 2;
      return state.beaconPassed && Math.abs(plane.heading) > 2.6 && Math.abs(plane.x - runwayCentre) < 380 && plane.y < 170;
    });
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  world.resetSortie(0);
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, { pitch: 0, turn: 0, throttleUp: false, throttleDown: false, action: false }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
