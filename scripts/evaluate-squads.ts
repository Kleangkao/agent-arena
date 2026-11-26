import {readFileSync,writeFileSync} from 'node:fs';
import {initialSquads,legacySquadRules,loadSquads,playWindow,point,scriptedSquads,squadConfig,squadRules,teamSizes} from '../src/squads/game.js';

const file=JSON.parse(readFileSync('evidence/squads/model-matches.json','utf8'));
const sample=file.find((row:{id:string})=>row.id==='21bd79a1-2f63-464d-9724-94339fb27cb3');
const plans=loadSquads(sample.replay).replay.windows[0];
const starting=initialSquads(squadConfig());
const current=file.find((row:{id:string})=>row.id==='64687a33-3e0b-491d-a05b-443052a37181');
const [north,fixedSand]=loadSquads(current.replay).replay.windows[0];
const openingComparison=[north,plans[0]].map(blue=>{
 const end=playWindow(starting,[blue,fixedSand]).at(-1)!;
 return {intent:blue.intent,score:end.score,blueUnits:end.units.filter(u=>u.side===0).map(u=>({at:point(u.at),hp:u.hp}))};
});
const collision=[legacySquadRules,squadRules].map(rules=>{
 const frames=playWindow(starting,plans,rules),last=frames.at(-1)!;
 return {rules,blueAtSpawn:last.units.filter((u,i)=>u.side===0&&u.at===starting.units[i].at).length,
  blockedUnitTicks:frames.reduce((n,f)=>n+f.units.filter(u=>u.side===0&&u.blocked>0).length,0)};
});
const sizes=teamSizes.map(size=>{
 const config=squadConfig(size);
 const times:number[]=[];
 const data=scriptedSquads(config,'split','north');
 for(let i=0;i<30;i++){
  const start=performance.now();
  scriptedSquads(config,'split','north');
  times.push(performance.now()-start);
 }
 times.sort((a,b)=>a-b);
 const end=data.frames.at(-1)!;
 return {size,ticks:end.tick,score:end.score,result:data.replay.final,shots:data.frames.flatMap(f=>f.shots).length,
  blockedSurvivors:end.units.filter(u=>u.hp&&u.blocked).length,medianMs:+times[15].toFixed(2),p95Ms:+times[28].toFixed(2)};
});
const result={method:'One fixed split-vs-north scripted matchup per size; 30 warm timing samples. Planning and browser playback excluded.',
 collision,openingComparison:{method:'Execute the two genuine Blue opening plans against the same accepted Sand plan from the current-rules run.',runs:openingComparison},sizes};
writeFileSync('evidence/squads/offline-comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
