# Squad Arena

The 26 November 2026 owner amendment moves current gameplay to one human coaching one commander for a whole team. The original master specification and historical duel formats remain preserved. The pre-change checkpoint is `8ae3979` on `codex/arena-before-squads`.

## Play

Relay Yard is an original 27×15 grid with mirrored five-unit spawns, two separated 3×3 relays, walls that block movement and sight, and marked cells that halve incoming pulse damage. A relay scores for the only team with living units in it. The first team to 24 wins. At 48 ticks the higher score wins, and equal scores draw. Elimination can end the match earlier. Both sides start with equal unit health and the same automatic pulse mechanics. The full board is public to both commanders.

Each commander receives the same checkpoint state every 12 ticks, its own coaching, and the public terrain. It can hold each slot, assign a destination, or assign two ordered waypoints. The engine finds routes, handles occupancy and simultaneous pulses, and reports per-unit blocking and health at the next checkpoint. Both plans must validate before they are applied. Model errors can receive one correction at the same snapshot, with a four-retry match cap. A technical interruption has no winner.

Default guest practice is scripted and clearly labeled. Arena offers Gemini 5v5 when enabled, same-setup rematches for the current rules, and a genuine recording playable without new inference. Playback uses validated version 7 transcripts. Current `squads-v2` rules give one friendly mover a rotating priority when teammates want the same free cell. Cross-team claims still cancel. Historical `squads-v1` recordings preserve their original movement.

Design references were the geometry and unit-level calls in [Screeps Arena's developer documentation](https://arena.screeps.com/docs/), simultaneous bounded planning from [Mode 7's Frozen Synapse](https://store.steampowered.com/app/98200/Frozen_Synapse/), and visible waypoints from [KillHouse Games' developer notes](https://store.steampowered.com/news/posts/?appgroupname=Door+Kickers+2&appids=1239080&enddate=1646059499&feed=steam_community_announcements). The map, visuals, and mechanics are original.

## Evidence recorded 26 November

| Live run | Rules | Preparation | Requests | Engine result |
| --- | --- | ---: | --- | --- |
| Initial attempt | squads-v1 | 0.137 s | 2 HTTP 400 | Interrupted before tick 1. The key suffix failed authentication. The full authorized entry worked. |
| North coaching | squads-v1 | 5.902 s | 8 accepted | Sand 16–7 at tick 48. |
| South coaching | squads-v1 | 7.158 s | 5 accepted, 1 invalid | Interrupted at tick 24. |
| South same-setup retry | squads-v1 | 18.057 s | 8 accepted, 1 HTTP 503 | Sand 21–0 at tick 48. |
| North coaching | squads-v2 | 18.554 s | 6 accepted, 1 invalid then corrected | Sand 24–21 at tick 34. Both relays scored during the match. |

The model was `gemini-3.5-flash-lite` on both sides. In the same-setup v1 comparison, Blue's accepted opening assignments changed from four North and one South to four South and one North. Both complete runs ended in a Sand win. Sand's generated plans differed too, so the comparison establishes an observed change in assignments, with outcome influence and repeatability still open. On v2, Sand initially targeted the wall at 13,7. Gemini received the validation error and generated a legal replacement. The v2 South rematch hit the application's 20-match rolling daily limit before a provider call. The budget stayed in place.

Under v1, two Blue units in the South opening stalled at spawn for a whole checkpoint. With the same model-authored opening dispatched offline against v2, zero stayed at spawn and Blue's blocked unit-ticks fell from 38 to 8. This isolates the movement change from new model output. The fixed v2 scripted split-versus-north comparison finished for 3/5/10/20 units per side. Warm p95 engine plus replay time stayed under 6 ms for each size over 30 samples. The 20v20 fixture ended with 12 blocked survivors. Keep 5v5 as the provisional default because it has genuine model and mobile evidence. One scripted scenario does not establish size balance or human preference.

Executing the two genuine Blue openings under v2 against one fixed, genuine Sand opening also produced different positions and scores at tick 12. North coaching reached 2–2 with four Blue survivors, and South coaching reached 0–2 with all five. This is an offline comparison of previously generated orders.

- [Model orders, request receipts and validated replays](../evidence/squads/model-matches.json)
- [Offline collision and team-size comparison](../evidence/squads/offline-comparison.json)
- [Current recorded Gemini match video](../evidence/squads/current-5v5.webm)
- [Desktop live match](../evidence/squads/current-live-playback.png) and [mobile practice](../evidence/squads/practice-mobile.png)

## Launch and release scope

Run `npm run dev` for practice and recorded gameplay. Enable live local squads by setting server-side `ARENA_LOCAL_SQUADS=1`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. A Vercel Preview can opt in through `ARENA_PREVIEW_SQUADS=1` with the existing configured origin, guest protection, Supabase and provider limits. Hosted squad matchmaking, squad-specific memory, and a human playtest are unverified.

The Agent Passport retains the [confirmed BSC Testnet duel](https://testnet.bscscan.com/tx/0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672). The existing Solidity verifier covers its lane-v1 rules. Squad results have deterministic off-chain validation and operator-attested model provenance. Squad settlement and Solidity parity for squad rules remain open. No new deployment or chain write was performed during this sprint.

Verification used 144 passing Vitest tests with the local Solidity RPC, the standard and preview builds, and Playwright desktop and 390 px browser checks. The packaged preview replayed the current match to 21–24 without a match-generation request. [Browser Testnet receipt check](../evidence/squads/bsc-passport.png).
