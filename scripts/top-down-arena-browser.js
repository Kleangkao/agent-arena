async page=>{
 const output='evidence/top-down-arena/';
 const errors=[],posts=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/'))posts.push(request.url());});
 await page.setViewportSize({width:1180,height:980});
 await page.goto('http://127.0.0.1:4182');
 await page.getByRole('img',{name:/Relay Yard grid/}).waitFor();
 await page.getByRole('button',{name:'Arena',exact:true}).click();
 await page.getByRole('button',{name:'Watch Objective Duel'}).click();
 const duel=page.getByRole('region',{name:'Objective Duel'});
 await duel.locator('[data-route="Blue"]').waitFor();
 await page.screenshot({path:output+'route-desktop.png',fullPage:true});
 await duel.getByRole('button',{name:'Pause',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:output+'route-mobile.png',fullPage:true});
 const scrub=duel.getByRole('slider',{name:'Replay position'});
 await scrub.fill('60');
 await duel.getByText('Channeling Core',{exact:false}).waitFor();
 await page.screenshot({path:output+'core-mobile.png',fullPage:true});
 await duel.getByRole('button',{name:'Resume'}).click();
 await duel.getByRole('heading',{name:'Sand wins'}).waitFor();
 await duel.getByRole('button',{name:/Blue starts Core/}).click();
 await duel.getByText('Channeling Core',{exact:false}).waitFor();
 if(await duel.getByRole('heading',{name:'Sand wins'}).isVisible())throw Error('Checkpoint did not seek back.');
 if(posts.length||errors.length||await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))
  throw Error('Recorded replay posted to API, threw an error, or overflowed mobile.');
 return {posts,errors,result:'Sand wins',route:true,core:true,checkpoint:true};
}
