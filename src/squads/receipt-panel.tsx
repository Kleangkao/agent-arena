import {useState} from 'react';
import type {SquadReplay} from './game';
import type {Address,Hash} from 'viem';

const configured=import.meta.env.VITE_BSC_TESTNET_SQUAD_REGISTRY;
const registry=typeof configured==='string'&&/^0x[a-fA-F0-9]{40}$/.test(configured)?configured as Address:null;

export function SquadReceipt({replay,matchId,identityHash}:{replay:SquadReplay;matchId?:string;identityHash?:Hash}){
 const [commitment,setCommitment]=useState<Hash>();
 const [transaction,setTransaction]=useState<Hash>();
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 if(!replay.final||replay.source!=='operator-attested-gemini')return null;

 async function check(){
  setBusy(true);
  setStatus('');
  setTransaction(undefined);
  try{
   const {squadCommitment,checkTestnetSquadRecord}=await import('./receipt');
   const {replayHash,matchKey}=squadCommitment(replay,matchId);
   setCommitment(identityHash??replayHash);
   if(!registry||!matchKey)return;
   const record=await checkTestnetSquadRecord(registry,matchKey,identityHash??replayHash);
   switch(record.status){
    case 'recorded':
     setTransaction(record.hash);
     setStatus(identityHash?'Identity and replay commitment recorded on BSC Testnet.':'Replay hash recorded on BSC Testnet.');
     break;
    case 'pending':setStatus('Replay record is awaiting confirmation. Try again shortly.');break;
    case 'different':setStatus('The on-chain hash differs from this evidence.');break;
    case 'absent':setStatus('No on-chain record for this match.');break;
   }
  }catch{setStatus('Could not check this replay. Try again.');}
  finally{setBusy(false);}
 }

 return <details className="squad-receipt">
  <summary>BNB Chain replay record</summary>
  <p>The game checks the outcome by replaying the orders. A Testnet record can show when the operator published the {identityHash?'signed entry and replay commitment':'replay hash'}. Model provenance remains operator-attested.</p>
  {(!registry||!matchId)&&<p>Testnet lookup is unavailable for this replay.</p>}
  <button className="textbutton" type="button" disabled={busy} onClick={check}>
   {busy?'Checking…':registry&&matchId?'Check Testnet record':'Show replay hash'}
  </button>
  {commitment&&<p>{identityHash?'Evidence hash':'Replay hash'} <code style={{overflowWrap:'anywhere'}}>{commitment}</code></p>}
  {status&&<p role="status">{status}</p>}
  {transaction&&<a href={'https://testnet.bscscan.com/tx/'+transaction} target="_blank" rel="noreferrer">View Testnet transaction</a>}
 </details>;
}
