import {GoogleGenAI} from '@google/genai';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {setTimeout as sleep} from 'node:timers/promises';
import {second,sides,type Config,type Pair,type Side} from '../src/v26/config.js';
import {authorize,condition,execute,feedback,motionLease,parsePlan,planLimits,strategicPrompt,type Coach,type Execution,type Feedback} from '../src/v26/controller.js';
import {deadline,maxTicks,maxTime,observation,type Packet} from '../src/v26/game.js';
import {append,begin,load,type Source,type Interruption} from '../src/v26/replay.js';
import {BehaviorExecution,digest,parseBehavior,type Behavior,type Representation} from './gameplay-v26-behavior.js';

export const limits={perSide:10,total:20,requestMs:8000,overallMs:60000};
export type Cadence='sixth'|'eight-seconds'|'lifecycle'|'reserved'|'renewal'|'renewal-credit'|'renewal-paced';
export const selectedCadence:Cadence='renewal-paced';
const pause=(c:Config,cadence:Cadence)=>cadence==='sixth'?Math.ceil(maxTime(c)/6):cadence==='eight-seconds'?8*second:10*second;
type ModelReceipt={model?:string;input?:number;output?:number};
export type Provider=(input:ReturnType<typeof strategicPrompt>,signal:AbortSignal,receipt:(metadata:ModelReceipt)=>void)=>Promise<unknown>;
type Metric={calls:number;covered:number;expired:number;uncovered:number;waiting:number;eligible:number;urgent:number;delivered:number;dropped:number;exhaustions:number};
const metrics=():Metric=>({calls:0,covered:0,expired:0,uncovered:0,waiting:0,eligible:0,urgent:0,delivered:0,dropped:0,exhaustions:0});
const timing=()=>({eligible:0,covered:0,expired:0,uncovered:0,infrastructureIdle:0,longestGap:0,
  longestInfrastructureGap:0,executable:0,blocked:0,planIdle:0,
  authorizedWait:0,guardWait:0,noExecutableBehavior:0,feedbackProduced:0});
type RequestTrace=ModelReceipt&{tick:number;trigger:string;status:string;attempt:number;ms:number;plan?:Execution['plan'];behavior?:Behavior;
  coachingRevision:string;memoryRevision?:number;failure?:string};
export type UpstreamOptions={representation?:Representation;horizon:20|30;matchScope?:boolean;earliest?:boolean;matchId?:string;diagnostics?:boolean};
type Reference=ReturnType<BehaviorExecution['reference']>;
export type AuthorizationTrace={tick:number;side:Side;origin:Source;decision:'lease-release'|'lease-resume'|'authored';
  ref?:Reference;leaseMovement?:'release'|'resume';packet:Packet;receipts:ReturnType<typeof append>['receipts'][number]};
type Agent={execution?:Execution;behavior?:BehaviorExecution;revision:number;planDigest?:string;last:number;urgent?:'respawn'|'phase'|'invalidated';events:Feedback[];
  dropped:number;life:number;motion:boolean;metric:Metric;trace:RequestTrace[];timing:ReturnType<typeof timing>;
  gap:number;idleGap:number;guardSince?:number};
const agent=():Agent=>({revision:0,last:-Infinity,events:[],dropped:0,life:1,motion:false,metric:metrics(),trace:[],timing:timing(),gap:0,idleGap:0});
export async function requestWithin<T>(work:()=>Promise<T>,signal:AbortSignal) {
  let abort!:()=>void;
  const deadline=new Promise<never>((_,reject)=>{
    abort=()=>reject(signal.reason);
    if(signal.aborted) abort();else signal.addEventListener('abort',abort,{once:true});
  });
  try {signal.throwIfAborted();return await Promise.race([work(),deadline]);}
  finally {signal.removeEventListener('abort',abort);}
}
export async function runTrial(c:Config,coaches:Pair<Coach>,provider:Provider,cadence:Cadence,signal:AbortSignal,
  source:Extract<Source,'injected-provider'|'operator-attested-gemini'>='injected-provider',experiment?:UpstreamOptions) {
  if(experiment?.earliest&&source!=='injected-provider') throw Error('Scheduling diagnostics are injected-only');
  const r=begin(c,source), players:Pair<Agent>=[agent(),agent()];
  const matchId=experiment?(experiment.matchId??randomUUID()):'';
  const matchDigest=experiment?digest({matchId,config:c}):'';
  const evaluationMs:number[]=[], provenance:AuthorizationTrace[]=[];
  const diagnostics:{tick:number;side:Side;status:string;reason?:string;stage?:string|number;trigger:string|null}[]=[];
  const started=performance.now();
  const renewal=cadence==='renewal'||cadence==='renewal-credit'||cadence==='renewal-paced';
  const overall=AbortSignal.timeout(limits.overallMs);
  const bounded=AbortSignal.any([signal,overall]);
  const canRequest=(p:Agent)=>p.metric.calls<limits.perSide&&players[0].metric.calls+players[1].metric.calls<limits.total;
  const stop=(reason:Interruption['reason'],side?:Side)=>{r.interruption={kind:'technical-interrupted',reason,...(side===undefined?{}:{side})};};
  const select=(p:Agent,v:ReturnType<typeof observation>)=>{
    if(!p.behavior&&!p.execution) return undefined;
    const start=experiment?performance.now():0;
    const blocked=p.events.some(event=>event.kind==='collision'&&event.time===v.time);
    const selected=p.behavior?p.behavior.next(v):execute(p.execution!,v,undefined,blocked);
    if(experiment) evaluationMs.push(performance.now()-start);
    return selected;
  };
  for(let tick=0;tick<maxTicks(c)&&!r.final.result&&!r.interruption;tick++) {
    if(bounded.aborted) {stop(signal.aborted?'cancelled':'timeout');break;}
    const state=r.final, views=sides.map(side=>observation(c,state,side));
    const packets:[Packet|null,Packet|null]=[null,null];
    const selections=players.map((p,i)=>select(p,views[i]));
    const triggers=players.map((p,i)=>{
      if(!views[i].agent.hp) return null;
      const status=selections[i]?.status;
      const invalid=status==='invalidated'||status==='expired'||status==='completed';
      const urgent=p.urgent;
      if(renewal) {
        const view=views[i], selection=selections[i], e=p.execution;
        const heldAction=view.agent.attackIn!==null||view.agent.reloadIn!==null||view.match.progress?.by==='self';
        if(status==='waiting') p.guardSince??=state.time;
        else p.guardSince=undefined;
        if(!Number.isFinite(p.last)) return 'scheduled';
        const paced=cadence==='renewal-paced'&&c.mode==='score-deathmatch';
        if(urgent==='phase'&&state.time-p.last>=second||urgent==='respawn'&&!paced) return urgent;
        if(state.time-p.last<second||heldAction) return null;
        const finish=p.behavior?.expires??(e?Math.min(e.expires,e.stageTime+e.plan.stages.slice(e.index)
          .reduce((units,stage)=>units+Math.ceil(stage.forMs*second/1000/c.step)*c.step,0)):state.time);
        const covered=status==='executing'||status==='waiting';
        const stalledGuard=p.guardSince!==undefined&&state.time-p.guardSince>=2*second;
        const active=(p.behavior??e)?.active;
        const explicitWait=status==='executing'&&active&&Object.keys(active).length===0;
        const imminent=!explicitWait&&finish<=state.time+c.step&&finish<deadline(c,state);
        const need=!covered||imminent||urgent==='invalidated'||stalledGuard&&!paced;
        if(!need||covered&&deadline(c,state)-state.time<=c.step) return null;
        // Score can borrow only from the next two simulated seconds and keeps a late renewal in reserve.
        const reserve=2+Math.floor(8*(state.time+(paced&&!covered?2*second:0))/maxTime(c));
        const credit=cadence==='renewal-credit'&&!covered?1:0;
        if(!experiment?.earliest&&(p.metric.calls>=reserve+credit||paced&&p.metric.calls===limits.perSide-1&&maxTime(c)-state.time>4*second)) return null;
        return urgent==='respawn'?urgent:!covered?status??'unavailable':stalledGuard?'guard-stalled':imminent?'handoff':'invalidated';
      }
      if((status==='invalidated'||invalid&&cadence==='lifecycle')&&!urgent) p.urgent='invalidated';
      if(urgent==='respawn'||urgent==='phase'&&state.time-p.last>=second) return urgent;
      const reserve=2+Math.floor(8*state.time/maxTime(c));
      if(p.urgent&&state.time-p.last>=second&&(cadence!=='reserved'||p.metric.calls<reserve)) return p.urgent;
      if(cadence==='reserved'&&p.metric.calls>=reserve) return null;
      return state.time-p.last>=pause(c,cadence)?'scheduled':null;
    });
    const attempted=await Promise.allSettled(players.map(async(p,i)=>{
      const trigger=triggers[i];
      if(!trigger||!canRequest(p)) return;
      const side=i as Side;
      const prompt=strategicPrompt(c,side,views[i],coaches[i],p.events,p.dropped,p.execution);
      const recovered={transient:0,plan:0};
      for(let n=1;canRequest(p);n++) {
        p.metric.calls++;
        const deadline=AbortSignal.any([bounded,AbortSignal.timeout(limits.requestMs)]);
        const start=performance.now();
        let status='invalid';
        let failure:string|undefined;
        let plan:Execution['plan']|undefined;
        let behavior:Behavior|undefined;
        let metadata:ModelReceipt={};
        try {
          const answer=await requestWithin(()=>provider(prompt,deadline,receipt=>{metadata=receipt;}),deadline);
          if(experiment?.representation) {
            behavior=parseBehavior(answer,c,experiment.representation,experiment.horizon,experiment.matchScope);
            p.behavior=new BehaviorExecution(behavior,views[i],side,++p.revision,matchDigest);
          } else {
            plan=parsePlan(answer,c);
            p.execution=authorize(plan,state.time);
            if(experiment) {p.revision++;p.planDigest=digest(plan);}
          }
          p.last=state.time;
          if(trigger!=='scheduled') p.metric.urgent++;
          status='accepted';p.metric.delivered+=p.events.length;p.metric.dropped+=p.dropped;
          p.events=[];p.dropped=0;p.urgent=undefined;
          selections[i]=select(p,views[i]);
          p.guardSince=selections[i]?.status==='waiting'?state.time:undefined;
          return;
        } catch(error) {
          const code=(error as {status?:number})?.status;
          status=deadline.aborted?'timeout':code?String(code):'invalid-or-provider';
          failure=deadline.aborted?'timeout':code?'provider-http-'+code:error instanceof ZodError?'plan-validation':
            error instanceof SyntaxError?'response-json':error instanceof Error&&error.message==='Invalid bounded plan'?'plan-contract':'provider-or-plan';
          const category=code===503||deadline.aborted?'transient':'plan';
          if(recovered[category]>=(category==='transient'?2:1)||code&&code!==503||bounded.aborted||!canRequest(p))
            throw {reason:signal.aborted?'cancelled':deadline.aborted?'timeout':'provider',side};
          recovered[category]++;
          if(code===503&&source==='operator-attested-gemini')
            await sleep(600*2**(recovered.transient-1)+Math.floor(Math.random()*300));
        } finally {
          p.trace.push({...metadata,tick:state.tick,trigger,status,attempt:n,ms:Math.round(performance.now()-start),plan,failure,
            ...(behavior?{behavior}:{}),
            coachingRevision:prompt.coaching.revision,memoryRevision:prompt.memory?.revision});
        }
      }
    }));
    const failed=attempted.find(r=>r.status==='rejected');
    if(failed?.status==='rejected') {stop(failed.reason.reason,failed.reason.side);break;}
    if(experiment?.diagnostics) for(const side of sides) {
      const selected=selections[side], p=players[side];
      diagnostics.push({tick:state.tick,side,status:selected?.status??'unavailable',reason:selected?.reason,
        stage:p.behavior?.step??p.execution?.index,trigger:triggers[side]});
    }
    for(const side of sides) {
      const p=players[side], v=views[side];
      if(!v.agent.hp) continue;
      p.metric.eligible++;
      const selection=selections[side];
      const valid=selection?.status==='executing'||selection?.status==='waiting';
      if(valid) p.metric.covered++;else p.metric.uncovered++;
      if(selection?.status==='waiting') p.metric.waiting++;
      if(selection?.status==='expired') p.metric.expired++;
      const draining=v.agent.attackIn!==null||v.agent.reloadIn!==null||v.match.progress?.by==='self';
      if(!valid&&!canRequest(p)&&!draining) {
        p.metric.exhaustions++;stop('budget',side);break;
      }
      const input=motionLease(selection,p.behavior??p.execution,v,p.motion);
      p.motion=input.motion;
      packets[side]=input.packet;
    }
    if(r.interruption) break;
    const frame=append(r,packets);
    for(const side of sides) {
      const p=players[side], v=observation(c,frame.state,side);
      const before=views[side];
      const selected=selections[side];
      const attemptedPacket=packets[side];
      if(experiment&&attemptedPacket) {
        const ref:Reference|undefined=p.behavior?.reference()??(p.execution&&p.planDigest?{contract:p.planDigest,match:matchDigest,side,
          revision:p.revision,scope:'life',life:before.agent.life,acceptedLife:before.agent.life,
          expires:p.execution.expires,step:`stage-${p.execution.index}`,branch:p.execution.branch}:undefined);
        const active=(p.behavior??p.execution)?.active;
        const leaseMovement=attemptedPacket.movement&&!selected?.packet?.movement?
          attemptedPacket.movement.kind==='stop'&&!active?.movement?'release':'resume':undefined;
        const releaseOnly=leaseMovement==='release'&&!selected?.packet;
        provenance.push({tick:state.tick,side,origin:source,decision:releaseOnly?'lease-release':selected?.packet?'authored':'lease-resume',
          ref:releaseOnly?undefined:ref,leaseMovement,packet:attemptedPacket,receipts:frame.receipts[side]});
      }
      if(before.agent.hp) {
        const elapsed=frame.state.time-state.time, m=p.timing;
        const covered=selected?.status==='executing'||selected?.status==='waiting';
        const active=(p.behavior??p.execution)?.active;
        const fighter=frame.state.fighters[side], prior=state.fighters[side];
        const ongoing=!!(prior.firing||prior.reloadDue||state.core?.channel?.side===side);
        const progressed=fighter.life===prior.life&&(fighter.position.x!==prior.position.x||fighter.position.y!==prior.position.y);
        const action=frame.receipts[side].some(x=>x.accepted&&x.channel!=='movement'&&x.channel!=='facing');
        const blocked=frame.events.some(e=>e.kind==='collision'&&e.side===side);
        m.eligible+=elapsed;
        if(covered) {m.covered+=elapsed;p.gap=0;}
        else {m.uncovered+=elapsed;p.gap+=elapsed;m.longestGap=Math.max(m.longestGap,p.gap);}
        if(selected?.status==='expired') m.expired+=elapsed;
        if(progressed||action||ongoing) {m.executable+=elapsed;p.idleGap=0;}
        else {
          m.noExecutableBehavior+=elapsed;
          if(!covered) {
            m.infrastructureIdle+=elapsed;p.idleGap+=elapsed;
            m.longestInfrastructureGap=Math.max(m.longestInfrastructureGap,p.idleGap);
          } else {
            p.idleGap=0;
            if(blocked) m.blocked+=elapsed;
            else if(selected?.status==='waiting') m.guardWait+=elapsed;
            else if(active&&Object.keys(active).length===0) m.authorizedWait+=elapsed;
            else m.planIdle+=elapsed;
          }
        }
      } else {p.gap=0;p.idleGap=0;}
      if(v.agent.life!==p.life) {p.life=v.agent.life;p.urgent='respawn';}
      if(!v.agent.hp) {p.execution=undefined;p.motion=false;p.urgent=undefined;}
      else if(frame.state.core?.phase!==state.core?.phase&&!frame.state.result&&p.urgent!=='respawn') p.urgent='phase';
      if(p.execution&&selected?.packet&&frame.receipts[side].length&&frame.receipts[side].every(receipt=>!receipt.accepted)) {
        const stage=p.execution.plan.stages[p.execution.index];
        if(!stage?.repeat) p.execution=undefined;
        if(!p.urgent) p.urgent='invalidated';
      }
      if(p.behavior&&selected?.packet&&frame.receipts[side].length&&frame.receipts[side].every(receipt=>!receipt.accepted)) {
        if(!p.behavior.repeat) p.behavior.end();
        if(!p.urgent) p.urgent='invalidated';
      }
      const next=feedback(frame.events,frame.receipts[side],v,side);
      p.timing.feedbackProduced+=next.length;
      p.events.push(...next);
      if(p.events.length>planLimits.eventBuffer) {
        const n=p.events.length-planLimits.eventBuffer;p.events.splice(0,n);p.dropped+=n;
      }
      if(p.behavior&&(before.agent.life!==v.agent.life||before.agent.hp&&!v.agent.hp)) {
        p.events=[];p.dropped=0;p.guardSince=undefined;
        if(!v.agent.hp) p.behavior.next(v);
      }
    }
  }
  const recording=load(r).recording;
  return {recording,preparationMs:Math.round(performance.now()-started),participants:players.map(p=>({metrics:p.metric,timing:p.timing,
    feedbackPending:p.events.length,feedbackOverflow:p.metric.dropped+p.dropped,requests:p.trace})),
    upstream:experiment?{version:1,matchId,match:matchDigest,replay:digest(recording),evaluationMs,provenance,
      ...(experiment.diagnostics?{diagnostics}:{})}:undefined};
}
const point={type:'object',properties:{x:{type:'integer'},y:{type:'integer'}},required:['x','y']};
const textField={type:'string'};
const packetFields={type:'object',additionalProperties:true,properties:{
  movement:{type:'object',properties:{kind:textField,gait:textField,to:point,direction:point},required:['kind']},
  attack:textField,core:textField,
}};
const providerPlanSchema={type:'object',properties:{version:{type:'integer'},expiresInMs:{type:'integer'},
  stages:{type:'array',items:{type:'object',additionalProperties:true,properties:{forMs:{type:'integer'},packet:packetFields,
    when:textField,until:textField,alternative:packetFields},
  required:['packet','forMs']}}},required:['version','expiresInMs','stages']};

type ModelOutput={raw:string;usage:ModelReceipt;finish?:string;time:number};
export function geminiProvider(key:string,model:string,onResponse?:(response:ModelOutput)=>void):Provider {
  const client=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
  return async (input,abortSignal,receipt)=>{
    const message='Author the shortest useful plan for this fictional arcade match. Return version 1, expiresInMs (34–20000), and 1–4 stages. Each stage needs forMs (34–15000) and packet. Omit unused fields. Movement is {kind:"stop"}, {kind:"goal",gait:"walk"|"run",to:{x,y}}, or {kind:"steer",gait,direction:{x,y}}. Use the numeric world coordinates from the observation. Other packet fields are attack ("standard"|"precision"), core ("start"|"cancel"), reload (true), jump (true), facing ({x,y}), or posture ("upright"|"crouch"). Use {} to wait. Each tag packet is one attempt. Optional repeat uses everyMs (250–15000) and count (2–12).';
    const rules=`When legal.core is true, {"core":"start"} starts Core on this spot. The site is a zone, not a single point. Public Core landmarks are optional destinations inside the zone. If you choose one, copy its coordinates into movement.to. Do not combine Core start with movement to a goal or direction, a tag, reload, jump or posture change. Only add an alternative in a stage with when. Conditions: ${condition.options.join(', ')}. Use at-goal only as until on a goal movement stage. action-finished tracks tag and reload only. core-idle means you are not holding Core. movement-blocked is true at the boundary immediately after your own collision. Use until to end a stage on an observed checkpoint and proceed to the next authored stage. For example, an approach may end at core-available. Historical contact is a past sample.`;
    const {site,siteRadius}=input.view.match;
    const offset=Math.floor((siteRadius??0)*5/8);
    const coreLandmarks=site&&offset?{west:{x:site.x-offset,y:site.y},east:{x:site.x+offset,y:site.y}}:undefined;
    const reply=await client.models.generateContent({model,contents:JSON.stringify({message,rules,coreLandmarks,input}),config:{
      abortSignal,responseMimeType:'application/json',responseJsonSchema:providerPlanSchema,maxOutputTokens:512,candidateCount:1}});
    const usage={model:reply.modelVersion,input:reply.usageMetadata?.promptTokenCount,output:reply.usageMetadata?.candidatesTokenCount};
    receipt(usage);
    const raw=reply.text;
    if(onResponse) onResponse({raw:raw?.replaceAll(key,'[redacted]')??'',usage,finish:reply.candidates?.[0]?.finishReason,time:input.view.time});
    if(!raw||raw.length>8000) throw Error('Invalid provider output');
    return JSON.parse(raw) as unknown;
  };
}
export function runGeminiV26(key:string,model:string,config:Config,coaches:Pair<Coach>,signal:AbortSignal,onResponse?:(response:ModelOutput)=>void) {
  return runTrial(config,coaches,geminiProvider(key,model,onResponse),selectedCadence,signal,'operator-attested-gemini');
}
