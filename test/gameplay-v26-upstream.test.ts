import {expect,it} from 'vitest';
import {BehaviorExecution,parseBehavior} from '../server/gameplay-v26-behavior.js';
import {verifyAuthorizationTrace} from '../server/gameplay-v26-evidence.js';
import {limits,runTrial,selectedCadence} from '../server/gameplay-v26.js';
import {configure,second} from '../src/v26/config.js';
import {advance,initial,observation} from '../src/v26/game.js';
import {condition} from '../src/v26/controller.js';

const config=configure(12,'score-deathmatch');
const asView=()=>observation(config,initial(config),0);
const coach={text:'Injected fixture',revision:'fixture'};
const ordered={version:1,kind:'ordered',expiresInMs:1000,reenter:true,scope:{kind:'life'},
  stages:[{forMs:100,packet:{movement:{kind:'steer',gait:'walk',direction:{x:1,y:0}}}}]};
const stateMachine={version:1,kind:'state-machine',expiresInMs:2000,reenter:false,scope:{kind:'life'},entry:'move',
  states:[{id:'move',action:{forMs:100,packet:{movement:{kind:'steer',gait:'walk',direction:{x:1,y:0}}}},transitions:[{to:'rest'}]},
    {id:'rest',action:{forMs:150,packet:{}},transitions:[]}]};

it('separates nonrenewing life scope from explicit match scope and resets execution on respawn',()=>{
  const v=asView(), dead={...v,time:100,agent:{...v.agent,hp:0,reloadIn:300}},
    revived={...v,time:200,agent:{...v.agent,life:2}};
  const scoped={...ordered,scope:{kind:'match',restart:'stage-0'}};
  expect(()=>parseBehavior(scoped,config,'ordered',20)).toThrow();
  expect(()=>parseBehavior({...scoped,scope:{kind:'match',restart:'stage-1'}},config,'ordered',20,true)).toThrow();
  const life=new BehaviorExecution(parseBehavior(ordered,config,'ordered',20),v,0,1,'match');
  const match=new BehaviorExecution(parseBehavior(scoped,config,'ordered',20,true),v,0,1,'match');
  expect(match.next(v).packet).toEqual(life.next(v).packet);
  expect(life.next(dead).status).toBe('invalidated');
  expect(match.next(dead)).toMatchObject({status:'waiting',packet:null});
  expect(match.active).toBeUndefined();
  expect(life.next(revived).packet).toBeNull();
  expect(match.next(revived).packet).toEqual(ordered.stages[0].packet);
  expect(match.reference()).toMatchObject({life:2,acceptedLife:1,expires:second,scope:'match'});
  expect(match.next({...dead,time:second}).status).toBe('expired');
  expect(match.next({...revived,time:second+100}).packet).toBeNull();
});

it('ends on explicit revocation and terminal match, with no restart or authorization extension',()=>{
  const v=asView(), b=parseBehavior({...ordered,revokeWhen:'ammo-empty'},config,'ordered',20);
  const revoked=new BehaviorExecution(b,v,0,1,'match');
  expect(revoked.next(v).packet).not.toBeNull();
  expect(revoked.next({...v,time:100,agent:{...v.agent,ammo:0}}).status).toBe('invalidated');
  expect(revoked.next({...v,time:200}).packet).toBeNull();
  const terminal=new BehaviorExecution(b,v,0,1,'match');
  expect(terminal.next({...v,match:{...v.match,remaining:0}}).status).toBe('completed');
  expect(terminal.next(v).packet).toBeNull();
});

it('transition priorities and tree preemption follow authored guards and reject cyclic trees',()=>{
  const v=asView(), s=parseBehavior(stateMachine,config,'state-machine',20);
  const fsm=new BehaviorExecution(s,v,0,1,'match');
  expect(fsm.next(v).packet).toMatchObject({movement:{kind:'steer'}});
  expect(fsm.next({...v,time:300}).reason).toBe('transition');
  expect(fsm.next({...v,time:400}).packet).toEqual({});
  const tree={version:1,kind:'behavior-tree',expiresInMs:2000,reenter:false,scope:{kind:'life'},root:'root',
    nodes:[{id:'root',kind:'selector',children:['reload','hold']},{id:'reload',kind:'sequence',children:['ready','action']},
      {id:'ready',kind:'condition',when:'ammo-empty'},{id:'action',kind:'action',action:{forMs:1400,packet:{reload:true}}},
      {id:'hold',kind:'wait',forMs:2000}]};
  const t=new BehaviorExecution(parseBehavior(tree,config,'behavior-tree',20),v,0,1,'match');
  expect(t.next(v).packet).toEqual({});
  expect(t.next({...v,time:100,agent:{...v.agent,ammo:0}}).packet).toEqual({reload:true});
  expect(t.reference()).toMatchObject({step:'action',branch:'primary'});
  expect(()=>parseBehavior({...tree,nodes:[{...tree.nodes[0],children:['root']},...tree.nodes.slice(1)]},
    config,'behavior-tree',20)).toThrow();
  expect(()=>parseBehavior({...tree,nodes:tree.nodes.map(n=>n.id==='ready'?{...n,when:'hidden-rival-position'}:n)},
    config,'behavior-tree',20)).toThrow();
});

it('distinguishes accepted gameplay capabilities from the vocabulary used to condition on them',()=>{
  const objective=configure(12,'objective-duel');
  const start=initial(objective);
  start.fighters[0].position=objective.core.position;
  const v=observation(objective,start,0);
  const spec=(packet:unknown,when?:string)=>({...ordered,stages:[{forMs:400,packet,when}]});
  const action=(input:unknown,view:typeof v)=>new BehaviorExecution(parseBehavior(input,objective,'ordered',20),view,0,1,'match').next(view).packet;
  const prioritize=action(spec({core:'start'},'core-available'),v);
  expect(action(spec({}),v)).toEqual({});
  const committed=advance(objective,start,[prioritize,null]).state;
  const committing=observation(objective,committed,0);
  expect(committing.legal.cancel).toBe(true);
  const cancel=action(spec({core:'cancel'},'pending'),committing);
  expect(advance(objective,committed,[cancel,null]).receipts[0]).toContainEqual({channel:'core',accepted:true});
  for(const key of ['can-cancel','has-history','can-precision']) expect(condition.safeParse(key).success).toBe(false);
  // Isolated predicate probe: the phase guard alone cannot distinguish these matched observations.
  expect(action(spec({core:'cancel'},'pending'),v)).toEqual({core:'cancel'});
  expect(advance(objective,start,[{core:'cancel'},null]).receipts[0].some(r=>!r.accepted)).toBe(true);
  const explicitCancel=(view:typeof v)=>view.legal.cancel?action(spec({core:'cancel'}),view):null;
  expect(explicitCancel(v)).toBeNull();
  expect(explicitCancel(committing)).toEqual({core:'cancel'});
  const low=initial(config);
  low.fighters[0].ammo=1;
  const own=observation(config,low,0);
  const movement=ordered.stages[0].packet.movement;
  const moving=new BehaviorExecution(parseBehavior(spec({movement,reload:true},'can-reload'),config,'ordered',20),own,0,1,'match');
  expect(advance(config,low,[moving.next(own).packet,null]).receipts[0]).toEqual(expect.arrayContaining([
    {channel:'movement',accepted:true},{channel:'reload',accepted:true},
  ]));
});

it('accounts for trace tampering, injected provider interruption, and request caps',async()=>{
  const small={...ordered,expiresInMs:4500};
  const run=await runTrial(config,[coach,coach],async()=>small,selectedCadence,new AbortController().signal,
    'injected-provider',{representation:'ordered',horizon:20});
  expect(verifyAuthorizationTrace(run).authored).toBeGreaterThan(0);
  expect(run.participants.every(p=>p.metrics.calls<=limits.perSide)).toBe(true);
  expect(run.participants.reduce((n,p)=>n+p.metrics.calls,0)).toBeLessThanOrEqual(limits.total);
  const altered=structuredClone(run);
  altered.upstream!.provenance[0].ref!.expires++;
  expect(()=>verifyAuthorizationTrace(altered)).toThrow();
  const blocked=await runTrial(config,[coach,coach],async()=>{throw Object.assign(Error('injected'),{status:429});},
    selectedCadence,new AbortController().signal,'injected-provider',{representation:'ordered',horizon:20});
  expect(blocked.recording.final.result).toBeNull();
  expect(blocked.recording.interruption).toMatchObject({reason:'provider'});
  expect(blocked.participants.every(p=>p.metrics.calls===1)).toBe(true);
});

it('produces the same replay from the same authorizations and equivalent observable state',async()=>{
  const c=configure(23,'objective-duel');
  for(const [representation,spec] of [['ordered',ordered],['state-machine',stateMachine],['behavior-tree',{
    version:1,kind:'behavior-tree',scope:{kind:'life'},expiresInMs:1500,reenter:true,
    root:'wait',nodes:[{id:'wait',kind:'wait',forMs:100}],
  }]] as const) {
    const run=()=>runTrial(c,[coach,coach],async()=>spec,selectedCadence,new AbortController().signal,
      'injected-provider',{representation,horizon:20});
    const [a,b]=await Promise.all([run(),run()]);
    expect(a.upstream!.replay).toBe(b.upstream!.replay);
    expect(a.upstream!.match).not.toBe(b.upstream!.match);
    expect(verifyAuthorizationTrace(a)).toEqual(verifyAuthorizationTrace(b));
  }
});
