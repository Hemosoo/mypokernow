import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { act, createElement } from 'react';
import { App } from '../src/studio/App';
import { AnimationCoordinator } from '../src/animation/core/coordinator';
import { presets } from '../src/animation/registry';
import { validateLibrary } from '../src/themes/schema';
import { createDefaultLibrary } from '../src/themes/defaults';
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('Studio mounts, runs all eight through the actual coordinator, persists assignments, and manages themes',async()=>{
 const {JSDOM,VirtualConsole}=createRequire(import.meta.url)('jsdom');
 const domErrors:string[]=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',(error:Error)=>domErrors.push(error.message));
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://studio.fixture/',pretendToBeVisual:true,virtualConsole});
 const descriptors=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,DOMParser:dom.window.DOMParser,XMLSerializer:dom.window.XMLSerializer,localStorage:dom.window.localStorage,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true,Image:class {src='';decode(){return Promise.resolve();}},requestAnimationFrame:(callback:FrameRequestCallback)=>setTimeout(()=>callback(performance.now()),1),cancelAnimationFrame:(id:ReturnType<typeof setTimeout>)=>clearTimeout(id)})) {
  descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 }
 dom.window.HTMLElement.prototype.getBoundingClientRect=function(){const board=this.getAttribute('data-board'),hole=this.getAttribute('data-hole');const x=board?300+Number(board)*70:hole?150+Number(hole[0])*90:100;return {x,y:220,left:x,top:220,width:this.classList.contains('table-felt')?700:55,height:this.classList.contains('table-felt')?250:77,right:x+55,bottom:297,toJSON:()=>({})};};
 const runs:string[]=[];const play=AnimationCoordinator.prototype.play;
 AnimationCoordinator.prototype.play=function(event,theme,options){runs.push(options?.presetId??theme.animations[event.type==='HOLE_CARDS_APPEARED'?'deal':event.type==='FLOP_REVEALED'?'flop':event.type==='TURN_REVEALED'?'turn':'river'].preset);const handle=play.call(this,event,theme,options);setTimeout(()=>handle.finish(),20);return handle;};
 const {createRoot}=await import('react-dom/client');
 let root=createRoot(document.getElementById('root')!);
 const click=async(selector:string)=>{const button=document.querySelector<HTMLButtonElement>(selector);assert.ok(button,selector);await act(async()=>{button.click();});await act(async()=>{await wait(140);});await act(async()=>{await wait(50);});};
 const nav=async(text:string)=>{const button=[...document.querySelectorAll<HTMLButtonElement>('.nav-item')].find(b=>b.textContent===text)!;assert.ok(button);await act(async()=>{button.click();});};
 try {
  await act(async()=>{root.render(createElement(App));await wait(30);});await act(async()=>{await wait(30);});
  assert.equal(document.querySelectorAll('.preset-card').length,8);assert.equal(document.querySelectorAll('.player-seat').length,6);
  assert.match(document.querySelector('.studio-context')!.textContent!, /Browser preview.*changes stay here/);
  for(const preset of presets) {
   await click(`[aria-label="Preview ${preset.name}"]`);
   assert.equal(runs.at(-1),preset.id,`${preset.id} did not reach shared engine`);
   assert.equal(document.querySelectorAll('[data-pnc-concealed]').length,0,'source was not restored');
  }
  await act(async()=>{await wait(450);});
  const stored=validateLibrary(JSON.parse(localStorage.getItem('pokernow-customizer.library.v1')!));
  assert.equal(stored.themes[0].animations.deal.preset,'deal.orbit');assert.equal(stored.themes[0].animations.flop.preset,'flop.crystal-spread');
  await nav('Themes');const before=document.querySelectorAll('.theme-library-card').length;
  await click('.section-heading .accent-button');assert.equal(document.querySelectorAll('.theme-library-card').length,before+1);
  const duplicate=[...document.querySelectorAll<HTMLButtonElement>('.button-row button')].find(b=>b.textContent?.includes('Duplicate'))!;
  await act(async()=>{duplicate.click();});assert.equal(document.querySelectorAll('.theme-library-card').length,before+2);
  await click('.button-row .danger');assert.equal(document.querySelectorAll('.theme-library-card').length,before+1);
  await nav('Cards');
  const faceBefore=document.querySelector<HTMLImageElement>('[data-board="0"] img')!.src;
  await click('.face-style-card:nth-child(4)');
  assert.notEqual(document.querySelector<HTMLImageElement>('[data-board="0"] img')!.src,faceBefore,'Face selection did not update the table artwork');
  const backBefore=document.querySelector<HTMLImageElement>('[data-hole="1-0"] img')!.src;
  await click('.choice-row button:nth-child(3)');
  assert.notEqual(document.querySelector<HTMLImageElement>('[data-hole="1-0"] img')!.src,backBefore,'Back selection did not update opponent artwork');
  await nav('Table');const feltBefore=document.querySelector<HTMLElement>('.table-felt')!.style.getPropertyValue('--felt');
  await click('.table-theme-card:nth-child(3)');
  assert.notEqual(document.querySelector<HTMLElement>('.table-felt')!.style.getPropertyValue('--felt'),feltBefore,'Table selection did not change felt');
  await nav('Settings');await click('.connection-card button');
  assert.match(document.querySelector('.connection-results')!.textContent!, /Browser preview only.*Chrome toolbar/);
  await click('[aria-label="Reduced motion"]');assert.equal(document.querySelector('[aria-label="Reduced motion"]')?.getAttribute('aria-checked'),'true');
  await act(async()=>{await wait(450);});assert.equal(validateLibrary(JSON.parse(localStorage.getItem('pokernow-customizer.library.v1')!)).settings.reducedMotion,true);
  assert.ok(!document.querySelector('.save-status.failed'));
  const beforeDisabled=runs.length;await click('[aria-label="Enable customization in settings"]');await click('.quick-preview-grid button');
  assert.equal(runs.length,beforeDisabled,'Disabled previews should keep canonical cards without running effects');
  await act(async()=>{root.unmount();});
  const key='pokernow-customizer.library.v1',broken='{"version":99}';localStorage.setItem(key,broken);
  root=createRoot(document.getElementById('root')!);await act(async()=>{root.render(createElement(App));});await act(async()=>{await wait(450);});
  assert.ok(document.querySelector('.recovery-banner'));assert.equal(localStorage.getItem(key),broken,'Invalid data was overwritten without recovery');
  await click('.recovery-banner .accent-button');await act(async()=>{await wait(450);});
  assert.ok(!document.querySelector('.recovery-banner'));assert.equal(validateLibrary(JSON.parse(localStorage.getItem(key)!)).version,1);

  // Uploaded assets can take longer than the old 80 ms preview timer. A preset
  // must wait for the exact resolved theme, then play instead of being cancelled.
  await act(async()=>root.unmount());
  const assetLibrary=createDefaultLibrary();assetLibrary.themes[0].card.back='image';assetLibrary.themes[0].card.backImage='asset:slow-image';
  localStorage.setItem(key,JSON.stringify(assetLibrary));
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
  await act(async()=>{root.render(createElement(App));});await act(async()=>{await wait(270);});
  const beforeQueued=runs.length;
  await act(async()=>{document.querySelector<HTMLButtonElement>('[aria-label="Preview Triple Orbit"]')!.click();});
  await act(async()=>{await wait(130);});assert.equal(runs.length,beforeQueued,'Preview ran before its uploaded assets resolved');
  await act(async()=>{await wait(150);});await act(async()=>{await wait(50);});
  assert.equal(runs.length,beforeQueued+1);assert.equal(runs.at(-1),'flop.triple-orbit');
  assert.deepEqual(domErrors,[],'Uncaught DOM errors');
 } finally {
  await act(async()=>root.unmount());AnimationCoordinator.prototype.play=play;
  for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  dom.window.close();
 }
});

