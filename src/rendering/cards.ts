import type { CardAppearance, CardIdentity, Suit, Theme, VisualCard } from '../types';
const paths: Record<Suit, string> = {
 hearts:'M0 8 C-25-8-19-27-6-24 C-2-24 0-20 0-18 C0-23 6-26 12-24 C29-18 21-3 0 8Z',
 diamonds:'M0-27 18-9 0 10-18-9Z',
 spades:'M0-28 C-8-17-25-7-17 3 C-12 9-4 6-2 1 L-5 12 H5 L2 1 C5 6 13 9 18 2 C24-8 8-18 0-28Z',
 clubs:'M0-9 C-15-17-8-32 1-27 C8-24 8-16 4-12 C18-21 27-5 17 2 C12 6 5 3 2 0 L5 12 H-5 L-2 0 C-11 9-23 0-19-8 C-16-15-6-16 0-9Z',
};
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
function color(value: string): string {return /^#[0-9a-f]{6}$/i.test(value) ? value : '#7770df';}
function image(value: string | undefined): string | undefined {return value && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;}
function pip(suit: Suit, x: number, y: number, scale: number, upsideDown = false): string {
  return `<g transform="translate(${x} ${y}) rotate(${upsideDown?180:0}) scale(${scale})"><path d="${paths[suit]}"/></g>`;
}
export interface SemanticRegion {id: string; x: number; y: number; width: number; height: number; kind: 'rank' | 'suit' | 'art' | 'body'}
export function cardSemanticRegions(identity?: CardIdentity): SemanticRegion[] {
  const corners: SemanticRegion[] = [{id:'rank-top',x:3,y:3,width:23,height:23,kind:'rank'},{id:'suit-top',x:3,y:26,width:23,height:15,kind:'suit'},{id:'rank-bottom',x:74,y:114,width:23,height:23,kind:'rank'},{id:'suit-bottom',x:74,y:99,width:23,height:15,kind:'suit'}];
  if (!identity || ['J','Q','K'].includes(identity.rank)) return [...corners,{id:'court',x:26,y:25,width:48,height:90,kind:'art'}];
  if(identity.rank==='A') return [...corners,{id:'pip-0',x:28,y:48,width:44,height:40,kind:'suit'}];
  return [...corners, ...pipPositions(identity.rank).map(([x,y],i)=>({id:`pip-${i}`,x:x-9,y:y-12,width:18,height:25,kind:'suit' as const}))];
}
function pipPositions(rank: string): number[][] {
  const n = Number(rank); if(rank==='A') return [[50,73]];
  if(n===2) return [[50,44],[50,99]];
  if(n===3) return [[50,42],[50,71],[50,100]];
  if(n===4) return [[35,43],[65,43],[35,100],[65,100]];
  if(n===5) return [[35,43],[65,43],[50,71],[35,100],[65,100]];
  const rows=n>=9?[39,59,83,103]:[43,71,100];
  const positions=rows.flatMap(y=>[[35,y],[65,y]]);
  if(n===7) positions.push([50,55]);
  if(n===8) positions.push([50,55],[50,88]);
  if(n===9) positions.push([50,71]);
  if(n===10) positions.push([50,49],[50,93]);
  return positions;
}
export function cardSvg(identity: CardIdentity | undefined, appearance: CardAppearance): string {
  const a=appearance; const radius = Math.min(14,Math.max(0,a.borderRadius));
  const bg = color(a.faceColor), border=color(a.borderColor), back=color(a.backColor);
  let artwork: string;
  if(!identity) {
    const uploaded=image(a.backImage);
    const pattern = a.back === 'crosshatch' ? '<path d="M-5 0 15 20M0-5 20 15M5-10 25 10M-5 20 15 0M0 25 20 5M5 30 25 10" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".7"/>' : '<path d="M10 2 17 10 10 18 3 10Z" fill="none" stroke="#fff" stroke-opacity=".23" stroke-width=".8"/>';
    artwork=`<defs><pattern id="pattern" width="20" height="20" patternUnits="userSpaceOnUse">${pattern}</pattern><clipPath id="edge"><rect x="4" y="4" width="92" height="132" rx="${Math.max(0,radius-2)}"/></clipPath></defs><rect width="100" height="140" rx="${radius}" fill="${bg}"/><rect x="4" y="4" width="92" height="132" rx="${Math.max(0,radius-2)}" fill="${back}"/>${a.back==='image'&&uploaded?`<image href="${escape(uploaded)}" x="4" y="4" width="92" height="132" preserveAspectRatio="xMidYMid slice" clip-path="url(#edge)"/>`:a.back==='solid'?'':'<rect x="5" y="5" width="90" height="130" fill="url(#pattern)"/>'}<rect x="10" y="10" width="80" height="120" rx="2" fill="none" stroke="#fff" stroke-opacity=".35"/><path d="M50 50 65 70 50 90 35 70Z" fill="${back}" stroke="#fff" stroke-opacity=".65"/><path d="M50 59 58 70 50 81 42 70Z" fill="#fff" fill-opacity=".75"/>`;
  } else {
    const ink = color(identity.suit==='hearts'||identity.suit==='diamonds'?a.redColor:a.blackColor);
    const court=['J','Q','K'].includes(identity.rank);
    const positions=pipPositions(identity.rank);
    const center=court ? `<g transform="translate(26 28)" fill="${ink}"><rect width="48" height="84" rx="2" fill="${ink}" fill-opacity=".07" stroke="${ink}" stroke-opacity=".3"/><path d="M6 18 10 5 20 15 24 3 29 15 39 5 42 18Z"/><circle cx="24" cy="33" r="10" fill-opacity=".8"/><path d="M13 33 Q24 45 35 33 L33 47 15 47Z" fill-opacity=".5"/><path d="M6 78 13 49 24 57 35 49 42 78Z" fill-opacity=".65"/><path d="M9 65 39 65M24 57V79" stroke="${bg}" stroke-width="2"/><text x="24" y="74" font-size="13" text-anchor="middle" fill="${bg}" font-family="Georgia,serif">${identity.rank}</text></g>` : positions.map(([x,y])=>pip(identity.suit,x,y,identity.rank==='A'?.85:.38,y>82)).join('');
    const font=a.face==='modern'?'Arial,sans-serif':'Georgia,serif';
    const corner=`<text x="14" y="22" text-anchor="middle" font-family="${font}" font-size="${identity.rank==='10'?18:21}" font-weight="700">${escape(identity.rank)}</text>${pip(identity.suit,14,34,.27)}`;
    artwork=`<rect width="100" height="140" rx="${radius}" fill="${bg}"/><g fill="${ink}">${corner}<g transform="rotate(180 50 70)">${corner}</g>${center}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="100" height="140">${artwork}<rect x=".6" y=".6" width="98.8" height="138.8" rx="${radius}" stroke="${border}" stroke-width="1.2" fill="none"/></svg>`;
}
export function cardDataUrl(identity: CardIdentity | undefined, appearance: CardAppearance): string {return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardSvg(identity,appearance))}`;}
export function createCardElement(card: VisualCard, theme: Theme): HTMLElement {
  const element = document.createElement('div');
  Object.assign(element.style, {position:'absolute',width:`${card.target.width}px`,height:`${card.target.height}px`, backgroundImage:`url("${cardDataUrl(card.identity,theme.card)}")`,backgroundSize:'100% 100%',borderRadius:`${theme.card.borderRadius}px`,boxShadow:`0 8px 20px rgba(0,0,0,${Math.min(.65,theme.card.shadow)})`, transformStyle:'preserve-3d',willChange:'transform, opacity',pointerEvents:'none'});
  element.setAttribute('aria-hidden','true'); return element;
}
