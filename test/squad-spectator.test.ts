import {describe, expect, it} from 'vitest';
import bomb from '../src/fixtures/relay-yard-gemini-bomb.json';
import tdm from '../src/fixtures/relay-yard-gemini-tdm.json';
import {loadSquads, windowTicks} from '../src/squads/game';
import {authorizedOrders, coreTransitions, executionSummary} from '../src/squads/replay-summary';

describe('squad replay receipts for spectators',()=>{
 it('keeps a described engagement, authorized orders and actual pulses separate',()=>{
  const {replay,frames}=loadSquads(tdm);
  const totals=([0,1] as const).map(side=>replay.windows.reduce((pulses,plans,i)=>{
   expect(authorizedOrders(plans[side]).pulse).toEqual([]);
   const start=i*windowTicks;
   return pulses+executionSummary(frames[start],frames.slice(start+1,start+windowTicks+1),side).pulses;
  },0));
  expect(totals).toEqual([0,0]);
  expect(executionSummary(frames[0],frames.slice(1,13),0).moved).not.toEqual([]);
 });
 it('shows a Core activation only when playback reaches its authoritative frame',()=>{
  const {frames}=loadSquads(bomb);
  expect(coreTransitions(frames[12],frames.slice(13,23))).not.toContain('North Core activated');
  expect(coreTransitions(frames[12],frames.slice(13,24))).toContain('North Core activated');
 });
 it('attributes actual pulses to teams from replay coordinates',()=>{
  const {replay,frames}=loadSquads(bomb);
  const pulses=([0,1] as const).map(side=>executionSummary(frames[0],frames.slice(1),side).pulses);
  expect(pulses[0]+pulses[1]).toBe(23);
  expect(authorizedOrders(replay.windows[1][0],replay.windows[0][0])).toMatchObject({
   link:[1],pulse:[3,4,5],changed:4,
  });
 });
});
