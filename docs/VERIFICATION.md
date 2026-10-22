# Verification record

Date: 2026-10-22. Build: 0.1.0. Environment: macOS sandbox, Node.js 22.14.0, npm 10.9.2, strict TypeScript 5.8.3. The repository was empty when implementation began. Phase 0 specifications were written before application code.

## Verified locally

- `npm run typecheck`: strict application and test types.
- `npm test`: deterministic Node/jsdom tests covering the actual studio, adapter, shared presets, motion, fragmentation, lifecycle, and theme boundaries. Final test count is recorded in the compatibility report.
- `npm run build`: Vite studio, standalone bundled content-script IIFE, ESM service worker, MV3 manifest, generated 16/32/48/128 PNG icons, and source maps in `dist/`.
- All eight compositions sampled at minimum/default/maximum schema values with two- and ten-player deal layouts; no NaN/infinite transforms.
- All 20–40 physical fragment counts exactly partition the final artwork. Cubic endpoints and tangent-matched orbit departure continuity are checked numerically.
- Actual local SVG semantic layers preserve corner ranks/suits, each pip, and a single coherent court illustration. All 52 identities render; numeric pip counts match their ranks.
- Decode/preparation/frame failures, cancellation before async decode, pause/resume, forced finish, twelve-second watchdog, conflicting events, deduplication, reduced motion, and host/source detachment restore original visibility values/priorities and remove layers.
- Adapter fixtures exercise mid-hand baseline, normal streets, skipped ambiguous jumps, equivalent rerenders, repeated card sets in a new hand, partial deals, multi-board/Omaha rejection, and never reading hidden or back-facing identities.
- A complete adapter → presentation → coordinator fixture checks actual concealment leases, cached previously visible identities, cancellation, and observer filtering. It caught and fixed a CSSOM color-normalization loop.
- The React studio is mounted in jsdom. All eight preview buttons reach the actual coordinator; assignments persist, theme creation/duplication/deletion work, reduced motion saves, disabled previews avoid the engine, and invalid stored data remains intact until explicit recovery. This test controls completion timing and **does not test browser paint or CSS layout**.
- Theme tests cover strict inert schemas, migrations, invalid/incompatible assignments, parameter bounds, no-asset portable round-trips, and rejection of remote/vector/executable payloads. Raster signatures and compressed dimensions are bounded before actual image decode.
- Content asset tests prove image IDs are resolved through the extension service-worker message boundary, rather than the website's IndexedDB origin. Complete uploaded-image IndexedDB round-trip still needs real-browser verification.

## Browser verification blocked

`npm run test:browser` bundles a browser fixture, launches Chrome with `--remote-debugging-pipe`, activates the target, checks all eight effects and cleanup, exercises studio controls/persistence, and captures a screenshot. It uses local file URLs, with no automation service or local listener required. Set `CHROME_PATH` on systems without the default macOS Chrome location.

Actual attempts in this environment:

1. The original localhost test-server approach failed with `listen EPERM: operation not permitted 127.0.0.1`.
2. The revised pipe/file approach launched installed **Google Chrome 155.0.8059.85**, which terminated with **SIGABRT** before a DevTools target could be created. A direct headless `--dump-dom` check also exited 134.

Therefore there is **no successful browser playback run, screenshot, CSS layout verification, paint verification, frame-rate measurement, loaded-extension toolbar check, or Chrome-restart check** from this environment. The browser runner is included for execution outside the sandbox. Do not treat its existence as a passed test.

## Live PokerNow verification blocked

The public official homepage was inspected; no authorized game DOM or live session was available. Shell requests also failed DNS resolution. Candidate selectors are isolated and guarded, and are not certified current selectors. No game was created or joined. No hidden game data, socket stream, app store, or game logic was accessed.

Run the live scenarios in `TEST_PLAN.md` and record each preset in `COMPATIBILITY_REPORT.md` before claiming supported live tables. Until then this deliverable is an implemented V1 codebase with local automated verification, **not a fully browser- and live-certified release**.

## Known limitations

- Current live card markup, reveal timing, artwork format, and target geometry are unverified. Unknown layouts preserve normal page presentation.
- Deal choreography needs an observable complete two-card batch for every recognized seat. Ambiguous participation, sit-outs, and incomplete batches are skipped.
- Multi-board/Omaha, historical reveals on attachment, and ambiguous missed streets are skipped.
- Native face mode preserves resting site art; transient animation art is a local equivalent from already visible identities.
- Live board spacing is preserved; spacing edits affect preview only.
- Preview pauses share the bounded twelve-second restoration watchdog; very long paused runs are completed/canceled safely.
- Uploaded image storage and export are implemented. Removing references does not immediately reclaim every orphaned image; `pruneAssets` is available for future safe maintenance. Import storage failures may leave an unreferenced asset while the previous theme remains intact.
- No representative-hardware FPS or sustained memory profiling has been possible. Node/fragment budgets and disposal paths are enforced and tested.

## Follow-up regression fixes — 0.1.1

After a user reported that customization did not apply, code investigation confirmed that the full animation snapshot incorrectly gated every static appearance change, and that failed image resolution prevented adapter startup. These paths are now separated. The actual content-entry test checks an empty recognized table, failed uploaded image, live settings update, diagnostic response, and exact restoration on disable. Additional tests exercise nested aliases, card wrappers, empty seat placeholders, visible backs versus unknown faces, delayed studio assets, and connection reporting. The updated suite passes 48 tests.

The worker stores count-only runtime diagnostics in extension `chrome.storage.session` and actively probes known content-script tabs when requested from Settings. No identities, participant information, or game URL is included. The localhost studio now displays its separate configuration scope. Browser and live-game verification limits above still apply; the user's exact page has not been inspected.
