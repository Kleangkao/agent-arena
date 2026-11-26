import {point, type Frame, type Plan, type Side} from './game';

export function authorizedOrders(plan:Plan,previous?:Plan){
 const movement:number[]=[],pulse:number[]=[],link:number[]=[];
 let changed=0;
 for(const [slot,order] of plan.orders.entries()){
  const [route,action]=order.split('/');
  if(route!=='-')movement.push(slot+1);
  if(action==='pulse')pulse.push(slot+1);
  if(action==='link')link.push(slot+1);
  if(previous&&order!==previous.orders[slot])changed++;
 }
 return {movement,pulse,link,changed:previous?changed:undefined};
}

export function executionSummary(start:Frame,frames:Frame[],side:Side){
 const moved=new Set<number>(),blocked=new Set<number>();
 let pulses=0,defeats=0,returns=0;
 let prior=start;
 for(const frame of frames){
  for(const [i,unit] of frame.units.entries()){
   if(unit.side!==side)continue;
   const before=prior.units[i];
   if(!before.hp&&unit.hp)returns++;
   if(before.hp&&!unit.hp)defeats++;
   // A return can replace the frame position after pulses, so only attribute
   // a pulse to a unit that was active before this frame.
   if(!before.hp)continue;
   const [x,y]=point(unit.at),[ox,oy]=point(before.at);
   if((unit.x??x)!==(before.x??ox)||(unit.y??y)!==(before.y??oy))moved.add(unit.slot+1);
   if(unit.blocked)blocked.add(unit.slot+1);
   pulses+=frame.shots.filter(shot=>shot.fromX===undefined?shot.from===unit.at:
    shot.fromX===unit.x&&shot.fromY===unit.y).length;
  }
  prior=frame;
 }
 return {moved:[...moved].sort((a,b)=>a-b),blocked:[...blocked].sort((a,b)=>a-b),pulses,defeats,returns,
  points:prior.score[side]-start.score[side]};
}

export function coreTransitions(start:Frame,frames:Frame[]){
 const events:string[]=[];
 let previous=start.objective;
 for(const frame of frames){
  const next=frame.objective;
  const site=(next??previous)?.site===1?'South':'North';
  if(next?.phase==='countdown'&&previous?.phase==='activate')events.push(`${site} Core activated`);
  if(next?.phase==='disable'&&frame.terminal==='sand')events.push(`${site} Core disabled`);
  else if(next&&next.phase!=='countdown'&&(next.phase!==previous?.phase||next.actor!==previous.actor||next.site!==previous.site))
   events.push(`${site} ${next.phase==='activate'?'activation':'disable'} started`);
  if(previous?.phase==='activate'&&!next||previous?.phase==='disable'&&next?.phase==='countdown'&&next.remaining>0)
   events.push(`${site} ${previous.phase==='activate'?'activation':'disable'} reset`);
  previous=next;
 }
 return events;
}

export function territoryTransitions(frames:Frame[]){
 return frames.flatMap(frame=>frame.territory?.flatMap((site,index)=>
  site.owner!==null&&site.changedAt===frame.tick?
   [{tick:frame.tick,site:index===0?'North':'South',owner:site.owner}]:[])??[]);
}
