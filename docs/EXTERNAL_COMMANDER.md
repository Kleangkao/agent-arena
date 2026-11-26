# External commander development protocol

A standalone Node process played Blue against a scripted Sand opponent in the local host. The host passed the same squad observation, destination IDs, canonical order validation and execution receipts used by the Gemini integration. The example process imports only Node built-ins. It receives no Arena credentials, coaching, guest cookie, raw engine object or opponent plan. It is a separately implemented deterministic example shipped in this repository.

## Connect a local process

Run `npx --offline tsx scripts/external-arena-demo.ts` from the repository. The launcher starts the pinned `scripts/external-commander.mjs` using Node with an empty inherited environment and receives one UTF-8 JSON response per process. To try a separate trusted implementation locally, point the development launcher at the reviewed file. Production Arena exposes no public commander transport. A local child executes with the workstation user’s privileges. Use reviewed code for this example.

Every message has `version: "arena-commander-stdio/v1"`, `matchId`, `requestId` and `side: "Blue"`. Echo those fields in replies. The host binds each reply to one newly generated checkpoint ID and its assigned side. Input and output are each bounded to 8 KiB, with a two-second process timeout. The final outcome caps the number of checkpoints even if a client keeps returning valid orders.

| Message | Additional fields |
| --- | --- |
| Host `checkpoint` | `config` identifies the map, mode, rules and team size. `observation` contains the current authoritative board projection. `destinations.options` lists selectable IDs, coordinates, terrain and site membership. `capabilities` reports current contact. `availableActions` names the mode’s action options. `previous` is the prior execution receipt or `null`. |
| Client `orders` | `intent` is spectator text up to 120 characters. `orders` contains exactly five entries in slot order. Each movement is `-`, one destination ID, or two IDs separated by `>`. Defeated slots must hold. Bomb allows `/link` or `/pulse` suffixes. TDM requires distinct living `pulseSlots` indices, including an empty list if no pulses are authorized. Relay pulses are automatic under its game rules. |
| Host `finished` | `outcome` is `blue`, `sand` or `draw`. `tick`, `score` and `previous` report the terminal tick, scoreboard and last receipt. A Relay elimination can win before a team leads on points. |
| Client `acknowledged` | Echo the `outcome` and matching envelope. The host determines and validates the outcome independently. |

The engine checks legal orders again after the host has decoded the selected IDs. The host exits with an error if a reply is missing, malformed, late or outside its assigned scope. The transport never accepts an endpoint URL or makes an outbound network request. The local process assignment authorizes Blue orders inside the demo. ERC-8004 wallet authorization and operator-attested inference provenance are separate capabilities. The example records its replays as `scripted-practice` and has no access to publish them or claim standardized reputation.

## Executed demo

The [captured run](../evidence/external-commander/summary.json) completed 12 accepted checkpoints across three matches. Blue won [Relay](../evidence/external-commander/relay.json) by elimination on tick 40 and [Team Deathmatch](../evidence/external-commander/tdm.json) by 5–2 on tick 48. Sand won [Bomb Mode](../evidence/external-commander/bomb.json) on tick 48 after Blue failed to activate the Core. All three V7 replays reconstructed to the same terminal result and the peer acknowledged each. The launcher checked rejection of reused and cross-match replies, wrong-side replies, unknown destination IDs and duplicate TDM pulse slots. The traces include checkpoint requests, accepted orders, execution receipts and final acknowledgements.
