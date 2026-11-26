import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {expect,it} from 'vitest';
import {createApi} from '../server/api.js';
import {limits,playModeTrial,prompt,type Coach} from '../server/gameplay-v25.js';
import type {Attempt} from '../server/match.js';
import {sqliteStorage} from '../server/sqlite-storage.js';
import {configure,initial,revision} from '../src/v25/game.js';
import {load,record} from '../src/v25/replay.js';

const coaches:[Coach,Coach] = [
  {revision:'calm-1',text:'Watch the remaining time.',memory:{rulesVersion:revision,revision:3,lessons:['Watch the score.']}},
  {revision:'quick-1',text:'Seek contact.',memory:{rulesVersion:'lane-v1',revision:9,lessons:['Ignore this old version.']}},
];
const open = () => new AbortController().signal;
const score = configure(8,{mode:'score-deathmatch'},['sample-blue','private-sand']);
const objective = configure(8,{mode:'objective-duel',activator:1},['sample-blue','private-sand']);

it('builds bounded, side-specific context with role, score, coaching, and compatible memory',()=>{
  const blue = prompt(score,initial(score),0,coaches[0]);
  expect(blue).toMatchObject({participant:'sample-blue',coaching:{revision:'calm-1'},memory:{revision:3},
    match:{mode:'score-deathmatch',score:0,opponentScore:0,target:5,remaining:225000}});
  const red = prompt(objective,initial(objective),1,coaches[1]);
  expect(red).toMatchObject({coaching:{revision:'quick-1'},memory:null,match:{mode:'objective-duel',role:'Activator',phase:'pending'}});
  expect(Object.keys(blue.world)).toEqual(['contact']);
  expect(JSON.stringify(blue)).not.toMatch(/private-sand|seed|fighters/);
  expect(blue.choices.length).toBeLessThan(150);
  expect(blue.choices.some(c=>c.available&&c.input.kind==='move')).toBe(true);
});
it('requests both independent prompts from the same state and records executed and expired intents',async()=>{
  const attempts:Attempt[] = [];
  let active = 0, peak = 0;
  const replay = await playModeTrial(objective,coaches,async view=>{
    peak=Math.max(peak,++active);
    await Promise.resolve();
    active--;
    const observe = view.choices.find(c=>c.input.kind==='observe')!;
    const invalidHere = view.choices.find(c=>c.input.kind==='interact')!;
    return {text:JSON.stringify({picks:[{choice:observe.index,repeat:1},{choice:invalidHere.index,repeat:1}]}),model:'test-double'};
  },open(),attempts);
  expect(peak).toBe(2);
  expect(attempts.slice(0,2).map(a=>a.step)).toEqual([0,0]);
  expect(attempts.every(a=>a.status==='ok'&&a.unexecuted===1)).toBe(true);
  expect(replay.transcript[0][1]).toEqual([{kind:'observe'},{kind:'observe'}]);
  expect(load(replay).recording.final).toMatchObject({reason:'activation-prevented',result:'blue'});
});
it('keeps the full score clock inside the request cap and interrupts without a substitute on 429',async()=>{
  const attempts:Attempt[] = [];
  const played = await playModeTrial(score,coaches,async ()=>({text:'{"picks":[]}'}),open(),attempts);
  expect(played.final).toMatchObject({result:'draw',score:[0,0]});
  expect(attempts).toHaveLength(18);
  expect(attempts.filter(a=>a.side===0)).toHaveLength(9);
  expect(attempts.length).toBeLessThanOrEqual(limits.total);
  const blocked:Attempt[] = [];
  await expect(playModeTrial(objective,coaches,async()=>{throw Object.assign(Error('quota'),{status:429});},open(),blocked)).rejects.toThrow('429');
  expect(blocked.every(a=>a.status==='429'&&a.attempt===1)).toBe(true);
});
it('rejects malformed choices and non-game data after two attempts',async()=>{
  const attempts:Attempt[] = [];
  await expect(playModeTrial(score,coaches,async()=>({text:'{"picks":[{"choice":999,"repeat":8,"secret":"bad"}]}'}),open(),attempts))
    .rejects.toThrow('invalid');
  expect(attempts.filter(attempt=>attempt.status==='invalid').length).toBeGreaterThanOrEqual(3);
  expect(attempts.every(attempt=>['invalid','cancelled'].includes(attempt.status))).toBe(true);
  expect(attempts.every(attempt=>!attempt.intents&&attempt.attempt<=2)).toBe(true);
});
it('requires authorization and shared reservation before a V2.5 runner can start',async()=>{
  const db = new DatabaseSync(':memory:');
  const storage = sqliteStorage(db,'.arena-data/memory');
  const reservation = storage.reserve;
  let blocked = true,calls=0;
  storage.reserve = config=>blocked ? {status:'busy',retryAfter:60} : reservation(config);
  const origin='https://arena.example',token='validation-token-from-test-with-32-characters';
  const background:Promise<void>[] = [];
  const app=createApi(storage,{hosted:true,origin,key:'v1-test',model:'test-model',background:work=>background.push(work),
    v25Trial:{key:'trial-test',token,runner:async (key,_model,config,coaches,_signal,attempts)=>{
      calls++;
      expect(key).toBe('trial-test');
      expect(coaches[0]).toMatchObject({text:'Review the Core timer.'});
      expect(coaches[0].memory).toBeUndefined();
      expect(config).toMatchObject({mode:'objective-duel',activator:1});
      expect(db.prepare('SELECT status FROM matches').get()?.status).toBe('preparing');
      attempts.push({side:0,step:0,status:'ok',attempt:1,ms:1});
      return record(config,()=>[null,null],'gemini').recording;
    }}});
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
  const guest=async()=>(await fetch(url+'guest',{method:'POST',headers:{origin}})).headers.get('set-cookie')!.split(';')[0];
  const body={requestId:randomUUID(),coaching:'Review the Core timer.',rulesVersion:revision,mode:'objective-duel',activator:1};
  const post=(cookie:string,secret=token,data:object=body)=>fetch(url+'matches',{method:'POST',body:JSON.stringify(data),
    headers:{origin,cookie,'x-arena-trial':secret,'content-type':'application/json'}});
  try{
    const owner=await guest(),stranger=await guest();
    expect((await post('')).status).toBe(401);
    expect((await post(owner,'bad-token')).status).toBe(404);
    expect((await post(owner,token,{...body,seed:1})).status).toBe(400);
    expect((await post(owner)).status).toBe(429);
    expect(calls).toBe(0);
    blocked=false;
    const start=await post(owner);
    expect(start.status).toBe(202);
    const {id}=await start.json();
    await Promise.all(background);
    expect((await post(owner,token,{...body,activator:0})).status).toBe(409);
    expect((await (await post(owner)).json()).id).toBe(id);
    expect((await fetch(url+'matches/'+id,{headers:{cookie:stranger}})).status).toBe(404);
    const result=await (await fetch(url+'matches/'+id,{headers:{cookie:owner}})).json();
    expect(result).toMatchObject({status:'completed',rulesVersion:revision,attempts:[{status:'ok'}],reflection:{status:'unavailable'}});
    expect(load(result.replay).recording.final.result).toBe('blue');
    expect(calls).toBe(1);
  } finally {
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    db.close();
  }
});
