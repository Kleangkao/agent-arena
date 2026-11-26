import {GoogleGenAI} from '@google/genai';
import {z} from 'zod';
import {advance, assertConfig, initial, legal, observation, randomnessFor, realtime, realtimeRules, revision, rules, sameIntent, sides, type Config, type Intent, type Intents, type RulesVersion, type Side, type State} from '../src/v2/game.js';
import {validate, type Frame} from '../src/v2/replay.js';
import {crates, HEIGHT, MAP_VERSION, walls, WIDTH} from '../src/v2/yard.js';
import type {Attempt} from './match.js';

const requestLimit = 20;
const windowSize = 3;
const plan = z.object({actions: z.array(z.number().int().nonnegative()).min(1).max(windowSize)
  .refine(actions => actions.length === new Set(actions).size)}).strict();
type Coach = {text: string; revision: string; memory?: {rulesVersion: string; revision: number; lessons: string[]}};
type Input = ReturnType<typeof plannerInput>;
type ProviderReply = {text?: string; model?: string; input?: number; output?: number};
type PlanProvider = (input: Input, signal: AbortSignal) => Promise<ProviderReply>;

export function plannerInput(state: State, side: Side, coach: Coach, version: RulesVersion = rules.version) {
  const memory = coach.memory?.rulesVersion === version ? coach.memory : undefined;
  return {
    objective: 'Win this fictional grid game. Reduce rival health to zero or have more health when time ends. Coaching guides preferences.',
    task: 'Return one to three distinct action indices in execution order. At each free tick this window the controller uses the first still legal action you chose, once per index, or holds. New observations arrive at the next checkpoint.',
    map: {version: MAP_VERSION, width: WIDTH, height: HEIGHT, walls, crates},
    rules: {walk: 'up to 3 tiles; 2 ticks per tile', run: 'up to 4 tiles; 1 tick per tile; briefly easier to spot',
      crouch: 'up to 2 tiles; 3 ticks per tile; harder to spot', jump: '1 tile; 2 ticks; expands observation on landing',
      attack: 'costs 1 ammo and 2 ticks; may miss; closer hits are likelier', reload: '3 ticks; refill ammo',
      observe: '1 tick; check up to 5 tiles', peek: '2 ticks; check up to 6 tiles', hold: '1 tick',
      ...(version === revision ? {attack: 'standard 18 damage on hit; 1 ammo and 2 ticks; can overlap active walking',
        precision: '34 damage on hit, less reliable; 1 ammo and 2 ticks; stationary only',
        reload: '3 ticks, can overlap walking or crouching; cannot fire until finished'} : {}),
      ...(version === realtime ? {walk: '6 steps of the simulation clock per tile; may overlap standard shot, survey or reload',
        run: '3 per tile, blocks other actions; easier to spot', crouch: '9 per tile; compatible with standard shot, survey or reload',
        jump: '6, one tile, committed until landing', attack: '18 on hit; costs 1 ammo and 7 steps of the clock; current movement and posture affect accuracy',
        precision: '34 on hit; costs 1 ammo and 7 steps; stationary only', reload: '12 steps; prevents firing',
        observe: '4 steps', peek: '8 steps, stationary only', hold: 'no new input; accepted states continue',
        timing: realtimeRules.stepMs, motionControl: 'Stop or redirect ground movement while compatible actions continue.'} : {})},
    observation: observation(state, side, version),
    coaching: {revision: coach.revision, text: coach.text.slice(0, 500)},
    memory: memory ? {revision: memory.revision, lessons: memory.lessons.slice(0, 3).map(lesson => lesson.slice(0, 160))} : null,
  };
}

export async function playV2(
  config: Config, coaches: [Coach, Coach], provider: PlanProvider, cancellation: AbortSignal, attempts: Attempt[],
) {
  assertConfig(config);
  const checkpointTicks = config.rulesVersion === realtime ? 20 : config.rulesVersion === revision ? 5 : 4;
  const quota = new AbortController();
  const signal = AbortSignal.any([cancellation, quota.signal, AbortSignal.timeout(60_000)]);
  const initialState = initial();
  let state = initialState;
  let requests = 0;
  let idleWithoutChoice = 0;
  const timeline: Frame[] = [];

  async function request(input: Input, side: Side) {
    const choices = input.observation.actions;
    if (!choices.length) return [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      signal.throwIfAborted();
      if (requests >= requestLimit) throw Error('V2 match request budget exhausted');
      requests++;
      const started = performance.now();
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
      try {
        const reply = await provider(input, deadline);
        let parsed: unknown;
        try { parsed = JSON.parse(reply.text ?? ''); } catch { throw Error('invalid'); }
        const result = plan.safeParse(parsed);
        if (!result.success || result.data.actions.some(index => index >= choices.length)) throw Error('invalid');
        attempts.push({step: input.observation.tick, side, attempt, ms: Math.round(performance.now() - started),
          status: 'ok', model: reply.model, input: reply.input, output: reply.output});
        return result.data.actions.map(index => choices[index]);
      } catch (error) {
        const code = (error as {status?: number}).status;
        const status = (error as Error).message === 'invalid' ? 'invalid' :
          code ? String(code) : deadline.aborted ? 'timeout' : 'provider error';
        attempts.push({step: input.observation.tick, side, attempt, ms: Math.round(performance.now() - started), status});
        if (status === '429') quota.abort();
        if (attempt === 2 || signal.aborted) throw Error('V2 preparation interrupted');
        await new Promise(resolve => setTimeout(resolve, 900));
      }
    }
    throw Error('V2 preparation interrupted');
  }

  while (!state.result) {
    signal.throwIfAborted();
    const plans = await Promise.allSettled(sides.map(side => request(plannerInput(state, side, coaches[side], config.rulesVersion), side)));
    const windows = plans.map(result => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
    for (let tick = 0; tick < checkpointTicks && !state.result; tick++) {
      signal.throwIfAborted();
      const choose = (side: Side): Intent | null => {
        const available = legal(state, side, config.rulesVersion);
        if (!available.length) return null;
        const index = windows[side].findIndex(intent => available.some(choice => sameIntent(intent, choice)));
        if (index >= 0) return windows[side].splice(index, 1)[0];
        if (config.rulesVersion === realtime) {idleWithoutChoice++; return null;}
        const hold = available.find(choice => choice.kind === 'hold');
        if (!hold) return null;
        idleWithoutChoice++;
        return hold;
      };
      const intents: Intents = [choose(0), choose(1)];
      const frame = advance(config, state, intents);
      timeline.push({intents, ...frame});
      state = frame.state;
    }
  }
  return {config, timeline, initialState, result: state.result, requests, idleWithoutChoice};
}

// Server-only. A live call site must use the shared hosted reservation before invoking this runner.
export async function runGeminiV2(
  key: string, model: string, config: Config, coaches: [Coach, Coach], signal: AbortSignal, attempts: Attempt[],
) {
  const ai = new GoogleGenAI({apiKey: key, httpOptions: {retryOptions: {attempts: 1}}});
  const match = await playV2(config, coaches, async (input, abortSignal) => {
    const reply = await ai.models.generateContent({model, contents: JSON.stringify(input), config: {
      abortSignal, maxOutputTokens: 300, responseMimeType: 'application/json',
      responseJsonSchema: {type: 'object', properties: {actions: {type: 'array', minItems: 1, maxItems: windowSize,
        items: {type: 'integer', minimum: 0, maximum: input.observation.actions.length - 1}}}, required: ['actions']},
    }});
    return {text: reply.text, model: reply.modelVersion, input: reply.usageMetadata?.promptTokenCount,
      output: reply.usageMetadata?.candidatesTokenCount};
  }, signal, attempts);
  const replay = validate({version: 2, config, randomness: randomnessFor(config.rulesVersion), source: 'operator-attested-gemini',
    timeline: match.timeline, initialState: match.initialState, result: match.result});
  return {replay, model, requests: match.requests, idleWithoutChoice: match.idleWithoutChoice};
}
