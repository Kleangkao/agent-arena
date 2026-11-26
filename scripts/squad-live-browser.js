async page=>{
 const second=new URL(page.url()).searchParams.has('squad-rematch-probe');
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1200,height:900});
 await page.goto('http://127.0.0.1:4182/');
 const coach=async(text)=>{
  await page.getByRole('button',{name:'My Agent',exact:true}).click();
  await page.getByLabel('Coaching message').fill(text);
  await page.getByRole('button',{name:'Save coaching'}).click();
  await page.getByText('Coaching saved for your next match.').waitFor();
 };
 const matchView=page.getByRole('region',{name:'Relay match'});
 const run=async (button,coaching)=>{
  const submit=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/matches'));
  const terminal=page.waitForResponse(async r=>r.ok()&&r.request().method()==='GET'&&/\/api\/matches\/[a-f0-9-]+$/.test(r.url())&&
   ['completed','interrupted'].includes((await r.json()).status),{timeout:75000});
  const started=Date.now();
  await button.click();
  const response=await submit;
  if(!response.ok()){
   void terminal.catch(()=>{});
   throw Error('Match start returned HTTP '+response.status());
  }
  const posted=response.request().postDataJSON();
  if(posted.coaching!==coaching||posted.rulesVersion!=='squads-v2')throw Error('Match request did not match the coaching/setup.');
  const job=await (await terminal).json();
  if(job.status==='completed'){
   await matchView.getByRole('button',{name:'Pause',exact:true}).click();
   const scrub=matchView.getByRole('slider');
   await scrub.focus();
   for(let i=0;i<10;i++)await scrub.press('ArrowRight');
   await page.screenshot({path:'evidence/squads/current-'+(posted.sameSetup?'rematch':'live')+'-playback.png',fullPage:true});
   await matchView.getByRole('button',{name:'Skip to result'}).click();
   await matchView.getByRole('heading',{name:/wins|Draw/}).waitFor();
   await page.screenshot({path:'evidence/squads/current-'+(posted.sameSetup?'rematch':'live')+'-result.png',fullPage:true});
  }
  return {started,job,posted};
 };
 const a='Favor North. Assign four units to distinct North Relay scoring cells, and send one to South to scout and score.';
 const b='Favor South. Assign four units to distinct South Relay scoring cells, and send one to North to scout and score.';
 await coach(second?b:a);
 if(!second){
  await page.getByRole('button',{name:'Arena',exact:true}).click();
  return {first:await run(page.getByRole('button',{name:'Play 5v5'}),a),errors};
 }
 await page.getByText('Recent matches',{exact:true}).click();
 await page.getByRole('button',{name:/Reopen .+ match/}).first().click();
 await matchView.getByRole('button',{name:'Skip to result'}).click();
 const firstId=await page.evaluate(()=>localStorage.getItem('arena-match'));
 const followup=await run(matchView.getByRole('button',{name:'Same-setup rematch'}),b);
 if(followup.posted.sameSetup!==firstId)throw Error('The rematch did not use the prior setup.');
 return {followup,errors};
}
