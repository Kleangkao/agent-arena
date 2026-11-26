import {expect,it} from 'vitest';
import {limits,runTrial,selectedCadence} from '../server/gameplay-v26.js';
import {configure,second} from '../src/v26/config.js';
import {load} from '../src/v26/replay.js';

const coach={text:'Local lifecycle fixture',revision:'fixture'};
const coaches=[coach,coach] as const;
const wait=(ms:number)=>({version:1,expiresInMs:ms,stages:[{forMs:ms,packet:{}}]});
const signal=()=>new AbortController().signal;

it('renews at completion or expiry under the allowance while preserving authored waits',async()=>{
  const c=configure(12,'objective-duel');
  for(const plan of [wait(4500),{...wait(10000),stages:wait(4500).stages}]) {
    const trial=await runTrial(c,coaches,async()=>plan,selectedCadence,signal());
    for(const p of trial.participants) {
      expect(p.requests.map(x=>x.tick)).toEqual([0,135,270,405,540]);
      expect(p.timing.eligible).toBe(c.core.pending);
      expect(p.timing.authorizedWait).toBe(c.core.pending);
      expect(p.timing.infrastructureIdle).toBe(0);
      expect(p.timing.executable).toBe(0);
    }
  }
});

it('counts held guards separately and starts both participants from the same boundary',async()=>{
  const c=configure(12,'objective-duel');
  const entered:string[]=[];
  let release!:()=>void;
  const both=new Promise<void>(done=>{release=done;});
  const trial=await runTrial(c,coaches,async prompt=>{
    if(prompt.view.time===0) {
      entered.push(prompt.participant);
      if(entered.length===2) release();
      await both;
    }
    return {version:1,expiresInMs:10000,stages:[{forMs:10000,when:'active',packet:{core:'cancel'}}]};
  },selectedCadence,signal());
  expect(entered).toEqual(c.participants);
  for(const p of trial.participants) {
    expect(p.requests[1]).toMatchObject({tick:60,trigger:'guard-stalled'});
    expect(p.timing.guardWait).toBeGreaterThan(0);
    expect(p.timing.authorizedWait).toBe(0);
    expect(p.timing.executable+p.timing.infrastructureIdle+p.timing.guardWait+p.timing.blocked+
      p.timing.authorizedWait+p.timing.planIdle).toBe(p.timing.eligible);
  }
});

it('counts retries in the budget and preserves a terminal-free interrupted recording',async()=>{
  const c=configure(12,'score-deathmatch',0,undefined,undefined,5,120);
  const retried=new Set<string>();
  const trial=await runTrial(c,coaches,async input=>{
    const key=input.participant+':'+input.view.time;
    if(!retried.has(key)) {
      retried.add(key);
      throw Object.assign(Error('Injected transient error'),{status:503});
    }
    return wait(1000);
  },selectedCadence,signal());
  expect(trial.participants.every(p=>p.metrics.calls<=limits.perSide)).toBe(true);
  expect(trial.participants.reduce((n,p)=>n+p.metrics.calls,0)).toBeLessThanOrEqual(limits.total);
  expect(trial.participants[0].requests.some(x=>x.attempt===2)).toBe(true);
  expect(trial.recording.interruption).toMatchObject({reason:'budget'});
  expect(trial.recording.final.result).toBeNull();
  expect(trial.recording.final.time).toBeLessThan(120*second);
  expect(load(trial.recording).recording).toEqual(trial.recording);
});

it('advances a model-authored blocked-movement checkpoint on the collision boundary without requesting another plan',async()=>{
  const c=configure(23,'objective-duel');
  const spec={version:1,expiresInMs:10000,stages:[
    {forMs:5000,packet:{movement:{kind:'goal',gait:'run',to:c.core.position}},until:'movement-blocked'},
    {forMs:5000,packet:{movement:{kind:'stop'},posture:'crouch'}},
  ]};
  const trial=await runTrial(c,coaches,async()=>spec,selectedCadence,signal());
  const {frames}=load(trial.recording);
  const collision=frames.find(frame=>frame.events.some(e=>e.kind==='collision'&&e.side===0));
  expect(collision).toBeDefined();
  const next=frames.find(frame=>frame.state.tick===collision!.state.tick+1);
  expect(next?.receipts[0]).toContainEqual({channel:'posture',accepted:true});
  expect(trial.participants[0].requests.some(r=>r.tick===collision!.state.tick)).toBe(false);
});

it('allows one recovery for each of a transient provider failure and an invalid plan under the same budget',async()=>{
  const c=configure(12,'objective-duel');
  let count=0;
  const trial=await runTrial(c,coaches,async prompt=>{
    if(prompt.participant===c.participants[0]&&prompt.view.time===0){
      count++;
      if(count<=2)throw Object.assign(Error('Injected transient response'),{status:503});
      if(count===3)return {stages:[]};
    }
    return {version:1,expiresInMs:20000,stages:[{forMs:10000,packet:{}},{forMs:10000,packet:{}}]};
  },selectedCadence,signal());
  expect(trial.recording.interruption).toBeNull();
  expect(trial.participants[0].requests.map(x=>x.status)).toEqual(['503','503','invalid-or-provider','accepted']);
  expect(trial.participants[0].requests[2].failure).toMatch(/validation/);
});
