async page=>{
 const output='evidence/autonomous-product/';
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 if(await page.getByRole('alert').count())throw Error('Unexpected page alert before retry.');
 await page.getByRole('button',{name:'Arena',exact:true}).click();
 const requested=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/api/matches'));
 const received=page.waitForResponse(async r=>r.request().method()==='GET'&&/\/api\/matches\/[\da-f-]+$/.test(r.url())&&
  r.ok()&&['completed','interrupted'].includes((await r.json()).status),{timeout:80000});
 await page.getByRole('button',{name:'Play Objective Duel'}).click();
 const request=(await requested).postDataJSON();
 const match=await (await received).json();
 if(request.coaching!=='Be deliberate. Reassess the rival before committing to an objective.')
  throw Error('Retry did not use the coaching saved for the rematch.');
 if(match.status==='completed'){
  const duel=page.getByRole('region',{name:'Objective Duel'});
  await duel.getByRole('button',{name:'Skip to result'}).click();
  await duel.getByText('Blue’s first tag or Core action').waitFor();
  const comparison=await duel.locator('.continuous-comparison').innerText();
  await page.screenshot({path:output+'rematch-comparison.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'mobile-rematch.png',fullPage:true});
  return {request,match,comparison,errors};
 }
 return {request,match,errors};
}
