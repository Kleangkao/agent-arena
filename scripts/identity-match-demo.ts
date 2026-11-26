import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {privateKeyToAccount} from 'viem/accounts';
import type {Hex} from 'viem';
import {participationEntry,readParticipationEvidence,typedParticipation} from '../src/squads/participation';
import {loadSquads} from '../src/squads/game';
import {squadCommitment} from '../src/squads/receipt';

assert.ok(process.argv.includes('--confirm-live-identity-match'));
const origin='https://agent-arena-preview.vercel.app';
const key=process.env.BSC_TESTNET_OPERATOR_KEY;
delete process.env.BSC_TESTNET_OPERATOR_KEY;
assert.ok(key&&/^0x[\da-f]{64}$/i.test(key),'Load the dedicated Testnet owner securely.');
const signer=privateKeyToAccount(key as Hex);
assert.equal(signer.address,'0x0f7340C0B93377f4c59d0ACCcc076991bb872E30');
const scope={agentId:'2933',requestId:randomUUID(),mode:'relay',opponent:'official-sand'} as const;
const corrective=process.argv.includes('--corrective');
const coaching=corrective
 ?'Last time all five units targeted South every checkpoint. Correct that concentration: start three units toward North and two toward South. Use your receipt to adjust a blocked or contested lane; defend any score advantage.'
 :'Send the first squad toward South. Use execution receipts at each checkpoint. If units are blocked or South is contested, redirect idle units to North. Protect an earned lead.';
const folder='evidence/identity-competition';
mkdirSync(folder,{recursive:true});
const save=(file:string,body:unknown)=>writeFileSync(`${folder}/${file}`,JSON.stringify(body,null,2)+'\n');
const guest=await fetch(origin+'/api/guest',{method:'POST',headers:{origin},signal:AbortSignal.timeout(15000)});
assert.equal(guest.status,204);
const cookie=guest.headers.get('set-cookie')!.split(';')[0];
const headers={cookie,origin,'content-type':'application/json'};
const post=(route:string,body:unknown)=>fetch(origin+'/api/matches'+route,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
const challenge=await post('/entry',scope);
assert.equal(challenge.status,200);
const entry=participationEntry.parse(await challenge.json());
assert.deepEqual([entry.audience,entry.agentId,entry.mode,entry.opponent],[origin,scope.agentId,scope.mode,scope.opponent]);
const signature=await signer.signTypedData(typedParticipation(entry));
const payload={requestId:scope.requestId,opponent:scope.opponent,mode:scope.mode,coaching,rulesVersion:entry.rulesVersion??'squads-v3',participation:{agentId:scope.agentId,expires:entry.expires,signature}};
let response=await post('',payload);
if(response.status===429){
 const retry=Number(response.headers.get('retry-after'));
 if(retry>0&&retry<=65){await sleep((retry+1)*1000);response=await post('',payload);}
}
if(response.status!==202)throw Error(`Reservation returned ${response.status}: ${await response.text()}`);
const reservation=await response.json();
assert.equal(reservation.id,entry.matchId);
assert.equal(reservation.participation?.signature,signature);
assert.equal(reservation.status,'preparing');
const matchUrl=origin+'/api/matches/'+entry.matchId;
assert.equal((await fetch(matchUrl,{signal:AbortSignal.timeout(12000)})).status,401);

for(let poll=0;poll<30;poll++){
 response=await fetch(matchUrl,{headers,signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200);
 const job=await response.json();
 if(job.status==='preparing'){await sleep(2200);continue;}
 const {id,status,model,durationMs,attempts,replay,participation:proof}=job;
 assert.deepEqual(proof,reservation.participation);
 const gameplay=replay&&loadSquads(replay);
 const final=gameplay?.frames.at(-1);
 // Persist timings and validated plans. Keep session and private coaching out of public artifacts.
 save(id+'.json',{id,status,model,durationMs,attempts,replay,proof});
 console.log(JSON.stringify({id,status,model,durationMs,attempts:attempts?.map((row:{status:string})=>row.status),
  tick:final?.tick,score:final?.score,result:replay?.final,interruption:replay?.interruption}));
 if(status!=='completed')throw Error('The genuine match was interrupted. Its trace was saved.');
 const {replayHash}=squadCommitment(replay);
 const evidence={version:1,proof,replay,replayHash,model};
 const verified=await readParticipationEvidence(evidence);
 save(corrective?'corrective-probe.json':'candidate-public-record.json',evidence);
 console.log(JSON.stringify({matchKey:verified.matchKey,replayHash,evidenceHash:verified.evidenceHash,block:proof.block}));
 process.exit(0);
}
throw Error('The hosted match did not complete within the polling window.');
