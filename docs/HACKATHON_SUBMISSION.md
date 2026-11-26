# BNB Bangkok submission kit

## Event and submission

**Developer Track, BNB Bangkok 2026.** The organizer's brief accepts projects built on BNB Chain and highlights on-chain AI agents and real-world assets. HackQuest's event instructions put registration and submission closure at **09:00 Bangkok time (UTC+7) on 27 November 2026**. Demo Night is at Park Hyatt Bangkok on 27 November, 15:00–18:00 local time, with separate admission and presentation selection. [HackQuest event and submission instructions](https://www.hackquest.io/hackathons/BNB-Bangkok) · [BNB Chain organizer announcement](https://www.bnbchain.org/en/blog/bnb-bangkok-build-demo-and-pitch)

The BNB Chain judging criteria cover design and usability, scalability, innovation, open source and integration. The public Developer Track materials provide no numeric weights or track-specific video length. Show the guest coaching journey and verification first, then explain how one commander per team and bounded checkpoints constrain provider work. Identify the code available for review and explain how registered ownership enables signed entry. Disclose the existing product checkpoint and explain exactly what changed during the event. [Organizer judging criteria and build guidance](https://www.bnbchain.org/en/blog/bnb-bangkok-build-demo-and-pitch#judging)

An approved entrant signs in to HackQuest, confirms participation, creates or joins the team project, and adds the project description, repository and demo. Select **Developer Track** and check for the portal confirmation after submitting. Use the exact form fields shown by the portal. The project materials here are for the Developer Track. Read-only evidence checks and preparation do not confirm an external submission.

## Copy for the project form

| Field | Copy |
| --- | --- |
| Name | AGENT ARENA |
| Tagline | Humans coach. AI competes. |
| Short description | Coach one autonomous commander, choose an Arena challenge, and inspect the replay. BNB Chain keeps the agent identity and the evidence. |
| Public application | [Play AGENT ARENA](https://agent-arena-preview.vercel.app/). |
| Repository | [Kleangkao/agent-arena](https://github.com/Kleangkao/agent-arena). |
| Demo | [Genuine Challenge and same-setup rematch](../evidence/challenge-release/relay-normal/hosted-live.webm) · [31-second historical verification fallback](../evidence/hackathon-release/commander-2933-fallback.mp4). Share a file through a judge-accessible URL if the portal requires one. |

**Detailed description**

An AI identity identifies an agent and its owner. AGENT ARENA gives people a way to see what the agent can do. A human prepares and coaches one commander. The commander chooses orders for its whole team. The player chooses a challenge, watches the match, and can revise the coaching.

**Challenge** is the main format. The player picks Bomb Mode, Team Deathmatch, or Relay, then Easy, Normal, or Hard. The player's commander is a Gemini model. The Arena opponent is a versioned local policy, `arena-bot/v3`, with the same health, speed, and rules. **AI Duel** pairs two Gemini commanders. Private two-player rooms are future work.

Choose Relay, Team Deathmatch or Bomb Mode. Each team starts with the same number of units and the same capabilities. The player's model receives scoped observations and the locked coaching, then authors its own orders. The deterministic engine resolves movement, actions, and the result. One win does not prove a stronger commander, and Arena results are not a measure of general intelligence.

On BSC Testnet, ERC-8004 Commander #2933 has persistent identity and a registered owner. The owner signed the entry for a genuine Relay match under the earlier rules. Anyone can reproduce its result and confirm that the evidence matches the registry's on-chain commitment. New challenge replays can include the opponent id, policy version, and difficulty in a future evidence hash. This build does not add a contract or a new transaction. Arena history is separate from ERC-8004 reputation feedback. No wallet is needed to watch or verify published evidence.

## Judge walkthrough and pitch

1. **0:00–0:20 · Open Play.** “Humans coach. AI competes. I prepare one commander, then choose the challenge it has to beat.” Show **Challenge**, the three modes, and Easy, Normal, and Hard. AI Duel is the separate Gemini-versus-Gemini format.
2. **0:20–0:50 · Coach and compete.** Enter a short coaching message. Start a Challenge when the live service has capacity. Your commander uses the model. The Arena bot does not. Use scripted preview or the recorded fallback if the provider is busy. The Challenge capture includes difficulty selection and a revised rematch.
3. **0:50–1:25 · Review and adjust.** Follow the ownership indicators, unit movement, actual commands and score. Open the result review. Explain that the commander's stated intent, accepted orders and resulting behavior answer separate questions. Show how to revise coaching and retain the setup for a rematch. One observed result can motivate a revision without proving a causal effect.
4. **1:25–2:15 · Verify.** Open **Arena → Watch ERC-8004 Commander #2933**. At the result, open **Agent participation** and check the signature and replay. Open **BNB Chain replay record** and check the Testnet commitment. “The owner authorized this competition, you can reproduce its outcome, and the registry binds that evidence to a confirmed record.” This published match uses the historical Relay rules.
5. **2:15–2:30 · Close.** “A persistent identity gives an agent a name and an owner. AGENT ARENA gives it a competitive record anyone can inspect.” If asked about outside agents, show the separate, runnable Node commander over the local protocol.

For the live presentation use **Play** for preparation and **Arena** for the verified match. Open the recorded fallback if genuine inference is unavailable. The fallback is a browser recording of the historical genuine match and its verification. The recording opened the public Passport, played the match to its result, checked the signature and replay, and checked the Testnet commitment. It made zero API POSTs and reported zero browser errors. [Fallback video](../evidence/hackathon-release/commander-2933-fallback.mp4) · [External commander protocol](EXTERNAL_COMMANDER.md)

## Public proof and reproduction

| Item | Evidence |
| --- | --- |
| ERC-8004 | Commander #2933, BSC Testnet chain 97. [Public profile](https://agent-arena-preview.vercel.app/agent-arena-commander.json) · [Identity registry](https://testnet.bscscan.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) · [Registration receipt](https://testnet.bscscan.com/tx/0xfaf23fdba98496e60bd637f74ee410f4f64e59d7c7caa7caed9988a7ee08fa7e) |
| Owner-authorized competition | Historical Relay, Blue 24–12, six accepted Gemini calls, 7.46 seconds to prepare on the server. [Published replay and evidence](https://agent-arena-preview.vercel.app/competition/commander-2933.json) |
| Identity evidence commitment | [Squad registry](https://testnet.bscscan.com/address/0xbd1a8427da0b2b2d947a391ed117e49ec8801f81) · [Confirmed Testnet transaction](https://testnet.bscscan.com/tx/0x2c36b996f25a4b06e0764ce81947af7883830757a94ead7b03969fd6bc193e8f) |
| Legacy contract-computed duel | Historical 1v1 demonstration with separate rules. [Confirmed settlement](https://testnet.bscscan.com/tx/0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672) |
| Public screenshots | [Desktop battle](../evidence/identity-competition/public-battle-1180.png) · [Mobile Passport](../evidence/identity-competition/public-passport-390.png) · [Desktop verified result](../evidence/identity-competition/public-result-1180.png) |
| Current game and coaching | [Challenge verification](CHALLENGE_MODE.md) · [Desktop setup](../evidence/challenge-release/relay-normal/hosted-live-prepare-desktop.png) · [Mobile review](../evidence/challenge-release/relay-normal/hosted-live-review-mobile.png) |

Install using Node.js 24 and npm as documented in the README. Run `npx tsx scripts/verify-identity-competition.ts --expect-chain` to validate the historical owner, recover the owner signature, recompute the replay and compare the confirmed event and storage. No wallet or inference key is required. A fresh CLI check and an independent official BNB Chain MCP read both succeeded. MCP confirmed chain 97, the registered owner, the matching storage and event hash, and a successful receipt at block 145034610 using 68,449 gas. [Fresh MCP evidence](../evidence/hackathon-release/bsc-recheck.json) · [Setup and commands](../README.md) · [Competition architecture](IDENTITY_COMPETITION.md) · [Autonomous squads](CONTINUOUS_SQUADS.md) · [Official BNB tools](BNB_AGENT_TOOLING.md)

### Trust and scope

The squad registry stores an operator-published commitment. Deterministic validation executes off-chain. The provider attribution comes from Arena, and raw prompts and private coaching stay private. The owner's signature authorizes the scoped match entry. Arena competitive history is distinct from standardized ERC-8004 reputation, which requires legitimate independent feedback. The external commander completed local protocol matches. Public external matchmaking is future work.

### Owner submission checklist

- Confirm organizer approval and team participation in HackQuest.
- The owner authorized a public repository at [Kleangkao/agent-arena](https://github.com/Kleangkao/agent-arena). Confirm the project license separately. Asset origins and terms are documented. [Asset credits](ASSET_LICENSES.md)
- Share an accessible capture of the final demo or the clearly labeled historical fallback, and use the public game for the live walkthrough.
- Enter the project copy, links and team details in the Developer Track form. Check for submission confirmation by the published deadline.
