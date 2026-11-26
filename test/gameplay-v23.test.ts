import {describe, expect, it} from 'vitest';
import {advance, allows, configure, initial, matchTime, observation, rates, tickAt, type Inputs, type State} from '../src/v23/game';
import {agentsCollide, center, clearSight, openSegment, radius, unit} from '../src/v23/space';
import {developmentMatch} from '../src/v23/development';
import {load, record} from '../src/v23/replay';
import {validate} from '../src/v2/replay';
import {validateReplay} from '../src/replay';
import historical from '../src/fixtures/historical-gemini.json';
import old20 from '../evidence/gameplay-v2/showcase.json';
import old21 from '../evidence/gameplay-v21/ordinary.json';
import old22 from '../evidence/gameplay-v22/autonomous.json';

const config = configure(0);
const pair = (state: State, inputs: Inputs) => advance(config, state, inputs);
const go = {kind: 'steer', mode: 'walk', dx: 1, dy: 0} as const;
const run = (state: State, ticks: number) => {
  for (let i = 0; i < ticks; i++) state = pair(state, [null, null]).state;
  return state;
};
describe('continuous authoritative movement', () => {
  it('moves partially on its first tick, redirects and stops off-center', () => {
    const start = initial();
    const moving = pair(start, [go, null]).state;
    const origin = start.fighters[0].position;
    expect(moving.fighters[0].position).toEqual({x: origin.x + 300, y: origin.y});
    const redirected = pair(moving, [{...go, dx: 0, dy: -1}, null]).state;
    expect(redirected.fighters[0].position).toEqual({x: origin.x + 300, y: origin.y - 300});
    const stopped = pair(redirected, [{kind: 'stop'}, null]).state;
    expect(run(stopped, 18).fighters[0].position).toEqual(redirected.fighters[0].position);
    const target = {x: origin.x + 425, y: origin.y - 300};
    const command = {kind: 'move', mode: 'walk', to: target} as const;
    expect(pair(stopped, [command, null]).state.fighters[0].position).toEqual(target);
  });
  it('rejects invalid inputs and sweeps world, terrain and opponent paths', () => {
    const start = initial();
    for (const input of [{...go, dx: 20}, {...go, extra: 1}, {kind: 'move', mode: 'run', to: {x: Infinity, y: 0}},
      {kind: 'move', mode: 'walk', to: center(22)}] as const) {
      expect(() => pair(start, [input, null])).toThrow('Illegal continuous input');
    }
    expect(openSegment(center(19), center(21))).toBe(false);
    expect(agentsCollide(center(28), center(30), center(30), center(28))).toBe(true);
    let state = pair(start, [{...go, mode: 'run'}, {...go, mode: 'run', dx: -1}]).state;
    let collisions = [];
    while (state.tick < 40 && !collisions.length) {
      const frame = pair(state, [null, null]);
      state = frame.state;
      collisions = frame.events.filter(event => event.kind === 'collision');
    }
    expect(collisions).toEqual([{kind:'collision',side:0,with:'agent'}, {kind:'collision',side:1,with:'agent'}]);
    expect(state.fighters[1].position.x - state.fighters[0].position.x).toBeGreaterThan(radius * 2);
    const left = pair(start, [{...go, dx: -1, mode: 'run'}, null]).state;
    expect(run(left, 25).fighters[0].position.x).toBeGreaterThanOrEqual(radius);
    expect(run(left, 25).fighters[0].motion).toBeUndefined();
  });
  it('routes destinations around existing obstacles from partial positions', () => {
    const start = initial();
    const moving = pair(start, [go, null]).state;
    const target = center(21);
    expect(advance(config, moving, [{kind:'move',mode:'walk',to:target}, null]).state.fighters[0].motion).toBeDefined();
    const arrived = run(advance(config, moving, [{kind:'move',mode:'walk',to:target}, null]).state, 65);
    expect(arrived.fighters[0].position).toEqual(target);
  });
  it('exposes a rival inside continuous range before the next center and preserves hidden information', () => {
    const state = initial();
    state.fighters[0].position = {x: 2 * unit, y: center(28).y};
    state.fighters[1].position = {x: 6 * unit + 1, y: center(34).y};
    expect(observation(state, 0).contact).toEqual({status: 'unknown'});
    const moved = pair(state, [go, null]).state;
    expect(observation(moved, 0).contact).toMatchObject({status:'visible', position: state.fighters[1].position});
    expect(clearSight(center(19), center(21))).toBe(false);
  });
  it('spends ammo once, preserves compatible timers, and rejects incompatible movement', () => {
    let state = run(pair(initial(), [go, {...go, dx: -1}]).state, 25);
    expect(allows(state, 0, {kind: 'attack'})).toBe(true);
    state = pair(state, [{kind:'attack'}, null]).state;
    expect(state.fighters[0]).toMatchObject({ammo:3, motion:{mode:'walk'}, firing:{kind:'attack'}});
    expect(allows(state, 0, {...go, mode:'run'})).toBe(false);
    expect(allows(state, 0, {kind:'reload'})).toBe(false);
    state = run(state, 24);
    state = pair(state, [{kind:'reload'}, null]).state;
    state = pair(state, [{kind:'observe'}, null]).state;
    expect(state.fighters[0]).toMatchObject({ammo:3, motion:{mode:'walk'}, survey:{kind:'observe'}});
    const stopped = pair(state, [{kind:'stop'}, null]).state;
    expect(stopped.fighters[0].reloadDue).toBe(state.fighters[0].reloadDue);
    expect(run(stopped, 40).fighters[0].ammo).toBe(4);
  });
  it('keeps a bounded jump committed and applies damage without invulnerability', () => {
    let state = initial();
    state.fighters[0].position = center(30);
    state.fighters[1].position = center(32);
    state.fighters[1].firing = {kind:'attack', due:100};
    let result: ReturnType<typeof advance> | undefined;
    for (let seed = 0; seed < 20; seed++) {
      result = advance(configure(seed), state, [{...go, mode:'jump', dx:-1}, null]);
      if (result.state.fighters[0].hp < 100) break;
    }
    expect(result?.state.fighters[0]).toMatchObject({hp:82, motion:{mode:'jump'}});
    state = result!.state;
    expect(allows(state, 0, {kind:'stop'})).toBe(false);
    expect(run(state, 19).fighters[0].position).toEqual(center(29));
  });
  it('orders simultaneous lethal attacks before either defeat', () => {
    const state = initial();
    for (const side of [0, 1] as const) {
      state.fighters[side].position = center(side === 0 ? 30 : 32);
      state.fighters[side].hp = 18;
      state.fighters[side].firing = {kind: 'attack', due: 100};
    }
    const lethal = Array.from({length: 20}, (_, seed) => advance(configure(seed), state, [null, null]))
      .find(frame => frame.state.fighters.every(f => f.hp === 0));
    expect(lethal?.state.result).toBe('draw');
    expect(lethal?.events.filter(event => event.kind === 'attack' || event.kind === 'defeat')
      .map(event => [event.kind, event.side])).toEqual([['attack',0],['attack',1],['defeat',0],['defeat',1]]);
  });
  it('mirrors a last-known contact exactly on a horizontal cell boundary', () => {
    const a = developmentMatch(3, ['seek', 'seek'], rates.baseline);
    const b = developmentMatch(0x80000003, ['seek', 'seek'], rates.baseline);
    expect(a.frames.length).toBe(b.frames.length);
    for (const [i, {state}] of a.frames.entries()) {
      expect(state.fighters[0].position.x + b.frames[i].state.fighters[1].position.x).toBe(unit * 9);
    }
  });
  it('serializes a stable replay, rejects edits, and caps every frequency at the same time', () => {
    for (const step of Object.values(rates)) {
      const playback = record(configure(9, step), state => state.tick ? [null,null] : [go,null]);
      expect(playback.frames.length).toBe(tickAt(matchTime / 3, step));
      expect(playback.recording.final.time).toBe(matchTime);
      expect(load(JSON.parse(JSON.stringify(playback.recording))).frames).toEqual(playback.frames);
      const tampered = {...playback.recording, final: {...playback.recording.final, result: 'sand'}};
      expect(() => load(tampered)).toThrow('integrity');
      expect(() => load({...playback.recording, events: [[1, [{kind:'defeat',side:0}]]]})).toThrow('integrity');
      expect(() => load({...playback.recording, transcript: [...playback.recording.transcript, playback.recording.transcript[0]]})).toThrow('transcript');
      expect(() => advance(configure(9,step),playback.recording.final,[null,null])).toThrow('already finished');
    }
  });
  it('repeats deterministic full matches and validates all prior rules versions', () => {
    const first = developmentMatch(5), second = developmentMatch(5);
    expect(first).toEqual(second);
    expect(validateReplay(historical).result).toBeTruthy();
    for (const replay of [old20, old21, old22]) expect(validate(replay).result).toBeTruthy();
  });
});
