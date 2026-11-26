async page=>{
  const browser=page.context().browser(),url='http://127.0.0.1:4182',out='evidence/gameplay-v26/';
  const check=(ok,text)=>{if(!ok)throw Error(text);};
  const results=await Promise.all(['manual','objective-duel','score-deathmatch'].map(async name=>{
    const viewport={width:960,height:780};
    const ctx=await browser.newContext({viewport,recordVideo:{dir:out,size:viewport}});
    const game=await ctx.newPage(),err=[],api=[];
    game.on('pageerror',e=>err.push(e.message));
    game.on('request',r=>{if(/\/api\/|generativelanguage/.test(r.url()))api.push(r.url());});
    const video=game.video();
    try {
      const fixture=await (await game.request.get(url+'/'+out+name+'.json')).json();
      const eventCount=fixture.observations.reduce((n,[,items])=>n+items.length,0);
      await game.goto(url+'/?arena-v26');
      await game.getByLabel('State overlay').check();
      await game.getByLabel('Load replay').setInputFiles(out+name+'.json');
      if(name==='score-deathmatch') {
        await game.waitForTimeout(1500);
        await game.evaluate(()=>{const end=performance.now()+1100;while(performance.now()<end){}});
      }
      await game.getByText(fixture.final.result+' · '+fixture.final.reason,{exact:true}).waitFor({timeout:90000});
      const board=game.getByLabel('Dust Yard V2.6 battlefield');
      await game.waitForFunction(expected=>document.querySelector('[aria-label="Dust Yard V2.6 battlefield"]').dataset.events===String(expected),eventCount);
      const count=Number(await board.getAttribute('data-events'));
      check(count===eventCount,name+' event stream length mismatch');
      check(!err.length&&!api.length,name+' unexpected errors or requests');
      await board.screenshot({path:out+name+'.png'});
      return {name,result:fixture.final.result,reason:fixture.final.reason,tick:fixture.final.tick,expected:eventCount,drained:count,errors:err,api};
    } finally {
      await ctx.close();
      if(video) await video.saveAs(out+name+'.webm');
    }
  }));
  await page.goto(url+'/?arena-v26');
  await page.getByLabel('State overlay').check();
  await page.getByRole('button',{name:'Start sandbox'}).click();
  await page.keyboard.down('KeyD');
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const inAir=JSON.parse(await page.getByLabel('Authoritative event ledger').innerText()).blue.agent;
  await page.keyboard.up('KeyD');
  check(inAir.moving&&inAir.airFor>0&&inAir.position.x>8910,'manual air/steer packet did not move');
  await page.getByLabel('Dust Yard V2.6 battlefield').screenshot({path:out+'manual-live.png'});
  return {results,input:{moving:inAir.moving,airFor:inAir.airFor,x:inAir.position.x}};
}
