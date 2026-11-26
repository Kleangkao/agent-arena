# Demo and submission notes

## Current public demonstration

1. Start guest practice on [AGENT ARENA](https://agent-arena-preview.vercel.app/). Then open **My Agent → Agent Passport → Find Arena Commander** to discover ERC-8004 agent #2933 and its registered owner.
2. A coach who controls the registered Testnet wallet can select that agent for an Arena match and sign a one-match entry. The signature has no network fee. The public demo can use the genuine saved Relay match from the Passport or Arena.
3. Watch Blue secure South. Scrub to the next checkpoint and compare each commander's intent, accepted orders, and observed execution. Blue won 24–12.
4. On the result, check **Agent participation** and **BNB Chain replay record**. The first validates the owner signature, Testnet ownership and deterministic replay. The second checks the confirmed commitment. [Public evidence](https://agent-arena-preview.vercel.app/competition/commander-2933.json) · [Confirmed Testnet transaction](https://testnet.bscscan.com/tx/0x2c36b996f25a4b06e0764ce81947af7883830757a94ead7b03969fd6bc193e8f)

The replay is available to guests without a wallet or Gemini requests. The operator attests to model use, and an independent reader can rerun the recorded orders. [Current protocol and limitations](IDENTITY_COMPETITION.md)

## Original duel demonstration

AGENT ARENA is a guest-first AI auto-battler. Start with two equal fighters in Dust Yard, coach your agent in plain language, then watch what it chooses under the same fictional rules as its opponent.

1. Open the [public preview](https://agent-arena-preview.vercel.app/) and start practice without creating an account. Win the first round and show Quick start unlocking.
2. In the [protected Preview](https://agent-arena-preview-bfbnss8j0-jamesbitarcade-2158s-projects.vercel.app/), save a coaching message in My Agent and choose a Gemini opponent in Arena. Start the match, watch it, then open the result and expand Match details. If inference capacity is unavailable during a demo, use one of the explicitly labeled recorded matches.
3. Show the genuine lesson saved against that match. Open My Agent after refresh and show the persisted memory. A later local match uses that memory revision in the next Gemini request.
4. In the configured build, open Agent Passport under My Agent and check the public settlement. It shows Blue Team wins and links to the confirmed transaction and Arena contract. The seven-turn replay ends Blue 25–0. [Confirmed BSC Testnet receipt](https://testnet.bscscan.com/tx/0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672)

The public preview runs practice and recorded matches. The protected Preview completed a genuine hosted match, saved its reflection and reopened the replay. A rematch used the saved lessons and interrupted after Gemini returned two HTTP 503s. The BSC Testnet settlement is confirmed and the Passport was checked on the protected build. The contract independently computes a result from the submitted legal transcript. The operator attests to the transcript's AI provenance.

See [progress and evidence](PROGRESS.md), the [requirements tracker](REQUIREMENTS_TRACKER.md), and the [competition protocol](PROTOCOL.md).

The isolated Gameplay V2 graybox is an optional development update. Its [recording](../evidence/gameplay-v2/match-seed-3.webm) uses deterministic test policies and a separate replay format. The confirmed Testnet result belongs to V1.
