import {afterEach,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {createApi} from '../server/api.js';
import {sqliteStorage} from '../server/sqlite-storage.js';
import {runTrial} from '../server/gameplay-v26.js';
import type {Server} from 'node:http';

let server:Server|undefined;
let db:DatabaseSync|undefined;
afterEach(async()=>{
  if(server) await new Promise<void>(resolve=>server!.close(()=>resolve()));
  db?.close();
});
it('requires a protected token and persists technical interruptions without reflection or a completed result',async()=>{
  db=new DatabaseSync(':memory:');
  const storage=sqliteStorage(db,'.arena-data/v26-test-memory');
  let ran=0, reflected=0;
  const jobs:Promise<void>[]=[];
  const origin='https://arena.example';
  const trialToken='test-token-with-at-least-thirty-two-characters';
  const app=createApi(storage,{hosted:true,localV26:true,origin,key:'test-v1-api',model:'test-model',background:job=>jobs.push(job),
    reflection:async()=>{reflected++;return [];},
    v26Trial:{key:'test-v26-api',token:trialToken,runner:async(_key,_model,config,coaches,signal)=>{
      ran++;
      return runTrial(config,coaches,async(_prompt,_s,receipt)=>{
        receipt({model:'injected-model',input:9,output:0});
        throw Object.assign(Error('injected quota test'),{status:429});
      },
        'reserved',signal,'operator-attested-gemini');
    }}});
  server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server!.once('listening',resolve));
  const addr=server.address() as {port:number};
  const url='http://127.0.0.1:'+addr.port+'/api/';
  const guest=await fetch(url+'guest',{method:'POST',headers:{origin}});
  const cookie=guest.headers.get('set-cookie')!.split(';')[0];
  const body=JSON.stringify({requestId:randomUUID(),coaching:'A local fixture',rulesVersion:'arcade-v2.6',mode:'score-deathmatch'});
  const headers={cookie,origin,'content-type':'application/json'};
  expect((await fetch(url+'matches',{method:'POST',headers,body})).status).toBe(404);
  expect(ran).toBe(0);
  const reserved=await fetch(url+'matches',{method:'POST',headers:{...headers,'x-arena-trial':trialToken},body});
  expect(reserved.status).toBe(202);
  const {id}=await reserved.json();
  await Promise.all(jobs);
  const completed=await (await fetch(url+'matches/'+id,{headers})).json();
  expect(completed).toMatchObject({status:'interrupted',reflection:null,rulesVersion:'arcade-v2.6',
    replay:{version:6,interruption:{kind:'technical-interrupted'},final:{tick:0,result:null}}});
  expect(completed.attempts.map((a:{status:string})=>a.status)).toEqual(['429','429']);
  expect(completed.attempts[0]).toMatchObject({model:'injected-model',input:9,output:0,coachingRevision:expect.any(String)});
  expect(ran).toBe(1);
  expect(reflected).toBe(0);
});

it('offers continuous matches to local guests only when explicitly enabled',async()=>{
  db=new DatabaseSync(':memory:');
  const jobs:Promise<void>[]=[];
  const storage=sqliteStorage(db,'.arena-data/v26-test-memory');
  const reserve=storage.reserve.bind(storage);
  const configs:Parameters<typeof reserve>[0]['config'][]=[];
  const app=createApi({...storage,reserve(job){
    configs.push(job.config);
    if(configs.length===2)return {status:'busy',retryAfter:60};
    return reserve(job);
  }},{
    key:'local-v1',model:'test-model',localV26:true,background:job=>jobs.push(job),
    v26Trial:{key:'local-v26',token:'',runner:(_key,_model,config,coaches,signal)=>runTrial(config,coaches,async()=>({
      version:1,expiresInMs:20000,stages:[{forMs:10000,packet:{}},{forMs:10000,packet:{}}],
    }),'renewal-paced',signal,'operator-attested-gemini')},
  });
  server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server!.once('listening',resolve));
  const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
  expect(await (await fetch(url+'health')).json()).toMatchObject({continuousConfigured:true});
  const guest=await fetch(url+'guest',{method:'POST'});
  const cookie=guest.headers.get('set-cookie')!.split(';')[0];
  const headers={cookie,'content-type':'application/json'};
  const body=JSON.stringify({requestId:randomUUID(),coaching:'Hold and observe.',rulesVersion:'arcade-v2.6',mode:'objective-duel'});
  const response=await fetch(url+'matches',{method:'POST',headers,body});
  expect(response.status).toBe(202);
  const {id}=await response.json();
  await Promise.all(jobs);
  expect(await (await fetch(url+'matches/'+id,{headers})).json()).toMatchObject({
    status:'completed', replay:{version:6,final:{result:'sand'}},
    attempts:expect.arrayContaining([expect.objectContaining({side:0,status:'accepted',step:0,plan:expect.any(Object)})]),
  });
  expect((await fetch(url+'matches/'+id)).status).toBe(401);
  const matchRequest={requestId:randomUUID(),coaching:'Commit when ready.',rulesVersion:'arcade-v2.6',mode:'objective-duel',sameSetup:id};
  const rematch=(cookie:string,body:object)=>fetch(url+'matches',{method:'POST',headers:{...headers,cookie},body:JSON.stringify(body)});
  const outsider=(await fetch(url+'guest',{method:'POST'})).headers.get('set-cookie')!.split(';')[0];
  expect((await rematch(outsider,matchRequest)).status).toBe(404);
  expect((await rematch(cookie,{...matchRequest,activator:1})).status).toBe(404);
  expect((await rematch(cookie,matchRequest)).status).toBe(429);
  expect(configs[1]).toMatchObject({arena:(configs[0] as {arena:unknown}).arena,sameSetup:id,model:configs[0].model});
  expect(configs[1].coaches[0].text).toBe(matchRequest.coaching);
  expect(configs[1].coaches[1]).toEqual(configs[0].coaches[1]);
});
