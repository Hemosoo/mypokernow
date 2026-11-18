/**
 * Records every animation preset, played by the real runtime on the replica
 * table, then hands the frames to frame-media.py, which crops each clip and
 * poster to the effect's own motion for the studio's effect cards.
 *
 *   npm run build && python3 -m http.server 8765 &  (serve the repository root)
 *   node scripts/capture-media.mjs [preset-id ...]
 *
 * Needs Playwright with Chromium, Python with numpy and Pillow, and ffmpeg
 * (libvpx-vp9, libwebp). Time is
 * driven by Playwright's fake clock and every Web Animation is stepped by hand,
 * so each frame is exact however slowly the machine renders it.
 */
import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:8765/dist/';
const OUT = 'public/media';
const WORK = '.capture';
const FPS = 30;
const DT = 1000 / FPS;
// The preset catalogue, read from the source rather than copied here.
const bundled = await build({ entryPoints: ['src/animation/registry/index.ts'], bundle: true, platform: 'neutral', format: 'esm', write: false, logLevel: 'silent' });
const registry = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const wanted = process.argv.slice(2);
const catalogue = registry.presets.filter((preset) => !wanted.length || wanted.includes(preset.id))
  .map((preset) => ({ id: preset.id, duration: preset.duration, street: preset.supportedEvents[0], companion: Boolean(preset.companion) }));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function capture(preset) {
  const dir = `${WORK}/${preset.id}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    const roots = [];
    const attach = Element.prototype.attachShadow;
    // Open the overlay's shadow root so its animations can be stepped too.
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
  await page.evaluate(({ id, street, room }) => {
    const select = document.querySelector('select');
    select.value = room;
    select.dispatchEvent(new Event('change'));
    const replica = globalThis.__pncReplica;
    const theme = structuredClone(replica.theme);
    theme.animations[street] = { preset: id, parameters: {} };
    replica.configure(theme, replica.settings);
    replica.rest(street);
  }, { id: preset.id, street: preset.street, room: preset.companion ? 'room-puppy' : 'room-monte-carlo' });
  // Let fonts, artwork and (for the puppy) the 3D model settle at rest.
  for (let frame = 0; frame < 75; frame++) await step();
  if (preset.companion) await page.waitForFunction(() => globalThis.__pncReplica.runtime.companionDebug?.(), null, { timeout: 20000 });
  for (let frame = 0; frame < 15; frame++) await step();

  await page.evaluate((street) => {
    globalThis.__progress = 0;
    globalThis.__pncReplica.onAnimation((handle) => {
      const read = () => { globalThis.__progress = handle.progress; if (handle.progress < 1) requestAnimationFrame(read); };
      read();
      handle.finished.then(() => { globalThis.__progress = 1; });
    });
    void globalThis.__pncReplica.play(street);
  }, preset.street);

  const deal = preset.street === 'deal';
  const clip = deal ? { x: 90, y: 6, width: 1100, height: 619 } : { x: 240, y: 52, width: 800, height: 450 };
  const total = Math.round((0.35 + (preset.duration / 1000) * (preset.companion ? 1.3 : 1.1) + 0.75) * FPS);
  let finishedAt = -1;
  for (let frame = 0; frame < total; frame++) {
    await step();
    await page.screenshot({ path: `${dir}/f${String(frame).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92, clip });
    const progress = await page.evaluate(() => globalThis.__progress);
    if (finishedAt < 0 && progress >= 1) finishedAt = frame;
  }
  await context.close();
  const frames = finishedAt > 0 ? Math.min(total, finishedAt + Math.round(0.75 * FPS)) : total;
  return { id: preset.id, frames, finishedAt };
}

const results = [];
const queue = [...catalogue];
await Promise.all([0, 1].map(async () => {
  while (queue.length) {
    const preset = queue.shift();
    const result = await capture(preset);
    results.push(result);
    console.log(`${result.id}: ${result.frames} frames, finished ${result.finishedAt}`);
  }
}));
await browser.close();
await writeFile(`${WORK}/results.json`, JSON.stringify(results, null, 2));
// Crop each recording to its own motion and choose its poster.
execFileSync('python3', ['scripts/frame-media.py', ...results.map((result) => result.id)], { stdio: 'inherit' });
