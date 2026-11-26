import {configure, observation, realtime, revision, rules, type Intent, type Intents, type RulesVersion, type Side, type State} from './game.js';
import {record} from './replay.js';
import {distance, point, WIDTH} from './yard.js';

type Profile = 'roam' | 'seek';
function choose(state: State, side: Side, profile: Profile, seed: number, version: RulesVersion, adapted: boolean): Intent | null {
  const {actions, contact, you} = observation(state, side, version);
  if (!actions.length) return null;
  const playable = (kind: Intent['kind']) => actions.find(intent => intent.kind === kind);
  if (state.fighters[side].active) return (you.ammo <= 1 ? playable('reload') : undefined) ?? playable('attack') ?? null;
  const phase = (state.tick + seed) % 11;
  const information = 'cell' in contact ? contact.cell : undefined;
  const gap = information === undefined ? Infinity : distance(you.cell, information);
  const attack = playable('attack');
  const reload = playable('reload');
  const topUpWhileMoving = adapted && version === revision && reload && you.ammo === 0;
  if (!topUpWhileMoving && phase > 1 && (profile === 'seek' || phase > 3) && attack) {
    return gap <= 2 && you.ammo <= 2 ? playable('precision') ?? attack : attack;
  }
  if (!topUpWhileMoving && reload && (you.ammo === 0 || (you.ammo === 1 && phase < 3))) return reload;
  if (!topUpWhileMoving && phase === 1 && playable('observe')) return {kind: profile === 'roam' ? 'peek' : 'observe'};
  const x = phase % 3 === 0 ? 2 : 6;
  const waypoint = (phase % 2 ? 2 : 4) * WIDTH + (side === 0 ? x : WIDTH - 1 - x);
  const goal = information !== undefined && profile === 'seek' && phase > 3 ? information : waypoint;
  const mode = topUpWhileMoving ? 'walk' : phase < 3 ? 'crouch' : phase === 3 ? 'jump' : phase < 7 ? 'walk' : 'run';
  const moves = actions.filter(intent => intent.kind === 'move').filter(intent => intent.mode === mode);
  const score = (cell: number) => {
    const across = side === 0 ? point(cell).x : WIDTH - 1 - point(cell).x;
    if (adapted && information !== undefined) {
      if (cell === information) return 1024;
      if (topUpWhileMoving) return (Math.abs(distance(cell, information) - 2) * 2 + distance(cell, you.cell)) * WIDTH + across;
    }
    return distance(cell, goal) * WIDTH + across;
  };
  return moves.sort((a, b) => score(a.to) - score(b.to))[0] ?? reload ?? playable('observe') ?? null;
}

export function developmentMatch(seed: number, profiles: [Profile, Profile] = ['seek', 'roam'],
    version: RulesVersion = rules.version, adapted = version === revision) {
  if (version === realtime) return record(configure(seed, version), state =>
    [realtimePolicy(state, 0, profiles[0], seed), realtimePolicy(state, 1, profiles[1], seed)]);
  const policySeed = version === revision ? seed & 0x7fffffff : seed;
  return record(configure(seed, version), state => [choose(state, 0, profiles[0], policySeed, version, adapted),
    choose(state, 1, profiles[1], policySeed, version, adapted)] satisfies Intents);
}

export function realtimePolicy(state: State, side: Side, profile: Profile, seed: number): Intent | null {
  if (state.tick % 4) return null;
  const {actions, contact, you} = observation(state, side, realtime);
  const {motion, firing, reloadDue} = state.fighters[side];
  const legal = (kind: Intent['kind']) => actions.find(intent => intent.kind === kind);
  const phase = (state.tick / 4 + (seed & 0x7fffffff)) % 11;
  if (you.ammo <= 1 && legal('reload')) return legal('reload')!;
  if (legal('attack') && (profile === 'seek' || phase < 8)) {
    return phase < 3 && you.ammo > 1 ? legal('precision') ?? legal('attack')! : legal('attack')!;
  }
  if (phase === 1 && legal('observe')) return legal('observe')!;
  if (motion && (phase % 3 !== 0 || motion.mode === 'jump')) return null;
  const rival = 'cell' in contact ? contact.cell : undefined;
  const across = (x: number) => side === 0 ? x : WIDTH - 1 - x;
  const waypoint = (phase % 2 ? 2 : 4) * WIDTH + across(phase % 3 ? 6 : 2);
  const goal = rival !== undefined && profile === 'seek' ? rival : waypoint;
  const mode = reloadDue || firing ? 'walk' : phase === 3 ? 'jump' : phase < 4 ? 'crouch' : phase < 8 ? 'walk' : 'run';
  const moves = actions.filter(intent => intent.kind === 'move').filter(intent => intent.mode === mode);
  const score = (cell: number) => cell === rival ? 1024 :
    (goal === rival ? Math.abs(distance(cell, goal) - 2) : distance(cell, goal)) * WIDTH + across(point(cell).x);
  return moves.sort((a, b) => score(a.to) - score(b.to))[0] ?? null;
}
