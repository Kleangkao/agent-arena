import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createPublicClient,createWalletClient,encodeFunctionData,formatEther,http,keccak256,parseEventLogs,parseTransaction,recoverTransactionAddress,TransactionNotFoundError,type Hex,type TransactionSerialized} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {bscTestnet} from 'viem/chains';
import {agentIdentityAbi,agentRegistry,commanderProfile as profile,readAgentIdentity} from '../src/agent-identity';

if(process.argv.length!==3||process.argv[2]!=='--confirm-erc8004-testnet-registration')throw Error('Explicit ERC-8004 Testnet registration approval required.');
const accountAddress='0x0f7340C0B93377f4c59d0ACCcc076991bb872E30';
const key=process.env.BSC_TESTNET_OPERATOR_KEY;
if(!key||!/^0x[a-fA-F0-9]{64}$/.test(key))throw Error('Load the dedicated Testnet signer.');
const account=privateKeyToAccount(key as Hex);
if(account.address!==accountAddress)throw Error('Unexpected registration signer.');

const transport=http('https://bsc-testnet-rpc.publicnode.com',{timeout:10000,retryCount:0});
const client=createPublicClient({chain:bscTestnet,transport});
const wallet=createWalletClient({chain:bscTestnet,transport,account});
if(await client.getChainId()!==bscTestnet.id)throw Error('Expected BSC Testnet.');
const data=encodeFunctionData({abi:agentIdentityAbi,functionName:'register',args:[profile]});
const directory='.arena-data/erc8004-testnet';
const path=`${directory}/commander.json`;
mkdirSync(directory,{recursive:true});
type Journal={hash:Hex;signed:TransactionSerialized};
let journal:Journal;
let prepared=false;
try{journal=JSON.parse(readFileSync(path,'utf8')) as Journal;}
catch(error){
 if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
 const response=await fetch(profile,{signal:AbortSignal.timeout(10000)});
 if(!response.ok||(await response.json()).name!=='AGENT ARENA · Squad Commander')throw Error('Publish the commander profile before registration.');
 const call={account,address:agentRegistry,abi:agentIdentityAbi,functionName:'register',args:[profile]} as const;
 await client.simulateContract(call);
 const [gas,gasPrice,balance,nonce]=await Promise.all([client.estimateContractGas(call),client.getGasPrice(),client.getBalance({address:account.address}),client.getTransactionCount({address:account.address,blockTag:'pending'})]);
 if(gas*gasPrice>30_000_000_000_000n||gas*gasPrice>balance)throw Error('Registration fee exceeds the Testnet safety bound.');
 const signed=await account.signTransaction({chainId:bscTestnet.id,type:'legacy',to:agentRegistry,data,gas,gasPrice,nonce});
 journal={signed,hash:keccak256(signed)};
 writeFileSync(path,JSON.stringify(journal),{flag:'wx'});
 prepared=true;
}
const transaction=parseTransaction(journal.signed);
if(journal.hash!==keccak256(journal.signed)||transaction.chainId!==bscTestnet.id||transaction.to?.toLowerCase()!==agentRegistry.toLowerCase()||transaction.data!==data||transaction.value||
 await recoverTransactionAddress({serializedTransaction:journal.signed})!==account.address)throw Error('Registration journal mismatch.');

if(prepared){
 console.log(`ERC-8004 Testnet registration transaction: ${journal.hash}`);
 if(await wallet.sendRawTransaction({serializedTransaction:journal.signed})!==journal.hash)throw Error('RPC returned a different transaction hash.');
}else{
 try{await client.getTransaction({hash:journal.hash});}
 catch(error){if(error instanceof TransactionNotFoundError)throw Error(`Check the existing registration journal and transaction ${journal.hash} before rebroadcasting.`);throw error;}
}
const receipt=await client.waitForTransactionReceipt({hash:journal.hash,confirmations:2,timeout:45000});
const [event,...extra]=parseEventLogs({abi:agentIdentityAbi,eventName:'Registered',logs:receipt.logs.filter(log=>log.address.toLowerCase()===agentRegistry.toLowerCase())});
if(receipt.status!=='success'||!event||extra.length||event.args.owner!==account.address||event.args.agentURI!==profile)throw Error('Registration receipt mismatch.');
const identity=await readAgentIdentity(client,event.args.agentId.toString());
if(identity.owner!==account.address||identity.profile!==profile)throw Error('Registered owner or profile state mismatch.');
console.log(JSON.stringify({chainId:bscTestnet.id,registry:agentRegistry,id:identity.id,owner:identity.owner,profile,transaction:receipt.transactionHash,
 block:String(receipt.blockNumber),gasUsed:String(receipt.gasUsed),feeTbnb:formatEther(receipt.gasUsed*receipt.effectiveGasPrice)}));
