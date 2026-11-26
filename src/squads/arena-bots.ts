import {arenaOpponentIds,arenaPolicyVersion,currentSquadConfig,initialSquads,loadSquads,map,playWindow,point,result,scriptedTeamPlan,sites,type ArenaDifficulty,type ArenaOpponentId,type Frame,type Plan,type SquadConfig,type SquadReplay} from './game.js';

export {arenaOpponentIds,arenaPolicyVersion};
export type {ArenaDifficulty,ArenaOpponentId};

export const arenaOpponents={
 'arena-easy':{difficulty:'easy' as const,name:'Easy',behavior:'Uses a predictable formation and responds to an active Core.'},
 'arena-normal':{difficulty:'normal' as const,name:'Normal',behavior:'Covers both objectives and reinforces an active Core.'},
 'arena-hard':{difficulty:'hard' as const,name:'Hard',behavior:'Reassigns units based on pressure, health, and objective control.'},
} as const satisfies Record<ArenaOpponentId,{difficulty:ArenaDifficulty;name:string;behavior:string}>;

export function isArenaOpponent(id:string):id is ArenaOpponentId{
 return (arenaOpponentIds as readonly string[]).includes(id);
}

const siteOffsets=[[1,0],[0,-1],[0,1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1],[0,0]];
const distance=(x:number,y:number,site:number)=>Math.abs(x-sites[site][0])+Math.abs(y-sites[site][1]);

function formationPlan(frame:Frame,difficulty:ArenaDifficulty,focusSite?:number):Plan{
 const own=frame.units.filter(unit=>unit.side===1);
 const active=frame.objective?.site;
 const rivalPressure=sites.map((_,site)=>frame.units.filter(unit=>{
  const [x,y]=point(unit.at);
  return unit.side===0&&unit.hp&&distance(x,y,site)<=7;
 }).length);
 const priority=active??focusSite??(rivalPressure[1]>rivalPressure[0]?1:0);
 const formation=new Map<number,number>();
 if(difficulty==='hard'){
  const ranked=own.filter(unit=>unit.hp).sort((a,b)=>{
   const [ax,ay]=point(a.at),[bx,by]=point(b.at);
   return distance(ax,ay,priority)-distance(bx,by,priority)||b.hp-a.hp||a.slot-b.slot;
  });
  ranked.forEach((unit,index)=>formation.set(unit.slot,index));
 }
 const assigned=[0,0];
 return {
  intent:frame.mode==='bomb'?(active===undefined?'Guard both Core sites.':'Respond to activity at the Core.')
   :frame.mode==='tdm'?'Group up and authorize pulses.':'Secure both relays and respond to pressure.',
  orders:own.map(unit=>{
   if(!unit.hp)return '-';
   const rank=formation.get(unit.slot)??unit.slot;
   let site=difficulty==='easy'?Number(unit.slot%5!==0):unit.slot%2;
   if(frame.mode==='tdm')site=difficulty==='easy'?site:difficulty==='normal'?0:priority;
   else if(frame.mode==='bomb'&&active!==undefined&&(difficulty!=='easy'||rank<Math.ceil(own.length/2)))site=active;
   else if(difficulty==='hard'){
    const safeSite=frame.territory?.findIndex(territory=>territory.owner===1&&territory.occupancy!=='contested');
    const focus=focusSite??(safeSite===0||safeSite===1?1-safeSite:priority);
    site=rank<Math.ceil(own.length*0.6)?focus:1-focus;
   }
   const position=assigned[site]++;
   const armed=frame.objective?.phase==='countdown'||frame.objective?.phase==='disable';
   const link=frame.mode==='bomb'&&armed&&site===active&&position<(difficulty==='easy'?1:2);
   const offset=siteOffsets[(position+(difficulty==='hard'?1:0))%siteOffsets.length];
   const [sx,sy]=sites[site];
   const x=sx+offset[0],y=sy+offset[1];
   const target=map[y]?.[x]&&map[y][x]!=='#'?[x,y]:[sx,sy];
   return target.join(',')+(link?'/link':'/pulse');
  }),
 };
}

function evaluate(frame:Frame){
 const winner=result(frame);
 if(winner)return winner==='sand'?1000:winner==='blue'?-1000:0;
 const [blue,sand]=frame.units.reduce((hp,unit)=>{
  hp[unit.side]+=unit.hp+(unit.hp?60:0);
  return hp;
 },[0,0]);
 const material=(sand-blue)/25;
 if(frame.mode==='tdm')return material+8*(frame.score[1]-frame.score[0]);
 if(frame.territory)return material+frame.score[1]-frame.score[0]+frame.territory.reduce((sum,site)=>
  sum+(site.owner===1?6:site.owner===0?-6:0)+(site.claimant===1?site.progress:site.claimant===0?-site.progress:0),0);
 if(frame.objective?.phase==='activate')return material-3*frame.objective.progress;
 if(frame.objective)return material-25+3*frame.objective.progress;
 return material;
}

export function arenaBotPlan(frame:Frame,difficulty:ArenaDifficulty):Plan{
 if(difficulty!=='hard'||!frame.mode||frame.mode==='bomb')return formationPlan(frame,difficulty);
 const rules=currentSquadConfig(frame.mode).rulesVersion;
 const candidates=[formationPlan(frame,'hard'),formationPlan(frame,'normal'),
  formationPlan(frame,'hard',0),formationPlan(frame,'hard',1),scriptedTeamPlan(frame,1,'split')];
 // Opponent orders are private. Test plausible public-state formations, never the actual rival plan.
 const references=(['split','north','south'] as const).map(approach=>scriptedTeamPlan(frame,0,approach));
 let selected=candidates[0],best=-Infinity;
 for(const candidate of candidates){
  const scores=references.map(reference=>evaluate(playWindow(frame,[reference,candidate],rules).at(-1)!));
  const score=scores.reduce((sum,value)=>sum+value,0)/scores.length+Math.min(...scores)/2;
  if(score>best){best=score;selected=candidate;}
 }
 return {...selected,intent:'Choose a formation that holds up against multiple plausible rival approaches.'};
}

export function previewChallenge(config:SquadConfig,difficulty:ArenaDifficulty,reference:'split'|'north'|'south'='split'){
 let frame=initialSquads(config);
 const windows:SquadReplay['windows']=[];
 while(!result(frame)){
  const orders:[Plan,Plan]=[scriptedTeamPlan(frame,0,reference),arenaBotPlan(frame,difficulty)];
  windows.push(orders);
  frame=playWindow(frame,orders,config.rulesVersion).at(-1)!;
 }
 return loadSquads({version:7,config,source:'scripted-practice',windows,final:result(frame),interruption:null});
}

const difficultyRank={easy:1,normal:2,hard:3} as const;
export function highestWins(records:Array<{mode:string;difficulty:ArenaDifficulty;result:string}>){
 const best:Partial<Record<string,ArenaDifficulty>>={};
 for(const row of records){
  if(row.result!=='blue')continue;
  const current=best[row.mode];
  if(!current||difficultyRank[row.difficulty]>difficultyRank[current])best[row.mode]=row.difficulty;
 }
 return best;
}
