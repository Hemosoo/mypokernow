// No popup or game-page settings controls. The action opens a full extension tab.
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({url: chrome.runtime.getURL('index.html')});
});

// Content scripts use the host page's IndexedDB origin. Serve bounded image data
// from the extension origin rather than looking for studio assets on PokerNow.
import { isAssetRequest, respondToAsset } from './assets';
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isAssetRequest(message)) return;
  void respondToAsset(message).then(sendResponse);
  return true; // Keep the MV3 message channel alive during the IndexedDB read.
});

import { recordRuntimeStatus, inspectConnectedTabs } from './diagnostics';
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if(sender.id!==chrome.runtime.id||!message||typeof message!=='object')return;
  const request=message as {type?:unknown;status?:unknown};
  if(request.type==='pnc.runtime.status'&&sender.tab?.id!==undefined) {
    let host='';try {host=new URL(sender.url??'').hostname;}catch{return;}
    if(host!=='pokernow.com'&&host!=='www.pokernow.com')return;
    void recordRuntimeStatus(request.status,sender.tab.id).then(()=>sendResponse({ok:true}),()=>sendResponse({ok:false}));return true;
  }
  if(request.type==='pnc.runtime.inspect') {
    void inspectConnectedTabs().then(sendResponse,()=>sendResponse({statuses:[]}));return true;
  }
});
