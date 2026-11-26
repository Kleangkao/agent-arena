import {readFileSync,writeFileSync} from 'node:fs';
import {configure,second} from '../src/v26/config.js';
import {advance,initial,observation,type State} from '../src/v26/game.js';
import {baselineDevelopmentPlan,developmentController} from '../src/v26/development.js';
import {authorize,execute,motionLease,parsePlan} from '../src/v26/controller.js';
import {unit} from '../src/v23/space.js';

const out='evidence/gameplay-v26-playtest/';
const c=configure(12,'elimination');
function scenario(distance:number,ammo:number,moving:boolean) {
  const i=initial(c);
  i.fighters[0].position={x:8910,y:20790};
  i.fighters[1].position={x:8910+distance,y:20790};
  i.fighters[1].ammo=ammo;
  return advance(c,i,[null,moving?{movement:{kind:'steer',direction:{x:-1,y:0},gait:'walk'}}:null]).state;
}
function sample(label:string,state:State,baseline:boolean) {
  const controller=developmentController(c,1,'steady',23,baseline?baselineDevelopmentPlan:undefined);
  const initialState=structuredClone(state), rows=[];
  for(let n=0;n<45;n++) {
    const view=observation(c,state,1), packet=controller(view);
    const frame=advance(c,state,[null,packet]);
    if(packet||frame.events.some(e=>'side'in e&&e.side===1)||n===0) rows.push({
      tick:state.tick,observation:view,execution:controller.diagnostics(),packet,receipts:frame.receipts[1],
      stateAfter:frame.state.fighters[1],events:frame.events.filter(e=>'side'in e&&e.side===1)});
    state=frame.state;
  }
  return {label,baseline,initialState,rows};
}
const reload=scenario(unit,1,false);
const approach=scenario(c.equipment.range+600,4,true);
const result=[true,false].flatMap(before=>[sample('close-reload',reload,before),sample('approach-enters-equipment-reach',approach,before)]);
const set={version:1,expiresInMs:2000,stages:[{forMs:1800,when:'has-contact',
  packet:{movement:{kind:'stop'}},alternative:{movement:{kind:'goal',to:{x:30000,y:20790},gait:'walk'}}}]};
const i=initial(c);
i.fighters[0].position={x:8000,y:20790};
i.fighters[1].position={x:8000+c.perception.range+180,y:20790};
const e=authorize(parsePlan(set,c),i.time);
let s=i, hadMotion=false;
const reactive=Array.from({length:3},()=>{
  const observationBefore=observation(c,s,0);
  const selection=execute(e,observationBefore);
  const input=motionLease(selection,e,observationBefore,hadMotion);
  const frame=advance(c,s,[input.packet,null]);
  hadMotion=input.motion;s=frame.state;
  return {observation:observationBefore,activeStage:e.index,selection,input,receipts:frame.receipts[0],
    stateAfter:s.fighters[0]};
});
writeFileSync(out+'traces.json',JSON.stringify({source:'Deterministic local fixtures, not model inference',
  controller:'src/v26/sandbox.tsx → src/v26/development.ts → src/v26/controller.ts → src/v26/game.ts',
  result,conditional:{plan:set,trace:reactive}},null,2));

type Sample={seed:number;bluePolicy:string;activator:number|null;outcome:string;reason:string;score?:[number,number];
  respawns:number;respawnContact:number;respawnInput:number;seconds:number;pendingSeconds:number|null;activeSeconds:number|null;
  disabled:boolean;completed:boolean};
type Participant=Awaited<ReturnType<typeof import('../server/gameplay-v26.js').runTrial>>['participants'][number];
type Bench={cohorts:{mode:string;samples:Sample[]}[];scheduling:{mode:string;pattern:string;result:string;
  interruption:unknown;seconds:number;unplayedUpperBoundSeconds:number;participants:Participant[]}[]};
const round=(n:number)=>Math.round(n*100)/100;
const count=(list:(string|undefined)[])=>Object.fromEntries([...new Set(list)].map(value=>[String(value),list.filter(x=>x===value).length]));
const distribution=(list:number[])=>{
  const a=[...list].sort((a,b)=>a-b);
  return a.length?{min:round(a[0]),median:round(a[Math.floor(a.length/2)]),max:round(a.at(-1)!)}:null;
};
function summarize(path:string) {
  const input:Bench=JSON.parse(readFileSync(path,'utf8'));
  return {
    modes:input.cohorts.map(({mode,samples})=>({
      mode,n:samples.length,draws:samples.filter(x=>x.outcome==='draw').length,
      outcomesByReason:count(samples.map(x=>x.reason)),duration:distribution(samples.map(x=>x.seconds)),
      ...(mode==='objective-duel'?{
        activations:samples.filter(x=>x.activeSeconds!==null).length,
        disables:samples.filter(x=>x.disabled).length,
        completions:samples.filter(x=>x.completed).length,
        pendingDuration:distribution(samples.map(x=>x.pendingSeconds!)),
        activeDuration:distribution(samples.flatMap(x=>x.activeSeconds===null?[]:[x.activeSeconds])),
        roleSwaps:[0,1].map(activator=>({activator,results:count(samples.filter(x=>x.activator===activator).map(x=>
          x.outcome==='draw'?'draw':x.outcome===(activator===0?'blue':'sand')?'Activator':'Defender'))}))
      }:{
        targetScoreRate:round(100*samples.filter(x=>x.reason==='target-score').length/samples.length),
        scores:count(samples.map(x=>x.score?.join('–'))),respawns:distribution(samples.map(x=>x.respawns)),
        totalRespawns:samples.reduce((a,x)=>a+x.respawns,0),
        respawnImmediateContact:samples.reduce((a,x)=>a+x.respawnContact,0),
        respawnFirstBoundaryAcceptedInput:samples.reduce((a,x)=>a+x.respawnInput,0)
      })
    })),
    scheduler:input.scheduling.map(x=>{
      const total=(pick:(p:Participant)=>number)=>x.participants.reduce((n,p)=>n+pick(p),0);
      const duration=(pick:(p:Participant)=>number)=>round(total(pick)/second);
      const eligible=total(p=>p.timing.eligible), produced=total(p=>p.timing.feedbackProduced);
      const coverage=eligible?round(100*total(p=>p.timing.covered)/eligible):null;
      return {mode:x.mode,scenario:x.pattern,result:x.result,interruption:x.interruption??null,matchSeconds:x.seconds,
        unplayedUpperBoundSeconds:x.unplayedUpperBoundSeconds,eligible:duration(p=>p.timing.eligible),coverage,
        uncovered:duration(p=>p.timing.uncovered),infrastructureIdle:duration(p=>p.timing.infrastructureIdle),
        longestGap:round(Math.max(...x.participants.map(p=>p.timing.longestGap))/second),
        authorizedWait:duration(p=>p.timing.authorizedWait),guardWait:duration(p=>p.timing.guardWait),
        expired:duration(p=>p.timing.expired),noExecutableBehavior:duration(p=>p.timing.noExecutableBehavior),
        feedback:{generated:produced,delivered:total(p=>p.metrics.delivered),pending:total(p=>p.feedbackPending),
          overflow:total(p=>p.feedbackOverflow)},
        requests:total(p=>p.metrics.calls),retries:total(p=>p.requests.filter(r=>r.attempt>1).length),
        acceptedTriggers:count(x.participants.flatMap(p=>p.requests.filter(r=>r.status==='accepted').map(r=>r.trigger))),
        budgetExhaustions:total(p=>p.metrics.exhaustions)};
    })
  };
}
writeFileSync(out+'summary.json',JSON.stringify({baseline:summarize(out+'baseline/benchmark.json'),
  updated:summarize(out+'benchmark.json')},null,2));
