import {authorize,execute,motionLease,parsePlan,type Execution,type View} from './controller.js';
import {second,type Config,type Side} from './config.js';
import {moveToward,within,type Packet} from './game.js';
import {unit} from '../v23/space.js';

export type Style='mobile'|'steady';
export function baselineDevelopmentPlan(view:View,side:Side,style:Style,policySeed:number) {
  const {agent,current,historical,match,legal}=view;
  const observed=current??historical;
  const focused=match.role==='Activator'&&match.phase==='pending'||match.role==='Defender'&&match.phase==='active';
  const site=match.site;
  const middle={x:(side===0?4:5)*unit,y:3.5*unit};
  const packet:Packet={};
  if(match.progress?.by==='self') return {version:1,expiresInMs:5500,stages:[{forMs:4000,packet}]};
  if (legal.core) packet.core='start';
  else if (legal.reload&&agent.ammo<=(style==='steady'?1:0)) packet.reload=true;
  else if (legal.precision&&style==='steady') packet.attack='precision';
  else if (legal.standard) {
    if(style==='steady'&&agent.moving) packet.movement={kind:'stop'};
    else packet.attack='standard';
  } else if(legal.move&&agent.attackIn===null) {
    const to=focused&&site?{x:site.x+(side===0?-1:1)*1800,y:site.y}:
      observed?.position??{x:middle.x+(side===0?1:-1)*((policySeed>>>0)%3)*180,y:middle.y};
    if(to.x!==agent.position.x||to.y!==agent.position.y)
      packet.movement={kind:'goal',gait:style==='mobile'&&!observed?'run':'walk',to};
  }
  return {version:1,expiresInMs:8000,stages:[{forMs:packet.core?3200:packet.attack?800:packet.reload?1400:450,packet}]};
}
export function previousDevelopmentPlan(view:View,side:Side,style:Style,policySeed:number) {
  const {agent,current,legal,match}=view;
  const base=baselineDevelopmentPlan(view,side,style,policySeed);
  const {packet}=base.stages[0];
  if(packet.core||match.progress?.by==='self') return base;
  const stop={kind:'stop'} as const;
  const focused=match.role==='Activator'&&match.phase==='pending'||match.role==='Defender'&&match.phase==='active';
  const objectiveApproach=focused&&match.site&&match.siteRadius!==null&&legal.move&&
    !within(agent.position,match.site,match.siteRadius)?{kind:'goal',gait:'walk',to:{
      x:match.site.x+(side===0?-1:1)*1800,y:match.site.y}} as const:undefined;
  if(packet.reload||agent.reloadIn!==null) {
    delete packet.movement;
    if(current&&legal.move&&within(agent.position,current.position,unit*1.5)) {
      packet.movement={kind:'steer',gait:'walk',direction:{
        x:Math.sign(agent.position.x-current.position.x),y:Math.sign(agent.position.y-current.position.y)}};
    } else if(objectiveApproach) packet.movement=objectiveApproach;
    else if(agent.moving) packet.movement=stop;
  } else if(objectiveApproach) {
    packet.movement=objectiveApproach;
    if(legal.standard) packet.attack='standard';
  } else if(legal.standard) {
    packet.attack=style==='steady'&&legal.stopAndPrecision?'precision':'standard';
    if(agent.moving) packet.movement=stop;
  }
  return base;
}
export function developmentPlan(view:View,side:Side,style:Style,policySeed:number) {
  const plan=previousDevelopmentPlan(view,side,style,policySeed);
  const move=plan.stages[0].packet.movement;
  const target=view.current?.position;
  if(move?.kind==='goal'&&target&&move.to.x===target.x&&move.to.y===target.y) {
    // Keep visible pursuit goals short of the rival's footprint.
    move.to=moveToward(target,view.agent.position,2*unit);
  }
  return plan;
}
type PlanAuthor=(view:View,side:Side,style:Style,policySeed:number)=>ReturnType<typeof developmentPlan>;
export function developmentController(config:Config,side:Side,style:Style,policySeed:number,author:PlanAuthor=developmentPlan) {
  let execution:Execution|undefined, last=-Infinity, life=0, motion=false, attackable=false;
  let diagnostic:(ReturnType<typeof execute>&{plan:Execution['plan'];stage:number;active?:Packet;expires:number;input:Packet|null})|null=null;
  const next=(view:View):Packet|null=>{
    if(!view.agent.hp) {execution=undefined;motion=false;attackable=false;diagnostic=null;return null;}
    if(!execution||view.agent.life!==life||view.time-last>=second*.45||
      (author!==baselineDevelopmentPlan&&!attackable&&view.legal.standard)) {
      execution=authorize(parsePlan(author(view,side,style,policySeed),config),view.time);
      life=view.agent.life;
      last=view.time;
    }
    attackable=view.legal.standard;
    const selection=execute(execution,view);
    const input=motionLease(selection,execution,view,motion);
    motion=input.motion;
    diagnostic={plan:execution.plan,stage:execution.index,active:execution.active,expires:execution.expires,
      ...selection,input:input.packet};
    return input.packet;
  };
  return Object.assign(next,{diagnostics:()=>diagnostic});
}
