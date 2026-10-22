import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRuntime, runtimeStatusSchema, type RuntimeStatus } from '../src/storage/diagnostics';
import { inspectConnectedTabs, recordRuntimeStatus } from '../src/background/diagnostics';
const status=(reason='Table appearance is active.'):RuntimeStatus=>({state:'ready',reason,tableCount:1,boardCount:1,seatCount:2,cardCount:7,observedAt:Date.now(),version:'0.1.1'});
test('connection diagnostics never confuse localhost preview with installed extension configuration',async()=>{
 const previous=new Map<string,PropertyDescriptor|undefined>();let called=0;
 for(const [key,value]of Object.entries({location:{protocol:'http:'},chrome:{runtime:{id:'fixture',sendMessage:async()=>{called++;return {statuses:[status()]};}}}})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 try {
  assert.deepEqual(await inspectRuntime(),{context:'standalone',statuses:[]});assert.equal(called,0);
  Object.defineProperty(globalThis,'location',{value:{protocol:'chrome-extension:'},configurable:true});
  const response=await inspectRuntime();assert.equal(response.context,'extension');assert.equal(response.statuses[0].state,'ready');assert.equal(called,1);
  assert.ok(!runtimeStatusSchema.safeParse({...status(),cardIdentity:'AS'}).success,'Private identity fields must not enter diagnostics');
 }finally{for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
test('worker records concurrent tab updates without losing entries and drops disconnected tabs when probed',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'chrome');const store:Record<string,unknown>={};
 Object.defineProperty(globalThis,'chrome',{configurable:true,value:{storage:{session:{get:async(key:string)=>({[key]:structuredClone(store[key])}),set:async(values:Record<string,unknown>)=>{Object.assign(store,structuredClone(values));}}},tabs:{sendMessage:async(tabId:number)=>{if(tabId===2)throw new Error('Tab closed');return status('Current status from the connected content script.');}}}});
 try {
  await Promise.all([recordRuntimeStatus(status('first'),1),recordRuntimeStatus(status('second'),2)]);
  const stored=Object.values(store)[0] as RuntimeStatus[];assert.equal(stored.length,2);assert.deepEqual(stored.map(s=>s.tabId).sort(),[1,2]);
  const inspected=await inspectConnectedTabs();assert.equal(inspected.statuses.length,1);assert.equal(inspected.statuses[0].tabId,1);assert.equal(inspected.statuses[0].reason,'Current status from the connected content script.');
  await recordRuntimeStatus({...status(),hiddenPayload:'not allowed'},3);assert.equal((Object.values(store)[0] as RuntimeStatus[]).length,2);
 }finally{if(previous)Object.defineProperty(globalThis,'chrome',previous);else Reflect.deleteProperty(globalThis,'chrome');}
});
