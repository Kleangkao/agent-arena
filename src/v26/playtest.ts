import {second} from './config.js';
import type {View} from './controller.js';
import type {Packet,State} from './game.js';

// Keep the same starting coordinates as the original A08 deterministic fixture.
export const collisionStart=[{x:19000,y:20790},{x:21100,y:20790}] as const;
export const collisionRelease=second*.6;
export function collisionOpponent(state:State):Packet|null {
  return state.time===collisionRelease?{movement:{kind:'steer',gait:'run',direction:{x:1,y:0}}}:null;
}

export const actionKeys=new Set(['KeyC','Space','KeyF','KeyP','KeyR','KeyX','KeyZ']);
export const walkKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight']);
export function manualPacket(view:View,held:ReadonlySet<string>,pressed:ReadonlySet<string>):Packet|null {
  const x=Number(held.has('KeyD'))-Number(held.has('KeyA'));
  const y=Number(held.has('KeyS'))-Number(held.has('KeyW'));
  const command:Packet={};
  if(view.agent.hp&&view.match.progress?.by!=='self') {
    if(x||y) {
      command.movement={kind:'steer',gait:held.has('ShiftLeft')||held.has('ShiftRight')?'run':'walk',direction:{x,y}};
      command.facing={x,y};
    } else if(view.agent.moving) command.movement={kind:'stop'};
  }
  if(pressed.has('KeyC')) command.posture=view.agent.posture==='crouch'?'upright':'crouch';
  if(pressed.has('Space')) command.jump=true;
  if(pressed.has('KeyF')||pressed.has('KeyP')) command.attack=pressed.has('KeyP')?'precision':'standard';
  if(pressed.has('KeyR')) command.reload=true;
  if(pressed.has('KeyZ')||pressed.has('KeyX')) command.core=pressed.has('KeyZ')?'cancel':'start';
  return Object.keys(command).length?command:null;
}
