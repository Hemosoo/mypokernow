import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { act, createElement } from 'react';
import { App } from '../src/studio/App';
import { AnimationCoordinator } from '../src/animation/core/coordinator';
import { presets, resolvePreset } from '../src/animation/registry';
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
 const streetIndex={deal:0,flop:1,turn:2,river:3} as const;
 try {
  await act(async()=>{root.render(createElement(App));await wait(30);});await act(async()=>{await wait(30);});
  // The studio opens on Home: the before-and-after comparison, then the way in.
  assert.equal(document.querySelector('.step-tab[aria-current="page"]')!.textContent!.trim(),'Home');
  assert.deepEqual([...document.querySelectorAll<HTMLVideoElement>('.before-after video')].map(v=>v.getAttribute('src')),['./media/compare-plain.webm','./media/compare-puppy.webm']);
  assert.ok([...document.querySelectorAll<HTMLVideoElement>('.before-after video')].every(v=>v.loop&&v.muted),'The comparison loops, muted');
  await clickText('.ba-chapters button','Flop');
  await clickText('.home-bar .primary-button','Make it yours');
  assert.ok(!document.querySelector('.before-after'),'Leaving Home shows the live table again');
  assert.equal(document.querySelectorAll('.tile').length,presets.filter(p=>p.supportedEvents.includes('flop')).length,'The flop shelves show every flop effect');
  assert.equal(document.querySelectorAll('.player-seat').length,6);
  assert.match(document.querySelector('.studio-context')!.textContent!, /Browser preview.*changes stay here/);
  assert.equal(document.querySelectorAll('.tile-media img').length,document.querySelectorAll('.tile').length,'Every tile has its own poster');
  assert.equal(new Set([...document.querySelectorAll<HTMLImageElement>('.tile-media img')].map(i=>i.getAttribute('src'))).size,document.querySelectorAll('.tile').length,'No two tiles share a poster');

  // Every effect, from its own street's shelves, through the shared engine.
  for(const preset of presets) {
   const tracks=document.querySelectorAll<HTMLButtonElement>('.track');
   await act(async()=>{tracks[streetIndex[preset.supportedEvents[0]!]]!.click();});await settle();
   await click(`[aria-label="Preview ${preset.name}"]`);
   assert.equal(runs.at(-1),preset.id,`${preset.id} did not reach the shared engine`);
   assert.equal(document.querySelectorAll('[data-pnc-concealed]').length,0,'source was not restored');
  }
  // Previewing never changes what is assigned; selecting does.
  await save();
  assert.equal(stored().themes[0].animations.flop.preset,'flop.grand');
  await clickText('.track-title small','Initial deal');
  await click('[aria-label="Select Puppy Deal"]');
  assert.equal(runs.at(-1),'deal.puppy');
  await save();assert.equal(stored().themes[0].animations.deal.preset,'deal.puppy');

  // Shuffle on the turn, replayed, and saved.
  await clickText('.track-title small','Turn');
  await click('[aria-label="Select Random"]');
  assert.equal(document.querySelector('[aria-label="Select Random"]')?.getAttribute('aria-pressed'),'true');
  await click('[aria-label="Replay animation"]');
  assert.equal(runs.at(-1),'random','Replay must use the current shuffle assignment');
  await save();assert.equal(stored().themes[0].animations.turn.preset,'random');

  // Hearts are saved and change what Shuffle describes.
  await click('[aria-label="Add Slam to favorites"]');
  await save();assert.deepEqual(stored().settings.favorites,['reveal.slam']);
  assert.match(document.querySelector('.shuffle-row')!.textContent!,/1 hearted effect/);

  // Keyboard: a number plays that street; ] moves to the next effect.
  const before=runs.length;
  await key({key:'2'});
  assert.equal(runs.length,before+1);assert.equal(runs.at(-1),'flop.grand');
  await key({key:']'});
  const flopOrder=presets.filter(p=>p.supportedEvents.includes('flop')).map(p=>p.id);
  assert.equal(runs.at(-1),flopOrder[(flopOrder.indexOf('flop.grand')+1)%flopOrder.length]);

  // Search: ⌘K, type, Enter.
  await key({key:'k',ctrlKey:true});
  const search=document.querySelector<HTMLInputElement>('.menu input');assert.ok(search,'Command menu opens');
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!;setter.call(search,'rouge');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  await key({key:'Enter'},search);
  assert.ok(!document.querySelector('.menu'),'Running a command closes the menu');
  assert.equal(document.querySelector('.stage-title h1')!.textContent,'Rouge');
  await clickText('.step-tab span','Themes');
  await click('.theme-card');

  // Themes: new, duplicate, delete with confirmation.
  const count=()=>document.querySelectorAll('.theme-card').length;const themes=count();
  await click('.new-theme');assert.equal(count(),themes+1);
  await clickText('.button-row .secondary-button','Duplicate');assert.equal(count(),themes+2);
  await clickText('.button-row .secondary-button','Delete…');assert.equal(count(),themes+2,'Delete asks first');
  await clickText('.confirm .secondary-button','Delete theme');assert.equal(count(),themes+1);
  await click('.theme-card');

  // Deck and felt changes reach the preview artwork.
  await clickText('.step-tab span','Deck');
  const faceBefore=document.querySelector<HTMLImageElement>('[data-board="0"] img')!.src;
  await click('.face-option:nth-child(4)');
  assert.notEqual(document.querySelector<HTMLImageElement>('[data-board="0"] img')!.src,faceBefore,'Face selection did not update the table artwork');
  assert.equal(document.querySelectorAll('.face-option').length,5,'All five faces, Puppy included, are offered');
  const backBefore=document.querySelector<HTMLImageElement>('[data-hole="1-0"] img')!.src;
  await clickText('.back-controls .segmented button','Solid');
  assert.notEqual(document.querySelector<HTMLImageElement>('[data-hole="1-0"] img')!.src,backBefore,'Back selection did not update opponent artwork');
  await clickText('.step-tab span','Felt');
  const felt=()=>document.querySelector<HTMLElement>('.table-felt')!.style.getPropertyValue('--felt');const feltBefore=felt();
  await click('.room-swatch:nth-child(3)');
  assert.notEqual(felt(),feltBefore,'Room selection did not change felt');
  assert.equal(document.querySelector('.room-swatch:nth-child(3)')!.getAttribute('aria-checked'),'true','The chosen room shows as selected');
  const moodBefore=felt();
  await key({key:'ArrowRight',shiftKey:true},document.querySelector('.mood-knob')!);
  assert.notEqual(felt(),moodBefore,'The mood pad recolours the felt from the keyboard');

  // Settings.
  await clickText('.step-tab span','Settings');await click('.connection-card button');
  assert.match(document.querySelector('.connection-results')!.textContent!, /Browser preview only.*Chrome toolbar/);
  await click('[aria-label="Reduced motion"]');assert.equal(document.querySelector('[aria-label="Reduced motion"]')?.getAttribute('aria-checked'),'true');
  await save();assert.equal(stored().settings.reducedMotion,true);
  assert.ok(!document.querySelector('.save-status.failed'));
  const beforeDisabled=runs.length;await click('[aria-label="Enable customization in settings"]');await clickText('.player-streets button','Flop');
  assert.equal(runs.length,beforeDisabled,'Disabled previews should keep canonical cards without running effects');
  await act(async()=>{root.unmount();});

  // A broken library is never overwritten without the owner's say.
  const broken='{"version":99}';localStorage.setItem(KEY,broken);
  root=createRoot(document.getElementById('root')!);await act(async()=>{root.render(createElement(App));});await save();
  assert.ok(document.querySelector('.recovery-banner'));assert.equal(localStorage.getItem(KEY),broken,'Invalid data was overwritten without recovery');
  await click('.recovery-banner .accent-button');await save();
  assert.ok(!document.querySelector('.recovery-banner'));assert.equal(stored().version,4);

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
  await act(async()=>{[...document.querySelectorAll<HTMLButtonElement>('.step-tab')].find(b=>b.textContent?.trim()==='Effects')!.click();});
  await act(async()=>{await wait(60);});
  const beforeQueued=runs.length;
  await act(async()=>{document.querySelector<HTMLButtonElement>('[aria-label="Preview Triple Orbit"]')!.click();});
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
