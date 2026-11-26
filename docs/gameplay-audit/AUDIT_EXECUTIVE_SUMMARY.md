# V2.5 audit executive summary

V2.5 has an authoritative continuous world at 30 Hz. The world moves and interrupts off-center, but its protected controller gets grid-centered motion choices and plans from periodically sampled views. Three confirmed interactions explain much of the apparent inactivity.

1. Attack permission and resolution both depend on passive contact. The probe produced an authorized current observation within the attack's nominal range and found Attack unavailable. A separate same-position posture change converted a seeded hit to a miss.
2. Observe/Peek detection can last a single boundary, with last-seen retention of 2.2 seconds. Model checkpoints occur every 4 seconds in Objective and about 8.33 by default in Score. A valid short-lived contact can be missed completely. Respawn neither issues a fresh request nor always creates a contact-enter event, even if the new life sees a target.
3. Attack effects use old positions and newly applied posture, while replay frames display updated positions, both fighters, and the result. One probe logged a hit on the 4-tile limit with the displayed state ending 300 units beyond it. This is deterministic ordering, with effects that need clearer presentation.

100 tests passed, eight stored recordings reconstructed, 144 headless matches ran, and a browser replay finished at the exact stored 5–4 result. Two browser risks remain suspected from source: reasserting a held direction after collision and keeping every visual cue through playback frame batching. Assertions and source evidence are indexed below. The historical V1 release and Testnet verification are separate evidence. This audit used zero Gemini generation requests and made no gameplay or integration changes.

Review contact/attack semantics and mixed-state ordering before modifying the world. Add regression fixtures and preserve V2.5 replay validation. Coordinate the respawn and AI observation corrections, then compare revised controller cohorts before interpreting balance.

[Full report](GAMEPLAY_AUDIT.md) · [Issue register](GAMEPLAY_ISSUES.json) · [Evidence](AUDIT_EVIDENCE.md)
