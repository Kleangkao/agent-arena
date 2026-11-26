import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const root='https://agent-arena-preview.vercel.app';
const output='evidence/native-bnb';
const owner='0x0f7340C0B93377f4c59d0ACCcc076991bb872E30';
const source=process.env.ARENA_QA_PLAYWRIGHT;
if(!source)throw Error('Set ARENA_QA_PLAYWRIGHT to the installed Playwright package.json.');
const {chromium}=createRequire(import.meta.url)(source.replace(/package\.json$/,''));
const browser=await chromium.launch();
mkdirSync(output,{recursive:true});
const proof=[];
try{
 for(const width of [1180,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();
  const errors=[],starts=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/matches')starts.push(request.url());});
  await page.addInitScript(owner=>{
   let onChainChanged;
   window.ethereum={
    request:({method})=>Promise.resolve(method==='eth_chainId'?'0x61':method==='eth_requestAccounts'?[owner]:[]),
    on:(event,listener)=>{if(event==='chainChanged')onChainChanged=listener;},
    removeListener:()=>{},
   };
   window.changeTestWalletChain=()=>onChainChanged?.('0x38');
  },owner);
  await page.goto(root);
  const profile=await (await context.request.get(root+'/agent-arena-commander.json')).json();
  assert.deepEqual(profile.registrations,[{agentId:2933,agentRegistry:'eip155:97:0x8004A818BFB912233c491871b3d84c89A494BD9e'}]);
  await page.getByRole('button',{name:'My Agent',exact:true}).click();
  await page.getByText('Agent Passport',{exact:true}).click();
  await page.getByRole('button',{name:'Find Arena Commander'}).click();
  await page.getByText('ERC-8004 agent #2933',{exact:true}).waitFor({timeout:22000});
  assert.equal(await page.getByRole('link',{name:owner,exact:true}).count(),1);
  await page.getByRole('button',{name:'Check connected wallet'}).click();
  await page.getByText('Connected wallet matches the registered owner.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${output}/passport-${width}.png`,fullPage:true});
  await page.evaluate(()=>window.changeTestWalletChain());
  await page.getByText('Wallet changed. Check ownership again.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Watch historical Bomb match'}).click();
  const skip=page.getByRole('button',{name:'Skip to result'});
  if(await skip.isVisible())await skip.click();
  await page.getByText('BNB Chain replay record',{exact:true}).click();
  await page.getByRole('button',{name:'Check Testnet record'}).click();
  await page.getByText('Replay hash recorded on BSC Testnet.',{exact:true}).waitFor({timeout:25000});
  const receipt=await page.getByRole('link',{name:'View Testnet transaction'}).getAttribute('href');
  assert.ok(receipt.endsWith('0xccd05b0c93c3c7931b9c77575894dc78c7bd9850b6a0e35f760ab2c6e61cacb6'));
  await page.screenshot({path:`${output}/historical-bomb-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'My Agent',exact:true}).click();
  await page.getByText('Agent Passport',{exact:true}).click();
  await page.getByLabel('Agent ID',{exact:true}).fill('100');
  await page.getByRole('button',{name:'Look up agent',exact:true}).click();
  await page.getByText('ERC-8004 agent #100',{exact:true}).waitFor({timeout:22000});
  assert.equal(await page.getByRole('button',{name:'Watch historical Bomb match'}).count(),0);
  assert.deepEqual(starts,[]);
  assert.deepEqual(errors,[]);
  proof.push({width,publishedIdentity:2933,externalIdentity:100,owner,receipt,walletProvider:'injected browser test wallet',rpc:'live BSC Testnet',generationRequests:starts.length});
  await context.close();
 }
}finally{
 await browser.close();
 writeFileSync(`${output}/passport-browser.json`,JSON.stringify({origin:root,proof},null,2)+'\n');
}
console.log(JSON.stringify(proof));
