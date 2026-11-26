import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
const [mode,coaching='']=process.argv.slice(2);
if(!['relay','bomb','tdm'].includes(mode))throw Error('Use relay, bomb, or tdm.');
const developerToken=process.env.ARENA_LOCAL_SQUAD_TEST_TOKEN;
const variant=process.env.ARENA_SQUAD_EVIDENCE_VARIANT;
let server,db;
const exchange=[];
let port=3001;
if(variant){
 if(!['reference','receipts','destinations'].includes(variant)||!/^[a-f0-9]{64}$/.test(developerToken??''))
  throw Error('Set a local developer token and valid evidence variant.');
 const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
 if(!key||!model)throw Error('Configure GEMINI_API_KEY and GEMINI_MODEL locally.');
 const {DatabaseSync}=await import('node:sqlite');
 const {createApi}=await import('../server/api.ts');
 const {sqliteStorage}=await import('../server/sqlite-storage.ts');
 const {runGeminiSquads}=await import('../server/squads.ts');
 db=new DatabaseSync('.arena-data/arena.sqlite');
 const app=createApi(sqliteStorage(db,'.arena-data/memory',process.env.ARENA_LIVE_MIN_START_INTERVAL_SECONDS),{
  key,model,localSquads:true,developerSquadToken:developerToken,
  squadRunner:(...args)=>runGeminiSquads(...args,{feedback:variant!=='reference',navigation:variant==='destinations',capture:row=>exchange.push(row)})});
 server=app.listen(0,'127.0.0.1');
 await once(server,'listening');
 port=server.address().port;
}
const root='http://127.0.0.1:'+port+'/api';
try {
const guest=await fetch(root+'/guest',{method:'POST'});
if(!guest.ok)throw Error('Guest rejected: '+guest.status);
const cookie=guest.headers.get('set-cookie').split(';')[0];
const start=await fetch(root+'/matches',{method:'POST',headers:{cookie,'Content-Type':'application/json',...(developerToken?{'x-arena-squad-test':developerToken}:{})},
 body:JSON.stringify({requestId:randomUUID(),rulesVersion:'squads-v3',mode,coaching})});
const job=await start.json();
if(!start.ok)throw Error('Match rejected '+start.status+': '+job.error);
for(let i=0;i<36;i++){
 const response=await fetch(root+'/matches/'+job.id,{headers:{cookie}});
 if(!response.ok)throw Error('Polling failed: '+response.status);
 const match=await response.json();
 if(match.status!=='preparing'){
  const {id,status,replay,attempts,durationMs,model,error}=match;
  const evidence={id,status,replay,attempts,durationMs,model,error,coaching,...(variant?{variant,exchange}:{})};
  const folder=variant?'evidence/squad-intelligence':'evidence/continuous-squads';
  mkdirSync(folder,{recursive:true});
  writeFileSync(folder+'/'+mode+'-'+id+'.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({id,status,final:replay?.final,attempts:attempts?.map(r=>r.status),durationMs,error}));
  process.exitCode=status==='completed'?0:2;
  break;
 }
 await new Promise(resolve=>setTimeout(resolve,1900));
 if(i===35)throw Error('Runtime exceeded polling budget.');
}
} finally {
 if(server)await new Promise(resolve=>server.close(resolve));
 db?.close();
}
