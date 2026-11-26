import {legal, realtime, realtimeRules, sameIntent, type Intent, type State} from './game.js';
import {distance, WIDTH} from './yard.js';

const directions = new Map([['KeyW', -WIDTH], ['KeyA', -1], ['KeyS', WIDTH], ['KeyD', 1]]);
const actions = new Map<string, Intent>([
  ['KeyF', {kind: 'attack'}], ['KeyP', {kind: 'precision'}], ['KeyR', {kind: 'reload'}],
  ['KeyE', {kind: 'observe'}], ['KeyQ', {kind: 'peek'}],
]);
export const sandboxKeys = new Set([...directions.keys(), ...actions.keys(), 'ShiftLeft', 'ShiftRight', 'KeyC', 'Space']);
export const oneShot = (code: string) => actions.has(code) || code === 'KeyC' || code === 'Space';

export function sandboxIntent(state: State, held: ReadonlySet<string>, pressed?: string, facing = 1): Intent | null {
  const fighter = state.fighters[0];
  const direction = [...held].reverse().flatMap(key => directions.has(key) ? [directions.get(key)!] : [])[0];
  const mode = pressed === 'Space' ? 'jump' : held.has('ShiftLeft') || held.has('ShiftRight') ? 'run'
    : fighter.posture === 'crouch' ? 'crouch' : 'walk';
  let wanted: Intent | undefined = pressed ? actions.get(pressed) : undefined;
  if (pressed === 'KeyC') wanted = {kind: 'posture', posture: fighter.posture === 'crouch' ? 'upright' : 'crouch'};
  if (!pressed || pressed === 'Space') {
    if (direction !== undefined || pressed === 'Space') {
      const to = fighter.cell + (direction ?? facing);
      if (distance(to, fighter.cell) === 1) wanted = {kind: 'move', mode, to};
    } else if (fighter.motion) {
      wanted = {kind: 'stop'};
    }
  }
  return wanted && legal(state, 0, realtime).some(choice => sameIntent(wanted, choice)) ? wanted : null;
}

export function dueTick(elapsedMs: number) {
  return Math.min(realtimeRules.ticks, Math.max(0, Math.floor(elapsedMs / realtimeRules.stepMs)));
}

export function facingFor(held: ReadonlySet<string>, previous: number) {
  for (const key of [...held].reverse()) {
    const direction = directions.get(key);
    if (direction !== undefined) return direction;
  }
  return previous;
}
