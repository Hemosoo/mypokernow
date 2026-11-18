# PokerNow Customizer

A local, animation-first Chrome Manifest V3 extension with a dedicated React/TypeScript studio. PokerNow owns the game; the extension presents information already visible to the current player.

**Live PokerNow compatibility is not yet verified.** The content adapter is implemented against guarded candidate selectors and local fixtures. It safely skips unrecognized layouts. The standalone studio and a live game are different verification targets; consult [the compatibility report](docs/COMPATIBILITY_REPORT.md).

## Run the studio

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. The studio runs independently of PokerNow and uses exactly the same registry, artwork, fragment system, timeline, and coordinator as the content script.

The studio is laid out like a game's cosmetics screen: a navigation rail on the left, the live table in the middle, and a panel for the page you are on. Drag the panel's edge to resize it (double-click resets), or hide it to give the table the whole width. The top bar shows the theme in use (click it for recent and all themes), search, undo and redo, the save state, and the **PokerNow** switch, which says whether your theme is *Live* on PokerNow, *Off*, or *Preview only* (the localhost studio, which cannot reach PokerNow).

- **Discover** opens with the same hand recorded on a plain table and with the Puppy theme, looping in step behind a divider you can drag, with chapters for the deal, each street and the win. Below it: the themes, featured cinematic effects and the puppy. Returning visitors get a *Continue with…* bar instead of the getting-started steps. No live table runs on Discover.
- **Themes** is the gallery. Each card is drawn with the theme's own table, deck, card back and room light. Click a card to preview it on the table without applying it (the table says so; **Esc** goes back), then **Use** it. Built-in themes can be edited and restored to their original look but never deleted; your own themes can be renamed, duplicated, exported or deleted (with confirmation and an Undo). **Surprise me** makes a new theme from a coordinated palette, a deck and a random set of effects.
- **Appearance** has four tabs. *Cards*: seven decks (Classic, Modern, Midnight, Neon, Sakura, Puppy and PokerNow's own), shown as fanned A♠ K♥ 7♦, six card backs or your own image, then colours and advanced settings (corner radius, shadow, made-hand glow). *Table*: coordinated palettes, the mood pad (drag across for colour, down for depth), a surface diagram that lights up the felt, rail or trim you are editing, the trim metal, the felt pattern (plain, paw prints, lit grid, petals; it also marks the chips and dealer button), the emblem and words on the felt. *Room*: room colour, a background image and the ambient particles. *Board*: the highlight colour, plus effect-lab-only spacing and plate settings, labelled as such. Colours you have changed show a reset button.
- **Effects** has a tab for each moment (Deal, Flop, Turn, River) showing what each uses. Cards show the effect mid-motion, cropped to where it happens, and play the recording on hover or keyboard focus. Click a card to try it on the table: the table says it is *not equipped* until you press **Equip**. Search, sort, and filter by Cinematic, Minimal, Companion, Favorites or Fast. **Shuffle** for a moment picks a random effect each hand, from your hearted effects when any suit it.
- **Companion** is the 3D puppy: choose it (or none), its coat, collar and size, its energy, and whether it joins the action. **Try a trick** makes it celebrate, nap, bark, tilt its head, scratch or stretch on the table, and its card duties can be tried or equipped for every street. The stage follows the puppy in close-up; click it on the table to say hello.
- **Settings** (bottom of the rail) holds the PokerNow switch and connection check, reduced motion, the animation speed used on PokerNow, a performance mode (High quality, Balanced, Lightweight) with each table effect switchable on its own, import and export, and a reset that keeps your own themes.

The player under the table plays, pauses, replays and resets, plays any moment or a whole hand, and has a preview speed (1×, ½×, ¼×) that is separate from the speed used on PokerNow and is never saved. **Players** sets 2–10 seats; hold **C** (or *Hold to compare*) to see the table without your theme; the expand button shows the table full screen. Everything on the stage is a simulated hand on the replica table.

Keys: **⌘K** or **/** search, **⌘Z** / **⇧⌘Z** undo and redo, **Space** play or pause, **1–4** play a moment, **[** and **]** try the previous or next effect, **H** a whole hand, **F** heart the effect on the table, **R** replay, **Esc** stop previewing a theme, **?** the full list.

Effect posters and clips in `public/media/` are recorded from the replica table by `scripts/capture-media.mjs` (Playwright and ffmpeg), which hands the frames to `scripts/frame-media.py` (numpy, Pillow) to crop each one to its own motion and pick its poster. Run it again after changing a preset. The comparison clips are `public/media/compare-*.webm`.

## Install in Chrome

```sh
npm ci
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this project's `dist` directory.
3. Click the extension's toolbar icon to open the full-page studio. Pin the icon if needed.
4. Choose a theme, customize it, and pick effects. Changes save automatically and apply to PokerNow at once; undo is one click away.
5. Reload an already open PokerNow game to load the content script. Only recognized single-board Hold'em layouts are candidates for presentation effects. No live scenario has yet been certified.

There is no popup and no in-game settings panel. Switch off customization in the studio to restore the native page appearance. Browser **Remove** also removes the extension; reload any open game after unloading it.

## If nothing changes

See [troubleshooting](docs/TROUBLESHOOTING.md). In the installed studio, open **Settings → Check PokerNow connection**. The result distinguishes disabled settings, a missing content script, unsupported table/card markup, and missing uploaded assets. A localhost browser preview has separate settings and is now labeled explicitly.

## Room rehearsal

`preview.html` is a self-contained replica with authored layout CSS (the studio's live table embeds it). It runs the extension’s shared Runtime, skin, stage and adapter through a sample hand. Choose a room, play, or reset. This is an offline fixture, not a PokerNow connection.

Cards → Made-hand aura offers an on/off toggle, color and strength for a steady glow around your hole cards when they contribute to a pair or better. Only visible cards and revealed board cards are used; board-only hands, folded/hidden hands and multiple boards do not trigger it. Aura settings travel with the theme.

Table settings include metal trim, inscription and emblem; Settings independently controls moving chips, celebrations, action feedback and ambience. Four new house presets join the original eight: House Pitch, Silk Cascade, Velvet Turnover and River Squeeze. Existing saved assignments are preserved. Font attribution and licenses ship in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

## Rooms

Seven built-in themes, each with its own palette, deck, emblem and pace:

| Theme | Look | Effects |
| --- | --- | --- |
| Monte Carlo | Emerald felt, gold inlay, classic engraved deck | The signature set: Dealer's Storm, Grand Flop, Spotlight, Showdown |
| Obsidian | Charcoal felt, brushed silver, flat modern deck | Restrained: Dealer Flick, Triple Spread, Velvet Turnover |
| Rouge | Claret felt, warm gold, laurel emblem | Theatrical: Orbit Deal, Triple Orbit, Slam, Showdown |
| Riviera | Midnight-blue felt, rose-gold inlay | Fluid: House Pitch, Silk Cascade, River Squeeze, Spotlight |
| Neon | Night-city felt with a lit grid, a neon tube around the rail, glowing cards on black, circuit backs, flickering pixels | Digital: Dealer's Storm, Crystal Spread, Fragment Assembly, Crystallization |
| Sakura | Dusk-blue felt with petals, cherry-wood rail set with blossoms, washi-paper deck, falling petals | Gentle: House Pitch, Silk Cascade, Velvet Turnover, River Squeeze |
| Puppy | Walnut and forest felt with paw prints, puppy deck, the 3D puppy | The puppy deals and reveals every street |

Libraries saved before Neon and Sakura existed gain them once (library version 5), after every theme the owner made; nothing is replaced, and a room deleted later stays deleted. A new theme starts from Monte Carlo; the Theme gallery's *Surprise me* builds one at random.

## Puppy skin

Choose **Puppy** in the theme switcher or under **Themes**, or choose the puppy on the **Companion** page. A procedurally modelled 3D puppy (Three.js, rendered on a transparent, click-through canvas) lives on the table:

- It rests where it covers no cards, chips or name plates, and idles: wagging, blinking, looking around, tilting its head, scratching an ear, play-bowing.
- It runs the card animations itself. It trots to the deck and paws each hole card out, noses the flop across the felt and paws the cards apart, fetches the turn in its mouth, and slides the river into place with a paw before celebrating. Cards and puppy sample one shared plan at the animation's own progress, so each card moves exactly when it is touched.
- It noses swept bets into the pot, bats folded cards away, glances at bets and whoever is to act, and celebrates wins (hops, spins, paw-print sparkles), scaled to the pot.
- The room has a matching paw-print deck, felt with paw prints and a paw emblem, paw chips and a paw dealer button.

Settings live on the studio's **Companion** page: puppy on or off, coat (Golden, Chocolate, Cream, Midnight, Silver), collar, size (Small / Medium / Large), energy (Calm / Lively / Playful) and whether it joins the action. The global **Reduced motion** setting keeps the puppy resting quietly. The 3D module (`puppy.js`) is downloaded only on a Puppy table, renders at a throttled rate when idle, stops while the tab is hidden, and is removed completely when you switch skins. Visual holds for the puppy (chips and folded cards it is about to touch) are capped at about 0.4 s and never delay the game.

## Shuffle

On the **Effects** page, pick a moment and switch on **Shuffle** (stored as `random`). Each new event or replay chooses from that street’s compatible effects using the effect’s default tuning, limited to your hearted effects when at least one of them suits the street. Choices can repeat. Each street has its own assignment; it saves and exports with your theme. Hearts are a library setting. Global speed and reduced-motion settings still apply.

## Included effects

| Event | Presets |
| --- | --- |
| Initial deal | Dealer Flick, Orbit Deal |
| Flop | Triple Spread, Triple Orbit, Crystal Spread |
| Turn and river, separately assigned | Slam / Impact, Fragment Assembly, Crystallization Reveal |

Motion uses shared continuous trajectories and CSS 3D transforms. Physical construction clips real final card artwork into 20–40 polygons; semantic assembly separates actual ranks, suits, pips, and coherent illustrations. All motion objects are temporary. Reduced motion completes immediately at the canonical card state.

Studio features include street assignments, favourites, parameter controls, replay, pause/resume, slow motion, a whole-hand preview, hold-to-compare, search, 2–10 preview players, card backs/faces, table and board colors, bounded raster uploads, theme create/rename/duplicate/delete/switch, portable import/export, and restore defaults. Live card spacing is deliberately preserved; spacing customization is preview-only until a safe site-specific strategy is verified.

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
