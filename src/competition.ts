import {bot,legal,type State} from './game.js';

export const stages=[
 {id:'first-round',name:'First round',brief:'Defeat the training bot to clear the stage.'},
 {id:'quick-start',name:'Quick start',brief:'Take advantage of the training bot’s slow start.'},
] as const;

export function trainingProgress(cleared:string[],stage:number,result:State['result']) {
 const id=stages[stage].id;
 return result==='blue'&&!cleared.includes(id)?[...cleared,id]:cleared;
}

export function trainingAgent(state:State) {
 return state.fighters[0].ammo===0?'reload':bot(state,0);
}

export function trainingOpponent(state:State,stage:number) {
 if(stage===1&&state.step<4)return 'wait';
 if(stage===0&&state.fighters[1].ammo<3&&legal(state,1).includes('reload'))return 'reload';
 return bot(state,1);
}

export const officials={
 'official-sand':{name:'Sand Team',style:'Patient',coaching:'Spend resources only when they help you win. Keep competing for the lead.'},
 'official-sand-pace':{name:'Sand Team · Pace',style:'Fast-paced',coaching:'Contest the lead early. Advance when it opens a useful game action. Stay engaged through the final turn.'},
} as const;
export type OfficialId=keyof typeof officials;
