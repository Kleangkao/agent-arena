import {readFileSync,writeFileSync} from 'node:fs';
import {runMatch,type Attempt,type Coach} from '../server/match';
import {loadMemory} from './memory-store';

const key=process.env.GEMINI_API_KEY || readFileSync(process.env.GEMINI_KEY_FILE!,'utf8').split(/\r?\n/).find(x=>x.trim())!.trim();
const model=process.env.GEMINI_MODEL!;
const memory=process.env.EQUAL_MEMORY==='1'?{revision:0,lessons:[]}:loadMemory('evidence/local-memory','local-blue');
const coaches:[Coach,Coach]=[
 {text:'Press the advantage early and keep pressure when legal.',revision:'1',memory},
 {text:'Conserve resources when there is a clear benefit, but contest the win.',revision:'1',memory:{revision:0,lessons:[]}}
];
if(process.env.SWAP_COACHING==='1')coaches.reverse();
const attempts:Attempt[]=[];
const start=Date.now();
let replay;
try{replay=await runMatch(key,model,coaches,AbortSignal.timeout(60000),attempts);}
catch{process.exitCode=1;}
const path='evidence/window-match-'+new Date(start).toISOString().replace(/[:.]/g,'-')+'.json';
const report={model,coaching:coaches.map(c=>c.text),memoryRevision:coaches.map(c=>c.memory.revision),memoryLessonCount:coaches.map(c=>c.memory.lessons.length),status:replay?'completed':'interrupted',durationMs:Date.now()-start,requests:attempts.length,retries:attempts.filter(a=>a.attempt>1).length,attempts,replay};
writeFileSync(path,JSON.stringify(report,null,2));
console.log(JSON.stringify({path,status:report.status,durationMs:report.durationMs,requests:report.requests,retries:report.retries,result:replay?.result,statuses:attempts.map(a=>a.status)}));
