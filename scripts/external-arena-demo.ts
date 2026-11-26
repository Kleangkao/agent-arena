import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {decodeSquadDestinations,squadCapabilities,squadDestinations,squadReceipt} from '../server/squad-observation.js';
import {tdmOrderAuthorization} from '../server/squads.js';
import {continuousConfig,initialSquads,loadSquads,maxTicks,observeSquads,parsePlan,playWindow,result,sites,squadModes,
 type Frame,type Pair,type Plan,type SquadReplay} from '../src/squads/game.js';

const version='arena-commander-stdio/v1';
const envelope=z.object({version:z.literal(version),matchId:z.uuid(),requestId:z.uuid(),side:z.literal('Blue')});
const ordersResponse=envelope.extend({type:z.literal('orders'),intent:z.string().min(1).max(120),
 orders:z.array(z.string().max(17)).length(5),pulseSlots:z.array(z.number().int().min(0).max(4)).max(5).optional(),
}).strict();
const outcomeSchema=z.enum(['blue','sand','draw']);
const ackResponse=envelope.extend({type:z.literal('acknowledged'),outcome:outcomeSchema}).strict();
const executable=fileURLToPath(new URL('./external-commander.mjs',import.meta.url));
const bound=8192;

function exchange(request:object):Promise<unknown>{
 const input=JSON.stringify(request);
 if(Buffer.byteLength(input)>bound)throw Error('External request exceeds the payload limit');
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[executable],{stdio:['pipe','pipe','ignore'],windowsHide:true,env:{}});
  const chunks:Buffer[]=[];
  let size=0;
  const fail=(error:Error)=>{clearTimeout(timeout);child.kill();reject(error);};
  const timeout=setTimeout(()=>fail(Error('External commander timed out')),2000);
  child.on('error',fail);
  child.stdin.on('error',fail);
  child.stdout.on('data',(chunk:Buffer)=>{
   size+=chunk.length;
   if(size>bound){fail(Error('External response exceeds the payload limit'));return;}
   chunks.push(chunk);
  });
  child.on('close',code=>{
   clearTimeout(timeout);
   if(code!==0){reject(Error('External commander exited without a valid response'));return;}
   try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}
  });
  child.stdin.end(input);
 });
}

function verifyScope(expected:z.infer<typeof envelope>,response:z.infer<typeof envelope>){
 if(response.matchId!==expected.matchId||response.requestId!==expected.requestId)throw Error('External commander response scope mismatch');
}

function validateOrders(expected:z.infer<typeof envelope>,response:unknown,frame:Frame){
 const parsed=ordersResponse.parse(response);
 verifyScope(expected,parsed);
 const {intent,orders,pulseSlots}=parsed;
 if((frame.mode==='tdm')!==(pulseSlots!==undefined))throw Error('Explicit pulse slots are only valid in TDM');
 const decoded=decodeSquadDestinations({intent,orders,...(pulseSlots?{pulseSlots}:{})});
 if(frame.mode!=='tdm')return parsePlan(decoded,frame,0);
 const authorized=tdmOrderAuthorization(decoded);
 if(authorized===decoded)throw Error('Invalid pulse authorization');
 return parsePlan(authorized,frame,0);
}

function sandPlan(frame:Frame):Plan{
 return parsePlan({intent:'Arena local scripted opponent.',orders:frame.units.filter(unit=>unit.side===1).map(unit=>{
  if(!unit.hp)return '-';
  const [x,y]=sites[frame.objective?.phase==='disable'||frame.objective?.phase==='countdown'?frame.objective.site:unit.slot%2];
  const action=frame.mode==='bomb'?(unit.slot<2?'/link':'/pulse'):frame.mode==='tdm'?'/pulse':'';
  return `${x+unit.slot%3-1},${y+Math.floor(unit.slot/3)}${action}`;
 })},frame,1);
}

const output='evidence/external-commander';
mkdirSync(output,{recursive:true});
const summary=[];
for(const mode of squadModes){
 const config=continuousConfig(mode);
 const matchId=randomUUID();
 const scope=()=>({version,matchId,requestId:randomUUID(),side:'Blue'} as const);
 let frame=initialSquads(config);
 let previous:ReturnType<typeof squadReceipt>|null=null;
 const windows:SquadReplay['windows']=[];
 const trace=[];
 while(!result(frame)){
  const expected=scope();
  const request={...expected,type:'checkpoint',config,observation:observeSquads(frame,0),destinations:squadDestinations,
   availableActions:mode==='tdm'?['move','hold','pulseSlots']:mode==='bomb'?['move','hold','link','pulse']:['move','hold','automatic pulse'],
   capabilities:squadCapabilities(frame,0),previous};
  const response=await exchange(request);
  const plan=validateOrders(expected,response,frame);
  // Reusing a valid response in a later window or with a different match must fail even if its orders are still legal.
  assert.throws(()=>validateOrders(scope(),response,frame),/scope mismatch/);
  assert.throws(()=>validateOrders({...expected,matchId:randomUUID()},response,frame),/scope mismatch/);
  assert.throws(()=>validateOrders(expected,{...(response as object),side:'Sand'},frame));
  assert.throws(()=>validateOrders(expected,{...(response as object),orders:['A99','-','-','-','-']},frame),/unknown destination/);
  if(mode==='tdm')assert.throws(()=>validateOrders(expected,{...(response as object),pulseSlots:[0,0]},frame),/pulse authorization/);
  const plans:Pair<Plan>=[plan,sandPlan(frame)];
  windows.push(plans);
  const frames=playWindow(frame,plans,config.rulesVersion);
  previous=squadReceipt({start:frame,frames,plan},0,true);
  frame=frames.at(-1)!;
  trace.push({request,response,receipt:previous});
  assert.ok(frame.tick<=maxTicks+12);
 }
 const final=outcomeSchema.parse(result(frame));
 const replay=loadSquads({version:7,config,windows,final,source:'scripted-practice',interruption:null}).replay;
 const terminal={...scope(),type:'finished',outcome:final,tick:frame.tick,score:frame.score,previous};
 const acknowledged=ackResponse.parse(await exchange(terminal));
 verifyScope(terminal,acknowledged);
 assert.equal(acknowledged.outcome,final);
 const row={matchId,mode,outcome:final,tick:frame.tick,score:frame.score,checkpoints:windows.length,accepted:windows.length,terminalAcknowledged:true};
 summary.push(row);
 writeFileSync(`${output}/${mode}.json`,JSON.stringify({version,provenance:'local-deterministic-process',replay,trace,terminal,acknowledged},null,2)+'\n');
}
writeFileSync(`${output}/summary.json`,JSON.stringify({version,provenance:'local-deterministic-process',checks:
 ['wrong match','wrong role','reused response','unknown destination','duplicate pulse authorization','authoritative replay','terminal acknowledgement'],matches:summary},null,2)+'\n');
console.log(JSON.stringify(summary));
