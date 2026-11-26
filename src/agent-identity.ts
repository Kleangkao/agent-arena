import {createPublicClient,fallback,http,parseAbi,type Address,type PublicClient} from 'viem';
import {bscTestnet} from 'viem/chains';

export const agentRegistry='0x8004A818BFB912233c491871b3d84c89A494BD9e' as const;
export const commanderProfile='https://agent-arena-preview.vercel.app/agent-arena-commander.json';
const publicRpc='https://bsc-testnet-rpc.publicnode.com';
export const agentIdentityAbi=parseAbi([
 'function ownerOf(uint256 tokenId) view returns (address)',
 'function tokenURI(uint256 tokenId) view returns (string)',
 'function register(string agentURI) returns (uint256 agentId)',
 'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]);

export function parseAgentId(value:string){
 if(!/^(0|[1-9][0-9]{0,77})$/.test(value))throw Error('Enter a valid agent ID.');
 const id=BigInt(value);
 if(id>=2n**256n)throw Error('Enter a valid agent ID.');
 return id;
}

export function publicAgentProfile(uri:string){
 try{
  if(uri.startsWith('ipfs://')&&/^ipfs:\/\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9._/-]*)?$/.test(uri))return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  const url=new URL(uri);
  if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;
 }catch{}
 return undefined;
}

type IdentityClient=Pick<PublicClient,'getChainId'|'getBlockNumber'|'readContract'>;
export async function readAgentIdentity(client:IdentityClient,value:string){
 const id=parseAgentId(value);
 if(await client.getChainId()!==bscTestnet.id)throw Error('Unexpected chain');
 const blockNumber=(await client.getBlockNumber({cacheTime:0}))-1n;
 const contract={address:agentRegistry,abi:agentIdentityAbi,blockNumber,args:[id] as const};
 const [owner,uri]=await Promise.all([
  client.readContract({...contract,functionName:'ownerOf'}),
  client.readContract({...contract,functionName:'tokenURI'}),
 ]);
 return {id:id.toString(),owner:owner as Address,blockNumber,profile:publicAgentProfile(uri),agentRegistry:`eip155:${bscTestnet.id}:${agentRegistry}`};
}

export function lookupAgentIdentity(value:string){
 return readAgentIdentity(testnetIdentityClient(),value);
}

export function testnetIdentityClient(){
 const options={timeout:8000,retryCount:0};
 return createPublicClient({chain:bscTestnet,transport:fallback([http(publicRpc,options),http(undefined,options)],{retryCount:0})});
}
