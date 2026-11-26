import {mkdirSync, writeFileSync} from 'node:fs';
import {developmentMatch} from '../src/v2/development.js';
import {initial, rules} from '../src/v2/game.js';
import {validate} from '../src/v2/replay.js';
import {mirror} from '../src/v2/yard.js';

const out = 'evidence/gameplay-v2';
mkdirSync(out, {recursive: true});
const aggregate = {
  matches: 0, results: {blue: 0, sand: 0, draw: 0}, resultsByAssignment: [{blue: 0, sand: 0, draw: 0}, {blue: 0, sand: 0, draw: 0}],
  ticks: {min: rules.ticks as number, max: 0, total: 0}, actions: {} as Record<string, number>,
  outcomes: {miss: 0, hit: 0, precision: 0}, movements: 0, contacts: 0, collisions: 0, roundsWithoutMovement: 0,
  timeoutFinishes: 0, invalidIntents: 0, terminationFailures: 0, longestNoMovementTicks: 0,
};
const destinations = new Set<number>();
let showcase: ReturnType<typeof developmentMatch> | undefined;
for (let seed = 0; seed < 80; seed++) for (const swapped of [false, true]) {
  const replay = developmentMatch(seed, swapped ? ['roam', 'seek'] : ['seek', 'roam']);
  validate(JSON.parse(JSON.stringify(replay)));
  const length = replay.timeline.length;
  aggregate.matches++;
  aggregate.results[replay.result]++;
  aggregate.resultsByAssignment[Number(swapped)][replay.result]++;
  aggregate.ticks.min = Math.min(length, aggregate.ticks.min);
  aggregate.ticks.max = Math.max(length, aggregate.ticks.max);
  aggregate.ticks.total += length;
  if (length === rules.ticks) aggregate.timeoutFinishes++;
  let hasMove = false;
  let inactive = 0;
  for (const {events} of replay.timeline) {
    inactive = events.some(event => event.kind === 'move') ? 0 : inactive + 1;
    aggregate.longestNoMovementTicks = Math.max(aggregate.longestNoMovementTicks, inactive);
  }
  for (const {events} of replay.timeline) for (const event of events) {
    if (event.kind === 'start') {
      const key = event.intent.kind === 'move' ? event.intent.mode : event.intent.kind;
      aggregate.actions[key] = (aggregate.actions[key] ?? 0) + 1;
      if (event.intent.kind === 'move') destinations.add(event.intent.to);
    }
    if (event.kind === 'move') { aggregate.movements++; hasMove = true; }
    if (event.kind === 'collision') aggregate.collisions++;
    if (event.kind === 'contact') aggregate.contacts++;
    if (event.kind === 'attack') aggregate.outcomes[event.outcome]++;
  }
  if (!hasMove) aggregate.roundsWithoutMovement++;
  if (seed === 7) writeFileSync(`${out}/seed-7${swapped ? '-swapped' : ''}.json`, JSON.stringify(replay, null, 2));
  if (!showcase && length < rules.ticks && replay.timeline.some(frame => frame.events.some(event =>
    event.kind === 'attack' && event.outcome === 'precision'))) showcase = replay;
}
if (!showcase) throw Error('No representative early-finish precision match');
writeFileSync(out + '/showcase.json', JSON.stringify(showcase, null, 2));
const sameProfile = (['seek', 'roam'] as const).map(profile => {
  const matches = 500;
  const results = {blue: 0, sand: 0, draw: 0};
  const outcomesBySide = [{miss: 0, hit: 0, precision: 0}, {miss: 0, hit: 0, precision: 0}];
  let frames = 0;
  let nonMirrored = 0;
  for (let seed = 0; seed < matches; seed++) {
    const replay = validate(developmentMatch(seed, [profile, profile]));
    results[replay.result]++;
    for (const frame of replay.timeline) {
      frames++;
      const [blue, sand] = frame.state.fighters;
      if (mirror(blue.cell) !== sand.cell || blue.ammo !== sand.ammo) nonMirrored++;
      for (const event of frame.events) if (event.kind === 'attack') outcomesBySide[event.side][event.outcome]++;
    }
  }
  return {profile, matches, results, frames, nonMirrored, outcomesBySide};
});
const metrics = {source: 'Development Test Policies — Not Gemini Gameplay', starting: initial(), ...aggregate,
  distinctDestinations: destinations.size, meanTicks: aggregate.ticks.total / aggregate.matches,
  sameProfile,
  showcase: {seed: showcase.config.seed, ticks: showcase.timeline.length, result: showcase.result}};
writeFileSync(out + '/balance.json', JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics));
