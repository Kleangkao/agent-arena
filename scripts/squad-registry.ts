import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import solc from 'solc';
import {createPublicClient,createTestClient,createWalletClient,encodeFunctionData,http,isAddress,keccak256,parseTransaction,recoverTransactionAddress,TransactionNotFoundError,type Address,type Hex,type TransactionSerialized} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {bscTestnet,hardhat} from 'viem/chains';
import bombReplay from '../src/fixtures/relay-yard-gemini-bomb.json';
import {checkSquadRecord,publicTestnetReplayRpc,squadCommitment,squadReceiptAbi} from '../src/squads/receipt';
import {readParticipationEvidence} from '../src/squads/participation';

const [network,operation,argument,...flags]=process.argv.slice(2);
const local=network==='local';
if(!local&&network!=='testnet')throw Error('Choose local or testnet explicitly.');
if(!['deploy','publish','verify','quote-identity','publish-identity','verify-identity'].includes(operation))throw Error('Unknown registry operation.');
const identity=operation.endsWith('-identity');
const readOnly=operation==='verify'||operation==='verify-identity'||operation==='quote-identity';
const address=operation==='deploy'?undefined:argument;
if(operation!=='deploy'&&(!address||!isAddress(address)))throw Error('Provide the registry address.');
const [expectedIdentity,...identityFlags]=flags;
if(identity&&!/^0x[a-f0-9]{64}$/.test(expectedIdentity??''))throw Error('Pass the exact reviewed identity evidence hash.');
const options=operation==='deploy'?[argument,...flags].filter(Boolean):identity?identityFlags:flags;
if(options.some(option=>option!=='--confirm-testnet-write'&&option!=='--rebroadcast-known'))throw Error('Unknown option.');
if(!local&&!readOnly&&!options.includes('--confirm-testnet-write'))throw Error('Testnet writes require explicit owner approval.');

const chain=local?hardhat:bscTestnet;
const rpc=local?new URL(process.env.PARITY_RPC??'http://127.0.0.1:8545'):undefined;
if(rpc&&!['127.0.0.1','localhost','[::1]'].includes(rpc.hostname))throw Error('Use a loopback RPC for the local registry.');
const transport=http(rpc?.href??process.env.BSC_TESTNET_RPC??publicTestnetReplayRpc,{timeout:10000,retryCount:0});
const client=createPublicClient({chain,transport});
if(await client.getChainId()!==chain.id)throw Error(`RPC must serve chain ${chain.id}.`);

const reviewed=identity?await readParticipationEvidence(JSON.parse(readFileSync('public/competition/commander-2933.json','utf8'))):null;
if(reviewed&&(reviewed.evidenceHash!==expectedIdentity||reviewed.proof.entry.agentId!=='2933'||
 reviewed.proof.entry.audience!=='https://agent-arena-preview.vercel.app'))throw Error('The evidence differs from the reviewed identity and match.');
if(!local&&reviewed&&operation==='publish-identity'){
 const url=reviewed.proof.entry.audience+'/competition/commander-2933.json';
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok||(await readParticipationEvidence(await response.json())).evidenceHash!==reviewed.evidenceHash)
  throw Error('The reviewed evidence must be publicly retrievable before publication.');
}
const matchId=reviewed?.proof.entry.matchId??'94c5e9e8-b2cc-4fd1-b261-5aa814be685f';
const commitment=squadCommitment(bombReplay,matchId);
const matchKey=reviewed?.matchKey??commitment.matchKey;
const replayHash=reviewed?.evidenceHash??commitment.replayHash;
if(!matchKey)throw Error('Missing match key.');

async function readRecord(registry:Address,hash?:Hex){
 const record=await checkSquadRecord(client,chain.id,registry,matchKey!,replayHash);
 if(record.status!=='recorded')throw Error(`Replay record ${record.status}.`);
 if(hash&&record.hash!==hash)throw Error('Recorded transaction differs from the submitted transaction.');
 const receipt=await client.getTransactionReceipt({hash:record.hash});
 const [recordedHash,recordedBlock]=await client.readContract({address:registry,abi:squadReceiptAbi,functionName:'records',args:[matchKey!]});
 return {chainId:chain.id,address:registry,matchId,matchKey,...(reviewed?{evidenceHash:replayHash,replayHash:reviewed.replayHash}:{replayHash}),recordedHash,recordedBlock:String(recordedBlock),
  transactionHash:record.hash,gasUsed:String(receipt.gasUsed),confirmations:String(await client.getBlockNumber({cacheTime:0})-receipt.blockNumber+1n)};
}

if(operation==='quote-identity'){
 const registry=address as Address;
 const operator=await client.readContract({address:registry,abi:squadReceiptAbi,functionName:'operator'});
 const gas=await client.estimateContractGas({address:registry,abi:squadReceiptAbi,functionName:'recordReplay',args:[matchKey,replayHash],account:operator});
 console.log(JSON.stringify({chainId:chain.id,registry,matchId,evidenceHash:replayHash,gas:String(gas),estimatedFeeWei:String(gas*await client.getGasPrice())}));
}else if(readOnly){
 console.log(await readRecord(address as Address));
}else{
 const wallet=createWalletClient({chain,transport});
 const key=process.env.BSC_TESTNET_OPERATOR_KEY;
 if(!local&&(!key||!/^0x[a-fA-F0-9]{64}$/.test(key)))throw Error('Load the dedicated Testnet operator securely.');
 const signer=local?undefined:privateKeyToAccount(key as Hex);
 const operator=signer?.address??(await wallet.getAddresses())[0];
 if(!operator)throw Error('No local deployment account available.');
 if(!local&&operator!=='0x0f7340C0B93377f4c59d0ACCcc076991bb872E30')throw Error('Use the approved dedicated squad registry operator.');
 const directory='.arena-data/squad-registry-testnet';

 async function send(step:string,data:Hex,to?:Address){
  let hash:Hex;
  if(!signer){
   hash=await wallet.sendTransaction({account:operator,data,to});
  }else{
   mkdirSync(directory,{recursive:true});
   const file=`${directory}/${step}.json`;
   const previous=existsSync(file);
   if(!previous){
    const request=await wallet.prepareTransactionRequest({account:signer,data,to,type:'legacy',gasPrice:await client.getGasPrice()});
    if(identity&&request.gas*request.gasPrice>10000000000000n)throw Error('Identity publication exceeds 0.00001 tBNB.');
    const signed=await signer.signTransaction({chainId:chain.id,data,to,type:'legacy',gasPrice:request.gasPrice,gas:request.gas,nonce:request.nonce});
    writeFileSync(file,JSON.stringify({hash:keccak256(signed),signed}),{flag:'wx'});
   }
   const saved=JSON.parse(readFileSync(file,'utf8')) as {hash:Hex;signed:TransactionSerialized};
   const parsed=parseTransaction(saved.signed);
   if(keccak256(saved.signed)!==saved.hash||parsed.chainId!==chain.id||parsed.data!==data||Boolean(parsed.value)||
    (parsed.to??undefined)?.toLowerCase()!==to?.toLowerCase()||
    (await recoverTransactionAddress({serializedTransaction:saved.signed}))!==operator)
    throw Error('The transaction journal does not match the current registry operation.');
   hash=saved.hash;
   console.log({chainId:chain.id,operation:step,transactionHash:hash});
   if(!previous)await client.sendRawTransaction({serializedTransaction:saved.signed});
   else if(options.includes('--rebroadcast-known')){
    try{await client.getTransaction({hash});}
    catch(error){
     if(!(error instanceof TransactionNotFoundError))throw error;
     await client.sendRawTransaction({serializedTransaction:saved.signed});
    }
   }
  }
  const first=await client.waitForTransactionReceipt({hash,timeout:90000});
  if(first.transactionHash!==hash||first.status!=='success')throw Error(`Registry transaction failed or was replaced: ${hash}`);
  if(local)await createTestClient({chain:hardhat,mode:'hardhat',transport}).mine({blocks:1});
  const confirmed=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:90000});
  if(confirmed.transactionHash!==hash||confirmed.status!=='success')throw Error(`Registry confirmation failed: ${hash}`);
  return confirmed;
 }

 if(operation==='deploy'){
  const name='SquadReplayRegistry.sol';
  const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{[name]:{content:readFileSync('contracts/'+name,'utf8')}},
   settings:{evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['evm.bytecode.object']}}},
  })));
  const bytecode=compiled.contracts?.[name]?.SquadReplayRegistry.evm.bytecode.object;
  if(!bytecode)throw Error('SquadReplayRegistry compilation failed.');
  const receipt=await send('deploy',`0x${bytecode}`);
  if(!receipt.contractAddress)throw Error('Missing deployed registry address.');
  const owner=await client.readContract({address:receipt.contractAddress,abi:squadReceiptAbi,functionName:'operator'});
  if(owner!==operator)throw Error('Unexpected registry operator.');
  console.log({chainId:chain.id,address:receipt.contractAddress,operator,transactionHash:receipt.transactionHash,gasUsed:String(receipt.gasUsed)});
 }else{
  const registry=address as Address;
   if(!local){
    const {hash}=JSON.parse(readFileSync(directory+'/deploy.json','utf8')) as {hash:Hex};
    const deployment=await client.getTransactionReceipt({hash});
    if(deployment.status!=='success'||deployment.contractAddress?.toLowerCase()!==registry.toLowerCase()||
     deployment.from.toLowerCase()!==operator.toLowerCase())throw Error('Publish only to the registry deployed by this workflow.');
   }
  const owner=await client.readContract({address:registry,abi:squadReceiptAbi,functionName:'operator'});
  if(owner!==operator)throw Error('The signer is not the registry operator.');
  const record=await checkSquadRecord(client,chain.id,registry,matchKey,replayHash);
  if(record.status==='different')throw Error('Registry already contains a different replay for this match.');
  if(record.status==='absent'){
   const {request}=await client.simulateContract({address:registry,abi:squadReceiptAbi,functionName:'recordReplay',account:operator,args:[matchKey,replayHash]});
   const data=encodeFunctionData({abi:request.abi,functionName:request.functionName,args:request.args});
   const receipt=await send(identity?`identity-${matchId}`:`publish-${registry.toLowerCase()}`,data,registry);
   console.log(await readRecord(registry,receipt.transactionHash));
  }else console.log(await readRecord(registry));
 }
}
