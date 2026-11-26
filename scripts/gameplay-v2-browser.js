async page => {
  const failures = [];
  const api = [];
  const origin = 'http://127.0.0.1:4182';
  const out = 'evidence/gameplay-v2/';
  page.on('pageerror', error => failures.push(error.message));
  page.on('request', request => {
    if (/\/api\/|generativelanguage\.googleapis\.com/.test(request.url())) api.push(request.url());
  });
  const button = name => page.getByRole('button', {name, exact: true});
  const status = page.locator('.graybox-status');
  const click = name => button(name).click();
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const loadShowcase = async () => {
    await page.getByText('Replay tools', {exact: true}).click();
    await page.getByLabel('Load replay').setInputFiles(out + 'showcase.json');
    await page.getByText('Replay tools', {exact: true}).click();
    await page.locator('canvas').waitFor({state: 'visible'});
    await status.getByText('Tick 0 / 36', {exact: true}).waitFor();
  };
  const currentTick = async () => Number((await status.locator('strong').first().textContent()).match(/Tick (\d+)/)[1]);
  const stepTo = async target => {
    for (let tick = await currentTick(); tick < target; tick++) {
      await click('Step');
      await status.getByText('Tick ' + (tick + 1) + ' / 36', {exact: true}).waitFor();
    }
  };
  const result = async () => {
    await status.getByText('Blue wins', {exact: true}).waitFor();
    const hp = await page.locator('meter').evaluateAll(elements => elements.map(meter => meter.value));
    assert(hp[0] === 10 && hp[1] === 0, 'HUD result diverged from seed 3 fixture');
    return hp;
  };

  await page.setViewportSize({width: 1000, height: 920});
  await page.goto(origin + '/?gameplay-v2');
  await loadShowcase();
  await page.screenshot({path: out + '01-graybox.png', fullPage: true});
  await page.getByText('Replay tools', {exact: true}).click();
  await page.getByLabel('Logical map').check();
  await page.locator('canvas').screenshot({path: out + '02-logical-map.png'});
  await page.getByLabel('Logical map').uncheck();
  await page.getByText('Replay tools', {exact: true}).click();
  await click('Play replay');
  await status.getByText(/^Tick [1-9]\d* \/ 36$/).waitFor();
  await click('Pause');
  const frozen = await status.textContent();
  await page.waitForTimeout(560);
  assert(await status.textContent() === frozen, 'Pause advanced the clock');
  await stepTo(18);
  await page.screenshot({path: out + '03-desktop-gameplay.png', fullPage: true});
  await click('Step');
  await status.getByText('Tick 19 / 36', {exact: true}).waitFor();
  await click('Resume');
  const desktop = await result();
  await page.screenshot({path: out + '05-result.png', fullPage: true});

  await page.setViewportSize({width: 390, height: 844});
  await page.reload();
  assert(JSON.stringify(await result()) === JSON.stringify(desktop), 'Refresh did not recover terminal instant');
  await loadShowcase();
  await stepTo(16);
  assert(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Mobile horizontal overflow');
  for (const name of ['Resume', 'Step', 'Skip to result']) {
    const rect = await button(name).boundingBox();
    assert(rect.height >= 44, name + ' missed minimum touch size');
  }
  await page.screenshot({path: out + '04-mobile-gameplay.png', fullPage: true});
  await click('Skip to result');
  assert(JSON.stringify(await result()) === JSON.stringify(desktop), 'Mobile reload/skip changed result');
  assert(failures.length === 0, failures.join('\n'));
  assert(api.length === 0, 'V2 playback called an API');
  return {desktop, mobile: desktop, apiCalls: api.length, browserErrors: failures, mobileWidth: 390};
}
