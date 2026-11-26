import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import solc from 'solc';
import {createPublicClient,createWalletClient,http,keccak256,toHex} from 'viem';
import {hardhat} from 'viem/chains';
import fixture from '../src/fixtures/historical-gemini.json';
import {validateReplay} from '../src/replay';

it.skipIf(!process.env.PARITY_RPC)('authorizes and settles a complete transcript with on-chain result and receipt gas',async()=>{
 const transport=http(process.env.PARITY_RPC);
 const client=createPublicClient({chain:hardhat,transport}), wallet=createWalletClient({chain:hardhat,transport});
 const sources=Object.fromEntries(['ArenaRules.sol','ArenaSettlement.sol'].map(name=>[name,{content:readFileSync('contracts/'+name,'utf8')}]));
 const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{
  evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}},
 }})));
 expect(output.errors?.filter((e:{severity:string})=>e.severity==='error')??[]).toEqual([]);
 const compiled=output.contracts['ArenaSettlement.sol'].ArenaSettlement;
 const [operator,blue,outsider]=await wallet.getAddresses();
 const deployment=await client.waitForTransactionReceipt({hash:await wallet.deployContract({account:operator,abi:compiled.abi,bytecode:`0x${compiled.evm.bytecode.object}`})});
 const contract={address:deployment.contractAddress!,abi:compiled.abi};
 const send=async(account:typeof blue,functionName:string,args:unknown[]=[])=>{
  const {request}=await client.simulateContract({...contract,account,functionName,args});
  return client.waitForTransactionReceipt({hash:await wallet.writeContract(request)});
 };
 const id=keccak256(toHex('local-test-match')),config=keccak256(toHex('local-test-config'));
 const actions=validateReplay(fixture).events.map(event=>event.actions.map(action=>['wait','advance','attack','reload'].indexOf(action)));
 await expect(send(blue,'createMatch',[id,config,1,1])).rejects.toThrow('participants');
 const operatorRegistration=await send(operator,'register');
 const playerRegistration=await send(blue,'register');
 await expect(send(blue,'createMatch',[id,config,2,1])).rejects.toThrow('version');
 const authorization=await send(blue,'createMatch',[id,config,1,1]);
 await expect(send(outsider,'settle',[id,config,actions])).rejects.toThrow('operator');
 await expect(send(operator,'settle',[id,id,actions])).rejects.toThrow('configuration');
 await expect(send(operator,'settle',[id,config,[[2,0]]])).rejects.toThrow('illegal');
 await expect(send(operator,'settle',[id,config,[[0,0]]])).rejects.toThrow('nonterminal');
 const receipt=await send(operator,'settle',[id,config,actions]);
 expect(receipt.status).toBe('success');
 const record=await client.readContract({...contract,functionName:'matches',args:[id]}) as unknown[];
 expect(record[0]).toBe(blue);
 expect(record[2]).toBe(config);
 expect(record[4]).toBe(1);
 await expect(send(operator,'settle',[id,config,actions])).rejects.toThrow('match unavailable');
 console.log('Local receipt gas (optimized Testnet build)',{
  deployment:Number(deployment.gasUsed),operatorRegistration:Number(operatorRegistration.gasUsed),
  playerRegistration:Number(playerRegistration.gasUsed),authorization:Number(authorization.gasUsed),
  historicalSettlement:Number(receipt.gasUsed),
 });
},30000);
