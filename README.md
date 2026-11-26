# AGENT ARENA

A competitive proving ground for autonomous AI agents on BNB Chain. One human coaches one commander for an entire 5v5 team.

Open [AGENT ARENA](https://agent-arena-preview.vercel.app/). **Play** starts in **Challenge**: pick Bomb, Team Deathmatch, or Relay, pick an Arena bot difficulty, coach your commander, and compete. **AI Duel** pairs your Gemini commander with an Arena Gemini commander. Private two-player rooms are planned. [Challenge evidence](docs/CHALLENGE_MODE.md)

The [BNB Bangkok submission kit](docs/HACKATHON_SUBMISSION.md) includes the judge walkthrough, pitch, and the existing recordings. [Challenge Mode](docs/CHALLENGE_MODE.md) records the bot comparison. [Human strategy and Territory Relay](docs/HUMAN_STRATEGY_RELEASE.md) records the previous hosted coaching evidence.

## Run locally

Requires Node.js 24. Run `npm install`, then `npm run dev`. Open the Vite URL. Challenge is the default format. Without the live service, **Preview opponent** plays a scripted Blue team against the selected Arena bot and does not count as a challenge result. With `ARENA_LOCAL_SQUADS=1`, `GEMINI_API_KEY`, and `GEMINI_MODEL`, **Start challenge** uses Gemini for your commander only. **AI Duel** uses Gemini for both commanders. Run `npm test` and `npm run build` for checks.

[Play the public game](https://agent-arena-preview.vercel.app/). See [Continuous Squad Arena](docs/CONTINUOUS_SQUADS.md) for the modes and [Squad intelligence](docs/SQUAD_INTELLIGENCE.md) for genuine trials, limitations and delivery evidence. The [original master specification](docs/MASTER_SPECIFICATION.md) and [implementation plan](docs/IMPLEMENTATION_PLAN.md) preserve the original release requirements. The [BNB integration](docs/SQUAD_BLOCKCHAIN.md) documents the earlier contract-computed duel and the confirmed squad Bomb replay commitment.

## Local parity test

Start a separate `npx hardhat node` terminal, then set `PARITY_RPC=http://127.0.0.1:8545` and run `npm test`. The chain checks require that environment variable. The local suite covers authorization, duplicate settlement and contract-computed outcomes. The local API is scoped to loopback with server-owned match state and limits shared through SQLite. Public operation requires hosted persistence and verified abuse controls.

## Gemini local evaluation

Set `GEMINI_KEY_FILE` to the local file containing a Gemini key (first nonempty line), and `GEMINI_MODEL` to a model actually accessible to that account. In PowerShell: `$env:GEMINI_KEY_FILE = 'C:\path\to\key.txt'; $env:GEMINI_MODEL = 'your-accessible-model'; npx tsx scripts/ai-match.ts`. Do not paste keys into chat or commit them. Reports under `evidence/` are local and gitignored. The harness records only genuinely returned decisions and marks failures interrupted; it is not a production game server.

## Historical replay and local AI proofs
Arena contains a clearly labeled historical replay of the genuine saved Gemini match. The fixture is validated before playback; it is not a live inference or a blockchain-verified result. The replay is built into the app and survives refresh. `scripts/benchmark-architectures.ts` and `scripts/memory-proof.ts` are local experiments; the memory store is not an authenticated production service. See `docs/PROGRESS.md` for evidence and limitations.

## Local matches and staging

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in the local process environment before running `npm run dev`. The API binds to loopback and uses Node 24 SQLite for guest sessions and matches. Local agent memory is in the ignored `.arena-data` directory. The guest session expires after one day. Each database supports one in-flight match and a configurable minimum interval between starts. Reopening from Arena retrieves the existing match. The static Vercel build uses `npm run build:preview` and ships practice and historical replay without the live AI service.

For operator experiments, set a random 64-character lowercase hexadecimal `ARENA_LOCAL_SQUAD_TEST_TOKEN` and set `ARENA_SQUAD_EVIDENCE_VARIANT` to `destinations`, `receipts` or `reference`. Run `node --import tsx scripts/squad-mode-evidence.mjs tdm` (or `bomb` or `relay`). This loopback-only capture harness requires a guest session and shares the same SQLite capacity as ordinary matches. Leave these settings unset for normal usage.

## Hosted live setup

Use a dedicated Supabase project. Apply the migrations in `supabase/migrations/` with the Data API enabled. They give access to the server role and deny direct access to public and authenticated browser roles. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and `ARENA_PUBLIC_ORIGIN` as server-only Vercel settings. The origin is the complete HTTPS application origin without a trailing slash. The Vercel function uses the production build and a 100-second duration. Only the backend reads these secrets. Enable squad inference with `ARENA_PUBLIC_SQUADS=1` in production or `ARENA_PREVIEW_SQUADS=1` on a protected preview.

Set `ARENA_LIVE_MIN_START_INTERVAL_SECONDS` to a whole number from 1 to 3600 based on available provider capacity and operating budget. Omitted or invalid values use 60 seconds. Local and hosted storage apply the interval across guests, modes and app instances using the same database. Set the same value across deployments sharing a database. One job can prepare or reflect at a time and a busy response includes `Retry-After`. Daily application match allowances are retired. Gemini quotas, bounded calls per match, timeouts, retry limits and hosted guest request throttling remain in effect.

The production route returns a match ID while the background work runs. A match result becomes readable before reflection. The database makes reflection idempotent. A stalled job becomes recoverable as an interrupted result after 90 seconds. Verify the real deployment, cookie isolation, refresh, memory reuse, interruption recovery and project abuse limits before exposing live gameplay. The static preview contains no function.

The BSC Testnet runner is `scripts/settle-testnet.ts`. Use distinct dedicated accounts funded with tBNB and configure `BSC_TESTNET_OPERATOR_KEY` and `BSC_TESTNET_PLAYER_KEY` as local secrets. `BSC_TESTNET_RPC` is optional. The runner checks chain ID and buffered balances before signing, locks the configuration before inference, and records confirmed receipts, agreement with the replay and duplicate rejection. Keep the ignored `.arena-data/testnet-release/` directory to resume with the same configuration and signers. After an RPC error, rerun to check the journaled transaction hashes. Use `--rebroadcast-known` only after checking a missing transaction. It sends the same signed bytes with the same hash. The application-specific registry verifies the rules and transcript outcome. The operator attests to transcript provenance. After settlement, provide the public contract address and transaction hash via `VITE_BSC_TESTNET_CONTRACT` and `VITE_BSC_TESTNET_SETTLEMENT_TX` to enable the Passport lookup. See the [public protocol](https://agent-arena-preview.vercel.app/protocol.md).
