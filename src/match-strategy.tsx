import {TeamEmblem} from './arena-board';
import {officials,type OfficialId} from './competition';
import {windowTicks,type loadSquads,type SquadMode} from './squads/game';
import {arenaOpponents,isArenaOpponent,type ArenaOpponentId} from './squads/arena-bots';
import {authorizedOrders,executionSummary} from './squads/replay-summary';
import {squadModeLabels} from './squads/watch';

const strategies={proactive:'Proactive',balanced:'Balanced',patient:'Patient',custom:'Custom'};
const autonomyOptions={
 'coach-led':{label:'Coach-led',description:'Follow your guidance closely when it fits the match.'},
 adaptive:{label:'Adaptive',description:'Use your guidance and adjust as the match changes.'},
 independent:{label:'Independent',description:'Treat your guidance as context and use your own judgment.'},
};
export const modeDescriptions={
 relay:'Capture relays and earn points from territory you own, even after moving away.',
 bomb:'Blue links either Core site. Sand defends or disables the active Core.',
 tdm:'Units respawn. The first team to eight eliminations wins.',
};
const examples={
 relay:'Favor securing one relay before expanding. Reconsider if we lose control.',
 bomb:'Keep the team coordinated. Switch sites if the first approach stalls.',
 tdm:'Play for a steady lead. Avoid spreading the team too thin.',
};
export type StrategyChoices={strategy:keyof typeof strategies;autonomy:keyof typeof autonomyOptions};
export type PrivateGuidance=StrategyChoices&{coaching:string;revision:string;requests:number;received?:{strategy:string;autonomy:string;coaching:string}};
export type ReviewAttempt={side:number;step:number;attempt:number;status:string;failure?:string};
export const defaultStrategy:StrategyChoices={strategy:'balanced',autonomy:'adaptive'};
export type MatchOpponentId=OfficialId|ArenaOpponentId;
const arenaIds=Object.keys(arenaOpponents) as ArenaOpponentId[];

type SetupProps={
 mode:SquadMode;choices:StrategyChoices;coaching:string;opponent:MatchOpponentId;entryAgent?:string;teamSize:number;live:boolean;
 progress:string;rematch?:boolean;model?:string;onMode:(mode:SquadMode)=>void;onChoices:(choices:StrategyChoices)=>void;onCoaching:(text:string)=>void;
 onOpponent:(id:MatchOpponentId)=>void;onGuest:()=>void;onStart:()=>void;onPractice:()=>void;
};

export function MatchStrategy({mode,choices,coaching,opponent,entryAgent,teamSize,live,progress,rematch,model,onMode,onChoices,onCoaching,onOpponent,onGuest,onStart,onPractice}:SetupProps){
 const challenge=isArenaOpponent(opponent);
 const bot=challenge?arenaOpponents[opponent]:undefined;
 const submitLabel=live?(entryAgent?'SIGN & PLAY 5V5':rematch?'PLAY REMATCH':challenge?'START CHALLENGE':'PLAY AI DUEL'):challenge?'PREVIEW OPPONENT':'START PRACTICE';
 return <form className="strategy-panel" onSubmit={event=>{event.preventDefault();live?onStart():onPractice();}}>
  <div className="strategy-commander"><TeamEmblem side={0}/><div><h2>Prepare your commander</h2>
   <p>{entryAgent?`ERC-8004 Commander #${entryAgent}`:'Blue Team · Guest Commander'} · {teamSize}v{teamSize}{live?` · ${model||'Gemini'}`:''}</p></div></div>
  {live&&entryAgent&&<p className="strategy-scope">Your BSC Testnet owner wallet signs the match entry. Your coaching stays private and is outside the signature. <button type="button" className="textbutton" onClick={onGuest}>Play as guest</button></p>}
  <fieldset><legend>Competition</legend><div className="stage-menu" role="group" aria-label="Competition format">
   <button type="button" aria-pressed={challenge} onClick={()=>onOpponent(challenge?opponent:'arena-easy')}>Challenge</button>
   <button type="button" aria-pressed={!challenge} onClick={()=>onOpponent(challenge?'official-sand':opponent)}>AI Duel</button>
  </div><p>{challenge?'Test and improve your commander against an Arena opponent.':live?'Your commander plays an Arena Gemini commander. This is not another human player.':'AI Duel needs the live service. This is not another human player.'}</p></fieldset>
  <fieldset><legend>Game mode</legend><div className="stage-menu" role="group" aria-label="Game mode">
   {(Object.keys(squadModeLabels) as SquadMode[]).map(id=><button key={id} type="button" aria-pressed={mode===id} onClick={()=>onMode(id)}>{squadModeLabels[id]}</button>)}
  </div><p>{modeDescriptions[mode]}</p></fieldset>
  {challenge?<fieldset><legend>Arena opponent</legend><div className="stage-menu" role="group" aria-label="Opponent difficulty">
   {arenaIds.map(id=><button key={id} type="button" aria-pressed={opponent===id} onClick={()=>onOpponent(id)}>{arenaOpponents[id].name}</button>)}
  </div><p>{bot?.behavior} Same health, speed, and rules as your team. The bot does not use a model.</p>
   <p>{progress}</p></fieldset>:
   live?<fieldset><legend>Arena commander</legend><div className="stage-menu" role="group" aria-label="Choose opponent">
    {(Object.keys(officials) as OfficialId[]).map(id=><button key={id} type="button" aria-pressed={opponent===id} onClick={()=>onOpponent(id)}>{officials[id].name} · {officials[id].style}</button>)}
   </div><p>Both commanders use Gemini. Private two-player rooms are not available in this release.</p></fieldset>:
   <p>AI Duel needs the live service. This preview uses scripted commanders and is not another player.</p>}
  {live&&<><fieldset><legend>Strategic preference</legend><div className="stage-menu">
   {(Object.keys(strategies) as StrategyChoices['strategy'][]).map(id=><button key={id} type="button" aria-pressed={choices.strategy===id} onClick={()=>onChoices({...choices,strategy:id})}>{strategies[id]}</button>)}
  </div></fieldset>
  <label className="strategy-label" htmlFor="strategy-autonomy">Commander autonomy</label>
  <select id="strategy-autonomy" value={choices.autonomy} aria-describedby="autonomy-description" onChange={e=>onChoices({...choices,autonomy:e.target.value as StrategyChoices['autonomy']})}>
   {(Object.keys(autonomyOptions) as StrategyChoices['autonomy'][]).map(id=><option value={id} key={id}>{autonomyOptions[id].label}</option>)}
  </select>
  <p id="autonomy-description">{autonomyOptions[choices.autonomy].description}</p>
  <label className="strategy-label" htmlFor="strategy-coaching">Coaching message <small>Optional</small></label>
  <textarea id="strategy-coaching" value={coaching} onChange={e=>onCoaching(e.target.value)} maxLength={1000} placeholder={examples[mode]}/></>}
  <div className="strategy-summary" aria-label="Match setup summary"><b>{challenge?`Challenge · ${bot?.name}`:`AI Duel · ${challenge?'':officials[opponent as OfficialId].style}`} · {squadModeLabels[mode]} · {teamSize}v{teamSize}{live?` · ${strategies[choices.strategy]} · ${autonomyOptions[choices.autonomy].label}`:''}</b>
   <p>{rematch?'Keeps the previous match setup. ':''}{!live?'Scripted preview. It is not a challenge result and does not use your coaching. ':challenge?'Your commander plans with the model. The Arena bot is local. ':'Both Gemini commanders plan from the same board. Coaching stays with your commander. '}Coaching changes apply to your next match.</p></div>
  <div className="strategy-actions"><button className="primary" type="submit">{submitLabel} ↗</button>
   {live&&<button type="button" className="textbutton" onClick={onPractice}>Try scripted practice</button>}</div>
 </form>;
}

type Playback=ReturnType<typeof loadSquads>;
export function MatchReview({match,guidance,attempts=[],model,previous}:{match:Playback;guidance:PrivateGuidance;attempts?:ReviewAttempt[];model?:string;previous?:Playback}){
 const blueAttempts=attempts.filter(attempt=>attempt.side===0);
 const rejected=blueAttempts.filter(attempt=>attempt.status==='invalid-orders');
 const accepted=blueAttempts.filter(attempt=>attempt.status==='accepted').length;
 const processed=()=>match.replay.windows.map(([plan],index)=>{
  const start=match.frames[index*windowTicks];
  const frames=match.frames.slice(start.tick+1,start.tick+1+windowTicks);
  return {plan,orders:authorizedOrders(plan),observed:executionSummary(start,frames,0),tick:start.tick};
 });
 const challenge=match.replay.challenge;
 return <section className="strategy-review" aria-labelledby="strategy-review-title">
  <h2 id="strategy-review-title">Your match review</h2>
  {challenge&&<p>Challenge · {arenaOpponents[challenge.opponent].name} · policy {challenge.policy}. One result does not prove a stronger commander.</p>}
  <p><b>{strategies[guidance.strategy]} · {autonomyOptions[guidance.autonomy].label}</b>{model&&` · ${model}`}</p>
  <p className="strategy-quote">{guidance.coaching||'You left the message blank.'}</p>
  <p>{accepted} accepted {accepted===1?'plan':'plans'} · {rejected.length} rejected {rejected.length===1?'plan':'plans'}</p>
  {previous&&<p>Previous {previous.replay.final??'unfinished'} · {previous.frames.at(-1)?.score.join('–')} → This match {match.replay.final??'unfinished'} · {match.frames.at(-1)?.score.join('–')}</p>}
  <details><summary>What your commander received</summary>
   {guidance.received?<><p>{guidance.requests} Blue model {guidance.requests===1?'request included':'requests included'} these instructions and received a response.</p>
    <dl className="guidance-received"><div><dt>Strategy</dt><dd>{guidance.received.strategy}</dd></div><div><dt>Autonomy</dt><dd>{guidance.received.autonomy}</dd></div>
     {guidance.received.coaching&&<div><dt>Message</dt><dd className="strategy-quote">{guidance.received.coaching}</dd></div>}</dl></>:<p>No provider response with these instructions was recorded.</p>}
  </details>
  <details><summary>Compare intent, orders and execution</summary>
   <ol className="strategy-plans">{processed().map(({plan,orders,observed,tick})=><li key={tick}>
    <dl className="guidance-received"><div><dt>Stated intent</dt><dd>{plan.intent}</dd></div>
     <div><dt>Accepted orders</dt><dd>{orders.movement.length||orders.pulse.length||orders.link.length?[
      ...orders.movement.map(slot=>`Unit ${slot} → ${plan.orders[slot-1].split('/')[0].split('>').join(' → ')}`),
      orders.pulse.length?`Pulse · ${orders.pulse.join(', ')}`:'',orders.link.length?`Link Core · ${orders.link.join(', ')}`:'',
     ].filter(Boolean).join(' · '):'Hold'}</dd></div>
     <div><dt>Observed</dt><dd>{observed.moved.length} moved · {observed.pulses} pulses · {observed.points} points{observed.blocked.length>0&&` · ${observed.blocked.length} blocked`}</dd></div></dl>
    {rejected.filter(attempt=>attempt.step===tick).map((attempt,index)=><p key={index}>Rejected before play · {attempt.failure??'Invalid orders'}</p>)}
   </li>)}</ol>
  </details>
 </section>;
}
