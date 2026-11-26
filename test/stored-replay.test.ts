import {describe,it,expect} from 'vitest';
import fixture from '../src/fixtures/historical-gemini.json';
import twoTurn from '../src/fixtures/two-turn-gemini.json';
import {validateReplay} from '../src/replay';
describe('stored genuine replay',()=>{it('validates every authoritative event and result',()=>{const r=validateReplay(fixture);expect(r.events).toHaveLength(10);expect(r.result).toBe('blue')});it('rejects changed state, action, version and result',()=>{for(const edit of [(x:any)=>x.events[3].state.fighters[0].hp=1,(x:any)=>x.events[0].actions[0]='attack',(x:any)=>x.version=2,(x:any)=>x.result='sand']){const x=structuredClone(fixture);edit(x);expect(()=>validateReplay(x)).toThrow()}})});
it('plays the completed seven-turn Gemini fixture under the same rules and map versions',()=>{
 const r=validateReplay(twoTurn);
 expect(r.events).toHaveLength(7);
 expect(r.events.at(-1)?.state.fighters.map(fighter=>fighter.hp)).toEqual([25,0]);
 expect(r.result).toBe('blue');
 expect([r.rulesVersion,r.mapVersion]).toEqual([fixture.rulesVersion,fixture.mapVersion]);
});
it('accepts PostgreSQL JSONB key order without accepting changed combat state',()=>{
 const reordered=JSON.parse(JSON.stringify(twoTurn,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?
  Object.fromEntries(Object.entries(value).reverse()):value));
 expect(validateReplay(reordered).result).toBe(twoTurn.result);
 reordered.events[0].state.fighters[0].hp=99;
 expect(()=>validateReplay(reordered)).toThrow('Replay integrity check failed');
});
