async page=>{
 const output='evidence/autonomous-product/';
 const errors=[];
 const calls=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.url().includes('/api/'))calls.push(request.method()+' '+new URL(request.url()).pathname);});
 await page.setViewportSize({width:1350,height:1050});
 await page.goto('http://127.0.0.1:4182');
 await page.getByRole('button',{name:'Arena',exact:true}).click();
 await page.getByRole('button',{name:'Watch Objective Duel'}).click();
 const duel=page.getByRole('region',{name:'Objective Duel'});
 await duel.getByText('Recorded Gemini Duel',{exact:false}).waitFor();
 await duel.getByText('Move until Core is available',{exact:true}).waitFor();
 await page.waitForFunction(()=>Boolean(document.querySelector('.continuous-canvas canvas')));
 await page.screenshot({path:output+'recorded-checkpoint.png'});
 if(await duel.getByRole('button',{name:'Skip to result'}).isVisible())
  await duel.getByRole('button',{name:'Skip to result'}).click();
 await duel.getByRole('heading',{name:'Sand wins'}).waitFor();
 if(calls.some(c=>c.startsWith('POST'))) throw Error('Recorded playback created a match or guest.');
 const coaching=async text=>{
  await page.getByLabel('Coaching message').fill(text);
  await page.getByRole('button',{name:'Save coaching'}).click();
  await page.getByText('Coaching saved for your next match.').waitFor();
 };
 await duel.getByRole('button',{name:'Coach Agent'}).click();
 const firstCoach='Prioritize making early progress when you can.';
 const secondCoach='Be deliberate. Reassess the rival before committing to an objective.';
 await coaching(firstCoach);
 await page.getByRole('button',{name:'Choose opponent'}).click();
 const getMatch=async(button)=>{
  const started=Date.now();
  const requested=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/api/matches'));
  const received=page.waitForResponse(async r=>r.request().method()==='GET'&&/\/api\/matches\/[\da-f-]+$/.test(r.url())&&
   r.ok()&&['completed','interrupted'].includes((await r.json()).status),{timeout:80000});
  await button.click();
  const body=(await requested).postDataJSON();
  const match=await (await received).json();
  if(match.status!=='completed')return {started,body,match};
  await duel.getByText('Gemini Duel',{exact:false}).waitFor();
  await duel.getByRole('button',{name:'Skip to result'}).click();
  await duel.getByRole('heading',{name:/Blue wins|Sand wins|Draw/}).waitFor();
  return {started,body,match};
 };
 const first=await getMatch(page.getByRole('button',{name:'Play Objective Duel'}));
 if(first.match.status!=='completed')return {first,errors,calls};
 await page.screenshot({path:output+'live-result.png'});
 await duel.getByRole('button',{name:'Coach Agent'}).click();
 await coaching(secondCoach);
 await page.screenshot({path:output+'corrective-coaching.png'});
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await duel.getByRole('button',{name:'Rematch'}).waitFor();
 // Keep each live match's burst in its own provider-minute window.
 await page.waitForTimeout(Math.max(0,65000-(Date.now()-first.started)));
 const second=await getMatch(duel.getByRole('button',{name:'Rematch'}));
 if(second.match.status==='completed'){
  await duel.getByText('Blue’s first tag or Core action').waitFor();
  await page.screenshot({path:output+'rematch-comparison.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'mobile-rematch.png',fullPage:true});
 }
 if(first.body.coaching!==firstCoach||second.body.coaching!==secondCoach||errors.length)
  throw Error('Coaching did not reach the match request or playback threw an error.');
 return {first,second,errors,calls};
}
