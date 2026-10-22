import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDefaultLibrary } from '../src/themes/defaults';
import type { Library } from '../src/types';
import type { RuntimeStatus } from '../src/storage/diagnostics';
const flush=async()=>{for(let i=0;i<4;i++)await new Promise<void>(resolve=>setImmediate(resolve));};
test('actual content entry applies pregame appearance, survives a missing upload, reports connection, updates and restores on disable',async()=>{
 const{JSDOM}=createRequire(import.meta.url)('jsdom');
 const dom=new JSDOM('<!doctype html><html><body><div class="table"></div></body></html>',{url:'https://www.pokernow.com/games/local-fixture',pretendToBeVisual:true});
 const previous=new Map<string,PropertyDescriptor|undefined>();
 const storageListeners=new Set<(changes:Record<string,ChromeStorageChange>,area:string)=>void>();
 const messageListeners=new Set<(message:unknown,sender:{id?:string},respond:(response:unknown)=>void)=>unknown>();
 const reports:RuntimeStatus[]=[];let library=createDefaultLibrary();
 library.themes[0].card.back='image';library.themes[0].card.backImage='asset:missing-image';
 const fakeChrome={runtime:{id:'fixture',sendMessage:async(message:{type:string;status?:RuntimeStatus})=>{if(message.type==='pnc.asset.read')return {ok:false,error:'Missing fixture upload'};if(message.status)reports.push(message.status);return {ok:true};},onMessage:{addListener:(listener:typeof messageListeners extends Set<infer T>?T:never)=>messageListeners.add(listener),removeListener:(listener:typeof messageListeners extends Set<infer T>?T:never)=>messageListeners.delete(listener)}},storage:{local:{get:async(key:string)=>({[key]:library})},onChanged:{addListener:(listener:typeof storageListeners extends Set<infer T>?T:never)=>storageListeners.add(listener),removeListener:(listener:typeof storageListeners extends Set<infer T>?T:never)=>storageListeners.delete(listener)}}};
 for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),chrome:fakeChrome})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:20,y:40,left:20,top:40,right:820,bottom:540,width:800,height:500,toJSON:()=>({})};};
 const table=document.querySelector<HTMLElement>('.table')!;table.style.setProperty('background-color','#112233','important');
 const dispatch=async(next:Library)=>{library=next;for(const listener of storageListeners)listener({'pokernow-customizer.library.v1':{newValue:next}},'local');await flush();};
 try {
  await import('../src/content/index');await flush();
  assert.equal(table.style.backgroundColor,'rgb(35, 75, 67)','Basic table colors must not require seats or a full hand');
  assert.equal(table.style.getPropertyPriority('background-color'),'important');
  assert.ok(reports.at(-1)?.reason.includes('Table appearance is active'));
  assert.ok(reports.at(-1)?.reason.includes('uploaded image could not load'),'Missing assets should be visible diagnostics, not stop the adapter');
  const edited=createDefaultLibrary();edited.themes[0].table.feltColor='#123456';await dispatch(edited);assert.equal(table.style.backgroundColor,'rgb(18, 52, 86)');
  edited.settings.enabled=false;await dispatch(edited);assert.equal(table.style.backgroundColor,'rgb(17, 34, 51)');assert.equal(table.style.getPropertyPriority('background-color'),'important');assert.equal(reports.at(-1)?.state,'disabled');
  let probed:unknown;for(const listener of messageListeners)listener({type:'pnc.runtime.probe'},{id:'fixture'},response=>{probed=response;});assert.equal((probed as RuntimeStatus).state,'disabled');
 }finally{
  (globalThis as typeof globalThis&{__pncCleanup?:()=>void}).__pncCleanup?.();assert.equal(storageListeners.size,0);assert.equal(messageListeners.size,0);dom.window.close();
  for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
