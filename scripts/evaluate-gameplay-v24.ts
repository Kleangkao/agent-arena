import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {developmentMatch as baseline, type Profile} from '../src/v23/development.js';
import {initial as worldInitial, observation as worldObservation, matchTime} from '../src/v23/game.js';
import {load as loadOld} from '../src/v23/replay.js';
import {agentsCollide, clearSight, equal, gap,openSegment,unit} from '../src/v23/space.js';
import {WIDTH} from '../src/v2/yard.js';
import {configure,initial,settings,maxTicks} from '../src/v24/objective.js';
import {developmentMatch} from '../src/v24/development.js';
import {load} from '../src/v24/replay.js';
import type {Side} from '../src/v2/game.js';

const out='evidence/gameplay-v24';
mkdirSync(out,{recursive:true});
const profiles=[['seek','roam'],['roam','seek']] as const;
const counts=(list: readonly string[])=>Object.fromEntries(list.map(x=>[x,0]));
const empty=()=>({matches:0,draws:0,clock:0,wins:counts(['blue','sand','draw','Activator','Defender']),
  reasons:counts(['elimination','mutual-elimination','health-clock','core-completed','core-disabled','activation-prevented']),
  durations:Array<number>(), idleTime:0, agentTime:0, overlapping:0, moveTime:counts(['walk','run','crouch','jump']),
  inputs:{} as Record<string,number>, attacks:counts(['miss','hit','precision']), noAttack:0, bothFull:0,
  progress:counts(['started','cancelled','activated','disabled','completed']), furthestInteractionHistogram:counts(['none','partial','activated']),
  collisions:counts(['agent','terrain']), invalidInputs:0, terminationFailures:0,replayFailures:0,replayBytes:0});
const totals={elimination:empty(),unchangedPolicies:empty(),objectiveAware:empty()};
const breakdown={seekActivator:{matches:0,wins:0},roamActivator:{matches:0,wins:0},activationBySide:[0,0],activatorWinsBySide:[0,0],
  pairedByRole:counts(['both-Activator','both-Defender','one-each','draw']),mirroredPairs:0};
const pacing={decisionSlots:0,unknownContact:0,emptyAmmo:0,legalStandard:0,passedLegal:0,passedRoam:0,passedSeek:0,
  missOutOfRangeOrSightAtPreviousBoundary:0,inputsMoving:0,offCenterAgentSteps:0};
const fixtures: Record<string,{file:string;result:string|null;reason:string|null;seed:number;activator:Side;durationMs:number}>={};
const fixture=(name:string,rec: ReturnType<typeof developmentMatch>['recording'])=>{
  if(fixtures[name])return;
  const {config,final}=rec;
  fixtures[name]={file:name+'.json',result:final.result,reason:final.reason,seed:config.seed,activator:config.activator,durationMs:final.time/3};
  writeFileSync(out+'/'+name+'.json',JSON.stringify(rec)+'\n');
};
const add=(t:ReturnType<typeof empty>,original:ReturnType<typeof baseline>|ReturnType<typeof developmentMatch>,players:readonly [Profile,Profile])=>{
  const rec=original.recording;
  const verified=rec.version===4?load(JSON.parse(JSON.stringify(rec))):loadOld(JSON.parse(JSON.stringify(rec)));
  assert.deepEqual(verified.frames,original.frames);
  const end=rec.final;
  assert(end.result);
  assert(end.tick<=(rec.version===4?maxTicks:581));
  const reason='reason' in end?end.reason!:end.time===matchTime?'health-clock':end.result==='draw'?'mutual-elimination':'elimination';
  t.matches++; t.wins[end.result]++; t.reasons[reason]++;
  t.draws+=Number(end.result==='draw');
  t.clock+=Number(['health-clock','activation-prevented','core-completed'].includes(reason));
  t.durations.push(end.time/3);
  t.bothFull+=Number(end.fighters.every(f=>f.hp===100));
  t.replayBytes+=Buffer.byteLength(JSON.stringify(rec));
  if(rec.version===4&&end.result!=='draw')t.wins[(end.result==='blue'?0:1)===rec.config.activator?'Activator':'Defender']++;
  let previous=rec.version===4?initial(rec.config):worldInitial();
  let attacks=0, progress=false, activated=false;
  const byTick=new Map(rec.transcript);
  for(const [,intents] of rec.transcript)for(const input of intents)if(input)t.inputs[input.kind]=(t.inputs[input.kind]??0)+1;
  for(const {state,events} of original.frames){
    const elapsed=(state.time-previous.time)/3;
    for(const side of [0,1] as const){
      const f=state.fighters[side], from=previous.fighters[side];
      assert(openSegment(from.position,f.position));
      assert(f.hp>=0&&f.hp<=100&&f.ammo>=0&&f.ammo<=4);
      if(f.hp){
        t.agentTime+=elapsed;
        const doing=!!(f.firing||f.reloadDue||f.survey||('core' in state&&state.core.interaction?.side===side));
        if(f.motion){t.moveTime[f.motion.mode]+=elapsed; if(doing)t.overlapping+=elapsed;}
        else if(!doing)t.idleTime+=elapsed;
      }
      if(rec.version===3){
        pacing.offCenterAgentSteps+=Number((f.position.x-unit/2)%unit!==0||(f.position.y-unit/2)%unit!==0);
        pacing.inputsMoving+=Number(!equal(f.position,from.position));
        if(!previous.time||Math.floor(previous.time/1320)!==Math.floor((previous.time-100)/1320)){
          const o=worldObservation(previous,side);
          pacing.decisionSlots++;
          pacing.unknownContact+=Number(o.contact.status==='unknown');
          pacing.emptyAmmo+=Number(o.you.ammo===0);
          if(o.actions.includes('attack')){
            pacing.legalStandard++;
            if(!['attack','precision'].includes(byTick.get(state.tick)?.[side]?.kind??'')){
              pacing.passedLegal++; if(players[side]==='seek')pacing.passedSeek++;else pacing.passedRoam++;
            }
          }
        }
      }
    }
    assert(!agentsCollide(previous.fighters[0].position,state.fighters[0].position,previous.fighters[1].position,state.fighters[1].position));
    for(const e of events){
      if(e.kind==='objective'){t.progress[e.action]++;progress=true;if(e.action==='activated')activated=true;}
      if(e.kind==='collision')t.collisions[e.with]++;
      if(e.kind==='attack'){
        attacks++;t.attacks[e.outcome]++;
        const [a,b]=previous.fighters.map(f=>f.position);
        if(rec.version===3&&e.outcome==='miss'&&(gap(a,b)>4*unit||!clearSight(a,b)))pacing.missOutOfRangeOrSightAtPreviousBoundary++;
      }
    }
    previous=state;
  }
  if(rec.version===4)t.furthestInteractionHistogram[activated?'activated':progress?'partial':'none']++;
  t.noAttack+=Number(!attacks);
};

for(let seed=0;seed<80;seed++) for(const assignment of profiles){
  add(totals.elimination,baseline(seed,assignment),assignment);
  const results=[];
  for(const activator of [0,1] as const){
    const config=configure(seed,activator);
    const untouched=developmentMatch(config,assignment,false), adapted=developmentMatch(config,assignment);
    add(totals.unchangedPolicies,untouched,assignment);add(totals.objectiveAware,adapted,assignment);
    const rec=adapted.recording,{result,reason}=rec.final;
    const roleWon=result===(activator===0?'blue':'sand');
    const profile=assignment[activator]==='seek'?breakdown.seekActivator:breakdown.roamActivator;
    profile.matches++;profile.wins+=Number(roleWon);
    breakdown.activatorWinsBySide[activator]+=Number(roleWon);
    const activated=rec.events.some(([,events])=>events.some(e=>e.kind==='objective'&&e.action==='activated'));
    breakdown.activationBySide[activator]+=Number(activated);
    results.push(result==='draw'?null:roleWon);
    if(seed===3&&assignment[0]==='seek')fixture(activator===0?'paired-blue-activator':'paired-sand-activator',rec);
    if(reason==='core-disabled')fixture('disabled',rec);
    if(reason==='core-completed')fixture('completed',rec);
    if(reason==='elimination')fixture('elimination',rec);
    if(untouched.recording.final.reason==='activation-prevented'&&seed===3)fixture('deadline',untouched.recording);
    if(activated && rec.final.fighters[activator].hp===0)fixture('activator-defeated-after-activation',rec);
  }
  breakdown.pairedByRole[results.includes(null)?'draw':results.every(Boolean)?'both-Activator':results.every(x=>!x)?'both-Defender':'one-each']++;
}
for(let seed=0;seed<32;seed++)for(const assignment of profiles)for(const activator of [0,1] as const){
  const a=developmentMatch(configure(seed,activator),assignment), b=developmentMatch(configure((seed^0x80000000)>>>0,
    activator===0?1:0,['sand-agent','blue-agent']),[assignment[1],assignment[0]]);
  assert.equal(a.frames.length,b.frames.length);assert.equal(a.recording.final.reason,b.recording.final.reason);
  assert.equal(a.recording.final.result,b.recording.final.result==='blue'?'sand':b.recording.final.result==='sand'?'blue':'draw');
  for(const [i,{state}] of a.frames.entries()){
    const other=b.frames[i].state;
    assert.deepEqual([state.core.phase,state.core.deadline,state.core.interaction?.started],
      [other.core.phase,other.core.deadline,other.core.interaction?.started]);
    if(state.core.interaction)assert.equal(state.core.interaction.side,1-other.core.interaction!.side);
    for(const side of [0,1] as const){
      const x=state.fighters[side], y=other.fighters[1-side];
      assert.equal(x.position.x+y.position.x,unit*WIDTH);
      assert.deepEqual([x.hp,x.ammo,x.posture,x.position.y],[y.hp,y.ammo,y.posture,y.position.y]);
    }
  }
  breakdown.mirroredPairs++;
}
const summary=Object.fromEntries(Object.entries(totals).map(([key,t])=>{
  const {durations,...rest}=t;durations.sort((a,b)=>a-b);
  const nth=(n:number)=>durations[Math.floor((durations.length-1)*n)];
  return [key,{...rest,durationMs:{min:nth(0),median:nth(.5),p90:nth(.9),max:nth(1),mean:durations.reduce((a,b)=>a+b,0)/durations.length},
    idlePct:t.idleTime/t.agentTime*100,overlapPct:t.overlapping/t.agentTime*100}];
}));
const result={seedRange:'0–79, two profile assignments; Objective Duel tests both roles per assignment',summary,pacing,breakdown,fixtures};
writeFileSync(out+'/benchmark.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
