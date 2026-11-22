/**
 * Records the studio's before-and-after illustration: one scripted hand on the
 * replica table, once plain (recreating PokerNow's standard look, with the
 * screen around the table) and once with a theme, frame for frame.
 *
 *   npm run build && python3 -m http.server 8765 &  (serve the repository root)
 *   node scripts/capture-compare.mjs [room-id]
 *
 * room-id defaults to room-puppy. Writes public/media/compare-plain.webm / .webp
 * and compare-<room>.webm / .webp, and prints the frame each chapter starts on
 * (COMPARE_CHAPTERS in src/studio/BeforeAfter.tsx). Time runs on Playwright's
 * fake clock and every Web Animation is stepped by hand, so both recordings
 * match frame for frame however slowly the machine renders. Needs Playwright
 * with Chromium and ffmpeg (libvpx-vp9, libwebp).
 */
import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:8765/dist/';
const OUT = 'public/media', WORK = '.capture/compare', FPS = 30, DT = 1000 / FPS;
const room = process.argv[2] ?? 'room-puppy';
const looks = [{ key: 'plain', room: undefined }, { key: room.replace(/^room-/, ''), room }];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function record({ key, room }) {
  const dir = `${WORK}/${key}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    const roots = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) { const root = attach.call(this, { ...init, mode: 'open' }); roots.push(root); return root; };
    globalThis.__stepAnimations = (dt) => {
      for (const animation of [...document.getAnimations(), ...roots.flatMap((root) => root.getAnimations())]) {
        if (animation.playState === 'finished') continue;
        if (animation.playState !== 'paused') animation.pause();
        animation.currentTime = (Number(animation.currentTime) || 0) + dt;
      }
    };
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(`${BASE}preview.html?players=6&chrome=1`);
  await page.clock.pauseAt(Date.now() + 2000);
  await page.clock.runFor(400);
  await page.waitForFunction(() => globalThis.__pncReplica);
  await page.addStyleTag({ content: '.replica-toolbar,.replica-label{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  const step = async () => { await page.clock.runFor(DT); await page.evaluate((dt) => globalThis.__stepAnimations(dt), DT); };
  await page.evaluate((room) => {
    const replica = globalThis.__pncReplica;
    if (room) {
      const select = document.querySelector('select');
      select.value = room;
      select.dispatchEvent(new Event('change'));
    } else replica.configure(replica.theme, { ...replica.settings, enabled: false });
    replica.rest('deal');
  }, room);
  for (let frame = 0; frame < 75; frame++) await step();
  if (room) await page.waitForFunction(() => globalThis.__pncReplica.runtime.companionDebug?.() !== undefined || !globalThis.__pncReplica.theme.companion, null, { timeout: 20000 });
  for (let frame = 0; frame < 30; frame++) await step();

  const marks = {};
  await page.evaluate(() => { globalThis.__handDone = false; void globalThis.__pncReplica.hand().then(() => { globalThis.__handDone = true; }); });
  let total = 0, tail = -1;
  for (let frame = 0; frame < 60 * FPS; frame++) {
    await step();
    await page.screenshot({ path: `${dir}/f${String(frame).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    total = frame + 1;
    const state = await page.evaluate(() => {
      const s = globalThis.__pncReplica.scenario.state;
      return { holes: s.seats.some((seat) => seat.cards), board: s.board.length, winner: s.seats.some((seat) => seat.winner), done: globalThis.__handDone };
    });
    const mark = (name, reached) => { if (reached && marks[name] === undefined) marks[name] = frame; };
    mark('deal', state.holes); mark('flop', state.board >= 3); mark('turn', state.board >= 4); mark('river', state.board >= 5); mark('win', state.winner);
    if (state.done && tail < 0) tail = frame;
    if (tail >= 0 && frame - tail >= FPS) break;
  }
  await context.close();
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/f%05d.jpg`,
    '-vf', 'scale=1024:576:flags=lanczos,format=yuv420p', '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an',
    `${OUT}/compare-${key}.webm`], { stdio: 'inherit' });
  const poster = String((marks.flop ?? 0) + 90).padStart(5, '0');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${dir}/f${poster}.jpg`, '-vf', 'scale=1024:576:flags=lanczos', '-quality', '82', `${OUT}/compare-${key}.webp`], { stdio: 'inherit' });
  return { key, total, marks };
}

await mkdir(OUT, { recursive: true });
const results = await Promise.all(looks.map(record));
await browser.close();
for (const result of results) console.log(`${result.key}: ${result.total} frames, chapters ${JSON.stringify(result.marks)}`);
await writeFile(`${WORK}/marks.json`, JSON.stringify(results, null, 2));
