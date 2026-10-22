import { selectorProfiles, OWNED_SELECTOR } from './selectors';
import { findTableCandidates, isPainted } from './snapshot';
export interface ObservedLayout {profile?:string;tableCount:number;boardCount:number;seatCount:number;cardCount:number}
// Counts of painted presentation nodes only: no values, identities, player names,
// game IDs, or hidden attributes are collected by connection diagnostics.
export function inspectLayout(document:Document):ObservedLayout {
 for(const profile of selectorProfiles) {
  if(profile.id==='fixture')continue;
  const painted=(elements:NodeListOf<HTMLElement>,empty=false)=>Array.from(elements).filter(element=>!element.closest(OWNED_SELECTOR)&&isPainted(element,false,empty));
  const tables=findTableCandidates(document,profile);
  if(!tables.length)continue;
  const table=tables.length===1?tables[0]:undefined;
  const boards=table?painted(table.querySelectorAll<HTMLElement>(profile.board),true):[];
  const cards=table?painted(table.querySelectorAll<HTMLElement>(profile.card)):[];
  const boardCount=boards.filter(node=>!boards.some(other=>other!==node&&node.contains(other))).length;
  const cardCount=cards.filter(node=>!cards.some(other=>other!==node&&other.contains(node))).length;
  return {profile:profile.id,tableCount:tables.length,boardCount,seatCount:table?painted(table.querySelectorAll<HTMLElement>(profile.seat)).length:0,cardCount};
 }
 return {tableCount:0,boardCount:0,seatCount:0,cardCount:0};
}
export function describeUnsupported(layout:ObservedLayout,appearanceActive:boolean):string {
 if(layout.tableCount===0)return 'Content script connected, but no supported table element was found. This page layout needs an adapter update.';
 if(layout.tableCount>1)return 'Multiple possible table elements were found; customization is paused to avoid changing the wrong area.';
 const prefix=appearanceActive?'Table appearance is active. ':'';
 if(layout.boardCount===0)return prefix+'The community board markup was not recognized, so card effects are paused.';
 if(layout.boardCount>1)return prefix+'Multiple community boards are unsupported for card effects.';
 if(layout.seatCount<2)return prefix+'Waiting for at least two measurable seats before animating cards.';
 return prefix+'Card artwork or the current hand layout was not recognized. Unreadable original cards remain visible.';
}
