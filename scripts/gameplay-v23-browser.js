async page => {
  const browser = page.context().browser(), origin = 'http://127.0.0.1:4182';
  const out = 'evidence/gameplay-v23/';
  const errors = [], metrics = [];
  const check = (actual, message) => { if (!actual) throw Error(message); };
  const observe = game => {
    game.on('pageerror', error => errors.push(error.message));
    game.on('request', request => {
      if (/\/api\/|generativelanguage\.googleapis\.com/.test(request.url())) errors.push('Unexpected API call');
    });
  };
  const overlay = game => game.locator('pre').textContent().then(JSON.parse);
  const wait = async (game, predicate, message) => {
    for (let i = 0; i < 200; i++) {
      const data = await overlay(game);
      if (predicate(data)) return data;
      await game.waitForTimeout(16);
    }
    throw Error(message);
  };
  async function manual(rate, video) {
    const viewport = {width: 880, height: 1130};
    const context = await browser.newContext({viewport, acceptDownloads: true,
      ...(video ? {recordVideo:{dir:out,size:viewport}} : {})});
    const game = await context.newPage();
    observe(game);
    try {
      await game.goto(origin + '/?arena-continuous&rate=' + rate);
      const rendered = game.getByLabel('Rendered positions');
      await game.waitForFunction(() => !!document.querySelector('output')?.dataset.updates);
      await game.getByRole('button',{name:'Start sandbox'}).click();
      const positions = data => data.state.fighters[0].position;
      const initial = positions(await overlay(game));
      const latencies = [];
      const renderStart = Number(await rendered.getAttribute('data-updates'));
      const began = Date.now();
      for (let i = 0; i < 8; i++) {
        const code = i % 2 ? 'KeyA' : 'KeyD', dx = i % 2 ? -1 : 1;
        const from = positions(await overlay(game));
        await game.waitForTimeout((i * 13) % 43);
        await game.keyboard.down(code);
        const moving = await wait(game,d => (positions(d).x - from.x) * dx > 0,'No authoritative displacement');
        latencies.push(moving.firstPositionUpdateMs);
        await game.keyboard.up(code);
        await wait(game,d => !d.state.fighters[0].motion,'Release did not stop');
      }
      const sample = await overlay(game);
      const renderFps = (Number(await rendered.getAttribute('data-updates')) - renderStart) * 1000 / (Date.now() - began);
      if (video) {
        const from = positions(sample);
        await game.keyboard.down('KeyD');
        const moved = await wait(game,d => positions(d).x > from.x + 500,'Insufficient partial movement');
        await game.keyboard.up('KeyD');
        const stopped = await wait(game,d => !d.state.fighters[0].motion,'No off-grid stop');
        const offGrid = positions(stopped);
        check((offGrid.x - 2970) % 5940 !== 0, 'Stopped on a center');
        await game.waitForTimeout(280);
        check(JSON.stringify(positions(await overlay(game))) === JSON.stringify(offGrid), 'Drift after stop');
        await game.screenshot({path:out+'manual-off-center.png',fullPage:true});
        await game.keyboard.down('KeyW');
        await wait(game,d => positions(d).y < offGrid.y,'Redirect failed');
        await game.keyboard.up('KeyW');
        await wait(game,d => !d.state.fighters[0].motion,'Second stop failed');
        await game.keyboard.press('KeyC');
        await wait(game,d => d.state.fighters[0].posture === 'crouch','Crouch failed');
        await game.keyboard.down('KeyS');
        await wait(game,d => d.state.fighters[0].motion?.mode === 'crouch','Moving crouch failed');
        await game.keyboard.press('KeyE');
        const overlap = await wait(game,d => d.state.fighters[0].motion?.mode === 'crouch' && d.state.fighters[0].survey?.kind === 'observe','Overlap failed');
        await game.screenshot({path:out+'manual-overlap.png',fullPage:true});
        await game.keyboard.up('KeyS');
        await wait(game,d => !d.state.fighters[0].motion,'Third stop failed');
        await game.keyboard.down('ShiftLeft');
        await game.keyboard.down('KeyA');
        await game.getByText('Blue · terrain contact', {exact:true}).waitFor();
        const collision = await overlay(game);
        await game.keyboard.up('KeyA');
        await game.keyboard.up('ShiftLeft');
        await game.keyboard.down('KeyD');
        await wait(game,d => positions(d).x > positions(collision).x,'Reverse after wall failed');
        await game.keyboard.up('KeyD');
        await wait(game,d => !d.state.fighters[0].motion,'Pre-jump stop failed');
        await game.keyboard.press('Space');
        const jump = await wait(game,d => d.state.fighters[0].motion?.mode === 'jump','Jump failed');
        await wait(game,d => !d.state.fighters[0].motion,'Landing failed');
        const save = game.getByRole('button',{name:'Save replay'});
        await game.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Save replay')?.disabled,
          undefined,{timeout:25_000});
        const pending = game.waitForEvent('download');
        await save.click();
        await (await pending).saveAs(out+'manual.json');
        const final = (await overlay(game)).state;
        await context.close();
        await game.video().saveAs(out+'manual.webm');
        await game.video().delete();
        return {rate,latencies,renderFps,initial,partial:positions(moved),stopped:offGrid,
          overlapTick:overlap.state.tick,terrainPosition:positions(collision),jumpTick:jump.state.tick,final};
      }
      return {rate,latencies,renderFps,initial};
    } finally { await context.close(); }
  }
  metrics.push(await manual('baseline', false));
  metrics.push(await manual('30hz', true));
  metrics.push(await manual('60hz', false));
  const comparisons = [];
  for (const fps of [20,60]) {
    const viewport = fps === 20 ? {width:880,height:930} : {width:390,height:844};
    const context = await browser.newContext({viewport, ...(fps === 60 ? {recordVideo:{dir:out,size:viewport}} : {})});
    const game = await context.newPage(); observe(game);
    try {
      await game.goto(origin + '/?gameplay-v23&fps='+fps);
      await game.getByLabel('Load replay').setInputFiles(out+'autonomous.json');
      await game.getByRole('button',{name:'Play replay'}).click();
      await game.waitForTimeout(850);
      await game.getByRole('button',{name:'Pause'}).click();
      const paused = await overlay(game);
      await game.waitForTimeout(240);
      check((await overlay(game)).state.tick === paused.state.tick,'Pause lost position');
      const rendered = game.getByLabel('Rendered positions');
      const count = Number(await rendered.getAttribute('data-updates')), start = Date.now();
      await game.getByRole('button',{name:'Resume'}).click();
      await game.waitForTimeout(1000);
      const fpsMeasured = (Number(await rendered.getAttribute('data-updates')) - count)*1000/(Date.now()-start);
      check(fpsMeasured > 0,'No render updates measured');
      check(await game.evaluate(() => innerWidth === document.documentElement.scrollWidth),'Horizontal overflow');
      await game.getByText(/Blue · hit|Sand · hit/).last().waitFor();
      if (fps === 60) await game.screenshot({path:out+'autonomous-mobile.png',fullPage:true});
      const terminal = game.getByText('Blue wins',{exact:true});
      await terminal.waitFor({timeout:25_000});
      const final = (await overlay(game)).state;
      await game.reload();
      await game.getByRole('button',{name:'Skip to result'}).click();
      check(JSON.stringify((await overlay(game)).state) === JSON.stringify(final),'Refresh changed replay');
      comparisons.push({fps, fpsMeasured,final});
      await context.close();
      if (fps === 60) {await game.video().saveAs(out+'autonomous-mobile.webm');await game.video().delete();}
    } finally {await context.close();}
  }
  check(JSON.stringify(comparisons[0].final) === JSON.stringify(comparisons[1].final),'Render rate changed authoritative replay');
  check(errors.length === 0,errors.join('\n'));
  return {metrics,comparisons,errors};
}
