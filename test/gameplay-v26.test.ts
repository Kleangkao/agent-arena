import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {center,unit} from '../src/v23/space.js';
import {configure,second} from '../src/v26/config.js';
import {advance,initial,observation,moveToward,distance2,within,type Packet} from '../src/v26/game.js';
import {authorize,execute,feedback,motionLease,parsePlan,strategicPrompt} from '../src/v26/controller.js';
import {load,record} from '../src/v26/replay.js';
import {load as oldLoad} from '../src/v25/replay.js';
import {runTrial} from '../server/gameplay-v26.js';

const coach={revision:'local',text:'Test a bounded arcade plan.'};
const steer:Packet={movement:{kind:'steer',gait:'walk',direction:{x:1,y:1}}};
const plan=(p:Packet,forMs=4500)=>({version:1,expiresInMs:forMs,stages:[{forMs,packet:p}]});
const oneSide=(p:Packet)=>[p,null] as const;
describe('V2.6 shared gameplay contract',()=>{
  it('moves continuously with bounded mirrored diagonal speed and changes direction, posture and facing together',()=>{
    const c=configure(12,'elimination'), i=initial(c);
    const reflected={x:-127,y:87}, direction={x:127,y:87}, p={x:0,y:0};
    const a=moveToward(p,direction,50), b=moveToward(p,reflected,50);
    expect(a.x).toBe(-b.x);expect(a.y).toBe(b.y);expect(distance2(a,p)).toBeLessThanOrEqual(2500);
    const frame=advance(c,i,oneSide({...steer,posture:'crouch',facing:{x:-1,y:0}}));
    expect(frame.receipts[0].every(r=>r.accepted)).toBe(true);
    expect(frame.state.fighters[0].posture).toBe('crouch');
    expect(distance2(frame.state.fighters[0].position,i.fighters[0].position)).toBeLessThanOrEqual(200**2);
    const redir=advance(c,frame.state,oneSide({posture:'upright',movement:{kind:'steer',gait:'run',direction:{x:-1,y:0}}}));
    expect(redir.state.fighters[0].position.x).toBe(frame.state.fighters[0].position.x-600);
  });
  it('keeps awareness, historical information, and attack range independent',()=>{
    const c=configure(1,'elimination'), i=initial(c);
    i.fighters[0].position=center(29);i.fighters[1].position={x:center(29).x+4*unit+1,y:center(29).y};
    const visible=advance(c,i,[null,null]).state;
    expect(observation(c,visible,0).current).toBeTruthy();
    expect(advance(c,visible,oneSide({attack:'standard'})).receipts[0][0].reason).toBe('outside-equipment-geometry');
    visible.fighters[1].position=center(13);
    const hidden=advance(c,visible,[null,null]).state;
    expect(observation(c,hidden,0).current).toBeNull();
    expect(observation(c,hidden,0).historical).toBeTruthy();
    expect(advance(c,hidden,oneSide({attack:'standard'})).receipts[0][0].reason).toBe('no-current-contact');
    expect(within({x:0,y:0},{x:3,y:4},5)).toBe(true);
  });
  it('uses new positions for due attacks and allows airborne movement and reload',()=>{
    const c=configure(12,'elimination'), i=initial(c);
    i.fighters[0].position=center(29);i.fighters[1].position={x:center(29).x+4*unit,y:center(29).y};
    i.fighters[0].firing={kind:'standard',due:100};
    const frame=advance(c,i,[null,{movement:{kind:'steer',gait:'walk',direction:{x:1,y:0}}}]);
    const attack=frame.events.find(e=>e.kind==='attack')!;
    expect(attack).toMatchObject({time:100,due:100,damage:0,to:frame.state.fighters[1].position});
    i.fighters[0].ammo=1;delete i.fighters[0].firing;
    const air=advance(c,i,oneSide({...steer,jump:true,reload:true}));
    expect(air.receipts[0].every(r=>r.accepted)).toBe(true);
    expect(air.state.fighters[0].airUntil).toBe(2000);
    expect(advance(c,air.state,oneSide({jump:true,posture:'crouch'})).receipts[0].every(r=>!r.accepted)).toBe(true);
  });
  it('rounds scheduled actions to boundaries and settles simultaneous due effects before the clipped deadline',()=>{
    const c=configure(12,'elimination'), i=initial(c);
    i.fighters[0].ammo=1;
    let pending=advance(c,i,oneSide({reload:true}));
    while(pending.state.time<3900) pending=advance(c,pending.state,[null,null]);
    expect(pending.state.fighters[0].ammo).toBe(1);
    expect(advance(c,pending.state,[null,null]).events).toContainEqual({kind:'reload',side:0,time:4000,due:3960});
    const last=initial(c);
    last.time=58000;last.fighters[0].ammo=1;last.fighters[1].ammo=2;
    last.fighters[0].reloadDue=58080;last.fighters[1].reloadDue=58081;
    const final=advance(c,last,[null,null]);
    expect(final.events[0]).toEqual({kind:'reload',side:0,time:58080,due:58080});
    expect(final.events.some(e=>e.kind==='reload'&&e.side===1)).toBe(false);
    expect(final.state.result).toBe('draw');
  });
  it('locks all Core channels, keeps perception, and does not unlock on the cancellation boundary',()=>{
    const c=configure(12,'objective-duel'), i=initial(c);
    i.fighters[0].position=c.core.position;
    i.fighters[1].position=center(32);
    const first=advance(c,i,oneSide({core:'start'}));
    expect(first.state.core?.channel?.started).toBe(0);
    expect(first.state.fighters[0].current).toBeTruthy();
    const second=advance(c,first.state,oneSide({...steer,core:'cancel',jump:true,reload:true,attack:'standard',posture:'crouch'}));
    expect(second.receipts[0].filter(r=>r.accepted).map(r=>r.channel)).toEqual(['core']);
    expect(second.state.core?.channel).toBeUndefined();
    const moved=advance(c,second.state,oneSide(steer));
    expect(moved.state.fighters[0].position).not.toEqual(first.state.fighters[0].position);
  });
  it('restores fresh contact after respawn, hides unobserved Core activity, and filters attack outcome locations',()=>{
    const c=configure(12,'score-deathmatch'), i=initial(c);
    i.fighters[0].hp=0;i.respawnAt=[100,null];i.fighters[1].position=center(31);
    const frame=advance(c,i,[null,null]);
    expect(frame.events.filter(e=>'side' in e&&e.side===0).map(e=>e.kind)).toEqual(['respawn','contact']);
    expect(frame.state.fighters[0]).toMatchObject({hp:100,ammo:4,life:2});
    const d=configure(89,'objective-duel'), active=initial(d);
    active.core!.channel={side:1,started:0};
    expect(observation(d,active,0).match.progress).toBeNull();
    const v=observation(c,frame.state,0);
    const allowed=feedback([{kind:'attack',attack:'standard',side:0,time:100,due:100,damage:0,from:center(1),to:center(8)}],[],v,0);
    expect(allowed[0].data).toEqual({damage:0,attack:'standard'});
  });
  it('reconstructs a V6 replay and rejects event changes without changing historical V5',()=>{
    const r=record(configure(12,'objective-duel'),'manual-sandbox',()=>[null,null]);
    expect(r.final).toMatchObject({time:58080,result:'sand',reason:'activation-prevented'});
    expect(load(structuredClone(r)).recording).toEqual(r);
    r.observations.at(-1)![1]=[];
    expect(()=>load(r)).toThrow();
    expect(oldLoad(JSON.parse(readFileSync('evidence/gameplay-v25/ordinary-score.json','utf8'))).recording.final.result).toBe('sand');
  });
  it('emits the same authorized packet and receipts as manual input, including a conditional alternative',()=>{
    const c=configure(12,'elimination'), i=initial(c);
    const packet:Packet={movement:{kind:'goal',gait:'walk',to:{x:i.fighters[0].position.x+3700,y:i.fighters[0].position.y+96}},
      jump:true,facing:{x:1,y:1}};
    const input={version:1,expiresInMs:3000,stages:[{forMs:2000,packet:{attack:'standard'},when:'has-contact',alternative:packet}]};
    const result=execute(authorize(parsePlan(input,c),0),observation(c,i,0));
    expect(result.packet).toEqual(packet);
    expect(advance(c,i,[result.packet,null])).toEqual(advance(c,i,oneSide(packet)));
    expect(()=>parsePlan(plan({movement:{kind:'goal',gait:'walk',to:{x:-1,y:20}}}),c)).toThrow();
    expect(()=>parsePlan({...input,arbitrary:'code'},c)).toThrow();
  });
  it('reports exhausted inference as a partial technical interruption and preserves authorized waits',async()=>{
    const c=configure(120,'score-deathmatch');
    const timeout=new AbortController();
    const views:unknown[]=[];
    const run=await runTrial(c,[coach,coach],async view=>{views.push(view);return plan({},4500);},'lifecycle',timeout.signal);
    expect(views).toHaveLength(20);
    expect(run.recording.interruption).toMatchObject({reason:'budget'});
    expect(run.recording.final.time).toBeGreaterThanOrEqual(40*second);
    expect(run.recording.final.result).toBeNull();
    expect(load(run.recording).recording.interruption).toEqual(run.recording.interruption);
    const rejected=await runTrial(c,[coach,coach],async()=>({invalid:true}),'eight-seconds',timeout.signal);
    expect(rejected.recording.interruption).toMatchObject({reason:'provider'});
    expect(rejected.recording.final.tick).toBe(0);
  });
  it('sends compatible memory and retains timestamped contact events as history without leaking seed',()=>{
    const c=configure(827193,'objective-duel'), i=initial(c), v=observation(c,i,0);
    const prompt=strategicPrompt(c,0,{...v,time:9000},{...coach,memory:{revision:3,rulesVersion:c.rulesVersion,lessons:['A local lesson']}},
      [{kind:'contact',time:1000,data:{visible:true}}],0);
    expect(prompt.events[0]).toMatchObject({historical:true,time:1000});
    expect(prompt.memory?.revision).toBe(3);
    expect(JSON.stringify(prompt)).not.toContain('827193');
    expect(strategicPrompt(c,0,v,{...coach,memory:{revision:1,rulesVersion:'arcade-v2.5',lessons:['Old']}},[],0).memory).toBeNull();
  });
  it('stops an expired movement lease and reasserts explicitly authorized held steering after a blocker clears',()=>{
    const c=configure(12,'elimination'), i=initial(c);
    i.fighters[0].position={x:19000,y:20790};i.fighters[1].position={x:21100,y:20790};
    const p:Packet={movement:{kind:'steer',gait:'walk',direction:{x:1,y:0}}};
    const execution=authorize(parsePlan(plan(p,120),c),0);
    const input=motionLease(execute(execution,observation(c,i,0)),execution,observation(c,i,0),false);
    const blocked=advance(c,i,oneSide(input.packet!));
    expect(blocked.events).toContainEqual({kind:'collision',time:100,side:0,with:'agent'});
    const v=observation(c,blocked.state,0);
    const continued=motionLease(execute(execution,v),execution,v,input.motion);
    expect(continued.packet).toEqual(p);
    const moving=advance(c,blocked.state,[continued.packet,{movement:{kind:'steer',gait:'run',direction:{x:1,y:0}}}]);
    expect(moving.state.fighters[0].position.x).toBeGreaterThan(i.fighters[0].position.x);
    const later=observation(c,{...moving.state,time:400},0);
    const expired=motionLease(execute(execution,later),execution,later,continued.motion);
    expect(expired.packet).toEqual({movement:{kind:'stop'}});
  });
});
