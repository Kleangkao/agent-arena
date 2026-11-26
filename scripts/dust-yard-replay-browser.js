async page=>{
  const folder='evidence/dust-yard-research';
  const file=folder+'/duel-replay.json';
  const url='http://127.0.0.1:4182';
  const errors=[],apiRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    if(/\/api\/|generativelanguage/.test(request.url())) apiRequests.push(request.url());
  });
  await page.goto(url+'/?arena-v26');
  const replay=await (await page.request.get(url+'/'+file)).json();
  const expected=replay.observations.reduce((total,[,events])=>total+events.length,0);
  const board=page.getByLabel('Dust Yard V2.6 battlefield');
  await page.getByLabel('Load replay').setInputFiles(file);
  await page.getByText(/Operator-attested Gemini recording/).waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Dust Yard V2.6 battlefield"]').dataset.events)>=10);
  await page.screenshot({path:folder+'/duel-in-progress.png'});
  await page.getByText(replay.final.result+' · '+replay.final.reason,{exact:true}).waitFor({timeout:35000});
  await page.waitForFunction(count=>Number(document.querySelector('[aria-label="Dust Yard V2.6 battlefield"]').dataset.events)===count,expected);
  await page.screenshot({path:folder+'/duel-result.png'});
  const rendered=Number(await board.getAttribute('data-events'));
  if(rendered!==expected||errors.length||apiRequests.length) throw Error('Replay playback mismatch or unexpected network requests');
  return {result:replay.final.result,reason:replay.final.reason,tick:replay.final.tick,rendered,expected,errors,apiRequests};
}
