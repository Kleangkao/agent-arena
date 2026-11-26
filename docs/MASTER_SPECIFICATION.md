# AGENT ARENA
## Unified Master Development Specification
### Version 1.0 — 24-Hour Hackathon MVP

---

# 00. Executive Summary

Project Name: **AGENT ARENA**

Tagline: **Your strategy. Your AI. Your champion.**

Secondary tagline: **You coach. AI competes.**

Build a visually engaging, accessible, browser-based AI tactical auto-battler where humans create, coach, train, and compete using autonomous AI agents.

Players teach their agents through natural language rather than directly controlling combat.

Agents powered by real AI models interpret human instructions, observe fictional game states, make decisions, compete under deterministic game rules, and accumulate persistent experience.

BNB Smart Chain provides persistent agent identity, independently inspectable battle settlement, public competition records, and the foundation for an open agent competition protocol.

The game must combine:

- The competitive atmosphere of classic Counter-Strike.
- Original desert-themed environments inspired by the visual atmosphere of Dust II.
- Pixel Art 2.5D isometric presentation.
- The coaching experience of a management game.
- Real AI model competition.
- Persistent agent memory.
- Meaningful BNB Smart Chain integration.
- Consumer-grade UX simplicity inspired by Apple, YouTube, Instagram, and Facebook.

The primary development target is a functional BNB Chain Hackathon MVP within a strict 24-hour implementation budget.

Build an actual playable product, not merely a presentation, design document, mockup, AI dashboard, or blockchain demonstration.

This unified document supersedes all previous AGENT ARENA prompts and addenda.

---

# 01. Your Role

Act as a multidisciplinary senior product development team.

Your responsibilities include:

- Product management.
- Game design.
- Gameplay engineering.
- Technical art.
- UX/UI design.
- AI agent engineering.
- Blockchain engineering.
- Backend development.
- Security engineering.
- Quality assurance.
- Deployment.
- Hackathon submission preparation.

You are responsible for investigating, designing, implementing, testing, integrating, and delivering the product.

Do not stop after producing a development plan.

Work autonomously within the approved product scope.

Use established libraries, official SDKs, reusable components, and existing development tools wherever they reduce implementation risk.

Do not overengineer.

When encountering a technical obstacle, investigate the simplest alternative that preserves the intended player experience.

Do not treat every inconvenience as a blocker.

Do not invent successful integrations, test results, AI responses, transaction hashes, deployment URLs, or completed features.

**Build a simple game with deep AI, not a complicated game with shallow AI.**

---

# 02. Product Vision

AGENT ARENA is a competition platform where human strategy becomes autonomous AI gameplay.

The player is a coach.

The agent is the competitor.

The game engine enforces the rules.

The blockchain verifies eligible competition results.

The player should feel that they are developing a character with its own identity, experience, preferences, and decision-making ability.

They should not feel that they are configuring a language model API.

The game must appeal to:

- Casual gamers.
- Competitive gamers.
- People interested in AI.
- People who enjoy coaching and management games.
- Prompt engineering enthusiasts.
- Developers building autonomous agents.

A casual player should be able to enjoy the game without understanding blockchain, AI infrastructure, programming, or prompt engineering.

A developer should eventually be able to create an external agent that competes under the same documented game protocol.

## 2.1 Competitive philosophy

Competition should emerge from:

1. Human coaching.
2. AI interpretation.
3. Agent decision-making.
4. Accumulated experience.
5. Adaptation.

Competition should not emerge from:

- Purchased statistical advantages.
- Higher damage from leveling.
- Rare equipment.
- Paid upgrades.
- Expensive NFTs.
- Token ownership.

All initial competitors must have identical gameplay equipment and base attributes.

Cosmetics do not affect gameplay.

## 2.2 Long-term vision

AGENT ARENA may eventually become an open AI esports platform.

Future competition formats may include:

- Gemini versus GPT.
- Gemini versus Claude.
- Commercial models versus open-source models.
- Identical models with different human coaching.
- Memory-enabled versus memory-disabled agents.
- Independently developed external agents.
- AI teams coached by humans.
- Community tournaments.

Do not attempt to build this entire ecosystem within the first 24 hours.

Deliver the smallest meaningful foundation that demonstrates this vision.

---

# 03. Locked Product Decisions

The following decisions have been approved.

Do not reopen these decisions unless a verified technical limitation requires a change.

| Category | Approved Direction |
|---|---|
| Platform | Web browser |
| Genre | AI Tactical Auto Battler |
| Player role | Coach |
| Combat control | Fully autonomous AI |
| Visual style | Pixel Art 2.5D Isometric |
| Visual theme | Modern Tactical / Desert Industrial |
| Visual inspiration | Classic Counter-Strike atmosphere |
| Map inspiration | Dust II / Site A atmosphere |
| Character system | Universal character base |
| Factions | Blue Team and Sand Team |
| Equipment | Identical initial equipment |
| Weapon archetypes | One initial fictional weapon |
| Initial match format | 1v1 |
| Campaign | Three compact training configurations |
| Arena | Official AI opponents available immediately |
| Progression | Memory, experience, stage unlocking |
| Battle presentation | Precomputed simulation and animated playback |
| AI provider | Google Gemini |
| Future AI architecture | Provider-independent |
| Blockchain | BNB Smart Chain Testnet |
| Blockchain purpose | Identity, verification, public records, open protocol |
| Main navigation | Play, My Agent, Arena |
| UX philosophy | Consumer-grade simplicity |
| Onboarding | Guest-first |
| Economy | No real-money economy |
| Custom token | None |
| Marketplace | None |
| Implementation budget | 24 hours |

The initial game must not become:

- A generic cryptocurrency dashboard.
- A text-only AI conversation simulator.
- A card game replacing the approved tactical presentation.
- A complex RPG.
- A real-world combat simulator.
- A clone of Counter-Strike.
- A blockchain leaderboard without meaningful game verification.

---

# 04. Product Experience Philosophy

**Complex technology. Simple experience.**

Treat UX/UI quality as a core product requirement, not an optional polish task.

Take inspiration from the product design principles of Apple, YouTube, Instagram, and Facebook.

Do not reproduce their proprietary interfaces or branding.

Apply the following principles:

- Immediate usability.
- Familiar interactions.
- Visual-first communication.
- Strong hierarchy.
- Minimal wording.
- Clear primary actions.
- Progressive disclosure.
- Predictable navigation.
- Responsive feedback.
- Accessible interfaces.
- Minimal cognitive load.

A first-time player must not need to understand:

- AI agents.
- LLMs.
- AI inference.
- Prompt engineering.
- Smart contracts.
- Wallets.
- Gas fees.
- Blockchain verification.

These technologies must support the experience rather than dominate it.

The product must feel like a game first.

## 4.1 Core UX rules

- Play first. Register later.
- Show, do not overexplain.
- One screen should have one dominant purpose.
- Provide sensible defaults.
- Make advanced features optional.
- Keep the character at the center of the experience.
- Hide implementation complexity without hiding important permissions, costs, or errors.
- Avoid unnecessary screens and confirmation dialogs.
- Do not display every implemented feature simultaneously.

---

# 05. Core Gameplay Loop

The primary gameplay loop is:

    Create or select Agent
        ↓
    Coach
        ↓
    Train
        ↓
    Watch Battle
        ↓
    Review Result
        ↓
    Learn
        ↓
    Improve
        ↓
    Enter Arena
        ↓
    Repeat

The player must be able to complete this loop without directly controlling the character during combat.

## 5.1 First-time experience

A new player should be able to initiate their first match within approximately three to five interactions.

Target a first-match initiation time of approximately 30 seconds, excluding AI processing time.

This is a usability target, not a guaranteed measured result.

Suggested flow:

1. Open the website.
2. Press Play.
3. Accept the default agent or choose an appearance.
4. Optionally select a coaching suggestion or enter custom instructions.
5. Start the match.

Do not require:

- Account registration.
- Wallet connection.
- API key entry.
- Mandatory character naming.
- Mandatory model selection.
- Mandatory free-text coaching.
- Long tutorials.
- Blockchain explanations.

Allow further personalization after the first match.

---

# 06. Mandatory Technical Investigation

Before committing to the implementation architecture, perform a short technical proof-of-concept.

Timebox this phase to approximately the first two hours.

The purpose is to remove uncertainty, not create lengthy research documents.

## 6.1 Inspect the development environment

Inspect:

- Current workspace.
- Existing files.
- Git status.
- Installed Node.js version.
- Available package managers.
- Available game development tools.
- Browser automation capabilities.
- Solidity development tools.
- Available deployment integrations.
- Existing environment configuration.
- Available Supabase projects.
- Available Vercel projects.
- Available Gemini credentials.
- Available Testnet wallet configuration.

Do not overwrite unrelated work.

If reusable pre-existing code is available, inspect its suitability and verify hackathon rules before incorporating it.

Clearly document reused components.

## 6.2 Verify actual dependencies

Perform real minimal tests where access permits:

1. Call a currently supported Gemini model.
2. Receive a valid structured response.
3. Validate the response using a runtime schema.
4. Connect to BSC Testnet.
5. Verify the chain ID.
6. Check Testnet wallet funding.
7. Compile and execute a minimal Solidity contract locally.
8. Deploy a minimal Testnet contract if funding is available.
9. Render a small isometric scene in the selected game engine.
10. Investigate character and environment asset availability.
11. Investigate official ERC-8004 registration.
12. Investigate hosting and serverless execution limits.

Do not assume that a package, model ID, SDK method, deployed contract address, free-tier quota, or public RPC is currently available.

Verify actual behavior.

## 6.3 Research references

Consult current official documentation where relevant:

- https://ai.google.dev/gemini-api/docs
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://docs.bnbchain.org/
- https://github.com/bnb-chain
- https://eips.ethereum.org/EIPS/eip-8004
- https://eips.ethereum.org/EIPS/eip-712
- https://viem.sh/
- https://docs.phaser.io/
- https://phaser.io/
- https://supabase.com/docs
- https://vercel.com/docs
- https://getfoundry.sh/
- https://www.hackquest.io/hackathons/BNB-Bangkok

Locate the current official BNB Agent SDK documentation and supported registry deployments through verified official sources.

Verify the actual hackathon:

- Submission deadline.
- Eligibility.
- Developer Track requirements.
- Testnet acceptance.
- Submission format.
- Pre-existing-code rules.
- Required demonstration materials.
- Sponsor requirements if relevant.

Do not make optional sponsor integration a dependency of the primary game.

## 6.4 Investigation outputs

Maintain concise working documents:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/TECHNICAL_VALIDATION.md`
- `docs/BLOCKERS.md`

These documents should support implementation rather than replace it.

Proceed directly into development once the essential architecture is validated.

Continue non-blocked work even if some external credentials are unavailable.

---

# 07. Technology Stack

Preferred stack:

## Frontend

- Phaser.
- TypeScript.
- Vite.
- React or equivalent lightweight DOM-based application UI.
- CSS-based responsive layouts.
- WebGL where appropriate.

## Backend

- TypeScript.
- Lightweight server-side API routes.
- Official Google Gen AI SDK or another officially supported Gemini integration.
- Runtime validation with Zod or equivalent.
- Supabase for persistent data.
- Vercel for deployment.

## Blockchain

- Solidity.
- Foundry or Hardhat.
- viem.
- BNB Smart Chain Testnet.
- ERC-8004 if verified and feasible.
- EIP-712 where participant authorization requires it.

## 7.1 Engine selection

Phaser is the preferred default because of its browser integration, lightweight rendering, TypeScript ecosystem, and straightforward connection to web application and wallet functionality.

Use a verified stable release.

Godot, Rust, or another engine is permitted only if technical investigation demonstrates a meaningful implementation advantage without compromising the 24-hour deadline.

Do not switch engines merely because another technology is theoretically more powerful.

The initial game has:

- One small arena.
- Two active characters.
- Limited fictional gameplay state.
- Precomputed battle playback.
- No requirement for a complex physics engine.

Do not introduce unnecessary infrastructure:

- Kubernetes.
- Redis.
- Microservice clusters.
- Custom blockchain indexers.
- Vector databases.
- Dedicated real-time multiplayer servers.
- Complex queue systems.
- Custom AI inference infrastructure.

Prefer the smallest architecture that satisfies actual product requirements.

---

# 08. Architecture

Separate the following responsibilities:

1. Application UI.
2. Game renderer.
3. Deterministic game protocol.
4. Agent runtime.
5. AI model providers.
6. Persistence.
7. Blockchain integration.

Suggested repository:

    agent-arena/
      src/
        app/
        ui/
          navigation/
          components/
          screens/
          theme/
        game/
          scenes/
          rendering/
          animation/
          assets/
          maps/
          replay/
          audio/
        core/
          protocol/
          state/
          actions/
          rules/
          simulator/
          validation/
        agents/
          providers/
          runtime/
          coaching/
          memory/
          opponents/
        blockchain/
          abi/
          registry/
          settlement/
          clients/
        persistence/
      api/
      contracts/
      test/
      scripts/
      public/
      supabase/
      docs/
      README.md
      .env.example

Adapt this structure to the selected framework.

Avoid unnecessary abstraction layers and monorepo complexity.

## 8.1 Architectural boundaries

- Rendering never determines authoritative outcomes.
- AI never directly modifies authoritative game state.
- AI providers do not own combat rules.
- Combat rules do not depend on Gemini.
- Blockchain modules do not depend on Phaser.
- Assets are replaceable independently from gameplay.
- Persistent storage does not override finalized blockchain outcomes.
- Model identity is distinct from agent identity.
- Rules, maps, and replay formats are versioned.
- Public metadata does not expose private instructions.
- API credentials never enter the frontend bundle.

Use strict TypeScript types for important domain objects.

## 8.2 Conceptual flow

    Player Coaching
        ↓
    Versioned Agent Configuration
        ↓
    Agent Runtime
        ↓
    AI Provider
        ↓
    Validated Game Decision
        ↓
    Deterministic Battle Protocol
        ↓
    Authoritative Event Stream
        ├── Animated Replay
        ├── Match Result
        ├── Agent Reflection
        └── Blockchain Settlement

---

# 09. Art Direction

Create an original competitive tactical game with the recognizable atmosphere of classic Counter-Strike.

The visual direction must combine:

- Pixel Art.
- Isometric perspective.
- Convincing 2.5D environmental depth.
- Desert architecture.
- Modern tactical characters.
- Competitive esports branding.
- Warm environmental lighting.
- Minimal consumer-friendly interface design.

The product should visually evoke the genre without reproducing copyrighted assets.

Do not copy:

- Counter-Strike logos.
- Dust II map geometry.
- Existing character models.
- Weapon textures.
- Proprietary sound effects.
- Original game UI.
- Existing promotional artwork.

Use original artwork, procedural assets, or appropriately licensed third-party assets.

Keep all combat stylized, fictional, and non-graphic.

---

# 10. Corporate Identity

Develop an original AGENT ARENA identity.

Brand keywords:

- Competitive.
- Tactical.
- Confident.
- Minimal.
- Desert.
- Industrial.
- Premium.
- Accessible.
- Modern esports.

## 10.1 Logo

Create an original wordmark or simple symbol.

The logo should be:

- Bold.
- Readable.
- Distinctive.
- Suitable for a game title screen.
- Recognizable at small sizes.
- Usable on desktop and mobile.

Avoid visual imitation of the Counter-Strike logo.

Do not spend excessive development time designing multiple logo alternatives.

## 10.2 Color palette

Suggested starting palette:

| Role | Color |
|---|---|
| Carbon background | #16191B |
| Secondary surface | #222629 |
| Desert sand | #D8AD6B |
| Ivory text | #EEE7D9 |
| Muted text | #A49F95 |
| Blue Team | #527D9D |
| Sand Team | #BC7042 |

These colors are starting points, not immutable requirements.

Adjust for accessibility, legibility, and actual rendered appearance.

## 10.3 Typography

Suggested:

- Barlow Condensed or Rajdhani for headings.
- Inter or another readable sans-serif for application text.

Verify licensing before distribution.

Do not use pixel fonts for all interface text.

Use bold competitive typography selectively.

## 10.4 Visual restraint

Avoid:

- Excessive neon.
- Generic crypto gradients.
- Unnecessary glassmorphism.
- Glowing borders around every component.
- Excessive decorative cards.
- Large blockchain logos.
- Dashboard-style metric overload.

BNB branding should appear in appropriate verified competition and Agent Passport contexts.

---

# 11. Character Direction

Use a single reusable character base.

Target character proportions of approximately three to four heads tall.

Characters should resemble stylized fictional competitive shooter participants.

Do not make them excessively realistic or excessively cute.

Prioritize strong silhouettes at normal gameplay scale.

## 11.1 Blue Team

Visual attributes:

- Muted navy and blue uniform.
- Helmet.
- Protective goggles.
- Stylized tactical vest.
- Clean structured silhouette.
- Recognizable team accents.

## 11.2 Sand Team

Visual attributes:

- Desert tan and muted brown clothing.
- Scarf or headwear.
- Stylized vest.
- Distinct warm-colored silhouette.
- Recognizable team accents.

These are fictional visual factions inspired by the general contrast of classic competitive shooters.

They do not represent real organizations.

## 11.3 Cosmetics

Target four cosmetic appearances using reusable assets.

Minimum acceptable fallback:

- One character base.
- Two distinguishable faction palettes.

Additional variations may use:

- Palette swaps.
- Uniform colors.
- Helmet variations.
- Accessories.

Cosmetics never modify:

- Health.
- Movement.
- Damage.
- Accuracy.
- Equipment.
- Decision budget.
- Visibility.
- Game rules.

The user must be able to preview and select appearances easily.

## 11.4 Animation

Minimum animation states:

- Idle.
- Movement.
- Fictional weapon activation.
- Reload.
- Hit reaction.
- Defeat.

Optional:

- Utility activation.
- Victory pose.
- Additional direction variants.

Use sprite flipping or other efficient techniques where visually appropriate.

Do not create complex skeletal animation systems unless already available.

---

# 12. Environment and Maps

The initial environment is an original desert-themed competitive arena.

Use the visual atmosphere of Dust II and Site A as inspiration.

Do not recreate the actual map layout.

## 12.1 Environment elements

Create or acquire a small coherent asset library containing:

- Sandstone walls.
- Beige plaster walls.
- Stone floor tiles.
- Wooden doors.
- Wooden crates.
- Arched entrances.
- Simple metal objects.
- Decorative rooftops.
- Site signage.
- Environmental shadows.

Use warm daylight rather than dark cyberpunk lighting.

Keep character readability high.

## 12.2 Initial arena: Dust Yard

Create an original compact arena named **Dust Yard**.

The arena should include a recognizable Site A visual motif, such as a painted A marking.

This is an environmental gimmick for the MVP.

Do not make bomb planting, bomb defusal, realistic explosive mechanics, or objective-based team combat a requirement.

The initial mode remains bounded 1v1 fictional elimination competition.

## 12.3 Campaign configurations

Use the same modular environment assets for three training configurations.

**Stage 01 — Courtyard**

- Simple original arena.
- Introduce basic game rules.
- Predictable training opponent.

**Stage 02 — Double Gate**

- Different arrangement of environmental objects.
- Introduce more movement restrictions.
- Different opponent behavior.

**Stage 03 — Site A**

- Recognizable Site A visual identity.
- Introduce additional fictional utility effects.
- Official AI opponent where feasible.

These are original game layouts.

Do not create three unrelated asset libraries.

## 12.4 Future level depth

Design the map architecture for future elevation.

Represent:

- Unique node or tile identifier.
- Logical x and y coordinates.
- Elevation.
- Layer identifier.
- Traversability.
- Blocking state.
- Explicit movement connections.
- Surface type.
- Spawn information.
- Decorative objects.
- Visual depth anchors.

Do not assume that adding a height variable alone implements multi-level navigation.

Use explicit graph connections to support future stairs, platforms, bridges, and overlapping levels.

For the initial MVP:

- Use one active gameplay elevation.
- Allow decorative vertical structures.
- Do not require playable multi-floor traversal.
- Avoid dynamic geometry.

Future playable elevation is an architectural extension, not a mandatory release feature.

## 12.5 Isometric rendering

Implement:

- Consistent logical-to-screen projection.
- Depth sorting.
- Ground shadows.
- Appropriate sprite anchors.
- Smooth movement interpolation.
- Correct character and object overlap.
- Consistent pixel scale.
- Crisp texture filtering.

Test actual rendered scenes.

Characters must appear correctly in front of and behind relevant objects.

---

# 13. Asset Production Strategy

Asset availability must not prevent core development.

Use the following priority order:

1. Original assets.
2. Procedurally generated assets.
3. Verified licensed asset packs.
4. Consistent temporary placeholders.

For early gameplay validation, use programmatically generated sprites and simple environment objects if necessary.

Later replace them without altering game logic.

Minimum asset budget:

| Asset | Target |
|---|---:|
| Character base | 1 |
| Faction styles | 2 |
| Cosmetic variants | Up to 4 |
| Environment tileset | 1 |
| Environment props | 6–10 |
| Fictional weapon archetype | 1 |
| Core animation states | 6 |
| Utility effects | 2 |
| Basic sound effects | 5–10 |
| Background audio | Optional |

Do not spend hours browsing asset marketplaces.

Set an explicit asset acquisition time budget.

If suitable assets cannot be found, create a cohesive original low-resolution visual style.

Do not mix inconsistent art styles merely to increase asset count.

Maintain:

    docs/ASSET_LICENSES.md

Record:

- Asset name.
- Author.
- Source URL.
- License.
- Attribution requirements.
- Modifications.
- Redistribution restrictions.

Do not claim that assets are licensed unless verified.

---

# 14. Game Modes

Implement Training Campaign and Arena using the same simulation protocol.

Do not create separate combat engines.

## 14.1 Training Campaign

Purpose:

- Immediate gameplay.
- Introduce coaching.
- Teach game mechanics naturally.
- Build agent experience.
- Allow experimentation without blockchain friction.

Training must be available to guest players.

Stage progression:

- Begin with the first stage unlocked.
- A valid victory unlocks the next stage.
- Completed stages remain replayable.
- Losses allow immediate rematch.
- No permanent penalties.
- Experience and memory persist.

Use configurable stage definitions.

The target is three complete training configurations.

If necessary, first deliver one complete configuration and expand after the vertical slice works.

## 14.2 Arena

Purpose:

- Challenge other agents.
- Demonstrate real AI versus AI.
- Support verified competition.
- Create publicly inspectable match records.

Official opponents must be available immediately.

Do not require another human player to be online.

Provide at least two selectable official opponent profiles.

Use real Gemini decisions for official AI opponents.

Deterministic training bots must be clearly labeled as bots.

Do not present a deterministic bot as an AI model.

## 14.3 Opponent types

Support:

**Training Bot**

Deterministic opponent for reproducible tests and introductory gameplay.

**Official AI Agent**

Real Gemini-powered opponent operated by the application.

**Community Agent**

An agent created by another user, eligible for asynchronous competition through explicit authorization.

Community Agent functionality is optional for the first release unless the core product is already complete.

**External Agent**

An independently implemented agent using the published competition protocol.

A minimal independent client proof-of-concept is preferred over a large unfinished SDK.

## 14.4 Matchmaking

Do not build a complex matchmaking service.

Allow players to choose an available opponent and press Challenge.

Avoid empty matchmaking queues.

If no community agents exist, official agents remain available.

Do not display nonfunctional matchmaking features.

---

# 15. Core Combat Design

Build a bounded, deterministic, fictional game simulation.

The visual presentation may resemble a tactical shooter, but the underlying mechanics should remain simple abstract game rules.

Do not build a realistic firearms simulator.

All initial participants use:

- Identical health.
- Identical movement attributes.
- Identical fictional equipment.
- Identical resource rules.
- Identical utility availability.
- Identical maximum decision budgets.

## 15.1 Action vocabulary

Keep the initial action space small.

Suggested abstract actions:

    MOVE
    ATTACK
    RELOAD
    USE_UTILITY
    WAIT

Add additional actions only if they improve the game and can be validated without substantial architectural complexity.

Use a single fictional primary weapon archetype.

Do not introduce:

- Multiple weapon classes.
- Real-world weapon specifications.
- Realistic ballistics.
- Complex recoil systems.
- Skill trees.
- Real-world tactical training.
- Detailed realistic combat guidance.

## 15.2 Utility effects

Target two abstract game utilities initially:

1. Temporary visibility-obscuring effect, visually represented by stylized smoke.
2. Bounded area-effect ability, visually represented by a stylized game grenade effect.

Potential optional extensions:

- Temporary visual impairment status.
- Temporary hazardous game tile.

All effects must be deterministic, abstract, and bounded by fictional game rules.

Do not simulate real explosive construction, real chemical behavior, or realistic weapon usage.

## 15.3 Logical simulation

Use a small bounded logical map or graph.

Avoid continuous physics.

Separate:

- Logical state transitions.
- Visual character movement.
- Visual particles.
- Sound.
- Camera behavior.

The logical simulation is authoritative.

Phaser renders the events.

## 15.4 Match state

Maintain:

- Match ID.
- Rules version.
- Map version.
- Participants.
- Initial configuration.
- Simulation step.
- Participant positions.
- Health.
- Abstract ammunition or action resources.
- Utility availability.
- Temporary game status effects.
- Termination state.

Use integers for authoritative numerical calculations.

Avoid floating-point discrepancies between TypeScript and Solidity.

## 15.5 Resolution rules

Define explicit behavior for:

- Valid and invalid actions.
- Map boundaries.
- Blocked nodes.
- Simultaneous actions.
- Resource exhaustion.
- Conflicting movement.
- Effect expiration.
- Participant defeat.
- Simultaneous defeat.
- Maximum-step termination.
- Draws.

Avoid unspecified tie-breaking behavior.

Prefer simultaneous decisions from the same pre-step snapshot.

Neither agent should gain an advantage from seeing the other agent's uncommitted decision.

If simultaneous decisions are infeasible in a particular mode, document the exact resolution order and evaluate side bias.

## 15.6 Match duration

Use a bounded number of game decision windows.

Start with a small configurable maximum, such as six to ten windows.

Each window may contain deterministic visual events.

The exact number should be established through actual testing of:

- AI latency.
- Gameplay quality.
- Gas estimation.
- Match termination.
- Animation pacing.

Target approximately 20–60 seconds of animated playback.

Do not artificially prolong the match to make it appear more complex.

---

# 16. Deterministic Battle Protocol

The battle protocol is the authoritative game specification.

Define a versioned format for:

- Initial state.
- Agent observation.
- Legal actions.
- Action commitments.
- Validated action sequence.
- Ordered events.
- Final result.
- Replay metadata.

The same initial state and action sequence must always produce the same outcome under the same rules version.

Avoid relying on nondeterministic randomness in the MVP.

If randomness is introduced later, use a clearly defined, verifiable seed mechanism.

Do not introduce an external randomness oracle unless genuinely required.

## 16.1 Contract-first versus simulator-first

During the technical validation phase, compare two implementation strategies.

**Option A — Solidity-authoritative transition logic**

- Implement bounded game transitions in Solidity.
- Expose read-only simulation functions.
- Execute locally or through appropriate read-only EVM calls.
- Reuse transition logic during settlement.

Advantages:

- Reduces divergence between simulation and settlement.

Potential disadvantages:

- Integration complexity.
- RPC latency.
- EVM execution limitations.

**Option B — TypeScript simulator and Solidity verifier**

- Implement a small pure TypeScript simulator.
- Implement matching Solidity transition rules.
- Use shared test fixtures.
- Verify cross-language parity continuously.

Advantages:

- Easier application-side integration.

Potential disadvantages:

- Duplicated rules.
- Risk of implementation divergence.

Select the simplest proven approach.

Do not assume either approach is automatically superior.

Do not maintain divergent authoritative rule implementations without parity tests.

## 16.2 Complexity limits

Before expanding gameplay, benchmark:

- Maximum state size.
- Maximum action count.
- Worst-case execution.
- Gas estimation.
- Transaction size.
- Local simulation performance.

If verification is too expensive, simplify the fictional game rules, action count, map representation, or optional effects.

Do not silently replace independent rule verification with a contract that blindly accepts a claimed winner.

---

# 17. AI Agent System

AI must be a functional component of gameplay.

A personality selector connected only to hardcoded behavior is insufficient for the primary experience.

A real AI agent should implement:

1. Perception.
2. Goal interpretation.
3. Decision-making.
4. Validated execution.
5. Reflection.
6. Persistent memory.

## 17.1 Agent profile

Maintain a versioned profile containing:

- Internal agent ID.
- Owner or guest identifier.
- Display name.
- Cosmetic ID.
- Provider ID.
- Model ID.
- Personality.
- Coaching instructions.
- Instruction revision.
- Memory revision.
- Experience statistics.
- Created timestamp.
- Updated timestamp.
- Optional on-chain identity.

Do not expose API credentials through profiles.

Do not store private coaching or memory in public on-chain metadata.

## 17.2 Provider abstraction

Use a small provider interface conceptually equivalent to:

    AgentProvider
      healthCheck()
      getCapabilities()
      decide(observation, context, budget)
      reflect(matchSummary, previousMemory)

Implement:

**GeminiProvider**

Real Google Gemini inference.

**RuleBasedProvider**

Deterministic training and testing opponent.

**MockProvider**

Automated tests only.

**ExternalAgent interface**

Documented integration boundary for independently implemented agents.

Additional providers are optional.

Do not make OpenAI or Anthropic credentials mandatory.

Provider and model configuration should remain replaceable.

## 17.3 Real Gemini integration

Use Google AI Studio / Gemini Developer API through a supported server-side SDK.

The project owner has indicated that Gemini API access is available.

Do not treat the theoretical cost of model inference as the primary blocker.

However, verify:

- Actual supported models.
- Actual account/project access.
- Current quota.
- Structured output support.
- Request latency.
- Error handling.

Keep model identifiers configurable.

Do not hardcode unverified model names.

Do not automatically rotate accounts to evade service quotas or terms.

Do not expose API keys to users.

## 17.4 Agent observations

Provide a bounded structured representation of the permitted fictional game state.

Include only relevant information:

- Current state.
- Permitted action choices.
- Available game resources.
- Relevant visible game entities.
- Remaining decision budget.
- Recent game events.
- Human coaching instructions.
- Bounded memory.

Do not expose:

- Opponent private coaching.
- Opponent private memory.
- Uncommitted opponent decisions.
- Backend secrets.
- Arbitrary database access.
- Filesystem access.
- External execution tools.

Observation filtering is an application-level game constraint.

Do not claim cryptographically private gameplay if the settlement transcript or underlying state is publicly available.

## 17.5 Structured decisions

Use structured model outputs.

Prefer providing a bounded list of legal action IDs and allowing the model to select among them.

Conceptual response:

    {
      "actionId": "permitted-action-id",
      "summary": "Short player-facing explanation."
    }

The game engine determines the meaning and legality of the selected action.

The model must never determine:

- Damage values.
- Health values.
- Ownership.
- Resource creation.
- Match winners.
- Rewards.
- Contract permissions.

Validate every response using runtime schemas.

Never execute arbitrary generated code.

Treat model output as untrusted input.

Any displayed explanation is generated commentary, not a verified disclosure of the model's internal reasoning.

## 17.6 Decision frequency

Do not call AI on every animation frame.

Use bounded decision windows.

Recommended initial approach:

- Read the current observation.
- Request a decision from each eligible model.
- Validate both decisions.
- Resolve the next game state.
- Repeat until termination.

Request independent decisions in parallel where safe and supported.

Use an identical decision budget for comparable participants.

If latency is excessive, investigate:

- Fewer decision windows.
- Smaller observations.
- More efficient supported models.
- Bounded multi-step policy decisions.
- Hybrid decision execution.

A hybrid controller may perform deterministic intermediate actions, but its behavior must be documented.

Do not secretly substitute hardcoded strategy for real AI decision-making.

## 17.7 AI failure handling

Implement:

- Request timeout.
- Bounded retry.
- Schema validation.
- Overall match budget.
- Maximum input length.
- Maximum output length.
- Meaningful error state.

For practice:

A clearly labeled deterministic fallback is acceptable.

For verified AI competition:

Do not silently replace a requested AI model with a different model or a deterministic bot.

Mark an affected match as:

- Interrupted.
- Aborted.
- Unverified.
- Recoverable.

Preserve recoverable progress.

Do not display fake AI responses.

---

# 18. Human Coaching

Human coaching is a central feature.

The experience should resemble a familiar messaging interaction.

Users should be able to write natural-language instructions without learning prompt engineering.

Example:

"Play more carefully this time and learn from your previous match."

Provide optional short coaching suggestions:

- Be aggressive.
- Stay careful.
- Manage resources.
- Adapt to the situation.
- Learn from the last match.
- Try something different.

Suggestions are instruction shortcuts, not numerical bonuses or hidden behavior modes.

## 18.1 Personality presets

Provide optional presets such as:

- Assertive.
- Cautious.
- Resource-conscious.
- Adaptive.

These are input preferences for the AI.

They must not modify base statistics.

Users may provide their own custom instructions.

## 18.2 Coaching revisions

Save coaching changes as versioned records.

When a match starts, lock the relevant instruction revision.

Do not permit a user to secretly alter instructions during a verified competition.

Show a short acknowledgment when instructions are saved successfully.

Do not falsely claim that an AI response occurred if the model was not called.

A simple application acknowledgment is acceptable when accurately labeled.

## 18.3 Product requirement

Demonstrate that two agents using:

- The same model.
- The same map.
- The same equipment.
- Different coaching instructions.

Can produce observably different valid decision patterns.

Do not promise that a particular coaching style always wins.

---

# 19. Persistent Memory and Progression

Use lightweight structured persistent memory.

Do not build a vector database for the initial MVP.

## 19.1 Memory contents

Maintain:

- Recent match summaries.
- Wins, losses, and draws.
- Reusable lessons.
- Relevant decision patterns.
- Coaching revisions.
- Reflection timestamps.
- Memory revisions.

Limit memory size.

Prefer a small number of useful lessons over a large unfiltered transcript.

## 19.2 Post-match reflection

After a valid completed match:

1. Provide the model with a validated match summary.
2. Include previous relevant memory.
3. Request a bounded set of short lessons.
4. Validate the output.
5. Save the next memory revision.
6. Include relevant lessons in future decisions.

Do not let reflection modify game rules or numerical base attributes.

Do not claim that persistent prompting is actual model fine-tuning.

Do not claim automatic intelligence improvement.

The system should demonstrate adaptation and continuity.

## 19.3 Reflection failure

Reflection failure must not invalidate an otherwise valid completed battle.

Preserve the result.

Allow a bounded retry.

Display that a lesson is pending or unavailable.

Do not fabricate a lesson to fill the UI.

## 19.4 Progression

Use:

- Experience count.
- Completed training stages.
- Match history.
- Lessons learned.
- Verified competition record.

Do not increase health or damage through experience.

Progression should reflect the development of the agent's decision-making context.

## 19.5 Memory ownership

Ensure:

- Every memory belongs to the correct agent.
- Different agents cannot read each other's private memory.
- Refreshing the browser preserves expected progress.
- Guest ownership and wallet ownership are explicitly handled.
- Memory updates are idempotent.
- Retried operations do not duplicate lessons or experience.

Provide a simple way to inspect or reset memory.

---

# 20. Model versus Model Competition

Design the architecture to support different AI providers without requiring all providers for the MVP.

Support configurable model identifiers.

If two suitable Gemini models are accessible, attempt a real model-versus-model exhibition after the primary loop is complete.

Do not fake a second provider.

Do not label two configurations of the same model as different underlying models.

## 20.1 Open Arena

Agents may differ in:

- Model.
- Personality.
- Coaching.
- Memory.

The environment, base equipment, and rules remain consistent.

## 20.2 Standardized Arena

Future controlled comparison mode:

- Same rules version.
- Same map.
- Same equipment.
- Equivalent initial conditions.
- Same observation permissions.
- Same decision budget.
- Controlled coaching.
- Controlled memory.
- Recorded model identifiers.
- Side-swapped rematches.

The MVP does not require a separate standardized competition interface.

The data model should allow these comparisons.

One match does not establish the universal superiority of one AI model.

Avoid statistically unsupported conclusions.

---

# 21. BNB Smart Chain Integration

Blockchain must provide meaningful functionality.

Do not use BNB Chain only to store an arbitrary winner or decorative NFT.

Use three core capabilities.

## 21.1 Capability A — Agent Identity

Establish an on-chain association between an agent identifier and an authorized owner.

Investigate ERC-8004 through current official BNB Chain documentation.

If integration succeeds:

- Register a real agent.
- Confirm its identity.
- Read ownership from the registry.
- Display the actual identity reference.
- Provide an explorer link.

If ERC-8004 is blocked:

Implement a minimal Arena-specific identity registry.

Clearly identify this as an application-specific registry.

Do not describe the fallback as ERC-8004 compliant.

Keep the identity integration replaceable.

ERC-8004 integration is preferred, but a specific verified registry blocker must not halt all development.

## 21.2 Capability B — Battle Verification

The contract must independently determine the competition result from:

- Locked match configuration.
- Authorized participants.
- Rules version.
- Map version.
- Bounded submitted action sequence.

Do not allow the settlement submitter to freely choose the winner.

The contract must reject invalid sequences according to its implemented rules.

The contract should compute the final outcome using deterministic transitions.

Benchmark actual gas requirements.

Simplify gameplay if necessary to make verification practical.

## 21.3 Capability C — Open Competition Protocol

Publish the minimum information required for another developer to understand and interact with the competition system:

- Contract ABI.
- Deployment address.
- Agent identity format.
- Registration requirements.
- Match configuration.
- Observation format.
- Action format.
- Replay format.
- Rules version.
- Settlement requirements.
- Authorization requirements.

The preferred additional demonstration is a minimal independent script that participates without relying on the main game UI.

Do not build a large SDK before the core product works.

## 21.4 Trust model

Be explicit about what blockchain verification proves.

It may prove:

- Agent ownership association.
- Match configuration consistency.
- Compliance with implemented game rules.
- Contract-computed outcome.
- Finalization uniqueness.
- Public competition records.

It does not automatically prove:

- That a specific LLM genuinely generated an action.
- That the operator did not influence decisions.
- That private model instructions were followed.
- That an off-chain AI provider behaved honestly.
- That the entire competition is decentralized.

Do not market the MVP as fully trustless AI execution.

Where the application operates both competitors' inference and signing infrastructure, disclose the operator trust assumption.

---

# 22. Smart Contract Design

Use a minimal coherent contract set.

Avoid unnecessary upgradeable proxy architecture for the hackathon.

Version future rule changes through explicit protocol versions or new deployments.

Suggested conceptual contract functions:

    registerAgent
    bindExternalIdentity
    createMatch
    authorizeMatch
    simulateBattle
    settleMatch
    getAgent
    getMatch

Adapt the names to the actual implementation.

## 22.1 Match configuration

Before verified competition, bind:

- Unique match ID.
- Participant IDs.
- Authorized owners or submitters.
- Map version.
- Rules version.
- Initial state configuration.
- Relevant coaching revision commitment.
- Relevant memory revision commitment.
- Expiry or cancellation rules where needed.

Do not publish raw private coaching or memory on-chain.

Use commitments appropriately.

If hashing private low-entropy data, account for dictionary-guessing risks; avoid publishing unnecessary commitments or use appropriate randomized commitments.

Use canonical encoding.

The settlement function must not allow a submitter to silently replace participants, rules, equipment, map, or initial state.

## 22.2 Authorization

For the primary official-agent flow, use a simple explicit authorization design that can be realistically implemented and tested.

The user must control their agent's ownership or competition authorization.

The platform may operate official opponents.

Use a documented authorized submission mechanism.

If EIP-712 signatures are used, bind them to:

- Chain.
- Verifying contract.
- Match ID.
- Participant.
- Nonce.
- Configuration or transcript commitment.
- Expiry.

Implement replay protection explicitly.

EIP-712 alone does not provide complete replay prevention.

Independent agent signers and advanced decentralized authorization are valuable extensions, not a reason to delay the initial complete match.

## 22.3 Integrity requirements

Implement:

- Authorization checks.
- Valid agent references.
- Bounded input size.
- Locked match configuration.
- Legal action validation.
- Deterministic outcome computation.
- Duplicate settlement prevention.
- Terminal-state enforcement.
- Appropriate cancellation or expiry.
- Event emission.

Do not allow an already finalized match to be finalized again.

Do not count the same result twice.

Use safe integer bounds.

Avoid unnecessary external calls during settlement.

## 22.4 Settlement lifecycle

Separate:

- Match creation.
- Configuration authorization.
- Simulation.
- Settlement submission.
- Transaction confirmation.
- Finalized outcome.

Read the confirmed transaction receipt and contract state before displaying Verified.

A submitted transaction hash is not proof of confirmed settlement.

If settlement fails, preserve the simulated result and clearly label it unverified.

## 22.5 Network safety

Use BSC Testnet.

Verify the actual chain ID.

Use Testnet funds only.

Do not deploy to Mainnet.

Do not transfer real funds without explicit authorization.

Investigate faucet and sponsored registration options.

Do not assume that sponsored registration covers all game transactions.

Never request a player's seed phrase.

---

# 23. Agent Passport

Provide an accessible public identity view.

Display:

- Agent name.
- Agent appearance.
- Agent ID.
- Owner address.
- Model/provider metadata.
- Identity registry type.
- Verified match count.
- Wins.
- Losses.
- Draws.
- Recent verified matches.
- Relevant transaction links.

Separate:

**Verified information**

Information read from confirmed blockchain state.

**Application metadata**

Model labels, cosmetic information, off-chain experience, and other application-maintained information.

Do not imply that off-chain metadata is cryptographically verified merely because it appears beside an on-chain identity.

The passport should be simple by default.

Hide contract addresses, technical identifiers, and raw records behind expandable details.

---

# 24. Match Processing and Replay

Precompute the match before animated playback.

This is an approved design decision.

The application must clearly communicate that the battle is being prepared and subsequently replayed.

Do not represent precomputed playback as live AI inference.

## 24.1 Processing flow

    Create Match
        ↓
    Lock Agent Configuration
        ↓
    Request AI Decisions
        ↓
    Validate and Resolve
        ↓
    Repeat Until Terminal State
        ↓
    Persist Result and Replay
        ↓
    Animated Playback
        ↓
    Result Screen
        ├── Reflection
        └── Eligible Blockchain Verification

Do not make the user wait for reflection or blockchain confirmation before viewing an already completed simulation.

## 24.2 Processing states

Suggested states:

    CREATED
    PREPARING
    SIMULATING
    SIMULATED
    PLAYING_REPLAY
    PENDING_SETTLEMENT
    FINALIZED
    FAILED
    ABORTED

Maintain separate reflection status.

Do not conflate simulation completion with blockchain finalization.

## 24.3 Replay format

Store an immutable representation of the completed simulation:

- Initial state.
- Participants.
- Map and rules versions.
- Validated action sequence.
- Authoritative event log.
- Final state or result.
- Canonical transcript hash where appropriate.

Make replay data retrievable for completed matches.

If on-chain settlement only references a hash, disclose that off-chain replay availability still depends on storage.

Prefer including enough bounded action data in transaction calldata or another inspectable format to independently reproduce verified outcomes.

## 24.4 Animated playback

The renderer consumes authoritative events.

It must not independently decide:

- Hit outcomes.
- Health changes.
- Resource changes.
- Victory.
- Defeat.

Use visual interpolation, particles, sound effects, and character animation to present recorded game events.

Decorative effects must not imply contradictory gameplay events.

Provide:

- Play.
- Pause.
- Skip.
- Playback speed if feasible.

Browser frame rate must not affect the outcome.

## 24.5 Recovery

A completed match should survive browser refresh.

Persist completed results before showing the final result screen.

For interrupted processing, use bounded checkpoint recovery where feasible.

Do not introduce complex background infrastructure unnecessarily.

Start with short bounded server requests or a simple resumable processing design.

If interrupted match recovery is incomplete, clearly identify the limitation.

---

# 25. Backend and Persistence

Use Supabase or another verified minimal persistence solution.

Avoid building an unnecessarily complex data platform.

Suggested logical entities:

- Profiles.
- Agents.
- Coaching revisions.
- Memory revisions.
- Stage progress.
- Matches.
- Participants.
- Decision records.
- Replay records.
- Settlement records.

Implement only the entities needed for working functionality.

Combine tables where doing so remains clear and secure.

## 25.1 Guest-first identity

Guest users should be able to start practice immediately.

Use an appropriate anonymous session or clearly scoped local practice save.

Do not treat a user-supplied agent ID as proof of ownership.

If using anonymous authenticated sessions, verify current provider behavior.

Define a clear guest-to-wallet linking flow.

Do not allow another wallet to claim an existing guest agent without appropriate session and wallet authorization.

If complete linking is not feasible, retain guest practice separately and create a clearly distinguished verified agent identity.

Do not falsely imply automatic cross-device migration.

## 25.2 Server-owned responsibilities

Server-side code should control:

- AI requests.
- Credential access.
- Match orchestration.
- Authorized persistence.
- Usage limits.
- Validation.
- Eligible settlement operations.

The client should not be trusted to declare:

- Verified wins.
- Arbitrary experience.
- Another user's ownership.
- Valid AI provenance.
- Confirmed blockchain status.

## 25.3 Idempotency

Prevent accidental duplicate operations.

Use unique match identifiers.

Ensure retries cannot create:

- Duplicate match records.
- Duplicate memory updates.
- Duplicate experience.
- Duplicate settlement.
- Multiple conflicting final results.

Do not overbuild distributed systems.

Use appropriate database uniqueness constraints and simple transaction boundaries.

---

# 26. Security and Abuse Prevention

Implement baseline security from the beginning.

Requirements:

- Gemini API keys remain server-side.
- Supabase service credentials remain server-side.
- Dedicated signing credentials remain protected.
- Never commit secrets to Git.
- Include `.env.example` without actual secrets.
- Validate all public API inputs.
- Authenticate sensitive operations.
- Verify wallet ownership where required.
- Apply appropriate row-level security.
- Prevent unauthorized cross-user reads and writes.
- Limit coaching input size.
- Limit AI response size.
- Limit decision budgets.
- Limit concurrent match processing.
- Apply basic demo usage limits.
- Protect expensive public API endpoints.
- Escape or safely render untrusted text.

Treat all user input and AI-generated output as untrusted.

A user may attempt to instruct an AI agent to ignore game rules.

This must not allow the agent to bypass deterministic validation.

Do not give AI direct access to:

- Private keys.
- Arbitrary transaction signing.
- Shell commands.
- SQL execution.
- Source code execution.
- File modification.
- Unrestricted external tools.

Do not use sensitive credentials in logs or screenshots.

Do not publish private coaching instructions or memory without clear user control.

---

# 27. Navigation and Information Architecture

Limit primary navigation to exactly three main destinations:

1. Play
2. My Agent
3. Arena

Do not expose every implemented subsystem as a navigation item.

## 27.1 Play

Purpose:

Start or continue gameplay.

Display:

- Prominent Play or Continue action.
- Current training stage.
- Small stage thumbnails.
- Clear completion or lock states.

## 27.2 My Agent

Purpose:

Develop and personalize the character.

Display:

- Large character preview.
- Agent name.
- Cosmetic selection.
- Coaching interaction.
- Concise experience information.
- Relevant lessons.

Move detailed records into secondary views.

## 27.3 Arena

Purpose:

Select an opponent and compete.

Display:

- Opponent portrait.
- Agent name.
- Model or bot label.
- Optional concise record.
- Challenge button.

## 27.4 Secondary navigation

Place these inside contextual menus or profile settings:

- Wallet.
- Agent Passport.
- Advanced model settings.
- Detailed memory.
- Match history.
- Transaction history.
- Account settings.
- Technical details.

On mobile, prefer accessible bottom navigation.

On desktop, use compact consistent navigation.

Avoid multiple redundant home screens.

---

# 28. Required UX Screens

Screens may be combined when doing so improves usability.

Do not create separate routes merely because a feature exists.

## 28.1 Home / Play

Primary action: Play or Continue.

Recommended composition:

- Compact game identity.
- Large character or arena artwork.
- One dominant primary button.
- Current stage.
- Small progression indicator.

No large feature explanation.

No blockchain promotional dashboard.

## 28.2 Agent Creation

Allow:

- Accepting a default character.
- Selecting a cosmetic.
- Optional name.
- Optional personality preference.

Do not require advanced settings.

The player should be able to skip customization and begin playing.

## 28.3 My Agent

The character is the visual center.

Use a familiar coaching input.

Show concise relevant information:

- Name.
- Model label.
- Experience.
- Recent outcome.
- Memory.

Keep numerical statistics restrained.

Do not surround the character with excessive charts and cards.

## 28.4 Coaching

Make coaching resemble a chat interaction.

Provide:

- Text field.
- Optional quick suggestions.
- Clear send/save action.
- Short acknowledgment.
- Recent instruction context.

Do not turn this screen into an API configuration form.

The user must understand that coaching affects future matches.

## 28.5 Arena

Use a visual opponent roster.

Official opponents should be immediately selectable.

Clearly distinguish:

- Training Bot.
- Official AI Agent.
- Community Agent, if implemented.

Do not show fictional users or invented player counts as real data.

## 28.6 Battle Preparation

Display a short useful status while processing.

Examples:

- Getting your agent ready...
- Preparing the battle...
- Your battle is ready.

Do not display fake progress percentages.

Do not freeze the interface.

Provide cancellation or retry where appropriate.

## 28.7 Battle Screen

The battlefield should dominate the screen.

Minimum HUD:

- Participant names.
- Health indicators.
- Match progress.
- Essential game status.
- Playback controls.

Use clear Blue Team and Sand Team identification.

Provide an optional expandable decision feed.

Do not display raw JSON.

Do not cover the arena with large textual panels.

## 28.8 Result Screen

Make the outcome immediately understandable.

Display:

1. Victory, Defeat, or Draw.
2. Character presentation.
3. One or two relevant observations.
4. A concise lesson when available.
5. Rematch.
6. Coach Agent.

Show verification state compactly.

Additional statistics and technical details should be expandable.

Do not overload the result screen with a full analytical report.

## 28.9 Agent Passport

Display public identity and verified competition history.

Keep technical details progressively disclosed.

---

# 29. Consumer-Facing Language

Use concise human-friendly wording.

Preferred labels:

| Technical concept | Player-facing language |
|---|---|
| Agent initialization | Create Agent |
| LLM configuration | AI Model |
| Instruction submission | Coach |
| Persistent context | Memory |
| Simulation execution | Play |
| Simulation completion | Battle Ready |
| Match verification | Verify Match |
| Identity registration | Agent Passport |
| Transaction confirmation | Confirming |
| Replay execution | Watch Battle |
| Match repetition | Rematch |

Do not expose implementation jargon by default.

Technical concepts such as ERC-8004, EIP-712, RPC, nonce, structured outputs, and deterministic state transitions belong in advanced details or documentation.

Use short contextual hints when necessary.

Prefer visual communication over paragraphs.

Do not remove important error, permission, or transaction information merely to reduce wording.

---

# 30. Visual UI System

Use a hybrid visual language:

- Pixel Art 2.5D for characters and environments.
- Modern minimalist UI for menus and controls.

Use:

- Large character artwork.
- Strong typography.
- Consistent spacing.
- Clear primary buttons.
- Restrained accent colors.
- Compact HUD.
- Predictable component behavior.
- Subtle meaningful transitions.

Avoid:

- Too many small cards.
- Too many simultaneous call-to-action buttons.
- Generic admin dashboards.
- Excessive technical wording.
- Excessive blockchain branding.
- Dense charts on default screens.
- Unnecessary modal dialogs.

Every main screen must have one dominant purpose.

Use secondary actions only where contextually appropriate.

---

# 31. Responsive Design and Accessibility

Support desktop and mobile browsers.

Desktop is the primary hackathon development target.

Mobile should remain usable, not merely visually scaled down.

Use accessible HTML/DOM interfaces for:

- Navigation.
- Coaching.
- Menus.
- Settings.
- Important buttons.
- Wallet interactions.

Use Phaser primarily for game rendering.

Requirements:

- No unintended horizontal scrolling.
- No clipped essential controls.
- Readable typography.
- Sufficient contrast.
- Touch-friendly targets.
- Prefer approximately 44 CSS pixel interactive targets.
- Keyboard-accessible primary navigation.
- Visible focus states.
- Accessible labels for icon-only controls.
- Feedback not dependent on color alone.
- Appropriate responsive arena scaling.
- Reduced-motion support where practical.
- No unnecessary rapid flashing.

Test actual browser viewports.

Do not declare mobile readiness based on responsive CSS alone.

---

# 32. Blockchain UX

Blockchain should not interrupt the first gameplay experience.

Recommended flow:

1. Guest training.
2. Discover Arena.
3. Choose verified competition.
4. Connect wallet when necessary.
5. Create or bind Agent Passport.
6. Authorize competition.
7. Confirm eligible settlement.

Keep the practice experience available if the wallet is unavailable.

Use simple language.

Example:

"Create your Agent Passport to enter verified competitions."

Clearly communicate:

- Required permissions.
- Required transaction.
- Relevant costs.
- Wrong network.
- Rejected transaction.
- Pending confirmation.
- Failed transaction.
- Confirmed verification.

Only show Verified after actual confirmation.

Never display fake verification badges.

Do not require users to manually manage technical contract details.

---

# 33. Loading, Errors and Empty States

Every asynchronous operation must have appropriate feedback.

Examples:

- Preparing your agent...
- Getting the battle ready...
- Saving your lesson...
- Confirming your match...

Provide clear alternatives when something fails.

For example:

"Your agent couldn't complete the match. Try again."

Preserve recoverable information.

Prevent duplicate submissions while processing.

Do not expose stack traces in default UI.

Log technical diagnostics separately.

Do not falsely show success.

If AI inference, reflection, persistence, or blockchain settlement fails, distinguish the affected subsystem.

An unavailable lesson should not invalidate a valid match.

An unconfirmed transaction should not appear verified.

A failed verified competition should not silently become a successful verified result.

---

# 34. Feature Priorities

Use the following scope hierarchy.

## P0-A — Non-negotiable vertical slice

Build this first.

- Functional web application.
- Guest access.
- One fictional isometric arena.
- One universal character base.
- Two distinguishable cosmetic sides.
- Identical equipment.
- Complete bounded 1v1 simulation.
- Real Gemini decisions.
- Human coaching.
- At least one immediately available opponent.
- Animated playback.
- Result screen.
- Rematch.
- Deterministic rules.
- Local contract verification tests.

This is the minimum internal vertical slice.

It is not yet the complete hackathon submission.

## P0-B — Required hackathon submission

Complete after the first vertical slice.

- Cohesive final Pixel Art 2.5D visual presentation.
- Persistent memory.
- Memory reused in future AI decisions.
- Training Campaign.
- Arena with official real AI opponents.
- Target three training configurations.
- Target four cosmetic appearances.
- Agent ownership or identity on BSC Testnet.
- Actual Testnet contract deployment.
- Contract-computed match outcome.
- At least one real confirmed Testnet settlement.
- Public Agent Passport.
- Published competition protocol.
- Consumer-friendly UX.
- Public deployment.
- Actual testing evidence.
- Submission documentation.

If any P0 requirement remains incomplete, identify it explicitly.

Do not call an incomplete P0 feature complete.

## P1 — High-value differentiators

Implement only after P0 is stable.

Priority order:

1. ERC-8004 integration, if not completed earlier.
2. Minimal independent external agent example.
3. Second accessible real AI model.
4. Community asynchronous challenge.
5. Side-swapped controlled comparison.
6. Additional utility effects.
7. Additional cosmetic variations.
8. Improved audio and visual effects.
9. Additional map configuration.
10. Public verified leaderboard.

The first two P1 items have particularly high value for blockchain interoperability.

Attempt an early ERC-8004 proof-of-concept, but do not let integration uncertainty block the complete gameplay loop.

## P2 — Post-hackathon

Do not implement as submission dependencies:

- 2v2, 3v3, or 5v5.
- Full bomb planting or defusal.
- Multiple playable elevations.
- Complex equipment economy.
- Weapon marketplaces.
- Character NFTs beyond required identity functionality.
- Custom tokens.
- Real-money wagering.
- Tournaments.
- Guilds.
- Complex matchmaking.
- Large-scale AI benchmarking.
- Full external SDK ecosystem.
- Advanced cryptographic inference verification.
- Fully decentralized AI execution.

---

# 35. Implementation Strategy

Use a vertical-slice development approach.

Do not spend the first half of the hackathon building disconnected infrastructure.

The first working version may use temporary graphics and deterministic test bots.

It must then integrate real Gemini and real blockchain verification.

At every milestone, run relevant tests.

Do not wait until the final hours to integrate external dependencies.

## 35.1 Early prototype

The initial prototype should prove:

- Two characters can participate.
- The game state changes correctly.
- Legal actions are enforced.
- A match terminates.
- A result can be replayed.
- Real AI can select an allowed action.
- A minimal contract can verify a bounded sequence.

Do not prioritize polished menus before these core mechanics work.

## 35.2 Product expansion

Once the core simulation works:

- Add real character and environment art.
- Add guest onboarding.
- Add coaching.
- Add persistent memory.
- Add official opponents.
- Add campaign configurations.
- Add agent identity.
- Add verification UX.

## 35.3 Feature freeze

Stop adding optional functionality before final QA.

Protect:

- Complete gameplay.
- Real AI.
- Meaningful blockchain.
- Visual coherence.
- Usability.
- Submission readiness.

---

# 36. 24-Hour Development Schedule

Treat this schedule as a strict time-budgeting plan, not a guaranteed implementation estimate.

Adjust the allocation based on verified progress.

## Hours 00–02 — Technical proof-of-concept

- Inspect environment.
- Verify Gemini.
- Verify BSC Testnet.
- Verify wallet funding.
- Compile local contract.
- Test minimal Phaser scene.
- Investigate ERC-8004.
- Verify initial asset strategy.
- Verify hackathon requirements.

Exit criteria:

- Real Gemini decision succeeds or exact credential blocker is documented.
- Local Solidity execution succeeds.
- Testnet connectivity is verified.
- Game rendering is feasible.

## Hours 02–05 — Playable core simulation

- Implement bounded map.
- Implement state.
- Implement action validation.
- Implement transitions.
- Implement termination.
- Implement event log.
- Implement test opponents.
- Render a basic replay with temporary art.
- Run core tests.

Exit criteria:

A complete fictional match can finish and be watched.

## Hours 05–08 — AI and blockchain vertical slice

- Integrate real Gemini.
- Integrate human coaching.
- Implement official agent profiles.
- Implement deterministic verification.
- Run parity tests if applicable.
- Benchmark gas.
- Deploy the game contract to Testnet when available.
- Attempt a real settlement.

Exit criteria:

A real Gemini-driven match can produce an independently checked result.

## Hours 08–12 — Visual identity and game presentation

- Build Dust Yard.
- Implement reusable desert environment assets.
- Implement Blue and Sand character styles.
- Implement required animation states.
- Add depth sorting.
- Connect replay events.
- Add compact HUD.
- Add essential audio and effects.
- Inspect actual rendered output.

Exit criteria:

The game visibly resembles the approved Pixel Art 2.5D competitive shooter direction.

## Hours 12–16 — Complete product experience

- Implement Play.
- Implement My Agent.
- Implement Arena.
- Implement guest onboarding.
- Implement coaching UI.
- Implement persistent memory.
- Implement stage progression.
- Implement official opponent selection.
- Implement result screen.
- Implement Agent Passport.

Exit criteria:

A new user can complete a full gameplay loop without developer guidance.

## Hours 16–19 — Integration and expansion

- Complete remaining training configurations.
- Complete cosmetic variations.
- Validate wallet flow.
- Confirm real Testnet settlement.
- Attempt ERC-8004 integration if pending.
- Attempt external agent example.
- Attempt second accessible model.
- Improve highest-impact usability and visual issues.

Exit criteria:

P0 is complete or remaining blockers are explicitly documented.

## Hours 19–22 — Feature freeze and QA

- Run automated tests.
- Run real AI integration tests.
- Run real Testnet checks.
- Run browser tests.
- Test persistence.
- Test wallet rejection.
- Test unauthorized access.
- Test replay consistency.
- Test desktop and mobile.
- Fix release-blocking defects.

Do not introduce unrelated features.

## Hours 22–24 — Submission

- Deploy the final application.
- Verify public access.
- Run public deployment smoke tests.
- Prepare README.
- Prepare architecture diagram.
- Record actual demo evidence.
- Collect real transaction references.
- Prepare short pitch.
- Complete submission materials.

Do not risk the submission deadline to add another feature.

If the project owner must personally authorize or submit something, clearly identify the remaining required action.

---

# 37. Blocker Management

Classify issues into:

1. Critical blocker.
2. Degradable feature.
3. Optional feature.
4. Cosmetic issue.

Do not treat every issue as equally important.

## 37.1 Gemini API unavailable

Continue with deterministic development fixtures.

Clearly label test modes.

Request only required credentials or access.

Real AI remains mandatory for the final AI MVP.

Do not deliver a bot-only game while claiming real AI integration.

## 37.2 API latency excessive

Investigate:

- Smaller observations.
- Fewer decision windows.
- Parallel independent requests.
- Supported efficient models.
- Bounded policy generation.
- Shorter matches.

Do not eliminate meaningful AI decision-making.

## 37.3 ERC-8004 unavailable

Use the documented application-specific registry fallback.

Preserve a replaceable identity adapter.

Do not misrepresent standards compliance.

## 37.4 Testnet funding unavailable

Continue with local EVM execution and contract tests.

Record the exact funding blocker.

Request the minimum required user action.

Do not invent Testnet deployment or transaction evidence.

## 37.5 Verification gas excessive

Reduce:

- Logical map complexity.
- Action parameter size.
- Maximum decision windows.
- Optional game effects.
- State representation complexity.

Preserve independent result computation.

## 37.6 Asset pack unavailable

Create original cohesive pixel assets.

Use procedural artwork and simple reusable animations.

Do not let asset sourcing halt game development.

## 37.7 Hosting limitations

Use the simplest compatible deployment design.

Avoid one unnecessarily long serverless request.

Reduce request complexity or introduce bounded resumable processing.

Do not require an elaborate distributed worker system.

## 37.8 Poor gameplay balance

Reduce the action vocabulary.

Adjust fictional game parameters.

Run reproducible bot simulations.

Inspect actual replays.

Do not add more weapons or skills merely to compensate for poor core gameplay.

## 37.9 Time shortage

Cut in this order:

1. Extra visual effects.
2. Additional cosmetic variations.
3. Optional audio.
4. Extra utility effects.
5. Additional model providers.
6. Additional arena layouts.
7. Community matchmaking.
8. Advanced external client tooling.
9. Advanced ERC-8004 integration.
10. Additional campaign configurations.

Do not sacrifice the core AI gameplay loop.

Do not misrepresent blockchain verification.

Do not replace the approved game concept with a generic dashboard.

---

# 38. Automated Testing

Use appropriate automated tests.

Do not use test counts as the only measure of quality.

## 38.1 Combat unit tests

Test:

- Valid actions.
- Invalid actions.
- State transitions.
- Map boundaries.
- Blocking rules.
- Movement conflicts.
- Resource exhaustion.
- Temporary effects.
- Simultaneous resolution.
- Victory.
- Defeat.
- Draws.
- Maximum-step termination.
- Terminal-state behavior.
- Replay serialization.
- Deterministic reproduction.

## 38.2 AI provider tests

Test:

- Valid structured response.
- Runtime validation.
- Invalid action rejection.
- Timeout.
- Retry limit.
- Rate limit response.
- Provider error.
- Coaching context inclusion.
- Memory context inclusion.
- Correct fallback labeling.
- Model identity recording.

Mocked tests must be labeled as mocked.

Perform at least one actual Gemini integration test and actual complete AI match when credentials permit.

## 38.3 Blockchain tests

Test:

- Agent registration.
- Ownership checks.
- Participant authorization.
- Match configuration locking.
- Valid settlement.
- Invalid sequence rejection.
- Unauthorized settlement rejection.
- Duplicate finalization rejection.
- Invalid map version.
- Invalid rules version.
- Terminal-state enforcement.
- Replay protection.
- Signature validation when implemented.
- Bounded execution.
- Worst-case gas estimation.

## 38.4 Parity tests

When using both TypeScript and Solidity combat implementations:

- Use shared fixtures.
- Compare initial states.
- Compare valid action sequences.
- Compare final state.
- Compare winner or draw.
- Compare canonical hashes where appropriate.
- Test edge cases.
- Test randomized bounded legal inputs.

Any verified mismatch is release-blocking for verified competition.

Do not allow visual results to contradict contract-computed outcomes.

## 38.5 Persistence tests

Test:

- Agent ownership.
- Guest session isolation.
- Cross-user access denial.
- Coaching revisions.
- Memory persistence.
- Memory reuse.
- Stage unlocking.
- Idempotent result updates.
- Duplicate experience prevention.
- Interrupted match handling.
- Refresh after completion.

---

# 39. Real Gameplay and AI Evaluation

Evaluate actual agent behavior, not merely whether an AI API responds.

Run a small controlled test suite appropriate for the hackathon.

Recommended comparisons:

1. Same model with different human coaching.
2. Same coaching with different memory revisions.
3. Memory enabled versus disabled.
4. Side-swapped match conditions.
5. Different accessible real models if available.

Record:

- Model identifier.
- Instruction revision.
- Memory revision.
- Map version.
- Rules version.
- Decision count.
- Decision distribution.
- Invalid action count.
- Fallback count.
- Outcome.
- Processing time.
- Replay consistency.
- Settlement status.

Demonstrate that real AI choices influence the match.

Demonstrate that saved memory is supplied to later model requests.

Do not claim that every lesson improves performance.

Do not claim broad statistical conclusions from a small sample.

The game should exhibit observable agent variation without relying on hidden stat bonuses.

---

# 40. Browser and UX Testing

Test the real application in a clean browser session.

Use browser automation where available.

## 40.1 Required flows

Test:

- Open public application.
- Start guest training.
- Accept default agent.
- Customize appearance.
- Save coaching.
- Start a match.
- Observe processing feedback.
- Watch replay.
- View result.
- Rematch.
- Return to My Agent.
- Refresh and inspect persistence.
- Select official opponent.
- Connect wallet.
- Handle wrong network.
- Authorize eligible competition.
- Handle rejected transaction.
- Confirm settlement.
- Open actual explorer link.
- Inspect Agent Passport.

## 40.2 Usability targets

Measure or inspect:

- Number of interactions before first match.
- Time to locate Play.
- Ability to understand coaching.
- Ability to distinguish opponent types.
- Ability to understand victory or defeat.
- Ability to find Rematch.
- Ability to distinguish verified and unverified results.

If a real unfamiliar tester is available, ask them to start a match without explaining the interface.

Record hesitation, confusion, and mistakes.

If no independent tester is available, perform a structured first-time-user walkthrough and clearly identify that limitation.

## 40.3 Responsive testing

Inspect representative desktop and mobile viewports.

Suggested:

- Desktop 1440 × 900.
- Desktop 1280 × 720.
- Mobile approximately 390 × 844.

These are test viewports, not the only supported devices.

Check:

- Navigation.
- Text readability.
- Touch targets.
- Arena scaling.
- Scroll behavior.
- Clipping.
- Modal positioning.
- Coaching input.
- Result screen.
- Wallet interactions.

---

# 41. Visual Quality Assurance

Inspect actual rendered browser screenshots or live browser output.

Check:

- Isometric projection.
- Consistent pixel scale.
- Correct sprite anchors.
- Depth sorting.
- Environmental coherence.
- Character readability.
- Team recognition.
- Shadow placement.
- Animation timing.
- HUD alignment.
- Text readability.
- Responsive layout.
- Visual effects corresponding to actual events.

The final scene should visibly resemble an original desert-themed competitive game.

It should not look like:

- Random geometric placeholders.
- A generic AI dashboard.
- An unfinished game-engine tutorial.
- An unrelated fantasy game.
- A direct Counter-Strike asset rip.

Temporary assets are acceptable during development.

A placeholder-only final presentation must be reported as an incomplete visual limitation.

Do not approve visuals merely because the build succeeds.

---

# 42. Release Acceptance Criteria

A release is ready only when the following criteria are checked against actual evidence.

## 42.1 Gameplay

- A new user can start playing.
- Guest access works.
- A default agent is available.
- Coaching is functional.
- At least one immediate opponent exists.
- A complete 1v1 match terminates.
- Base attributes are identical.
- Actions follow deterministic rules.
- Animated playback represents actual events.
- The result is understandable.
- Rematch works.
- Campaign progression works for implemented stages.
- Arena supports a real AI competition.

## 42.2 AI

- Real Gemini integration is functional.
- The model receives permitted structured observations.
- The model selects valid game actions.
- Invalid output cannot bypass the rules.
- Coaching is included in AI requests.
- Agent memory persists.
- Relevant memory is reused in later requests.
- Fallback behavior is accurately identified.
- Model metadata is recorded.
- At least one controlled comparison demonstrates actual AI behavior differences, or the absence of a measurable difference is honestly reported.

## 42.3 Blockchain

- Actual BSC Testnet connectivity is verified.
- Actual contract deployment is confirmed.
- Agent identity or ownership is recorded.
- Match configuration is appropriately bound.
- At least one real match is settled.
- Contract independently determines the result from valid actions.
- Invalid submissions are rejected.
- Unauthorized submissions are rejected.
- Duplicate finalization is rejected.
- Confirmed result matches the displayed authoritative result.
- Transaction and contract explorer links work.
- Verified and unverified outcomes are distinguishable.
- Trust assumptions are documented.

## 42.4 Open protocol

- Action schema is published.
- Observation schema is published.
- Rules and map versions are documented.
- Replay format is documented.
- Contract ABI is available.
- Deployment references are available.
- External participation requirements are documented.

An actual independent client is a high-value additional proof.

Do not claim open interoperability is proven by documentation alone.

## 42.5 UX

- Main navigation contains no more than three destinations.
- Play is immediately understandable.
- Wallet is not required for initial practice.
- Coaching resembles a familiar text interaction.
- Character customization is visually understandable.
- The battle dominates the gameplay screen.
- Result and Rematch are easy to locate.
- Default interfaces avoid technical jargon.
- Loading states are meaningful.
- Errors provide clear recovery options.
- Essential controls remain accessible on desktop and mobile.
- No fake or nonfunctional primary interactions are presented as completed features.

## 42.6 Visual

- Pixel Art 2.5D presentation is visible.
- Desert environment is coherent.
- Blue and Sand characters are recognizable.
- Character and environment scale is consistent.
- Depth sorting works.
- Required animation states are present.
- Visual identity is original.
- Asset licenses are documented.

## 42.7 Operational

- Production build succeeds.
- Critical tests pass.
- Public application is accessible.
- Secrets are protected.
- Setup instructions are reproducible.
- Important limitations are documented.
- Submission materials accurately represent functionality.

---

# 43. Release Severity

Use severity classifications.

**Critical**

Examples:

- Core match cannot finish.
- AI integration is fake or unavailable in the claimed AI release.
- Verified result can be arbitrarily fabricated.
- Ownership can be stolen.
- Private keys are exposed.
- Public application cannot load.
- Contract and authoritative replay disagree.

Must fix or explicitly declare the release incomplete.

**High**

Examples:

- Progress is lost on refresh.
- Coaching does not affect model input.
- Memory is not reused.
- Critical buttons are inaccessible.
- Wallet failures are misleading.
- Training progression does not work.

Prioritize before optional features.

**Medium**

Examples:

- Limited cosmetic variety.
- Missing optional replay speed control.
- Incomplete secondary details.
- Minor layout problems.

Fix when time permits.

**Low**

Examples:

- Extra particles.
- Additional decorative props.
- Optional audio variation.
- Minor animation polish.

Do not prioritize over functionality or submission readiness.

---

# 44. Hackathon Demonstration

Prepare a three-to-five-minute demonstration.

The pitch must communicate the product before explaining infrastructure.

Suggested structure:

## Opening

"Most games compete on how well humans control characters. AGENT ARENA competes on how well humans coach AI."

## Product demonstration

1. Open the game.
2. Show that it is immediately playable.
3. Select or display an agent.
4. Give it natural-language coaching.
5. Challenge an official AI opponent.
6. Show the animated Pixel Art 2.5D battle.
7. Show the result.
8. Show a generated lesson.
9. Explain that memory is reused in later matches.

## Blockchain demonstration

10. Open the Agent Passport.
11. Show an actual confirmed BSC Testnet match.
12. Open the actual explorer transaction.
13. Explain that the contract checks the implemented rules and computes the result.
14. Explain the current AI provenance trust limitation honestly.

## Future vision

15. Show the provider-independent architecture.
16. Demonstrate an external agent client if implemented.
17. Explain future model-versus-model competitions.

Do not begin the pitch with Solidity internals or a technical dashboard.

Show the game first.

## Demo resilience

Prepare a previously generated genuine replay as a backup.

Clearly label historical replay footage.

Do not present recorded AI activity as newly generated live inference.

Keep a real confirmed transaction available for inspection.

Do not fabricate transaction screenshots.

---

# 45. Submission Description

Use a concise product description based on implemented functionality.

Suggested starting description:

**AGENT ARENA is an AI-powered tactical auto-battler where humans coach autonomous agents instead of controlling characters directly. Players teach their agents through natural language, watch them compete in a Pixel Art 2.5D arena, and develop persistent experience through match reflection. BNB Smart Chain provides agent identity and contract-validated competition records, laying the foundation for an open AI esports ecosystem.**

Revise the description to accurately reflect the completed release.

Remove or qualify capabilities that were not implemented.

Do not overstate decentralization, interoperability, learning performance, or AI verification.

---

# 46. Required Deliverables

Produce:

- Working source code.
- Playable web application.
- Public deployment URL, if available.
- Solidity source.
- Contract ABI.
- Actual Testnet deployment addresses.
- Actual confirmed transaction references.
- Real AI provider integration.
- Persistent memory implementation.
- Versioned game protocol.
- Replay implementation.
- Asset license documentation.
- Environment variable template.
- Reproducible setup instructions.
- Test evidence.
- Architecture documentation.
- Known limitations.
- Submission-ready description.
- Demo script.
- External agent example if completed.

Suggested documentation:

    README.md
    docs/PRODUCT.md
    docs/ARCHITECTURE.md
    docs/PROTOCOL.md
    docs/IMPLEMENTATION_PLAN.md
    docs/TECHNICAL_VALIDATION.md
    docs/ASSET_LICENSES.md
    docs/TEST_REPORT.md
    docs/BLOCKERS.md
    docs/SUBMISSION.md

Avoid duplicate documentation with contradictory requirements.

Keep the README concise and usable.

---

# 47. Final Implementation Report

At completion, produce a truthful concise report.

Include the following.

## A. Implemented

List actual completed functionality.

## B. Tested

List:

- Tests performed.
- Passes.
- Failures.
- Mocked tests.
- Actual integration tests.
- Actual browser checks.
- Actual Testnet checks.

## C. Deployment

Provide:

- Public URL.
- Contract addresses.
- Chain.
- Confirmed transaction references.

Only include values that were actually verified.

## D. Incomplete

Identify unfinished requirements.

Explain:

- What remains.
- Why it remains.
- Whether it affects submission.
- What user action is required, if any.

## E. Trust assumptions

Explain what the smart contract verifies and what still depends on the operator or AI provider.

## F. Next actions

Provide the highest-priority remaining steps.

Do not list speculative features before unresolved release issues.

---

# 48. Execution Discipline

Work autonomously within the approved scope.

Do not repeatedly ask the project owner to decide issues already specified.

Request input only when necessary for:

- Required credentials.
- Account authorization.
- Testnet funding.
- Irreversible external actions.
- Genuine uncovered product decisions.

If access is unavailable, continue non-blocked development.

Use verified evidence rather than assumptions.

When selecting between alternatives, prefer:

1. Working functionality.
2. Simplicity.
3. Reliability.
4. Usability.
5. Visual coherence.
6. Extensibility.

Do not introduce a larger system merely because it is technically interesting.

Do not spend excessive time documenting future systems.

Do not treat compilation as proof of gameplay.

Do not treat a UI mockup as a completed feature.

Do not treat a contract deployment as proof of meaningful blockchain integration.

Do not treat an AI response as proof of a complete AI agent.

Do not treat stored lessons as proof of improved intelligence.

Validate the actual complete product journey.

After every major milestone:

- Inspect the implementation.
- Run relevant tests.
- Record evidence.
- Fix critical issues.
- Reassess the scope.
- Protect the deadline.

---

# 49. Final Non-Negotiable Product Principles

## Product

Humans coach. AI competes.

## Game

Build a simple game with deep AI, not a complicated game with shallow AI.

## Visual

Classic competitive shooter atmosphere, original desert environments, and cohesive Pixel Art 2.5D presentation.

## UX

The player should experience the game, not the infrastructure.

## Blockchain

AI chooses. Game rules enforce. BNB Chain verifies eligible outcomes.

## Engineering

Separate rules, rendering, AI, persistence, and blockchain.

## Security

Treat all external inputs as untrusted.

## Competition

Equal initial equipment. Meaningful decisions.

## Delivery

A small complete product is better than a large unfinished platform.

## Honesty

Demonstrate what actually works. Clearly identify what does not.

---

# 50. Start Development

Begin now.

First inspect the workspace and verify the essential technical dependencies.

Create a concise implementation plan based on the actual environment.

Perform the initial technical proof-of-concept.

Then implement the first playable vertical slice immediately.

Do not wait for perfect assets.

Do not wait for every optional integration.

Do not restart product design unnecessarily.

Build, test, integrate, inspect, improve, and prepare the submission.

The final objective is a real, attractive, accessible AI game that ordinary users can understand in seconds and technical reviewers can independently inspect.

**AGENT ARENA**

**Your strategy. Your AI. Your champion.**