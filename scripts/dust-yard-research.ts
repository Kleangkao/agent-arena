import {createHash} from 'node:crypto';
import {appendFileSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {GoogleGenAI} from '@google/genai';
import {z} from 'zod';
import {configure,second,type Config,type Pair} from '../src/v26/config.js';
import {feedback,parsePlan,strategicPrompt,type Coach} from '../src/v26/controller.js';
import {developmentController} from '../src/v26/development.js';
import {observation} from '../src/v26/game.js';
import {load,record} from '../src/v26/replay.js';
import {limits,requestWithin,runTrial,selectedCadence,type Provider} from '../server/gameplay-v26.js';
import {executeLocally,followupFormat,generation,matchedEnvelope,snapshot,snapshotSet} from './probe-v27.js';

const model='gemini-3.5-flash-lite';
const output='.arena-data/dust-yard-research';
const movementStage=matchedEnvelope.properties.stages.items;
const choicePacket={...movementStage.properties.packet,properties:{...movementStage.properties.packet.properties,
  core:{type:'string'},attack:{type:'string'}}};
const choiceSchema={...matchedEnvelope,properties:{...matchedEnvelope.properties,stages:{...matchedEnvelope.properties.stages,
  items:{...movementStage,properties:{...movementStage.properties,packet:choicePacket,alternative:choicePacket}}}}};
const choiceStages=choiceSchema.properties.stages;
const checkpointSchema={...choiceSchema,properties:{...choiceSchema.properties,stages:{...choiceStages,items:{
  ...choiceStages.items,properties:{...choiceStages.items.properties,until:{type:'string'}},
}}}};
const arms=[
  {label:'commit',text:'When you can start the Core, commit immediately. Accept the risk of a visible rival to get the objective moving.'},
  {label:'contest',text:'If you can start the Core but can also tag a visible rival, make the tag attempt first. Start the Core when you have reassessed the risk.'},
  {label:'uncoached',text:''},
];
const schedule=[0,1,2,1,2,0,2,0,1];
const fixture=process.argv[2]==='holdout'
  ?snapshot('evidence/gameplay-v26-upstream/finite-objective.json','defender-core-eligible',
    v=>v.match.phase==='active'&&v.legal.core&&v.legal.standard,1)
  :snapshotSet()[1];
const syntaxExample=parsePlan({version:1,expiresInMs:1000,stages:[
  {forMs:1000,packet:{movement:{kind:'goal',gait:'walk',to:{x:3000,y:3000}}}},
]},fixture.config);
const message='Author a bounded plan for this fictional arcade match. Follow the mode goal and use only legitimate observations. '
  +'Choose the behavior yourself, taking coaching into account. For an objective goal, use the numeric x and y in view.match.site. '
  +'Use the same fixed-point axes as view.agent.position. Only use alternative together with when. '
  +'An attack input is a single attempt unless explicitly repeated. A Core commitment locks incompatible actions until it ends or is cancelled.';
const packetContract='A Core start and movement to a goal or direction are mutually exclusive in the SAME packet. '
  +'When legal.core is true, {"core":"start"} starts it here, with no approach movement required. '
  +'When legal.standard is true, {"attack":"standard"} attempts one tag. You may use either, neither, or distinct stages when warranted. '
  +'If a stage has no when condition, omit its alternative. The action-finished condition tracks only tag and reload, not Core progress. '
  +'The parser and game enforce these constraints.';
const checkpointHint='If your plan depends on a future observation, authorize a completion condition that ends the stage when you need to reconsider. '
  +'For example, until:"core-available" can end an approach as soon as the Core becomes eligible. '
  +'Use until:"at-goal" for a goal move only when reaching that position calls for reassessment. These conditions do not select the next action.';
const envelope=(prompt:Parameters<Provider>[0],contract=false,checkpoint=false)=>({
  instruction:message+(contract?' '+packetContract:'')+(checkpoint?' '+checkpointHint:''),format:followupFormat,
  movementExample:{note:'Syntax only. These coordinates are illustrative.',plan:syntaxExample},prompt});
const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const matched=(text:string)=>strategicPrompt(fixture.config,fixture.side,fixture.view,{text,revision:'dust-yard-pilot'},[],0);
const lessonSchema=z.object({lessons:z.array(z.string().trim().min(1).max(160)).min(1).max(3)}).strict();

function summarize(plan?:ReturnType<typeof parsePlan>) {
  const run=executeLocally(fixture,plan,20*second,true);
  const attempts=run.boundaries.flatMap(frame=>frame.receipts.map(receipt=>({tick:frame.tick,...receipt})));
  const events=run.boundaries.flatMap(frame=>frame.events);
  return {run,metrics:{
    accepted:attempts.filter(x=>x.accepted),
    rejected:attempts.filter(x=>!x.accepted),
    core:events.filter(x=>x.kind==='core'),result:run.final.result,finalTick:run.final.tick,
    replayDigest:digest(run.replay),
  }};
}

async function main() {
  const [mode,file]=process.argv.slice(2);
  if(mode==='verify') {
    const folder=file??output;
    const replayFiles=readdirSync(folder).filter(name=>name.endsWith('.json')&&
      !['memory-revision.json','replay-verification.json'].includes(name));
    const replays=replayFiles.map(name=>{
      const replay=load(JSON.parse(readFileSync(folder+'/'+name,'utf8')));
      return {name,hash:digest(replay.recording),result:replay.recording.final.result,reason:replay.recording.final.reason,
        frames:replay.frames.length,interruption:replay.recording.interruption};
    });
    const scripted=[3,23,71].flatMap(seed=>([0,1] as const).map(activator=>{
      const config=configure(seed,'objective-duel',activator);
      const blue=developmentController(config,0,'steady',23),sand=developmentController(config,1,'steady',23);
      const r=load(record(config,'development-policy',state=>[blue(observation(config,state,0)),sand(observation(config,state,1))])).recording;
      return {seed,activator,result:r.final.result,reason:r.final.reason,frames:r.final.tick};
    }));
    console.log(JSON.stringify({providerCalls:0,replays,scripted},null,2));
    return;
  }
  if(mode==='inspect') {
    const shared=arms.map(arm=>digest(envelope({...matched(arm.text),coaching:matched('').coaching})));
    const localControls=[
      summarize(parsePlan({version:1,expiresInMs:5000,stages:[{forMs:5000,packet:{core:'start'}}]},fixture.config)),
      summarize(parsePlan({version:1,expiresInMs:5000,stages:[{forMs:5000,packet:{attack:'standard'}}]},fixture.config)),
      summarize(),
    ];
    console.log(JSON.stringify({providerCalls:0,tick:fixture.state.tick,legal:fixture.view.legal,
      shared,controls:localControls.map(x=>x.metrics)},null,2));
    if(new Set(shared).size!==1||!fixture.view.legal.core||!fixture.view.legal.standard||
      localControls[0].metrics.accepted.find(x=>x.channel!=='movement')?.channel!=='core'||
      localControls[1].metrics.accepted.find(x=>x.channel!=='movement')?.channel!=='attack')
      throw Error('The matched scenario does not expose both planned choices.');
    return;
  }
  if(!file||!['coaching','choice','contract','holdout','duel','duel-swap','duel-checkpoint','duel-typed-checkpoint','memory'].includes(mode))
    throw Error('Use inspect, verify, coaching, choice, contract, holdout, duel, duel-swap, duel-checkpoint, duel-typed-checkpoint, or memory.');
  const typedCheckpoint=mode==='duel-typed-checkpoint';
  const checkpoint=mode==='duel-checkpoint'||typedCheckpoint;
  const duel=mode==='duel'||mode==='duel-swap'||checkpoint;
  const contract=['contract','holdout','memory'].includes(mode)||duel;
  const responseConfig={...generation,responseJsonSchema:mode==='coaching'?matchedEnvelope:typedCheckpoint?checkpointSchema:choiceSchema};
  const gameConfig=duel?configure(23,'objective-duel'):fixture.config;
  const key=readFileSync(file,'utf8').split(/\r?\n/)[0].trim().replace(/^['"]|['"]$/g,'');
  if(!/^[\x21-\x7e]{25,100}$/.test(key)) throw Error('The supplied credential is unavailable.');
  const ai=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
  mkdirSync(output,{recursive:true});
  let retryAfter=0;
  for(const name of readdirSync(output).filter(name=>name.endsWith('.jsonl'))) {
    const path=output+'/'+name;
    for(const line of readFileSync(path,'utf8').trim().split('\n')) {
      const row=JSON.parse(line);
      if(row.status!==429) continue;
      const seconds=Number(/retry in ([\d.]+)s/i.exec(row.message??'')?.[1]??60);
      retryAfter=Math.max(retryAfter,(row.utc?Date.parse(row.utc):statSync(path).mtimeMs)+Math.ceil(seconds*1000));
    }
  }
  if(retryAfter>Date.now()) await sleep(retryAfter-Date.now());
  const logPath=`${output}/${mode}.jsonl`;
  const attemptLimit=duel?limits.total:mode==='memory'?8:12;
  writeFileSync(logPath,JSON.stringify({model,mode,attemptLimit,responseConfig,message,
    ...(contract?{packetContract}:{}),...(checkpoint?{checkpointHint}:{}),syntaxExample,format:followupFormat,schedule,
    cadence:duel?selectedCadence:null,utc:new Date().toISOString()})+'\n',{flag:'wx'});
  const log=(row:object)=>appendFileSync(logPath,JSON.stringify(row)+'\n');
  let attempts=0,providerPaused=false,lastStarted=0;
  async function request(prompt:Parameters<Provider>[0],signal:AbortSignal,label:string,receipt?:Parameters<Provider>[2]) {
    if(attempts>=attemptLimit||providerPaused) throw Object.assign(Error('Experiment request limit'),{status:429});
    const id=++attempts;
    const start=performance.now();
    lastStarted=start;
    log({kind:'request',id,label,prompt,utc:new Date().toISOString()});
    try {
      const response=await requestWithin(()=>ai.models.generateContent({model,contents:JSON.stringify(envelope(prompt,contract,checkpoint)),
        config:{...responseConfig,abortSignal:signal}}),signal);
      const raw=response.text?.replaceAll(key,'[redacted]');
      const usage={model:response.modelVersion,input:response.usageMetadata?.promptTokenCount,
        output:response.usageMetadata?.candidatesTokenCount,thoughts:response.usageMetadata?.thoughtsTokenCount};
      receipt?.(usage);
      let plan:ReturnType<typeof parsePlan>|undefined;
      let error:unknown;
      try {plan=parsePlan(JSON.parse(raw??''),gameConfig);}
      catch(cause) {error=cause instanceof z.ZodError?cause.issues.map(({path,code})=>({path,code})):
        {message:cause instanceof Error?cause.message:'Invalid model decision'};}
      log({kind:'response',id,label,raw,usage,status:plan?'accepted':'invalid',error,plan,
        finish:response.candidates?.[0]?.finishReason,ms:Math.round(performance.now()-start)});
      return {plan,id};
    } catch(cause) {
      const error=cause as {status?:number;message?:string};
      const status=error.status??(signal.aborted?'timeout':'transport');
      if([400,401,403,404,429].includes(Number(status))) providerPaused=true;
      log({kind:'error',id,label,status,message:error.message?.replaceAll(key,'[redacted]').slice(0,1500),utc:new Date().toISOString(),
        ms:Math.round(performance.now()-start)});
      if(status===503&&!signal.aborted) await sleep(1000+Math.floor(Math.random()*500));
      throw cause;
    }
  }
  if(mode==='memory') {
    const {recording,frames}=load(JSON.parse(readFileSync(output+'/duel-replay.json','utf8')));
    if(recording.source!=='operator-attested-gemini'||!recording.final.result||recording.interruption)
      throw Error('Reflection requires the completed genuine duel.');
    const reflectionPrompt={task:'For your own Blue participant in this fictional game, write one to three reusable lessons, each at most 160 characters. '
      +'Use observable evidence and avoid assuming an untested tactic would have won.',
      rulesVersion:recording.config.rulesVersion,outcome:recording.final.result,reason:recording.final.reason,
      events:frames.flatMap(frame=>feedback(frame.events,frame.receipts[0],observation(recording.config,frame.state,0),0))};
    const reflectionConfig={...generation,responseJsonSchema:{type:'object',properties:{lessons:{type:'array',items:{type:'string'}}},
      required:['lessons'],additionalProperties:false}};
    let lessons:z.infer<typeof lessonSchema>|undefined;
    for(let round=0;round<2&&!lessons;round++) {
      const id=++attempts;
      lastStarted=performance.now();
      log({kind:'reflection-request',id,reflectionConfig,prompt:reflectionPrompt,utc:new Date().toISOString()});
      try {
        const signal=AbortSignal.timeout(limits.requestMs);
        const reply=await requestWithin(()=>ai.models.generateContent({model,contents:JSON.stringify(reflectionPrompt),
          config:{...reflectionConfig,abortSignal:signal}}),signal);
        const raw=reply.text?.replaceAll(key,'[redacted]');
        try {lessons=lessonSchema.parse(JSON.parse(raw??''));} catch {/* Rejected output is saved below. */}
        log({kind:'reflection-response',id,raw,accepted:!!lessons,model:reply.modelVersion,usage:reply.usageMetadata,
          finish:reply.candidates?.[0]?.finishReason,ms:Math.round(performance.now()-lastStarted)});
      } catch(cause) {
        const error=cause as {status?:number;message?:string};
        log({kind:'reflection-error',id,status:error.status,message:error.message?.replaceAll(key,'[redacted]').slice(0,1500)});
        if(error.status&&error.status!==503) break;
      }
      if(!lessons&&round===0) await sleep(Math.max(0,4250+lastStarted-performance.now()));
    }
    if(!lessons) return;
    const revisionPath=output+'/memory-revision.json';
    const agent=recording.config.participants[0];
    writeFileSync(revisionPath,JSON.stringify({agent,sourceReplay:digest(recording),rulesVersion:recording.config.rulesVersion,
      revision:1,...lessons}),{flag:'wx'});
    const saved=JSON.parse(readFileSync(revisionPath,'utf8'));
    if(saved.agent!==fixture.config.participants[fixture.side]) throw Error('Wrong agent for the saved memory revision.');
    const control=matched('');
    const treatment=strategicPrompt(fixture.config,fixture.side,fixture.view,{text:'',revision:control.coaching.revision,memory:saved},[],0);
    if(!treatment.memory||digest({...treatment,memory:null})!==digest(control)) throw Error('Unmatched memory comparison.');
    for(const [trial,memory] of [false,true,true,false,false,true].entries()) {
      if(providerPaused||attempts>=attemptLimit) break;
      await sleep(Math.max(0,4250+lastStarted-performance.now()));
      const label=memory?'memory':'no-memory';
      try {
        const response=await request(memory?treatment:control,AbortSignal.timeout(limits.requestMs),label);
        if(!response.plan) continue;
        const data=summarize(response.plan);
        const path=`${output}/memory-${label}-${trial+1}.json`;
        writeFileSync(path,JSON.stringify(data.run.replay));
        log({kind:'execution',id:response.id,label,path,...data.metrics});
      } catch {/* Provider failures are retained by request(). */}
    }
  } else if(!duel) {
    const control=summarize();
    log({kind:'scripted',metrics:control.metrics});
    writeFileSync(`${output}/${mode}-scripted.json`,JSON.stringify(control.run.replay));
    for(const [trial,index] of schedule.entries()) {
      const arm=arms[index];
      if(providerPaused||attempts>=attemptLimit) break;
      let response:Awaited<ReturnType<typeof request>>|undefined;
      for(let retry=0;retry<2;retry++) {
        if(mode==='holdout'&&lastStarted) await sleep(Math.max(0,4250+lastStarted-performance.now()));
        try {response=await request(matched(arm.text),AbortSignal.timeout(limits.requestMs),arm.label);break;}
        catch {if(providerPaused||attempts>=attemptLimit) break;}
      }
      if(!response?.plan) continue;
      const data=summarize(response.plan);
      const path=`${output}/${mode}-${arm.label}-${trial+1}.json`;
      writeFileSync(path,JSON.stringify(data.run.replay));
      log({kind:'execution',id:response.id,label:arm.label,trial:trial+1,path,...data.metrics});
    }
  } else {
    const coach=({text,label}:typeof arms[number]):Coach=>({text,revision:label});
    const coaches:Pair<Coach>=mode==='duel-swap'?[coach(arms[1]),coach(arms[0])]:[coach(arms[0]),coach(arms[1])];
    const provider:Provider=async (prompt,signal,receipt)=>{
      const response=await request(prompt,signal,prompt.coaching.revision,receipt);
      if(!response.plan) throw Error('Strict local validation rejected the decision.');
      return response.plan;
    };
    const trial=await runTrial(gameConfig,coaches,provider,selectedCadence,
      AbortSignal.timeout(limits.overallMs),'operator-attested-gemini',{horizon:20,diagnostics:true,matchId:'dust-yard-research-'+mode});
    const path=`${output}/${mode}-replay.json`;
    writeFileSync(path,JSON.stringify(trial.recording));
    load(JSON.parse(readFileSync(path,'utf8')));
    const {recording,...diagnostics}=trial;
    log({kind:'duel',path,result:recording.final.result,tick:recording.final.tick,interruption:recording.interruption,...diagnostics});
  }
  console.log(JSON.stringify({mode,attempts,logPath}));
}

main().catch(error=>{
  console.error(error instanceof Error&&error.message.startsWith('Use inspect')?error.message:
    'Research harness stopped. Check the local evidence, fixture, and whether this mode has already run.');
  process.exitCode=1;
});
