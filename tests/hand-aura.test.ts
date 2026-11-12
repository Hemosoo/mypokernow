import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { madeHand, auraShadow } from '../src/rendering/hand-aura';
import { readTableState } from '../src/adapter/pokernow/table-state';
import { renderReplica, type ReplicaState } from '../src/replica/markup';
import { createDefaultTheme } from '../src/themes/defaults';
import { validateTheme } from '../src/themes/schema';
import type { CardIdentity, Rank, Suit } from '../src/types';
const suits:Record<string,Suit>={s:'spades',h:'hearts',d:'diamonds',c:'clubs'};
const cards=(codes:string):CardIdentity[]=>codes?codes.split(' ').map(code=>({rank:(code[0]==='T'?'10':code[0]) as Rank,suit:suits[code[1]!]!})):[];
test('aura recognizes made hands from visible cards, without draws or shared-board-only highlights',()=>{
 for(const [hole,board,expected] of [
  ['Ah Ad','','Pair'],['Ah Kh','',''],['Ah Jh','As 8d 2c','Pair'],
  ['Ah Jh','As Jd 2c','Two pair'],['Ah Ad','As 8d 2c','Three of a kind'],
  ['Ah Kd','Qs Jc Th','Straight'],['Ah 2h','Kh 7h 4h','Flush'],
  ['Ah Ad','As 8d 8c','Full house'],['Ah Ad','As Ac 8c','Four of a kind'],
  ['Ah Kh','Qh Jh Th','Straight flush'],['Ah 2d','3s 4c 5h','Straight'],
  ['2c 3d','As Ah Kd Qc Js',''],['2c 3d','As Ks Qs Js Ts',''],
  ['Ah Jh','Kh 7h 4c',''],['Ah Ad','Ah 8d 2c',''],
 ] as const) assert.equal(madeHand(cards(hole),cards(board)),expected||undefined,`${hole} / ${board}`);
 assert.equal(madeHand(cards('Ah'),cards('As 8d 2c')),undefined);
 assert.equal(madeHand(cards('Ah Jh'),cards('As 8d')),undefined);
});
test('old themes get bounded aura defaults and appearance stays inert',()=>{
 const theme=createDefaultTheme();const {aura,...oldCard}=theme.card;
 assert.deepEqual(validateTheme({...theme,card:oldCard}).card.aura,{enabled:true,color:'#d4b274',strength:0.4});
 assert.throws(()=>validateTheme({...theme,card:{...theme.card,aura:{...aura,color:'red;display:none'}}}));
 assert.throws(()=>validateTheme({...theme,card:{...theme.card,aura:{...aura,strength:Infinity}}}));
 assert.equal(auraShadow('#d4b274',0),'none');
});
test('real markup aura reader excludes hidden cards, folded hero and multiple boards',()=>{
 const {JSDOM}=createRequire(import.meta.url)('jsdom');const dom=new JSDOM('<!doctype html><body><main></main></body>',{pretendToBeVisual:true});
 const previous=Object.getOwnPropertyDescriptor(globalThis,'HTMLElement');
 Object.defineProperty(globalThis,'HTMLElement',{value:dom.window.HTMLElement,configurable:true});
 dom.window.HTMLElement.prototype.getBoundingClientRect=()=>({x:0,y:0,width:70,height:90,left:0,top:0,right:70,bottom:90,toJSON:()=>({})});
 const state:ReplicaState={orientation:'landscape',blinds:[10,20],pot:100,board:[{value:'As',flipped:true},{value:'8d',flipped:true},{value:'2c',flipped:true}],seats:[{id:'hero',position:1,name:'You',stack:500,you:true,cards:[{value:'Ah',flipped:true},{value:'Jh',flipped:true}]}]};
 try {
  renderReplica(dom.window.document.querySelector('main')!,state);
  const table=dom.window.document.querySelector('.table')! as HTMLElement;
  assert.equal(madeHand(readTableState(table)!.heroHand!.hole,readTableState(table)!.heroHand!.board),'Pair');
  const hole=table.querySelector('.table-player-cards .card-container')!;hole.classList.remove('flipped');assert.equal(readTableState(table)!.heroHand,undefined);
  hole.classList.add('flipped');table.querySelector('.table-player')!.classList.add('fold');assert.equal(readTableState(table)!.heroHand,undefined);
  table.querySelector('.table-player')!.classList.remove('fold');const second=dom.window.document.createElement('div');second.className='table-cards run-2';table.append(second);assert.equal(readTableState(table)!.heroHand,undefined);
 } finally {if(previous)Object.defineProperty(globalThis,'HTMLElement',previous);else Reflect.deleteProperty(globalThis,'HTMLElement');dom.window.close();}
});
