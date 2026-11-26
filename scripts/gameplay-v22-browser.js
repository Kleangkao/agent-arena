async page => {
  const browser = page.context().browser();
  const origin = 'http://127.0.0.1:4182';
  const out = 'evidence/gameplay-v22/';
  const logs = [];
  const errors = [];
  const noApi = game => {
    game.on('pageerror', error => errors.push(error.message));
    game.on('request', request => {
      if (/\/api\/|generativelanguage\.googleapis\.com/.test(request.url())) errors.push('Unexpected API request');
    });
  };
  const assert = (value, message) => { if (!value) throw Error(message); };
  async function capture(name, viewport, run) {
    const context = await browser.newContext({viewport, recordVideo: {dir: out, size: viewport}, acceptDownloads: true});
    const game = await context.newPage();
    noApi(game);
    const video = game.video();
    try { logs.push(await run(game)); }
    finally { await context.close(); }
    await video.saveAs(out + name + '.webm');
    await video.delete();
  }
  await capture('manual', {width: 1000, height: 940}, async game => {
    await game.goto(origin + '/?arena-sandbox');
    await game.getByLabel('State overlay').check();
    await game.getByRole('button', {name: 'Start sandbox', exact: true}).click();
    const overlay = () => game.locator('pre').textContent().then(JSON.parse);
    const next = async (predicate, message) => {
      for (let counter = 0; counter < 180; counter++) {
        const data = await overlay();
        if (predicate(data)) return data;
        await game.waitForTimeout(28);
      }
      throw Error(message);
    };
    await game.keyboard.down('KeyD');
    const eligible = await next(data => data.blueActions.includes('attack'), 'No legal manual shot');
    await game.keyboard.press('KeyF');
    const overlap = await next(data => data.state.fighters[0].motion && data.state.fighters[0].firing, 'No manual move/attack overlap');
    const shotActivity = await game.getByTestId('Blue activity').textContent();
    await game.screenshot({path: out + 'manual-overlap.png', fullPage: true});
    await game.keyboard.down('KeyA');
    const redirected = await next(data => data.events.some(event => event.kind === 'interrupt' && event.side === 0 && event.reason === 'redirect'), 'Manual redirect absent');
    await game.keyboard.up('KeyD');
    await next(data => data.blueActions.includes('reload'), 'No legal manual reload');
    await game.keyboard.press('KeyR');
    const reload = await next(data => data.state.fighters[0].motion && data.state.fighters[0].reloadDue, 'No reload/move overlap');
    await game.keyboard.up('KeyA');
    const stop = await next(data => data.events.some(event => event.kind === 'interrupt' && event.side === 0 && event.reason === 'stop'), 'Manual stop absent');
    assert(stop.state.fighters[0].reloadDue === reload.state.fighters[0].reloadDue, 'Stop cancelled reload');
    await next(data => !data.state.fighters[0].reloadDue, 'Reload did not complete');
    await game.keyboard.press('Space');
    const jump = await next(data => data.state.fighters[0].motion?.mode === 'jump', 'Manual jump did not start');
    const landing = await next(data => !data.state.fighters[0].motion, 'Manual jump did not land');
    const save = game.getByRole('button', {name: 'Save replay'});
    await save.waitFor();
    await game.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Save replay')?.disabled,
      undefined, {timeout: 25_000});
    const downloading = game.waitForEvent('download');
    await save.click();
    await (await downloading).saveAs(out + 'manual.json');
    return {kind: 'manual', eligibilityTick: eligible.state.tick, shotTick: overlap.state.tick, activity: shotActivity,
      shotAcceptanceMs: overlap.lastAcceptedActionMs, reloadAcceptanceMs: reload.lastAcceptedActionMs,
      redirectTick: redirected.state.tick, stopTick: stop.state.tick, jumpTick: jump.state.tick, landingTick: landing.state.tick};
  });
  await capture('autonomous-mobile', {width: 390, height: 844}, async game => {
    await game.goto(origin + '/?gameplay-v22');
    await game.getByText('Replay tools', {exact: true}).click();
    await game.getByLabel('Load replay').setInputFiles(out + 'autonomous.json');
    await game.getByText('Replay tools', {exact: true}).click();
    await game.locator('canvas').waitFor();
    await game.getByRole('combobox', {name: 'Speed'}).selectOption('2');
    await game.getByRole('button', {name: 'Play replay', exact: true}).click();
    const status = game.locator('.graybox-status');
    await status.getByText('Blue wins', {exact: true}).waitFor();
    const scores = await game.locator('meter').evaluateAll(elements => elements.map(meter => meter.value));
    assert(scores.join(',') === '48,46', 'Unexpected fixture result');
    assert(await game.evaluate(() => innerWidth === document.documentElement.scrollWidth), '390px overflow');
    await game.screenshot({path: out + 'autonomous-mobile.png', fullPage: true});
    await game.reload();
    await status.getByText('Blue wins', {exact: true}).waitFor();
    assert(await game.locator('meter').evaluateAll(elements => elements.map(meter => meter.value)).then(values => values.join(',') === '48,46'), 'Refresh changed the score');
    return {kind: 'autonomous-mobile', scores, width: 390, refreshed: true};
  });
  assert(errors.length === 0, errors.join('\n'));
  return logs;
}
