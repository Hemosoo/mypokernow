# PokerNow Customizer

A local, animation-first Chrome Manifest V3 extension with a dedicated React/TypeScript studio. PokerNow owns the game; the extension presents information already visible to the current player.

**Live PokerNow compatibility is not yet verified.** The content adapter is implemented against guarded candidate selectors and local fixtures. It safely skips unrecognized layouts. The standalone studio and a live game are different verification targets; consult [the compatibility report](docs/COMPATIBILITY_REPORT.md).

## Run the studio

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Choose an event, select an effect, and press Preview. The studio runs independently of PokerNow. It uses exactly the same registry, artwork, fragment system, timeline, and coordinator as the content script.

## Install in Chrome

```sh
npm ci
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this project's `dist` directory.
3. Click the extension's toolbar icon to open the full-page studio. Pin the icon if needed.
4. Configure your animations and theme. Changes save automatically.
5. Reload an already open PokerNow game to load the content script. Only recognized single-board Hold'em layouts are candidates for presentation effects. No live scenario has yet been certified.

There is no popup and no in-game settings panel. Switch off customization in the studio to restore the native page appearance. Browser **Remove** also removes the extension; reload any open game after unloading it.

## If nothing changes

See [troubleshooting](docs/TROUBLESHOOTING.md). In the installed studio, open **Settings → Check PokerNow connection**. The result distinguishes disabled settings, a missing content script, unsupported table/card markup, and missing uploaded assets. A localhost browser preview has separate settings and is now labeled explicitly.

## Room rehearsal

The studio’s **Rehearse a full hand** link opens `preview.html`, a self-contained replica with authored layout CSS. It runs the extension’s shared Runtime, skin, stage and adapter through a sample hand. Choose a room, play, or reset. This is an offline fixture, not a PokerNow connection.

Cards → Made-hand aura offers an on/off toggle, color and strength for a steady glow around your hole cards when they contribute to a pair or better. Only visible cards and revealed board cards are used; board-only hands, folded/hidden hands and multiple boards do not trigger it. Aura settings travel with the theme.

Table settings include metal trim, inscription and emblem; Settings independently controls moving chips, celebrations, action feedback and ambience. Four new house presets join the original eight: House Pitch, Silk Cascade, Velvet Turnover and River Squeeze. Existing saved assignments are preserved. Font attribution and licenses ship in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

## Random animation mode

In Animation Studio, select an event (deal, flop, turn or river), then choose **Random**. Each new event or replay chooses from that event’s compatible presets using the effect’s default tuning. Choices can repeat. Each event has its own assignment; the mode saves and exports with your theme. Global speed and reduced-motion settings still apply.

## Included effects

| Event | Presets |
| --- | --- |
| Initial deal | Dealer Flick, Orbit Deal |
| Flop | Triple Spread, Triple Orbit, Crystal Spread |
| Turn and river, separately assigned | Slam / Impact, Fragment Assembly, Crystallization Reveal |

Motion uses shared continuous trajectories and CSS 3D transforms. Physical construction clips real final card artwork into 20–40 polygons; semantic assembly separates actual ranks, suits, pips, and coherent illustrations. All motion objects are temporary. Reduced motion completes immediately at the canonical card state.

Studio features include event assignments, parameter controls, replay, pause/resume, slow motion, 2–10 preview players, card backs/faces, table and board colors, bounded raster uploads, theme create/rename/duplicate/delete/switch, portable import/export, and restore defaults. Live card spacing is deliberately preserved; spacing customization is preview-only until a safe site-specific strategy is verified.

## Storage and permissions

Extension configuration uses `chrome.storage.local`, while uploaded PNG/JPEG/WebP artwork uses IndexedDB. The localhost studio uses localStorage plus its own IndexedDB; it is a separate browser origin and does not share the installed extension's settings. Theme JSON exports include uploaded assets so they travel with the theme.

The only API permission is `storage`. Content scripts match PokerNow game URLs. There are no network hooks, analytics, backend, hidden-card reads, remote scripts, arbitrary imported code, or screenshot permissions. The overlay ignores pointer input and never changes betting or game data. Unknown layouts, missed streets, multiple boards, and ambiguous identities fall back to the original presentation.

Native face mode retains PokerNow's resting artwork. Animation objects use a local equivalent from already visible identities; current site artwork extraction remains unverified. A deck origin is a measured table-relative virtual origin, not observed server dealing timing. Events can start only after cards become observable.

## Validate

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
```

`test:browser` uses an installed Chrome binary, native DevTools protocol over a debugging pipe, loopback HTTP fixtures, and no automation service. On macOS it finds `/Applications/Google Chrome.app`; elsewhere set `CHROME_PATH` to a Chrome/Chromium executable. Run `build` first. It writes the studio screenshot and verification results to ignored `artifacts/`. These tests prove local behavior, not live PokerNow compatibility or a universal 60 FPS guarantee.

See [TEST_PLAN](docs/TEST_PLAN.md) for live verification steps, performance profiling, and release gates. Current test evidence is in [VERIFICATION](docs/VERIFICATION.md).

## Architecture and contribution

- [Product specification](docs/PRODUCT_SPEC.md)
- [Eight animation specifications](docs/ANIMATION_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md) and [module contracts](docs/INTERFACES.md)
- [PokerNow research](docs/POKERNOW_INTEGRATION.md)
- [Implementation plan](docs/V1_IMPLEMENTATION_PLAN.md)
- [Compatibility report](docs/COMPATIBILITY_REPORT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

MIT licensed. This is an independent project, unaffiliated with PokerNow.
