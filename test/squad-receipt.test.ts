import {readFileSync} from 'node:fs';
import solc from 'solc';
import {expect,it} from 'vitest';
import {createPublicClient,createWalletClient,http,type Hex,zeroHash} from 'viem';
import {hardhat} from 'viem/chains';
import fixture from '../src/fixtures/relay-yard-gemini.json';
import {continuousConfig,scriptedSquads,squadModes} from '../src/squads/game';
import {checkSquadRecord,squadCommitment,squadReceiptAbi} from '../src/squads/receipt';

const matchId='64687a33-3e0b-491d-a05b-443052a37181';
const differentId='64687a33-3e0b-491d-a05b-443052a37182';

it('hashes the deterministic replay independently of private commentary and binds a stable match identity',()=>{
 const original=squadCommitment(fixture,matchId);
 const copy=structuredClone(fixture);
 copy.windows[0][0].intent='Changed spectator commentary';
 expect(squadCommitment(copy,matchId)).toEqual(original);
 const relocated=squadCommitment(copy,differentId);
 expect(relocated.matchKey).not.toBe(original.matchKey);
 expect(relocated.replayHash).toBe(original.replayHash);

 // One accepted deployment order changes without changing the eventual winner.
 copy.windows[0][0].orders[1]='12,2';
 expect(squadCommitment(copy,matchId).replayHash).not.toBe(original.replayHash);
 expect(()=>squadCommitment(fixture,'untrusted-user-id')).toThrow('Invalid match identity');
 expect(()=>squadCommitment({...fixture,final:'draw'},matchId)).toThrow('does not match');
 expect(()=>squadCommitment({...fixture,source:'scripted-practice'},matchId)).toThrow('completed model matches');
});

it('binds the mode of each continuous replay',()=>{
 const hashes=squadModes.map(mode=>{
  // Synthetic fixture to test commitment encoding only.
  const {replay}=scriptedSquads(continuousConfig(mode));
  return squadCommitment({...replay,source:'operator-attested-gemini'},matchId).replayHash;
 });
 expect(new Set(hashes).size).toBe(squadModes.length);
});

it.skipIf(!process.env.PARITY_RPC)('reads a confirmed commitment through the same path as the browser',async()=>{
 const rpc=new URL(process.env.PARITY_RPC!);
 if(!['127.0.0.1','localhost','[::1]'].includes(rpc.hostname))throw Error('Local RPC required.');
 const transport=http(rpc.href);
 const client=createPublicClient({chain:hardhat,transport});
 const wallet=createWalletClient({chain:hardhat,transport});
 if(await client.getChainId()!==hardhat.id)throw Error('Local Hardhat chain required.');
 const [operator,outsider]=await wallet.getAddresses();
 const name='SquadReplayRegistry.sol';
 const compiled=JSON.parse(solc.compile(JSON.stringify({
  language:'Solidity',sources:{[name]:{content:readFileSync('contracts/'+name,'utf8')}},
  settings:{evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['evm.bytecode.object']}}},
 })));
 expect(compiled.errors?.filter((e:{severity:string})=>e.severity==='error')??[]).toEqual([]);
 const bytecode:Hex=`0x${compiled.contracts[name].SquadReplayRegistry.evm.bytecode.object}`;
 const deployment=await client.waitForTransactionReceipt({
  hash:await wallet.deployContract({account:operator,abi:squadReceiptAbi,bytecode}),
 });
 expect(deployment.status).toBe('success');
 const address=deployment.contractAddress!;
 const {matchKey,replayHash}=squadCommitment(fixture,matchId);
 const read=(hash=replayHash,chainId:number=hardhat.id)=>checkSquadRecord(client,chainId,address,matchKey!,hash);
 const write=(account=operator,key=matchKey!,hash=replayHash)=>client.simulateContract({
  address,abi:squadReceiptAbi,account,functionName:'recordReplay',args:[key,hash],
 });

 await expect(client.readContract({address,abi:squadReceiptAbi,functionName:'operator'})).resolves.toBe(operator);
 await expect(read()).resolves.toEqual({status:'absent'});
 await expect(read(replayHash,97)).rejects.toThrow('Unexpected chain');
 await expect(write(outsider)).rejects.toThrow('operator');
 await expect(write(operator,zeroHash)).rejects.toThrow('empty commitment');

 const {request}=await write();
 const hash=await wallet.writeContract(request);
 const receipt=await client.waitForTransactionReceipt({hash});
 expect(receipt.status).toBe('success');
 await expect(read()).resolves.toEqual({status:'pending'});
 await expect(read(zeroHash)).resolves.toEqual({status:'different'});
 await expect(write(operator,matchKey!,zeroHash)).rejects.toThrow('empty commitment');
 await expect(write()).rejects.toThrow('already recorded');

 // Send another local transaction to establish a second confirmation without manual chain mining.
 const next=await write(operator,squadCommitment(fixture,differentId).matchKey!);
 await client.waitForTransactionReceipt({hash:await wallet.writeContract(next.request)});
 await expect(read()).resolves.toEqual({status:'recorded',hash});
 console.log('Local replay registry gas',{deploy:Number(deployment.gasUsed),record:Number(receipt.gasUsed)});
},30000);
