import {GoogleGenAI} from '@google/genai';
import {z} from 'zod';
import type {StoredReplay} from '../src/replay';

const schema=z.object({lessons:z.array(z.string().trim().min(1).max(120)).min(1).max(3)}).strict();
export async function reflect(key:string, model:string, replay:StoredReplay, previous:string[]) {
 const ai=new GoogleGenAI({apiKey:key,httpOptions:{retryOptions:{attempts:1}}});
 const reply=await ai.models.generateContent({
  model,
  contents:JSON.stringify({task:'For Blue in this fictional game, write one to three reusable, concise lessons, maximum 120 characters each. Use only the supplied match and earlier lessons.',previous,events:replay.events,result:replay.result}),
  config:{responseMimeType:'application/json',responseJsonSchema:{type:'object',properties:{lessons:{type:'array',items:{type:'string'},minItems:1,maxItems:3}},required:['lessons']},maxOutputTokens:350,abortSignal:AbortSignal.timeout(12000)}
 });
 return schema.parse(JSON.parse(reply.text??'')).lessons;
}
