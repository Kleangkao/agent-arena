import {useState} from 'react';
import type {EIP1193Provider} from 'viem';
import {participationEntry,participationInput,typedParticipation,type ParticipationEntry,type ParticipationProof} from './participation';

export async function signEntryInWallet(entry:ParticipationEntry){
 const provider=(window as Window&{ethereum?:EIP1193Provider}).ethereum;
 if(!provider)throw Error('Open Arena in a browser with a wallet to enter a registered agent.');
 try{
  const [account]=await provider.request({method:'eth_requestAccounts'});
  if(!account)throw Error('No account');
  if(await provider.request({method:'eth_chainId'})!=='0x61')return null;
  const typed=typedParticipation(entry);
  const signature=await provider.request({method:'eth_signTypedData_v4',params:[account,JSON.stringify({
   ...typed,types:{...typed.types,EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},
    {name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}]},
  })]});
  return participationInput.parse({agentId:entry.agentId,expires:entry.expires,signature});
 }catch{throw Error('Match entry was not signed. You can try again or enter as a guest.');}
}

export function checkedEntry(input:unknown,scope:Pick<ParticipationEntry,'agentId'|'mode'|'opponent'>){
 const entry=participationEntry.parse(input);
 if(entry.agentId!==scope.agentId||entry.mode!==scope.mode||entry.opponent!==scope.opponent||
    !(entry.audience===location.origin||['localhost','127.0.0.1'].includes(location.hostname)&&entry.audience==='http://localhost/agent-arena-development'))
  throw Error('Could not confirm the requested match entry.');
 return entry;
}

export function ParticipationSummary({proof,publicUrl}:{proof:ParticipationProof;publicUrl?:string}){
 const [status,setStatus]=useState('');
 async function verify(){
  if(!publicUrl)return;
  setStatus('Checking replay and ownership on BSC Testnet…');
  try{
   const [response,{readParticipationEvidence}]=await Promise.all([
    fetch(publicUrl,{signal:AbortSignal.timeout(10000)}),import('./participation'),
   ]);
   if(!response.ok)throw Error();
   await readParticipationEvidence(await response.json());
   setStatus('Owner signature, historical BSC Testnet ownership, and replay confirmed.');
  }catch{setStatus('Could not confirm the evidence. Try again.');}
 }
 return <details className="match-details"><summary>Agent participation · ERC-8004 #{proof.entry.agentId}</summary>
  <p>Blue entered with a wallet signature checked against the registered BSC Testnet owner. Sand was an official Arena opponent.</p>
  <p>Squad results are computed from the replay. Arena attests to model use.</p>
  {publicUrl&&<><a href={publicUrl}>Public match evidence</a>{' · '}
   <button className="textbutton" type="button" onClick={()=>void verify()}>Check participation and replay</button></>}
  {status&&<p role="status">{status}</p>}
 </details>;
}
