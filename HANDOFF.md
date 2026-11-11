# Codex continuation — 2026-11-11

Original Claude handoff is preserved below. Work continues on `claude/gifted-galileo-kxrvbv`; main has not been merged or modified.

Completed implementation:
- Semantic layers use renderer `data-part` markers, preserve paint servers and normalized centers; physical shard ordering uses normalized regions. All three construction presets share corrected artwork.
- Added House Pitch, Silk Cascade, Velvet Turnover and River Squeeze; new rooms use these assignments. Existing saved themes retain their presets.
- Added standalone `preview.html` room rehearsal with authored structural CSS and shared Runtime. It deliberately keeps site class names isolated from the studio. Full-hand scenario token cancellation bug fixed.
- Studio exposes trim, inscription, emblem and four independent effect controls; preview uses theme metal accents.
- Stage chip landing/collection timing, pot-label clearance, cancellation and disposal improved. Motion disable cancels active sprite animations. Community identities wait for the site flip.
- Font metadata verified: Inter 4.001/git-66647c0bb; Playfair Display 1.203 normal/italic. Copyright, SHA-256 and OFL notices are in THIRD_PARTY_NOTICES.md and copied into dist.
- Updated outdated design assertions and added chip/state/migration/hidden-board tests. Browser fixtures use loopback HTTP because managed Chrome blocks file URLs. Corrected two broken selector-string escapes in the browser runner.

Visual iteration: retained Claude’s materials; added the room rehearsal, restrained house choreography, then corrected fixture scaling/clipped seats and pot-chip overlap after screenshot inspection. Stage sprites remain bounded and use transform/opacity; no FPS guarantee is claimed.

Validation is being finalized; see docs/VERIFICATION.md for the final results. Live PokerNow games, mobile layouts and real gameplay remain manual verification requirements. No claim of live certification. `src/content/presentation.ts` remains an offline fixture helper exercised by existing restoration tests; production uses Skin instead.

---

# Handoff: PokerNow Customizer visual overhaul

Branch `claude/gifted-galileo-kxrvbv`, one work-in-progress commit on top of `c1f49c9`. No pull request is open; the owner has not asked for one.

## The brief

Turn a functional but plain PokerNow reskin (a Chrome MV3 extension) into a premium poker experience: luxury table, crafted cards and chips, choreographed animation, and tasteful invented details. Hard limits from the owner:

- Never change game logic or outcomes, and never hide gameplay information or get in the way of PokerNow's controls.
- Keep existing capabilities, keep it performant, keep it a working extension.
- Be subtle for small moments (a fold) and dramatic only for big ones (a huge pot).

## Current state

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | passes |
| `npm run build` | passes, `dist/` loads as an unpacked extension |
| `npm test` | 38 pass, 10 fail (tests still target the old design, see below) |
| Live PokerNow game | never tried |
| Local replica with PokerNow's real stylesheet | static skin reviewed in all four rooms; motion barely reviewed |

Use `npm install`. `npm ci` failed on the original lockfile; `npm install` rewrote it and that is committed, but `npm ci` has not been re-run.

## What changed and where

The most important finding: PokerNow's site is reachable, and its shipped CSS and JS show the real table markup. The old adapter was written against guessed selectors and treated `.flipped` as face-down, so it could never read a live card. Everything below is built on the real markup.

| Area | Files | Status |
| --- | --- | --- |
| Adapter for real markup | `src/adapter/pokernow/selectors.ts`, `snapshot.ts`, `diff.ts`, `index.ts` | written; old tests not updated |
| Seats, bets, pot reader | `src/adapter/pokernow/table-state.ts` | written, untested |
| Skin (one stylesheet under `html[data-pnc-skin]`, no DOM changes) | `src/skin/css.ts`, `index.ts`, `table-art.ts` | reviewed visually, looks right |
| Card and chip artwork | `src/rendering/cards.ts`, `chips.ts`, `color.ts`, `glyphs.ts` | reviewed visually |
| Stage (chip movement, all-in, tiered wins, fold muck, motes) | `src/stage/stage.ts`, `actions.ts` | written; one scripted hand ran with no console errors, frames mostly not looked at |
| Shared runtime | `src/runtime/index.ts`, `src/content/index.ts` | written; content script now thin |
| Theme schema v2, four rooms, v1 migration | `src/types/index.ts`, `src/themes/defaults.ts`, `schema.ts` | written; schema tests not updated |
| Replica table and scripted hand | `src/replica/markup.ts`, `scenario.ts` | works with PokerNow's real CSS only |
| Studio | `src/studio/*`, `src/preview/PreviewTable.tsx` | untouched, still the old preview |

## PokerNow markup, in brief

- `html` carries `.landscape` or `.portrait`. The whole table is sized in `rem`; the site sets the root font size to `0.032 × min(canvasHeight, 1.8 × canvasWidth)`.
- `.table` is 55.55rem × 26.25rem with a bitmap background (1889 × 892). `table-art.ts` draws a replacement in the same coordinates, so seats and cards line up.
- Seats: `.table-player.table-player-N` (N is 1–10), with state classes `decision-current`, `winner`, `fold`, `you-player`, `offline`. Open seats add `.table-player-seat`.
- Inside a seat: `.table-player-infos-ctn` (name plate), `.table-player-name`, `.table-player-stack` (text is "All In" when the stack is committed), `.table-player-bet-value` (`.check` for a check), `.time-to-talk` (clock; gains `.red` when urgent), `.table-player-cards` (`.hide-cards` when a folded opponent's hand fades out).
- Cards: `.card-container.card-{s|h|d|c}.card-s-{rank}` holding `.front` (which is the printed **back**) and `.card` (the face, with `.value` and `.suit` text). `.flipped` means **face up**. Face-down hole cards carry no rank or suit at all.
- Board: `.table-cards.run-1`. The site adds flop cards face down with their values already present, then flips them 150 ms apart. A second board (`.run-2`) means run-it-twice.
- Pot: `.table-pot-size .main-value`. Dealer button: `.dealer-button-ctn.dealer-position-N .button`. Decision bar: `.game-decisions-ctn .action-buttons .action-button`.
- Amounts are wrapped as `.chips-value > .normal-value`; in big-blind display mode a `.bb-value` is shown instead and `.normal-value` is hidden.

## Remaining work, in the order I would do it

1. **Review the stage in motion.** Play `Scenario.playHand()` and look at bet pushes, the sweep into the pot, the all-in beat, the win tiers, and the fold muck. Timing and placement are first guesses.
2. **Check the card hand-off.** New cards are held invisible for 200 ms by a CSS animation (`pnc-hold` in `css.ts`) so the engine can take over without a flash. It releases by itself if the engine does nothing. Confirm there is no flash or double reveal on deal and flop.
3. **Fix the fragment presets.** `src/animation/fragments/semantic.ts` parses the old card SVG structure and `construction.ts` still scales regions by 100 × 140. The new card SVG marks parts with `data-part` and `cardSemanticRegions` now returns 0–1 fractions. Fragment Assembly, Crystallization and Crystal Spread are probably degraded until this is updated.
4. **Add the signature presets.** Planned ids: `deal.pitch`, `flop.cascade`, `reveal.turnover`, `reveal.squeeze`. `signatureAnimations()` in `defaults.ts` points at existing presets for now so themes validate; switch it once the presets are registered.
5. **Update the tests.** The ten failures, with my untested guess at each cause:
   - Tests 9–12 exercise the removed `legacy-candidate` profile and the old inline-style presenter.
   - Test 28 expects inline styles on `.table`; the skin is now a stylesheet.
   - Test 38 expects the old card SVG layering (same root cause as item 3).
   - Tests 42 and 43 expect theme version 1.
   - Test 46 expects the old card SVG.
   - Test 40 (studio mount) is not diagnosed.
   - `src/content/presentation.ts` is dead code kept only so those tests compile; delete it with them.
   - Add tests for `diffTable`, `parseChips`, the v1 migration, and the `pokernow` profile using `renderReplica`.
6. **Rebuild the studio preview.** Plan: a second Vite page (`preview.html`) loaded in an iframe that renders the replica and runs the same `Runtime` with `allowAnyLocation: true`, controlled by `postMessage`. That gives real `rem` scaling and keeps PokerNow's generic class names (`.table`, `.card`, `.button`) away from the studio's CSS. This needs a self-authored structural stylesheet for the replica, since PokerNow's CSS must not be committed. Then expose the new fields: `table.trimColor`, `table.inscription`, `table.emblem`, and `settings.effects`.
7. **Housekeeping.**
   - Add `THIRD_PARTY_NOTICES.md` with the SIL Open Font License for Inter and Playfair Display. `public/fonts/` ships both and `glyphs.ts` already refers to the file, which does not exist yet.
   - `package.json` still says 0.1.1; the manifest and content script say 0.2.0.
   - Consider `run_at: document_start` so the skin applies before first paint.
   - `README.md` and `docs/` describe the old design.
8. **Live check.** Load `dist/` and play a real hand. Nothing here has been verified against a running game.

## How to preview without a live game

The harness I used lived in a temporary directory and is gone. To recreate it:

1. Fetch `https://www.pokernow.com/start-game`; it links the current `game-<hash>.css`. Download that file and the `Suits` and `Utils` fonts it references. Keep them out of the repo.
2. Write an HTML page that links that stylesheet and has `<div id="main-container">`.
3. Bundle an entry with esbuild that does roughly this, then screenshot it with Playwright at 1600 × 900:

```ts
const scenario = new Scenario(document.getElementById('main-container')!, 6);
scenario.render();
const runtime = new Runtime({ document, fontBase: './fonts', allowAnyLocation: true });
runtime.configure(builtInThemes[0], createDefaultLibrary().settings);
void scenario.playHand();
```

Game pages return 403 to plain HTTP clients behind a bot check. Do not try to get around it; live testing is a manual step for the owner.

## Decisions worth keeping

- **CSS-only skin.** PokerNow's nodes are measured, never moved or wrapped. The one exception is the existing visibility lease the animation coordinator places on a card while it animates.
- **Resting chips are pseudo-elements** on PokerNow's own bet and pot labels, fed by a small live stylesheet (`Skin.setLiveRules`). Only chips in motion are overlay elements. `CHIP_REM` in `stage.ts` must match the sizes written into those rules.
- **Card identity rule.** Hole cards are read only when `.flipped`. Board cards are read as soon as the site inserts them, since it is already revealing them.
- **`.table.red` is left unskinned** on purpose; it is a state signal from the site whose meaning I did not confirm.
- **Run-it-twice and Omaha** get the skin but no card animations (the snapshot fails open).
- **v1 libraries migrate in place.** The four rooms are added in front, and the active theme switches to Monte Carlo only if the previous choice was an untouched built-in.
