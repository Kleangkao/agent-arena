import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {commandMatch} from '../server/squads';
import {createApi} from '../server/api';
import {sqliteStorage} from '../server/sqlite-storage';
import {lockSquadGuidance} from '../server/squad-guidance';
import {arenaBotPlan,highestWins,previewChallenge} from '../src/squads/arena-bots';
import {arenaPolicyVersion,currentSquadConfig,initialSquads,loadSquads,parsePlan,scriptedSquads,squadModes,type ArenaDifficulty,type SquadMode} from '../src/squads/game';
import {squadCommitment} from '../src/squads/receipt';
import type {Attempt,Coach} from '../server/match';

const difficulties=['easy','normal','hard'] as const satisfies readonly ArenaDifficulty[];
const coach:Coach={text:'Hold the south approach.',revision:'coach-rev',memory:{revision:0,lessons:[]},
 guidance:lockSquadGuidance('patient','coach-led','Hold the south approach.')};

it('plays every mode legally and deterministically against three reference formations',()=>{
 for(const mode of squadModes)for(const reference of ['split','north','south'] as const){
  const traces=difficulties.map(difficulty=>{
   const config=currentSquadConfig(mode);
   const first=previewChallenge(config,difficulty,reference);
   expect(previewChallenge(config,difficulty,reference).replay).toEqual(first.replay);
   expect(first.frames[0].units.every(unit=>unit.hp===100)).toBe(true);
   expect(first.replay.final).not.toBeNull();
   expect(()=>parsePlan(first.replay.windows[0][1],initialSquads(config),1)).not.toThrow();
   expect(first.replay.windows[0][1].orders.every(order=>order.endsWith('/pulse'))).toBe(true);
   return JSON.stringify(first.replay.windows.map(window=>window[1].orders));
  });
  expect(new Set(traces).size).toBe(3);
 }
});

it('authorizes legal Core interaction and pulses at every difficulty',()=>{
 const frame=initialSquads(currentSquadConfig('bomb'));
 frame.objective={site:0,phase:'countdown',progress:0,remaining:10};
 for(const difficulty of difficulties){
  const plan=arenaBotPlan(frame,difficulty);
  expect(()=>parsePlan(plan,frame,1)).not.toThrow();
  expect(plan.orders.some(order=>order.endsWith('/link'))).toBe(true);
  expect(plan.orders.some(order=>order.endsWith('/pulse'))).toBe(true);
 }
});

it('asks the model only for the player commander and keeps the bot policy on the replay',async()=>{
 const attempts:Attempt[]=[];
 const sides:number[]=[];
 const config=currentSquadConfig('tdm');
 const replay=await commandMatch(config,async(frame,side)=>{
  sides.push(side);
  if(side!==0)throw Error('Sand was sent to the commander');
  return {intent:'Hold and watch.',orders:frame.units.filter(unit=>unit.side===0).map(()=>'-')};
 },AbortSignal.timeout(2000),attempts,raw=>raw,{plan:frame=>arenaBotPlan(frame,'easy'),
  challenge:{format:'challenge',difficulty:'easy',policy:arenaPolicyVersion,opponent:'arena-easy'}});
 expect(sides.every(side=>side===0)).toBe(true);
 expect(attempts.filter(attempt=>attempt.side===1).every(attempt=>attempt.model===undefined&&attempt.status==='accepted')).toBe(true);
 expect(replay).toMatchObject({source:'arena-challenge',challenge:{opponent:'arena-easy',policy:arenaPolicyVersion},interruption:null});
 expect(loadSquads(replay).replay).toEqual(replay);
 expect(squadCommitment(replay,'11111111-1111-4111-8111-111111111111').replayHash)
  .not.toBe(squadCommitment({...replay,challenge:{...replay.challenge!,difficulty:'hard',opponent:'arena-hard'}},'11111111-1111-4111-8111-111111111111').replayHash);
});

it('counts a win only from an authoritative blue result',()=>{
 expect(highestWins([
  {mode:'bomb',difficulty:'easy',result:'blue'},
  {mode:'bomb',difficulty:'hard',result:'sand'},
  {mode:'relay',difficulty:'normal',result:'blue'},
  {mode:'tdm',difficulty:'easy',result:'draw'},
 ])).toEqual({bomb:'easy',relay:'normal'});
});

it('reserves a challenge opponent separately from a Gemini versus match',async()=>{
 const db=new DatabaseSync(':memory:');
 const storage=sqliteStorage(db,'.arena-data/challenge-test');
 const calls:{squad:number;challenge:SquadMode[]}={squad:0,challenge:[]};
 const jobs:Promise<void>[]=[];
 const app=createApi(storage,{localSquads:true,key:'test-key',model:'test-model',background:job=>jobs.push(job),
  squadRunner:async()=>{calls.squad++;return {...scriptedSquads(currentSquadConfig('relay')).replay,source:'operator-attested-gemini' as const};},
  challengeRunner:async(_key,_model,config,_coaches,_signal,attempts,difficulty,opponent)=>{
   try{
    calls.challenge.push('mode' in config?config.mode:'relay');
    const playback=scriptedSquads(config);
    playback.replay.windows.forEach((_,index)=>attempts.push({step:index*12,side:0,status:'accepted',attempt:1,ms:1,model:'test-model',coachingRevision:_coaches[0].revision,input:3,output:2}));
    const replay={...playback.replay,source:'arena-challenge' as const,challenge:{format:'challenge' as const,difficulty,policy:arenaPolicyVersion,opponent}};
    return loadSquads(replay).replay;
   }catch(error){calls.challenge.push(error instanceof Error?error.message:String(error));throw error;}
  }});
 const server=app.listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 try{
  const root='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
  const cookie=(await fetch(root+'guest',{method:'POST'})).headers.get('set-cookie')!.split(';')[0];
  const start=(body:object)=>fetch(root+'matches',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)});
  const created=await start({requestId:randomUUID(),rulesVersion:'squads-v4',mode:'relay',opponent:'arena-hard',coaching:coach.text,strategy:'patient',autonomy:'coach-led'});
  expect(created.status).toBe(202);
  const {id}=await created.json();
  await Promise.all(jobs);
  const job=await (await fetch(root+'matches/'+id,{headers:{cookie}})).json();
  expect(job.replay.challenge).toMatchObject({difficulty:'hard',policy:arenaPolicyVersion,opponent:'arena-hard'});
  expect(job.guidance.received.coaching).toBe(coach.text);
  expect(job.attempts.filter((attempt:{side:number})=>attempt.side===0).length).toBeGreaterThan(0);
  expect(job.attempts.some((attempt:{side:number;model?:string})=>attempt.side===1&&attempt.model)).toBe(false);
  expect(calls).toMatchObject({squad:0,challenge:['relay']});
  expect((await start({requestId:randomUUID(),rulesVersion:'squads-v4',mode:'relay',opponent:'arena-easy',coaching:coach.text,strategy:'patient',autonomy:'coach-led',sameSetup:id})).status).toBe(404);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});

const {generate}=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('@google/genai',()=>({GoogleGenAI:class{models={generateContent:generate};}}));

it('sends coaching only on Blue challenge requests',async()=>{
 const {runChallengeSquads}=await import('../server/squads');
 generate.mockReset();
 generate.mockImplementation(async(request:{contents:string})=>{
  const input=JSON.parse(request.contents);
  expect(input.observation.side).toBe('Blue');
  expect(input.coaching).toMatchObject({coaching:'Hold the south approach.',autonomy:expect.any(String)});
  return {text:JSON.stringify({intent:'Hold',orders:['-','-','-','-','-'],pulseSlots:[]}),modelVersion:'test-model',usageMetadata:{promptTokenCount:11,candidatesTokenCount:4}};
 });
 const attempts:Attempt[]=[];
 const replay=await runChallengeSquads('fake-key','fake-model',currentSquadConfig('tdm'),[coach,coach],AbortSignal.timeout(5000),attempts,'normal','arena-normal');
 expect(generate.mock.calls.length).toBe(replay.windows.length);
 expect(attempts.filter(attempt=>attempt.side===0&&attempt.status==='accepted').every(attempt=>attempt.coachingRevision===coach.revision&&attempt.input===11)).toBe(true);
 expect(attempts.filter(attempt=>attempt.side===1).every(attempt=>attempt.model===undefined)).toBe(true);
 expect(replay.source).toBe('arena-challenge');
});
