import {expect,it} from 'vitest';
import {commandMatch} from '../server/squads';
import {hasSight,initialSquads,loadSquads,map,maxTicks,parsePlan,playWindow,result,scriptedSquads,squadConfig,teamSizes,width,
 type Frame,type Plan} from '../src/squads/game';
import type {Attempt} from '../server/match';

const at=(x:number,y:number)=>x+y*width;
const hold:Plan={intent:'Hold',orders:['-','-','-','-','-']};

it('preserves equal mirrored spawns, bounded legal movement and deterministic results at every supported size',()=>{
 for(const size of teamSizes){
  const {replay,frames}=scriptedSquads(squadConfig(size));
  expect(frames[0].units).toHaveLength(size*2);
  expect(frames[0].units.every(u=>u.hp===100)).toBe(true);
  expect(replay.final).toBe('draw');
  expect(frames.length).toBeLessThanOrEqual(maxTicks+1);
  expect(loadSquads(replay).frames).toEqual(frames);
  for(const f of frames){
   const occupied=f.units.filter(u=>u.hp).map(u=>u.at);
   expect(new Set(occupied).size).toBe(occupied.length);
   expect(occupied.every(cell=>map[Math.floor(cell/width)][cell%width]!=='#')).toBe(true);
   expect(f.units.slice(0,size).every((u,i)=>u.at+f.units[size+i].at===map.length*width-1)).toBe(true);
  }
 }
});

it('rejects partial orders, wall destinations, off-board targets, dead unit orders, and mismatched replay outcomes',()=>{
 const frame=initialSquads(squadConfig());
 for(const orders of [['-'],['7,2','-','-','-','-'],['2,6>27,8','-','-','-','-'],['0,0>1,0>2,0','-','-','-','-']])
  expect(()=>parsePlan({intent:'Invalid',orders},frame,0)).toThrow();
 frame.units[0].hp=0;
 expect(()=>parsePlan({intent:'Invalid',orders:['2,6','-','-','-','-']},frame,0)).toThrow();
 const {replay,frames}=scriptedSquads();
 expect(()=>loadSquads({...replay,final:'blue'})).toThrow();
 expect(()=>loadSquads({...replay,windows:[...replay.windows.slice(0,-1)]})).toThrow();
 expect(()=>playWindow(frames.at(-1)!,[hold,hold])).toThrow();
});

it('uses walls and cover, settles simultaneous pulses, and scores only uncontested occupied objectives',()=>{
 expect(hasSight(at(6,3),at(9,3))).toBe(false);
 expect(hasSight(at(12,2),at(13,2))).toBe(true);
 const start=initialSquads(squadConfig());
 const place=(placements:Record<number,number>)=>({...start,units:start.units.map((u,i)=>({...u,at:placements[i]??u.at}))});
 const contested=playWindow(place({0:at(12,2),5:at(13,2)}),[hold,hold]);
 expect(contested[0].score).toEqual([0,0]);
 expect(contested[0].control[0]).toBe('contested');
 expect(contested[1].units[0].hp).toBe(90);
 expect(contested[1].units[5].hp).toBe(80);
 expect(contested[1].shots).toHaveLength(2);
 const split=playWindow(place({0:at(13,3),1:at(13,11)}),[hold,hold]);
 expect(split[0].score).toEqual([2,0]);
 expect(result(split.at(-1)!)).toBe('blue');
 const lastUnits={...start,tick:0,units:start.units.map((u,i)=>({...u,hp:i===0||i===5?20:0,
  at:i===0?at(13,3):i===5?at(14,3):u.at}))};
 expect(result(playWindow(lastUnits,[hold,hold]).at(-1)!)).toBe('draw');
});

it('requests both commanders from identical checkpoints and keeps an interrupted match from awarding a winner',async()=>{
 const attempts:Attempt[]=[];
 const readings:Array<{frame:Frame;side:number}>=[];
 const replay=await commandMatch(squadConfig(),async (frame,side)=>{
  readings.push({frame,side});
  if(frame.tick&&side===0)throw Object.assign(Error('fake quota failure'),{status:429});
  return hold;
 },AbortSignal.timeout(1000),attempts);
 expect(readings.map(row=>[row.frame.tick,row.side])).toEqual([[0,0],[0,1],[12,0],[12,1]]);
 expect(readings[0].frame).toBe(readings[1].frame);
 expect(replay).toMatchObject({final:null,interruption:'rate-limit',windows:[[hold,hold]]});
 expect(attempts.map(a=>a.status)).toEqual(['accepted','accepted','429','accepted']);
 expect(loadSquads(replay).frames.at(-1)?.tick).toBe(12);
});

it('allows one corrected model order without executing an illegal destination',async()=>{
 const attempts:Attempt[]=[];
 const feedbacks:string[]=[];
 const replay=await commandMatch(squadConfig(),async (frame,side,_signal,feedback)=>{
  if(frame.tick===0&&side===0){
   if(!feedback)return {intent:'Invalid first plan',orders:['7,2','-','-','-','-']};
   feedbacks.push(feedback);
   return {intent:'Use legal waypoint',orders:['5,3','-','-','-','-']};
  }
  return hold;
 },AbortSignal.timeout(1000),attempts);
 expect(replay.windows[0][0].orders[0]).toBe('5,3');
 expect(feedbacks).toEqual(['Slot 0 targets a wall or off-board cell at 7,2.']);
 expect(attempts.find(a=>a.side===0&&a.step===0&&a.attempt===1)?.status).toBe('invalid-orders');
 expect(attempts.find(a=>a.side===0&&a.step===0&&a.attempt===2)?.status).toBe('accepted');
 expect(replay.interruption).toBeNull();
});

it('loads the genuine archived replay through the production validator',async()=>{
 const {default:legacy}=await import('../src/fixtures/relay-yard-gemini-v1.json');
 expect(loadSquads(legacy).frames.at(-1)).toMatchObject({tick:48,score:[7,16]});
 const {default:fixture}=await import('../src/fixtures/relay-yard-gemini.json');
 const {replay,frames}=loadSquads(fixture);
 expect(replay.source).toBe('operator-attested-gemini');
 expect(replay.final).toBe('sand');
 expect(frames.at(-1)).toMatchObject({tick:34,score:[21,24]});
});

it('advances both teammates when distinct relay goals share a first tile',()=>{
 const starting=initialSquads(squadConfig());
 const blue={intent:'Favor South',orders:['12,11','13,12','14,11','13,10','13,3']};
 const sand={intent:'Advance',orders:['15,9','15,8','15,7','15,6','15,5']};
 const frame=playWindow(starting,[blue,sand]).at(-1)!;
 expect(frame.units[0].at).not.toBe(starting.units[0].at);
 expect(frame.units[1].at).not.toBe(starting.units[1].at);
});
