import {GoogleGenAI} from '@google/genai';
import {z} from 'zod';
import {WIDTH,HEIGHT,walls,crates,destinations} from '../src/v2/yard.js';
import {rules,sides,type Side} from '../src/v2/game.js';
import {cellAt,center,unit} from '../src/v23/space.js';
import {destination} from '../src/v23/game.js';
import {advance,allows,assertConfig,initial,maxTicks,observation,revision,type Config,type Input,type State} from '../src/v25/game.js';
import {load,type Recording} from '../src/v25/replay.js';
import type {Attempt} from './match.js';

export const limits = {total:20,perSide:10,requestMs:8000,overallMs:60_000} as const;
export type Coach = {revision:string;text:string;memory?:{rulesVersion:string;revision:number;lessons:string[]}};
const planSchema = z.object({picks:z.array(z.object({choice:z.number().int().nonnegative(),
  repeat:z.number().int().min(1).max(3)}).strict()).max(4)}).strict();
const ordinary = ['attack','precision','reload','observe','peek','stop'] as const;
const minimumCheckpointMs = (config:Config) => config.mode === 'score-deathmatch' ? Math.ceil(config.limit/3/9) : 4000;

export function prompt(config:Config,state:State,side:Side,coach:Coach) {
  const current = observation(config,state,side);
  const choices:Input[] = ordinary.map(kind=>({kind}));
  if (config.mode === 'objective-duel') choices.push({kind:'interact'},{kind:'cancel-interaction'});
  choices.push({kind:'posture',posture:'upright'},{kind:'posture',posture:'crouch'});
  const cell = cellAt(current.agent.position,side === 1);
  for (const mode of ['walk','run','crouch'] as const) {
    for (const goal of destinations(cell,rules.modes[mode].steps,side === 1).keys()) {
      const move = {kind:'move',mode,to:center(goal)} as const;
      if (allows(config,state,side,move)) choices.push(move);
    }
  }
  for (const dx of [-1,0,1]) for (const dy of [-1,0,1]) {
    const jump = {kind:'steer',mode:'jump',dx,dy} as const;
    if (allows(config,state,side,jump)) choices.push(jump);
  }
  const memory = coach.memory?.rulesVersion === revision ? coach.memory : undefined;
  return {
    rulesVersion:revision, participant:config.participants[side], ...current,
    map:{version:config.mapVersion,width:WIDTH,height:HEIGHT,walls,crates,unit},
    coaching:{revision:coach.revision,text:coach.text.slice(0,500)},
    memory:memory ? {revision:memory.revision,lessons:memory.lessons.slice(0,3).map(text=>text.slice(0,160))} : null,
    task:'Compete under the public victory rules. Coaching guides preferences. Return picks in priority order. Each pick has a choice index and an explicit repeat count (1–3). At each boundary the first currently legal pick may execute, until its repetitions expire. Picks can wait for eligibility, expire at the next checkpoint and never generate substitute actions. Interest in a position does not require repeating movement. Time units are 1/3000 second.',
    choices:choices.map((input,index)=>({index,input,available:allows(config,state,side,input)})),
  };
}

type Reply = {text?:string;model?:string;input?:number;output?:number};
type Provider = (observation:ReturnType<typeof prompt>,signal:AbortSignal)=>Promise<Reply>;
type Command = {input:Input;remaining:number};
async function withinDeadline(work:Promise<Reply>,signal:AbortSignal) {
  let cancel!:() => void;
  const deadline = new Promise<never>((_resolve,reject)=>{
    cancel = () => reject(signal.reason);
    if (signal.aborted) cancel();
    else signal.addEventListener('abort',cancel,{once:true});
  });
  try {return await Promise.race([work,deadline]);}
  finally {signal.removeEventListener('abort',cancel);}
}

export async function playModeTrial(config:Config,coaches:readonly [Coach,Coach],provider:Provider,cancellation:AbortSignal,attempts:Attempt[]) {
  assertConfig(config);
  if (config.mode === 'elimination') throw Error('Only competitive V2.5 modes use protected trials');
  const stop = new AbortController();
  const signal = AbortSignal.any([cancellation,stop.signal,AbortSignal.timeout(limits.overallMs)]);
  const first = initial(config), requests = [0,0];
  const transcript:Recording['transcript'] = [], events:Recording['events'] = [];
  let state = first, next = 0;
  const queue:[Command[],Command[]] = [[],[]];
  const lastAttempt:Array<Attempt|undefined> = [undefined,undefined];
  const checkpoint = minimumCheckpointMs(config)*3;
  const expire = (side:Side) => {
    const attempt = lastAttempt[side];
    if (attempt) attempt.unexecuted = queue[side].reduce((count,entry)=>count+entry.remaining,0);
    queue[side] = [];
    lastAttempt[side] = undefined;
  };
  async function request(side:Side,current:State) {
    if (!current.fighters[side].hp) return;
    const view = prompt(config,current,side,coaches[side]);
    for (let number=1; number<=2; number++) {
      signal.throwIfAborted();
      if (requests[side]>=limits.perSide || requests[0]+requests[1]>=limits.total) throw Error('V2.5 request budget exhausted');
      requests[side]++;
      const start = performance.now();
      const deadline = AbortSignal.any([signal,AbortSignal.timeout(limits.requestMs)]);
      const attempt:Attempt = {side,step:current.tick,attempt:number,status:'provider error',ms:0,
        matchContext:view.match,coachingRevision:view.coaching.revision,memoryRevision:view.memory?.revision ?? 0};
      attempts.push(attempt);
      try {
        const reply = await withinDeadline(provider(view,deadline),deadline);
        deadline.throwIfAborted();
        Object.assign(attempt,{model:reply.model,input:reply.input,output:reply.output});
        let json:unknown;
        if ((reply.text?.length ?? 0) <= 1500) try {json = JSON.parse(reply.text ?? '');} catch { /* Invalid response. */ }
        const parsed = planSchema.safeParse(json);
        if (!parsed.success || parsed.data.picks.some(p=>!view.choices[p.choice]) ||
            new Set(parsed.data.picks.map(p=>p.choice)).size!==parsed.data.picks.length) throw Error('invalid');
        queue[side] = parsed.data.picks.map(p=>({input:view.choices[p.choice].input,remaining:p.repeat}));
        attempt.intents = queue[side].map(entry=>({input:entry.input,repeat:entry.remaining}));
        attempt.status = 'ok';
        lastAttempt[side] = attempt;
        return;
      } catch (error) {
        const code = (error as {status?:number})?.status;
        attempt.status = (error as Error)?.message === 'invalid' ? 'invalid' : code ? String(code)
          : signal.aborted ? 'cancelled' : deadline.aborted ? 'timeout' : 'provider error';
        if (attempt.status === '429' || number===2 || signal.aborted) {
          stop.abort();
          throw Error('V2.5 preparation interrupted ('+attempt.status+')');
        }
      } finally {attempt.ms = Math.round(performance.now()-start);}
    }
  }
  function input(side:Side) {
    const goal = destination(state.fighters[side]);
    const choice = queue[side].find(entry=>entry.remaining &&
      !(goal && entry.input.kind==='move' && entry.input.to.x===goal.x && entry.input.to.y===goal.y && entry.input.mode===state.fighters[side].motion?.mode) &&
      allows(config,state,side,entry.input));
    if (!choice) return null;
    choice.remaining--;
    return choice.input;
  }
  try {
    const bound = maxTicks(config);
    while (!state.result && state.tick < bound) {
      signal.throwIfAborted();
      if (state.time >= next) {
        sides.forEach(expire);
        const receipts = await Promise.allSettled(sides.map(side=>request(side,state)));
        const rejected = receipts.find(receipt=>receipt.status==='rejected');
        if (rejected) throw rejected.reason;
        next += checkpoint;
      }
      const inputs = [input(0),input(1)] as const;
      const frame = advance(config,state,inputs);
      state = frame.state;
      if (inputs[0] || inputs[1]) transcript.push([state.tick,inputs]);
      if (frame.events.length) events.push([state.tick,frame.events]);
      for (const event of frame.events) if (event.kind === 'defeat') expire(event.side);
    }
  } finally {sides.forEach(expire);}
  if (!state.result) throw Error('V2.5 trial exceeded its simulation bound');
  return load({version:5,source:'gemini',config,initialState:first,transcript,events,final:state}).recording;
}

// Invoked from the protected API only after the shared Arena reservation succeeds.
export function runGeminiV25(key:string,model:string,config:Config,coaches:[Coach,Coach],signal:AbortSignal,attempts:Attempt[]) {
  const ai = new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
  return playModeTrial(config,coaches,async (input,abortSignal)=>{
    const reply = await ai.models.generateContent({model,contents:JSON.stringify(input),config:{
      abortSignal,maxOutputTokens:256,responseMimeType:'application/json',responseJsonSchema:{
        type:'object',properties:{picks:{type:'array',maxItems:4,items:{type:'object',
          properties:{choice:{type:'integer',minimum:0,maximum:input.choices.length-1},repeat:{type:'integer',minimum:1,maximum:3}},
          required:['choice','repeat']}}},required:['picks']},
    }});
    return {text:reply.text,model:reply.modelVersion,input:reply.usageMetadata?.promptTokenCount,
      output:reply.usageMetadata?.candidatesTokenCount};
  },signal,attempts);
}
