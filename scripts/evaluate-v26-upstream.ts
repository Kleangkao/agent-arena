import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {previousDevelopmentPlan} from '../src/v26/development.js';
import {configure,second,type Config,type Side} from '../src/v26/config.js';
import {maxTime,observation,type Packet} from '../src/v26/game.js';
import {load,record} from '../src/v26/replay.js';
import type {Execution} from '../src/v26/controller.js';
import {runTrial,selectedCadence,limits,type Provider,type UpstreamOptions} from '../server/gameplay-v26.js';
import {verifyAuthorizationTrace} from '../server/gameplay-v26-evidence.js';

const path='evidence/gameplay-v26-upstream';
const auditOnly=process.argv.includes('--objective-audit');
mkdirSync(path,{recursive:true});
const write=(name:string,data:unknown)=>writeFileSync(path+'/'+name+'.json',JSON.stringify(data,null,2)+'\n');
const seeds=[12,3,23,71], modes=['objective-duel','score-deathmatch'] as const;
type Mode=typeof modes[number];
type Case='authorized-wait'|'expiry'|'planned-play'|'retry'|'ordinary'|'ordinary-swapped'|'latency'|'429'|'timeout';
type Arm={name:string;options:UpstreamOptions;reenter?:boolean};
const arms:Arm[]=[
  {name:'finite',options:{horizon:20}},
  {name:'earliest',options:{horizon:20,earliest:true}},
  {name:'ordered-finite',options:{representation:'ordered',horizon:20}},
  {name:'ordered',options:{representation:'ordered',horizon:20},reenter:true},
  {name:'state-machine',options:{representation:'state-machine',horizon:20},reenter:true},
  {name:'behavior-tree',options:{representation:'behavior-tree',horizon:20},reenter:true},
  {name:'ordered-long',options:{representation:'ordered',horizon:30},reenter:true},
  {name:'ordered-match',options:{representation:'ordered',horizon:20,matchScope:true},reenter:true},
  {name:'state-machine-match',options:{representation:'state-machine',horizon:20,matchScope:true},reenter:true},
  {name:'behavior-tree-match',options:{representation:'behavior-tree',horizon:20,matchScope:true},reenter:true},
];
type Plan=Execution['plan'];
const valid=(value:unknown)=>value as Plan;
const waiting=(ms:number):Plan=>({version:1,expiresInMs:ms,stages:[{forMs:ms,packet:{}}]});
const delay=(ms:number,signal:AbortSignal)=>sleep(ms,undefined,{signal});
const archived=JSON.parse(readFileSync('evidence/gameplay-v26-lifecycle/benchmark.json','utf8')).filter((r:{cadence:string})=>r.cadence===selectedCadence);
const archivedReplay=JSON.parse(readFileSync('evidence/gameplay-v26-lifecycle/score-renewal-paced.json','utf8'));
const sha=(input:unknown)=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
const coaches=[{text:'Commit when authorized',revision:'commit'},{text:'Keep moving and restore resources',revision:'mobile'}] as const;
const scenarios=['authorized-wait','expiry','planned-play','retry','ordinary','ordinary-swapped'] as const;
const primary=arms.filter(a=>['finite','ordered','state-machine','behavior-tree'].includes(a.name));
const probeConfig=configure(12,'objective-duel');
const steer=(x:number):Packet=>({movement:{kind:'steer',gait:'run',direction:{x,y:0}}});
const stop:Packet={movement:{kind:'stop'}};
const probe=record(probeConfig,'development-policy',({tick})=>tick===0?[steer(1),steer(-1)]:
  tick===12?[steer(-1),steer(1)]:tick===23?[stop,stop]:[null,null]);
assert(load(probe).frames.some(({state})=>{
  const v=observation(probeConfig,state,0);
  return v.match.phase==='pending'&&v.historical&&!v.current;
}));
if(!auditOnly) write('probe-objective',probe);

function author(p:Parameters<Provider>[0],side:Side,pattern:Case):Plan {
  if(pattern==='authorized-wait') return waiting(13000);
  if(pattern==='expiry') return waiting(4500);
  const v=p.view, base=previousDevelopmentPlan(v,side,side===0?'mobile':'steady',45);
  const walk=base.stages[0].packet.movement;
  const repeat={everyMs:850,count:7};
  const main={forMs:5500,packet:{attack:'standard'},when:'can-attack',
    ...(walk?{alternative:{movement:walk}}:{}),repeat};
  if(pattern==='planned-play'||pattern==='retry') return valid({version:1,expiresInMs:10000,stages:[
    {forMs:3500,packet:{core:'start'},when:'core-available',alternative:{},until:v.legal.core?undefined:'action-finished'},
    main,{forMs:1400,packet:{reload:true},when:'can-reload',alternative:{}},
  ]});
  const direction={x:side===0?1:-1,y:0};
  const steer={kind:'steer',gait:'walk',direction};
  const retreat={...steer,direction:{x:-direction.x,y:0}};
  const goal=v.match.site?{kind:'goal',gait:'walk',to:{x:v.match.site.x-direction.x*1200,y:v.match.site.y}}:steer;
  const explorer=p.coaching.revision==='mobile';
  const approach={forMs:1800,packet:{movement:explorer?steer:goal},until:v.match.site&&!explorer?'at-goal':undefined};
  const core={forMs:3200,packet:{core:'start'},when:'core-available',alternative:{},until:undefined};
  const combat={forMs:2500,packet:{attack:'standard',movement:{kind:'stop'}},
    when:'can-attack',alternative:{movement:retreat},repeat:{everyMs:850,count:3}};
  const reload={forMs:1400,packet:{reload:true,movement:explorer?retreat:goal},when:'can-reload',alternative:{movement:goal}};
  return valid({version:1,expiresInMs:20000,stages:explorer?[reload,approach,combat,core]:[approach,core,combat,reload]});
}

function represent(plan:Plan,arm:Arm,pattern:Case) {
  const kind=arm.options.representation;
  if(!kind) return plan;
  const useFullHorizon=pattern==='ordinary'||pattern==='ordinary-swapped'||pattern==='latency';
  const root=kind==='ordered'?'stage-0':kind==='state-machine'?'stage-0':'root';
  const common={version:1,kind,scope:arm.options.matchScope?{kind:'match',restart:root}:{kind:'life'},
    expiresInMs:useFullHorizon?arm.options.horizon*1000:plan.expiresInMs,
    reenter:!!arm.reenter&&pattern!=='authorized-wait'&&pattern!=='expiry'};
  const stages=plan.stages.map((action,i)=>({id:'stage-'+i,action}));
  if(kind==='ordered') return {...common,stages:plan.stages};
  if(kind==='state-machine') return {...common,entry:root,states:stages.map((s,i)=>({...s,
    transitions:i+1<stages.length?[{to:stages[i+1].id}]:[]}))};
  return {...common,root,nodes:[{id:root,kind:'sequence',children:stages.map(s=>s.id)},
    ...stages.map(s=>({...s,kind:'action'}))]};
}

const percentile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]??0;
async function run(seed:number,mode:Mode,pattern:Case,arm:Arm) {
  const swapped=pattern==='ordinary-swapped', c=configure(seed,mode,swapped?1:0);
  const calls=new Map<string,number>();
  const trial=await runTrial(c,swapped?[coaches[1],coaches[0]]:coaches,async(p,signal)=>{
    const side=c.participants[0]===p.participant?0:1;
    const n=(calls.get(p.participant)??0)+1;
    calls.set(p.participant,n);
    if(pattern==='latency') await delay(80,signal);
    if(pattern==='timeout'&&side===0&&n===1) await delay(2*limits.requestMs,signal);
    if(pattern==='429'||pattern==='timeout'&&side===0&&n===2) throw Object.assign(Error('Injected 429'),{status:429});
    if(pattern==='retry'&&n===2) throw Object.assign(Error('Injected 503'),{status:503});
    return represent(author(p,side,pattern),arm,pattern);
  },selectedCadence,new AbortController().signal,'injected-provider',auditOnly?{...arm.options,diagnostics:true}:arm.options);
  const {recording,preparationMs,participants,upstream}=trial;
  assert(upstream);
  assert(participants.every(p=>p.metrics.calls<=limits.perSide));
  assert(participants.reduce((n,p)=>n+p.metrics.calls,0)<=limits.total);
  const provenance=verifyAuthorizationTrace(trial);
  const replay=sha(recording);
  if(auditOnly) objectiveTrials.set(`${seed}:${pattern}:${arm.name}`,trial);
  if(arm.name==='finite') {
    const reference=archived.find((r:{seed:number;mode:Mode;pattern:Case})=>r.seed===seed&&r.mode===mode&&r.pattern===pattern);
    if(reference) {
      assert.deepEqual(recording.final.result,reference.result);
      assert.deepEqual(recording.interruption,reference.interruption);
      assert.deepEqual(participants.map(p=>[p.metrics,p.timing]),reference.participants.map((p:typeof participants[number])=>[p.metrics,p.timing]));
      if(seed===12&&mode==='score-deathmatch'&&pattern==='retry') assert.equal(replay,sha(archivedReplay));
    }
  }
  if(seed===12&&mode==='score-deathmatch'&&['retry','ordinary'].includes(pattern)&&
    ['finite','ordered','state-machine','behavior-tree','ordered-match','state-machine-match','behavior-tree-match'].includes(arm.name)) {
    write(`${arm.name}-${pattern}`,trial);
  }
  if(!auditOnly&&seed===12&&mode==='objective-duel'&&pattern==='ordinary'&&arm.name==='finite') write('finite-objective',recording);
  return {arm:arm.name,seed,mode,pattern,replay,provenance,result:recording.final.result,interruption:recording.interruption,
    reached:recording.final.time/second,unplayedUpperBound:recording.interruption?(maxTime(c)-recording.final.time)/second:0,preparationMs,
    costP50Ms:percentile(upstream.evaluationMs,.5),costP95Ms:percentile(upstream.evaluationMs,.95),
    sides:participants.map(p=>({timing:p.timing,attempts:p.metrics.calls,revisionCount:p.requests.filter(r=>r.status==='accepted').length,
      retries:p.requests.filter(r=>r.attempt>1).length,attemptsByStatus:p.requests.map(r=>r.status)}))};
}

type Row=Awaited<ReturnType<typeof run>>;
const objectiveTrials=new Map<string,Awaited<ReturnType<typeof runTrial>>>();
if(auditOnly) {
  const {auditObjective}=await import('./v27-objective-audit.js');
  const differences=[];
  for(const [seed,pattern] of [...seeds.flatMap(seed=>scenarios.map(pattern=>[seed,pattern] as const)),[12,'latency'] as const]) {
    for(const name of ['finite','ordered-finite','ordered']) await run(seed,'objective-duel',pattern,arms.find(a=>a.name===name)!);
    const [finite,wrapped,persistent]=['finite','ordered-finite','ordered'].map(name=>objectiveTrials.get(`${seed}:${pattern}:${name}`)!);
    if(finite.recording.final.result!==persistent.recording.final.result)
      differences.push({seed,pattern,...auditObjective(finite,wrapped,persistent)});
    objectiveTrials.clear();
  }
  assert.equal(differences.length,6);
  write('../gameplay-v27/objective-divergences',differences);
  console.log(JSON.stringify(differences.map(({seed,pattern,first,classification})=>({seed,pattern,tick:first.tick,classification})),null,2));
} else {
const rows:Row[]=[];
for(const arm of arms) for(const mode of modes) for(const seed of seeds) for(const pattern of scenarios) {
  if(arm.options.matchScope&&mode!=='score-deathmatch') continue;
  if(arm.options.horizon===30&&!pattern.startsWith('ordinary')) continue;
  rows.push(await run(seed,mode,pattern,arm));
}
for(const arm of primary) for(const mode of modes) for(const pattern of ['latency','429'] as const)
  rows.push(await run(12,mode,pattern,arm));
rows.push(...await Promise.all(primary.map(arm=>run(12,'objective-duel','timeout',arm))));
write('rows',rows);

function summarize(set:Row[]) {
  const sides=set.flatMap(r=>r.sides);
  const sum=(key:keyof Row['sides'][number]['timing'])=>sides.reduce((n,s)=>n+s.timing[key],0);
  const ms=(key:'preparationMs'|'costP50Ms'|'costP95Ms')=>percentile(set.map(r=>r[key]),.95);
  const pct=(key:Parameters<typeof sum>[0])=>sum('eligible')?100*sum(key)/sum('eligible'):0;
  return {completed:set.filter(r=>r.result).length,interrupted:set.filter(r=>r.interruption).length,
    eligibleSeconds:sum('eligible')/second,idlePct:pct('infrastructureIdle'),idleSeconds:sum('infrastructureIdle')/second,
    longestIdleSeconds:Math.max(0,...sides.map(s=>s.timing.longestInfrastructureGap/second)),
    longestAuthorizationGap:Math.max(0,...sides.map(s=>s.timing.longestGap/second)),
    authorizationPct:pct('covered'),executablePct:pct('executable'),intentionalWaitPct:pct('authorizedWait'),
    guardWaitPct:pct('guardWait'),blockedPct:pct('blocked'),otherAuthorizedIdlePct:pct('planIdle'),
    calls:sides.reduce((n,s)=>n+s.attempts,0),retries:sides.reduce((n,s)=>n+s.retries,0),
    revisions:sides.reduce((n,s)=>n+s.revisionCount,0),preparationP95Ms:ms('preparationMs'),
    perTrialControllerP95Ms:ms('costP95Ms'),reusedLives:set.reduce((n,r)=>n+r.provenance.reusedLives,0)};
}
const summary=arms.flatMap(arm=>modes.map(mode=>{
  const cases=rows.filter(r=>r.arm===arm.name&&r.mode===mode);
  const comparable=(r:Row)=>r.arm==='finite'&&r.mode===mode&&cases.some(c=>c.pattern===r.pattern&&c.seed===r.seed);
  const baseline=rows.filter(comparable);
  const paired=cases.filter(c=>c.result&&baseline.some(b=>b.result&&b.seed===c.seed&&b.pattern===c.pattern));
  return {arm:arm.name,mode,all:summarize(cases),pairedComplete:summarize(paired),
    pairedBaseline:summarize(baseline.filter(b=>paired.some(c=>b.seed===c.seed&&b.pattern===c.pattern))),
    changedPairedResult:paired.filter(c=>baseline.some(b=>b.seed===c.seed&&b.pattern===c.pattern&&sha(b.result)!==sha(c.result))).length,
    ordinary:summarize(cases.filter(r=>r.pattern.startsWith('ordinary')))};
})).filter(r=>r.all.completed+r.all.interrupted>0);
write('summary',summary);
console.log(JSON.stringify({verifiedArchived:32,trials:rows.length,packets:rows.reduce((n,r)=>n+r.provenance.packets,0),
  unauthorized:0,summary:summary.map(r=>({arm:r.arm,mode:r.mode,completed:r.all.completed,interrupted:r.all.interrupted,
    idlePct:+r.all.idlePct.toFixed(2),worst:+r.all.longestIdleSeconds.toFixed(2),calls:r.all.calls,reusedLives:r.all.reusedLives}))},null,2));
}
