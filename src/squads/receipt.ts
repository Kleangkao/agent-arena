import {createPublicClient,fallback,http,keccak256,parseAbi,parseEventLogs,toHex,zeroHash,type Address,type Hash,type PublicClient} from 'viem';
import {bscTestnet} from 'viem/chains';
import {loadSquads} from './game.js';

export const publicTestnetReplayRpc='https://bsc-testnet-rpc.publicnode.com';

export const squadReceiptAbi=parseAbi([
 'function operator() view returns (address)',
 'function records(bytes32 matchKey) view returns (bytes32 replayHash, uint64 blockNumber)',
 'function recordReplay(bytes32 matchKey, bytes32 replayHash)',
 'event ReplayRecorded(bytes32 indexed matchKey, bytes32 indexed replayHash)',
]);

export function squadCommitment(input:unknown,matchId?:string){
 const {replay}=loadSquads(input);
 if((replay.source!=='operator-attested-gemini'&&replay.source!=='arena-challenge')||!replay.final||replay.interruption)
  throw Error('Only completed model matches can make a replay commitment.');
 if(matchId!==undefined&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(matchId))
  throw Error('Invalid match identity.');
 // Explicit field order keeps the commitment independent of JSON key and schema order.
 const {rulesVersion,mapVersion,teamSize}=replay.config;
 const mode='mode' in replay.config?replay.config.mode:null;
 const challenge=replay.challenge?[replay.challenge.opponent,replay.challenge.policy,replay.challenge.difficulty]:[];
 const payload=JSON.stringify([
  'agent-arena/squad-replay/v1',replay.version,[rulesVersion,mapVersion,teamSize,mode],replay.source,
  replay.windows.map(window=>window.map(plan=>plan.orders)),replay.final,...(challenge.length?[challenge]:[]),
 ]);
 return {
  replayHash:keccak256(toHex(payload)),
  matchKey:matchId===undefined?null:keccak256(toHex('agent-arena/squad-match/v1:'+matchId)),
 };
}

type ReceiptClient=Pick<PublicClient,'getChainId'|'readContract'|'getBlockNumber'|'getContractEvents'|'getTransactionReceipt'>;
export async function checkSquadRecord(client:ReceiptClient,chainId:number,address:Address,matchKey:Hash,replayHash:Hash){
 if(await client.getChainId()!==chainId)throw Error('Unexpected chain');
 const [recordedHash,blockNumber]=await client.readContract({address,abi:squadReceiptAbi,functionName:'records',args:[matchKey]});
 if(recordedHash===zeroHash)return {status:'absent'} as const;
 if(recordedHash!==replayHash)return {status:'different'} as const;
 if(await client.getBlockNumber({cacheTime:0})<=blockNumber)return {status:'pending'} as const;

 const events=await client.getContractEvents({
  address,abi:squadReceiptAbi,eventName:'ReplayRecorded',args:{matchKey,replayHash},fromBlock:blockNumber,toBlock:blockNumber,strict:true,
 });
 const hash=events[0]?.transactionHash;
 if(events.length!==1||!hash)throw Error('Missing replay record event');
 const receipt=await client.getTransactionReceipt({hash});
 const matching=parseEventLogs({abi:squadReceiptAbi,eventName:'ReplayRecorded',
  logs:receipt.logs.filter(log=>log.address.toLowerCase()===address.toLowerCase()),
 }).some(log=>log.args.matchKey===matchKey&&log.args.replayHash===replayHash);
 if(receipt.status!=='success'||receipt.blockHash!==events[0].blockHash||receipt.blockNumber!==blockNumber||!matching)
  throw Error('Replay record mismatch');
 return {status:'recorded',hash} as const;
}

export function checkTestnetSquadRecord(address:Address,matchKey:Hash,replayHash:Hash){
 const options={timeout:8000,retryCount:0};
 const client=createPublicClient({chain:bscTestnet,transport:fallback([
  http(publicTestnetReplayRpc,options),http(undefined,options),
 ],{retryCount:0})});
 return checkSquadRecord(client,bscTestnet.id,address,matchKey,replayHash);
}
