import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir('artifacts',{recursive:true});
await build({entryPoints:['tests/browser-harness.ts'],bundle:true,format:'iife',target:'chrome120',outfile:'.test-build/browser-harness.js'});
await writeFile('.test-build/browser-harness.html','<!doctype html><html><head><title>Engine fixture</title></head><body><script src="./browser-harness.js"></script></body></html>');
const harnessUrl=pathToFileURL(path.resolve('.test-build/browser-harness.html')).href;
const studioUrl=pathToFileURL(path.resolve('dist/index.html')).href;
const profile=await mkdtemp(path.join(tmpdir(),'pnc-chrome-'));
const chromePath=process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--allow-file-access-from-files','--disable-breakpad','--window-size=1440,1000','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
let chromeLog='';chrome.stderr.on('data',chunk=>{chromeLog+=chunk;});
let id=0,session,buffer='';const pending=new Map(),errors=[];
const call=(method,params={},browser=false)=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(new Error('Chrome protocol timeout: '+method+' '+chromeLog.slice(-1500)));},30000);pending.set(key,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});chrome.stdio[3].write(JSON.stringify({id:key,method,params,...(!browser&&session?{sessionId:session}:{})})+'\0');});
chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const data=JSON.parse(raw);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);if(data.error)entry?.reject(new Error(JSON.stringify(data.error)));else entry?.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description??data.params.exceptionDetails.text);}});
chrome.on('error',error=>{for(const entry of pending.values())entry.reject(error);pending.clear();});
chrome.once('exit',(code,signal)=>{for(const entry of pending.values())entry.reject(new Error(`Chrome exited during browser verification (code ${code}, signal ${signal}). ${chromeLog.slice(-1500)}`));pending.clear();});
try {
 const page=await call('Target.createTarget',{url:harnessUrl},true);
 session=(await call('Target.attachToTarget',{targetId:page.targetId,flatten:true},true)).sessionId;
 await call('Target.activateTarget',{targetId:page.targetId},true);
 const evaluate=async(expression)=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
 await call('Runtime.enable');await call('Page.enable');await call('Page.bringToFront');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 async function until(expression,timeout=8000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await evaluate(expression))return;await sleep(100);}throw new Error('Timed out: '+expression);}
 await until('!!globalThis.__pncTest');
 assert.equal(await evaluate('document.visibilityState'),'visible','Harness must be active for animation clocks');
 const engine=await evaluate('globalThis.__pncTest.runAll()');console.log('Chrome animation checks:',engine);
 await call('Page.navigate',{url:studioUrl});await until('document.querySelectorAll(".preset-card").length===8');await sleep(500);
 const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:document.querySelectorAll(".preset-card").length})');assert.equal(layout.cards,8);assert.ok(layout.scroll<=layout.width,'Desktop horizontal overflow');
 for(const name of ['Dealer Flick','Orbit Deal','Triple Spread','Triple Orbit','Crystal Spread','Slam / Impact','Fragment Assembly','Crystallization Reveal']) {
  const clicked=await evaluate(`(()=>{const button=[...document.querySelectorAll('.preset-preview-button')].find(x=>x.getAttribute('aria-label').includes(${JSON.stringify(name)}));if(!button)return false;button.click();return true})()`);
  if(!clicked)throw new Error('Missing preview button: '+name);
  await sleep(250);
  await until('!document.querySelector("[aria-label=\"Pause animation\"]")',12000);
 }
 const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('artifacts/studio.png',Buffer.from(screenshot.data,'base64'));
 // Settings persist and survive a reload of the standalone development studio.
 await evaluate('[...document.querySelectorAll(".nav-item")].find(x=>x.textContent==="Settings").click()');
 await evaluate('document.querySelector("[aria-label=\"Reduced motion\"]").click()');await sleep(600);
 await call('Page.reload');await until('document.querySelectorAll(".nav-item").length===6');await sleep(500);
 await evaluate('[...document.querySelectorAll(".nav-item")].find(x=>x.textContent==="Settings").click()');
 assert.equal(await evaluate('document.querySelector("[aria-label=\"Reduced motion\"]").getAttribute("aria-checked")'),'true');
 await call('Emulation.setDeviceMetricsOverride',{width:1100,height:900,deviceScaleFactor:1,mobile:false});await sleep(200);
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Small desktop horizontal overflow');
 assert.deepEqual(errors,[],'Unexpected browser runtime errors');
 await writeFile('artifacts/browser-results.json',JSON.stringify({date:new Date().toISOString(),browser:await call('Browser.getVersion'),engine,layout,checks:['all8 source restoration','pause/resume','cancel','reduced motion','detach','resize','prepare failure','studio all8 preview','settings persistence','1440/1100 desktop layout'],errors},null,2));
 console.log('Browser checks passed; screenshot artifacts/studio.png');
} finally {chrome.kill('SIGTERM');for(const entry of pending.values())entry.reject(new Error('Browser test ended'));pending.clear();await sleep(400);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});}
