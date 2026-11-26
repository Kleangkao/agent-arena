export type Action = 'advance' | 'attack' | 'reload' | 'wait';
export type Fighter = { position: number; hp: number; ammo: number };
export type State = { step: number; fighters: [Fighter, Fighter]; result: 'blue' | 'sand' | 'draw' | null };
export type Event = { step: number; actions: [Action, Action]; state: State };
export const initial = (): State => ({ step: 0, fighters: [{position:0,hp:100,ammo:3},{position:6,hp:100,ammo:3}], result:null });
export function legal(s: State, i: number): Action[] {
 const f=s.fighters[i], o=s.fighters[1-i]; const a: Action[]=['wait'];
 if (Math.abs(f.position-o.position)>1) a.push('advance');
 if (f.ammo>0 && Math.abs(f.position-o.position)<=3) a.push('attack');
 if (f.ammo<3) a.push('reload'); return a;
}
export function resolve(s: State, actions: [Action,Action]): State {
 if(s.result) throw Error('Match already finished');
 if(!Number.isInteger(s.step)||s.step<0||s.step>=10||!Array.isArray(s.fighters)||s.fighters.length!==2||s.fighters.some(f=>!Number.isInteger(f.position)||f.position<0||f.position>6||!Number.isInteger(f.hp)||f.hp<1||f.hp>100||!Number.isInteger(f.ammo)||f.ammo<0||f.ammo>3)) throw Error('Invalid match state');
 for(let i=0;i<2;i++) if(!legal(s,i).includes(actions[i])) throw Error('Illegal action');
 const fs: [Fighter,Fighter]=s.fighters.map(f=>({...f})) as [Fighter,Fighter];
 for(let i=0;i<2;i++){ const a=actions[i]; if(a==='advance') fs[i].position+=i===0?1:-1; if(a==='reload') fs[i].ammo=3; if(a==='attack'){fs[i].ammo--;fs[1-i].hp=Math.max(0,fs[1-i].hp-25);} }
 if(fs[0].position===fs[1].position){fs[0].position=s.fighters[0].position;fs[1].position=s.fighters[1].position;}
 const step=s.step+1; let result:State['result']=null;
 if(fs[0].hp===0||fs[1].hp===0||step>=10) result=fs[0].hp===fs[1].hp?'draw':fs[0].hp>fs[1].hp?'blue':'sand';
 return {step,fighters:fs,result};
}
export function bot(s:State,i:number):Action { const a=legal(s,i); return a.includes('attack')?'attack':a.includes('advance')?'advance':a.includes('reload')?'reload':'wait'; }

/** Reconstruct a match from a bounded, untrusted action transcript. */
export function replay(transcript: unknown): State {
 if(!Array.isArray(transcript) || transcript.length>10) throw Error('Invalid transcript');
 let state=initial();
 for(const pair of transcript){
  if(!Array.isArray(pair)||pair.length!==2||!pair.every(a=>typeof a==='string' && ['advance','attack','reload','wait'].includes(a))) throw Error('Invalid transcript action');
  state=resolve(state,pair as [Action,Action]);
 }
 return state;
}
