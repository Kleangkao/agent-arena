import {advance, assertConfig, initial, maxTicks, type Config, type Event, type Frame, type Inputs, type State} from './objective.js';

export type Recording = {
  version: 4;
  source: 'manual-sandbox' | 'development-policy';
  config: Config;
  initialState: State;
  transcript: [tick: number, inputs: Inputs][];
  events: [tick: number, events: Event[]][];
  final: State;
};
export type Playback = {recording: Recording; frames: Frame[]};
export function record(config: Config, choose: (state: State) => Inputs): Playback {
  assertConfig(config);
  const initialState = initial(config);
  let state = initialState;
  const frames: Frame[] = [], transcript: Recording['transcript'] = [], events: Recording['events'] = [];
  while (!state.result) {
    const inputs = choose(state);
    const frame = advance(config,state,inputs);
    state = frame.state;
    frames.push(frame);
    if (inputs[0] || inputs[1]) transcript.push([state.tick,inputs]);
    if (frame.events.length) events.push([state.tick,frame.events]);
  }
  return {recording:{version:4,source:'development-policy',config,initialState,transcript,events,final:state},frames};
}
const canonical = (value: unknown) => JSON.stringify(value, (_key, entry) =>
  entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key,entry[key]])) : entry);

export function load(value: unknown): Playback {
  const data = value as Recording;
  if (!data || data.version !== 4 || !['manual-sandbox','development-policy'].includes(data.source)) throw Error('Unknown Objective Duel replay');
  assertConfig(data.config);
  if (!Array.isArray(data.transcript) || data.transcript.length > maxTicks ||
      !Array.isArray(data.events) || data.events.length > maxTicks) throw Error('Unbounded Objective Duel replay');
  let prior = 0;
  for (const entry of data.transcript) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] <= prior || entry[0] > maxTicks ||
        !Array.isArray(entry[1]) || entry[1].length !== 2 || (!entry[1][0] && !entry[1][1])) throw Error('Invalid Objective Duel transcript');
    prior = entry[0];
  }
  let cursor = 0;
  const playback = record(data.config,state => data.transcript[cursor]?.[0] === state.tick + 1
    ? data.transcript[cursor++][1] : [null,null]);
  if (cursor !== data.transcript.length || canonical(playback.recording.initialState) !== canonical(data.initialState) ||
      canonical(playback.recording.events) !== canonical(data.events) || canonical(playback.recording.final) !== canonical(data.final)) {
    throw Error('Objective Duel replay integrity check failed');
  }
  playback.recording.source = data.source;
  return playback;
}
