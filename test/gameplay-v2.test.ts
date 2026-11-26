import {describe, expect, it} from 'vitest';
import {advance, configure, draw, initial, legal, observation, rules, type Intents, type State} from '../src/v2/game';
import {developmentMatch} from '../src/v2/development';
import {record, validate} from '../src/v2/replay';
import {clearSight, destinations, distance, HEIGHT, mirror, neighbors, walkable, WIDTH} from '../src/v2/yard';

const hold = {kind: 'hold'} as const;
const config = configure(12);
const tick = (state: State, ...intents: Intents) => advance(config, state, intents);
const at = (blue: number, sand: number) => {
  const state = initial();
  state.fighters[0].cell = blue;
  state.fighters[1].cell = sand;
  return state;
};

describe('Gameplay V2', () => {
  it('bounds destinations and crosses neither obstacles nor wrapped row edges', () => {
    expect(neighbors(8)).toEqual([7, 17]);
    expect([...destinations(28, 4).values()].every(path => path.length <= 4 && path.every(walkable))).toBe(true);
    expect(() => tick(initial(), {kind: 'move', mode: 'run', to: 22}, hold)).toThrow('Illegal');
    expect(() => tick(initial(), {kind: 'move', mode: 'walk', to: 34}, hold)).toThrow('Illegal');
    expect(() => tick(initial(), {kind: 'move', mode: 'run', to: 63}, hold)).toThrow('Illegal');
    expect(() => tick(initial(), {...hold, hp: 1000} as typeof hold, hold)).toThrow('Illegal');
  });

  it('resolves same-cell and occupied-cell collisions without side priority', () => {
    const move = {kind: 'move', mode: 'run', to: 31} as const;
    const contested = tick(at(30, 32), move, move);
    expect(contested.state.fighters.map(fighter => fighter.cell)).toEqual([30, 32]);
    expect(contested.events.filter(event => event.kind === 'collision')).toHaveLength(2);
    expect(tick(at(30, 31), move, hold).state.fighters[0].cell).toBe(30);
  });

  it('mirrors map geometry, sight, and shortest paths including tied paths', () => {
    for (let cell = 0; cell < WIDTH * HEIGHT; cell++) {
      expect(walkable(cell)).toBe(walkable(mirror(cell)));
      if (!walkable(cell)) continue;
      for (const [to, path] of destinations(cell, 4)) {
        expect(destinations(mirror(cell), 4, true).get(mirror(to))).toEqual(path.map(mirror));
        expect(clearSight(cell, to)).toBe(clearSight(mirror(cell), mirror(to)));
        expect(clearSight(cell, to)).toBe(clearSight(to, cell));
      }
    }
  });

  it('gives walk, run, crouch and jump distinct timing and blocks incompatible actions', () => {
    for (const [mode, interval] of [['walk', 2], ['run', 1], ['crouch', 3], ['jump', 2]] as const) {
      let current = tick(initial(), {kind: 'move', mode, to: 29}, hold);
      if (interval > 1) expect(() => tick(current.state, hold, hold)).toThrow('Illegal');
      for (let i = 1; i < interval; i++) current = tick(current.state, null, hold);
      expect(current.events).toContainEqual({kind: 'move', side: 0, from: 28, to: 29, mode});
      expect(current.state.fighters[0].posture).toBe(mode === 'crouch' ? 'crouch' : 'upright');
      expect(current.state.fighters[0].active).toBeNull();
    }
  });

  it('hides rival state and expires contact, with bounded observe and peek', () => {
    expect(clearSight(4, 31)).toBe(false);
    expect(observation(at(4, 31), 0).contact).toEqual({status: 'unknown'});
    expect(legal(at(4, 31), 0)).not.toContainEqual({kind: 'attack'});
    expect(observation(initial(), 0).contact).toEqual({status: 'unknown'});
    const observed = tick(at(28, 33), {kind: 'observe'}, hold);
    expect(observation(observed.state, 0).contact).toEqual({status: 'observed', cell: 33, tick: 1});
    let state = tick(initial(), {kind: 'peek'}, hold).state;
    expect(observation(state, 0).contact.status).toBe('unknown');
    state = tick(state, null, hold).state;
    expect(observation(state, 0).contact).toEqual({status: 'observed', cell: 34, tick: 2});
    state = tick(state, hold, hold).state;
    expect(observation(state, 0).contact.status).toBe('last seen');
    while (state.tick <= 2 + rules.contactAge) state = tick(state, hold, hold).state;
    expect(observation(state, 0).contact).toEqual({status: 'unknown'});
    expect(Object.keys(observation(state, 0))).not.toContain('fighters');
  });

  it('trades run visibility and short jump observation against ordinary walking', () => {
    const running = tick(initial(), {kind: 'move', mode: 'run', to: 29}, hold).state;
    expect(observation(running, 1).contact.status).toBe('visible');
    expect(legal(running, 1)).not.toContainEqual({kind: 'attack'});
    let walking = tick(initial(), {kind: 'move', mode: 'walk', to: 29}, hold).state;
    walking = tick(walking, null, hold).state;
    expect(observation(walking, 1).contact.status).toBe('unknown');
    let jumping = tick(initial(), {kind: 'move', mode: 'jump', to: 29}, hold).state;
    jumping = tick(jumping, null, hold).state;
    expect(observation(jumping, 0).contact.status).toBe('observed');
  });

  it('consumes ammo on start, resolves hits simultaneously, and reloads only on completion', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const start = at(30, 32);
      start.fighters[0].ammo = 1;
      const attack = {kind: 'attack'} as const;
      const first = advance(configure(seed), start, [attack, attack]);
      expect(first.state.fighters.map(fighter => fighter.ammo)).toEqual([0, 3]);
      expect(first.state.fighters.map(fighter => fighter.hp)).toEqual([100, 100]);
      const completed = advance(configure(seed), first.state, [null, null]);
      for (const event of completed.events) if (event.kind === 'attack') {
        seen.add(event.outcome);
        expect(completed.state.fighters[1 - event.side].hp).toBe(100 - event.damage);
      }
      expect(() => tick(completed.state, attack, hold)).toThrow('Illegal');
      let state = tick(completed.state, {kind: 'reload'}, hold).state;
      state = tick(state, null, hold).state;
      expect(state.fighters[0].ammo).toBe(0);
      expect(tick(state, null, hold).state.fighters[0].ammo).toBe(rules.ammo);
    }
    expect(seen).toEqual(new Set(['hit', 'miss', 'precision']));
  });

  it('allows damage during a jump and clamps simultaneous lethal damage', () => {
    const seed = Array.from({length: 100}, (_, i) => i).find(i => draw(i, 2, 0) < 68 && draw(i, 2, 1) < 68)!;
    const attack = {kind: 'attack'} as const;
    const start = at(30, 32);
    let state = advance(configure(seed), start, [attack, {kind: 'move', mode: 'jump', to: 33}]).state;
    state = advance(configure(seed), state, [null, null]).state;
    expect(state.fighters[1].hp).toBeLessThan(100);
    expect(state.fighters[1].cell).toBe(33);
    start.fighters.forEach(fighter => fighter.hp = 1);
    state = advance(configure(seed), start, [attack, attack]).state;
    state = advance(configure(seed), state, [null, null]).state;
    expect(state.fighters.map(fighter => fighter.hp)).toEqual([0, 0]);
    expect(state.result).toBe('draw');
    expect(() => advance(configure(seed), state, [hold, hold])).toThrow('finished');
  });

  it('spends the attack even when the rival moves out of range before completion', () => {
    const seed = Array.from({length: 100}, (_, i) => i).find(i => draw(i, 2, 0) < rules.farPrecision)!;
    const config = configure(seed);
    const first = advance(config, at(28, 32), [{kind: 'attack'}, {kind: 'move', mode: 'run', to: 33}]);
    const final = advance(config, first.state, [null, hold]);
    expect(final.events).toContainEqual({kind: 'attack', side: 0, outcome: 'miss', damage: 0});
    expect(final.state.fighters.map(fighter => fighter.hp)).toEqual([100, 100]);
    expect(final.state.fighters[0].ammo).toBe(3);
  });

  it('bounds inactivity and validates tamper-resistant complete timelines', () => {
    const replay = record(config, () => [hold, hold]);
    expect(replay.timeline).toHaveLength(rules.ticks);
    expect(replay.result).toBe('draw');
    const fixture = developmentMatch(12);
    expect(developmentMatch(12)).toEqual(fixture);
    expect(validate(JSON.parse(JSON.stringify(fixture)))).toEqual(fixture);
    expect(() => validate({...fixture, config: {...fixture.config, seed: 0x100000000}})).toThrow('V2 configuration');
    expect(() => validate({...fixture, timeline: fixture.timeline.slice(0, -1)})).toThrow('result');
    fixture.timeline[0].state.fighters[0].hp++;
    expect(() => validate(fixture)).toThrow('timeline');
  });

  it('keeps complete matches in bounds across matched seeds and side-swapped policies', () => {
    for (let seed = 0; seed < 40; seed++) for (const swapped of [false, true]) {
      const replay = validate(developmentMatch(seed, swapped ? ['roam', 'seek'] : ['seek', 'roam']));
      for (const frame of replay.timeline) {
        const [blue, sand] = frame.state.fighters;
        expect(blue.cell).not.toBe(sand.cell);
        for (const fighter of frame.state.fighters) {
          expect(walkable(fighter.cell)).toBe(true);
          expect(fighter.hp).toBeGreaterThanOrEqual(0);
          expect(fighter.ammo).toBeGreaterThanOrEqual(0);
          expect(fighter.ammo).toBeLessThanOrEqual(rules.ammo);
        }
        for (const event of frame.events) if (event.kind === 'move') expect(distance(event.from, event.to)).toBe(1);
      }
    }
  });
});
