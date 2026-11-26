import {pulseTarget} from '../src/squads/continuous.js';
import {map,sites,type Frame,type Plan,type Side} from '../src/squads/game.js';

export type SquadWindow = {start:Frame; frames:Frame[]; plan:Plan};
const position=(unit:Frame['units'][number])=>[unit.x,unit.y] as const;
export const blockedColumnsByRow=Object.fromEntries(map.flatMap((row,y)=>{
 const columns=Array.from(row).flatMap((tile,x)=>tile==='#'?[x]:[]);
 return columns.length?[[y,columns]]:[];
}));

// A symmetric set of selectable floor points, every cover cell and both site zones.
// IDs live in the provider interface only. A replay records the chosen coordinate.
const sampleColumns=[2,5,8,11,13,15,18,21,24];
const sampleRows=[1,4,7,10,13];
type Destination=[id:string,x:number,y:number,terrain:'floor'|'cover',site?:'North'|'South'];
const destinationId=(x:number,y:number)=>String.fromCharCode(65+y)+x;
const destinations:Destination[]=map.flatMap((row,y)=>Array.from(row)
 .flatMap<Destination>((tile,x)=>{
  const site=sites.findIndex(([sx,sy])=>Math.max(Math.abs(sx-x),Math.abs(sy-y))<=1);
  if(tile==='#'||site<0&&tile!=='+'&&!(sampleColumns.includes(x)&&sampleRows.includes(y)))return [];
  const destination:Destination=[destinationId(x,y),x,y,tile==='+'?'cover':'floor'];
  if(site>=0)destination.push(site===0?'North':'South');
  return [destination];
 }));
const destinationCells=new Map(destinations.map(([id,x,y])=>[id,`${x},${y}`]));
export const squadDestinations={
 columns:['id','x','y','terrain','site (only if inside its zone)'],
 options:destinations,
};

export function decodeSquadDestinations(input:unknown){
 if(typeof input!=='object'||input===null||!('orders' in input)||!Array.isArray(input.orders))return input;
 return {...input,orders:input.orders.map((order:unknown,slot)=>{
  if(typeof order!=='string')return order;
  if(!/^(?:-|[A-O]\d{1,2}(?:>[A-O]\d{1,2})?)(?:\/(?:link|pulse))?$/.test(order))
   throw Error(`Slot ${slot} must use an ID in destinations.options, two IDs joined by ">", or "-".`);
  const [path,action]=order.split('/');
  if(path==='-')return order;
  const coordinates=path.split('>').map(id=>{
   const cell=destinationCells.get(id);
   if(cell===undefined)throw Error(`Slot ${slot} uses unknown destination "${id}". Copy an ID from destinations.options or use "-".`);
   return cell;
  });
  return coordinates.join('>')+(action===undefined?'':'/'+action);
 })};
}
const objective=(frame:Frame)=>{
 const core=frame.objective;
 return core?{site:core.site===0?'North':'South',phase:core.phase,progress:core.progress,remaining:core.remaining}:null;
};

export function squadCapabilities(frame:Frame,side:Side){
 return frame.units.filter(unit=>unit.side===side).map(unit=>{
  const target=unit.hp?pulseTarget(frame.units,unit)?.target:undefined;
  return {slot:unit.slot,pulseContactNow:target?position(target):null};
 });
}

export function legalDestinationFeedback(error:string){
 const match=/wall or off-board cell at (\d+),(\d+)\.$/.exec(error);
 if(!match)return error;
 const x=Number(match[1]),y=Number(match[2]);
 const candidates=map.flatMap((row,iy)=>Array.from(row).flatMap((tile,ix)=>
  tile!=='#'&&Math.abs(ix-x)+Math.abs(iy-y)<=2?[`${ix},${iy}`]:[])).slice(0,8);
 return candidates.length?`${error} For that coordinate, use one of these nearby legal destinations verbatim (${candidates.join(' | ')}) or hold that slot with "-".`:error;
}

export function squadReceipt(window:SquadWindow,side:Side,navigation=false){
 const {start,frames,plan}=window;
 const end=frames.at(-1)!;
 const explicitPulse=navigation&&(start.mode==='tdm'||!!start.territory);
 const pulseSlots:number[]=[];
 const units=start.units.flatMap((unit,index)=>{
  if(unit.side!==side)return [];
  const acceptedOrder=plan.orders[unit.slot];
  if(explicitPulse&&acceptedOrder.endsWith('/pulse'))pulseSlots.push(unit.slot);
  const order=navigation?acceptedOrder.replace(/(\d+),(\d+)/g,(_cell,x,y)=>destinationId(Number(x),Number(y)))
   .replace(/\/pulse$/,action=>explicitPulse?'':action):acceptedOrder;
  const last=end.units[index];
  let pulses=0,blockedTicks=0,linkTicks=0,movingTicks=0;
  let previous=unit;
  for(const frame of frames){
   const current=frame.units[index];
   const [x,y]=position(current);
   pulses+=frame.shots.filter(shot=>shot.fromX===x&&shot.fromY===y).length;
   if(current.blocked>0)blockedTicks++;
   if(frame.objective?.actor===index)linkTicks++;
   if(previous.hp>0&&current.anchor!==undefined&&(current.x!==previous.x||current.y!==previous.y))movingTicks++;
   previous=current;
  }
  return [{slot:unit.slot,order,movingTicks,blockedTicks,pulses,linkTicks,
   endAt:position(last),endHp:last.hp}];
 });
 return {fromTick:start.tick,toTick:end.tick,authoredIntent:plan.intent,own:units,...(explicitPulse?{pulseSlots}:{}),
  score:{own:end.score[side]-start.score[side],rival:end.score[1-side]-start.score[1-side]},
  coreBefore:objective(start),coreAfter:objective(end)};
}
