import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {configure,second,step,type Side,type Profile} from '../src/v26/config.js';
import {advance,initial,maxTime,observation,within,type State} from '../src/v26/game.js';
import {center,clearSight,unit} from '../src/v23/space.js';
import {baselineDevelopmentPlan,developmentController,developmentPlan} from '../src/v26/development.js';
import {load,record,type Recording} from '../src/v26/replay.js';
import {developmentMatch as oldMatch} from '../src/v25/development.js';
import {configure as oldConfig} from '../src/v25/game.js';
import {limits,runTrial,selectedCadence,type Cadence} from '../server/gameplay-v26.js';
import {planLimits} from '../src/v26/controller.js';

const playtest=process.argv.includes('--playtest');
const useBaseline=process.argv.includes('--baseline');
const path=playtest?'evidence/gameplay-v26-playtest'+(useBaseline?'/baseline':''):'evidence/gameplay-v26';
mkdirSync(path,{recursive:true});
const write=(name:string,value:unknown)=>writeFileSync(path+'/'+name+'.json',JSON.stringify(value,null,2));
const modes=['objective-duel','score-deathmatch'] as const;
const cohorts=[];
const runs = new Map<string,Recording>();
const rangeCases = [
  {name:'open approach from home',from:center(28),to:{x:center(28).x+4.5*unit,y:center(28).y}},
  {name:'Core approach',from:center(28),to:center(31)},
  {name:'diagonal inside equipment reach',from:center(1),to:center(11)},
  {name:'wall occludes nearby target',from:center(21),to:center(23)},
];
const rangeMatrix=[];
const samples=48;
for(const sight of [4,5,6] as const) for(const reach of [4,5] as const) {
  if(playtest&&(sight!==5||reach!==4)) continue;
  const profile:Profile={sight,reach};
  const c=configure(1,'objective-duel',0,undefined,profile);
  rangeMatrix.push({profile,cases:rangeCases.map(({name,from,to})=>{
    const state=initial(c);
    state.fighters[0].position=from;state.fighters[1].position=to;
    const frame=advance(c,state,[null,null]);
    const blue=observation(c,frame.state,0);
    return {name,geometry:clearSight(from,to),inPassiveRadius:within(from,to,c.perception.range),
      inEquipmentRadius:within(from,to,c.equipment.range),current:!!blue.current,attack:blue.legal.standard};
  })});
  for(const mode of modes) {
    let activator=0,defender=0,draw=0,attacks=0,hits=0,empty=0,seconds=0,activations=0,respawns=0;
    const samplesByMatch=[];
    for(let seed=0;seed<samples;seed++) {
      for(const side of [0,1] as const) for(const roles of (mode==='objective-duel'?[0,1]:[0]) as Side[]) {
        const c=configure(seed,mode,roles,undefined,profile);
        const policySeed=(seed+12345)>>>0;
        const author=useBaseline||!playtest?baselineDevelopmentPlan:developmentPlan;
        const blue=developmentController(c,0,side===0?'mobile':'steady',policySeed,author);
        const sand=developmentController(c,1,side===0?'steady':'mobile',policySeed,author);
        const r=record(c,'development-policy',state=>[blue(observation(c,state,0)),sand(observation(c,state,1))]);
        const {frames}=load(r);
        if(seed===12&&side===0&&roles===0) runs.set(sight+'/'+reach+'/'+mode,r);
        const events=r.observations.flatMap(row=>row[1]);
        const shots=events.filter(e=>e.kind==='attack');
        attacks+=shots.length;hits+=shots.filter(e=>e.damage).length;
        empty+=Number(!shots.length);seconds+=r.final.time/second;
        activations+=events.filter(e=>e.kind==='core'&&e.action==='activated').length;
        respawns+=events.filter(e=>e.kind==='respawn').length;
        const activation=events.find(e=>e.kind==='core'&&e.action==='activated');
        const deaths=events.filter(e=>e.kind==='respawn');
        samplesByMatch.push({seed,bluePolicy:side===0?'mobile':'steady',activator:mode==='objective-duel'?roles:null,
          outcome:r.final.result,reason:r.final.reason,score:r.final.score,seconds:r.final.time/second,
          pendingSeconds:mode==='objective-duel'?(activation?.time??r.final.time)/second:null,
          activeSeconds:activation?(r.final.time-activation.time)/second:null,
          disabled:events.some(e=>e.kind==='core'&&e.action==='disabled'),
          completed:events.some(e=>e.kind==='core'&&e.action==='completed'),
          respawns:deaths.length,respawnContact:deaths.filter(e=>events.some(o=>o.kind==='contact'&&o.visible&&o.side===e.side&&o.time===e.time)).length,
          respawnInput:deaths.filter(e=>frames.find(f=>f.state.time>e.time)?.receipts[e.side].some(input=>input.accepted)).length});
        if(r.final.result==='draw') draw++;
        else if(r.final.result===(roles===0?'blue':'sand')) activator++;else defender++;
      }
    }
    cohorts.push({profile,mode,matches:samples*(mode==='objective-duel'?4:2),
      ...(mode==='objective-duel'?{activatorWins:activator,defenderWins:defender}:{blueWins:activator,sandWins:defender}),
      draw,attacks,hits,empty,seconds,activations,respawns,...(playtest?{samples:samplesByMatch}:{})});
  }
}

const baseline = playtest?[]:modes.map(mode=>{
  let matches=0, attacks=0, activations=0, respawns=0;
  for(let seed=0;seed<samples;seed++) for(const side of [0,1] as const) for(const activator of (mode==='objective-duel'?[0,1]:[0]) as Side[]) {
    const c=oldConfig(seed,mode==='objective-duel'?{mode,activator}:{mode});
    const r=oldMatch(c,side===0?['seek','roam']:['roam','seek']).recording;
    const events=r.events.flatMap(e=>e[1]);
    matches++;attacks+=events.filter(e=>e.kind==='attack').length;
    activations+=events.filter(e=>e.kind==='objective'&&e.action==='activated').length;
    respawns+=events.filter(e=>e.kind==='respawn').length;
  }
  return {mode,matches,attacks,activations,respawns};
});
const scheduling=[];
const coaches=[{text:'Local test',revision:'a'},{text:'Local test',revision:'b'}] as const;
const wait=(ms:number)=>({version:1,expiresInMs:ms,stages:[{forMs:ms,packet:{}}]});
const cadences:Cadence[]=playtest?['reserved']:['sixth','eight-seconds','lifecycle','reserved'];
for(const cadence of cadences) for(const mode of modes) {
  for(const pattern of ['authorized-wait','expiry','planned-play','retry'] as const) {
    const c=configure(12,mode), calls=new Map<string,number>();
    const trial=await runTrial(c,coaches,async input=>{
      const n=(calls.get(input.participant)??0)+1;calls.set(input.participant,n);
      if(pattern==='retry'&&n===2) throw Object.assign(Error('Injected transient error'),{status:503});
      if(pattern==='authorized-wait') return wait(13000);
      if(pattern==='expiry') return wait(4500);
      const side=input.participant===c.participants[0]?0:1;
      const v=input.view, base=developmentPlan(v,side as Side,side===0?'mobile':'steady',45);
      const walk=base.stages[0].packet.movement;
      const main={forMs:5500,packet:{attack:'standard'},when:'can-attack',
        ...(walk?{alternative:{movement:walk}}:{}),repeat:{everyMs:850,count:7}};
      return {version:1,expiresInMs:10000,stages:[
        {forMs:3500,packet:{core:'start'},when:'core-available',alternative:{},until:v.legal.core?undefined:'action-finished'},
        main,
        {forMs:1400,packet:{reload:true},when:'can-reload',alternative:{}},
      ]};
    },cadence,new AbortController().signal);
    scheduling.push({cadence,mode,pattern,result:trial.recording.final.result,interruption:trial.recording.interruption,
      seconds:trial.recording.final.time/second,participants:trial.participants,
      unplayedUpperBoundSeconds:trial.recording.interruption?(maxTime(c)-trial.recording.final.time)/second:0,
      lostAgentSeconds:trial.participants.reduce((n,p)=>n+p.metrics.uncovered*step,0)/second+
        (trial.recording.interruption?2*(maxTime(c)-trial.recording.final.time)/second:0)});
    if(pattern==='planned-play') write('injected-'+cadence+'-'+mode,trial.recording);
  }
}
for(const mode of modes) write(mode,runs.get('5/4/'+mode)!);
const manual=record(configure(12,'objective-duel'),'manual-sandbox',(s:State)=>{
  if(s.tick===0) return [{movement:{kind:'steer',gait:'run',direction:{x:1,y:0}},jump:true},null];
  if(s.tick===31) return [{movement:{kind:'stop'},core:'start'},null];
  return [null,null];
});
write('manual',load(manual).recording);
const preserved=['ordinary-objective','ordinary-score','manual'].map(name=>JSON.parse(readFileSync('evidence/gameplay-v25/'+name+'.json','utf8')).version);
write('benchmark',{rangeMatrix,cohorts,baseline,scheduling,preserved});
const defaults=configure(0,'objective-duel');
write('parameters',{rulesVersion:defaults.rulesVersion,mapVersion:defaults.mapVersion,geometry:defaults.geometry,
  timeUnitsPerSecond:second,step,locomotion:defaults.locomotion,perception:defaults.perception,equipment:defaults.equipment,
  core:defaults.core,score:defaults.score,elimination:defaults.elimination,planLimits,providerLimits:limits,selectedCadence});
