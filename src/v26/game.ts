import {z} from 'zod';
import {draw, type Result} from '../v2/game.js';
import {agentsCollide,center,clearSight,equal,obstacles,openSegment,route,type Position,starts} from '../v23/space.js';
import {HEIGHT,WIDTH,walls,crates} from '../v2/yard.js';
import {other,sides,type Config,type Pair,type Side} from './config.js';

const position = z.object({x:z.number().int(),y:z.number().int()}).strict();
const gait = z.enum(['walk','run']);
export const packetSchema = z.object({
  movement:z.discriminatedUnion('kind',[
    z.object({kind:z.literal('stop')}).strict(),
    z.object({kind:z.literal('steer'),gait,direction:position}).strict(),
    z.object({kind:z.literal('goal'),gait,to:position}).strict(),
  ]).optional(),
  posture:z.enum(['upright','crouch']).optional(), facing:position.optional(), jump:z.literal(true).optional(),
  attack:z.enum(['standard','precision']).optional(), reload:z.literal(true).optional(),
  core:z.enum(['start','cancel']).optional(),
}).strict();
export type Packet = z.infer<typeof packetSchema>;
export type Inputs = Pair<Packet|null>;
export type Channel = keyof Packet;
type Gait = z.infer<typeof gait>;
type Motion = {gait:Gait;direction:Position} | {gait:Gait;path:Position[]};
type Attack = NonNullable<Packet['attack']>;
type Contact = {position:Position;time:number;life:number};
type Fighter = {
  position:Position; hp:number; ammo:number; life:number; posture:NonNullable<Packet['posture']>; facing:Position;
  motion?:Motion; airUntil?:number; firing?:{kind:Attack;due:number}; reloadDue?:number;
  current?:Contact; history?:Contact;
};
type Core = {phase:'pending'|'active'|'disabled'|'completed';deadline:number; channel?:{side:Side;started:number}};
export type State = {tick:number;time:number;fighters:[Fighter,Fighter];result:Result|null;reason:string|null;
  core?:Core;score?:[number,number];respawnAt?:[number|null,number|null]};
export type Receipt = {channel:Channel;accepted:boolean;reason?:string};
type Timed = {time:number;side:Side};
export type Event = Timed & (
  {kind:'attack';attack:Attack;damage:number;due:number;from:Position;to:Position} |
  {kind:'contact';visible:boolean;contact?:Contact} |
  {kind:'core';action:'started'|'cancelled'|'activated'|'disabled'|'completed'} |
  {kind:'score';total:number} |
  {kind:'reload';due:number} |
  {kind:'collision';with:'terrain'|'agent'} |
  {kind:'defeat'|'respawn'|'jump'|'land'}
) | {time:number;kind:'terminal';result:Result;reason:string};
export type Frame = {state:State;events:Event[];receipts:Pair<Receipt[]>};
const channels:readonly Channel[] = ['core','facing','posture','jump','movement','attack','reload'];
const team = (side:Side):Result => side ? 'sand' : 'blue';
const winner = ([a,b]:Pair<number>):Result => a === b ? 'draw' : a>b ? 'blue' : 'sand';
export const distance2 = (a:Position,b:Position) => (a.x-b.x)**2 + (a.y-b.y)**2;
export const within = (a:Position,b:Position,range:number) => distance2(a,b)<=range**2;
export function moveToward(from:Position,to:Position,budget:number):Position {
  const square = distance2(from,to);
  if (square<=budget**2) return to;
  const length = Math.ceil(Math.sqrt(square));
  return {x:from.x+Math.trunc((to.x-from.x)*budget/length),y:from.y+Math.trunc((to.y-from.y)*budget/length)};
}
const directionOk = ({x,y}:Position,limit:number) => (x!==0 || y!==0) && Math.abs(x)<=limit && Math.abs(y)<=limit;
const fresh = (c:Config,side:Side,life:number,at=starts[side]):Fighter =>
  ({position:at,life,hp:c.equipment.hp,ammo:c.equipment.capacity,posture:'upright',facing:{x:side?-1:1,y:0}});
export const maxTime = (c:Config) => c.mode==='score-deathmatch'?c.score.limit:c.mode==='objective-duel'?c.core.pending+c.core.active:c.elimination;
export const deadline = (c:Config,s:State) => s.core?.deadline ?? maxTime(c);
export const maxTicks = (c:Config) => c.mode==='objective-duel'?Math.ceil(c.core.pending/c.step)+Math.ceil(c.core.active/c.step):Math.ceil(maxTime(c)/c.step);
export const passive = (c:Config,a:Fighter,b:Fighter) => !!(a.hp && b.hp &&
  within(a.position,b.position,c.perception.range) && clearSight(a.position,b.position));
export const inReach = (c:Config,a:Fighter,b:Fighter) => within(a.position,b.position,c.equipment.range) && clearSight(a.position,b.position);
export function initial(c:Config):State {
  const fighters:[Fighter,Fighter] = [fresh(c,0,1),fresh(c,1,1)];
  const state:State = {tick:0,time:0,fighters,result:null,reason:null};
  if(c.mode==='objective-duel') state.core={phase:'pending',deadline:c.core.pending};
  if(c.mode==='score-deathmatch') {state.score=[0,0];state.respawnAt=[null,null];}
  refresh(c,state,state,[]);
  return state;
}
function refresh(c:Config, previous:State, state:State, events:Event[]) {
  for (const side of sides) {
    const you=state.fighters[side], rival=state.fighters[other(side)];
    const before=previous.fighters[side];
    const wasSeen=before.current && before.life===you.life && before.current.life===rival.life;
    if (passive(c,you,rival)) {
      you.current={position:rival.position,time:state.time,life:rival.life};
      delete you.history;
      if (!wasSeen) events.push({kind:'contact',side,time:state.time,visible:true,contact:you.current});
    } else {
      delete you.current;
      const history=before.current ?? before.history;
      if (you.hp && before.life===you.life && history && state.time-history.time<=c.perception.history) you.history=history;
      else delete you.history;
      if (wasSeen && you.hp) events.push({kind:'contact',side,time:state.time,visible:false});
    }
  }
}
const clearActions = (f:Fighter) => {
  delete f.motion; delete f.airUntil; delete f.reloadDue; delete f.firing;
};
function validate(c:Config,prev:State,side:Side,packet:Packet,next:Fighter) {
  const original=prev.fighters[side], rival=prev.fighters[other(side)], core=prev.core;
  const receipts:Receipt[]=[];
  const attempt=(channel:Channel,why?:string)=>receipts.push(why?{channel,accepted:false,reason:why}:{channel,accepted:true});
  for (const key of channels) {
    if (packet[key]===undefined) continue;
    if (!original.hp) {attempt(key,'defeated');continue;}
    if (key==='core') {
      if (packet.core==='cancel') attempt(key,core?.channel?.side===side?undefined:'no-own-interaction');
      else if (!core || core.channel || side!==(core.phase==='pending'?c.activator:other(c.activator))) attempt(key,'core-role-or-phase');
      else if ([packet.posture, packet.jump,packet.attack,packet.reload].some(Boolean) ||
        (packet.movement && packet.movement.kind!=='stop')) attempt(key,'core-conflicting-input');
      else if (original.airUntil || original.firing || original.reloadDue ||
        !within(original.position,c.core.position,c.core.radius)) attempt(key,'core-unavailable');
      else {delete next.motion;attempt(key);}
      continue;
    }
    if (key==='facing') {
      if (!directionOk(packet.facing!,c.geometry.directionLimit)) attempt(key,'invalid-direction');
      else {next.facing=packet.facing!;attempt(key);}
      continue;
    }
    if (core?.channel?.side===side || receipts.some(r=>r.channel==='core'&&r.accepted&&packet.core==='start')) {
      if(packet.core==='start' && packet.movement?.kind==='stop' && key==='movement') attempt(key);
      else attempt(key,'core-commitment');
      continue;
    }
    switch(key) {
      case 'posture':
        if (original.airUntil) attempt(key,'airborne');
        else { next.posture=packet.posture!; if(next.posture==='crouch'&&next.motion?.gait==='run') next.motion={...next.motion,gait:'walk'};attempt(key); }
        break;
      case 'jump':
        if (original.airUntil || original.firing?.kind==='precision') attempt(key,'jump-locked');
        else {next.airUntil=prev.time+c.step*c.locomotion.airTicks;attempt(key);}
        break;
      case 'movement': {
        const move=packet.movement!;
        if (move.kind==='stop') {delete next.motion;attempt(key);break;}
        if (original.firing?.kind==='precision') {attempt(key,'precision-lock');break;}
        if (move.gait==='run'&&next.posture==='crouch') {attempt(key,'crouched');break;}
        if (move.kind==='steer') {
          if (!directionOk(move.direction,c.geometry.directionLimit)) attempt(key,'invalid-direction');
          else {next.motion={gait:move.gait,direction:move.direction};attempt(key);}
          break;
        }
        if (equal(next.position,move.to)) {delete next.motion;attempt(key);break;}
        const path=openSegment(next.position,move.to)?[move.to]:route(next.position,move.to,c.geometry.routeEdges,side===1);
        if (!path) attempt(key,'unreachable-goal');
        else {next.motion={gait:move.gait,path};attempt(key);}
        break;
      }
      case 'attack':
        if (next.firing || next.reloadDue || !next.ammo) attempt(key,'equipment-busy-or-empty');
        else if (packet.attack==='precision'&&(next.motion||next.airUntil)) attempt(key,'precision-needs-still-grounded');
        else if (!original.current || !passive(c,original,rival)) attempt(key,'no-current-contact');
        else if (!inReach(c,original,rival)) attempt(key,'outside-equipment-geometry');
        else {next.ammo--;next.firing={kind:packet.attack!,due:prev.time+c.equipment.attackTime};attempt(key);}
        break;
      case 'reload':
        if (next.firing || next.reloadDue || next.ammo===c.equipment.capacity) attempt(key,'equipment-busy-or-full');
        else {next.reloadDue=prev.time+c.equipment.reloadTime;attempt(key);}
    }
  }
  return receipts;
}
export function preview(c:Config,s:State,side:Side,p:Packet) {
  return validate(c,s,side,packetSchema.parse(p),{...s.fighters[side]});
}
export function advance(c:Config,prev:State,inputs:Inputs):Frame {
  if (prev.result || prev.time>=deadline(c,prev) || !Array.isArray(inputs) || inputs.length!==2) throw Error('Invalid V2.6 step');
  const time=Math.min(prev.time+c.step,deadline(c,prev)), elapsed=time-prev.time;
  const state:State={...prev,time,tick:prev.tick+1,fighters:[{...prev.fighters[0]},{...prev.fighters[1]}],
    ...(prev.core?{core:{...prev.core}}:{}),...(prev.score?{score:[...prev.score],respawnAt:[...prev.respawnAt!]}:{})};
  const events:Event[]=[];
  const receipts = sides.map(side=>inputs[side]===null?[]:validate(c,prev,side,packetSchema.parse(inputs[side]),state.fighters[side])) as [Receipt[],Receipt[]];
  const accepted = (side:Side,key:Channel) => receipts[side].some(r=>r.channel===key&&r.accepted);
  for (const side of sides) {
    if (accepted(side,'jump')) events.push({kind:'jump',side,time});
    if (state.core && accepted(side,'core')) {
      if (inputs[side]?.core==='start') state.core.channel={side,started:prev.time}; else delete state.core.channel;
      events.push({kind:'core',action:inputs[side]?.core==='start'?'started':'cancelled',side,time});
    }
  }
  const origins=state.fighters.map(f=>f.position);
  const gaits=state.fighters.map(f=>f.motion?.gait);
  const targets=state.fighters.map((f,side)=>{
    const motion=f.motion;
    if (!motion) return f.position;
    const to='path' in motion?motion.path[0]:
      {x:f.position.x+motion.direction.x*c.geometry.unit,y:f.position.y+motion.direction.y*c.geometry.unit};
    const speed=c.locomotion[f.posture==='crouch'?'crouch':motion.gait];
    const target=moveToward(f.position,to,elapsed*speed);
    if (openSegment(f.position,target)) return target;
    events.push({kind:'collision',side:side as Side,time,with:'terrain'});
    delete f.motion;
    return f.position;
  });
  const blocked=state.fighters.every(f=>f.hp>0)&&agentsCollide(origins[0],targets[0],origins[1],targets[1]);
  for (const side of sides) {
    const f=state.fighters[side];
    if (blocked&&!equal(origins[side],targets[side])) {
      delete f.motion;events.push({kind:'collision',side,time,with:'agent'});
    } else {
      f.position=targets[side];
      if (f.motion&&'path' in f.motion&&equal(f.position,f.motion.path[0])) {
        if(f.motion.path.length>1) f.motion={...f.motion,path:f.motion.path.slice(1)};else delete f.motion;
      }
    }
    if (f.airUntil&&f.airUntil<=time) {delete f.airUntil;events.push({kind:'land',side,time});}
  }
  const damage=[0,0];
  for (const side of sides) {
    const f=state.fighters[side], rival=state.fighters[other(side)];
    if (f.firing&&f.firing.due<=time) {
      const {kind,due}=f.firing, {equipment:e}=c;
      const gait=equal(origins[side],f.position)?undefined:gaits[side];
      const mod=f.airUntil?'air':gait==='run'?'run':gait?f.posture==='crouch'?'crouchMoving':'walk':f.posture;
      const odds=e.odds[kind][within(f.position,rival.position,e.near)?0:1]+e.modifiers[mod];
      const roll=draw(c.seed&0x7fffffff,due,(side^(c.seed>>>31)) as Side);
      damage[other(side)]=rival.hp&&inReach(c,f,rival)&&roll<odds?e.damage[kind]:0;
      events.push({kind:'attack',attack:kind,side,time,due,damage:damage[other(side)],from:f.position,to:rival.position});
      delete f.firing;
    }
    if (f.reloadDue&&f.reloadDue<=time) {events.push({kind:'reload',due:f.reloadDue,side,time});f.ammo=c.equipment.capacity;delete f.reloadDue;}
  }
  const defeated:Side[]=[];
  for (const side of sides) {
    const f=state.fighters[side];
    if (f.hp>0 && (f.hp=Math.max(0,f.hp-damage[side]))===0) {
      defeated.push(side); clearActions(f); events.push({kind:'defeat',side,time});
    }
  }
  settle(c,state,events,defeated);
  refresh(c,prev,state,events);
  return {state,events,receipts};
}
function settle(c:Config,s:State,events:Event[],defeated:Side[]) {
  const time=s.time;
  const finish=(result:Result,reason:string)=>{
    if (s.core?.channel) {events.push({kind:'core',action:'cancelled',side:s.core.channel.side,time});delete s.core.channel;}
    s.result=result;s.reason=reason;s.fighters.forEach(clearActions);
    if (s.respawnAt) s.respawnAt=[null,null];
    events.push({kind:'terminal',result,reason,time});
  };
  if (s.core) {
    const core=s.core, activator=c.activator, defender=other(activator), active=core.phase==='active';
    if (!active&&!s.fighters[activator].hp&&!s.fighters[defender].hp) finish('draw','mutual-elimination');
    else if (!s.fighters[defender].hp) finish(team(activator),'elimination');
    else if (!active&&!s.fighters[activator].hp) finish(team(defender),'elimination');
    else if (core.channel&&time-core.channel.started>=c.core.channel) {
      delete core.channel;
      if (active) {core.phase='disabled';events.push({kind:'core',action:'disabled',side:defender,time});finish(team(defender),'core-disabled');}
      else {core.phase='active';core.deadline=time+c.core.active;events.push({kind:'core',action:'activated',side:activator,time});}
    } else if (time===core.deadline) {
      if (active) {core.phase='completed';events.push({kind:'core',action:'completed',side:activator,time});finish(team(activator),'core-completed');}
      else finish(team(defender),'activation-prevented');
    }
    return;
  }
  if (s.score&&s.respawnAt) {
    for (const side of defeated) {
      const scorer=other(side);s.respawnAt[side]=time+c.score.respawn;
      events.push({kind:'score',side:scorer,total:++s.score[scorer],time});
    }
    const result=winner(s.score);
    if (Math.max(...s.score)>=c.score.target) finish(result,result==='draw'?'simultaneous-target':'target-score');
    else if(time===c.score.limit) finish(result,result==='draw'?'equal-score':'score-clock');
    else for (const side of sides) {
      const due=s.respawnAt[side], rival=s.fighters[other(side)];
      if (due===null||due>time) continue;
      const at=c.score.spawnCells[side].map(center).find(p=>!rival.hp||!agentsCollide(p,p,rival.position,rival.position));
      if (at) {s.fighters[side]=fresh(c,side,s.fighters[side].life+1,at);s.respawnAt[side]=null;events.push({kind:'respawn',side,time});}
    }
    return;
  }
  if (defeated.length||time===c.elimination) finish(winner([s.fighters[0].hp,s.fighters[1].hp]),
    defeated.length===2?'mutual-elimination':defeated.length?'elimination':'health-clock');
}
// Public geometry. Walls and crates are blocked grid cells, with these exact world rectangles.
const yard={width:WIDTH,height:HEIGHT,walls,crates,obstacles};
export function observation(c:Config,s:State,side:Side) {
  const f=s.fighters[side], channel=s.core?.channel;
  const ownChannel=channel?.side===side;
  const visibleProgress=channel&&(ownChannel||f.current)?s.time-channel.started:null;
  const asOf = (at?:number) => at===undefined?null:Math.max(0,at-s.time);
  const legal=(p:Packet)=>!s.result&&preview(c,s,side,p).every(r=>r.accepted);
  return {time:s.time,environment:{...yard,version:c.mapVersion,unitsPerTile:c.geometry.unit,
    footprintRadius:c.geometry.radius,routeEdges:c.geometry.routeEdges},
    agent:{position:f.position,hp:f.hp,ammo:f.ammo,life:f.life,posture:f.posture,facing:f.facing,
    moving:!!f.motion,airFor:asOf(f.airUntil),reloadIn:asOf(f.reloadDue),attackIn:asOf(f.firing?.due)},
    current:f.current??null,historical:f.history??null,
    currentInReach:!!f.current&&within(f.position,f.current.position,c.equipment.range),
    match:{mode:c.mode,remaining:s.result?0:deadline(c,s)-s.time,score:s.score?[s.score[side],s.score[other(side)]]:null,
      target:s.score?c.score.target:null,role:s.core?(side===c.activator?'Activator':'Defender'):null,
      phase:s.core?.phase??null,site:s.core?c.core.position:null,siteRadius:s.core?c.core.radius:null,
      progress:visibleProgress===null?null:{by:ownChannel?'self':'opponent',elapsed:visibleProgress},
      victory:c.mode==='objective-duel'?'Pending: survivor wins, mutual defeat draws, or Defender wins at the deadline. Active: successful disable wins for Defender. Core completion or Defender defeat wins for Activator.':
        c.mode==='score-deathmatch'?'Each opposing defeat scores one. Higher score at the target or deadline wins. Equal scores then draw.':
          'Survivor wins, or higher health wins at the deadline. Equal health then draws.',
      respawnIn:asOf(s.respawnAt?.[side]??undefined)},
    legal:{standard:legal({attack:'standard'}),precision:legal({attack:'precision'}),
      stopAndPrecision:legal({movement:{kind:'stop'},attack:'precision'}),reload:legal({reload:true}),
      jump:legal({jump:true}),core:legal({core:'start'}),cancel:legal({core:'cancel'}),move:legal({movement:{kind:'steer',gait:'walk',direction:{x:1,y:0}}})}};
}
