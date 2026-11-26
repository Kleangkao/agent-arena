import {policy as base, type Profile} from '../v23/development.js';
import {configure as worldConfig} from '../v23/game.js';
import {cellAt, center} from '../v23/space.js';
import {destinations, distance} from '../v2/yard.js';
import {policy as core} from '../v24/development.js';
import type {Side} from '../v2/game.js';
import {allows, observation, type Config, type Input, type State} from './game.js';
import {record} from './replay.js';

export function policy(config:Config,state:State,side:Side,profile:Profile,contestPending = false, seekContact = true):Input|null {
  if (!state.fighters[side].hp) return null;
  if (config.mode === 'score-deathmatch' && seekContact) {
    const choice = scorePolicy(config,state,side,profile);
    return choice && allows(config,state,side,choice) ? choice : null;
  }
  const input = config.mode === 'objective-duel' && 'core' in state ? core(config,state,side,profile,true,contestPending)
    : base(worldConfig(config.seed),state,side,profile);
  return input && allows(config,state,side,input) ? input : null;
}
function scorePolicy(config:Config,state:State,side:Side,profile:Profile):Input|null {
  const cadence = 1320;
  if (state.time && Math.floor(state.time/cadence) === Math.floor((state.time-config.step)/cadence)) return null;
  const {agent,world,legal} = observation(config,state,side);
  if (agent.ammo <= (profile === 'seek' ? 0 : 1) && legal.actions.includes('reload')) return {kind:'reload'};
  if (legal.actions.includes('attack')) {
    if (profile === 'roam' && legal.actions.includes('stop')) return {kind:'stop'};
    return {kind:profile === 'roam' && legal.actions.includes('precision') ? 'precision' : 'attack'};
  }
  if (agent.firing || agent.mode) return null;
  const here = cellAt(agent.position,side === 1);
  const contact = 'position' in world.contact && world.contact.position;
  const central = side === 0 ? [30,32] : [32,30];
  const goal = contact ? cellAt(contact,side === 1) : central[Math.floor(state.time/12000)%2];
  const mode = profile === 'seek' && !contact && legal.movement.includes('run') ? 'run' : 'walk';
  for (const cell of [...destinations(here,mode === 'run' ? 4 : 3,side === 1).keys()]
    .sort((a,b)=>distance(a,goal)-distance(b,goal))) {
    if (distance(cell,goal) >= distance(here,goal)) break;
    const input = {kind:'move',mode,to:center(cell)} as const;
    if (allows(config,state,side,input)) return input;
  }
  return legal.actions.includes('observe') ? {kind:'observe'} : null;
}
export const developmentMatch = (config:Config,profiles:readonly [Profile,Profile] = ['seek','roam'],contestPending = false, seekContact = true) =>
  record(config,state => [policy(config,state,0,profiles[0],contestPending,seekContact),policy(config,state,1,profiles[1],contestPending,seekContact)]);
