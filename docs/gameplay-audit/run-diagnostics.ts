import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {performance} from 'node:perf_hooks';
import {agentsCollide, center, clearSight, gap, openSegment, route, unit} from '../../src/v23/space.js';
import * as game from '../../src/v25/game.js';
import {developmentMatch, policy} from '../../src/v25/development.js';
import {load, record} from '../../src/v25/replay.js';
import {playModeTrial, prompt} from '../../server/gameplay-v25.js';
import type {Attempt} from '../../server/match.js';

const config = game.configure(1, {mode:'score-deathmatch'});
const fixture = () => {
  const state = game.initial(config);
  state.fighters[0].position = center(29);
  state.fighters[1].position = center(32);
  return state;
};
const observation = (state:game.State) => game.observation(config,state,0);
const legality = (state:game.State) => ({
  stop:game.allows(config,state,0,{kind:'stop'}),
  posture:game.allows(config,state,0,{kind:'posture',posture:'crouch'}),
  walk:game.allows(config,state,0,{kind:'steer',mode:'walk',dx:0,dy:1}),
  run:game.allows(config,state,0,{kind:'steer',mode:'run',dx:0,dy:1}),
  crouch:game.allows(config,state,0,{kind:'steer',mode:'crouch',dx:0,dy:1}),
  jump:game.allows(config,state,0,{kind:'steer',mode:'jump',dx:-1,dy:0}),
  attack:game.allows(config,state,0,{kind:'attack'}),
  precision:game.allows(config,state,0,{kind:'precision'}),
  reload:game.allows(config,state,0,{kind:'reload'}),
  observe:game.allows(config,state,0,{kind:'observe'}),
  peek:game.allows(config,state,0,{kind:'peek'}),
});
const cases = ['standing','walking','running','crouched','crouch-moving','jumping','attack','precision','reload','observe','peek','defeated'] as const;
const motions:Partial<Record<typeof cases[number],'walk'|'run'|'crouch'|'jump'>> = {
  walking:'walk',running:'run','crouch-moving':'crouch',jumping:'jump',
};
const matrix = Object.fromEntries(cases.map(label => {
  const state = fixture(), fighter = state.fighters[0];
  fighter.ammo = 2;
  if (label === 'crouched' || label === 'crouch-moving') fighter.posture = 'crouch';
  const mode = motions[label];
  if (mode) fighter.motion = {mode,path:[center(30)]};
  if (label === 'attack' || label === 'precision') fighter.firing = {kind:label,due:2310};
  if (label === 'reload') fighter.reloadDue = 3960;
  if (label === 'observe' || label === 'peek') fighter.survey = {kind:label,due:1320};
  if (label === 'defeated') fighter.hp = 0;
  return [label,legality(state)];
}));
const start = game.initial(config);
const moved = game.advance(config,start,[{kind:'steer',mode:'walk',dx:1,dy:0},null]).state;
const changed = game.advance(config,moved,[{kind:'steer',mode:'walk',dx:0,dy:-1},null]).state;
const stopped = game.advance(config,changed,[{kind:'stop'},null]).state;
const geometry = {
  footprintBoundary:[openSegment({x:900,y:2970},{x:900,y:2970}),openSegment({x:899,y:2970},{x:899,y:2970})],
  crossWall:openSegment(center(21),center(23)),
  occluded:!clearSight(center(21),center(23)),
  routeAroundWall:route(center(21),center(23),4,false),
  relativeSweep:agentsCollide({x:3000,y:3000},{x:6000,y:3000},{x:6000,y:3000},{x:3000,y:3000}),
  positions:[start,moved,changed,stopped].map(s=>s.fighters[0].position),
  walkWithCrouchPosture:game.advance(config,{...fixture(),fighters:[{...fixture().fighters[0],posture:'crouch'},fixture().fighters[1]]},
    [{kind:'steer',mode:'walk',dx:-1,dy:0},null]).state.fighters[0],
};
const gapFixture = (units:number, crouch:boolean, exposed=false) => {
  const state = fixture();
  state.fighters[1].position = {x:state.fighters[0].position.x+units,y:state.fighters[0].position.y};
  if (crouch) state.fighters[1].posture = 'crouch';
  if (exposed) state.fighters[1].exposedUntil = 2640;
  return {units, clear:clearSight(...state.fighters.map(f=>f.position) as [typeof state.fighters[0]['position'],typeof state.fighters[0]['position']]), view:observation(state)};
};
const focusStart = fixture();
focusStart.fighters[1].position = {x:focusStart.fighters[0].position.x+3*unit+100,y:focusStart.fighters[0].position.y};
focusStart.fighters[1].posture = 'crouch';
let focused = game.advance(config,focusStart,[{kind:'observe'},null]);
while (focused.state.fighters[0].survey) focused = game.advance(config,focused.state,[null,null]);
const afterFocus = game.advance(config,focused.state,[null,null]);
const resolving = fixture();
resolving.fighters[1].position = {x:resolving.fighters[0].position.x+3*unit+100,y:resolving.fighters[0].position.y};
resolving.fighters[0].firing = {kind:'attack',due:100};
const unchanged = game.advance(config,resolving,[null,null]);
const rivalChanges = game.advance(config,resolving,[null,{kind:'posture',posture:'crouch'}]);
const postureRng = {seed:config.seed,baseEvents:unchanged.events,changedEvents:rivalChanges.events};
const movingAtEdge = fixture();
movingAtEdge.fighters[1].position = {x:movingAtEdge.fighters[0].position.x+4*unit,y:movingAtEdge.fighters[0].position.y};
movingAtEdge.fighters[0].firing = {kind:'attack',due:100};
const edgeResult = game.advance(config,movingAtEdge,[null,{kind:'steer',mode:'walk',dx:1,dy:0}]);
const edge = {before:gap(movingAtEdge.fighters[0].position,movingAtEdge.fighters[1].position),
  after:gap(edgeResult.state.fighters[0].position,edgeResult.state.fighters[1].position),events:edgeResult.events};
const coach = {revision:'audit-fixture',text:'Select an available arcade input.'};
const respawnProbe = fixture();
respawnProbe.fighters[0].hp = 0;
const emptyPrompt = prompt(config,respawnProbe,0,coach);
const exposed = [gapFixture(3*unit,true),gapFixture(3*unit+1,true),gapFixture(4*unit,false),gapFixture(4*unit+1,false,true)];
const replayNames = ['ordinary-objective','ordinary-score','interrupted','simultaneous-defeats','defeated-activator','score-clock','idle-objective-deadline','manual'];
const replays = replayNames.map(name => {
  const raw = readFileSync('evidence/gameplay-v25/'+name+'.json','utf8');
  const t = performance.now();
  const playback = load(JSON.parse(raw));
  const loadMs = performance.now()-t;
  const rec = playback.recording;
  const byTick = new Map(rec.transcript);
  const examples = playback.frames.flatMap(({state,events},i) => {
    if (state.result) return [];
    return events.filter(e=>e.kind === 'contact' && e.visible || e.kind === 'objective' && e.action === 'activated' || e.kind === 'respawn')
      .flatMap(event => {
        const side = event.kind === 'contact' || event.kind === 'respawn' ? event.side : rec.config.mode === 'objective-duel' ? (1-rec.config.activator) as 0|1 : 0;
        const next = playback.frames[i+1];
        return [{
          event, tick:state.tick, state, gap:gap(state.fighters[0].position,state.fighters[1].position),
          view:game.observation(rec.config,state,side), side,
          nextInput:byTick.get(state.tick+1)?.[side] ?? null,
          nextEvents:next?.events, nextState:next?.state,
          policySeek:policy(rec.config,state,side,'seek'), policyRoam:policy(rec.config,state,side,'roam'),
          nextPolicyBoundary:playback.frames.slice(i,i+18).find(frame=>Math.floor(frame.state.time/1320)>Math.floor((frame.state.time-100)/1320))?.state.tick
        }];
      });
  });
  return {name, source:rec.source, config:rec.config, bytes:Buffer.byteLength(raw), loadMs, frames:playback.frames.length,
    inputs:rec.transcript.length, events:rec.events.reduce((sum,item)=>sum+item[1].length,0), final:rec.final,
    examples:examples.filter((entry,i)=>examples.findIndex(e=>e.event.kind===entry.event.kind)===i).slice(0,4)};
});
async function audit() {
  const attempts:Attempt[] = [];
  const views: Array<ReturnType<typeof prompt>> = [];
  const timeline = await playModeTrial(game.configure(12,{mode:'objective-duel',activator:0}),[coach,coach],
    async view => {
      views.push(view);
      return {text:'{"picks":[]}',model:'offline-fixture'};
    },new AbortController().signal,attempts);
  assert.equal(observation(focused.state).world.contact.status,'observed');
  assert.equal(observation(focused.state).legal.actions.includes('attack'),false);
  assert.equal(observation(afterFocus.state).world.contact.status,'last seen');
  assert.ok(unchanged.events.some(e=>e.kind==='attack' && e.outcome==='hit'));
  assert.ok(rivalChanges.events.some(e=>e.kind==='attack' && e.outcome==='miss'));
  assert.ok(edge.after>4*unit && edge.events.some(e=>e.kind==='attack' && e.outcome==='hit'));
  assert.deepEqual([...new Set(attempts.map(attempt=>attempt.step))],[0,120,240,360,480]);
  const runs = [];
  for (const mode of ['elimination','objective-duel','score-deathmatch'] as const) {
    const costs:number[] = [];
    let bytes = 0, frames = 0, events = 0;
    for (let seed=0;seed<48;seed++) {
      const c = game.configure(seed,mode === 'objective-duel' ? {mode,activator:(seed%2) as 0|1} : {mode});
      const start = performance.now();
      const match = developmentMatch(c);
      costs.push(performance.now()-start);
      frames += match.frames.length;
      events += match.recording.events.reduce((n,[,current])=>n+current.length,0);
      bytes += Buffer.byteLength(JSON.stringify(match.recording));
    }
    costs.sort((a,b)=>a-b);
    runs.push({mode,samples:costs.length,medianMs:costs[24],p90Ms:costs[43],meanFrames:frames/48,meanEvents:events/48,meanBytes:bytes/48});
  }
  const reachable = record(config,s=>s.time<12000 ? [{kind:'steer',mode:'walk',dx:1,dy:0},null] : [null,null]);
  console.log(JSON.stringify({node:process.version,matrix,geometry,exposed,focus:{start:observation(focusStart),end:observation(focused.state),
    event:focused.events,next:observation(afterFocus.state),nextEvents:afterFocus.events},postureRng,edge,
    prompt:{keys:Object.keys(views[0]),starting:views[0],defeated:emptyPrompt, attempts, final:timeline.final},
    replays,runs,reachable:{ticks:reachable.frames.length,final:reachable.recording.final}},null,2));
}
void audit();

