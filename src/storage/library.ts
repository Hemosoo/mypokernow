import type { Library } from '../types';
import { createDefaultLibrary } from '../themes/defaults';
import { validateLibrary } from '../themes/schema';
const KEY='pokernow-customizer.library.v1';
const hasChromeStorage=()=>typeof chrome!=='undefined'&&!!chrome.storage?.local;
const listeners=new Set<(library: Library)=>void>();
export async function loadLibrary(): Promise<Library> {
 const stored=hasChromeStorage()?(await chrome.storage.local.get(KEY))[KEY]:JSON.parse(localStorage.getItem(KEY)??'null') as unknown;
 if(stored===undefined || stored===null) return createDefaultLibrary();
 // Invalid persisted data must be reported instead of silently overwriting it.
 return validateLibrary(stored);
}
export async function saveLibrary(library: Library): Promise<void> {
 const clean=validateLibrary(library);
 if(hasChromeStorage()) await chrome.storage.local.set({[KEY]:clean});
 else {localStorage.setItem(KEY,JSON.stringify(clean)); listeners.forEach(callback=>callback(clean));}
}
export function subscribeLibrary(callback: (library: Library)=>void): ()=>void {
 if(hasChromeStorage()) {
  const onChange=(changes: Record<string,ChromeStorageChange>,area: string)=>{
   if(area==='local'&&changes[KEY]?.newValue) {try {callback(validateLibrary(changes[KEY].newValue));} catch(error) {console.warn('PokerNow Customizer ignored invalid storage change',error);}}
  };
  chrome.storage.onChanged.addListener(onChange); return ()=>chrome.storage.onChanged.removeListener(onChange);
 }
 listeners.add(callback);
 const onStorage=(event: StorageEvent)=>{if(event.key===KEY&&event.newValue){try {callback(validateLibrary(JSON.parse(event.newValue)));} catch { /* keep the last validated configuration */ }}};
 window.addEventListener('storage',onStorage); return ()=>{listeners.delete(callback);window.removeEventListener('storage',onStorage);};
}
