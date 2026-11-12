import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir('artifacts',{recursive:true});
await build({entryPoints:['tests/browser-harness.ts'],bundle:true,format:'iife',target:'chrome120',outfile:'.test-build/browser-harness.js'});
await writeFile('.test-build/browser-harness.html','<!doctype html><html><head><title>Engine fixture</title></head><body><script src="./browser-harness.js"></script></body></html>');
// Serve local fixtures over loopback; managed Chrome may disallow file URLs.
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  const relative=decodeURIComponent(url.pathname).slice(1);
  const file=path.resolve(relative);
  if(!file.startsWith(path.resolve('dist')+path.sep)&&!file.startsWith(path.resolve('.test-build')+path.sep)) {res.writeHead(403).end();return;}
  const body=await readFile(file);
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'text/html');
  res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const harnessUrl=base+'/.test-build/browser-harness.html';
const studioUrl=base+'/dist/index.html';
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
 const page=await call('Target.createTarget',{url:'about:blank'},true);
 session=(await call('Target.attachToTarget',{targetId:page.targetId,flatten:true},true)).sessionId;
 await call('Target.activateTarget',{targetId:page.targetId},true);
 const evaluate=async(expression)=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
 await call('Runtime.enable');await call('Page.enable');await call('Page.bringToFront');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 async function until(expression,timeout=8000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await evaluate(expression))return;await sleep(100);}throw new Error('Timed out: '+expression+' '+JSON.stringify({errors, page:await evaluate('({url:location.href,body:document.body?.innerText})'),chromeLog:chromeLog.slice(-2000)}));}
 await call('Page.navigate',{url:harnessUrl});
 await until('!!globalThis.__pncTest');
 assert.equal(await evaluate('document.visibilityState'),'visible','Harness must be active for animation clocks');
 const engine=await evaluate('globalThis.__pncTest.runAll()');console.log('Chrome animation checks:',engine);
 const assembly=await evaluate('(async()=>{globalThis.__assembly=await globalThis.__pncTest.assemblyFrames(); return globalThis.__assembly.frames;})()');
 console.log('Assembly handoff geometry:',assembly);
 for(const t of [.94,.984,.985]) {
  await evaluate(`globalThis.__assembly.sample(${t})`);
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`artifacts/assembly-${t}.png`,Buffer.from(shot.data,'base64'));
 }
 await evaluate('globalThis.__assembly.clear()');
 await call('Page.navigate',{url:studioUrl});await until('document.querySelectorAll(".preset-card").length===20');await sleep(500);
 const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:document.querySelectorAll(".preset-card").length})');assert.equal(layout.cards,20);assert.ok(layout.scroll<=layout.width,'Desktop horizontal overflow');
 for(const name of ['Dealer Flick','Orbit Deal','Triple Spread','Triple Orbit','Crystal Spread','Slam / Impact','Fragment Assembly','Crystallization Reveal','House Pitch','Silk Cascade','Velvet Turnover','River Squeeze',"Dealer's Storm",'Grand Flop','Spotlight','Showdown','Puppy Deal','Puppy Flop','Puppy Fetch','Puppy Paw']) {
  const clicked=await evaluate(`(()=>{const button=[...document.querySelectorAll('.preset-preview-button')].find(x=>x.getAttribute('aria-label').includes(${JSON.stringify(name)}));if(!button)return false;button.click();return true})()`);
  if(!clicked)throw new Error('Missing preview button: '+name);
  await sleep(250);
  await until(`!document.querySelector('[aria-label="Pause animation"]')`,12000);
 }
 await evaluate(`document.querySelector('[aria-label="Select Random"]').click()`);
 assert.equal(await evaluate(`document.querySelector('[aria-label="Select Random"]').getAttribute('aria-pressed')`),'true');
 await evaluate(`document.querySelector('[aria-label="Replay animation"]').click()`);
 await sleep(250);
 await until(`!document.querySelector('[aria-label="Pause animation"]')`,12000);
 await sleep(500);
 await call('Page.reload');await until('document.querySelectorAll(".preset-card").length===20');
 // Reload selects the studio's initial event, so return to the saved random turn.
 await evaluate(`Array.from(document.querySelectorAll('[role="tab"]')).find(x=>x.textContent==='Turn').click()`);
 assert.equal(await evaluate(`document.querySelector('[aria-label="Select Random"]').getAttribute('aria-pressed')`),'true');
 const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('artifacts/studio.png',Buffer.from(screenshot.data,'base64'));
 // Settings persist and survive a reload of the standalone development studio.
 await evaluate('[...document.querySelectorAll(".nav-item")].find(x=>x.textContent==="Settings").click()');
 await evaluate(`document.querySelector('[aria-label="Reduced motion"]').click()`);await sleep(600);
 await call('Page.reload');await until('document.querySelectorAll(".nav-item").length===6');await sleep(500);
 await evaluate('[...document.querySelectorAll(".nav-item")].find(x=>x.textContent==="Settings").click()');
 assert.equal(await evaluate(`document.querySelector('[aria-label="Reduced motion"]').getAttribute('aria-checked')`),'true');
 await call('Emulation.setDeviceMetricsOverride',{width:1100,height:900,deviceScaleFactor:1,mobile:false});await sleep(200);
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Small desktop horizontal overflow');
 await call('Page.navigate',{url:base+'/dist/preview.html'});
 await until('!!globalThis.__pncReplica');
 await sleep(400);
 assert.equal(await evaluate('document.documentElement.getAttribute("data-pnc-skin")'),'on');
 assert.equal(await evaluate('document.querySelectorAll(".table-player").length'),6);
 const rooms=await evaluate('Array.from(document.querySelector("select").options).map(x=>x.value)');
 for (const room of rooms) {
  await evaluate(`(()=>{const select=document.querySelector('select');select.value=${JSON.stringify(room)};select.dispatchEvent(new Event('change'));})()`);
  await sleep(200);
  const image=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(`artifacts/room-${room}.png`,Buffer.from(image.data,'base64'));
 }
 await evaluate(`(()=>{const r=globalThis.__pncReplica.runtime;const theme=structuredClone(r.state.theme);theme.card.aura={enabled:true,color:'#f0c77a',strength:.65};r.configure(theme,r.state.settings);r.scan();})()`);
 assert.ok(await evaluate(`document.querySelector('[data-pnc-owned="live"]').textContent.includes('card-container::after')`),'Made pair must activate hero aura');
 const aura=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 await writeFile('artifacts/hand-aura.png',Buffer.from(aura.data,'base64'));
 await evaluate(`(()=>{const r=globalThis.__pncReplica.runtime;const theme=structuredClone(r.state.theme);theme.card.aura.enabled=false;r.configure(theme,r.state.settings);r.scan();})()`);
 assert.equal(await evaluate(`document.querySelector('[data-pnc-owned="live"]').textContent.includes('card-container::after')`),false,'Aura toggle must remove glow');
 // No original card may show before its animation takes over (live flop arrives face down, turned 150 ms apart).
 const handoff=[];
 for (const street of ['deal','flop','turn','river']) handoff.push(await evaluate(`(async()=>{const R=globalThis.__pncReplica;let done=false;R.stop();R.scenario.prepare(${JSON.stringify(street)});R.runtime.scan();await new Promise(r=>setTimeout(r,300));
  R.onAnimation(h=>{h.finished.then(()=>{done=true;});});const sel=${JSON.stringify(street)}==='deal'?'.table-player-cards .card-container':'.table-cards .card-container';const before=new Set(document.querySelectorAll(sel));let leaks=0;const t0=performance.now();
  const loop=()=>{for(const c of document.querySelectorAll(sel)){if(before.has(c))continue;const cs=getComputedStyle(c);if(!done&&cs.visibility!=='hidden'&&Number(cs.opacity)>.01)leaks++;}if(performance.now()-t0<4400)requestAnimationFrame(loop);};requestAnimationFrame(loop);
  R.scenario.reveal(${JSON.stringify(street)});await new Promise(r=>setTimeout(r,4600));R.onAnimation(undefined);return {street:${JSON.stringify(street)},leaks,animated:done};})()`));
 console.log('Card hand-off:',handoff);
 for (const result of handoff) { assert.equal(result.leaks,0,`${result.street} cards showed before their animation`); assert.ok(result.animated,`${result.street} did not animate`); }
 await evaluate('void globalThis.__pncReplica.scenario.playHand(2)');
 await sleep(2000);
 const motion=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 await writeFile('artifacts/room-motion.png',Buffer.from(motion.data,'base64'));
 await sleep(18000);
 assert.ok(await evaluate('document.querySelectorAll(".table-player.winner").length > 0'),'Scripted hand must reach its winner');
 // Puppy: the companion appears, idles at a throttled frame rate, runs the deal, and is removed on a skin switch.
 await evaluate(`(()=>{const select=document.querySelector('select');select.value='room-puppy';select.dispatchEvent(new Event('change'));})()`);
 await until('!!globalThis.__pncReplica.runtime.companionDebug()?.visible',15000);
 await sleep(1500);
 const before=await evaluate('globalThis.__pncReplica.runtime.companionDebug().renders');await sleep(2000);
 const idleRate=(await evaluate('globalThis.__pncReplica.runtime.companionDebug().renders')-before)/2;
 assert.ok(idleRate>0&&idleRate<=40,`Idle puppy should render at a throttled rate, got ${idleRate}/s`);
 const puppyStates=await evaluate(`(async()=>{const R=globalThis.__pncReplica;const seen=new Set();R.play('deal');const t=performance.now();while(performance.now()-t<4200){seen.add(R.runtime.companionDebug()?.state);await new Promise(r=>setTimeout(r,40));}return [...seen];})()`);
 console.log('Puppy states during the deal:',puppyStates,'idle renders/s:',idleRate);
 assert.ok(puppyStates.includes('DEALING'),'The puppy must deal the cards');
 assert.ok(puppyStates.includes('RUNNING'),'The puppy must run to the deck');
 const puppyShot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/puppy.png',Buffer.from(puppyShot.data,'base64'));
 // A long think puts the puppy to sleep; the clock running low (PokerNow's red timer) startles it awake.
 const tank=await evaluate(`(async()=>{const R=globalThis.__pncReplica;R.rest('turn');await new Promise(r=>setTimeout(r,1500));const seat=R.scenario.state.seats[2];seat.deciding=true;seat.timer={normal:60,bank:20};R.scenario.render();R.runtime.scan();
  const t=performance.now();while(performance.now()-t<12000&&R.runtime.companionDebug().state!=='SLEEPING')await new Promise(r=>setTimeout(r,100));const asleep=R.runtime.companionDebug().state;
  seat.timer={normal:4,bank:0,red:true};R.scenario.render();const seen=new Set();const u=performance.now();while(performance.now()-u<1200){seen.add(R.runtime.companionDebug().state);await new Promise(r=>setTimeout(r,40));}
  seat.deciding=false;seat.timer=undefined;R.scenario.render();return {asleep,after:[...seen]};})()`);
 console.log('Tanking:',tank);
 assert.equal(tank.asleep,'SLEEPING','A long think should put the puppy to sleep');
 assert.ok(tank.after.includes('STARTLED'),'The low-time warning should wake the puppy with a start');
 // A reused board slot (filled and turned over in place) is held again before it can paint.
 const reused=await evaluate(`(async()=>{const R=globalThis.__pncReplica;R.rest('turn');await new Promise(r=>setTimeout(r,400));const board=document.querySelector('.table-cards');const slot=board.querySelector('.card-container').cloneNode(true);
  slot.removeAttribute('data-pnc-released');slot.classList.remove('flipped');slot.classList.add('not-visible');board.append(slot);R.runtime.scan();await new Promise(r=>setTimeout(r,300));const released=slot.hasAttribute('data-pnc-released');
  slot.classList.remove('not-visible');slot.classList.add('flipped');await new Promise(r=>requestAnimationFrame(r));const opacity=getComputedStyle(slot).opacity;slot.remove();return {released,opacity};})()`);
 assert.ok(reused.released,'An empty slot is released'); assert.equal(reused.opacity,'0','A reused slot must be held when it turns over');
 await evaluate(`(()=>{const s=globalThis.__pncReplica.scenario;s.state.decisions={attention:true,buttons:[{label:'Check',kind:'check',color:'green'}]};s.render();globalThis.__controlClicks=0;document.querySelector('.action-button').onclick=()=>globalThis.__controlClicks++;})()`);
 const control=await evaluate(`(()=>{const b=document.querySelector('.action-button');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',...control,button:'left',clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',...control,button:'left',clickCount:1});
 assert.equal(await evaluate('globalThis.__controlClicks'),1,'Overlay must not block game controls');
 await evaluate(`(()=>{const select=document.querySelector('select');select.value='room-monte-carlo';select.dispatchEvent(new Event('change'));})()`);
 await sleep(400);
 assert.equal(await evaluate('globalThis.__pncReplica.runtime.companionDebug()'),undefined,'Switching skins must remove the puppy');
 // Another room with a puppy animation: the puppy visits for that animation only, then leaves.
 const visit=await evaluate(`(async()=>{const R=globalThis.__pncReplica;const theme=structuredClone(R.runtime.state.theme);theme.animations.flop={preset:'flop.puppy',parameters:{}};R.configure(theme,R.settings);
  const t=performance.now();while(!R.runtime.companionDebug()&&performance.now()-t<8000)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,400));R.rest('turn');await new Promise(r=>setTimeout(r,400));
  const hiddenBefore=!R.runtime.companionDebug().visible;let shown=false;R.play('flop');const u=performance.now();while(performance.now()-u<3500){shown||=R.runtime.companionDebug().visible;await new Promise(r=>setTimeout(r,50));}
  const v=performance.now();while(R.runtime.companionDebug().visible&&performance.now()-v<6000)await new Promise(r=>setTimeout(r,100));
  return {hiddenBefore,shown,goneAfter:!R.runtime.companionDebug().visible,state:R.runtime.companionDebug().state};})()`);
 console.log('Visiting puppy:',visit);
 assert.ok(visit.hiddenBefore&&visit.shown&&visit.goneAfter,'A visiting puppy appears for its animation and then leaves');
 await evaluate('globalThis.__pncReplica.runtime.dispose()');
 assert.equal(await evaluate('document.querySelectorAll("[data-pnc-overlay], [data-pnc-owned]").length'),0);
 assert.deepEqual(errors,[],'Unexpected browser runtime errors');
 await writeFile('artifacts/browser-results.json',JSON.stringify({date:new Date().toISOString(),browser:await call('Browser.getVersion'),engine,layout,checks:['all12 source restoration','pause/resume','cancel','reduced motion','detach','resize','prepare failure','studio all12 preview','settings persistence','1440/1100 desktop layout'],errors},null,2));
 console.log('Browser checks passed; screenshot artifacts/studio.png');
} finally {server.close();chrome.kill('SIGTERM');for(const entry of pending.values())entry.reject(new Error('Browser test ended'));pending.clear();await sleep(400);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});}
