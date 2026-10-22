import type { Theme } from '../types';
const DB='pokernow-customizer-assets';
export const MAX_ASSET_BYTES=2*1024*1024;
const allowedTypes=new Set(['image/png','image/jpeg','image/webp']);
function openDatabase(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1); let abandoned=false;
  request.onupgradeneeded=()=>request.result.createObjectStore('assets');
  request.onsuccess=()=>{if(abandoned)request.result.close();else resolve(request.result);}; request.onerror=()=>reject(request.error??new Error('Asset database unavailable'));
  request.onblocked=()=>{abandoned=true;reject(new Error('Close older studio tabs to upgrade the asset database'));};
 });
}
export function validateImageDataUrl(value: string): void {
 if(value.length>Math.ceil(MAX_ASSET_BYTES*4/3)+100 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Use a PNG, JPEG or WebP image up to 2 MB');
 const body=value.slice(value.indexOf(',')+1); let bytes:string;
 try {bytes=atob(body.slice(0,48));} catch {throw new Error('Invalid image encoding');}
 const png=bytes.startsWith('\x89PNG\r\n\x1a\n'), jpeg=bytes.startsWith('\xff\xd8\xff'), webp=bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
 const mime=value.slice(5,value.indexOf(';'));
 if(!(mime==='image/png'&&png||mime==='image/jpeg'&&jpeg||mime==='image/webp'&&webp)) throw new Error('Image content does not match its type');
}
export function validateRasterDimensions(bytes: Uint8Array, mime: string): void {
 const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width=0,height=0;
 if(mime==='image/png'&&bytes.length>=24) {width=data.getUint32(16);height=data.getUint32(20);}
 if(mime==='image/jpeg') {
  let offset=2;
  while(offset+4<bytes.length) {
   if(bytes[offset]!==255)break;while(bytes[offset]===255)offset++;
   const marker=bytes[offset++];if(marker===0xd9||marker===0xda)break;
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   if(offset+2>bytes.length)break;const length=data.getUint16(offset);
   if(length<2||offset+length>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7) {height=data.getUint16(offset+3);width=data.getUint16(offset+5);break;}
   offset+=length;
  }
 }
 if(mime==='image/webp'&&bytes.length>=30) {
  const tag=String.fromCharCode(...bytes.slice(12,16));
  const uint24=(offset:number)=>bytes[offset]+bytes[offset+1]*256+bytes[offset+2]*65536;
  if(tag==='VP8X') {width=uint24(24)+1;height=uint24(27)+1;}
  else if(tag==='VP8L'&&bytes[20]===0x2f) {width=1+(bytes[21]|(bytes[22]&0x3f)<<8);height=1+((bytes[22]>>6)|bytes[23]<<2|(bytes[24]&0xf)<<10);}
  else if(tag==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a) {width=data.getUint16(26,true)&0x3fff;height=data.getUint16(28,true)&0x3fff;}
 }
 if(width>8192||height>8192||width*height>24_000_000)throw new Error('Image dimensions are too large (maximum 24 megapixels)');
}
export async function validateDecodedAsset(dataUrl: string): Promise<void> {
 validateImageDataUrl(dataUrl);
 const header=dataUrl.slice(5,dataUrl.indexOf(';')); const binary=atob(dataUrl.slice(dataUrl.indexOf(',')+1));
 const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
 validateRasterDimensions(bytes,header);
 const bitmap=await createImageBitmap(new Blob([bytes],{type:header}));
 try {if(bitmap.width>8192||bitmap.height>8192||bitmap.width*bitmap.height>24_000_000) throw new Error('Image dimensions are too large (maximum 24 megapixels)');} finally {bitmap.close();}
}
export async function storeAssetData(dataUrl: string): Promise<string> {
 await validateDecodedAsset(dataUrl); const id=`asset:${crypto.randomUUID()}`; const db=await openDatabase();
 try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(dataUrl,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Asset write aborted'));});} finally {db.close();} return id;
}
export async function readAsset(id: string): Promise<string> {
 if(!/^asset:[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid asset reference');
 // Web APIs in a content script belong to the website origin, not the studio.
 // Route only validated local asset IDs to our own extension service worker.
 if(typeof chrome!=='undefined' && chrome.runtime?.id && typeof location!=='undefined' && location.protocol!=='chrome-extension:') {
  const response=await chrome.runtime.sendMessage({type:'pnc.asset.read',id}) as {ok?:boolean; data?:unknown; error?:unknown}|undefined;
  if(!response?.ok || typeof response.data!=='string') throw new Error(typeof response?.error==='string'?response.error:'Extension asset storage is unavailable');
  validateImageDataUrl(response.data);return response.data;
 }
 const db=await openDatabase();
 try {return await new Promise<string>((resolve,reject)=>{const request=db.transaction('assets','readonly').objectStore('assets').get(id); request.onsuccess=()=>{if(typeof request.result!=='string')reject(new Error('An uploaded image is missing. Re-upload it in the studio.'));else {try {validateImageDataUrl(request.result);resolve(request.result);}catch(error){reject(error);}}}; request.onerror=()=>reject(request.error);});} finally {db.close();}
}
export async function saveAsset(file: File): Promise<string> {
 if(!allowedTypes.has(file.type)||file.size>MAX_ASSET_BYTES) throw new Error('Use a PNG, JPEG or WebP image up to 2 MB');
 const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
 validateImageDataUrl(dataUrl);

 return storeAssetData(dataUrl);
}
export async function resolveThemeAssets(theme: Theme): Promise<Theme> {
 const resolved=structuredClone(theme);
 const refs=[resolved.card.backImage,resolved.table.backgroundImage];
 const values=await Promise.all(refs.map(ref=>ref?readAsset(ref):undefined));
 resolved.card.backImage=values[0]; resolved.table.backgroundImage=values[1]; return resolved;
}
export async function pruneAssets(themes: Theme[]): Promise<void> {
 const keep=new Set(themes.flatMap(t=>[t.card.backImage,t.table.backgroundImage]).filter(Boolean)); const db=await openDatabase();
 try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets'),request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){if(!keep.has(String(cursor.key)))cursor.delete();cursor.continue();}};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally {db.close();}
}
