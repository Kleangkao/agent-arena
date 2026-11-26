# Challenge Mode

The public Play screen defaults to Challenge. Pick a mode and difficulty, coach a Gemini commander, watch the deterministic match, then review orders and revise the strategy. Results stay in the current browser. Only genuine completed challenges count toward the highest defeated difficulty. AI Duel uses two Gemini commanders. Private two-player rooms remain future work.

Arena Bot v3 uses the same game state, equipment, health and speed as the player. Every difficulty authorizes pulses and can disable an armed Core. Easy uses a predictable formation and a limited Core response. Normal covers both objectives and reinforces the Core. Hard adjusts assignments using pressure, unit health and control. For Relay and Team Deathmatch it evaluates at most five legal formations for a single window against three plausible opposing formations, using no private opposing orders. Bot planning makes zero Gemini calls. Replay v7 recognizes historical v1 and v2 policy identifiers as well as v3.

## Difficulty evidence

Twenty-seven deterministic 5v5 matches used the same spawns and split, north and south reference formations. Rows give Sand wins out of three, then draws in parentheses where present.

| Mode | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Relay | 1 | 1 | 1 |
| Bomb | 1 | 1 | 1 |
| Team Deathmatch | 2 | 2 (1) | 2 (1) |

Outcomes differ within those totals. Normal won Bomb against split at tick 48, while Hard won against north at tick 42. The old split trial ended at tick 32 across all three policies. Easy had no Core interaction and Normal and Hard only swarmed the objective after activation. Under v3, all levels can authorize a disable, and Bomb no longer always ends the same way. Hard Relay lost the split trial by elimination 9–4 at tick 26, beat north 58–46 and narrowly lost south 55–57. Territory points are insufficient to prevent elimination. Team Deathmatch shows stronger coordination in specific matchups, including Hard beating split 7–3 versus Normal 5–2. These three reference formations do not establish reliable difficulty ordering. [Complete 27-match comparison](../evidence/challenge-release/reference-matrix.json)

## Genuine matches and verification

The hosted traversal for Normal Relay used `gemini-3.5-flash-lite`. Initial preparation took 4,508 ms and the revised same-setup rematch took 2,612 ms. Each completed with three accepted Gemini plans and three deterministic bot decisions. Sand won both by elimination, at ticks 28 and 26. The changed coaching and orders are observable, and two runs do not establish causality. This capture uses policy v2. [Genuine trace](../evidence/challenge-release/relay-normal/hosted-live.json) · [Recording](../evidence/challenge-release/relay-normal/hosted-live.webm) · [Mobile play](../evidence/challenge-release/relay-normal/hosted-live-battle-mobile.png) · [Rematch review](../evidence/challenge-release/relay-normal/hosted-live-rematch-comparison.png)

The current production policy v3 also completed Easy Bomb (Blue, tick 32, three accepted Gemini plans, 2,405 ms) and Normal Team Deathmatch (Sand 2–0, tick 48, four accepted plans, 2,576 ms). The Easy Bot reached the armed site and began a disable before the countdown ended. Both traces reconstruct the stored outcome and report no Sand model usage. [Easy Bomb](../evidence/challenge-release/bomb-easy/hosted-live.json) · [Normal Team Deathmatch](../evidence/challenge-release/tdm-normal/hosted-live.json)

Hard Relay on the final deployment completed with Sand winning 20–3 by elimination at tick 34. It took 2,225 ms and three accepted Blue model plans. The public browser run verified the stored result, private review, strategy revision, historical #2933 proof, challenge history after refresh and all three inference-free practice modes. It reported no browser errors. [Final trace](../evidence/challenge-release/final/hosted-live.json) · [25-second demo](../evidence/challenge-release/final/challenge-demo.mp4) · [Mobile review](../evidence/challenge-release/final/hosted-live-review-mobile.png)

The first v3 launch returned HTTP 429 at match admission and used no inference. The logged failure is preserved. The shared pacing and in-flight limits still apply. [Admission trace](../evidence/challenge-release/admission-429.json)

Run `npm run build` and `PARITY_RPC=http://127.0.0.1:8545 npm test` with local Hardhat listening. The browser harness accepts `ARENA_QA_ORIGIN`, `ARENA_QA_MODE` and `ARENA_QA_DIFFICULTY`. With `--live`, it creates a genuine match, keeps the trace, reconstructs the result, checks that only Blue used inference, and verifies the review. Space genuine runs to respect the shared capacity limits. `--verify-public` independently rechecks the historical #2933 evidence from the browser. `--practice` exercises all modes using zero inference.

The historical ERC-8004 record still verifies. Challenge replay commitments bind opponent id, difficulty, policy, mode, rules and outcome through the transcript. The current Challenge matches used guest entries. No new identity association or Testnet write was made. The squad engine computes results off-chain.


## Release audit

The public Vercel deployment is `dpl_7ViTgmtQRzP9Qze2HJ3SMdMCqb8h`. Hosted health returned 200, an unauthenticated same-origin match request returned 401, and cross-origin guest creation returned 403. Local port 3001 was restarted with the current build and encrypted local Gemini configuration.

The build and all 183 tests across 38 files passed, including Solidity parity. The production dependency audit reported zero advisories. The full audit still reports three high-severity development findings involving Hardhat, its zod utilities and zod. Lockfile license metadata reports MIT, Apache-2.0, BSD-3-Clause, ISC, MPL-2.0 and 0BSD. The only omission, solc's development dependency memorystream, ships an MIT-style license. Asset credits document original project artwork and SIL OFL fonts. The public repository starts from a reviewed snapshot, omitting historical commit metadata. Common credential-signature checks found no matching text in the eight reachable historical commits or the reviewed snapshot. Project-wide licensing remains an owner decision.
