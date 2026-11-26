import {createHash} from 'node:crypto';
import {z} from 'zod';
import {canonical} from '../src/v25/game.js';
import {authorize,condition,execute,matches,parsePlan,stage,type Execution,type View} from '../src/v26/controller.js';
import {second,type Config,type Side} from '../src/v26/config.js';
import type {Packet} from '../src/v26/game.js';

const id=z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
const guard=condition.exclude(['at-goal']);
const scope=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('life')}).strict(),
  z.object({kind:z.literal('match'),restart:id}).strict(),
]);
const transition=z.object({to:id,when:guard.optional()}).strict();
const state=z.object({id,action:stage,transitions:z.array(transition).max(4)}).strict();
const node=z.discriminatedUnion('kind',[
  z.object({id,kind:z.enum(['selector','sequence']),children:z.array(id).min(1).max(8)}).strict(),
  z.object({id,kind:z.literal('condition'),when:guard}).strict(),
  z.object({id,kind:z.literal('action'),action:stage}).strict(),
  z.object({id,kind:z.literal('wait'),forMs:stage.shape.forMs}).strict(),
  z.object({id,kind:z.literal('complete')}).strict(),
]);
const common={version:z.literal(1),scope,expiresInMs:z.number().int().min(34).max(30000),
  reenter:z.boolean(),revokeWhen:guard.optional()};
const schema=z.discriminatedUnion('kind',[
  z.object({...common,kind:z.literal('ordered'),stages:z.array(stage).min(1).max(4)}).strict(),
  z.object({...common,kind:z.literal('state-machine'),entry:id,states:z.array(state).min(1).max(4)}).strict(),
  z.object({...common,kind:z.literal('behavior-tree'),root:id,nodes:z.array(node).min(1).max(12)}).strict(),
]);
export type Behavior=z.infer<typeof schema>;
export type Representation=Behavior['kind'];
export const behaviorSchema=(kind:Representation)=>schema.options.find(option=>option.shape.kind.value===kind)!;
type Stage=z.infer<typeof stage>;
type Selection=ReturnType<typeof execute>;
type Visit={status:'running'|'success'|'failure'|'complete';selection?:Selection};
const running:Visit={status:'running'};
const failure:Visit={status:'failure'};
const success:Visit={status:'success'};
const complete:Visit={status:'complete'};
const selection=(status:Selection['status'],reason?:string):Selection=>({packet:null,status,reason});
export const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const stageId=(index:number)=>`stage-${index}`;
const planFor=(stages:Stage[])=>({version:1 as const,expiresInMs:20000,stages});

export function parseBehavior(input:unknown,c:Config,kind:Representation,horizon:20|30,matchScope=false):Behavior {
  const b=schema.parse(input);
  if(b.kind!==kind||b.expiresInMs>horizon*1000||b.scope.kind==='match'&&(!matchScope||c.mode!=='score-deathmatch'))
    throw Error('Behavior exceeds experiment authorization');
  const actions=b.kind==='ordered'?b.stages:b.kind==='state-machine'?b.states.map(s=>s.action):
    b.nodes.flatMap(n=>n.kind==='action'?[n.action]:[]);
  for(const action of actions) parsePlan(planFor([action]),c);
  let entry:string;
  if(b.kind==='ordered') entry=stageId(0);
  else if(b.kind==='state-machine') {
    entry=b.entry;
    const states=new Map(b.states.map(s=>[s.id,s]));
    if(states.size!==b.states.length||!states.has(entry)) throw Error('Invalid state machine entry');
    const reachable=new Set<string>();
    const visit=(key:string)=>{
      if(reachable.has(key)) return;
      reachable.add(key);
      const state=states.get(key)!;
      for(const [index,next] of state.transitions.entries()) {
        if(!states.has(next.to)||!next.when&&index!==state.transitions.length-1) throw Error('Invalid transition');
        visit(next.to);
      }
    };
    visit(entry);
    if(reachable.size!==states.size) throw Error('Unreachable state');
  } else {
    entry=b.root;
    const nodes=new Map(b.nodes.map(n=>[n.id,n])), visited=new Set<string>();
    if(nodes.size!==b.nodes.length||!nodes.has(entry)) throw Error('Invalid tree root');
    const visit=(key:string,depth:number)=>{
      const n=nodes.get(key);
      if(!n||visited.has(key)||depth>4) throw Error('Tree must be bounded, connected and acyclic');
      visited.add(key);
      if(n.kind==='sequence'||n.kind==='selector') {
        if(n.kind==='selector'&&n.children.some(child=>nodes.get(child)?.kind==='condition'))
          throw Error('Guard selector branches with a sequence');
        if(n.kind==='sequence') {
          const firstTask=n.children.findIndex(child=>nodes.get(child)?.kind!=='condition');
          if(firstTask<0||n.children.slice(firstTask).some(child=>nodes.get(child)?.kind==='condition'))
            throw Error('Sequence conditions must guard an executable subtree');
        }
        for(const child of n.children) visit(child,depth+1);
      }
    };
    visit(entry,1);
    if(visited.size!==nodes.size||b.nodes.every(n=>n.kind!=='action'&&n.kind!=='wait')) throw Error('Tree has no executable behavior');
  }
  if(b.scope.kind==='match'&&b.scope.restart!==entry) throw Error('Respawn must restart at the guarded entry');
  return b;
}

export class BehaviorExecution {
  readonly expires:number;
  readonly acceptedLife:number;
  readonly authorizedDigest:string;
  private life:number;
  private ended:Selection['status']|undefined;
  private task:Execution|undefined;
  private key:string|undefined;
  private current:string|undefined;
  private entered:number|undefined;
  private rootRestart=false;
  private readonly cursor=new Map<string,number>();
  active:Packet|undefined;
  branch:string|undefined;

  constructor(readonly spec:Behavior,view:View,readonly side:Side,readonly revision:number,readonly matchDigest:string) {
    this.expires=view.time+spec.expiresInMs*second/1000;
    this.life=this.acceptedLife=view.agent.life;
    this.authorizedDigest=digest(spec);
  }

  get step() {return this.key??this.current;}
  get repeat() {return !!this.task?.plan.stages[this.task.index]?.repeat;}
  get activeBranch() {return this.task?.branch??this.branch;}

  private reset() {
    this.task=undefined;
    this.key=undefined;
    this.current=undefined;
    this.entered=undefined;
    this.active=undefined;
    this.branch=undefined;
    this.rootRestart=false;
    this.cursor.clear();
  }

  end(status:'completed'|'expired'|'invalidated'='invalidated') {
    this.ended=status;
    this.reset();
  }

  private runAction(key:string,stages:Stage[],v:View) {
    if(this.key!==key||!this.task) {
      this.key=key;
      this.task=authorize(planFor(stages),v.time);
      // Only the enclosing contract determines the deadline.
      this.task.expires=this.expires;
    }
    const result=execute(this.task,v);
    this.active=this.task.active;
    return result;
  }

  private tree(v:View,b:Extract<Behavior,{kind:'behavior-tree'}>) {
    const nodes=new Map(b.nodes.map(n=>[n.id,n])), visited=new Set<string>();
    let remaining=12, advanced=false;
    const evaluate=(key:string):Visit=>{
      if(--remaining<0) throw Error('Tree evaluation bound exceeded');
      visited.add(key);
      const n=nodes.get(key)!;
      if(n.kind==='condition') return matches(n.when,v)?success:failure;
      if(n.kind==='complete') return complete;
      if(n.kind==='selector') {
        for(const child of n.children) {
          const result=evaluate(child);
          if(result.status!=='failure') return result;
        }
        return failure;
      }
      if(n.kind==='sequence') {
        const first=n.children.findIndex(child=>nodes.get(child)?.kind!=='condition');
        for(const child of n.children.slice(0,first)) if(evaluate(child).status!=='success') {
          this.cursor.delete(key);
          return failure;
        }
        const index=this.cursor.get(key)??first;
        if(index===n.children.length) {
          this.cursor.delete(key);
          return success;
        }
        const result=evaluate(n.children[index]);
        if(result.status==='failure') this.cursor.delete(key);
        if(result.status!=='success') return result;
        if(!advanced) {
          this.cursor.set(key,index+1);
          advanced=true;
        }
        return running;
      }
      if(n.kind!=='action'&&n.kind!=='wait') throw Error('Invalid validated tree node');
      const result=this.runAction(key,[n.kind==='action'?n.action:{forMs:n.forMs,packet:{}}],v);
      if(result.status==='completed') return success;
      if(result.status==='invalidated') return failure;
      return {status:'running',selection:result};
    };
    const result=evaluate(b.root);
    for(const key of this.cursor.keys()) if(!visited.has(key)) this.cursor.delete(key);
    if(this.key&&!visited.has(this.key)) {this.key=undefined;this.task=undefined;}
    return result;
  }

  next(v:View):Selection {
    if(this.ended) return selection(this.ended);
    if(v.time>=this.expires) {this.end('expired');return selection('expired','contract-deadline');}
    if(v.match.remaining<=0) {this.end('completed');return selection('completed','match-terminal');}
    if(!v.agent.hp||this.life!==v.agent.life) {
      this.reset();
      if(this.spec.scope.kind==='life') {this.end();return selection('invalidated','life-ended');}
      if(!v.agent.hp) return selection('waiting','respawn');
      this.life=v.agent.life;
    }
    const b=this.spec;
    if(b.revokeWhen&&matches(b.revokeWhen,v)) {this.end();return selection('invalidated','authored-revocation');}
    if(this.rootRestart) this.reset();
    this.active=undefined;
    let result:Selection;
    if(b.kind==='ordered') {
      result=this.runAction('ordered',b.stages,v);
    } else if(b.kind==='state-machine') {
      this.current??=b.entry;
      const s=b.states.find(state=>state.id===this.current)!;
      this.entered??=v.time;
      const next=s.transitions.find(t=>t.when&&this.key===s.id&&v.time>this.entered!&&matches(t.when,v));
      result=next?selection('completed','transition'):this.runAction(s.id,[s.action],v);
      if(result.status==='completed') {
        const transition=next??s.transitions.find(t=>!t.when);
        if(transition) {
          this.current=transition.to;
          this.entered=v.time;
          this.key=undefined;
          this.task=undefined;
          this.active=undefined;
          return selection('executing','transition');
        }
      }
    } else {
      const visit=this.tree(v,b);
      if(visit.status==='complete') {this.end('completed');return selection('completed','authored-completion');}
      result=visit.selection??(visit.status==='success'?selection('completed'):
        visit.status==='failure'?selection('waiting','guard-unmet'):selection('executing','transition'));
    }
    if(result.status==='invalidated') this.end();
    if(result.status==='completed') {
      if(!b.reenter) this.end('completed');
      else {
        this.active=undefined;
        this.rootRestart=true;
        return selection('executing','authored-reentry');
      }
    }
    return result;
  }

  reference() {
    const step=this.spec.kind==='ordered'?stageId(this.task?.index??0):this.step;
    return {contract:this.authorizedDigest,match:this.matchDigest,side:this.side,revision:this.revision,
      scope:this.spec.scope.kind,life:this.life,acceptedLife:this.acceptedLife,expires:this.expires,step,branch:this.activeBranch};
  }
}
