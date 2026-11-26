import {expect,it} from 'vitest';
import {
 continuousConfig,continuousSquadRules,initialSquads,loadSquads,map,maxTicks,parsePlan,playWindow,result,
 scriptedSquads,teamSizes,width,type Frame,type Plan,
} from '../src/squads/game';
import {tdmOrderAuthorization} from '../server/squads';

const plan=(...orders:string[]):Plan=>({intent:'Deterministic test orders',orders:[...orders,...Array(5-orders.length).fill('-')]});
const simulate=(frame:Frame,blue=plan(),sand=plan())=>playWindow(frame,[blue,sand],continuousSquadRules);
const place=(start:Frame,id:number,x:number,y:number,hp=100)=>{
 Object.assign(start.units[id],{x,y,at:x+y*width,anchor:x+y*width,edge:undefined,hp});
};

it('resolves competing ally approaches and completes a Bomb practice including activation',()=>{
 const game=scriptedSquads(continuousConfig('bomb'));
 const {frames,replay}=game;
 expect(frames[1].units.slice(0,2).some(u=>!Number.isInteger(u.x)||!Number.isInteger(u.y))).toBe(true);
 expect(frames.some(f=>f.objective?.phase==='countdown')).toBe(true);
 expect(frames.at(-1)).toMatchObject({tick:32,terminal:'blue',objective:{site:0,remaining:0}});
 expect(loadSquads(replay).frames).toEqual(frames);
});

it('preserves body separation, walkable footprints, fixed precision, and same-rule replays through 20v20',()=>{
 for(const mode of ['relay','bomb','tdm'] as const)for(const size of teamSizes){
  const {replay,frames}=scriptedSquads(continuousConfig(mode,size));
  expect(frames[0].units).toHaveLength(2*size);
  expect(frames.length).toBeLessThanOrEqual(maxTicks+11);
  expect(loadSquads(replay).frames).toEqual(frames);
  for(const [tick,frame] of frames.entries())for(const [i,unit] of frame.units.entries()){
   if(!unit.hp)continue;
   expect(Number.isInteger(unit.x!*256)&&Number.isInteger(unit.y!*256)).toBe(true);
   expect(map[Math.round(unit.y!)][Math.round(unit.x!)]).not.toBe('#');
   const prev=frames[tick-1]?.units[i];
   if(prev?.hp)expect(Math.abs(prev.x!-unit.x!)+Math.abs(prev.y!-unit.y!)).toBeLessThanOrEqual(0.75);
   for(const other of frame.units.slice(i+1))if(other.hp){
    expect((unit.x!-other.x!)**2+(unit.y!-other.y!)**2).toBeGreaterThanOrEqual((88/256)**2);
   }
  }
 }
});

it('links either site, can disable a linked Core, interrupts interaction on a hit, and allows late countdown',()=>{
 for(const [site,y] of [[0,3],[1,11]]){
  const unguarded=initialSquads(continuousConfig('bomb'));
  place(unguarded,0,13,y);
  const activated=simulate(unguarded,plan('-/link'),plan());
  expect(activated[2]).toMatchObject({objective:{phase:'countdown',site,remaining:10}});
  const defended=initialSquads(continuousConfig('bomb'));
  place(defended,0,13,y);
  place(defended,5,14,y);
  const disabled=simulate(defended,plan('-/link'),plan('-/link'));
  expect(disabled.at(-1)).toMatchObject({terminal:'sand',objective:{phase:'disable',progress:3,site}});
  const contested=initialSquads(continuousConfig('bomb'));
  place(contested,0,13,y);
  place(contested,5,14,y);
  const interrupted=simulate(contested,plan('-/link'),plan('-/pulse'));
  expect(interrupted[0].objective?.progress).toBe(1);
  expect(interrupted[1].objective).toBeUndefined();
  expect(interrupted.every(f=>f.objective?.phase!=='countdown')).toBe(true);
 }
 const late=initialSquads(continuousConfig('bomb'));
 late.tick=48;late.objective={site:1,phase:'countdown',progress:0,remaining:10};
 expect(simulate(late).at(-1)).toMatchObject({tick:58,terminal:'blue'});
});

it('requires an authored pulse in TDM, counts one simultaneous elimination per unit and clears orders on respawn',()=>{
 const start=initialSquads(continuousConfig('tdm'));
 place(start,0,13,3,20);place(start,5,14,3,20);
 expect(simulate(start).every(f=>f.shots.length===0)).toBe(true);
 const frames=simulate(start,plan('-/pulse'),plan('-/pulse'));
 expect(frames[1]).toMatchObject({score:[1,1]});
 expect(frames[1].shots).toHaveLength(2);
 expect(frames[1].units[0].hp).toBe(0);
 expect(frames[4].units[0].hp).toBe(0);
 expect(frames[5].units[0]).toMatchObject({hp:100,x:3,y:5});
 expect(frames.slice(2).every(f=>f.shots.length===0)).toBe(true);
 const winner=initialSquads(continuousConfig('tdm'));
 winner.score=[7,0];place(winner,0,13,3);place(winner,5,14,3,20);
 expect(result(simulate(winner,plan('-/pulse')).at(-1)!)).toBe('blue');
});

it('rejects actions across mode boundaries and replays with a mismatched rules/config or result',async()=>{
 const invalid=[['relay','-/pulse'],['tdm','-/link'],['bomb','13,3/pulse/link'],['bomb','12,7/link']] as const;
 for(const [mode,order] of invalid)expect(()=>parsePlan(plan(order),initialSquads(continuousConfig(mode)),0)).toThrow();
 const {default:fixture}=await import('../src/fixtures/relay-yard-gemini-bomb.json');
 const {replay,frames}=loadSquads(fixture);
 expect(replay.source).toBe('operator-attested-gemini');
 expect(frames.at(-1)).toMatchObject({terminal:'blue',objective:{site:0,remaining:0}});
 expect(()=>loadSquads({...replay,config:{...replay.config,mode:'tdm'}})).toThrow();
 expect(()=>loadSquads({...replay,final:'draw'})).toThrow();
 expect(()=>simulate(frames.at(-1)!)).toThrow();
});

it('requires explicit pulse authorization in the provider format and validates the normalized plans',()=>{
 const start=initialSquads(continuousConfig('tdm'));
 const raw={...plan('13,3','-'),pulseSlots:[0,1]};
 expect(parsePlan(tdmOrderAuthorization(raw),start,0).orders).toEqual(['13,3/pulse','-/pulse','-','-','-']);
 expect(parsePlan(tdmOrderAuthorization({...raw,pulseSlots:[]}),start,0).orders).toEqual(raw.orders);
 expect(()=>parsePlan(tdmOrderAuthorization({...raw,pulseSlots:[7]}),start,0)).toThrow();
 expect(()=>parsePlan(tdmOrderAuthorization({...raw,pulseSlots:[0,0]}),start,0)).toThrow();
 start.units[0].hp=0;
 expect(()=>parsePlan(tdmOrderAuthorization(raw),start,0)).toThrow();
});
