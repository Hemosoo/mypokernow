/**
 * Records each built-in theme, and each of Classic's colourways, playing on the
 * replica table: the flop, then the river, with the theme's own deck, felt,
 * effects, ambience and companion. The simple view plays these on hover.
 *
 *   npm run build && python3 -m http.server 8765 &  (serve the repository root)
 *   node scripts/capture-themes.mjs [theme-key ...]
 *
 * Keys are theme ids (room-neon) or Classic colourways (room-monte-carlo.claret).
 * Writes public/media/theme-<key>.webm. Time runs on Playwright's fake clock and
 * every Web Animation is stepped by hand, so frames are exact however slowly the
 * machine renders. Needs Playwright with Chromium and ffmpeg (libvpx-vp9).
 */
import { createRequire } from 'node:module';
import { mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:8765/dist/';
const OUT = 'public/media', WORK = '.capture/themes', FPS = 20, DT = 1000 / FPS;

const bundled = await build({ entryPoints: ['src/themes/defaults.ts'], bundle: true, platform: 'neutral', format: 'esm', write: false, logLevel: 'silent' });
const { builtInThemes, CLASSIC_COLOURWAYS, withColourway } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const targets = builtInThemes.flatMap((theme) => theme.id === 'room-monte-carlo'
  ? CLASSIC_COLOURWAYS.map((colourway) => ({ key: `${theme.id}.${colourway.id}`, theme: withColourway(theme, colourway) }))
  : [{ key: theme.id, theme }]);
const wanted = process.argv.slice(2);
const queue = targets.filter((target) => !wanted.length || wanted.includes(target.key));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function capture({ key, theme }) {
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
  await page.goto(`${BASE}preview.html?players=6`);
  await page.clock.pauseAt(Date.now() + 2000);
  await page.clock.runFor(400);
  await page.waitForFunction(() => globalThis.__pncReplica);
  await page.addStyleTag({ content: '.replica-toolbar,.replica-label{display:none!important}' });
  const step = async () => { await page.clock.runFor(DT); await page.evaluate((dt) => globalThis.__stepAnimations(dt), DT); };
  await page.evaluate((theme) => { const replica = globalThis.__pncReplica; replica.configure(theme, { ...replica.settings, enabled: true }); replica.rest('flop'); }, theme);
  for (let frame = 0; frame < 50; frame++) await step();
  if (theme.companion) await page.waitForFunction(() => globalThis.__pncReplica.runtime.companionDebug?.(), null, { timeout: 20000 });
  for (let frame = 0; frame < 10; frame++) await step();

  const clip = { x: 90, y: 6, width: 1100, height: 619 };
  let frame = 0;
  const shoot = async () => { await step(); await page.screenshot({ path: `${dir}/f${String(frame++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, clip }); };
  for (const street of ['flop', 'river']) {
    await page.evaluate((street) => {
      globalThis.__progress = 0;
      globalThis.__pncReplica.onAnimation((handle) => {
        const read = () => { globalThis.__progress = handle.progress; if (handle.progress < 1) requestAnimationFrame(read); };
        read();
        handle.finished.then(() => { globalThis.__progress = 1; });
      });
      void globalThis.__pncReplica.play(street);
    }, street);
    // Until the street's effect has finished, then a beat to see it at rest; never longer than 7 s.
    let done = -1;
    for (let i = 0; i < 7 * FPS; i++) {
      await shoot();
      if (done < 0 && await page.evaluate(() => globalThis.__progress) >= 1) done = i;
      if (done >= 0 && i - done > FPS * 0.6) break;
    }
  }
  await context.close();
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/f%04d.jpg`,
    '-vf', 'scale=640:360:flags=lanczos,format=yuv420p', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an',
    `${OUT}/theme-${key}.webm`], { stdio: 'inherit' });
  return { key, frames: frame };
}

await Promise.all([0, 1].map(async () => {
  while (queue.length) {
    const target = queue.shift();
    const result = await capture(target);
    console.log(`${result.key}: ${result.frames} frames`);
  }
}));
await browser.close();
