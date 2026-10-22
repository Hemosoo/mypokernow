import test from 'node:test';
import assert from 'node:assert/strict';
import { isAssetRequest, respondToAsset } from '../src/background/assets';
import { readAsset, resolveThemeAssets } from '../src/storage/assets';
import { createDefaultTheme } from '../src/themes/defaults';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZ0AAAAASUVORK5CYII=';
test('asset service accepts only inert local IDs and returns controlled missing-asset errors',async()=>{
 assert.ok(isAssetRequest({type:'pnc.asset.read',id:'asset:fixture'}));
 for(const value of [null,{type:'eval',id:'asset:fixture'},{type:'pnc.asset.read',id:'https://example.com'},{type:'pnc.asset.read',id:'asset:fixture',code:'arbitrary'}])assert.ok(!isAssetRequest(value));
 assert.deepEqual(await respondToAsset({type:'pnc.asset.read',id:'asset:fixture'},async id=>{assert.equal(id,'asset:fixture');return png;}),{ok:true,data:png});
 assert.equal((await respondToAsset({type:'pnc.asset.read',id:'asset:fixture'},async()=>{throw new Error('internal database information');})).ok,false);
});
test('content assets cross the extension message boundary and never access PokerNow IndexedDB',async()=>{
 const descriptors=new Map<string,PropertyDescriptor|undefined>();const calls:unknown[]=[];
 for(const [key,value] of Object.entries({location:{protocol:'https:'},chrome:{runtime:{id:'extension-fixture',sendMessage:async(message:unknown)=>{calls.push(message);return {ok:true,data:png};}}},indexedDB:{open(){throw new Error('Page IndexedDB must not be accessed');}}})){
  descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});
 }
 try {
  const theme=createDefaultTheme();theme.card.backImage='asset:fixture';theme.table.backgroundImage='asset:table';const resolved=await resolveThemeAssets(theme);
  assert.equal(resolved.card.backImage,png);assert.equal(resolved.table.backgroundImage,png);assert.equal(theme.card.backImage,'asset:fixture');assert.equal(calls.length,2);
  await assert.rejects(readAsset('https://remote.example/image.png'),/reference/);assert.equal(calls.length,2);
  (chrome.runtime.sendMessage as (message:unknown)=>Promise<unknown>)=async()=>({ok:true,data:'data:image/svg+xml;base64,PHN2Zz4='});
  await assert.rejects(readAsset('asset:fixture'),/PNG/);
 }finally{for(const [key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
