# Gameplay V2.4 · Objective Duel

The owner approved a local, reversible experiment in asymmetric objectives. This revisits the objective-related exclusion associated with R34-034 without changing its original context. The original specification, its original release scope, and historical acceptance records stay intact. The Arena Core is a fictional game object. Full bomb planting or defusal remains outside this experiment.

## Rules and resolution order

Roles are assigned per match and independent of participant ID and faction. Both sides use the same V2.3 arena, stats, combat rules and strategic decision cadence. The pending clock is 19.36 seconds, the active clock is six seconds, and both interactions require 0.9 seconds in the same central zone.

| Phase | First applicable outcome | Result |
|---|---|---|
| Pending | Both agents defeated on the same update | Draw · mutual elimination |
| Pending | One agent defeated | Survivor wins · elimination |
| Pending | Living Activator finishes interaction | Core activates, even at the pending deadline |
| Pending | Pending clock expires | Defender wins · activation prevented |
| Active | Defender defeated, including mutual elimination | Activator wins · elimination |
| Active | Living Defender finishes interaction | Defender wins · Core disabled, even at the active deadline |
| Active | Active clock expires | Activator wins · Core completed |
| Active | Activator defeated and Defender survives | Core stays active. Defender can still disable it. |

Apply the shared movement and combat step before evaluating objective interaction progress and terminal rules. A valid interaction starts from an in-zone, living, eligible agent. Walking, crouching, posture changes and observing can overlap. Leaving the zone, defeat, starting run/jump/attack/reload/peek or an explicit cancel interrupts and resets progress. No agent is invulnerable while interacting. Terminal state clears timers and rejects further inputs. Any unfinished interaction at the end is cancelled once.

## V2.3 pacing and controlled comparison

Seed 3 reproduced a full-health deadline. Across 160 V2.3 matches, 44 resolved no attacks and 48 ended with both agents at full health. Of 13,948 decision slots, 4,004 had unknown contact. In 2,195 slots with legal standard attacks, the policies chose neither attack type 428 times (347 Roam, 81 Seek). No decision slot had empty ammo. There were 153,815 agent-position changes and 154,822 off-center samples. Of 1,231 misses, 841 lacked shared geometric range or line of sight at the preceding boundary. This proxy does not isolate wind-up effects, accuracy or exposure modifiers. Health-clock results can reward holding a lead, but the traces show no evidence that these policies optimized for the clock.

The sample used seeds 0–79 and both Seek/Roam assignments. Objective Duel ran both roles per seed and profile assignment with the same spawns, motion, combat rules and 30 Hz stepping. V2.4 with unchanged policies exactly doubled the baseline movement, attack and deadline counts because it ran twice as many matches. The objective-aware policies exercise Core choices while pending defense uses the original combat policy. These are development heuristics. Different objectives and policy choices both contribute to the observed results.

| Metric | V2.3 elimination | V2.4 unchanged policies | V2.4 objective-aware |
|---|---:|---:|---:|
| Matches | 160 | 320 | 320 |
| Draws | 73 | 0 | 0 |
| Clock outcomes | 145 health clocks | 290 activation prevented | 250 Core completions |
| Elimination wins | 15 | 30 | 12 |
| Median / 90th percentile | 19.36 / 19.36 s | 19.36 / 19.36 s | 8.67 / 11.77 s |
| Matches with no resolved attacks | 44 | 88 | 0 |
| Total resolved attacks | 1,765 | 3,530 | 2,952 |
| Idle agent-time | 9.40% | 9.40% | 9.53% |
| Concurrent movement and action | 29.29% | 29.29% | 26.02% |
| Distinct input kinds | 6 | 6 | 8 |
| Agent collisions | 86 | 172 | 420 |
| Interactions started / cancelled | — | 0 / 0 | 413 / 35 |
| Activations / completions / disables | — | 0 / 0 / 0 | 320 / 250 / 58 |
| Activator / Defender wins | — | 15 / 305 | 262 / 58 |

All 800 matches round-tripped with identical full reconstructed frames and passed input, termination, resource and geometry checks. The Activator won both role swaps in 102 of 160 pairs and won one assignment in the other 58. Blue and Sand each won 131/160 as Activator. Seek won 116/160 as Activator and Roam 146/160. Another 128 mirror pairs matched positions, resources, phase timing and results. This supports horizontal symmetry in the sample. The Activator advantage and frequent contact stops at the Core merit more testing with a purposeful pending Defender and genuine policy choices. Future competitive evaluations should pair role swaps. [Full movement, attack and duration data](../evidence/gameplay-v24/benchmark.json)

## Sandbox and recordings

Open the local sandbox at `http://127.0.0.1:4182/?arena-objective`. Choose Blue's role and start. Use WASD or arrows, Shift to run, C to crouch, Space to jump, F for standard attack, P for stationary precision, R to reload, E to observe, and Q to peek. Tap X inside the diamond when your role can use the Core and Z to cancel. Reset restarts at the same seed. The query supports `seed=3&role=defender`. The replay viewer is at `http://127.0.0.1:4182/?gameplay-v24`. It can play, pause, resume, skip or open a v4 replay. The V2.3 routes remain available.

Chromium rejected manual X outside the zone, accepted it at off-center x=23010, cancelled it with Z and accepted a restart that activated the Core. Sand then disabled it. The browser export, import and refresh preserved the result. All seven recorded playbacks agreed with their headless results and the 390px disable view had no horizontal overflow. [Browser measurements](../evidence/gameplay-v24/browser.json) · [Manual transcript](../evidence/gameplay-v24/manual.json)

| Recorded outcome | Evidence |
|---|---|
| Activation and Core completion, with the winner on lower HP | [Recording](../evidence/gameplay-v24/completed.webm) |
| Defender disables the active Core | [390px recording](../evidence/gameplay-v24/disabled.webm) |
| Defender wins on the pending clock, both agents still full health | [Recording](../evidence/gameplay-v24/deadline.webm) |
| Ordinary objective-aware match ends via elimination | [Recording](../evidence/gameplay-v24/elimination.webm) |
| Same agents and profiles, Blue wins in both roles by different means | [Blue Activator](../evidence/gameplay-v24/paired-blue-activator.webm) · [Sand Activator](../evidence/gameplay-v24/paired-sand-activator.webm) |
| Defeated Activator still wins when the already-active Core completes | [Recording](../evidence/gameplay-v24/activator-defeated-after-activation.webm) |

## Replay, verification and genuine AI

Replay v4 includes mode, map, rules, participant IDs, Activator assignment, locked objective parameters, seed, initial state, sparse legal inputs, ordered events, and terminal state including victory reason. Reconstruction validates their consistency. Authentication of identities and inference provenance are separate. Historical V1–V2.3 loaders keep their version paths. A later independent verifier would need the exact combat and objective ordering, including damage, interruptions, phase clocks and terminal precedence. Pre-match authorization should bind the participants, roles, rules, map, seed commitment and objective parameters. A transcript hash alone only commits bytes. V2.4 has no on-chain verifier. [Confirmed V1 settlement](https://testnet.bscscan.com/tx/0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672)

Validation used `npx --offline tsx scripts/evaluate-gameplay-v24.ts`, `npx --offline @playwright/cli -s=arena-v24 run-code --filename scripts/gameplay-v24-browser.js`, and `npm test` with `PARITY_RPC=http://127.0.0.1:8545`. All 83 tests in 18 files passed. Both `npm run build` and `npm run build:preview` passed with the existing bundle and worker warnings. Neither output contained the experimental route or rules identifiers. Public V1 guest practice reached Victory. The local V2.3 viewer still displayed Blue wins on the existing fixture. The master specification and approved V2 specification hashes matched their original values. No model generation, deployment, infrastructure change, chain write or spend occurred.

The offline server module prepares a role-aware observation, separate coaching and compatible memory revisions, a strict two-intent parser, and execution only when each selected intent becomes legal. It does not call Gemini or reserve quota. The core checks support one protected learning trial once the runner enforces reservations and cutoffs. Use the same model for both sides. If budget permits, repeat with the roles swapped while holding identity, coaching, memory and faction constant. Use 3-second checkpoints, no more than nine decisions and one retry per side, 20 total attempts, 8 seconds per call and a 60-second preparation cap. Record provider metadata, valid/invalid requests, accepted intents, interruption, replay and outcome. Stop on quota rejection. The 82% Activator win rate under one policy sample warrants follow-up before competitive release.
