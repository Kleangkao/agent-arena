async page => {
  const browser = page.context().browser();
  const url = 'http://127.0.0.1:4182/?gameplay-v2';
  const out = 'evidence/gameplay-v21/';
  const cases = [
    {name: 'ordinary', ticks: 44, hp: [28, 30], label: 'Sand wins', width: 1000},
    {name: 'draw', ticks: 40, hp: [0, 0], label: 'Draw', width: 390},
    {name: 'unusual', ticks: 13, hp: [0, 82], label: 'Sand wins', width: 1000},
  ];
  const evidence = [];
  for (const entry of cases) {
    const viewport = {width: entry.width, height: entry.width === 390 ? 844 : 920};
    const context = await browser.newContext({viewport, recordVideo: {dir: out, size: viewport}});
    const game = await context.newPage();
    const errors = [], requests = [];
    game.on('pageerror', error => errors.push(error.message));
    game.on('request', request => {
      if (/\/api\/|generativelanguage\.googleapis\.com/.test(request.url())) requests.push(request.url());
    });
    const video = game.video();
    const clock = game.locator('.graybox-status');
    const result = async () => {
      await clock.getByText(entry.label, {exact: true}).waitFor({timeout: 25_000});
      await clock.getByText('Tick ' + entry.ticks + ' / 44', {exact: true}).waitFor();
      const hp = await game.locator('meter').evaluateAll(elements => elements.map(meter => meter.value));
      if (JSON.stringify(hp) !== JSON.stringify(entry.hp)) throw Error('Replay disagreed with ' + entry.name);
    };
    try {
      await game.goto(url);
      await game.getByText('Replay tools', {exact: true}).click();
      await game.getByLabel('Load replay').setInputFiles(out + entry.name + '.json');
      await game.getByText('Replay tools', {exact: true}).click();
      await game.locator('canvas').waitFor();
      if (await game.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
      await game.getByRole('combobox', {name: 'Speed'}).selectOption('2');
      await game.getByRole('button', {name: 'Play replay', exact: true}).click();
      if (entry.name === 'ordinary') {
        await clock.getByText(/^Tick [1-9]\d* \/ 44$/).waitFor();
        await game.getByRole('button', {name: 'Pause', exact: true}).click();
        const frozen = await clock.textContent();
        await game.waitForTimeout(450);
        if (frozen !== await clock.textContent()) throw Error('Pause advanced the clock');
        await game.getByRole('button', {name: 'Resume', exact: true}).click();
      }
      await result();
      await game.screenshot({path: out + entry.name + '.png', fullPage: true});
      await game.reload();
      await result();
      if (errors.length || requests.length) throw Error(JSON.stringify({errors, requests}));
      evidence.push({name: entry.name, hp: entry.hp, ticks: entry.ticks, width: entry.width, apiCalls: 0});
    } finally {
      await context.close();
    }
    if (!video) throw Error('Browser recording unavailable');
    await video.saveAs(out + entry.name + '.webm');
    await video.delete();
  }
  return evidence;
}
