async page => {
  const browser = page.context().browser(), origin='http://127.0.0.1:4182';
  const out='evidence/gameplay-v24/';
  const errors=[];
  const observe=game=>{
    game.on('pageerror',error=>errors.push(error.message));
    game.on('request',request=>{if(/\/api\/|generativelanguage/.test(request.url()))errors.push(request.url());});
  };
  const check=(passed,message)=>{if(!passed)throw Error(message);};
  async function capture(name,verdict,width=860){
    const viewport={width,height:width===390?844:890};
    const context=await browser.newContext({viewport,recordVideo:{dir:out,size:viewport}});
    const game=await context.newPage();
    observe(game);
    try{
      await game.goto(origin+'/?gameplay-v24&fps=60');
      await game.getByLabel('Load replay').setInputFiles(out+name+'.json');
      await game.getByRole('button',{name:'Play replay',exact:true}).click();
      if(name==='completed'){
        await game.getByText('Arena Core · active',{exact:true}).waitFor();
        await game.screenshot({path:out+'active.png',fullPage:true});
      }
      if(name==='disabled'){
        await game.getByRole('progressbar',{name:'Core interaction progress'}).first().waitFor();
        check(await game.evaluate(()=>innerWidth===document.documentElement.scrollWidth),'Mobile has horizontal overflow');
      }
      const status=game.locator('.graybox-status span');
      await status.getByText(verdict,{exact:true}).waitFor({timeout:30_000});
      const hp=await game.locator('meter').evaluateAll(values=>values.map(meter=>meter.value));
      if(name==='disabled')await game.screenshot({path:out+'disabled-mobile.png',fullPage:true});
      if(name==='deadline')await game.screenshot({path:out+'deadline.png',fullPage:true});
      await game.waitForTimeout(180);
      const video=game.video();
      await context.close();
      await video.saveAs(out+name+'.webm');await video.delete();
      return {name,verdict,hp,width};
    }finally{await context.close();}
  }
  const manual=async()=>{
    const context=await browser.newContext({viewport:{width:860,height:940},acceptDownloads:true});
    const game=await context.newPage();
    observe(game);
    try {
      await game.goto(origin+'/?arena-objective');
      await game.getByLabel('State overlay').check();
      await game.getByRole('button',{name:'Start sandbox'}).click();
      const get=()=>game.locator('pre').textContent().then(JSON.parse);
      const wait=async(predicate,message)=>{
        for(let i=0;i<220;i++){const data=await get();if(predicate(data))return data;await game.waitForTimeout(16);}
        throw Error(message);
      };
      await game.keyboard.press('KeyX');
      await game.getByText('Core interaction unavailable',{exact:true}).waitFor();
      await game.keyboard.down('KeyD');
      await wait(d=>d.blue.actions.includes('interact'),'Blue failed to reach objective');
      await game.keyboard.up('KeyD');
      await wait(d=>!d.state.fighters[0].motion,'Failed to stop');
      await game.keyboard.press('KeyX');
      const start=await wait(d=>d.state.core.interaction?.side===0,'Manual Core interaction not accepted');
      await game.keyboard.press('KeyZ');
      await wait(d=>d.state.core.phase==='pending'&&!d.state.core.interaction,'Manual cancel failed');
      await game.keyboard.press('KeyX');
      await wait(d=>d.state.core.phase==='active','Manual activation failed');
      await game.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Save replay')?.disabled,
        undefined,{timeout:25_000});
      const final=(await get()).state;
      const pending=game.waitForEvent('download');
      await game.getByRole('button',{name:'Save replay'}).click();
      await (await pending).saveAs(out+'manual.json');
      await game.getByRole('button',{name:'Reset',exact:true}).click();
      await game.getByLabel('Blue role').selectOption('1');
      check((await get()).state.tick===0,'Reset failed');
      await game.getByText('Blue · Defender',{exact:true}).waitFor();
      await game.goto(origin+'/?gameplay-v24');
      await game.getByLabel('Load replay').setInputFiles(out+'manual.json');
      await game.getByRole('button',{name:'Skip to result'}).click();
      await game.getByLabel('State overlay').check();
      check(JSON.stringify((await get()).state)===JSON.stringify(final),'Imported replay disagrees with manual run');
      await game.reload();
      await game.getByRole('button',{name:'Skip to result'}).click();
      await game.getByLabel('State overlay').check();
      check(JSON.stringify((await get()).state)===JSON.stringify(final),'Refresh lost the replay state');
      return {manualStartTick:start.state.tick, manualX:start.state.fighters[0].position.x,final};
    }finally{await context.close();}
  };
  const manualEvidence=await manual();
  const clips=await Promise.all([
    capture('completed','Blue wins · Core completed'),
    capture('disabled','Sand wins · Core disabled',390),
    capture('deadline','Sand wins · Activation prevented'),
    capture('elimination','Blue wins · Elimination'),
    capture('paired-blue-activator','Blue wins · Core completed'),
    capture('paired-sand-activator','Blue wins · Core disabled'),
    capture('activator-defeated-after-activation','Sand wins · Core completed'),
  ]);
  check(errors.length===0,errors.join('\n'));
  return {manual:manualEvidence,clips,errors};
}
