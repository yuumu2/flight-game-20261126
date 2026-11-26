// Tracks held flight controls and queues discrete menu actions.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const pitchUp = ['ArrowUp'];
const pitchDown = ['ArrowDown'];
const rollRight = ['ArrowRight', 'KeyD'];
const rollLeft = ['ArrowLeft', 'KeyA'];
const throttleUp = ['KeyW', 'ShiftLeft', 'ShiftRight'];
const throttleDown = ['KeyS', 'ControlLeft', 'ControlRight'];
const controls = new Set([...pitchUp, ...pitchDown, ...rollRight, ...rollLeft, ...throttleUp, ...throttleDown]);
const actionKeys = new Map([
  ['Space', ACTION_CONFIRM], ['Enter', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE], ['Escape', ACTION_PAUSE],
]);

export function createInput(target = window) {
  const held = new Set();
  let actions = 0;
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  target.addEventListener('keydown', (event) => {
    const action = actionKeys.get(event.code);
    if (!action && !controls.has(event.code)) return;
    event.preventDefault();
    if (controls.has(event.code)) held.add(event.code);
    if (!event.repeat && action) actions |= action;
  }, options);
  target.addEventListener('keyup', (event) => held.delete(event.code), options);
  target.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; }, options);
  target.addEventListener('blur', () => held.clear(), options);

  function axis(positive, negative) {
    return Number(positive.some((key) => held.has(key))) - Number(negative.some((key) => held.has(key)));
  }

  return {
    pitchInput: () => axis(pitchUp, pitchDown),
    rollInput: () => axis(rollRight, rollLeft),
    throttleInput: () => axis(throttleUp, throttleDown),
    takeActions() {
      const pending = actions;
      actions = 0;
      return pending;
    },
    dispose() {
      listeners.abort();
      held.clear();
      actions = 0;
    },
  };
}
