import {expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApi} from '../server/api.js';
import {sqliteStorage} from '../server/sqlite-storage.js';
import {continuousConfig,scriptedSquads} from '../src/squads/game.js';
import type {NewJob} from '../server/storage.js';

it.each(['squads-v2','squads-v3'] as const)('gates %s, locks config and isolates idempotency and rematch setup by guest',async rulesVersion=>{
 const db=new DatabaseSync(':memory:');
 const storage=sqliteStorage(db,'.arena-data/squad-test-memory');
 const reserve=storage.reserve.bind(storage);
 const configs:Parameters<typeof reserve>[0]['config'][]=[];
 const jobs:Promise<void>[]=[];
 const app=createApi({...storage,reserve(job){
  configs.push(job.config);
  return configs.length>1?{status:'busy',retryAfter:60}:reserve(job);
 }},{localSquads:true,key:'test-key',model:'test-model',background:job=>jobs.push(job),
  squadRunner:async(_key,_model,config)=>({...scriptedSquads(config).replay,source:'operator-attested-gemini'})});
 const server=app.listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 try{
  const root='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
  const createGuest=async()=>(await fetch(root+'guest',{method:'POST'})).headers.get('set-cookie')!.split(';')[0];
  expect(await (await fetch(root+'health')).json()).toMatchObject({squadsConfigured:true});
  const cookie=await createGuest();
  const other=await createGuest();
  const body={requestId:randomUUID(),rulesVersion,coaching:'Favor North.',...(rulesVersion==='squads-v3'?{mode:'bomb'}:{})};
  const start=(payload:object,owner=cookie)=>fetch(root+'matches',{method:'POST',headers:{cookie:owner,'content-type':'application/json'},body:JSON.stringify(payload)});
  expect((await start(body,'')).status).toBe(401);
  expect((await start({...body,teamSize:20})).status).toBe(400);
  expect((await start({...body,winner:'blue'})).status).toBe(400);
  if(rulesVersion==='squads-v3')expect((await start({...body,mode:'objective-duel'})).status).toBe(400);
  const response=await start(body);
  expect(response.status).toBe(202);
  const {id}=await response.json();
  await Promise.all(jobs);
  const get=(owner:string)=>fetch(root+'matches/'+id,{headers:{cookie:owner}});
  expect((await get(other)).status).toBe(404);
  expect(await (await get(cookie)).json()).toMatchObject({status:'completed',replay:{version:7},arena:{teamSize:5}});
  expect(await (await start(body)).json()).toMatchObject({id,status:'completed'});
  expect((await start({...body,coaching:'Changed'})).status).toBe(409);
  if(rulesVersion==='squads-v3')expect((await start({...body,mode:'tdm'})).status).toBe(409);
  const rematch={...body,requestId:randomUUID(),sameSetup:id,coaching:'Favor South.'};
  expect((await start(rematch,other)).status).toBe(404);
  if(rulesVersion==='squads-v3')expect((await start({...rematch,mode:'relay'})).status).toBe(404);
  expect((await start(rematch)).status).toBe(429);
  const [first,second]=configs;
  expect(first.rulesVersion).toBe(rulesVersion);
  expect(second).toMatchObject({arena:{teamSize:5,mapVersion:'relay-yard-v1'},model:first.model,sameSetup:id});
  expect(second.coaches[1]).toEqual(first.coaches[1]);
  expect(second.coaches[0].text).toBe('Favor South.');
  expect(jobs).toHaveLength(1);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});


it('admits another sequential reservation after existing matches from the same day',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const storage=sqliteStorage(db,'.arena-data/squad-test-memory');
  const id=randomUUID(),owner='test-owner';
  db.prepare('INSERT INTO guests VALUES(?,?)').run(owner,Date.now()+3600000);
  for(let i=0;i<20;i++)db.prepare('INSERT INTO matches VALUES(?,?,?,?,?,?,?)')
   .run(randomUUID(),owner,randomUUID(),'interrupted',null,'{}',Date.now()-120000);
  expect(storage.reserve({id,owner,requestId:randomUUID(),config:{} as Parameters<typeof storage.reserve>[0]['config']}))
   .toMatchObject({status:'new'});
 }finally{db.close();}
});

it.each([false,true])('scopes a developer reservation to opted-in local squads (hosted %s)',async hosted=>{
 const db=new DatabaseSync(':memory:');
 const storage=sqliteStorage(db,'.arena-data/squad-test-memory');
 const token='a'.repeat(64);
 const origin='https://arena.example';
 const jobs:Promise<void>[]=[];
 const app=createApi(storage,{hosted,origin,localSquads:true,hostedSquads:true,key:'test-key',model:'test-model',
  developerSquadToken:token,background:job=>jobs.push(job),
  squadRunner:async(_key,_model,config)=>({...scriptedSquads(config).replay,source:'operator-attested-gemini'})});
 const server=app.listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 try {
  const root='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
  const guest=await fetch(root+'guest',{method:'POST',headers:{origin}});
  expect(guest.status).toBe(204);
  const cookie=guest.headers.get('set-cookie')!.split(';')[0];
  const owner=db.prepare('SELECT id FROM guests').get()!.id!;
  for(let i=0;i<20;i++)db.prepare('INSERT INTO matches VALUES(?,?,?,?,?,?,?)')
   .run(randomUUID(),owner,randomUUID(),'interrupted',null,'{}',Date.now()-120000);
  const body={requestId:randomUUID(),rulesVersion:'squads-v3',mode:'tdm',coaching:''};
  const start=(payload:object,access?:string,guestCookie=cookie)=>fetch(root+'matches',{method:'POST',
   headers:{origin,cookie:guestCookie,'content-type':'application/json',...(access===undefined?{}:{'x-arena-squad-test':access})},
   body:JSON.stringify(payload)});
  expect((await start(body,'wrong')).status).toBe(404);
  expect((await start(body,token,'')).status).toBe(401);
  expect((await start({requestId:randomUUID(),rulesVersion:'lane-v1',coaching:''},token)).status).toBe(404);
  const accepted=await start(body,token);
  if(hosted){
   expect(accepted.status).toBe(404);
   expect(jobs).toHaveLength(0);
   return;
  }
  expect(accepted.status).toBe(202);
  const {id}=await accepted.json();
  await Promise.all(jobs);
  expect(await (await start(body,token)).json()).toMatchObject({status:'completed',id});
  const replacement={...body,requestId:randomUUID()};
  const denied=await start(replacement,token);
  expect(denied.status).toBe(429);
  expect(await denied.json()).toEqual({error:'Arena is busy. Try again shortly.'});
  expect(Number(denied.headers.get('retry-after'))).toBeGreaterThan(0);
  expect((await start(replacement)).status).toBe(429);
  db.prepare('UPDATE matches SET created=? WHERE id=?').run(Date.now()-61_000,id);
  expect((await start(replacement)).status).toBe(202);
  await Promise.all(jobs);
  const second=await (await start(replacement)).json();
  db.prepare('UPDATE matches SET created=? WHERE id=?').run(Date.now()-61_000,second.id);
  const third=await start({...body,requestId:randomUUID(),sameSetup:second.id},token);
  expect(third.status).toBe(202);
  const {id:thirdId}=await third.json();
  await Promise.all(jobs);
  expect(await (await fetch(root+'matches/'+thirdId,{headers:{cookie}})).json()).toMatchObject({status:'completed'});
  expect(jobs).toHaveLength(3);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});

it('shares live capacity across owners and storage restarts and recovers stale jobs',()=>{
 const memoryDir=mkdtempSync(join(tmpdir(),'arena-capacity-'));
 const file=join(memoryDir,'arena.sqlite');
 const db=new DatabaseSync(file);
 const otherDb=new DatabaseSync(file);
 try {
  const arena=continuousConfig('relay');
  const coach={text:'',revision:'test',memory:{revision:0,lessons:[]}};
  const job=(owner='owner'):NewJob=>({
   id:randomUUID(),owner,requestId:randomUUID(),
   config:{participants:['owner','official-sand'],coaches:[coach,coach],model:'test-model',decisionBudget:20,
    rulesVersion:arena.rulesVersion,mapVersion:arena.mapVersion,arena},
  });
  const first=job();
  let storage=sqliteStorage(db,memoryDir,2);
  expect(storage.reserve(first)).toMatchObject({status:'new'});
  expect(storage.reserve(job('other'))).toEqual({status:'busy',retryAfter:5});
  const otherProcess=sqliteStorage(otherDb,memoryDir,2);
  expect(otherProcess.find(first.owner,first.id)).toMatchObject({status:'preparing'});
  expect(otherProcess.reserve(job('other'))).toEqual({status:'busy',retryAfter:5});
  storage.finish(first.id,null,[],0);
  storage=sqliteStorage(db,memoryDir,2);
  expect(storage.reserve(job())).toMatchObject({status:'busy',retryAfter:2});
  db.prepare('UPDATE matches SET created=? WHERE id=?').run(Date.now()-3_000,first.id);
  const second=job('other');
  expect(storage.reserve(second)).toMatchObject({status:'new'});
  db.prepare('UPDATE matches SET created=? WHERE id=?').run(Date.now()-91_000,second.id);
  expect(otherProcess.find(second.owner,second.id)).toMatchObject({status:'interrupted'});
  expect(storage.reserve(job())).toMatchObject({status:'new'});
 }finally{
  db.close();
  otherDb.close();
  rmSync(file);
  rmdirSync(memoryDir);
 }
});
