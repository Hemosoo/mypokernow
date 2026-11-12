import type { CardIdentity } from '../types';
import { rgba, safeHex } from './color';

const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
interface Made { name: string; value: number[] }
const straight = (values: number[]): number => {
 const unique = new Set(values); if (unique.has(14)) unique.add(1);
 for (let high=14;high>=5;high--) if ([0,1,2,3,4].every(offset=>unique.has(high-offset))) return high;
 return 0;
};
function classify(cards: CardIdentity[]): Made {
 const values=cards.map(card=>ranks.indexOf(card.rank)+2);
 const groups=Array.from(new Set(values)).map(rank=>({rank,count:values.filter(v=>v===rank).length})).sort((a,b)=>b.count-a.count||b.rank-a.rank);
 const flush=['hearts','diamonds','clubs','spades'].map(suit=>cards.filter(c=>c.suit===suit).map(c=>ranks.indexOf(c.rank)+2)).find(cards=>cards.length>=5);
 const sf=flush ? straight(flush) : 0;
 if(sf)return {name:'Straight flush',value:[8,sf]};
 if(groups[0]?.count===4)return {name:'Four of a kind',value:[7,groups[0].rank]};
 if(groups[0]?.count===3&&(groups[1]?.count??0)>=2)return {name:'Full house',value:[6,groups[0].rank,groups[1]!.rank]};
 if(flush)return {name:'Flush',value:[5,...flush.sort((a,b)=>b-a).slice(0,5)]};
 const high=straight(values);if(high)return {name:'Straight',value:[4,high]};
 if(groups[0]?.count===3)return {name:'Three of a kind',value:[3,groups[0].rank]};
 const pairs=groups.filter(group=>group.count===2).map(group=>group.rank).sort((a,b)=>b-a);
 if(pairs.length>=2)return {name:'Two pair',value:[2,...pairs.slice(0,2)]};
 if(pairs.length)return {name:'Pair',value:[1,pairs[0]!]};
 return {name:'High card',value:[0]};
}
/** Decorative feedback from visible cards only. Board-only hands do not light your cards. */
export function madeHand(hole: CardIdentity[], board: CardIdentity[]): string | undefined {
 if(hole.length!==2||![0,3,4,5].includes(board.length))return undefined;
 const cards=[...hole,...board];
 if(new Set(cards.map(c=>c.rank+c.suit)).size!==cards.length)return undefined;
 const hand=classify(cards), shared=classify(board);
 const index=hand.value.findIndex((value,i)=>value!==(shared.value[i]??0));
 return hand.value[0]!>0&&index>=0&&hand.value[index]!>(shared.value[index]??0)?hand.name:undefined;
}
export function auraShadow(color: string, strength: number): string {
 const ink=safeHex(color,'#d4b274'), power=Math.max(0,Math.min(1,strength));
 return power===0?'none':`0 0 0 1px ${rgba(ink,power*.8)},0 0 ${8+power*16}px ${rgba(ink,power*.65)}`;
}
