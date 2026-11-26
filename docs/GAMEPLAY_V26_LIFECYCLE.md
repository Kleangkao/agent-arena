# V2.6 plan lifecycle and playtest validation

26 November 2026 · Local and experimental

## Lifecycle correction

At Score tick 387, Blue's first living respawn boundary bypassed the soft reserve after a two-attempt request at tick 300. The replacement plan completed at tick 595, 208 ticks after authorization. Reserved scheduling ignored completion and expiry as immediate renewal signals. Its 10-second cadence became due at tick 687, but four attempts had already been spent and the fifth allowance opened at tick 844. The resulting 249-tick gap was 92 completed-plan ticks and 157 expired-plan ticks. The injected 503 at tick 300 consumed budget and recovered at that same boundary. The exact original reproducer still reconstructs the same replay digest, including when injecting 80 ms into each request. [Original reproducer](../evidence/gameplay-v26-architecture-audit/reproduce-gap.mts) · [Current baseline recheck](../evidence/gameplay-v26-lifecycle/baseline-recheck.txt)

The runner now compares three lifecycle variants against the original reserved scheduler. All use the same bounded model-authored stages, validated packets and synchronous simulation checkpoints. They consider completion, expiry, invalidation and an imminent final-stage or plan deadline, while letting already-started actions finish. An explicit wait can run to its authored boundary. Objective can reconsider after a two-second blocked guard and preserves priority for phase changes. Score's paced policy defers guard-only refresh, places respawn under the soft allowance, and can borrow only from allowance opening within two seconds when there is no usable plan. It holds the final ordinary Score request until the last four seconds. That hold is an initiation rule. A retry on a request already in flight can still use the final hard-budget attempt. The 10/side, 20/match, 8-second request timeout and 60-second runtime limits remain in place. A terminal provider failure or hard exhaustion still produces a partial technical interruption without a competitive result. [Scheduler](../server/gameplay-v26.ts) · [Lifecycle tests](../test/gameplay-v26-lifecycle.test.ts)

## Exact Score retry scenario

The regenerated reserved baseline has the exact original replay digest. Each candidate uses seed 12 and the same injected response function, which reacts to the new observation when checkpoints move. A changed replay or outcome is therefore expected. Each individual replay reconstructs independently of provider timing.

| Metric | Reserved Blue / Sand | Paced renewal Blue / Sand |
|---|---:|---:|
| Eligible agent-seconds | 71.40 / 71.40 | 71.40 / 72.60 |
| Valid plan coverage | 62.84% / 63.82% | 61.58% / 64.74% |
| Executable behavior coverage | 43.14% / 48.09% | 40.76% / 46.33% |
| Infrastructure idle, seconds | 25.80 / 25.80 | 27.43 / 25.57 |
| Longest no-plan gap, seconds | 8.30 / 7.20 | 6.07 / 6.47 |
| Longest infrastructure-idle gap, seconds | 7.93 / 7.17 | 6.07 / 6.47 |
| Authorized waiting, seconds | 0.47 / 0.53 | 0.63 / 0.63 |
| Guard waiting, seconds | 11.43 / 4.50 | 9.77 / 6.37 |
| Expired-plan time, seconds | 11.20 / 10.50 | 0 / 0 |
| Requests including one retry each | 9 / 9 | 10 / 10 |
| Recorded preparation on this machine | 342 ms | 265 ms |
| Outcome | Draw at 75 s | Sand at 75 s |

The improvement is in longest uninterrupted gaps. Overall Blue activity and idle time regressed in this fixture. A phase with a valid waiting guard or an exhausted one-shot stage can still look inactive. Timing uses a local injected provider and includes synchronous simulation and replay validation. The single timing figures do not support a performance claim about genuine inference.

## Candidate comparison

Four fixed seeds (12, 3, 23, 71), both modes and four injected patterns per candidate. Patterns cover long authorized waits, short expiry, conditional play and a synthetic 503 with retry. The conditional scenarios exercise Score respawn and repeated scoring without a request per score event. Tests cover a dual-participant request barrier, a sustained guard, Objective phase feedback, retries, and an exhausted-budget partial replay. Each row includes 16 matches. All timings below are simulated except preparation latency, which is attached per match in the JSON.

| Candidate | Objective interruptions · calls · worst plan gap | Score interruptions · calls · worst plan gap |
|---|---:|---:|
| Reserved baseline | 0 · 80 · 5.50 s | 0 · 276 · 9.47 s |
| Renewal within allowance | 0 · 114 · 0 s | 2 · 272 · 11.37 s |
| Renewal with one future credit | 0 · 114 · 0 s | 11 · 288 · 10.37 s |
| Paced renewal | 0 · 114 · 0 s | 0 · 288 · 7.33 s |

Paced renewal is provisionally selected because it held the longest Score gap down while preserving completion in this cohort. Aggregate Score infrastructure idle changed from 652.00 to 649.70 agent-seconds and pooled executable coverage fell from 24.03% to 22.37%. Objective infrastructure idle fell from 133.28 seconds to zero while executable coverage rose from 24.69% to 30.16%. The two interrupted alternatives trade fewer played agent-seconds for earlier requests. Their idle totals need to be read alongside the interruptions, whose remaining simulated time is excluded. No candidate approaches the audit's proposed two-second maximum in Score. The present cap and authored horizons can still produce long pauses.

**Denominators and overlaps.** Eligible time is simulated time at living pre-step boundaries, using exact elapsed units. Valid-plan and executable coverage both divide by eligible time. Valid-plan time includes valid guards, even when unmet. Executable time is observed displacement, an accepted non-facing/non-movement action, or a previously committed action still underway. A stop receipt alone does not count. The exclusive breakdown is executable, infrastructure idle (no valid plan and no executable work), blocked, guard waiting, explicit empty-packet waiting, and other plan idle. Expiry is a separate overlay on no-plan time and can overlap pending action execution. The older plan-gap metric includes uncovered time while an earlier action is still resolving. Preparation is per match. Requests count all attempts including errors and retries.

[Per-side and per-mode metrics](../evidence/gameplay-v26-lifecycle/summary.json) · [Per-scenario rows, plan traces and timings](../evidence/gameplay-v26-lifecycle/benchmark.json)

## Manual sandbox diagnosis

**Start sandbox** sends Blue keyboard packets and runs Sand's local scripted steady policy, seed 23. Both use shared packet validation and the deterministic engine. Sand's path is `developmentPlan → authorize → execute → motionLease → append → advance`. The injected provider fixtures and genuine Gemini flow are separate from these manual runs.

- **Stationary reload reproduced.** In a fresh Score session, release D near tick 30. At tick 93 Sand was 20,640 units (3.47 tiles) away and sent only reload. The accepted reload ran until tick 132 with zero Sand displacement. In the closer run, holding D until tick 88 produced an accepted reload and steer at tick 93. Sand moved 8,400 units during reload and stopped before completion. This is a context-dependent scripted choice plus previously poor visual feedback. No engine concurrency defect was found. Both choices remain available.
- **Unnecessary goal reproduced, autonomous close approach still uncertain.** In both browser runs the old tick-15 approach intended Blue's exact observed coordinate (13,110, 20,790). The same packet after the fix targets (24,990, 20,790), two tiles short along the approach. Both packets were accepted. Sand stopped and prepared precision at tick 21 when legal, and the closer session was driven by Blue holding D. The captured inputs therefore do not reproduce Sand autonomously reaching unnecessary close range in the owner's exact sequence. The patch fixes the confirmed overlong goal while preserving legitimate current contact, historical search and Core movement. The 450 ms policy cadence, threshold behavior and naturalness in other sequences need owner follow-up.
- The sandbox now labels the actual controller and replay source, draws authoritative reload progress, and labels active actions, blocked movement, controller waits, unavailable or expired plans, and technical interruption. Historical replay v6 lacks per-tick plan status, so only known authority state and events are shown in historical playback. Enable **State overlay** and choose **Save diagnostic trace** for up to 450 recent synchronized boundaries, including pre-step observations, plans, attempted inputs, receipts and post-step state.

[Local sandbox](http://127.0.0.1:4182/?arena-v26) · [Stationary trace before](../evidence/gameplay-v26-lifecycle/manual-trace.json) · [Close trace before](../evidence/gameplay-v26-lifecycle/manual-close-trace.json) · [Stationary trace after](../evidence/gameplay-v26-lifecycle/revised-trace.json) · [Close trace after](../evidence/gameplay-v26-lifecycle/revised-close-trace.json) · [Close reload recording](../evidence/gameplay-v26-lifecycle/revised-close-observations.webm) · [Reload screenshot](../evidence/gameplay-v26-lifecycle/revised-close-reload.png)

## Regression and readiness

The actual browser path passed A08 with one keydown. Blue stayed at x=19,000 while blocked and resumed to x=19,300 when Sand cleared. A10 passed across a 1.1-second stall, with 149 authoritative events and 74 attack cues consumed and zero API calls or page errors. The scoped parity fixtures cover manual, scripted and strategic movement, redirect, crouch, airborne movement, reload, Core and life transitions. **124 tests** passed with local Hardhat parity, both client builds passed, and 38 stored v3–v6 replays reconstructed. The original master hash and 00–50 sections are preserved. No rules, map, balance or replay formats were changed. A02 is improved locally and remains provisional. A11 remains blocked and A15's owner acceptance and broader presentation performance remain open. [Browser assertions](../evidence/gameplay-v26-lifecycle/a08-a10-browser.txt) · [Test log](../evidence/gameplay-v26-lifecycle/tests.txt) · [Historical reconstruction](../evidence/gameplay-v26-lifecycle/historical.txt)

The read-only hosted reservation check at 17:50 ICT on 26 November showed **2/2** in the rolling day, zero in flight, earliest expiry **12:07 ICT on 27 November 2026**. Preview's variable inventory still lacks `ARENA_V26_VALIDATION_TOKEN`. Authenticated metadata confirmed `models/gemini-3.5-flash-lite` and `generateContent` support. Generation capacity remains unknown. This pass made zero generation requests, deployments, or chain writes. Review the remaining Score gaps and capture ordinary owner play before a protected genuine Objective trial. BSC Testnet verification and genuine memory evidence from V1 remain version-specific. [Read-only access evidence](../evidence/gameplay-v26-lifecycle/access.txt)
