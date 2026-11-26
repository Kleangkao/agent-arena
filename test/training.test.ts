import {expect,it} from 'vitest';
import {initial,resolve} from '../src/game';
import {stages,trainingAgent,trainingOpponent,trainingProgress} from '../src/competition';

it('gives guest practice a legal path to victory in every published stage',()=>{
 for(const [index] of stages.entries()){
  let state=initial();
  while(!state.result)state=resolve(state,[trainingAgent(state),trainingOpponent(state,index)]);
  expect(state.result).toBe('blue');
  expect(state.step).toBeLessThanOrEqual(10);
 }
});

it('advances training on a win only and preserves a clear when replaying a stage',()=>{
 const cleared:string[]=[];
 expect(trainingProgress(cleared,0,'sand')).toBe(cleared);
 expect(trainingProgress(cleared,0,'draw')).toBe(cleared);
 const victory=trainingProgress(cleared,0,'blue');
 expect(victory).toEqual(['first-round']);
 expect(trainingProgress(victory,0,'blue')).toBe(victory);
 expect(trainingProgress(victory,0,'sand')).toBe(victory);
});
