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

The first time it opens, the studio asks how you would like to start:

- **Just pick a theme** is a single page of ready-made tables. Hover a theme (or press its **Watch** button on a touch screen) and it plays for real: a recording of its flop and river on the table, with its own deck, effects, ambience and companion. Click one to use it, choose Classic's colourway, switch PokerNow on or off, or **Import a theme**. **Customize** (top right) opens the full studio.
- **Customize everything** is the full studio below. **Simple view** in its top bar goes back.

**Import a theme** takes a file someone exported, or theme code pasted from anywhere, including an AI assistant's whole answer (anything around the theme is ignored). **Make one with AI** copies a prompt that lists every field and allowed value; paste it into ChatGPT, Claude, Gemini or any assistant, add what you want ("a deep-sea table with glowing jellyfish colours"), and paste the answer back. The import is forgiving about form (short colours, a missing board, an effect that does not exist falls back to the house one) and strict about content: only colours, fixed choices and known effects, never code, links or images. A refusal names the field that is wrong.

The full studio is laid out like a game's cosmetics screen: a navigation rail on the left, the live table in the middle, and a panel for the page you are on. Drag the panel's edge to resize it (double-click resets), or hide it to give the table the whole width. The top bar shows the theme in use (click it for recent and all themes), search, undo and redo, the save state, and the **PokerNow** switch, which says whether your theme is *Live* on PokerNow, *Off*, or *Preview only* (the localhost studio, which cannot reach PokerNow).

- **Discover** opens with the same hand recorded on a plain table and with the Puppy theme, looping in step behind a divider you can drag, with chapters for the deal, each street and the win. Out of the box the plain side is the replica table in PokerNow's standard look, rebuilt from measurements of a live table (felt, rim, cards in Abril Fatface, grey backs, seat boxes, pot pill, Mulish type) with PokerNow's own menu, buttons and chat around it on both sides, and is labelled *PokerNow · recreated*. `scripts/capture-compare.mjs` re-records it; see *Record the comparison on PokerNow* below to replace it with a real hand. Below it: the themes, featured cinematic effects and the companions. Returning visitors get a *Continue with…* bar instead of the getting-started steps. No live table runs on Discover.
- **Themes** is the gallery. Each card is drawn with the theme's own table, deck, card back and room light. Click a card to preview it on the table without applying it (the table says so; **Esc** goes back), then **Use** it. Built-in themes can be edited and restored to their original look but never deleted; your own themes can be renamed, duplicated, exported or deleted (with confirmation and an Undo). **Surprise me** makes a new theme from a coordinated palette, a deck and a random set of effects.
- **Appearance** has four tabs. *Cards*: eleven decks (Classic, Modern, Midnight, Neon, Sakura, Pixel, Hologram, Cipher, Puppy, Cat and PokerNow's own), shown as fanned A♠ K♥ 7♦, ten card backs or your own image, then colours and advanced settings (corner radius, shadow, made-hand glow). *Table*: coordinated palettes, the mood pad (drag across for colour, down for depth), a surface diagram that lights up the felt, rail or trim you are editing, the trim metal, the felt pattern (plain, paw prints, paws and yarn, lit grid, petals, pixel marquee, wet street, circuit traces; it also marks the chips and dealer button), the emblem and words on the felt. *Room*: room colour, a background image and the ambient particles. *Board*: the highlight colour, plus effect-lab-only spacing and plate settings, labelled as such. Colours you have changed show a reset button.
- **Effects** has a tab for each moment (Deal, Flop, Turn, River) showing what each uses, and a **Win** tab (below). Cards show the effect mid-motion, cropped to where it happens, and play the recording on hover or keyboard focus. Click a card to try it on the table: the table says it is *not equipped* until you press **Equip**. Search, sort, and filter by Cinematic, Minimal, Companion, Favorites or Fast. **Shuffle** for a moment picks a random effect each hand, from your hearted effects when any suit it. A room with a companion lists only that character's own moves.
- **Companion** picks the character: the 3D **puppy**, the 3D **cat**, or none. Each keeps its own coat, so switching back and forth loses nothing, and switching swaps the companion's card moves for the other character's. Then size, energy, collar (the cat's has a bell), and whether it joins the action. **Try a trick** makes it celebrate, nap, bark or meow, tilt its head, scratch or groom, or stretch on the table, and its card duties can be tried or equipped for every street. The stage follows the companion in close-up, rendered at a higher resolution so it stays sharp; click it on the table to say hello.
- **Settings** (bottom of the rail) holds the PokerNow switch and connection check, reduced motion, the animation speed used on PokerNow, a performance mode (High quality, Balanced, Lightweight) with each table effect switchable on its own, how big wins get (Quiet, Balanced, Loud) and whether other players' wins are celebrated, import and export, and a reset that keeps your own themes.

The player under the table plays, pauses, replays and resets, plays any moment or a whole hand, has a scrub bar (drag it and the effect holds on that moment; let go and it carries on), and has a preview speed (1×, ½×, ¼×) that is separate from the speed used on PokerNow and is never saved. **Players** sets 2–10 seats; hold **C** (or *Hold to compare*) to see the table without your theme; the expand button shows the table full screen. Everything on the stage is a simulated hand on the replica table.

Keys: **⌘K** or **/** search, **⌘Z** / **⇧⌘Z** undo and redo, **Space** play or pause, **1–4** play a moment, **[** and **]** try the previous or next effect, **H** a whole hand, **F** heart the effect on the table, **R** replay, **Esc** stop previewing a theme, **?** the full list.

The simple view's theme clips (`public/media/theme-*.webm`) are recorded by `scripts/capture-themes.mjs`: every built-in theme, and Classic in each colourway, playing its flop and river on the replica table. A theme someone changed has no clip, since it would show the wrong look. Effect posters and clips in `public/media/` are recorded from the replica table by `scripts/capture-media.mjs` (Playwright and ffmpeg), which hands the frames to `scripts/frame-media.py` (numpy, Pillow) to crop each one to its own motion and pick its poster. Run it again after changing a preset; each room's own effects are recorded in that room. The comparison clips are `public/media/compare-*.webm`.

### Record the comparison on PokerNow

`scripts/capture-pokernow.mjs` replaces the recreation with a real hand. It opens two ordinary, visible Chrome windows on a game you host or may watch, one plain and one with the built extension showing the theme you name, records both, and when you mark the start and end in the terminal, trims both to the same moment and writes `public/media/compare-real-*` and `compare.json`:

```sh
npm run build
node scripts/capture-pokernow.mjs https://www.pokernow.com/games/<your-game> room-puppy
npm run build
```

If PokerNow asks a window to confirm you are human, answer it yourself; the script never clicks or types on the table. Needs Playwright with Chromium and ffmpeg.

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

Seven built-in themes:

| Theme | Look | Effects |
| --- | --- | --- |
| Classic | Classic felt and cards in five colourways. **Emerald**: green felt, gold inlay, engraved deck. **Obsidian**: charcoal felt, brushed silver, flat modern deck. **Claret**: deep red felt, warm gold, laurel emblem. **Midnight**: midnight-blue felt, rose-gold inlay. **Sakura**: dusk-blue felt with petals, cherry-wood rail set with blossoms, washi-paper deck, falling petals | Each colourway has its own pace: signature, restrained, theatrical, fluid or gentle |
| Neon | Night-city felt with a lit grid, a neon tube around the rail, glowing cards on black, circuit backs, flickering pixels | Digital: Dealer's Storm, Crystal Spread, Fragment Assembly, Crystallization |
| Arcade | Dithered blue pixel felt, a marquee of gold and magenta bulbs, pixel cards in plain red and black, pixel-coin backs, twinkling pixels | Stepped, 12 frames a second: Pixel Deal, Pixel Flop, Pixel Drop |
| Rain District | Wet asphalt felt with sign light pooled in puddles, scuffed chrome rail with hazard marks, holographic glass cards, foil backs with the room's own sigil, rain | Projected: Dealer Flick, Hologram Flop, Hologram Boot |
| Breach | Graphite felt with circuit traces, a data line around the rail, black dot-matrix cards with corner brackets, glyph-block backs, data packets | Encrypted: Packet Deal, Decrypt Flop, Decrypt |
| Puppy | Walnut and forest felt with paw prints, puppy deck, the 3D puppy | The puppy deals and reveals every street |
| Cat Café | Teal felt with cat paws and yarn, warm wood, a strand of yarn round the rail, cat deck, the 3D grey tabby | The cat deals and reveals every street |

Classic's colourways are a row of swatches on its card, in the studio's Themes page and in the simple view; one click dresses Classic in that colourway and puts it in use.

Libraries gain new rooms once, after every theme the owner made; nothing is replaced, a room deleted later stays deleted, and a library already holding 100 themes keeps all of them. Version 7 folds Obsidian, Rouge, Riviera and Sakura (separate rooms until then) into Classic: copies exactly as shipped go, any the owner changed stay as their own themes, and if one was in use, Classic takes over wearing that colourway so the table looks the same. An untouched Cat Café gets the new grey tabby.

## Wins

A win is celebrated in steps that grow with what happened, and your own wins count most:

1. **Small pot:** the chips slide over and the name plate glows softly.
2. **Medium pot:** a sweep of light crosses the felt and the plate shines.
3. **Big pot:** the room dims and a spotlight finds the winner, chips fountain over, and the room's own flourish plays: gold leaf (Classic), a glitch (Neon), a gust of petals (Classic in Sakura), a pixel score counting up (Arcade), a WINNER sign buzzing on (Rain District), an ACCESS GRANTED stamp (Breach), the puppy's victory leap and dance, or the cat's pounce and a purring loaf by the chips.
4. **All-in won:** the cards PokerNow marks as the winning hand light up for a beat before the chips move.
5. **You won:** a banner under the board names your hand the way a dealer says it ("Full house, kings over sevens", "Two pair, aces and eights") and what you won. It reads only your own cards and the board, already face up on your screen.

**Settings → Wins** chooses the size: *Quiet* never goes past the sweep of light, *Balanced* follows the pot, *Loud* lifts every win a step. *Celebrate other players' wins* off keeps theirs to the chips sliding over. The **Win** tab in Effects plays each step on the preview table. Everything stays over the table, never over PokerNow's controls, and is gone within about two and a half seconds.

## Cat

Choose **Cat Café** in the theme switcher, or the cat on the **Companion** page (in any room). The cat is built on the same rig as the puppy and cute in its own way: one smooth, round head that widens at the cheeks, big glossy eyes, a soft loaf of a body, short legs with white mitten paws, a plump tail and a bell on its collar. Its markings (the tabby's bands and forehead "M", a calico's patches) are painted into the fur, so it stays one soft shape:

- **Deal:** it sits up by the deck and flicks each card out to its player.
- **Flop:** it paws the three cards out face down, trots to the end of the row, crouches and bats a ball of yarn along it. Each card flips as the ball rolls over it, and the strand it trails fades.
- **Turn** (*Cat Push*): it pushes the card into place with one paw, slowly, staring at you, then flicks it over.
- **River** (*Pounce*): it slides the card in, backs off, crouches with a wiggle and pounces; the card flips under its paws.
- **Win:** a pounce for a real pot, then it curls up by the winner's chips, eyes half shut, purring.
- It grooms instead of scratching and meows instead of barking. When someone tanks (or on **Nap**) it curls up the way a real cat does: a round bun with its paws tucked in, its head resting down on its cheek, its tail wrapped round its side and its eyes shut as two soft curves. It wakes at the timer warning.

Coats: grey tabby (the default), black, tuxedo, calico and orange tabby; eyes amber, green or blue. A room's own companion only performs its own moves; in a room without one, the puppy or the cat drops in for its moves and leaves.

## Puppy skin

Choose **Puppy** in the theme switcher or under **Themes**, or choose the puppy on the **Companion** page. A procedurally modelled 3D puppy (Three.js, rendered on a transparent, click-through canvas) lives on the table:

- It rests where it covers no cards, chips or name plates, and idles: wagging, blinking, looking around, tilting its head, scratching an ear, play-bowing.
- It runs the card animations itself. It trots to the deck and paws each hole card out, noses the flop across the felt and paws the cards apart, fetches the turn in its mouth, and slides the river into place with a paw before celebrating. Cards and puppy sample one shared plan at the animation's own progress, so each card moves exactly when it is touched.
- It noses swept bets into the pot, bats folded cards away, glances at bets and whoever is to act, and celebrates wins (hops, spins, paw-print sparkles), scaled to the pot.
- The room has a matching paw-print deck, felt with paw prints and a paw emblem, paw chips and a paw dealer button.

Settings live on the studio's **Companion** page: puppy on or off, coat (Golden, Chocolate, Cream, Midnight, Silver), collar, size (Small / Medium / Large), energy (Calm / Lively / Playful) and whether it joins the action. The global **Reduced motion** setting keeps the puppy resting quietly. The 3D module (`puppy.js`, which also holds the cat) is downloaded only on a table with a companion, renders at a throttled rate when idle, stops while the tab is hidden, and is removed completely when you switch skins. Visual holds for the puppy (chips and folded cards it is about to touch) are capped at about 0.4 s and never delay the game.

## Shuffle

On the **Effects** page, pick a moment and switch on **Shuffle** (stored as `random`). Each new event or replay chooses from that street’s compatible effects using the effect’s default tuning, limited to your hearted effects when at least one of them suits the street. Choices can repeat. Each street has its own assignment; it saves and exports with your theme. Hearts are a library setting. Global speed and reduced-motion settings still apply.

## Included effects

| Event | Presets |
| --- | --- |
| Initial deal | Dealer Flick, Orbit Deal, House Pitch, Dealer's Storm, Pixel Deal, Packet Deal, Puppy Deal, Cat Deal |
| Flop | Triple Spread, Triple Orbit, Crystal Spread, Silk Cascade, Grand Flop, Pixel Flop, Hologram Flop, Decrypt Flop, Puppy Flop, Yarn Ball Flop |
| Turn and river, separately assigned | Slam / Impact, Fragment Assembly, Crystallization Reveal, Velvet Turnover, River Squeeze, Spotlight, Showdown, Pixel Drop, Hologram Boot, Decrypt, Puppy Fetch, Puppy Paw, Cat Push, Pounce |

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
