# V2.6 human playtest follow-up

[Gameplay contract](GAMEPLAY_CONTRACT.md) · [Original V2.6 evidence and A01–A15 register](GAMEPLAY_V26.md) · [V2.5 audit](gameplay-audit/GAMEPLAY_AUDIT.md)

## What the owner played

**Start sandbox** sends Blue keyboard inputs and runs Sand's deterministic `steady` development policy with seed 23. **Watch development match** also uses the deterministic `mobile` policy for Blue. Sand follows `sandbox.tsx` → `developmentController` → `parsePlan` / `authorize` → `execute` / `motionLease` → `append` / `advance`. The policy and the protected Gemini runner share the strategic plan and reactive executor. Sand's policy generates plans locally in the browser. During the owner playtest, the provider and its scheduler were outside this path.

## Reproductions and fixes

`npm test -- test/gameplay-v26-playtest.test.ts` initially failed all three focused assertions. The old policy sent only reload, sent stop without precision, and left a one-shot conditional approach active after contact entered. The same assertions passed after these changes. The full before/after traces include state, filtered observations, plans, stage, packet, receipts and state after each boundary. [Trace data](../evidence/gameplay-v26-playtest/traces.json)

| Reproduction | Before | After |
|---|---|---|
| Sand reloads at close range with one charge | Tick 1 sent only reload. Sand stayed at x=14,850 through the first policy interval. At tick 15 the policy treated unavailable attack as a reason to pursue the rival's x=8,910 and eventually stopped at an agent collision. | Tick 1 authorized reload and walk away together. The engine accepted both channels. Sand reached x=19,050 and stopped when the local spacing condition cleared. Reload resolved at the same authoritative time and restored four charges. |
| Sand closes from just outside reach | The goal was the current contact's observed position. The prior 450 ms polling interval let the motion continue until tick 15, at x=28,770. Sand could not see the stop-and-precision combination and fired only at tick 29. | At tick 2, the legal attack transition caused immediate policy reconsideration. The acknowledged stop-and-precision packet held x=32,670. Role-qualified Core approaches retain movement and can combine it with standard when legal. |
| Live condition during a goal stage | A one-shot branch was selected once. The executor checked completion and interruption per tick, but checked the branch guard again only on an eligible repeated send. | Both guard and alternative are evaluated each boundary. The loaded no-contact goal switches on the next real sensor sample to its authored stop packet. Its movement receipt is accepted and the position holds. |

The first two issues were scripted policy and observation-interface limitations. The third was a separate executor limitation that a genuine model could have encountered. The fixtures reproduce the reported behaviors under controlled conditions. The owner's original keyboard sequence was not recorded. Manual, scripted and strategic packets use the same input validator. Perception, equipment reach, damage, speed, odds and Core clocks kept the existing profile.

A branch can initially send its complete packet. Returning to an already-sent branch renews only its movement. Nonmovement reissues still need an eligible bounded repeat. Failure of a guard without an alternative revokes the stage's movement lease. Conditions and due times are sampled on the 30 Hz boundary. A stage can complete at its selected off-center goal, change channels, invalidate on an authored predicate or expire. Already authorized reloads, attacks and Core commitments keep their authoritative rules.

Every controller receives the same public map version, dimensions, tile units, solid-cell list, exact obstacle rectangles, footprint clearance and route limit. Open cells derive from the dimensions and blocked cells. A movement capability reports channel compatibility and the receipt still governs a specific requested goal. The filtered observation includes own location, posture, motion flag and timers, current contact, timestamped last-known contact, current-contact equipment reach independent of cooldown and ammo, and approved public match and own/visible Core context. Exact motion paths and the other side's view are labeled spectator diagnostics. No hidden rival state or outcome seed enters the strategic prompt.

## Capability and browser checks

- The sandbox's keyboard packet builder and an equivalent authored plan produce the same packets, receipts and authoritative results for steer, redirect, crouch, jump, reload with movement, and Core start/cancel. The same authored packets run through the development controller in fixtures. The stock scripted opponent chooses a subset of these capabilities. Keyboard steering reaches off-center positions and the strategic interface can submit a specific bounded off-center goal.
- Focused checks cover next-boundary branch switching, expiration, interruption and goal completion. An injected plan transitions from Core approach to commitment, then both participants receive the actual public phase event and Blue wins by Core completion. Score evidence includes fresh contact and new input on respawn, and injected first-living-boundary requests.
- **A08:** A single browser D keydown held Blue at (19,000, 20,790) against Sand (21,100, 20,790). The movement packet remained legal and collision prevented displacement. At tick 19 Sand moved to x=21,700 and Blue resumed at x=19,300 with no second keydown.
- **A10:** A 1.1-second main-thread stall crossed a recorded attack during the stored 5-point Score replay. Phaser drained all 149 events and queued all 74 attack cues. The stored Blue target-score result agreed, with zero page errors or API calls. Counts demonstrate delivery into the renderer. Fine-grained visibility of overlapping effects and production-device frame pacing remain to be validated.

[Browser assertions](../evidence/gameplay-v26-playtest/browser.txt) · [A08 screenshot](../evidence/gameplay-v26-playtest/held-steering.png) · [A08 recording](../evidence/gameplay-v26-playtest/held-steering.webm) · [Stalled Score playback](../evidence/gameplay-v26-playtest/score-stall.webm)

## Reserved scheduler

The existing reserved-budget policy was kept. The original eight scenarios finished with 92 requests and 194.97 lost agent-seconds under the prior accounting. The refreshed runs use the revised conditional executor and exact elapsed time, with separate accounting for time actually simulated and unplayed time after interruption. Each row sums living agent-seconds across both sides. Coverage includes a valid guard waiting for its condition. Authorized wait here means an explicit empty packet rather than time during a missing or expired plan. The JSON includes guard waits, expiry, no executable behavior, feedback generated/delivered/pending/overflow, request trigger counts, retries, exhaustion, and technical interruptions.

| Mode and scenario | Eligible s | Coverage | Uncovered s | Infrastructure idle s | Longest gap s | Authorized wait s | Expired s | Calls |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Objective · authorized wait | 38.72 | 100% | 0 | 0 | 0 | 38.72 | 0 | 4 |
| Objective · expiry | 38.72 | 46.49% | 20.72 | 20.72 | 5.50 | 18 | 20.72 | 4 |
| Objective · planned play | 23.40 | 73.79% | 6.13 | 6.13 | 3.07 | 0.23 | 0 | 4 |
| Objective · injected retry | 23.40 | 73.79% | 6.13 | 6.13 | 3.07 | 0.23 | 0 | 6 |
| Score · authorized wait | 150 | 100% | 0 | 0 | 0 | 150 | 0 | 16 |
| Score · expiry | 150 | 48% | 78 | 78 | 5.50 | 72 | 78 | 16 |
| Score · planned play | 141.60 | 76.11% | 33.83 | 32.73 | 5.40 | 1.17 | 3.17 | 19 |
| Score · injected retry | 142.80 | 63.33% | 52.37 | 51.60 | 8.30 | 1 | 21.70 | 18 |

Objective aggregated 73.45% coverage across 124.24 eligible agent-seconds, 18 calls and 2 retries. Score aggregated 71.90% across 584.40 eligible agent-seconds, 69 calls and 2 retries. Both modes completed all four scenarios with zero budget interruptions. Score planned and retry cases accepted 7 and 6 respawn-triggered calls. Planned/retry feedback delivered 32/49 in each Objective run, 219/249 in Score planned and 174/217 in Score retry. Pending terminal feedback remains separate from overflow. The short-plan cases expose a 5.5-second gap and the Score retry case reached 8.3 seconds. This is a practical coverage limitation. The trial prompt now explains live conditions and concurrent inputs. The cadence and existing limits of 10 requests per side, 20 per match, 8 seconds per call and 60 seconds total are unchanged. [Per-scenario measurements](../evidence/gameplay-v26-playtest/summary.json)

## Mode comparison

Reconstructed 288 complete matches per policy on the selected 5/4 profile, crossing the same 48 seeds, policy side and Objective role assignments. These are scripted cohorts. V2.5's 320-match reference used different `seek`/`roam` policies and different contact rules. It recorded 262 Activator wins, 58 Defender wins and 250 Core completions. It does not isolate a single engine effect.

| Objective Duel | Preserved baseline | Revised policy |
|---|---:|---:|
| Activator / Defender / draw | 62 / 127 / 3 | 25 / 167 / 0 |
| Activation / disable / completion | 74 / 42 / 0 | 185 / 160 / 0 |
| Elimination / mutual elimination | 147 / 3 | 32 / 0 |
| Median pending / active phase | 8.60 / 3.87 s | 5.07 / 3.87 s |
| Blue as Activator, wins / losses / draws | 37 / 57 / 2 | 17 / 79 / 0 |
| Sand as Activator, wins / losses / draws | 25 / 70 / 1 | 8 / 88 / 0 |

The first revised draft activated zero times. It stopped a legitimate Core approach to take a shot. The final policy preserves objective movement when compatible and produces much more Core interaction, but baseline and revised stock policies both lack an effective sustained Core defense in these samples. The controlled strategic fixture verified a Core-completion path. These role outcomes give no basis for equipment or timing changes.

Score baseline had **96/96** target wins, no draws, median **61.93 s**, **729** respawns, and fresh visible contact on **615** respawns. Revised Score had **92/96** target wins, **1** simultaneous-target draw, **3** time-limit draws, median **62.37 s** (35.80–75.00), **727** respawns and fresh contact on **599**. The revised cohort ranged from **5–1** to **5–5**, with **58** 5–4 results across both sides and a median of **8** respawns per match. Every respawn in both stock-policy cohorts accepted an input on the first eligible boundary. Full score and duration distributions, per-match seeds and role swaps are in [summary.json](../evidence/gameplay-v26-playtest/summary.json) and the [raw benchmark](../evidence/gameplay-v26-playtest/benchmark.json).

## Playtest and genuine readiness

Open [Dust Yard V2.6](http://127.0.0.1:4182/?arena-v26), pick a mode and choose **Start sandbox**. WASD steers, Shift runs, C changes posture, Space jumps, F uses standard, P uses precision, R reloads, X starts Core, and Z cancels. Use **State overlay** for observations, plans, receipts and timers. In the [A08 fixture](http://127.0.0.1:4182/?arena-v26&collision-fixture), start and hold D through the 0.6-second blocker release. That fixture is diagnostic and does not export a canonical competition replay.

Authenticated Gemini metadata returned `models/gemini-3.5-flash-lite` with `generateContent` support. No generation was attempted, so provider throughput, actual model behavior, latency and quota are unknown. The protected runner now retains provider-returned model version and token usage when reported, alongside per-call latency, request status and coaching or compatible-memory revision. The persistence test used injected metadata. A read-only Vercel check confirmed that Preview has the provider credential and lacks `ARENA_V26_VALIDATION_TOKEN`. A server-side Preview secret can be provisioned with the existing mechanism when a protected trial deployment is authorized. The local process also lacks the hosted Supabase secret. The last verified hosted reservation query was 2/2 at 15:00 ICT on 26 November, with earliest normal expiry 12:07 ICT on 27 November 2026. Current hosted rows were not re-queried. Running direct would bypass the established shared reservation control. No hosted settings, release, reservations or chain records were changed.

A11 remains blocked for a genuine V2.6 match, genuine reflection, identity and compatible memory reuse. The protected local test demonstrates technical-interruption integrity, with no winner or reflection. V1's confirmed Testnet settlement and separate memory evidence remain version-specific. A15 still needs owner feel checks, genuine trial behavior and production-device playback validation. A02 still has measured coverage gaps. A08's exact browser evidence is now closed and A10 was rerun. The remaining A01–A15 dispositions stay in the original register.

With local parity RPC, **120 tests passed in 23 files**. Both client builds passed and the Preview bundle excluded the V2.6 sandbox. Independently reconstructed **38 stored replays** across v3–v6, and the full suite covers earlier formats. Master specifications and approved plan were preserved, including original sections 00–50. [Tests](../evidence/gameplay-v26-playtest/tests.txt) · [Historical replay counts](../evidence/gameplay-v26-playtest/historical.txt) · [Gemini metadata](../evidence/gameplay-v26-playtest/gemini-access.txt) · [Redacted Preview inventory](../evidence/gameplay-v26-playtest/preview-env.txt)
