import * as world from '../v23/game.js';
import * as duel from '../v24/objective.js';
import {agentsCollide, center} from '../v23/space.js';
import {MAP_VERSION} from '../v2/yard.js';
import {sides, type Result, type Side} from '../v2/game.js';

export const revision = 'arcade-v2.5';
export const step = world.rates['30hz'];
export const modes = ['elimination', 'score-deathmatch', 'objective-duel'] as const;
const baseline = {pending:duel.settings.pending,active:duel.settings.active,activate:2700,disable:2700,interruptOnHit:false};
export const variants = {
  reference: baseline,
  'reference-live': baseline,
  'long-activation': {...baseline,activate:9000},
  'long-active': {...baseline,active:36000},
  'compact-duel': {...baseline,active:24000,activate:9000,disable:6000},
  'long-disable': {...baseline,active:24000,activate:9000,disable:9000},
  'long-interactions': {...baseline,active:36000,activate:9000,disable:6000},
  'contestable-core': {...baseline,active:36000,activate:9000,disable:6000,interruptOnHit:true},
} as const;
export type Variant = keyof typeof variants;
export const defaultVariant: Variant = 'long-disable';
export const targets = [5,10,20] as const;
export const clocks = [45,75,120] as const;
type Pair<T> = readonly [T,T];
type Common = {rulesVersion:typeof revision; mapVersion:typeof MAP_VERSION; seed:number; step:typeof step; participants:Pair<string>};
type ObjectiveConfig = Common & {mode:'objective-duel';activator:Side;variant:Variant;objective:
  (typeof variants)[Variant] & Pick<typeof duel.settings,'position'|'radius'>};
type ScoreConfig = Common & {mode:'score-deathmatch';target:typeof targets[number];limit:number;respawnDelay:number};
export type Config = ObjectiveConfig | ScoreConfig | Common & {mode:'elimination'};
type Options = {mode:'objective-duel';activator:Side;variant?:Variant} |
  {mode:'score-deathmatch';target?:ScoreConfig['target'];seconds?:typeof clocks[number]} | {mode:'elimination'};
export type ScoreReason = 'target-score' | 'simultaneous-target' | 'score-clock' | 'equal-score';
export type EliminationReason = 'elimination' | 'mutual-elimination' | 'health-clock';
export type ScoreState = world.State & {score:[number,number];respawnAt:[number|null,number|null];reason:ScoreReason|null};
export type EliminationState = world.State & {reason:EliminationReason|null};
export type State = EliminationState | duel.State | ScoreState;
export type Event = duel.Event | {kind:'score';side:Side;total:number} | {kind:'respawn';side:Side} |
  {kind:'score-ended';result:Result;reason:ScoreReason} | {kind:'elimination-ended';result:Result;reason:EliminationReason};
export type Frame = {state:State;events:Event[]};
export type Input = duel.Input;
export type Inputs = duel.Inputs;
const other = (side: Side): Side => side === 0 ? 1 : 0;
const winner = (score: Pair<number>): Result => score[0] === score[1] ? 'draw' : score[0] > score[1] ? 'blue' : 'sand';

export function configure(seed:number, options:Options, participants:Pair<string> = ['blue-agent','sand-agent']):Config {
  const common:Common = {rulesVersion:revision,mapVersion:MAP_VERSION,step,seed,participants};
  switch (options.mode) {
    case 'elimination': return {...common,mode:options.mode};
    case 'objective-duel': {
      const variant = options.variant ?? defaultVariant;
      return {...common,mode:options.mode,activator:options.activator,variant,
        objective:{...variants[variant],radius:duel.settings.radius,position:duel.settings.position}};
    }
    case 'score-deathmatch': return {...common,mode:options.mode,target:options.target ?? 5,
      limit:(options.seconds ?? 75)*3000,respawnDelay:3600};
  }
}

export const canonical = (value:unknown):string => JSON.stringify(value,(_key,entry) =>
  entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key,entry[key]])) : entry);

export function assertConfig(value:unknown):asserts value is Config {
  const config = value as Config;
  if (!config || !modes.includes(config.mode) || !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff ||
      !Array.isArray(config.participants) || config.participants.length !== 2 || config.participants[0] === config.participants[1] ||
      !config.participants.every(id => typeof id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(id))) throw Error('Invalid V2.5 match configuration');
  let expected:Config;
  if (config.mode === 'objective-duel') {
    if (!sides.includes(config.activator) || !Object.hasOwn(variants,config.variant)) throw Error('Invalid Core configuration');
    expected = configure(config.seed,config,config.participants);
  } else if (config.mode === 'score-deathmatch') {
    const seconds = clocks.find(clock => clock*3000 === config.limit);
    if (!seconds || !targets.includes(config.target)) throw Error('Invalid score configuration');
    expected = configure(config.seed,{mode:config.mode,target:config.target,seconds},config.participants);
  } else expected = configure(config.seed,config,config.participants);
  if (canonical(config) !== canonical(expected)) throw Error('Altered V2.5 match configuration');
}

export function initial(config:Config):State {
  if (config.mode === 'objective-duel') return duel.initial(config);
  const state = world.initial();
  return config.mode === 'score-deathmatch' ? {...state,score:[0,0],respawnAt:[null,null],reason:null} : {...state,reason:null};
}

export function deadline(config:Config,state:world.State | State) {
  return 'core' in state ? state.core.deadline : config.mode === 'score-deathmatch' ? config.limit : world.matchTime;
}
export function maxTicks(config:Config) {
  return config.mode === 'objective-duel'
    ? Math.ceil(config.objective.pending/step) + Math.ceil(config.objective.active/step)
    : Math.ceil((config.mode === 'score-deathmatch' ? config.limit : world.matchTime)/step);
}

export function allows(config:Config,state:State,side:Side,input:Input) {
  if (!input || !state.fighters[side].hp || (!historicalCore(config) && !state.fighters[other(side)].hp &&
      (input.kind === 'attack' || input.kind === 'precision'))) return false;
  if (config.mode === 'objective-duel') return 'core' in state && duel.allows(config,state,side,input);
  return input.kind !== 'interact' && input.kind !== 'cancel-interaction' &&
    world.allows(state,side,input as world.Input);
}
const historicalCore = (config:Config) => config.mode === 'objective-duel' && config.variant === 'reference';

// Prefer original homes, then test other symmetric valid cells in the same order for each side.
const spawnCells = [[28,10,46,27,9,45],[34,16,52,35,17,53]] as const;
function advanceScore(config:ScoreConfig,previous:ScoreState,inputs:world.Inputs):Frame {
  const {state:updated,events:baseEvents} = world.stepWorld(world.configure(config.seed),previous,inputs,config.limit,true);
  const state:ScoreState = {...updated,score:[...previous.score],respawnAt:[...previous.respawnAt],reason:null};
  const events:Event[] = baseEvents.slice();
  for (const event of baseEvents) if (event.kind === 'defeat') {
    const side = other(event.side);
    events.push({kind:'score',side,total:++state.score[side]});
    const fighter = state.fighters[event.side];
    delete fighter.motion;
    delete fighter.firing;
    delete fighter.reloadDue;
    delete fighter.survey;
    delete fighter.contact;
    // Observations from the defeated life expire when that life ends.
    delete state.fighters[side].contact;
    state.respawnAt[event.side] = state.time + config.respawnDelay;
  }
  const [blue,sand] = state.score;
  const terminal = Math.max(blue,sand) >= config.target ? blue === sand ? 'simultaneous-target' : 'target-score'
    : state.time === config.limit ? blue === sand ? 'equal-score' : 'score-clock' : null;
  if (terminal) {
    world.finish(state,winner(state.score));
    state.reason = terminal;
    state.respawnAt = [null,null];
    events.push({kind:'score-ended',reason:terminal,result:state.result!});
  } else for (const side of sides) {
    const due = state.respawnAt[side];
    if (due === null || due > state.time) continue;
    const rival = state.fighters[other(side)];
    const position = spawnCells[side].map(center).find(candidate => !rival.hp ||
      !agentsCollide(candidate,candidate,rival.position,rival.position));
    if (!position) continue;
    state.fighters[side] = {...world.initial().fighters[side],position};
    state.respawnAt[side] = null;
    events.push({kind:'respawn',side});
  }
  return {state,events};
}

export function advance(config:Config,previous:State,inputs:Inputs):Frame {
  if (!Array.isArray(inputs) || inputs.length !== 2 || previous.result ||
      sides.some(side => inputs[side] !== null && !allows(config,previous,side,inputs[side]!))) throw Error('Illegal V2.5 step');
  if (config.mode === 'objective-duel' && 'core' in previous)
    return duel.advanceCore(config,previous,inputs,{...config.objective,liveFightersOnly:!historicalCore(config)});
  if (config.mode === 'score-deathmatch' && 'score' in previous) return advanceScore(config,previous,inputs as world.Inputs);
  if (config.mode === 'elimination' && !('core' in previous) && !('score' in previous)) {
    const {state,events} = world.advance(world.configure(config.seed),previous,inputs as world.Inputs);
    if (!state.result) return {state:{...state,reason:null},events};
    const [blue,sand] = state.fighters;
    const reason = !blue.hp && !sand.hp ? 'mutual-elimination' : !blue.hp || !sand.hp ? 'elimination' : 'health-clock';
    return {state:{...state,reason},events:[...events,{kind:'elimination-ended',result:state.result,reason}]};
  }
  throw Error('V2.5 state does not match mode');
}

export function observation(config:Config,state:State,side:Side) {
  const seen = world.observation(state,side);
  const alive = state.fighters[side].hp > 0;
  const scoring = 'score' in state && config.mode === 'score-deathmatch';
  const objective = 'core' in state && config.mode === 'objective-duel';
  const remaining = state.result ? 0 : Math.max(0,deadline(config,state)-state.time);
  const ownRespawn = scoring ? state.respawnAt[side] : null;
  const match = scoring ? {mode:config.mode,remaining,score:state.score[side],opponentScore:state.score[other(side)],target:config.target,
    respawnIn:ownRespawn === null ? null : Math.max(0,ownRespawn-state.time),
    victory:'One point per opposing defeat. Both simultaneous defeats score before settlement. Equal scores at the target or deadline draw.'}
    : objective ? {mode:config.mode,remaining,role:duel.role(config,side),phase:state.core.phase,position:config.objective.position,
      radius:config.objective.radius,activate:config.objective.activate,disable:config.objective.disable,
      interruptedByDamage:config.objective.interruptOnHit, interaction:state.core.interaction ? {
        by:state.core.interaction.side === side ? 'self' : 'opponent', progress:state.time-state.core.interaction.started,
      } : null,victory:'Pending: survivor wins, or Defender wins at the deadline. Mutual defeat draws. Active: Activator wins when the Core completes or Defender falls. Defender wins by disabling the Core. Legal interactions may complete exactly at the deadline.'}
    : {mode:'elimination' as const,remaining,victory:'Win by elimination or higher health when time expires. Equal health at the end draws.'};
  const masked = !historicalCore(config) && (!alive || !state.fighters[other(side)].hp);
  const actions = seen.actions.filter(kind => !masked || (kind !== 'attack' && kind !== 'precision'));
  return {version:1,time:state.time,agent:{...seen.you,life:alive ? 'alive' : 'defeated'},
    world:{contact:masked ? {status:'unknown'} : seen.contact},
    match, legal:{actions:alive ? [...actions,...(['interact','cancel-interaction'] as const).filter(kind =>
      allows(config,state,side,{kind}))] : [],movement:alive ? seen.movement : []}};
}
