import {GoogleGenAI} from '@google/genai';
import {z} from 'zod';
import {type Frame,type Plan,type Side,type Pair,type SquadConfig,type SquadReplay,arenaPolicyVersion,initialSquads,loadSquads,map,maxTicks,observeSquads,parsePlan,playWindow,result,sites,territoryRules,winScore,windowTicks,type ArenaDifficulty,type ArenaOpponentId} from '../src/squads/game.js';
import {arenaBotPlan} from '../src/squads/arena-bots.js';
import {objectiveRules,tdmTarget} from '../src/squads/continuous.js';
import type {Attempt,Coach} from './match.js';
import {blockedColumnsByRow,decodeSquadDestinations,legalDestinationFeedback,squadCapabilities,squadDestinations,squadReceipt,type SquadWindow} from './squad-observation.js';

export type Commander=(frame:Frame,side:Side,signal:AbortSignal,feedback?:string,previous?:SquadWindow)=>Promise<unknown>;
type Interruption=NonNullable<SquadReplay['interruption']>;
const providerStatus=(error:unknown)=>typeof error==='object'&&error&&'status' in error&&typeof error.status==='number'?String(error.status):
 error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError')?'timeout':'provider-error';
const tdmOutput=z.object({intent:z.string(),orders:z.array(z.string().regex(/^(?:-|\d{1,2},\d{1,2}(?:>\d{1,2},\d{1,2})?)$/)).max(20),
 pulseSlots:z.array(z.number().int().nonnegative().max(19)).max(20)}).strict();
export function tdmOrderAuthorization(input:unknown){
 const parsed=tdmOutput.safeParse(input);
 if(!parsed.success)return input;
 const {intent,orders,pulseSlots}=parsed.data;
 if(new Set(pulseSlots).size!==pulseSlots.length||pulseSlots.some(slot=>slot>=orders.length))return input;
 return {intent,orders:orders.map((order,i)=>pulseSlots.includes(i)?order+'/pulse':order)};
}

export async function commandMatch(config:SquadConfig,commander:Commander,signal:AbortSignal,attempts:Attempt[],
 normalize:(raw:unknown,frame:Frame)=>unknown=raw=>raw,opponent?:{plan:(frame:Frame)=>unknown;challenge:NonNullable<SquadReplay['challenge']>}){
 let frame=initialSquads(config);
 const windows:SquadReplay['windows']=[];
 let interruption:Interruption|null=null;
 let retries=4;
 let previous:Pair<SquadWindow>|undefined;
 async function localSand(snapshot:Frame):Promise<Plan>{
  const row:Attempt={side:1,step:snapshot.tick,attempt:1,status:'invalid-orders',ms:0};
  attempts.push(row);
  const begin=performance.now();
  try{
   const plan=parsePlan(opponent!.plan(snapshot),snapshot,1);
   row.status='accepted';
   return plan;
  }finally{row.ms=Math.round(performance.now()-begin);}
 }
 async function request(snapshot:Frame,side:Side):Promise<Plan>{
  if(side===1&&opponent)return localSand(snapshot);
  const started=performance.now();
  let feedback:string|undefined;
  for(let attempt=1;attempt<=2;attempt++){
   signal.throwIfAborted();
   const row:Attempt={side,step:snapshot.tick,attempt,status:'provider-error',ms:0};
   attempts.push(row);
   const begin=performance.now();
   try{
    const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(6500)]);
    const raw=await commander(snapshot,side,requestSignal,feedback,previous?.[side]);
    row.status='invalid-orders';
    const plan=parsePlan(normalize(raw,snapshot),snapshot,side);
    row.status='accepted';
    return plan;
   }catch(error){
    if(row.status==='invalid-orders'){
     feedback=error instanceof Error?error.message:'Return a complete legal team plan.';
     row.failure=feedback;
    }else row.status=providerStatus(error);
    if((row.status!=='503'&&row.status!=='invalid-orders')||attempt>=2||!retries||performance.now()-started>7500||signal.aborted)throw Error(row.status);
    retries--;
   }finally{row.ms=Math.round(performance.now()-begin);}
   if(!feedback)await new Promise(resolve=>setTimeout(resolve,650+side*100));
  }
  throw Error('provider-error');
 }
 while(!result(frame)){
  const [blue,sand]=await Promise.allSettled([request(frame,0),request(frame,1)]);
  if(blue.status==='rejected'||sand.status==='rejected'){
   const codes=[blue,sand].flatMap(r=>r.status==='rejected'&&r.reason instanceof Error?[r.reason.message]:[]);
   interruption=codes.includes('429')?'rate-limit':signal.aborted||codes.includes('timeout')?'timeout':codes.includes('invalid-orders')?'invalid-orders':'provider';
   break;
  }
  const plans:Pair<Plan>=[blue.value,sand.value];
  windows.push(plans);
  const frames=playWindow(frame,plans,config.rulesVersion);
  previous=[{start:frame,frames,plan:plans[0]},{start:frame,frames,plan:plans[1]}];
  frame=frames.at(-1)!;
 }
 return loadSquads({version:7,config,source:opponent?'arena-challenge':'operator-attested-gemini',windows,final:result(frame),interruption,
  ...(opponent?{challenge:opponent.challenge}:{})}).replay;
}

export function runGeminiSquads(key:string,model:string,config:SquadConfig,coaches:Pair<Coach>,signal:AbortSignal,attempts:Attempt[],
 options:{feedback?:boolean;navigation?:boolean;sand?:(frame:Frame)=>unknown;challenge?:NonNullable<SquadReplay['challenge']>;
  capture?:(row:{side:Side;tick:number;input:unknown;response:string|null})=>void}={}){
 const client=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
 const navigation='mode' in config&&options.navigation!==false;
 return commandMatch(config,async(frame,side,abortSignal,feedback,previous)=>{
  if(options.sand&&side!==0)throw Error('Arena bot matches do not ask the model for Sand.');
  const base='Both teams start at 100 HP per unit. Pulses deal 20, halved in cover, every second tick. The engine chooses the nearest eligible rival within four world units; walls block sight. You see the whole game board.';
  const race=`Race to ${winScore} points. Uncontested living units in a relay 3×3 zone earn one point per tick. Elimination wins. Higher score at tick ${maxTicks} wins; ties draw.`;
  const territory=`Relay is persistent territory control. Each site is a 3×3 zone. ${territoryRules.captureTicks} uncontested occupation ticks capture a neutral site or recapture a rival site; no extra benefit from more units in the zone. The owner receives ${territoryRules.pointsPerTick} point per tick per site even when empty or being recaptured. A contested site pauses both progress and scoring while both sides are present. A vacant site or the owner alone resets an unfinished claim without changing ownership. Territory owner, occupancy and claimant use side IDs (0 Blue, 1 Sand). changedAt records the last ownership change. Win by elimination, first to ${territoryRules.winScore}, or leading at tick ${territoryRules.maxTicks}. Ties draw.`;
  const explicitPulse=frame.mode==='tdm'||!!frame.territory;
  const modeRules=frame.mode==='tdm'? `Team Deathmatch. Race to ${tdmTarget} eliminations. At tick ${maxTicks} higher score wins; ties draw. Sites are inactive. Defeated units return to their own spawn at least four ticks later and hold until your next checkpoint. Only slots in pulseSlots can emit a pulse.`
   :frame.mode==='bomb'?`Bomb Mode is an abstract Core game. Blue attacks, Sand defends. Blue can link either site; Sand can disable the linked site. One living /link slot must finish its route and spend ${objectiveRules.activate} ticks undamaged at the site to activate. Then Blue wins after a ${objectiveRules.countdown}-tick countdown unless one living Sand /link slot at that site stays undamaged for ${objectiveRules.disable} ticks and disables it. Damage or switching actor resets progress. Without activation by tick ${maxTicks}, Sand wins. Before activation elimination ends the game; after activation the countdown continues even if Blue is eliminated. Link slots cannot pulse. Pulses require /pulse.`
   :frame.territory?territory:race+' All units pulse automatically.';
  const actions=frame.mode==='bomb'?' Append /link to a slot order to authorize the site interaction at its final stop, or /pulse to authorize a pulse throughout the window.'
   :explicitPulse? ' Movement orders contain no suffix. In the required pulseSlots array list the zero-based living slots permitted to pulse in this window. Movement alone never pulses. An empty pulseSlots array explicitly keeps every unit silent.'+(navigation?'':' Example for a five-unit team: {"intent":"Send two units with pulse permission","orders":["12,3","-","-","-","-"],"pulseSlots":[0,1]}.'):'';
  const evidence=frame.mode&&options.feedback!==false;
  const input={
    task:'You command an entire team in a fictional geometric arcade board game. Try to win. Respect coaching when it helps. Return a short spectator intent and exactly one order per own unit, in slot order. Return only JSON.',
    rules:`${modeRules} Orders run for ${windowTicks} ticks simultaneously; then you receive a fresh board and may reassign everyone. ${frame.mode?'Units move 0.75 world units per tick via grid-aligned paths.':'Units move one orthogonal cell per tick and pulse range uses Manhattan distance.'} Use distinct goals so units can pass. ${base}`,
    terrain:{legend:'. floor, # wall, + cover. Coordinates x then y, zero based. y increases down.',rows:map,relays:{north:sites[0],south:sites[1]},
     ...(evidence&&!navigation?{blockedColumnsByRow,navigationHint:'For target x,y, reject x if named in blockedColumnsByRow[y]. This applies to each waypoint.'}:{})},
    ...(navigation?{destinations:squadDestinations}:{}),
    format:(navigation
     ?'Copy a destination ID from destinations.options for a goal. Syntax examples only: "D12" for one goal, "D12>D14" for two sequential waypoints, or "-" to hold. Orders use IDs verbatim and never x,y coordinates. The listed destinations are connected by floor routes. A unit can cover at most 9 world units this window, and wall detours and other units can delay arrival.'
     :'For each slot use "x,y" for a goal, "x,y>x,y" for two sequential waypoints, or "-" to hold.')+actions+' Dead units must have "-". Keep intent to 120 characters.',
    coaching:coaches[side].guidance?.prompt??coaches[side].text,observation:observeSquads(frame,side),
    ...(evidence?{
     actionFeedback:'pulseContactNow is an eligible target at this exact snapshot, before movement; a unit might gain or lose contact during execution. Authorizing a pulse enables it when eligible; it does not guarantee one. Last-window counts come from the simulator. Intent text never authorizes actions. Compare the events with your goals and adjust if needed.',
     capabilities:squadCapabilities(frame,side),...(previous?{ownLastWindow:squadReceipt(previous,side,navigation)}:{})
    }:{}),
    ...(feedback?{validationFeedback:(evidence&&!navigation?legalDestinationFeedback(feedback):feedback)+
     ' Author a complete replacement plan for the same snapshot.'}:{}),
  };
  const response=await client.models.generateContent({
   model,contents:JSON.stringify(input),
   config:{abortSignal,candidateCount:1,maxOutputTokens:512,responseMimeType:'application/json',
    responseJsonSchema:{type:'object',properties:{intent:{type:'string'},orders:{type:'array',items:{type:'string'}},
     ...(explicitPulse?{pulseSlots:{type:'array',items:{type:'integer'}}}:{})},
     required:explicitPulse?['intent','orders','pulseSlots']:['intent','orders']}},
  });
  const row=[...attempts].reverse().find(row=>row.side===side&&row.step===frame.tick);
  if(row)Object.assign(row,{model:response.modelVersion??model,input:response.usageMetadata?.promptTokenCount,
   output:response.usageMetadata?.candidatesTokenCount,coachingRevision:coaches[side].revision});
  options.capture?.({side,tick:frame.tick,input,response:response.text??null});
  try{return JSON.parse(response.text??'') as unknown;}catch{return null;}
 },signal,attempts,(raw,frame)=>{
  const plan=navigation?decodeSquadDestinations(raw):raw;
  if(frame.mode!=='tdm'&&!frame.territory)return plan;
  const authorized=tdmOrderAuthorization(plan);
  if(authorized===plan)throw Error('Return movement-only orders and a pulseSlots array of distinct living slot numbers.');
  return authorized;
 },options.sand&&options.challenge?{plan:options.sand,challenge:options.challenge}:undefined);
}

export function runChallengeSquads(key:string,model:string,config:SquadConfig,coaches:Pair<Coach>,signal:AbortSignal,attempts:Attempt[],
 difficulty:ArenaDifficulty,opponent:ArenaOpponentId,options?:Parameters<typeof runGeminiSquads>[6]){
 return runGeminiSquads(key,model,config,coaches,signal,attempts,{...options,sand:frame=>arenaBotPlan(frame,difficulty),
  challenge:{format:'challenge',difficulty,policy:arenaPolicyVersion,opponent}});
}
