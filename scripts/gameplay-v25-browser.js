async page => {
  const browser=page.context().browser(), origin='http://127.0.0.1:4182', out='evidence/gameplay-v25/';
  const errors=[], traffic=[];
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const read=game=>game.locator('pre').textContent().then(JSON.parse);
  const watch=game=>{
    game.on('pageerror',error=>errors.push(error.message));
    game.on('request',req=>{if(/\/api\/|generativelanguage/.test(req.url()))traffic.push(req.url());});
  };
  const reason={'core-completed':'Core completed','core-disabled':'Core disabled',elimination:'Elimination',
    'activation-prevented':'Activation prevented','target-score':'Target score reached','score-clock':'Higher score at the deadline',
    'equal-score':'Equal scores at the deadline','simultaneous-target':'Both reached the target'};
  const capture=async(name,width=900)=>{
    const viewport={width,height:width===390?844:900};
    const context=await browser.newContext({viewport,recordVideo:{dir:out,size:viewport}});
    const game=await context.newPage();
    watch(game);
    try{
      const asset=await game.request.get(origin+'/'+out+name+'.json');
      const stored=await asset.json();
      const expected=({blue:'Blue wins',sand:'Sand wins',draw:'Draw'})[stored.final.result]+' · '+reason[stored.final.reason];
      await game.goto(origin+'/?gameplay-v25&fps=60');
      await game.getByLabel('Load replay').setInputFiles(out+name+'.json');
      await game.getByRole('button',{name:'Play replay',exact:true}).click();
      if(name==='core-completed'){
        await game.getByText('Arena Core · active',{exact:true}).waitFor();
        await game.screenshot({path:out+'objective-active.png',fullPage:true});
      }
      if(name==='ordinary-score'){
        await game.getByText('Respawn in', {exact:false}).first().waitFor({timeout:25000});
        await game.screenshot({path:out+'score-respawn-mobile.png',fullPage:true});
      }
      if(name==='target-score'){
        await game.locator('.graybox-status span').getByText('scored',{exact:false}).waitFor({timeout:25000});
        await game.getByRole('button',{name:'Pause',exact:true}).click();
        const elapsed=await game.locator('.graybox-status strong').innerText();
        await game.waitForTimeout(260);
        check(elapsed===await game.locator('.graybox-status strong').innerText(),'Replay moved while paused');
        await game.getByRole('button',{name:'Resume',exact:true}).click();
      }
      await game.locator('.graybox-status span').getByText(expected,{exact:true}).waitFor({timeout:130000});
      check(await game.evaluate(()=>innerWidth===document.documentElement.scrollWidth),'Horizontal overflow in '+name);
      if(name==='target-score'||name==='core-disabled')await game.screenshot({path:out+name+'.png',fullPage:true});
      await game.getByLabel('State overlay').check();
      const final=(await read(game)).state;
      check(JSON.stringify(final)===JSON.stringify(stored.final),'Stored outcome mismatch in '+name);
      await game.getByLabel('State overlay').uncheck();
      await game.waitForTimeout(150);
      const video=game.video();
      await context.close();
      await video.saveAs(out+name+'.webm');
      await video.delete();
      return {name,width,verdict:expected,tick:final.tick,score:final.score,hp:final.fighters.map(f=>f.hp)};
    }finally{await context.close();}
  };
  async function manual(){
    const context=await browser.newContext({viewport:{width:900,height:900},acceptDownloads:true});
    const game=await context.newPage();
    watch(game);
    try{
      await game.goto(origin+'/?arena-modes');
      await game.getByRole('combobox',{name:'Mode',exact:true}).selectOption('score-deathmatch');
      await game.getByRole('heading',{name:'Score Deathmatch'}).waitFor();
      await game.getByRole('combobox',{name:'Target',exact:true}).selectOption('20');
      await game.getByText('First to 20',{exact:true}).waitFor();
      await game.getByRole('combobox',{name:'Match time',exact:true}).selectOption('45');
      await game.getByText('45.0 s left',{exact:true}).waitFor();
      await game.getByRole('combobox',{name:'Mode',exact:true}).selectOption('elimination');
      await game.getByRole('heading',{name:'Legacy Elimination'}).waitFor();
      await game.getByRole('combobox',{name:'Mode',exact:true}).selectOption('objective-duel');
      await game.screenshot({path:out+'sandbox-controls.png',fullPage:true});
      await game.getByRole('combobox',{name:'Blue role',exact:true}).selectOption('1');
      await game.getByText('Blue · Defender',{exact:true}).waitFor();
      await game.getByRole('combobox',{name:'Blue role',exact:true}).selectOption('0');
      await game.getByRole('combobox',{name:'Core timing',exact:true}).selectOption('reference');
      await game.getByRole('spinbutton',{name:'Seed',exact:true}).fill('3');
      await game.getByRole('spinbutton',{name:'Seed',exact:true}).blur();
      await game.getByLabel('State overlay').check();
      await game.getByRole('button',{name:'Start sandbox'}).click();
      await game.keyboard.press('KeyX');
      await game.getByText('Core interaction unavailable',{exact:true}).waitFor();
      await game.keyboard.down('KeyD');
      await game.waitForFunction(()=>JSON.parse(document.querySelector('pre').textContent).blue.legal.actions.includes('interact'));
      await game.keyboard.up('KeyD');
      await game.keyboard.press('KeyX');
      await game.getByRole('progressbar',{name:'Core interaction progress'}).waitFor();
      await game.keyboard.press('KeyZ');
      await game.getByText('Blue · interaction cancelled',{exact:true}).waitFor();
      await game.keyboard.press('KeyX');
      await game.getByText('Arena Core · active',{exact:true}).waitFor();
      await game.getByRole('button',{name:'Start again'}).waitFor({timeout:29000});
      const final=(await read(game)).state,download=game.waitForEvent('download');
      await game.getByRole('button',{name:'Save replay'}).click();
      await (await download).saveAs(out+'manual.json');
      await game.getByRole('button',{name:'Reset',exact:true}).click();
      check((await read(game)).state.tick===0,'Reset failed');
      await game.goto(origin+'/?gameplay-v25');
      await game.getByLabel('Load replay').setInputFiles(out+'manual.json');
      await game.reload();
      await game.getByLabel('State overlay').check();
      await game.getByRole('button',{name:'Skip to result'}).click();
      check(JSON.stringify((await read(game)).state)===JSON.stringify(final),'Refresh changed imported result');
      return {modeSelect:true,targetSelect:true,clockSelect:true,roleSelect:true,reset:true,invalidCore:true,cancel:true,activated:true,refresh:true,final};
    }finally{await context.close();}
  }
  const names=[['core-completed'],['core-disabled'],['reference-blue-activator'],['idle-objective-deadline'],
    ['elimination'],['interrupted'],['paired-0'],['paired-1'],['ordinary-objective'],
    ['target-score'],['ordinary-score',390],['score-clock'],['equal-score'],['simultaneous-defeats']];
  const clips=[], manualRun=manual().catch(error=>({error:String(error)}));
  // Batch contexts so recording keeps up with game playback.
  for(const subset of [names.slice(0,4),names.slice(4,9),names.slice(9)]) clips.push(...await Promise.all(subset.map(args=>capture(...args))));
  const manualEvidence=await manualRun;
  check(!manualEvidence.error,manualEvidence.error);
  check(!errors.length,errors.join('; '));
  check(!traffic.length,traffic.join('; '));
  return {clips,manual:manualEvidence,errors,traffic};
}

