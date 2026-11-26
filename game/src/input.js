// Keyboard and mouse input. The game reads a plain input frame every step:
// pitch -1..1 (up/down), turn -1..1 (left/right), throttle held up/down,
// action pressed this frame, and mouse clicks for menu buttons.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ACTION = 4;
export const ACTION_MISSION_1 = 8;
export const ACTION_MISSION_2 = 16;
export const ACTION_MISSION_3 = 32;

const PITCH_KEYS = { ArrowUp: 1, KeyW: 1, ArrowDown: -1, KeyS: -1 };
const TURN_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let click = null;

  function keyCode(event) {
    return event.code;
  }

  function onKeyDown(event) {
    const code = keyCode(event);
    if (code === 'Space') {
      event.preventDefault();
      if (!event.repeat) actions |= ACTION_ACTION | ACTION_CONFIRM;
    } else if (code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (code === 'KeyP' || code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_MISSION_1;
    } else if (code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_MISSION_2;
    } else if (code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_MISSION_3;
    }
    if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Space') {
      event.preventDefault();
    }
    held.add(code);
  }

  function onKeyUp(event) {
    held.delete(keyCode(event));
  }

  function onBlur() {
    held.clear();
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Pitch stick: +1 climbs, -1 descends. */
    pitch() {
      let value = 0;
      if (held.has('ArrowUp') || held.has('KeyW')) value += 1;
      if (held.has('ArrowDown') || held.has('KeyS')) value -= 1;
      return value;
    },
    /** Turn stick: +1 turns right (east), -1 turns left (west). */
    turn() {
      let value = 0;
      if (held.has('ArrowRight') || held.has('KeyD')) value += 1;
      if (held.has('ArrowLeft') || held.has('KeyA')) value -= 1;
      return value;
    },
    throttleUp() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    throttleDown() {
      return held.has('ControlLeft') || held.has('ControlRight');
    },
    /** One-shot actions since the last call; clears them. */
    takeActions() {
      const value = actions;
      actions = 0;
      return value;
    },
    /** The last mouse click in logical canvas coordinates, or null; clears it. */
    takeClick() {
      const value = click;
      click = null;
      return value;
    },
    /** True while any key that moves the plane is held. */
    anySteering() {
      return Object.keys(PITCH_KEYS).some((code) => held.has(code)) || Object.keys(TURN_KEYS).some((code) => held.has(code));
    },
  };
}
