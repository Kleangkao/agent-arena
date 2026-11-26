import {createHash} from 'node:crypto';
import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {GoogleGenAI} from '@google/genai';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {authorize,condition,execute,motionLease,parsePlan,planLimits,strategicPrompt} from '../src/v26/controller.js';
import {developmentController} from '../src/v26/development.js';
import {other,second} from '../src/v26/config.js';
import {observation,type Inputs} from '../src/v26/game.js';
import {append,load,type Recording} from '../src/v26/replay.js';
import {limits,requestWithin} from '../server/gameplay-v26.js';
import {wireSchema} from './validate-v26-upstream-live.js';

const directory='.arena-data/v27';
const settings=z.object({
  file:z.string().min(1),line:z.number().int().positive(),project:z.string().min(1).max(80),
  model:z.string().regex(/^gemini-[a-z0-9.-]+$/),tier:z.literal('Free'),billingEnabled:z.literal(false),
  verifiedAt:z.iso.datetime(),rpm:z.number().int().positive(),tpm:z.number().int().positive(),rpd:z.number().int().positive(),
}).strict();
const coaching=[
  {label:'initiative',text:'Take initiative. Look for opportunities to make progress rather than waiting unnecessarily. Adapt when circumstances become unfavorable.'},
  {label:'patience',text:'Be patient and deliberate. Preserve resources, avoid unnecessary commitments, and act when a meaningful opportunity appears.'},
];
const responseEnvelope={type:'object',properties:{version:{type:'integer'},expiresInMs:{type:'integer'},
  stages:{type:'array',items:{type:'object',additionalProperties:true}}},required:['version','expiresInMs','stages'],additionalProperties:false};
const pointEnvelope={type:'object',properties:{x:{type:'integer'},y:{type:'integer'}},required:['x','y']};
const packetEnvelope={type:'object',additionalProperties:true,properties:{movement:{type:'object',additionalProperties:true,
  properties:{kind:{type:'string'},gait:{type:'string'},to:pointEnvelope,direction:pointEnvelope},required:['kind']}}};
export const matchedEnvelope={...responseEnvelope,properties:{...responseEnvelope.properties,stages:{type:'array',items:{
  type:'object',additionalProperties:true,properties:{forMs:{type:'integer'},packet:packetEnvelope,alternative:packetEnvelope},
  required:['forMs','packet']}}}};
export const generation={responseMimeType:'application/json',maxOutputTokens:512,candidateCount:1};
export const followupFormat=[
  `Return the plan object directly. Use version 1, expiresInMs 34–${planLimits.maxPlanMs}, and 1–${planLimits.stages} stages.`,
  `Each stage requires forMs (34–${planLimits.maxStageMs}) and packet (object). Optional keys: when, until, interruptWhen, alternative (a packet when when is false), and repeat ({everyMs:250–15000,count:2–12}). Use integers. Omit unused keys.`,
  `Conditions: ${condition.options.join(', ')}. at-goal is only an until condition with goal movement.`,
  'Packet keys are optional and may be combined when compatible. movement is {kind:"stop"}, {kind:"steer",gait,direction:{x,y}}, or {kind:"goal",gait,to:{x,y}}. gait is "walk" or "run". A steer direction or facing:{x,y} is a nonzero integer vector bounded by directionLimit. A goal is an in-arena position in world units.',
  'Other packet keys: posture ("upright" or "crouch"), facing, jump (true), attack ("standard" or "precision"), reload (true), core ("start" or "cancel"). Use {} for an explicit wait. Use the current observation and legal flags; a past contact is not a current target. A pending Activator can commit to Core when eligible.',
].join('\n');
const historical='evidence/gameplay-v26-upstream/probe-objective.json';
const ordinary='evidence/gameplay-v26-upstream/finite-objective.json';

export function snapshot(file:string,label:string,pick:(view:ReturnType<typeof observation>)=>boolean,side:0|1=0) {
  const replay=load(JSON.parse(readFileSync(file,'utf8')));
  const config=replay.recording.config;
  const frame=replay.frames.find(({state})=>pick(observation(config,state,side)));
  if(!frame) throw Error('Required filtered snapshot missing: '+label);
  return {file,label,side,config,recording:replay.recording,state:frame.state,view:observation(config,frame.state,side)};
}

export const snapshotSet=()=>[
  snapshot(historical,'historical-only',v=>!!v.historical&&!v.current&&v.match.phase==='pending'),
  snapshot(ordinary,'core-eligible',v=>v.legal.core&&v.match.phase==='pending'),
  snapshot(ordinary,'defender-active',v=>v.match.phase==='active'&&v.agent.hp>0,1),
];

export function executeLocally(fixture:ReturnType<typeof snapshot>,plan?:ReturnType<typeof parsePlan>,duration=4*second,clearPriorMotion=false) {
  const {config,side,view}=fixture;
  const replay:Recording={...fixture.recording,source:plan?'operator-attested-gemini':'development-policy',final:fixture.state,
    transcript:fixture.recording.transcript.filter(([tick])=>tick<=fixture.state.tick),
    observations:fixture.recording.observations.filter(([tick])=>tick<=fixture.state.tick),interruption:null};
  let state=fixture.state, moving=clearPriorMotion&&view.agent.moving;
  const opponent=other(side);
  const scripted=developmentController(config,opponent,'steady',23);
  const baseline=developmentController(config,side,'steady',23);
  const execution=plan?authorize(plan,view.time):undefined;
  const boundaries=[];
  while(!state.result&&state.time-view.time<duration) {
    const own=observation(config,state,side);
    const selected=execution?execute(execution,own):undefined;
    const leased=motionLease(selected,execution,own,moving);
    moving=leased.motion;
    const ownPacket=execution?leased.packet:baseline(own);
    const rivalPacket=scripted(observation(config,state,opponent));
    const packets:Inputs=side===0?[ownPacket,rivalPacket]:[rivalPacket,ownPacket];
    const next=append(replay,packets);
    boundaries.push({tick:state.tick,position:own.agent.position,status:selected?.status,reason:selected?.reason,
      stage:execution?.index,branch:execution?.branch,packet:packets[side],receipts:next.receipts[side],events:next.events,
      observation:{current:own.current,historical:own.historical,legal:own.legal,ammo:own.agent.ammo,phase:own.match.phase}});
    state=next.state;
  }
  if(!state.result) replay.interruption={kind:'technical-interrupted',reason:'cancelled'};
  load(replay);
  return {source:execution?'local-execution-of-gemini-specification':'scripted-control',boundaries,final:state,replay};
}

async function main() {
  const [mode,credentialFile]=process.argv.slice(2);
  const compatibility=mode==='compatibility';
  const balanced=mode==='balanced';
  const interfaceTrial=compatibility||balanced||mode==='inspect-interface';
  const resilient=interfaceTrial||mode==='matched'||mode==='inspect-matched';
  const followup=resilient||mode==='followup'||mode==='inspect-followup';
  let config={...generation,responseJsonSchema:resilient?matchedEnvelope:followup?responseEnvelope:wireSchema()};
  const fixtures=snapshotSet();
  const syntaxExample=interfaceTrial?{
    note:'Syntax example only with illustrative coordinates. Choose your own action and destination. If you choose the objective as a goal, use the numeric x and y in view.match.site. The x and y axes are the same fixed-point world axes as view.agent.position. Do not use symbolic target names, screen pixels, or tile indices.',
    plan:parsePlan({version:1,expiresInMs:1000,stages:[{forMs:1000,packet:{movement:{kind:'goal',gait:'walk',to:{x:3000,y:3000}}}}]},fixtures[0].config),
  }:undefined;
  if(mode==='inspect') {
    console.log(JSON.stringify(fixtures.map(({label,file,side,view:v})=>({label,file,side,time:v.time,
      historical:!!v.historical,current:!!v.current,core:v.legal.core,role:v.match.role,phase:v.match.phase})),null,2));
    return;
  }
  if(mode==='inspect-pair'||mode==='inspect-followup'||mode==='inspect-matched'||mode==='inspect-interface') {
    const fixture=fixtures[0];
    const prompts=coaching.map(({text})=>strategicPrompt(fixture.config,fixture.side,fixture.view,{text,revision:'v28-pair'},[],0));
    const digestWithoutCoachingText=(prompt:typeof prompts[number])=>createHash('sha256').update(
      JSON.stringify({...prompt,coaching:{...prompt.coaching,text:''}})).digest('hex');
    if(digestWithoutCoachingText(prompts[0])!==digestWithoutCoachingText(prompts[1]))
      throw Error('Probe conditions differ.');
    console.log(JSON.stringify({snapshot:fixture.label,rulesVersion:fixture.config.rulesVersion,coaching,
      sharedContext:digestWithoutCoachingText(prompts[0]),generation:config,format:followup?followupFormat:undefined,syntaxExample,
      sampling:'provider-default',sdkAttempts:1,requestTimeoutMs:limits.requestMs,generationRequests:0},null,2));
    return;
  }
  if(mode!=='stage1'&&mode!=='stage2'&&!followup) throw Error('Use inspect, inspect-pair, inspect-followup, inspect-matched, stage1, stage2, followup or matched.');
  const selected=mode==='stage2'?fixtures:fixtures.slice(0,1);
  // The two original 400s and the follow-up 503 count toward the eight-attempt experiment cap.
  const calls=compatibility?6:balanced?10:resilient?5:2*selected.length;
  const arms=compatibility?[{label:'interface-only',text:'For this compatibility check, include one movement intent of your choosing.'}]:coaching;
  let file=credentialFile,line=1,model='gemini-3.5-flash-lite',project:string|undefined;
  if(mode==='stage2') {
    const stored=directory+'/free-project.json';
    if(!existsSync(stored)) throw Error('The intended credential line and its verified Free-tier project are missing.');
    const c=settings.safeParse(JSON.parse(readFileSync(stored,'utf8')));
    if(!c.success) throw Error('Invalid verified Free project configuration.');
    ({file,line,model,project}=c.data);
    const age=Date.now()-Date.parse(c.data.verifiedAt);
    if(age<0||age>15*60_000||c.data.rpm<calls||c.data.rpd<calls||c.data.tpm<calls*6000)
      throw Error('Verified Free capacity is stale or insufficient.');
    const approved=directory+'/stage1-useful.txt';
    if(!existsSync(approved)||readFileSync(approved,'utf8').trim()!=='validated-two-useful-plans')
      throw Error('Stage 2 requires review of both accepted Stage 1 specifications.');
  }
  if(!file) throw Error('The selected credential file path is required.');
  const key=readFileSync(file,'utf8').split(/\r?\n/)[line-1]?.trim().replace(/^['"]|['"]$/g,'');
  if(!key||!/^[\x21-\x7e]{25,100}$/.test(key)) throw Error('The selected credential line is unavailable.');
  const ai=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
  // Keep the original evidence when rerunning local inspection.
  const compatibilityEvidence=directory+'/v28-interface-compatibility.jsonl';
  const ledger=compatibility?compatibilityEvidence:balanced?directory+'/v28-interface-balanced.jsonl':
    directory+(resilient?'/v28-coaching-matched.jsonl':followup?'/v28-coaching-followup.jsonl':mode==='stage1'?'/v28-coaching.jsonl':'/stage2.jsonl');
  if(balanced) {
    const evidence=readFileSync(compatibilityEvidence,'utf8').trim().split('\n').map(line=>JSON.parse(line));
    const proven=evidence.find(row=>row.kind==='compatibility-proven');
    if(!proven) throw Error('Interface compatibility has not been demonstrated.');
    config=proven.generation;
  }
  mkdirSync(directory,{recursive:true});
  let keyId:string|undefined;
  if(mode==='stage2') {
    keyId=createHash('sha256').update(key).digest('hex');
    const previous=readFileSync(directory+'/stage1.jsonl','utf8').trim().split('\n').map(line=>JSON.parse(line));
    if(Date.now()-Date.parse(previous[0]?.utc)<60_000||
      previous.filter(row=>row.kind==='attempt-result'&&row.status==='accepted').length!==2||
      previous[0]?.keyId!==keyId||previous[0]?.model!==model) throw Error('Stage 2 must use the reviewed credential and model.');
  }
  writeFileSync(ledger,JSON.stringify({kind:'experiment',model,...(mode==='stage2'?{keyId,project}:{}),calls,
    generation:config,sampling:'provider-default',sdkAttempts:1,requestTimeoutMs:limits.requestMs,utc:new Date().toISOString()})+'\n',{flag:'wx'});
  const log=(row:object)=>appendFileSync(ledger,JSON.stringify(row)+'\n');
  const signal=AbortSignal.timeout(limits.overallMs);
  let attempted=0,accepted=0;
  let delayMs=0, retry=0;
  batch: for(const fixture of selected) {
    const completed=new Set<number>();
    for(let turn=0;attempted<calls&&completed.size<arms.length;turn++) {
      const index=turn%arms.length;
      if(completed.has(index)) continue;
      const coach=arms[index];
      if(!resilient&&signal.aborted) break batch;
      if(delayMs) await sleep(delayMs);
      const prompt=strategicPrompt(fixture.config,fixture.side,fixture.view,{text:coach.text,revision:'v28-pair'},[],0);
      const requestTimeout=AbortSignal.timeout(limits.requestMs);
      const deadline=resilient?requestTimeout:AbortSignal.any([signal,requestTimeout]);
      const began=performance.now();
      const attempt=++attempted;
      const movementExample=syntaxExample??(resilient&&fixture.view.match.site?{packet:{movement:{kind:'goal',gait:'walk',to:fixture.view.match.site}},
        note:'Format example only. Choose your own action. Do not use a string like "site" for coordinates.'}:undefined);
      log({kind:'attempt-start',attempt,label:fixture.label,coach:coach.label,prompt,movementExample});
      let spec:ReturnType<typeof parsePlan>|undefined;
      try {
        const reply=await requestWithin(()=>ai.models.generateContent({model,contents:JSON.stringify({
          instruction:'Author a bounded plan for this fictional arcade match. Obey the current mode goal. Historical contact is a past sample. Specify only authorized game packets and conditions. An empty packet explicitly waits.',
          format:followup?followupFormat:undefined,movementExample,prompt,
        }),config:{...config,abortSignal:deadline}}),deadline);
        const usage={model:reply.modelVersion,input:reply.usageMetadata?.promptTokenCount,output:reply.usageMetadata?.candidatesTokenCount,
          thoughts:reply.usageMetadata?.thoughtsTokenCount};
        const raw=reply.text;
        let json='no-content',validation:unknown='not-run';
        if(raw) {
          let parsed:unknown;
          try {parsed=JSON.parse(raw);json='parsed';} catch {json='invalid-json';}
          if(json==='parsed') {
            try {spec=parsePlan(parsed,fixture.config);validation='accepted';}
            catch(error) {validation=error instanceof z.ZodError?error.issues.map(({path,code,message})=>({path,code,message})):
              {message:error instanceof Error?error.message:'Invalid bounded plan'};}
          }
        }
        if(spec) accepted++;
        log({kind:'attempt-result',attempt,status:spec?'accepted':'invalid',ms:Math.round(performance.now()-began),
          provider:'success',finish:reply.candidates?.[0]?.finishReason,json,validation,usage,spec,response:raw?.replaceAll(key,'[redacted]')});
        if(followup&&!resilient&&!raw) break batch;
        if(compatibility&&!spec&&raw) break batch;
        retry=0;
        delayMs=0;
      } catch(error) {
        const provider=error as {status?:number;message?:string};
        const status=provider.status;
        log({kind:'attempt-result',attempt,status:deadline.aborted?'timeout':status??'provider',
          ms:Math.round(performance.now()-began),error:provider.message?.replaceAll(key,'[redacted]').slice(0,1200)});
        if(!resilient&&(followup||status===429||status===401||status===403||signal.aborted)) break batch;
        if(resilient&&!balanced&&status===400&&config.responseJsonSchema&&/schema|response.?format|constraint/i.test(provider.message??'')) {
          config={...config,responseJsonSchema:undefined};
          log({kind:'generation-change',attempt,generation:config,discardedAccepted:accepted});
          accepted=0;
          completed.clear();
          turn=-1;
          continue;
        }
        if(resilient&&status!==429&&status!==503&&!deadline.aborted&&status!==undefined) break batch;
        retry++;
        if(resilient&&status===429) {
          const seconds=Number(/"retryDelay"\s*:\s*"([\d.]+)s"/.exec(provider.message??'')?.[1]??60);
          delayMs=Math.max(1000,Math.ceil(seconds*1000))+Math.floor(Math.random()*500);
          log({kind:'retry-delay',attempt,delayMs,status});
          continue;
        }
      }
      if(spec) {
        for(const state of resilient?[fixture]:fixtures) {
          const execution=executeLocally(state,spec,interfaceTrial?20*second:4*second);
          log({kind:'local-execution',attempt,label:state.label,execution});
          if(compatibility&&execution.boundaries.some(frame=>frame.receipts.some(receipt=>receipt.accepted&&receipt.channel==='movement'))) {
            log({kind:'compatibility-proven',attempt,generation:config});
          }
        }
        if(compatibility) break batch;
      }
      if(!resilient||spec) completed.add(index);
      if(resilient&&!spec&&retry>0&&attempted<calls) {
        delayMs=Math.min(20_000,1000*2**(retry-1))+Math.floor(Math.random()*500);
        log({kind:'retry-delay',attempt,delayMs});
      }
    }
  }
  for(const state of selected) log({kind:'scripted-comparison',label:state.label,execution:executeLocally(state)});
  console.log(JSON.stringify({mode,attempted,accepted,ledger}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{
  const e=error as {message?:string;code?:string;status?:number};
  const safe=/^(Use inspect|The intended credential|Invalid verified|Verified Free|Required filtered|Stage 2|The selected credential|Model metadata)/.test(e.message??'');
  console.error(safe?e.message:e.code==='EEXIST'?'This experiment already has saved evidence.':
    e.status?'Provider metadata failed (HTTP '+e.status+').':'Probe stopped; inspect the local configuration and protected evidence.');
  process.exitCode=1;
});
