import {initial,resolve,type State,type Action} from './game.js';
export type ReplayEvent={step:number;actions:[Action,Action];state:State};
export type StoredReplay={version:1;rulesVersion:'lane-v1';mapVersion:'dust-yard-prototype-v1';label:string;initialState:State;events:ReplayEvent[];result:'blue'|'sand'|'draw'};
const canonical=(value:unknown)=>JSON.stringify(value,(_key,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?
 Object.fromEntries(Object.entries(entry).sort(([left],[right])=>left<right?-1:left>right?1:0)):entry);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export function validateReplay(value:unknown):StoredReplay {
 if(!value||typeof value!=='object')throw Error('Invalid replay');
 const r=value as StoredReplay;
 if(r.version!==1||r.rulesVersion!=='lane-v1'||r.mapVersion!=='dust-yard-prototype-v1'||typeof r.label!=='string'||!same(r.initialState,initial())||!Array.isArray(r.events)||r.events.length<1||r.events.length>10)throw Error('Unsupported replay');
 let s=initial();
 for(const e of r.events){if(!e||!Array.isArray(e.actions)||e.actions.length!==2||!e.actions.every(a=>['wait','advance','attack','reload'].includes(a)))throw Error('Invalid replay action');s=resolve(s,e.actions);if(e.step!==s.step||!same(e.state,s))throw Error('Replay integrity check failed')}
 if(!s.result||s.result!==r.result)throw Error('Replay result mismatch');
 return r;
}
