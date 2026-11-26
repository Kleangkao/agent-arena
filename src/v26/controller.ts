import {z} from 'zod';
import {inside} from '../v23/space.js';
import {packetSchema,type Packet,type Event,type Receipt,observation} from './game.js';
import {revision,second,type Config,type Side} from './config.js';

export const planLimits={stages:4,maxStageMs:15000,maxPlanMs:20000,eventBuffer:16} as const;
export const condition=z.enum(['has-contact','no-contact','ammo-empty','ammo-ready','grounded','action-finished','at-goal','pending','active',
  'can-attack','in-reach','can-reload','core-available','movement-blocked','core-idle']);
export const stage=z.object({
  forMs:z.number().int().min(34).max(planLimits.maxStageMs),
  packet:packetSchema,
  when:condition.optional(),
  until:condition.optional(),
  alternative:packetSchema.optional(),
  interruptWhen:condition.optional(),
  repeat:z.object({everyMs:z.number().int().min(250).max(15000),count:z.number().int().min(2).max(12)}).strict().optional(),
}).strict();
export const planSchema=z.object({
  version:z.literal(1), expiresInMs:z.number().int().min(34).max(planLimits.maxPlanMs),
  stages:z.array(stage).min(1).max(8),
}).strict();
type Plan=z.infer<typeof planSchema>;
export type View=ReturnType<typeof observation>;
export type Coach={text:string;revision:string;memory?:{rulesVersion:string;revision:number;lessons:string[]}};
export type Feedback={kind:string;time:number;data?:unknown};
export function parsePlan(value:unknown,c:Config,maxStages:number=planLimits.stages) {
  const plan=planSchema.parse(value);
  const vectorsOk=(p:Packet)=>{
    const move=p.movement;
    return (move?.kind!=='goal'||inside(move.to)) && [p.facing,move?.kind==='steer'?move.direction:undefined].every(v=>
      !v||((v.x||v.y)&&Math.max(Math.abs(v.x),Math.abs(v.y))<=c.geometry.directionLimit));
  };
  if(!Number.isSafeInteger(maxStages)||maxStages<1||maxStages>8||plan.stages.length>maxStages||
    plan.stages.some(s=>!vectorsOk(s.packet)||s.when==='at-goal'||s.interruptWhen==='at-goal'||
      (s.until==='at-goal'&&s.packet.movement?.kind!=='goal'&&s.alternative?.movement?.kind!=='goal')||
      (s.alternative&&(!s.when||!vectorsOk(s.alternative)))))
    throw Error('Invalid bounded plan');
  return plan;
}
export function matches(c:NonNullable<Plan['stages'][number]['when']>,v:View,movementBlocked=false) {
  switch(c) {
    case 'has-contact':return !!v.current;
    case 'no-contact':return !v.current;
    case 'ammo-empty':return !v.agent.ammo;
    case 'ammo-ready':return v.agent.ammo>0;
    case 'grounded':return v.agent.airFor===null;
    case 'can-attack':return v.legal.standard;
    case 'in-reach':return v.currentInReach;
    case 'can-reload':return v.legal.reload;
    case 'core-available':return v.legal.core;
    case 'core-idle':return v.match.role!==null&&v.match.progress?.by!=='self';
    case 'movement-blocked':return movementBlocked;
    case 'action-finished':return v.agent.attackIn===null&&v.agent.reloadIn===null;
    case 'at-goal':return false; // Goal completion uses the position authorized by the selected branch.
    case 'pending':case 'active':return v.match.phase===c;
  }
}
type Branch='primary'|'alternative';
export type Execution={plan:Plan;expires:number;index:number;active?:Packet;branch?:Branch;sentBranches:Set<Branch>;
  stageTime:number;sent:number;nextInput:number};
export const authorize=(plan:Plan,time:number):Execution=>({plan,expires:time+plan.expiresInMs*second/1000,
  index:0,stageTime:time,sent:0,nextInput:time,sentBranches:new Set()});
type Selection={packet:Packet|null;status:'executing'|'waiting'|'completed'|'expired'|'invalidated';reason?:string};
export function execute(e:Execution,v:View,guardMatches?:(stageIndex:number)=>boolean|undefined,movementBlocked=false):Selection {
  if(!v.agent.hp) return {packet:null,status:'invalidated',reason:'defeat'};
  if(v.time>=e.expires) return {packet:null,status:'expired',reason:'plan-deadline'};
  let reason:string|undefined;
  while(e.index<e.plan.stages.length) {
    const s=e.plan.stages[e.index];
    if(s.interruptWhen&&matches(s.interruptWhen,v,movementBlocked)) return {packet:null,status:'invalidated',reason:s.interruptWhen};
    const goal=e.active?.movement;
    const completed=e.sent&&s.until&&v.time>e.stageTime&&(s.until==='at-goal'?
      goal?.kind==='goal'&&goal.to.x===v.agent.position.x&&goal.to.y===v.agent.position.y:matches(s.until,v,movementBlocked));
    if(completed||v.time-e.stageTime>=s.forMs*second/1000) {
      reason=completed?s.until:'stage-deadline';
      e.index++;e.sent=0;e.active=undefined;e.branch=undefined;e.sentBranches.clear();e.stageTime=v.time;e.nextInput=v.time;
      continue;
    }
    const branch=s.when&&!(guardMatches?.(e.index)??matches(s.when,v,movementBlocked))?'alternative':'primary';
    const packet=branch==='primary'?s.packet:s.alternative;
    const changed=e.branch!==branch;
    e.branch=branch;
    if(!packet) {e.active=undefined;return {packet:null,status:'waiting',reason:'guard-unmet'};}
    if(changed&&e.sentBranches.has(branch)) {
      e.active=packet;
      return {packet:packet.movement?{movement:packet.movement}:null,status:'executing',reason:'branch-changed'};
    }
    if(!changed&&(!s.repeat||e.sent>=s.repeat.count||v.time<e.nextInput)) return {packet:null,status:'executing',reason};
    e.sentBranches.add(branch);
    e.sent++;e.active=packet;e.nextInput=v.time+(s.repeat?.everyMs??s.forMs)*second/1000;
    return {packet,status:'executing',reason:reason??(changed&&e.sent>1?'branch-changed':undefined)};
  }
  return {packet:null,status:'completed',reason};
}
export function motionLease(selection:ReturnType<typeof execute>|undefined,e:Pick<Execution,'active'>|undefined,view:View,hadMotion:boolean) {
  let packet=selection?.packet??null;
  const valid=selection?.status==='executing'||selection?.status==='waiting';
  const active=valid?e?.active?.movement:undefined;
  if(selection?.status==='executing'&&active?.kind==='steer'&&!view.agent.moving&&!packet?.movement)
    packet={...packet,movement:active};
  if(hadMotion&&view.agent.moving&&!active&&!packet?.movement) packet={...packet,movement:{kind:'stop'}};
  return {packet,motion:!!active&&active.kind!=='stop'};
}
export function feedback(events:Event[],receipts:Receipt[],current:View,side:Side):Feedback[] {
  const output:Feedback[]=[];
  for(const e of events) {
    if(e.kind==='terminal'||e.kind==='score'||(e.kind==='core'&&['activated','completed','disabled'].includes(e.action))) {
      output.push({kind:e.kind,time:e.time,data:e});continue;
    }
    if(e.side!==side) continue;
    if(e.kind==='attack') output.push({kind:'own-attack',time:e.time,data:{damage:e.damage,attack:e.attack}});
    else if(e.kind==='collision') output.push({kind:'collision',time:e.time});
    else output.push({kind:e.kind,time:e.time,data:e});
  }
  if(receipts.length) output.push({kind:'validation',time:current.time,data:receipts});
  return output;
}
export function strategicPrompt(config:Config,side:Side,view:View,coach:Coach,events:Feedback[],dropped:number,execution?:Execution) {
  const memory=coach.memory?.rulesVersion===revision?coach.memory:undefined;
  return {rulesVersion:revision,participant:config.participants[side],view,
    config:{equipmentRange:config.equipment.range,perceptionRange:config.perception.range,directionLimit:config.geometry.directionLimit,
      attackDuration:config.equipment.attackTime,reloadDuration:config.equipment.reloadTime,capacity:config.equipment.capacity,
      coreDuration:config.mode==='objective-duel'?config.core.channel:null,
      worldUnitsPerTile:config.geometry.unit,timeUnitsPerSecond:second},
    events:events.map(e=>e.kind==='contact'?{...e,historical:e.time<view.time}:e),dropped,
    planStatus:execution?{stage:execution.index,remaining:Math.max(0,execution.expires-view.time)}:null,
    coaching:{text:coach.text.slice(0,500),revision:coach.revision},
    memory:memory?{revision:memory.revision,lessons:memory.lessons.slice(0,3).map(l=>l.slice(0,160))}:null};
}
