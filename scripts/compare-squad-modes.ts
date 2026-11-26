import {writeFileSync} from 'node:fs';
import archived from '../src/fixtures/relay-yard-gemini.json';
import {continuousConfig,continuousSquadRules,initialSquads,playWindow,point,scriptedSquads,squadConfig,
 type Frame,type Pair,type Plan,type SquadMode} from '../src/squads/game';

function summarize(frames:Frame[]){
 let fractional=0,total=0,blocked=0,distance=0,pulses=0,respawns=0;
 const status:Record<string,number>={};
 const xy=(u:Frame['units'][number])=>u.x===undefined?point(u.at):[u.x,u.y!];
 for(const [tick,frame] of frames.entries()){
  if(!tick)continue;
  pulses+=frame.shots.length;
  if(frame.objective)status[frame.objective.phase]=(status[frame.objective.phase]??0)+1;
  for(const [i,unit] of frame.units.entries()){
   if(!unit.hp)continue;
   total++;
   const [x,y]=xy(unit),prev=frames[tick-1].units[i];
   if(!Number.isInteger(x)||!Number.isInteger(y))fractional++;
   if(unit.blocked)blocked++;
   if(prev.hp){const [px,py]=xy(prev);distance+=Math.hypot(x-px,y-py);}
   else respawns++;
  }
 }
 const last=frames.at(-1)!;
 return {ticks:last.tick,score:last.score,worldDistance:Number(distance.toFixed(2)),fractional,sampledLiveUnitTicks:total,blocked,pulses,respawns,objectiveStatusTicks:status};
}

const old=squadConfig(),current=continuousConfig('relay');
const plans=archived.windows[0] as Pair<Plan>;
const open=(config:typeof old|typeof current)=>{const state=initialSquads(config);return summarize([state,...playWindow(state,plans,config.rulesVersion)]);};
const practice=(['bomb','tdm','relay'] as const).map((mode:SquadMode)=>{
 const {frames,replay}=scriptedSquads(continuousConfig(mode));
 return {mode,source:replay.source,result:replay.final,...summarize(frames)};
});
const arena=initialSquads(continuousConfig('tdm'));
for(const [i,x] of [[0,13],[5,14]])Object.assign(arena.units[i],{x,y:3,at:x+3*27,hp:20});
const pulseControl=['-','-/pulse'].map(order=>{
 const plan={intent:'Test control',orders:[order,'-','-','-','-']};
 return {order,...summarize([arena,...playWindow(arena,[plan,plan],continuousSquadRules)])};
});
const data={movement:{source:'Same genuine archived opening executed offline under two rules',v2:open(old),v3:open(current)},
 practice,pulseControl};
writeFileSync('evidence/continuous-squads/local-comparison.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(data,null,2));
