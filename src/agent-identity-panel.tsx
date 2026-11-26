import {useEffect,useState,type FormEvent} from 'react';
import type {EIP1193Provider} from 'viem';

type Identity=Awaited<ReturnType<typeof import('./agent-identity').lookupAgentIdentity>>;
const commanderId='2933';

export function AgentIdentityPanel({onWatchBomb,onEnter,onHistory}:{onWatchBomb:()=>void;onEnter?:(id:string)=>void;onHistory?:()=>void}){
 const [id,setId]=useState('');
 const [record,setRecord]=useState<Identity>();
 const [lookup,setLookup]=useState('');
 const [pending,setPending]=useState(false);
 const [wallet,setWallet]=useState('');
 const [walletStatus,setWalletStatus]=useState('');
 const provider=(window as Window&{ethereum?:EIP1193Provider}).ethereum;
 useEffect(()=>{
  const reset=()=>{setWallet('');setWalletStatus('Wallet changed. Check ownership again.');};
  provider?.on?.('accountsChanged',reset);
  provider?.on?.('chainChanged',reset);
  return()=>{provider?.removeListener?.('accountsChanged',reset);provider?.removeListener?.('chainChanged',reset);};
 },[provider]);

 const find=async(value:string)=>{
  setPending(true);setLookup('Looking up BSC Testnet identity…');setRecord(undefined);
  try{
   const {parseAgentId,lookupAgentIdentity}=await import('./agent-identity');
   try{parseAgentId(value.trim());}catch{setLookup('Enter a valid agent ID.');return;}
   setRecord(await lookupAgentIdentity(value.trim()));setLookup('');
  }catch{setLookup('Identity unavailable. Check the ID or try again.');}
  finally{setPending(false);}
 };
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void find(id);};
 const isArena=record?.id===commanderId&&record.profile==='https://agent-arena-preview.vercel.app/agent-arena-commander.json';
 const connect=async()=>{
  setWallet('');
  if(!provider){setWalletStatus('Open this page in a browser with a wallet.');return;}
  try{
   const accounts=await provider.request({method:'eth_requestAccounts'});
   if(await provider.request({method:'eth_chainId'})!=='0x61'){
    setWalletStatus('Switch your wallet to BSC Testnet, then try again.');return;
   }
   if(!accounts[0])throw Error();
   setWallet(accounts[0]);setWalletStatus('');
  }catch{setWalletStatus('Wallet connection was unavailable.');}
 };

 return <section className="passport-identity" aria-label="BNB agent identity">
  <p>Find an ERC-8004 agent registered on BSC Testnet. Search by agent ID.</p>
  <button type="button" className="textbutton" disabled={pending} onClick={()=>{setId(commanderId);void find(commanderId);}}>Find Arena Commander</button>
  <form onSubmit={submit}>
   <label htmlFor="passport-agent-id">Agent ID</label>
   <div><input id="passport-agent-id" inputMode="numeric" value={id} maxLength={78} required disabled={pending} onChange={event=>setId(event.target.value)}/>
    <button type="submit" className="textbutton" disabled={pending}>Look up agent</button></div>
  </form>
  {lookup&&<p role="status">{lookup}</p>}
  {record&&<div className="passport-record">
   <p><strong>ERC-8004 agent #{record.id}</strong> · BSC Testnet</p>
   <p>Registered owner <a href={`https://testnet.bscscan.com/address/${record.owner}`}>{record.owner}</a></p>
   {record.profile&&<p><a href={record.profile} target="_blank" rel="noopener noreferrer">Agent’s public profile ↗</a></p>}
   {isArena&&<div>
    <p><strong>Arena Commander</strong> · Registered on BSC Testnet</p>
    <a href="https://testnet.bscscan.com/tx/0xfaf23fdba98496e60bd637f74ee410f4f64e59d7c7caa7caed9988a7ee08fa7e" target="_blank" rel="noopener noreferrer">Registration transaction ↗</a>
    {onHistory&&<p><button type="button" className="textbutton" onClick={onHistory}>Watch the Commander’s competitive record</button></p>}
    <p><a href="https://testnet.bscscan.com/address/0x8004B663056A597Dffe9eCcC1965A193B7388713">ERC-8004 Reputation Registry ↗</a></p>
    <p>Explore the Arena’s earlier Bomb match and its replay commitment. It predates this registration.</p>
    <button type="button" className="textbutton" onClick={onWatchBomb}>Watch historical Bomb match</button>
   </div>}
   {onEnter&&<p><button type="button" className="textbutton" onClick={()=>onEnter(record.id)}>Choose a match for agent #{record.id}</button></p>}
   <button type="button" className="textbutton" onClick={connect}>Check connected wallet</button>
   {walletStatus&&<p role="status">{walletStatus}</p>}
   {wallet&&<p role="status">{wallet.toLowerCase()===record.owner.toLowerCase()?'Connected wallet matches the registered owner.':'Connected wallet differs from the registered owner.'}</p>}
   <p className="hint">Registry ownership and Arena competition records are checked separately.</p>
  </div>}
 </section>;
}
