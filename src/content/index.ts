import { PokerNowAdapter } from '../adapter/pokernow';
import { describeUnsupported, inspectLayout, type ObservedLayout } from '../adapter/pokernow/diagnostics';
import { AnimationCoordinator } from '../animation/core/coordinator';
import { loadLibrary, subscribeLibrary } from '../storage/library';
import { resolveThemeAssets } from '../storage/assets';
import type { RuntimeStatus } from '../storage/diagnostics';
import type { Library, Theme } from '../types';
import { TablePresentation } from './presentation';

const VERSION='0.1.1';
const runtime=globalThis as typeof globalThis & {__pncCleanup?:()=>void};
runtime.__pncCleanup?.();
const host=document.createElement('div');
host.setAttribute('data-pnc-overlay','runtime');host.setAttribute('aria-hidden','true');
host.style.cssText='position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:visible;';
const shadow=host.attachShadow({mode:'closed'}),surface=document.createElement('div');
surface.setAttribute('data-pnc-overlay','surface');
surface.style.cssText='position:fixed;inset:0;pointer-events:none;overflow:visible;';
shadow.append(surface);document.documentElement.append(host);
const coordinator=new AnimationCoordinator(surface),presentation=new TablePresentation();
let library:Library|undefined,theme:Theme|undefined;
let stopped=false,suspended=false,revision=0,appearanceActive=false;
let imageWarning='';
let status:RuntimeStatus={state:'starting',reason:'The content script is loading extension settings.',tableCount:0,boardCount:0,seatCount:0,cardCount:0,observedAt:Date.now(),version:VERSION};
let lastSignature='';
function publish(state:RuntimeStatus['state'],reason:string,layout:ObservedLayout=inspectLayout(document)):void {
 status={...layout,state,reason:(reason+(imageWarning?' '+imageWarning:'')).slice(0,600),observedAt:Date.now(),version:VERSION};
 host.dataset.pncState=state;
 const signature=JSON.stringify({...status,observedAt:0});
 if(signature===lastSignature)return;lastSignature=signature;
 void chrome.runtime.sendMessage({type:'pnc.runtime.status',status}).catch(()=>{});
}
const adapter=new PokerNowAdapter({
 onInvalidate:()=>coordinator.cancelAll(),
 onPresentation:snapshot=>{
  appearanceActive=!!snapshot&&!!theme&&!!library?.settings.enabled;
  if(snapshot&&theme&&library?.settings.enabled)presentation.apply(snapshot,theme);
  else presentation.clear();
 },
 onUnsupported:()=>publish('unsupported',describeUnsupported(inspectLayout(document),appearanceActive)),
 onSnapshot:snapshot=>publish('ready',"Table appearance is active. New observable card events are being monitored; existing cards do not replay.",{profile:snapshot.profile,tableCount:1,boardCount:1,seatCount:snapshot.seats.length,cardCount:snapshot.board.length+snapshot.holes.length}),
 onEvent:event=>{
  if(!theme||!library?.settings.enabled)return;
  if(event.type==='TABLE_READY'||event.type==='HAND_VISUAL_RESET'){coordinator.cancelAll();return;}
  try {void coordinator.play(event,theme,{speed:library.settings.speed,reducedMotion:library.settings.reducedMotion}).finished.catch(()=>coordinator.cancelAll());}
  catch {coordinator.cancelAll();publish('error','An animation could not start; the original cards remain available.');}
 },
});
async function applyLibrary(next:Library):Promise<void> {
 const currentRevision=++revision;
 coordinator.cancelAll();adapter.stop();presentation.clear();appearanceActive=false;
 library=next;theme=undefined;imageWarning='';
 if(stopped||suspended)return;
 if(!next.settings.enabled){publish('disabled','Customization is switched off in the extension studio.');return;}
 const selected=next.themes.find(candidate=>candidate.id===next.settings.activeThemeId)??next.themes[0];
 if(!selected){publish('error','No usable theme is selected. Restore defaults in the extension studio.');return;}
 publish('starting','Loading the selected theme and looking for the PokerNow table.');
 let resolved:Theme;
 try {resolved=await resolveThemeAssets(selected);}
 catch {
  // Missing assets must never disable unrelated colors, backs or animations.
  resolved=structuredClone(selected);delete resolved.card.backImage;delete resolved.table.backgroundImage;
  if(resolved.card.back==='image')resolved.card.back='solid';
  imageWarning='An uploaded image could not load; other customizations continue. Re-upload that image in the studio.';
 }
 if(currentRevision!==revision||stopped||suspended)return;
 theme=resolved;adapter.start();
}
const unsubscribe=subscribeLibrary(next=>{void applyLibrary(next);});
void loadLibrary().then(applyLibrary).catch(()=>{presentation.clear();publish('error','Saved settings could not be loaded. Open the extension studio and use Restore local defaults.');});
const probe=(message:unknown,sender:{id?:string},sendResponse:(response:unknown)=>void):void=>{
 if(sender.id!==chrome.runtime.id||!message||typeof message!=='object'||(message as {type?:unknown}).type!=='pnc.runtime.probe')return;
 if(library?.settings.enabled&&theme&&!suspended)adapter.scan();
 sendResponse({...status,observedAt:Date.now()});
};
chrome.runtime.onMessage.addListener(probe);
function cleanup():void {
 if(stopped)return;stopped=true;revision++;
 unsubscribe();adapter.stop();coordinator.dispose();presentation.clear();host.remove();
 chrome.runtime.onMessage.removeListener(probe);
 window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);
 delete runtime.__pncCleanup;
}
function pagehide(event:PageTransitionEvent):void {
 if(!event.persisted){cleanup();return;}
 suspended=true;revision++;adapter.stop();coordinator.cancelAll();presentation.clear();
}
function pageshow(event:PageTransitionEvent):void {
 if(!event.persisted||stopped)return;suspended=false;
 void loadLibrary().then(applyLibrary).catch(()=>publish('error','Saved settings could not be loaded after restoring this tab.'));
}
runtime.__pncCleanup=cleanup;
window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
publish('starting','The content script is loading extension settings.');
