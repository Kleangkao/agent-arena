import {advance, assertConfig, initial, matchTime, type Config, type Event, type Frame, type Inputs, type State} from './game.js';

type Entry = readonly [tick: number, inputs: Inputs];
type EventEntry = readonly [tick: number, events: Event[]];
export type Recording = {
  version: 3;
  config: Config;
  source: 'manual-sandbox' | 'development-policy';
  transcript: Entry[];
  events: EventEntry[];
  final: State;
};
export type Playback = {recording: Recording; frames: Frame[]};
export function record(config: Config, choose: (state: State) => Inputs, source: Recording['source'] = 'development-policy'): Playback {
  assertConfig(config);
  let state = initial();
  const frames: Frame[] = [], transcript: Entry[] = [], events: EventEntry[] = [];
  while (!state.result) {
    const inputs = choose(state);
    const frame = advance(config, state, inputs);
    state = frame.state;
    frames.push(frame);
    if (inputs[0] || inputs[1]) transcript.push([state.tick, inputs]);
    if (frame.events.length) events.push([state.tick, frame.events]);
  }
  return {recording: {version: 3, config, source, transcript, events, final: state}, frames};
}

const canonical = (value: unknown) => JSON.stringify(value, (_key, entry) =>
  entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

export function load(value: unknown): Playback {
  const data = value as Recording;
  if (!data || data.version !== 3 || !['manual-sandbox', 'development-policy'].includes(data.source)) throw Error('Unknown continuous replay');
  assertConfig(data.config);
  const limit = Math.ceil(matchTime / data.config.step);
  if (!Array.isArray(data.transcript) || data.transcript.length > limit ||
      !Array.isArray(data.events) || data.events.length > limit) throw Error('Unbounded continuous replay');
  let prior = 0;
  for (const entry of data.transcript) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] <= prior || entry[0] > limit ||
        !Array.isArray(entry[1]) || entry[1].length !== 2 || (!entry[1][0] && !entry[1][1])) throw Error('Invalid continuous transcript');
    prior = entry[0];
  }
  let cursor = 0;
  const playback = record(data.config, state => data.transcript[cursor]?.[0] === state.tick + 1
    ? data.transcript[cursor++][1] : [null, null], data.source);
  if (cursor !== data.transcript.length || canonical(playback.recording.events) !== canonical(data.events) ||
      canonical(playback.recording.final) !== canonical(data.final)) throw Error('Continuous replay integrity check failed');
  return playback;
}
