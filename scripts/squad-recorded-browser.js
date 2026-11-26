async page=>{
 const errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/matches'))posts.push(r.url());});
 await page.setViewportSize({width:1180,height:920});
 await page.goto(new URL('/',page.url()).href);
 await page.getByRole('button',{name:'Arena',exact:true}).click();
 await page.getByRole('button',{name:'Watch Gemini 5v5'}).click();
 const battle=page.getByRole('region',{name:'Relay match'});
 await battle.getByText('Recorded Gemini · 5v5').waitFor();
 await battle.getByRole('heading',{name:'Sand Team wins'}).waitFor({timeout:25000});
 if(await battle.locator('.relay-scoreboard strong').allTextContents().then(s=>s.join('–'))!=='21–24')
  throw Error('Recorded result differs from transcript');
 await page.screenshot({path:'evidence/squads/recorded-result.png',fullPage:true});
 if(posts.length||errors.length)throw Error('Recorded replay submitted a match or raised an exception');
 return {posts,errors,result:'Sand Team wins',score:[21,24]};
}
