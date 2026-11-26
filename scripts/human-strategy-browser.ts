import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'vite';
import {createApi} from '../server/api.js';
import {sqliteStorage} from '../server/sqlite-storage.js';
import {arenaPolicyVersion,currentSquadConfig,loadSquads,scriptedSquads,type SquadMode} from '../src/squads/game.js';

const flags=new Set(process.argv.slice(2));
const hosted=process.env.ARENA_QA_ORIGIN;
const generate=flags.has('--live');
const verifyPublic=flags.has('--verify-public');
const verifyPractice=flags.has('--practice');
assert(!generate||hosted,'--live requires explicit ARENA_QA_ORIGIN');
assert(!verifyPublic||hosted,'--verify-public requires explicit ARENA_QA_ORIGIN');
const kind=hosted?(generate?'hosted-live':'hosted-readonly'):'local-mock';
const folder=process.env.ARENA_QA_EVIDENCE_DIR??'evidence/human-strategy';
mkdirSync(folder,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.ARENA_QA_PLAYWRIGHT?.replace(/package\.json$/,'')??'playwright');
const mode=(process.env.ARENA_QA_MODE??'relay') as SquadMode;
const modeLabel={relay:'Relay',bomb:'Bomb Mode',tdm:'Team Deathmatch'}[mode];
const difficulty=process.env.ARENA_QA_DIFFICULTY??'Normal';
const demoGuidance=mode==='relay'?'Secure one relay early. If it keeps scoring, look for opportunities to expand.'
 :mode==='bomb'?'Choose one Core and keep nearby units supporting the link.':'Keep the team close and regroup when units respawn.';
const revisedGuidance='Check where we are falling behind before sending units away from owned territory.';

async function local(){
 const db=new DatabaseSync(':memory:');
 const api=createApi(sqliteStorage(db,'.arena-data/strategy-browser-test',1),{
  localSquads:true,key:'local-browser-mock',model:'local-browser-mock',
  squadRunner:async(_key,model,config,coaches,_signal,attempts)=>{
   const playback=scriptedSquads(config);
   playback.replay.windows.forEach((_,index)=>{
    for(const [side,coach] of coaches.entries())attempts.push({step:index*12,side,status:'accepted',attempt:1,ms:0,model,coachingRevision:coach.revision});
   });
   return {...playback.replay,source:'operator-attested-gemini'};
  },
  challengeRunner:async(_key,model,config,coaches,_signal,attempts,difficulty,opponent)=>{
   const playback=scriptedSquads(config);
   playback.replay.windows.forEach((_,index)=>{
    attempts.push({step:index*12,side:0,status:'accepted',attempt:1,ms:0,model,coachingRevision:coaches[0].revision});
   });
   return {...playback.replay,source:'arena-challenge',challenge:{format:'challenge',difficulty,policy:arenaPolicyVersion,opponent}};
  },
 }).listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>api.once('listening',resolve));
 const apiPort=(api.address() as {port:number}).port;
 const vite=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${apiPort}`}}});
 await vite.listen();
 return {origin:vite.resolvedUrls!.local[0],async close(){await vite.close();await new Promise<void>(resolve=>api.close(()=>resolve()));db.close();}};
}

const fixture=hosted?undefined:await local();
const origin=hosted??fixture!.origin;
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1180,height:920},
 ...(flags.has('--video')?{recordVideo:{dir:folder,size:{width:1180,height:920}}}:{})});
const page=await context.newPage();
const errors:string[]=[];
const matchPosts:unknown[]=[];
const startStatuses:number[]=[];
const shots:string[]=[];
const runs:unknown[]=[];
const practiced:string[]=[];
let failure:string|null=null;
page.on('pageerror',(error:Error)=>errors.push(error.message));
page.on('console',(message:any)=>{if(message.type()==='error'&&message.text().includes('same key'))errors.push(message.text());});
page.on('request',(req:any)=>{if(req.method()==='POST'&&req.url().endsWith('/api/matches'))matchPosts.push(req.postDataJSON());});
const nav=(name:string)=>page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name,exact:true}).click();
const button=(name:string|RegExp)=>page.getByRole('button',{name,exact:typeof name==='string'});
const shot=async(name:string)=>{
 const path=`${folder}/${kind}-${name}.png`;
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+name);
 await page.screenshot({path,fullPage:true});
 shots.push(path);
};
const seek=()=>page.getByRole('slider',{name:'Replay position'});
async function submit(name:string|RegExp,coaching:string,expected:{strategy:string;autonomy:string;sameSetup?:string}){
 const started=page.waitForResponse((res:any)=>res.request().method()==='POST'&&res.url().endsWith('/api/matches'));
 const terminal=page.waitForResponse(async(res:any)=>res.ok()&&res.request().method()==='GET'&&/\/api\/matches\/[a-f0-9-]+$/.test(res.url())&&
  ['completed','interrupted'].includes((await res.json()).status),{timeout:75000});
 void terminal.catch(()=>{});
 await button(name).click();
 const response=await started;
 startStatuses.push(response.status());
 assert.equal(response.status(),202,'match start returned HTTP '+response.status());
 const {id}=await response.json();
 const posted=response.request().postDataJSON();
 for(const [key,value] of Object.entries({coaching,...expected,rulesVersion:currentSquadConfig(mode).rulesVersion,mode}))assert.equal(posted[key],value,key);
 assert(!posted.participation,'guest flow attempted a wallet action');
 assert.equal(posted.opponent,'arena-'+difficulty.toLowerCase());
 const job=await (await terminal).json();
 const captured={id:job.id,status:job.status,error:job.error,model:job.model,guidance:job.guidance,attempts:job.attempts,
  durationMs:job.durationMs,replay:job.replay,terminal:null as null|{score:unknown;tick?:number;result:unknown}};
 runs.push(captured);
 assert.equal(job.id,id);
 assert.equal(job.status,'completed',JSON.stringify({status:job.status,error:job.error,attempts:job.attempts?.map((row:any)=>row.status)}));
 const {replay,frames}=loadSquads(job.replay);
 assert.equal(replay.config.rulesVersion,currentSquadConfig(mode).rulesVersion);
 assert.equal(replay.source,'arena-challenge');
 assert.equal(replay.challenge?.policy,arenaPolicyVersion);
 assert(job.attempts.some((row:any)=>row.side===0&&row.model&&row.status==='accepted'));
 assert(job.attempts.every((row:any)=>row.side===0||!row.model));
 assert.equal(job.guidance.coaching,coaching);
 assert.equal(job.guidance.received.coaching,coaching);
 assert(job.guidance.requests>0);
 captured.terminal={score:frames.at(-1)?.score,tick:frames.at(-1)?.tick,result:replay.final};
 await seek().waitFor();
 return captured;
}
try{
 await page.goto(origin);
 if(hosted)await button(/Play 5v5|Start challenge/i).waitFor();
 await shot('play-desktop');
 await page.setViewportSize({width:390,height:844});
 await shot('play-mobile');
 await nav('My Agent');
 await shot('agent-mobile');
 await nav('Arena');
 await page.getByRole('heading',{name:'Prepare your commander'}).waitFor();
 await button(modeLabel).click();
 await button(difficulty).click();
 await button('Proactive').click();
 await page.getByLabel('Commander autonomy').selectOption('coach-led');
 await page.getByLabel('Coaching message').fill(demoGuidance);
 await shot('prepare-mobile');
 await page.setViewportSize({width:1180,height:920});
 await shot('prepare-desktop');

 if(!hosted||generate){
  const first=await submit(/Play 5v5|Start challenge/i,demoGuidance,{strategy:'proactive',autonomy:'coach-led'});
  await seek().focus();
  for(let i=0;i<14;i++)await seek().press('ArrowRight');
  await shot('battle-desktop');
  await page.setViewportSize({width:390,height:844});
  await shot('battle-mobile');
  if(flags.has('--natural-playback'))await button('Resume').click();
  else await button('Skip to result').click();
  const review=page.getByRole('region',{name:'Your match review'});
  await review.waitFor();
  await review.getByText('What your commander received',{exact:true}).click();
  await review.getByText('Compare intent, orders and execution',{exact:true}).click();
  await shot('review-mobile');
  await page.setViewportSize({width:1180,height:920});
  await shot('review-desktop');
  await button(/revise/i).click();
  const coach=page.getByLabel('Coaching message');
  assert.equal(await coach.inputValue(),demoGuidance);
  await coach.fill(revisedGuidance);
  await shot('rematch-setup');
  if(!hosted||flags.has('--rematch')){
   await page.waitForTimeout(hosted?60_000:1_050);
   await submit(/Play rematch/i,revisedGuidance,{strategy:'proactive',autonomy:'coach-led',sameSetup:first.id});
   await button('Skip to result').click();
   await page.getByText(/Previous .* → This match/).waitFor();
   await shot('rematch-comparison');
  }
 }
 if(verifyPublic){
  const before=matchPosts.length;
  await nav('Arena');
  await button(/Watch ERC-8004 Commander #2933/i).click();
  await seek().waitFor();
  await button('Skip to result').click();
  await page.getByText('Agent participation · ERC-8004 #2933',{exact:true}).click();
  await button('Check participation and replay').click();
  await page.getByText('Owner signature, historical BSC Testnet ownership, and replay confirmed.').waitFor({timeout:25000});
  await page.getByText('BNB Chain replay record',{exact:true}).click();
  await button('Check Testnet record').click();
  await page.getByText('Identity and replay commitment recorded on BSC Testnet.').waitFor({timeout:25000});
  assert.equal(matchPosts.length,before,'public verification started an AI match');
  await shot('public-verified');
 }
 if(verifyPractice){
  const before=matchPosts.length;
  await page.reload();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('arena-challenge-history')??'[]'));
  for(const run of runs as Array<{id:string;replay:{final:string}}>) {
   assert(stored.some((row:any)=>row.id===run.id&&row.result===run.replay.final));
  }
  for(const mode of ['Bomb Mode','Team Deathmatch','Relay']){
   await button(mode).click();
   await button(/Start practice|Try scripted practice/i).click();
   const battle=page.getByRole('region',{name:mode+' match'});
   await battle.getByText(/Scripted practice/).waitFor();
   await battle.getByRole('button',{name:'Skip to result'}).click();
   await battle.getByRole('heading',{name:/wins|Draw/}).waitFor();
   await battle.getByRole('button',{name:'Back to Play'}).click();
   practiced.push(mode);
  }
  assert.equal(matchPosts.length,before,'scripted practice started an AI match');
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('arena-challenge-history')??'[]'));
  assert.deepEqual(after,stored,'scripted practice modified challenge history');
 }
 assert.deepEqual(errors,[]);
 assert.equal(matchPosts.length,runs.length);
}catch(error){
 failure=error instanceof Error?error.message:String(error);
 throw error;
}finally{
 const video=page.video();
 await context.close();
 const recording=video?`${folder}/${kind}.webm`:null;
 if(video&&recording){
  const {renameSync}=await import('node:fs');
  renameSync(await video.path(),recording);
 }
 writeFileSync(`${folder}/${kind}.json`,JSON.stringify({origin,kind,shots,recording,errors,failure,startStatuses,runs,practiced,publicVerificationRequested:verifyPublic},null,2)+'\n');
 await browser.close();
 await fixture?.close();
}
