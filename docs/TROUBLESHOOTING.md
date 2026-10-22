# Customization does not appear

Version 0.1.1 fixes confirmed application failures; it does not certify current live PokerNow markup.

## Reload the updated extension

1. Open `chrome://extensions`, locate PokerNow Customizer, and click its reload icon. Confirm version **0.1.1**.
2. Refresh the PokerNow game tab and the studio tab. Content scripts already running before an extension reload must be refreshed.
3. Open the studio from the **extension toolbar icon**. Its header should say **Extension studio**.
4. Enable customization, change the felt color, and wait for **All changes saved**. Table appearance no longer requires a complete hand or a recognized flop.
5. Open **Settings → Check PokerNow connection**.

The `npm run dev` page is a browser preview. Its header says **Browser preview · changes stay here**. It does not write the installed extension's configuration. Export/import a theme to transfer a look between those separate browser origins.

## Read the connection result

| Result | Meaning / next action |
| --- | --- |
| No content script responded | Refresh the game after installing/reloading. Confirm this is a PokerNow game URL and Chrome allows the extension on that site. |
| Disabled | Enable customization in the extension studio. |
| No supported table element | The content script runs, but the page markup needs an adapter update. Report the displayed status and structural counts. |
| Table appearance active, board/cards unsupported | Colors can apply independently. Animations are skipped until recognizable visible card geometry and identities are available. Report the displayed status/counts. |
| Connected | A supported visual snapshot is readable. New card events are monitored; cards already present on attachment intentionally do not replay. |
| Uploaded image could not load | Colors and other effects continue with a built-in back. Re-upload the image in the extension studio. |
| Saved settings could not be loaded | Use the explicit Restore local defaults recovery action in the studio. Invalid saved data is not overwritten automatically. |

Diagnostics contain status and counts of rendered table/seat/board/card nodes. They omit card identities, player names, game IDs and game URLs. They are shown only in the studio; there is no in-game settings overlay.

## Confirmed fixes in 0.1.1

- The old content runtime applied every theme only after obtaining a complete supported poker snapshot. Missing board markup, an empty table, partial cards, or unreadable identity silently prevented even felt colors. Static appearance now has an independent observation path.
- A failed uploaded image previously prevented adapter startup. It now falls back locally and reports the missing asset while other customization continues.
- Native styles can include `!important`; appearance overrides now use reversible property leases with matching priority.
- Nested table aliases, card containers and inner faces are deduplicated. Empty seat placeholders no longer count as participating players. Unknown visible faces are preserved rather than replaced with guessed backs.
- Studio preset previews no longer race a fixed 80 ms timer against asset loading.
- Responsive preview CSS no longer silently overrides the board-spacing control.

These fixes are covered by local regression tests, including the actual content-script entry applying, updating and restoring a theme with incomplete table markup and a missing uploaded asset. Browser paint and the user's actual live page still require verification; see `COMPATIBILITY_REPORT.md`.
