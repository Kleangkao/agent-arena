import {canonical} from '../v25/game.js';
import {assertConfig,type Config} from './config.js';
import {advance,initial,maxTicks,type Frame,type Inputs,type State} from './game.js';

export type Source = 'manual-sandbox'|'development-policy'|'injected-provider'|'operator-attested-gemini';
export type Interruption = {kind:'technical-interrupted';reason:'budget'|'timeout'|'provider'|'cancelled';side?:0|1};
export type Recording = {version:6;source:Source;config:Config;initialState:State;
  transcript:[tick:number,inputs:Inputs][];observations:[tick:number,events:Frame['events'],receipts:Frame['receipts']][];
  final:State;interruption:Interruption|null};
export function begin(config:Config,source:Source):Recording {
  assertConfig(config);
  const state=initial(config);
  return {version:6,source,config,initialState:state,transcript:[],observations:[],final:state,interruption:null};
}
export function append(r:Recording,inputs:Inputs):Frame {
  const frame=advance(r.config,r.final,inputs);
  const tick=frame.state.tick;
  if(inputs[0]!==null||inputs[1]!==null) r.transcript.push([tick,inputs]);
  if(frame.events.length||frame.receipts.some(a=>a.length)) r.observations.push([tick,frame.events,frame.receipts]);
  r.final=frame.state;
  return frame;
}
export function record(c:Config,source:Source,next:(s:State)=>Inputs) {
  const r=begin(c,source);
  while(!r.final.result&&r.final.tick<maxTicks(c)) append(r,next(r.final));
  if(!r.final.result) throw Error('V2.6 did not settle');
  return r;
}
export function load(input:unknown) {
  const r=input as Recording;
  if(!r||r.version!==6||!['manual-sandbox','development-policy','injected-provider','operator-attested-gemini'].includes(r.source))
    throw Error('Unsupported V2.6 replay');
  assertConfig(r.config);
  const cap=maxTicks(r.config), count=r.final?.tick;
  if(!Number.isInteger(count)||count<0||count>cap||!Array.isArray(r.transcript)||r.transcript.length>count||
    !Array.isArray(r.observations)||r.observations.length>count) throw Error('Invalid V2.6 replay bounds');
  let previous=0;
  for(const item of r.transcript) {
    if(!Array.isArray(item)||item.length!==2||!Number.isInteger(item[0])||item[0]<=previous||item[0]>count||
      !Array.isArray(item[1])||item[1].length!==2||item[1].every(p=>p===null)) throw Error('Invalid V2.6 transcript');
    previous=item[0];
  }
  const generated=begin(r.config,r.source), frames:Frame[]=[];
  let cursor=0;
  for(let tick=1;tick<=count;tick++) frames.push(append(generated,r.transcript[cursor]?.[0]===tick?r.transcript[cursor++][1]:[null,null]));
  const incident=r.interruption;
  if(incident!==null) {
    if(generated.final.result || !incident || incident.kind!=='technical-interrupted' ||
      !['budget','timeout','provider','cancelled'].includes(incident.reason) ||
      (incident.side!==undefined&&incident.side!==0&&incident.side!==1)) throw Error('Invalid V2.6 interruption');
    generated.interruption={kind:incident.kind,reason:incident.reason,...(incident.side===undefined?{}:{side:incident.side})};
  } else if(!generated.final.result) throw Error('V2.6 replay is incomplete');
  if(canonical(r)!==canonical(generated)) throw Error('V2.6 replay mismatch');
  return {recording:generated,frames};
}
