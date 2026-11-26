import React, {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {initial,resolve,type State,type Action} from './game';
import {validateReplay,type StoredReplay} from './replay';
import historical from './fixtures/historical-gemini.json';
import recentReplay from './fixtures/two-turn-gemini.json';
import {Battlefield} from './battlefield';
import {TeamEmblem} from './arena-board';
import {officials,stages,trainingAgent,trainingOpponent,trainingProgress,type OfficialId} from './competition';
import {load as loadContinuous} from './v26/replay';
import type {Decision} from './v26/spectate';
import {initialSquads,loadSquads,scriptedSquads,currentSquadConfig,continuousSquadRules,territorySquadRules,squadModes} from './squads/game';
import {RelayBoard,WatchSquads,squadModeLabels} from './squads/watch';
import {SquadReceipt} from './squads/receipt-panel';
import {AgentIdentityPanel} from './agent-identity-panel';
import {MatchReview,MatchStrategy,defaultStrategy,type MatchOpponentId,type PrivateGuidance,type ReviewAttempt,type StrategyChoices} from './match-strategy';
import {arenaOpponents,highestWins,isArenaOpponent,previewChallenge} from './squads/arena-bots';
import type {ArenaDifficulty,SquadMode} from './squads/game';
import type {ParticipationProof,participationInput} from './squads/participation';
import type {z} from 'zod';
import type {Hash} from 'viem';
import './style.css';
const preview=import.meta.env.MODE==='preview';
const configuredContract=import.meta.env.VITE_BSC_TESTNET_CONTRACT;
const configuredTransaction=import.meta.env.VITE_BSC_TESTNET_SETTLEMENT_TX;
const hasCustomPassport=!!(configuredContract||configuredTransaction);
const passportAddress=hasCustomPassport?configuredContract:'0x6bb39ff181723b6238cac858a1c9c028ffc97d09';
const passportTransaction=hasCustomPassport?configuredTransaction:'0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672';
const passportConfigured=/^0x[a-fA-F0-9]{40}$/.test(passportAddress??'')&&/^0x[a-fA-F0-9]{64}$/.test(passportTransaction??'');
type RecordItem={id?:string;result:string; coaching:string; date:string;agentId?:string;mode?:SquadMode;difficulty?:ArenaDifficulty;format?:'challenge'|'versus'};
type ChallengeLog={id:string;mode:SquadMode;difficulty:ArenaDifficulty;opponent:string;policy:string;result:string;date:string;agentId?:string};
const challengeKey='arena-challenge-history';
const Spectate=lazy(()=>import('./v26/spectate'));
type LiveSquadRules=typeof continuousSquadRules|typeof territorySquadRules;
type MatchDraft=StrategyChoices&{coaching:string;rulesVersion?:LiveSquadRules};
type PendingMatch=Partial<StrategyChoices>&{requestId:string;coaching:string;opponent:MatchOpponentId;rulesVersion?:'arcade-v2.6'|LiveSquadRules;mode?:'objective-duel'|SquadMode;sameSetup?:string;participation?:z.infer<typeof participationInput>};
type ContinuousMatch={replay:ReturnType<typeof loadContinuous>;decisions:Decision[];recorded:boolean;viewed?:boolean;id?:string;opponent?:OfficialId};
type SquadMatch={match:ReturnType<typeof loadSquads>;id?:string;opponent?:MatchOpponentId;recorded?:boolean;viewed?:boolean;playback:number;proof?:ParticipationProof;publicUrl?:string;identityHash?:Hash;
 guidance?:PrivateGuidance;attempts?:ReviewAttempt[];model?:string;comparison?:ReturnType<typeof loadSquads>;caption?:string};
const ParticipationSummary=lazy(()=>import('./squads/participation-panel').then(module=>({default:module.ParticipationSummary})));
const previews=Object.fromEntries(squadModes.map(mode=>[mode,initialSquads(currentSquadConfig(mode))]));
type Reflection={status:'saved';revision:number;lessons:string[]}|{status:'unavailable'}|null;
function AgentPassport({onWatchBomb,onEnter,onHistory}:{onWatchBomb:()=>void;onEnter?:(id:string)=>void;onHistory?:()=>void}){
 const [record,setRecord]=useState<Awaited<ReturnType<typeof import('./passport').readPassport>>>();
 const [status,setStatus]=useState('');
 const check=async()=>{
  if(!passportConfigured)return;
  setStatus('Checking BSC Testnet…');
  try{
   const {readPassport}=await import('./passport');
   setRecord(await readPassport(passportAddress,passportTransaction));
   setStatus('');
  }catch{setStatus('Could not confirm the settlement. Try again.');}
 };
 return <details><summary>Agent Passport</summary>
  <AgentIdentityPanel onWatchBomb={onWatchBomb} onEnter={onEnter} onHistory={onHistory}/>
  <p>The original duel has a separate public settlement.</p>
  {passportConfigured?<><button className="textbutton" type="button" onClick={check}>Check public settlement</button>
   {status&&<p role="status">{status}</p>}
   {record&&<div className="passport-record"><p><strong>Confirmed BSC Testnet · {record.outcome}</strong></p>
    <p>Public competition record · {record.id}</p>
    <p>Blue owner {record.blue}<br/>Sand owner {record.sand}</p>
    <a href={`https://testnet.bscscan.com/tx/${record.hash}`}>Settlement transaction</a>{' · '}
    <a href={`https://testnet.bscscan.com/address/${record.address}`}>Arena contract</a>
   </div>}
  </>:<p>No BSC Testnet settlement published.</p>}
  <a href="/protocol.md">Competition protocol</a>
 </details>;
}
function TeamStatus({team,hp}:{team:'blue'|'sand';hp:number}) {
 return <div className={`team-status team-${team}`}>
  <TeamEmblem side={team==='blue'?0:1}/>
  <div><span>{team==='blue'?'Blue Team':'Sand Team'}</span><meter min={0} max={100} value={hp} aria-label={`${team} health`} /></div>
  <b>{hp}</b>
 </div>;
}
function App(){const [page,setPage]=useState<'Play'|'My Agent'|'Arena'>('Play'); const [coaching,setCoaching]=useState(localStorage.getItem('coaching')||''); const [state,setState]=useState(initial); const [actions,setActions]=useState<[Action,Action]|null>(null);const [running,setRunning]=useState(false);const [status,setStatus]=useState('');const [history,setHistory]=useState<RecordItem[]>(JSON.parse(localStorage.getItem('history')||'[]'));const [challengeLog,setChallengeLog]=useState<ChallengeLog[]>(()=>{try{return JSON.parse(localStorage.getItem(challengeKey)||'[]')}catch{return []}});const [mode,setMode]=useState<'bot'|'ai'|'historical'>('bot');const [recording,setRecording]=useState<StoredReplay|null>(null);const [paused,setPaused]=useState(false);const [busy,setBusy]=useState(false);
 const [liveAvailable,setLiveAvailable]=useState(false);
 const [continuousAvailable,setContinuousAvailable]=useState(false);
 const [squadsAvailable,setSquadsAvailable]=useState(false);
 const [availableModel,setAvailableModel]=useState('');
 const [squadMode,setSquadMode]=useState<SquadMode>('relay');
 const [squads,setSquads]=useState<SquadMatch|null>(null);
 const [strategy,setStrategy]=useState(defaultStrategy);
 const [rematchSetup,setRematchSetup]=useState<SquadMatch>();
 const [legacyTraining,setLegacyTraining]=useState(false);
 const [continuous,setContinuous]=useState<ContinuousMatch|null>(null);
 const [previousContinuous,setPreviousContinuous]=useState<ContinuousMatch|null>(null);
 const [saving,setSaving]=useState(false);
 const save=async()=>{
  const message=coaching.trim();
  localStorage.setItem('coaching',message);
  setStatus('Coaching saved on this device.');
  if(!liveAvailable)return;
  setSaving(true);
  try{
   const guest=await fetch('/api/guest',{method:'POST',signal:AbortSignal.timeout(5000)});
   if(!guest.ok)throw Error();
   const response=await fetch('/api/coaching',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({coaching:message}),signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error();
   setStatus('Coaching saved for your next match.');
  }catch{setStatus('Saved on this device. Arena could not sync it.');}
  finally{setSaving(false);}
 };
 const [lessons,setLessons]=useState<string[]>([]);
 const [stage,setStage]=useState(0);
 const [cleared,setCleared]=useState<string[]>(()=>JSON.parse(localStorage.getItem('arena-training-cleared')||'[]'));
 const [opponent,setOpponent]=useState<MatchOpponentId>('arena-easy');
 const [settled,setSettled]=useState<State|null>(null);
 const [preparation,setPreparation]=useState('');
 const [reflection,setReflection]=useState<Reflection>(null);
 const [matchModel,setMatchModel]=useState('');
 const [liveId,setLiveId]=useState('');
 const [entryAgent,setEntryAgent]=useState<string>();
 const [publicRecord,setPublicRecord]=useState(false);
 const [recovered,setRecovered]=useState(false);
 const stageInfo=stages[stage];
 const unlocked=(index:number)=>index===0||cleared.includes(stages[index-1].id);
 useEffect(()=>{
  if(preview)return;
  const controller=new AbortController();
  fetch('/api/health',{signal:controller.signal}).then(response=>response.ok?response.json():null)
   .then(health=>{setLiveAvailable(health?.geminiConfigured===true);setContinuousAvailable(health?.continuousConfigured===true);setSquadsAvailable(health?.squadsConfigured===true);if(typeof health?.squadModel==='string')setAvailableModel(health.squadModel)}).catch(()=>{});
  import('./squads/participation').then(({publicParticipationPath})=>fetch(publicParticipationPath,{method:'HEAD',signal:controller.signal}))
   .then(response=>setPublicRecord(response.ok&&response.headers.get('content-type')?.includes('application/json')===true)).catch(()=>{});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(preview||page!=='My Agent')return;
  const controller=new AbortController();
  fetch('/api/memory',{signal:controller.signal}).then(response=>response.ok?response.json():null)
   .then(memory=>setLessons(memory?.lessons??[])).catch(()=>{});
  if(localStorage.getItem('coaching')===null){
   fetch('/api/coaching',{signal:controller.signal}).then(response=>response.ok?response.json():null)
    .then(saved=>{
     if(typeof saved?.coaching==='string'&&localStorage.getItem('coaching')===null){
      localStorage.setItem('coaching',saved.coaching);
      setCoaching(current=>current||saved.coaching);
     }
    }).catch(()=>{});
  }
  return ()=>controller.abort();
 },[page]);
 const request=useRef<AbortController|null>(null);
 const playReplay=(r:StoredReplay,m:'ai'|'historical')=>{setRecording(r);setSettled(null);setMode(m);setState(r.initialState);setActions(null);setPaused(false);setRunning(true);setPage('Play')};
 const start=(m:'bot'|'ai',resume=false,format:'lane'|'duel'|'squads'='lane',sameSetup?:{id?:string;opponent?:MatchOpponentId},resumeId?:string,chosen=squadMode,registeredAgent?:string,draft?:MatchDraft,comparison?:SquadMatch['match'])=>{
  request.current?.abort();
  const continuousRules=format==='duel';
  if(continuousRules&&continuous&&!continuous.recorded)setPreviousContinuous(continuous);
  setContinuous(null);setSquads(null);setLegacyTraining(m==='bot');
  setRecording(null);setSettled(null);setReflection(null);setMatchModel('');setLiveId('');setRecovered(resume);setPaused(false);setMode(m);setState(initial());setActions(null);setRunning(m==='bot');setStatus('');setPage('Play');setBusy(m==='ai');
  if(m==='bot')return;
  setPreparation(resume?'Reopening your match…':'Preparing your agent…');
  const controller=new AbortController();request.current=controller;
  const signal=controller.signal;
  const read=async(response:Response)=>{if(!response.ok){const error=await response.json().catch(()=>null);throw Error(error?.error??'Match unavailable. Open Arena to try again.')}return response.json()};
  void (async()=>{
   let id=resume?(resumeId??localStorage.getItem('arena-match')):null;
   if(!id){
    const pending=resume?localStorage.getItem('arena-pending-match'):null;
    const input:PendingMatch=pending?JSON.parse(pending):{requestId:crypto.randomUUID(),coaching:draft?.coaching??localStorage.getItem('coaching')??'',opponent:sameSetup?.opponent??opponent,
     ...(draft?{strategy:draft.strategy,autonomy:draft.autonomy}:{}),
     ...(continuousRules?{rulesVersion:'arcade-v2.6',mode:'objective-duel'}:format==='squads'?{rulesVersion:draft?.rulesVersion??currentSquadConfig(chosen).rulesVersion,mode:chosen}:{}),...(sameSetup?.id?{sameSetup:sameSetup.id}:{})};
    const guest=await fetch('/api/guest',{method:'POST',signal});
    if(!guest.ok)await read(guest);
    if(registeredAgent){
     setPreparation('Waiting for your wallet signature…');
     const scope={requestId:input.requestId,agentId:registeredAgent,mode:chosen,opponent:input.opponent};
     const [{checkedEntry,signEntryInWallet},entry]=await Promise.all([import('./squads/participation-panel'),
      fetch('/api/matches/entry',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(scope)}).then(read)]);
     signal.throwIfAborted();
     const checked=checkedEntry(entry,scope);
     if((checked.rulesVersion??continuousSquadRules)!==input.rulesVersion)throw Error('Arena returned a different rules version. Reopen your match setup and try again.');
     const permission=await signEntryInWallet(checked);
     signal.throwIfAborted();
     if(!permission)throw Error('Switch your wallet to BSC Testnet and try again.');
     input.participation=permission;
     setPreparation('Checking registered ownership…');
    }
    const previousId=localStorage.getItem('arena-match');
    localStorage.setItem('arena-pending-match',JSON.stringify(input));
    localStorage.removeItem('arena-match');
    const response=await fetch('/api/matches',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    if(!response.ok&&response.status>=400&&response.status<500){
     localStorage.removeItem('arena-pending-match');
     if(previousId)localStorage.setItem('arena-match',previousId);
    }
    const job=await read(response);
    if(typeof job.id!=='string')throw Error('Could not recover the match.');
    id=job.id;localStorage.setItem('arena-match',job.id);localStorage.removeItem('arena-pending-match');
   }
   if(!id)throw Error('Could not recover the match.');
   const matchId=id;
   setPreparation(format==='squads'?(isArenaOpponent(sameSetup?.opponent??opponent)?'Your commander is planning…':'Both commanders are planning…'):continuousRules?'Both agents are planning…':'Preparing the match…');
   for(let poll=0;poll<35;poll++){
    const job=await read(await fetch('/api/matches/'+encodeURIComponent(matchId),{signal}));
    if(job.status==='completed'){
     signal.throwIfAborted();
     localStorage.setItem('arena-match',matchId);
     const continuousReplay=job.rulesVersion==='arcade-v2.6'?loadContinuous(job.replay):null;
     const squadReplay=job.replay?.version===7?loadSquads(job.replay):null;
     const result=continuousReplay||squadReplay?null:validateReplay(job.replay);
     if(isArenaOpponent(job.opponent)||job.opponent==='official-sand'||job.opponent==='official-sand-pace')setOpponent(job.opponent);
     setReflection(job.reflection??null);setMatchModel(job.model??'');if(!squadReplay)setLiveId(matchId);
     const recent:RecordItem[]=JSON.parse(localStorage.getItem('history')||'[]');
     if(!recent.some(entry=>entry.id===matchId)){
      const challenge=squadReplay?.replay.challenge;
      const squadModePlayed=squadReplay&&'mode' in squadReplay.replay.config?squadReplay.replay.config.mode:undefined;
      const updated=[{id:matchId,result:squadReplay?.replay.final??continuousReplay?.recording.final.result??result?.result??'interrupted',coaching:'',date:new Date().toISOString(),agentId:job.participation?.entry.agentId,
       ...(challenge&&squadModePlayed?{mode:squadModePlayed,difficulty:challenge.difficulty,format:'challenge' as const}:{}),
       ...(!challenge&&squadReplay?{format:'versus' as const,mode:squadModePlayed}:{})},...recent].slice(0,20);
      localStorage.setItem('history',JSON.stringify(updated));setHistory(updated);
      if(challenge&&squadReplay.replay.final&&squadModePlayed){
       setChallengeLog(current=>{
        if(current.some(entry=>entry.id===matchId))return current;
        const saved:ChallengeLog[]=[{id:matchId,mode:squadModePlayed,difficulty:challenge.difficulty,opponent:challenge.opponent,policy:challenge.policy,result:squadReplay.replay.final!,date:new Date().toISOString(),agentId:job.participation?.entry.agentId},...current].slice(0,40);
        localStorage.setItem(challengeKey,JSON.stringify(saved));
        return saved;
       });
      }
     }
     if(squadReplay){
      setSquads({match:squadReplay,id:matchId,opponent:job.opponent,proof:job.participation,playback:0,guidance:job.guidance,attempts:job.attempts,model:job.model,comparison});
      setRematchSetup(undefined);
     }
     else if(continuousReplay)setContinuous({replay:continuousReplay,decisions:job.attempts??[],recorded:false,id:matchId,opponent:job.opponent});
     else if(result)playReplay(result,'ai');
     return;
    }
    if(job.status==='interrupted'){
     if(sameSetup?.id)localStorage.setItem('arena-match',sameSetup.id);
     else localStorage.removeItem('arena-match');
     throw Error(job.error??'Match preparation stopped. Try again from Arena.');
    }
    await new Promise(resolve=>setTimeout(resolve,2000));
   }
   throw Error('Preparation is taking longer than expected. You can reopen the match from Arena.');
  })().catch(error=>{if(!signal.aborted)setStatus(error.message)}).finally(()=>{if(!signal.aborted)setBusy(false)});
 };
 const openCompetitiveRecord=async()=>{
  request.current?.abort();setBusy(false);setStatus('');
  try{
   const {publicParticipationPath,readParticipationEvidence}=await import('./squads/participation');
   const response=await fetch(publicParticipationPath,{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error();
   const evidence=await readParticipationEvidence(await response.json());
   if(evidence.proof.entry.agentId!=='2933'||evidence.proof.entry.audience!==location.origin)throw Error();
   setContinuous(null);setRunning(false);setRecording(null);setLiveId('');
   setSquads({match:loadSquads(evidence.replay),id:evidence.proof.entry.matchId,recorded:true,playback:0,proof:evidence.proof,publicUrl:publicParticipationPath,identityHash:evidence.evidenceHash});
   setPage('Play');
  }catch{setStatus('The public record could not be confirmed. Try again shortly.');}
 };
 const practiceSquads=(chosen=squadMode)=>{
  request.current?.abort();setRunning(false);setBusy(false);setContinuous(null);setRecording(null);setState(initial());setLiveId('');setStatus('');
  const bot=isArenaOpponent(opponent)?arenaOpponents[opponent]:undefined;
  setSquads(previous=>({match:bot?previewChallenge(currentSquadConfig(chosen),bot.difficulty):scriptedSquads(currentSquadConfig(chosen)),playback:(previous?.playback??0)+1,
   caption:bot?`Scripted practice · Arena Bot · ${bot.name}`:undefined}));setPage('Play');
 };
 const openSquadRecording=async(record:SquadMode='relay',archive=false)=>{
  request.current?.abort();setBusy(false);setRunning(false);setRecording(null);setContinuous(null);setLiveId('');setStatus('');
  try{
   const {default:fixture}=record==='bomb'?await import('./fixtures/relay-yard-gemini-bomb.json'):
    record==='tdm'?(archive?await import('./fixtures/relay-yard-gemini-tdm.json'):await import('./fixtures/squad-tdm-retake.json')):
    await import('./fixtures/relay-yard-gemini.json');
   setSquads({match:loadSquads(fixture),recorded:true,playback:0,
    id:record==='bomb'?'94c5e9e8-b2cc-4fd1-b261-5aa814be685f':
     record==='tdm'?(archive?'1ca149fa-5c19-42d8-a58b-d3a56aea493d':'a0f9c67d-1ac6-4e7b-b009-18d3950603c2'):
     '64687a33-3e0b-491d-a05b-443052a37181'});
   setPage('Play');
  }catch{setStatus('This replay failed its integrity check.');}
 };
 const openRecording=(fixture:unknown)=>{request.current?.abort();setBusy(false);setContinuous(null);setSquads(null);setLiveId('');setReflection(null);setMatchModel('');try{playReplay(validateReplay(fixture),'historical');setStatus('')}catch{setStatus('This replay failed its integrity check.')}};
 const openObjective=async()=>{
  request.current?.abort();setRunning(false);setBusy(false);setSquads(null);setLiveId('');setStatus('');
  try{
   const {default:fixture}=await import('./fixtures/dust-yard-objective.json');
   setContinuous({replay:loadContinuous(fixture.replay),decisions:fixture.decisions as Decision[],recorded:true});
   setPage('Play');
  }catch{setStatus('This replay failed its integrity check.')}
 };
 const leavePreparation=(destination:'My Agent'|'Arena')=>{
  request.current?.abort();setBusy(false);setStatus('Reopen your match to pick up where you left off.');setPage(destination);
 };
 useEffect(()=>{
  if(!liveId||reflection)return;
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>;
  let remaining=8;
  const check=async()=>{
   try{
    const response=await fetch('/api/matches/'+encodeURIComponent(liveId),{signal:controller.signal});
    if(response.ok){
     const job=await response.json();
     if(job.reflection){setReflection(job.reflection);return;}
    }
   }catch{if(controller.signal.aborted)return;}
   if(--remaining>0&&!controller.signal.aborted)timer=setTimeout(check,2000);
  };
  timer=setTimeout(check,2000);
  return()=>{controller.abort();clearTimeout(timer)};
 },[liveId,reflection]);
 useEffect(()=>{if(!running||paused||!recording)return;const timer=setTimeout(()=>{const e=recording.events[state.step];if(!e){setRunning(false);return}setActions(e.actions);setState(e.state);if(e.step===recording.events.length)setRunning(false)},1000);return()=>clearTimeout(timer)},[running,paused,recording,state.step]);
 useEffect(()=>{if(mode!=='bot'||!running||state.result)return;const timer=setTimeout(()=>{const a:[Action,Action]=[trainingAgent(state),trainingOpponent(state,stage)];setActions(a);setState(resolve(state,a))},900);return()=>clearTimeout(timer)},[state,running,mode,stage]);
 useEffect(()=>{
  if(!state.result||!running||mode!=='bot')return;
  setRunning(false);
  const h=[{result:state.result,coaching,date:new Date().toISOString()},...history].slice(0,20);
  setHistory(h);localStorage.setItem('history',JSON.stringify(h));
  const updated=trainingProgress(cleared,stage,state.result);
  if(updated!==cleared){
   setCleared(updated);localStorage.setItem('arena-training-cleared',JSON.stringify(updated));
  }
 },[state.result,running,mode,coaching,history,cleared,stage]);
 const outcome=state.result==='draw'?'Draw':state.result==='blue'?'Victory':'Defeat';
 const resultReady=!!state.result&&state===settled;
 const skip=()=>{
  if(!recording)return;
  const last=recording.events[recording.events.length-1];
  setState(last.state);setActions(null);setRunning(false);setPaused(false);
 };
 const reviseStrategy=(previous:SquadMatch)=>{
  if(previous.recorded||!previous.id||!squadsAvailable){setPage('My Agent');return;}
  const {config}=previous.match.replay;
  setSquadMode('mode' in config?config.mode:'relay');
  if(previous.opponent)setOpponent(previous.opponent);
  setEntryAgent(previous.proof?.entry.agentId);
  setCoaching(previous.guidance?.coaching??localStorage.getItem('coaching')??'');
  setStrategy(previous.guidance?{strategy:previous.guidance.strategy,autonomy:previous.guidance.autonomy}:defaultStrategy);
  setRematchSetup(previous);setSquads(null);setStatus('');setPage('Play');window.scrollTo(0,0);
 };
 const previousConfig=rematchSetup?.match.replay.config;
 const keepSetup=!!rematchSetup?.id&&!entryAgent&&!rematchSetup.proof&&rematchSetup.opponent===opponent&&
  previousConfig?.rulesVersion===currentSquadConfig(squadMode).rulesVersion&&previousConfig&&'mode' in previousConfig&&previousConfig.mode===squadMode;
 const legacyOpponent:OfficialId=opponent==='official-sand-pace'?'official-sand-pace':'official-sand';
 const challengeProgress=(()=>{
  const wins=highestWins(challengeLog);
  const cleared=squadModes.flatMap(mode=>wins[mode]?[`${squadModeLabels[mode]} ${wins[mode]}`]:[]);
  return cleared.length?`Highest win saved on this device: ${cleared.join(', ')}.`:'No Arena bot wins saved on this device yet.';
 })();
 const matchStrategy=<MatchStrategy mode={squadMode} choices={strategy} coaching={coaching} opponent={opponent} entryAgent={entryAgent}
  teamSize={currentSquadConfig(squadMode).teamSize} live={squadsAvailable} progress={challengeProgress} model={keepSetup?rematchSetup?.model:availableModel} rematch={keepSetup}
  onMode={setSquadMode} onChoices={setStrategy} onCoaching={setCoaching} onOpponent={setOpponent} onGuest={()=>setEntryAgent(undefined)}
  onStart={()=>start('ai',false,'squads',keepSetup?rematchSetup:undefined,undefined,squadMode,entryAgent,{...strategy,coaching:coaching.trim()},keepSetup?rematchSetup?.match:undefined)}
  onPractice={()=>practiceSquads()}/>;
 return <div className="app">
  <header>
   <div className="brand"><span className="mark">A</span><span>AGENT <b>ARENA</b></span></div>
   <nav aria-label="Primary">{(['Play','My Agent','Arena'] as const).map(p=><button key={p} className={page===p?'active':''} aria-current={page===p?'page':undefined} onClick={()=>busy&&p!=='Play'?leavePreparation(p):setPage(p)}>{p}</button>)}</nav>
   <span className="guest">● GUEST</span>
  </header>
  {page==='Play'&&squads&&<main className="play playing"><WatchSquads key={squads.id??squads.playback} match={squads.match}
   live={squads.match.replay.source!=='scripted-practice'} recorded={squads.recorded} viewed={squads.viewed}
   caption={squads.caption??(squads.match.replay.source==='operator-attested-gemini'&&!squads.recorded?'AI Duel · Arena Gemini · not a human player':undefined)}
   onFinish={()=>setSquads(current=>current&&!current.viewed?{...current,viewed:true}:current)}
   onBack={()=>{setSquads(null);setLegacyTraining(false);}}
   coachLabel={!squads.recorded&&squads.id&&squadsAvailable?'Revise strategy →':undefined}
   rematchLabel={!squads.recorded&&squads.id&&squadsAvailable?(squads.proof?'Prepare signed rematch':
    [territorySquadRules,continuousSquadRules].some(rules=>rules===squads.match.replay.config.rulesVersion)?'Same-setup rematch':'Play practice'):undefined}
   onCoach={()=>reviseStrategy(squads)} onRematch={()=>{
    const config=squads.match.replay.config;
    const chosen='mode' in config?config.mode:'relay';
    if(!squads.recorded&&squads.proof&&squadsAvailable)reviseStrategy(squads);
    else if(!squads.recorded&&squads.id&&squadsAvailable&&(config.rulesVersion===continuousSquadRules||config.rulesVersion===territorySquadRules)){
     const guide=squads.guidance;
     const draft=guide?{strategy:guide.strategy,autonomy:guide.autonomy,coaching:guide.coaching}:defaultStrategy;
     start('ai',false,'squads',squads,undefined,chosen,undefined,{coaching:localStorage.getItem('coaching')??'',...draft,rulesVersion:config.rulesVersion},squads.match);
    }
    else practiceSquads(chosen);
   }}/>
   {squads.viewed&&squads.guidance&&<MatchReview match={squads.match} guidance={squads.guidance} attempts={squads.attempts} model={squads.model} previous={squads.comparison}/>}
   {squads.viewed&&squads.proof&&<Suspense fallback={null}><ParticipationSummary proof={squads.proof} publicUrl={squads.publicUrl}/></Suspense>}
   {squads.viewed&&<SquadReceipt key={`receipt-${squads.id??squads.playback}`} replay={squads.match.replay} matchId={squads.id} identityHash={squads.identityHash}/>}</main>}
  {page==='Play'&&busy&&<main className="play playing"><section className="battle relay-match" aria-label="Match preparation">
   <div className="battlefooter"><p role="status" className="preparing"><span aria-hidden="true"/>{preparation}</p>
    <button className="textbutton" onClick={()=>leavePreparation('Arena')}>Back to Arena</button></div>
  </section></main>}
  {page==='Play'&&!busy&&!squads&&!continuous&&!legacyTraining&&!running&&!recording&&!state.result&&<main className="play">
   <div className="intro strategy-intro"><div><h1>HUMANS COACH.<br/><em>AI COMPETES.</em></h1>
    <p className="relay-lede">Choose a challenge, coach your commander, and send it into the match.</p>
    <div className="play-watch">{squadsAvailable&&<button className="textbutton" onClick={()=>practiceSquads()}>Quick practice →</button>}
     <button className="textbutton" onClick={()=>setPage('Arena')}>Watch recordings →</button>
     {publicRecord&&<button className="textbutton" onClick={()=>void openCompetitiveRecord()}>Watch BSC Commander #2933 →</button>}</div>
   </div></div>
   <div className="play-strategy">{matchStrategy}
    <section className="battle relay-match" aria-label="Relay Yard"><div className="relay-caption"><strong>Relay Yard</strong><span>5v5 · {squadModeLabels[squadMode]}</span></div><RelayBoard frame={previews[squadMode]}/></section>
   </div>
   <button className="textbutton" onClick={()=>setLegacyTraining(true)}>Duel training stages</button>
   {status&&<div className="notice" role="status">{status}</div>}
  </main>}
  {page==='Play'&&continuous&&<main className="play playing"><Suspense fallback={<p role="status">Loading Dust Yard…</p>}>
   <Spectate replay={continuous.replay} decisions={continuous.decisions} recorded={continuous.recorded}
    previous={!continuous.recorded?previousContinuous?.replay:undefined} onCoach={()=>setPage('My Agent')}
    viewed={continuous.viewed===true} onFinish={()=>setContinuous(match=>match&&!match.viewed?{...match,viewed:true}:match)}
    onRematch={continuousAvailable?()=>start('ai',false,'duel'):undefined}
    onSameSetup={continuousAvailable&&continuous.id?()=>start('ai',false,'duel',continuous):undefined}/>
  </Suspense></main>}
  {page==='Play'&&!continuous&&!squads&&!busy&&(legacyTraining||running||recording||state.result)&&<main className={running||state.result?'play playing':'play'}>
   {!running&&!state.result&&!busy&&<div className="intro">
    <div><h1>HUMANS COACH.<br/><em>AI COMPETES.</em></h1><p>{stageInfo.name} · {stageInfo.brief}</p>
     <div className="stage-menu" aria-label="Training stages">
      {stages.map((entry,index)=><button key={entry.id} aria-pressed={stage===index} disabled={!unlocked(index)} onClick={()=>setStage(index)}>{entry.name}{cleared.includes(entry.id)?' ✓':!unlocked(index)?' · Locked':''}</button>)}
     </div>
    </div>
    <button className="primary" onClick={()=>start('bot')}>START PRACTICE <span>↗</span></button>
   </div>}
   <section className="battle" aria-label="Dust Yard">
    <div className="battlebar">
     <TeamStatus team="blue" hp={state.fighters[0].hp}/>
     <div className="round"><strong>Dust Yard</strong><span>{running||state.result?`Turn ${state.step} / 10`:'Training'}</span></div>
     <TeamStatus team="sand" hp={state.fighters[1].hp}/>
    </div>
    <Battlefield state={state} actions={actions} paused={paused} onSettled={setSettled}/>
    <div className="battlefooter">
     <div className="match-caption">
      {resultReady&&<TeamEmblem side={state.result==='sand'?1:0}/>}
      <div><span className="eyebrow">{mode==='bot'?'PRACTICE':mode==='historical'?'RECORDED GEMINI MATCH':recovered?'RECOVERED GEMINI MATCH':'LIVE GEMINI MATCH'}</span>
      {busy?<p role="status" className="preparing"><span aria-hidden="true"/>{preparation}</p>:resultReady?<><h2>{outcome}</h2><p>{state.result==='draw'?'Even score.':`${state.result==='blue'?'Blue':'Sand'} Team wins.`} · Unverified</p></>:null}</div>
     </div>
     {busy&&<button className="textbutton" onClick={()=>leavePreparation('Arena')}>BACK TO ARENA</button>}
     {running&&recording&&<div className="replay-controls"><button onClick={()=>setPaused(!paused)}>{paused?'RESUME':'PAUSE'}</button><button onClick={skip}>SKIP TO RESULT</button></div>}
     {resultReady&&<div className="result-actions">
      {mode==='bot'&&state.result==='blue'&&stage+1<stages.length&&<button className="primary" onClick={()=>{setStage(stage+1);start('bot')}}>NEXT STAGE ↗</button>}
      <button className={mode==='bot'&&state.result==='blue'&&stage+1<stages.length?'textbutton':'primary'} onClick={()=>mode==='historical'&&recording?openRecording(recording):start(mode==='ai'?'ai':'bot')}>{mode==='historical'?'WATCH AGAIN':'REMATCH'} ↗</button>
      {mode==='bot'&&<button className="textbutton" onClick={()=>{setState(initial());setActions(null)}}>Training stages</button>}
      <button className="textbutton" onClick={()=>setPage('My Agent')}>Coach Agent →</button>
     </div>}
    </div>
    {resultReady&&recording&&<div className="match-details">
     {mode==='ai'&&reflection?.status==='saved'&&<p><strong>Agent lesson</strong> {reflection.lessons[0]}</p>}
     {mode==='ai'&&reflection?.status==='unavailable'&&<p>No lesson was saved for this match.</p>}
     <details><summary>Match details</summary>
      {matchModel&&<p>Model · {matchModel}</p>}
      {([0,1] as const).map(side=>{
       const counts=recording.events.reduce<Record<Action,number>>((t,event)=>{t[event.actions[side]]++;return t;},{advance:0,attack:0,reload:0,wait:0});
       return <p key={side}>{side===0?'Blue':'Sand'} · {counts.advance} advance, {counts.attack} attack, {counts.reload} reload, {counts.wait} wait</p>;
      })}
     </details>
    </div>}
   </section>
   {status&&<div className="notice" role="status">{status}</div>}
  </main>}
  {page==='My Agent'&&<main className="interior">
   <h1>MY <em>AGENT.</em></h1>
   <div className="agentlayout">
    <div className="agentvisual"><div className="avatar"><TeamEmblem side={0}/></div><span>BLUE TEAM</span><h2>YOUR COMMANDER</h2><p>Duel training cleared · {cleared.length} / {stages.length}</p></div>
    <div className="coach"><h2>Coach your agent</h2><p>Leave a message for your agent’s next AI match.</p>
     <label htmlFor="coach">Coaching message</label><textarea id="coach" value={coaching} onChange={e=>setCoaching(e.target.value)} maxLength={1000} placeholder="Play carefully and make every move count."/>
     <div className="suggestions">{['Favor North','Favor South','Split across both relays'].map(s=><button key={s} onClick={()=>setCoaching(s)}>{s}</button>)}</div>
     <button className="primary" disabled={saving} onClick={save}>SAVE COACHING ↗</button>
     {!preview&&<button className="textbutton" onClick={()=>{setStatus('');setSquads(null);setContinuous(null);setRecording(null);setLegacyTraining(false);setRunning(false);setState(initial());setPage('Play')}}>Prepare match →</button>}
     {status&&<p role="status">{status}</p>}
     <details><summary>Memory</summary>{lessons.length>0?<ul>{lessons.map((lesson,i)=><li key={i}>{lesson}</li>)}</ul>:<p>Lessons appear after an AI match.</p>}</details>
     <details><summary>Recent matches</summary>{history.length?history.slice(0,5).map((h,i)=><div className="history" key={i}>
      {h.id&&liveAvailable?<button className="textbutton" onClick={()=>start('ai',true,'lane',undefined,h.id)}>Reopen {h.result} match</button>:<b>{h.result.toUpperCase()}</b>}
      <span>{h.format==='challenge'&&h.mode?`${squadModeLabels[h.mode]} · ${h.difficulty} · `:h.format==='versus'?'AI Duel · ':''}{h.agentId&&`Agent #${h.agentId} · `}{new Date(h.date).toLocaleDateString()}</span></div>):<p>No matches yet.</p>}</details>
     <AgentPassport onWatchBomb={()=>void openSquadRecording('bomb')} onEnter={squadsAvailable?id=>{setEntryAgent(id);setRematchSetup(undefined);setStatus('');setPage('Arena')}:undefined}
      onHistory={publicRecord?()=>void openCompetitiveRecord():undefined}/>
    </div>
   </div>
  </main>}
  {page==='Arena'&&<main className="interior">
   <h1>THE <em>ARENA.</em></h1>
   {!squadsAvailable&&<div className="opponent"><TeamEmblem side={1}/>
    <div><div className="eyebrow">OFFICIAL OPPONENT</div><h2>{officials[legacyOpponent].name}</h2><p>{liveAvailable?`${officials[legacyOpponent].style} · Powered by Gemini`:'Recorded Gemini matches'}</p>
     {liveAvailable&&<div className="stage-menu" aria-label="Choose opponent">
      {(Object.keys(officials) as OfficialId[]).map(id=><button key={id} aria-pressed={opponent===id} onClick={()=>setOpponent(id)}>{officials[id].style}</button>)}
     </div>}
    </div>
    {liveAvailable&&<div className="challenge-actions">
     <button className="primary" disabled={busy} onClick={()=>start('ai',false,continuousAvailable?'duel':'lane')}>{continuousAvailable?'PLAY OBJECTIVE DUEL ↗':'CHALLENGE ↗'}</button>
     <button className="textbutton" onClick={()=>{setStatus('');setPage('My Agent')}}>{localStorage.getItem('coaching')?'Review saved coaching':'Add coaching (optional)'}</button></div>}
   </div>}
   <div className="recordings arena-featured">
    {publicRecord&&<button className="replay-link" onClick={()=>void openCompetitiveRecord()}>WATCH ERC-8004 COMMANDER #2933 →</button>}
    {liveAvailable&&(localStorage.getItem('arena-match')||localStorage.getItem('arena-pending-match'))&&<button className="replay-link" disabled={busy} onClick={()=>start('ai',true)}>REOPEN YOUR MATCH</button>}
   </div>
   {squadsAvailable&&matchStrategy}
   <div className="recordings"><h2>Recorded matches</h2>
    <button className="replay-link" onClick={()=>openSquadRecording('bomb')}>WATCH GEMINI BOMB MODE →</button>
    <button className="replay-link" onClick={()=>openSquadRecording('tdm')}>WATCH GEMINI TEAM DEATHMATCH →</button>
    <button className="replay-link" onClick={()=>openSquadRecording()}>WATCH GEMINI RELAY · ORIGINAL RULES →</button>
    <button className="replay-link" onClick={()=>openSquadRecording('tdm',true)}>EARLIER TEAM DEATHMATCH · 0–0 →</button>
    <button className="replay-link" onClick={openObjective}>WATCH OBJECTIVE DUEL →</button>
    <button className="replay-link" onClick={()=>openRecording(recentReplay)}>TWO-TURN GEMINI MATCH →</button>
    <button className="replay-link" onClick={()=>openRecording(historical)}>HISTORICAL GEMINI MATCH →</button>
   </div>
   {status&&<div className="notice" role="status">{status}</div>}
   <p className="hint">{passportConfigured?'Check the public BSC Testnet record in My Agent.':'No BSC Testnet settlement published.'}</p>
  </main>}
 </div>;

}
const root=createRoot(document.getElementById('root')!);
const devQuery=import.meta.env.DEV?new URLSearchParams(location.search):null;
if(devQuery?.has('arena-v26')){
 void import('./v26/sandbox').then(({Sandbox26})=>root.render(<Sandbox26/>));
}else if(devQuery&&(devQuery.has('arena-continuous')||devQuery.has('gameplay-v23')||devQuery.has('arena-objective')||devQuery.has('gameplay-v24')||
 devQuery.has('arena-modes')||devQuery.has('gameplay-v25'))){
 void import('./v23/sandbox').then(({ContinuousSandbox})=>root.render(<ContinuousSandbox
  unified={devQuery.has('arena-modes')||devQuery.has('gameplay-v25')}
  replayMode={devQuery.has('gameplay-v23')||devQuery.has('gameplay-v24')||devQuery.has('gameplay-v25')}
  objective={devQuery.has('arena-objective')||devQuery.has('gameplay-v24')}/>));
}else if(devQuery&&(devQuery.has('gameplay-v2')||devQuery.has('gameplay-v22')||devQuery.has('arena-sandbox'))){
 void import('./v2/graybox').then(({Graybox,Sandbox})=>root.render(devQuery.has('arena-sandbox')?<Sandbox/>:<Graybox latest={devQuery.has('gameplay-v22')}/>));
}else root.render(<App/>);

