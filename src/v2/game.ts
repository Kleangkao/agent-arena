import {clearSight, destinations, distance, MAP_VERSION, spawns, type Cell} from './yard.js';

export const rules = {
  version: 'arcade-v2.0', randomness: 'mix32-tick-side-v1', ticks: 36, hp: 100, ammo: 4,
  vision: 4, observeVision: 5, peekVision: 6, runExposure: 2, contactAge: 5, attackRange: 4, attackTicks: 2, reloadTicks: 3,
  standardDamage: 18, precisionDamage: 34, nearHit: 68, nearPrecision: 9, farHit: 52, farPrecision: 5,
  modes: {walk: {steps: 3, interval: 2}, run: {steps: 4, interval: 1},
    crouch: {steps: 2, interval: 3}, jump: {steps: 1, interval: 2}},
} as const;
export const revision = 'arcade-v2.1';
export const realtime = 'arcade-v2.2';
export const realtimeRules = {
  stepMs: 110, ticks: 176, attack: 7, reload: 12, observe: 4, peek: 8,
  contactAge: 20, exposure: 8, intervals: {walk: 6, run: 3, crouch: 9, jump: 6},
  accuracy: {upright: 0, crouch: 4, walk: -8, movingCrouch: -4},
} as const;
export const arcadeAttack = {standard: {near: 76, far: 60}, precision: {near: 40, far: 30}};
export type RulesVersion = typeof rules.version | typeof revision | typeof realtime;
export const ticksFor = (version: RulesVersion) => version === realtime ? realtimeRules.ticks : version === revision ? 44 : rules.ticks;
export const stepMsFor = (version: RulesVersion) => version === realtime ? realtimeRules.stepMs : 440;
export const randomnessFor = (version: RulesVersion) => version !== rules.version ? 'mix32-mirrored-side-v2' : rules.randomness;
export type Side = 0 | 1;
export const sides = [0, 1] as const;
type Mode = keyof typeof rules.modes;
type SimpleAction = 'attack' | 'precision' | 'reload' | 'observe' | 'peek' | 'hold';
type Posture = 'upright' | 'crouch';
export type Intent = {kind: SimpleAction | 'stop'} | {kind: 'move'; mode: Mode; to: Cell} | {kind: 'posture'; posture: Posture};
type Active = {kind: 'move'; mode: Mode; path: Cell[]; due: number} | {kind: SimpleAction; due: number};
type Contact = {cell: Cell; tick: number};
type Fighter = {cell: Cell; hp: number; ammo: number; posture: Posture; exposedUntil: number; active: Active | null; contact: Contact | null;
  reloadDue?: number; shotDue?: number; motion?: Extract<Active, {kind: 'move'}>;
  firing?: {kind: 'attack' | 'precision'; due: number}; survey?: {kind: 'observe' | 'peek'; due: number}};
type Outcome = 'miss' | 'hit' | 'precision';
export type GameEvent =
  | {kind: 'start'; side: Side; intent: Intent}
  | {kind: 'move'; side: Side; from: Cell; to: Cell; mode: Mode}
  | {kind: 'collision' | 'defeat'; side: Side}
  | {kind: 'interrupt'; side: Side; action: 'move'; reason: 'redirect' | 'stop'}
  | {kind: 'complete'; side: Side; action: SimpleAction | 'move'}
  | {kind: 'attack'; side: Side; outcome: Outcome; damage: number}
  | {kind: 'contact'; side: Side; visibility: 'visible' | 'lost'};
export type Result = 'blue' | 'sand' | 'draw';
export type State = {tick: number; fighters: [Fighter, Fighter]; result: Result | null};
export type Intents = [Intent | null, Intent | null];
export type Config = {rulesVersion: RulesVersion; mapVersion: typeof MAP_VERSION; seed: number};
export const configure = (seed: number, rulesVersion: RulesVersion = rules.version): Config => ({rulesVersion, mapVersion: MAP_VERSION, seed});
export function initial(): State {
  const fighter = (cell: Cell): Fighter => ({cell, hp: rules.hp, ammo: rules.ammo, posture: 'upright', exposedUntil: 0, active: null, contact: null});
  return {tick: 0, fighters: [fighter(spawns[0]), fighter(spawns[1])], result: null};
}

const other = (side: Side): Side => side === 0 ? 1 : 0;
export function visible(state: State, side: Side, focusRange = 0) {
  const you = state.fighters[side], rival = state.fighters[other(side)];
  const passiveRange = rules.vision - (rival.posture === 'crouch' ? 1 : 0) + (rival.exposedUntil > state.tick ? rules.runExposure : 0);
  const range = Math.max(focusRange, passiveRange);
  return distance(you.cell, rival.cell) <= range && clearSight(you.cell, rival.cell);
}

const canReloadWhile = (mode: Mode) => mode === 'walk' || mode === 'crouch';
export function legal(state: State, side: Side, version: RulesVersion = rules.version): Intent[] {
  if (version === realtime) return realtimeLegal(state, side);
  const you = state.fighters[side];
  if (state.result) return [];
  const modern = version === revision;
  const canAttack = you.ammo > 0 && distance(you.cell, state.fighters[other(side)].cell) <= rules.attackRange && visible(state, side);
  if (you.shotDue) return [];
  if (you.active) {
    const choices: Intent[] = [];
    if (modern && you.active.kind === 'move' && !you.reloadDue) {
      if (canReloadWhile(you.active.mode) && you.ammo < rules.ammo) choices.push({kind: 'reload'});
      if (you.active.mode === 'walk' && canAttack) choices.push({kind: 'attack'});
    }
    return choices;
  }
  const choices: Intent[] = [{kind: 'hold'}, {kind: 'observe'}, {kind: 'peek'}];
  if (you.ammo < rules.ammo) choices.push({kind: 'reload'});
  if (canAttack) {
    choices.push({kind: 'attack'});
    if (modern) choices.push({kind: 'precision'});
  }
  if (you.reloadDue) choices.splice(0);
  for (const mode of Object.keys(rules.modes) as Mode[]) {
    if (you.reloadDue && !canReloadWhile(mode)) continue;
    for (const to of destinations(you.cell, rules.modes[mode].steps, side === 1).keys()) choices.push({kind: 'move', mode, to});
  }
  return choices;
}

export function observation(state: State, side: Side, version: RulesVersion = rules.version) {
  const {cell, hp, ammo, posture, contact, exposedUntil} = state.fighters[side];
  const current = visible(state, side);
  return {
    rulesVersion: version, tick: state.tick, remaining: ticksFor(version) - state.tick,
    you: {cell, hp, ammo, posture, exposed: exposedUntil > state.tick,
      ...(version === revision ? {moving: state.fighters[side].active?.kind === 'move', reloading: !!state.fighters[side].reloadDue,
        firingWhileWalking: !!state.fighters[side].shotDue} : {}),
      ...(version === realtime ? {motion: state.fighters[side].motion?.mode ?? null, reloading: !!state.fighters[side].reloadDue,
        firing: state.fighters[side].firing?.kind ?? null, surveying: state.fighters[side].survey?.kind ?? null} : {})},
    contact: current ? {status: 'visible', cell: state.fighters[other(side)].cell, tick: state.tick}
      : contact?.tick === state.tick ? {status: 'observed', ...contact}
      : contact && state.tick - contact.tick <= (version === realtime ? realtimeRules.contactAge : rules.contactAge)
        ? {status: 'last seen', ...contact} : {status: 'unknown'},
    actions: legal(state, side, version),
  };
}

export function sameIntent(a: unknown, b: Intent) {
  if (!a || typeof a !== 'object') return false;
  const candidate = a as Intent;
  if (candidate.kind === 'posture') return b.kind === 'posture' && Object.keys(candidate).length === 2 && candidate.posture === b.posture;
  if (candidate.kind !== 'move') return candidate.kind === b.kind && Object.keys(candidate).length === 1;
  return b.kind === 'move' && Object.keys(candidate).length === 3 && candidate.mode === b.mode && candidate.to === b.to;
}

export function assertConfig(config: Config) {
  if (![rules.version, revision, realtime].includes(config.rulesVersion) || config.mapVersion !== MAP_VERSION ||
      !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) throw Error('Unsupported V2 configuration');
}

// Unsigned 32-bit avalanche. Each tick/side has a reserved draw, even when no attack happens.
export function draw(seed: number, tick: number, side: Side) {
  let n = (seed + Math.imul(tick * 2 + side + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) % 100;
}

export function rollFor(config: Config, tick: number, side: Side) {
  return config.rulesVersion !== rules.version
    ? draw(config.seed & 0x7fffffff, tick, (side ^ (config.seed >>> 31)) as Side)
    : draw(config.seed, tick, side);
}

export function advance(config: Config, previous: State, intents: Intents): {state: State; events: GameEvent[]} {
  assertConfig(config);
  const modern = config.rulesVersion === revision;
  const limit = ticksFor(config.rulesVersion);
  if (previous.result || previous.tick >= limit) throw Error('V2 match already finished');
  if (config.rulesVersion === realtime) return advanceRealtime(config, previous, intents);
  const state: State = {tick: previous.tick + 1, fighters: [{...previous.fighters[0]}, {...previous.fighters[1]}], result: null};
  const events: GameEvent[] = [];
  const next: Array<Cell | null> = [null, null];
  const damage = [0, 0];
  const focus = [0, 0];
  for (const side of sides) {
    const fighter = state.fighters[side], intent = intents[side];
    const continuing = intent === null && (fighter.active || fighter.reloadDue || fighter.shotDue);
    if (!continuing && !legal(previous, side, config.rulesVersion).some(choice => sameIntent(intent, choice))) throw Error('Illegal V2 intent');
    if (!intent) continue;
    if (intent.kind === 'stop' || intent.kind === 'posture') throw Error('Illegal V2 intent');
    events.push({kind: 'start', side, intent});
    if (intent.kind === 'move') {
      const mode = rules.modes[intent.mode];
      fighter.posture = intent.mode === 'crouch' ? 'crouch' : 'upright';
      if (intent.mode === 'run') fighter.exposedUntil = previous.tick + 2;
      fighter.active = {kind: 'move', mode: intent.mode, path: destinations(fighter.cell, mode.steps, side === 1).get(intent.to)!, due: previous.tick + mode.interval};
    } else if (modern && intent.kind === 'reload') {
      fighter.reloadDue = previous.tick + rules.reloadTicks;
    } else if (modern && intent.kind === 'attack' && fighter.active?.kind === 'move') {
      fighter.shotDue = previous.tick + rules.attackTicks;
      fighter.ammo--;
    } else {
      const firing = intent.kind === 'attack' || intent.kind === 'precision';
      const duration = firing ? rules.attackTicks : intent.kind === 'reload' ? rules.reloadTicks : intent.kind === 'peek' ? 2 : 1;
      fighter.active = {kind: intent.kind, due: previous.tick + duration};
      if (firing) fighter.ammo--;
    }
  }
  function attack(side: Side, kind: 'attack' | 'precision') {
      const fighter = state.fighters[side];
      const gap = distance(fighter.cell, previous.fighters[other(side)].cell);
      const near = gap <= 2;
      const roll = rollFor(config, state.tick, side);
      const hit = gap <= rules.attackRange && visible(previous, side);
      const odds = kind === 'precision' ? arcadeAttack.precision : arcadeAttack.standard;
      const outcome: Outcome = !hit ? 'miss' : modern
        ? roll < (near ? odds.near : odds.far) ? kind === 'precision' ? 'precision' : 'hit' : 'miss'
        : roll < (near ? rules.nearPrecision : rules.farPrecision) ? 'precision'
        : roll < (near ? rules.nearHit : rules.farHit) ? 'hit' : 'miss';
      const amount = outcome === 'precision' ? rules.precisionDamage : outcome === 'hit' ? rules.standardDamage : 0;
      damage[other(side)] = amount;
      events.push({kind: 'attack', side, outcome, damage: amount});
  }
  for (const side of sides) {
    const fighter = state.fighters[side], active = fighter.active;
    if (fighter.reloadDue === state.tick) {
      fighter.ammo = rules.ammo;
      delete fighter.reloadDue;
      events.push({kind: 'complete', side, action: 'reload'});
    }
    if (fighter.shotDue === state.tick) {
      attack(side, 'attack');
      delete fighter.shotDue;
      events.push({kind: 'complete', side, action: 'attack'});
    }
    if (!active || active.due !== state.tick) continue;
    if (active.kind === 'move') {
      next[side] = active.path[0];
      continue;
    }
    if (active.kind === 'attack' || active.kind === 'precision') attack(side, active.kind);
    if (active.kind === 'reload') fighter.ammo = rules.ammo;
    focus[side] = active.kind === 'peek' ? rules.peekVision : active.kind === 'observe' ? rules.observeVision : 0;
    fighter.active = null;
    events.push({kind: 'complete', side, action: active.kind});
  }
  for (const side of sides) {
    const fighter = state.fighters[side], target = next[side], active = fighter.active;
    if (target !== null && active?.kind === 'move') {
      const rivalTarget = next[other(side)];
      const occupied = target === previous.fighters[other(side)].cell;
      const vacated = modern && rivalTarget !== null && rivalTarget !== previous.fighters[side].cell;
      if (target === rivalTarget || (occupied && !vacated)) {
        fighter.active = null;
        events.push({kind: 'collision', side});
      } else {
        events.push({kind: 'move', side, from: fighter.cell, to: target, mode: active.mode});
        fighter.cell = target;
        if (active.mode === 'run') fighter.exposedUntil = state.tick + 2;
        if (active.mode === 'jump') focus[side] = rules.observeVision;
        fighter.active = active.path.length === 1 ? null : {...active, path: active.path.slice(1), due: state.tick + rules.modes[active.mode].interval};
      }
      if (!fighter.active) events.push({kind: 'complete', side, action: 'move'});
    }
    fighter.hp = Math.max(0, fighter.hp - damage[side]);
    if (fighter.hp === 0) {
      fighter.active = null;
      delete fighter.reloadDue;
      delete fighter.shotDue;
      events.push({kind: 'defeat', side});
    }
  }
  for (const side of sides) {
    const fighter = state.fighters[side], wasVisible = visible(previous, side) || previous.fighters[side].contact?.tick === previous.tick;
    const isVisible = visible(state, side, focus[side]);
    if (isVisible) fighter.contact = {cell: state.fighters[other(side)].cell, tick: state.tick};
    if (isVisible !== wasVisible) events.push({kind: 'contact', side, visibility: isVisible ? 'visible' : 'lost'});
  }
  const [blue, sand] = state.fighters;
  if (blue.hp === 0 || sand.hp === 0 || state.tick === limit) {
    state.result = blue.hp === sand.hp ? 'draw' : blue.hp > sand.hp ? 'blue' : 'sand';
    blue.active = sand.active = null;
    delete blue.reloadDue;
    delete sand.reloadDue;
    delete blue.shotDue;
    delete sand.shotDue;
  }
  return {state, events};
}

function realtimeLegal(state: State, side: Side): Intent[] {
  if (state.result) return [];
  const you = state.fighters[side], mode = you.motion?.mode;
  const grounded = mode !== 'run' && mode !== 'jump';
  const still = !mode;
  const choices: Intent[] = [{kind: 'hold'}];
  if (mode && mode !== 'jump') choices.push({kind: 'stop'});
  if (grounded && mode !== 'crouch' && you.firing?.kind !== 'precision') {
    choices.push({kind: 'posture', posture: you.posture === 'crouch' ? 'upright' : 'crouch'});
  }
  if (grounded && !you.firing && !you.reloadDue && !you.survey && you.ammo > 0 &&
      distance(you.cell, state.fighters[other(side)].cell) <= rules.attackRange && visible(state, side)) {
    choices.push({kind: 'attack'});
    if (still) choices.push({kind: 'precision'});
  }
  if (grounded && !you.firing && !you.reloadDue && you.survey?.kind !== 'peek' && you.ammo < rules.ammo) choices.push({kind: 'reload'});
  if (grounded && !you.survey && !you.firing) {
    choices.push({kind: 'observe'});
    if (still && !you.reloadDue) choices.push({kind: 'peek'});
  }
  if (mode === 'jump' || you.firing?.kind === 'precision' || you.survey?.kind === 'peek') return choices;
  for (const nextMode of Object.keys(rules.modes) as Mode[]) {
    if ((nextMode === 'run' || nextMode === 'jump') && (you.firing || you.reloadDue || you.survey)) continue;
    for (const to of destinations(you.cell, rules.modes[nextMode].steps, side === 1).keys()) {
      if (mode !== nextMode || to !== you.motion?.path.at(-1)) choices.push({kind: 'move', mode: nextMode, to});
    }
  }
  return choices;
}

export function realtimeOdds(kind: 'attack' | 'precision', near: boolean, posture: Posture, motion?: Mode) {
  const odds = arcadeAttack[kind === 'precision' ? 'precision' : 'standard'];
  const state = motion === 'walk' ? 'walk' : motion === 'crouch' ? 'movingCrouch' : posture;
  return (near ? odds.near : odds.far) + realtimeRules.accuracy[state];
}

function advanceRealtime(config: Config, previous: State, intents: Intents): {state: State; events: GameEvent[]} {
  const tick = previous.tick + 1;
  const state: State = {tick, fighters: [{...previous.fighters[0]}, {...previous.fighters[1]}], result: null};
  const events: GameEvent[] = [];
  const focus = [0, 0], damage = [0, 0];
  for (const side of sides) {
    const fighter = state.fighters[side], intent = intents[side];
    if (intent === null) continue;
    if (!realtimeLegal(previous, side).some(choice => sameIntent(intent, choice))) throw Error('Illegal V2 intent');
    events.push({kind: 'start', side, intent});
    switch (intent.kind) {
      case 'move': {
        const prior = fighter.motion;
        const path = destinations(fighter.cell, rules.modes[intent.mode].steps, side === 1).get(intent.to)!;
        if (prior) events.push({kind: 'interrupt', side, action: 'move', reason: 'redirect'});
        if (intent.mode !== 'walk') fighter.posture = intent.mode === 'crouch' ? 'crouch' : 'upright';
        if (intent.mode === 'run') fighter.exposedUntil = tick + realtimeRules.exposure;
        const due = intent.mode !== 'jump' && prior ? prior.due : previous.tick + realtimeRules.intervals[intent.mode];
        fighter.motion = {kind: 'move', mode: intent.mode, path, due};
        break;
      }
      case 'stop':
        delete fighter.motion;
        events.push({kind: 'interrupt', side, action: 'move', reason: 'stop'});
        break;
      case 'posture':
        fighter.posture = intent.posture;
        break;
      case 'attack':
      case 'precision':
        fighter.ammo--;
        fighter.firing = {kind: intent.kind, due: previous.tick + realtimeRules.attack};
        break;
      case 'reload':
        fighter.reloadDue = previous.tick + realtimeRules.reload;
        break;
      case 'observe':
      case 'peek':
        fighter.survey = {kind: intent.kind, due: previous.tick + realtimeRules[intent.kind]};
        break;
    }
  }

  const targets = state.fighters.map(fighter => fighter.motion?.due === tick ? fighter.motion.path[0] : undefined);
  for (const side of sides) {
    const fighter = state.fighters[side], rival = other(side);
    if (fighter.firing?.due === tick) {
      const kind = fighter.firing.kind;
      const gap = distance(fighter.cell, state.fighters[rival].cell);
      const odds = realtimeOdds(kind, gap <= 2, fighter.posture, fighter.motion?.mode);
      const hits = gap <= rules.attackRange && visible(state, side) && rollFor(config, tick, side) < odds;
      const outcome: Outcome = !hits ? 'miss' : kind === 'precision' ? 'precision' : 'hit';
      damage[rival] = !hits ? 0 : kind === 'precision' ? rules.precisionDamage : rules.standardDamage;
      events.push({kind: 'attack', side, outcome, damage: damage[rival]}, {kind: 'complete', side, action: kind});
      delete fighter.firing;
    }
    if (fighter.reloadDue === tick) {
      fighter.ammo = rules.ammo;
      delete fighter.reloadDue;
      events.push({kind: 'complete', side, action: 'reload'});
    }
    if (fighter.survey?.due === tick) {
      const kind = fighter.survey.kind;
      focus[side] = kind === 'observe' ? rules.observeVision : rules.peekVision;
      delete fighter.survey;
      events.push({kind: 'complete', side, action: kind});
    }
  }
  for (const side of sides) {
    const fighter = state.fighters[side], rival = other(side);
    const to = targets[side], rivalTo = targets[rival], motion = fighter.motion;
    if (to !== undefined && motion) {
      const occupied = to === previous.fighters[rival].cell;
      if (to === rivalTo || (occupied && (rivalTo === undefined || rivalTo === fighter.cell))) {
        delete fighter.motion;
        events.push({kind: 'collision', side});
      } else {
        events.push({kind: 'move', side, from: fighter.cell, to, mode: motion.mode});
        fighter.cell = to;
        if (motion.mode === 'run') fighter.exposedUntil = tick + realtimeRules.exposure;
        if (motion.mode === 'jump') focus[side] = rules.observeVision;
        if (motion.path.length > 1) fighter.motion = {...motion, path: motion.path.slice(1), due: tick + realtimeRules.intervals[motion.mode]};
        else delete fighter.motion;
      }
      if (!fighter.motion) events.push({kind: 'complete', side, action: 'move'});
    }
    fighter.hp = Math.max(0, fighter.hp - damage[side]);
    if (!fighter.hp) events.push({kind: 'defeat', side});
  }
  for (const side of sides) {
    const hadContact = visible(previous, side) || previous.fighters[side].contact?.tick === previous.tick;
    const contact = visible(state, side, focus[side]);
    if (contact) state.fighters[side].contact = {cell: state.fighters[other(side)].cell, tick};
    if (contact !== hadContact) events.push({kind: 'contact', side, visibility: contact ? 'visible' : 'lost'});
  }
  const [blue, sand] = state.fighters;
  if (blue.hp === 0 || sand.hp === 0 || tick === realtimeRules.ticks) {
    state.result = blue.hp === sand.hp ? 'draw' : blue.hp > sand.hp ? 'blue' : 'sand';
    for (const fighter of state.fighters) {
      delete fighter.motion;
      delete fighter.firing;
      delete fighter.reloadDue;
      delete fighter.survey;
    }
  }
  return {state, events};
}
