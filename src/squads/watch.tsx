import {useEffect,useMemo,useState} from 'react';
import {ArenaGrid,UnitMark,TeamEmblem} from '../arena-board';
import {objectiveRules,tdmTarget} from './continuous';
import {continuousSquadRules,height,map,maxTicks,point,sites,territoryRules,territorySquadRules,tickMs,width,winScore,windowTicks,type Frame,type Territory,type loadSquads} from './game';
import {authorizedOrders,coreTransitions,executionSummary,territoryTransitions} from './replay-summary';
import './watch.css';

const tile=24;
const center=(n:number)=>(n+.5)*tile;
const coords=(at:number)=>point(at).map(center) as [number,number];
const position=(at:number,x?:number,y?:number)=>x===undefined||y===undefined?coords(at):[center(x),center(y)] as const;
const unitPosition=({at,x,y}:Frame['units'][number])=>position(at,x,y);

export const squadModeLabels={relay:'Relay',bomb:'Bomb Mode',tdm:'Team Deathmatch'} as const;
const siteName=(i:number)=>i?'South':'North';
const bombPhaseText=(phase:NonNullable<Frame['objective']>['phase'])=>phase==='activate'?'Activating':phase==='disable'?'Disabling':'Active';
const seconds=(ticks:number)=>`${(ticks*tickMs/1000).toFixed(1)}s`;

function bombEnding(frame:Frame){
 const {objective}=frame;
 if(objective?.phase==='disable'&&objective.progress>=objectiveRules.disable)return `${siteName(objective.site)} Core disabled`;
 if(objective&&objective.phase!=='activate'&&objective.remaining<=0)return `${siteName(objective.site)} countdown completed`;
 if(!frame.units.some(u=>u.side===0&&u.hp))return 'Blue Team eliminated';
 if(!frame.units.some(u=>u.side===1&&u.hp))return 'Sand Team eliminated';
 return 'Time expired before activation';
}

function matchEnding(frame:Frame){
 if(frame.mode==='bomb')return bombEnding(frame);
 if(frame.mode!=='tdm'){
  const blue=frame.units.some(u=>u.side===0&&u.hp),sand=frame.units.some(u=>u.side===1&&u.hp);
  if(!blue&&!sand)return 'Both teams eliminated';
  if(!blue||!sand)return `${blue?'Sand':'Blue'} Team eliminated`;
 }
 const target=frame.territory?territoryRules.winScore:frame.mode==='tdm'?tdmTarget:winScore;
 const score=frame.score.join('–');
 return Math.max(...frame.score)>=target?`Score target reached · ${score}`:`Time expired · ${score}`;
}

export function RelayBoard({frame,prior=[],animate=false}:{frame:Frame;prior?:Frame[];animate?:boolean}){
 const mode=frame.mode??'relay';
 const {objective}=frame;
 const labels=mode==='tdm'?'Team Deathmatch has no objective sites.':`North and South ${mode==='bomb'?'bomb sites':'relays'} are marked N and S.`;
 return <ArenaGrid width={width*tile} height={height*tile} step={tile} label={`Relay Yard. ${labels} Blue hexagons and Sand diamonds.`}>
  <rect x={tile} y={tile*4.5} width={tile*3} height={tile*5} rx={8} fill="#193451"/>
  <rect x={tile*23} y={tile*5.5} width={tile*3} height={tile*5} rx={8} fill="#483a26"/>
  {map.flatMap((row,y)=>[...row].map((cell,x)=>cell==='.'?null:
   <g key={x+y*width}>
    <rect x={x*tile+1} y={y*tile+1} width={tile-2} height={tile-2} rx={3} className={cell==='#'?'relay-wall':'relay-cover'}/>
    {cell==='+'&&<path d={`M${x*tile+7} ${y*tile+16} l9 -9 m-5 9 l5 -5`} stroke="#a7bbc9" strokeWidth="1.5"/>}
   </g>))}
  {mode!=='tdm'&&sites.map(([x,y],i)=>{
   const phase=mode==='bomb'&&objective?.site===i?objective.phase:null;
   const territory=frame.territory?.[i];
   const owner=territory?territory.owner:frame.control[i];
   const contested=territory?territory.occupancy==='contested':frame.control[i]==='contested';
   const claimed=territory?.changedAt===frame.tick;
   const color=phase==='activate'?'blue-unit':phase==='disable'?'sand-unit':phase==='countdown'?'relay-alert':
    mode==='relay'&&owner===0?'blue-unit':mode==='relay'&&owner===1?'sand-unit':'relay-neutral';
   return <g key={i} className={color}>
    {territory&&<title>{siteName(i)} · {territoryText(territory)}</title>}
    <rect x={(x-1)*tile+2} y={(y-1)*tile+2} width={tile*3-4} height={tile*3-4} rx="10" fill="currentColor" fillOpacity={phase||claimed?'.3':'.15'}
     stroke={contested?'#ffd078':'currentColor'} strokeWidth={phase||claimed?3:2} strokeDasharray={mode==='bomb'&&!phase||contested?'4 4':undefined}/>
    {!!territory?.progress&&<rect x={(x-1)*tile+6} y={(y+2)*tile-8} height="4" rx="2"
     width={(tile*3-12)*territory.progress/territoryRules.captureTicks} fill={territory.claimant===0?'#80baff':'#ffd078'}/>}
    <circle cx={center(x)} cy={center(y)} r={12} stroke="currentColor" fill="#142333"/>
    <text x={center(x)} y={center(y)+5} textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="800">{i?'S':'N'}</text>
   </g>;
  })}
  {frame.units.map((unit,i)=>{
   if(!unit.hp)return null;
   const goal=frame.goals[i];
   const history=prior.map(old=>old.units[i]);
   const lastDefeat=history.map(old=>old.hp).lastIndexOf(0);
   const route=[...history.slice(lastDefeat+1),unit].map(unitPosition).map(pos=>pos.join(',')).join(' ');
   return <g key={i} className={unit.side?'sand-unit':'blue-unit'}>
    <polyline points={route} stroke="currentColor" fill="none" opacity=".56" strokeWidth="2.5" strokeLinecap="round"/>
    {goal!=null&&<circle cx={coords(goal)[0]} cy={coords(goal)[1]} r="5" stroke="currentColor" fill="none" opacity=".65"/>}
   </g>;
  })}
  {frame.shots.map((shot,i)=>{
   const [x1,y1]=position(shot.from,shot.fromX,shot.fromY),[x2,y2]=position(shot.to,shot.toX,shot.toY);
   return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e9f6ff" strokeWidth={2.5} opacity=".82"/>;
  })}
  {frame.units.map((unit,i)=>{
   const {hp,side,slot}=unit;
   if(!hp)return null;
   const [x,y]=unitPosition(unit);
   const interacting=mode==='bomb'&&objective?.actor===i&&objective.phase!=='countdown';
   return <g key={i} className={side?'relay-unit sand-unit':'relay-unit blue-unit'} data-unit={`${side}-${slot}`} style={{transform:`translate(${x}px,${y}px)`,transition:animate?undefined:'none'}}>
    {interacting&&<circle r="15" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3"/>}
    <circle r="11" fill="#0e1724" stroke="currentColor" strokeOpacity=".65"/>
    <g transform="scale(.7)"><UnitMark side={side}/></g>
    <text textAnchor="middle" y="3.7" fill="#101725" fontSize="10" fontWeight="900">{slot+1}</text>
    <rect x="-8" y="-13" width="16" height="2" rx="1" fill="#526176"/>
    <rect x="-8" y="-13" width={16*hp/100} height="2" rx="1" fill="currentColor"/>
   </g>;
  })}
 </ArenaGrid>;
}

type Playback=ReturnType<typeof loadSquads>;
function CommanderOrders({match,planIndex,index}:{match:Playback;planIndex:number;index:number}){
 const plan=match.replay.windows[planIndex],previous=match.replay.windows[planIndex-1];
 const start=match.frames[planIndex*windowTicks];
 const played=match.frames.slice(start.tick+1,index+1);
 const core=coreTransitions(start,played);
 const captures=territoryTransitions(played);
 const list=(slots:number[])=>slots.join(', ');
 const label=(name:string,slots:number[])=>slots.length?`${name} ${list(slots)}`:null;
 const count=(n:number,singular:string,plural:string)=>n?`${n} ${n===1?singular:plural}`:null;
 return <section className="relay-orders" aria-label="Commander intentions">
  {plan.map((p,side)=>{
   const order=authorizedOrders(p,previous?.[side]);
   const observed=executionSummary(start,played,side===0?0:1);
   const authorizations=[
    label('Move',order.movement),
    (start.mode==='relay'&&!start.territory)||!start.mode?'Automatic pulses':label('Pulse',order.pulse)??'No pulse permission',
    label('Core',order.link),
   ].filter(Boolean);
   const events=[
    label('Moved',observed.moved),played.length?`${observed.pulses} ${observed.pulses===1?'pulse':'pulses'} fired`:null,label('Blocked',observed.blocked),
    count(observed.defeats,'unit down','units down'),count(observed.returns,'unit returned','units returned'),
    count(observed.points,'point scored','points scored'),
   ].filter(Boolean);
   return <div className="relay-order" key={side}>
    <b className={side?'sand-unit':'blue-unit'}>{side?'Sand':'Blue'}</b> {p.intent}
    <dl>
     <div><dt>Orders</dt><dd>{order.movement.length||order.link.length||order.pulse.length?null:'Hold · '}{authorizations.join(' · ')}</dd></div>
     <div><dt>Observed</dt><dd>{events.join(' · ')||(played.length?'No activity this window yet':'Waiting for first frame')}</dd></div>
     {order.changed!==undefined&&<div><dt>Replan</dt><dd>{order.changed?`${order.changed} of ${p.orders.length} unit orders changed`:'Same unit orders'}</dd></div>}
    </dl>
   </div>;
  })}
  {core.length>0&&<p className="relay-core-events"><b>Core</b> {core.join(' · ')}</p>}
  {captures.length>0&&<p className="relay-core-events"><b>Relay</b> {captures.map(event=>`${event.owner===0?'Blue':'Sand'} took ${event.site} at ${seconds(event.tick)}`).join(' · ')}</p>}
 </section>;
}

export function WatchSquads({match,live,recorded,viewed,onFinish,onRematch,onCoach,onBack,rematchLabel,coachLabel,caption}:{match:Playback;live:boolean;recorded?:boolean;
 viewed?:boolean;onFinish:()=>void;onRematch:()=>void;onCoach:()=>void;onBack:()=>void;rematchLabel?:string;coachLabel?:string;caption?:string}){
 const last=match.frames.length-1;
 const [index,setIndex]=useState(viewed?last:0),[paused,setPaused]=useState(false);
 const frame=match.frames[index],complete=index===last;
 const mode=frame.mode??'relay';
 const {objective}=frame;
 const clock=mode==='relay'?`${seconds((frame.territory?territoryRules.maxTicks:maxTicks)-frame.tick)} left · First to ${frame.territory?territoryRules.winScore:winScore}`:
  mode==='tdm'?`${seconds(maxTicks-frame.tick)} left`:`${seconds(frame.tick)} elapsed`;
 const prior=useMemo(()=>match.frames.slice(Math.max(0,index-5),index),[match,index]);
 const planIndex=Math.min(match.replay.windows.length-1,Math.max(0,Math.floor((frame.tick-1)/windowTicks)));
 const plan=match.replay.windows[planIndex];
 useEffect(()=>{
  if(paused||complete)return;
  const timer=setTimeout(()=>setIndex(i=>i+1),tickMs);
  return()=>clearTimeout(timer);
 },[paused,complete,index]);
 useEffect(()=>{if(complete&&!viewed)onFinish();},[complete,viewed,onFinish]);
 const title=match.replay.final==='draw'?'Draw':match.replay.final==='blue'?'Blue Team wins':'Sand Team wins';
 const sameSetup=match.replay.config.rulesVersion===continuousSquadRules||match.replay.config.rulesVersion===territorySquadRules;
 return <section className="battle relay-match" aria-label={`${squadModeLabels[mode]} match`}>
  <div className="relay-scoreboard">
   {([0,1] as const).map(side=><div className={side?'sand-unit':'blue-unit'} key={side}><TeamEmblem side={side}/>
    <span>{side?'Sand':'Blue'} <small>{mode==='bomb'?(side?'Defend':'Activate')+' · ':''}{frame.units.filter(u=>u.side===side&&u.hp).length} active</small></span>
    {mode!=='bomb'&&<strong>{frame.score[side]}</strong>}
   </div>)}
  </div>
  <div className="relay-caption"><strong>{mode==='relay'?(frame.territory?'Relay · Territory Control':'Relay · Original Rules'):`${squadModeLabels[mode]} · Relay Yard`}</strong><span>{caption??(match.replay.challenge?`Challenge · ${match.replay.challenge.difficulty} · your Gemini commander`:live?(recorded?'Recorded Gemini':'Gemini commanders'):'Scripted practice')} · {match.replay.config.teamSize}v{match.replay.config.teamSize}</span></div>
  <RelayBoard frame={frame} prior={prior} animate={!paused&&!complete}/>
  <div className="relay-caption relay-sites">
   {mode==='relay'&&sites.map((_,i)=><span key={i}><b>{siteName(i)}</b> · {frame.territory?territoryText(frame.territory[i],frame.tick):controlText(frame.control[i])}</span>)}
   {mode==='bomb'&&(objective?<span className="bomb-status"><b>{siteName(objective.site)} · {bombPhaseText(objective.phase)}</b>
    {objective.phase!=='countdown'&&<progress aria-label={bombPhaseText(objective.phase)} value={objective.progress} max={objectiveRules[objective.phase]}/>}
    <span>{seconds(objective.remaining)} left</span></span>:<span>North and South sites open · {seconds(Math.max(0,maxTicks-frame.tick))} left</span>)}
   {mode==='tdm'&&<span>First to {tdmTarget} eliminations · Units respawn</span>}
   <span>{plan&&<>Plan {planIndex+1} · </>}{clock}</span>
  </div>
  <div className="relay-controls">
   <label>Replay position<input aria-label="Replay position" type="range" min={0} max={last} value={index} onChange={e=>{setPaused(true);setIndex(Number(e.target.value));}}/></label>
   <button className="textbutton" onClick={()=>{if(complete){setIndex(0);setPaused(false);}else setPaused(!paused);}}>{complete?'Watch again':paused?'Resume':'Pause'}</button>
   {!complete&&<button className="textbutton" onClick={()=>setIndex(last)}>Skip to result</button>}
  </div>
  {complete&&<div className="battlefooter"><div role="status"><h2>{match.replay.interruption?'Match interrupted':title}</h2>
   <p>{match.replay.interruption?'No competitive result.':`${matchEnding(frame)} · Off-chain replay validation`}</p></div>
   <div className="result-actions"><button className="primary" onClick={onRematch}>{rematchLabel??(recorded?'Play practice':live?(sameSetup?'Same-setup rematch':'Play current rules'):'Rematch')}</button>
    <button className="textbutton" onClick={onCoach}>{coachLabel??'Coach Agent →'}</button><button className="textbutton" onClick={onBack}>Back to Play</button></div>
  </div>}
  {plan&&<CommanderOrders match={match} planIndex={planIndex} index={index}/>}
 </section>;
}
function controlText(value:Frame['control'][number]){
 return value===null?'Open':value===0?'Blue scores':value===1?'Sand scores':'Contested';
}
function territoryText(site:Territory,tick?:number){
 const side=(value:0|1)=>value===0?'Blue':'Sand';
 const occupied=site.owner===null?'Neutral':`${side(site.owner)} ${tick===site.changedAt?'captured':'controls'}`;
 const progress=site.claimant===null?'':` · ${side(site.claimant)} capture ${site.progress}/${territoryRules.captureTicks}`;
 if(site.occupancy==='contested')return occupied+' · Contested, scoring paused'+progress;
 return occupied+(site.owner===null?'':` · +${territoryRules.pointsPerTick}/tick`)+progress;
}
