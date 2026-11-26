import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {expect,it,vi} from 'vitest';
import {createApi} from '../server/api';
import {sqliteStorage} from '../server/sqlite-storage';
import {continuousConfig,scriptedSquads,territorySquadRules} from '../src/squads/game';
import {admitParticipation,readParticipationEvidence,typedParticipation,type ParticipationEntry} from '../src/squads/participation';
import {squadCommitment} from '../src/squads/receipt';

const signer=privateKeyToAccount(generatePrivateKey());
const stranger=privateKeyToAccount(generatePrivateKey());
const ownerClient={getChainId:vi.fn(async()=>97),getBlockNumber:vi.fn(async()=>50n),readContract:vi.fn(async()=>signer.address)};
const now=Date.now()/1000|0;
const entry={agentId:'2933',matchId:randomUUID(),audience:'https://arena.example',expires:now+600,mode:'relay',opponent:'official-sand'} satisfies ParticipationEntry;
const sign=(entry:ParticipationEntry)=>signer.signTypedData(typedParticipation(entry));

it('validates a signed match and historical ownership, rejecting forged, expired, and altered evidence',async()=>{
 const signature=await sign(entry);
 const proof=await admitParticipation(entry,signature,now,ownerClient);
 expect(proof).toMatchObject({block:'49',owner:signer.address});
 expect(ownerClient.readContract).toHaveBeenCalledWith(expect.objectContaining({blockNumber:49n,args:[2933n]}));
 expect(ownerClient.readContract).toHaveBeenCalledWith(expect.objectContaining({blockTag:'latest'}));
 expect(await admitParticipation(entry,signature,entry.expires,ownerClient)).toBeNull();
 expect(await admitParticipation({...entry,opponent:'official-sand-pace'},signature,now,ownerClient)).toBeNull();
 expect(await admitParticipation({...entry,audience:'https://other.example'},signature,now,ownerClient)).toBeNull();
 expect(await admitParticipation(entry,signature,now,{...ownerClient,readContract:vi.fn(async args=>'blockTag' in args?stranger.address:signer.address)})).toBeNull();
 const replay={...scriptedSquads(continuousConfig('relay')).replay,source:'operator-attested-gemini'};
 const {replayHash}=squadCommitment(replay);
 const evidence={version:1,proof,replay,replayHash,model:'test-model'};
 const checked=await readParticipationEvidence(evidence,ownerClient);
 expect(checked.evidenceHash).toMatch(/^0x[a-f0-9]{64}$/);
 expect((await readParticipationEvidence({...evidence,model:'different-model'},ownerClient)).evidenceHash).not.toBe(checked.evidenceHash);
 await expect(readParticipationEvidence({...evidence,replayHash:'0x'+'0'.repeat(64)},ownerClient)).rejects.toThrow('mismatch');
 await expect(readParticipationEvidence({...evidence,proof:{...proof,entry:{...entry,mode:'tdm'}}},ownerClient)).rejects.toThrow('mismatch');
 await expect(readParticipationEvidence(evidence,{...ownerClient,readContract:vi.fn(async()=>stranger.address)})).rejects.toThrow('registered owner');
 await expect(readParticipationEvidence(evidence,{...ownerClient,getChainId:vi.fn(async()=>56)})).rejects.toThrow('unconfirmed');
});

it('requires the same wallet-authorized guest and setup and reserves one job for concurrent duplicate entries',async()=>{
 const db=new DatabaseSync(':memory:');
 const jobs:Promise<void>[]=[];
 const squadRunner=vi.fn(async(_key,_model,config)=>({...scriptedSquads(config).replay,source:'operator-attested-gemini' as const}));
 const server=createApi(sqliteStorage(db,'.arena-data/squad-entry-test'),{
  key:'test',model:'test',origin:entry.audience,hosted:true,hostedSquads:true,background:job=>jobs.push(job),squadRunner,
  participationVerifier:(entry,signature,now)=>admitParticipation(entry,signature,now,ownerClient),
 }).listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 const root=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/`;
 const post=(route:string,body:object,cookie='',origin=entry.audience)=>fetch(root+route,{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const guest=async()=>(await post('guest',{})).headers.get('set-cookie')!.split(';')[0];
 try{
  const [first,second]=await Promise.all([guest(),guest()]);
  const scope={requestId:randomUUID(),agentId:'2933',mode:'relay',opponent:'official-sand'};
  expect((await post('matches/entry',scope)).status).toBe(401);
  expect((await post('matches/entry',scope,first,'https://other.example')).status).toBe(403);
  const challenge=await (await post('matches/entry',scope,first)).json();
  const other=await (await post('matches/entry',scope,second)).json();
  expect(challenge.matchId).not.toBe(other.matchId);
  const participation={agentId:challenge.agentId,expires:challenge.expires,signature:await sign(challenge)};
  const {agentId:_,...configuration}=scope;
  expect(challenge.rulesVersion).toBe(territorySquadRules);
  const body={...configuration,rulesVersion:territorySquadRules,coaching:'private',participation};
  expect((await post('matches',body,second)).status).toBe(403);
  expect((await post('matches',{...body,rulesVersion:'squads-v3'},first)).status).toBe(400);
  expect((await post('matches',{...body,mode:'tdm',rulesVersion:'squads-v3'},first)).status).toBe(403);
  expect((await post('matches',{...body,requestId:randomUUID()},first)).status).toBe(403);
  expect((await post('matches',{...body,participation:{...participation,signature:await stranger.signTypedData(typedParticipation(challenge))}},first)).status).toBe(403);
  expect(squadRunner).not.toHaveBeenCalled();
  const responses=await Promise.all([post('matches',body,first),post('matches',body,first)]);
  expect(responses.map(response=>response.status).sort()).toEqual([200,202]);
  await Promise.all(jobs);
  const result=await (await fetch(root+'matches/'+challenge.matchId,{headers:{cookie:first}})).json();
  expect(result).toMatchObject({id:challenge.matchId,status:'completed',participation:{owner:signer.address,entry:challenge}});
  expect(result).not.toHaveProperty('coaches');
  expect(squadRunner).toHaveBeenCalledTimes(1);
  expect((await fetch(root+'matches/'+challenge.matchId,{headers:{cookie:second}})).status).toBe(404);
  expect((await post('matches',{...body,participation:undefined},first)).status).toBe(409);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});
