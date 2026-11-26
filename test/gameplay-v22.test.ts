import {expect, it} from 'vitest';
import {advance, configure, initial, legal, realtime, realtimeOdds, realtimeRules, rollFor, type Intent, type Intents, type State} from '../src/v2/game';
import {dueTick, sandboxIntent} from '../src/v2/sandbox-input';
import {developmentMatch} from '../src/v2/development';
import {validate} from '../src/v2/replay';
import v20 from '../evidence/gameplay-v2/showcase.json';
import v21 from '../evidence/gameplay-v21/ordinary.json';

it('accepts a route change while moving and stops before a scheduled step', () => {
  const version = 'arcade-v2.2';
  const config = configure(3, version);
  const walk = (to: number) => ({kind: 'move', mode: 'walk', to} as const);
  let state = advance(config, initial(), [walk(31), null]).state;
  expect(legal(state, 0, version)).toContainEqual(walk(19));
  state = advance(config, state, [walk(19), null]).state;
  state = advance(config, state, [{kind: 'stop'}, null]).state;
  for (let i = 0; i < 8; i++) state = advance(config, state, [null, null]).state;
  expect(state.fighters[0].cell).toBe(28);
  expect(state.fighters[0].motion).toBeUndefined();
});

const config = configure(10, realtime);
const close = () => {
  const state = initial();
  Object.assign(state.fighters[0], {cell: 30, ammo: 2});
  state.fighters[1].cell = 33;
  return state;
};
const move = (mode: 'walk'|'run'|'crouch'|'jump', to = 31): Intent => ({kind: 'move', mode, to});

it.each([
  ['still', true, true, true, true],
  ['walk', true, false, true, true],
  ['crouch', true, false, true, true],
  ['run', false, false, false, false],
  ['jump', false, false, false, false],
] as const)('%s has the declared standard, precision, reload and observe permissions', (mode, shot, precision, reload, observe) => {
  const state = mode === 'still' ? close() : advance(config, close(), [move(mode), null]).state;
  const combinations = [[{kind: 'attack'}, shot], [{kind: 'precision'}, precision], [{kind: 'reload'}, reload], [{kind: 'observe'}, observe]] as const;
  for (const [intent, allowed] of combinations) {
    expect(legal(state, 0, realtime).some(choice => choice.kind === intent.kind)).toBe(allowed);
    if (allowed) expect(() => advance(config, state, [intent, null])).not.toThrow();
    else expect(() => advance(config, state, [intent, null])).toThrow('Illegal V2 intent');
  }
});

it('allows stationary crouched precision, and blocks move/posture changes until it completes', () => {
  const crouched = advance(config, close(), [{kind: 'posture', posture: 'crouch'}, null]).state;
  expect(advance(config, crouched, [{kind: 'attack'}, null]).state.fighters[0].firing?.kind).toBe('attack');
  const started = advance(config, crouched, [{kind: 'precision'}, null]).state;
  expect(started.fighters[0]).toMatchObject({posture: 'crouch', ammo: 1, firing: {kind: 'precision'}});
  for (const intent of [move('walk'), {kind: 'posture', posture: 'upright'} as const, {kind: 'reload'} as const]) {
    expect(() => advance(config, started, [intent, null])).toThrow('Illegal V2 intent');
  }
});

it('commits stationary peek, rejects movement during it, and returns only local contact', () => {
  let state = advance(config, initial(), [{kind: 'peek'}, null]).state;
  expect(() => advance(config, state, [move('walk', 29), null])).toThrow('Illegal V2 intent');
  for (let i = 1; i < realtimeRules.peek; i++) state = advance(config, state, [null, null]).state;
  expect(state.fighters[0]).toMatchObject({contact: {cell:34, tick:realtimeRules.peek}});
  expect(state.fighters[0].survey).toBeUndefined();
});

it('redirects a run into a full-duration jump and rejects row wrapping and walls', () => {
  const running = advance(config, close(), [move('run'), null]).state;
  const jump = advance(config, running, [move('jump', 29), null]).state;
  expect(jump.fighters[0].motion).toMatchObject({mode:'jump', due:running.tick + realtimeRules.intervals.jump});
  const edge = close();
  edge.fighters[0].cell = 8;
  expect(sandboxIntent(edge, new Set(['KeyD']))).toBeNull();
  expect(() => advance(config, edge, [move('run', 13), null])).toThrow('Illegal V2 intent');
});

it('preserves a reload through walk redirection, stance change, observe and stop', () => {
  let state = advance(config, close(), [{kind: 'reload'}, null]).state;
  state = advance(config, state, [move('walk'), null]).state;
  state = advance(config, state, [{kind: 'posture', posture: 'crouch'}, null]).state;
  const redirect = advance(config, state, [move('crouch', 29), null]);
  expect(redirect.events).toContainEqual({kind: 'interrupt', side: 0, action: 'move', reason: 'redirect'});
  expect(redirect.state.fighters[0]).toMatchObject({reloadDue: 12, posture: 'crouch'});
  state = advance(config, redirect.state, [{kind: 'observe'}, null]).state;
  expect(state.fighters[0]).toMatchObject({motion: {mode: 'crouch'}, survey: {kind: 'observe'}, reloadDue: 12});
  state = advance(config, state, [{kind: 'stop'}, null]).state;
  expect(state.fighters[0].motion).toBeUndefined();
  expect(state.fighters[0].reloadDue).toBe(12);
  while (state.tick < 12) state = advance(config, state, [null, null]).state;
  expect(state.fighters[0]).toMatchObject({cell: 30, ammo: 4});
  expect(state.fighters[0].reloadDue).toBeUndefined();
  expect(state.fighters[0].survey).toBeUndefined();
});

it('applies the state at resolution to an already committed shot', () => {
  const seed = Array.from({length: 200}, (_, i) => i).find(i => {
    const roll = rollFor(configure(i, realtime), realtimeRules.attack, 0);
    return roll >= realtimeOdds('attack', false, 'upright', 'walk') && roll < realtimeOdds('attack', false, 'upright');
  })!;
  const shotConfig = configure(seed, realtime);
  const start = advance(shotConfig, close(), [{kind: 'attack'}, null]).state;
  function resolve(redirect: Intent | null) {
    let frame = advance(shotConfig, start, [redirect, null]);
    while (frame.state.tick < realtimeRules.attack) frame = advance(shotConfig, frame.state, [null, null]);
    return frame;
  }
  expect(resolve(null).events).toContainEqual({kind:'attack', side:0, outcome:'hit', damage:18});
  const moving = resolve(move('walk', 29));
  expect(moving.events).toContainEqual({kind:'attack', side:0, outcome:'miss', damage:0});
  expect(moving.events).toContainEqual({kind:'move', side:0, from:30, to:29, mode:'walk'});
  expect(moving.state.fighters[0].ammo).toBe(1);
});

it('blocks jumping redirects and allows the opponent to damage a jumping agent on landing', () => {
  const seed = Array.from({length: 200}, (_, i) => i)
    .find(i => rollFor(configure(i, realtime), realtimeRules.attack, 1) < 60)!;
  const jumpConfig = configure(seed, realtime);
  const fire = advance(jumpConfig, close(), [null, {kind:'attack'}]).state;
  let frame = advance(jumpConfig, fire, [move('jump'), null]);
  expect(legal(frame.state, 0, realtime).map(intent => intent.kind)).toEqual(['hold']);
  while (frame.state.tick < 7) frame = advance(jumpConfig, frame.state, [null, null]);
  expect(frame.events).toContainEqual({kind:'move', side:0, from:30, to:31, mode:'jump'});
  expect(frame.state.fighters[0]).toMatchObject({cell:31, hp:82});
  expect(frame.state.fighters[0].motion).toBeUndefined();
});

it('manual input uses legal commands and gives identical traces under different scheduler cadences', () => {
  const held = new Set(['KeyD']);
  const pump = (sampleMs: number) => {
    let state: State = close();
    const trace = [];
    for (let elapsed = 0; !state.result; elapsed += sampleMs) {
      while (!state.result && state.tick < dueTick(elapsed)) {
        const controls = state.tick < 10 ? held : new Set<string>();
        const pressed = state.tick === 1 ? 'KeyF' : state.tick === 9 ? 'KeyR' : undefined;
        const intents: Intents = [sandboxIntent(state, controls, pressed), null];
        const frame = advance(config, state, intents);
        state = frame.state;
        trace.push(frame);
      }
    }
    return trace;
  };
  expect(pump(7)).toEqual(pump(83));
  expect(pump(16).at(-1)?.state.tick).toBe(realtimeRules.ticks);
  expect(sandboxIntent(initial(), new Set(), 'KeyF')).toBeNull();
});

it('clears pending states at termination and preserves historical replays', () => {
  const state = close();
  state.tick = realtimeRules.ticks - 1;
  const finished = advance(config, state, [move('walk'), null]).state;
  expect(finished.result).toBe('draw');
  expect(finished.fighters[0].motion).toBeUndefined();
  expect(() => advance(config, finished, [null, null])).toThrow('finished');
  expect(validate(v20).result).toBe('blue');
  expect(validate(v21).result).toBe('sand');
  const replay = developmentMatch(3, undefined, realtime);
  expect(validate(JSON.parse(JSON.stringify(replay)))).toEqual(replay);
});

it('resolves simultaneous lethal shots once with stable ordering and mirrored draw', () => {
  const state = close();
  state.fighters[0].hp = state.fighters[1].hp = 1;
  const seed = Array.from({length: 200}, (_, i) => i).find(i =>
    [0, 1].every(side => rollFor(configure(i, realtime), realtimeRules.attack, side as 0|1) < 60))!;
  const match = configure(seed, realtime);
  let frame = advance(match, state, [{kind:'attack'}, {kind:'attack'}]);
  expect(frame.state.fighters.map(fighter => fighter.ammo)).toEqual([1, 3]);
  while (!frame.state.result) frame = advance(match, frame.state, [null, null]);
  expect(frame.state.result).toBe('draw');
  expect(frame.events.filter(event => event.kind === 'attack' || event.kind === 'defeat').map(event => [event.kind, event.side]))
    .toEqual([['attack', 0], ['attack', 1], ['defeat', 0], ['defeat', 1]]);
  expect(frame.state.fighters.map(fighter => fighter.hp)).toEqual([0, 0]);
});
