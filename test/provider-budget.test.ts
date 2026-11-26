import {expect,it,vi} from 'vitest';
import {runMatch,type Attempt,type Coach} from '../server/match';
import {reflect} from '../server/reflect';
import {validateReplay} from '../src/replay';
import fixture from '../src/fixtures/historical-gemini.json';

it('stops at the first 429 per agent and gives reflection exactly one HTTP attempt',async()=>{
 const request=vi.fn(async()=>new Response(JSON.stringify({
  error:{code:429,status:'RESOURCE_EXHAUSTED',message:'Rate limited'},
 }),{status:429,headers:{'Content-Type':'application/json','Retry-After':'60'}}));
 vi.stubGlobal('fetch',request);
 try{
  const coach:Coach={text:'',revision:'test',memory:{revision:0,lessons:[]}};
  const attempts:Attempt[]=[];
  await expect(runMatch('test-key','test-model',[coach,coach],AbortSignal.timeout(2500),attempts)).rejects.toThrow('interrupted');
  expect(request).toHaveBeenCalledTimes(2);
  expect(attempts.map(({status})=>status)).toEqual(['429','429']);
  await expect(reflect('test-key','test-model',validateReplay(fixture),[])).rejects.toMatchObject({status:429});
  expect(request).toHaveBeenCalledTimes(3);
 }finally{vi.unstubAllGlobals();}
});
