# Contributing

Use Node.js 22+, `npm ci`, and `npm run dev`. Before a contribution, run typecheck, unit/fixture tests, production build, and browser checks. Record live evidence separately from fixtures; never submit private game URLs or hidden state captures.

## Add a bundled effect

1. Read `docs/ANIMATION_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/INTERFACES.md`.
2. Compose shared motion/card/fragment/timeline primitives under `src/animation/presets`. Keep PokerNow selectors out of this directory.
3. Register a unique ID, supported events, descriptive metadata, bounded default duration, parameter schema, and reduced-motion policy in the registry.
4. Supply actual artwork portions for construction effects and coherent semantic regions for identity effects. Opponent identities stay undefined until visibly revealed.
5. Test exact endpoint geometry, finite trajectories, cleanup, cancellation, preparation failure, source restoration, and reduced motion. Run with 2 and 10 seats, small/large windows, and rapid events.
6. Update the compatibility report honestly for the new effect. A working studio does not certify a live adapter.

All effects must finish at the measured canonical rectangles, preserve input access, and be bounded. Never add game-state mutations, network interception, hidden information, or arbitrary community code execution. Theme imports are inert validated data.

## Future declarative definitions

V1 theme files assign only bundled preset IDs and numeric parameters. They do not accept executable animation definitions. A future format should describe metadata, supported visual events, logical card objects, safe primitive IDs, bounded keyframes, relative track timings, and schema parameters. Its validator must enforce object/fragment/duration budgets and resolve every primitive through a bundled allowlist. No expression evaluator, script URLs, DOM selectors, `eval`, or dynamically imported code belongs in that format. See `docs/ROADMAP.md`.
