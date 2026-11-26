import {allows as worldAllows, configure as worldConfig, finish, initial as worldInitial, matchTime, observation as worldObservation,
  rates, stepWorld, type Event as WorldEvent, type Input as WorldInput, type State as WorldState} from '../v23/game.js';
import {center, gap} from '../v23/space.js';
import {MAP_VERSION} from '../v2/yard.js';
import {sides, type Result, type Side} from '../v2/game.js';

export const settings = {radius: 4000, pending: matchTime, active: 18000, channel: 2700, position: center(31)} as const;
export const step = rates['30hz'];
export const maxTicks = Math.ceil(settings.pending / step) + Math.ceil(settings.active / step);
export const role = (config: Pick<Config,'activator'>, side: Side) => config.activator === side ? 'Activator' : 'Defender';
const opponent = (side: Side): Side => side === 0 ? 1 : 0;
const team = (side: Side): Result => side === 0 ? 'blue' : 'sand';
export type Config = {
  rulesVersion: 'arcade-v2.4'; mode: 'objective-duel'; mapVersion: typeof MAP_VERSION; step: typeof step;
  seed: number; activator: Side; participants: readonly [string, string]; objective: typeof settings;
};
export const configure = (seed: number, activator: Side, participants: Config['participants'] = ['blue-agent','sand-agent']): Config =>
  ({rulesVersion:'arcade-v2.4',mode:'objective-duel',mapVersion:MAP_VERSION,step,seed,activator,participants,objective:settings});
export function assertConfig(c: Config) {
  const o = c?.objective;
  if (!c || c.rulesVersion !== 'arcade-v2.4' || c.mode !== 'objective-duel' || c.mapVersion !== MAP_VERSION || c.step !== step ||
      !Number.isInteger(c.seed) || c.seed < 0 || c.seed > 0xffffffff || !sides.includes(c.activator) ||
      !Array.isArray(c.participants) || c.participants.length !== 2 || c.participants[0] === c.participants[1] ||
      !c.participants.every(id => typeof id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(id)) ||
      !o || o.radius !== settings.radius || o.pending !== settings.pending || o.active !== settings.active ||
      o.channel !== settings.channel || o.position?.x !== settings.position.x || o.position?.y !== settings.position.y ||
      Object.keys(c).length !== 8 || Object.keys(o).length !== 5 || Object.keys(o.position).length !== 2) throw Error('Invalid Objective Duel configuration');
}
type Interaction = {side: Side; started: number};
type Objective = {phase: 'pending' | 'active' | 'disabled' | 'completed'; deadline: number; interaction?: Interaction};
export type Reason = 'mutual-elimination' | 'elimination' | 'activation-prevented' | 'core-disabled' | 'core-completed';
export type State = WorldState & {core: Objective; reason: Reason | null};
export type Input = WorldInput | {kind: 'interact' | 'cancel-interaction'};
export type Inputs = readonly [Input | null, Input | null];
export type Event = WorldEvent | {kind: 'objective'; action: 'started' | 'cancelled' | 'activated' | 'disabled' | 'completed'; side: Side}
  | {kind: 'round-ended'; result: Result; reason: Reason};
export type Frame = {state: State; events: Event[]};
export type CoreConfig = Pick<Config,'seed' | 'activator' | 'mode'> & {objective:{
  radius:number; pending:number; active:number; position:typeof settings.position;
}};
export const initial = (config: CoreConfig): State => ({...worldInitial(), core:{phase:'pending',deadline:config.objective.pending},reason:null});

function eligible(config: CoreConfig, state: State, side: Side) {
  const {position,hp,motion,firing,reloadDue,survey} = state.fighters[side];
  return hp > 0 && gap(position,config.objective.position) <= config.objective.radius && motion?.mode !== 'run' &&
    motion?.mode !== 'jump' && !firing && !reloadDue && survey?.kind !== 'peek';
}
export function allows(config: CoreConfig, state: State, side: Side, input: Input) {
  if (state.result || !state.fighters[side].hp || !input || typeof input !== 'object') return false;
  if (input.kind === 'interact' || input.kind === 'cancel-interaction') {
    if (Object.keys(input).length !== 1) return false;
    if (input.kind === 'cancel-interaction') return state.core.interaction?.side === side;
    return !state.core.interaction && (state.core.phase === 'pending' || state.core.phase === 'active') &&
      side === (state.core.phase === 'pending' ? config.activator : opponent(config.activator)) && eligible(config,state,side);
  }
  return worldAllows(state,side,input as WorldInput);
}
export function observation(config: Config,state: State,side: Side) {
  const world = worldObservation(state,side);
  return {
    ...world, mode:config.mode, role:role(config,side), remaining:state.result ? 0 : Math.max(0,state.core.deadline-state.time),
    core:{...state.core, ...config.objective, progress:state.core.interaction ? state.time-state.core.interaction.started : 0},
    actions: !state.fighters[side].hp ? [] : [...world.actions,
      ...(['interact','cancel-interaction'] as const).filter(kind => allows(config,state,side,{kind}))],
    movement: state.fighters[side].hp ? world.movement : [],
    objectiveRules:'Activator wins on Core completion. Defender wins by preventing activation until pending time expires or disabling an active Core. Pending elimination awards the survivor; double defeat draws. Active Defender defeat awards Activator; Activator defeat alone leaves the Core active.',
  };
}

function interrupts(input: Input | null) {
  return input?.kind === 'cancel-interaction' || input?.kind === 'attack' || input?.kind === 'precision' ||
    input?.kind === 'reload' || input?.kind === 'peek' ||
    ((input?.kind === 'move' || input?.kind === 'steer') && (input.mode === 'run' || input.mode === 'jump'));
}

export function advance(config: Config, previous: State, inputs: Inputs): Frame {
  assertConfig(config);
  return advanceCore(config,previous,inputs,{activate:config.objective.channel,disable:config.objective.channel});
}

export function advanceCore(config: CoreConfig, previous: State, inputs: Inputs, timing: {
  activate:number;disable:number;interruptOnHit?:boolean;liveFightersOnly?:boolean;
}): Frame {
  if (!Array.isArray(inputs) || inputs.length !== 2) throw Error('Invalid Objective Duel inputs');
  for (const side of sides) if (inputs[side] !== null && !allows(config,previous,side,inputs[side]!)) throw Error('Illegal Objective Duel input');
  const commands = (side: Side) => {
    const input = inputs[side];
    return input && (input.kind === 'interact' || input.kind === 'cancel-interaction') ? null : input as WorldInput | null;
  };
  const world = stepWorld(worldConfig(config.seed), previous, [commands(0),commands(1)], previous.core.deadline,timing.liveFightersOnly);
  const state: State = {...world.state,core:{...previous.core},reason:null};
  for (const fighter of state.fighters) if (!fighter.hp) {
    delete fighter.motion;
    delete fighter.firing;
    delete fighter.reloadDue;
    delete fighter.survey;
  }
  const events: Event[] = world.events;
  const core = state.core, objective = config.objective, activator = config.activator, defender = opponent(activator);
  const started = sides.find(side => inputs[side]?.kind === 'interact');
  if (started !== undefined) {
    core.interaction = {side:started,started:previous.time};
    events.push({kind:'objective',action:'started',side:started});
  }
  const cancel = () => {
    if (!core.interaction) return;
    events.push({kind:'objective',action:'cancelled',side:core.interaction.side});
    delete core.interaction;
  };
  const end = (result: Result, reason: Reason) => {
    cancel();
    finish(state,result);
    state.reason = reason;
    events.push({kind:'round-ended',result,reason});
  };
  const living = state.fighters.map(f => f.hp > 0);
  const active = core.phase === 'active';
  if (!active && !living[0] && !living[1]) end('draw','mutual-elimination');
  else if (!active && !living[activator]) end(team(defender),'elimination');
  else if (!living[defender]) end(team(activator),'elimination');
  else {
    const channel = core.interaction;
    if (channel && (interrupts(inputs[channel.side]) || !eligible(config,state,channel.side) ||
      (timing.interruptOnHit && state.fighters[channel.side].hp < previous.fighters[channel.side].hp))) cancel();
    if (core.interaction && state.time - core.interaction.started >= (active ? timing.disable : timing.activate)) {
      delete core.interaction;
      if (active) {
        core.phase = 'disabled';
        events.push({kind:'objective',action:'disabled',side:defender});
        end(team(defender),'core-disabled');
      } else {
        core.phase = 'active';
        core.deadline = state.time + objective.active;
        events.push({kind:'objective',action:'activated',side:activator});
      }
    } else if (state.time === core.deadline) {
      if (active) {
        core.phase = 'completed';
        events.push({kind:'objective',action:'completed',side:activator});
        end(team(activator),'core-completed');
      } else end(team(defender),'activation-prevented');
    }
  }
  return {state,events};
}

