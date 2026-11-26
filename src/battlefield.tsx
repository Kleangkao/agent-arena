import {useEffect} from 'react';
import {ArenaGrid,ArenaUnit} from './arena-board';
import type {Action,State} from './game';

type View={state:State;actions:[Action,Action]|null;paused:boolean;onSettled:(state:State)=>void};

export function Battlefield({state,actions,paused,onSettled}:View) {
 useEffect(()=>{
  if(!state.result||paused)return;
  const timer=setTimeout(()=>onSettled(state),actions?500:0);
  return ()=>clearTimeout(timer);
 },[state,actions,paused,onSettled]);
 const x=(position:number)=>48+position*48;
 return <ArenaGrid width={384} height={192} label="Top-down Dust Yard practice battlefield">
  <rect x="24" y="72" width="336" height="48" rx="8" fill="#26354b" stroke="#4c627e"/>
  {Array.from({length:7},(_,i)=><circle key={i} cx={x(i)} cy="96" r="4" fill="#526985"/>)}
  {actions?.map((action,side)=>{
   if(action!=='attack')return null;
   return <line key={side} className={side===0?'blue-unit':'sand-unit'} x1={x(state.fighters[side].position)}
    y1={side===0?87:105} x2={x(state.fighters[1-side].position)} y2={side===0?105:87}
    stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/>;
  })}
  {state.fighters.map((fighter,side)=><g className={paused?'':'lane-unit'} key={side}
   style={{transform:`translate(${x(fighter.position)}px,${side===0?87:105}px)`}}>
   <ArenaUnit x={0} y={0} side={side} hp={fighter.hp} ammo={fighter.ammo} capacity={3} active={actions?.[side]==='reload'?'reload':''}/>
  </g>)}
 </ArenaGrid>;
}
