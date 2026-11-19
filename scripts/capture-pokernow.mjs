/**
 * Records the studio's before-and-after comparison on a real PokerNow table.
 *
 * Two browser windows watch the same game at the same time: one plain, one with
 * the extension (and the theme you name). Both are recorded, trimmed to the
 * stretch you choose and saved as the comparison the Discover page shows:
 *
 *   public/media/compare-real-plain.webm / .webp
 *   public/media/compare-real-theme.webm / .webp
 *   public/media/compare.json
 *
 * Run it on a game you host or are allowed to watch:
 *
 *   npm run build
 *   node scripts/capture-pokernow.mjs https://www.pokernow.com/games/<your-game> [room-id]
 *   npm run build      (again, so the recording is packed into dist/)
 *
 * room-id is a built-in theme such as room-puppy (the default), room-cat or room-rain.
 * You stay in charge throughout: both windows are ordinary, visible browser
 * windows. If PokerNow asks either window to confirm you are human, answer it
 * yourself; this script never does that for you. Nothing is clicked or typed on
 * the table. Needs Playwright with Chromium and ffmpeg (libvpx-vp9, libwebp).
 */
import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, room = 'room-puppy'] = process.argv.slice(2);
if (!url || !/^https:\/\/(www\.)?pokernow\.com\/games\/[\w-]+/.test(url)) {
  console.error('Usage: node scripts/capture-pokernow.mjs https://www.pokernow.com/games/<game-id> [room-id]');
  process.exit(1);
}
const DIST = resolve('dist'), WORK = resolve('.capture/pokernow'), OUT = 'public/media';
if (!existsSync(`${DIST}/manifest.json`)) { console.error('Build the extension first: npm run build'); process.exit(1); }
await rm(WORK, { recursive: true, force: true });
await mkdir(`${WORK}/plain`, { recursive: true });
await mkdir(`${WORK}/theme`, { recursive: true });
const ask = createInterface({ input: process.stdin, output: process.stdout });
const size = { width: 1280, height: 720 };

// The themed window: a profile of its own with the built extension loaded.
const themed = await chromium.launchPersistentContext(`${WORK}/profile`, {
  headless: false, viewport: size, recordVideo: { dir: `${WORK}/theme`, size },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const worker = themed.serviceWorkers()[0] ?? await themed.waitForEvent('serviceworker');
// Choose the theme in the extension's own storage, as the studio would.
const chosen = await worker.evaluate(async (id) => {
  const KEY = 'pokernow-customizer.library.v1';
  const library = (await chrome.storage.local.get(KEY))[KEY];
  if (!library) return 'missing';
  const theme = library.themes.find((item) => item.id === id);
  if (!theme) return 'unknown';
  library.settings.activeThemeId = id;
  library.settings.enabled = true;
  await chrome.storage.local.set({ [KEY]: library });
  return theme.name;
}, room);
let themeName = chosen;
if (chosen === 'missing') {
  // First run: open the studio once so the extension writes its library, then try again.
  const extensionId = new URL(worker.url()).host;
  const studio = await themed.newPage();
  await studio.goto(`chrome-extension://${extensionId}/index.html`);
  await studio.waitForTimeout(1500);
  await studio.close();
  themeName = await worker.evaluate(async (id) => {
    const KEY = 'pokernow-customizer.library.v1';
    const library = (await chrome.storage.local.get(KEY))[KEY];
    const theme = library?.themes.find((item) => item.id === id);
    if (!theme) return 'unknown';
    library.settings.activeThemeId = id;
    library.settings.enabled = true;
    await chrome.storage.local.set({ [KEY]: library });
    return theme.name;
  }, room);
}
if (themeName === 'unknown') { console.error(`No theme called ${room}. Try room-puppy, room-cat, room-arcade, room-rain or room-breach.`); await themed.close(); process.exit(1); }

// The plain window: no extension at all.
const browser = await chromium.launch({ headless: false });
const plain = await browser.newContext({ viewport: size, recordVideo: { dir: `${WORK}/plain`, size } });

const themedPage = themed.pages()[0] ?? await themed.newPage();
const plainPage = await plain.newPage();
// Each recording starts when its page is created; remember when, to line the two up.
const begin = { theme: Date.now(), plain: Date.now() };
await Promise.all([themedPage.goto(url), plainPage.goto(url)]);

console.log(`
Two windows are open on ${url}:
  one plain, one with the extension showing "${themeName}".
Watch the game in both (as a spectator is fine). If PokerNow asks a window to
confirm you are human, do that yourself in that window.
`);
await ask.question('When a hand is about to start, press Enter to mark the START of the clip… ');
const start = Date.now();
await ask.question('Press Enter to mark the END of the clip (20–40 seconds works well)… ');
const end = Date.now();
ask.close();

const plainVideo = plainPage.video(), themedVideo = themedPage.video();
await plain.close(); await browser.close(); await themed.close();
const files = { plain: await plainVideo.path(), theme: await themedVideo.path() };

// Trim both to the same wall-clock stretch so the two sides show the same moment.
const seconds = Math.max(4, (end - start) / 1000);
for (const [side, name] of [['plain', 'compare-real-plain'], ['theme', 'compare-real-theme']]) {
  const offset = Math.max(0, (start - begin[side]) / 1000);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', offset.toFixed(2), '-i', files[side], '-t', seconds.toFixed(2), '-r', '30',
    '-vf', 'scale=1280:720:flags=lanczos,format=yuv420p', '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-an', `${OUT}/${name}.webm`], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '1', '-i', `${OUT}/${name}.webm`, '-frames:v', '1', '-quality', '80', `${OUT}/${name}.webp`], { stdio: 'inherit' });
}
await writeFile(`${OUT}/compare.json`, `${JSON.stringify({ source: 'pokernow', theme: themeName, recorded: new Date().toISOString().slice(0, 10), seconds: Number(seconds.toFixed(1)) }, null, 2)}\n`);
console.log(`\nSaved the comparison to ${OUT}/. Run npm run build to pack it into the extension.`);
