# Active boundaries

| Boundary | Entry and implementation | Inputs → outputs | Legacy or release relation |
|---|---|---|---|
| Manual and replay browser | `src/main.tsx:282–287` → `src/v23/sandbox.tsx` | Dev-only query → keyboard/controller or version-specific replay, renderer and HUD | Default consumer release uses V1 React/Phaser via `src/battlefield.tsx`. No V2.5 public client route. |
| V2.5 contract in TypeScript | `src/v25/game.ts` configure/assertConfig/initial/advance | Strict seed/map/mode/participants/options → mode-bound result and events | Functional, headless, replays share it. On-chain Solidity in `contracts/` verifies V1, independently. |
| Shared world | `src/v23/game.ts` permissions, checked, stepWorld, observation | Two optional commands from previous snapshot → simultaneous simulation + filtered side views | V2.3 defaults and V2.2 exported balance/timing helpers. Current Objective/Score call live-only world; elimination terminates on defeat. |
| Geometry | `src/v23/space.ts` → `src/v2/yard.ts` | Fixed-point bounds/segments → accepted position, routes or contact | Shared historical map cell data. Active visibility uses rectangle rays, never grid adjacency. |
| Objective | `src/v24/objective.ts` via V2.5 advance | Shared world update → interaction progress, cancellation, terminal reason | V2.4 wrapper and exact V2.5 reference retain historical behavior. Current default has separate tuning and alive filtering. |
| Score mode | `src/v25/game.ts` advanceScore | World events → points, terminal ordering, fresh life | Separate lifecycle, shared attack/perception code. |
| Development policies | `src/v25/development.ts` → `src/v24/development.ts` / `src/v23/development.ts` | Side view, own motion and public config → validator-gated choice | Sources intentionally independent of external inference. V2.0–2.2 policies in `src/v2/development.ts` are historical. |
| Protected provider | `api/arena.ts` → `server/api.ts` → `server/gameplay-v25.ts` | Guest + preview token + quotas → locked config, prompts, checked queue, authoritative recording | `server/gameplay-v2.ts` is separate historical validation; `server/match.ts` V1 production flow. `server/objective-trial.ts` is a separate legacy boundary tested locally, not the V2.5 runner. |
| Store | `server/storage.ts`, `sqlite-storage.ts`, `supabase-storage.ts`, `supabase/migrations/` | Owner-scoped reservation → completed/interrupted with replay, bounded attempt metadata | V2.5 reservation sets both memory revisions zero, skips reflection. Local fixtures exercise adapter, no hosted writes. |
| Replay | `src/v25/replay.ts`, historical `src/v24/replay.ts`, `src/v23/replay.ts`, `src/v2/replay.ts`, `src/replay.ts` | Versioned config + initial + sparse inputs + events + final → canonical match and reconstructed frames | Each format preserves own interpretation. V2.5 compared with deterministic re-execution, no model or chain. |
| Renderer | `src/v23/sandbox.tsx` Board/render loop | Latest validated state/events → interpolated circles, visual effects, HUD | Top-down diagnostic view of the same coordinates. HUD and both fighters are spectator information. |

## Authoritative event order

1. Validate both commands against the same previous snapshot. Apply mode, posture and timers, and consume launch ammo.
2. Resolve due attacks, reloads and surveys. Attacks use pre-displacement coordinates and current posture, at the new clock time. Store simultaneous damage before modifying either health value.
3. Sweep both movement paths, resolve contact, apply positions and damage, then update contact/last seen from the resulting world.
4. Resolve Core progress/defeat/clock or Score points/result/respawn. Score respawn happens after contact update. Elimination uses survivor or health at the deadline.
5. Emit one bounded frame. Replay records sparse commands/semantic events with resulting tick and validates complete reconstruction. The viewer schedules by `state.time`.

Headless load and render run in separate layers, though the browser currently reconstructs the whole match synchronously on import. Links: [main audit](GAMEPLAY_AUDIT.md), [AI boundary](AI_INTERFACE_AUDIT.md).
