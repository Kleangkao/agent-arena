import {GoogleGenAI} from '@google/genai';
import {z} from 'zod';
import {initial,legal,resolve} from '../src/game.js';
import {validateReplay,type ReplayEvent} from '../src/replay.js';
import type {SquadGuidance} from './squad-guidance.js';

const actions=['attack','advance','reload','wait'] as const;
const action=z.enum(actions);
const rank=z.array(action).length(4).refine(a=>new Set(a).size===4);
const windowSchema=z.object({now:action,next:rank}).strict();
export type Coach={text:string; revision:string; memory:{revision:number;lessons:string[]}; guidance?:SquadGuidance};
export type Attempt={step:number;side:number;attempt:number;ms:number;status:string;input?:number;output?:number;model?:string;
 intents?:{input:import('../src/v25/game.js').Input;repeat:number}[];unexecuted?:number;coachingRevision?:string;memoryRevision?:number;
 plan?:import('../src/v26/controller.js').Execution['plan'];failure?:string;
 matchContext?:ReturnType<typeof import('../src/v25/game.js').observation>['match']};
export async function runMatch(key:string, model:string, coaches:[Coach,Coach], signal:AbortSignal, attempts:Attempt[]) {
 const provider=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
 const events:ReplayEvent[]=[];
 let state=initial();
 while(!state.result){
  const snapshot=state;
  const plans=await Promise.allSettled(coaches.map(async (coach,side)=>{
   const allowed=legal(snapshot,side);
   const you=snapshot.fighters[side],rival=snapshot.fighters[1-side];
   for(let attempt=1;attempt<=2;attempt++){
    signal.throwIfAborted();
    const started=performance.now();
    try{
     const response=await provider.models.generateContent({
      model,
      contents:JSON.stringify({
       objective:'Win this fictional board game. Coaching adjusts preferences without overriding the win objective. Each turn is simultaneous. First zero health ends the game; after ten turns higher health wins. Equal health draws.',
       rules:{wait:'spend a turn without changing resources or position',attack:'within three spaces, spend one ammo, subtract 25 health',reload:'restore ammo to three',advance:'move one space toward rival; simultaneous moves into the same space are cancelled'},
       task:'Choose a legal action now, then rank all four actions for the next turn. The engine will choose your highest ranked legal action at that time.',
       remaining:10-snapshot.step,you,rival,allowed,
       distance:Math.abs(you.position-rival.position),healthLead:you.hp-rival.hp,
       coaching:coach.text,memory:coach.memory.lessons
      }),
      config:{responseMimeType:'application/json',responseJsonSchema:{type:'object',properties:{now:{type:'string',enum:allowed},next:{type:'array',items:{type:'string',enum:actions},minItems:4,maxItems:4}},required:['now','next']},maxOutputTokens:300,abortSignal:AbortSignal.any([signal,AbortSignal.timeout(12000)])}
     });
     let raw:unknown;
     try{raw=JSON.parse(response.text??'');}catch{throw Error('invalid');}
     const plan=windowSchema.safeParse(raw);
     if(!plan.success||!allowed.includes(plan.data.now))throw Error('invalid');
     attempts.push({step:snapshot.step,side,attempt,ms:Math.round(performance.now()-started),status:'ok',input:response.usageMetadata?.promptTokenCount,output:response.usageMetadata?.candidatesTokenCount,model:response.modelVersion});
     return plan.data;
    }catch(error){
     const code=(error as {status?:number}).status;
     const name=(error as Error).name;
     const status=(error as Error).message==='invalid'?'invalid':code?String(code):name==='AbortError'||name==='TimeoutError'?'timeout':'provider error';
     attempts.push({step:snapshot.step,side,attempt,ms:Math.round(performance.now()-started),status});
     if(attempt===2||signal.aborted||status==='429')throw Error('AI preparation interrupted. Try again shortly.');
     await new Promise(resolve=>setTimeout(resolve,900));
    }
   }
   throw Error('Decision budget exhausted');
  }));
  const [blue,sand]=plans;
  if(blue.status!=='fulfilled'||sand.status!=='fulfilled')throw Error('AI preparation interrupted. Try again shortly.');
  signal.throwIfAborted();
  const first:[typeof actions[number],typeof actions[number]]=[blue.value.now,sand.value.now];
  state=resolve(state,first);
  events.push({step:state.step,actions:first,state});
  if(state.result)break;
  const second:typeof first=[blue.value.next.find(a=>legal(state,0).includes(a))!,sand.value.next.find(a=>legal(state,1).includes(a))!];
  state=resolve(state,second);
  events.push({step:state.step,actions:second,state});
 }
 return validateReplay({version:1,rulesVersion:'lane-v1',mapVersion:'dust-yard-prototype-v1',label:'Gemini Arena match',initialState:initial(),events,result:state.result});
}
