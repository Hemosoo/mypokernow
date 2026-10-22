import { z } from 'zod';
const count=z.number().int().min(0).max(10000);
export const runtimeStatusSchema=z.object({
  tabId:z.number().int().optional(),state:z.enum(['starting','ready','unsupported','disabled','error']),
  reason:z.string().max(600),profile:z.string().max(80).optional(),
  tableCount:count,boardCount:count,seatCount:count,cardCount:count,
  observedAt:z.number().finite(),version:z.string().max(30),
}).strict();
export type RuntimeStatus=z.infer<typeof runtimeStatusSchema>;
export interface RuntimeInspection {context:'extension'|'standalone';statuses:RuntimeStatus[]}
export function isExtensionStudio():boolean {
 return typeof chrome!=='undefined'&&!!chrome.runtime?.id&&typeof location!=='undefined'&&location.protocol==='chrome-extension:';
}
export async function inspectRuntime():Promise<RuntimeInspection> {
 if(!isExtensionStudio())return {context:'standalone',statuses:[]};
 const response=await chrome.runtime.sendMessage({type:'pnc.runtime.inspect'}) as {statuses?:unknown}|undefined;
 if(!response||!Array.isArray(response.statuses))throw new Error('The extension background is unavailable. Reload the extension and reopen its studio.');
 return {context:'extension',statuses:response.statuses.map(value=>runtimeStatusSchema.parse(value))};
}
