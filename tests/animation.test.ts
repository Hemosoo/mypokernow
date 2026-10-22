import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { partitionArtwork, polygonArea, semanticRegions } from '../src/animation/fragments/geometry';
import { cubic, cubicTangent, formationAt, peelFrom, point } from '../src/animation/primitives/motion';
import { presets } from '../src/animation/registry';
import { cardObject } from '../src/animation/primitives/objects';
import { createDefaultTheme } from '../src/themes/defaults';
import { eventForStreet } from '../src/types';
import type { CardIdentity, Rank, VisualCard, VisualEvent } from '../src/types';

const near=(a:number,b:number,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('20–40 physical fragments partition exactly one whole artwork at every count',()=>{
 for(let count=20;count<=40;count++) {
  const pieces=partitionArtwork(count);assert.equal(pieces.length,count);near(pieces.reduce((sum,p)=>sum+polygonArea(p.polygon),0),1);
  assert.ok(pieces.every(p=>p.area>0&&p.polygon.every(v=>v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1)));
 }
});
test('semantic region geometry covers one card and keeps court artwork coherent',()=>{
 for(const rank of ['A','2','8','10','J','Q','K'] as Rank[]) {
  const pieces=semanticRegions({rank,suit:'hearts'});near(pieces.flatMap(p=>p.polygons).reduce((sum,p)=>sum+polygonArea(p),0),1);
  assert.equal(pieces.filter(p=>p.kind==='rank').length,2);
  if(['J','Q','K'].includes(rank))assert.equal(pieces.filter(p=>p.kind==='artwork').length,1);
 }
});
test('motion endpoints and peel derivatives preserve continuity and zero landing velocity',()=>{
 const a=point(1,2,3),b=point(6,8,30),c=point(9,10,15),d=point(25,35,0);
 assert.deepEqual(cubic(a,b,c,d,0),a);assert.deepEqual(cubic(a,b,c,d,1),d);assert.deepEqual(cubicTangent(a,b,c,d,0),point(15,18,81));
 const formation={center:point(500,300),radiusX:120,radiusY:55,depth:45,phase:0,arc:Math.PI*1.4};
 const path=(t:number)=>formationAt(formation,t,.5),departure=.55,end=.96,epsilon=.00001;
 assert.deepEqual(peelFrom(path,departure,end,d,departure),path(departure));assert.deepEqual(peelFrom(path,departure,end,d,1),d);
 const left=peelFrom(path,departure,end,d,departure-epsilon),at=peelFrom(path,departure,end,d,departure),right=peelFrom(path,departure,end,d,departure+epsilon);
 near((at.x-left.x)/epsilon,(right.x-at.x)/epsilon,.2);near((at.y-left.y)/epsilon,(right.y-at.y)/epsilon,.2);
 const almost=peelFrom(path,departure,end,d,end-epsilon);assert.ok(Math.hypot(almost.x-d.x,almost.y-d.y)<1e-5);
});
test('all eight compositions remain finite across extreme schema values and 2/10-player layouts',()=>{
 const {JSDOM}=createRequire(import.meta.url)('jsdom');const dom=new JSDOM('<!doctype html><body></body>');
 Object.assign(globalThis,{document:dom.window.document,HTMLElement:dom.window.HTMLElement,DOMParser:dom.window.DOMParser,XMLSerializer:dom.window.XMLSerializer});
 const theme=createDefaultTheme();assert.equal(presets.length,8);assert.equal(new Set(presets.map(p=>p.id)).size,8);
 for(const preset of presets)for(const extreme of ['min','default','max'] as const)for(const seats of [2,10]) {
  const street=preset.supportedEvents[0];const length=street==='deal'?seats*2:street==='flop'?3:1;
  const cards:VisualCard[]=Array.from({length},(_,i)=>({id:`card-${i}`,seatId:`seat-${i%seats}`,round:Math.floor(i/seats),identity:street==='deal'&&i%seats!==0?undefined:{rank:i%2?'K':'8',suit:'hearts'} as CardIdentity,target:{x:250+i*25,y:350,width:65,height:91}}));
  const event:VisualEvent={id:'unit',type:eventForStreet[street],timestamp:Date.now(),origin:point(300,200),cards};
  const layer=document.createElement('div');document.body.append(layer);
  const parameters=Object.fromEntries(preset.parameters.map(p=>[p.key,p[extreme]]));
  const tracks=preset.build({event,theme,parameters,layer,intensity:parameters.intensity,center:point(500,350),card:card=>cardObject(card,theme,layer)});
  assert.ok(tracks.length>0);
  for(const t of [0,.1,.25,.4,.6,.8,.95,1]) {
   for(const track of tracks)track.update(Math.max(0,Math.min(1,(t-track.start)/(track.end-track.start))));
   assert.ok(!/NaN|Infinity/.test(layer.innerHTML),`${preset.id} ${extreme} ${seats} invalid transform at ${t}`);
  }
  for(const track of tracks)track.cleanup?.();layer.remove();
 }
 dom.window.close();
});
