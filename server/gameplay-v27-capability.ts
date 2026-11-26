import {z} from 'zod';
import {authorize,condition,execute,parsePlan,planSchema,stage,type View} from '../src/v26/controller.js';
import type {Config} from '../src/v26/config.js';

const ownCapability=z.enum(['standard','precision','stopAndPrecision','reload','jump','core','cancel','move'] satisfies (keyof View['legal'])[]);
const predicate=z.object({kind:z.literal('capability-available'),capability:ownCapability}).strict();
const experimentalStage=stage.extend({when:z.union([condition,predicate]).optional()});
const experimentalPlan=planSchema.extend({stages:z.array(experimentalStage).min(1).max(4)}).strict();

/** Private expressiveness experiment. Uses the same validated packets and execution rules. */
export function capabilityPlan(input:unknown,c:Config,initial:View) {
  const spec=experimentalPlan.parse(input);
  const execution=authorize(parsePlan({...spec,stages:spec.stages.map(s=>typeof s.when==='object'?{...s,when:'grounded'}:s)},c),initial.time);
  return {
    spec,
    next:(view:View)=>execute(execution,view,index=>{
      const guard=spec.stages[index].when;
      return typeof guard==='object'?view.legal[guard.capability]:undefined;
    }),
  };
}
