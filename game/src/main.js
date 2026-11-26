// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between screens: title, play, paused,
// crashed, mission cleared, sortie failed and game over.
//
// ?seed=N fixes the archipelago. ?shot=start|play|rings|landing (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, CLEARED_KEY, MISSIONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld,
  EVENT_BULLSEYE,
  EVENT_CENTRE_RING,
  EVENT_CRASH,
  EVENT_DROP,
  EVENT_DROP_HIT,
  EVENT_FUEL_EMPTY,
  EVENT_LANDED,
  EVENT_MISSION_CLEAR,
  EVENT_RING,
  EVENT_ROUGH,
  EVENT_SORTIE_OVER,
} from './world.js';
import {
  ACTION_ACTION,
  ACTION_CONFIRM,
  ACTION_MISSION_1,
  ACTION_MISSION_2,
  ACTION_MISSION_3,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import {
  createRenderer,
  SCREEN_CLEARED,
  SCREEN_CRASHED,
  SCREEN_FAILED,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// A handle for headless play-tests: window.__nusantara exposes live state.
window.__nusantara = { world, seed };

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

function readCleared() {
  try {
    return JSON.parse(window.localStorage.getItem(CLEARED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveCleared(ids) {
  try {
    window.localStorage.setItem(CLEARED_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be off; cleared missions then last this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, readCleared(), performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let cleared = readCleared();
  let accumulator = 0;
  let last = performance.now();
  let queuedAction = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function recordBest() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function startMission(index) {
    audio.unlock();
    audio.click();
    world.resetSortie(index);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Flying ' + MISSIONS[index].name + '. ' + MISSIONS[index].hint);
  }

  function backToTitle() {
    recordBest();
    screen = SCREEN_TITLE;
    announce('Nusantara Skies. Press 1, 2 or 3 to pick a mission.');
  }

  function playEventSounds(events) {
    if (events & EVENT_CENTRE_RING) audio.centreRing();
    else if (events & EVENT_RING) audio.ring();
    if (events & EVENT_BULLSEYE) audio.bullseye();
    else if (events & EVENT_DROP_HIT) audio.drop();
    if (events & EVENT_DROP) audio.drop();
    if (events & EVENT_LANDED) audio.touchdown();
    if (events & EVENT_ROUGH) audio.touchdown();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_FUEL_EMPTY) audio.warning();
    if (events & EVENT_MISSION_CLEAR) audio.fanfare();
  }

  function handleActions() {
    const actions = input.takeActions();
    // Space is both "confirm" and the cargo-drop action; keep its drop half for step().
    if (actions & ACTION_ACTION) queuedAction = true;
    const click = input.takeClick();
    if (click && screen === SCREEN_TITLE) {
      // Mission buttons on the title screen: three boxes across the middle.
      const buttonY = 330;
      const buttonW = 330;
      const gap = 30;
      const totalW = buttonW * 3 + gap * 2;
      let bx = (1280 - totalW) / 2;
      for (let i = 0; i < MISSIONS.length; i += 1) {
        if (click.x >= bx && click.x <= bx + buttonW && click.y >= buttonY && click.y <= buttonY + 150) {
          startMission(i);
          return;
        }
        bx += buttonW + gap;
      }
    }
    if (actions & ACTION_MISSION_1) startMission(0);
    else if (actions & ACTION_MISSION_2) startMission(1);
    else if (actions & ACTION_MISSION_3) startMission(2);
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CRASHED) {
      if (world.state.attemptsLeft > 0 && world.retry()) {
        screen = SCREEN_PLAY;
        announce('Retrying ' + world.state.mission.name + '.');
      } else {
        backToTitle();
      }
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CLEARED) {
      const next = world.state.missionIndex + 1;
      if (next < MISSIONS.length) startMission(next);
      else backToTitle();
    } else if (actions & ACTION_CONFIRM && (screen === SCREEN_FAILED || screen === SCREEN_OVER)) {
      backToTitle();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { pitch: 0, turn: 0, throttleUp: false, throttleDown: false, action: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const frame = {
      pitch: input.pitch(),
      turn: input.turn(),
      throttleUp: input.throttleUp(),
      throttleDown: input.throttleDown(),
      action: queuedAction,
    };
    queuedAction = false;
    const events = world.step(STEP, frame, false);
    playEventSounds(events);
    audio.setEngine(world.state.plane.throttle, world.state.plane.flying);
    if (events & EVENT_MISSION_CLEAR) {
      const id = world.state.mission.id;
      if (!cleared.includes(id)) {
        cleared = [...cleared, id];
        saveCleared(cleared);
      }
      recordBest();
      screen = SCREEN_CLEARED;
      announce('Mission complete! Score ' + world.state.score);
    } else if (events & EVENT_CRASH) {
      recordBest();
      screen = world.state.status === 'failed' ? SCREEN_FAILED : SCREEN_CRASHED;
      announce(world.state.status === 'failed' ? 'Sortie over.' : 'Crashed. Press Space to retry.');
    } else if (events & EVENT_SORTIE_OVER) {
      recordBest();
      screen = SCREEN_FAILED;
      announce('Sortie over. Score ' + world.state.score);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // Crashed planes keep smoking: let particles settle even off the play screen.
      world.step(STEP, { pitch: 0, turn: 0, throttleUp: false, throttleDown: false, action: false }, false);
    }
    renderer.draw(world.state, screen, best, cleared, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting fuel burn unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nusantara Skies. Press 1, 2 or 3 to pick a mission.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
