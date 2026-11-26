# Gameplay V2.3 · Continuous Dust Yard

This local sprint implements the owner's continuous movement brief. The approved master specification, V2 specification, V1 release, V2.0–2.2 code and historical evidence remain the baseline. V2.3 uses its own engine, input schema and replay version and is excluded from production client bundles. The sandbox controls Blue for engineering review. The product remains coach-led.

## Architecture decision

The reproduction called V2.2's headless `advance` with a valid walk from cell 28 to 29. At 110 ms, its authoritative position was still 28. V2.2 stores an integer cell identifier and a due tick for each route waypoint. On that tick it replaces the old cell with the next cell. Phaser receives both centers and interpolates pixels. Neither the camera nor the rendering loop caused the restriction.

| Option | What was evaluated | Decision |
|---|---|---|
| Phaser and fixed-point TypeScript | Implemented and measured. Eight static boxes, two agent footprints, bounded grid routing and swept segments. Node runs the core directly and Chromium runs the same module. Replay compares seeded output independently of view cadence. No new package or WASM runtime. | Adopt at 30 Hz for the current map. The grid remains useful for route suggestions. |
| Phaser and Rapier 2D | Reviewed official JS initialization and determinism documentation. Rapier would add an asynchronous WASM initialization and distribution choice, collider setup and solver versioning. Its documented deterministic replay depends on identical engine version, initialized values and construction order. The current engine has no need for impulse, rigid-body or joint solving. Node/browser package size, performance and collision behavior were not measured. | Defer. Reconsider with an isolated experiment if richer collision, compound bodies or profiling exposes a concrete gap. |
| Different game engine | The existing Phaser viewer rendered custom coordinates on desktop and mobile while the same engine ran in Node. A migration would replace presentation and its browser tooling while leaving authoritative rules, input validation and transcript verification to solve. | No unmet requirement justified a migration. |

[Phaser timing controls](https://docs.phaser.io/api-documentation/class/core-timestep) · [Rapier determinism](https://www.rapier.rs/docs/user_guides/javascript/determinism/) · [Rapier JS initialization](https://rapier.rs/docs/user_guides/templates/getting_started_js/)

## Authoritative movement and game states

- A tile is 5,940 coordinate units. Position is a pair of bounded integers. At 30 Hz the walk speed is 300 units per full update, run 600 and crouch 200. Diagonal travel uses the same Manhattan distance budget. A `move` can end at any legal integer coordinate. A `steer` issues a bounded direction that persists until a new command, contact, or stop. Jump is a committed one-tile-distance motion with the same terrain checks and no damage immunity.
- Static obstacles use the original Dust Yard cells. A square footprint is swept against obstacle bounds expanded by 900 units. Agent contacts use relative swept motion and cancel the approaching movement for both sides when both move. The world boundary also includes the footprint. A collision stops movement at its previous valid position. Sliding and contact resolution beyond this stop are future work.
- Navigation uses a direct clear segment when possible, then a bounded search over existing center connections. Each quantum advances toward the next point. Sub-tile stops and redirection preserve position. Side-relative tie-breaking at exact horizontal cell boundaries keeps mirrored policies equivalent. Input is validated before changing either side against the same previous state.
- Movement, posture, firing, reload/ammo, surveys, contact and life are separate. Walking and crouching can overlap standard attack, reload or observe when their other requirements allow. Run and jump restrict simultaneous action starts. Precision and peek commit the agent to their defined stationary state. Both due attacks resolve before damage and defeat. Attack damage, baseline odds and motion modifiers match V2.2's fictional values. Range and line-of-sight query the actual coordinates. The observation contains only self state and current or previously revealed contact, with expiry. Observer focus, jump, posture and run exposure affect that result.
- Each simulation boundary advances 330, 100 or 50 units of 1/3000 second. The match ends at exactly 19.36 seconds if both agents survive. Action duration uses the same physical time for each frequency and resolves at the next boundary. Seeded draws are reserved by scheduled attack time and side. Different simulation rates can change outcomes through timing, position and resulting decisions. The frequency is bound in the replay configuration.
- Manual and deterministic agents submit the same input types to `advance`. The policy chooses at approximately the V2.2 440 ms cadence from its own state and legal observations. A future model can provide the same validated movement target or action at strategic checkpoints. V2.3 did not change the model adapter, hosted session, quota or persistence and made no Gemini requests. Collision, steering and action ticks need no inference.

## Measurement and replay

[Benchmark JSON](../evidence/gameplay-v23/benchmark.json) has 160 matches per configuration with seeds 0–79, two profile assignments, equal starting equipment and the same 19.36 s limit. V2.2 retains its own grid movement and policy implementation. V2.3 mirrors the profile scoring and timing as far as possible. Fractional contact and route interpretation, fewer idle gaps and rounding to different action boundaries all change which inputs are legal. This is a system comparison. It cannot attribute all gameplay changes to geometry or frequency alone.

| Metric | V2.2 / 110 ms | V2.3 / 110 ms | V2.3 / 30 Hz | V2.3 / 60 Hz |
|---|---:|---:|---:|---:|
| Mean match duration, s | 18.85 | 19.05 | 19.17 | 19.33 |
| Clock endings / 160 | 125 | 143 | 145 | 159 |
| Idle agent-time | 14.9% | 14.1% | 9.4% | 8.6% |
| Movement + action agent-time | 23.7% | 23.9% | 29.3% | 29.6% |
| Longest joint stationary stretch, s | 3.41 | 0.88 | 0.67 | 0.67 |
| Agent contacts | 629 | 83 | 86 | 42 |
| Standard hits / misses / precision | 675 / 1631 / 133 | 644 / 1252 / 47 | 510 / 1231 / 24 | 467 / 1183 / 20 |
| Events | 34,656 | 14,185 | 12,996 | 13,353 |
| Mean replay bytes | 85,611 | 7,811 | 7,431 | 7,588 |
| Node simulation cost, 160 matches | 290 ms | 142 ms | 198 ms | 329 ms |
| Node replay load/validation cost, 160 matches | 742 ms | 113 ms | 174 ms | 339 ms |
| Retained heap delta, 160 loaded matches | 23.0 MB | 22.4 MB | 54.0 MB | 100.5 MB |

V2.3 measures actual displacement for stationary stretches, compared with V2.2 tile events. Active time is a per-boundary sample of each fighter's state. It includes movement and action state even when the last update completed only part of a route. V2.2 stores movement events and full states, while V2.3 stores input and semantic events. Heap figures are forced-GC deltas for a retained batch on this host, with one labeled wall-clock run and approximate totals. No mobile hardware or cross-platform performance extrapolation is intended. At 30 Hz walk/run/crouch/jump occupy about 42.5% / 9.5% / 21.2% / 8.5% of agent time, versus 35.9% / 10.4% / 13.8% / 5.0% in V2.2. Attack success fell from 33.1% to 30.3%. Higher clock endings and fewer attack attempts remain a gameplay tuning concern. No damage or round length increase was used.

Replay version 3 stores versioned map/rules, seed and frequency, sparse validated boundary inputs, sparse ordered semantic events and terminal state. The locked version and map imply the initial state. Every authoritative frame is rebuilt headlessly on load. Reconstruction rejects illegal inputs, duplicate/out-of-order entries, altered events and altered final state. The viewer can read or animate the reconstructed frames without inference. Format integrity detects inconsistencies against entered inputs. Authenticity of a claimed original transcript requires separate attestation. Using full snapshots at 30 Hz would take about 288 kB per replay here. Fixed replay size caps and releasing materialized frames avoid retaining whole batches in a normal viewer. A future many-match service could retain only compact logs and regenerate playback on demand.

All 480 continuous matches in the matrix passed state/range/collision bounds and serialized replay validation. Another 192 mirrored pairs matched position, health, posture, resources and outcomes at every checked boundary. Unit coverage confirms off-center position, interruption, obstacle routing, ranged discovery, concurrent reload/observe/movement, simultaneous attacks, jump damage, invalid input, clock, replay tampering and historical formats.

## Review the graybox

- Manual at `http://127.0.0.1:4182/?arena-continuous`. Choose **Start sandbox**. WASD or arrows steer. Release to stop. Shift runs, C toggles crouch while stationary or walking, Space jumps toward the last sampled direction, F attempts standard attack, P stationary precision, R reloads, E observes and Q peeks. A command is accepted only when legal. Change direction or release after a wall stops you. Keys are sampled at the simulation boundary. Save becomes available on match completion.
- Autonomous at `http://127.0.0.1:4182/?gameplay-v23`. Play, pause, resume or skip. Load a V2.3 JSON file to inspect a previous run. Optional manual query parameters are `rate=baseline` and `rate=60hz`. Phaser's debug presentation rate can independently be limited using `fps=20` or `fps=60`. Old routes `/?arena-sandbox` and `/?gameplay-v22` still open V2.2.
- The graybox shows both agents for the developer. The simulator's agent observation still hides unavailable contacts. Navigation dots and edges, coral terrain clearances, authoritative square footprints, rendered circles, destination lines, simulation time and coordinate/action data are visible in the overlay.

## Browser evidence

Chromium recorded eight direction changes per frequency. Median keydown to first authoritative displacement was 63 ms at 110 ms (46–100 ms), 20 ms at 30 Hz (4–32 ms), and 9.5 ms at 60 Hz (4–18 ms). These measurements include browser scheduling and stop at the authoritative update. They do not measure display latency. The host could render the graybox at about 240 scene updates/sec with no presentation cap in the short input probe. At the two replay caps Phaser measured 19.6 and 59.9 updates/sec. On this host 30 Hz provides better input response than 110 ms, keeps roughly half the 60 Hz batch memory, and leaves enough headroom for this graybox. Desktop/mobile coverage here refers to Chromium viewport emulation.

Blue moved from (8910, 20790) to (9510, 20790), then held that off-center position after release. The manual trace also shows a vertical redirect, crouch with observe, terrain contact at x=1110, reversal and a completed jump. With animation callbacks delayed by 500 ms, live Blue advanced to x=11310 at tick 8 before the first render callback. Both renders of the autonomous fixture played through to Blue 64–0 at 14.90 s and preserved that result after reload. Node reconstructed the manual and autonomous file to exactly the terminal states displayed by Chromium. The browser logged no page errors or game API requests on the final V2.3 pass. Captured screenshots and video frames were inspected for visible coordinate separation, navigation geometry, actor distinction and 390px layout. The art consists of development primitives.

[Manual recording](../evidence/gameplay-v23/manual.webm) · [Off-center stop](../evidence/gameplay-v23/manual-off-center.png) · [Concurrent crouch and observe](../evidence/gameplay-v23/manual-overlap.png) · [Manual transcript](../evidence/gameplay-v23/manual.json) · [Autonomous mobile recording](../evidence/gameplay-v23/autonomous-mobile.webm) · [Mobile screenshot](../evidence/gameplay-v23/autonomous-mobile.png) · [Autonomous transcript](../evidence/gameplay-v23/autonomous.json) · [Raw browser measurements](../evidence/gameplay-v23/browser.json)

The public V1 preview returned HTTP 200 and completed a guest practice match in Chromium. The existing V1 Passport read confirmed the Blue outcome on BSC Testnet. All 73 tests in 16 files passed with the local Hardhat RPC, including V1 Solidity parity and settlement. Both client build modes passed with the existing bundle size and worker externalization warnings, and both asset scans excluded the V2.3 entry. This sprint made no deployment, blockchain write, Gemini request, or infrastructure change.

[Public V1 preview](https://agent-arena-preview.vercel.app/) · [Existing V1 settlement](https://testnet.bscscan.com/tx/0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672)

## Verification and future boundaries

For a later verifier, the integer geometry and explicit event order make independent reimplementation possible. It would need exact signed arithmetic and rounding, the same geometry and collision iteration, identical seeded RNG and timer ordering, and a compact, committed action transcript. Even the 30 Hz run can reach 581 updates and 1,162 input slots. On-chain full replay offers direct independent validation if gas is measured and acceptable with worst-case geometry and inputs. Off-chain deterministic re-execution with a signed or on-chain committed transcript allows independent inspection but leaves settlement or transcript provenance with the operator. An event hash alone only commits bytes. Fraud-proof or validity-proof techniques would add different trust assumptions and substantial implementation work. None was implemented or benchmarked. The contract cannot independently establish AI inference provenance.

Scaling beyond this 1v1 arena will require profiling. The pure core can move to a headless worker or another renderer today. A larger map may require spatial indexing and cached navigation. More agents would require an explicit stable collision-resolution rule and efficient candidate pairing. Those changes deserve their own version and parity tests. This sprint establishes the movement model. It still needs owner feel review, more geometry stress and production-device checks. Genuine Gemini V2.3 needs a protected strategic-intent adapter and a controlled provider-backed trial after this local engineering phase.
