import {advance, assertConfig, canonical, initial, maxTicks, type Config, type Event, type Frame, type Inputs, type State} from './game.js';

export type Recording = {version:5;source:'manual-sandbox'|'development-policy'|'gemini';config:Config;initialState:State;
  transcript:[tick:number,inputs:Inputs][];events:[tick:number,events:Event[]][];final:State};
export type Playback = {recording:Recording;frames:Frame[]};

export function record(config:Config,choose:(state:State)=>Inputs,source:Recording['source'] = 'development-policy'):Playback {
  assertConfig(config);
  const initialState = initial(config), frames:Frame[] = [], transcript:Recording['transcript'] = [], events:Recording['events'] = [];
  let state = initialState;
  const bound = maxTicks(config);
  while (!state.result && frames.length < bound) {
    const inputs = choose(state);
    const frame = advance(config,state,inputs);
    state = frame.state;
    frames.push(frame);
    if (inputs[0] || inputs[1]) transcript.push([state.tick,inputs]);
    if (frame.events.length) events.push([state.tick,frame.events]);
  }
  if (!state.result) throw Error('V2.5 match exceeded its bound');
  return {frames,recording:{version:5,source,config,initialState,transcript,events,final:state}};
}

export function load(value:unknown):Playback {
  const data = value as Recording;
  if (!data || data.version !== 5 || !['manual-sandbox','development-policy','gemini'].includes(data.source))
    throw Error('Unknown V2.5 replay');
  assertConfig(data.config);
  const bound = maxTicks(data.config);
  if (!Array.isArray(data.transcript) || !Array.isArray(data.events) || data.transcript.length > bound || data.events.length > bound)
    throw Error('Unbounded V2.5 replay');
  let prior = 0;
  for (const item of data.transcript) {
    if (!Array.isArray(item) || item.length !== 2 || !Number.isInteger(item[0]) || item[0] <= prior || item[0] > bound ||
      !Array.isArray(item[1]) || item[1].length !== 2 || (!item[1][0] && !item[1][1])) throw Error('Invalid V2.5 transcript');
    prior = item[0];
  }
  let cursor = 0;
  const result = record(data.config,state => data.transcript[cursor]?.[0] === state.tick + 1
    ? data.transcript[cursor++][1] : [null,null],data.source);
  if (cursor !== data.transcript.length || canonical(data) !== canonical(result.recording)) throw Error('V2.5 replay integrity check failed');
  return result;
}
