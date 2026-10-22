import { runtimeStatusSchema, type RuntimeStatus } from '../storage/diagnostics';
const KEY='pnc.runtime.statuses.v1';
let updates=Promise.resolve();
export function recordRuntimeStatus(value:unknown,tabId:number):Promise<void> {
 const parsed=runtimeStatusSchema.safeParse(value);if(!parsed.success)return Promise.resolve();
 const status={...parsed.data,tabId,observedAt:Date.now()};
 const update=updates.then(async()=>{
  const stored=(await chrome.storage.session.get(KEY))[KEY];
  const previous=Array.isArray(stored)?stored.map(value=>runtimeStatusSchema.safeParse(value)).filter(value=>value.success).map(value=>value.data!):[];
  const statuses=[status,...previous.filter(item=>item.tabId!==tabId)].slice(0,20);
  await chrome.storage.session.set({[KEY]:statuses});
 });updates=update.catch(()=>{});return update;
}
export async function inspectConnectedTabs():Promise<{statuses:RuntimeStatus[]}> {
 await updates;const stored=(await chrome.storage.session.get(KEY))[KEY];
 const previous=Array.isArray(stored)?stored:[];
 const statuses=await Promise.all(previous.map(async(value):Promise<RuntimeStatus|undefined>=>{
  const entry=runtimeStatusSchema.safeParse(value);if(!entry.success||entry.data.tabId===undefined)return;
  try {
   const response=await chrome.tabs.sendMessage(entry.data.tabId,{type:'pnc.runtime.probe'});
   const status=runtimeStatusSchema.safeParse(response);return status.success?{...status.data,tabId:entry.data.tabId}:undefined;
  }catch{return;}
 }));
 return {statuses:statuses.filter((status):status is RuntimeStatus=>!!status)};
}
