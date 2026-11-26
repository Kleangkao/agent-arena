import {expect,test,vi} from 'vitest';
import interrupted from '../evidence/squad-intelligence/tdm-34a08b75-8d0e-4ef7-9480-15c2db7897fd.json';
import {squadDestinations} from '../server/squad-observation.js';
import {runGeminiSquads} from '../server/squads.js';
import {continuousConfig,height,initialSquads,loadSquads,map,parsePlan,sites,width} from '../src/squads/game.js';
import type {Attempt,Coach} from '../server/match.js';

const {generate}=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('@google/genai',()=>({GoogleGenAI:class {models={generateContent:generate};}}));
const coach:Coach={text:'Make your own choices.',revision:'test',memory:{revision:0,lessons:[]}};
const config=continuousConfig('tdm');

test('catalogue is bounded, mirrored, covers both full objective zones and is reachable on static geometry',()=>{
 const options=squadDestinations.options;
 const at=new Map(options.map(([,x,y,terrain])=>[`${x},${y}`,terrain]));
 expect(options.length).toBeLessThan(80);
 expect(new Set(options.map(([id])=>id)).size).toBe(options.length);
 const queue=[[13,3]];
 const reachable=new Set(['13,3']);
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
   const key=`${nx},${ny}`;
   if(map[ny]?.[nx]===undefined||map[ny][nx]==='#'||reachable.has(key))continue;
   reachable.add(key);queue.push([nx,ny]);
  }
 }
 for(const [,x,y,terrain] of options){
  expect(reachable.has(`${x},${y}`)).toBe(true);
  expect(at.get(`${width-1-x},${height-1-y}`)).toBe(terrain);
 }
 for(const [sx,sy] of sites)for(const dx of [-1,0,1])for(const dy of [-1,0,1])
  expect(at.has(`${sx+dx},${sy+dy}`)).toBe(true);
});

test('reproduces the archived double-wall failure and offers a legal centre approach in the provider interface',async()=>{
 const history=loadSquads(interrupted.replay);
 const frame=history.frames.at(-1)!;
 const rows=interrupted.exchange.filter(row=>row.tick===frame.tick&&row.side===1);
 expect(rows).toHaveLength(2);
 for(const [i,row] of rows.entries()){
  const plan=JSON.parse(row.response);
  plan.orders=plan.orders.map((order:string,slot:number)=>plan.pulseSlots.includes(slot)?order+'/pulse':order);
  delete plan.pulseSlots;
  expect(()=>parsePlan(plan,frame,1)).toThrow(i===0?'wall or off-board cell at 13,7':'wall or off-board cell at 12,7');
 }
 generate.mockReset();
 generate.mockImplementation(async(req)=>{
  const input=JSON.parse(req.contents);
  const first=input.observation.tick===0;
  const orders=['-','-','-','-','-'];
  if(first&&input.observation.side==='Sand')orders[2]='H15';
  return {text:JSON.stringify({intent:'Explicit choice',orders,pulseSlots:first&&input.observation.side==='Sand'?[2]:[]})};
 });
 const attempts:Attempt[]=[];
 const replay=await runGeminiSquads('fake-key','fake-model',config,[coach,coach],AbortSignal.timeout(5000),attempts);
 const prompt=JSON.parse(generate.mock.calls[0][0].contents);
 expect(prompt.destinations.options).toContainEqual(['H15',15,7,'floor']);
 expect(prompt.destinations.options.some((entry:[string,number,number,string])=>entry[1]===13&&entry[2]===7)).toBe(false);
 expect(replay.windows[0][1].orders).toEqual(['-','-','15,7/pulse','-','-']);
 const sandSecond=generate.mock.calls.map(([req])=>JSON.parse(req.contents))
  .find(row=>row.observation.tick===12&&row.observation.side==='Sand');
 expect(sandSecond.ownLastWindow.own[2].order).toBe('H15');
 expect(sandSecond.ownLastWindow.pulseSlots).toEqual([2]);
 expect(attempts.every(attempt=>attempt.status==='accepted')).toBe(true);
 expect(loadSquads(replay).replay).toEqual(replay);
});

test('invalid IDs cause a bounded correction and never select a destination on behalf of the commander',async()=>{
 generate.mockReset();
 generate.mockImplementation(async(req)=>{
  const input=JSON.parse(req.contents);
  const orders=['-','-','-','-','-'];
  if(input.observation.tick===0&&input.observation.side==='Blue')orders[0]=input.validationFeedback?'E11>B13':'H13';
  return {text:JSON.stringify({intent:'Explicit choice',orders,pulseSlots:[]})};
 });
 const attempts:Attempt[]=[];
 const replay=await runGeminiSquads('fake-key','fake-model',config,[coach,coach],AbortSignal.timeout(5000),attempts);
 expect(attempts.slice(0,3).map(row=>row.status)).toEqual(['invalid-orders','accepted','accepted']);
 const correction=generate.mock.calls.map(([req])=>JSON.parse(req.contents).validationFeedback).find(Boolean);
 expect(correction).toContain('H13');
 expect(correction).toContain('destinations.options');
 expect(replay.windows[0][0].orders[0]).toBe('11,4>13,1');
});

test.each(['bomb','relay'] as const)('decodes selected destination IDs for %s without adding actions',async(mode)=>{
 generate.mockReset();
 const bomb=mode==='bomb';
 generate.mockResolvedValue({text:JSON.stringify({intent:'Choose North',orders:['D13'+(bomb?'/link':''),'-','-','-','-']})});
 const replay=await runGeminiSquads('fake-key','fake-model',continuousConfig(mode),[coach,coach],AbortSignal.timeout(5000),[]);
 expect(replay.windows[0].map(plan=>plan.orders[0])).toEqual(Array(2).fill('13,3'+(bomb?'/link':'')));
 expect(loadSquads(replay).frames[0]).toEqual(initialSquads(continuousConfig(mode)));
 const nextPrompt=generate.mock.calls.map(([req])=>JSON.parse(req.contents))
  .find(row=>row.observation.tick===12);
 expect(nextPrompt.ownLastWindow.own[0].order).toBe('D13'+(bomb?'/link':''));
 expect(nextPrompt.ownLastWindow.pulseSlots).toBeUndefined();
});
