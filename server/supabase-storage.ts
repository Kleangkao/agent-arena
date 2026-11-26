import {liveStartInterval,matchStatus,type ArenaStorage,type GuestRequest,type Job,type Memory,type Reservation} from './storage.js';

export function supabaseStorage(url:string,key:string,minStartIntervalSeconds?:string):ArenaStorage {
 const root=new URL('/rest/v1/',url);
 const startInterval=liveStartInterval(minStartIntervalSeconds);
 if(root.protocol!=='https:')throw Error('Supabase must use HTTPS');
 async function call<T>(path:string,method='GET',data?:object,prefer?:string):Promise<T>{
  const response=await fetch(new URL(path,root),{
   method,headers:{apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),
    'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
   body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(5000),
  });
  if(!response.ok)throw Error('Arena storage request failed ('+response.status+')');
  const body=await response.text();
  return JSON.parse(body||'null');
 }
 const find=async(owner:string,field:'id'|'idem',value:string)=>{
  const [row]=await call<(Job&{created:string})[]>('arena_matches?select=id,status,replay,config,reflection,created&guest=eq.'+owner+'&'+field+'=eq.'+value);
  if(!row)return null;
  if(row.status==='preparing'&&Date.now()-Date.parse(row.created)>90000)return {...row,status:'interrupted' as const};
  if(row.status==='completed'&&!row.reflection&&Date.now()-Date.parse(row.created)>90000)return {...row,reflection:{status:'unavailable' as const}};
  return row;
 };
 return {
  async guest(id){return (await call<unknown[]>('arena_guests?select=id&id=eq.'+id+'&expires=gt.'+Date.now())).length>0},
  guestRequest:id=>call<GuestRequest>('rpc/arena_guest_request','POST',{p_id:id}),
  createGuest:(id,expires)=>call<boolean>('rpc/arena_create_guest','POST',{p_id:id,p_expires:expires}),
  async memory(owner){
   const [memory]=await call<Memory[]>('arena_memories?select=revision,lessons&guest=eq.'+owner);
   return memory??{revision:0,lessons:[]};
  },
  async coaching(owner){
   const [current]=await call<{text:string}[]>('arena_coaching?select=text&guest=eq.'+owner+'&order=saved.desc&limit=1');
   return current?.text??null;
  },
  async saveCoaching(owner,text,revision){
   await call('arena_coaching','POST',{guest:owner,text,revision,saved:new Date().toISOString()},'resolution=merge-duplicates');
  },
  find:(owner,id)=>find(owner,'id',id),
  existing:(owner,requestId)=>find(owner,'idem',requestId),
  reserve:({id,owner,requestId,config})=>call<Reservation>('rpc/arena_reserve_match','POST',{
   p_id:id,p_owner:owner,p_idem:requestId,p_config:config,p_start_interval_seconds:startInterval,
  }),
  async finish(id,replay,attempts,durationMs){
   const [row]=await call<Pick<Job,'config'>[]>('arena_matches?select=config&id=eq.'+id);
   if(!row)throw Error('Reserved match missing');
   await call('arena_matches?id=eq.'+id+'&status=eq.preparing','PATCH',{
    status:matchStatus(replay),replay,config:{...row.config,attempts,durationMs},
   });
  },
  async reflect(owner,id,lessons){await call('rpc/arena_reflect_match','POST',{p_owner:owner,p_id:id,p_lessons:lessons})},
 };
}
