import {policy as baseline, type Profile} from '../v23/development.js';
import {configure as worldConfig, destination} from '../v23/game.js';
import {equal, gap} from '../v23/space.js';
import type {Side} from '../v2/game.js';
import {allows, role, type Config, type CoreConfig, type Input, type State} from './objective.js';
import {record} from './replay.js';

// Local test heuristic. The mode itself never requests movement or picks actions.
export function policy(config: CoreConfig & Pick<Config,'step'>,
  state: State, side: Side, profile: Profile, useObjective = true, contestPending = false): Input | null {
  const fighter = state.fighters[side];
  if (!fighter.hp) return null;
  const fallback = () => baseline(worldConfig(config.seed),state,side,profile);
  if (!useObjective) return fallback();
  const cadence = 1320;
  if (state.time && Math.floor(state.time / cadence) === Math.floor((state.time - config.step) / cadence)) return null;
  const canUseCore = (state.core.phase === 'pending') === (role(config,side) === 'Activator');
  if (!canUseCore && !(contestPending && state.core.phase === 'pending')) return fallback();
  if (state.core.interaction?.side === side) return null;
  const combat = fallback();
  if (combat?.kind === 'attack' || combat?.kind === 'precision' || combat?.kind === 'reload') return combat;
  if (allows(config,state,side,{kind:'interact'})) return {kind:'interact'};
  const {position,radius} = config.objective;
  if (gap(fighter.position,position) <= radius) return fighter.motion && allows(config,state,side,{kind:'stop'}) ? {kind:'stop'} : null;
  const target = {x:position.x + (side === 0 ? -2000 : 2000),y:position.y};
  const prior = destination(fighter);
  if (prior && equal(prior,target)) return null;
  const modes: Array<'run'|'walk'> = profile === 'seek' ? ['run','walk'] : ['walk','run'];
  for (const mode of modes) {
    const input = {kind:'move',mode,to:target} as const;
    if (allows(config,state,side,input)) return input;
  }
  return combat;
}

export function developmentMatch(config: Config, profiles: readonly [Profile,Profile] = ['seek','roam'], useObjective = true) {
  return record(config,state => [policy(config,state,0,profiles[0],useObjective),policy(config,state,1,profiles[1],useObjective)]);
}
