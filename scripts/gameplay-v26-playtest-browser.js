async page=>{
  const browser=page.context().browser(), url='http://127.0.0.1:4182', out='evidence/gameplay-v26-playtest/';
  const read=()=>JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent);
  const check=(condition,message)=>{if(!condition) throw Error(message);};
  const browserErrors=[], api=[];
  const run=async(name,operation)=>{
    const viewport={width:960,height:780};
    const ctx=await browser.newContext({viewport,recordVideo:{dir:out,size:viewport}});
    const game=await ctx.newPage(), video=game.video();
    game.on('pageerror',e=>browserErrors.push(e.message));
    game.on('request',r=>{if(/\/api\/|generativelanguage/.test(r.url())) api.push(r.url());});
    try {return await operation(game);}
    finally {
      await ctx.close();
      await video.saveAs(out+name+'.webm');
      await video.delete();
    }
  };
  const result=await Promise.all([
    run('held-steering',async game=>{
      await game.goto(url+'/?arena-v26&collision-fixture');
      await game.getByLabel('State overlay').check();
      await game.getByRole('button',{name:'Start sandbox'}).click();
      await game.keyboard.down('KeyD');
      const ledger=await game.waitForFunction(()=>{
        const v=JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent);
        return v.tick>=4&&v.tick<19&&v.events.some(e=>e.kind==='collision'&&e.side===0&&e.with==='agent')&&v;
      });
      const blocked=await ledger.jsonValue();
      check(blocked.blue.agent.position.x===19000&&!blocked.blue.agent.moving,'Blue moved through the blocker');
      check(blocked.spectator.lastBoundary.inputs[0].movement.kind==='steer'&&
        blocked.spectator.lastBoundary.receipts[0].some(r=>r.channel==='movement'&&r.accepted),'Held steering was not accepted while blocked');
      const resumed=await (await game.waitForFunction(()=>{
        const v=JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent);
        return v.tick>=19&&v.blue.agent.position.x>19000&&v;
      })).jsonValue();
      await game.keyboard.up('KeyD');
      check(resumed.blue.agent.moving&&resumed.blue.agent.position.y===20790&&
        resumed.blue.agent.position.x===19000+(resumed.tick-18)*300&&
        resumed.sand.agent.position.x===21100+(resumed.tick-18)*600,'Authoritative positions did not match per-tick displacement');
      await game.getByLabel('Dust Yard V2.6 battlefield').screenshot({path:out+'held-steering.png'});
      return {blocked,resumed,keyDowns:1};
    }),
    run('score-stall',async game=>{
      const relative='evidence/gameplay-v26/score-deathmatch.json';
      const fixture=await (await game.request.get(url+'/'+relative)).json();
      const eventCount=fixture.observations.reduce((n,[,items])=>n+items.length,0);
      const attackCount=fixture.observations.flatMap(([,items])=>items).filter(e=>e.kind==='attack').length;
      await game.goto(url+'/?arena-v26');
      await game.getByLabel('State overlay').check();
      await game.getByLabel('Load replay').setInputFiles(relative);
      const board=game.getByLabel('Dust Yard V2.6 battlefield');
      await game.waitForFunction(()=>{
        const state=JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent);
        return state.tick>=290;
      },undefined,{timeout:30000});
      const before=await game.evaluate(read);
      await game.evaluate(()=>{const end=performance.now()+1100;while(performance.now()<end) {}});
      await game.waitForFunction(tick=>{
        const state=JSON.parse(document.querySelector('[aria-label="Authoritative event ledger"]').textContent);
        return state.tick>=tick+30;
      },before.tick);
      const after=await game.evaluate(read);
      const stalledEvents=fixture.observations.filter(([tick])=>tick>before.tick&&tick<=after.tick).flatMap(([,events])=>events);
      check(stalledEvents.some(e=>e.kind==='attack'),'The stall did not span an authoritative attack event');
      await game.getByText(fixture.final.result+' · '+fixture.final.reason,{exact:true}).waitFor({timeout:90000});
      await game.waitForFunction(n=>document.querySelector('[aria-label="Dust Yard V2.6 battlefield"]').dataset.events===String(n),eventCount);
      await game.waitForFunction(n=>document.querySelector('[aria-label="Dust Yard V2.6 battlefield"]').dataset.attacks===String(n),attackCount);
      return {eventCount,attackCount,drained:Number(await board.getAttribute('data-events')),attacks:Number(await board.getAttribute('data-attacks')),
        stalledFrom:before.tick,stalledTo:after.tick,stalledEventKinds:stalledEvents.map(e=>e.kind),
        result:fixture.final.result,reason:fixture.final.reason};
    })
  ]);
  check(!api.length&&!browserErrors.length,'Unexpected browser errors or API requests');
  return {collision:result[0],stall:result[1],browserErrors,api};
}
