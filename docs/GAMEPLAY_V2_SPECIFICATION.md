# AGENT ARENA — Unified Gameplay V2 Master Implementation Specification

## 00. Authority and purpose

Continue implementation in the existing AGENT ARENA repository.

This instruction consolidates and supersedes the previous Gameplay V2 and Gameplay-First development instructions.

The original MASTER_SPECIFICATION.md sections 00–50 remain authoritative for the overall product, except where the owner has explicitly revised the gameplay direction through this instruction.

Preserve the existing specification and document these approved gameplay changes separately.

Do not silently delete, rewrite, or mark original requirements as completed.

This is an implementation sprint, not another broad planning exercise.

Inspect the existing repository and working systems before making architectural changes.

The objective is to transform AGENT ARENA from a relatively rigid autonomous damage-exchange game into a meaningful, engaging, spatially aware, FPS-inspired competitive arcade game.

The product vision remains:

**Humans coach. AI competes.**

---

## 01. Owner's gameplay direction

The owner has identified several fundamental issues:

- Agents frequently approach each other and repeatedly exchange damage.
- The environment has limited gameplay significance.
- Movement choices are too restricted.
- The spectator experience feels rigid.
- Human coaching does not yet produce sufficiently observable gameplay differences.
- Excessive time has been spent producing visual assets before validating the underlying gameplay.

The owner wants a competitive autonomous video game inspired by the general experience of classic FPS games, particularly Counter-Strike.

Use this as a game-feel reference, not as a requirement to reproduce proprietary game content or realistic weapon behavior.

Implement original, fictional, abstract arcade mechanics.

The autonomous agents should have meaningful choices involving movement, destination selection, observation, game timing, resource management, and attack decisions.

The game should not become a turn-based RPG with firearms.

---

## 02. Protect the existing V1 release

The existing V1 implementation contains valuable working functionality and verified release evidence.

Preserve:

- Existing public preview.
- Existing protected hosted deployment.
- Previously completed genuine hosted Gemini match.
- Supabase database and migrations.
- Guest authorization.
- Server-owned match processing.
- Coaching persistence.
- Memory revisions.
- Stored replays.
- Existing training progression.
- Existing character assets.
- Existing Isometric renderer.
- Agent Passport.
- Confirmed BSC Testnet deployment and settlement.
- Existing protocol documentation.
- Existing security protections.
- Existing regression tests.

Existing V1 Arena contract:

`0x6bb39ff181723b6238cac858a1c9c028ffc97d09`

Existing V1 settlement transaction:

`0x1637c4faaf1ac80fe18eb24ba6ecaf2829472be5bc4bda9114d8d18729497672`

Treat these as existing release evidence to preserve and verify where necessary.

Do not unnecessarily redeploy the V1 contract.

Do not invalidate existing matches.

Develop V2 through an isolated branch, feature flag, or equivalent reversible implementation path.

Do not replace the working public release with an experimental implementation.

Continue hackathon submission preparation independently.

---

## 03. Gemini credential configuration

The owner has prepared a new Gemini API credential file at:

a local credential file outside the repository

You are authorized to read this specific file for AGENT ARENA credential configuration.

Treat the file as sensitive secret material.

Never:

- Display its contents in chat.
- Print its contents in terminal output.
- Include secrets in screenshots.
- Include secrets in diagnostic logs.
- Copy the file into the repository.
- Commit credentials.
- Include credentials in frontend bundles.
- Upload the raw credential file to external services.

Determine securely whether the file contains one or multiple credentials.

Validate only the minimum necessary credential.

Use supported low-cost metadata or authentication checks before making generation requests.

Determine whether the credential supports the selected Gemini model.

Investigate previous HTTP 503 failures and distinguish them from:

- Provider quota restrictions.
- Invalid credentials.
- Model unavailability.
- Network errors.
- Application-configured match limits.

Do not assume that multiple API keys have independent quota.

Do not rotate keys to evade provider restrictions.

Do not test every available credential unnecessarily.

Configure an appropriate selected credential through secure server-side local configuration and sensitive Vercel environment variables.

Preserve a safe rollback path.

If file access requires owner permission, initiate the appropriate permission request.

If the credential is invalid or unsuitable, report the reason without exposing the secret.

Maintain the previously approved $0 spending constraint.

---

## 04. Development methodology: gameplay first

Adopt a gameplay-first development workflow.

The production order is:

1. Authoritative simulation.
2. Graybox logical map.
3. Movement and navigation.
4. Game actions and state transitions.
5. Abstract visibility and observation.
6. Accuracy and damage.
7. Deterministic balance testing.
8. Strategic AI integration.
9. Replay and verification compatibility.
10. Production visual presentation.

Do not begin another detailed asset-production sprint.

The current objective is to validate the gameplay itself.

A visually impressive environment is not evidence of good gameplay.

The initial V2 prototype must be inexpensive to modify.

Do not invest in detailed animation, character redesign, lighting, large environment illustrations, or complex visual effects before the gameplay is sufficiently stable.

---

## 05. Top-down graybox presentation

Create a simple orthographic top-down development renderer using the existing Phaser and TypeScript stack.

Use basic visual elements:

- Blue and Sand circles for agents.
- Rectangles for walls.
- Rectangles for crates and objects.
- Flat floor colors.
- Simple boundary markers.
- Small state indicators.
- HP and ammunition indicators.
- Basic movement interpolation.
- Concise event labels.
- Optional development-only debug overlays.

Do not require detailed character sprites.

Do not require new textures.

Do not require an isometric projection.

Do not require complex depth sorting.

Do not require new environment artwork.

The graybox must represent an actual running simulation and authoritative replay.

It must not be a static illustration.

Maintain adequate readability at desktop and mobile viewport sizes.

Keep the existing application navigation where practical.

---

## 06. Camera-independent game architecture

The authoritative game engine must be independent of the visual renderer.

Maintain independent logical representations for:

- Map geometry.
- Agent locations.
- Legal navigation connections.
- Agent state.
- Action state.
- Game timing.
- Resource state.
- Observation state.
- Accuracy and damage outcomes.
- Match termination.
- Authoritative event history.

The simulator must not depend on:

- Sprite dimensions.
- Texture dimensions.
- Phaser display coordinates.
- Camera projection.
- Screen resolution.
- Animation frame timing.
- Browser frame rate.

Design a focused renderer boundary that can support:

- Top-down graybox presentation now.
- Existing or improved Isometric presentation later.

Do not build an unnecessary generic game-engine framework.

Both renderers must be capable of presenting the same authoritative V2 match without changing its outcome.

The eventual production renderer remains an open visual decision until gameplay validation is complete.

Preserve the existing Isometric artwork.

---

## 07. Inspect the existing implementation

Before introducing new systems, inspect:

- TypeScript simulator.
- Game state representation.
- Existing legal actions.
- Movement implementation.
- Logical map.
- Existing damage rules.
- Ammunition rules.
- Turn resolution.
- Match termination.
- AI decision schema.
- Gemini prompt construction.
- Agent observations.
- Coaching integration.
- Memory integration.
- Replay format.
- Phaser renderer.
- Solidity verifier.
- Hosted match processing.
- Usage-budget implementation.

Identify which proposed capabilities already exist.

Avoid duplicating or replacing working systems unnecessarily.

Determine why the current implementation frequently produces stationary damage exchanges.

Document the actual findings briefly.

Then proceed with implementation.

Do not return only an audit or plan.

---

## 08. Explicit gameplay exclusions

Do not implement:

- Stamina.
- Mana.
- RPG-style Block.
- RPG-style Guard.
- Magical shields.
- Guaranteed Dodge abilities.
- Automatic successful evasion.
- RPG skill trees.
- Character classes with unequal base attributes.
- Multiple weapon classes during this sprint.
- Weapon purchasing systems.
- Bomb defusal.
- 5v5.
- Realistic ballistics.
- Real-world weapon specifications.
- Real-world combat instruction.

The gameplay should derive depth from original fictional game mechanics, spatial choices, timing, information, and resource trade-offs.

Keep the competition accessible and understandable.

---

## 09. Core agent resources

Retain the following core resources:

### Health

Represents the remaining game health of an agent.

Use bounded integer values.

### Ammunition

Represents the remaining fictional ammunition available for the existing attack action.

Preserve ammunition management and reload constraints.

### Game time

Use action duration and bounded simulation time as meaningful opportunity costs.

Do not introduce an additional Stamina resource.

Do not add unnecessary resource bars.

Both agents must have equivalent starting resources and identical underlying base attributes.

Character appearance must remain cosmetic.

All numerical balance values must be configurable within a versioned ruleset.

---

## 10. Logical map and navigation

Make the environment part of the actual game simulation.

The current V1 environment reportedly contains decorative walls and crates.

V2 must have a meaningful logical navigation system.

Support:

- Walkable locations.
- Blocked locations.
- Valid agent positions.
- Legal navigation connections.
- Valid destinations.
- Deterministic path execution.
- Collision constraints.
- Reachability validation.
- Map boundaries.
- Position-dependent game state.

Use an original abstract graybox arena inspired by the existing Dust Yard theme.

Do not reproduce the proprietary Dust II layout.

Keep the initial arena compact enough for rapid iteration.

Use simple logical coordinates, navigation nodes, a grid, or another appropriate bounded representation based on the existing architecture.

Prefer the simplest representation that supports the intended gameplay and future verification.

The AI must be able to choose valid destinations rather than being restricted to a single advance-or-retreat axis.

Moving to an invalid or unreachable destination must never produce an illegal authoritative state.

Ensure logical map geometry and displayed geometry correspond.

---

## 11. Movement system

Support meaningful fictional movement states.

Evaluate and implement:

### Walk

Standard movement within the rules of the game.

### Run

A faster movement state with appropriate game-specific restrictions or trade-offs.

### Crouch

A distinct posture or movement state with its own game-defined properties.

### Jump

A bounded movement state with visible animation and deterministic state transitions.

Jumping must not grant guaranteed evasion or invulnerability.

A jumping agent may still receive damage under the fictional game rules.

### Reposition

Move to another valid destination within the logical arena.

### Retreat

Represent movement away from the current area through the ordinary navigation system.

Do not necessarily implement retreat as an independent action identifier.

Where practical, use a unified movement intent containing:

- Valid destination.
- Movement mode.
- Bounded action duration or completion condition.

The controller must validate movement legality.

Prevent teleportation, invalid positions, wall penetration, and indefinite movement states.

Do not implement detailed real-world movement or combat simulation.

Use original arcade abstractions.

---

## 12. Action system

Design a compact action schema.

The required gameplay capabilities include:

- Destination-based movement.
- Walk.
- Run.
- Crouch.
- Jump.
- Explore.
- Observe.
- Peek as an abstract information-gathering interaction.
- Hide through valid game state.
- Reposition.
- Attack.
- Reload.
- Hold.

These are gameplay capabilities, not necessarily separate action identifiers.

Prefer reusable and consistent action structures.

For example, movement modes can share one movement action.

Exploration and observation may share a suitable game-information action.

Hiding may be represented as a position-dependent state rather than an activated ability.

Do not introduce a redundant RPG ability framework.

Keep action validation server-owned.

Do not trust arbitrary model-generated commands.

The model must be limited to supported fictional game actions.

---

## 13. Action timing and opportunity cost

Every meaningful action must involve an understandable trade-off.

Use:

- Game time.
- Action duration.
- Mutually exclusive action states.
- Movement availability.
- Information availability.
- Ammunition.
- Reload duration.
- Fictional accuracy properties.
- Maximum match duration.

Do not use Stamina to enforce action costs.

Specify when an action:

- Starts.
- Remains active.
- Completes.
- Can be interrupted.
- Becomes invalid.
- Produces an authoritative event.

Avoid states where an agent can simultaneously perform incompatible actions without an explicit rule.

Prevent zero-duration loops and infinite action chains.

The renderer must not decide when an authoritative action completes.

The game simulation determines completion and publishes the corresponding event.

Do not increase complexity unless it creates a meaningful gameplay improvement.

---

## 14. Abstract visibility and game information

Introduce a bounded game-information system.

The agent should not receive unrestricted opponent information throughout the match.

Represent appropriate fictional information states, such as:

- Observable.
- Not currently observable.
- Unknown.
- Previously observed.
- Information no longer current.

Support valid exploration and observation interactions.

Implement Peek as an abstract arcade observation interaction rather than a detailed simulation of real-world combat techniques.

Hiding must be governed by the game rules.

Do not implement a magical invisibility skill.

Do not give agents information that their current game observation does not permit.

Audit:

- Agent observation objects.
- Model prompt construction.
- Replay data passed into model requests.
- Memory summaries.
- Development debug information.

The spectator may view complete authoritative replay information.

The strategic agent must only receive information allowed by its observation boundary.

Do not expose unrestricted spectator data to the model.

---

## 15. Fictional damage and hit outcomes

Introduce an original arcade-style damage outcome model.

The game should distinguish between:

- Miss.
- Standard hit.
- Precision hit.

Precision hits may be displayed to spectators as HEADSHOT events.

A precision hit should be less common or otherwise harder to achieve under the game rules than a standard hit, with a correspondingly higher fictional damage reward.

Do not implement realistic injury models, anatomical simulation, real-world ballistics, or detailed weapon behavior.

Use configurable abstract probabilities and damage tiers.

Do not assign final numerical values without evaluating their gameplay consequences.

Preserve the existing weapon abstraction.

Both factions must use identical damage rules.

The simulator must enforce:

- Valid attack state.
- Valid ammunition state.
- Legal target availability under game rules.
- Bounded damage.
- Health clamping.
- Correct miss handling.
- Correct terminal-state handling.

A missed attack must consume the appropriate fictional ammunition and action opportunity.

A precision hit must not be guaranteed merely because the model requests an attack.

Do not artificially increase precision-hit frequency to make a demo look exciting.

---

## 16. Abstract accuracy and risk–reward

Introduce meaningful fictional uncertainty into attack outcomes.

Investigate configurable arcade accuracy properties associated with the implemented game states.

Evaluate whether the system needs:

- Standard attack outcomes.
- Higher-risk precision outcomes.
- Movement-state modifiers.
- Timing-dependent modifiers.
- Bounded miss probability.

Keep this system deliberately abstract.

Do not implement real-world aiming techniques, weapon-specific accuracy data, recoil patterns, or guidance for harming people.

The game should provide an understandable distinction between:

- A more reliable standard outcome.
- A less reliable but higher-reward precision outcome.
- An unsuccessful outcome.

Ensure expected game rewards and action trade-offs do not create an obvious universally dominant choice.

Evaluate the distribution of outcomes with deterministic simulation tests.

Balance the system based on actual game results rather than assumptions.

Display concise and truthful game event feedback.

---

## 17. Deterministic seeded randomness

If attack outcomes introduce uncertainty, use reproducible seeded randomness.

Do not use uncontrolled Math.random() in authoritative game resolution.

Specify:

- Ruleset version.
- Randomness algorithm.
- Seed representation.
- Seed initialization.
- Random event ordering.
- Integer arithmetic.
- Outcome mapping.
- Match configuration binding.

Given the same initial state, ruleset, seed, and valid action transcript, the resulting match must be identical.

The renderer must not generate authoritative random outcomes.

Replaying or refreshing a completed match must not change its result.

Investigate seed-selection bias.

Bind relevant match configuration before competition.

Prevent unauthorized seed replacement after match decisions or results become known.

Do not claim decentralized or manipulation-proof randomness unless that property has actually been implemented and verified.

Document the trust model accurately.

Design the selected randomness mechanism with future Solidity parity in mind.

Avoid unnecessary infrastructure or cryptographic complexity during the graybox phase.

---

## 18. Match resolution and fairness

Define explicit action-resolution semantics.

Investigate whether the current implementation has:

- Faction advantage.
- Starting-position advantage.
- Action-ordering bias.
- Terminal-state ordering issues.
- Invalid simultaneous state transitions.

Where appropriate, use bounded fixed-tick simulation or deterministic event-based resolution.

Choose the approach that best fits the existing architecture and verification constraints.

Do not assume that converting the game to a fully continuous simulation is necessary.

Separate authoritative game time from rendering time.

Define deterministic handling for:

- Concurrent compatible actions.
- Interrupted actions.
- Completed actions.
- Damage events.
- Defeat events.
- Reload completion.
- Invalid intents.
- Maximum match duration.
- Draws.
- Inactivity.

Prevent endless matches and unbounded computation.

Both agents must operate under the same rules.

---

## 19. Strategic AI architecture

Gemini must not make decisions every rendered frame.

Separate:

1. Strategic AI decisions.
2. Validated game intents.
3. Deterministic controller execution.
4. Authoritative game simulation.
5. Authoritative event timeline.
6. Visual presentation.

The strategic AI should select meaningful game intentions at bounded decision checkpoints.

The deterministic controller may execute the legal movement and timing associated with an accepted intent.

Do not call Gemini for:

- Every visual frame.
- Every movement interpolation step.
- Every animation update.
- Every repeated status display.
- Replay playback.
- Ordinary visual regression testing.

Do not allow the deterministic controller to secretly replace meaningful AI choices with unrelated hardcoded behavior.

Explicitly document which decisions belong to Gemini and which operations belong to the controller.

The model must remain the source of meaningful autonomous gameplay choices.

---

## 20. Decision checkpoints and bounded plans

Preserve the existing two-turn planning approach where practical.

Evaluate whether V2 should use:

- Bounded short action plans.
- Bounded game intents.
- Decision checkpoints.
- Relevant state-change notifications.
- Explicit completion conditions.

Do not require model inference every time the simulation advances.

Define a clear boundary for requesting a new decision.

Prevent repeated model calls caused by unchanged game state.

Maintain:

- Maximum decisions per agent.
- Maximum requests per match.
- Maximum retries.
- Maximum preparation time or bounded execution policy.
- Maximum authoritative game duration.
- Global inference budget.

Do not expand the API request budget merely because the renderer now animates more frequently.

Measure actual request usage.

Continue using precomputed authoritative matches and stored replays unless a demonstrated requirement justifies a focused architecture change.

Never describe precomputed replay playback as live frame-by-frame model inference.

---

## 21. Human coaching

Preserve natural-language coaching.

The human should be able to express preferences concerning fictional game behavior, including:

- Aggressive or cautious play.
- Movement frequency.
- Exploration preferences.
- Information gathering.
- Resource conservation.
- Adaptation to previous matches.
- Willingness to take risks.

These preferences must not alter underlying base statistics.

Do not create fixed RPG character classes.

Do not assign different damage or health advantages based on coaching labels.

Do not fabricate coaching effectiveness by secretly hardcoding a requested personality into the simulator.

The model should receive:

- Valid game observations.
- Available legal actions.
- Current coaching revision.
- Relevant legitimate memory.
- Applicable ruleset information.

Keep prompts concise and bounded.

Do not expose private model reasoning.

If user-facing explanations are provided, use actual observable game events or supported concise summaries.

---

## 22. Persistent memory and reflection

Preserve the existing agent memory system.

Ensure V2 memory can represent legitimate lessons derived from actual V2 matches.

Version memory context where necessary.

Do not blindly apply incompatible V1 lessons as if they were valid under V2 rules.

Preserve legitimate cross-version personality and coaching information where appropriate.

Keep:

- Agent ownership.
- Coaching revision.
- Memory revision.
- Match association.
- Reflection idempotency.
- Interrupted-match recovery.

Do not fabricate lessons.

Do not generate reflection for an incomplete match as if the match completed.

Do not leak opponent information that was unavailable to the agent.

Keep reflection separate from authoritative game-result computation.

---

## 23. Local deterministic testing before Gemini

Do not consume live Gemini inference for ordinary simulator development.

Create or reuse deterministic development policies.

Clearly label these as:

**Development Test Policies — Not Gemini Gameplay**

Use representative policies to evaluate the legal game systems.

Test:

- Movement legality.
- Navigation correctness.
- Unreachable destinations.
- Blocked locations.
- Collision constraints.
- Position bounds.
- Walking.
- Running.
- Crouching.
- Jumping.
- Observation transitions.
- Hidden-state transitions.
- Action timing.
- Ammunition constraints.
- Reload.
- Misses.
- Standard hits.
- Precision hits.
- Health clamping.
- Defeat.
- Match termination.
- Seed reproducibility.
- Replay integrity.

Run local tests across multiple deterministic seeds.

Use side-swapped configurations and equivalent starting conditions.

Do not consume AI API calls to increase the number of automated tests.

---

## 24. Balance evaluation

Build a lightweight local simulation evaluation workflow.

Avoid creating an unnecessary analytics platform.

Record relevant metrics such as:

- Match count.
- Win distribution by side.
- Draw rate.
- Match duration distribution.
- Action distribution.
- Movement frequency.
- Destination diversity.
- Observation-state changes.
- Miss frequency.
- Standard-hit frequency.
- Precision-hit frequency.
- Ammunition consumption.
- Invalid action count.
- Inactivity duration.
- Termination failures.

Investigate whether a particular action dominates under representative test conditions.

Investigate whether one starting side is systematically advantaged.

Investigate whether matches frequently become repetitive or fail to terminate.

Do not claim mathematical balance from a small sample.

Do not treat policy action diversity alone as proof that the game is fun.

Use actual replay inspection alongside quantitative checks.

Select provisional gameplay parameters based on evidence.

Document remaining uncertainty.

---

## 25. Top-down debug tools

Provide focused development-only inspection capabilities.

Useful information includes:

- Logical map boundaries.
- Walkable locations.
- Blocked locations.
- Agent coordinates.
- Valid navigation connections.
- Current movement state.
- Current action state.
- Selected destination.
- Current action duration.
- Game clock.
- Legal actions.
- Observation state.
- Authoritative event log.
- Seed and ruleset version.
- Replay identifier.

Provide a straightforward way to load deterministic fixtures and stored matches.

Allow playback without Gemini requests.

Where practical, support:

- Pause.
- Resume.
- Replay.
- Step through events.
- Playback speed adjustment.

Debug overlays must not be required parts of the normal consumer experience.

Ensure debug information cannot accidentally enter strategic AI observations.

---

## 26. Minimal visual feedback

During the graybox phase, use simple presentation for game actions.

Examples:

- Smooth circle movement.
- Distinct agent colors.
- Small state markers.
- A simple visual jump indicator.
- Concise observation-state labels.
- Reload feedback.
- Damage numbers.
- Miss feedback.
- Standard-hit feedback.
- HEADSHOT feedback for genuine precision-hit events.
- Health and ammunition changes.
- Match clock.
- Victory, defeat, or draw.

Do not create elaborate effects.

Do not require detailed sprite production.

Do not invent visual attacks, movement, damage, or outcomes.

Every displayed gameplay event must correspond to an actual authoritative event.

Ensure that terminal states render correctly after normal playback, skipping, refresh, and recovery.

The graybox must be easy to understand without relying on developer-only logs.

---

## 27. Spectator experience

The game is an autonomous competition.

The human primarily coaches and watches.

The player should understand:

- Which agent is acting.
- What game action is occurring.
- How agent state changes.
- When an attack succeeds or misses.
- Whether a precision event occurs.
- How much health and ammunition remain.
- Why the match ended according to the game rules.

Keep feedback concise.

Do not overwhelm players with internal state information.

Preserve the current consumer-facing application structure:

- Play.
- My Agent.
- Arena.

Do not add unnecessary primary navigation destinations.

Keep detailed simulation diagnostics in development or expandable advanced views.

Do not introduce direct human combat controls as a replacement for autonomous AI competition.

---

## 28. Replay protocol V2

Introduce explicit versioning for modified gameplay.

Preserve V1 replay compatibility.

Version relevant:

- Ruleset.
- Logical map.
- Action definitions.
- Movement states.
- Observation rules.
- Timing rules.
- Damage rules.
- Accuracy rules.
- Randomness algorithm.
- Initial state.
- Match configuration.
- Action transcript.
- Authoritative event timeline.
- Replay format.
- Verification metadata.

Do not reinterpret old V1 transcripts using V2 rules.

Do not regenerate an existing replay to change its original result.

Ensure that a saved V2 replay is independent of future balance changes.

Persist sufficient information to reproduce the historical result under its original ruleset.

Both top-down and future Isometric presentation must consume the same authoritative V2 replay.

---

## 29. Hosted persistence compatibility

Preserve the approved Supabase project:

`frefnzjshtlsewsxnito`

Do not create another project unnecessarily.

Inspect the existing database schema.

Introduce additive, version-aware migrations only where required.

Preserve:

- Guest authorization.
- Agent isolation.
- Existing coaching.
- Existing memory.
- V1 match records.
- V1 replay records.
- Existing verification records.
- Usage reservations.
- Global request budgets.
- Reflection idempotency.
- Recovery.

Do not perform destructive database changes.

Do not modify unrelated projects.

Do not expose server credentials.

Use local development and deterministic fixtures before consuming hosted resources.

---

## 30. Solidity verification V2

The existing V1 contract must remain valid.

V2 changes to movement, visibility, timing, damage, accuracy, or randomness may require a new verifier.

Design V2 rules with bounded deterministic verification feasibility in mind.

Do not require an immediate Testnet deployment before gameplay is stable.

First:

1. Stabilize the TypeScript V2 ruleset.
2. Document its deterministic behavior.
3. Define transcript encoding.
4. Evaluate verification complexity.
5. Implement matching Solidity rules where feasible.
6. Test TypeScript/Solidity parity.
7. Test invalid transcripts.
8. Test edge cases.
9. Estimate gas.
10. Review bounded computation and trust assumptions.

Do not use the V1 contract to claim verification of incompatible V2 matches.

Do not overwrite the existing V1 deployment.

If V2 becomes ready for deployment, use a separate versioned verifier.

Use BSC Testnet only.

Preserve the previously approved Testnet-only and $0 spending scope.

Report actual limitations if a new mechanic cannot be efficiently verified with the selected approach.

---

## 31. Agent Passport compatibility

Preserve existing confirmed V1 Agent Passport records.

Represent verification status accurately for every match.

Distinguish:

- V1 recorded match.
- V1 confirmed verified match.
- V2 development simulation.
- V2 genuine AI match.
- V2 unverified match.
- V2 confirmed verified match, once supported.

Do not display V2 matches as verified until a compatible verifier has confirmed the relevant result.

Preserve the distinction between:

- On-chain outcome verification.
- Operator-attested AI provenance.
- Application-provided metadata.

Do not claim that a smart contract independently proves the private inference process of Gemini.

---

## 32. Gemini evaluation gate

Conduct live Gemini V2 tests only after the graybox simulator is sufficiently stable.

Before using live inference:

- Verify credential configuration.
- Verify provider availability.
- Verify permitted project quota where accessible.
- Verify global usage reservations.
- Establish a bounded request budget.
- Verify deterministic action validation.
- Verify game termination.
- Verify replay integrity.

Begin with the smallest useful genuine AI evaluation.

Do not run unnecessary matches merely to increase evidence counts.

Use equivalent game conditions when comparing coaching preferences.

Record:

- Model identifier.
- Ruleset version.
- Coaching revision.
- Memory revision.
- Actual legal decisions.
- Action distribution.
- Movement frequency.
- Observation-state changes.
- Attack outcomes.
- Match result.
- Match duration.
- Provider request count.
- Retries.
- Provider errors.
- Invalid response count.

If provider errors occur, respect bounded retry behavior and applicable limits.

Do not rotate credentials to evade restrictions.

Do not silently substitute development policies for genuine Gemini.

---

## 33. Mobile and browser usability

Maintain a playable and observable graybox at representative desktop and mobile sizes.

Test approximately 390px mobile width and representative desktop viewports.

Verify:

- Arena readability.
- Agent visibility.
- HP indicators.
- Ammunition indicators.
- Game clock.
- Action feedback.
- Replay controls.
- Match result.
- No unintended horizontal overflow.
- No inaccessible essential controls.

Do not invest in elaborate mobile-specific artwork during this phase.

Do not redesign the complete application merely to add the development renderer.

The immediate requirement is an understandable working gameplay prototype.

---

## 34. Visual production gate

Do not start detailed production artwork until the graybox demonstrates sufficient gameplay quality.

Required evidence includes:

- Valid spatial movement.
- Meaningful destination selection.
- Collision correctness.
- Observable game-state changes.
- Appropriate action trade-offs.
- Distinct movement states.
- Understandable attack outcomes.
- No guaranteed evasion.
- No infinite defensive or movement loops.
- Stable match termination.
- Reproducible randomness.
- Deterministic replay.
- Readable spectator feedback.
- Evidence of more varied competition than V1.

Review actual gameplay recordings.

Do not consider these conditions satisfied merely because tests pass.

Enjoyment and spectator interest require qualitative inspection.

After gameplay validation, evaluate the best visual production direction.

Possible options:

- Polished top-down presentation.
- Detailed Isometric Pixel Art.
- Optional multiple spectator perspectives in a later release.

Do not automatically create expensive new assets.

Do not discard existing artwork.

The logical map and action states should be stable before production asset generation begins.

---

## 35. Resource and production discipline

Maintain previously approved autonomous resource-management constraints.

Do not:

- Spend real money.
- Enable paid plans.
- Create unnecessary cloud projects.
- Generate unnecessary AI requests.
- Redeploy on every minor change.
- Request unnecessary Testnet funds.
- Use Mainnet.
- Evade provider limits.
- Expose credentials.
- Modify unrelated projects.

Prefer:

- Local deterministic simulation.
- Cached fixtures.
- Existing stored matches.
- Focused regression tests.
- Local browser verification.
- Bounded genuine AI evaluations.
- Consolidated deployment changes.

Do not increase infrastructure complexity unless a verified requirement justifies it.

Ask the owner only for genuine authentication, access, approval, or credential interventions.

Do not transfer routine technical work to the owner.

---

## 36. Implementation priorities

### P0 — Preserve the working release

- Preserve V1.
- Preserve existing Testnet evidence.
- Preserve stored replays.
- Preserve existing hosted resources.
- Preserve submission readiness.
- Configure the supplied Gemini credential securely.

### P0 — Gameplay vertical slice

- Independent authoritative V2 simulation.
- Top-down graybox renderer.
- Logical map.
- Destination-based navigation.
- Collision.
- Walk, run, crouch, and jump.
- Abstract observation and visibility.
- Valid repositioning and hiding.
- Action timing.
- HP and ammunition.
- Miss, standard hit, and precision-hit outcomes.
- Seeded deterministic resolution where needed.
- Match termination.
- Basic replay.
- Development-policy testing.

### P1 — Gameplay validation

- Representative balance evaluations.
- Side-fairness investigation.
- Dominant-action investigation.
- Improved spectator feedback.
- Strategic Gemini integration.
- Coaching compatibility.
- Memory compatibility.
- Genuine AI gameplay evaluation.
- Hosted V2 integration after local validation.

### P1 — Verification completion

- V2 transcript protocol.
- Solidity parity.
- Gas evaluation.
- Separate V2 verifier deployment when ready.
- Version-aware Agent Passport.

### P2 — Visual production

- Final production camera decision.
- Detailed character animation.
- Environment artwork.
- Lighting.
- Additional visual effects.
- Additional maps.
- Optional cosmetics.

Do not begin P2 merely because a graybox prototype looks visually simple.

Do not allow V2 development to compromise the existing V1 release or hackathon submission.

---

## 37. Implementation acceptance criteria

The initial V2 implementation is acceptable only when actual evidence demonstrates:

- A running top-down simulation.
- Agents choosing legal destinations.
- Valid movement through the logical arena.
- Distinct movement states.
- Position-dependent game state.
- Appropriate observation boundaries.
- Collision correctness.
- Attack and reload constraints.
- Miss and damage outcomes.
- Precision-hit outcomes governed by fictional game rules.
- No Stamina.
- No RPG-style Block or Guard.
- No automatic successful Dodge.
- Bounded action timing.
- Stable match termination.
- Reproducible outcomes.
- Valid replay playback.
- Accurate visual event feedback.
- Preservation of V1 functionality.

The game must not simply rename existing actions while retaining the same rigid damage-exchange behavior.

Document which acceptance criteria are implemented, verified, incomplete, or deferred.

---

## 38. Required evidence

Save actual evidence in an organized repository location.

Provide:

- Top-down graybox screenshot.
- Logical map debug screenshot.
- Desktop gameplay screenshot.
- Mobile gameplay screenshot.
- Genuine graybox gameplay recording.
- Representative deterministic match replays.
- Actual action distribution.
- Actual damage-outcome distribution.
- Match duration results.
- Side-fairness results.
- Replay reproducibility evidence.
- V1 regression evidence.
- Actual test commands and results.

When genuine Gemini tests occur, provide:

- Genuine AI gameplay recording.
- Actual request count.
- Actual model identifier.
- Coaching revision.
- Memory revision.
- Actual match result.
- Actual provider errors and retries.

Do not fabricate screenshots, videos, tests, matches, or integration outcomes.

Do not present static concept artwork as proof of gameplay.

---

## 39. Documentation

Update or create focused project documentation covering:

- Approved Gameplay V2 direction.
- Existing V1 limitations.
- V2 logical architecture.
- Ruleset and action definitions.
- Movement representation.
- Observation rules.
- Abstract accuracy and damage.
- Seeded randomness.
- Action timing.
- Replay versioning.
- Gemini decision boundaries.
- Development testing workflow.
- Verification compatibility.
- Known limitations.
- Remaining requirements.

Preserve MASTER_SPECIFICATION.md sections 00–50.

Maintain an accurate REQUIREMENTS_TRACKER.md and PROGRESS.md.

Do not silently reduce the original approved project scope.

Record explicit owner-approved changes separately.

Do not spend excessive time producing documentation instead of working gameplay.

---

## 40. Required next implementation report

Return an evidence-based report with the following sections.

### A. Existing implementation findings

Explain the actual reasons for rigid V1 gameplay.

### B. Credential configuration

Report whether the supplied Gemini credential was securely configured.

Do not expose secrets.

### C. Implemented V2 mechanics

List actual working gameplay capabilities.

Distinguish implemented mechanics from proposed ones.

### D. Graybox arena

Provide actual screenshot and recording paths.

### E. Game rules

Document implemented movement, actions, timing, observation, accuracy, and damage rules.

Report provisional balance parameters and their rationale.

### F. Simulation results

Report actual match outcomes, action distributions, damage distributions, fairness findings, termination behavior, and known problems.

### G. AI architecture

Explain the boundary between Gemini decisions and deterministic execution.

Report actual request usage if live inference occurred.

### H. Replay and verification

Report V1 compatibility, V2 reproducibility, Solidity parity status, and actual verification limitations.

### I. Regression results

Provide actual commands, test results, and build results.

### J. Remaining work

Identify genuine blockers, incomplete requirements, deferred features, and any necessary owner actions.

### K. Product assessment

Explain whether the actual graybox is meaningfully more engaging and varied than V1.

Do not claim success solely because new actions exist.

Do not return another broad implementation plan instead of implementation.

Begin with repository inspection, V1 preservation, secure credential configuration, and the smallest meaningful top-down Gameplay V2 vertical slice.

The final objective is:

**A game in which autonomous AI agents make interesting, observable decisions under fair fictional game rules, while human coaching, persistent memory, reproducible replays, and BNB Chain verification remain central to the product.**

**Make it work. Make it fun. Make it beautiful.**