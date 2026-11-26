import express, {type Request,type Response} from 'express';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {runMatch,type Attempt} from './match.js';
import {validateReplay} from '../src/replay.js';
import {reflect} from './reflect.js';
import {officials} from '../src/competition.js';
import type {ArenaStorage,Job,MatchConfig} from './storage.js';
import {runGeminiV2} from './gameplay-v2.js';
import {configure, revision} from '../src/v2/game.js';
import {validate as validateV2} from '../src/v2/replay.js';
import {configure as configureMode,revision as modeRevision,canonical} from '../src/v25/game.js';
import {load as loadMode} from '../src/v25/replay.js';
import {runGeminiV25} from './gameplay-v25.js';
import {runGeminiV26} from './gameplay-v26.js';
import {configure as configureV26,revision as revisionV26} from '../src/v26/config.js';
import {load as loadV26} from '../src/v26/replay.js';
import {loadSquads,squadConfig,squadRules,legacySquadRules,continuousConfig,continuousSquadRules,currentSquadConfig,territorySquadRules,squadModes,type SquadMode} from '../src/squads/game.js';
import {runChallengeSquads,runGeminiSquads} from './squads.js';
import {arenaOpponents,isArenaOpponent} from '../src/squads/arena-bots.js';
import {arenaPolicyVersion,type ArenaOpponentId} from '../src/squads/game.js';
import {lockSquadGuidance,squadAutonomy,squadStrategy} from './squad-guidance.js';
import {admitParticipation,maxEntrySeconds,participationInput,participationScope,type ParticipationEntry} from '../src/squads/participation.js';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const coachingText=z.string().trim().max(1000);
const isContinuousSquad=(version:string)=>version===continuousSquadRules||version===territorySquadRules;
const entryId=(owner:string,requestId:string)=>{
 const digest=hash(`agent-arena/entry/v1:${owner}:${requestId}`);
 return `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
};
const startSchema=z.object({
 requestId:z.uuid(),coaching:coachingText,
 strategy:squadStrategy.optional(),autonomy:squadAutonomy.optional(),
 opponent:z.enum(['official-sand','official-sand-pace','arena-easy','arena-normal','arena-hard']).default('official-sand'),
 rulesVersion:z.enum(['lane-v1',revision,modeRevision,revisionV26,squadRules,continuousSquadRules,territorySquadRules]).default('lane-v1'),
 mode:z.enum(['objective-duel','score-deathmatch',...squadModes]).optional(),
 activator:z.union([z.literal(0),z.literal(1)]).optional(),
 sameSetup:z.uuid().optional(),
 participation:participationInput.optional(),
}).strict().refine(({rulesVersion,mode,activator,sameSetup,participation,strategy,autonomy})=>
 ((strategy===undefined)===(autonomy===undefined))&&
 (!participation||isContinuousSquad(rulesVersion)&&!sameSetup)&&
 (!sameSetup||rulesVersion===revisionV26||rulesVersion===squadRules||isContinuousSquad(rulesVersion))&&
 (isContinuousSquad(rulesVersion) ? (rulesVersion===territorySquadRules?mode==='relay':squadModes.some(value=>value===mode))&&activator===undefined
 : rulesVersion===modeRevision||rulesVersion===revisionV26
 ? (mode==='objective-duel'||mode==='score-deathmatch'&&activator===undefined) : mode===undefined&&activator===undefined));

export function createApi(storage:ArenaStorage, options:{
 key?:string;model?:string;origin?:string;hosted?:boolean;localV26?:boolean;localSquads?:boolean;hostedSquads?:boolean;developerSquadToken?:string;
 background?:(work:Promise<void>)=>void;
 runner?:typeof runMatch;reflection?:typeof reflect;
 squadRunner?:typeof runGeminiSquads;
 challengeRunner?:typeof runChallengeSquads;
 participationVerifier?:typeof admitParticipation;
 v2Trial?:{key:string;token:string;runner?:typeof runGeminiV2};
 v25Trial?:{key:string;token:string;runner?:typeof runGeminiV25};
 v26Trial?:{key:string;token:string;runner?:typeof runGeminiV26};
}={}) {
 const {key,model,origin,hosted,background,runner=runMatch,reflection=reflect,v2Trial,v25Trial,v26Trial}=options;
 const enabled=!!key&&!!model&&(!hosted||!!origin&&!!background);
 const continuousConfigured=enabled&&options.localV26===true&&!hosted;
 const squadsConfigured=enabled&&(hosted?options.hostedSquads===true:options.localSquads===true);
 const audience=origin??'http://localhost/agent-arena-development';
 const nowSeconds=()=>Math.floor(Date.now()/1000);
 const app=express();
 app.disable('x-powered-by');
 app.use('/api',(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(req.method==='POST'&&(req.get('sec-fetch-site')==='cross-site'||(hosted&&(!origin||req.get('origin')!==origin))))return res.sendStatus(403);
  next();
 });
 app.use(express.json({limit:'4kb'}));

 function guestId(req:Request){
  const token=/(?:^|;\s*)arena_guest=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1];
  if(token)return hash(token);
 }
 const send=(res:Response,job:Job)=>{
  const coach=job.config.coaches[0];
  const guidance=coach.guidance;
  const requests=guidance?job.config.attempts?.filter(attempt=>attempt.side===0&&attempt.coachingRevision===coach.revision).length??0:0;
  return res.json({id:job.id,status:job.status,replay:job.replay,
  opponent:job.config.participants[1],model:job.config.model,reflection:job.reflection,rulesVersion:job.config.rulesVersion,
  ...(guidance?{guidance:{strategy:guidance.strategy,autonomy:guidance.autonomy,coaching:coach.text,revision:coach.revision,
   requests,...(requests?{received:guidance.prompt}:{})}}:{}),
  ...(job.config.participation?{participation:job.config.participation}:{}),
  ...('arena' in job.config?{arena:job.config.arena,attempts:job.config.attempts,durationMs:job.config.durationMs}:{}),
  ...(job.status==='interrupted'&&job.config.attempts?.some(attempt=>attempt.status==='429')?
   {error:'Live AI reached its provider limit. Try later or play practice.'}:{}),
  ...(job.status==='interrupted'&&job.replay?.version===7&&job.replay.interruption==='invalid-orders'?
   {error:'A commander returned invalid orders. No winner was declared.'}:{}),
  });
 };
 app.get('/api/health',(_req,res)=>res.json({geminiConfigured:enabled,...(continuousConfigured?{continuousConfigured:true}:{}),
  ...(squadsConfigured?{squadsConfigured:true,squadModel:model}:{})}));
 app.post('/api/guest',async(req,res)=>{
  if(hosted&&!enabled)return res.sendStatus(503);
  const id=guestId(req);
  if(id&&await storage.guest(id))return res.sendStatus(204);
  const token=randomBytes(32).toString('hex');
  const ttl=86400*1000;
  if(!await storage.createGuest(hash(token),Date.now()+ttl))return res.status(429).json({error:'Guest capacity reached'});
  res.cookie('arena_guest',token,{httpOnly:true,secure:!!hosted,sameSite:'strict',path:'/api',maxAge:ttl}).sendStatus(204);
 });
 app.use(['/api/memory','/api/coaching','/api/matches'],async(req,res,next)=>{
  const owner=guestId(req);
  if(!owner)return res.sendStatus(401);
  const access=storage.guestRequest?await storage.guestRequest(owner):await storage.guest(owner)?'allowed':'missing';
  if(access==='missing')return res.sendStatus(401);
  if(access==='limited')return res.set('Retry-After','60').status(429).json({error:'Too many Arena requests. Try again in a minute.'});
  res.locals.owner=owner;
  next();
 });
 app.get('/api/memory',async(req,res)=>{
  const owner:string=res.locals.owner;
  const {revision,lessons}=await storage.memory(owner);
  return res.json({revision,lessons});
 });
 app.get('/api/coaching',async(req,res)=>{
  const owner:string=res.locals.owner;
  return res.json({coaching:await storage.coaching(owner)});
 });
 app.post('/api/coaching',async(req,res)=>{
  const owner:string=res.locals.owner;
  const input=z.object({coaching:coachingText}).strict().safeParse(req.body);
  if(!input.success)return res.sendStatus(400);
  await storage.saveCoaching(owner,input.data.coaching,hash(input.data.coaching));
  return res.sendStatus(204);
 });
 app.get('/api/matches/:id',async(req,res)=>{
  const owner:string=res.locals.owner;
  if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(404);
  const job=await storage.find(owner,req.params.id);
  return job?send(res,job):res.sendStatus(404);
 });
 app.post('/api/matches/entry', (req,res)=>{
  if(!squadsConfigured)return res.sendStatus(404);
  const input=participationScope.safeParse(req.body);
  if(!input.success)return res.status(400).json({error:'Invalid match entry.'});
  const {requestId,...scope}=input.data;
  const entry:ParticipationEntry={...scope,audience,matchId:entryId(res.locals.owner,requestId),expires:nowSeconds()+maxEntrySeconds,
   ...(scope.mode==='relay'?{rulesVersion:territorySquadRules}:{})};
  return res.json(entry);
 });
 app.post('/api/matches',async(req,res)=>{
  const owner:string=res.locals.owner;
  const input=startSchema.safeParse(req.body);
  if(!input.success)return res.status(400).json({error:'Invalid match request'});
  const {requestId,coaching,strategy,autonomy,opponent,rulesVersion,mode,activator=0,sameSetup,participation}=input.data;
  const developerToken=req.get('x-arena-squad-test');
  if(developerToken!==undefined&&(
    hosted||!squadsConfigured||!isContinuousSquad(rulesVersion)||req.socket.remoteAddress!=='127.0.0.1'||
    !options.developerSquadToken||!timingSafeEqual(Buffer.from(hash(developerToken),'hex'),Buffer.from(hash(options.developerSquadToken),'hex'))
  ))return res.sendStatus(404);
  const validation=rulesVersion===revision, modeValidation=rulesVersion===modeRevision, validation26=rulesVersion===revisionV26;
  const squads=rulesVersion===squadRules||isContinuousSquad(rulesVersion);
  if(strategy&&!squads)return res.status(400).json({error:'Strategy preferences are for squad matches.'});
  const squadMode=isContinuousSquad(rulesVersion)?mode as SquadMode:undefined;
  const wrongSquadMode=(job:Job)=>'arena' in job.config&&isContinuousSquad(job.config.rulesVersion)&&
   (!('mode' in job.config.arena)||job.config.arena.mode!==squadMode);
  if(squads&&!squadsConfigured)return res.sendStatus(404);
  const validationKey=validation?v2Trial:modeValidation?v25Trial:validation26?v26Trial:undefined;
  if((validation||modeValidation||validation26&&!continuousConfigured)&&(!validationKey||validationKey.token.length<32||
      !timingSafeEqual(Buffer.from(hash(req.get('x-arena-trial')??''),'hex'),Buffer.from(hash(validationKey.token),'hex'))))return res.sendStatus(404);
  const reuse=(job:Job)=>job.config.coaches[0].text!==coaching||job.config.participants[1]!==opponent||
    job.config.coaches[0].guidance?.strategy!==strategy||job.config.coaches[0].guidance?.autonomy!==autonomy||
    job.config.participation?.signature!==participation?.signature||job.config.participation?.entry.agentId!==participation?.agentId||
    job.config.participation?.entry.expires!==participation?.expires||
    job.config.rulesVersion!==rulesVersion||job.config.sameSetup!==sameSetup||wrongSquadMode(job)||((job.config.rulesVersion===modeRevision||job.config.rulesVersion===revisionV26)&&
      (job.config.arena.mode!==mode||(job.config.arena.mode==='objective-duel'&&job.config.arena.activator!==activator)))
    ?res.sendStatus(409):send(res,job);
  const existing=await storage.existing(owner,requestId);
  if(existing)return reuse(existing);
  if(!enabled||!key||!model)return res.status(503).json({error:'Live matches are unavailable.'});
  const reference=sameSetup?await storage.find(owner,sameSetup):null;
  if(sameSetup&&(reference?.status!=='completed'||reference.config.rulesVersion!==rulesVersion||
    reference.config.participants[1]!==opponent||wrongSquadMode(reference)||reference.config.rulesVersion===revisionV26&&
    (reference.config.arena.mode!==mode||reference.config.arena.activator!==activator)))
   return res.status(404).json({error:'The previous match setup is unavailable.'});
  const referenceConfig=reference?.config.rulesVersion===revisionV26?reference.config:null;
  const squadReference=reference?.config.rulesVersion===squadRules||reference?.config.rulesVersion===continuousSquadRules||
   reference?.config.rulesVersion===territorySquadRules?reference.config:null;
  const squadArena=squads?squadReference?.arena??(rulesVersion===territorySquadRules?currentSquadConfig('relay'):
   squadMode?continuousConfig(squadMode):squadConfig()):null;

  const id=participation?entryId(owner,requestId):randomUUID();
  let proof;
  if(participation&&squadMode){
   if(squadMode==='relay'&&rulesVersion!==territorySquadRules)return res.status(400).json({error:'Request a fresh Relay entry.'});
   const entry:ParticipationEntry={matchId:id,agentId:participation.agentId,expires:participation.expires,mode:squadMode,opponent,audience,
    ...(rulesVersion===territorySquadRules?{rulesVersion}:{})};
   try{proof=await (options.participationVerifier??admitParticipation)(entry,participation.signature,nowSeconds());}
   catch{return res.status(503).json({error:'Could not confirm the registered owner on BSC Testnet.'});}
   if(!proof)return res.status(403).json({error:'Sign this match with the agent’s registered Testnet owner wallet.'});
  }
  const memory=await storage.memory(owner);
  const priorCoach=squadReference?.coaches[0];
  const priorGuidance=priorCoach?.guidance;
  const guidance=strategy&&autonomy?(priorGuidance&&priorCoach.text===coaching&&priorGuidance.strategy===strategy&&priorGuidance.autonomy===autonomy
   ?priorGuidance:lockSquadGuidance(strategy,autonomy,coaching)):undefined;
  const arena=modeValidation?configureMode(randomBytes(4).readUInt32LE(),
    mode==='objective-duel'?{mode,activator}:{mode:'score-deathmatch'},[owner,opponent]):undefined;
  const arena26=referenceConfig?.arena??(validation26&&(mode==='objective-duel'||mode==='score-deathmatch')?configureV26(randomBytes(4).readUInt32LE(),mode,activator,[owner,opponent]):undefined);
  const config:MatchConfig={participants:[owner,opponent],coaches:[
   {text:coaching,revision:hash(guidance?JSON.stringify(guidance):coaching),memory,...(guidance?{guidance}:{})},
   squadReference?.coaches[1]??referenceConfig?.coaches[1]??(isArenaOpponent(opponent)
    ?{text:`${arenaOpponents[opponent].name}. ${arenaOpponents[opponent].behavior}`,revision:arenaPolicyVersion,memory:{revision:0,lessons:[]}}
    :{text:officials[opponent].coaching,revision:opponent+'-v1',memory:{revision:0,lessons:[]}}),
  ],model:squadReference?.model??referenceConfig?.model??model,decisionBudget:20,...(proof?{participation:proof}:{}),...(sameSetup?{sameSetup}:{}),...(squadArena?{arena:squadArena,mapVersion:squadArena.mapVersion,rulesVersion:squadArena.rulesVersion===legacySquadRules?squadRules:squadArena.rulesVersion}:
    arena26?{arena:arena26,mapVersion:arena26.mapVersion,rulesVersion:revisionV26,memoryRevisions:[0,0]}:
    arena?{arena,mapVersion:arena.mapVersion,rulesVersion:modeRevision,memoryRevisions:[0,0]}:
    validation?{...configure(randomBytes(4).readUInt32LE(),revision),rulesVersion:revision,memoryRevisions:[0,0]}:
    {mapVersion:'dust-yard-prototype-v1',rulesVersion:'lane-v1'})};
  const reservation=await storage.reserve({id,owner,requestId,config});
  if(reservation.status==='busy')return res.set('Retry-After',String(reservation.retryAfter)).status(429)
   .json({error:'Arena is busy. Try again shortly.'});
  if(reservation.status==='unauthorized')return res.sendStatus(401);
  if(reservation.status==='existing')return reuse(reservation.job);

  const process=async()=>{
   const attempts:Attempt[]=[];
   const started=Date.now();
   const locked=reservation.job.config;
   let replay:Job['replay']=null;
   try{
    const signal=AbortSignal.timeout(60000);
    if((locked.rulesVersion===squadRules||locked.rulesVersion===continuousSquadRules||locked.rulesVersion===territorySquadRules)&&squadsConfigured){
     const arenaOpponent:ArenaOpponentId|undefined=isArenaOpponent(locked.participants[1])?locked.participants[1]:undefined;
     const candidate=loadSquads(arenaOpponent
      ?await (options.challengeRunner??runChallengeSquads)(key,locked.model,locked.arena,locked.coaches,signal,attempts,arenaOpponents[arenaOpponent].difficulty,arenaOpponent)
      :await (options.squadRunner??runGeminiSquads)(key,locked.model,locked.arena,locked.coaches,signal,attempts)).replay;
     if((arenaOpponent?candidate.source!=='arena-challenge'||candidate.challenge?.opponent!==arenaOpponent:candidate.source!=='operator-attested-gemini')
      ||canonical(candidate.config)!==canonical(locked.arena))throw Error('Squad reservation mismatch');
     replay=candidate;
    }else if(locked.rulesVersion===revisionV26&&(v26Trial||continuousConfigured)){
     const [blue,sand]=locked.coaches;
     const run=await (v26Trial?.runner??runGeminiV26)(v26Trial?.key??key,locked.model,locked.arena,
       [{text:blue.text,revision:blue.revision},{text:sand.text,revision:sand.revision}],signal);
     const candidate=loadV26(run.recording).recording;
     if(candidate.source!=='operator-attested-gemini'||canonical(candidate.config)!==canonical(locked.arena))throw Error('V2.6 reservation mismatch');
     for(const [side,p] of run.participants.entries())
      for(const attempt of p.requests) attempts.push({side,step:attempt.tick,attempt:attempt.attempt,ms:attempt.ms,status:attempt.status,plan:attempt.plan,
       model:attempt.model,input:attempt.input,output:attempt.output,coachingRevision:attempt.coachingRevision,memoryRevision:attempt.memoryRevision,failure:attempt.failure});
     replay=candidate;
    }else if(locked.rulesVersion===modeRevision&&v25Trial){
     const [blue,sand]=locked.coaches;
     const candidate=loadMode(await (v25Trial.runner??runGeminiV25)(v25Trial.key,model,locked.arena,
       [{text:blue.text,revision:blue.revision},{text:sand.text,revision:sand.revision}],signal,attempts)).recording;
     if(candidate.source!=='gemini'||canonical(candidate.config)!==canonical(locked.arena))throw Error('V2.5 reservation mismatch');
     replay=candidate;
    }else if(locked.rulesVersion===revision&&v2Trial){
     const [blue,sand]=locked.coaches;
     const match=await (v2Trial.runner??runGeminiV2)(v2Trial.key,model,locked,
       [{text:blue.text,revision:blue.revision},{text:sand.text,revision:sand.revision}],signal,attempts);
     const candidate=validateV2(match.replay);
     if(candidate.source!=='operator-attested-gemini'||candidate.config.seed!==locked.seed||
       candidate.config.rulesVersion!==locked.rulesVersion||candidate.config.mapVersion!==locked.mapVersion)throw Error('V2 reservation mismatch');
     replay=candidate;
    }else if(locked.rulesVersion==='lane-v1')replay=validateReplay(await runner(key,model,locked.coaches,signal,attempts));
   }catch{}
   await storage.finish(id,replay,attempts,Date.now()-started);
   if(!replay||((replay.version===6||replay.version===7)&&replay.interruption))return;
   if(replay.version!==1){await storage.reflect(owner,id,null);return;}
   let lessons:string[]|null=null;
   try{lessons=await reflection(key,model,replay,reservation.job.config.coaches[0].memory.lessons);}
   catch{console.warn('Match completed; reflection unavailable');}
   await storage.reflect(owner,id,lessons);
  };
  const work=process().catch(()=>console.error('Unable to persist match result'));
  background?.(work);
  send(res.status(202),reservation.job);
 });
 app.use((error:{status?:number},_req:Request,res:Response,_next:express.NextFunction)=>{
  if(error.status===400||error.status===413)return res.sendStatus(error.status);
  console.error('Arena API request failed');
  return res.status(503).json({error:'Could not reach Arena. Reopen your match or try again shortly.'});
 });
 return app;
}
