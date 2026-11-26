import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {GoogleGenAI} from '@google/genai';
import {z} from 'zod';
import {configure,sides,type Pair} from '../src/v26/config.js';
import {planSchema,parsePlan,strategicPrompt,type Coach} from '../src/v26/controller.js';
import {observation} from '../src/v26/game.js';
import {load} from '../src/v26/replay.js';
import {behaviorSchema,digest,parseBehavior,type Representation} from '../server/gameplay-v26-behavior.js';
import {verifyAuthorizationTrace} from '../server/gameplay-v26-evidence.js';
import {geminiProvider,limits,requestWithin,runTrial,selectedCadence} from '../server/gameplay-v26.js';
import {supabaseStorage} from '../server/supabase-storage.js';
import type {Attempt} from '../server/match.js';
import type {MatchConfig} from '../server/storage.js';

const capacitySchema=z.object({project:z.string().min(1).max(80),model:z.string().regex(/^gemini-[a-z0-9.-]+$/),
  tier:z.literal('Free'),verifiedAt:z.iso.datetime(),rpm:z.number().int().positive(),tpm:z.number().int().positive(),
  rpd:z.number().int().positive(),keyProjectVerified:z.literal(true)}).strict();
const invocation=z.object({mode:z.enum(['probe','duel']),live:z.literal('--live')});
const coaches:Pair<Coach>=[
  {text:'When eligible, favor committing to the Core. Preserve the objective and wait only with a reason.',revision:'probe-commit-v1'},
  {text:'Prioritize keeping movement and resources available. Favor disengaging from an uncertain contact before committing to the Core.',revision:'probe-mobile-v1'},
];
const manifest='evidence/gameplay-v26-upstream/probe-objective.json';
const evidenceDir='.arena-data/v26-upstream';
const participantOwner=(token:string)=>digest({purpose:'v26-upstream-validation',token});
const instructions:Record<Representation,string>={
  ordered:'The stages run in order. Reenter only if explicitly intended. Each entry reevaluates authored guards.',
  'state-machine':'Start at entry. List transitions in priority order. Guarded transitions can interrupt after entry. An unguarded final transition follows action completion.',
  'behavior-tree':'An ordered selector takes the first eligible branch. Put typed condition leaves first in a guarded sequence. Sequence progress is retained until interrupted. Use only unique tree nodes.',
};
export function wireSchema(representation?:Representation) {
  const json=z.toJSONSchema(representation?behaviorSchema(representation):planSchema);
  // The transport only constrains shape. Zod and the authority check all local bounds.
  function normalize(input:unknown):unknown {
    if(Array.isArray(input)) return input.map(normalize);
    if(input===null||typeof input!=='object') return input;
    return Object.fromEntries(Object.entries(input).flatMap(([k,value])=>
      k==='$schema'||k==='pattern'?[]:k==='const'?[['enum',[value]]]:[[k==='oneOf'?'anyOf':k,normalize(value)]]));
  }
  return normalize(json);
}

async function main() {
  if(process.argv[2]==='inspect') {
    const snapshot=probeSnapshot();
    console.log(JSON.stringify({source:manifest,time:snapshot.time,phase:snapshot.match.phase,
      history:!!snapshot.historical,current:!!snapshot.current,coreAvailable:snapshot.legal.core,
      schemas:[undefined,'ordered','state-machine','behavior-tree'].map(kind=>JSON.stringify(wireSchema(kind as Representation|undefined)).length),
      generationRequests:0}));
    return;
  }
  const input=invocation.safeParse({mode:process.argv[2],live:process.argv[3]});
  if(!input.success) throw Error('Use probe or duel with --live only after verifying the protected gates.');
  const {mode}=input.data;
  const {GEMINI_V2_API_KEY:key,SUPABASE_URL:url,SUPABASE_SECRET_KEY:secret,ARENA_V26_VALIDATION_TOKEN:token,
    ARENA_V26_UPSTREAM_REPRESENTATION:requested,ARENA_V26_UPSTREAM_DUEL_ACCEPTED:accepted}=process.env;
  if(!key||!url||!secret||!token||token.length<32) throw Error('Missing protected local validation configuration.');
  if(new URL(url).hostname!=='frefnzjshtlsewsxnito.supabase.co') throw Error('The configured storage is not the shared Arena project.');
  if(mode==='duel'&&accepted!=='yes') throw Error('The duel requires recorded owner gameplay acceptance.');
  const capacity=capacitySchema.safeParse(JSON.parse(readFileSync(evidenceDir+'/capacity.json','utf8')));
  if(!capacity.success) throw Error('Project, key association and current Free project limits must be verified.');
  const {model,rpm,tpm,rpd,verifiedAt}=capacity.data;
  const age=Date.now()-Date.parse(verifiedAt);
  const representation=z.enum(['ordered','state-machine','behavior-tree']).optional().parse(requested);
  const budget=mode==='duel'?limits.total:representation?4:2;
  if(age<0||age>15*60*1000||rpm<budget||rpd<budget||tpm<budget*6000)
    throw Error('Verified Free capacity is stale or has insufficient headroom.');
  if(mode==='probe'&&representation) {
    const eligibility=JSON.parse(readFileSync(evidenceDir+'/candidate-gate.json','utf8'));
    if(eligibility.representation!==representation||eligibility.localGatePassed!==true)
      throw Error('A persistent representation must pass the local architecture gate before probing.');
  }
  const ai=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
  const metadataSignal=AbortSignal.timeout(limits.requestMs);
  const metadata=await requestWithin(()=>ai.models.get({model,config:{abortSignal:metadataSignal}}),metadataSignal);
  if(!metadata.supportedActions?.includes('generateContent')) throw Error('Selected model lacks confirmed generation support.');
  const owner=participantOwner(token), opponent='official-sand';
  const arena=configure(12,'objective-duel',0,[owner,opponent]);
  const snapshot=mode==='probe'?probeSnapshot():undefined;
  const storage=supabaseStorage(url,secret);
  if(!await storage.guest(owner)) await storage.createGuest(owner,Date.now()+60*60*1000);
  const id=randomUUID();
  const config:MatchConfig={participants:[owner,opponent],
    coaches:[{...coaches[0],memory:{revision:0,lessons:[]}},{...coaches[1],memory:{revision:0,lessons:[]}}],
    model,decisionBudget:20,rulesVersion:arena.rulesVersion,mapVersion:arena.mapVersion,arena,memoryRevisions:[0,0]};
  const reservationConfig={...config,validationPurpose:mode==='duel'?'v26-upstream-duel':'v26-upstream-probe'};
  const reservation=await storage.reserve({owner,id,requestId:id,config:reservationConfig});
  if(reservation.status!=='new') throw Error('Atomic shared reservation denied: '+reservation.status);
  const attempts:Attempt[]=[], started=performance.now();
  let replay:Awaited<ReturnType<typeof runTrial>>['recording']|null=null;
  mkdirSync(evidenceDir,{recursive:true});
  try {
    const locked=reservation.job.config;
    if(locked.rulesVersion!==arena.rulesVersion||locked.model!==model||digest(locked.arena)!==digest(arena))
      throw Error('Protected reservation configuration did not match.');
    if(mode==='duel') {
      const trial=await runTrial(arena,coaches,geminiProvider(key,model),selectedCadence,AbortSignal.timeout(limits.overallMs),
        'operator-attested-gemini',{horizon:20,matchId:id});
      for(const [side,participant] of trial.participants.entries()) for(const row of participant.requests) {
        const {tick:step,attempt,ms,status,plan,model,input,output,coachingRevision,memoryRevision}=row;
        attempts.push({side,step,attempt,ms,status,plan,model,input,output,coachingRevision,memoryRevision});
      }
      writeFileSync(evidenceDir+'/'+id+'.json',JSON.stringify({kind:'live-finite-duel',trial},null,2));
      verifyAuthorizationTrace(trial);
      replay=trial.recording;
    } else {
      const responses:{representation:string;side:number;accepted?:unknown}[]=[];
      const signal=AbortSignal.timeout(limits.overallMs);
      batch: for(const kind of [undefined,...(representation?[representation]:[])]) for(const side of sides) {
          const prompt=strategicPrompt(arena,0,snapshot!,coaches[side],[],0);
          const row:Attempt={side,step:0,attempt:1,ms:0,status:'invalid',coachingRevision:coaches[side].revision};
          const start=performance.now();
          try {
            signal.throwIfAborted();
            attempts.push(row);
            const deadline=AbortSignal.any([signal,AbortSignal.timeout(limits.requestMs)]);
            const response=await requestWithin(()=>ai.models.generateContent({model,contents:JSON.stringify({prompt,
              instruction:'Choose a legal arcade strategy for the mode. Current contact is live, historical contact is a past sample. An empty packet deliberately waits. Preserve the objective while following coaching preferences.',
              representation:kind??'finite',conditions:'Use only supplied typed guards, explicit alternatives and compatible packet channels.',
              scope:kind?'Use life scope, at most 20000ms. Author priorities and conditions yourself.':'Maximum 4 stages and 20000ms.',
              semantics:kind?instructions[kind]:undefined,
            }),config:{abortSignal:deadline,responseMimeType:'application/json',
              responseJsonSchema:wireSchema(kind),maxOutputTokens:kind?1400:512}}),deadline);
            row.input=response.usageMetadata?.promptTokenCount;
            row.output=response.usageMetadata?.candidatesTokenCount;
            row.model=response.modelVersion;
            if(!response.text||response.text.length>12000) throw Error('Invalid structured output');
            const data=JSON.parse(response.text);
            const result=kind?parseBehavior(data,arena,kind,20):parsePlan(data,arena);
            row.status='accepted';
            responses.push({representation:kind??'finite',side,accepted:result});
          } catch(error) {
            const status=(error as {status?:number})?.status;
            row.status=status?String(status):signal.aborted||(error as Error).name==='TimeoutError'?'timeout':'invalid-or-provider';
            responses.push({representation:kind??'finite',side});
            if(status===429||signal.aborted) break batch;
          } finally {row.ms=Math.round(performance.now()-start);}
      }
      const probe={kind:'live-probe-with-local-reuse',manifest,snapshot,attempts,responses};
      const output=evidenceDir+'/'+id+'.json';
      writeFileSync(output,JSON.stringify(probe,null,2));
      const executions=[];
      for(const kind of [undefined,...(representation?[representation]:[])]) {
        const pair=responses.filter(r=>r.representation===(kind??'finite')&&r.accepted!==undefined);
        if(pair.length!==2) continue;
        for(const seed of [12,3,23,71]) {
          const swapped=seed===3||seed===71, c=configure(seed,'objective-duel',swapped?1:0);
          const trial=await runTrial(c,coaches,async prompt=>pair[Number(prompt.participant===c.participants[1])^Number(swapped)].accepted,
            selectedCadence,AbortSignal.timeout(limits.overallMs),'injected-provider',{representation:kind,horizon:20});
          verifyAuthorizationTrace(trial);
          executions.push({kind:kind??'finite',origin:'local-reexecution-of-gemini-specification',
            specifications:pair.map(p=>digest(p.accepted)),seed,swapped,trial});
        }
      }
      writeFileSync(output,JSON.stringify({...probe,executions},null,2));
    }
  } finally {
    // Probe reservations retain their rolling quota charge without producing a competitive result.
    await storage.finish(id,replay,attempts,Math.round(performance.now()-started));
    if(replay?.final.result) await storage.reflect(owner,id,null);
  }
  console.log(JSON.stringify({mode,model,attempts:attempts.length,accepted:attempts.filter(r=>r.status==='accepted').length,
    evidence:evidenceDir+'/'+id+'.json',result:replay?.final.result??null}));
}

function probeSnapshot() {
  const objective=load(JSON.parse(readFileSync(manifest,'utf8')));
  const samples=objective.frames.map(f=>observation(objective.recording.config,f.state,0));
  const view=samples.find(v=>v.match.phase==='pending'&&v.historical&&!v.current&&v.agent.hp>0);
  if(!view) throw Error('Required legitimate comparison snapshot is unavailable.');
  return view;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{
  const safe=error as {status?:number;message?:string};
  const message=safe.message??'';
  const o=/^(Use probe|Missing protected|The duel requires|The configured storage|Project, key|Verified Free|A persistent|Selected model|Atomic shared|Required legitimate|Protected reservation)/.test(message);
  console.error(o?message:'Validation stopped. Check protected local configuration and storage. '+(safe.status?`HTTP ${safe.status}`:''));
  process.exitCode=1;
});
