import type {StoredReplay} from '../src/replay';
import type {Coach,Attempt} from './match';
import type {OfficialId} from '../src/competition';
import type {ArenaOpponentId} from '../src/squads/game';
import type {Replay} from '../src/v2/replay';
import type {Config as ModeConfig} from '../src/v25/game';
import type {Recording as ModeReplay} from '../src/v25/replay';
import type {Config as V26Config} from '../src/v26/config';
import type {Recording as V26Replay} from '../src/v26/replay';
import type {SquadConfig,SquadReplay,squadMap,squadRules,continuousSquadRules,territorySquadRules} from '../src/squads/game';
import type {ParticipationProof} from '../src/squads/participation';

export type Memory=Coach['memory'];
export type Reflection={status:'saved';revision:number;lessons:string[]}|{status:'unavailable'};
export type MatchReplay=StoredReplay|Replay|ModeReplay|V26Replay|SquadReplay;
export const matchStatus=(replay:MatchReplay|null)=>replay&&((replay.version!==6&&replay.version!==7)||!replay.interruption)?'completed':'interrupted';
export type MatchConfig={
 participants:[string,OfficialId|ArenaOpponentId];coaches:[Coach,Coach];model:string;
 decisionBudget:20;attempts?:Attempt[];durationMs?:number;sameSetup?:string;participation?:ParticipationProof;
}&({mapVersion:'dust-yard-prototype-v1';rulesVersion:'lane-v1'}|
 {mapVersion:'dust-yard-grid-v2.0';rulesVersion:'arcade-v2.1';seed:number;memoryRevisions:[0,0]}|
 {mapVersion:'dust-yard-grid-v2.0';rulesVersion:'arcade-v2.5';arena:ModeConfig;memoryRevisions:[0,0]}|
 {mapVersion:'dust-yard-grid-v2.0';rulesVersion:'arcade-v2.6';arena:V26Config;memoryRevisions:[0,0]}|
 {mapVersion:typeof squadMap;rulesVersion:typeof squadRules|typeof continuousSquadRules|typeof territorySquadRules;arena:SquadConfig});
export type Job={
 id:string;status:'preparing'|'completed'|'interrupted';replay:MatchReplay|null;
 config:MatchConfig;reflection:Reflection|null;
};
export type NewJob={id:string;owner:string;requestId:string;config:MatchConfig};
export type Reservation={status:'new'|'existing';job:Job}|{status:'busy';retryAfter:number}|{status:'unauthorized'};
export function liveStartInterval(value?:string|number){
 const seconds=Number(value);
 return Number.isInteger(seconds)&&seconds>=1&&seconds<=3600?seconds:60;
}
export type GuestRequest='allowed'|'limited'|'missing';
type MaybePromise<T>=T|Promise<T>;
export interface ArenaStorage {
 guest(id:string):MaybePromise<boolean>;
 guestRequest?(id:string):MaybePromise<GuestRequest>;
 createGuest(id:string,expires:number):MaybePromise<boolean>;
 memory(owner:string):MaybePromise<Memory>;
 coaching(owner:string):MaybePromise<string|null>;
 saveCoaching(owner:string,text:string,revision:string):MaybePromise<void>;
 find(owner:string,id:string):MaybePromise<Job|null>;
 existing(owner:string,requestId:string):MaybePromise<Job|null>;
 reserve(job:NewJob):MaybePromise<Reservation>;
 finish(id:string,replay:MatchReplay|null,attempts:Attempt[],durationMs:number):MaybePromise<void>;
 reflect(owner:string,id:string,lessons:string[]|null):MaybePromise<void>;
}
