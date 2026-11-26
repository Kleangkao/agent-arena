import {appendFileSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {runMatch} from './match';
import {reflect} from './reflect';
import {createApi} from './api';
import {sqliteStorage} from './sqlite-storage';
import {runGeminiV26} from './gameplay-v26';

export function createApp(db:DatabaseSync,runner=runMatch,key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL,reflection=reflect,memoryDir='.arena-data/memory'){
 const localV26=process.env.ARENA_LOCAL_CONTINUOUS==='1';
 const localSquads=process.env.ARENA_LOCAL_SQUADS==='1';
 const developerSquadToken=process.env.ARENA_LOCAL_SQUAD_TEST_TOKEN;
 const developerSquads=localSquads&&developerSquadToken&&/^[a-f0-9]{64}$/.test(developerSquadToken);
 const capture:{key:string;token:string;runner:typeof runGeminiV26}|undefined=
  localV26&&key&&process.env.ARENA_LOCAL_CAPTURE==='1'?{
   key,token:'',runner:(apiKey,model,config,coaches,signal)=>runGeminiV26(apiKey,model,config,coaches,signal,
    row=>appendFileSync('.arena-data/continuous-provider.jsonl',JSON.stringify(row)+'\n')),
  }:undefined;
 return createApi(sqliteStorage(db,memoryDir,process.env.ARENA_LIVE_MIN_START_INTERVAL_SECONDS),{
  runner,key,model,reflection,localV26,v26Trial:capture,localSquads,developerSquadToken:developerSquads?developerSquadToken:undefined,
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 mkdirSync('.arena-data',{recursive:true});
 createApp(new DatabaseSync('.arena-data/arena.sqlite')).listen(Number(process.env.PORT)||3001,'127.0.0.1',()=>console.log('Agent Arena local API listening'));
}
