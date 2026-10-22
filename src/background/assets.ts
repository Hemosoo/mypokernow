import { readAsset } from '../storage/assets';
export interface AssetRequest {type:'pnc.asset.read'; id:string}
export type AssetResponse = {ok:true; data:string} | {ok:false; error:string};
export function isAssetRequest(value: unknown): value is AssetRequest {
 if(!value||typeof value!=='object')return false;
 const request=value as Record<string,unknown>;
 return Object.keys(request).length===2&&request.type==='pnc.asset.read'&&typeof request.id==='string'&&/^asset:[a-zA-Z0-9-]{1,80}$/.test(request.id);
}
export async function respondToAsset(request: AssetRequest, load: (id:string)=>Promise<string> = readAsset): Promise<AssetResponse> {
 try{return {ok:true,data:await load(request.id)};}catch{return {ok:false,error:'The uploaded image is unavailable in extension storage. Re-upload it in the studio.'};}
}
