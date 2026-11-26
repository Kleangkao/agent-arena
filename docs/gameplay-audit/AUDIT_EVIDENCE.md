# Audit evidence index

| Evidence | What it establishes | Limit |
|---|---|---|
| [TEST_RUN.txt](TEST_RUN.txt) | `$env:PARITY_RPC='http://127.0.0.1:8545'; npm test` → 100 tests passed in 20 files. TypeScript/Solidity applies to the V1 verifier. | The suite alone cannot establish V2.5 play quality or chain support. |
| [run-diagnostics.ts](run-diagnostics.ts) · [DIAGNOSTICS.json](DIAGNOSTICS.json) | `npx --offline tsx docs/gameplay-audit/run-diagnostics.ts`; runtime legality, wall/footprint tests, reach and focus, posture and resolution order, eight historical V5 recordings, offline trial and 144 development matches. | Some precision checks inject a known valid world shape or due timer. Saved files and development matches cover reachable states. Uses fixture provider. |
| [BROWSER.txt](BROWSER.txt) · [Respawn screenshot](../../evidence/gameplay-audit/score-respawn.png) · [Result screenshot](../../evidence/gameplay-audit/score-final.png) | Local Chrome via cached Playwright CLI at `/?gameplay-v25`. Import ordinary-score, show debug state, watch to Sand respawn around 10.5s, skip, verify stored terminal, reload, play again. 54.067s, tick 1622, Sand wins target 5–4. Stored initial state returned on refresh, zero page errors and API calls in assertion run. | Two sessions: screenshot run and assertion/rAF run. First attempted scripted browser logging with dynamic import failed at runtime, then corrected without Node imports. Graybox; no new gameplay video for the audit. |
| [Prior V2.5 browser script](../../scripts/gameplay-v25-browser.js) · [Prior browser record](../../evidence/gameplay-v25/browser.json) | Historical independent archive for other modes, pause/resume, mobile viewport and recorded outcomes. | This audit’s new browser sample is desktop Score only. |
| [Prior V2.5 benchmark](../../evidence/gameplay-v25/benchmark.json) | 4,864 prior local reconstructions; role and side swaps, deathmatch targets, reference variants. | Policy and configuration dependent. |
| [Protected integration snapshot](../../evidence/gameplay-v25/integration.json) | Last V2.5 read-only integration check and separate V1 chain evidence. | No fresh hosted test, no provider capacity assumption, no new chain action. |

## Regression coverage and residual gaps

- V2.3 tests isolate partial movement, interrupt, route, path collision, hide/reveal, resource spending and independent timers, jump damage, simultaneity, mirrored cell boundary and historical load.
- V2.4 tests check objective progress, roles and range, same-deadline channels, defeat order and replay tampering. V2.5 adds mode configuration, exact score deadline and simultaneous target, respawn and nonoverlap, cleanup and filtered score, damage interruption variant, and complete score replay integrity.
- V2.5 server tests check auth/reservations, same-state parallel prompt generation, private fields, optional compatible injected memory, bounded decisions/expiry/schema/retries and 429 failure.
- Important remaining regression cases include legitimate focused contact through protected scheduling and attack eligibility, range-crossing during motion with exact timer deadline, attack-event render loss under batching, dynamic held-steer recovery, observable contact events on respawn, broader mixed-state reachability and reflected memory after genuine trials. No low-end cost estimates.

The original master and V2 hashes were checked against the prior recorded baseline. Only new audit materials and tracker/progress annotations were written. The initial browser recording stills are intentionally diagnostic assets and show unverified local development mode.
