import {describe,expect,it,vi} from 'vitest';
import {agentRegistry,parseAgentId,publicAgentProfile,readAgentIdentity} from '../src/agent-identity';

describe('BSC Testnet Passport identity',()=>{
 it('uses the official registry and one confirmed block for ownership and profile',async()=>{
  const readContract=vi.fn(async({functionName})=>functionName==='ownerOf'?'0x0000000000000000000000000000000000000061':'https://arena.example/agent.json');
  const client={getChainId:vi.fn(async()=>97),getBlockNumber:vi.fn(async()=>100n),readContract};
  const record=await readAgentIdentity(client,'100');
  expect(record).toMatchObject({id:'100',profile:'https://arena.example/agent.json',blockNumber:99n,agentRegistry:`eip155:97:${agentRegistry}`});
  expect(readContract.mock.calls.map(([call])=>call)).toEqual(['ownerOf','tokenURI'].map(functionName=>expect.objectContaining({address:agentRegistry,functionName,args:[100n],blockNumber:99n})));
  client.getChainId.mockResolvedValueOnce(56);
  await expect(readAgentIdentity(client,'100')).rejects.toThrow('Unexpected chain');
  expect(readContract).toHaveBeenCalledTimes(2);
 });

 it('bounds agent identifiers and permits web links without executing embedded metadata',()=>{
  expect(parseAgentId('0')).toBe(0n);
  expect(parseAgentId(String(2n**256n-1n))).toBe(2n**256n-1n);
  for(const invalid of ['','-1','100.0','0x64',String(2n**256n)])expect(()=>parseAgentId(invalid)).toThrow();
  for(const untrusted of ['data:text/html,hi','javascript:alert(1)','https://user:token@example.com','http://example.com','ipfs://cid?redirect'])expect(publicAgentProfile(untrusted)).toBeUndefined();
  expect(publicAgentProfile('ipfs://bafyagent/profile.json')).toBe('https://ipfs.io/ipfs/bafyagent/profile.json');
 });
});
