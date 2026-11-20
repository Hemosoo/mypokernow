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
 assert.equal(upgraded.version, 7);
 assert.equal(upgraded.themes[0]!.animations.deal.preset, 'deal.storm');
 assert.equal(upgraded.themes[0]!.animations.flop.preset, 'flop.grand');
 assert.equal(upgraded.themes[0]!.animations.turn.preset, 'reveal.turnover', 'tuned choices are kept');
 assert.equal(upgraded.themes[0]!.animations.river.preset, 'reveal.slam', 'other presets are kept');
 // A house preset chosen after the upgrade stays chosen.
 const later = structuredClone(upgraded); later.themes[0]!.animations.deal = { preset: 'deal.pitch', parameters: {} };
 assert.equal(validateLibrary(later).themes[0]!.animations.deal.preset, 'deal.pitch');
});

test('library v5 adds Neon once (Sakura is now a Classic colourway), keeps every saved theme and choice, and reads older companions', () => {
 const v4 = structuredClone(createDefaultLibrary()) as unknown as { version: number; settings: Record<string, unknown>; themes: Record<string, unknown>[] };
 v4.version = 4;
 delete v4.settings.recent;
 v4.themes = v4.themes.filter((theme) => theme.id !== 'room-neon' && theme.id !== 'room-sakura');
 const own: Record<string, unknown> = { ...structuredClone(v4.themes[0]!), id: 'mine-1', name: 'Friday club' };
 // A puppy saved before coats existed.
 own.companion = { kind: 'puppy', animations: true, intensity: 'playful', scale: 'large' };
 v4.themes.push(own);
 v4.settings.activeThemeId = 'mine-1';
 const upgraded = validateLibrary(v4);
 assert.equal(upgraded.version, 7);
 assert.deepEqual(upgraded.settings.recent, [], 'Older libraries gain an empty recent list');
 assert.equal(upgraded.settings.activeThemeId, 'mine-1', 'The owner keeps their theme');
 assert.equal(upgraded.themes.filter((theme) => theme.id === 'room-neon').length, 1);
 assert.equal(upgraded.themes.filter((theme) => theme.id === 'room-sakura').length, 0, 'Sakura arrives as a Classic colourway, not a room');
 const kept = upgraded.themes.find((theme) => theme.id === 'mine-1')!;
 assert.equal(kept.name, 'Friday club');
 assert.deepEqual(kept.companion, { kind: 'puppy', animations: true, intensity: 'playful', scale: 'large' }, 'Nothing is added to a saved companion');
 // Deleting a new room later is final: a v5 library is not re-migrated.
 const deleted = structuredClone(upgraded); deleted.themes = deleted.themes.filter((theme) => theme.id !== 'room-neon');
 assert.equal(validateLibrary(deleted).themes.some((theme) => theme.id === 'room-neon'), false);
 // The new decks, backs, felt patterns and emblems all validate and render.
 for (const id of ['room-neon']) {
  const theme = upgraded.themes.find((item) => item.id === id)!;
  assert.deepEqual(validateTheme(theme), theme);
  assert.ok(cardSvg({ rank: 'K', suit: 'hearts' }, theme.card).includes('data-part="rank"'));
  assert.ok(cardSvg(undefined, theme.card).includes('pattern'));
 }
 assert.throws(() => validateTheme({ ...createDefaultTheme(), companion: { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium', coat: 'tartan' } }));
});

test('library v6 adds Arcade, Rain District, Breach and Cat Café once, keeps every saved theme and choice, and adds the win settings', () => {
 const v5 = structuredClone(createDefaultLibrary()) as unknown as { version: number; settings: { effects: Record<string, unknown>; activeThemeId: string }; themes: Record<string, unknown>[] };
 v5.version = 5;
 const added = ['room-arcade', 'room-rain', 'room-breach', 'room-cat'];
 v5.themes = v5.themes.filter((theme) => !added.includes(String(theme.id)));
 // Effects saved before the win settings existed, with the owner's own choices.
 v5.settings.effects = { chips: true, celebrations: false, moments: true, ambience: false };
 const own: Record<string, unknown> = { ...structuredClone(v5.themes[0]!), id: 'mine-2', name: 'Home game' };
 own.companion = { kind: 'puppy', animations: true, intensity: 'subtle', scale: 'small', coat: 'silver', collar: 'violet' };
 v5.themes.push(own);
 v5.settings.activeThemeId = 'mine-2';
 const upgraded = validateLibrary(v5);
 assert.equal(upgraded.version, 7);
 assert.equal(upgraded.settings.activeThemeId, 'mine-2', 'The owner keeps their theme');
 assert.deepEqual(upgraded.settings.effects, { chips: true, celebrations: false, moments: true, ambience: false, winSize: 'balanced', othersWins: true }, 'Earlier choices stay; the new settings take their defaults');
 for (const id of added) assert.equal(upgraded.themes.filter((theme) => theme.id === id).length, 1, `${id} added once`);
 assert.deepEqual(upgraded.themes.find((theme) => theme.id === 'mine-2')!.companion, own.companion, 'A saved companion is untouched');
 // Deleting a new room later is final.
 const deleted = structuredClone(upgraded); deleted.themes = deleted.themes.filter((theme) => theme.id !== 'room-rain');
 assert.equal(validateLibrary(deleted).themes.some((theme) => theme.id === 'room-rain'), false);
 // Each new room's deck, back, felt and emblem validate and draw.
 for (const id of added) {
  const theme = upgraded.themes.find((item) => item.id === id)!;
  assert.deepEqual(validateTheme(theme), theme);
  for (const rank of ['A', '10', 'K'] as Rank[]) assert.ok(cardSvg({ rank, suit: 'hearts' }, theme.card).includes('data-part="rank"'), `${id} ${rank}`);
  assert.ok(cardSvg(undefined, theme.card).includes('data-part="art"'));
 }
 // A library too full for the new rooms keeps every one of the owner's themes.
 const full = structuredClone(v5);
 full.themes = Array.from({ length: 100 }, (_, index) => ({ ...structuredClone(v5.themes[0]!), id: `owned-${index}`, name: `Owned ${index}` }));
 full.settings.activeThemeId = 'owned-0';
 const kept = validateLibrary(full);
 assert.equal(kept.themes.filter((theme) => String(theme.id).startsWith('owned-')).length, 100);
});

test('library v7 folds Obsidian, Rouge, Riviera and Sakura into Classic, keeping any the owner changed and the look in use', async () => {
 const { CLASSIC_COLOURWAYS, BUILT_IN_TIMESTAMP, builtInTheme, colourwayOf } = await import('../src/themes/defaults');
 const shipped = (id: string, name: string, colourway: string) => ({ ...structuredClone(builtInTheme('room-monte-carlo')!), ...structuredClone(CLASSIC_COLOURWAYS.find((c) => c.id === colourway)!.look), id, name });
 const v6 = structuredClone(createDefaultLibrary()) as unknown as { version: number; settings: Record<string, unknown>; themes: Record<string, unknown>[] };
 v6.version = 6;
 delete v6.settings.mode;
 // The four rooms as they shipped in version 6, one of them edited by its owner.
 const rouge = shipped('room-rouge', 'Rouge', 'claret'), obsidian = shipped('room-obsidian', 'Obsidian', 'obsidian'), riviera = shipped('room-riviera', 'Riviera', 'midnight');
 const sakura = { ...shipped('room-sakura', 'Sakura', 'sakura'), updatedAt: '2026-11-15T10:00:00.000Z' };
 (sakura.table as unknown as Record<string, unknown>).inscription = 'Hanami';
 const monteCarlo = { ...v6.themes[0]!, name: 'Monte Carlo' };
 const catCafe = v6.themes.find((theme) => theme.id === 'room-cat')!;
 catCafe.companion = { ...(catCafe.companion as object), catCoat: 'tabby', eyes: 'green' };
 v6.themes = [monteCarlo, obsidian, rouge, riviera, sakura, ...v6.themes.slice(1)];
 v6.settings.activeThemeId = 'room-rouge';
 v6.settings.recent = ['room-rouge', 'room-obsidian', 'room-neon'];
 const upgraded = validateLibrary(v6);
 assert.equal(upgraded.version, 7);
 const ids = upgraded.themes.map((theme) => theme.id);
 for (const gone of ['room-obsidian', 'room-rouge', 'room-riviera']) assert.ok(!ids.includes(gone), `${gone} folds into Classic`);
 assert.ok(ids.includes('room-sakura'), 'A room its owner changed stays');
 assert.equal(upgraded.themes.find((theme) => theme.id === 'room-sakura')!.table.inscription, 'Hanami');
 // Rouge was in use: Classic takes over, wearing Claret, so the table looks the same.
 assert.equal(upgraded.settings.activeThemeId, 'room-monte-carlo');
 const classic = upgraded.themes.find((theme) => theme.id === 'room-monte-carlo')!;
 assert.equal(classic.name, 'Classic');
 assert.equal(colourwayOf(classic)?.id, 'claret');
 assert.equal(classic.updatedAt, BUILT_IN_TIMESTAMP, 'Wearing a colourway still counts as untouched');
 assert.deepEqual(upgraded.settings.recent, ['room-neon'], 'Recent drops the rooms that went');
 assert.equal(upgraded.settings.mode, undefined, 'The owner is asked how to start');
 // An untouched Cat Café gets the new grey tabby.
 assert.equal(upgraded.themes.find((theme) => theme.id === 'room-cat')!.companion!.catCoat, 'grey');

 // A Classic the owner edited is never overwritten: the room in use stays instead.
 const edited = structuredClone(v6);
 edited.themes[0] = { ...edited.themes[0]!, updatedAt: '2026-11-16T09:00:00.000Z', table: { ...(edited.themes[0]!.table as object), inscription: 'Friday' } };
 const kept = validateLibrary(edited);
 assert.equal(kept.settings.activeThemeId, 'room-rouge');
 assert.equal(kept.themes.find((theme) => theme.id === 'room-monte-carlo')!.table.inscription, 'Friday');
 assert.ok(!kept.themes.some((theme) => theme.id === 'room-obsidian'), 'Rooms not in use still fold');
 // An edited Cat Café keeps its owner's cat.
 const ownCat = structuredClone(v6); const cafe = ownCat.themes.find((theme) => theme.id === 'room-cat')!; cafe.updatedAt = '2026-11-17T09:00:00.000Z';
 assert.equal(validateLibrary(ownCat).themes.find((theme) => theme.id === 'room-cat')!.companion!.catCoat, 'tabby');
});

test('a theme written by an AI imports from its whole answer, and refusals say what is wrong', async () => {
 const { completeTheme, explain, importThemeText, aiPrompt } = await import('../src/themes/ai');
 const prompt = aiPrompt();
 for (const word of ['"face"', 'pixel', 'reveal.decrypt', 'deal.packet', '#rrggbb']) assert.ok(prompt.includes(word), `The prompt lists ${word}`);
 assert.ok(!/deal\.puppy|flop\.cat/.test(prompt), 'Companion effects are not offered to an AI');
 const answer = `Here's a theme for you!\n\`\`\`json\n${JSON.stringify({
  name: 'Deep Sea', description: 'Glowing jellyfish over a dark ocean', extra: 'ignored',
  card: { face: 'neon', back: 'circuit', backColor: '#0a2a3a', faceColor: '#06141c', redColor: '#f6b', blackColor: '7ff3ff', borderColor: '#1d4a5a', borderRadius: 8, shadow: 0.5, sparkle: true },
  table: { feltColor: '#0b3550', railColor: '#04121a', backgroundColor: '#020a10', trimColor: '#5cf2ff', inscription: 'Deep Sea', emblem: 'none', motif: 'neon' },
  animations: { deal: { preset: 'deal.storm' }, flop: 'flop.hologram', turn: { preset: 'reveal.decrypt' }, river: { preset: 'reveal.does-not-exist' } },
 })}\n\`\`\`\nEnjoy the depths.`;
 const theme = await importThemeText(answer);
 assert.equal(theme.name, 'Deep Sea');
 assert.equal(theme.card.redColor, '#ff66bb', 'Short colours are expanded');
 assert.equal(theme.card.blackColor, '#7ff3ff', 'A missing # is forgiven');
 assert.equal(theme.board.color, '#0b3550', 'A missing board takes the felt');
 assert.deepEqual(Object.values(theme.animations).map((a) => a.preset), ['deal.storm', 'flop.hologram', 'reveal.decrypt', 'reveal.showdown'], 'An unknown effect falls back to the house one');
 assert.match(theme.id, /^theme-/);
 // Strict where it matters: a face that does not exist is refused, and the reason names the field.
 let message = '';
 try { completeTheme({ ...JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)), card: { face: 'glitter', back: 'solid', backColor: '#000000', faceColor: '#ffffff', redColor: '#ff0000', blackColor: '#000000', borderColor: '#cccccc' } }); }
 catch (error) { message = explain(error); }
 assert.match(message, /card\.face/);
 await assert.rejects(importThemeText('no theme here'));
 assert.match(explain(new SyntaxError('x')), /first \{ to the last \}/);
});

test('every built-in theme, and Classic in each colourway, has a recording for the simple view to play', async () => {
 const { existsSync } = await import('node:fs');
 const { builtInThemes, CLASSIC_COLOURWAYS, withColourway } = await import('../src/themes/defaults');
 const { themeClip } = await import('../src/studio/Simple');
 const looks = builtInThemes.flatMap((theme) => theme.id === 'room-monte-carlo' ? CLASSIC_COLOURWAYS.map((colourway) => withColourway(theme, colourway)) : [theme]);
 for (const theme of looks) {
  const clip = themeClip(theme);
  assert.ok(clip, `${theme.name} has a clip`);
  assert.ok(existsSync(`public/${clip!.replace('./', '')}`), `${clip} was recorded`);
 }
 assert.equal(themeClip(withColourway(builtInThemes[0]!, CLASSIC_COLOURWAYS[2]!)), './media/theme-room-monte-carlo.claret.webm');
 // A theme someone changed, or made, has no recording: it would show the wrong look.
 const edited = { ...structuredClone(builtInThemes[1]!), table: { ...builtInThemes[1]!.table, feltColor: '#123456' } };
 assert.equal(themeClip(edited), undefined);
 assert.equal(themeClip({ ...structuredClone(builtInThemes[1]!), id: 'theme-mine' }), undefined);
});
