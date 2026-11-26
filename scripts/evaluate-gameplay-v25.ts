import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {developmentMatch as historical} from '../src/v24/development.js';
import {configure as oldConfig} from '../src/v24/objective.js';
import {developmentMatch} from '../src/v25/development.js';
import {canonical, configure, defaultVariant, variants, type Variant} from '../src/v25/game.js';
import {load, record, type Playback} from '../src/v25/replay.js';
import {WIDTH} from '../src/v2/yard.js';
import {agentsCollide, openSegment, unit} from '../src/v23/space.js';

const dir = 'evidence/gameplay-v25';
const profiles = [['seek','roam'],['roam','seek']] as const;
const factions = [0,1] as const;
const histogram = () => ({} as Record<string,number>);
const increment = (table:Record<string,number>, key:string|number) => {table[key] = (table[key] ?? 0) + 1;};
const group = () => ({matches:0,replays:0,reasons:histogram(),duration:[] as number[],role:histogram(),side:histogram(),pairs:histogram(),
  profiles:histogram(),factionRole:histogram(),series:histogram(),scores:histogram(),margin:histogram(),events:histogram(),
  attacks:histogram(),inputs:histogram(),moved:0,idle:0,agentTicks:0,peakProgress:0,scoreContext:histogram(),noAttack:0,marginChanges:0});
type Group = ReturnType<typeof group>;
const save = (name:string,playback:Playback) => writeFileSync(dir+'/'+name+'.json',JSON.stringify(playback.recording));
const fixtures: Record<string,boolean> = {};
function fixture(name:string,playback:Playback) {if (!fixtures[name]) {save(name,playback); fixtures[name] = true;}}
function observe(group:Group, playback:Playback, profile?:string) {
  const {recording,frames} = playback, {config,final} = recording;
  assert.equal(canonical(load(JSON.parse(JSON.stringify(recording))).recording),canonical(recording));
  group.matches++; group.replays++; group.duration.push(final.time/3);
  increment(group.side,final.result!);
  const reason = 'reason' in final ? final.reason! : 'elimination';
  increment(group.reasons,reason);
  if (config.mode === 'objective-duel') {
    const actor = config.activator === 0 ? 'blue' : 'sand';
    const winningRole = final.result === 'draw' ? 'Draw' : final.result === actor ? 'Activator' : 'Defender';
    increment(group.role,winningRole); increment(group.profiles,profile+':'+winningRole);
    increment(group.factionRole,actor+':'+winningRole);
  }
  if ('score' in final) {
    increment(group.scores,final.score.join('–'));
    increment(group.margin,Math.abs(final.score[0]-final.score[1]));
  }
  let before = recording.initialState, attacks = 0;
  for (const {state,events} of frames) {
    const [blue,sand] = state.fighters;
    if (blue.hp && sand.hp) assert(!agentsCollide(blue.position,blue.position,sand.position,sand.position));
    for (const side of factions) {
      const f = state.fighters[side], prev = before.fighters[side];
      assert(openSegment(f.position,f.position));
      assert(f.hp >= 0 && f.hp <= 100 && f.ammo >= 0 && f.ammo <= 4);
      if (f.hp && prev.hp) {
        group.agentTicks++;
        if (prev.position.x !== f.position.x || prev.position.y !== f.position.y) group.moved++;
        else if (!f.firing && !f.reloadDue && !f.survey && !('core' in state && state.core.interaction?.side === side)) group.idle++;
      }
    }
    if ('core' in state && state.core.interaction) group.peakProgress = Math.max(group.peakProgress,state.time-state.core.interaction.started);
    if ('score' in state && 'score' in before && state.score.some((n,i)=>n!==before.score[i])) {
      group.marginChanges++;
      increment(group.scoreContext,state.score[0] === state.score[1] ? 'tied' : state.score[0] > state.score[1] ? 'blue-leading' : 'sand-leading');
    }
    for (const e of events) {
      increment(group.events,e.kind === 'objective' ? e.action : e.kind);
      if (e.kind === 'attack') {attacks++; increment(group.attacks,e.outcome);}
      if (e.kind === 'defeat' && config.mode === 'objective-duel' && config.variant !== 'reference') assert(before.fighters[e.side].hp > 0);
    }
    before = state;
  }
  if (!attacks) group.noAttack++;
  for (const [,inputs] of recording.transcript) for (const i of inputs) if (i) increment(group.inputs,i.kind);
}
function summary(g:Group) {
  const {duration,...data} = g; duration.sort((a,b)=>a-b);
  const attackCount = Object.values(g.attacks).reduce((a,b)=>a+b,0);
  return {...data,durationMs:{min:duration[0],median:duration[Math.floor(duration.length/2)],
    p90:duration[Math.ceil(duration.length*.9)-1],max:duration.at(-1)},idlePct:g.idle/g.agentTicks*100,
    hitPct:attackCount ? (1-(g.attacks.miss??0)/attackCount)*100 : 0,invalidInputs:0,terminationFailures:0,replayFailures:0};
}

const objective:Record<string,ReturnType<typeof summary>> = {};
for (const [variant,contest] of [...Object.keys(variants).map(v=>[v,false] as const),
  ['reference',true],['reference-live',true],['contestable-core',true],['long-interactions',true],['compact-duel',true],['long-disable',true]] as [Variant,boolean][]) {
  const g = group();
  for (let seed=0;seed<80;seed++) for (const profile of profiles) {
    const results = [], team:[number,number] = [0,0];
    for (const activator of factions) {
      const p = developmentMatch(configure(seed,{mode:'objective-duel',activator,variant}),profile,contest);
      const {final,events} = p.recording;
      assert('core' in final);
      if (variant === 'reference' && !contest) {
        const legacy = historical(oldConfig(seed,activator),profile);
        assert.equal(canonical(p.frames),canonical(legacy.frames));
        if (seed === 3 && profile[0] === 'seek' && activator === 0) fixture('reference-blue-activator',p);
      }
      if (variant === defaultVariant && !contest) {
        if (profile[0] === 'seek' && seed === 3) fixture('paired-'+activator,p);
        if (profile[0] === 'seek' && seed === 39 && activator === 0) fixture('ordinary-objective',p);
        fixture(final.reason!,p);
        if (events.some(([,e])=>e.some(event=>event.kind === 'objective' && event.action === 'cancelled'))) fixture('interrupted',p);
      }
      if (variant === defaultVariant && final.reason === 'core-completed' && !final.fighters[activator].hp) fixture('defeated-activator',p);
      results.push(final.result === 'draw' ? 'Draw' : final.result === (activator ? 'sand' : 'blue') ? 'Activator' : 'Defender');
      if (final.result === 'draw') {team[0]+=.5;team[1]+=.5;}
      else team[final.result === 'blue'?0:1]++;
      observe(g,p,profile[activator]);
    }
    increment(g.pairs,results.sort().join('/'));
    increment(g.series,team[0]===team[1]?'draw':team[0]>team[1]?'blue':'sand');
  }
  objective[variant+(contest?'.contest-policy':'')] = summary(g);
}
const deathmatch:Record<string,ReturnType<typeof summary>> = {};
for (const [target,seconds,seekContact] of [[5,75,false],[5,45,true],[5,75,true],[10,75,true],[10,120,true],[20,120,true]] as const) {
  const g = group();
  for (let seed=0;seed<32;seed++) for (const profile of profiles) {
    const p = developmentMatch(configure(seed,{mode:'score-deathmatch',target,seconds}),profile,false,seekContact);
    observe(g,p);
    if (target === 5 && seekContact) {
      const f = p.recording.final;
      if (seconds === 75 && seed === 12 && profile[0] === 'seek') fixture('ordinary-score',p);
      if ('score' in f && (seconds === 75 || f.reason === 'score-clock')) fixture(f.reason!,p);
      if (seconds === 75 && p.recording.events.some(([,events])=>events.filter(event=>event.kind==='defeat').length===2)) fixture('simultaneous-defeats',p);
    }
  }
  deathmatch[target+'x'+seconds+(seekContact?'':'.legacy-policy')] = summary(g);
}
fixture('idle-score-draw',record(configure(3,{mode:'score-deathmatch',seconds:45}),()=>[null,null]));
fixture('idle-objective-deadline',record(configure(3,{mode:'objective-duel',activator:0}),()=>[null,null]));
let mirroredPairs = 0;
for (let seed=0;seed<32;seed++) for (const mode of ['score-deathmatch','objective-duel'] as const) {
  const a = developmentMatch(configure(seed,mode==='objective-duel'?{mode,activator:0}:{mode}));
  const b = developmentMatch(configure(seed+0x80000000,mode==='objective-duel'?{mode,activator:1}:{mode}),['roam','seek']);
  assert.equal(a.frames.length,b.frames.length);
  for (let i=0;i<a.frames.length;i++) {
    const left = a.frames[i].state,right = b.frames[i].state;
    if ('score' in left && 'score' in right) assert.deepEqual(left.score,[...right.score].reverse());
    if ('core' in left && 'core' in right) assert.equal(left.core.phase,right.core.phase);
    for (const side of factions) {
      const x = left.fighters[side],y = right.fighters[1-side];
      assert.deepEqual([x.position.x,x.position.y,x.hp,x.ammo],[WIDTH*unit-y.position.x,y.position.y,y.hp,y.ammo]);
    }
  }
  assert.equal(a.recording.final.result,b.recording.final.result === 'draw' ? 'draw' : b.recording.final.result === 'blue' ? 'sand' : 'blue');
  mirroredPairs++;
}
const report = {objective,deathmatch,mirroredPairs,fixtures:Object.keys(fixtures)};
writeFileSync(dir+'/benchmark.json',JSON.stringify(report,null,2));
for (const [name,g] of Object.entries({...objective,...deathmatch})) console.log(name,g.role,g.reasons,g.durationMs,g.events.respawn,g.hitPct.toFixed(1));
