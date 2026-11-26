import {
 map, point, width, height, sites, windowTicks, maxTicks, winScore, parsePlan, territoryRules,
 type Frame, type Unit, type Plan, type Pair, type Shot, type Territory,
} from './game.js';

const scale=256, step=64, body=88;
export const tdmTarget=8;
export const objectiveRules={activate:3,disable:3,countdown:10};
const cell=(x:number,y:number)=>x+y*width;
const square=(x:number,y:number)=>x*x+y*y;
const walkable=(x:number,y:number)=>map[y]?.[x]!==undefined&&map[y][x]!=='#';
const nearest=(x:number,y:number)=>cell(Math.floor((x+scale/2)/scale),Math.floor((y+scale/2)/scale));
const position=(u:Unit)=>{const [x,y]=point(u.at);return [Math.round((u.x??x)*scale),Math.round((u.y??y)*scale)] as const;};
const center=(at:number)=>point(at).map(n=>n*scale);
const neighbors=new Map<number,number[]>();
const fields=new Map<number,Int16Array>();
function field(goal:number,occupied?:Set<number>){
 const cached=!occupied&&fields.get(goal);
 if(cached)return cached;
 const distances=new Int16Array(width*height).fill(-1), queue=[goal];
 distances[goal]=0;
 for(let i=0;i<queue.length;i++){
  const at=queue[i];
  let next=neighbors.get(at);
  if(!next){
   const [x,y]=point(at);
   next=[[x+1,y],[x,y-1],[x-1,y],[x,y+1]].filter(([a,b])=>walkable(a,b)).map(([a,b])=>cell(a,b));
   neighbors.set(at,next);
  }
  for(const n of next)if(distances[n]===-1&&!occupied?.has(n)){
   distances[n]=distances[at]+1;queue.push(n);
  }
 }
 if(!occupied)fields.set(goal,distances);
 return distances;
}
function visible(a:Unit,b:Unit){
 const [x,y]=position(a),[u,v]=position(b),dx=u-x,dy=v-y;
 for(let row=Math.floor((Math.min(y,v)+scale/2)/scale);row<=Math.floor((Math.max(y,v)+scale/2)/scale);row++)
  for(let col=Math.floor((Math.min(x,u)+scale/2)/scale);col<=Math.floor((Math.max(x,u)+scale/2)/scale);col++){
   if(walkable(col,row))continue;
   const interval=(origin:number,delta:number,grid:number)=>{
    const lo=grid*scale-scale/2-origin,hi=lo+scale;
    return !delta?lo<=0&&hi>=0?[-Infinity,Infinity]:[Infinity,-Infinity]:
     delta>0?[lo/delta,hi/delta]:[hi/delta,lo/delta];
   };
   const [lx,hx]=interval(x,dx,col),[ly,hy]=interval(y,dy,row);
   if(Math.max(lx,ly,0)<=Math.min(hx,hy,1))return false;
  }
 return true;
}

export function moveUnits(frame:Frame,goals:Array<number|null>):Unit[]{
 // Center-to-center navigation keeps the body clear of tile-aligned wall corners.
 // Three fixed-point substeps per snapshot preserve intermediate authoritative positions.
 let units=frame.units;
 const progressed=new Set<number>();
 for(let sub=0;sub<3;sub++){
  const positions=units.map(position);
  const proposals=units.map((unit,i)=>{
   const [x,y]=positions[i];
   const stay={x,y,edge:unit.edge};
   if(!unit.hp||goals[i]===null)return stay;
   const goal=goals[i]!;
   const here=nearest(x,y);
   const [cx,cy]=center(here);
   const occupied=new Set(units.flatMap((other,j)=>j!==i&&other.hp?
    other.edge!==undefined?[other.at,other.edge]:[other.at]:[]));
   let edge=unit.edge;
   if(edge===undefined||(x===cx&&y===cy)||unit.blocked>=2&&occupied.has(edge)){
    if(x!==cx||y!==cy)edge=unit.blocked>=2&&unit.anchor!==undefined?unit.anchor:edge??here;
    else {
     if(here===goal)return stay;
     const route=field(goal);
     const available=(neighbors.get(here)??[]).filter(n=>!occupied.has(n));
     const rank=(n:number)=>{
      const delta=(n-here)*(unit.side?-1:1);
      return delta===1?0:delta===-width?1:delta===-1?2:3;
     };
     const select=(cost:Int16Array)=>available.filter(n=>cost[n]>=0&&(cost[here]<0||cost[n]<cost[here]))
      .sort((a,b)=>cost[a]-cost[b]||rank(a)-rank(b))[0];
     edge=select(route);
     if(edge===undefined&&unit.blocked>=2&&!occupied.has(goal))edge=select(field(goal,occupied));
     if(edge===undefined)return stay;
    }
   }
   const [tx,ty]=center(edge);
   const nx=x+Math.sign(tx-x)*Math.min(step,Math.abs(tx-x)),ny=y+Math.sign(ty-y)*Math.min(step,Math.abs(ty-y));
   if(positions.some(([ox,oy],j)=>j!==i&&units[j].hp&&square(nx-ox,ny-oy)<body*body))return stay;
   return {x:nx,y:ny,edge};
  });
  const allowed=proposals.map(({x,y},i)=>x!==positions[i][0]||y!==positions[i][1]);
  const count=units.length/2;
  const rank=(i:number)=>(units[i].slot-(frame.tick+sub)%count+count)%count;
  for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
   if(!allowed[i]||!allowed[j])continue;
   const sameEdge=proposals[i].edge===proposals[j].edge;
   if(!sameEdge&&square(proposals[i].x-proposals[j].x,proposals[i].y-proposals[j].y)>=body*body)continue;
   if(units[i].side!==units[j].side)allowed[i]=allowed[j]=false;
   else allowed[rank(i)<rank(j)?j:i]=false;
  }
  units=units.map((unit,i)=>{
   const p=proposals[i];
   if(!allowed[i])return unit;
   progressed.add(i);
   const at=nearest(p.x,p.y),[cx,cy]=center(at);
   return {...unit,x:p.x/scale,y:p.y/scale,at,edge:p.edge,anchor:p.x===cx&&p.y===cy?at:unit.anchor??unit.at};
  });
 }
 return units.map((unit,i)=>({...unit,blocked:unit.hp&&goals[i]!==null&&!progressed.has(i)&&!arrived(unit,goals[i]!)?unit.blocked+1:0}));
}

const arrived=(unit:Unit,goal:number)=>{
 const [x,y]=position(unit),[tx,ty]=center(goal);
 return x===tx&&y===ty;
};
const gap=(a:Unit,b:Unit)=>{
 const [x,y]=position(a),[p,q]=position(b);
 return square(x-p,y-q);
};
export function pulseTarget(units:Unit[],unit:Unit){
 return units.map((target,id)=>({target,id,dist:gap(unit,target)})).filter(({target,dist})=>
  target.side!==unit.side&&target.hp&&dist<=(4*scale)**2&&visible(unit,target))
  .sort((a,b)=>a.dist-b.dist||a.target.slot-b.target.slot)[0];
}
const inSite=(unit:Unit,index:number)=>{
 const [x,y]=position(unit),[sx,sy]=sites[index];
 return Math.max(Math.abs(x-sx*scale),Math.abs(y-sy*scale))<=scale*1.5;
};

function updateTerritory(site:Territory,occupancy:Territory['occupancy'],tick:number):Territory{
 if(occupancy==='contested')return {...site,occupancy};
 if(occupancy===null||occupancy===site.owner)return {...site,occupancy,claimant:null,progress:0};
 const progress=occupancy===site.claimant?site.progress+1:1;
 return progress>=territoryRules.captureTicks?{owner:occupancy,occupancy,claimant:null,progress:0,changedAt:tick}:
  {...site,occupancy,claimant:occupancy,progress};
}

export function continuousWindow(start:Frame,raw:Pair<Plan>):Frame[]{
 const plans=[parsePlan(raw[0],start,0),parsePlan(raw[1],start,1)];
 const orders:Array<{action?:string;route:number[]}>=start.units.map(({side,slot})=>{
  const [path,action]=plans[side].orders[slot].split('/');
  return {action,route:path==='-'?[]:path.split('>').map(mark=>{const [x,y]=mark.split(',').map(Number);return cell(x,y);})};
 });
 let frame=start;
 const frames:Frame[]=[];
 do {
  const tick=frame.tick+1;
  const goals=frame.units.map((unit,i)=>{
   if(unit.hp&&orders[i].route.length&&arrived(unit,orders[i].route[0]))orders[i].route.shift();
   return unit.hp?orders[i].route[0]??null:null;
  });
  const units=moveUnits(frame,goals);
  const shots:Shot[]=[];
  const damage=new Map<number,number>();
  if(tick%2===0)for(const [i,unit] of units.entries()){
   if(!unit.hp||((frame.mode!=='relay'||frame.territory)&&orders[i].action!=='pulse'))continue;
   const found=pulseTarget(units,unit);
   if(!found)continue;
   const {target,id}=found;
   const [x,y]=point(target.at),amount=map[y][x]==='+'?10:20;
   shots.push({from:unit.at,to:target.at,damage:amount,fromX:unit.x,fromY:unit.y,toX:target.x,toY:target.y});
   damage.set(id,(damage.get(id)??0)+amount);
  }
  const score:Pair<number>=[...frame.score];
  const control=sites.map((_,i)=>{
   const present=([0,1] as const).filter(side=>units.some(unit=>unit.side===side&&unit.hp&&inSite(unit,i)));
   return present.length===2?'contested' as const:present[0]??null;
  });
  for(const [i,amount] of damage){
   const unit=units[i];
   unit.hp=Math.max(0,unit.hp-amount);
   if(unit.hp===0&&frame.mode==='tdm'){
    score[1-unit.side]++;unit.respawn=tick+4;
   }
  }
  if(frame.mode==='tdm')for(const unit of units){
   if(unit.hp||unit.respawn===undefined||unit.respawn>tick)continue;
   const [x,y]=point(unit.spawn!);
   if(units.some(u=>u.hp&&gap(u,{...unit,x,y})<(scale*1.3)**2))continue;
   Object.assign(unit,{hp:100,x,y,at:unit.spawn,edge:undefined,anchor:unit.spawn,respawn:undefined});
   const i=units.indexOf(unit);
   orders[i].action=undefined;orders[i].route=[];
  }
  let objective=frame.objective,terminal:Frame['terminal'];
  let territory=frame.territory;
  if(frame.mode==='relay')for(const [i,state] of control.entries()){
   if(territory){
    const alive=([0,1] as const).filter(side=>units.some(unit=>unit.side===side&&unit.hp&&inSite(unit,i)));
    control[i]=alive.length===2?'contested':alive[0]??null;
    continue;
   }
   if(typeof state==='number'&&units.some(unit=>unit.side===state&&unit.hp&&inSite(unit,i))&&
      !units.some(unit=>unit.side!==state&&unit.hp&&inSite(unit,i)))score[state]++;
   else {
    const alive=([0,1] as const).filter(side=>units.some(unit=>unit.side===side&&unit.hp&&inSite(unit,i)));
    if(alive.length===1)score[alive[0]]++;
    control[i]=alive.length===2?'contested':alive[0]??null;
   }
  }
  if(territory)territory=territory.map((site,i)=>{
   const next=updateTerritory(site,control[i],tick);
   if(next.owner!==null&&next.occupancy!=='contested')score[next.owner]+=territoryRules.pointsPerTick;
   return next;
  });
  if(frame.mode==='bomb'){
   const armed=objective?.phase==='countdown'||objective?.phase==='disable';
   const actorSide=armed?1:0;
   const actor=units.findIndex((unit,i)=>unit.side===actorSide&&unit.hp&&orders[i].action==='link'&&goals[i]===null&&
    !damage.has(i)&&sites.some((_,site)=>inSite(unit,site)&&(!armed||site===objective!.site)));
   const site=armed?objective!.site:actor<0?-1:sites.findIndex((_,i)=>inSite(units[actor],i));
   const progress=actor<0?0:objective?.actor===actor&&objective?.site===site?objective.progress+1:1;
   const remaining=armed?objective!.remaining-1:Math.max(0,maxTicks-tick);
   if(armed){
    objective={site,phase:actor<0?'countdown':'disable',progress,remaining,actor:actor<0?undefined:actor};
    if(progress>=objectiveRules.disable)terminal='sand';
    else if(remaining<=0||!units.some(u=>u.side===1&&u.hp))terminal='blue';
   }else if(progress>=objectiveRules.activate){
    objective={site,phase:'countdown',progress:0,remaining:objectiveRules.countdown};
   }else{
    objective=actor<0?undefined:{site,phase:'activate',progress,remaining,actor};
    if(!units.some(u=>u.side===0&&u.hp)||tick>=maxTicks)terminal='sand';
    else if(!units.some(u=>u.side===1&&u.hp))terminal='blue';
   }
  }else{
   const alive=([0,1] as const).map(side=>units.some(unit=>unit.side===side&&unit.hp));
   if(frame.mode==='relay'&&(!alive[0]||!alive[1]))terminal=alive[0]?'blue':alive[1]?'sand':'draw';
   if(!terminal&&(tick>=(territory?territoryRules.maxTicks:maxTicks)||
      Math.max(...score)>=(territory?territoryRules.winScore:frame.mode==='tdm'?tdmTarget:winScore)))
    terminal=score[0]===score[1]?'draw':score[0]>score[1]?'blue':'sand';
  }
  frame={...frame,tick,units,score,control,shots,goals,objective,terminal,...(territory?{territory}:{})};
  frames.push(frame);
 }while(frames.length<windowTicks&&!frame.terminal);
 return frames;
}
