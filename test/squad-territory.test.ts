import {expect,it} from 'vitest';
import {continuousConfig,currentSquadConfig,initialSquads,loadSquads,playWindow,scriptedSquads,territorySquadRules,width,type Frame,type Plan} from '../src/squads/game';
import {territoryTransitions} from '../src/squads/replay-summary';

const plan=(first='-'):Plan=>({intent:'Test territory',orders:[first,'-','-','-','-']});
function place(start:Frame,id:number,x:number,y:number){
 const at=x+y*width;
 Object.assign(start.units[id],{x,y,at,anchor:at,edge:undefined});
}
const run=(start:Frame,blue=plan(),sand=plan())=>playWindow(start,[blue,sand],territorySquadRules);

it('takes three occupation ticks and scores even after the occupants depart',()=>{
 const start=initialSquads(currentSquadConfig('relay'));
 place(start,0,13,3);
 const frames=run(start);
 expect(frames[1]).toMatchObject({score:[0,0],territory:[{owner:null,claimant:0,progress:2},{owner:null}]});
 expect(frames[2]).toMatchObject({score:[1,0],territory:[{owner:0,claimant:null,progress:0,changedAt:3},{owner:null}]});
 const next=run(frames.at(-1)!,plan('13,6'));
 expect(next.at(-1)).toMatchObject({score:[22,0],territory:[{owner:0,occupancy:null},{owner:null}]});
});

it('pauses progress and scoring during a contest and transfers ownership only after a completed claim',()=>{
 const start=initialSquads(currentSquadConfig('relay'));
 place(start,0,13,3);
 const owned=run(start).at(-1)!;
 place(owned,5,14,3);
 const contest=run(owned);
 expect(contest[0]).toMatchObject({score:[10,0],territory:[{owner:0,occupancy:'contested',progress:0},{owner:null}]});
 const resumed=contest.at(-1)!;
 place(resumed,0,10,5);
 place(resumed,5,14,3);
 expect(run(resumed)[2]).toMatchObject({score:[12,1],territory:[{owner:1,changedAt:27},{owner:null}]});
});

it('captures separate sites in the same tick, reconstructs new replays and retains historical modes',()=>{
 const start=initialSquads(currentSquadConfig('relay'));
 place(start,0,13,3);
 place(start,5,13,11);
 const both=run(start);
 expect(both[2]).toMatchObject({score:[1,1],territory:[{owner:0,changedAt:3},{owner:1,changedAt:3}]});
 expect(territoryTransitions(both)).toEqual([{tick:3,site:'North',owner:0},{tick:3,site:'South',owner:1}]);
 const current=scriptedSquads(currentSquadConfig('relay'));
 expect(loadSquads(current.replay).frames).toEqual(current.frames);
 expect(current.replay.config.rulesVersion).toBe(territorySquadRules);
 expect(currentSquadConfig('bomb')).toEqual(continuousConfig('bomb'));
 expect(currentSquadConfig('tdm')).toEqual(continuousConfig('tdm'));
 expect(loadSquads(scriptedSquads(continuousConfig('relay')).replay).frames[0].territory).toBeUndefined();
});

it('freezes a partial capture during contention and clears it only when the site is empty',()=>{
 const start=initialSquads(currentSquadConfig('relay'));
 place(start,0,13,3);
 start.territory![0]={owner:1,occupancy:0,claimant:0,progress:2,changedAt:3};
 place(start,5,14,3);
 const contested=run(start).at(-1)!;
 expect(contested.territory![0]).toMatchObject({owner:1,occupancy:'contested',claimant:0,progress:2});
 place(contested,0,10,4);
 place(contested,5,16,3);
 const vacant=run(contested)[0];
 expect(vacant).toMatchObject({score:[0,1],territory:[{owner:1,occupancy:null,claimant:null,progress:0},{owner:null}]});
});

it('requires authorized pulses and bounds a full 72-tick scoreless match',()=>{
 const config=currentSquadConfig('relay');
 const start=initialSquads(config);
 place(start,0,13,3);
 place(start,5,14,3);
 expect(run(start).flatMap(f=>f.shots)).toHaveLength(0);
 expect(run(start,plan('-/pulse'))[1].shots).toHaveLength(1);
 const windows=Array.from({length:6},()=>[plan(),plan()]);
 const replay={version:7,config,source:'scripted-practice',windows,final:'draw',interruption:null};
 const finished=loadSquads(replay).frames.at(-1);
 expect(finished).toMatchObject({tick:72,terminal:'draw',score:[0,0]});
 expect(()=>loadSquads({...replay,windows:[...windows,windows[0]]})).toThrow();
});
