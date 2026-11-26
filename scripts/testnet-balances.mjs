import {createPublicClient,createWalletClient,formatEther,formatGwei,http,keccak256} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {bscTestnet} from 'viem/chains';
import {existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';

try{
 const keys=[process.env.BSC_TESTNET_OPERATOR_KEY,process.env.BSC_TESTNET_PLAYER_KEY];
 if(keys.some(key=>!/^0x[a-fA-F0-9]{64}$/.test(key??'')))throw Error('Missing or invalid encrypted Testnet signers');
 const [operatorAccount,playerAccount]=keys.map(key=>privateKeyToAccount(key));
 const operator=operatorAccount.address,player=playerAccount.address;
 if(operator===player)throw Error('Testnet signer addresses must be distinct');
 const bundles=existsSync('dist/assets')?readdirSync('dist/assets').filter(file=>file.endsWith('.js')):[];
 for(const bundle of bundles){
  const source=readFileSync('dist/assets/'+bundle,'utf8');
  if(keys.some(key=>source.includes(key)||source.includes(key.slice(2))))throw Error('Unexpected signer material in the frontend build');
 }
 const transport=http(process.env.BSC_TESTNET_RPC,{timeout:10000,retryCount:0});
 const client=createPublicClient({chain:bscTestnet,transport});
 if(await client.getChainId()!==97)throw Error('Unexpected chain ID');
 const [gasPrice,operatorBalance,playerBalance]=await Promise.all([
  client.getGasPrice(),client.getBalance({address:operator}),client.getBalance({address:player}),
 ]);
 const report=(address,balance,gas)=>{
  const target=gas*gasPrice;
  return {address,balance:formatEther(balance),target:formatEther(target),shortfall:formatEther(balance<target?target-balance:0n)};
 };
 if(process.argv.includes('--fund')){
  if(operator!=='0x0f7340C0B93377f4c59d0ACCcc076991bb872E30'||player!=='0x54adC3BdDB9234DD4Fa195b23c14B624B174133A')throw Error('Unexpected funding participants');
  const file='.arena-data/testnet-funding.json';
  const target=240000n*gasPrice;
  if(playerBalance<target&&!existsSync(file)){
   const amount=target-playerBalance;
   const gas=await client.estimateGas({account:operator,to:player,value:amount});
   if(operatorBalance<amount+(gas+1800000n)*gasPrice)throw Error('Operator balance is below the combined requirement');
   const wallet=createWalletClient({account:operatorAccount,chain:bscTestnet,transport});
   const request=await wallet.prepareTransactionRequest({account:operatorAccount,to:player,value:amount,gas,gasPrice,type:'legacy'});
   const signed=await wallet.signTransaction(request);
   writeFileSync(file,JSON.stringify({hash:keccak256(signed)}),{flag:'wx'});
   await client.sendRawTransaction({serializedTransaction:signed});
  }
  if(existsSync(file)){
   const {hash}=JSON.parse(readFileSync(file,'utf8'));
   const receipt=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:90000});
   const tx=await client.getTransaction({hash});
   if(receipt.status!=='success'||receipt.transactionHash!==hash||tx.to?.toLowerCase()!==player.toLowerCase()||
     tx.from.toLowerCase()!==operator.toLowerCase())throw Error('Funding receipt mismatch');
   const [operatorAfter,playerAfter]=await Promise.all([client.getBalance({address:operator}),client.getBalance({address:player})]);
   if(playerAfter<target||operatorAfter<1800000n*gasPrice)throw Error('Confirmed funding does not cover remaining transactions');
   console.log(JSON.stringify({chainId:97,hash,amount:formatEther(tx.value),gasUsed:String(receipt.gasUsed),
    operator:report(operator,operatorAfter,1800000n),player:report(player,playerAfter,240000n)}));
   process.exit(0);
  }
 }
 console.log(JSON.stringify({chainId:97,gasPriceGwei:formatGwei(gasPrice),frontendBundlesChecked:bundles.length,
  operator:report(operator,operatorBalance,1800000n),player:report(player,playerBalance,240000n),
 }));
}catch{
 console.error('Could not validate dedicated signers and BSC Testnet balances.');
 process.exitCode=1;
}
