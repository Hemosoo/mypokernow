import { AnimationCoordinator } from '../src/animation/core/coordinator';
import { presets, getPreset } from '../src/animation/registry';
import { createDefaultTheme } from '../src/themes/defaults';
import { cardDataUrl } from '../src/rendering/cards';
import { eventForStreet } from '../src/types';
import type { CardIdentity, Street, VisualEvent } from '../src/types';

const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const require=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
async function leased(input:VisualEvent):Promise<void>{
 const deadline=performance.now()+1500;
 while(!input.cards.every(card=>card.source?.style.visibility==='hidden')){
  if(performance.now()>deadline)throw new Error('Card artwork did not decode and acquire visibility leases');
  await wait(10);
 }
}
const theme=createDefaultTheme();
const scene=document.createElement('main');
scene.style.cssText='position:fixed;inset:40px;background:#183c35;border-radius:180px;border:18px solid #292a35';
document.body.style.cssText='background:#101219;color:#fff;margin:0';
document.body.append(scene);
const host=document.createElement('div');document.body.append(host);
const engine=new AnimationCoordinator(host);
let generation=0;
function event(street:Street):VisualEvent {
 scene.replaceChildren();
 const count=street==='deal'?12:street==='flop'?3:1;
 const identities:CardIdentity[]=[{rank:'A',suit:'spades'},{rank:'K',suit:'hearts'},{rank:'7',suit:'clubs'}];
 const cards=Array.from({length:count},(_,index)=>{
  const source=document.createElement('div');
  const seat=index%6,round=Math.floor(index/6);
  const angle=Math.PI/2+seat/6*Math.PI*2;
  const x=street==='deal'?innerWidth/2+Math.cos(angle)*(innerWidth*.32)+round*30:innerWidth/2+(index-1)*90;
  const y=street==='deal'?innerHeight/2+Math.sin(angle)*(innerHeight*.32):innerHeight/2-60;
  source.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:70px;height:98px;background-size:100% 100%;`;
  source.style.setProperty('visibility','visible','important');
  const identity=street==='deal'&&seat!==0?undefined:identities[index%3];
  source.style.backgroundImage=`url("${cardDataUrl(identity,theme.card)}")`;scene.append(source);
  const rect=source.getBoundingClientRect();return {id:`${street}-${index}`,identity,source,seatId:`seat-${seat}`,round,target:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
 });
 return {id:`browser-${generation++}`,type:eventForStreet[street],cards,timestamp:Date.now(),origin:{x:innerWidth*.45,y:innerHeight*.3,z:0}};
}
async function runAll(){
 const result:{preset:string;objects:number;duration:number}[]=[];
 for(const preset of presets){
  const input=event(preset.supportedEvents[0]);const started=performance.now();
  const handle=engine.play(input,theme,{presetId:preset.id,speed:2});
  await leased(input);const objects=host.querySelectorAll('*').length;
  require(objects>0,`${preset.id}: no visual objects`);
  require(input.cards.every(c=>c.source?.style.visibility==='hidden'),`${preset.id}: source lease missing`);
  await handle.finished;
  require(input.cards.every(c=>c.source?.style.visibility==='visible'&&c.source.style.getPropertyPriority('visibility')==='important'),`${preset.id}: original styles not restored`);
  require(input.cards.every(card=>!card.source?.hasAttribute('data-pnc-concealed')),`${preset.id}: concealment stranded`);
  require(host.childElementCount===0,`${preset.id}: temporary overlay remained`);
  require(!host.querySelector('[style*="will-change"]'),`${preset.id}: animated GPU layers remained`);
  result.push({preset:preset.id,objects,duration:Math.round(performance.now()-started)});
 }
 // Pause/resume must preserve progress and cancellation must restore sources.
 const input=event('flop');const paused=engine.play(input,theme,{presetId:'flop.triple-orbit'});
 await leased(input);await wait(90);paused.pause();const progress=paused.progress;await wait(120);require(paused.progress===progress,'pause clock drifted');paused.resume();await wait(70);require(paused.progress>progress,'resume did not advance');paused.cancel();await paused.finished;
 require(input.cards.every(c=>c.source?.style.visibility==='visible'),'cancel restoration failed');
 const reducedEvent=event('river');await engine.play(reducedEvent,theme,{reducedMotion:true}).finished;require(reducedEvent.cards[0].source?.style.visibility==='visible','reduced motion concealed source');
 const detached=event('turn');const handle=engine.play(detached,theme);await leased(detached);detached.cards[0].source?.remove();await handle.finished;require(detached.cards[0].source?.style.visibility==='visible','detachment restoration failed');
 const resized=event('river');const resize=engine.play(resized,theme);await leased(resized);window.dispatchEvent(new Event('resize'));await resize.finished;require(resized.cards[0].source?.style.visibility==='visible','resize restoration failed');
 const failing=getPreset('flop.triple-spread')!;const originalBuild=failing.build;failing.build=()=>{throw new Error('Deliberate preparation failure');};
 const failed=event('flop');try{await engine.play(failed,theme).finished;}catch{/* failure may reject or fail open */}finally{failing.build=originalBuild;}
 require(failed.cards.every(c=>c.source?.style.visibility==='visible'),'preparation error stranded source');
 return result;
}
(globalThis as typeof globalThis & {__pncTest:unknown}).__pncTest={runAll,engine,event,theme,presets};
