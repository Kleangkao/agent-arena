# Gameplay V2.2 core validation

Run `npx --offline vite --host 127.0.0.1 --port 4182 --strictPort`. Open [manual sandbox](http://127.0.0.1:4182/?arena-sandbox) or [autonomous replay](http://127.0.0.1:4182/?gameplay-v22). Both entries are development-only.

## Architecture

V2.1 advanced both agents on the same fixed logical tick. A multi-tile path occupied the main action slot until completion. Two special cases allowed a walk to overlap a shot or reload. The seed-3 minimal probe started a three-tile walk, then found no legal movement change on the next tick. Rendering had no role in this rejection.

V2.2 uses a common 110 ms clock, up to 176 quanta (19.36 s). A quantum can advance both agents with two inputs, one input, or none. Input starts or revises authoritative state. Movement, posture, firing, survey, reload, ammo and life are represented separately. The existing deterministic reducer validates all input sources under versioned rules. Keyboard callbacks timestamp input, the simulation timer consumes it at the next eligible boundary, and Phaser interpolates confirmed tile moves independently. Older recorded V2 rules keep their original step sizes, action semantics and results.

Walking, running, crouch movement and jumping take 6, 3, 9 and 6 quanta per tile. A ground redirect keeps the existing next-step deadline. Stop cancels the path before its due step and leaves compatible work intact. Jump is a one-tile commitment with its own full landing timer. Collision uses simultaneous target positions. A following move into a vacated cell can succeed, while a shared destination or swap is rejected. Movements remain tile-based.

## State-combination matrix

All rows were checked in `test/gameplay-v22.test.ts` or the deterministic replay/browser checks. Allowed shots still require ammo, range and current sight.

| State or operation | Supported and verified | Intentionally restricted |
|---|---|---|
| Stationary upright or crouched | Standard and precision shots, reload, observe, peek | Firing while a reload or survey is live |
| Walk | Standard shot, reload, observe, stance switch, ground redirect or stop | Precision and peek while moving |
| Crouch movement | Standard shot, reload, observe, ground redirect or stop | Stand directly while following a crouch route. Change the movement mode first. |
| Run | Ground redirect, stop, move on its own cadence | Fire, reload and survey while running |
| Jump | One adjacent landing and survey of the landing area. Can take damage. | Fire, reload, survey input, stop and redirect while airborne |
| Standard shot due | Walk/crouch movement and ground changes may continue during its timer | Starting another shot, reload, observe, peek, run or jump |
| Precision due | Stationary resolution with the committed stance | Changing stance, movement or other active tasks |
| Reload and observe | May coincide with each other and with walk/crouch. Stop or redirect does not discard them. | Firing until reload completes. Peek requires a free stationary slot. |
| Both agents resolve in one quantum | Deterministic ordered events, simultaneous damage, double defeat draws | Further control after terminal state |

An ordinary hit deals 18 and precision deals 34. Both cost one ammo on acceptance and resolve after seven quanta. Reload completes after 12 quanta. Accuracy uses post-input, pre-move geometry and current movement and posture at the resolution boundary. Standard and precision retain their 76/60 and 40/30 near/far baselines. Stationary crouch adds four percentage points, walking subtracts eight and crouch movement subtracts four. Seeded rolls and bounds are equal across sides. A shot which loses legal sight/range still consumes ammo and misses.

## Browser and deterministic evidence

- [Manual recording](../evidence/gameplay-v22/manual.webm) and [move/attack screenshot](../evidence/gameplay-v22/manual-overlap.png). Real keyboard input produced walk and attack on tick 15, a redirect on 16, stop during reload on 23, jump on 34 and landing on 39. Observed key-to-acceptance times were 95 ms for attack and 103 ms for reload. The exported [browser transcript](../evidence/gameplay-v22/manual.json) revalidated as a 100–100 draw at tick 176.
- [Autonomous development-policy recording at 390px](../evidence/gameplay-v22/autonomous-mobile.webm) and [result screenshot](../evidence/gameplay-v22/autonomous-mobile.png). The stored replay reached Blue 48–46 with no horizontal overflow, and refresh recovered the same result. Both browser runs made zero API calls.
- Fixed inputs fed through 7 ms and 83 ms sampler cadences produced identical full traces. A browser sandbox check throttling animation callbacks to 500 ms reached simulation tick 6 and its first walking tile after one animation callback. The renderer does not advance game state.
- `npx --offline tsx scripts/evaluate-gameplay-v22.ts` reproduced V2.1 baseline moves and deadline counts. It validated all 320 benchmark replays after JSON round trips and checked 320 paired side-swapped V2.2 simulations. [Machine-readable metrics](../evidence/gameplay-v22/balance.json)

| Same 160 seeds and policy assignments per version | V2.1 | V2.2 |
|---|---:|---:|
| Blue / Sand / draw | 67 / 75 / 18 | 80 / 62 / 18 |
| Deadline decisions | 88 | 125 |
| Mean simulated duration | 17.48 s | 18.85 s |
| First attack mean | 4.12 s | 4.79 s |
| Longest stationary stretch | 10.56 s | 3.41 s |
| Tile steps / collisions | 4,474 / 538 | 6,392 / 629 |
| Moving with an active action, share of agent time | 6.23% | 23.69% |
| Idle share of agent time | 29.90% | 14.35% |
| Miss / standard / precision outcomes | 754 / 937 / 165 | 1,631 / 675 / 133 |
| Simulate and validate locally | 336 ms | 1,037 ms |

The comparison includes a V2.2-compatible development policy. It does not isolate the effect of the clock, policy or rules. More movement and fewer long stationary segments came with more misses and deadline decisions. The recordings show meaningful mid-action control and still show periods of disengagement. The 110 ms choice buys four input opportunities per former 440 ms interval while keeping the same time ceiling. It increases a complete transcript to 352 input slots and adds independent timers, which a future verifier must evaluate.

## Gemini readiness gate

| Requirement | Status and evidence |
|---|---|
| Simulation independent of alternating turns | Passed locally. Simultaneous inputs and simultaneous lethal outcomes are tested. |
| Compatible action and movement coexistence | Passed. State matrix, keyboard overlap and reload continuation. |
| Coherent transitions | Passed on covered paths. Explicit mutual exclusion, stop, redirect, completion and defeat. |
| Responsive movement | Passed for boundary updates. Browser route redirect and stop, plus deterministic timing tests. |
| Rendering frame-rate independence | Passed. Throttled browser and fixed-input sampler comparison. |
| Gemini frequency independence | Passed for core execution. The engine consumes sparse intents without a provider. The planner was exercised with an injected provider only. |
| State-based damage | Passed. A fixed seed turns the same committed shot from hit to miss when walking at resolution. |
| Shared manual/autonomous engine | Passed. Both run the same reducer and replay validator. |
| Deterministic replay | Passed locally across current and historical fixtures. |
| No critical core defects remain | Not yet verified beyond the covered matrix and samples. Deadline-heavy pacing, misses and tile response remain validation work. |

The future planner visits up to nine checkpoints spaced 20 quanta apart, with up to three distinct eligible choices per side and the existing 20-request cap. When a choice expires or is ineligible, the engine advances without a new intent. The model provider was not contacted. No deployment or chain writes occurred. V1 remains the confirmed on-chain ruleset, and V2.2 is unverified.
