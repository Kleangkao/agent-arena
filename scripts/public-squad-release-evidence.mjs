import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {loadSquads} from '../src/squads/game.ts';
import {coreTransitions} from '../src/squads/replay-summary.ts';

if(!process.argv.includes('--live'))throw Error('Pass --live to run up to four genuine public match starts.');
const origin='https://agent-arena-preview.vercel.app';
const bombOnly=process.argv.includes('--bomb-only');
const folder=bombOnly?'evidence/squad-native/bomb-retest':'evidence/squad-native';
mkdirSync(folder,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.ARENA_QA_PLAYWRIGHT?.replace(/package\.json$/,'')??'playwright');
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1180,height:920}});
const page=await context.newPage();
const proof={origin,startedAt:new Date().toISOString(),checks:{},attempts:[],matches:[],pageErrors:[]};
page.on('pageerror',error=>proof.pageErrors.push(error.message));
const nav=name=>page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name,exact:true}).click();
const button=(name)=>page.getByRole('button',{name,exact:true});
const screenshot=async name=>{
 const path=folder+'/'+name+'.png';
 await page.screenshot({path,fullPage:true});
 return path;
};
const save=()=>writeFileSync(folder+'/hosted-matches.json',JSON.stringify(proof,null,2)+'\n');
const coaching='Reassess every window. Choose a concrete objective and review which authorized orders made progress.';
const revised='Favor the South relay initially. If Sand contests it, reassign some units to North and defend any lead.';
let lastAccepted=0,session;

async function coach(text){
 await nav('My Agent');
 await page.getByRole('textbox',{name:'Coaching message'}).fill(text);
 await page.getByRole('button',{name:/^Save coaching/i}).click();
 await page.getByText('Coaching saved for your next match.',{exact:true}).waitFor();
 const cookie=(await context.cookies(origin+'/api/guest')).find(cookie=>cookie.name==='arena_guest');
 assert.ok(cookie?.secure&&cookie.httpOnly&&cookie.sameSite==='Strict');
 if(session)assert.equal(cookie.value,session);
 session=cookie.value;
}

async function record(mode,name,open){
 if(lastAccepted)await sleep(Math.max(0,61_000-(Date.now()-lastAccepted)));
 let accepted;
 for(let check=0;check<2;check++){
  const start=page.waitForResponse(response=>response.url()===origin+'/api/matches'&&response.request().method()==='POST',{timeout:20000});
  await open(check>0);
  const response=await start;
  const input=response.request().postDataJSON();
  const job=await response.json();
  const retry=Number(response.headers()['retry-after']);
  const {requestId:_,...safeInput}=input;
  proof.attempts.push({name,at:new Date().toISOString(),http:response.status(),route:'/api/matches',input:safeInput,
   ...(!response.ok()?{error:job.error,...(retry?{retryAfter:retry}:{})}:{id:job.id})});
  save();
  assert.equal(input.mode,mode);
  if(response.status()===202){accepted={job,input};break;}
  if(response.status()===429&&job.error?.startsWith('Arena is busy.')&&retry>0&&retry<=120){await sleep((retry+1)*1000);continue;}
  return;
 }
 if(!accepted)return;
 const {job,input}=accepted;
 lastAccepted=Date.now();
 const owner=(await context.cookies(origin+'/api/matches')).find(cookie=>cookie.name==='arena_guest');
 assert.equal(owner?.value,session);
 const route='/api/matches/'+job.id;
 let result;
 for(let poll=0;poll<33;poll++){
  const response=await context.request.get(origin+route);
  assert.equal(response.status(),200);
  result=await response.json();
  if(result.status!=='preparing')break;
  await sleep(2200);
 }
 assert.notEqual(result.status,'preparing','The public match did not finish inside the polling window.');
 const {id,status,replay,attempts,durationMs,model,error}=result;
 const playable=replay?loadSquads(replay):null;
 const finalFrame=playable?.frames.at(-1);
 const models=[...new Set(attempts?.flatMap(row=>row.model?[row.model]:[])??[])];
 const row={name,id,mode,status,model,models,durationMs,error,coaching:input.coaching,sameSetup:input.sameSetup,
  result:replay?.final,interruption:replay?.interruption,score:finalFrame?.score,finalTick:finalFrame?.tick,
  pulses:playable?.frames.reduce((n,frame)=>n+frame.shots.length,0),
  core:playable&&coreTransitions(playable.frames[0],playable.frames.slice(1)),
  attempts:attempts?.map(row=>row.status),pollRoute:route};
 proof.matches.push(row);
 writeFileSync(folder+'/hosted-'+name+'.json',JSON.stringify({id,status,replay,attempts,durationMs,model,error,coaching:input.coaching,sameSetup:input.sameSetup},null,2)+'\n');
 save();
 if(status==='completed'){
  assert.equal(replay?.source,'operator-attested-gemini');
  assert.ok(models.length&&attempts.some(row=>row.status==='accepted'));
  await page.getByText('Gemini commanders',{exact:false}).waitFor({timeout:12000});
  const progress=page.getByRole('slider',{name:'Replay position'});
  await page.waitForFunction(()=>Number(document.querySelector('input[type=range]')?.value)>=3);
  row.battleScreenshot=await screenshot('public-'+name+'-battle');
  if(await button('Skip to result').isVisible())await button('Skip to result').click();
  const title=replay.final==='blue'?'Blue Team wins':replay.final==='sand'?'Sand Team wins':'Draw';
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.ok(await progress.isVisible());
 }else{
  await page.locator('.notice').waitFor({timeout:12000});
 }
 row.resultScreenshot=await screenshot('public-'+name+'-result');
 row.noHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 assert.ok(row.noHorizontalOverflow);
 save();
 console.log(JSON.stringify(row));
 return row;
}

try {
 const health=await context.request.get(origin+'/api/health');
 assert.equal(health.status(),200);
 assert.equal((await health.json()).squadsConfigured,true);
 await page.goto(origin);
 await nav('Arena');
 await page.getByRole('button',{name:/^Play 5v5/i}).waitFor();
 await coach(coaching);
 const open=mode=>async()=>{
  await nav('Arena');
  await page.getByRole('group',{name:'Game mode'}).getByRole('button',{name:mode,exact:true}).click();
  await page.getByRole('button',{name:/^Play 5v5/i}).click();
 };
 const bomb=await record('bomb','bomb-desktop',open('Bomb Mode'));
 if(!bombOnly){
 await page.setViewportSize({width:390,height:844});
 const tdm=await record('tdm','tdm-mobile',open('Team Deathmatch'));
 const relay=await record('relay','relay-mobile',open('Relay'));
 const previous=[relay,tdm,bomb].find(row=>row?.status==='completed');
 if(previous){
  const next=previous.mode==='relay'?revised:'Protect the score advantage. Reassign idle units when their orders have finished.';
  await coach(next);
  await page.reload();
  await nav('My Agent');
  assert.equal(await page.getByRole('textbox',{name:'Coaching message'}).inputValue(),next);
  const reopen=async()=>{
   if(await page.evaluate(()=>localStorage.getItem('arena-match'))===previous.id){
    await nav('Arena');
    await button('REOPEN YOUR MATCH').click();
   }else{
    await nav('My Agent');
    await page.getByText('Recent matches',{exact:true}).click();
    await button('Reopen '+previous.result+' match').first().click();
   }
   await page.getByText('Gemini commanders',{exact:false}).waitFor({timeout:12000});
   if(await button('Skip to result').isVisible())await button('Skip to result').click();
   await button('Same-setup rematch').waitFor();
  };
  await reopen();
  proof.checks.coachingAfterReload=true;
  let firstRematch=true;
  const rematch=await record(previous.mode,'same-setup-mobile',async()=>{
   if(!firstRematch)await reopen();
   firstRematch=false;
   await button('Same-setup rematch').click();
  });
  if(rematch){
   assert.equal(rematch.sameSetup,previous.id);
   assert.equal(rematch.coaching,next);
   const before=proof.matches.find(row=>row.id===previous.id);
   assert.equal(rematch.model,before.model);
   proof.checks.sameSetup=rematch.status==='completed';
  }
 }
 }
 proof.checks.sameGuest=true;
 proof.checks.thirdMatchAdmitted=proof.attempts.filter(row=>row.http===202).length>=3;
 proof.checks.thirdMatchCompleted=proof.matches.filter(row=>row.status==='completed').length>=3;
 assert.deepEqual(proof.pageErrors,[]);
}catch(error){
 proof.failure=error.message;
 await screenshot('public-smoke-failure').catch(()=>{});
 throw error;
}finally{
 save();
 await browser.close();
}
