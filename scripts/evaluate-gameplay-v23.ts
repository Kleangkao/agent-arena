import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {developmentMatch as tiled} from '../src/v2/development.js';
import {realtime} from '../src/v2/game.js';
import {validate} from '../src/v2/replay.js';
import {developmentMatch, type Profile} from '../src/v23/development.js';
import {load, record} from '../src/v23/replay.js';
import {configure, initial, rates, type Config} from '../src/v23/game.js';
import {agentsCollide, equal, openSegment, unit} from '../src/v23/space.js';
import {WIDTH} from '../src/v2/yard.js';

const out = 'evidence/gameplay-v23';
mkdirSync(out, {recursive:true});
const players = [['seek','roam'], ['roam','seek']] as const;
const samples = (operation: () => void, n: number) => {
  const start = performance.now();
  for (let i = 0; i < n; i++) operation();
  return Math.round((performance.now() - start) * 100) / 100;
};
function measure(step?: Config['step']) {
  const m = {wins: {blue:0,sand:0,draw:0}, clock:0, timeMs:0, idleMs:0, overlapMs:0, agentMs:0,
    moveModeMs:{walk:0,run:0,crouch:0,jump:0}, maxStationaryMs:0, collisions:{terrain:0,agent:0}, events:0,
    attack:{hits:0,misses:0,precision:0}, replayBytes:0, materializedBytes:0, simulateMs:0, loadMs:0, retainedBatchHeapDeltaBytes:0};
  global.gc?.();
  const heap = process.memoryUsage().heapUsed, held = [];
  for (let seed = 0; seed < 80; seed++) for (const profile of players) {
    let stationary = 0;
    const events = (event: {kind:string; outcome?:string; with?:'terrain'|'agent'}) => {
      m.events++;
      if (event.kind === 'collision') m.collisions[event.with ?? 'agent']++;
      if (event.kind === 'attack') m.attack[event.outcome === 'miss' ? 'misses' : event.outcome === 'precision' ? 'precision' : 'hits']++;
    };
    const activity = (ms: number, moving: string | undefined, active: boolean) => {
      m.agentMs += ms;
      if (moving) {
        m.moveModeMs[moving as keyof typeof m.moveModeMs] += ms;
        if (active) m.overlapMs += ms;
      } else if (!active) m.idleMs += ms;
    };
    const amount = (ms: number, moved: boolean) => {
      m.timeMs += ms;
      stationary = moved ? 0 : stationary + ms;
      m.maxStationaryMs = Math.max(stationary, m.maxStationaryMs);
    };
    if (step) {
      const start = performance.now(), playback = developmentMatch(seed, profile, step);
      m.simulateMs += performance.now() - start;
      const serialized = JSON.stringify(playback.recording);
      const startLoad = performance.now(), checked = load(JSON.parse(serialized));
      m.loadMs += performance.now() - startLoad;
      assert.deepEqual(checked.recording.final, playback.recording.final);
      const {fighters, result} = checked.recording.final;
      if (fighters.every(f => f.hp)) m.clock++;
      m.wins[result!]++;
      m.replayBytes += Buffer.byteLength(serialized);
      m.materializedBytes += Buffer.byteLength(JSON.stringify(checked.frames));
      held.push(checked);
      let before = initial();
      for (const frame of checked.frames) {
        const ms = (frame.state.time - (frame.state.tick === 1 ? 0 : before.time)) / 3;
        const positions = frame.state.fighters.map(f => f.position);
        assert(!agentsCollide(...[positions[0],positions[0],positions[1],positions[1]] as const));
        assert(frame.state.fighters.every(f => f.hp >= 0 && f.hp <= 100 && f.ammo >= 0 && f.ammo <= 4));
        assert(positions.every((p, side) => openSegment(before.fighters[side].position, p)));
        amount(ms, positions.some((p, side) => !equal(p,before.fighters[side].position)));
        for (const f of frame.state.fighters) activity(ms, f.motion?.mode, !!(f.firing || f.reloadDue || f.survey));
        frame.events.forEach(events);
        before = frame.state;
      }
    } else {
      const start = performance.now(), replay = tiled(seed, [...profile], realtime);
      m.simulateMs += performance.now() - start;
      const serialized = JSON.stringify(replay);
      const startLoad = performance.now(), checked = validate(JSON.parse(serialized));
      m.loadMs += performance.now() - startLoad;
      m.wins[checked.result]++;
      if (checked.timeline.at(-1)!.state.fighters.every(f => f.hp)) m.clock++;
      m.replayBytes += Buffer.byteLength(serialized);
      m.materializedBytes += Buffer.byteLength(JSON.stringify(checked.timeline));
      held.push(checked);
      for (const {events: frameEvents,state} of checked.timeline) {
        amount(110,frameEvents.some(event => event.kind === 'move'));
        for (const f of state.fighters) activity(110,f.motion?.mode,!!(f.firing || f.reloadDue || f.survey));
        frameEvents.forEach(events);
      }
    }
  }
  global.gc?.();
  m.retainedBatchHeapDeltaBytes = process.memoryUsage().heapUsed - heap;
  assert.equal(held.length,160);
  return Object.fromEntries(Object.entries(m).map(([key,value]) => [key,typeof value === 'number' ? Math.round(value * 100) / 100 : value]));
}
const configurations = {tiled110: measure(), continuous110:measure(rates.baseline),
  continuous30Hz:measure(rates['30hz']), continuous60Hz:measure(rates['60hz'])};
const mirrored: Record<string,number> = {};
const motionChecks: Record<string,unknown> = {};
for (const [name, step] of Object.entries(rates)) {
  let pairs = 0;
  for (let seed = 0; seed < 16; seed++) for (const assignment of [...players,['seek','seek'],['roam','roam']] as readonly (readonly [Profile,Profile])[]) {
    const a = developmentMatch(seed,assignment,step), b = developmentMatch((seed ^ 0x80000000) >>> 0,[assignment[1],assignment[0]],step);
    assert.equal(a.frames.length,b.frames.length);
    assert.equal(a.recording.final.result,b.recording.final.result === 'draw' ? 'draw' : b.recording.final.result === 'blue' ? 'sand' : 'blue');
    for (const [i,{state}] of a.frames.entries()) for (const side of [0,1]) {
      const x = state.fighters[side], y = b.frames[i].state.fighters[1-side];
      assert.equal(x.position.x + y.position.x,WIDTH * unit, JSON.stringify({name,seed,assignment,i,side,a:a.frames[i-1]?.state,b:b.frames[i-1]?.state}));
      assert.deepEqual([x.position.y,x.hp,x.ammo,x.posture],[y.position.y,y.hp,y.ammo,y.posture]);
    }
    pairs++;
  }
  mirrored[name] = pairs;
  const probe = () => record(configure(0,step), state => state.tick === 0 ? [{kind:'steer',mode:'walk',dx:1,dy:0},null]
    : state.tick === 1 ? [{kind:'stop'},null] : [null,null]);
  const first = probe();
  motionChecks[name] = {firstDelta: first.frames[0].state.fighters[0].position.x - 1.5 * unit,
    stopHeld:equal(first.frames[0].state.fighters[0].position,first.frames.at(-1)!.state.fighters[0].position),
    tenHeadlessPassesMs:samples(() => {load(probe().recording);},10)};
}
const result = {matchesPerConfig:160, seedRange:'0–79, two profile assignments', configurations, mirrored, motionChecks,
  environment:{node:process.version, gcAvailable:!!global.gc}, pilot:developmentMatch(12).recording.final};
writeFileSync(out+'/benchmark.json',JSON.stringify(result,null,2)+'\n');
writeFileSync(out+'/autonomous.json',JSON.stringify(developmentMatch(12).recording)+'\n');
console.log(JSON.stringify(result));
