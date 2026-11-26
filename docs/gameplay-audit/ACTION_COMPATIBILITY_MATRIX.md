# Action compatibility at the world boundary

The [runtime fixture](DIAGNOSTICS.json) calls V2.5 allows for both modes' shared world conditions using a living stationary rival, unobstructed at 3 tiles, Blue with 2/4 ammo, and a clear legal jump direction. Rows indicate current state, columns new input. One command per side per tick. Continuing existing motion/timers is implicit.

| Current | Stop | Posture | Walk/redirect | Run/redirect | Crouch/redirect | Start jump | Attack | Precision | Reload | Observe | Peek |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Standing | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Walking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | – |
| Running | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – |
| Crouched stationary | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Crouch movement | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | – |
| Jumping | – | – | – | – | – | – | – | – | – | – | – |
| Standard attack winding up (stationary fixture) | – | ✓ | ✓ | – | ✓ | – | – | – | – | – | – |
| Precision winding up | – | – | – | – | – | – | – | – | – | – | – |
| Reloading (stationary fixture) | – | ✓ | ✓ | – | ✓ | – | – | – | – | ✓ | – |
| Observing (stationary fixture) | – | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | – |
| Peeking | – | ✓ | – | – | – | – | – | – | – | – | – |
| Defeated | – | – | – | – | – | – | – | – | – | – | – |

✓ supported in this fixture. – conditional or prohibited by explicit code. Stop has no meaning without motion. Standard attack permits ongoing low-speed movement and posture changes. Precision and peek require stationary start and prevent motion during the timer. Observe and reload overlap in both orders. Reload cannot start at capacity. Passive detection runs during jump/running even when they prohibit the active Observe input. Jump is committed until endpoint or a collision, then next boundary can accept new inputs. Test `gameplay-v23` verifies jump can receive damage. This probe has no independent airborne/landing state. Full state combinations were sampled by existing matches, exhaustive pairwise mixed-state tests are pending.

| Objective or life phase | Actual behavior and assessment | Evidence |
|---|---|---|
| Channel starts | Correct role, living, ≤4000 units, no existing channel or run/jump/firing/reload/peek. Walking, crouch, posture and Observe compatible. | `src/v24/objective.ts:43–55`, V2.4 tests and V2.5 replay |
| Channel while moving, changing direction or stopping | Existing low-speed movement continues. Direction change can exit zone and then cancels in same step. Stop or Observe keeps eligible progress. | `advanceCore`, V2.4 overlap and exit tests |
| Channel with incompatible input | If otherwise legal, run/jump, attack/precision, reload or peek is accepted and cancels channel. Explicit cancel accepted only for own interaction. Hit can cancel only contestable preset. | V2.4 and V2.5 cancellation/deadline tests |
| Attack with focused observation | Attack false at a legitimate current observed location below nominal range. Mechanically confirmed and inconsistent with a single unified visibility status. | Diagnostic focus and A01 |
| Defeat and respawn | Current competitive presets gate dead input. Score respawns with fresh HP, ammo, posture, timers and contacts. First normal command next boundary. Core may continue after Activator falls. | V2.5 test, ordinary score respawn probe |
| Consecutive same-boundary actions | Partially supported through persistent state. Engine accepts only one new command. Manual handler serializes action keys and prioritizes action over new steering. | Probe and `sandbox.tsx:214–257` |
| Held input after collision | Source suggests same held key may remain blocked after opponent moves. Direct browser reproduction still needed. | A08 |
| Exact historical reference | Repeated defeat and corpse participation possible only via historical validation variant. | A12, previous suite |
