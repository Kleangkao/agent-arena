import {MAP_VERSION} from '../v2/yard.js';
import {center, unit, radius} from '../v23/space.js';
import {canonical} from '../v25/game.js';

export const revision = 'arcade-v2.6';
export const step = 100;
export const second = 3000;
export type Side = 0 | 1;
export const sides: readonly Side[] = [0,1];
export const other = (side:Side):Side => side === 0 ? 1 : 0;
export type Pair<T> = readonly [T,T];
export type Mode = 'objective-duel' | 'score-deathmatch' | 'elimination';
export type Profile = {sight:4|5|6; reach:4|5};
export type Config = ReturnType<typeof configure>;
export function configure(seed:number, mode:Mode, activator:Side = 0, participants:Pair<string> = ['blue-agent','sand-agent'],
  profile:Profile = {sight:5,reach:4}, target = 5, seconds = 75) {
  return {rulesVersion:revision as typeof revision, mapVersion:MAP_VERSION as typeof MAP_VERSION, seed, mode, activator,
    participants:[...participants] as Pair<string>,profile:{...profile},
    geometry:{unit,radius,routeEdges:4,directionLimit:127}, step,
    locomotion:{walk:3,run:6,crouch:2,airTicks:20},
    perception:{range:profile.sight*unit,history:6600},
    equipment:{hp:100,capacity:4,range:profile.reach*unit,near:2*unit,attackTime:2310,reloadTime:3960,
      damage:{standard:18,precision:34},odds:{standard:[76,60],precision:[40,30]},
      modifiers:{upright:0,crouch:4,walk:-8,crouchMoving:-4,run:-16,air:-20}},
    core:{position:center(31),radius:4000,pending:58080,active:24000,channel:9000},
    score:{target,limit:seconds*second,respawn:3600,
      spawnCells:[[28,10,46,27,9,45],[34,16,52,35,17,53]]}, elimination:58080};
}
export function assertConfig(input:unknown):asserts input is Config {
  const c = input as Config;
  if (!c || !Number.isInteger(c.seed) || c.seed < 0 || c.seed > 0xffffffff ||
      !['objective-duel','score-deathmatch','elimination'].includes(c.mode) || !sides.includes(c.activator) ||
      !Array.isArray(c.participants) || c.participants.length !== 2 || c.participants[0] === c.participants[1] ||
      !c.participants.every(id => typeof id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(id)) ||
      ![4,5,6].includes(c.profile?.sight) || ![4,5].includes(c.profile?.reach) ||
      ![5,10,20].includes(c.score?.target) || ![45,75,120].includes(c.score?.limit/second) ||
      canonical(c) !== canonical(configure(c.seed,c.mode,c.activator,c.participants,c.profile,c.score.target,c.score.limit/second)))
    throw Error('Invalid V2.6 configuration');
}
