# V2.6 engineering and acceptance evidence

[Gameplay contract](GAMEPLAY_CONTRACT.md) · [V2.5 baseline audit](gameplay-audit/GAMEPLAY_AUDIT.md) · [Parameter registry](../evidence/gameplay-v26/parameters.json) · [Benchmark](../evidence/gameplay-v26/benchmark.json)

The [owner playtest follow-up](GAMEPLAY_V26_PLAYTEST.md) records the revised development policy, live guard evaluation and completed A08 browser evidence. The measurements below preserve the original baseline.

The [lifecycle validation](GAMEPLAY_V26_LIFECYCLE.md) compares the baseline with the current provisional paced renewal and records the latest browser, manual-policy and access evidence.

## Provisional profiles

The approved Core and score clocks are preserved. The coordinate grid still supplies the obstacle shapes, but perception, equipment reach and Core inclusion use squared Euclidean distance. Passive perception no longer changes with target pose or running in this profile. The six sight/reach profiles are explicit versioned presets. The selected 5/4 profile exposes open contact at 4.5 tiles without an attack at that distance. Reach 4 supports Core and score engagements in the sampled cohorts. A nearby wall still blocks both. The three sight values and two equipment ranges are each exercised independently with open, Core, diagonal and occluded cases. V2.5 uses different geometry and controller policies, so differences in win rate combine both changes.

| Group | Selected values and limits |
|---|---|
| Grid and geometry | Dust Yard 9×7. 5,940 position units per tile, 900-unit square half-width, four route edges around obstacles, integer input direction components from −127 through 127. |
| Simulation clock | 3,000 time units per second and 100 units per step. Nominal attack 2,310 units (770 ms), reload 3,960 units (1,320 ms). Full-step completion at 800 ms and 1,333⅓ ms. The final boundary clamps to the deadline. |
| Locomotion | Walk 3, run 6, crouch 2 position units per time unit. Air state 20 ticks (666⅔ ms). Facing is stored independently and has no game effect. |
| Perception | 29,700-unit passive radius with line of sight and 6,600-unit authorized history, equivalent to 5 tiles and 2.2 seconds. No committed Observe/Peek input. |
| Equipment | 23,760-unit reach and 11,880-unit near split. Four ammo, 100 HP, 18/34 damage, base standard odds 76/60 and precision 40/30 percent. Crouch stationary +4, walk −8, moving crouch −4, running −16, airborne −20 percentage points. Use the airborne modifier first. |
| Core | (26,730, 20,790), circular radius 4,000. 19.36 seconds pending, 8 active and 3 each to activate or disable. |
| Score | Default 5 points in 75 seconds. Presets 5/10/20 and 45/75/120 retained. Respawn 1.2 seconds with mirrored alternate locations and no immunity. |
| Strategic limits | Four stages initially, schema accepts only configured bounds up to eight. Stage 34–15,000 ms, plan 34–20,000 ms, optional repetitions 2–12 at 250–15,000 ms. Event buffer 16. Request limits 10/side and 20/match, 8 seconds per call, 60 seconds per run. |

The registry is bound to replay v6. Unselected profiles are explicit experimental configuration, and arbitrary balance edits are rejected by configuration validation. Candidate geometry remains bounded within the arena. Inputs outside the coordinate boundary or route constraints are rejected.

## Compatibility

✓ accepts when ordinary eligibility and resources allow. Lock takes precedence over start. Perception and presentation-only facing are available throughout living states.

| Existing state | Steer or stop | Change posture | Jump | Standard | Precision | Reload | Core |
|---|---|---|---|---|---|---|---|
| Grounded stationary | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Eligible role and radius |
| Walk or run | ✓ | ✓ | ✓ | ✓ | Same packet must stop first | ✓ | Legal start stops old motion |
| Crouched movement | Slow gait only | ✓ | ✓ | ✓ | Same packet must stop first | ✓ | Legal start stops old motion |
| Airborne | ✓ | Locked | Locked | ✓ | Locked | ✓ | Locked |
| Standard winding up | ✓ | If grounded | If grounded | Busy | Busy | Busy | Busy |
| Precision winding up | Stop only | ✓ | Locked | Busy | Busy | Busy | Busy |
| Reload winding up | ✓ | If grounded | If grounded | Busy | Busy | Busy | Busy |
| Core committed | Locked | Locked | Locked | Locked | Locked | Locked | Explicit cancel, unlock next tick |
| Defeated | Rejected | Rejected | Rejected | Rejected | Rejected | Rejected | Rejected |

Movement intent and action can share an input packet. Starting an attack uses the previous legitimate contact and equipment checks. Resolve from the authoritative positions after movement, and report timing and spatial anchors in replay. Existing Core commitment rejects incompatible commands even on the cancellation boundary.

## Controller and scheduler

The strategic interface accepts typed packets, stage guards, conditional alternatives, completion and interruption predicates, finite duration and optional bounded repeats. A validated stage may choose an already-authorized branch at a repeat boundary. The executor reapplies held steering after collision while its lease exists and stops its own movement on lease expiry. The same plan and packet code serves deterministic policy fixtures. Public context and authorized per-side feedback are separate from spectator state and raw provider output. The replay binds attempted packets, channel receipts, authority events and final state. Validated provider plans and request status have separate bounded traces.

The scheduler comparison includes one-sixth cadence, eight-second cadence and a lifecycle-first ten-second backstop. It also tests a reserved-budget variant with the same ten-second backstop and early general requests limited by a time-based allowance. Respawn and public phase can bypass the allowance within the hard cap. The reserved-budget variant is provisionally selected to preserve Score completion in the stress cohort. Lifecycle-first spent fewer uncovered agent seconds in some scenarios, but exhausted the hard budget before the Score deadline across several scenarios. The reserved variant exchanges some uncovered time for full match completion. These are injected-provider data and cannot establish Gemini latency or coaching effects.

| Scheduler | Trials interrupted / 8 | Local requests | Lost agent-seconds including unplayed time after interruption |
|---|---:|---:|---:|
| One-sixth | 0 | 94 | 208.40 |
| Eight seconds | 2 | 106 | 146.00 |
| Lifecycle-first | 3 | 106 | 139.17 |
| Reserved budget | 0 | 92 | 194.97 |

Completion took priority over uncovered time because a technical interruption cannot count as a competitive result. Among the two candidates that finished the cohort, reserved budget had lower uncovered time and fewer requests. The 5/4 profile produced attacks in all 192 Objective and 96 Score matches. Objective outcomes were 62 Activator wins, 127 Defender wins, and 3 draws. Score had 729 respawns. These are deterministic policies with independent role and profile swaps. No timing was changed to compensate for the Objective results.

The protected API reuses the existing guest and application reservation checks and requires the V2.6 preview-only trial token. It can persist a partial v6 replay as interrupted with no winner or reflection. Local tests use an injected provider. The previous hosted evidence showed both reservations consumed until 27 November 2026 at 12:07 ICT. No V2.6 preview token was provisioned during this work, and real generation capacity was unavailable to verify. No genuine model requests, deployment changes or Testnet writes occurred. Compatible memory formatting was tested locally. Genuine reflection and later reuse remain pending.

## Audit dispositions

| Audit item | Disposition and evidence |
|---|---|
| A01 | Corrected locally. Independent contact, retained history, equipment and outcome probes. |
| A02 | Paced renewal tested with injected plans. The exact 8.30 s Blue gap fell to 6.07 s. The worst sampled Score gap remains 7.33 s and executable coverage fell. [Lifecycle comparison](GAMEPLAY_V26_LIFECYCLE.md) |
| A03 | Verified locally. Bounded continuous goals, conditional branch and packet equivalence fixture. |
| A04 | Verified locally. Crouch speed and stand/run transition in the same packet. |
| A05 | Normalized timers and recorded actual resolution. Quantized due times and exact clipped deadline are independently inspectable. |
| A06 | Verified locally. Range crossing resolves from the displaced state and events store both spatial anchors. |
| A07 | Verified locally. Fresh Score life emits contact-enter. Runner queues the first living boundary and respects exhaustion. |
| A08 | Verified in the deterministic fixture and browser. One held key remains accepted while blocked and resumes without another keydown. [Browser evidence](../evidence/gameplay-v26-playtest/browser.txt) |
| A09 | Matched role and policy-side swaps in the range benchmark. Controllers use the shared validator and separate seed. |
| A10 | Phaser drains from a queue independent of React update frequency. Browser evidence records the count across a forced stall. |
| A11 | Local protected API and memory filtering tested. Genuine trial and memory lifecycle blocked by access and quota. V2.6 verifier deferred. |
| A12 | Historical loader unchanged. V5 ordinary-score and baseline regression suite passed. V2.6 prevents repeat defeat events. |
| A13 | Verified locally. Independent channels, grouped inputs and rejection receipts. |
| A14 | Filtered timers and own outcome feedback included. Hidden world fields and unobserved Core progress excluded in fixtures. |
| A15 | Local regression, synchronized scripted playtest, replay reconstruction and browser artifacts recorded. Owner gameplay feel, genuine behavior and production-device performance remain unverified. |

Commands: `npm test` with local PARITY_RPC, `npm run build`, `npx --offline tsx scripts/evaluate-gameplay-v26.ts`, and the cached Playwright CLI for `scripts/gameplay-v26-browser.js`. The V2.6 graybox is available at `/?arena-v26` in Vite development only.

[Tests](../evidence/gameplay-v26/tests.txt) · [Browser assertions](../evidence/gameplay-v26/browser.txt) · [Manual](../evidence/gameplay-v26/manual.webm) · [Objective Duel](../evidence/gameplay-v26/objective-duel.webm) · [Score Deathmatch](../evidence/gameplay-v26/score-deathmatch.webm)
