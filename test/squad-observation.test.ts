import {expect,test} from 'vitest';
import {continuousConfig,initialSquads,map,playWindow,point,width,type Plan,type Unit} from '../src/squads/game.js';
import {legalDestinationFeedback,squadCapabilities,squadReceipt} from '../server/squad-observation.js';

test('capability previews and execution receipts distinguish contact, authorization and pulses',()=>{
 const start=initialSquads(continuousConfig('tdm'));
 const place=(unit:Unit,x:number,y:number)=>Object.assign(unit,{x,y,at:x+y*width,anchor:x+y*width});
 place(start.units[0],12,3);place(start.units[5],14,3);
 const hold:Plan={intent:'Hold',orders:Array<string>(5).fill('-')};
 const pulse:Plan={intent:'Pulse',orders:['-/pulse','-','-','-','-']};
 expect(squadCapabilities(start,0)[0]).toEqual({slot:0,pulseContactNow:[14,3]});
 expect(squadCapabilities(start,0)[1].pulseContactNow).toBeNull();
 const noPulse=squadReceipt({start,frames:playWindow(start,[hold,hold],'squads-v3'),plan:hold},0);
 const applied=squadReceipt({start,frames:playWindow(start,[pulse,hold],'squads-v3'),plan:pulse},0);
 expect(noPulse.own[0]).toMatchObject({order:'-',movingTicks:0,pulses:0});
 expect(applied.own[0]).toMatchObject({order:'-/pulse',movingTicks:0,pulses:5});
 expect(applied.score).toEqual({own:1,rival:0});
 expect(applied.own.map(u=>u.slot)).toEqual([0,1,2,3,4]);
 expect(point(start.units[5].at)).toEqual([14,3]);
 expect(start.units[5].hp).toBe(100);
});

test('wall correction offers only valid destinations and leaves choice with the commander',()=>{
 const original='Slot 2 targets a wall or off-board cell at 14,7.';
 const feedback=legalDestinationFeedback(original);
 const destinations=feedback.slice(original.length).matchAll(/(\d+),(\d+)/g);
 const coordinates=Array.from(destinations,match=>[Number(match[1]),Number(match[2])]);
 expect(coordinates.length).toBeGreaterThan(0);
 expect(coordinates.every(([x,y])=>map[y]?.[x]&&map[y][x]!=='#'&&Math.abs(x-14)+Math.abs(y-7)<=2)).toBe(true);
 expect(legalDestinationFeedback('Slot 2 is defeated.')).toBe('Slot 2 is defeated.');
});
