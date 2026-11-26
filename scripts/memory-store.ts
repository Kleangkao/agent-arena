import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
const memorySchema=z.object({revision:z.number().int().nonnegative(),lessons:z.array(z.string().min(1).max(120)).max(3),matches:z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100)}).strict();
export type Memory=z.infer<typeof memorySchema>;
export function matchId(data:unknown){return createHash('sha256').update(JSON.stringify(data)).digest('hex')}
export function loadMemory(dir:string,agent:string):Memory {if(!/^[a-z0-9-]{1,40}$/.test(agent))throw Error('Invalid agent');const path=join(dir,agent+'.json');return existsSync(path)?memorySchema.parse(JSON.parse(readFileSync(path,'utf8'))):{revision:0,lessons:[],matches:[]}}
export function saveReflection(dir:string,agent:string,match:string,lessons:string[]):Memory {const old=loadMemory(dir,agent);if(old.matches.includes(match))return old;const next=memorySchema.parse({revision:old.revision+1,lessons,matches:[...old.matches,match]});mkdirSync(dir,{recursive:true});const path=join(dir,agent+'.json'),tmp=path+'.tmp';writeFileSync(tmp,JSON.stringify(next,null,2),{mode:0o600});renameSync(tmp,path);return next}
