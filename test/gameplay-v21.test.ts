import {expect, it} from 'vitest';
import {advance, arcadeAttack, configure, initial, legal, revision, rollFor} from '../src/v2/game';
import {developmentMatch} from '../src/v2/development';
import {validate} from '../src/v2/replay';
import historical from '../evidence/gameplay-v2/showcase.json';

it('reloads during an ongoing walk without cancelling its scheduled step', () => {
  const config = configure(3, 'arcade-v2.1');
  const hold = {kind: 'hold'} as const;
  const state = initial();
  state.fighters[0].ammo = 1;
  const walk = advance(config, state, [{kind: 'move', mode: 'walk', to: 30}, hold]).state;
  expect(legal(walk, 0, config.rulesVersion)).toContainEqual({kind: 'reload'});
  const reload = advance(config, walk, [{kind: 'reload'}, hold]);
  expect(reload.state.fighters[0].cell).toBe(29);
  expect(reload.state.fighters[0].ammo).toBe(1);
  const next = advance(config, reload.state, [null, hold]).state;
  const complete = advance(config, next, [null, hold]);
  expect(complete.state.fighters[0]).toMatchObject({cell: 30, ammo: 4, active: null});
});

it('offers a standard shot during a walk, reserving precision for stationary decisions', () => {
  const config = configure(3, revision);
  const hold = {kind: 'hold'} as const;
  const state = initial();
  state.fighters[1].cell = 32;
  const walk = advance(config, state, [{kind: 'move', mode: 'walk', to: 30}, hold]).state;
  expect(legal(walk, 0, revision)).toEqual([{kind: 'attack'}]);
  const firing = advance(config, walk, [{kind: 'attack'}, hold]).state;
  expect(firing.fighters[0]).toMatchObject({cell: 29, ammo: 3, shotDue: 3});
  expect(legal(firing, 0, revision)).toEqual([]);
  const hit = advance(config, firing, [null, hold]);
  expect(hit.events).toContainEqual(expect.objectContaining({kind: 'attack', side: 0}));
  expect(hit.state.fighters[0].shotDue).toBeUndefined();
});

it('allows a pair of non-conflicting moves through a vacated tile and rejects swaps', () => {
  const state = initial();
  state.fighters[0].cell = 29;
  state.fighters[1].cell = 30;
  const runTo = (to: number) => ({kind: 'move', mode: 'run', to} as const);
  const config = configure(1, revision);
  expect(advance(config, state, [runTo(30), runTo(31)]).state.fighters.map(fighter => fighter.cell)).toEqual([30, 31]);
  const swap = advance(config, state, [runTo(30), runTo(29)]);
  expect(swap.state.fighters.map(fighter => fighter.cell)).toEqual([29, 30]);
  expect(swap.events.filter(event => event.kind === 'collision')).toHaveLength(2);
});

it('maps explicit precision to either 34 damage or a miss, with mirrored random samples', () => {
  const state = initial();
  state.fighters[0].cell = 30;
  state.fighters[1].cell = 32;
  const hold = {kind: 'hold'} as const;
  const outcomes = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const config = configure(seed, revision);
    const roll = rollFor(config, 2, 0);
    expect(roll).toBe(rollFor(configure(seed + 0x80000000, revision), 2, 1));
    const started = advance(config, state, [{kind: 'precision'}, hold]).state;
    const result = advance(config, started, [null, hold]);
    const shot = result.events.find(event => event.kind === 'attack');
    expect(shot).toMatchObject(roll < arcadeAttack.precision.near ? {outcome: 'precision', damage: 34} : {outcome: 'miss', damage: 0});
    outcomes.add(shot!.outcome);
  }
  expect(outcomes).toEqual(new Set(['precision', 'miss']));
});

it('retains the historical V2 replay and breaks the seed-3 stationary segment in V2.1', () => {
  expect(validate(historical).timeline.at(-1)?.state.fighters.map(fighter => fighter.hp)).toEqual([10, 0]);
  const oldSegment = historical.timeline.slice(14).flatMap(frame => frame.events);
  expect(oldSegment.filter(event => event.kind === 'move')).toHaveLength(0);
  const updated = validate(developmentMatch(3, undefined, revision));
  expect(updated.timeline.slice(14).flatMap(frame => frame.events).filter(event => event.kind === 'move').length).toBeGreaterThan(0);
});
