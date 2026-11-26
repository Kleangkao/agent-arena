import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';

const origin='https://agent-arena-preview.vercel.app';
const folder='evidence/identity-competition';
mkdirSync(folder,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.ARENA_QA_PLAYWRIGHT?.replace(/package\.json$/,'')??'playwright');
const browser=await chromium.launch();
const runs=[];
try{
 for(const width of [1180,390]){
  const page=await browser.newPage({viewport:{width,height:920}});
  const errors=[],writes=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/'))writes.push(request.url());});
  const nav=name=>page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name,exact:true}).click();
  const button=name=>page.getByRole('button',{name,exact:true});
  const shot=async name=>{
   const path=`${folder}/${name}-${width}.png`;
   await page.screenshot({path,fullPage:true});
   return path;
  };
  await page.goto(origin);
  await nav('My Agent');
  await page.getByText('Agent Passport',{exact:true}).click();
  await button('Find Arena Commander').click();
  await page.getByText('ERC-8004 agent #2933',{exact:true}).waitFor({timeout:25000});
  const passport=await shot('public-passport');
  await button('Watch the Commander’s competitive record').click();
  await page.getByRole('slider',{name:'Replay position'}).waitFor({timeout:25000});
  await page.waitForFunction(()=>Number(document.querySelector('input[type=range]')?.value)>=5);
  const battle=await shot('public-battle');
  if(await button('Skip to result').isVisible())await button('Skip to result').click();
  await page.getByRole('heading',{name:'Blue Team wins',exact:true}).waitFor();
  await page.getByText('Agent participation · ERC-8004 #2933',{exact:true}).click();
  await button('Check participation and replay').click();
  await page.getByText('Owner signature, historical BSC Testnet ownership, and replay confirmed.').waitFor({timeout:25000});
  await page.getByText('BNB Chain replay record',{exact:true}).click();
  await button('Check Testnet record').click();
  const chainStatus=process.argv.includes('--expect-chain')?'Identity and replay commitment recorded on BSC Testnet.':'No on-chain record for this match.';
  await page.getByText(chainStatus,{exact:true}).waitFor({timeout:25000});
  const transaction=await page.getByRole('link',{name:'View Testnet transaction'}).getAttribute('href').catch(()=>null);
  const result=await shot('public-result');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.reload();
  await nav('Arena');
  await button('WATCH ERC-8004 COMMANDER #2933 →').click();
  await page.getByRole('slider',{name:'Replay position'}).waitFor({timeout:25000});
  assert.deepEqual(writes,[]);
  assert.deepEqual(errors,[]);
  runs.push({width,passport,battle,result,chainStatus,transaction,zeroApiPosts:true,reopenedAfterRefresh:true,noHorizontalOverflow:true,pageErrors:errors});
  await page.close();
 }
 writeFileSync(folder+'/public-browser.json',JSON.stringify({origin,runs},null,2)+'\n');
}finally{await browser.close();}
