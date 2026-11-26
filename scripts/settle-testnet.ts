import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import solc from 'solc';
import {createPublicClient,createWalletClient,encodeAbiParameters,encodeFunctionData,formatEther,http,keccak256,toHex,TransactionNotFoundError,type Address,type Hex,type TransactionSerialized} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {bscTestnet} from 'viem/chains';
import {runMatch,type Attempt,type Coach} from '../server/match';
import {randomUUID} from 'node:crypto';
import {validateReplay} from '../src/replay';

const model=process.env.GEMINI_MODEL;
const key=process.env.GEMINI_API_KEY;
const operatorKey=process.env.BSC_TESTNET_OPERATOR_KEY;
const playerKey=process.env.BSC_TESTNET_PLAYER_KEY;
if(!model||!key||!operatorKey||!playerKey)throw Error('Configure the Gemini model and both dedicated BSC Testnet signers in the local environment.');
if(!/^0x[a-fA-F0-9]{64}$/.test(operatorKey)||!/^0x[a-fA-F0-9]{64}$/.test(playerKey))throw Error('Testnet signers must be 32-byte hex private keys.');
const operator=privateKeyToAccount(operatorKey as `0x${string}`);
const player=privateKeyToAccount(playerKey as `0x${string}`);
if(operator.address===player.address)throw Error('Provide distinct operator and player accounts.');
const transport=http(process.env.BSC_TESTNET_RPC,{timeout:10000,retryCount:0});
const chain=bscTestnet;
const client=createPublicClient({chain,transport});
if(await client.getChainId()!==97)throw Error('The RPC must serve BSC Testnet chain 97.');
const sources=Object.fromEntries(['ArenaRules.sol','ArenaSettlement.sol'].map(name=>[name,{content:readFileSync('contracts/'+name,'utf8')}]));
const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}))).contracts['ArenaSettlement.sol'].ArenaSettlement;
const bytecode:Hex=`0x${compiled.evm.bytecode.object}`;

const coaches:[Coach,Coach]=[
 {text:'Press the advantage when legal.',revision:'testnet-v1',memory:{revision:0,lessons:[]}},
 {text:'Conserve resources and compete to win.',revision:'official-v1',memory:{revision:0,lessons:[]}}
];
const configuration=keccak256(toHex(JSON.stringify({model,rules:1,map:1,budget:20,coaches})));
const directory='.arena-data/testnet-release';
mkdirSync(directory,{recursive:true});
const read=<T>(file:string):T=>JSON.parse(readFileSync(file,'utf8'));
const manifest=directory+'/match.json';
const scope={chainId:97,operator:operator.address,player:player.address,configuration,bytecodeHash:keccak256(bytecode)};
if(!existsSync(manifest))writeFileSync(manifest,JSON.stringify({...scope,id:keccak256(toHex(randomUUID()))}),{flag:'wx'});
const saved=read<typeof scope&{id:Hex}>(manifest);
if(Object.entries(scope).some(([key,value])=>saved[key as keyof typeof scope]!==value))throw Error('Resume with the same Testnet signers, model and contract build.');
const {id}=saved;

const gasPrice=await client.getGasPrice();
// Buffered unit budgets derived from optimized local receipts. Live sends are estimated separately.
for(const [account,steps] of [
 [operator,[['deployment',1500000n],['operator-registration',80000n],['settlement',220000n]]],
 [player,[['player-registration',80000n],['authorization',160000n]]],
] as const){
 const available=await client.getBalance({address:account.address});
 const required=steps.filter(([step])=>!existsSync(directory+'/'+step+'.json')).reduce((sum,[,gas])=>sum+gas,0n)*gasPrice;
 if(available<required)throw Error(`Testnet signer ${account.address} has ${formatEther(available)} tBNB. Buffered target: ${formatEther(required)} tBNB.`);
}

async function send(step:string,account:typeof operator,data:Hex,to?:Address){
 const file=directory+'/'+step+'.json';
 const previous=existsSync(file);
 if(!previous){
  const wallet=createWalletClient({account,chain,transport});
  const request=await wallet.prepareTransactionRequest({account,data,to,type:'legacy',gasPrice:await client.getGasPrice()});
  const signed=await wallet.signTransaction(request);
  writeFileSync(file,JSON.stringify({hash:keccak256(signed),signed}),{flag:'wx'});
 }
 const {hash,signed}=read<{hash:Hex;signed:TransactionSerialized}>(file);
 if(keccak256(signed)!==hash)throw Error('Transaction journal hash mismatch for '+step);
 if(!previous)await client.sendRawTransaction({serializedTransaction:signed});
 else if(process.argv.includes('--rebroadcast-known')){
  try{await client.getTransaction({hash});}
  catch(error){
   if(!(error instanceof TransactionNotFoundError))throw error;
   // Rebroadcast the exact signed bytes. This preserves the sender, nonce and transaction hash.
   await client.sendRawTransaction({serializedTransaction:signed});
  }
 }
 const result=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:90000});
 if(result.transactionHash!==hash)throw Error('Journal transaction was replaced. Inspect '+hash);
 if(result.status!=='success')throw Error('Testnet transaction failed. Inspect '+hash);
 return result;
}
const deployment=await send('deployment',operator,bytecode);
const address=deployment.contractAddress;
if(!address)throw Error('Missing contract address in the deployment receipt.');
const call=(step:string,account:typeof operator,functionName:string,args:unknown[]=[])=>send(step,account,
 encodeFunctionData({abi:compiled.abi,functionName,args}),address);
const deploymentHash=deployment.transactionHash;
const log={chainId:97,address,deployment:deploymentHash,id,configuration,operator:operator.address,player:player.address,
 registration:{operator:'',player:''}};
const path='evidence/testnet-'+id+'.json';
const persist=(extra:object)=>{
 const pending=directory+'/evidence-'+randomUUID()+'.json';
 const previous=existsSync(path)?read<object>(path):{};
 writeFileSync(pending,JSON.stringify({...log,...previous,...extra,registration:log.registration},null,2));
 renameSync(pending,path);
};
const operatorRegistration=await call('operator-registration',operator,'register');
log.registration.operator=operatorRegistration.transactionHash;
const playerRegistration=await call('player-registration',player,'register');
log.registration.player=playerRegistration.transactionHash;
const created=await call('authorization',player,'createMatch',[id,configuration,1,1]);
persist({created:created.transactionHash});
const inferenceFile=directory+'/match-replay.json';
if(!existsSync(inferenceFile)){
 const attempts:Attempt[]=[];
 try{
  const replay=await runMatch(key,model,coaches,AbortSignal.timeout(60000),attempts);
  writeFileSync(inferenceFile,JSON.stringify({replay,attempts}),{flag:'wx'});
 }catch(error){
  persist({created:created.transactionHash,matchStatus:'interrupted',attempts});
  throw error;
 }
}
const inference=read<{replay:unknown;attempts:Attempt[]}>(inferenceFile);
const replay=validateReplay(inference.replay);
const {attempts}=inference;
persist({created:created.transactionHash,replay,attempts});
const actions=replay.events.map(e=>e.actions.map(a=>['wait','advance','attack','reload'].indexOf(a))) as [number,number][];
const transcriptHash=keccak256(encodeAbiParameters([{type:'uint8[2][]'}],[actions]));
const finalized=await call('settlement',operator,'settle',[id,configuration,actions]);
const record=await client.readContract({address,abi:compiled.abi,functionName:'matches',args:[id]}) as [string,string,string,string,number];
const resultCode={blue:1,sand:2,draw:3}[replay.result];
if(record[0].toLowerCase()!==player.address.toLowerCase()||record[1].toLowerCase()!==operator.address.toLowerCase()||record[2]!==configuration||record[3]!==transcriptHash||record[4]!==resultCode)throw Error('Confirmed record differs from the replay.');
persist({created:created.transactionHash,settlement:finalized.transactionHash,gasUsed:String(finalized.gasUsed),replay,attempts,record});
try{
 await client.simulateContract({account:operator,address,abi:compiled.abi,functionName:'settle',args:[id,configuration,actions]});
 throw Error('Duplicate settlement unexpectedly simulated successfully.');
}catch(error){
 if(!(error instanceof Error)||!error.message.includes('match unavailable'))throw error;
}
persist({created:created.transactionHash,settlement:finalized.transactionHash,gasUsed:String(finalized.gasUsed),replay,attempts,record,duplicateSettlementRejected:true,
 receiptGas:Object.fromEntries(Object.entries({deployment,operatorRegistration,playerRegistration,authorization:created,settlement:finalized}).map(([step,result])=>[step,String(result.gasUsed)]))});
console.log(path);
