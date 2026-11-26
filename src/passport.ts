import {createPublicClient,http,parseAbi,parseEventLogs,type Address,type Hash} from 'viem';
import {bscTestnet} from 'viem/chains';

const abi=parseAbi([
 'function registered(address owner) view returns (bool)',
 'function matches(bytes32 id) view returns (address blue, address sand, bytes32 configuration, bytes32 transcriptHash, uint8 result)',
 'event Finalized(bytes32 indexed id, uint8 result, bytes32 transcriptHash)',
]);

export async function readPassport(address:Address,hash:Hash){
 const client=createPublicClient({chain:bscTestnet,transport:http(undefined,{timeout:8000,retryCount:0})});
 if(await client.getChainId()!==97)throw Error('Unexpected chain');
 const receipt=await client.getTransactionReceipt({hash});
 if(receipt.status!=='success'||receipt.to?.toLowerCase()!==address.toLowerCase()||await client.getBlockNumber()<=receipt.blockNumber)throw Error('Settlement is not confirmed');
 const [event,...others]=parseEventLogs({abi,eventName:'Finalized',logs:receipt.logs.filter(log=>log.address.toLowerCase()===address.toLowerCase())});
 if(!event||others.length)throw Error('Missing settlement record');
 const [blue,sand,,transcriptHash,result]=await client.readContract({address,abi,functionName:'matches',args:[event.args.id]});
 const participants=await Promise.all([blue,sand].map(owner=>client.readContract({address,abi,functionName:'registered',args:[owner]})));
 const outcome={1:'Blue Team wins',2:'Sand Team wins',3:'Draw'}[result];
 if(!participants.every(Boolean)||!outcome||result!==event.args.result||transcriptHash!==event.args.transcriptHash)throw Error('Settlement record mismatch');
 return {blue,sand,outcome,hash,id:event.args.id,address};
}
