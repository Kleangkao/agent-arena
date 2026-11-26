import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {expect,it,vi} from 'vitest';
import {createApi} from '../server/api.js';
import {sqliteStorage} from '../server/sqlite-storage.js';

it('locks private strategy and coaching at reservation and sends the reviewed guidance to the SDK',async()=>{
 const inputs:{coaching:unknown}[]=[];
 let firstBlue=true;
 const originalFetch=globalThis.fetch;
 const replies=vi.spyOn(globalThis,'fetch').mockImplementation(async (resource,options)=>{
  const request=new Request(resource,options);
  const target=new URL(request.url);
  if(target.hostname==='127.0.0.1')return originalFetch(request);
  expect(target.hostname).toBe('generativelanguage.googleapis.com');
  expect(target.pathname).toContain('models/test-model:generateContent');
  const payload=await request.json();
  const input=JSON.parse(payload.contents[0].parts[0].text);
  inputs.push(input);
  const shouldReject=typeof input.coaching==='object'&&firstBlue;
  if(shouldReject)firstBlue=false;
  return Response.json({
   modelVersion:'test-exact-model',
   candidates:[{content:{parts:[{text:JSON.stringify({intent:'Hold for this test',orders:shouldReject?[]:['-','-','-','-','-']})}]}}],
  });
 });
 const db=new DatabaseSync(':memory:');
 const pending:Promise<void>[]=[];
 const server=createApi(sqliteStorage(db,'.arena-data/squad-guidance-test'),{
  localSquads:true,key:'test',model:'test-model',background:job=>pending.push(job),
 }).listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 try{
  const root='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
  const guest=async()=>(await fetch(root+'guest',{method:'POST'})).headers.get('set-cookie')!.split(';')[0];
  const owner=await guest(),other=await guest();
  const request={requestId:randomUUID(),rulesVersion:'squads-v3',mode:'bomb',
   coaching:'  Favor progress when safe.  ',strategy:'patient',autonomy:'coach-led'};
  const start=(input:object)=>fetch(root+'matches',{method:'POST',headers:{cookie:owner,'content-type':'application/json'},body:JSON.stringify(input)});
  const {autonomy:_,...partial}=request;
  expect((await start(partial)).status).toBe(400);
  expect((await start({...request,rulesVersion:'lane-v1',mode:undefined})).status).toBe(400);
  expect((await start({...request,coachingPrompt:'override'})).status).toBe(400);
  const response=await start(request);
  expect(response.status).toBe(202);
  const reservation=await response.json();
  expect(reservation.guidance).toMatchObject({coaching:'Favor progress when safe.',strategy:'patient',autonomy:'coach-led',requests:0});
  expect(reservation.guidance.received).toBeUndefined();
  await Promise.all(pending);

  const get=(cookie:string)=>fetch(root+'matches/'+reservation.id,{headers:{cookie}});
  expect((await get(other)).status).toBe(404);
  expect((await get('')).status).toBe(401);
  const result=await (await get(owner)).json();
  expect(result.status).toBe('completed');
  expect(result.replay.config).not.toHaveProperty('guidance');
  expect(JSON.stringify(result.replay)).not.toContain('Favor progress when safe.');
  const blue=inputs.filter(input=>typeof input.coaching==='object');
  const sand=inputs.filter(input=>typeof input.coaching==='string');
  expect(blue.length).toBeGreaterThan(0);
  expect(sand).toHaveLength(blue.length-1);
  expect(result.guidance).toMatchObject({
   revision:reservation.guidance.revision,requests:blue.length,
   received:{strategy:expect.stringContaining('preserving options'),autonomy:expect.stringContaining('strong weight'),
    coaching:'Favor progress when safe.'},
  });
  expect(blue.every(input=>JSON.stringify(input.coaching)===JSON.stringify(result.guidance.received))).toBe(true);
  expect(sand.every(input=>input.coaching!==request.coaching.trim())).toBe(true);
  expect(result.attempts.filter((attempt:{side:number})=>attempt.side===0)).toEqual([
   expect.objectContaining({coachingRevision:result.guidance.revision,model:'test-exact-model',status:'invalid-orders'}),
   ...Array.from({length:blue.length-1},()=>expect.objectContaining({coachingRevision:result.guidance.revision,model:'test-exact-model',status:'accepted'})),
  ]);
  expect((await start({...request,strategy:'balanced'})).status).toBe(409);
  expect((await start({...request,autonomy:'adaptive'})).status).toBe(409);
  expect((await start(request)).status).toBe(200);
  expect(pending).toHaveLength(1);

  db.prepare('UPDATE matches SET created=? WHERE id=?').run(Date.now()-61_000,reservation.id);
  const rematch=await start({...request,sameSetup:reservation.id,requestId:randomUUID(),autonomy:'adaptive'});
  expect(rematch.status).toBe(202);
  const second=await rematch.json();
  expect(second.arena).toEqual(result.arena);
  expect(second.guidance.revision).not.toBe(result.guidance.revision);
  expect(second.guidance).toMatchObject({coaching:result.guidance.coaching,strategy:'patient',autonomy:'adaptive'});
  await Promise.all(pending);
  const reviewed=await (await fetch(root+'matches/'+second.id,{headers:{cookie:owner}})).json();
  expect(reviewed.guidance.received).toMatchObject({strategy:result.guidance.received.strategy,
   autonomy:expect.stringContaining('starting preference'),coaching:result.guidance.received.coaching});
 }finally{
  replies.mockRestore();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  db.close();
 }
});
