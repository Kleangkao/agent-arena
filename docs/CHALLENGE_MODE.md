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

Outcomes differ within those totals. Normal won Bomb against split at tick 48, while Hard won against north at tick 42. The old split trial ended at tick 32 across all three policies. Easy had no Core interaction and Normal and Hard only swarmed the objective after activation. Under v3, all levels can authorize a disable, and Bomb no longer always ends the same way. Hard Relay lost the split trial by elimination 9–4 at tick 26, beat north 58–46 and narrowly lost south 55–57. Territory points are insufficient to prevent elimination. Team Deathmatch shows stronger coordination in specific matchups, including Hard beating split 7–3 versus Normal 5–2. These three reference formations do not establish reliable difficulty ordering.

## Genuine matches and verification

The hosted traversal for Normal Relay used `gemini-3.5-flash-lite`. Initial preparation took 4,508 ms and the revised same-setup rematch took 2,612 ms. Each completed with three accepted Gemini plans and three deterministic bot decisions. Sand won both by elimination, at ticks 28 and 26. The changed coaching and orders are observable, and two runs do not establish causality. This capture uses policy v2. [Genuine trace](../evidence/challenge-release/relay-normal/hosted-live.json) · [Recording](../evidence/challenge-release/relay-normal/hosted-live.webm) · [Mobile play](../evidence/challenge-release/relay-normal/hosted-live-battle-mobile.png) · [Rematch review](../evidence/challenge-release/relay-normal/hosted-live-rematch-comparison.png)

Run `npm run build` and `PARITY_RPC=http://127.0.0.1:8545 npm test` with local Hardhat listening. The browser harness accepts `ARENA_QA_ORIGIN`, `ARENA_QA_MODE` and `ARENA_QA_DIFFICULTY`. With `--live`, it creates a genuine match, keeps the trace, reconstructs the result, checks that only Blue used inference, and verifies the review. Reserve live testing capacity before running that command. `--verify-public` independently rechecks the historical #2933 evidence from the browser. `--practice` exercises all modes using zero inference.

The historical ERC-8004 record still verifies. Challenge replay commitments bind opponent id, difficulty, policy, mode, rules and outcome through the transcript. The current Challenge matches used guest entries. No new identity association or Testnet write was made. The squad engine computes results off-chain.
