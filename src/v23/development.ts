import {allows, configure, observation, type Config, type Input, type State} from './game.js';
import {center, cellAt} from './space.js';
import {record} from './replay.js';
import {destinations, distance, point, WIDTH} from '../v2/yard.js';
import {rules, type Side} from '../v2/game.js';

export type Profile = 'roam' | 'seek';
// Match V2.2's 440 ms strategic cadence, with the decision at the first boundary at or after it.
export function policy(config: Config, state: State, side: Side, profile: Profile): Input | null {
  const cadence = 1320;
  if (state.time && Math.floor(state.time / cadence) === Math.floor((state.time - config.step) / cadence)) return null;
  const {actions, movement, contact, you} = observation(state, side);
  const phase = (Math.floor(state.time / cadence) + (config.seed & 0x7fffffff)) % 11;
  if (you.ammo <= 1 && actions.includes('reload')) return {kind: 'reload'};
  if (actions.includes('attack') && (profile === 'seek' || phase < 8)) {
    return {kind: phase < 3 && you.ammo > 1 && actions.includes('precision') ? 'precision' : 'attack'};
  }
  if (phase === 1 && actions.includes('observe')) return {kind: 'observe'};
  if (you.mode && phase % 3 !== 0) return null;
  const rival = contact.position ? cellAt(contact.position, side === 1) : undefined;
  const across = (x: number) => side === 0 ? x : WIDTH - 1 - x;
  const waypoint = (phase % 2 ? 2 : 4) * WIDTH + across(phase % 3 ? 6 : 2);
  const goal = rival !== undefined && profile === 'seek' ? rival : waypoint;
  const mode = you.reloading || you.firing ? 'walk' : phase === 3 ? 'jump' : phase < 4 ? 'crouch' : phase < 8 ? 'walk' : 'run';
  if (!movement.includes(mode)) return null;
  const score = (cell: number) => cell === rival ? 1024 :
    (goal === rival ? Math.abs(distance(cell, goal) - 2) : distance(cell, goal)) * WIDTH + across(point(cell).x);
  const currentGoal = state.fighters[side].motion;
  if (mode === 'jump') {
    const moves = [{dx: 0, dy: -1}, {dx: side ? 1 : -1, dy: 0}, {dx: side ? -1 : 1, dy: 0}, {dx: 0, dy: 1}];
    const cell = cellAt(you.position, side === 1);
    const best = moves.sort((a, b) => score(cell + a.dx + a.dy * WIDTH) - score(cell + b.dx + b.dy * WIDTH))
      .map((direction): Input => ({kind: 'steer', mode, ...direction})).find(input => allows(state, side, input));
    return best ?? null;
  }
  const already = currentGoal && 'path' in currentGoal && currentGoal.mode === mode ? cellAt(currentGoal.path.at(-1)!, side === 1) : -1;
  for (const cell of [...destinations(cellAt(you.position, side === 1), rules.modes[mode].steps, side === 1).keys()].sort((a, b) => score(a) - score(b))) {
    const input = {kind: 'move', mode, to: center(cell)} as const;
    if (cell !== already && allows(state, side, input)) return input;
  }
  return null;
}

export function developmentMatch(seed: number, players: readonly [Profile, Profile] = ['seek', 'roam'], step?: Config['step']) {
  const config = configure(seed, step);
  return record(config, state => [policy(config, state, 0, players[0]), policy(config, state, 1, players[1])]);
}
