# Gameplay V2.1 validation

Run the [same local graybox](GAMEPLAY_V2.md#run-the-graybox). New development matches use `arcade-v2.1`; replay import keeps the saved rules and result. V1 remains its own lane ruleset and the BSC Testnet Passport remains V1-only.

## Diagnosis and changes

The seed-3 V2.0 replay had 13 ticks after contact with no tile motion and ten resolved attacks. Attack-first development choices and the single action slot made most firing and reload sequences stationary. The old collision rule also rejected followers entering a tile in the same tick its occupant left. A focused failing test reproduced the rejected follower. V2.1 allows that move while blocking shared destinations and swaps, with both requests resolved from the same snapshot.

A walk can overlap one ordinary shot or one reload. Crouch movement can overlap a reload. Run, jump, observe, peek and precision use exclusive action slots. Reload and fire cannot overlap. Scheduling reads the pre-tick state and applies due actions before simultaneous movement and damage are committed. A collision interrupts the path; a committed shot or reload continues. Defeat and the deadline clear pending work.

Standard and precision intents use one ammo and take two ticks. Standard can hit for 18 or miss. Its near/far chance is 76%/60%. Precision is a separately selected, stationary intent and can hit for 34 or miss, at 40%/30%. Near means distance 1–2 and far means 3–4. Legal range and sight are rechecked at completion. Near expected damage is 13.68 versus 13.6, and far expected damage is 10.8 versus 10.2. Standard is more reliable and compatible with walking. Precision gives a higher one-action ceiling. Playtesting still needs to establish how often that trade-off matters.

## Comparison

Run `npx --offline tsx scripts/evaluate-gameplay-v21.ts`. The same seeds 0–79 and both policy assignments produce 160 matches per configuration. [Full machine-readable comparison](../evidence/gameplay-v21/balance.json)

| Measurement | V2.0 | V2.1 candidate |
|---|---:|---:|
| Blue / Sand / draw | 58 / 77 / 25 | 67 / 75 / 18 |
| Reached final tick | 100 | 94 |
| Decision by deadline, excluding defeat on final tick | 96 | 88 |
| Mean duration | 32.425 ticks | 39.725 ticks |
| Mean first resolved shot | 15.75 | 9.3625 |
| Tile steps / distinct destinations | 2,629 / 17 | 4,474 / 19 |
| Share of ticks with no movement | 69.8% | 59.9% |
| Matches with a stationary stretch over ten ticks | 42 | 16 |
| Longest stationary stretch | 22 ticks | 24 ticks |
| Move collisions | 351 | 538 |
| Repeated decisions | 1,007 | 761 |
| Miss / standard / precision outcomes | 574 / 876 / 133 | 754 / 937 / 165 |

The older 100 figure counted all matches at tick 36, including four defeats. V2.1's 94 at tick 44 include six defeats. Choice adjustments alone increased actual deadline decisions to 119. A 36-tick prototype with overlaps but the old occupied-tile rule produced 129 deadline finishes, and extending that prototype to 44 reduced the count to 109. Enabling vacated-tile moves reduced it further to 88. The unadapted development choices under the final mechanics yielded 54 deadline decisions but 56 matches with long stationary stretches. The selected policy comparison illustrates a trade-off between movement and decisive endings. Health and damage values stayed the same.

Baseline identical policies at seeds 0–499 yielded Seek 217/181/102 and Roam 226/204/70. V2.1 uses the seed's high bit to swap the two rolls generated from its lower 31 bits. Identical Seek yielded 219/203/78 and 203/219/78 with swapped rolls. Roam yielded 196/202/102 and 202/196/102. Both pipelines were checked tick by tick. The same paired check with opposing styles and swapped starting sides yielded 37/35/8 and the exact reverse. This checks structural symmetry under the sampled transcripts. It does not establish fairness for strategic play across every seed or map.

## Planner, persistence and gate

V2.1 requests from each eligible agent every five authoritative ticks, up to nine checkpoints. Each plan contains up to three distinct action indices from that observation's legal choices. A chosen intent is used at most once and only if still legal. Continuing an existing action or holding is allowed when no selected choice applies. The controller does not pick alternative attacks, targets or destinations. Plans expire at the next checkpoint. The shared per-match request cap remains 20 including retries, with an abort on provider 429.

The preview-only candidate accepts an explicit V2.1 request through the existing guest and origin checks plus a server-side trial token. It uses the existing shared reservation, locking seed and rules before inference. JSONB already carries versioned configurations and replays. V1 memory remains isolated from V2.1, which starts at revision zero on both sides. V2.1 reflection is deferred. Local HTTP/SQLite tests and the existing migration exercised in Postgres verify versioned records, authorization, idempotency, quota and recovery. The hosted candidate is unprovisioned and the public release has not changed.

At 13:09 ICT on 26 November the hosted application had two active reservations. The first could age out at 12:07:11 ICT on 27 November. Gemini model metadata authenticated, while project-specific generation quota was unavailable with the current credential access. No keys rotated, no budget was raised and no generation was attempted. [Gemini rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits)

Local Playwright captured an ordinary decision by HP, a mobile double-defeat draw and an unusual early precision finish. These are development policy recordings. See [evidence](../evidence/gameplay-v21/). Movement resumes after some contacts, though prolonged exchanges remain visible. Keep the gameplay gate open for a protected genuine match and a follow-up pacing assessment. The 44-tick bounds and independent due events will require a compatible future Solidity verifier.
