import {hashTypedData,isAddressEqual,keccak256,recoverTypedDataAddress,toHex,type Address,type Hex} from 'viem';
import {z} from 'zod';
import {agentIdentityAbi,agentRegistry,parseAgentId,testnetIdentityClient} from '../agent-identity.js';
import {continuousSquadRules,defaultTeamSize,loadSquads,squadMap,squadModes,territorySquadRules} from './game.js';
import {squadCommitment} from './receipt.js';

const agentIdSchema=z.string().refine(value=>{
 try{parseAgentId(value);return true;}catch{return false;}
});
export const participationScope=z.object({
 requestId:z.uuid(),agentId:agentIdSchema,mode:z.enum(squadModes),
 opponent:z.enum(['official-sand','official-sand-pace','arena-easy','arena-normal','arena-hard']),
}).strict();
export const participationInput=z.object({
 agentId:agentIdSchema,expires:z.number().int().positive(),
 signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/).transform(value=>value as Hex),
}).strict();
export const participationEntry=participationScope.omit({requestId:true}).extend({
 matchId:z.uuid(),audience:z.string().url().max(200),expires:z.number().int().positive(),rulesVersion:z.literal(territorySquadRules).optional(),
}).strict().refine(entry=>!entry.rulesVersion||entry.mode==='relay');
export type ParticipationEntry=z.infer<typeof participationEntry>;
const proofSchema=z.object({
 entry:participationEntry,signature:participationInput.shape.signature,
 owner:z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(value=>value as Address),
 block:z.string().regex(/^[1-9][0-9]{0,15}$/),admittedAt:z.number().int().positive(),
}).strict();
export type ParticipationProof=z.infer<typeof proofSchema>;
export const maxEntrySeconds=600;

export function typedParticipation(entry:ParticipationEntry){
 return {
  domain:{name:'AGENT ARENA Match Entry',version:'1',chainId:97,verifyingContract:agentRegistry},
  primaryType:'MatchEntry',
  types:{MatchEntry:[
   {name:'arena',type:'string'},{name:'matchId',type:'string'},{name:'agentId',type:'string'},
   {name:'team',type:'string'},{name:'opponent',type:'string'},{name:'mode',type:'string'},
   {name:'mapVersion',type:'string'},{name:'rulesVersion',type:'string'},{name:'teamSize',type:'uint8'},
   {name:'expiresUtc',type:'string'},{name:'permission',type:'string'},
  ]},
  message:{arena:entry.audience,matchId:entry.matchId,agentId:entry.agentId,team:'blue',
   opponent:entry.opponent,mode:entry.mode,mapVersion:squadMap,rulesVersion:entry.rulesVersion??continuousSquadRules,
   teamSize:defaultTeamSize,expiresUtc:new Date(entry.expires*1000).toISOString(),
   permission:'Enter this match once. Arena may publish the reviewed replay and participation evidence.'},
 } as const;
}

type OwnerClient=Pick<ReturnType<typeof testnetIdentityClient>,'getChainId'|'getBlockNumber'|'readContract'>;
export async function admitParticipation(entry:ParticipationEntry,signature:Hex,now:number,client:OwnerClient=testnetIdentityClient()):Promise<ParticipationProof|null>{
 if(entry.expires<=now||entry.expires>now+maxEntrySeconds)return null;
 let signer:Address;
 try{signer=await recoverTypedDataAddress({...typedParticipation(entry),signature});}catch{return null;}
 if(await client.getChainId()!==97)throw Error('Unexpected identity chain');
 const block=await client.getBlockNumber({cacheTime:0})-1n;
 const contract={address:agentRegistry,abi:agentIdentityAbi,functionName:'ownerOf',args:[parseAgentId(entry.agentId)]} as const;
 const [confirmed,current]=await Promise.all([
  client.readContract({...contract,blockNumber:block}),client.readContract({...contract,blockTag:'latest'}),
 ]);
 return isAddressEqual(signer,confirmed)&&isAddressEqual(signer,current)?
  {entry,signature,owner:confirmed,block:String(block),admittedAt:now}:null;
}

export const publicParticipationPath='/competition/commander-2933.json';
const evidenceSchema=z.object({
 version:z.literal(1),proof:proofSchema,replay:z.unknown(),
 replayHash:z.string().regex(/^0x[0-9a-f]{64}$/),model:z.string().min(1).max(100),
}).strict();

export function participationCommitment(proof:ParticipationProof,replayHash:Hex,model:string){
 return keccak256(toHex(JSON.stringify(['agent-arena/identity-match/v1',hashTypedData(typedParticipation(proof.entry)),
  proof.owner.toLowerCase(),proof.signature.toLowerCase(),proof.block,proof.admittedAt,replayHash,model])));
}

export async function readParticipationEvidence(input:unknown,client:OwnerClient=testnetIdentityClient()){
 const record=evidenceSchema.parse(input);
 const {entry,signature,owner,block,admittedAt}=record.proof;
 const {replay}=loadSquads(record.replay);
 const {config}=replay;
 const {replayHash,matchKey}=squadCommitment(replay,entry.matchId);
 if(admittedAt>=entry.expires||entry.expires-admittedAt>maxEntrySeconds||
    !('mode' in config)||config.rulesVersion!==(entry.rulesVersion??continuousSquadRules)||config.mode!==entry.mode||config.teamSize!==defaultTeamSize||
    (replay.challenge?replay.challenge.opponent!==entry.opponent:entry.opponent.startsWith('arena-'))||
    record.replayHash!==replayHash||!isAddressEqual(owner,await recoverTypedDataAddress({ ...typedParticipation(entry),signature})))
  throw Error('Participation or replay mismatch');
 if(await client.getChainId()!==97||await client.getBlockNumber({cacheTime:0})<=BigInt(block))throw Error('Ownership block unconfirmed');
 const registered=await client.readContract({address:agentRegistry,abi:agentIdentityAbi,functionName:'ownerOf',
  args:[parseAgentId(entry.agentId)],blockNumber:BigInt(block)});
 if(!isAddressEqual(owner,registered))throw Error('Signer was not the registered owner');
 return {...record,replay,replayHash,matchKey:matchKey!,evidenceHash:participationCommitment(record.proof,replayHash,record.model)};
}
