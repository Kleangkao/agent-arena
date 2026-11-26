import {useId} from 'react';

export function ArenaGrid({width,height,label,children,step=48}:{width:number;height:number;label:string;children:React.ReactNode;step?:number}) {
 const grid=useId();
 return <svg className="arena-grid" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
  <defs><pattern id={grid} width={step} height={step} patternUnits="userSpaceOnUse">
   <path d={`M${step} 0H0V${step}`} fill="none" stroke="#303c4e" strokeWidth="1.2"/>
   {step>=48&&<circle cx="0" cy="0" r="2.2" fill="#536982"/>}
  </pattern></defs>
  <rect width={width} height={height} fill="#121d2c"/>
  <rect width={width} height={height} fill={`url(#${grid})`}/>
  {children}
 </svg>;
}

export function UnitMark({side}:{side:number}) {
 return side===0?<path d="M0 -11 10 -5 10 6 0 12 -10 6 -10 -5Z" fill="currentColor"/>:
  <rect x="-9" y="-9" width="18" height="18" rx="3" transform="rotate(45)" fill="currentColor"/>;
}

export function TeamEmblem({side}:{side:number}) {
 return <svg className={side===0?'team-emblem blue-unit':'team-emblem sand-unit'} viewBox="-18 -18 36 36" aria-hidden="true">
  <circle r="16" fill="#172433" stroke="currentColor" opacity=".7"/><UnitMark side={side}/>
  <circle r="3" fill="#142236"/>
 </svg>;
}

export function ArenaUnit({x,y,side,hp,ammo,capacity=4,active='',scale=1}:{x:number;y:number;side:number;hp:number;ammo?:number;capacity?:number;active?:string;scale?:number}) {
 return <g className={side===0?'blue-unit':'sand-unit'} transform={`translate(${x} ${y}) scale(${scale})`} opacity={hp?1:.34}>
  <circle r="16" fill="#101825" stroke="currentColor" strokeWidth="2"/>
  {active&&<circle r="20" fill="none" stroke="currentColor" strokeDasharray="3 4" opacity=".78"/>}
  <UnitMark side={side}/><circle r="3" fill="#142236"/>
  <rect x="-14" y="-23" width="28" height="3" rx="1.5" fill="#384459"/>
  <rect x="-14" y="-23" width={28*hp/100} height="3" rx="1.5" fill="currentColor"/>
  {ammo!==undefined&&Array.from({length:capacity},(_,i)=><rect key={i} x={i*6-(capacity*6-2)/2} y="22" width="4" height="4"
   fill={i<ammo?'currentColor':'#41516a'} rx="1"/>)}
 </g>;
}
