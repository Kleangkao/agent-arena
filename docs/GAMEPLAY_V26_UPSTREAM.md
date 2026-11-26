# V2.6 upstream intelligence experiment

26 November 2026 ICT · Local injected-provider evidence

## Decision

Retain finite plans with paced renewal. The smallest promising candidate is explicit reentry in the existing ordered-stage executor. It improved pooled Score continuity, with lower complexity than either a state machine or Behavior Tree. It also changed six paired Objective results and reduced activity in the ordinary Score cohort. Genuine model behavior and owner acceptance are open.

The benchmark matched 32 archived paced-renewal rows on every deterministic timing and count field, interruptions and results. The archived seed-12 Score retry replay matched byte-for-byte under JSON serialization. The independent simulation, mode configuration, replay format and original master specification retain their prior hashes. No rules tuning or external release was performed.

## Comparison

The matched primary Score cohort has 25 completed rows per arm and one deliberately interrupted 429 row per arm. Values below use completed pairs. Percentages divide elapsed units by living agent-time. The machine-readable summary also includes the interruptions, matched controls and all other scenarios.

| Score arm | Infrastructure idle | Worst idle gap | Executable | Attempts |
| --- | ---: | ---: | ---: | ---: |
| Finite paced renewal | 17.75% | 7.33 s | 31.09% | 452 |
| Persistent ordered stages | 7.69% | 5.27 s | 34.46% | 358 |
| Persistent state machine | 8.14% | 5.57 s | 33.05% | 363 |
| Persistent Behavior Tree | 8.33% | 5.50 s | 32.99% | 365 |

Ordered reentry reduced Score idle by **10.06 percentage points**, about **57% relative**, and the worst gap by **2.07 seconds**, about **28% relative**. The absolute pooled gap missed the exploratory two-second target. The ordinary Score subset started at 0.20% idle. Ordered reentry removed that idle and reduced attempts from 146 to 75, while executable activity fell from 46.49% to 43.77%. The 30-second arm used 53 attempts in that same ordinary subset with zero infrastructure idle and 43.59% executable activity. Longer authorization reduced requests further with little continuity gain over 20 seconds in that subset.

The 24-row matched Score scope ablation let explicitly authorized contracts restart at their entry after respawn. Ordered stages changed from 8.01% life-scoped idle to 7.43% match-scoped idle on those pairs, with a 4.90-second match-scoped worst gap and 40 distinct side/revision/life resumptions. The match-scoped state machine and tree also reached 4.90 seconds. All three completed those 24 rows. Each kept the original expiry and reevaluated fresh legitimate observations after clearing prior-life execution state.

In Objective Duel, the four primary arms completed 25 rows each and had zero infrastructure idle. Each also recorded two intentional fault-injection interruptions separately. Compared with the same finite pairs, the ordered, state-machine and tree arms changed six, two and four results respectively. Pipeline correctness does not turn these changed outcomes into a gameplay acceptance pass.

Using earlier requests under the same hard limit removed measured idle before interruption, but exhausted the budget in **12 of 24 Score runs** at 45.0–62.3 simulated seconds. The lack of idle in those truncated runs is not a continuity win. In the injected 80 ms Score run, preparation was approximately 1.7 s finite and 0.9–1.0 s persistent on this machine. The forced request timeout followed by a 429 took approximately 8 s and interrupted at tick zero. These are synthetic provider timings, with no inference or production latency claim.

## Findings by hypothesis

- **H1 · Finite authorization.** Supported for the stress and combined Score cohorts. The wrapped ordered controller without reentry reproduced virtually the same gaps as finite plans. Reentry made the largest measured change with the same scheduler and packet vocabulary. The ordinary set had little idle to recover.
- **H2 · Scheduling.** Contributes to the gaps. Moving requests earlier trades the pauses for budget exhaustion. The life-scope ablation shows a separate cost to clearing otherwise useful authorization on defeat.
- **H3 · Representativeness.** Remains open for model behavior. The prior stress cohort had 27.73% idle and the new ordinary finite subset had 0.20%. The continued early-round movement and reload scripts in ordinary fixtures are authored test behaviors.
- **H4 · Expressiveness.** Partially supported. Core commitment, phase-guarded cancellation, distinct wait preferences, contact-guarded disengagement and moving reload use the shared input authority. Matched fixtures show that a public phase guard does not distinguish legal cancellation from having no commitment. The filtered view exposes `legal.cancel`, `legal.precision` and time-stamped history, while the condition vocabulary lacks corresponding predicates. A local cancellation predicate probe eliminated the rejected action without changing engine rules. These predicates were kept outside the main benchmark. Model comprehension remains unmeasured.
- **H5 · Strategic ownership.** Supported on deterministic local fixtures. Reentry, priorities, guard changes and post-respawn entry come from the accepted specification. The state machine and tree did not produce a better Score continuity result than ordered stages under equal scope. The tree took roughly 3 microseconds at the Score per-trial p95 compared with about 1 microsecond for the other candidates, a small local difference.

## Verification and artifacts

- `npm exec --offline -- tsx scripts/evaluate-v26-upstream.ts` produced **396 trials** and verified **107,929 attempted packets** against reconstructed replays and authorization records. There were **92 rejected input-channel receipts**, preserved as evidence, and **zero packets outside recorded authorization or the movement-lease rule**. Mixed packets can contain one authorized action plus a lease release, which the verifier accounts for separately. Match-scoped trials authorized 1,760 packets across life changes. [Rows](../evidence/gameplay-v26-upstream/rows.json) · [Summary](../evidence/gameplay-v26-upstream/summary.json) · [Ordered cross-life sample](../evidence/gameplay-v26-upstream/ordered-match-retry.json)
- `npm test` with loopback Hardhat passed **130 tests in 25 files**, including V1 Solidity parity. Both builds passed with the existing bundle-size and browser externalization warnings. Reconstructed **38** stored v3–v6 replays. [Test log](../evidence/gameplay-v26-upstream/tests.txt) · [Historical replays](../evidence/gameplay-v26-upstream/historical.txt)
- Chromium reloaded and reimported the finite injected Objective replay, crossed a 1.1-second forced stall and rendered **108 of 108 events**, Blue Core completion at tick 384, with zero API requests or page errors. A separate manual run exported a synchronized 97-boundary trace with a visible moving reload. The sandbox is diagnostic graybox art. The owner's original close-proximity report remains open. [Replay screenshot](../evidence/gameplay-v26-upstream/replay.png) · [Manual reload screenshot](../evidence/gameplay-v26-upstream/manual-reload.png) · [Browser log](../evidence/gameplay-v26-upstream/browser.txt)

## Protected live validation

The shared reservation was **2/2 at 18:32 ICT**, with the earliest expected release at **12:07 ICT on 27 November**. Metadata confirmed generation support for `gemini-3.5-flash-lite` using the existing local credential, privately matched against the earlier vault. The newly referenced key and its active Free project limits are unverified. The Windows launcher provisioned an ignored DPAPI operator token. The live CLI stopped before generation because the named local Gemini and Supabase service configuration was unavailable. Neither a live probe nor a duel was run. [Access evidence](../evidence/gameplay-v26-upstream/access.txt)

`npm exec --offline -- tsx scripts/validate-v26-upstream-live.ts inspect` validated a frozen pending Objective snapshot with legitimate historical contact, no current contact and four transport schemas without credentials. For an authorized live run, set `GEMINI_V2_API_KEY`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the local secret environment. Supply an ignored `.arena-data/v26-upstream/capacity.json` with fields `project`, `model`, `tier` (Free), `verifiedAt` (UTC), `rpm`, `tpm`, `rpd` and `keyProjectVerified` (true). Attest the live project's available capacity and key association in AI Studio. The CLI checks the local attestation and authenticated model metadata before calling the existing atomic shared reservation. Use `scripts/validate-v26-upstream-live.ps1 -Mode Probe` for the two matched finite generation calls. The persistent probe gate remains closed. After owner gameplay acceptance and a separate reservation, `-Mode Duel` with `ARENA_V26_UPSTREAM_DUEL_ACCEPTED=yes` runs one finite paced Objective match. No deployment, spending, chain write or reflection was performed. [Probe dry run](../evidence/gameplay-v26-upstream/probe-dry-run.txt) · [Provider rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) · [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
