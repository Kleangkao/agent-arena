import {describe,expect,it} from 'vitest';
import {advance, allows, configure, initial, observation, settings, type Inputs, type State} from '../src/v24/objective';
import {developmentMatch} from '../src/v24/development';
import {load, record} from '../src/v24/replay';
import {load as loadOld} from '../src/v23/replay';
import {center, openSegment, unit} from '../src/v23/space';
import old from '../evidence/gameplay-v23/autonomous.json';
const config = configure(3,0);
const none = [null,null] as const;
const play = (state: State, inputs: Inputs = none) => advance(config,state,inputs);
const useCore = {kind:'interact'} as const;
const stage = (side: 0|1, active = false) => {
  const state = initial(config);
  state.fighters[side].position = settings.position;
  if (active) state.core = {phase:'active',deadline:settings.active};
  return state;
};

describe('Objective Duel', () => {
  it('uses separate phase clocks and gives the Defender a pending deadline win', () => {
    const data = record(config, () => none);
    expect(data.recording.final).toMatchObject({time:settings.pending,result:'sand',reason:'activation-prevented'});
    expect(data.frames.at(-1)?.events.at(-1)).toEqual({kind:'round-ended',result:'sand',reason:'activation-prevented'});
    expect(() => play(data.recording.final)).toThrow('already finished');
  });
  it('activates after a legal continuous approach, then awards a Core completion', () => {
    const goal = {x:settings.position.x-2000,y:settings.position.y};
    const data = record(config,state => !state.tick ? [{kind:'move',mode:'run',to:goal},null]
      : state.core.phase === 'pending' && allows(config,state,0,useCore) ? [useCore,null] : none);
    const first = data.frames[0].state.fighters[0].position;
    expect(first.x).toBe(center(28).x+600);
    expect(openSegment(first,goal)).toBe(true);
    const entries = data.recording.events.flatMap(([,items])=>items).filter(e=>e.kind==='objective');
    expect(entries.map(e=>e.action)).toEqual(['started','activated','completed']);
    expect(data.recording.final).toMatchObject({result:'blue',reason:'core-completed',core:{phase:'completed'}});
  });
  it('rejects tampered inputs and only allows the eligible role, in range', () => {
    const state = stage(1);
    expect(() => play(state,[useCore,null])).toThrow('Illegal');
    expect(() => play(state,[null,useCore])).toThrow('Illegal');
    const near = stage(0);
    const started = play(near,[useCore,null]).state;
    expect(() => play(started,[useCore,null])).toThrow('Illegal');
    expect(() => play(near,[{...useCore,role:'Defender'} as typeof useCore,null])).toThrow('Illegal');
    const swapped = configure(3,1);
    expect(allows(swapped,state,1,useCore)).toBe(true);
    expect(initial(swapped).fighters).toEqual(initial(config).fighters);
    expect(observation(config,initial(config),0).contact).toEqual({status:'unknown'});
    expect(observation(config,near,0).actions).toContain('interact');
  });
  it('allows independent walking and observing and resets interaction on exit', () => {
    const state = stage(0);
    state.fighters[0].position = {...settings.position,x:settings.position.x + settings.radius - 650};
    let current = play(state,[useCore,null]).state;
    current = play(current,[{kind:'steer',mode:'walk',dx:1,dy:0},null]).state;
    current = play(current,[{kind:'observe'},null]).state;
    expect(current.core.interaction).toBeDefined();
    expect(current.fighters[0]).toMatchObject({motion:{mode:'walk'},survey:{kind:'observe'}});
    const exited = play(current);
    expect(exited.events).toContainEqual({kind:'objective',action:'cancelled',side:0});
    expect(exited.state.core.interaction).toBeUndefined();
    expect(exited.state.fighters[0].motion?.mode).toBe('walk');
    const explicit = play(play(state,[useCore,null]).state,[{kind:'cancel-interaction'},null]);
    expect(explicit.events.filter(e=>e.kind==='objective')).toEqual([{kind:'objective',action:'cancelled',side:0}]);
  });
  it('cancels on an incompatible action without locking the underlying action', () => {
    const started = play(stage(0),[useCore,null]).state;
    const frame = play(started,[{kind:'steer',mode:'run',dx:-1,dy:0},null]);
    expect(frame.state.core.interaction).toBeUndefined();
    expect(frame.state.fighters[0].motion?.mode).toBe('run');
  });
  it('accepts activation and disable on their exact deadlines before clock outcomes', () => {
    const pending = stage(0);
    pending.time = settings.pending-100;
    pending.core.interaction = {side:0,started:settings.pending-settings.channel};
    const active = play(pending).state;
    expect(active.core).toEqual({phase:'active',deadline:settings.pending+settings.active});
    const disable = stage(1,true);
    disable.time = settings.active-100;
    disable.core.interaction = {side:1,started:settings.active-settings.channel};
    const result = play(disable);
    expect(result.state).toMatchObject({result:'sand',reason:'core-disabled',core:{phase:'disabled'}});
    expect(result.events.map(e=>e.kind)).toEqual(['objective','round-ended']);
  });
  it('resolves defeat before a channel succeeds and keeps an active Core after Activator defeat', () => {
    const state = stage(0,true);
    state.fighters[1].position={...settings.position,x:settings.position.x+2*unit};
    state.fighters[0].hp=18;
    state.fighters[0].motion={mode:'walk',dx:-1,dy:0};
    state.fighters[1].firing={kind:'attack',due:100};
    const frames=Array.from({length:30},(_,seed)=>advance(configure(seed,0),state,none));
    const defeated=frames.find(f=>f.state.fighters[0].hp===0)!;
    expect(defeated.state.result).toBeNull();
    expect(defeated.state.fighters[0].motion).toBeUndefined();
    expect(() => play(defeated.state,[{kind:'observe'},null])).toThrow('Illegal');
    const pending=stage(0);
    pending.fighters=structuredClone(state.fighters);
    pending.core.interaction={side:0,started:-settings.channel};
    expect(Array.from({length:30},(_,seed)=>advance(configure(seed,0),pending,none)).find(f=>f.state.fighters[0].hp===0)?.state)
      .toMatchObject({result:'sand',reason:'elimination',core:{phase:'pending'}});
  });
  it('treats simultaneous elimination consistently in both phases', () => {
    for (const active of [false,true]) {
      const state=stage(0,active);
      state.fighters[1].position={...settings.position,x:settings.position.x+unit};
      for (const x of state.fighters) {x.hp=18; x.firing={kind:'attack',due:100};}
      const frame=Array.from({length:30},(_,seed)=>advance(configure(seed,0),state,none)).find(f=>f.state.fighters.every(x=>!x.hp))!;
      expect(frame.state.reason).toBe(active?'elimination':'mutual-elimination');
      expect(frame.state.result).toBe(active?'blue':'draw');
      expect(frame.events.filter(e=>e.kind==='attack'||e.kind==='defeat').map(e=>e.kind)).toEqual(['attack','attack','defeat','defeat']);
    }
  });
  it('reconstructs exact states and ordered events, detects tampering and keeps historical formats separate', () => {
    for (const side of [0,1] as const) {
      const data=developmentMatch(configure(5,side,['coach-a','coach-b']));
      expect(load(JSON.parse(JSON.stringify(data.recording)))).toEqual(data);
      const {recording}=data;
      expect(() => load({...recording,final:{...recording.final,reason:'fake'}})).toThrow('integrity');
      expect(() => load({...recording,events:[]})).toThrow('integrity');
      expect(() => load({...recording,initialState:{...recording.initialState,time:1}})).toThrow('integrity');
      expect(() => load({...recording,config:{...recording.config,participants:['coach-a','coach-a']}})).toThrow('configuration');
    }
    expect(() => load(old)).toThrow('Unknown');
    expect(loadOld(old).recording.final.result).toBe('blue');
  });
});
