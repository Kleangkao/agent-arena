# AGENT ARENA continuous Objective Duel

The normal Arena now offers a recorded Gemini Objective Duel. Guests can watch the agents in an isometric Dust Yard, see Blue's authored conditions alongside authoritative field events, and go directly to coaching. The opt-in local API additionally offers genuine matches and rematches using the saved natural-language coaching and a summary of the first accepted tag or Core action in each match. Match setup remains server-owned.

## Design decisions

- Screeps Arena exposes observations and intents through an agent API with tick and CPU budgets. AGENT ARENA uses filtered observations, a bounded plan contract and a shared inference budget. Coaching is the human input. [Screeps Arena docs](https://arena.screeps.com/docs/)
- Frozen Synapse lets players test independent plans before simultaneous execution. AGENT ARENA retains simultaneous input boundaries and makes the submitted plan and resulting actions visible separately. A model-facing counterfactual tool remains an experiment and would need a separate hypothetical world. [Frozen Synapse developer description](https://store.steampowered.com/app/98200/Frozen_Synapse/)
- Door Kickers 2 exposes waypoint holds and event-driven release. AGENT ARENA uses agent-authored conditions along with an observed collision checkpoint and a separate Core-idle predicate. The deterministic runner only transitions to the next authorized stage. [KillHouse developer update](https://store.steampowered.com/news/posts/?appgroupname=Door+Kickers+2&appids=1239080&enddate=1646059499&feed=steam_community_announcements)

## What changed

- The actual V2.6 server adapter now names movement, Core, tag and checkpoint fields. The strict parser still takes all supported channels and guards. A first, wider schema produced a malformed opening with `jump:false` and a plan using `at-goal` in the wrong field. The reduced schema avoids advertising irrelevant optional flags and explicitly describes the valid guard. [Original rejected responses](../evidence/autonomous-product/initial-adapter-responses.jsonl)
- Model-authored `movement-blocked` can yield to another stage at the boundary immediately after the agent's own collision. `core-idle` describes its own commitment separately from tag and reload completion. Collision recovery remains an authored choice. An injected match demonstrated that a next authored step was accepted immediately after collision without another generation request.
- An ordinary 503 followed by a rejected response used to exhaust the same decision's retry allowance. The runner now allows up to two transient recoveries and one invalid-plan recovery within the existing per-participant, total and wall-time limits. Rate-limit responses stop the match. Attempt records label provider errors, invalid JSON, plan-schema rejection and plan-contract rejection separately. The injected regression covers two 503s followed by an invalid plan and then a successful generation.
- A geometry control compared two identical destinations with two distinct positions inside the existing Core zone. The shared point produced two collisions per run. The distinct coordinates produced zero and preserved Blue's first legal Core boundary at tick 24. The three seeds share their opening geometry, so this isolates a destination effect for one layout. The final adapter exposes both coordinates as optional public landmarks. Gemini selected opposite landmarks for the two contestants in the successful rematch, and the game accepted both. Later movements still collided. [Geometry controls](../evidence/autonomous-product/approach-controls.json)

## Browser verification

Playwright entered through the main Arena page, played the recorded checkpoint duel without a match POST, saved coaching, ran a genuine duel, saved revised coaching, and sent the revised text in the rematch request. The first rematch was interrupted by repeated provider errors. A later request from the same browser guest completed after two 503s. The comparison remained visible at desktop and 390 px mobile widths with no page errors.

| Live browser example | Attempts accepted | Wall preparation | Result |
| --- | ---: | ---: | --- |
| Initial playable duel | 6 of 7 | 12.73 s | Blue completed Core at tick 541 |
| Compact adapter duel, early-progress coaching | 6 of 6 | 16.07 s | Sand disabled Core at tick 330. Blue first started at tick 151. |
| Final adapter retry, revised coaching | 7 of 9 | 33.69 s | Sand disabled Core at tick 223. Blue first started at tick 25. |

The displayed comparison is 5.0 s versus 0.8 s for the first Blue action. The server chose different seeds and the adapter changed, so this verifies coaching transfer and observable comparison. It does not isolate a coaching effect. Six browser-submitted recordings, including three interruptions, reconstructed with the V6 replay loader. The earlier 41 research replays still reconstruct. The full suite passed 135 tests including local Hardhat parity, and the production bundle built with the existing bundle and dependency externalization warnings.

[All six match traces and model attempts](../evidence/autonomous-product/matches.json) · [Raw model responses from the instrumented runs](../evidence/autonomous-product/provider-responses.jsonl) · [Recorded checkpoint](../evidence/autonomous-product/recorded-checkpoint.png) · [Desktop comparison](../evidence/autonomous-product/rematch-comparison.png) · [Mobile comparison](../evidence/autonomous-product/mobile-rematch.png)

## Run locally

With Gemini configured in the private server environment, set `ARENA_LOCAL_CONTINUOUS=1` and run `npm run dev`. Open Arena and choose **Play Objective Duel**. The configured local server listens on loopback. Recorded playback is available from **Watch Objective Duel** with no provider access. For local evidence runs only, `ARENA_LOCAL_CAPTURE=1` retains redacted raw model responses in the ignored `.arena-data/continuous-provider.jsonl`.

The hosted API still requires a protected V2.6 token and its existing authorization controls. The V6 replay remains an unverified continuous match; the existing Testnet passport and older match paths retain their separate scope. Local V2.6 memory remains disabled in the product pending evidence that grounded reflection improves play. The previous experiment established real reuse but also produced an inaccurate lesson. Human interpretation and enjoyment, role balance, and improvements in natural coaching quality still require evaluation.
