# PokerNow Customizer — V1 implementation plan

## Status and sequencing

This is the implementation plan established before significant application code. Completion is demonstrated by build/test evidence and the compatibility report, not by checking a milestone that only has a mock implementation. Update the final report with actual results and remaining limitations.

## Milestone 0 — Specifications and observable-site research

Write product, animation, architecture, implementation, test, and roadmap documents. Research the current public PokerNow frontend and distinguish inspected facts from assumptions. Record table/card rendering, rendered identity, street detection, target concealment, deck-origin feasibility, seat geometry, and changed-layout behavior in `POKERNOW_INTEGRATION.md`.

**Exit:** eight detailed effect designs, a shared engine contract, a safe adapter strategy, and explicit live verification limitations exist before site-specific animation code.

## Milestone 1 — Extension foundation and repository

Create React/TypeScript/Vite, strict compiler settings, MV3 manifest, content entry, service worker toolbar launcher, local studio page, and production build. Define shared event/theme types, registry metadata, schema validation, local settings, IndexedDB asset storage, and restoration hooks. Build the basic preview table with measured card slots and no dependency on a live game.

**Exit:** installable extension opens its studio; a setting survives reload; toggling enablement propagates; unsupported pages remain untouched. Document development and unpacked installation commands.

## Milestone 2 — Engine and renderer

Implement deterministic timeline sampling, relative tracks, cancellation/completion, watchdog, native concealment leases, pure motion math, front/back card rendering, exact geometry mapping, and reduced motion. Add artwork layers suitable for both physical and semantic decomposition. Render a simple movement through the complete preview adapter → coordinator → registry → renderer path before complex presets.

**Exit:** finish/cancel/error restores native visibility and removes overlay nodes. Motion progress can be tested without wall-clock waits. Resizing, reset, and a hidden tab cancel safely.

## Milestone 3 — Physical reference presets

Implement Dealer Flick, Triple Spread, and Slam. Validate round staggering, continuous Bézier motion, overlapping flip/spread, depth-aware shadows, impact envelopes, and exact settlement. Give each its own metadata, supported events, schema, and bounded parameters.

**Exit:** three presets visibly match their distinct concepts and pass midpoint, endpoint, cancel, reduced-motion, and cleanup tests. Turn and river assignments remain independent.

## Milestone 4 — Shared formations

Implement Orbit Deal and Triple Orbit with shared formation centers/phases, depth ordering, partial revolutions, and tangent-aware departures. Exercise 2/6/9 players and irregular measured seat layouts. Bound duration/node count and preserve two deal waves.

**Exit:** no stop between formation and destination, no arbitrary independent circles, accurate final targets, and stable depth transitions.

## Milestone 5 — Fragment and semantic composition

Implement source-aligned clipped artwork partitions, 20–40 polygons per card, coverage/ordering helpers, shared construction fields, and semantic source layers. Build Crystallization Reveal, Fragment Assembly, and Crystal Spread from these primitives.

**Exit:** captured intermediate states show actual incomplete artwork; semantic assembly clearly separates real ranks/suits/art; Crystal Spread is a shared three-card construction with coordinated drift and finish. No generic particles substitute for source fragments.

## Milestone 6 — Studio and themes

Connect all eight presets to event selection, schema-generated controls, real engine preview, replay/reset, speed/slow motion, reduced motion, player counts, and status text. Finish card/table/board controls and theme create/save/rename/duplicate/delete/switch/import/export/defaults. Validate portable assets and storage errors. Polish responsive desktop layout and keyboard focus.

**Exit:** every required preset is selectable and playable; settings persist; exported assets survive import into an empty repository; invalid data is rejected without losing the active theme.

## Milestone 7 — PokerNow observable integration

Implement supported DOM snapshot extraction, initial baseline, identity waits, geometry, event diffing/deduplication, reset generation, rerender handling, and fail-open unsupported detection. Plug emitted contexts into the same registry and engine used by the studio. Apply only permitted owned visual styles and restore them on disable.

Evaluate every preset against actual observable conditions. If a live game cannot be reached, complete fixture/browser testing, record the limitation, and leave live status unverified. Do not manufacture an integration pass using sample events or source inspection alone.

**Exit:** compatibility report lists preview status, live status, verified scenarios, limitations, and fixes for all eight IDs. Any live-supported claim cites the actual scenario exercised.

## Milestone 8 — Reliability, performance, and delivery

Run typecheck, production build, meaningful unit/integration/browser checks, and all-eight preview smoke tests. Exercise rapid streets, cancellation, resets, rerenders, page lifecycle, asset errors, imports, disablement, different geometry, and reduced motion. Inspect browser frame behavior and repeated-run node counts; fix material artifacts and leaks. Update README, architecture notes, and compatibility evidence.

**Exit:** independently testable V1 requirements pass; no known permanent concealment; no placeholder presets; validation commands and actual results are recorded. External live access limitations remain clearly separate from completed preview functionality.

## Dependency map

- Specifications precede implementation.
- Typed events and card artwork precede presets and adapter integration.
- Lifecycle/restoration precede native concealment.
- Physical presets validate primitives before shared formations.
- Polygon and semantic source geometry precede the three fragment presets.
- Registry parameter schemas precede generated studio forms.
- Theme validation and asset repository precede portable import/export.
- Live observations precede any compatibility claim.

Documentation, test design, public-site investigation, and isolated storage work may proceed in parallel. Shared contracts should be agreed first to avoid incompatible event/renderer implementations.

## Risk responses

| Risk | Response |
| --- | --- |
| Current game requires inaccessible browser/session access | Continue complete local implementation; mark live verification pending |
| Selectors change or snapshot is ambiguous | Skip presentation and retain native cards |
| Identity appears after the element | Wait only for visible identity; never infer hidden data |
| Native artwork cannot be safely extracted | Generate equivalent local artwork from visible identity and document handoff |
| Large multi-card fragment effects cost too much | Cap fragments, reuse topology, avoid per-frame layout, reduce optional accents |
| Theme or geometry changes midflight | Cancel and restore before applying new appearance |
| Browser throttles a hidden tab | Cancel/finish safely; watchdog restores on lifecycle transitions |
| Imported theme references missing/unsafe assets | Validate atomically and preserve previous active theme |

## Delivery checkpoint — 2026-10-22

All eight bundled preset implementations, the shared engine, studio, MV3 packaging, guarded DOM adapter, static presentation, theme storage, asset bridge, transfer validation, and documentation are implemented. Strict TypeScript, 38 automated tests, and the production build pass. The tests include a mounted studio dispatching every preset through the actual coordinator and a complete adapter/presentation/coordinator fixture.

Milestone exits requiring actual browser rendering, loaded-extension checks, uploaded-image IndexedDB round-trip, hardware performance profiling, and live PokerNow sessions remain unverified. Chrome aborts under the current sandbox, and no live game DOM was accessible. Those exits are not marked complete. `VERIFICATION.md` and `COMPATIBILITY_REPORT.md` define the remaining validation work; no placeholder animation is substituted for it.
