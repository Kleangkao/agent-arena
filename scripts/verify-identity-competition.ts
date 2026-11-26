import assert from 'node:assert/strict';
import {commanderProfile} from '../src/agent-identity';
import {publicParticipationPath,readParticipationEvidence} from '../src/squads/participation';
import {checkTestnetSquadRecord} from '../src/squads/receipt';

const profileUrl=new URL(commanderProfile);
const evidenceUrl=new URL(publicParticipationPath,profileUrl).href;
const read=async(url:string)=>{
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);
 return response.json();
};
const [profile,record]=await Promise.all([read(profileUrl.href),read(evidenceUrl)]);
const evidence=await readParticipationEvidence(record);
const {entry,owner,block}=evidence.proof;
assert.equal(entry.agentId,'2933');
assert.equal(entry.audience,profileUrl.origin);
assert.ok(profile.competitionEvidence.some((record:{matchId:string;evidenceHash:string;evidence:string})=>
 record.matchId===entry.matchId&&record.evidenceHash===evidence.evidenceHash&&record.evidence===evidenceUrl));
const chain=await checkTestnetSquadRecord('0xbd1a8427da0b2b2d947a391ed117e49ec8801f81',evidence.matchKey,evidence.evidenceHash);
const result={chainId:97,agentId:entry.agentId,owner,ownershipBlock:block,matchId:entry.matchId,mode:entry.mode,
 result:evidence.replay.final,model:evidence.model,evidenceUrl,replayHash:evidence.replayHash,evidenceHash:evidence.evidenceHash,
 matchKey:evidence.matchKey,chain};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--expect-chain'))assert.equal(chain.status,'recorded');
