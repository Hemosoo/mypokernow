/**
 * Records a short clip and a poster for every animation preset, played by the
 * real runtime on the replica table, for the studio's preset shelves.
 *
 *   npm run build && python3 -m http.server 8765 &  (serve the repository root)
 *   node scripts/capture-media.mjs [preset-id ...]
 *
 * Needs Playwright with Chromium and ffmpeg (libvpx-vp9, libwebp). Time is
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
/** The moment of each animation that best sums it up, as a fraction of its run. */
const POSTER_AT = { 'deal.dealer-flick': 0.42, 'deal.orbit': 0.45, 'deal.pitch': 0.4, 'deal.storm': 0.45, 'deal.puppy': 0.38,
  'flop.triple-spread': 0.5, 'flop.triple-orbit': 0.5, 'flop.crystal-spread': 0.5, 'flop.cascade': 0.45, 'flop.grand': 0.42, 'flop.puppy': 0.55,
  'reveal.slam': 0.62, 'reveal.fragment-assembly': 0.5, 'reveal.crystallization': 0.5, 'reveal.turnover': 0.55, 'reveal.squeeze': 0.55,
  'reveal.spotlight': 0.55, 'reveal.showdown': 0.5, 'turn.puppy': 0.5, 'river.puppy': 0.55 };

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
  const target = POSTER_AT[preset.id] ?? 0.5;
  let poster = -1, finishedAt = -1;
  for (let frame = 0; frame < total; frame++) {
    await step();
    await page.screenshot({ path: `${dir}/f${String(frame).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92, clip });
    const progress = await page.evaluate(() => globalThis.__progress);
    if (poster < 0 && progress >= target && progress < 1) poster = frame;
    if (finishedAt < 0 && progress >= 1) finishedAt = frame;
  }
  await context.close();
  if (poster < 0) poster = Math.round(total * 0.45);
  const frames = finishedAt > 0 ? Math.min(total, finishedAt + Math.round(0.75 * FPS)) : total;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/f%04d.jpg`, '-frames:v', String(frames),
    '-vf', 'scale=480:270:flags=lanczos,format=yuv420p', '-c:v', 'libvpx-vp9', '-crf', '37', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an',
    `${OUT}/${preset.id}.webm`]);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${dir}/f${String(poster).padStart(4, '0')}.jpg`,
    '-vf', 'scale=480:270:flags=lanczos', '-quality', '78', `${OUT}/${preset.id}.webp`]);
  return { id: preset.id, frames, poster, finishedAt };
}

const results = [];
const queue = [...catalogue];
await Promise.all([0, 1].map(async () => {
  while (queue.length) {
    const preset = queue.shift();
    const result = await capture(preset);
    results.push(result);
    console.log(`${result.id}: ${result.frames} frames, poster ${result.poster}, finished ${result.finishedAt}`);
  }
}));
await browser.close();
await writeFile(`${WORK}/results.json`, JSON.stringify(results, null, 2));
