# PokerNow Customizer — Test plan

## Evidence and scope

Use pure tests for deterministic algorithms, DOM/browser tests for lifecycle and real visual output, and actual PokerNow sessions for live compatibility. A fixture resembles a site but cannot prove that site's current selectors or update timing. Record commands, browser versions where relevant, outcomes, and skipped external verification in the compatibility report.

Tests focus on information safety, restoration, choreography, exact geometry, and meaningful theme workflows. Avoid tests that merely restate implementation constants without exercising behavior.

## Build and static validation

- Strict TypeScript passes for studio, shared engine, extension entries, and test code.
- Production build emits a valid MV3 manifest, studio HTML/assets, service worker, and content bundle.
- No runtime remote script, unsafe evaluation, or unbundled source dependency exists.
- Toolbar action opens the full studio. No popup or in-game configuration panel appears.

## Pure algorithm tests

### Motion and timeline

Test Bézier endpoints, tangent direction, clamped normalized progress, smooth envelopes, relative delays, overlapping tracks, pause/resume time accounting, speed changes, and deterministic terminal sampling. Check that invalid/zero duration cannot yield NaN or endless runs. Finish and cancel resolve once even if called repeatedly or after a timeout.

### Artwork and fragments

Test valid ranks/suits, unknown backs, semantic component placement, number-card pip counts, and face-card coherent art groups. Polygon sets cover source artwork without missing final areas; each clip refers to the correct source coordinates. Test fragment count limits, deterministic seeded ordering, edge/background-first priorities, and increasing arrival density near completion. Verify no complete card layer appears beneath partial physical assembly.

### Registry and schema

Verify eight unique IDs, supported-event assignments, parameter defaults/bounds, reduced-motion behavior, and no missing factories. Unknown IDs, invalid event mappings, excessive fragments, and non-finite values fall back or fail validation safely.

### Theme and assets

Exercise recognized schema migration, rejection of future/unsupported versions, create/rename/duplicate/delete/switch/defaults, and failed storage writes. Round-trip exports with uploaded assets into a fresh store and verify references/bytes. Reject malformed JSON, unknown executable properties, unsupported asset types, oversized images, invalid MIME data, missing asset references, arbitrary remote URLs, and invalid parameter values. A failed import leaves the active theme unchanged.

## Adapter tests

Use small DOM fixtures based on explicitly documented inspected structure; label authored fixtures clearly.

1. Initial snapshot with existing hole/flop/turn cards baselines without historical animation.
2. Empty board → three visible cards emits one flop, then four emits turn, then five emits river.
3. Repeated identical mutations and replacement card nodes emit no duplicates.
4. Reset/board clear advances the presentation generation; an identical next-hand card may animate again.
5. Back/unknown cards never acquire identity from hidden data, offscreen caches, or application internals.
6. Identity becoming visibly available after node creation can satisfy a bounded pending observation; absent identity fails safely.
7. Mid-observation multi-street jumps or ambiguous changes do not fabricate the missing event sequence.
8. Target rectangles are measured, positive, connected, and mapped into fixed overlay coordinates correctly.
9. Resize, scroll, table replacement, visibility change, navigation, and disablement release observers/runs and restore targets.
10. Unsupported selectors/layouts leave the native page usable with no concealed elements.

## All-preset browser matrix

Run each preset at default/minimum/maximum meaningful parameters, normal and reduced motion, and cancellation at approximately 10%, 50%, and 90%. Test finish, exception, watchdog, and rapid replay. Inspect actual rendered midpoint frames, not only completion promises.

| Preset | Distinct visual assertions |
| --- | --- |
| Dealer Flick | Deck-to-seat arc; two rounds; modest rotation; face-down opponents; no seat fade substitute |
| Orbit Deal | Shared moving formation; distinct depth; two peel waves; continuous formation-to-target travel |
| Triple Spread | Shared stack/group motion; spread and flip overlap; subtle ripple; exact three slots |
| Triple Orbit | Shared partial orbit; visible depth crossing; face flip during strong motion; continuous departure |
| Crystal Spread | One construction field; genuine partial three-card artwork; outward drift; synchronized completion |
| Slam | Anticipation/flip/descent overlap; rapid impact; adjustable force; brief restored local reaction |
| Fragment Assembly | Real ranks/suits/pips/art separated; meaningful identity timing; coherent face art; correct final source positions |
| Crystallization | 20–40 real clipped pieces; incomplete intermediate card; edge then identity construction; faster final arrivals |

After every run assert exact canonical state, no overlay children, no active clocks/watchdogs, no unreleased concealment, and no stale event ownership. On cancel the native state is immediately legible even if final animated pose is not shown.

## Preview interactions

- Deal, flop, turn, river, reset, and replay use the shared engine.
- Independent turn/river assignments and intensity settings survive switching events and reloading.
- Player counts 2/6/9 and varied preview sizes produce measured destinations.
- Slow motion/speed adjustment preserves choreography and remains bounded.
- Rapid sequential event clicks do not conceal newly rendered cards or leave old fragments.
- Changing a preset/theme, resizing, or resetting midflight restores presentation.
- All controls have labels, keyboard focus, usable contrast, and responsive layout.

## Native overlay lifecycle

Use an ordinary interactive fixture table to test native substitution independently of PokerNow.

- Preparation fails before concealment: native cards stay visible.
- Playback throws after concealment: native cards restore and overlay disappears.
- Targets detach or are replaced: tracked original nodes restore; replacements stay visible.
- Native inline styles change independently: restore only extension-owned properties.
- Overlay hit-testing cannot intercept a betting/control click.
- Cancellation/finish/cleanup called in different orders remains idempotent.
- Disabled extension and tab/page teardown remove all owned styles and observers.

## Live verification checklist

Only mark these verified after observing an actual game in the supported browser. Record date, URL kind, browser, player count/layout, zoom, preset IDs, event sequence, and any native artwork mismatch.

1. Detect an existing table and baseline mid-hand without replay.
2. Observe hole-card appearance while opponents remain backs and hero values match only rendered information.
3. Observe flop, turn, and river with correct destination rectangles and no duplicate replay after routine rerenders.
4. Exercise each of eight presets on its supported event, including shared three-card effects.
5. Verify betting controls remain clickable during animations.
6. Disable mid-animation; verify native appearance returns.
7. Refresh, resize/zoom, switch tabs, and watch a hand reset.
8. Observe unexpected layout/rerender behavior and confirm fail-open restoration.

Inspecting a public script bundle, a landing page, or a studio fixture does not satisfy this checklist. When access is unavailable, describe the exact blocker and keep live status unverified.

## Performance and longevity

Observe browser performance on a typical desktop and record representative frame behavior for Orbit Deal and Crystal Spread at maximum supported objects. Ensure the animation loop avoids repeated layout reads. Replay effects repeatedly and compare retained overlay nodes, timers, listeners, and blob URLs after settling. Verify uploaded assets are not duplicated on every replay.

Smooth 60 FPS and “no memory leaks” require measured evidence and realistic scope; describe the tested environment and limits rather than asserting universal performance. A small automated repeated-run cleanup test is still valuable even when profiling access is unavailable.

## Release evidence

The README lists installation and verification commands. The compatibility report includes one row per preset with preview result, live result, verified scenarios, limitations, and outstanding fixes. Record known failures explicitly. Build/test success does not waive unresolved core requirements or authorize a live-support claim.

## Included command mapping

- `npm run typecheck`: strict code and test contracts.
- `npm test`: motion/fragment invariants, actual lifecycle failures, guarded DOM fixtures, mounted React studio interactions/persistence/recovery, theme/schema/raster safety, and same-extension asset messaging.
- `npm run build`: unpacked MV3 output in `dist`.
- `npm run test:browser`: real Chrome over DevTools pipe with local files; checks actual execution, restoration, controls, responsive width, and captures a screenshot. This command was attempted but is blocked by Chrome SIGABRT in the current sandbox. It remains a release gate, not a passing check.

See `VERIFICATION.md` for current evidence. Add a loaded-extension test of the service-worker image bridge and uploaded PNG/JPEG/WebP round-trip before certifying asset behavior. Do not use the no-asset JSON unit round-trip as proof of native IndexedDB behavior.
