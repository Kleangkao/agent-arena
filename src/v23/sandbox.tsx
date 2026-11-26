import {useEffect, useRef, useState} from 'react';
import Phaser from 'phaser';
import {advance, allows, configure, destination, initial, matchTime, observation, rates,
  type Config, type Frame, type Input, type Inputs} from './game';
import {developmentMatch, policy} from './development';
import {load, type Playback, type Recording} from './replay';
import {center, radius, solid, unit, type Position} from './space';
import {HEIGHT, neighbors, walkable, WIDTH} from '../v2/yard';
import * as duel from '../v24/objective';
import {load as loadDuel, type Recording as DuelRecording, type Playback as DuelPlayback} from '../v24/replay';
import {developmentMatch as duelMatch, policy as duelPolicy} from '../v24/development';
import * as modes from '../v25/game';
import {load as loadModes, type Recording as ModeRecording, type Playback as ModePlayback} from '../v25/replay';
import {developmentMatch as modeMatch, policy as modePolicy} from '../v25/development';
import './continuous.css';

const tile = 60, scale = tile / unit;
const colors = [0x67b5f0, 0xeac278];
type ViewFrame = {state:Frame['state'] | modes.State;events:modes.Event[]};
type BoardView = {frame: ViewFrame; debug: boolean; running: boolean; step: Config['step']; fps: number;
  objective?: Pick<duel.Config['objective'],'radius'|'position'>};
function Board(view: BoardView) {
  const host = useRef<HTMLDivElement>(null), debugOutput = useRef<HTMLOutputElement>(null);
  const latest = useRef(view);
  latest.current = view;
  useEffect(() => {
    if (!host.current) return;
    class Yard extends Phaser.Scene {
      grid!: Phaser.GameObjects.Graphics;
      ink!: Phaser.GameObjects.Graphics;
      drawn?: ViewFrame;
      from?: Position[];
      elapsed = 0;
      flashes = [0, 0];
      updates = 0;
      create() {
        for (let cell = 0; cell < WIDTH * HEIGHT; cell++) {
          const {x, y} = center(cell);
          this.add.rectangle(x * scale, y * scale, tile, tile,
            walkable(cell) ? cell % 2 ? 0x665648 : 0x605144 : 0x382f2a);
        }
        this.grid = this.add.graphics().lineStyle(1, 0xdac4ae, .33);
        for (let cell = 0; cell < WIDTH * HEIGHT; cell++) if (walkable(cell)) {
          const a = center(cell);
          this.grid.fillStyle(0xdac4ae, .66).fillCircle(a.x * scale, a.y * scale, 2);
          for (const next of neighbors(cell).filter(next => next > cell)) {
            const b = center(next);
            this.grid.lineBetween(a.x * scale, a.y * scale, b.x * scale, b.y * scale);
          }
        }
        this.grid.lineStyle(1, 0xfe9879, .77);
        for (const box of solid) this.grid.strokeRect(box.left * scale, box.top * scale,
          (box.right - box.left) * scale, (box.bottom - box.top) * scale);
        this.ink = this.add.graphics();
      }
      update(_time: number, delta: number) {
        const {frame, running, debug, step, objective} = latest.current;
        if (this.drawn !== frame) {
          this.from = this.drawn?.state.tick === frame.state.tick - 1 ? this.drawn.state.fighters.map(f => f.position) : undefined;
          this.drawn = frame;
          this.elapsed = 0;
          if (!running) this.flashes = [0, 0];
          for (const event of frame.events) if (event.kind === 'attack') this.flashes[event.side] = 240;
        }
        const t = running && this.from ? Math.min(1, this.elapsed / (step / 3)) : 1;
        this.elapsed += delta;
        this.grid.setVisible(debug);
        this.ink.clear();
        if (objective && 'core' in frame.state) {
          const {x,y} = objective.position, r = objective.radius * scale;
          const px = x * scale, py = y * scale;
          const tint = frame.state.core.phase === 'active' ? 0xffae55 : frame.state.core.phase === 'disabled' ? 0x88ccd4 : 0xe2db9d;
          this.ink.lineStyle(2,tint,.9).beginPath().moveTo(px-r,py).lineTo(px,py-r).lineTo(px+r,py)
            .lineTo(px,py+r).closePath().strokePath();
          this.ink.fillStyle(tint,.85).fillRect(px-5,py-5,10,10);
        }
        const displayed = frame.state.fighters.map((fighter, side) => {
          const target = fighter.position, from = frame.events.some(e=>e.kind === 'respawn' && e.side === side) ? target : this.from?.[side] ?? target;
          const x = Phaser.Math.Linear(from.x, target.x, t), y = Phaser.Math.Linear(from.y, target.y, t);
          const sx = x * scale, sy = y * scale;
          const goal = destination(fighter);
          this.ink.fillStyle(colors[side], fighter.hp ? 1 : .3).fillCircle(sx, sy, fighter.posture === 'crouch' ? 7 : 10);
          if (this.flashes[side] > 0) this.ink.lineStyle(2, colors[side], this.flashes[side] / 240)
            .strokeCircle(sx, sy, 12 + (240 - this.flashes[side]) / 20);
          this.flashes[side] = Math.max(0, this.flashes[side] - delta);
          if (debug) {
            this.ink.lineStyle(1, colors[side], .9).strokeRect(target.x * scale - radius * scale,
              target.y * scale - radius * scale, radius * scale * 2, radius * scale * 2);
            if (goal) this.ink.lineBetween(target.x * scale, target.y * scale, goal.x * scale, goal.y * scale)
              .strokeCircle(goal.x * scale, goal.y * scale, 4);
            else if (fighter.motion && 'dx' in fighter.motion) this.ink.lineBetween(target.x * scale, target.y * scale,
              target.x * scale + fighter.motion.dx * 20, target.y * scale + fighter.motion.dy * 20);
          }
          return [Math.round(x), Math.round(y)];
        });
        if (debugOutput.current && debug) {
          debugOutput.current.value = JSON.stringify(displayed);
          debugOutput.current.dataset.updates = String(++this.updates);
        }
      }
    }
    const game = new Phaser.Game({type: Phaser.CANVAS, parent: host.current, width: WIDTH * tile, height: HEIGHT * tile,
      scene: Yard, fps: {limit: view.fps}, audio: {noAudio: true}, banner: false});
    return () => game.destroy(true);
  }, [view.fps]);
  return <><div ref={host} className="graybox-board" aria-label="Dust Yard battlefield"/>
    {view.debug && <div>Rendered (Blue, Sand) <output aria-label="Rendered positions" ref={debugOutput} /></div>}</>;
}

const keys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight']);
const actions = new Map<string, duel.Input['kind']>([['KeyC','posture'],['Space','steer'],['KeyF','attack'],['KeyP','precision'],
  ['KeyR','reload'],['KeyE','observe'],['KeyQ','peek'],['KeyX','interact'],['KeyZ','cancel-interaction']]);
const idle = (): Frame => ({state: initial(), events: []});
const storageKey = 'arena-continuous-replay';
function restored(objective: boolean, unified: boolean) {
  try {
    const saved = sessionStorage.getItem(storageKey + (unified ? '.5' : objective ? '.4' : ''));
    return saved ? (unified ? loadModes : objective ? loadDuel : load)(JSON.parse(saved)) : undefined;
  } catch { return undefined; }
}
const reasons: Record<duel.Reason|modes.ScoreReason|modes.EliminationReason,string> = {
  'activation-prevented':'Activation prevented', 'core-disabled':'Core disabled', 'core-completed':'Core completed',
  'elimination':'Elimination', 'mutual-elimination':'Mutual elimination',
  'target-score':'Target score reached','simultaneous-target':'Both reached the target','score-clock':'Higher score at the deadline','equal-score':'Equal scores at the deadline',
  'health-clock':'Health at the deadline',
};
function signal(frame: ViewFrame) {
  return frame.events.map(event => {
    if (event.kind === 'collision') return (event.side ? 'Sand' : 'Blue') + ' · ' + event.with + ' contact';
    if (event.kind === 'attack') return (event.side ? 'Sand' : 'Blue') + ' · ' + event.outcome;
    if (event.kind === 'score') return (event.side ? 'Sand' : 'Blue') + ' scored · ' + event.total;
    if (event.kind === 'respawn') return (event.side ? 'Sand' : 'Blue') + ' respawned';
    if (event.kind === 'objective') {
      return event.action === 'started' || event.action === 'cancelled'
        ? (event.side ? 'Sand' : 'Blue') + ' · interaction ' + event.action : 'Core ' + event.action;
    }
    return '';
  }).filter(Boolean).join(' · ');
}

export function ContinuousSandbox({replayMode, objective = false, unified = false}: {replayMode: boolean; objective?: boolean; unified?: boolean}) {
  const query = new URLSearchParams(location.search);
  const rate = query.get('rate');
  const step = objective ? duel.step : rate === 'baseline' ? rates.baseline : rate === '60hz' ? rates['60hz'] : rates['30hz'];
  const fps = query.get('fps') === '20' ? 20 : query.get('fps') === '60' ? 60 : 0;
  const [activator,setActivator] = useState<0|1>(query.get('role') === 'defender' ? 1 : 0);
  const [mode,setMode] = useState<modes.Config['mode']>(query.get('mode') === 'score-deathmatch' ? 'score-deathmatch'
    : query.get('mode') === 'elimination' ? 'elimination' : 'objective-duel');
  const [variant,setVariant] = useState<modes.Variant>(modes.defaultVariant);
  const [target,setTarget] = useState<typeof modes.targets[number]>(5);
  const [seconds,setSeconds] = useState<typeof modes.clocks[number]>(75);
  const [seed,setSeed] = useState(Number(query.get('seed') ?? 3));
  const safeSeed = Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff ? seed : 3;
  const config = duel.configure(safeSeed,activator);
  const createConfig = () => modes.configure(safeSeed,mode === 'objective-duel' ? {mode,activator,variant} :
    mode === 'score-deathmatch' ? {mode,target,seconds} : {mode});
  const modeConfig = createConfig();
  const opening = (): ViewFrame => unified ? {state:modes.initial(modeConfig),events:[]} : objective ? {state:duel.initial(config),events:[]} : idle();
  const [playback, setPlayback] = useState<Playback | DuelPlayback | ModePlayback | undefined>(() => replayMode
    ? restored(objective,unified) ?? (unified ? modeMatch(modeConfig) : objective ? duelMatch(config) : developmentMatch(12, undefined, step)) : undefined);
  const [frame, setFrame] = useState<ViewFrame>(() => playback?.recording.version === 5
    ? {state:playback.recording.initialState,events:[]} : opening());
  const [running, setRunning] = useState(false);
  const [debug, setDebug] = useState(!objective && !unified);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [latency, setLatency] = useState<number>();
  const [positionLatency, setPositionLatency] = useState<number>();
  const cursor = useRef(0);
  const manual = useRef<Recording | DuelRecording | ModeRecording | undefined>(undefined);
  const [matchSignal,setMatchSignal] = useState('');
  useEffect(() => {
    if (unified && !replayMode) {
      setFrame({state:modes.initial(createConfig()),events:[]});
      manual.current = undefined;
      setFeedback(''); setMatchSignal('');
    }
  },[unified,replayMode,mode,variant,activator,target,seconds,safeSeed]);

  function show(current:ViewFrame) {
    const message = signal(current);
    if (message) setFeedback(message);
    const significant = signal({...current,events:current.events.filter(e=>e.kind === 'score' || e.kind === 'respawn' || e.kind === 'objective')});
    if (significant) setMatchSignal(significant);
  }
  useEffect(() => {
    if (!running || replayMode) return;
    const baseConfig = configure(3, step), start = performance.now(), unifiedConfig = createConfig();
    const duelConfig = duel.configure(safeSeed,activator);
    const transcript: ModeRecording['transcript'] = [], events: ModeRecording['events'] = [];
    const held = new Set<string>();
    const queue: {code: string; down: boolean; time: number}[] = [];
    const unifiedFirst = unified ? modes.initial(unifiedConfig) : undefined;
    const first = unifiedFirst ?? (objective ? duel.initial(duelConfig) : initial());
    const hasCore = 'core' in first;
    let current: ViewFrame = {state:first,events:[]}, facing = {dx: 1, dy: 0}, lastKeyTime: number | undefined;
    const movement = {dx: 0, dy: 0, mode: ''};
    const key = (event: KeyboardEvent, down: boolean) => {
      if (!keys.has(event.code) && (!actions.has(event.code) || (!hasCore && ['KeyX','KeyZ'].includes(event.code)))) return;
      if (event.target instanceof HTMLElement && /^(BUTTON|INPUT|SELECT)$/.test(event.target.tagName) &&
          (event.code === 'Space' || event.code.startsWith('Arrow'))) return;
      event.preventDefault();
      if (!event.repeat && queue.length < 64) queue.push({code: event.code, down, time: performance.now()});
    };
    const onDown = (event: KeyboardEvent) => key(event, true);
    const onUp = (event: KeyboardEvent) => key(event, false);
    const clear = () => {queue.length = 0; queue.push({code: '', down: false, time: performance.now()});};
    const id = window.setInterval(() => {
      const now = performance.now();
      while (!current.state.result) {
        const before = current.state;
        const deadline = unified ? modes.deadline(unifiedConfig,before) : 'core' in before ? before.core.deadline : matchTime;
        const end = start + Math.min(deadline,before.time + (unified ? modes.step : step)) / 3;
        if (now < end) break;
        let pressed: (typeof queue)[number] | undefined;
        while (queue[0]?.time <= end) {
          const next = queue[0];
          if (actions.has(next.code) && next.down && pressed) break;
          queue.shift();
          if (!next.code) held.clear();
          else if (keys.has(next.code)) {
            lastKeyTime = next.time;
            if (next.down) held.add(next.code);
            else held.delete(next.code);
          } else if (next.down) pressed = next;
        }
        const fighter = before.fighters[0];
        const dx = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
        const dy = Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp'));
        if (dx || dy) facing = {dx, dy};
        const mode = held.has('ShiftLeft') || held.has('ShiftRight') ? 'run' : fighter.posture === 'crouch' ? 'crouch' : 'walk';
        const action = pressed && actions.get(pressed.code);
        let input: duel.Input | null = null;
        const accepts = (command: duel.Input) => unified && 'reason' in before ? modes.allows(unifiedConfig,before,0,command)
          : 'core' in before ? duel.allows(duelConfig,before,0,command) : allows(before,0,command as Input);
        if (action === 'steer') input = {kind: 'steer', mode: 'jump', ...facing};
        else if (action === 'posture') input = {kind: 'posture', posture: fighter.posture === 'crouch' ? 'upright' : 'crouch'};
        else if (action === 'attack' || action === 'precision' || action === 'reload' || action === 'observe' || action === 'peek') input = {kind: action};
        else if (hasCore && (action === 'interact' || action === 'cancel-interaction')) input = {kind:action};
        let acceptedAt = pressed?.time;
        if (input && !accepts(input)) {
          if (input.kind === 'interact') setFeedback('Core interaction unavailable');
          input = null;
        }
        if (!input && (dx !== movement.dx || dy !== movement.dy || mode !== movement.mode)) {
          const desired: Input | null = dx || dy ? {kind: 'steer', mode, dx, dy} : fighter.motion ? {kind: 'stop'} : null;
          if (!desired || accepts(desired)) {
            input = desired;
            acceptedAt = lastKeyTime;
            Object.assign(movement, {dx, dy, mode});
          }
        }
        if (input?.kind === 'steer' && input.mode === 'jump') movement.mode = '';
        const inputs: duel.Inputs = [input,unified && 'reason' in before ? modePolicy(unifiedConfig,before,1,'roam') :
          'core' in before ? duelPolicy(duelConfig,before,1,'roam') : policy(baseConfig,before,1,'roam')];
        current = unified && 'reason' in before ? modes.advance(unifiedConfig,before,inputs)
          : 'core' in before ? duel.advance(duelConfig,before,inputs) : advance(baseConfig,before,inputs as Inputs);
        if (!fighter.hp && current.state.fighters[0].hp) movement.mode = '';
        if (inputs[0] || inputs[1]) transcript.push([current.state.tick, inputs]);
        if (current.events.length) events.push([current.state.tick, current.events]);
        show(current);
        if (input && acceptedAt !== undefined) {
          const ms = Math.round(performance.now() - acceptedAt);
          setLatency(ms);
          if (input.kind === 'steer' && fighter.position !== current.state.fighters[0].position) setPositionLatency(ms);
        }
        setFrame(current);
      }
      if (current.state.result) {
        manual.current = unifiedFirst && 'reason' in current.state
          ? {version:5,config:unifiedConfig,source:'manual-sandbox',initialState:unifiedFirst,transcript,events,final:current.state}
          : 'core' in current.state
          ? {version:4, config:duelConfig, source:'manual-sandbox', initialState:first as duel.State, transcript, events:events as DuelRecording['events'], final:current.state}
          : {version:3, config:baseConfig, source:'manual-sandbox', transcript:transcript as Recording['transcript'],
            events:events as Recording['events'], final:current.state};
        setRunning(false);
      }
    }, 5);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
    };
  }, [replayMode, running, step, objective, safeSeed, activator, unified, mode, variant, target, seconds]);

  useEffect(() => {
    if (!running || !playback) return;
    const start = performance.now(), startTime = frame.state.time;
    const timer = window.setInterval(() => {
      const time = (performance.now() - start) * 3 + startTime;
      let next: ViewFrame | undefined;
      while (cursor.current < playback.frames.length && playback.frames[cursor.current].state.time <= time) {
        next = playback.frames[cursor.current++];
        show(next);
      }
      if (next) setFrame(next);
      if (cursor.current >= playback.frames.length) setRunning(false);
    }, 5);
    return () => clearInterval(timer);
  // The clock anchor is reset only when playback is started or resumed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, playback]);

  const seek = (tick: number) => {
    cursor.current = tick;
    const start = playback && 'initialState' in playback.recording ? {state:playback.recording.initialState,events:[]} : opening();
    setFrame(playback?.frames[tick - 1] ?? start);
    setFeedback('');
    setMatchSignal('');
  };
  const open = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw Error();
      const data = (unified ? loadModes : objective ? loadDuel : load)(JSON.parse(await file.text()));
      setRunning(false); cursor.current = 0; setFeedback(''); setMatchSignal(''); setPlayback(data); setError('');
      setFrame('initialState' in data.recording ? {state:data.recording.initialState,events:[]} : idle());
      try { sessionStorage.setItem(storageKey + (unified ? '.5' : objective ? '.4' : ''), JSON.stringify(data.recording)); } catch { /* The replay can still play. */ }
    } catch { setError('Could not load that continuous replay.'); }
  };
  const save = () => {
    const recording = playback?.recording ?? manual.current;
    if (!recording) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(recording)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url; link.download = unified ? 'dust-yard-v25.json' : objective ? 'objective-duel-v24.json' : 'dust-yard-v23.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const {state} = frame;
  const duelView = playback?.recording.version === 4 ? playback.recording.config : config;
  const modeView = playback?.recording.version === 5 ? playback.recording.config : modeConfig;
  const coreConfig = unified && modeView.mode === 'objective-duel' ? modeView : duelView;
  const core = 'core' in state ? state.core : undefined;
  const score = 'score' in state && modeView.mode === 'score-deathmatch' ? state : undefined;
  const reason = 'reason' in state ? state.reason : null;
  const manualUrl = unified ? '/?arena-modes&mode='+modeView.mode : objective ? '/?arena-objective' : '/?arena-continuous';
  const replayUrl = unified ? '/?gameplay-v25&mode='+modeView.mode : objective ? '/?gameplay-v24' : '/?gameplay-v23';
  const interactive = objective || unified && modeView.mode === 'objective-duel';
  const channel = 'channel' in coreConfig.objective ? coreConfig.objective.channel
    : core?.phase === 'active' ? coreConfig.objective.disable : coreConfig.objective.activate;
  return <main className="graybox continuous">
    <div className="graybox-title"><a href={replayMode ? manualUrl : replayUrl}>
      {replayMode ? 'Manual sandbox' : 'Autonomous replay'}</a><span>{unified ? 'V2.5' : objective ? 'V2.4' : 'V2.3'} · Local development · Unverified</span></div>
    <h1>{interactive ? 'Objective Duel' : unified ? modeView.mode === 'score-deathmatch' ? 'Score Deathmatch' : 'Legacy Elimination'
      : replayMode ? 'Dust Yard replay' : 'Dust Yard sandbox'}</h1>
    <p>{replayMode ? (playback?.recording.source === 'manual-sandbox' ? 'Recorded manual sandbox'
      : playback?.recording.source === 'gemini' ? 'Imported replay with Gemini source label' : 'Deterministic development policies')
      : 'WASD or arrows move · Shift run · C crouch · Space jump · F attack · P precision · R reload · E observe · Q peek' +
        (interactive ? ' · X use Core · Z cancel' : '')}</p>
    {unified && !replayMode && <div className="graybox-controls">
      <label>Mode <select disabled={running} value={mode} onChange={e=>setMode(e.target.value as modes.Config['mode'])}>
        <option value="elimination">Legacy Elimination</option><option value="score-deathmatch">Score Deathmatch</option>
        <option value="objective-duel">Objective Duel</option></select></label>
      {mode === 'objective-duel' && <label>Core timing <select disabled={running} value={variant} onChange={e=>setVariant(e.target.value as modes.Variant)}>
        {Object.keys(modes.variants).map(name=><option key={name} value={name}>{name.replaceAll('-',' ')}</option>)}</select></label>}
      {mode === 'score-deathmatch' && <>
        <label>Target <select disabled={running} value={target} onChange={e=>setTarget(Number(e.target.value) as typeof target)}>
          {modes.targets.map(n=><option key={n}>{n}</option>)}</select></label>
        <label>Match time <select disabled={running} value={seconds} onChange={e=>setSeconds(Number(e.target.value) as typeof seconds)}>
          {modes.clocks.map(n=><option key={n} value={n}>{n} s</option>)}</select></label></>}
      <label>Seed <input type="number" min={0} max={0xffffffff} defaultValue={safeSeed} disabled={running}
        onBlur={e=>{const value=e.target.valueAsNumber;
          if (Number.isInteger(value) && value >= 0 && value <= 0xffffffff) setSeed(value);
          else e.target.value=String(safeSeed);}}/></label>
    </div>}
    {core && <p className="core-hud"><strong>Arena Core · {core.phase}</strong>
      <span>{state.result ? 'Round over' : ((core.deadline-state.time)/3000).toFixed(1) + ' s left'}</span>
      {core.interaction && <progress aria-label="Core interaction progress" max={channel} value={state.time-core.interaction.started}/>}</p>}
    {unified && core && !('channel' in coreConfig.objective) && <p>{coreConfig.objective.pending/3000} s pending · {coreConfig.objective.active/3000} s active
      {' · '}{coreConfig.objective.activate/3000} s activate · {coreConfig.objective.disable/3000} s disable</p>}
    {score && modeView.mode === 'score-deathmatch' && <p className="core-hud"><strong>First to {modeView.target}</strong>
      <span>{state.result ? 'Match over' : ((modeView.limit-state.time)/3000).toFixed(1)+' s left'}</span></p>}
    {unified && modeView.mode === 'elimination' && <p className="core-hud"><strong>Single life</strong>
      <span>{state.result ? 'Match over' : ((matchTime-state.time)/3000).toFixed(1)+' s left'}</span></p>}
    <div className="graybox-score">{state.fighters.map((fighter, side) => <div key={side}>
      <strong>{side ? 'Sand' : 'Blue'}{interactive ? ' · ' + duel.role(coreConfig,side === 0 ? 0 : 1) : ''}
        {score ? ' · '+score.score[side] : ''}</strong>
      <meter aria-label={side ? 'Sand health' : 'Blue health'} min={0} max={100} value={fighter.hp}/>
      <span>{fighter.hp} HP · {fighter.ammo}/4 ammo</span>
      <small>{score && !fighter.hp ? score.respawnAt[side] !== null
        ? 'Respawn in '+Math.max(0,(score.respawnAt[side]-state.time)/3000).toFixed(1)+' s' : 'Defeated'
        : [fighter.motion?.mode ?? fighter.posture, fighter.firing?.kind, fighter.reloadDue && 'reload', fighter.survey?.kind].filter(Boolean).join(' · ')}</small>
    </div>)}</div>
    <Board frame={frame} running={running} debug={debug} fps={fps} step={playback?.recording.config.step ?? step}
      objective={interactive ? coreConfig.objective : undefined}/>
    <div className="graybox-status"><strong>{(state.time / 3000).toFixed(3)} s · Tick {state.tick}</strong>
      <span>{state.result ? (state.result === 'draw' ? 'Draw' : state.result === 'blue' ? 'Blue wins' : 'Sand wins') +
        (reason ? ' · ' + reasons[reason] : '') : unified && matchSignal || feedback}</span></div>
    <div className="graybox-controls">
      <button className="primary" disabled={!replayMode && running} onClick={() => {
        if (!replayMode || state.result) {seek(0); manual.current = undefined; setLatency(undefined); setPositionLatency(undefined);}
        setRunning(!running);
      }}>{replayMode ? running ? 'Pause' : state.result ? 'Watch again' : state.tick ? 'Resume' : 'Play replay' : state.result ? 'Start again' : 'Start sandbox'}</button>
      {playback && <button disabled={!!state.result} onClick={() => {seek(playback.frames.length); setRunning(false);}}>Skip to result</button>}
      {(objective || unified) && !replayMode && <><button onClick={() => {setRunning(false);seek(0);manual.current=undefined;}}>Reset</button>
        {interactive && <label>Blue role <select disabled={running} value={activator} onChange={event => setActivator(event.target.value === '1' ? 1 : 0)}>
          <option value={0}>Activator</option><option value={1}>Defender</option></select></label>}</>}
      <button disabled={!playback && !state.result} onClick={save}>Save replay</button>
      <label><input type="checkbox" checked={debug} onChange={event => setDebug(event.target.checked)}/> State overlay</label>
    </div>
    {replayMode && <label>Load replay <input type="file" accept=".json,application/json" onChange={event => void open(event.target.files?.[0])}/></label>}
    {error && <p role="alert">{error}</p>}
    {debug && <><p className="continuous-key">Dots and lines show navigation. Coral outlines show terrain clearance.
      Square outlines mark authoritative positions. Filled circles show rendered positions.</p>
      <pre>{JSON.stringify({state, blue: unified && 'reason' in state ? modes.observation(modeView,state,0) : 'core' in state ? duel.observation(duelView,state,0) : observation(state, 0), destinations: state.fighters.map(destination),
        lastInputMs: latency, firstPositionUpdateMs: positionLatency, events: frame.events}, null, 2)}</pre></>}
  </main>;
}
