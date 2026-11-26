import {z} from 'zod';
import {WIDTH, HEIGHT, walls, crates} from '../src/v2/yard.js';
import type {Side} from '../src/v2/game.js';
import {allows, observation, type Config, type Input, type State} from '../src/v24/objective.js';
import {unit} from '../src/v23/space.js';

// Proposed local provider trial limits, independent of the simulator's update rate.
export const trialLimits = {checkpointMs:3000, maxPerSide:10, maxTotal:20, requestTimeoutMs:8000, overallMs:60_000} as const;
type Coach = {text:string; revision:string; memory?:{rulesVersion:string; revision:number; lessons:string[]}};
const intent = z.union([
  z.object({kind:z.enum(['attack','precision','reload','observe','peek','stop','interact','cancel-interaction'])}).strict(),
  z.object({kind:z.literal('posture'),posture:z.enum(['upright','crouch'])}).strict(),
  z.object({kind:z.literal('move'),mode:z.enum(['walk','run','crouch','jump']),to:z.object({x:z.number().int(),y:z.number().int()}).strict()}).strict(),
]);
const reply = z.object({intents:z.array(intent).max(2)}).strict();

export function objectivePrompt(config: Config,state: State,side: Side,coach: Coach) {
  const current = observation(config,state,side);
  const memory = coach.memory?.rulesVersion === config.rulesVersion ? coach.memory : undefined;
  return {
    rulesVersion:config.rulesVersion, map:{version:config.mapVersion,width:WIDTH,height:HEIGHT,unit,walls,crates},
    participant:config.participants[side], observation:current,
    coaching:{revision:coach.revision,text:coach.text.slice(0,500)},
    memory:memory ? {revision:memory.revision,lessons:memory.lessons.slice(0,3).map(text=>text.slice(0,160))} : null,
    instructions:'Play the fictional arcade game. Choose zero to two ordered intents. A move supplies a fixed-point target and mode. You may queue a Core interaction after movement, or select another action. The controller executes only the next listed intent when legal and never picks a replacement. An unexecuted intent expires at the next checkpoint. A simulation time unit is 1/3000 second.',
  };
}

export function readObjectivePlan(json: string): Input[] {
  if (json.length > 1200) throw Error('Objective plan too large');
  return reply.parse(JSON.parse(json)).intents;
}

// Invalid/temporarily unavailable actions remain pending and cannot bypass game rules.
export function nextObjectiveIntent(config: Config,state: State,side: Side,queue: Input[]) {
  const next = queue[0];
  return next && allows(config,state,side,next) ? queue.shift()! : null;
}
