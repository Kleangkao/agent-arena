import {mkdirSync, writeFileSync} from 'node:fs';
import {developmentMatch} from '../src/v2/development.js';
import {revision, rules, type RulesVersion} from '../src/v2/game.js';
import {validate, type Replay} from '../src/v2/replay.js';
import {mirror} from '../src/v2/yard.js';

const path = 'evidence/gameplay-v21';
mkdirSync(path, {recursive: true});
const results = () => ({blue: 0, sand: 0, draw: 0});
const count = (object: Record<string, number>, key: string | number) => {
  object[key] = (object[key] ?? 0) + 1;
};
const swaps = [['seek', 'roam'], ['roam', 'seek']] as const;
const fixtures: Record<string, Replay> = {};
function evaluate(version: RulesVersion, adapted: boolean) {
  const stats = {wins: results(), clock: 0, ticks: {}, actions: {}, outcomes: {}, intentOutcomes: {}, contacts: 0,
    moves: 0, collisions: 0, overlapTicks: 0, idleAgentTicks: 0, emptyAgentTicks: 0,
    repeatedDecisions: 0, longestStationary: 0, stationaryTicks: 0, stationaryOver10: 0,
    tickSum: 0, invalid: 0, failures: 0, firstVisibleTickSum: 0, firstVisibleMatches: 0, firstShotTickSum: 0, noShotMatches: 0};
  const destinations = new Set<number>();
  for (let seed = 0; seed < 80; seed++) for (const roles of swaps) {
    let replay: Replay;
    try {
      replay = validate(developmentMatch(seed, [...roles], version, adapted));
    } catch (error) {
      if (error instanceof Error && error.message === 'Illegal V2 intent') stats.invalid++;
      else stats.failures++;
      continue;
    }
    const last = replay.timeline.at(-1)!.state;
    stats.wins[replay.result]++;
    count(stats.ticks, last.tick);
    stats.tickSum += last.tick;
    if (last.fighters.every(fighter => fighter.hp > 0)) stats.clock++;
    const first = replay.timeline.find(frame => frame.events.some(event => event.kind === 'contact' && event.visibility === 'visible'));
    if (first) {stats.firstVisibleTickSum += first.state.tick; stats.firstVisibleMatches++;}
    const shot = replay.timeline.find(frame => frame.events.some(event => event.kind === 'attack'));
    if (shot) stats.firstShotTickSum += shot.state.tick;
    else stats.noShotMatches++;
    let stationary = 0, matchLongestStationary = 0;
    const previous = ['', ''];
    const firing = ['attack', 'attack'];
    for (const frame of replay.timeline) {
      const moved = frame.events.some(event => event.kind === 'move');
      stationary = moved ? 0 : stationary + 1;
      if (!moved) stats.stationaryTicks++;
      matchLongestStationary = Math.max(matchLongestStationary, stationary);
      stats.longestStationary = Math.max(stats.longestStationary, stationary);
      for (const fighter of frame.state.fighters) {
        if (!fighter.ammo) stats.emptyAgentTicks++;
        if (fighter.active?.kind === 'move' && fighter.reloadDue) stats.overlapTicks++;
      }
      for (const event of frame.events) {
        if (event.kind === 'start') {
          const kind = event.intent.kind === 'move' ? event.intent.mode : event.intent.kind;
          count(stats.actions, kind);
          if (event.intent.kind === 'move') destinations.add(event.intent.to);
          if (event.intent.kind === 'hold') stats.idleAgentTicks++;
          if (kind === previous[event.side]) stats.repeatedDecisions++;
          previous[event.side] = kind;
          if (kind === 'attack' || kind === 'precision') firing[event.side] = kind;
        }
        if (event.kind === 'collision') stats.collisions++;
        if (event.kind === 'move') stats.moves++;
        if (event.kind === 'contact') stats.contacts++;
        if (event.kind === 'attack') {
          count(stats.outcomes, event.outcome);
          count(stats.intentOutcomes, firing[event.side] + '/' + event.outcome);
        }
      }
    }
    if (matchLongestStationary > 10) stats.stationaryOver10++;
    if (version === revision && adapted) {
      if (seed === 3 && roles[0] === 'seek') fixtures.ordinary = replay;
      if (replay.result === 'draw' && !fixtures.draw) fixtures.draw = replay;
      if (last.tick < 25 && !fixtures.unusual &&
          replay.timeline.flatMap(f => f.events).filter(event => event.kind === 'attack' && event.outcome === 'precision').length >= 2) fixtures.unusual = replay;
    }
  }
  return {...stats, distinctDestinations: destinations.size};
}
const baseline = evaluate(rules.version, false);
const policyOnly = evaluate(rules.version, true);
const mechanicsOnly = evaluate(revision, false);
const updated = evaluate(revision, true);
const flip = (seed: number) => (seed ^ 0x80000000) >>> 0;
const swapResult = (result: Replay['result']) => result === 'blue' ? 'sand' : result === 'sand' ? 'blue' : result;
function assertMirrored(a: Replay, b: Replay) {
  if (a.result !== swapResult(b.result) || a.timeline.length !== b.timeline.length) throw Error('Paired result mismatch');
  for (const [i, frame] of a.timeline.entries()) for (const side of [0, 1]) {
    const fighter = frame.state.fighters[side], rival = b.timeline[i].state.fighters[1 - side];
    if (mirror(fighter.cell) !== rival.cell || fighter.hp !== rival.hp || fighter.ammo !== rival.ammo) throw Error('Paired state mismatch');
  }
}
const pairedMixed = results();
for (let seed = 0; seed < 80; seed++) {
  const a = developmentMatch(seed, ['seek','roam'], revision);
  const b = developmentMatch(flip(seed), ['roam','seek'], revision);
  assertMirrored(a, b);
  pairedMixed[a.result]++;
}
const fairness = (['seek', 'roam'] as const).map(profile => {
  const original = results(), flipped = results();
  for (let seed = 0; seed < 500; seed++) {
    const a = developmentMatch(seed, [profile, profile], revision);
    const b = developmentMatch(flip(seed), [profile, profile], revision);
    original[a.result]++;
    flipped[b.result]++;
    assertMirrored(a, b);
  }
  return {profile, original, flipped};
});
const summary = {source: 'Deterministic development policies', seeds: '0–79 mixed, 0–499 paired identical', baseline, policyOnly,
  mechanicsOnly, updated, fairness, pairedMixed, fixtures: Object.fromEntries(Object.entries(fixtures).map(([label, replay]) => [label, {
    seed: replay.config.seed, result: replay.result, tick: replay.timeline.length, hp: replay.timeline.at(-1)!.state.fighters.map(fighter => fighter.hp),
  }]))};
for (const [label, replay] of Object.entries(fixtures)) writeFileSync(path + '/' + label + '.json', JSON.stringify(replay, null, 2));
writeFileSync(path + '/balance.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
if ([baseline, policyOnly, mechanicsOnly, updated].some(stats => stats.invalid || stats.failures)) process.exitCode = 1;
