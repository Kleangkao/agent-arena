async page=>{
  const url='http://127.0.0.1:4182', output='evidence/gameplay-v26-upstream/';
  const verify=(ok,message)=>{if(!ok) throw Error(message);};
  const browser=page.context().browser();
  const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:1050,height:800},acceptDownloads:true})));
  const observe=async context=>{
    const game=await context.newPage(),errors=[],requests=[];
    game.on('pageerror',e=>errors.push(e.message));
    game.on('request',r=>{if(/\/api\/|generativelanguage/.test(r.url())) requests.push(r.url());});
    await game.goto(url+'/?arena-v26');
    return {game,errors,requests};
  };
  try {
    const [replay,manual]=await Promise.all(contexts.map(observe));
    const [replayed,exported]=await Promise.all([
      (async()=>{
        const {game,errors,requests}=replay;
        const filename=output+'finite-objective.json';
        const fixture=await (await game.request.get(url+'/'+filename)).json();
        const expected=fixture.observations.reduce((n,[,events])=>n+events.length,0);
        await game.getByLabel('Load replay').setInputFiles(filename);
        const source=game.getByText('Replay · Injected provider', {exact:false});
        await source.waitFor();
        await game.reload();
        await game.getByLabel('Load replay').setInputFiles(filename);
        await source.waitFor();
        await game.waitForTimeout(1000);
        await game.evaluate(()=>{const end=performance.now()+1100;while(performance.now()<end){}});
        await game.getByText(fixture.final.result+' · '+fixture.final.reason,{exact:true}).waitFor({timeout:35000});
        const board=game.getByLabel('Dust Yard V2.6 battlefield');
        await game.waitForFunction(n=>Number(document.querySelector('[aria-label="Dust Yard V2.6 battlefield"]').dataset.events)===n,expected);
        const drained=Number(await board.getAttribute('data-events'));
        await game.screenshot({path:output+'replay.png'});
        verify(drained===expected&&!errors.length&&!requests.length,'Replay or network check failed');
        return {result:fixture.final.result,reason:fixture.final.reason,ticks:fixture.final.tick,expected,drained,errors,requests};
      })(),
      (async()=>{
        const {game,errors,requests}=manual;
        await game.getByLabel('Mode').selectOption('score-deathmatch');
        await game.getByLabel('State overlay').check();
        await game.getByRole('button',{name:'Start sandbox'}).click();
        await game.getByText('Blue manual · Sand scripted', {exact:false}).waitFor();
        await game.keyboard.down('KeyD');
        await game.waitForFunction(()=>JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent).tick>=88);
        await game.keyboard.up('KeyD');
        const progress=game.getByLabel('Sand action').getByRole('progressbar');
        await progress.waitFor();
        verify(Number(await progress.getAttribute('value'))>=0,'Reload progress missing');
        await game.screenshot({path:output+'manual-reload.png'});
        const next=game.waitForEvent('download');
        await game.getByRole('button',{name:'Save diagnostic trace'}).click();
        await (await next).saveAs(output+'manual-trace.json');
        verify(!errors.length&&!requests.length,'Manual errors or API requests');
        return {manualReload:true,trace:output+'manual-trace.json',errors,requests};
      })(),
    ]);
    return {replayed,exported};
  } finally {
    await Promise.all(contexts.map(context=>context.close()));
  }
}
