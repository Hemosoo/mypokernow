# PokerNow Customizer — Product specification

## Purpose

Build a local Chrome Manifest V3 extension that gives PokerNow expressive, cinematic presentation while preserving its game. Version 1 centers on eight reusable card animations and a full-page customization studio. The studio runs without a PokerNow session and uses the same renderer, registry, primitives, and animation implementations as the content script.

PokerNow decides what happens. The extension presents information already visible to the current user. It must not read network messages, application stores, hidden cards, server state, or unpublished future streets. It must not place bets, choose actions, shuffle, evaluate hands, or change any game state. Sample cards belong exclusively to the studio.

## Priorities

In order: motion quality; reliable observable-event synchronization; extensibility; creative range; performance; themes; ease of use. A polished animation is useful only if the original card remains readable when an effect fails. Correct restoration takes precedence over finishing a flourish.

## V1 deliverables

1. Installable unpacked extension, local production build, strict TypeScript, and source documentation.
2. A toolbar action that opens a full-page React studio. No popup and no game-page settings controls.
3. An event-based animation engine with continuous 3D motion, grouped choreography, clipping, semantic card components, cancellation, deterministic completion, and reduced motion.
4. Eight presets: Dealer Flick, Orbit Deal, Triple Spread, Triple Orbit, Crystal Spread, Slam, Fragment Assembly, and Crystallization Reveal.
5. Independent assignments for deal, flop, turn, and river. Turn and river share three reveal presets but retain separate parameters.
6. An interactive table preview with realistic measured geometry, sample cards, selectable player count, deal/flop/turn/river/reset/replay, playback speed, and reduced-motion preview.
7. Foundational card, table, and board appearance controls.
8. Local versioned themes, uploaded assets, theme CRUD, import/export with assets, and restore defaults.
9. A DOM-only PokerNow adapter, conservative synchronization, exact target measurements, and safe unsupported-layout behavior.
10. Automated tests, installation instructions, and an explicit per-preset compatibility report.

Live verification depends on obtaining an observable supported game. Preview completion, fixture tests, inspected site source, and an actual live session are different evidence levels. A passing preview never establishes live compatibility.

## Studio workflows

### Select and tune an animation

Open the extension toolbar action, choose an event, choose a compatible preset, replay it, and tune schema-generated parameters. The center table previews the selected engine output; the parameter panel shows only controls relevant to that preset. Save theme changes locally and apply them to eligible PokerNow tabs through storage updates.

Each preset shows a name, short description, visual thumbnail, explicit selection state, and preview action. Changing the event preserves the assignments for the other events. A failed theme write must show an error instead of reporting success.

### Preview a hand

Choose player count and deal. Flop, turn, and river add the appropriate sample cards. Replay reconstructs the selected event's before/after state so that it does not stack duplicate overlays. Reset cancels current work and restores an empty board. Different preview speeds adjust timeline time rather than rewriting the motion paths.

### Customize appearance

Cards expose built-in backs, back color/pattern, optional uploaded raster image, border, face style, suit colors, face background, and shadow. Tables expose felt color, built-in style, border, page backdrop, and optional background image. Boards expose a backplate/highlight and card shadow; spacing may only change in the studio or where the live adapter explicitly validates a layout-safe implementation. Live card destinations continue to come from native geometry.

The native face option preserves PokerNow's final artwork. Where exact native artwork cannot be represented safely, effects use locally generated artwork based solely on visible identity. Document that handoff; do not claim a pixel-identical extraction.

### Manage themes

Create, save, rename, duplicate, delete, switch, export, import, and restore defaults. Theme exports carry embedded required assets, not browser-local asset IDs alone. Validate the entire import before storing anything. Imported data must never become executable code or request arbitrary remote resources. Keep the active theme usable if storage or import fails.

### Disable customization

Turning the extension off immediately cancels presentation work, restores all temporary concealment and style overrides, and removes effects. No game refresh should be necessary to recover native presentation. A disabled extension does not animate new events.

## Interface direction

Use a dark creative-tool interface with readable typography, quiet chrome, restrained accent colors, and a large table canvas. Navigation includes Animation Studio, Cards, Table, Board, Themes, and Settings within one organized application. Use responsive stacking when a desktop three-column layout becomes cramped. Form labels, focus rings, keyboard actions, and status/error text must remain accessible.

No customization panel, launcher, tooltip, or floating button belongs on PokerNow. Its overlay contains only transient effects and permitted visual styling. It is transparent to pointer input and never obscures betting controls with an input-capturing surface.

## Required behavior and constraints

- Every effect is bounded, cancellable, removable, and resolves to measured canonical destinations.
- Hidden opponents' cards remain backs. Hero faces require identity already visible in the DOM.
- Group effects preserve coordinated timing instead of running unrelated independent animations.
- Physical fragments show real clipped card artwork; semantic assembly shows real rank, suit, pip, or illustration elements.
- First observation of a table is a baseline. Do not replay streets or hole cards already visible when joining.
- A rerender does not replay an already observed event. Unexpected changes cancel rather than guessing unseen state.
- Reduced motion follows the user setting and operating-system preference. Its short presentation must preserve information without orbit, slam, shake, or flying fragments.
- Animation errors restore native cards immediately. Watchdogs and tab/page lifecycle cleanup provide independent recovery paths.
- No runtime dependency on a backend, external asset CDN, remote script, or downloaded executable preset.

## Performance and reliability targets

Aim for 60 FPS on a typical desktop, with transforms and opacity as the per-frame writes. Cache reusable artwork and polygon topology; measure geometry once per event, invalidate it on resize/scroll/rerender, and avoid layout reads inside animation updates. Cap fragments, cards, and effect duration. One short missed frame is preferable to a concealed card or broken controls.

Performance claims require recorded browser observations. Until then, label 60 FPS as a target. Automated lifecycle tests establish bounded cleanup, not the absence of all possible memory leaks.

## Non-goals

V1 excludes betting assistance, hand odds, hidden information, game automation, audio, chips, winning-hand effects, a visual timeline editor, arbitrary community JavaScript, a community marketplace, and a backend. It also excludes the deprecated one-by-one Chain Reaction flop.

## Completion gate

All eight studio presets, shared engine, theme workflows, build, typecheck, and meaningful automated tests must work. Live support is reported separately per preset with evidence, scenarios, limitations, and remaining fixes. Unavailable access to a live game limits compatibility claims; it does not block independently testable engine or studio work.
