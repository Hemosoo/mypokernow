# PokerNow Customizer — Architecture

## Data flow and ownership

```text
PokerNow visible DOM → PokerNow adapter ─┐
                                       ├→ normalized visual events
Studio measured slots → preview adapter┘
  → coordinator → preset registry → shared timeline and primitives
  → card/fragment renderer → temporary pointer-transparent overlay

Studio theme editor → validated theme repository
  → chrome.storage.local configuration + IndexedDB assets
  → storage-change subscription → studio/content presentation
```

The adapter knows the website. The animation engine knows only event descriptors and geometry. The studio uses real engine output and a different event source. Theme data is inert configuration; only bundled TypeScript implementations execute.

## Runtime processes

- **Service worker:** a minimal MV3 toolbar action opens the studio in a new tab. No gameplay or animation work belongs in its suspendable lifetime.
- **Content script:** attaches a DOM observer only on permitted PokerNow pages, reads configuration, emits presentation events, and owns native restoration. It uses no network hooks or page-state injection.
- **Studio extension page:** React/TypeScript interface, preview source, schema-based controls, and theme management. React manages tool UI and final preview state, not per-frame card transforms.
- **Shared modules:** event/theme types, validation, rendering, motion, registry, coordinator, and persistence wrappers.

Build with Vite into MV3-compatible local resources. Use strict TypeScript, bundled local fonts/assets or system fonts, and CSP-safe code. No `eval`, remote scripts, downloaded modules, or imported animation JavaScript. Keep permissions limited to local storage and supported site matching; uploaded assets need no broad host access.

## Visual event boundary

Typed events include table ready, hand visual reset, hole cards appeared, flop revealed, turn revealed, and river revealed. A descriptor carries:

- A unique event ID and observed timestamp.
- Table/hand presentation generation and event type.
- Visible card descriptors: rank/suit only when observably exposed; otherwise an explicit back/unknown descriptor.
- Stable presentation slot keys and exact viewport destination rectangles.
- Available origin rectangle, table bounds, and measured seat layout.
- References or leases for native target restoration owned by the adapter, outside serializable theme data.

Events are observations, not authoritative poker events. Adapter confidence must be sufficient before emitting a street. Unsupported, ambiguous, or hidden geometry produces a documented skip. The engine must not complete unknown identities by guessing.

## PokerNow adapter

Centralize all selectors and parsing in `src/adapter/pokernow/`. Separate pure snapshot extraction/diffing from MutationObserver lifecycle. Observe visible presentation nodes; do not inspect React internals, network streams, app stores, hidden attributes containing private data, or hidden card values. Card parsing only consumes the rendered rank/suit presentation known to the current player.

The first supported snapshot is a baseline: signal table readiness but do not replay an existing hand. Batch mutation notifications into one scheduled snapshot after the DOM stabilizes. A visible identity can become readable after a target node appears, so coalesce a short bounded observation window and wait for visible information before face-dependent effects. Do not conceal a face whose identity remains unavailable.

Deduplicate by table generation, logical slot, street/card-set signature, and visible transition rather than node identity. Replacement DOM nodes must not replay a completed event. A shrinking/cleared board establishes a reset generation. A skipped multi-street jump, ambiguous hole-card replacement, unsupported player count, or inconsistent layout should baseline or skip instead of inventing the missing sequence.

Measure with `getBoundingClientRect()` in the same viewport coordinate system as a fixed overlay. Handle scroll, zoom, responsive layout, and different players through measurements rather than hardcoded screen positions. Any geometry invalidation during a run should cancel and restore rather than land at stale coordinates. A deck origin may be a documented table-relative visual heuristic when no deck is rendered; it cannot establish game timing.

Before site-specific claims, record actual observations and limitations in `POKERNOW_INTEGRATION.md`. Tests against authored fixtures establish adapter behavior against those fixtures only.

## Animation contract and registry

A preset definition exposes ID, display name, description, supported event types, default parameters, parameter schema, bounded default duration, reduced-motion policy, and a factory returning a prepared run. Registry validation rejects unknown presets or unsupported assignments and restores safe defaults.

A run supports preparation, play, pause/resume where implemented, progress sampling, finish, cancel, and cleanup. Cleanup is idempotent. A single completion promise resolves after completion, cancellation, or safe failure recovery, without leaving native card ownership unresolved. Errors are reported to the console; the handle uses one idempotent cleanup path. Preview and live code invoke the same factory; adapters supply geometry and lifecycle hooks.

Keep public interfaces small: card descriptors, rectangles, visual events, theme artwork, parameter values, render context, and animation handle. A new bundled preset registers itself with metadata and primitive composition. Core dispatch does not require another event-specific branch for each animation.

## Timeline and motion

Use one deterministic requestAnimationFrame clock per run, shared by all objects and properties in that run. The coordinator bounds concurrent runs. Each frame supplies normalized progress to parallel tracks; relative delays and local durations express stagger, sequence, and overlap. Pausing freezes logical elapsed time. Studio speed changes cancel the current preview and apply on the next replay, preserving the canonical resting state. Sampling progress directly enables tests and replay without wall-clock sleeps.

Prefer transforms and opacity for rendering; CSS perspective and front/back faces provide 3D cards without a heavyweight 3D engine. Use Bézier paths with derivatives, smooth blending, parametric shared formations, damped settles, flips, and impact envelopes as reusable pure functions. Native Web Animations may implement isolated simple accents, but the main shared clock remains the authoritative completion/cancellation path.

Dependency decision: a custom deterministic rAF timeline is sufficient for these 2.5D DOM compositions, avoids heavyweight dependencies, and exposes lifecycle/progress tests directly. Reevaluate a library only if demonstrable authoring or synchronization benefits exceed bundle and interoperability costs.

## Coordinator and safe replacement

The coordinator validates event freshness, preset support, reduced motion, node budget, and configuration. It deduplicates runs and claims logical target slots. Conflicting newer work cancels older work; disjoint effects may run within a fixed budget. Reset, disable, navigation, tab hiding, theme changes, or geometry invalidation cancels affected work.

Safe order:

1. Measure and validate connected visible targets.
2. Prepare the overlay and artwork completely; failure leaves native cards alone.
3. Acquire native concealment leases, each with original presentation state and independent timeout recovery.
4. Start the shared clock and watchdog.
5. On completion or any failure, restore every native lease first, then remove temporary visuals and release resources.

Only card presentation nodes may be concealed. The overlay is fixed, pointer-transparent, inaccessible to focus, and marked decorative. Never alter the game's card values or event timing. Detached nodes can still be restored before references are dropped. Mutation of native styles must restore only properties the extension owns so unrelated site updates survive.

## Card artwork and fragments

A local card renderer produces deterministic complete artwork and semantic layers from visible rank/suit plus theme settings. Front/back output shares dimensions and style tokens. Use system/local fonts and suit geometry or text; asset URLs are local blob/data resources from validated uploads.

Physical segmentation partitions source coordinates into approximately 20–40 polygons. Every fragment holds the same complete artwork with a unique clip polygon and source alignment. Parent transforms animate moving constructions; fragment transforms animate arrivals. No complete source card appears beneath a partial construction. Cache polygon topology and reusable artwork; release blob URLs and temporary DOM references.

Semantic decomposition produces background/border, corner rank/suit groups, central pips, and coherent face artwork. Its component transforms retain exact source placement. Physical and semantic effects share artwork but not choreography or segmentation semantics.

## Theme schema and persistence

A versioned theme contains metadata, card appearance, table appearance, board appearance, event assignments, preset parameters, and asset references. Runtime enablement and motion preferences can live in shared settings so switching themes does not unexpectedly reenable a disabled extension.

Use `chrome.storage.local` for configuration and theme metadata; provide an equivalent local browser repository for standalone development preview. Use IndexedDB for larger uploaded image blobs. Repository methods validate before write, return clear errors, and apply migrations sequentially from recognized previous schemas. Reject future schema versions rather than guessing their meaning.

Uploaded assets accept bounded raster image types with validated dimensions/size. Do not execute SVG or HTML uploads. Store stable asset IDs internally; export embeds bytes and MIME metadata in a portable, bounded JSON envelope. Import validates schema, assignments, known parameter bounds, asset sizes/types, and references before committing. Roll back or leave the previous active theme on failure. Data must never become selectors, script, HTML, or arbitrary remote URLs.

Changes propagate to content contexts through storage notifications. The studio loads its workspace on opening and saves edits automatically. Cancel active work before changing artwork. Deleting a theme requires choosing a surviving active theme, and asset cleanup must avoid deleting blobs still referenced by other themes. Export/import handles duplicated IDs without overwriting unrelated content silently.

## Studio composition

Keep the studio as one application with navigation sections, a measured table preview, playback controls, preset cards, and a property panel. React state represents selected event/theme, parameters, status, and canonical preview board. Engine handles live outside per-frame React state. A replay builds the before-event state, measures slots, emits the event, and restores the canonical after-event state on finish/cancel.

Parameter controls render from registry schemas with labels, units, bounds, and default values. Assignment validation independently handles deal/flop/turn/river. File inputs read local assets; export uses a local download. Surface unsupported live capabilities and persistence failures honestly.

## Future declarative format

Reserve a versioned data-only format with metadata, event capabilities, bounded parameter definitions, visual object references, primitive tracks, keyframes, curves, groups, and timing relationships. Only allow named bundled primitives and typed expressions with bounded evaluation. Set limits on object count, fragment count, duration, nesting, and resource use. Imported packages cannot contain JavaScript, dynamic imports, network endpoints, or arbitrary DOM selectors.

V1 implements bundled presets and reusable primitives, not a visual editor or general-purpose expression interpreter. Keep the registry independent from implementation classes so future validated declarative definitions can compile into the same run contract.

## Verification boundaries

Pure tests verify motion math, fragmentation, schema validation, migration, snapshot diffing, deduplication, and lifecycle. Browser tests verify actual artwork, all eight previews, cancellation, reduced motion, layout changes, and persistence. A real PokerNow session separately verifies selectors, presentation timing, native restoration, and gameplay usability. Record evidence and unresolved risks instead of merging these levels into one “integrated” claim.

## Extension asset-origin boundary

IndexedDB is owned by its origin. Studio pages and the service worker share extension-origin assets; a content script must not look for them in PokerNow’s origin. `readAsset` routes validated `asset:` IDs from content contexts to a same-extension `runtime.sendMessage` handler. The worker reads only extension IndexedDB, validates the requested identifier, and returns bounded raster data. It accepts no URLs, selectors, arbitrary database requests, or code. No extra permissions are required. This follows Chrome’s [storage-origin documentation](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies) and [asynchronous messaging contract](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).

## 0.1.1 runtime diagnostics and independent appearance

The adapter provides `onPresentation` for table-level styling before attempting a strict complete-hand snapshot. Strict snapshot failures pause animations without disabling a valid table theme. Missing uploaded assets fall back independently. The service worker stores bounded structural runtime statuses in session storage; the studio can request a content-script probe. Counts and controlled reason strings are allowed, while identities, names, game IDs, URLs and arbitrary payload fields are rejected.
