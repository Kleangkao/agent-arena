import {useEffect, useRef, useState} from 'react';
import Phaser from 'phaser';
import {developmentMatch, realtimePolicy} from './development';
import {advance, configure, initial, legal, observation, randomnessFor, realtime, realtimeRules, revision, rules, sides, stepMsFor, ticksFor, type GameEvent, type Intents, type State} from './game';
import {validate, type Frame, type Replay} from './replay';
import {dueTick, facingFor, oneShot, sandboxIntent, sandboxKeys} from './sandbox-input';
import {crates, HEIGHT, MAP_VERSION, neighbors, point, walkable, walls, WIDTH} from './yard';
import './graybox.css';

const names = ['Blue', 'Sand'];
const colors = [0x67b5f0, 0xeac278];
const tile = 60;
const storageKey = 'arena-v2-replay';
const center = (cell: number) => {
  const {x, y} = point(cell);
  return {x: (x + .5) * tile, y: (y + .5) * tile};
};
type BoardView = {state: State; events: GameEvent[]; debug: boolean; duration: number; paused: boolean; snap: boolean; continuous?: boolean};

function Board(view: BoardView) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(view);
  latest.current = view;
  useEffect(() => {
    if (!host.current) return;
    class Yard extends Phaser.Scene {
      ink!: Phaser.GameObjects.Graphics;
      grid!: Phaser.GameObjects.Graphics;
      rendered?: State;
      elapsed = 0;
      travel: Array<{from: number; to: number; mode: string; elapsed: number} | undefined> = [];

      create() {
        for (let cell = 0; cell < WIDTH * HEIGHT; cell++) {
          const {x, y} = center(cell);
          const color = walls.includes(cell) ? 0x41332c : crates.includes(cell) ? 0x8a5535 : cell % 2 ? 0x695747 : 0x635143;
          this.add.rectangle(x, y, tile - 1, tile - 1, color);
          if (!walkable(cell)) {
            this.add.rectangle(x, y, tile - 13, tile - 13).setStrokeStyle(2, 0xca9360, .65);
            this.add.text(x, y, walls.includes(cell) ? 'WALL' : 'CRATE', {
              fontFamily: 'Arial', fontSize: '11px', color: '#f0cfab',
            }).setOrigin(.5);
          }
        }
        this.grid = this.add.graphics().setVisible(false);
        this.grid.lineStyle(1, 0xdac4ae, .35);
        for (let cell = 0; cell < WIDTH * HEIGHT; cell++) {
          if (!walkable(cell)) continue;
          const a = center(cell);
          for (const next of neighbors(cell).filter(next => next > cell)) {
            const b = center(next);
            this.grid.lineBetween(a.x, a.y, b.x, b.y);
          }
          this.add.text(a.x - 15, a.y - 18, String(cell), {fontSize: '13px', color: '#fff0d9'}).setVisible(false).setName('coordinate');
        }
        this.ink = this.add.graphics();
      }

      update(_time: number, delta: number) {
        const {state, events, debug, duration, paused, snap, continuous} = latest.current;
        if (this.rendered !== state) {
          if (snap || !this.rendered || state.tick !== this.rendered.tick + 1) this.travel = [];
          if (continuous && !snap) for (const event of events) {
            if (event.kind === 'move') this.travel[event.side] = {...event, elapsed: 0};
          }
          this.rendered = state;
          this.elapsed = 0;
        }
        if (!paused) this.elapsed += delta;
        const t = snap ? 1 : Math.min(1, this.elapsed / Math.min(320, duration));
        this.grid.setVisible(debug);
        for (const child of this.children.getChildren()) {
          if (child.name === 'coordinate') (child as Phaser.GameObjects.Text).setVisible(debug);
        }
        this.ink.clear();
        for (const side of sides) {
          const fighter = state.fighters[side];
          const move = events.find(event => event.kind === 'move' && event.side === side);
          const moved = move?.kind === 'move';
          const travel = continuous && !snap ? this.travel[side] : undefined;
          if (travel && !paused) travel.elapsed += delta;
          const progress = travel ? Math.min(1, travel.elapsed / (2 * duration)) : t;
          const to = center(fighter.cell), from = center(travel?.from ?? (moved ? move.from : fighter.cell));
          const x = Phaser.Math.Linear(from.x, to.x, progress), y = Phaser.Math.Linear(from.y, to.y, progress);
          const jump = (travel?.mode ?? (moved ? move.mode : '')) === 'jump' ? Math.sin(progress * Math.PI) * 12 : 0;
          const radius = fighter.posture === 'crouch' ? 12 : 16;
          this.ink.fillStyle(0x211a17, .55).fillEllipse(x, y + 12, 36, 13);
          this.ink.fillStyle(colors[side], fighter.hp ? 1 : .32).fillCircle(x, y - jump, radius);
          this.ink.lineStyle(2, 0x201815).strokeCircle(x, y - jump, radius);
          if (activity(fighter)) this.ink.lineStyle(2, colors[side], .58).strokeCircle(x, y, 22);
          if (t < 1 && events.some(event => event.kind === 'attack' && event.side !== side && event.damage > 0)) {
            this.ink.lineStyle(3, 0xf8ebd6, 1 - t).strokeCircle(x, y - jump, 20);
          }
          const attack = events.find(event => event.kind === 'attack' && event.side === side);
          if (t < 1 && attack?.kind === 'attack') {
            this.ink.lineStyle(2, attack.damage ? 0xfcdfa1 : colors[side], 1 - t).strokeCircle(x, y - jump, 18 + t * 13);
          }
        }
      }
    }
    const game = new Phaser.Game({type: Phaser.CANVAS, parent: host.current, width: WIDTH * tile,
      height: HEIGHT * tile, scene: Yard, audio: {noAudio: true}, banner: false});
    return () => game.destroy(true);
  }, []);
  return <div ref={host} className="graybox-board" aria-label="Dust Yard battlefield" />;
}

function label(event: GameEvent) {
  const who = names[event.side];
  if (event.kind === 'attack') return who + (event.outcome === 'miss' ? ' missed'
    : event.outcome === 'precision' ? ' · HEADSHOT · −' + event.damage : ' hit · −' + event.damage);
  if (event.kind === 'contact') return who + (event.visibility === 'visible' ? ' spotted a rival' : ' lost sight');
  if (event.kind === 'collision') return who + ' stopped at an occupied tile';
  if (event.kind === 'interrupt') return who + (event.reason === 'stop' ? ' stopped' : ' changed route');
  if (event.kind === 'defeat') return who + ' defeated';
  if (event.kind === 'complete' && event.action === 'reload') return who + ' reloaded';
  if (event.kind === 'move') return who + ' · ' + event.mode;
  if (event.kind === 'start' && ['peek', 'observe', 'reload', 'attack', 'precision'].includes(event.intent.kind)) return who + ' · ' +
    (event.intent.kind === 'precision' ? 'precision attempt' : event.intent.kind);
  return null;
}

function activity(fighter: State['fighters'][number]) {
  const mode = fighter.active?.kind === 'move' ? fighter.active.mode : fighter.active?.kind;
  return [fighter.motion?.mode ?? mode, fighter.reloadDue && 'reload', fighter.firing?.kind ?? (fighter.shotDue && 'standard shot'),
    fighter.survey?.kind].filter(Boolean).join(' · ');
}

function Score({state}: {state: State}) {
  return <div className="graybox-score">{sides.map(side => {
    const fighter = state.fighters[side];
    return <div key={side} className={side === 0 ? 'graybox-blue' : 'graybox-sand'}>
      <strong>{names[side]}</strong>
      <meter aria-label={names[side] + ' health'} min={0} max={rules.hp} value={fighter.hp} />
      <span>{fighter.hp} HP · {fighter.ammo}/{rules.ammo} ammo</span>
      <small data-testid={names[side] + ' activity'}>{activity(fighter) || (fighter.hp === 0 ? 'Defeated' : '—')}</small>
    </div>;
  })}</div>;
}

function restore(latest: boolean) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey + (latest ? '.2' : '')) ?? 'null');
    if (saved) {
      const replay = validate(saved.replay);
      if (Number.isInteger(saved.tick) && saved.tick >= 0 && saved.tick <= replay.timeline.length) {
        return {replay, tick: saved.tick as number};
      }
    }
  } catch { /* An unavailable or invalid local replay can be reopened from its original file. */ }
  return {replay: validate(developmentMatch(3, undefined, latest ? realtime : revision)), tick: 0};
}

export function Graybox({latest = false}: {latest?: boolean}) {
  const [recovered] = useState(() => restore(latest));
  const [replay, setReplay] = useState(recovered.replay);
  const [tick, setTick] = useState(recovered.tick);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [debug, setDebug] = useState(false);
  const [error, setError] = useState('');
  const continuous = replay.config.rulesVersion === realtime;
  const duration = stepMsFor(replay.config.rulesVersion) / speed;
  const frame = replay.timeline[tick - 1];
  const state = frame?.state ?? replay.initialState;
  const finished = tick === replay.timeline.length;
  const feedback = replay.timeline.slice(Math.max(0, tick - (continuous ? 10 : 3)), tick).reverse()
    .map(item => item.events.map(label).filter(Boolean)).find(labels => labels.length);
  const ending = state.fighters.some(fighter => fighter.hp === 0) ? 'Defeat' : 'Time limit';
  useEffect(() => {
    if (!playing || finished) return;
    const timer = setTimeout(() => setTick(current => current + 1), duration);
    return () => clearTimeout(timer);
  }, [playing, tick, finished, duration]);
  useEffect(() => {
    if (playing && !finished) return;
    try { sessionStorage.setItem(storageKey + (latest ? '.2' : ''), JSON.stringify({replay, tick})); } catch { /* Playback still works. */ }
  }, [replay, tick, playing, finished, latest]);
  const open = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw Error('Replay file is too large');
      setReplay(validate(JSON.parse(await file.text())));
      setTick(0); setPlaying(false); setError('');
    } catch { setError('Could not load this V2 replay.'); }
  };
  return <main className="graybox">
    <div className="graybox-title"><a href="/">Agent Arena</a><span>{continuous ? 'Gameplay V2.2' : replay.config.rulesVersion === revision ? 'Gameplay V2.1' : 'Gameplay V2'} · Unverified</span></div>
    <h1>Dust Yard</h1>
    <p>{replay.source === 'development-policy' ? 'Development Test Policies · No Gemini inference'
      : replay.source === 'manual-sandbox' ? 'Recorded manual sandbox' : 'Imported replay · AI provenance unconfirmed'}</p>
    <Score state={state}/>
    <Board state={state} debug={debug} events={frame?.events ?? []} duration={duration}
      paused={!playing && !finished} snap={!playing && (finished || continuous)} continuous={continuous} />
    <div className="graybox-status">
      <strong>Tick {tick} / {ticksFor(replay.config.rulesVersion)}</strong>
      <span>
        {state.result && <><strong>{state.result === 'draw' ? 'Draw' : state.result === 'blue' ? 'Blue wins' : 'Sand wins'}</strong><small> · {ending}</small><br /></>}
        {feedback?.join(' · ') || '—'}
      </span>
    </div>
    <div className="graybox-controls">
      <button className="primary" onClick={() => {
        if (finished) setTick(0);
        setPlaying(!playing || finished);
      }}>{finished ? 'Watch again' : playing ? 'Pause' : tick ? 'Resume' : 'Play replay'}</button>
      <button disabled={finished} onClick={() => {setPlaying(false); setTick(tick + 1);}}>Step</button>
      <button disabled={finished} onClick={() => {setPlaying(false); setTick(replay.timeline.length);}}>Skip to result</button>
      <label>Speed <select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
        <option value={1}>1×</option><option value={2}>2×</option><option value={.5}>0.5×</option>
      </select></label>
    </div>
    <details>
      <summary>Replay tools</summary>
      <label><input type="checkbox" checked={debug} onChange={event => setDebug(event.target.checked)} /> Logical map</label>
      <label> Load replay <input type="file" accept=".json,application/json" onChange={event => void open(event.target.files?.[0])} /></label>
      {error && <p role="alert">{error}</p>}
      {debug && <pre>{JSON.stringify({map: MAP_VERSION, rules: replay.config.rulesVersion, seed: replay.config.seed,
        agents: sides.map(side => ({...observation(state, side, replay.config.rulesVersion), active: state.fighters[side].active})), events: frame?.events}, null, 2)}</pre>}
    </details>
    {latest && <a className="graybox-link" href="/?arena-sandbox">Manual input sandbox</a>}
  </main>;
}

const sandboxConfig = configure(3, realtime);
export function Sandbox() {
  const [state, setState] = useState(initial);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [debug, setDebug] = useState(false);
  const [latency, setLatency] = useState<number>();
  const timeline = useRef<Frame[]>([]);
  useEffect(() => {
    if (!running) return;
    let current = initial(), facing = 1;
    const started = performance.now(), held = new Set<string>();
    const queued: Array<{code: string; ms: number}> = [];
    const transitions: Array<{code: string; down: boolean; ms: number}> = [];
    const down = (event: KeyboardEvent) => {
      if (!sandboxKeys.has(event.code)) return;
      event.preventDefault();
      if (event.repeat) return;
      const ms = performance.now();
      transitions.push({code: event.code, down: true, ms});
      if (oneShot(event.code) && queued.length < 4) queued.push({code: event.code, ms});
    };
    const up = (event: KeyboardEvent) => {
      if (sandboxKeys.has(event.code)) transitions.push({code: event.code, down: false, ms: performance.now()});
    };
    const clear = () => {transitions.push({code: '', down: false, ms: performance.now()}); queued.length = 0;};
    const timer = window.setInterval(() => {
      const target = dueTick(performance.now() - started);
      const batch: GameEvent[] = [];
      const prior = current;
      while (!current.result && current.tick < target) {
        const quantumEnd = started + (current.tick + 1) * realtimeRules.stepMs;
        while (transitions[0]?.ms <= quantumEnd) {
          const key = transitions.shift()!;
          if (key.down) {
            held.add(key.code);
            facing = facingFor(held, facing);
          } else if (key.code) held.delete(key.code);
          else held.clear();
        }
        const input = queued[0]?.ms <= quantumEnd ? queued.shift() : undefined;
        const manual = sandboxIntent(current, held, input?.code, facing);
        const intents: Intents = [manual, realtimePolicy(current, 1, 'roam', sandboxConfig.seed)];
        const frame = advance(sandboxConfig, current, intents);
        timeline.current.push({intents, ...frame});
        current = frame.state;
        batch.push(...frame.events);
        if (input && manual) setLatency(Math.round(performance.now() - input.ms));
      }
      if (current !== prior) { setState(current); setEvents(batch); }
      if (current.result) setRunning(false);
    }, 12);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, [running]);
  const start = () => {
    timeline.current = [];
    setState(initial()); setEvents([]); setLatency(undefined); setRunning(true);
  };
  const save = () => {
    if (!state.result) return;
    const replay: Replay = {version: 2, config: sandboxConfig, randomness: randomnessFor(realtime),
      source: 'manual-sandbox', initialState: initial(), timeline: timeline.current, result: state.result};
    const url = URL.createObjectURL(new Blob([JSON.stringify(replay)], {type: 'application/json'}));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'sandbox-v22.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const recent = timeline.current.slice(-10).reverse().map(frame => frame.events.map(label).filter(Boolean)).find(items => items.length);
  return <main className="graybox">
    <div className="graybox-title"><a href="/?gameplay-v22">Autonomous replay</a><span>V2.2 · Development · Unverified</span></div>
    <h1>Manual sandbox</h1>
    <p>WASD move · Shift run · C crouch · Space jump · F attack · P precision · R reload · E observe · Q peek</p>
    <Score state={state}/>
    <Board state={state} events={events} debug={debug} continuous duration={realtimeRules.stepMs} paused={!running} snap={!running}/>
    <div className="graybox-status">
      <strong>Tick {state.tick} / {realtimeRules.ticks}</strong>
      <span>{state.result ? (state.result === 'draw' ? 'Draw' : state.result === 'blue' ? 'Blue wins' : 'Sand wins') : recent?.join(' · ')}</span>
    </div>
    <div className="graybox-controls">
      <button className="primary" onClick={start} disabled={running}>{state.result ? 'Start again' : 'Start sandbox'}</button>
      <button onClick={save} disabled={!state.result}>Save replay</button>
      <label><input type="checkbox" checked={debug} onChange={event => setDebug(event.target.checked)} /> State overlay</label>
    </div>
    {debug && <pre>{JSON.stringify({lastAcceptedActionMs: latency, state, events,
      blueActions: [...new Set(legal(state, 0, realtime).map(intent => intent.kind))]}, null, 2)}</pre>}
  </main>;
}
