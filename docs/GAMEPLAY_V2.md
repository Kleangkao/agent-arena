# Gameplay V2 implementation

[Owner-approved Gameplay V2 specification](GAMEPLAY_V2_SPECIFICATION.md) records the changes to gameplay. The [original master specification](MASTER_SPECIFICATION.md) and [approved implementation plan](IMPLEMENTATION_PLAN.md) remain the product baseline.

## Run the graybox

Run `npx --offline vite --host 127.0.0.1 --port 4182 --strictPort` and open `http://127.0.0.1:4182/?gameplay-v2`. Play the bundled development match or load a JSON fixture under Replay tools. The development entry is excluded from production builds. Returning to Agent Arena opens the existing V1 app.

V1 uses a seven-position lane, guaranteed 25-damage attacks, three ammo, a ten-turn deadline, and only forward movement. Running both practice policies reproduced two moves, three consecutive exchanges at positions 2 and 4, then five canceled moves because the bots chose Advance before Reload. V1 scenery is visual. V1 rules, historical replay, server and contract remain separate.

## Arcade rules `arcade-v2.0`

- Dust Yard `dust-yard-grid-v2.0` is a 9×7 mirrored grid. Walls and crates block movement and sight. Routes use bounded shortest paths with mirrored tie-breaking. Each action advances at most one orthogonal tile per due tick. Simultaneous entries into one tile and entries into the rival's currently occupied tile stop the path without side priority.
- Both sides start with 100 HP and four ammo. Walk covers up to three tiles at two ticks each. Run covers up to four at one tick each and extends the range at which the runner is visible. Crouch persists until another movement mode and covers up to two tiles at three ticks each. Jump moves one tile in two ticks and provides a brief observation on landing. Jump remains eligible to take damage.
- Observe lasts one tick and checks up to five tiles. Peek lasts two ticks and checks up to six. Ordinary sight is four tiles, adjusted by crouch and recent running. Blocked sight remains blocked during observation. An observed tile becomes last-seen information for up to five ticks. Only the current agent's resources, legal choices and permitted rival-cell contact enter the strategic request. The debug view can see both agents.
- Attack requires sight and range of four tiles. Starting it consumes one ammo. At completion two ticks later, the pre-tick geometry is checked again. An in-range roll yields 59% standard hit, 9% precision and 32% miss at distance 1–2, or 47%, 5% and 48% at distance 3–4. Standard hits deduct 18 HP and precision hits deduct 34. This gives near positions a higher expected reward while leaving uncertainty at both distances. These values are provisional. Reload restores four ammo after three ticks. Hold lasts one tick. Actions occupy one slot and terminate on completion, collision or match end.
- Damage from both sides resolves from the same pre-tick snapshot. Committed movement also resolves that tick, including on defeat. Health is clamped to zero. Defeat or tick 36 ends the match, higher HP wins and equal HP draws. Visual playback is 440 ms per tick at 1× and can be paused, stepped, skipped or replayed.

## Replay and verification

`src/v2/replay.ts` validates version 2, the rules and map identifiers, the unsigned 32-bit seed, the RNG identifier, the initial state, action pairs, every ordered event and the terminal result. Each tick carries a Blue/Sand intent pair, with `null` for continuing an active action, `{"kind":"attack"}` or another supported simple intent, or `{"kind":"move","mode":"walk","to":29}` for movement. The game advances at most 36 pairs. The Phaser canvas reads validated frames and events and has no authority over movement, damage, or results. Session recovery revalidates the saved replay.

The RNG `mix32-tick-side-v1` reserves one value per tick and side. For seed `s`, tick `t` and side `i`, it forms `s + (2*t+i+1)*0x9e3779b9` modulo 2³², mixes with xor-shifts 16, 13, 16 and multipliers `0x85ebca6b` and `0xc2b2ae35`, then takes the unsigned result modulo 100. This is reproducible arcade randomness with no fairness claim about who selects a seed. Any future verified match needs pre-decision authorization and commitment of the participants, seed, versions and configuration. A local replay can validate internal consistency even when it lacks an authenticated publisher.

The JSON transcript is the local wire format. A future Solidity verifier must reproduce bounded paths and collision, sight, action timing, RNG and termination from that transcript. The largest current match contains 72 intent slots. Route traversal and sight are bounded by the finite map. Gas feasibility and Solidity parity for these mechanics remain unmeasured. The current BSC contract verifies V1 exclusively.

## Strategic integration

`server/gameplay-v2.ts` prepares parallel decisions from eligible agents' own observations every four ticks. Gemini can choose up to three distinct legal action indices per window. The deterministic controller rechecks choices before use and holds when none remains legal. The runner reports such holds, validated requests, latency, model metadata and failures. It allows up to 20 total requests including retries, one retry per failed decision, a 12-second per-request timeout and a 60-second match deadline. A provider 429 ends preparation. Injected-provider tests exercise this boundary.

The V2 runner has no hosted route. A future protected call site must reserve from the same existing global budget, lock its configuration and persist the result under the proper version. Prompt input accepts a coaching revision and at most three matching rules-version memory lessons. V2 reflection creation, persistence, isolation and actual memory reuse are pending. Imported replays with an operator AI claim are labeled unconfirmed.

The selected credential is encrypted for the current Windows user in ignored local storage and staged as the separate Vercel Preview secret `GEMINI_V2_API_KEY`. The original V1 credential and deployments were preserved. No generation was requested for this milestone.

## Evidence and limitations

`npx --offline tsx scripts/evaluate-gameplay-v2.ts` recorded 160 mixed-policy matches and 1,000 identical-profile checks. Mixed policies produced 58 Blue wins, 77 Sand wins and 25 draws. The same Seek policy on both sides produced 217 Blue wins, 181 Sand wins and 102 draws. Identical Roam produced 226 Blue wins, 204 Sand wins and 70 draws. All 32,658 identical-profile frames retained mirrored positions and equivalent ammo. The mixed sample favored Sand while the identical-profile sample favored Blue, which gives no evidence of a consistent spawning-side advantage under the tested policies. Blue rolled 431 precision outcomes to Sand's 382 in the identical-profile sample.

The mixed-policy matches saw 2,629 tile moves, 17 distinct chosen destinations, 1,742 contact transitions, 351 path collisions, 574 misses, 876 standard hits and 133 precision hits. They lasted 10–36 ticks and averaged 32.425 ticks. All terminated, 100 at the time limit. One stationary stretch lasted 22 ticks. Aggressive action repetition after contact remains visible in the recording. The data shows meaningful spatial differences from V1 and gives no basis for claiming balance, successful coaching differentiation or a production visual direction.

Evidence lives in [evidence/gameplay-v2](../evidence/gameplay-v2/). It includes the replay, side-swapped fixtures, balance results, desktop and mobile screenshots, logical map and recorded browser playback. The recording shows development policies. V1 historical playback and Testnet receipt were checked separately.
