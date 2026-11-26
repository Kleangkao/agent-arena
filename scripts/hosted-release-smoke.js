export default async browser => {
 process.loadEnvFile('.env.local');
 const token=process.env.VERCEL_OIDC_TOKEN;
 const origin=process.env.ARENA_SMOKE_ORIGIN;
 const restored=process.env.ARENA_SMOKE_GUEST&&process.env.ARENA_SMOKE_FIRST&&process.env.ARENA_SMOKE_REQUEST;
 const existingRematch=process.env.ARENA_SMOKE_EXISTING_REMATCH;
 if(!token||!/^https:\/\/agent-arena-preview-[a-z0-9-]+\.vercel\.app$/.test(origin??''))throw Error('Missing protected Preview configuration.');
 const headers={'x-vercel-trusted-oidc-idp-token':token};
 const out='evidence/hosted-release/';
 const qualify=async context=>{
  await context.route(origin+'/**',route=>route.continue({headers:{...route.request().headers(),...headers}}));
  return context;
 };
 const context=await qualify(await browser.newContext({viewport:{width:1280,height:900}}));
 const other=await qualify(await browser.newContext());
 const live=await context.newPage();
 const call=(context,path,{method='GET',body,originHeader}={})=>context.request.fetch(origin+'/api/'+path,{
  method,data:body,headers:{...headers,...(method==='POST'?{origin:originHeader??origin}:{})},
 });
 const click=name=>live.getByRole('button',{name,exact:true}).click();
 const shot=name=>live.screenshot({path:out+name,fullPage:true});
 const requireStatus=(response,expected,label)=>{if(response.status()!==expected)throw Error(label+' returned '+response.status());return response;};
 const accepted=()=>{
  return live.waitForResponse(r=>r.url()===origin+'/api/matches'&&r.request().method()==='POST',{timeout:16000})
   .then(async r=>({id:(await requireStatus(r,202,'Match creation').json()).id,input:r.request().postDataJSON(),at:Date.now()}));
 };
 const result=()=>live.getByRole('heading',{name:/^(Victory|Defeat|Draw)$/}).waitFor({timeout:85000});
 const lessons=()=>live.getByText('Agent lesson',{exact:true}).waitFor({timeout:22000});
 try{
  if(restored)await context.addCookies([{name:'arena_guest',value:process.env.ARENA_SMOKE_GUEST,
   domain:new URL(origin).hostname,path:'/api',httpOnly:true,secure:true,sameSite:'Strict'}]);
  const health=await requireStatus(await call(context,'health'),200,'Health').json();
  if(!health.geminiConfigured)throw Error('Live environment did not initialize');
  requireStatus(await call(other,'memory'),401,'Signed-out guest');
  requireStatus(await call(other,'guest',{method:'POST',originHeader:'https://foreign.example'}),403,'Cross-origin POST');
  requireStatus(await call(other,'guest',{method:'POST'}),204,'Second guest');
  requireStatus(await call(other,'matches',{method:'POST',body:{winner:'blue'}}),400,'Client-supplied outcome');
  await live.goto(origin);
  await click('My Agent');
  const coaching='Keep competing each turn and use ammo deliberately.';
  if(restored)await live.waitForFunction(text=>document.querySelector('#coach')?.value===text,coaching);
  else {
   await live.getByRole('textbox',{name:'Coaching message'}).fill(coaching);
   await click('SAVE COACHING ↗');
   await live.getByText('Coaching saved for your next match.').waitFor();
  }
  await shot('desktop-coaching.png');
  let first;
  if(restored){
   first={id:process.env.ARENA_SMOKE_FIRST,at:0,input:{requestId:process.env.ARENA_SMOKE_REQUEST,coaching,opponent:'official-sand-pace'}};
   await live.evaluate(id=>localStorage.setItem('arena-match',id),first.id);
  }else{
   await click('Choose opponent →');
   await click('Fast-paced');
   const firstAccepted=accepted();
   await click('CHALLENGE ↗');
   first=await firstAccepted;
  }
  const repeated=await requireStatus(await call(context,'matches',{method:'POST',body:first.input}),200,'Duplicate match start').json();
  if(repeated.id!==first.id)throw Error('Duplicate request used a new match id');
  requireStatus(await call(other,'matches/'+first.id),404,'Cross-guest replay');
  if(!restored){
   requireStatus(await call(other,'matches',{method:'POST',body:{...first.input,requestId:crypto.randomUUID()}}),429,'Concurrent arena request');
   await click('BACK TO ARENA');
  }
  await live.reload();
  await click('Arena');
  await click('REOPEN YOUR MATCH');
  await live.getByText('Turn 3 / 10',{exact:true}).waitFor({timeout:80000});
  await shot('desktop-hosted-battle.png');
  await result();
  await lessons();
  const firstRecord=await requireStatus(await call(context,'matches/'+first.id),200,'First replay').json();
  const memory1=await requireStatus(await call(context,'memory'),200,'First memory').json();
  if(firstRecord.reflection?.status!=='saved'||memory1.revision!==1)throw Error('First hosted reflection did not persist');
  await shot('desktop-hosted-result.png');
  await live.setViewportSize({width:390,height:844});
  let secondId=existingRematch;
  if(!secondId){
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,62000-(Date.now()-first.at))));
   const secondAccepted=accepted();
   await live.getByRole('button',{name:/rematch/i}).click();
   secondId=(await secondAccepted).id;
   await result();
   await lessons();
  }
  const secondRecord=await requireStatus(await call(context,'matches/'+secondId),200,'Second match').json();
  const memory2=await requireStatus(await call(context,'memory'),200,'Second memory').json();
  if(existingRematch){
   if(secondRecord.status!=='interrupted'||memory2.revision!==1)throw Error('Interrupted rematch changed saved memory');
   await live.evaluate(id=>localStorage.setItem('arena-match',id),secondId);
   await live.reload();
   await click('Arena');
   await click('REOPEN YOUR MATCH');
   await live.getByText('Match preparation stopped. Try again from Arena.',{exact:true}).waitFor();
   await shot('mobile-hosted-interruption.png');
   await live.evaluate(id=>localStorage.setItem('arena-match',id),first.id);
   await click('Arena');
   await click('REOPEN YOUR MATCH');
   await result();
   await lessons();
  }else if(secondRecord.reflection?.status!=='saved'||memory2.revision!==2){
   throw Error('Second hosted reflection did not persist');
  }
  await shot('mobile-hosted-result.png');
  await live.reload();
  await click('My Agent');
  await live.getByText('Memory',{exact:true}).click();
  await live.locator('.coach li').first().waitFor();
  await live.getByText('Agent Passport',{exact:true}).click();
  await click('Check public settlement');
  await live.getByText('Confirmed BSC Testnet · Blue Team wins',{exact:true}).waitFor({timeout:12000});
  if(await live.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile layout overflowed');
  await shot('mobile-hosted-memory-passport.png');
  console.log(JSON.stringify({first:first.id,second:secondId,results:[firstRecord.replay.result,secondRecord.replay?.result??secondRecord.status],
   revisions:[memory1.revision,memory2.revision],guestIsolation:true,idempotence:true,passport:true}));
 }catch(error){
  await shot('failure.png').catch(()=>{});
  throw error;
 }finally{
  await context.close();
  await other.close();
 }
}
