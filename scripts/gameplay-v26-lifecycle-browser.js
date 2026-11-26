async page=>{
  const browser=page.context().browser(), url='http://127.0.0.1:4182', out='evidence/gameplay-v26-lifecycle/';
  const run=async(close)=>{
  const basename=close?'revised-close':'revised';
  const ctx=await browser.newContext({viewport:{width:960,height:820},recordVideo:{dir:out,size:{width:960,height:820}}});
  const game=await ctx.newPage(), video=game.video();
  const errors=[], calls=[];
  game.on('pageerror',e=>errors.push(e.message));
  game.on('request',r=>{if(/\/api\/|generativelanguage/.test(r.url())) calls.push(r.url());});
  const ledger=()=>JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent);
  const until=fn=>game.waitForFunction(fn,undefined,{timeout:15000});
  try {
    await game.goto(url+'/?arena-v26');
    await game.getByLabel('Mode').selectOption('score-deathmatch');
    await game.getByLabel('State overlay').check();
    await game.getByRole('button',{name:'Start sandbox'}).click();
    await game.keyboard.down('KeyD');
    await game.waitForFunction(tick=>JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent).tick>=tick,
      close?88:30);
    await game.keyboard.up('KeyD');
    const reload=await (await until(()=>{
      const t=JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent);
      return t.sand.agent.reloadIn>700&&t;
    })).jsonValue();
    await game.getByLabel('Sand action').getByRole('progressbar').waitFor();
    await game.screenshot({path:out+basename+'-reload.png'});
    await until(()=>JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent).tick>=150);
    const now=await game.evaluate(ledger);
    const download=game.waitForEvent('download');
    await game.getByRole('button',{name:'Save diagnostic trace'}).click();
    await (await download).saveAs(out+basename+'-trace.json');
    if(errors.length||calls.length) throw Error(JSON.stringify({errors,calls}));
    return {reloadTick:reload.tick,reloadIn:reload.sand.agent.reloadIn,moving:reload.sand.agent.moving,
      distance:Math.hypot(reload.sand.agent.position.x-reload.blue.agent.position.x,reload.sand.agent.position.y-reload.blue.agent.position.y),
      traceEnd:now.tick,errors,calls};
  } finally {
    await ctx.close();
    await video.saveAs(out+basename+'-observations.webm');
    await video.delete();
  }
  };
  return {open:await run(false),close:await run(true)};
}

