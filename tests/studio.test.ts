import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { act, createElement } from 'react';
import { App } from '../src/studio/App';
import { AnimationCoordinator } from '../src/animation/core/coordinator';
import { getPreset, presets, resolvePreset } from '../src/animation/registry';
import { presetName } from '../src/studio/catalog';
import { validateLibrary } from '../src/themes/schema';
import { createDefaultLibrary } from '../src/themes/defaults';
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const KEY='pokernow-customizer.library.v1';

test('Shuffle prefers hearted effects that suit the street and never summons the puppy',()=>{
 const pick=(favorites:string[])=>new Set(Array.from({length:40},(_,index)=>resolvePreset('random','flop',()=>index/40,favorites)!.id));
 assert.deepEqual([...pick(['flop.grand','reveal.slam'])],['flop.grand']);
 assert.deepEqual([...pick(['flop.grand','flop.cascade'])].sort(),['flop.cascade','flop.grand']);
 assert.ok(![...pick(['flop.puppy'])].includes('flop.puppy'),'A hearted puppy effect is chosen deliberately, never by Shuffle');
 assert.ok(pick([]).size>2,'With no hearted effect, Shuffle uses every compatible effect');
 assert.deepEqual(validateLibrary({...createDefaultLibrary(),settings:{...createDefaultLibrary().settings,favorites:undefined}}).settings.favorites,[],'Older libraries gain an empty favourites list');
});

test('Studio plays every effect through the engine, saves choices, and manages themes, keys and search',async()=>{
 const {JSDOM,VirtualConsole}=createRequire(import.meta.url)('jsdom');
 const domErrors:string[]=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',(error:Error)=>domErrors.push(error.message));
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://studio.fixture/',pretendToBeVisual:true,virtualConsole});
 const descriptors=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,KeyboardEvent:dom.window.KeyboardEvent,DOMParser:dom.window.DOMParser,XMLSerializer:dom.window.XMLSerializer,localStorage:dom.window.localStorage,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true,Image:class {src='';decode(){return Promise.resolve();}},requestAnimationFrame:(callback:FrameRequestCallback)=>setTimeout(()=>callback(performance.now()),1),cancelAnimationFrame:(id:ReturnType<typeof setTimeout>)=>clearTimeout(id)})) {
  descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 }
 // jsdom has no media playback; the comparison only needs play and pause to exist.
 dom.window.HTMLMediaElement.prototype.play=function(){return Promise.resolve();};dom.window.HTMLMediaElement.prototype.pause=function(){};
 dom.window.HTMLElement.prototype.getBoundingClientRect=function(){const board=this.getAttribute('data-board'),hole=this.getAttribute('data-hole');const x=board?300+Number(board)*70:hole?150+Number(hole[0])*90:100;return {x,y:220,left:x,top:220,width:this.classList.contains('table-felt')?700:55,height:this.classList.contains('table-felt')?250:77,right:x+55,bottom:297,toJSON:()=>({})};};
 const runs:string[]=[];const play=AnimationCoordinator.prototype.play;
 AnimationCoordinator.prototype.play=function(event,theme,options){runs.push(options?.presetId??theme.animations[event.type==='HOLE_CARDS_APPEARED'?'deal':event.type==='FLOP_REVEALED'?'flop':event.type==='TURN_REVEALED'?'turn':'river'].preset);const handle=play.call(this,event,theme,options);setTimeout(()=>handle.finish(),20);return handle;};
 const {createRoot}=await import('react-dom/client');
 let root=createRoot(document.getElementById('root')!);
 const settle=async()=>{await act(async()=>{await wait(140);});await act(async()=>{await wait(50);});};
 const click=async(selector:string)=>{const button=document.querySelector<HTMLElement>(selector);assert.ok(button,selector);await act(async()=>{button.click();});await settle();};
 const clickText=async(selector:string,text:string)=>{const button=[...document.querySelectorAll<HTMLElement>(selector)].find(b=>b.textContent?.trim()===text);assert.ok(button,`${selector} "${text}"`);await act(async()=>{button.click();});await settle();};
 const key=async(init:KeyboardEventInit,target:EventTarget=window)=>{await act(async()=>{target.dispatchEvent(new dom.window.KeyboardEvent('keydown',{bubbles:true,...init}));});await settle();};
 const stored=()=>validateLibrary(JSON.parse(localStorage.getItem(KEY)!));
 const save=async()=>{await act(async()=>{await wait(450);});};
 try {
  await act(async()=>{root.render(createElement(App));await wait(30);});await act(async()=>{await wait(30);});
  const nav=(label:string)=>clickText('.rail-item span',label);
  // First run asks how to start; the full studio is one choice.
  assert.match(document.querySelector('.welcome')!.textContent!,/Just pick a theme.*Customize everything/);
  await clickText('.welcome-choice b','Customize everything');
  assert.ok(!document.querySelector('.welcome'),'The choice is made once');
  const tryLabel=(id:string)=>`[aria-label="Try ${presetName(getPreset(id)!)} on the table"]`;
  // The studio opens on Discover: the looping before-and-after, and no preview table running behind it.
  assert.equal(document.querySelector('.rail-item[aria-current="page"]')!.textContent!.trim(),'Discover');
  assert.deepEqual([...document.querySelectorAll<HTMLVideoElement>('.before-after video')].map(v=>v.getAttribute('src')),['./media/compare-plain.webm','./media/compare-puppy.webm']);
  assert.ok([...document.querySelectorAll<HTMLVideoElement>('.before-after video')].every(v=>v.loop&&v.muted),'The comparison loops, muted');
  assert.ok(!document.querySelector('.player-seat'),'Discover runs no preview table');
  assert.match(document.querySelector('.power')!.textContent!,/Preview only/,'A browser preview says it does not reach PokerNow');
  await clickText('.hero-actions .primary-button','Browse themes');
  assert.equal(document.querySelector('.rail-item[aria-current="page"]')!.textContent!.trim(),'Themes');
  assert.equal(document.querySelectorAll('.theme-card').length,7,'Seven built-in themes: Classic and its colourways, then the rooms with a world of their own');

  // Effects: event tabs, then cards for that moment, each with its own poster.
  await nav('Effects');
  const flopEffects=presets.filter(p=>p.supportedEvents.includes('flop'));
  assert.equal(document.querySelectorAll('.fx-card').length,flopEffects.length,'Every flop effect has a card');
  assert.equal(document.querySelectorAll('.player-seat').length,6);
  assert.equal(new Set([...document.querySelectorAll<HTMLImageElement>('.fx-media img')].map(i=>i.getAttribute('src'))).size,flopEffects.length,'No two cards share a poster');

  // Every effect, tried from its own moment, through the shared engine.
  for(const preset of presets) {
   await clickText('.event-tab .event-name',{deal:'Deal',flop:'Flop',turn:'Turn',river:'River'}[preset.supportedEvents[0]!]);
   await click(tryLabel(preset.id));
   assert.equal(runs.at(-1),preset.id,`${preset.id} did not reach the shared engine`);
   assert.equal(document.querySelectorAll('[data-pnc-concealed]').length,0,'source was not restored');
  }
  // Trying never changes what is equipped; equipping does.
  await save();
  assert.equal(stored().themes[0].animations.flop.preset,'flop.grand');
  await clickText('.event-tab .event-name','Deal');
  await click(tryLabel('deal.puppy'));
  assert.equal(runs.at(-1),'deal.puppy');
  assert.match(document.querySelector('.stage-banner.trial')!.textContent!,/Not equipped/,'The table says a tried effect is not equipped');
  await save();assert.equal(stored().themes[0].animations.deal.preset,'deal.storm');
  await clickText('.fx-detail .primary-button','Equip for the deal');
  await save();assert.equal(stored().themes[0].animations.deal.preset,'deal.puppy');
  assert.ok(!document.querySelector('.stage-banner.trial'),'Equipping clears the try-on banner');

  // Shuffle on the turn, replayed, and saved.
  await clickText('.event-tab .event-name','Turn');
  await click('[aria-label="Shuffle the turn"]');
  assert.equal(document.querySelector('[aria-label="Shuffle the turn"]')?.getAttribute('aria-checked'),'true');
  await click('[aria-label="Replay animation"]');
  assert.equal(runs.at(-1),'random','Replay must use the current shuffle assignment');
  await save();assert.equal(stored().themes[0].animations.turn.preset,'random');

  // Hearts are saved, change what Shuffle describes, and feed the Favorites filter.
  await click('[aria-label="Add Slam to favorites"]');
  await save();assert.deepEqual(stored().settings.favorites,['reveal.slam']);
  assert.match(document.querySelector('.shuffle-line')!.textContent!,/your 1 favorite\b/);
  await clickText('.filter','Favorites1');
  assert.equal(document.querySelectorAll('.fx-card').length,1,'Favorites shows only hearted effects');
  await clickText('.filter',`All${presets.filter(p=>p.supportedEvents.includes('turn')).length}`);
  const searchEffects=document.querySelector<HTMLInputElement>('.search-field input')!;
  const type=async(input:HTMLInputElement,value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await settle();};
  await type(searchEffects,'crystal');
  assert.equal(document.querySelectorAll('.fx-card').length,1,'Search narrows the effects');
  await type(searchEffects,'');

  // Keyboard: a number plays that street; ] tries the next effect.
  const before=runs.length;
  await key({key:'2'});
  assert.equal(runs.length,before+1);assert.equal(runs.at(-1),'flop.grand');
  await key({key:']'});
  const flopOrder=flopEffects.map(p=>p.id);
  assert.equal(runs.at(-1),flopOrder[(flopOrder.indexOf('flop.grand')+1)%flopOrder.length]);

  // Search: ⌘K, type, Enter applies a theme; undo and redo walk it back and forth.
  await act(async()=>{await wait(600);});
  await key({key:'k',ctrlKey:true});
  const search=document.querySelector<HTMLInputElement>('.menu input');assert.ok(search,'Command menu opens');
  await type(search,'neon');
  await key({key:'Enter'},search);
  assert.ok(!document.querySelector('.menu'),'Running a command closes the menu');
  const inUse=()=>document.querySelector('.switcher-text b')!.textContent;
  assert.equal(inUse(),'Neon');
  await click('[aria-label="Undo"]');assert.equal(inUse(),'Classic','Undo restores the previous theme');
  await click('[aria-label="Redo"]');assert.equal(inUse(),'Neon','Redo applies it again');
  await act(async()=>{await wait(600);});

  // Themes: preview without applying, then apply; new, duplicate, delete with confirmation; built-ins cannot be deleted.
  await nav('Themes');
  await click('[aria-label="Preview Arcade on the table"]');
  assert.match(document.querySelector('.stage-banner')!.textContent!,/Arcade.*Not applied/);
  await save();assert.equal(stored().settings.activeThemeId,'room-neon','Previewing does not apply');
  await clickText('.stage-banner .primary-button','Use this theme');
  await save();assert.equal(stored().settings.activeThemeId,'room-arcade');
  // Classic's colourways: one click dresses Classic and puts it in use.
  await click('[aria-label="Classic colourway"] [aria-label="Claret"]');
  await save();assert.equal(stored().settings.activeThemeId,'room-monte-carlo');
  assert.equal(stored().themes.find(t=>t.id==='room-monte-carlo')!.table.feltColor,'#6a1626','Classic wears Claret');
  assert.equal(document.querySelector('[aria-label="Classic colourway"] [aria-checked="true"]')?.getAttribute('aria-label'),'Claret');
  const count=()=>document.querySelectorAll('.theme-card').length;
  await clickText('.head-actions .primary-button','New theme');
  assert.equal(document.querySelector('.rail-item[aria-current="page"]')!.textContent!.trim(),'Appearance','A new theme opens Appearance');
  await nav('Themes');assert.equal(count(),8);
  await clickText('.current .secondary-button','Duplicate');assert.equal(count(),9);
  await click('[aria-label="More actions for Classic"]');
  assert.ok(!document.querySelector('.card-menu .danger'),'Built-in themes cannot be deleted');
  await click('[aria-label="More actions for My theme"]');
  await clickText('.card-menu button','Delete…');assert.equal(count(),9,'Delete asks first');
  await clickText('.confirm .danger-button','Delete');assert.equal(count(),8);
  await save();assert.ok(!stored().themes.some(t=>t.name==='My theme'));

  // Appearance: faces, backs and table colours reach the preview artwork; undo puts them back.
  await nav('Appearance');
  assert.equal(document.querySelectorAll('.face-option').length,11,'Eleven decks, Pixel, Hologram, Cipher and Cat included');
  const faceBefore=document.querySelector<HTMLImageElement>('[data-board="0"] img')!.src;
  await clickText('.face-option b','Neon');
  assert.notEqual(document.querySelector<HTMLImageElement>('[data-board="0"] img')!.src,faceBefore,'Face selection did not update the table artwork');
  const backBefore=document.querySelector<HTMLImageElement>('[data-hole="1-0"] img')!.src;
  await clickText('.back-option span','Circuit');
  assert.notEqual(document.querySelector<HTMLImageElement>('[data-hole="1-0"] img')!.src,backBefore,'Back selection did not update opponent artwork');
  await clickText('.subtabs button','Table');
  const felt=()=>document.querySelector<HTMLElement>('.table-felt')!.style.getPropertyValue('--felt');const feltBefore=felt();
  await clickText('.palette span','Plum');
  assert.notEqual(felt(),feltBefore,'A palette did not change the felt');
  assert.equal([...document.querySelectorAll('.palette')].find(p=>p.textContent==='Plum')!.getAttribute('aria-checked'),'true','The chosen palette shows as selected');
  await act(async()=>{await wait(600);});
  const moodBefore=felt();
  await key({key:'ArrowRight',shiftKey:true},document.querySelector('.mood-knob')!);
  assert.notEqual(felt(),moodBefore,'The mood pad recolours the felt from the keyboard');
  await click('[aria-label="Undo"]');assert.equal(felt(),moodBefore,'Undo restores the felt');
  await clickText('.choice','Petals');
  await save();assert.equal(stored().themes.find(t=>t.id===stored().settings.activeThemeId)!.table.motif,'sakura');

  // Companion: choose the puppy, recolour it; tricks explain when they cannot play.
  await nav('Companion');
  await clickText('.companion-option b','Puppy');
  await clickText('.swatch','Chocolate');
  await save();assert.deepEqual(stored().themes.find(t=>t.id===stored().settings.activeThemeId)!.companion,{kind:'puppy',animations:true,intensity:'normal',scale:'medium',coat:'chocolate',collar:'ruby'});
  await clickText('.trick','Celebrate');
  assert.match(document.querySelector('.companion-page')!.textContent!,/busy or still settling in/,'A trick that cannot play says so');
  // Switch to the cat: its own coat, eyes and moves; the puppy's coat is kept for later.
  const active=()=>stored().themes.find(t=>t.id===stored().settings.activeThemeId)!;
  await clickText('.companion-option b','Cat');
  await clickText('.swatch','Calico');
  await clickText('.secondary-button','Use on every street');
  await save();
  assert.equal(active().companion!.kind,'cat');assert.equal(active().companion!.catCoat,'calico');assert.equal(active().companion!.coat,'chocolate','The puppy’s coat is kept');
  assert.deepEqual(Object.values(active().animations).map(a=>a.preset),['deal.cat','flop.cat','turn.cat','river.cat']);
  assert.ok([...document.querySelectorAll('.trick')].some(b=>b.textContent==='Meow'),'The cat meows rather than barks');
  await clickText('.companion-option b','Puppy');
  await save();
  assert.deepEqual(Object.values(active().animations).map(a=>a.preset),['deal.puppy','flop.puppy','turn.puppy','river.puppy'],'Switching character swaps its moves');
  // Effects: the Win tab lists the five steps of a win.
  await nav('Effects');await clickText('.event-tab .event-name','Win');
  assert.equal(document.querySelectorAll('.win-step').length,5);
  assert.match(document.querySelector('.win-panel')!.textContent!,/You won.*names your hand/);
  await nav('Companion');

  // Settings.
  await nav('Settings');await clickText('.connection button','Check PokerNow connection');
  assert.match(document.querySelector('.connection-results')!.textContent!, /Browser preview only.*Chrome toolbar/);
  await click('[aria-label="Reduced motion"]');assert.equal(document.querySelector('[aria-label="Reduced motion"]')?.getAttribute('aria-checked'),'true');
  await clickText('.mode b','Lightweight');
  await save();assert.equal(stored().settings.reducedMotion,true);assert.deepEqual(stored().settings.effects,{chips:false,celebrations:false,moments:false,ambience:false,winSize:'balanced',othersWins:true});
  await clickText('.mode b','High quality');
  await save();assert.deepEqual(stored().settings.effects,{chips:true,celebrations:true,moments:true,ambience:true,winSize:'balanced',othersWins:true});
  // Wins: size and other players' wins, kept apart from the performance modes.
  await click('[aria-label="Win size"] [role="radio"]:last-child');
  await click('[aria-label="Celebrate other players’ wins"]');
  await save();assert.equal(stored().settings.effects.winSize,'loud');assert.equal(stored().settings.effects.othersWins,false);
  await clickText('.mode b','Balanced');
  await save();assert.equal(stored().settings.effects.winSize,'loud','A performance mode leaves the win size alone');
  assert.ok(!document.querySelector('.save-status.s-failed'));
  // Simple view: one page of tables, Classic's colourways, and importing a theme an AI wrote.
  await clickText('.simple-switch','Simple view');
  assert.ok(document.querySelector('.simple')&&!document.querySelector('.rail'),'Simple view is one page, without the studio');
  await save();assert.equal(stored().settings.mode,'simple');
  await click('.simple [aria-label="Classic colourway"] [aria-label="Midnight"]');
  await save();assert.equal(stored().settings.activeThemeId,'room-monte-carlo');assert.equal(stored().themes.find(t=>t.id==='room-monte-carlo')!.table.feltColor,'#133a60');
  await click('.simple-import');
  assert.match(document.querySelector('.import-dialog')!.textContent!,/Make one with AI.*Copy the prompt/);
  const code=document.querySelector<HTMLTextAreaElement>('#theme-code')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(code,'Sure! {"name":"Deep Sea","card":{"face":"neon","back":"circuit","backColor":"#0a2a3a","faceColor":"#06141c","redColor":"#ff6fb5","blackColor":"#7ff3ff","borderColor":"#1d4a5a"},"table":{"feltColor":"#0b3550","railColor":"#04121a","backgroundColor":"#020a10","trimColor":"#5cf2ff","motif":"neon"}} Enjoy!');code.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await settle();
  await clickText('.import-dialog .primary-button','Import and use');
  await act(async()=>{await wait(50);});
  assert.ok(!document.querySelector('.import-dialog'),'A good theme closes the dialog');
  await save();assert.equal(stored().themes.find(t=>t.id===stored().settings.activeThemeId)!.name,'Deep Sea','The imported theme is in use');
  assert.ok([...document.querySelectorAll('.simple-card b')].some(b=>b.textContent!.startsWith('Deep Sea')),'It joins the page');
  await click('.simple-import');
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(code.isConnected?code:document.querySelector('#theme-code')!,'{"name":"Bad","card":{"face":"glitter"}}');document.querySelector('#theme-code')!.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await settle();
  await clickText('.import-dialog .primary-button','Import and use');await act(async()=>{await wait(50);});
  assert.match(document.querySelector('.import-error')!.textContent!,/card\.face/,'A refusal names the field');
  await click('.import-dialog [aria-label="Close"]');
  await clickText('.simple-bar .ghost-button','Customize');
  assert.ok(document.querySelector('.rail'),'Customize returns to the full studio');
  await nav('Settings');
  await click('[aria-label="Enable customization in settings"]');
  await nav('Effects');
  const beforeDisabled=runs.length;await clickText('.player-streets button','Flop');
  assert.equal(runs.length,beforeDisabled,'Disabled previews should keep canonical cards without running effects');
  await act(async()=>{root.unmount();});

  // A broken library is never overwritten without the owner's say.
  const broken='{"version":99}';localStorage.setItem(KEY,broken);
  root=createRoot(document.getElementById('root')!);await act(async()=>{root.render(createElement(App));});await save();
  assert.ok(document.querySelector('.recovery-banner'));assert.equal(localStorage.getItem(KEY),broken,'Invalid data was overwritten without recovery');
  await click('.recovery-banner .primary-button');await save();
  assert.ok(!document.querySelector('.recovery-banner'));assert.equal(stored().version,7);

  // Uploaded assets can take longer than a frame. A preview waits for the exact resolved theme, then plays.
  await act(async()=>root.unmount());
  const assetLibrary=createDefaultLibrary();assetLibrary.themes[0].card.back='image';assetLibrary.themes[0].card.backImage='asset:slow-image';
  localStorage.setItem(KEY,JSON.stringify(assetLibrary));
  descriptors.set('indexedDB',Object.getOwnPropertyDescriptor(globalThis,'indexedDB'));
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){
    const request:{result?:unknown;onsuccess?:()=>void}={};
    setTimeout(()=>{request.result={close(){},transaction(){return {objectStore(){return {get(){
      const read:{result?:unknown;onsuccess?:()=>void}={};
      setTimeout(()=>{read.result='data:image/png;base64,iVBORw0KGgo=';read.onsuccess?.();},220);
      return read;
    }}}}}};request.onsuccess?.();},1);
    return request;
  }}});
  root=createRoot(document.getElementById('root')!);
  await act(async()=>{root.render(createElement(App));});
  await act(async()=>{[...document.querySelectorAll<HTMLButtonElement>('.rail-item')].find(b=>b.textContent?.trim()==='Effects')!.click();});
  await act(async()=>{await wait(60);});
  const beforeQueued=runs.length;
  await act(async()=>{document.querySelector<HTMLButtonElement>('[aria-label="Try Triple Orbit on the table"]')!.click();});
  await act(async()=>{await wait(130);});assert.equal(runs.length,beforeQueued,'Preview ran before its uploaded assets resolved: '+runs.slice(-3).join(','));
  await act(async()=>{await wait(260);});await act(async()=>{await wait(50);});
  assert.equal(runs.length,beforeQueued+1);assert.equal(runs.at(-1),'flop.triple-orbit');
  assert.deepEqual(domErrors,[],'Uncaught DOM errors');
 } finally {
  await act(async()=>root.unmount());AnimationCoordinator.prototype.play=play;
  for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  dom.window.close();
 }
});
