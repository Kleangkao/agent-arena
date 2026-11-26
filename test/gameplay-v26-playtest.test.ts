import {expect,it} from 'vitest';
import {configure} from '../src/v26/config.js';
import {advance,initial,observation,type Frame,type Packet,type State} from '../src/v26/game.js';
import {authorize,execute,motionLease,parsePlan} from '../src/v26/controller.js';
import {developmentController} from '../src/v26/development.js';
import {unit} from '../src/v23/space.js';
import {manualPacket} from '../src/v26/playtest.js';
import {runTrial,selectedCadence} from '../server/gameplay-v26.js';

const c=configure(12,'elimination');
const stop={kind:'stop'} as const;
const steer={kind:'steer',gait:'walk',direction:{x:-1,y:0}} as const;
const approach={kind:'goal',gait:'walk',to:{x:30000,y:20790}} as const;
function open(distance:number,ammo:number) {
  const state=initial(c);
  state.fighters[1].position={x:24000,y:20790};
  state.fighters[0].position={x:24000-distance,y:20790};
  state.fighters[1].ammo=ammo;
  return advance(c,state,[null,null]).state;
}
it('the sandbox Sand policy can select movement as it starts reload when pressed at close range',()=>{
  const state=open(unit,1), view=observation(c,state,1);
  const packet=developmentController(c,1,'steady',23)(view);
  const next=advance(c,state,[null,packet]);
  expect(packet).toMatchObject({reload:true,movement:{kind:'steer'}});
  expect(next.receipts[1]).toEqual(expect.arrayContaining([
    expect.objectContaining({channel:'reload',accepted:true}),
    expect.objectContaining({channel:'movement',accepted:true})]));
  expect(next.state.fighters[1].position.x).toBeGreaterThan(state.fighters[1].position.x);
  const manual=manualPacket(view,new Set(['KeyD']),new Set(['KeyR']))!;
  const strategic=authorize(parsePlan({version:1,expiresInMs:1400,stages:[{forMs:1400,packet:manual}]},c),view.time);
  expect(advance(c,state,[null,execute(strategic,view).packet])).toEqual(advance(c,state,[null,manual]));
  let moving=next.state;
  const completion=state.time+4000;
  let final:Frame|undefined;
  while(moving.time<completion) {final=advance(c,moving,[null,null]);moving=final.state;}
  expect(final?.events).toContainEqual({kind:'reload',time:completion,due:state.time+3960,side:1});
  expect(moving.fighters[1].ammo).toBe(c.equipment.capacity);
});
it('the sandbox Sand policy stops an old approach when precision is available at current range',()=>{
  const state=open(3*unit,4);
  const moving=advance(c,state,[null,{movement:steer}]).state;
  const v=observation(c,moving,1);
  expect(v.legal.standard).toBe(true);
  const packet=developmentController(c,1,'steady',23)(v);
  expect(packet).toMatchObject({movement:stop,attack:'precision'});
  const next=advance(c,moving,[null,packet]);
  expect(next.receipts[1].every(r=>r.accepted)).toBe(true);
  expect(next.state.fighters[1].position).toEqual(moving.fighters[1].position);
});
it('the scripted Score opponent chooses a visible approach goal short of the opponent footprint',()=>{
  const start=initial(c);
  start.fighters[0].position={x:8910,y:20790};
  start.fighters[1].position={x:8910+4*unit+600,y:20790};
  const state=advance(c,start,[null,null]).state;
  const v=observation(c,state,1);
  expect(v.current?.position).toEqual(start.fighters[0].position);
  expect(v.currentInReach).toBe(false);
  const packet=developmentController(c,1,'steady',23)(v);
  expect(packet?.movement).toMatchObject({kind:'goal',to:{x:8910+2*unit,y:20790}});
  expect(advance(c,state,[null,packet]).receipts[1]).toContainEqual({channel:'movement',accepted:true});
});
it('a one-shot conditional alternative takes over an ongoing approach at the next observed boundary',()=>{
  const i=open(c.perception.range+180,4);
  // Move the pair into an open lane so contact changes through the real sensor.
  i.fighters[0].position={x:8000,y:20790};i.fighters[1].position={x:8000+c.perception.range+180,y:20790};
  const v=observation(c,i,0);
  const e=authorize(parsePlan({version:1,expiresInMs:2000,stages:[{forMs:1800,
    when:'has-contact',packet:{movement:stop},alternative:{movement:approach}}]},c),v.time);
  expect(v.current).toBeNull();
  const sent=motionLease(execute(e,v),e,v,false);
  expect(sent.packet).toMatchObject({movement:approach});
  const moving=advance(c,i,[sent.packet,null]).state;
  const current=observation(c,moving,0);
  expect(current.current?.time).toBe(moving.time);
  const reacted=motionLease(execute(e,current),e,current,sent.motion);
  expect(reacted.packet).toEqual({movement:stop});
  expect(advance(c,moving,[reacted.packet,null]).state.fighters[0].position).toEqual(moving.fighters[0].position);
});
it('manual, scripted and strategic inputs produce matching effects for redirect, air, posture and Core commitment',()=>{
  const objective=configure(12,'objective-duel');
  let state=initial(objective);
  state.fighters[0].position=objective.core.position;
  const compare=(s:State,held:string[],pressed:string[])=>{
    const view=observation(objective,s,0);
    const packet=manualPacket(view,new Set(held),new Set(pressed))!;
    const fixturePlan={version:1,expiresInMs:1500,stages:[{forMs:1000,packet}]};
    const x=authorize(parsePlan(fixturePlan,objective),view.time);
    const dev=developmentController(objective,0,'mobile',23,()=>fixturePlan);
    const fromManual=advance(objective,s,[packet,null]);
    expect(advance(objective,s,[execute(x,view).packet,null])).toEqual(fromManual);
    expect(advance(objective,s,[dev(view),null])).toEqual(fromManual);
    expect(fromManual.receipts[0].every(r=>r.accepted)).toBe(true);
    return fromManual.state;
  };
  state=compare(state,[],['KeyX']);
  expect(state.core?.channel?.side).toBe(0);
  state=compare(state,[],['KeyZ']);
  expect(state.core?.channel).toBeUndefined();
  state=compare(state,['KeyD'],['KeyC']);
  expect(state.fighters[0].posture).toBe('crouch');
  state=compare(state,['KeyA'],[]);
  expect(state.fighters[0].position).toEqual(objective.core.position);
  state=compare(state,['KeyS'],['Space']);
  expect(state.fighters[0].airUntil).toBeDefined();
});
it('hands off a completed off-center goal, invalidates the next stage, and expires an abandoned plan',()=>{
  const i=open(3*unit,4), at=i.fighters[1].position;
  const target={x:at.x+250,y:at.y+75};
  const v=observation(c,i,1);
  const p:Packet={movement:{kind:'goal',gait:'walk',to:target}};
  const e=authorize(parsePlan({version:1,expiresInMs:2000,stages:[
    {forMs:1500,packet:p,until:'at-goal'},
    {forMs:400,packet:{reload:true},interruptWhen:'has-contact'},
  ]},c),v.time);
  const start=execute(e,v);
  const frame=advance(c,i,[null,start.packet]);
  expect(frame.state.fighters[1].position).toEqual(target);
  expect(execute(e,observation(c,frame.state,1))).toMatchObject({status:'invalidated',reason:'has-contact'});
  expect(e.index).toBe(1);
  expect(execute(e,{...v,time:e.expires})).toMatchObject({status:'expired',reason:'plan-deadline'});
});
it('lets a development Activator combine a Core approach with a legal standard action',()=>{
  const objective=configure(12,'objective-duel'), i=initial(objective);
  i.fighters[0].position={x:10000,y:20790};
  i.fighters[1].position={x:32000,y:20790};
  const state=advance(objective,i,[null,null]).state;
  const v=observation(objective,state,0);
  expect(v.currentInReach&&v.legal.standard&&!v.legal.core).toBe(true);
  const packet=developmentController(objective,0,'steady',23)(v);
  expect(packet).toMatchObject({movement:{kind:'goal'},attack:'standard'});
  const frame=advance(objective,state,[packet,null]);
  expect(frame.receipts[0].every(r=>r.accepted)).toBe(true);
  expect(frame.state.fighters[0].position.x).toBeGreaterThan(state.fighters[0].position.x);
});
it('authorizes wait separately from missing plan time and preserves exact elapsed scheduler units',async()=>{
  const coach={text:'Fixture',revision:'fixture'};
  const r=await runTrial(c,[coach,coach],async()=>({version:1,expiresInMs:4500,
    stages:[{forMs:4500,packet:{}}]}),'reserved',new AbortController().signal);
  for(const p of r.participants) {
    expect(p.timing.eligible).toBe(r.recording.final.time);
    expect(p.timing.eligible).toBe(p.timing.covered+p.timing.uncovered);
    expect(p.timing.covered).toBe(p.timing.authorizedWait);
    expect(p.timing.infrastructureIdle).toBe(p.timing.uncovered);
    expect(p.timing.longestGap).toBeGreaterThan(0);
    expect(p.timing.feedbackProduced).toBe(p.metrics.delivered+p.feedbackPending+p.feedbackOverflow);
  }
});
it('executes a planned Core approach and commitment, then delivers the phase change to the injected provider',async()=>{
  const objective=configure(12,'objective-duel');
  const coach={text:'Fixture',revision:'fixture'};
  const requests:{phase:string|null;publicActivation:boolean}[]=[];
  const trial=await runTrial(objective,[coach,coach],async input=>{
    requests.push({phase:input.view.match.phase,publicActivation:input.events.some(e=>e.kind==='core')});
    const approachCore=input.view.match.role==='Activator'&&input.view.match.phase==='pending';
    return {version:1,expiresInMs:13000,stages:[approachCore?{
      forMs:13000,when:'core-available',packet:{core:'start'},
      alternative:{movement:{kind:'goal',gait:'run',to:input.view.match.site}}
    }:{forMs:13000,packet:{}}]};
  },selectedCadence,new AbortController().signal);
  expect(trial.recording.final).toMatchObject({result:'blue',reason:'core-completed'});
  expect(requests).toContainEqual({phase:'active',publicActivation:true});
  expect(trial.participants.flatMap(p=>p.requests).filter(r=>r.trigger==='phase'&&r.status==='accepted')).toHaveLength(2);
});
