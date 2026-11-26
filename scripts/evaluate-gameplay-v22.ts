import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {developmentMatch} from '../src/v2/development.js';
import {realtime, realtimeRules, revision, stepMsFor, type RulesVersion} from '../src/v2/game.js';
import {validate, type Replay} from '../src/v2/replay.js';
import {distance, mirror, walkable} from '../src/v2/yard.js';

const out = 'evidence/gameplay-v22';
mkdirSync(out, {recursive: true});
const assignments = [['seek', 'roam'], ['roam', 'seek']] as const;
let sample: Replay | undefined;
function measure(version: RulesVersion) {
  const totals = {wins: {blue: 0, sand: 0, draw: 0}, matches: 0, clock: 0, moves: 0, collisions: 0, redirects: 0, stops: 0,
    movingActionAgentTicks: 0, idleAgentTicks: 0, emptyAmmoAgentTicks: 0, totalAgentTicks: 0, costMs: 0,
    longestStationaryMs: 0, firstAttackSumMs: 0, noAttack: 0, invalid: 0, timing: {} as Record<number, number>,
    moveModes: {walk: 0, run: 0, jump: 0, crouch: 0}, outcomes: {miss: 0, hit: 0, precision: 0}};
  const start = performance.now();
  for (let seed = 0; seed < 80; seed++) for (const players of assignments) {
    let replay: Replay;
    try { replay = validate(JSON.parse(JSON.stringify(developmentMatch(seed, [...players], version)))); }
    catch {totals.invalid++; continue;}
    const duration = replay.timeline.length * stepMsFor(version);
    totals.matches++;
    totals.wins[replay.result]++;
    totals.timing[duration] = (totals.timing[duration] ?? 0) + 1;
    if (replay.timeline.at(-1)!.state.fighters.every(fighter => fighter.hp)) totals.clock++;
    const first = replay.timeline.find(frame => frame.events.some(event => event.kind === 'attack'));
    if (!first) totals.noAttack++;
    else totals.firstAttackSumMs += first.state.tick * stepMsFor(version);
    let stationary = 0, overlap = 0, precision = 0;
    for (const frame of replay.timeline) {
      if (frame.state.fighters[0].cell === frame.state.fighters[1].cell) throw Error('Agents share a tile');
      if (frame.events.some(event => event.kind === 'move')) stationary = 0;
      else stationary += stepMsFor(version);
      totals.longestStationaryMs = Math.max(totals.longestStationaryMs, stationary);
      for (const fighter of frame.state.fighters) {
        if (!walkable(fighter.cell) || fighter.ammo < 0 || fighter.ammo > 4 || fighter.hp < 0 || fighter.hp > 100) throw Error('State out of bounds');
        totals.totalAgentTicks++;
        const moving = fighter.motion || fighter.active?.kind === 'move';
        const action = fighter.firing || fighter.shotDue || fighter.survey || fighter.reloadDue;
        if (moving && action) {totals.movingActionAgentTicks++; overlap++;}
        if (!moving && !action && !fighter.active && !frame.state.result) totals.idleAgentTicks++;
        if (!fighter.ammo) totals.emptyAmmoAgentTicks++;
      }
      for (const event of frame.events) {
        if (event.kind === 'move') {
          if (distance(event.from, event.to) !== 1) throw Error('Nonadjacent move');
          totals.moves++; totals.moveModes[event.mode]++;
        }
        if (event.kind === 'collision') totals.collisions++;
        if (event.kind === 'interrupt') event.reason === 'redirect' ? totals.redirects++ : totals.stops++;
        if (event.kind === 'attack') {
          totals.outcomes[event.outcome]++;
          if (event.outcome === 'precision') precision++;
        }
      }
    }
    if (!sample && version === realtime && overlap >= 12 && precision > 0) sample = replay;
  }
  totals.costMs = Math.round(performance.now() - start);
  return totals;
}
const previous = JSON.parse(readFileSync('evidence/gameplay-v21/balance.json', 'utf8')).updated;
const baseline = measure(revision), updated = measure(realtime);
if (baseline.moves !== previous.moves || baseline.clock !== previous.clock) throw Error('V2.1 baseline changed');
let pairs = 0;
for (let seed = 0; seed < 80; seed++) for (const players of [...assignments, ['seek', 'seek'], ['roam', 'roam']] as const) {
  const [blue, sand] = players;
  const a = developmentMatch(seed, [blue, sand], realtime);
  const b = developmentMatch((seed ^ 0x80000000) >>> 0, [sand, blue], realtime);
  if (a.timeline.length !== b.timeline.length || a.result !== (b.result === 'blue' ? 'sand' : b.result === 'sand' ? 'blue' : 'draw')) throw Error('Mirror result differs');
  for (const [i, frame] of a.timeline.entries()) for (const side of [0, 1]) {
    const x = frame.state.fighters[side], y = b.timeline[i].state.fighters[1 - side];
    if (mirror(x.cell) !== y.cell || x.hp !== y.hp || x.ammo !== y.ammo || x.posture !== y.posture) throw Error('Mirror state differs');
  }
  pairs++;
}
if (!sample) throw Error('No overlapping-action precision replay found');
const fixture = {seed: sample.config.seed, tick: sample.timeline.length, result: sample.result,
  health: sample.timeline.at(-1)!.state.fighters.map(fighter => fighter.hp)};
const summary = {source: 'Deterministic development policies', seeds: '0–79, two assignments', baseline, updated, pairs, fixture,
  realtimeStepMs: realtimeRules.stepMs};
writeFileSync(out + '/autonomous.json', JSON.stringify(sample, null, 2));
writeFileSync(out + '/balance.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
if (baseline.invalid || updated.invalid) process.exitCode = 1;
