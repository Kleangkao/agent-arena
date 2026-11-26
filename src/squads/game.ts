import {z} from 'zod';
import {continuousWindow} from './continuous.js';

export const squadRules='squads-v2';
export const legacySquadRules='squads-v1';
export const continuousSquadRules='squads-v3';
export const territorySquadRules='squads-v4';
export const squadModes=['relay','bomb','tdm'] as const;
export type SquadMode=typeof squadModes[number];
export const squadMap='relay-yard-v1';
export const width=27, height=15, windowTicks=12, maxTicks=48, winScore=24, tickMs=320;
export const territoryRules={captureTicks:3,maxTicks:72,winScore:60,pointsPerTick:1} as const;
export const teamSizes=[3,5,10,20] as const;
export const defaultTeamSize=5;
export type Side=0|1;
export type Pair<T>=[T,T];
type Point=[number,number];
export const sites:Point[]=[[13,3],[13,11]];
const wallRects=[ [7,2,2,3], [9,7,2,1], [12,7,3,1], [4,4,1,2], [11,0,1,3] ];
const coverPoints:Point[]=[[5,3],[10,4],[11,6],[9,10],[6,9],[12,2],[12,10],[14,2]];
const rect=(x:number,y:number)=>wallRects.some(([a,b,w,h])=>x>=a&&x<a+w&&y>=b&&y<b+h);
const cover=(x:number,y:number)=>coverPoints.some(([a,b])=>x===a&&y===b);
export const map=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{
 const mx=width-1-x,my=height-1-y;
 return rect(x,y)||rect(mx,my)?'#':cover(x,y)||cover(mx,my)?'+':'.';
}).join(''));
const cell=(x:number,y:number)=>x+y*width;
export const point=(at:number):Point=>[at%width,Math.floor(at/width)];
const walkable=(x:number,y:number)=>map[y]?.[x]!==undefined&&map[y][x]!=='#';
const adjacent=Array.from({length:width*height},(_,at)=>{
 const [x,y]=point(at);
 return [[x+1,y],[x,y-1],[x-1,y],[x,y+1]].filter(([a,b])=>walkable(a,b)).map(([a,b])=>cell(a,b));
});
const siteAt=(at:number,i:number)=>{
 const [x,y]=point(at),[a,b]=sites[i];
 return Math.max(Math.abs(x-a),Math.abs(y-b))<=1;
};
const spawns:Point[]=[[3,5],[2,6],[3,7],[2,8],[3,9],[1,5],[2,5],[1,6],[3,6],[1,7],[2,7],[1,8],[3,8],[1,9],[2,9],[1,10],[2,10],[3,10],[4,7],[4,8]];

export type Unit={side:Side;slot:number;at:number;hp:number;blocked:number;x?:number;y?:number;edge?:number;anchor?:number;spawn?:number;respawn?:number};
export type Shot={from:number;to:number;damage:number;fromX?:number;fromY?:number;toX?:number;toY?:number};
type Occupancy=Side|'contested'|null;
export type Territory={owner:Side|null;occupancy:Occupancy;claimant:Side|null;progress:number;changedAt:number|null};
export type Frame={tick:number;units:Unit[];score:Pair<number>;control:Occupancy[];shots:Shot[];goals:Array<number|null>;territory?:Territory[];
 mode?:SquadMode;objective?:{site:number;phase:'activate'|'disable'|'countdown';progress:number;remaining:number;actor?:number};terminal?:Result};
export type Result='blue'|'sand'|'draw';
const planSchema=z.object({intent:z.string().trim().min(1).max(120),orders:z.array(z.string().max(17)).max(20)}).strict();
export type Plan=z.infer<typeof planSchema>;
const sharedConfig={mapVersion:z.literal(squadMap),teamSize:z.union([z.literal(3),z.literal(5),z.literal(10),z.literal(20)])};
export const configSchema=z.union([
 z.object({...sharedConfig,rulesVersion:z.enum([legacySquadRules,squadRules])}).strict(),
 z.object({...sharedConfig,rulesVersion:z.literal(continuousSquadRules),mode:z.enum(squadModes)}).strict(),
 z.object({...sharedConfig,rulesVersion:z.literal(territorySquadRules),mode:z.literal('relay')}).strict(),
]);
export type SquadConfig=z.infer<typeof configSchema>;
export const squadConfig=(teamSize:SquadConfig['teamSize']=defaultTeamSize):SquadConfig&{rulesVersion:typeof squadRules}=>({rulesVersion:squadRules,mapVersion:squadMap,teamSize});
export const continuousConfig=(mode:SquadMode,teamSize:SquadConfig['teamSize']=defaultTeamSize)=>({rulesVersion:continuousSquadRules,mapVersion:squadMap,teamSize,mode} as const);
export const currentSquadConfig=(mode:SquadMode,teamSize:SquadConfig['teamSize']=defaultTeamSize)=>
 mode==='relay'?{rulesVersion:territorySquadRules,mapVersion:squadMap,teamSize,mode} as const:continuousConfig(mode,teamSize);
export function initialSquads(config:SquadConfig):Frame {
 const mode='mode' in config?config.mode:undefined;
 const territory=config.rulesVersion===territorySquadRules?sites.map(()=>({owner:null,occupancy:null,claimant:null,progress:0,changedAt:null})):undefined;
 return {tick:0,score:[0,0],control:[null,null],shots:[],goals:[],...(mode?{mode}:{}),...(territory?{territory}:{}),units:([0,1] as const).flatMap(side=>
  spawns.slice(0,config.teamSize).map(([x,y],slot)=>{
   const at=side?cell(width-1-x,height-1-y):cell(x,y);
   const [worldX,worldY]=point(at);
   return {side,slot,at,hp:100,blocked:0,...(mode?{x:worldX,y:worldY,spawn:at,anchor:at}:{})};
  }))};
}
export function parsePlan(input:unknown,frame:Frame,side:Side):Plan {
 const parsed=planSchema.safeParse(input);
 if(!parsed.success)throw Error('Use an intent of 1–120 characters and a list of order strings.');
 const plan=parsed.data;
 const units=frame.units.filter(unit=>unit.side===side);
 if(plan.orders.length!==units.length)throw Error(`Return exactly ${units.length} orders in slot order.`);
 for(const [slot,order] of plan.orders.entries()){
  if(order==='-')continue;
  if(!units[slot].hp)throw Error(`Slot ${slot} is defeated and must use "-".`);
  const [path,action,extra]=order.split('/');
  if(extra!==undefined||action!==undefined&&!(frame.mode==='bomb'&&(action==='link'||action==='pulse')||(frame.mode==='tdm'||frame.territory)&&action==='pulse'))
   throw Error(`Slot ${slot} uses an action unsupported by this mode.`);
  if(path==='-')continue;
  if(!/^\d{1,2},\d{1,2}(>\d{1,2},\d{1,2})?$/.test(path))throw Error(`Slot ${slot} must use "x,y", "x,y>x,y", or "-".`);
  for(const pair of path.split('>')){
   const [x,y]=pair.split(',').map(Number);
   if(!walkable(x,y))throw Error(`Slot ${slot} targets a wall or off-board cell at ${x},${y}.`);
  }
 }
 return plan;
}

const distance=(a:number,b:number)=>{
 const [x,y]=point(a),[p,q]=point(b);
 return Math.abs(x-p)+Math.abs(y-q);
};
export function hasSight(from:number,to:number) {
 // Require both directions of the grid raster to agree at corner ties.
 const clear=(a:number,b:number)=>{
  let [x,y]=point(a);
  const [tx,ty]=point(b),dx=Math.abs(tx-x),dy=Math.abs(ty-y),sx=Math.sign(tx-x),sy=Math.sign(ty-y);
  let error=dx-dy;
  while(x!==tx||y!==ty){
   const e=2*error,oldX=x,oldY=y;
   if(e>-dy){error-=dy;x+=sx;}
   if(e<dx){error+=dx;y+=sy;}
   if(!walkable(x,y)||oldX!==x&&oldY!==y&&!walkable(oldX,y)&&!walkable(x,oldY))return false;
  }
  return true;
 };
 return clear(from,to)&&clear(to,from);
}
const staticFields=new Map<number,Int16Array>();
function distanceField(goal:number,occupied?:Set<number>){
 const cached=!occupied?staticFields.get(goal):undefined;
 if(cached)return cached;
 const dist=new Int16Array(width*height).fill(-1),pending=[goal];
 dist[goal]=0;
 for(let i=0;i<pending.length;i++)for(const next of adjacent[pending[i]])if(dist[next]<0&&!occupied?.has(next)){
  dist[next]=dist[pending[i]]+1;pending.push(next);
 }
 if(!occupied)staticFields.set(goal,dist);
 return dist;
}
function nextCell(unit:Unit,goal:number,occupied:Set<number>){
 if(goal===unit.at)return unit.at;
 const dirs=adjacent[unit.at];
 const tieOrder=(next:number)=>{
  const delta=(next-unit.at)*(unit.side?-1:1);
  return delta===1?0:delta===-width?1:delta===-1?2:3;
 };
 const closer=(field:Int16Array,next:number,best:number)=>field[next]>=0&&
  (best===-1||field[next]<field[best]||field[next]===field[best]&&tieOrder(next)<tieOrder(best));
 const dist=distanceField(goal);
 const available=dirs.filter(next=>!occupied.has(next));
 const step=available.reduce((best,next)=>closer(dist,next,best)?next:best,-1);
 if(step!==-1&&dist[step]<dist[unit.at])return step;
 if(unit.blocked<2||occupied.has(goal))return unit.at;
 const alternate=distanceField(goal,occupied);
 const detour=available.reduce((best,next)=>closer(alternate,next,best)?next:best,-1);
 return detour===-1?unit.at:detour;
}
export function result(frame:Frame):Result|null {
 if(frame.mode)return frame.terminal??null;
 const alive=([0,1] as const).map(side=>frame.units.some(unit=>unit.side===side&&unit.hp>0));
 if(!alive[0]||!alive[1])return alive[0]?'blue':alive[1]?'sand':'draw';
 if(frame.tick<maxTicks&&Math.max(...frame.score)<winScore)return null;
 return frame.score[0]===frame.score[1]?'draw':frame.score[0]>frame.score[1]?'blue':'sand';
}

export function playWindow(start:Frame,raw:Pair<Plan>,rules:SquadConfig['rulesVersion']=squadRules):Frame[] {
 if(result(start)||start.tick%windowTicks!==0)throw Error('Invalid squad checkpoint');
 if(start.mode){
  if(rules!==(start.territory?territorySquadRules:continuousSquadRules))throw Error('Wrong squad rules for continuous checkpoint');
  return continuousWindow(start,raw);
 }
 if(rules===continuousSquadRules||rules===territorySquadRules)throw Error('Missing continuous squad mode');
 const plans:Pair<Plan>=[parsePlan(raw[0],start,0),parsePlan(raw[1],start,1)];
 const routes=start.units.map(({side,slot})=>plans[side].orders[slot].split('>').filter(mark=>mark!=='-').map(mark=>{
  const [x,y]=mark.split(',').map(Number);return cell(x,y);
 }));
 const frames:Frame[]=[];
 let frame=start;
 do{
  const goals=frame.units.map((unit,i)=>{
   if(unit.hp&&routes[i][0]===unit.at)routes[i].shift();
   return unit.hp?(routes[i][0]??null):null;
  });
  const occupied=new Set(frame.units.filter(unit=>unit.hp).map(unit=>unit.at));
  const moves=frame.units.map((unit,i)=>goals[i]===null?unit.at:nextCell(unit,goals[i]!,occupied));
  const claims=new Map<number,number[]>();
  moves.forEach((at,i)=>{
   if(at===frame.units[i].at)return;
   const claim=claims.get(at);
   if(claim)claim.push(i);else claims.set(at,[i]);
  });
  const allowed=new Set<number>();
  for(const contenders of claims.values()){
   const first=frame.units[contenders[0]];
   if(contenders.length===1){allowed.add(contenders[0]);continue;}
   if(rules===legacySquadRules||contenders.some(i=>frame.units[i].side!==first.side))continue;
   // Give same-team contenders a rotating slot priority. Opposing claims remain contested.
   const count=frame.units.length/2;
   const priority=(i:number)=>(frame.units[i].slot-frame.tick%count+count)%count;
   allowed.add(contenders.reduce((winner,i)=>priority(i)<priority(winner)?i:winner));
  }
  const units=frame.units.map((unit,i)=>{
   const at=allowed.has(i)?moves[i]:unit.at;
   return {...unit,at,blocked:goals[i]!==null&&goals[i]!==at&&at===unit.at?unit.blocked+1:0};
  });
  const shots:Shot[]=[];
  if((frame.tick+1)%2===0)for(const unit of units)if(unit.hp){
   const target=units.filter(other=>other.side!==unit.side&&other.hp&&distance(unit.at,other.at)<=4&&hasSight(unit.at,other.at))
    .sort((a,b)=>distance(unit.at,a.at)-distance(unit.at,b.at)||a.slot-b.slot)[0];
   if(target){const [x,y]=point(target.at);shots.push({from:unit.at,to:target.at,damage:map[y][x]==='+'?10:20});}
  }
  const targets=new Map(units.filter(unit=>unit.hp).map(unit=>[unit.at,unit]));
  for(const shot of shots){const unit=targets.get(shot.to)!;unit.hp=Math.max(0,unit.hp-shot.damage);}
  const score:Pair<number>=[...frame.score];
  const control=sites.map((_,i)=>{
   const present=([0,1] as const).filter(side=>units.some(unit=>unit.side===side&&unit.hp&&siteAt(unit.at,i)));
   if(present.length===1){score[present[0]]++;return present[0];}
   return present.length?'contested':null;
  });
  frame={tick:frame.tick+1,units,score,control,shots,goals};
  frames.push(frame);
 }while(frames.length<windowTicks&&!result(frame));
 return frames;
}

export function observeSquads(frame:Frame,side:Side){
 const location=(u:Unit)=>u.x===undefined?point(u.at):[u.x,u.y];
 return {tick:frame.tick,side:side===0?'Blue':'Sand',score:{own:frame.score[side],rival:frame.score[1-side]},control:frame.control,
  ...(frame.mode?{mode:frame.mode,objective:frame.objective??null}:{}),
  ...(frame.territory?{territory:frame.territory.map((site,i)=>({...site,site:i?'south':'north',
   pointsPerTick:site.owner!==null&&site.occupancy!=='contested'?territoryRules.pointsPerTick:0})),
   remainingTicks:territoryRules.maxTicks-frame.tick}:{}),
  own:frame.units.filter(unit=>unit.side===side).map(u=>({slot:u.slot,at:location(u),hp:u.hp,blocked:u.blocked,...(u.respawn?{earliestReturn:u.respawn}:{})})),
  rival:frame.units.filter(unit=>unit.side!==side&&unit.hp).map(u=>({at:location(u),hp:u.hp}))};
}
export const arenaOpponentIds=['arena-easy','arena-normal','arena-hard'] as const;
export const arenaPolicyVersion='arena-bot/v3' as const;
export type ArenaOpponentId=typeof arenaOpponentIds[number];
export type ArenaDifficulty='easy'|'normal'|'hard';
const arenaDifficultyFor={ 'arena-easy':'easy','arena-normal':'normal','arena-hard':'hard'} as const satisfies Record<ArenaOpponentId,ArenaDifficulty>;
const challengeSchema=z.object({
 format:z.literal('challenge'),difficulty:z.enum(['easy','normal','hard']),policy:z.enum(['arena-bot/v1','arena-bot/v2',arenaPolicyVersion]),opponent:z.enum(arenaOpponentIds),
}).strict().refine(value=>value.difficulty===arenaDifficultyFor[value.opponent],'Challenge opponent does not match its difficulty.');
const replaySchema=z.object({version:z.literal(7),config:configSchema,source:z.enum(['scripted-practice','operator-attested-gemini','arena-challenge']),
 windows:z.array(z.tuple([planSchema,planSchema])).max(territoryRules.maxTicks/windowTicks),final:z.enum(['blue','sand','draw']).nullable(),
 interruption:z.enum(['rate-limit','provider','timeout','invalid-orders']).nullable(),challenge:challengeSchema.optional(),
}).strict().refine(({config,windows})=>
 windows.length<=(config.rulesVersion===territorySquadRules?territoryRules.maxTicks/windowTicks:maxTicks/windowTicks+1))
 .refine(replay=>(replay.source==='arena-challenge')===(replay.challenge!==undefined),'Challenge metadata must match the replay source.');
export type SquadReplay=z.infer<typeof replaySchema>;
export function loadSquads(input:unknown){
 const replay=replaySchema.parse(input);
 const frames=[initialSquads(replay.config)];
 for(const orders of replay.windows)frames.push(...playWindow(frames.at(-1)!,orders,replay.config.rulesVersion));
 const final=result(frames.at(-1)!);
 const modelSource=replay.source==='operator-attested-gemini'||replay.source==='arena-challenge';
 if(final!==replay.final||!!final===!!replay.interruption||(replay.interruption&&!modelSource))
  throw Error('Squad replay result does not match its transcript');
 return {replay,frames};
}
export function scriptedTeamPlan(frame:Frame,side:Side,choice:'split'|'north'|'south'='split'):Plan{
 const intent=frame.mode==='tdm'?'Spread across the yard and authorize pulses.':frame.mode==='bomb'
  ?side?'Cover the sites and unlink the active core.':'Escort the linkers to the sites.':choice==='split'?'Split between the two relays.':`Stack the ${choice} relay.`;
 return {intent,orders:frame.units.filter(unit=>unit.side===side).map(unit=>{
  if(!unit.hp)return '-';
  const n=unit.slot%9, [x,y]=sites[side===1&&frame.objective&&frame.objective.phase!=='activate'?frame.objective.site:
   choice==='split'?(unit.slot+side)%2:choice==='north'?0:1];
  const action=frame.mode==='tdm'||frame.territory?'/pulse':frame.mode==='bomb'?n<2?'/link':'/pulse':'';
  const offset=frame.mode==='bomb'&&n<2?side?1:-1:(side?1:-1)*(1-n%3);
  return `${x+offset},${y+(side?-1:1)*(Math.floor(n/3)-1)}${action}`;
 })};
}
export function scriptedSquads(config:SquadConfig=squadConfig(),policy:'split'|'north'|'south'='split',rivalPolicy:'split'|'north'|'south'='split'){
 let frame=initialSquads(config);
 const windows:SquadReplay['windows']=[];
 while(!result(frame)){
  const orders=[scriptedTeamPlan(frame,0,policy),scriptedTeamPlan(frame,1,rivalPolicy)] as Pair<Plan>;
  windows.push(orders);
  frame=playWindow(frame,orders,config.rulesVersion).at(-1)!;
 }
 return loadSquads({version:7,config,source:'scripted-practice',windows,final:result(frame),interruption:null});
}
