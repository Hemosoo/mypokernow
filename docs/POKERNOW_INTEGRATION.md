# PokerNow integration investigation

Inspection date: **2026-10-22**. This document deliberately distinguishes public research, local fixtures, and verification in a real PokerNow game.

## Evidence and access

The current [official PokerNow homepage](https://www.pokernow.com/) was fetched through the web research tool on the inspection date. It advertises games for up to ten players, No Limit Hold'em, Omaha variants, Run It Twice, Double Board, spectator mode, and rabbit hunting. These variants matter: one five-card board and two hole cards must never be assumed for every PokerNow game.

The workspace started empty. No authenticated browser session, permitted live game URL, game DOM capture, or DOM automation tool was available. A direct read-only shell fetch of the public homepage failed with `curl: (6) Could not resolve host: www.pokernow.com`. The web tool supplies readable document text, not an executable browser or complete HTML/CSS/JavaScript asset inspection. No game was created or joined, no private game was requested, and no game socket or application state was inspected.

Consequently **the current table DOM, card artwork representation, exact selectors, reveal timing, seat geometry, and temporary replacement behavior have not been verified against a running PokerNow game**. A working local fixture or studio is not evidence that they work on PokerNow.

A [public extension author's design document](https://github.com/anicolao/pokernow-extension/blob/main/POKER_NOW_DESIGN_OPTIONS.md) was inspected as a source of candidate selectors. It describes `#table`, `.table-player`, `.card`, and child `.value` and `.suit` elements. This establishes what that author reports using; it does **not** establish today's PokerNow markup. Its networking/HUD approaches are outside this product's scope and are not adopted. Candidate selectors remain isolated and guarded until a real visible DOM capture confirms them.

## Investigation questions and current answers

| Question | Verified result | Engineering response |
| --- | --- | --- |
| How is the table rendered? | Public homepage accessible; game implementation unverified. | Locate one supported visible table root; fail open when missing or ambiguous. |
| How are hole cards rendered? | Current game unverified. Public source describes HTML card nodes. | Inspect only painted, visible card/back nodes. Never parse hidden attributes, app stores, React internals, sockets, logs, or future cards. |
| How are community cards rendered? | Current game unverified. | Require a recognized board container and complete visible identities. Canvas-only/unrecognized layouts receive no animation. |
| Can each street be identified? | Not demonstrated live. | In supported single-board layout, compare stable visible board prefixes: 0→3, 3→4, 4→5. Other transitions establish a baseline without historical playback. |
| Can originals be replaced temporarily? | Not demonstrated live. | Only lease visibility after overlay preparation succeeds; restore in `finally`, timeout, abort, disable, rerender, visibility change, resize, navigation. |
| Is a deck origin observable? | No verified deck element. | A documented **virtual origin**, derived proportionally from measured table bounds, is cosmetic. Never claim it is PokerNow's actual deck position. |
| Can seat positions be measured? | Not demonstrated live. | Measure visible seat/card rectangles with `getBoundingClientRect()`; no hardcoded screen locations. |
| Can all eight effects avoid gameplay interference? | Engine approach feasible; live behavior unverified. | Fixed overlay and every child use `pointer-events: none`; only card presentation is leased; no poker controls are altered. |
| What happens after layout changes? | Unknown layouts expected. | Stop, restore, clean up, and establish a new baseline. Unknown structures never trigger speculative animations. |

## Adapter boundary

All PokerNow selectors and heuristics belong in `src/adapter/pokernow`. The animation engine receives typed visible events, card rectangles, a measured table rectangle, and presentation-only theme information. It receives no site selectors and no authoritative game data.

Candidate standard layout profile: `#table` / `.table`, `.table-player`, `.table-player-cards .card`, a recognized community-board container, and visible `.value` / `.suit` descendants. Candidate selectors are compatibility heuristics, not verified support. A second profile with explicit `data-pnc-*` attributes exists only for reproducible local integration fixtures. Fixture acceptance must never be labeled live acceptance.

Visibility must be checked before identity extraction. Both the card and the actual rank/suit text nodes must have visible computed styles and nonempty rectangles. A face-down card may legitimately occupy a rectangle without exposing rank/suit. It must yield `identity: undefined` and remain a back. Never derive identity from class tokens on a face-down card, `data-*` secrets, `title`, a hidden child, image URLs, or a page's internal model. Unknown or ambiguous cards are skipped. Revealed opponent cards are not treated as a new deal.

The initial observation is always a baseline. Reattaching after table replacement, tab restoration, route changes, or a missing table also establishes a baseline. Do not replay a board already present on page load. Use a hand-local stable visible signature plus event kind for deduplication; DOM object identity is insufficient because frameworks replace equivalent nodes.

## Observation and timing limitations

`MutationObserver` observes presentation changes after the site makes them. V1 does not promise to animate before PokerNow reveals a card. An effect requiring identity begins only after visible rank/suit information exists. Cosmetic concealment may hide an already-observed original locally for a bounded interval; it never delays game state, game actions, or site synchronization.

Coalesce related mutations into a short stability window so a three-card flop can become one event. A truncated transition (for example 0→1→3) is accepted only as one newly observed flop within that window. A jump such as 0→5, a changed board prefix, a second board, or a layout that cannot confidently identify a street should baseline and skip. All-in rapid reveals may complete/cancel an older effect before showing the newest visible event.

A synchronized whole-table deal cannot be promised if the page only presents cards sequentially over an unknown duration. Collect newly visible backs/cards briefly, then emit measured targets only when every recognized visible seat has exactly two cards in the same batch. Without a verified participating-seat marker, sitting-out/empty seats or delayed batches cause the current adapter to skip the deal rather than invent missing targets. The engine itself can handle smaller measured batches, but the live adapter remains conservative. Local two-round ordering is presentation choreography, not a claim about server delivery timing.

## Artwork strategy

PokerNow's current artwork format (HTML/CSS, SVG, sprite, image, or canvas) remains **unverified**. Do not scrape private bundles or hidden card assets to work around that uncertainty.

The shared renderer creates extension-owned SVG artwork from **already visible** rank and suit. It provides complete-card art, meaningful semantic layers (body, corner rank, corner suit, pips/illustration), and geometric clips of that exact art. This supports real fragment construction without needing screenshot permissions or canvas readback. A fragment is a clipped portion of the final SVG with matching viewBox and coordinates; there is no complete card behind unfinished geometric fragments.

For native-compatible styling the original site art remains the canonical resting appearance. Temporary locally drawn artwork may differ during an effect. Permanent custom faces, where enabled, are local presentation replacements only. Uploaded raster images are theme artwork/backdrops, never a source of hidden card identities.

## Overlay and geometry

Use a viewport-fixed isolated overlay, with CSS transforms and perspective inside it. Card targets are measured in the same viewport coordinates via `getBoundingClientRect()`. Browser zoom and responsive scaling are thereby reflected in the rectangle dimensions. The origin is derived from measured table bounds. Do not mix page coordinates with viewport rectangles.

Before concealing any original: validate all rectangles and visible identities, construct replacement artwork, attach the overlay, and register a cleanup lease. Reject zero-sized/disconnected targets. Cancellation restores every leased original even if preparation throws halfway through. Final state is the actual original DOM element; effect objects are removed after restoring it. No animation leaves a transformed original in a fabricated final layout.

Resize, scroll, visibility changes, target detachment, table replacement, theme updates, page navigation, and extension disable cancel and restore. Animation duration has a hard bound plus watchdog. Styles must be owned and reversible; never remove a page's original style values blindly. Content scripts have no settings controls, floating buttons, gameplay event handlers, or pointer capture.

## Feasibility by required preset

All statuses below concern the **live integration investigation**, not implementation completeness.

| Preset | Required observable input | Feasible presentation approach | Current live status / limitation |
| --- | --- | --- | --- |
| Dealer Flick | Newly visible seat card/back rectangles; visible hero identities only | Shared virtual deck and two measured-target dealing rounds | Unverified. May only animate a stable observed batch; no hidden identities or historical replay. |
| Orbit Deal | Complete stable set of newly visible participating hole-card targets | Shared phase/depth formation with continuous target peel | Unverified. Skip incomplete/ambiguous batches; cannot assume all cards arrive together. |
| Triple Spread | One new complete three-card board with visible identities | Shared compact stack spreading while flipping | Unverified. Must coalesce three observable cards before starting. |
| Triple Orbit | Same observable flop event | One shared center/phase with layered depth and coordinated release | Unverified. Same flop detection limitation; overlay cannot intercept controls. |
| Crystal Spread | Three visible identities and measured slots | One shared construction field using clips of extension artwork | Unverified. Artwork is locally reconstructed; unsupported board layouts skipped. |
| Slam / Impact | One visible new fourth/fifth card and target rectangle | Elevated 3D flip, acceleration, overlay shockwave | Unverified. No need to transform betting controls or original board. |
| Fragment Assembly | Same visible turn/river identity and rectangle | Semantic layers from local rank/suit/pips/illustration SVG | Unverified. Requires readable identity; generic particles are not a substitute. |
| Crystallization Reveal | Same visible turn/river identity and rectangle | Approximately 20–40 polygon clips of the exact final local artwork | Unverified. No card is drawn behind assembling fragments. |

All eight can use the same engine in preview and, when the stated inputs exist, a live adapter. This is an architectural feasibility conclusion, **not a claim of verified live support**.

## Unsupported states and verification gate

Default safe behavior for unrecognized DOM, ambiguous card identity, multiple boards, unsupported variants, canvas-only cards, stale events, or missing geometry is normal PokerNow presentation. Do not add broad speculative selectors that confuse chat/history cards with active cards. Do not observe unrelated documents or frames.

To promote a layout to verified support, manually load the unpacked extension into Chrome, open an authorized test game, and record browser/version/date plus sanitized visible DOM evidence. Exercise a new hand and all streets at 2, 6, and 10 players; attach mid-hand; rerender and resize at browser zoom 80%, 100%, and 125%; switch tabs during every effect; toggle/disable; verify originals restored and betting controls clickable. Test every preset assignment separately. Check unsupported multi-board/Omaha modes fail safely. Record outcomes in `COMPATIBILITY_REPORT.md` without including private game URLs or hidden game information.

## Later local test access

After implementing a native DevTools pipe runner, Chrome launch was attempted without a local server. The installed browser aborted with SIGABRT before any page could be inspected; a direct headless dump also exited 134. No further public-site or game DOM findings were obtained. See `VERIFICATION.md` for the exact local checks and blocked browser attempt.

## 0.1.1 observation and appearance split

Static appearance now observes a recognizable unique table separately from strict visual-event snapshots. It can apply table styling without seats, before a board exists, during partial streets, or when an animation hand is unsupported. Unknown or ambiguous table roots still restore presentation. Card art is replaced only for readable already-visible identities or explicitly visible backs; unsupported card identity parsing never substitutes a guessed back.

Additional author-source evidence informed candidate aliases, without verifying current live DOM: [Selenium card-container adapter](https://github.com/Zehmosu/PokerNow/blob/master/PokerNow/managers.py), [TypeScript DOM scraper](https://github.com/hellomate2/gto-poker-overlay/blob/main/src/content-script/scraper.ts), and [empty-seat handling](https://raw.githubusercontent.com/EthanLebowitz/PokernowHUD/master/content.js). Only structural selector evidence is used; identity-from-class, networking and log-reading approaches are not adopted.
