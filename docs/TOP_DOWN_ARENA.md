# Top-down AGENT ARENA

The owner approved an original abstract top-down identity for the current product on 26 November 2026. This replaces the older military art direction for the player-facing app. Historical master and submission materials retain their original descriptions and evidence.

Screeps: Arena's developer gameplay shows how grid geometry and distinct unit silhouettes let players read autonomous competition at a glance. AGENT ARENA applies this with original SVG shapes, team colors and a distinct Core marker. Frozen Synapse's independent planning and Door Kickers 2's waypoint cues informed the separation between the actual accepted route on the board and the authored condition in the plan. [Screeps gameplay](https://www.youtube.com/watch?v=-y6WNRTuVzg) · [Frozen Synapse](https://store.steampowered.com/app/98200/Frozen_Synapse/) · [Door Kickers 2 developer notes](https://store.steampowered.com/news/posts/?appgroupname=Door+Kickers+2&appids=1239080&enddate=1646059499&feed=steam_community_announcements)

## Shipped locally

- Practice, older replays and continuous Objective Duel use the shared geometric identity. Dust Yard's continuous grid displays authoritative obstacles, accepted movement routes, waypoints, goal markers, health and charge, Core phase and commitment progress, and tag and collision cues. Only already played frames contribute to the event display. Blue's authored conditions remain visible alongside the current execution state.
- Pause, seek, jump to recorded Core events, and replay without reopening the provider. The board uses SVG without sprite downloads. The main JS chunk built at 332 kB before gzip, down from about 1.7 MB in the prior build. Development sandboxes retain their diagnostic renderers.
- **Same-setup rematch** uses the original completed match owned by the requesting guest. The server locks the arena configuration, seed, opponent coaching, role and model. The player can send new coaching. Ordinary rematch still requests a fresh server seed. Provider sampling and opponent responses can vary even with the same setup. Existing authorization and reservation limits apply.

## Evidence

Two browser-started `gemini-3.5-flash-lite` duels used seed 3407723553 and the same adapter. The first asked Blue to favor early objective progress. The rematch asked Blue to preserve energy and reassess when the rival was visible. Both agents initially chose the same west landmark in both runs. Blue's first plan used `until: core-available`, while the revised plan used `until: at-goal`. Blue's Core starts came at ticks 25 and 27, respectively. Sand disabled Core in both matches. The pair demonstrates a conditional choice and a working comparison flow. It gives limited evidence of a meaningful change in playing style.

| Original / rematch | Accepted plans | Preparation | Simulated end | Collisions |
| --- | ---: | ---: | ---: | ---: |
| Early progress | 5/5 | 8.47 s | Sand · 6.80 s | 3 |
| Patient | 5/6 | 17.18 s | Sand · 6.87 s | 2 |

The west convergence remains a design constraint. The previous split-destination controls demonstrate that the engine permits conflict-free openings. A genuine pair still chose the same approach, despite the available destinations. Test a second independent scoring opportunity before attributing convergence to the model or expanding its action vocabulary. Neither a new competitive mode nor new map geometry shipped in this iteration.

The recorded duel played through in Chromium, with no match POSTs or page errors. Desktop and 390 px mobile captures showed the accepted route and a Core commitment. Both new live recordings reconstructed after anonymizing the guest identifier. The prior 41 research replays also reconstructed. All 135 tests passed with local Hardhat parity. The build passed with the existing dependency externalization notice. Human enjoyment, balance, hosted continuous play and evidence-grounded product memory remain open. The existing V1 settlement path is separate from unverified continuous matches.

[Replay video](../evidence/top-down-arena/player-replay.webm) · [Desktop](../evidence/top-down-arena/route-desktop.png) · [Mobile](../evidence/top-down-arena/core-mobile.png) · [Rematch comparison](../evidence/top-down-arena/same-setup-result.png) · [Model responses](../evidence/top-down-arena/provider-responses.jsonl) · [Attempts](../evidence/top-down-arena/matched-attempts.json) · [Early-progress replay](../evidence/top-down-arena/early-progress.json) · [Patient rematch replay](../evidence/top-down-arena/patient-rematch.json)

The source rollback point is Git branch `codex/arena-before-topdown`, commit `a9fa365`.
