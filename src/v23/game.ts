import {draw, realtimeOdds, realtimeRules, rules, sides, type Result, type Side} from '../v2/game.js';
import {MAP_VERSION} from '../v2/yard.js';
import {agentsCollide, clearSight, equal, gap, openSegment, route, starts, toward, unit, type Position} from './space.js';

export const rulesVersion = 'arcade-v2.3';
export const mapVersion = MAP_VERSION;
export const matchTime = 58_080; // Time units of 1/3000 second, 19.36 seconds total.
export const rates = {baseline: 330, '30hz': 100, '60hz': 50} as const;
export const tickTime = (tick: number, step: Step) => Math.min(matchTime, tick * step);
export const tickAt = (elapsedMs: number, step: Step) => elapsedMs * 3 >= matchTime ? Math.ceil(matchTime / step) : Math.max(0, Math.floor(elapsedMs * 3 / step));
type Step = typeof rates[keyof typeof rates];
type Mode = keyof typeof rules.modes;
type Posture = 'upright' | 'crouch';
type Action = 'attack' | 'precision' | 'reload' | 'observe' | 'peek' | 'stop';
export type Input = {kind: Action} | {kind: 'posture'; posture: Posture}
  | {kind: 'steer'; mode: Mode; dx: number; dy: number} | {kind: 'move'; mode: Mode; to: Position};
export type Inputs = readonly [Input | null, Input | null];
export type Config = Readonly<{rulesVersion: typeof rulesVersion; mapVersion: typeof mapVersion; seed: number; step: Step}>;
export const configure = (seed: number, step: Step = rates['30hz']): Config => ({rulesVersion, mapVersion, seed, step});
type Motion = {mode: Mode; path: readonly Position[]} | {mode: Exclude<Mode, 'jump'>; dx: number; dy: number};
type Fighter = {
  position: Position; hp: number; ammo: number; posture: Posture; exposedUntil: number;
  motion?: Motion; firing?: {kind: 'attack' | 'precision'; due: number}; reloadDue?: number;
  survey?: {kind: 'observe' | 'peek'; due: number}; contact?: {position: Position; time: number};
};
export type State = {tick: number; time: number; fighters: [Fighter, Fighter]; result: Result | null};
export type Event =
  | {kind: 'collision'; side: Side; with: 'terrain' | 'agent'}
  | {kind: 'complete'; side: Side; action: Action | 'move'}
  | {kind: 'contact'; side: Side; visible: boolean}
  | {kind: 'attack'; side: Side; outcome: 'hit' | 'miss' | 'precision'; damage: number}
  | {kind: 'defeat'; side: Side};
export type Frame = {state: State; events: Event[]};
export const initial = (): State => ({
  tick: 0, time: 0, result: null, fighters: sides.map(side => ({
    position: starts[side], hp: rules.hp, ammo: rules.ammo, posture: 'upright', exposedUntil: 0,
  })) as State['fighters'],
});
const speed = {walk: 3, run: 6, crouch: 2, jump: 3};
const other = (side: Side): Side => side === 0 ? 1 : 0;
const modes = Object.keys(speed) as Mode[];
const actionTime = (action: keyof Pick<typeof realtimeRules, 'attack' | 'reload' | 'observe' | 'peek'>) => realtimeRules[action] * 330;

export function assertConfig(config: Config) {
  if (!config || config.rulesVersion !== rulesVersion || config.mapVersion !== mapVersion ||
      !Object.values(rates).includes(config.step) || !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) {
    throw Error('Invalid continuous configuration');
  }
}

function visible(state: State, side: Side, focus = 0) {
  const you = state.fighters[side], rival = state.fighters[other(side)];
  const passive = rules.vision - Number(rival.posture === 'crouch') +
    (rival.exposedUntil > state.time ? rules.runExposure : 0);
  return gap(you.position, rival.position) <= Math.max(passive, focus) * unit && clearSight(you.position, rival.position);
}

export function permissions(state: State, side: Side) {
  const you = state.fighters[side], mode = you.motion?.mode, moving = !!mode;
  const light = mode !== 'run' && mode !== 'jump';
  const canFire = light && !you.firing && !you.reloadDue && !you.survey && you.ammo > 0 &&
    gap(you.position, state.fighters[other(side)].position) <= rules.attackRange * unit && visible(state, side);
  const actions: Input['kind'][] = [];
  const movement: Mode[] = [];
  if (state.result) return {actions, movement};
  if (moving && mode !== 'jump') actions.push('stop');
  if (light && mode !== 'crouch' && you.firing?.kind !== 'precision') actions.push('posture');
  if (canFire) {
    actions.push('attack');
    if (!moving) actions.push('precision');
  }
  if (light && !you.firing && !you.reloadDue && you.survey?.kind !== 'peek' && you.ammo < rules.ammo) actions.push('reload');
  if (light && !you.survey && !you.firing) {
    actions.push('observe');
    if (!moving && !you.reloadDue) actions.push('peek');
  }
  if (mode !== 'jump' && you.firing?.kind !== 'precision' && you.survey?.kind !== 'peek') {
    movement.push('walk', 'crouch');
    if (!you.firing && !you.reloadDue && !you.survey) movement.push('run', 'jump');
  }
  return {actions, movement};
}

export function observation(state: State, side: Side) {
  const {position, hp, ammo, posture, motion, firing, reloadDue, survey, contact} = state.fighters[side];
  return {
    time: state.time, remaining: matchTime - state.time,
    you: {position, hp, ammo, posture, mode: motion?.mode, firing: firing?.kind, reloading: !!reloadDue, surveying: survey?.kind},
    contact: visible(state, side) ? {status: 'visible', position: state.fighters[other(side)].position, time: state.time}
      : contact?.time === state.time ? {status: 'observed', ...contact}
      : contact && state.time - contact.time <= realtimeRules.contactAge * 330 ? {status: 'last seen', ...contact} : {status: 'unknown'},
    ...permissions(state, side),
  };
}

function inputMotion(you: Fighter, input: Extract<Input, {kind: 'move' | 'steer'}>, side: Side): Motion | undefined {
  if (!modes.includes(input.mode)) return;
  const from = you.position;
  if (input.kind === 'steer') {
    if (Object.keys(input).length !== 4 || ![-1, 0, 1].includes(input.dx) || ![-1, 0, 1].includes(input.dy) || (!input.dx && !input.dy)) return;
    if (input.mode !== 'jump') return {mode: input.mode, dx: input.dx, dy: input.dy};
    const to = toward(from, {x: from.x + input.dx * unit, y: from.y + input.dy * unit}, unit);
    if (openSegment(from, to)) return {mode: 'jump', path: [to]};
  } else {
    if (Object.keys(input).length !== 3 || !input.to || typeof input.to !== 'object' ||
        Object.keys(input.to).length !== 2) return;
    const {x, y} = input.to;
    const to = {x, y};
    const distance = gap(from, to);
    if (input.mode === 'jump') {
      if (distance === unit && openSegment(from, to)) return {mode: 'jump', path: [to]};
    } else {
      const path = route(from, to, rules.modes[input.mode].steps, side === 1);
      if (path) return {mode: input.mode, path};
    }
  }
}

function checked(state: State, side: Side, input: Input): true | Motion | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return;
  const {actions, movement} = permissions(state, side);
  if (input.kind === 'move' || input.kind === 'steer') {
    if (movement.includes(input.mode)) return inputMotion(state.fighters[side], input, side);
    return;
  }
  if (!actions.includes(input.kind)) return;
  if (input.kind === 'posture') {
    if (Object.keys(input).length === 2 && (input.posture === 'upright' || input.posture === 'crouch')) return true;
  } else if (Object.keys(input).length === 1) return true;
}
export const allows = (state: State, side: Side, input: Input) => !!checked(state, side, input);

export function destination(fighter: Fighter) {
  return fighter.motion && 'path' in fighter.motion ? fighter.motion.path.at(-1) : undefined;
}

export function advance(config: Config, previous: State, inputs: Inputs): Frame {
  assertConfig(config);
  const frame = stepWorld(config, previous, inputs, matchTime);
  const [blue, sand] = frame.state.fighters;
  if (!blue.hp || !sand.hp || frame.state.time === matchTime) {
    finish(frame.state, blue.hp === sand.hp ? 'draw' : blue.hp > sand.hp ? 'blue' : 'sand');
  }
  return frame;
}

export function finish(state: State, result: Result) {
  state.result = result;
  for (const fighter of state.fighters) {
    delete fighter.motion;
    delete fighter.reloadDue;
    delete fighter.firing;
    delete fighter.survey;
  }
}

// Apply the shared simultaneous world update before mode-specific settlement.
export function stepWorld(config: Config, previous: State, inputs: Inputs, deadline: number, liveFightersOnly = false): Frame {
  if (previous.result || previous.time >= deadline) throw Error('Continuous match already finished');
  if (!Array.isArray(inputs) || inputs.length !== 2) throw Error('Invalid continuous inputs');
  const tick = previous.tick + 1, time = Math.min(deadline, previous.time + config.step), elapsed = time - previous.time;
  const state: State = {tick, time, fighters: [{...previous.fighters[0]}, {...previous.fighters[1]}], result: null};
  const events: Event[] = [];
  const damage = [0, 0], focus = [0, 0];

  for (const side of sides) {
    const input = inputs[side], fighter = state.fighters[side];
    if (input === null) continue;
    const accepted = (!liveFightersOnly || (fighter.hp > 0 && (!(input.kind === 'attack' || input.kind === 'precision') ||
      previous.fighters[other(side)].hp > 0))) && checked(previous, side, input);
    if (!accepted) throw Error('Illegal continuous input');
    if (accepted !== true) {
      fighter.motion = accepted;
      if (accepted.mode !== 'walk') fighter.posture = accepted.mode === 'crouch' ? 'crouch' : 'upright';
    } else switch (input.kind) {
      case 'stop': delete fighter.motion; break;
      case 'posture': fighter.posture = input.posture; break;
      case 'attack':
      case 'precision':
        fighter.ammo--;
        fighter.firing = {kind: input.kind, due: previous.time + actionTime('attack')};
        break;
      case 'reload': fighter.reloadDue = previous.time + actionTime('reload'); break;
      case 'observe':
      case 'peek': fighter.survey = {kind: input.kind, due: previous.time + actionTime(input.kind)}; break;
    }
    if (fighter.motion?.mode === 'run') fighter.exposedUntil = time + realtimeRules.exposure * 330;
  }

  for (const side of sides) {
    const fighter = state.fighters[side], rival = other(side);
    if (fighter.firing && fighter.firing.due <= time) {
      const {kind, due} = fighter.firing;
      const distance = gap(fighter.position, state.fighters[rival].position);
      const roll = draw(config.seed & 0x7fffffff, due, (side ^ (config.seed >>> 31)) as Side);
      const hit = distance <= rules.attackRange * unit && visible(state, side) &&
        roll < realtimeOdds(kind, distance <= 2 * unit, fighter.posture, fighter.motion?.mode);
      damage[rival] = hit ? kind === 'precision' ? rules.precisionDamage : rules.standardDamage : 0;
      events.push({kind: 'attack', side, outcome: hit ? kind === 'precision' ? 'precision' : 'hit' : 'miss', damage: damage[rival]},
        {kind: 'complete', side, action: kind});
      delete fighter.firing;
    }
    if (fighter.reloadDue && fighter.reloadDue <= time) {
      fighter.ammo = rules.ammo;
      delete fighter.reloadDue;
      events.push({kind: 'complete', side, action: 'reload'});
    }
    if (fighter.survey && fighter.survey.due <= time) {
      const {kind} = fighter.survey;
      focus[side] = kind === 'peek' ? rules.peekVision : rules.observeVision;
      delete fighter.survey;
      events.push({kind: 'complete', side, action: kind});
    }
  }

  const origins = state.fighters.map(f => f.position);
  const blocks: Array<'terrain' | 'agent' | undefined> = [];
  const targets = state.fighters.map(({motion, position}, side) => {
    if (!motion) return position;
    const goal = 'path' in motion ? motion.path[0] : {x: position.x + motion.dx * unit, y: position.y + motion.dy * unit};
    const target = toward(position, goal, elapsed * speed[motion.mode]);
    if (openSegment(position, target)) return target;
    blocks[side] = 'terrain';
    return position;
  });
  if ((!liveFightersOnly || state.fighters.every(fighter => fighter.hp > 0)) && agentsCollide(origins[0], targets[0], origins[1], targets[1])) {
    for (const side of sides) if (!equal(origins[side], targets[side])) blocks[side] = 'agent';
  }
  for (const side of sides) {
    const fighter = state.fighters[side], motion = fighter.motion, blockage = blocks[side];
    if (blockage) {
      delete fighter.motion;
      events.push({kind: 'collision', side, with: blockage});
    } else if (motion) {
      fighter.position = targets[side];
      if (motion.mode === 'run') fighter.exposedUntil = time + realtimeRules.exposure * 330;
      if ('path' in motion && equal(motion.path[0], fighter.position)) {
        if (motion.path.length > 1) fighter.motion = {...motion, path: motion.path.slice(1)};
        else {
          delete fighter.motion;
          if (motion.mode === 'jump') focus[side] = rules.observeVision;
          events.push({kind: 'complete', side, action: 'move'});
        }
      }
    }
    fighter.hp = Math.max(0, fighter.hp - damage[side]);
    if (!fighter.hp && (!liveFightersOnly || previous.fighters[side].hp > 0)) events.push({kind: 'defeat', side});
  }
  for (const side of sides) {
    const fighter = state.fighters[side];
    const was = (!liveFightersOnly || previous.fighters.every(fighter => fighter.hp > 0)) &&
      (previous.fighters[side].contact?.time === previous.time || visible(previous, side));
    const now = (!liveFightersOnly || state.fighters.every(fighter => fighter.hp > 0)) && visible(state, side, focus[side]);
    if (now) fighter.contact = {position: state.fighters[other(side)].position, time};
    if (now !== was) events.push({kind: 'contact', side, visible: now});
  }
  return {state, events};
}

