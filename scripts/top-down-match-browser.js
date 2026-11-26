async page=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4182');
 const coach=async(text)=>{
  await page.getByRole('button',{name:'My Agent',exact:true}).click();
  await page.getByLabel('Coaching message').fill(text);
  await page.getByRole('button',{name:'Save coaching'}).click();
  await page.getByText('Coaching saved for your next match.').waitFor();
 };
 const duel=page.getByRole('region',{name:'Objective Duel'});
 const run=async (button,text)=>{
  const request=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/api/matches'));
  const response=page.waitForResponse(async r=>r.request().method()==='GET'&&/\/api\/matches\/[\da-f-]+$/.test(r.url())&&r.ok()&&
   ['completed','interrupted'].includes((await r.json()).status),{timeout:80000});
  const started=Date.now();
  await button.click();
  const posted=(await request).postDataJSON();
  if(posted.coaching!==text)throw Error('Saved coaching differs from submitted coaching.');
  const match=await (await response).json();
  if(match.status==='completed'){
   await duel.getByRole('button',{name:'Skip to result'}).click();
   await duel.getByRole('heading',{name:/Blue wins|Sand wins|Draw/}).waitFor();
  }
  return {started,match,posted};
 };
 const a='Favor early objective progress when it is available.';
 const b='Be patient if the rival is visible. Prefer to preserve energy and reassess before committing.';
 const saved=await page.evaluate(()=>localStorage.getItem('arena-match'));
 let first;
 if(saved){
  const match=await page.evaluate(id=>fetch('/api/matches/'+id).then(r=>r.json()),saved);
  if(match.status!=='completed')throw Error('Use a new browser session when the prior match did not finish.');
  first={started:0,match};
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  await page.getByRole('button',{name:'Reopen your match'}).click();
  await duel.getByRole('button',{name:'Skip to result'}).click();
  await duel.getByRole('button',{name:'Same-setup rematch'}).waitFor();
 }else{
  await coach(a);
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  first=await run(page.getByRole('button',{name:'Play Objective Duel'}),a);
 }
 if(first.match.status!=='completed')return {first,errors};
 await coach(b);
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.waitForTimeout(Math.max(0,65000-(Date.now()-first.started)));
 const second=await run(duel.getByRole('button',{name:'Same-setup rematch'}),b);
 if(second.posted.sameSetup!==first.match.id||second.match.arena.seed!==first.match.arena.seed||
  second.match.arena.activator!==first.match.arena.activator||second.match.model!==first.match.model||errors.length)
  throw Error('Rematch configuration or page errors.');
 if(second.match.status==='completed'){
  await duel.locator('.continuous-comparison').waitFor();
  await page.screenshot({path:'evidence/top-down-arena/same-setup-result.png',fullPage:true});
 }
 return {first,second,errors};
}
