# BNB Chain and squad replays

The [native BNB release](NATIVE_BNB_RELEASE.md) adds official ERC-8004 Agent Passport discovery, a confirmed Testnet commander registration and wallet ownership comparison. The legacy duel settlement and squad replay commitment retain their distinct verification scopes below.

The [identity competition release](IDENTITY_COMPETITION.md) adds signed squad entry and a confirmed combined commitment for ERC-8004 #2933. The inventory below describes the earlier duel and Bomb release.

## Current chain inventory

| Capability | Live evidence | Squad scope |
| --- | --- | --- |
| Agent identity | Both owners in the application-specific `ArenaSettlement.registered` mapping were re-read on BSC Testnet. Wallet addresses are the identity keys. | Guest squad identities remain off-chain. The UI's Agent Passport reads the legacy contract and does not connect or register a squad wallet. |
| Contract-computed result | BSC Testnet chain 97, `ArenaSettlement` at `0x6bb39ff181723b6238cac858a1c9c028ffc97d09`, independently determines the original lane duel result. Its deployed rule and map IDs are both 1. The published duel receipt and stored result were re-read and the Blue win matched the replay. Settlement used 97,941 gas. | Neither the squad grid rules nor the continuous modes fit this contract. It is immutable and has no compatible squad action vocabulary. |
| Replay record | BSC Testnet chain 97, `SquadReplayRegistry` at `0xbd1a8427da0b2b2d947a391ed117e49ec8801f81`. The operator published the genuine current-rules Bomb replay commitment. An independent RPC matched storage, event and receipt to the validated replay with 147 confirmations at the recorded check. | The bundled Bomb result can link to the record when the registry is configured. Other completed model-run results can show their replay hash. Guest practice and interrupted matches do not produce receipts. |

[Squad registry](https://testnet.bscscan.com/address/0xbd1a8427da0b2b2d947a391ed117e49ec8801f81) · [Deployment](https://testnet.bscscan.com/tx/0x786dee0f5dd9456eca25146b953f9027a911548e3354429de18fc3656ebf9116) · [Bomb record](https://testnet.bscscan.com/tx/0xccd05b0c93c3c7931b9c77575894dc78c7bd9850b6a0e35f760ab2c6e61cacb6) · [Squad replay registry ABI](../public/squad-replay-registry-abi.json)

[Existing deployed duel contract](https://testnet.bscscan.com/address/0x6bb39ff181723b6238cac858a1c9c028ffc97d09) · [Existing original duel record](https://testnet.bscscan.com/tx/0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672) · [Duel protocol and ABI](PROTOCOL.md)

## What each status means

- **Operator-attested Gemini** describes the server's claim about who authored the orders. It is an off-chain provenance claim.
- **Off-chain replay validation** means deterministic simulation of the accepted orders produced the stored outcome under the specified map and rules.
- **Replay hash recorded on BSC Testnet** means the configured registry published the same commitment under the match key. The app checks chain 97, contract storage, the matching event and a successful receipt with at least two confirmations.
- **Contract-computed result** applies to the published original lane duel. The new squad registry only timestamps an operator's commitment. It cannot check squad actions, determine a squad winner, establish wallet ownership for squads, or prove AI inference.

## Squad receipt protocol

The operator calls `recordReplay(bytes32 matchKey, bytes32 replayHash)` on the registry. It accepts nonzero values once per match key and rejects calls from other accounts. `records(matchKey)` returns the hash and block. `ReplayRecorded` indexes both hashes.

`squadCommitment` in [receipt.ts](../src/squads/receipt.ts) first validates and deterministically runs the replay. It hashes this fixed-order UTF-8 JSON array with Keccak-256. The mode is `null` for historical squad recordings that precede mode selection.

```text
["agent-arena/squad-replay/v1",version,[rulesVersion,mapVersion,teamSize,mode],source,ordered gameplay orders,final]
```

The match key is Keccak-256 of UTF-8 `agent-arena/squad-match/v1:<lowercase server UUID>`. A bundled recording without a match UUID can display its replay hash locally. No prompt, private coaching text, generated intent commentary, memory, token metadata, order list, or replay document goes on-chain. Comparing a hash requires an independently available replay. The UI does not submit transactions or hold a signer.

The immutable deployer operator is the trust boundary for public attestations. A new registry and deliberate configuration change are needed to replace it. Set `VITE_BSC_TESTNET_SQUAD_REGISTRY` to the public chain-97 registry address above to enable the game reader. The owner explicitly approved the dedicated operator's deployment and first Bomb commitment. The workflow reused the Windows DPAPI vault without printing signing material. The legacy contract and Passport stay separate.

## Operator and public read commands

The release script pins the bundled Bomb replay and match UUID. It checks the chain and dedicated operator, simulates publication before signing, and journals the signed transaction under ignored `.arena-data/`. The operator command reads an existing record on repeat. If broadcast status is uncertain, check the printed transaction hash and journal first. `-RebroadcastKnown` only resends the same signed bytes if the RPC cannot find the previous transaction. The two write commands require explicit owner approval for those operations. The public read command needs no wallet or secret.

```powershell
./scripts/testnet-signers.ps1 -Mode SquadDeploy -ConfirmSquadWrite
./scripts/testnet-signers.ps1 -Mode SquadPublish -ConfirmSquadWrite -RegistryAddress 0xbd1a8427da0b2b2d947a391ed117e49ec8801f81
npx tsx scripts/squad-registry.ts testnet verify 0xbd1a8427da0b2b2d947a391ed117e49ec8801f81
```

Against local Hardhat at `PARITY_RPC` (default `http://127.0.0.1:8545`), run `npx tsx scripts/squad-registry.ts local deploy`, then `local publish ADDRESS` and `local verify ADDRESS`. The command checks both the loopback host and chain 31337. The local driver mines a confirmation block. Testnet waits for at least two confirmations.

## Verification

`PARITY_RPC=http://127.0.0.1:8545 npx --offline vitest run test/squad-receipt.test.ts --disableConsoleIntercept --reporter=verbose` verifies the actual TypeScript reader against a local Solidity registry. Three tests covered mode binding, private commentary exclusion, changed orders, disjoint match keys, tampered outcomes, scripted replay rejection, wrong chain, missing and pending records, unauthorized and duplicate writes, commitment mismatch and successful confirmation. Local optimized gas was 211,949 for deployment and 68,461 for recording. These are local registry transactions.

The dedicated operator deployed on BSC Testnet using 211,949 gas and published the Bomb record using 68,461 gas. The default BNB RPC limited the block log query, so the independent public reader used PublicNode and matched the success receipt, event, and state. The browser reader now prefers the CORS-enabled PublicNode endpoint and retains the BNB endpoint as a fallback. [Testnet receipt evidence](../evidence/squad-modes/bsc-testnet-bomb.json) · [Genuine match trace](../evidence/continuous-squads/bomb-94c5e9e8-b2cc-4fd1-b261-5aa814be685f.json)

BNB Bangkok's Developer Track judging includes design and usability, scalability, innovation, open source, and integration. The public announcement lists the build ending on 27 November in the morning, without an exact submission cutoff. It does not establish which sponsor requirements apply to this entry. [Official BNB Bangkok schedule and judging](https://www.bnbchain.org/en/blog/bnb-bangkok-build-demo-and-pitch) · [Official BSC Testnet network settings](https://docs.bnbchain.org/bnb-smart-chain/developers/wallet-configuration/)
