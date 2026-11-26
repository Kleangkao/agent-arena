import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {configure,second,type Side} from '../src/v26/config.js';
import {maxTime} from '../src/v26/game.js';
import {previousDevelopmentPlan} from '../src/v26/development.js';
import {runTrial,type Cadence} from '../server/gameplay-v26.js';

const path='evidence/gameplay-v26-lifecycle';
mkdirSync(path,{recursive:true});
const write=(name:string,value:unknown)=>writeFileSync(path+'/'+name+'.json',JSON.stringify(value,null,2));
const modes=['objective-duel','score-deathmatch'] as const;const scheduling=[];
const coaches=[{text:'Local test',revision:'a'},{text:'Local test',revision:'b'}] as const;
const wait=(ms:number)=>({version:1,expiresInMs:ms,stages:[{forMs:ms,packet:{}}]});
const cadences:Cadence[]=['reserved','renewal','renewal-credit','renewal-paced'];
for(const seed of [12,3,23,71]) for(const cadence of cadences) for(const mode of modes) {
  for(const pattern of ['authorized-wait','expiry','planned-play','retry'] as const) {
    const c=configure(seed,mode), calls=new Map<string,number>();
    const trial=await runTrial(c,coaches,async input=>{
      const n=(calls.get(input.participant)??0)+1;calls.set(input.participant,n);
      if(pattern==='retry'&&n===2) throw Object.assign(Error('Injected transient error'),{status:503});
      if(pattern==='authorized-wait') return wait(13000);
      if(pattern==='expiry') return wait(4500);
      const side=input.participant===c.participants[0]?0:1;
      const v=input.view, base=previousDevelopmentPlan(v,side as Side,side===0?'mobile':'steady',45);
      const walk=base.stages[0].packet.movement;
      const main={forMs:5500,packet:{attack:'standard'},when:'can-attack',
        ...(walk?{alternative:{movement:walk}}:{}),repeat:{everyMs:850,count:7}};
      return {version:1,expiresInMs:10000,stages:[
        {forMs:3500,packet:{core:'start'},when:'core-available',alternative:{},until:v.legal.core?undefined:'action-finished'},
        main,
        {forMs:1400,packet:{reload:true},when:'can-reload',alternative:{}},
      ]};
    },cadence,new AbortController().signal);
    scheduling.push({seed,cadence,mode,pattern,result:trial.recording.final.result,interruption:trial.recording.interruption,
      seconds:trial.recording.final.time/second,preparationMs:trial.preparationMs,participants:trial.participants,
      unplayedUpperBoundSeconds:trial.recording.interruption?(maxTime(c)-trial.recording.final.time)/second:0});
    if(seed===12&&pattern==='retry'&&mode==='score-deathmatch') {
      if(cadence==='reserved') assert.equal(createHash('sha256').update(JSON.stringify(trial.recording)).digest('hex'),
        '45a3e019b5e15e8252ac925fd629bf468c760936c7217e08d3faabf16662bdcc');
      write('score-'+cadence,trial.recording);
    }
  }
}
write('benchmark',scheduling);
const scale=(n:number)=>Math.round(n*100)/100;
const summary=[];
for(const cadence of cadences) for(const mode of modes) {
  const trials=scheduling.filter(x=>x.cadence===cadence&&x.mode===mode);
  const sides=[0,1].map(side=>{
    const all=trials.map(trial=>trial.participants[side]);
    const sum=(field:keyof (typeof all)[number]['timing'])=>all.reduce((n,p)=>n+p.timing[field],0);
    const time=(field:Parameters<typeof sum>[0])=>scale(sum(field)/second);
    const max=(field:Parameters<typeof sum>[0])=>scale(Math.max(...all.map(p=>p.timing[field]))/second);
    return {side,eligible:time('eligible'),validPlanPct:scale(100*sum('covered')/sum('eligible')),
      executablePct:scale(100*sum('executable')/sum('eligible')),infrastructureIdle:time('infrastructureIdle'),
      longestInfrastructureGap:max('longestInfrastructureGap'),longestPlanGap:max('longestGap'),
      authorizedWaiting:time('authorizedWait'),guardWaiting:time('guardWait'),expiredPlan:time('expired'),
      blocked:time('blocked'),planIdle:time('planIdle'),requests:all.reduce((n,p)=>n+p.metrics.calls,0),
      retries:all.reduce((n,p)=>n+p.requests.filter(r=>r.attempt>1).length,0)};
  });
  summary.push({cadence,mode,trials:trials.length,interruptions:trials.filter(x=>x.interruption).length,
    preparationMs:trials.map(x=>x.preparationMs),requests:sides.reduce((n,p)=>n+p.requests,0),sides});
}
write('summary',summary);

