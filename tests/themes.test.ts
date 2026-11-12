import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultLibrary, createDefaultTheme } from '../src/themes/defaults';
import { migrateTheme, validateLibrary, validateTheme } from '../src/themes/schema';
import { exportTheme, importTheme } from '../src/themes/transfer';
import { validateImageDataUrl, validateRasterDimensions } from '../src/storage/assets';
import { cardSvg, cardDataUrl, cardSemanticRegions } from '../src/rendering/cards';
import type { Rank, Suit } from '../src/types';

test('defaults validate and orphaned selection recovers without deleting themes',()=>{
 const library=createDefaultLibrary();assert.deepEqual(validateLibrary(library),library);
 library.settings.activeThemeId='missing';assert.equal(validateLibrary(library).settings.activeThemeId,library.themes[0].id);
 library.themes.push(library.themes[0]);assert.throws(()=>validateLibrary(library),/Duplicate/);
});
test('inert theme schema rejects code, remote URLs, nonfinite values, future versions',()=>{
 const theme=createDefaultTheme();
 for(const patch of [{version:99},{script:'alert(1)'},{animations:{...theme.animations,deal:{preset:'reveal.slam',parameters:{}}}},{animations:{...theme.animations,turn:{preset:'reveal.slam',parameters:{force:999}}}},{card:{...theme.card,backImage:'https://remote.test/a.png'}},{card:{...theme.card,shadow:Infinity}},{name:' '},{animations:{...theme.animations,flop:{preset:'flop.triple-spread',parameters:{bad:NaN}}}}]) assert.throws(()=>validateTheme({...theme,...patch}));
 assert.equal(validateTheme({...theme,name:'  Saved  '}).name,'Saved');
});
test('recognized version migration preserves appearance and rejects unknown fields',()=>{
 const theme=createDefaultTheme();const old={...theme,version:0,createdAt:undefined,updatedAt:undefined};
 assert.equal(validateTheme(old).version,2);assert.equal(validateTheme(old).table.feltColor,theme.table.feltColor);
 assert.deepEqual(migrateTheme(theme),theme);
});
test('portable JSON round-trip regenerates ID, preserves assignments and rejects malformed envelopes',async()=>{
 const theme=createDefaultTheme(),json=await exportTheme(theme), imported=await importTheme(json);
 assert.notEqual(imported.id,theme.id);assert.deepEqual(imported.animations,theme.animations);assert.deepEqual(imported.card,theme.card);
 await assert.rejects(importTheme('{"format":"unknown"}'));
 await assert.rejects(importTheme(JSON.stringify({...JSON.parse(json),script:'javascript'})));
 await assert.rejects(importTheme(JSON.stringify({...JSON.parse(json),assets:{'asset:unused':'data:image/png;base64,AA=='}})));
 await assert.rejects(importTheme('x'.repeat(6*1024*1024+1)),/exceeds/);
});
test('asset envelope rejects disguised executable data and invalid content signatures',()=>{
 for(const value of ['data:image/svg+xml;base64,PHN2Zz4=','https://example.com/x.png','data:image/png;base64,PHNjcmlwdD4=','data:image/jpeg;base64,aGVsbG8='])assert.throws(()=>validateImageDataUrl(value));
 validateImageDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZ0AAAAASUVORK5CYII=');
});
test('all 52 visible identities render self-contained correct SVG, backs never include ranks',()=>{
 const appearance=createDefaultTheme().card;
 for(const suit of ['hearts','diamonds','clubs','spades'] as Suit[])for(const rank of ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as Rank[]) {
  const svg=cardSvg({rank,suit},appearance);assert.ok(svg.includes('viewBox="0 0 90 110"'));assert.ok(svg.includes('data-part="rank"'));assert.ok(svg.includes('<path'));assert.ok(!svg.includes('<script'));assert.ok(cardDataUrl({rank,suit},appearance).startsWith('data:image/svg+xml;'));
  const regions=cardSemanticRegions({rank,suit});assert.ok(regions.some(r=>r.kind==='rank'));assert.ok(regions.some(r=>r.kind==='suit'));
  assert.ok(regions.every(r=>r.x>=0&&r.y>=0&&r.x+r.width<=1&&r.y+r.height<=1));
 }
 const back=cardSvg(undefined,appearance);assert.ok(!back.includes('<text'));assert.ok(back.includes('pattern'));
});
test('renderer refuses unsanitized color and uploaded URLs even if called outside schema',()=>{
 const a={...createDefaultTheme().card,back:'image' as const,backImage:'javascript:alert(1)',backColor:'red" onload="alert(1)'};
 const svg=cardSvg(undefined,a);assert.ok(!svg.includes('javascript:'));assert.ok(!svg.includes('onload'));
});

test('compressed raster headers are bounded before decode, preventing huge image allocation',()=>{
 const png=new Uint8Array(24);const pngData=new DataView(png.buffer);pngData.setUint32(16,100000);pngData.setUint32(20,100000);
 assert.throws(()=>validateRasterDimensions(png,'image/png'),/dimensions/);
 const jpeg=Uint8Array.from([255,216,255,192,0,17,8,255,255,255,255,1,1,0,0,0,0,0,0,0,0]);
 assert.throws(()=>validateRasterDimensions(jpeg,'image/jpeg'),/dimensions/);
 const webp=new Uint8Array(30);webp.set([86,80,56,88],12);webp[24]=255;webp[25]=255;webp[26]=255;
 assert.throws(()=>validateRasterDimensions(webp,'image/webp'),/dimensions/);
 pngData.setUint32(16,1024);pngData.setUint32(20,1024);validateRasterDimensions(png,'image/png');
});

test('random assignments round-trip on all streets and reject effect-specific tuning',async()=>{
 const theme=createDefaultTheme();
 const {resolvePreset}=await import('../src/animation/registry');
 for(const street of ['deal','flop','turn','river'] as const){
  theme.animations[street]={preset:'random',parameters:{}};
  for(const sample of [0,.25,.5,.999999])assert.ok(resolvePreset('random',street,()=>sample)!.supportedEvents.includes(street));
 }
 assert.deepEqual(validateTheme(theme).animations,theme.animations);
 assert.deepEqual((await importTheme(await exportTheme(theme))).animations,theme.animations);
 assert.throws(()=>validateTheme({...theme,animations:{...theme.animations,turn:{preset:'random',parameters:{force:1}}}}));
});

test('version 3 moves untuned house presets to the showpieces once and keeps deliberate choices', async () => {
 const { validateLibrary } = await import('../src/themes/schema');
 const { createDefaultLibrary } = await import('../src/themes/defaults');
 const { getPreset } = await import('../src/animation/registry');
 const v2 = structuredClone(createDefaultLibrary()) as unknown as { version: number; themes: { animations: Record<string, { preset: string; parameters: Record<string, number> }> }[] };
 v2.version = 2;
 const pitchDefaults = Object.fromEntries(getPreset('deal.pitch')!.parameters.map((p) => [p.key, p.default]));
 v2.themes[0]!.animations = { deal: { preset: 'deal.pitch', parameters: pitchDefaults }, flop: { preset: 'flop.cascade', parameters: {} },
   turn: { preset: 'reveal.turnover', parameters: { duration: 1200 } }, river: { preset: 'reveal.slam', parameters: {} } };
 const upgraded = validateLibrary(v2);
 assert.equal(upgraded.version, 4);
 assert.equal(upgraded.themes[0]!.animations.deal.preset, 'deal.storm');
 assert.equal(upgraded.themes[0]!.animations.flop.preset, 'flop.grand');
 assert.equal(upgraded.themes[0]!.animations.turn.preset, 'reveal.turnover', 'tuned choices are kept');
 assert.equal(upgraded.themes[0]!.animations.river.preset, 'reveal.slam', 'other presets are kept');
 // A house preset chosen after the upgrade stays chosen.
 const later = structuredClone(upgraded); later.themes[0]!.animations.deal = { preset: 'deal.pitch', parameters: {} };
 assert.equal(validateLibrary(later).themes[0]!.animations.deal.preset, 'deal.pitch');
});
