import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {canonical} from '../src/v25/game.js';
import {sides} from '../src/v26/config.js';
import {matches} from '../src/v26/controller.js';
import {observation} from '../src/v26/game.js';
import {load} from '../src/v26/replay.js';
import type {runTrial} from '../server/gameplay-v26.js';

type Trial=Awaited<ReturnType<typeof runTrial>>;
export function auditObjective(finite:Trial,wrapped:Trial,persistent:Trial) {
  mkdirSync('evidence/gameplay-v27',{recursive:true});
  const firstChange=(a:Trial,b:Trial)=> {
    const read=(trial:Trial)=>({trial,frames:load(trial.recording).frames,
      inputs:new Map(trial.recording.transcript)});
    const left=read(a),right=read(b);
    const inputs=(arm:typeof left,i:number)=>arm.inputs.get(i+1)??[null,null];
    const first=(test:(i:number)=>boolean)=>{
      for(let i=0;i<Math.min(left.frames.length,right.frames.length);i++) if(test(i)) return i;
      return -1;
    };
    const firstInput=first(i=>canonical(inputs(left,i))!==canonical(inputs(right,i)));
    const firstAuthority=first(i=>canonical(left.frames[i])!==canonical(right.frames[i]));
    if(firstInput<0&&firstAuthority<0) return null;
    const sideEvidence=(arm:typeof left,i:number)=>{
      const {trial,frames}=arm, state=frames[i-1]?.state??trial.recording.initialState;
      return {tick:state.tick,side:sides.map(side=>{
        const view=observation(trial.recording.config,state,side);
        const latest=trial.participants[side].requests.filter(x=>x.status==='accepted'&&x.tick<=i).at(-1);
        const active=trial.upstream!.provenance.find(row=>row.side===side&&row.tick===i);
        const spec=latest?.behavior?.kind==='ordered'?latest.behavior.stages:latest?.plan?.stages;
        const guards=spec?.map((stage,index)=>({index,when:stage.when,matched:stage.when?matches(stage.when,view):null,
          until:stage.until,interruptWhen:stage.interruptWhen}));
        const transition=trial.upstream?.diagnostics?.find(row=>row.side===side&&row.tick===i);
        return {side,view,latest,guards,transition,active,packet:inputs(arm,i)[side],receipts:frames[i].receipts[side]};
      }),events:frames[i].events,postState:frames[i].state};
    };
    const tick=firstAuthority<0?firstInput:firstAuthority;
    return {tick:tick+1,firstInputTick:firstInput<0?null:firstInput+1,firstAuthorityTick:firstAuthority<0?null:firstAuthority+1,
      left:sideEvidence(left,tick),right:sideEvidence(right,tick),
      following:tick+1<Math.min(left.frames.length,right.frames.length)?
        {left:sideEvidence(left,tick+1),right:sideEvidence(right,tick+1)}:null,
      previous:{left:tick>0?sideEvidence(left,tick-1):null,right:tick>0?sideEvidence(right,tick-1):null}};
  };
  const first=firstChange(finite,persistent);
  assert(first);
  const control=firstChange(finite,wrapped);
  const persistence=firstChange(wrapped,persistent);
  const classification=control&&control.tick<=first.tick?'representation or scheduling semantics precede persistence':
    'first change requires authored reentry';
  return {first,control,persistence,classification,outcomes:[finite,wrapped,persistent].map(t=>({
    result:t.recording.final.result,reason:t.recording.final.reason,tick:t.recording.final.tick,replay:t.upstream!.replay,
  }))};
}
