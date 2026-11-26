import {expect,it} from 'vitest';
import {capabilityPlan} from '../server/gameplay-v27-capability.js';
import {parsePlan} from '../src/v26/controller.js';
import {configure} from '../src/v26/config.js';
import {advance,initial,observation} from '../src/v26/game.js';

it('guards Core cancellation with owned, filtered eligibility and keeps the current plan schema intact',()=>{
  const c=configure(12,'objective-duel');
  const s=initial(c);
  s.fighters[0].position=c.core.position;
  const started=advance(c,s,[{core:'start'},null]).state;
  const inactive=observation(c,s,0), committed=observation(c,started,0);
  const spec={version:1,expiresInMs:1000,stages:[{forMs:1000,packet:{core:'cancel'},
    when:{kind:'capability-available',capability:'cancel'},alternative:{}}]};
  expect(()=>parsePlan(spec,c)).toThrow();
  expect(capabilityPlan(spec,c,inactive).next(inactive).packet).toEqual({});
  const cancel=capabilityPlan(spec,c,committed).next(committed).packet;
  expect(advance(c,started,[cancel,null]).receipts[0]).toContainEqual({channel:'core',accepted:true});
  expect(()=>capabilityPlan({...spec,stages:[{...spec.stages[0],when:{kind:'capability-available',
    capability:'cancel',side:1}}]},c,inactive)).toThrow();
});

it('reads the precision flag without deriving it from unseen rival information or authoring a substitute',()=>{
  const c=configure(12,'score-deathmatch');
  const s=initial(c);
  const hidden=observation(c,s,0);
  s.fighters[0].position={x:18000,y:20790};
  s.fighters[1].position={x:24000,y:20790};
  const exposed=advance(c,s,[null,null]).state;
  const view=observation(c,exposed,0);
  const spec={version:1,expiresInMs:900,stages:[{forMs:900,
    when:{kind:'capability-available',capability:'precision'},packet:{attack:'precision'}}]};
  expect(hidden.legal.precision).toBe(false);
  expect(capabilityPlan(spec,c,hidden).next(hidden)).toMatchObject({packet:null,status:'waiting'});
  expect(view.legal.precision).toBe(true);
  const selected=capabilityPlan(spec,c,view).next(view).packet;
  expect(selected).toEqual({attack:'precision'});
  expect(advance(c,exposed,[selected,null]).receipts[0]).toContainEqual({channel:'attack',accepted:true});
});
