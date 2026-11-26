# Approved implementation plan

The complete `MASTER_SPECIFICATION.md` is authoritative; this is an execution summary and does not remove requirements.

The owner subsequently approved an abstract top-down visual direction for the current product. [Top-down Arena](TOP_DOWN_ARENA.md) records that amendment and its verification. The release and historical requirements below document the original implementation scope.

The current owner-approved gameplay is [Squad Arena](SQUAD_ARENA.md). A 5v5 commander directs an equal team across two relays; new squad matches use versioned off-chain rules. Duel training, recordings, and the existing BSC Testnet settlement retain their original rules and provenance.

## Product and first release
Humans coach; AI competes. Deliver a real guest-first 1v1 tactical auto-battler, identical initial stats and equipment, natural language coaching, real Gemini decisions, memory reused later, and event-driven playback. The first playable slice is one isometric desert arena, two distinguishable characters, complete deterministic match, replay, result and rematch. The complete hackathon MVP adds official real AI opponents, at least one training stage (three configurations targeted), cohesive final visuals, persistent memory, BSC Testnet identity, contract-computed verified outcome, confirmed settlement, public passport and protocol, public deployment and evidence. Bomb defusal, multiple weapons, stat upgrades, 5v5, marketplace and real-money systems are outside the MVP.

## Presentation and experience
Original Dust Yard: sandstone, crates, stone, arches, warm daylight and painted Site A motif; original Blue/Sand characters with universal base, two appearances minimum, four targeted. Isometric Pixel Art 2.5D, depth sorting and smooth animation; no proprietary Counter-Strike assets or copied map. Model map nodes, layers, heights and connections for future elevation; MVP stays flat. Charcoal, sand, ivory, blue and amber identity. Play/My Agent/Arena only; accessible DOM controls; guest-first, sensible defaults, no mandatory wallet, registration, name, coaching or model selection. Target 3–5 interactions to first match; battlefield-first, messaging-style coaching, result/rematch/coach, compact passport, progressive disclosure and meaningful errors.

## Architecture and implementation
React, TypeScript, Vite, Phaser; pure TypeScript simulator and Solidity verifier with shared cross-language fixtures, Hardhat, server-side Gemini, Supabase, Vercel, viem and BSC Testnet. Timebox the architecture proof; adopt Solidity-authoritative simulation only if a short proof shows clear benefit. Keep bounded deterministic rules, event-based renderer and real structured AI decisions with validation, budgets, retries and timeouts. Distinguish deterministic training bots, real official Gemini agents and future community/external agents. Compare coaching with equivalent conditions and demonstrate memory reuse; second model is optional. Protect secrets and do not expose insecure APIs.

BNB provides agent identity, battle verification and open protocol. Prefer ERC-8004 when feasible; otherwise clearly identify an app-specific registry. Bind configuration, participant authorization, map and rules before a match; verify bounded action transcripts, compute outcomes and reject invalid, altered, unauthorized or duplicate settlements. Publish schemas, ABI, authorization, replay and deployment references. Explain operator trust and the absence of AI provenance proof. An independent client is high-value, not proof merely by interface.

## Milestones and priorities
- Hours 0–2: validate credentials, Gemini, BSC Testnet, contract tooling, assets and architecture.
- Hours 2–5: deterministic complete match and animated replay.
- Hours 5–8: Gemini coaching/decisions, verifier, parity and gas; early staging once API is safe and integrations ready.
- Hours 8–12: Dust Yard, characters, animations, isometric visual identity.
- Hours 12–16: guest navigation, coaching, memory, results and rematch.
- Hours 16–19: campaign, official opponents, passport, wallet and confirmed settlement.
- Hours 19–22: feature freeze, browser, gameplay, AI, security and Testnet testing; fix critical problems.
- Hours 22–24: public deployment and submission evidence. Adapt to real deadline and progress.

P0: complete gameplay, genuine AI/memory, usability, visual identity and meaningful on-chain verification. P1: additional configurations, cosmetic variations, external client, second-model exhibition. P2: extra maps/providers and community matchmaking. Reduce optional scope first, documenting impact.

## Verification and blockers
Test deterministic termination, actions, state bounds, replay, side fairness, parity, authorization, duplicate settlement, persistence and isolation. Test genuine AI matches and coaching, observe desktop/mobile screenshots and animated playback, and confirm transaction receipt and state. Gemini failure may use clearly labeled fallback only in practice; competition is interrupted or unverified. Reflection failure must not invalidate a result. Missing credentials, funding or deployment access block the corresponding integration but not independent work. Preserve actual evidence and report implemented, tested, mocked, blocked and incomplete separately; do not fabricate results.

The 27 November owner amendment adds continuous authoritative movement, Bomb Mode, Team Deathmatch, and the Relay comparison in the same application. [Current modes and evidence](CONTINUOUS_SQUADS.md) record the scope and validation. [Squad BNB integration](SQUAD_BLOCKCHAIN.md) records the separate historical duel verification and current squad replay commitment.
