import {advance, assertConfig, initial, randomnessFor, ticksFor, type Config, type GameEvent, type Intents, type Result, type State} from './game.js';

export type Frame = {intents: Intents; state: State; events: GameEvent[]};
export type Replay = {
  version: 2;
  config: Config;
  randomness: ReturnType<typeof randomnessFor>;
  source: 'development-policy' | 'operator-attested-gemini' | 'manual-sandbox';
  initialState: State;
  timeline: Frame[];
  result: Result;
};

export function record(config: Config, choose: (state: State) => Intents): Replay {
  assertConfig(config);
  const initialState = initial(), timeline: Frame[] = [];
  let state = initialState;
  while (!state.result) {
    const intents = choose(state);
    const frame = advance(config, state, intents);
    timeline.push({intents, ...frame});
    state = frame.state;
  }
  return {version: 2, config, randomness: randomnessFor(config.rulesVersion), source: 'development-policy', initialState, timeline, result: state.result};
}

const canonical = (value: unknown) => JSON.stringify(value, (_key, entry) =>
  entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

export function validate(value: unknown): Replay {
  const replay = value as Replay;
  if (!replay || replay.version !== 2 || !['development-policy', 'operator-attested-gemini', 'manual-sandbox'].includes(replay.source) ||
      !replay.config || replay.randomness !== randomnessFor(replay.config.rulesVersion) || !Array.isArray(replay.timeline) || !replay.timeline.length || replay.timeline.length > ticksFor(replay.config.rulesVersion)) {
    throw Error('Unsupported V2 replay');
  }
  let state = initial();
  if (canonical(state) !== canonical(replay.initialState)) throw Error('Invalid V2 initial state');
  for (const frame of replay.timeline) {
    if (!Array.isArray(frame?.intents) || frame.intents.length !== 2) throw Error('Invalid V2 transcript');
    const expected = advance(replay.config, state, frame.intents);
    if (canonical(expected) !== canonical({state: frame.state, events: frame.events})) throw Error('Invalid V2 timeline');
    state = expected.state;
  }
  if (!state.result || state.result !== replay.result) throw Error('Invalid V2 result');
  return replay;
}
