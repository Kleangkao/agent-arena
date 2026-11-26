import {expect, it} from 'vitest';
import {plannerInput, playV2} from '../server/gameplay-v2';
import {configure, initial, realtime, revision, rules} from '../src/v2/game';
import type {Attempt} from '../server/match';

const coach = {revision: 'test-coach', text: 'Explore the arcade map.'};
const liveSignal = () => new AbortController().signal;

it('retains a sparse V2.2 plan boundary without adding fallback strategies', async () => {
  const attempts: Attempt[] = [];
  const result = await playV2(configure(3, realtime), [coach, coach], async input => {
    expect(input.observation.rulesVersion).toBe(realtime);
    return {text: '{"actions":[0]}'};
  }, liveSignal(), attempts);
  expect(result.timeline).toHaveLength(176);
  expect(result.requests).toBe(18);
  expect(attempts.every(attempt => attempt.step % 20 === 0)).toBe(true);
  expect(result.timeline.flatMap(frame => frame.intents).filter(Boolean)).toEqual(
    Array.from({length:18}, () => ({kind:'hold'})));
});

it('bounds V2.1 to nine five-tick windows and supplies only selected intents or explicit idle', async () => {
  const attempts: Attempt[] = [];
  const result = await playV2(configure(3, revision), [coach, coach], async input => {
    expect(input.observation.rulesVersion).toBe(revision);
    expect(input.rules.precision).toContain('less reliable');
    return {text: '{"actions":[0]}'};
  }, liveSignal(), attempts);
  expect(result.requests).toBe(18);
  expect(attempts.every(attempt => attempt.status === 'ok' && attempt.step % 5 === 0)).toBe(true);
  expect(result.timeline).toHaveLength(44);
  expect(result.timeline.every(frame => frame.intents.every(intent => intent?.kind === 'hold'))).toBe(true);
  expect(result.idleWithoutChoice).toBe(70);
});

it('passes only side-specific observations and compatible memory to a strategic planner', () => {
  const state = initial();
  const matching = {rulesVersion: rules.version, revision: 2, lessons: ['Observe before choosing a destination.']};
  const input = plannerInput(state, 0, {...coach, memory: matching});
  expect(input.coaching).toEqual(coach);
  expect(input.memory).toEqual({revision: 2, lessons: matching.lessons});
  expect(input.observation.contact).toEqual({status: 'unknown'});
  expect(JSON.stringify(input)).not.toContain('"fighters"');
  expect(plannerInput(state, 0, {...coach, memory: {...matching, rulesVersion: 'lane-v1'}}).memory).toBeNull();
});

it('executes validated indexed decisions at bounded checkpoints using an injected test provider', async () => {
  const attempts: Attempt[] = [];
  const result = await playV2(configure(3), [coach, coach], async input => {
    const actions = input.observation.actions;
    const index = actions.findIndex(action => action.kind === 'move' && action.mode === 'run');
    return {text: JSON.stringify({actions: [index, 0]}), model: 'test-provider'};
  }, liveSignal(), attempts);
  expect(result.requests).toBeLessThanOrEqual(18);
  expect(attempts).toHaveLength(result.requests);
  expect(attempts.every(attempt => attempt.status === 'ok' && attempt.step % 4 === 0)).toBe(true);
  expect(attempts[0].step).toBe(attempts[1].step);
  expect(result.timeline[0].intents.every(intent => intent?.kind === 'move')).toBe(true);
  expect(result.timeline).toHaveLength(rules.ticks);
  expect(result.result).toBe('draw');
});

it('labels invalid choices and interrupts after one retry without substituting a development policy', async () => {
  const attempts: Attempt[] = [];
  await expect(playV2(configure(3), [coach, coach], async () => ({text: '{"actions":[999]}'}),
    liveSignal(), attempts)).rejects.toThrow('interrupted');
  expect(attempts.map(attempt => attempt.status)).toEqual(['invalid', 'invalid', 'invalid', 'invalid']);
});

it('treats provider quota errors as unretryable', async () => {
  const attempts: Attempt[] = [];
  await expect(playV2(configure(3), [coach, coach], async () => { throw Object.assign(new Error('provider'), {status: 429}); },
    liveSignal(), attempts)).rejects.toThrow('interrupted');
  expect(attempts).toHaveLength(2);
  expect(attempts.every(attempt => attempt.status === '429' && attempt.attempt === 1)).toBe(true);
});
