import {describe,expect,it} from 'vitest';
import {draw, type Side} from '../src/v2/game.js';
import {center} from '../src/v23/space.js';
import * as world from '../src/v23/game.js';
import * as historic from '../src/v24/replay.js';
import {readFileSync} from 'node:fs';
import * as game from '../src/v25/game.js';
import {load,record} from '../src/v25/replay.js';

function score(seed = 3) {
  const config = game.configure(seed,{mode:'score-deathmatch',target:5,seconds:45});
  if (config.mode !== 'score-deathmatch') throw Error('Wrong test mode');
  return config;
}
function duel(variant:game.Variant = game.defaultVariant) {
  const config = game.configure(3,{mode:'objective-duel',activator:0,variant});
  if (config.mode !== 'objective-duel') throw Error('Wrong test mode');
  return config;
}
const scoreState = (state:game.State):game.ScoreState => {
  if (!('score' in state)) throw Error('Expected score state');
  return state;
};
const coreState = (state:game.State) => {
  if (!('core' in state)) throw Error('Expected Core state');
  return state;
};
// Position both agents within fictional attack range and pin two successful rolls.
function edgeDefeat(clock:number, oneSide?:Side) {
  let seed = 0;
  while (draw(seed,clock,0) >= 30 || draw(seed,clock,1) >= 30) seed++;
  const config = score(seed);
  const state = scoreState(game.initial(config));
  state.time = clock-100;
  state.fighters.forEach((fighter, side)=>{
    fighter.position = center(30+side*2);
    fighter.hp = 1;
    if (oneSide === undefined || side === oneSide) fighter.firing = {kind:'attack',due:clock};
  });
  return {config,state};
}

describe('V2.5 competition rules',()=>{
  it('changes the target, deadline, and Core durations only via a validated configuration',()=>{
    expect(game.maxTicks(score())).toBe(1350);
    expect(game.maxTicks(game.configure(3,{mode:'score-deathmatch',target:20,seconds:120}))).toBe(3600);
    expect(()=>game.assertConfig({...duel(),objective:{...duel().objective,activate:1}})).toThrow('Altered');
    expect(()=>game.assertConfig({...score(),target:1})).toThrow('Invalid score');
    expect(()=>game.assertConfig({...score(),participants:['same','same']})).toThrow();
    expect(()=>game.assertConfig({...score(),respawnDelay:0})).toThrow('Altered');
  });
  it('scores simultaneous defeats once before settling simultaneous target at the deadline',()=>{
    const {config,state} = edgeDefeat(score().limit);
    state.score = [4,4];
    const next = game.advance(config,state,[null,null]);
    expect(next.events.filter(e=>e.kind==='score')).toHaveLength(2);
    expect(next.events.at(-1)).toMatchObject({kind:'score-ended',reason:'simultaneous-target',result:'draw'});
    expect(scoreState(next.state).score).toEqual([5,5]);
    expect(scoreState(next.state).respawnAt).toEqual([null,null]);
    expect(()=>game.advance(config,next.state,[null,null])).toThrow('Illegal V2.5 step');
  });
  it('counts a deadline score before clock settlement and gives an early target result precedence',()=>{
    const {config,state} = edgeDefeat(score().limit,0);
    const frame = game.advance(config,state,[null,null]);
    expect(frame.state).toMatchObject({result:'blue',reason:'score-clock',score:[1,0],respawnAt:[null,null]});
    state.score = [4,0];
    expect(game.advance(config,state,[null,null]).state).toMatchObject({result:'blue',reason:'target-score',score:[5,0]});
  });
  it('clears previous-life state, rejects defeated inputs, and respawns without overlapping an occupied home',()=>{
    const {config,state} = edgeDefeat(100,0);
    state.fighters[1].reloadDue = 6000;
    let step = game.advance(config,state,[null,null]);
    expect(step.state.fighters[1].reloadDue).toBeUndefined();
    expect(game.allows(config,step.state,1,{kind:'observe'})).toBe(false);
    expect(game.allows(config,step.state,0,{kind:'attack'})).toBe(false);
    const scoreBefore = scoreState(step.state).score;
    step.state.fighters[0].position = center(34);
    let respawns = 0, defeats = 0, restored;
    for (let i=0;i<38;i++) {
      step = game.advance(config,step.state,[null,null]);
      respawns += step.events.filter(e=>e.kind==='respawn').length;
      defeats += step.events.filter(e=>e.kind==='defeat').length;
      if (step.events.some(e=>e.kind==='respawn')) restored = step.state.fighters[1];
    }
    expect([respawns,defeats]).toEqual([1,0]);
    expect(restored).toEqual({...world.initial().fighters[1],position:center(16)});
    expect(scoreState(step.state).score).toEqual(scoreBefore);
  });
  it('allows movement through a defeated agent location and restores both agents after mutual defeat',()=>{
    const {config,state} = edgeDefeat(100);
    let frame = game.advance(config,state,[null,null]);
    expect(scoreState(frame.state).score).toEqual([1,1]);
    for (let i=0;i<36;i++) frame = game.advance(config,frame.state,[null,null]);
    expect(frame.events.filter(e=>e.kind==='respawn')).toHaveLength(2);
    expect(frame.state.fighters).toEqual(world.initial().fighters);
    const single = edgeDefeat(100,0);
    frame = game.advance(single.config,single.state,[null,null]);
    for (let i=0;i<22;i++) frame = game.advance(single.config,frame.state,[i ? null : {kind:'steer',mode:'run',dx:1,dy:0},null]);
    expect(frame.state.fighters[0].position.x).toBeGreaterThan(frame.state.fighters[1].position.x);
  });
  it('publishes tied, leading and trailing score context without rival health or unrestricted position',()=>{
    const config = score();
    const state = scoreState(game.initial(config));
    expect(game.observation(config,state,0)).toMatchObject({match:{score:0,opponentScore:0,remaining:135000,target:5},world:{contact:{status:'unknown'}}});
    state.score = [4,2];
    state.time = 134000;
    expect(game.observation(config,state,0).match).toMatchObject({score:4,opponentScore:2,remaining:1000});
    expect(game.observation(config,state,1).match).toMatchObject({score:2,opponentScore:4,remaining:1000});
    expect(Object.keys(game.observation(config,state,0).world)).toEqual(['contact']);
  });
  it('completes Core interactions at exact deadlines and resets interrupted progress',()=>{
    const config = duel();
    let state = coreState(game.initial(config));
    state.time = config.objective.pending - config.objective.activate;
    // Move a test participant into the Core zone without affecting combat.
    state.fighters[0].position = {...config.objective.position,x:config.objective.position.x-2400};
    state.fighters[1].position = {...config.objective.position,x:config.objective.position.x+2400};
    state = coreState(game.advance(config,state,[{kind:'interact'},null]).state);
    // Start at a partial final tick offset, so the interaction completes exactly on the deadline.
    while (state.core.phase === 'pending') state = coreState(game.advance(config,state,[null,null]).state);
    expect(state.time).toBe(config.objective.pending);
    expect(state.core.phase).toBe('active');
    state = coreState(game.advance(config,state,[null,{kind:'interact'}]).state);
    state = coreState(game.advance(config,state,[null,{kind:'cancel-interaction'}]).state);
    expect(state.core.interaction).toBeUndefined();
    state.time = state.core.deadline-config.objective.disable;
    state = coreState(game.advance(config,state,[null,{kind:'interact'}]).state);
    while (!state.result) state = coreState(game.advance(config,state,[null,null]).state);
    expect(state.core.phase).toBe('disabled');
    expect(state).toMatchObject({result:'sand',reason:'core-disabled'});
  });
  it('keeps an active Core running after Activator defeat without reassessing the defeated fighter each tick',()=>{
    const config = duel();
    const state = coreState(game.initial(config));
    state.core = {phase:'active',deadline:300};
    state.fighters[0].hp = 0;
    state.fighters[0].position = center(30);
    state.fighters[1].position = center(32);
    expect(game.allows(config,state,1,{kind:'attack'})).toBe(false);
    expect(game.observation(config,state,1).world.contact).toEqual({status:'unknown'});
    const frame = game.advance(config,state,[null,null]);
    expect(frame.events).not.toContainEqual({kind:'defeat',side:0});
    expect(coreState(frame.state).core.phase).toBe('active');
    const next = game.advance(config,game.advance(config,frame.state,[null,null]).state,[null,null]);
    expect(next.state).toMatchObject({result:'blue',reason:'core-completed'});
  });
  it('isolates damage cancellation to the configured Core experiment',()=>{
    const {config:rollConfig,state:worldState} = edgeDefeat(100,1);
    for (const variant of ['long-disable','contestable-core'] as const) {
      const config = game.configure(rollConfig.seed,{mode:'objective-duel',activator:0,variant});
      const state = coreState(game.initial(config));
      state.fighters[0].position = {...duel().objective.position,x:duel().objective.position.x-2400};
      state.fighters[1].position = {...duel().objective.position,x:duel().objective.position.x+2400};
      state.fighters[1].firing = worldState.fighters[1].firing;
      const frame = game.advance(config,state,[{kind:'interact'},null]);
      expect(frame.state.fighters[0].hp).toBeLessThan(100);
      expect(frame.events.some(e=>e.kind==='objective'&&e.action==='cancelled')).toBe(variant==='contestable-core');
    }
  });
  it('records a bounded score draw and rejects altered outcomes, events, and transcript suffixes',()=>{
    const config = score();
    const idle = record(config,()=>[null,null]);
    expect(idle.recording.final).toMatchObject({result:'draw',reason:'equal-score',score:[0,0],tick:1350});
    expect(load(JSON.parse(JSON.stringify(idle.recording))).frames).toEqual(idle.frames);
    expect(()=>load({...idle.recording,events:[]})).toThrow('integrity');
    expect(()=>load({...idle.recording,final:{...idle.recording.final,result:'sand'}})).toThrow('integrity');
    expect(()=>load({...idle.recording,transcript:[[1351,[{kind:'observe'},null]]]})).toThrow('transcript');
  });
  it('records an explicit legacy elimination reason without changing the historical world outcome',()=>{
    const replay = record(game.configure(3,{mode:'elimination'}),()=>[null,null]);
    expect(replay.recording.final).toMatchObject({reason:'health-clock',result:'draw',time:world.matchTime});
    expect(replay.recording.events.at(-1)?.[1]).toContainEqual({kind:'elimination-ended',result:'draw',reason:'health-clock'});
    expect(load(replay.recording).frames).toEqual(replay.frames);
  });
  it('preserves the historical active Core replay after the V2.5 changes',()=>{
    const playback = historic.load(JSON.parse(readFileSync('evidence/gameplay-v24/activator-defeated-after-activation.json','utf8')));
    expect(playback.recording.final).toMatchObject({result:'sand',reason:'core-completed'});
    expect(playback.recording.final.fighters[1].hp).toBe(0);
  });
});
