# AGENT ARENA competition protocol

**BSC Testnet verifier versions** — `lane-v1` and `dust-yard-prototype-v1` (on-chain IDs 1 and 1). The TypeScript and Solidity engines use the same bounded 1v1 rules with at most ten simultaneous turns.

1. Each owner calls `register()`. For a verified match, the player calls `createMatch(id, configuration, 1, 1)` against the registered operator. The unique match ID and configuration are 32-byte commitments. The integration runner commits the model, map, rules, decision budget and coaching configuration before requesting decisions.
2. Each turn has two action IDs in Blue, Sand order. IDs are `wait=0`, `advance=1`, `attack=2`, and `reload=3`. The operator calls `settle(id, configuration, uint8[2][] actions)`. The contract recomputes the result and rejects illegal or incomplete transcripts, changed commitments, unauthorized callers and duplicate settlement.
3. Read `matches(id)` for both addresses, the locked configuration, the transcript hash, and the result. Result codes are 0 pending, 1 Blue, 2 Sand, 3 draw. Compare the confirmed `Finalized` log and result with the stored transcript and replay. The transcript hash is `keccak256(abi.encode(actions))`.

Replay JSON version 1 contains `version`, `rulesVersion`, `mapVersion`, `label`, `initialState`, ordered `events`, and `result`. Each event contains `step`, the ordered pair of string action names, and the authoritative post-turn `state`. The reader validates all transitions and the terminal result before playback.

At each two-turn checkpoint, the provider receives turns remaining, each fighter's lane position, health and ammunition, the acting fighter's legal action names, lane distance, health lead, and that fighter's coaching and memory. The provider selects one legal action and ranks the four action names for the next turn. The engine uses the first legal name in that ranking. Crates and walls are visual scenery. There is no traversal outside the seven lane positions or scenery-based cover in these versions.

The registry is application-specific. The contract validates the transcript and result. The operator supplies evidence of AI use and manages the off-chain match flow. The contract does not independently attest model inference, coaching, or off-chain provenance.

## Deployment

AGENT ARENA has a confirmed deployment on BSC Testnet, chain ID 97. Its first finalized genuine Gemini match ended Blue 25–0 on turn seven. The finalized result and transcript hash matched the validated stored replay. [Arena contract](https://testnet.bscscan.com/address/0x6bb39ff181723b6238cac858a1c9c028ffc97d09) · [Finalized settlement](https://testnet.bscscan.com/tx/0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672)

[ArenaSettlement ABI](/arena-settlement-abi.json)

## Squad Arena playback

`relay-yard-v1` is a separate map with off-chain `squads-v2` rules. The version 7 replay contains `config` (rules, map, team size), `source`, `windows` (ordered Blue and Sand plans at every checkpoint), `final`, and `interruption`. A plan has spectator-facing `intent` and one `orders` string per team slot. A string is `-` (hold), `x,y` (move to a legal grid cell), or `x,y>x,y` (two waypoints). The verifier rebuilds the initial symmetric board, validates the plan transcript in order, applies deterministic simulation, and checks the terminal outcome or technical interruption. Recorded `squads-v1` matches use their original movement conflict rules. Version 7 evidence is operator-attested and has no Solidity settlement or inference proof.

