# Gameplay V2.5

This owner-approved amendment adds Score Deathmatch, refines the experimental Objective Duel, and keeps Legacy Elimination available in the developer sandbox. The master specification §§00–50, prior amendments, public V1, historical replays and confirmed V1 Testnet record remain authoritative in their original scope. V2.5 uses an original, fictional single-site Core and the existing top-down development graybox.

## Reference game research

| Reference | Documented game rules | Design takeaway |
| --- | --- | --- |
| CS:GO Competitive and Majors, December 2015 | Valve set 1:55 for the round and 40 s for the active objective. | The phase clocks serve different purposes. [Valve winter update](https://blog.counter-strike.net/2015/12/13288/) |
| CS2, Gamers Assembly 2026 configuration | The tournament specifies competitive round setting 1.92 and an active objective clock of 40 s. These are event settings. | Cite the ruleset and configuration when comparing timings. [Tournament regulations](https://backoffice.gamers-assembly.net/sites/default/files/tournament/GA2026%20-%20Rules%20-%20CS2%20v1.3.pdf) |
| VALORANT Competitive | The community reference lists a 100 s round, 45 s active clock, 4 s activation, 7 s disable, and one retained checkpoint at 3.5 s. Riot documents the 12-round side swap and paired-role overtime. | Activation, active clock and disable can be tuned independently. Distinct progress and timer signals clarify why a round ends. [Competitive reference](https://wiki.playvalorant.com/en-us/Competitive) · [Objective reference](https://wiki.playvalorant.com/en-us/Spike) · [Riot beginner guide](https://playvalorant.com/en-gb/news/announcements/beginners-guide/) · [Riot patch 1.03](https://playvalorant.com/en-gb/news/game-updates/valorant-patch-notes-1-03/) |
| VALORANT Team Deathmatch, launch rules | Riot documents 9:30, first to 100, a 1.5 s respawn, and a score win or draw on expiry. | Respawn, score target and deadline work as separate rules. [Riot Team Deathmatch 101](https://playvalorant.com/en-us/news/game-updates/valorant-team-deathmatch-101/) |

The objective reference games support choosing a site on multi-site maps. Site choice can disperse attention. Here both agents can see the location of the one Core on Dust Yard, which makes reaching and contesting its zone faster. The VALORANT reference also distinguishes pending victory by elimination or time from active victory by objective completion or disabling. The sources above do not establish stable, equivalent interruption, interaction or exact deadline behavior for every Counter-Strike version and server configuration. Arena uses its own complete ordering and zero retained progress. [VALORANT mode rules](https://wiki.playvalorant.com/en-us/Custom_Game)

## Objective Duel

The V2.4 source fixes the pending deadline at 58,080 simulation units (19.36 s), sets an 18,000-unit active clock at activation (6 s), and uses 2,700 units (0.9 s) for each interaction. One tick is 100 units at 30 Hz. The Core is available from match start to the assigned Activator and from activation to the Defender. The center is (26730,20790) with inclusive Manhattan radius 4000. Identical base attributes and mirrored starts are independent from roles, player identity, coaching and model. Moving slowly within the zone, changing posture and observing are compatible. Leaving the zone, running, jumping, attacking, reloading, peeking, explicit cancellation or defeat interrupts and clears progress. Nonlethal damage did not cancel. Progress begins at the preceding boundary of the accepted input and is tested on every authoritative update. The deadline can have a partial final tick.

The V2.5 provisional default, named long-disable in the sandbox, keeps the 19.36 s pending clock and uses an 8 s active clock with 3 s to activate and 3 s to disable. Timing controls also offer the V2.4 reference, the same timings with current defeated-agent handling, isolated longer activation or active clock, 3 s activation with 2 s disable and either 8 s or 12 s active, and a 12 s diagnostic with damage cancellation. The default still allows nonlethal damage during interaction. Combat resolves first, invalid interactions have no effect, and unaccepted inputs are rejected by the authoritative API. No transition is legal after settlement.

| Phase/event | Result |
| --- | --- |
| Pending deadline without successful activation | Defender wins by preventing activation. |
| Valid activation, including exactly at pending deadline | Core becomes Active and gets its own clock. |
| Pending single or simultaneous defeat | Survivor wins or both draw. A defeat on the completion tick takes precedence. |
| Active Defender defeat, including a simultaneous defeat | Activator wins by elimination. |
| Active Activator defeat alone | Core persists. In current variants the defeated agent no longer blocks, appears as a live contact or fires. |
| Successful disable, including exactly at active deadline | Defender wins by disable. |
| Active deadline without a legal disable | Activator wins by Core completion. |
| Explicit or incompatible interruption | Progress resets without changing phase. If the deadline also expires, the phase deadline rule applies. |

The diagnostic reproduction is test/gameplay-v25.test.ts. An already defeated Activator remained in the historical world step and generated defeat events every tick. Before the change the regression also allowed the Defender to select the defeated opponent for attack. The corrected V2.5 reference emitted 39 defeat events vs 1,444 in the historical reference, with the same 262/320 and 58/320 role outcomes. This instrumentation establishes a real event/lifecycle defect and separates it from the primary role skew. The exact historical reference preserves its previous transcript interpretation.

All objective rows below use 80 seeds, two profile assignments and two role assignments per seed. Only the final two rows use additional pre-activation Defender pressure. The same participant identities and profiles are held across role swaps. Details for all 14 experiments are in the benchmark.

| Configuration | Active / activate / disable (s) | Activator wins | Activated / disabled / completed | Median / P90 (s) |
| --- | --- | ---: | --- | --- |
| V2.4 reference | 6 / 0.9 / 0.9 | 262/320 | 320 / 58 / 250 | 8.67 / 11.77 |
| Fixed defeat events, original clocks | 6 / 0.9 / 0.9 | 262/320 | 320 / 58 / 250 | 8.67 / 11.77 |
| Longer activation only | 6 / 3 / 0.9 | 162/320 | See benchmark | 10.77 / 13.87 |
| Longer active clock only | 12 / 0.9 / 0.9 | 79/320 | See benchmark | 10.60 / 16.00 |
| Compact duel | 8 / 3 / 2 | 118/320 | See benchmark | 12.77 / 15.67 |
| **Selected** | **8 / 3 / 3** | **162/320** | **320 / 158 / 145** | **12.77 / 15.87** |
| Original timing with Defender pressure | 6 / 0.9 / 0.9 | 238/320 | See benchmark | 9.10 / 12.63 |
| Selected timing with Defender pressure | 8 / 3 / 3 | 145/320 | 91 / 65 / 21 | 10.93 / 14.00 |

Longer activation gives the other agent more time to reach the site. Longer active time benefits that agent in the subsequent phase. The second policy is a stronger intervention than changing phase text. Under the selected timings it reduces Core activations from 320 to 91, trading goal interactions for 221 elimination wins and 13 draws. Two original policies scored 82/160 Blue Activator wins and 80/160 Sand Activator wins under the final default. Of 160 role-swapped pairs, 60 favored Activators twice, 58 favored Defenders twice and 42 split by role. Pooling rounds by agent produced 118 tied series, 22 Blue series wins and 20 Sand series wins. The selected default produced 90 cancellations, 17 elimination outcomes, 3,584 resolved attacks, 51.65% hit rate and 7.55% idle living agent-time. There were zero no-attack matches for that sample. A legitimate pending timeout is retained as a regression fixture. These paired policy findings do not measure provider behavior or universal balance.

## Score Deathmatch

Target choices are 5, 10 and 20, with 45 s, 75 s and 120 s clocks. First to 5 with a 75 s deadline is the provisional default. An opposing defeat gives one point. Simultaneous defeats both count before settlement. Equal score when both reach the target, or on timeout, draws. A score that reaches the target at the deadline settles by target. Otherwise higher score at the deadline wins. Both input and playback end at the single terminal result. Interrupted model preparation has no authoritative final score or completed replay.

A nonterminal defeat schedules respawn 1.2 s later. The simulation prefers each original home and then a symmetric ordered set of valid alternate cells if the live opponent occupies it. A defeated participant cannot keep acting or block the living opponent. On respawn health, ammunition, posture and temporary movement, combat and contact states reset. The participant and match configuration, score, coaching and memory revisions remain unchanged. There is no immunity window. Repeated deaths score once each and at most 3,600 ticks execute under any supported clock.

| Target × clock | Target wins / clock wins / draws (64) | Median / P90 (s) | Respawns |
| --- | --- | --- | ---: |
| 5 × 45 s | 3 / 33 / 28 | 45.00 / 45.00 | 375 |
| **5 × 75 s** | **63 / 0 / 1** | **59.77 / 68.13** | **485** |
| 10 × 75 s | 0 / 40 / 24 | 75.00 / 75.00 | 664 |
| 10 × 120 s | 18 / 33 / 13 | 120.00 / 120.00 | 1,072 |
| 20 × 120 s | 0 / 50 / 14 | 120.00 / 120.00 | 1,098 |
| 5 × 75 s, legacy policy | 0 / 17 / 47 | 75.00 / 75.00 | 70 |

In the final 64 seed/profile matches the median score margin was one, 39 finished one point apart, and one ended 4–4. There were 548 points, 542 score changes after coalescing simultaneous points, 4,860 resolved attacks, 53.81% hit rate and 14.42% idle living agent-time. The development policies use filtered contact, public waypoints and distinct preferences in the fictional rules. They do not change their personalities based on the score. The legacy-policy control had 28 scoreless draws and 18 matches without a resolved attack. The improved scoring frequency comes from policy choices. Whether genuine Gemini changes strategy when leading or trailing remains open. The default shows multiple score changes and leaves enough clock for a comeback. The recorded 45 s clock win and 75 s draw show that timeouts still produce understandable outcomes.

## Shared engine, sandbox and replay

V2.5 adds mode configuration and settlement around the existing 30 Hz fixed-point world. Continuous movement, interruption, collision, seed-based fictional combat, posture, jumps, ammunition and reload stay in the common engine. Phaser consumes the reconstructed frames and actual events. V5 replay binds participants, map, mode, rules, seed, role and/or score configuration, initial state, inputs, transitions, final state and reason. The loader reconstructs the match, rejects changed events and results, and does not call the AI. Older loaders remain available. An imported source label is a claim made by that file and does not authenticate model provenance.

Local routes are /?arena-modes and /?gameplay-v25. Append &mode=score-deathmatch or &mode=elimination to start there. The V2.5 viewer imports version 5 JSON, while the older dev routes continue to load their respective editions. WASD or arrows move, Shift runs, C toggles crouch, Space jumps, F attacks, P uses precision, R reloads, E observes, Q peeks, X uses the Core and Z cancels. The sandbox exposes fixed seed, mode, target, clock, role, timing experiment, reset, state overlay and terminal capture. The replay viewer supports pause, resume, skip, import, save and refresh recovery.

## Genuine trial boundary

The versioned prompt separates own agent state, filtered world contact, public Match Context and coaching/memory revision. It supplies candidate intents plus current eligibility. Gemini selects up to four ranked choices with bounded repetitions. The interpreter reevaluates eligibility, expires the choices at the next checkpoint or defeat, and substitutes no strategy. Requests use one snapshot per checkpoint, with independent Blue and Sand calls in parallel. The default intervals are 4 s of simulation time for Objective Duel and roughly 8.34 s for the 75 s score game. Maximums are 10 requests per side, 20 total, one retry per checkpoint, 8 s per request and 60 s total. A 429 interrupts. Stored receipts include accepted intents, leftovers, status, game context and coaching/memory revisions. The reserved trial route locks a server-generated seed, rules, participants and mode. It requires the existing guest and origin checks and an additional private preview token. Local tests inject provider responses to check the protocol boundary.

Hosted read-only usage was 2/2 rolling reservations at 15:00:36 ICT on November 26. Earliest rollover is 12:07:11 ICT on November 27. The authenticated metadata response identified models/gemini-3.5-flash-lite and listed generateContent. Actual generation capacity remains unknown. No live V2.5 generation, retries, reflection or provider behavior were observed. The new preview token is a configuration gate. No V2.5 preview was deployed. The runner starts with empty V2.5 memory because historical lane lessons have no compatibility guarantee. Compatible versioned lessons pass the prompt tests. The V1 hosted reflection and subsequent reuse attempt remain independently documented. V2.5 match reflection, revision storage and genuine coaching comparison remain pending.

## Evidence and release boundary

- Headless tests reconstructed 4,864 matches and verified 64 exact horizontal mirror pairs. The V2.4 reference reproduces every world frame of 320 historical-policy matches. [Benchmark](../evidence/gameplay-v25/benchmark.json)
- Chromium completed 14 recorded matches and matched their terminal states to the replay files. The 390 px viewer had no horizontal overflow. Replay pause, resume and refresh recovery worked with zero API calls. A separate manual check observed a point and the defeated agent's return at full health. The graybox uses colored dots and geometric obstacles. [Browser results](../evidence/gameplay-v25/browser.json) · [Manual Deathmatch](../evidence/gameplay-v25/manual-score-browser.json) · [Recordings and fixtures](../evidence/gameplay-v25/)
- Existing V1 public play and the independent BSC Testnet Passport stay available. V2.5 remains local and unverified on-chain. Any future verifier needs to bind fixed-point coordinates, seeded resolution, bounded tick count, same-tick ordering, score, respawn, objective timing and the transcript. A hash alone only commits to bytes. [Hosted usage and Passport](../evidence/gameplay-v25/integration.json) · [Public practice result](../evidence/gameplay-v25/v1-public-practice.png)
- Rerun with `npx --offline tsx scripts/evaluate-gameplay-v25.ts`, the Playwright CLI script at scripts/gameplay-v25-browser.js, `npm test` with PARITY_RPC pointed at local Hardhat, `npm run build`, `npm run build:preview`, and `node scripts/check-postgres.mjs` with the local PGlite fixture directory. All 100 tests passed. The client builds retain their existing vendor chunk-size and browser externalization warnings. [Test results](../evidence/gameplay-v25/tests.txt)

The next genuine evidence is one protected Objective Duel after the shared reservation opens and preview authorization is configured, followed by Score Deathmatch if allocation allows. The local mechanics are ready for that experiment. Graybox recordings can establish phase readability and interaction behavior. They cannot establish audience enjoyment, coaching effectiveness or provider strategy.
