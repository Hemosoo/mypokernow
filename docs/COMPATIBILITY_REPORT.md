# Compatibility report

Updated: 2026-10-22. Status labels distinguish implementation, local browser/fixture verification, and actual PokerNow verification. **No live PokerNow game has been inspected or exercised in this workspace.** See [integration investigation](POKERNOW_INTEGRATION.md) for evidence and access limitations.

## Preset matrix

| ID | Studio implementation | Local verification | Live PokerNow | Known limitation / outstanding verification |
| --- | --- | --- | --- | --- |
| `deal.dealer-flick` | Implemented shared composition | Finite-motion / parameter-extreme tests passed; browser blocked | Unverified | Need visible deal batch, actual seat/card rectangles, two-round restoration check. |
| `deal.orbit` | Implemented shared composition | Finite-motion / parameter-extreme tests passed; browser blocked | Unverified | Need full observable deal formation and varying seat counts; ambiguous/incomplete seats skipped. |
| `flop.triple-spread` | Implemented shared composition | Finite-motion / parameter-extreme tests passed; browser blocked | Unverified | Need reliable coalesced 0→3 board transition and overlapping spread/flip inspection. |
| `flop.triple-orbit` | Implemented shared composition | Finite-motion / parameter-extreme tests passed; browser blocked | Unverified | Need shared depth choreography and precise actual board geometry. |
| `flop.crystal-spread` | Implemented shared composition | Finite-motion / polygon partition tests passed; browser blocked | Unverified | Need shared fragment field, actual card clip fidelity, synchronized completion. |
| `reveal.slam` | Implemented shared composition | Finite-motion / parameter-extreme tests passed; browser blocked | Unverified | Need visible turn/river transitions, bounded impact, clickable controls. |
| `reveal.fragment-assembly` | Implemented shared composition | Finite-motion / semantic geometry tests passed; browser blocked | Unverified | Need visible identity parsing and meaningful semantic artwork convergence. |
| `reveal.crystallization` | Implemented shared composition | Finite-motion / polygon partition tests passed; browser blocked | Unverified | Need true incomplete clipped artwork at intermediate progress and exact restoration. |

## Scenario evidence ledger

| Scenario | Evidence | Status |
| --- | --- | --- |
| Public official homepage | Read-only web fetch on 2026-10-22 | Inspected; no game DOM |
| Direct public HTML/assets in shell | DNS resolution failure | Not available |
| Current live table selectors and artwork | No live game DOM/session | Unverified |
| Studio eight-preset playback | All eight buttons dispatch through the real coordinator in mounted React/jsdom tests; composition extrema sampled; browser painting unavailable | Browser blocked (Chrome abort) |
| Local DOM adapter fixtures | `tests/adapter.test.ts`: explicit offline profile, visible-only identities, coalesced flop, equivalent rerender, incomplete/multiboard/Omaha skip, source lease cache, style restoration | Passed in jsdom; fixtures are not live evidence |
| Mid-hand join / baseline | `VisualDiffer` unit test attaches with existing flop, emits no historical flop; later turn emits once | Passed locally; live unverified |
| Cancel, timeout, disable, rerender, reduced motion | Actual coordinator tests cover async decode cancellation/failure, track/preparation errors, watchdog, progress, conflict/dedup, source/host removal; mounted studio checks disable; adapter rerender/restoration fixtures | Passed locally; actual browser visibility transitions unverified |
| Theme import/export and assets | Strict schema/migration, compatible assignments/parameter bounds, portable no-asset JSON, raster validation, and content-to-extension asset message tests | Unit/message-boundary checks passed; actual IndexedDB/image-decode browser round-trip blocked |
| Chrome toolbar launch / storage / restart | Requires loaded unpacked extension | Pending |
| Sustained 60 FPS on representative hardware | Requires browser profiling | Unverified |

Final validation: `npm run typecheck`, `npm test` (**38/38**), and `npm run build` passed. Motion tests sample all eight compositions at parameter extrema and 2-/10-player layouts. These are structural/numeric and jsdom interaction checks, not proof of browser paint, visual polish, FPS, or actual game compatibility. See [verification evidence](VERIFICATION.md) for exact commands, test coverage, and blocked Chrome attempts.

## Browser restriction

The native pipe/file browser runner was attempted with Chrome 155.0.8059.85 and terminated with SIGABRT before a target was created. The original local-listener approach was also denied with EPERM. `npm run test:browser` is included but has **not passed** in this environment. Toolbar launch, uploaded-image round-trip, actual responsive layout, browser restart, frame-rate profiling, and live sessions remain external verification work.

## Release gate

Do not mark V1 fully live-integrated while this matrix has unverified live entries. Build/test success establishes software correctness only within those checks. Local fixture success establishes adapter behavior for the fixture structure only. Public source descriptions of selectors do not establish current PokerNow compatibility.

Manual evidence should name the scenario, extension build, browser version, preset, player count, resolution/zoom, date, result, and outstanding issue. Store only sanitized visible DOM captures; omit private game URLs, participant details, network payloads, and hidden information.

## 0.1.1 failure investigation

A user reported no customization. The exact live page was unavailable for reproduction. Confirmed code defects were repaired: static appearance depended on a complete animation snapshot; missing uploaded assets disabled startup; native important styles could win; nested table/card wrappers and empty seats were mishandled; studio playback raced asset resolution. Basic appearance now remains independent of animation support. Unknown faces remain native unless their visible identities are readable; explicit painted backs can be customized.

The local regression suite now passes **48 tests**. The actual content entry, settings updates, image fallback, counts-only diagnostics and restoration are exercised. Version **0.1.1** is packaged in `dist/`. Read `TROUBLESHOOTING.md` for reload and studio connection steps. All eight presets retain **unverified live PokerNow status** until exercised against the actual page.
