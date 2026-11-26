import {useEffect,useMemo,useRef,useState} from 'react';
import {ArenaGrid,ArenaUnit,TeamEmblem} from '../arena-board';
import {HEIGHT,WIDTH,crates,walls} from '../v2/yard.js';
import {unit} from '../v23/space.js';
import {second} from './config.js';
import type {Execution} from './controller.js';
import type {Frame,Packet,State} from './game.js';
import {load} from './replay.js';

export type Decision={side:number;step:number;status:string;plan?:Execution['plan']};
const tile=48;
const point=({x,y}:{x:number;y:number})=>({x:x/unit*tile,y:y/unit*tile});
const timeLabel=(time:number)=>(time/second).toFixed(1)+'s';
const teamName=['Blue','Sand'];
const gridCells=Array.from({length:WIDTH*HEIGHT},(_,cell)=>cell);

function Board({state,frame,config}:{state:State;frame?:Frame;config:ReturnType<typeof load>['recording']['config']}) {
 const origin=point(config.core.position);
 const radius=config.core.radius/unit*tile;
 const channel=state.core?.channel;
 const progress=channel?Math.min(1,(state.time-channel.started)/config.core.channel):0;
 const [blue,sand]=state.fighters.map(f=>point(f.position));
 const unitScale=Math.min(1,Math.max(.5,Math.hypot(blue.x-sand.x,blue.y-sand.y)/34));
 return <ArenaGrid width={WIDTH*tile} height={HEIGHT*tile} label="Top-down Dust Yard battlefield">
  {gridCells.map(cell=>{
   const wall=walls.includes(cell),crate=crates.includes(cell);
   if(!wall&&!crate)return null;
   const x=cell%WIDTH*tile,y=Math.floor(cell/WIDTH)*tile;
   return <g key={cell}><rect x={x+3} y={y+3} width={42} height={42} rx={5}
    fill={wall?'#29384b':'#384749'} stroke={wall?'#465870':'#6b765e'}/>
    <path d={`M${x+11} ${y+14}h26m-26 9h26m-26 9h26`} stroke={wall?'#3d4e64':'#7a826a'} opacity=".7"/></g>;
  })}
  {state.core&&<g className={`arena-core ${state.core.phase}`}>
   <circle cx={origin.x} cy={origin.y} r={radius} fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeDasharray="4 4"/>
   <rect x={origin.x-8} y={origin.y-8} width="16" height="16" rx="3" transform={`rotate(45 ${origin.x} ${origin.y})`} fill="currentColor"/>
   <circle cx={origin.x} cy={origin.y} r="4" fill="#13202c"/>
   {channel&&<circle className={channel.side===0?'blue-unit':'sand-unit'} cx={origin.x} cy={origin.y} r={radius-3}
    fill="none" stroke="currentColor" strokeWidth="4" pathLength="100" strokeDasharray={`${progress*100} 100`}
    transform={`rotate(-90 ${origin.x} ${origin.y})`}/>}
  </g>}
  {state.fighters.map((fighter,side)=>{
   if(!fighter.motion||!('path' in fighter.motion)||!fighter.motion.path.length)return null;
   const route=[fighter.position,...fighter.motion.path].map(point);
   const goal=route.at(-1)!;
   return <g key={side} className={side===0?'blue-unit':'sand-unit'} data-route={teamName[side]}>
    <polyline points={route.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor"
     strokeWidth="2.5" strokeDasharray={side===0?'5 4':'2 4'} strokeLinecap="round" opacity=".85"/>
    {route.slice(1,-1).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2.8" fill="currentColor"/>)}
    {side===0?<circle cx={goal.x} cy={goal.y} r="9" fill="none" stroke="currentColor" strokeWidth="2"/>:
     <rect x={goal.x-4} y={goal.y-4} width="8" height="8" transform={`rotate(45 ${goal.x} ${goal.y})`}
      fill="#152132" stroke="currentColor" strokeWidth="2"/>}
   </g>;
  })}
  {frame?.events.map((event,i)=>{
   if(event.kind!=='attack')return null;
   const from=point(event.from),to=point(event.to);
   return <path key={i} className={event.side===0?'blue-unit':'sand-unit'}
    d={`M${from.x} ${from.y}L${to.x} ${to.y}`} stroke="currentColor" strokeWidth={event.damage?4:2}/>;
  })}
  {state.fighters.map((fighter,side)=><ArenaUnit key={side} {...point(fighter.position)} side={side}
   hp={fighter.hp} ammo={fighter.ammo} capacity={config.equipment.capacity} scale={unitScale}
   active={channel?.side===side?'core':fighter.reloadDue?'reload':fighter.firing?'tag':''}/>)}
 </ArenaGrid>;
}
function action(packet:Packet){
 const descriptions=[];
 if(packet.movement) descriptions.push(packet.movement.kind==='stop'?'Stop moving':'Move');
 if(packet.attack) descriptions.push('Tag');
 if(packet.reload) descriptions.push('Reload');
 if(packet.core) descriptions.push(packet.core==='start'?'Commit to Core':'Cancel Core');
 if(packet.jump) descriptions.push('Jump');
 if(packet.posture) descriptions.push(packet.posture==='crouch'?'Crouch':'Stand');
 if(packet.facing) descriptions.push('Turn');
 return descriptions.join(' + ')||'Wait';
}
const conditions:Record<string,string>={
 'core-available':'Core is available','at-goal':'the destination is reached','action-finished':'tag or reload finishes',
 'has-contact':'a rival is visible','no-contact':'the rival is out of sight',
 'movement-blocked':'movement is blocked','core-idle':'your Core action is over',
};
const showCondition=(value:string)=>conditions[value]??value.replaceAll('-',' ');
const endReasons:Record<string,string>={
 'core-completed':'Core stayed active until the timer ended.',
 'core-disabled':'The defending agent disabled Core.',
 'activation-prevented':'Core never activated before the round timer ended.',
 'elimination':'One agent was eliminated.',
 'mutual-elimination':'Both agents were eliminated.',
};

function opening(replay:ReturnType<typeof load>) {
 const first=replay.frames.find(frame=>frame.receipts[0].some(r=>r.accepted&&(r.channel==='core'||r.channel==='attack')));
 if(!first)return 'No accepted tag or Core action';
 const receipt=first.receipts[0].find(r=>r.accepted&&(r.channel==='core'||r.channel==='attack'));
 return (receipt?.channel==='core'?'Core action':'Tag')+' at '+timeLabel(first.state.time);
}

export default function Spectate({replay,decisions,onCoach,onRematch,onSameSetup,recorded,previous,viewed,onFinish}:{replay:ReturnType<typeof load>;
 decisions:Decision[];onCoach:()=>void;onRematch?:()=>void;onSameSetup?:()=>void;recorded:boolean;previous?:ReturnType<typeof load>;viewed:boolean;onFinish:()=>void}) {
 const {recording,frames}=replay;
 const [index,setIndex]=useState(viewed?frames.length:0),[paused,setPaused]=useState(false);
 const frame=frames[index-1], state=frame?.state??recording.initialState;
 const finished=index===frames.length;
 const own=useMemo(()=>decisions.filter(d=>d.side===0&&d.status==='accepted'&&d.plan).sort((a,b)=>a.step-b.step),[decisions]);
 const latest=own.filter(d=>d.step<=state.tick).at(-1);
 const log=useMemo(()=>frames.flatMap(f=>{
  const entries=f.events.flatMap(event=>{
   if(event.kind==='collision')return [teamName[event.side]+' movement blocked'];
   if(event.kind==='core')return [`${event.side===0?'Blue':'Sand'} · Core ${event.action}`];
   if(event.kind==='attack')return [`${event.side===0?'Blue':'Sand'} ${event.damage?'landed a tag':'missed a tag'}`];
   return [];
  });
  return [...entries,...f.receipts[0].filter(r=>!r.accepted).map(r=>'Blue input declined · '+(r.reason??r.channel).replaceAll('-',' '))]
   .map(text=>({tick:f.state.tick,time:f.state.time,text}));
 }),[frames]);
 const visible=log.filter(e=>e.tick<=state.tick);
 const checkpoints=useMemo(()=>frames.flatMap((f,i)=>f.events.flatMap(event=>{
  if(event.kind!=='core'||!['started','activated','disabled','completed'].includes(event.action))return [];
  return [{index:i+1,action:event.action,time:event.time,side:event.side}];
 })),[frames]);
 const visited=checkpoints.filter(checkpoint=>checkpoint.index<=index).slice(-4);
 useEffect(()=>{if(finished)onFinish()},[finished,onFinish]);
 useEffect(()=>{
  if(paused||finished)return;
  let animation=0;
  const started=performance.now()-state.time*1000/second;
  let next=index;
  const draw=(now:number)=>{
   const elapsed=(now-started)*second/1000;
   while(frames[next]&&frames[next].state.time<=elapsed)next++;
   setIndex(next);
   if(next<frames.length)animation=requestAnimationFrame(draw);
  };
  animation=requestAnimationFrame(draw);
  return ()=>cancelAnimationFrame(animation);
 },[paused,finished,frames]);
 const end=recording.final;
 const objective=state.core?.phase==='active'?'Core active':state.core?.phase==='pending'?'Core pending':
  state.core?.phase==='disabled'?'Core disabled':state.core?.phase==='completed'?'Core completed':'Dust Yard';
 const status=(side:0|1)=>{
  const fighter=state.fighters[side];
  return !fighter.hp?'Defeated':state.core?.channel?.side===side?'Channeling Core':fighter.reloadDue?'Recharging':
   fighter.firing?'Preparing tag':fighter.motion?'Moving':!finished&&visible.some(e=>state.tick-e.tick<9&&e.text===teamName[side]+' movement blocked')?'Blocked':'Ready';
 };
 const cueFrame=frames.slice(Math.max(0,index-6),index).reverse().find(f=>f.events.some(event=>event.kind==='attack'));
 const remaining=state.core?Math.max(0,state.core.deadline-state.time):0;
 return <section className="battle continuous-match" aria-label="Objective Duel">
  <div className="battlebar">
   <div className="arena-side blue-unit"><TeamEmblem side={0}/><div><strong>Blue</strong><small>{status(0)} · {state.fighters[0].hp} HP</small></div></div>
   <div className="round"><strong>{objective}</strong><span>{finished?timeLabel(state.time)+' elapsed':timeLabel(remaining)+' left'}</span></div>
   <div className="arena-side sand-unit"><TeamEmblem side={1}/><div><strong>Sand</strong><small>{status(1)} · {state.fighters[1].hp} HP</small></div></div>
  </div>
  <Board state={state} frame={finished?undefined:cueFrame} config={recording.config}/>
  <div className="arena-caption"><span>{teamName[recording.config.activator]} activates Core. {teamName[1-recording.config.activator]} disables it.</span><span>{timeLabel(state.time)}</span></div>
  <div className="battlefooter">
   <div><span className="eyebrow">{recorded?'RECORDED GEMINI DUEL':'GEMINI DUEL'} · UNVERIFIED</span>
    {finished&&<h2>{end.result==='blue'?'Blue wins':end.result==='sand'?'Sand wins':end.result==='draw'?'Draw':'Match interrupted'}</h2>}
    {finished&&end.reason&&endReasons[end.reason]&&<p className="arena-end-reason">{endReasons[end.reason]}</p>}
   </div>
   <div className="replay-controls">{finished?
    <><button onClick={()=>{setIndex(0);setPaused(false)}}>Watch again</button>{onRematch&&<button onClick={onRematch}>Rematch</button>}{onSameSetup&&<button onClick={onSameSetup}>Same-setup rematch</button>}<button onClick={onCoach}>Coach Agent</button></>:
    <><button onClick={()=>setPaused(!paused)}>{paused?'Resume':'Pause'}</button><button onClick={()=>setIndex(frames.length)}>Skip to result</button></>}</div>
  </div>
  <input className="arena-scrubber" type="range" aria-label="Replay position" min="0" max={frames.length} value={index}
   onChange={event=>{setPaused(true);setIndex(Number(event.target.value))}}/>
  {visited.length>0&&<div className="arena-checkpoints" aria-label="Core replay checkpoints">
   {visited.map(checkpoint=>
    <button key={checkpoint.index+'-'+checkpoint.action} onClick={()=>{setPaused(true);setIndex(checkpoint.index)}}>
     {timeLabel(checkpoint.time)} · {teamName[checkpoint.side]} {checkpoint.action==='started'?'starts Core':'Core '+checkpoint.action}
    </button>)}
  </div>}
  <div className="match-details continuous-decisions">
   {finished&&previous&&<p className="continuous-comparison"><strong>Blue’s first tag or Core action</strong><br/>
    Previous · {opening(previous)}<br/>This match · {opening(replay)}</p>}
   <div><h3>Blue’s plan</h3>{latest?<><p>Accepted at {timeLabel(latest.step*recording.config.step)}</p><ol>{latest.plan!.stages.map((stage,i)=>
    <li key={i}>{action(stage.packet)}{stage.when?' if '+showCondition(stage.when):''}
     {stage.until?' until '+showCondition(stage.until):''}
     {stage.alternative?' · Otherwise '+action(stage.alternative):''}</li>)}</ol></>:<p>Waiting for a recorded decision.</p>}</div>
   <div><h3>On the field</h3>{visible.length===0&&<p>Waiting for the first field event.</p>}<ol>{visible.slice(-4).map((event,i)=><li key={event.tick+'-'+i}>{timeLabel(event.time)} · {event.text}</li>)}</ol>
    {finished&&visible.length>4&&<details><summary>Match event log</summary><ol>{visible.map((event,i)=><li key={i}>{timeLabel(event.time)} · {event.text}</li>)}</ol></details>}</div>
  </div>
 </section>;
}
