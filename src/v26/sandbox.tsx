import {useEffect,useRef,useState} from 'react';
import Phaser from 'phaser';
import {HEIGHT,WIDTH,walkable} from '../v2/yard.js';
import {center,solid,unit} from '../v23/space.js';
import {configure,second,type Config,type Mode} from './config.js';
import {deadline,observation,type Event,type Frame,type Inputs,type State} from './game.js';
import {append,begin,load,type Recording} from './replay.js';
import {developmentController} from './development.js';
import {actionKeys,collisionOpponent,collisionStart,manualPacket,walkKeys} from './playtest.js';
import '../v23/continuous.css';

type Controller=ReturnType<typeof developmentController>;
type Trace={tick:number;observations:ReturnType<typeof observation>[];plans:(ReturnType<Controller['diagnostics']> | null)[];
  inputs:Inputs;receipts:Frame['receipts'];state:State;events:Event[]};
const controllerLabel={
  'manual-sandbox':'Blue manual · Sand scripted steady',
  'development-policy':'Blue scripted mobile · Sand scripted steady',
  'injected-provider':'Injected provider fixture',
  'operator-attested-gemini':'Operator-attested Gemini recording',
};
function saveJson(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const colors=[0x6eb7ed,0xefc580];
const tile=68, scale=tile/unit;
type Board={state:State;config:Config;queue:{current:Event[]};debug:boolean};
function Yard({state,config,queue,debug}:Board) {
  const host=useRef<HTMLDivElement>(null), view=useRef({state,config,queue,debug});
  view.current={state,config,queue,debug};
  useEffect(()=>{
    class Scene extends Phaser.Scene {
      ink!:Phaser.GameObjects.Graphics;
      drained=0;
      attacks=0;
      drainVersion=queue.current;
      flashes:{at:number;event:Extract<Event,{kind:'attack'}>}[]=[];
      create() {
        for(let cell=0;cell<WIDTH*HEIGHT;cell++) {
          const {x,y}=center(cell);
          this.add.rectangle(x*scale,y*scale,tile,tile,walkable(cell)?cell%2?0x6e5c4c:0x635346:0x312720);
        }
        this.ink=this.add.graphics();
      }
      update(time:number) {
        const {state,config,queue,debug}=view.current;
        const ink=this.ink.clear();
        if(this.drainVersion!==queue.current) {this.drainVersion=queue.current;this.drained=0;this.attacks=0;this.flashes=[];}
        const batch=queue.current.splice(0);
        for(const event of batch) if(event.kind==='attack') {this.flashes.push({at:time,event});this.attacks++;}
        this.drained+=batch.length;
        if(host.current) {
          host.current.dataset.events=String(this.drained);
          host.current.dataset.attacks=String(this.attacks);
        }
        this.flashes=this.flashes.filter(f=>time-f.at<220);
        if(state.core) {
          const {position,radius}=config.core;
          ink.lineStyle(2,state.core.phase==='active'?0xffb762:0xbbaa88,1).strokeCircle(position.x*scale,position.y*scale,radius*scale);
        }
        if(debug) for(const box of solid) ink.lineStyle(1,0xe89470,0.7).strokeRect(box.left*scale,box.top*scale,(box.right-box.left)*scale,(box.bottom-box.top)*scale);
        state.fighters.forEach((f,side)=>{
          const x=f.position.x*scale,y=f.position.y*scale;
          ink.fillStyle(0x292119,.65).fillEllipse(x,y+5,23,9);
          ink.fillStyle(colors[side],f.hp?1:.25).fillCircle(x,y-(f.airUntil?12:0),f.posture==='crouch'?7:10);
          if(f.hp) ink.lineStyle(2,0xf5e8cb,1).lineBetween(x,y,x+Math.sign(f.facing.x)*11,y+Math.sign(f.facing.y)*11);
          if(f.reloadDue!==undefined) {
            const progress=Phaser.Math.Clamp(1-(f.reloadDue-state.time)/config.equipment.reloadTime,0,1);
            ink.fillStyle(0x292119).fillRect(x-12,y+13,24,4);
            ink.fillStyle(colors[side]).fillRect(x-12,y+13,24*progress,4);
          }
          const r=config.geometry.radius*scale;
          if(debug) ink.lineStyle(1,colors[side],.7).strokeRect(x-r,y-r,2*r,2*r);
        });
        for(const {at,event} of this.flashes) ink.lineStyle(2,colors[event.side],1-(time-at)/220)
          .lineBetween(event.from.x*scale,event.from.y*scale,event.to.x*scale,event.to.y*scale);
      }
    }
    const game=new Phaser.Game({type:Phaser.CANVAS,parent:host.current!,width:WIDTH*tile,height:HEIGHT*tile,scene:Scene,audio:{noAudio:true},banner:false});
    return ()=>game.destroy(true);
  },[]);
  return <div ref={host} className="graybox-board" aria-label="Dust Yard V2.6 battlefield"/>;
}
export function Sandbox26(){
  const collision=new URLSearchParams(location.search).has('collision-fixture');
  const [mode,setMode]=useState<Mode>('objective-duel');
  const [current,setCurrent]=useState(()=>begin(configure(12,'objective-duel'),'manual-sandbox'));
  const [state,setState]=useState(current.initialState);
  const queue=useRef<Event[]>([]);
  const [ledger,setLedger]=useState<Event[]>([]);
  const [running,setRunning]=useState(false), [debug,setDebug]=useState(false), [error,setError]=useState('');
  const session=useRef<{r:Recording;frames?:ReturnType<typeof load>['frames'];index:number;auto:boolean;started:number;
    collision:boolean;last?:{inputs:Inputs;receipts:Frame['receipts']};trace:Trace[];
    blue:Controller;sand:Controller}|null>(null);
  const traceEnabled=useRef(false);
  traceEnabled.current=debug;
  const held=useRef(new Set<string>()), pending=useRef(new Set<string>());
  const publish=(next:State,batch:Event[])=>{
    setState(next);
    queue.current.push(...batch);
    if(batch.length) setLedger(prev=>[...prev,...batch].slice(-20));
  };
  const open=(r:Recording,auto:boolean,frames?:ReturnType<typeof load>['frames'],collision=false)=>{
    held.current.clear();pending.current.clear();queue.current=[];setError('');
    if(collision) r.initialState.fighters.forEach((f,i)=>{f.position=collisionStart[i];});
    session.current={r,frames,index:0,auto,collision,trace:[],started:performance.now(),
      blue:developmentController(r.config,0,'mobile',23),sand:developmentController(r.config,1,'steady',23)};
    setCurrent(r);setLedger([]);publish(r.initialState,[]);setRunning(true);
  };
  useEffect(()=>{
    if(!running) return;
    const s=session.current!;
    const key=(e:KeyboardEvent)=> {
      if(s.auto||s.frames||!walkKeys.has(e.code)&&!actionKeys.has(e.code)) return;
      if(e.code==='Space'&&e.target instanceof HTMLButtonElement&&e.type==='keydown') return;
      e.preventDefault();
      if(e.type==='keyup') held.current.delete(e.code);
      else if(!e.repeat&&actionKeys.has(e.code)) pending.current.add(e.code);
      else if(walkKeys.has(e.code)) held.current.add(e.code);
    };
    const blur=()=>{held.current.clear();pending.current.clear();};
    const id=window.setInterval(()=>{
      const time=(performance.now()-s.started)*second/1000;
      let latest:State|undefined;
      const batch:Event[]=[];
      if(s.frames) {
        while(s.frames[s.index]&&s.frames[s.index].state.time<=time) {
          const frame=s.frames[s.index++];latest=frame.state;batch.push(...frame.events);
        }
        if(s.index===s.frames.length) setRunning(false);
      } else {
        while(!s.r.final.result&&Math.min(deadline(s.r.config,s.r.final),s.r.final.time+s.r.config.step)<=time) {
          const prior=s.r.final, config=s.r.config;
          const blue=observation(config,prior,0),sand=observation(config,prior,1);
          const inputs:Inputs=[s.auto?s.blue(blue):manualPacket(blue,held.current,pending.current),
            s.collision?collisionOpponent(prior):s.sand(sand)];
          pending.current.clear();
          const frame=append(s.r,inputs);
          s.last={inputs,receipts:frame.receipts};
          if(traceEnabled.current) {
            s.trace.push({tick:frame.state.tick,observations:[blue,sand],
              plans:[s.auto?s.blue.diagnostics():null,s.collision?null:s.sand.diagnostics()],
              inputs,receipts:frame.receipts,state:frame.state,events:frame.events});
            if(s.trace.length>450) s.trace.shift();
          }
          latest=frame.state;batch.push(...frame.events);
        }
        if(s.r.final.result) setRunning(false);
      }
      if(latest) publish(latest,batch);
    },8);
    window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur);
    return ()=>{window.clearInterval(id);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur);};
  },[running]);
  const save=()=>{
    const r=session.current?.r;
    if(session.current?.collision||!r?.final.result&&!r?.interruption) return;
    saveJson(r,'dust-yard-v26.json');
  };
  const s=session.current;
  const label=s?.collision?'Blue manual · Sand scripted collision fixture':controllerLabel[current.source];
  return <main className="graybox continuous">
    <p>V2.6 · Local development · Unverified</p>
    <h1>Dust Yard</h1>
    <label>Mode <select value={mode} disabled={running} onChange={e=>setMode(e.target.value as Mode)}>
      <option value="objective-duel">Objective Duel</option><option value="score-deathmatch">Score Deathmatch</option><option value="elimination">Elimination</option>
    </select></label>
    <div className="graybox-actions">
      <button disabled={running} onClick={e=>{e.currentTarget.blur();open(begin(configure(12,mode),'manual-sandbox'),false,undefined,collision);}}>Start sandbox</button>
      <button disabled={running} onClick={()=>open(begin(configure(12,mode),'development-policy'),true)}>Watch development match</button>
      <button disabled={running||!!session.current?.collision||(!current.final.result&&!current.interruption)} onClick={save}>Save replay</button>
    </div>
    <p>{current.source} · Tick {state.tick} · {(state.time/second).toFixed(2)} s</p>
    <p>{s?.frames?'Replay · ':''}{label}</p>
    {session.current?.collision&&<p>Collision fixture · Sand moves after 0.6 seconds · Hold D</p>}
    <div className="graybox-score">{state.fighters.map((f,i)=>{
      const plan=s&&!s.frames&&!s.collision?(i?s.sand:s.auto?s.blue:null)?.diagnostics():null;
      const movingBlocked=ledger.some(e=>e.kind==='collision'&&e.side===i&&e.time===state.time);
      const actionPending=f.reloadDue!==undefined||!!f.firing||state.core?.channel?.side===i;
      const planStatus=plan?.status==='expired'?'Plan expired':plan?.status==='invalidated'||plan?.status==='completed'?'Plan unavailable':
        plan?.status==='waiting'?'Waiting for condition':!actionPending&&!f.motion&&plan?.active&&
          Object.keys(plan.active).length===0?'Authorized wait':null;
      return <div key={i}>{i?'Sand':'Blue'} {state.score?.[i]??''} · {f.hp} HP · {f.ammo} ammo
        <div aria-label={(i?'Sand':'Blue')+' action'}>
          {f.reloadDue!==undefined&&<>Reload <progress aria-label="Reload progress" max={current.config.equipment.reloadTime}
            value={Math.max(0,current.config.equipment.reloadTime-(f.reloadDue-state.time))}/>{' · '}</>}
          {f.firing?'Preparing '+f.firing.kind:state.core?.channel?.side===i?'Core committed':
            movingBlocked?'Movement blocked':f.motion?'Moving':f.hp?'Stationary':'Defeated'}
          {running&&planStatus&&' · '+planStatus}
        </div>
      </div>;
    })}</div>
    {state.core&&<p role="status">Core {state.core.phase} · {((state.core.deadline-state.time)/second).toFixed(1)} s
      {state.core.channel?' · Committed':''}</p>}
    <Yard state={state} config={current.config} queue={queue} debug={debug}/>
    <p role="status">{state.result?state.result+' · '+state.reason:!running&&current.interruption?'Technical interruption · '+current.interruption.reason:''}</p>
    <p>WASD move · Shift run · C crouch · Space jump · F attack · P precision · R reload · X Core · Z cancel</p>
    <label><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)}/> State overlay</label>
    {debug&&<button disabled={!s?.trace.length} onClick={()=>s&&saveJson({controller:label,config:current.config,frames:s.trace},'dust-yard-v26-trace.json')}>Save diagnostic trace</button>}
    <label> Load replay <input type="file" disabled={running} accept=".json,application/json" onChange={async e=>{
      const file=e.target.files?.[0];
      if(!file)return;
      try{if(file.size>2_000_000) throw Error();const data=load(JSON.parse(await file.text()));open(data.recording,true,data.frames);}
      catch {setError('Could not load this V2.6 replay.');}
    }}/></label>
    {error&&<p role="alert">{error}</p>}
    {debug&&<pre aria-label="Authoritative event ledger">{JSON.stringify({events:ledger,tick:state.tick,
      blue:observation(current.config,state,0),sand:observation(current.config,state,1),
      spectator:{blueMotion:state.fighters[0].motion,sandMotion:state.fighters[1].motion,
        lastBoundary:session.current?.last,
        bluePlan:session.current?.auto&&!session.current.frames?session.current.blue.diagnostics():null,
        sandPlan:!session.current?.frames&&!session.current?.collision?session.current?.sand.diagnostics():null}},null,2)}</pre>}
  </main>;
}
