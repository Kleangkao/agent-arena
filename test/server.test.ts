import {it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Server} from 'node:http';
import {createApp} from '../server/index';
import {validateReplay} from '../src/replay';
import fixture from '../src/fixtures/historical-gemini.json';
import {officials} from '../src/competition';
import {createApi} from '../server/api';
import {sqliteStorage} from '../server/sqlite-storage';

it('scopes server-owned replay to the owner, survives restart, and keeps result on reflection failure',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'arena-server-'));
 const path=join(dir,'arena.sqlite');
 let db=new DatabaseSync(path), origin='', server:Server;
 let calls=0;
 const run:typeof import('../server/match').runMatch=async(_key,_model,coaches)=>{
  calls++;
  expect(coaches[1].text).toBe(officials['official-sand-pace'].coaching);
  return validateReplay(fixture);
 };
 const failure=async()=>{throw Error('provider failed');};
 const start=async()=>{
  server=createApp(db,run,'test','test',failure,dir).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',()=>resolve()));
  origin='http://127.0.0.1:'+((server.address() as {port:number}).port);
 };
 const stop=async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();};
 try{
  await start();
  const guest=async()=> (await fetch(origin+'/api/guest',{method:'POST'})).headers.get('set-cookie')!.split(';')[0];
  const first=await guest(), other=await guest();
  const body={requestId:randomUUID(),coaching:'Stay engaged',opponent:'official-sand-pace'};
  const create=(data:object,cookie?:string)=>fetch(origin+'/api/matches',{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});
  expect((await create(body)).status).toBe(401);
  expect((await fetch(origin+'/api/memory')).status).toBe(401);
  expect(await (await fetch(origin+'/api/memory',{headers:{cookie:other}})).json()).toEqual({revision:0,lessons:[]});
  expect((await create({...body,result:'blue'},first)).status).toBe(400);
  expect((await create({...body,opponent:'unregistered'},first)).status).toBe(400);
  const created=await create(body,first);
  expect(created.status).toBe(202);
  const {id}=await created.json();
  expect((await (await create(body,first)).json()).id).toBe(id);
  expect((await create({...body,coaching:'different'},first)).status).toBe(409);
  expect((await create({...body,opponent:'official-sand'},first)).status).toBe(409);
  expect((await create({...body,requestId:randomUUID()},first)).status).toBe(429);
  expect((await fetch(origin+'/api/matches/'+id,{headers:{cookie:other}})).status).toBe(404);
  expect((await fetch(origin+'/api/decide',{method:'POST'})).status).toBe(404);
  await stop();
  db=new DatabaseSync(path);
  await start();
  const result=await (await fetch(origin+'/api/matches/'+id,{headers:{cookie:first}})).json();
  expect(result.status).toBe('completed');
  expect(result.replay.result).toBe('blue');
  expect(calls).toBe(1);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

it('requires the configured hosted origin for writes and persists coaching by guest',async()=>{
 const db=new DatabaseSync(':memory:');
 const storage=sqliteStorage(db,'.arena-data/memory');
 let limited=false;
 storage.guestRequest=async id=>await storage.guest(id)?limited?'limited':'allowed':'missing';
 const app=createApi(storage,{
  hosted:true,origin:'https://arena.example',key:'test',model:'test',background:()=>{},
 });
 const server=app.listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',()=>resolve()));
 const endpoint='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
 const origin='https://arena.example';
 try{
  expect((await fetch(endpoint+'guest',{method:'POST'})).status).toBe(403);
  expect((await fetch(endpoint+'guest',{method:'POST',headers:{origin:'https://foreign.example'}})).status).toBe(403);
  const guest=async()=>{
   const response=await fetch(endpoint+'guest',{method:'POST',headers:{origin}});
   const header=response.headers.get('set-cookie')!;
   expect(response.status).toBe(204);
   expect(header).toMatch(/HttpOnly; Secure; SameSite=Strict/i);
   return header.split(';')[0];
  };
  const cookie=await guest(),other=await guest();
  const coaching=await fetch(endpoint+'coaching',{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify({coaching:'Use the remaining turns'})});
  expect(coaching.status).toBe(204);
  expect(await (await fetch(endpoint+'coaching',{headers:{cookie}})).json()).toEqual({coaching:'Use the remaining turns'});
  expect(await (await fetch(endpoint+'coaching',{headers:{cookie:other}})).json()).toEqual({coaching:null});
  limited=true;
  const limitedResponse=await fetch(endpoint+'coaching',{headers:{cookie}});
  expect(limitedResponse.status).toBe(429);
  expect(limitedResponse.headers.get('retry-after')).toBe('60');
 }finally{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  db.close();
 }
});
