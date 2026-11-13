import type { Rank, Suit, Theme } from '../types';
import { artOptions, cardDataUrl, CARD_HEIGHT, CARD_WIDTH } from '../rendering/cards';
import { puckSvg } from '../rendering/chips';
import { darken, lighten, metal, mix, rgba, safeHex, shade, svgDataUrl } from '../rendering/color';
import { landscapeTableUrl, portraitTableUrl, roomPatternUrl } from './table-art';

/**
 * The live skin: one stylesheet scoped to `html[data-pnc-skin]`, written
 * against PokerNow's own class names. Nothing in the page is moved, wrapped
 * or replaced, so removing the attribute restores the original table exactly.
 *
 * Lengths are in rem because PokerNow scales its whole table by changing the
 * root font size; the skin scales with it for free.
 */
export const SKIN_ATTRIBUTE = 'data-pnc-skin';
/** Repeated to outrank PokerNow's own selectors without resorting to !important. */
export const SKIN_ROOT = `html[${SKIN_ATTRIBUTE}][${SKIN_ATTRIBUTE}][${SKIN_ATTRIBUTE}]`;
const ROOT = SKIN_ROOT;

export interface SkinOptions {
  /** Directory serving the bundled fonts (extension URL live, relative path in the studio). */
  fontBase?: string;
}

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: [Suit, string][] = [['spades', 's'], ['hearts', 'h'], ['diamonds', 'd'], ['clubs', 'c']];
const rankClass = (rank: Rank): string => (rank === '10' ? 'T' : rank);
const safeImage = (value: string | undefined): string | undefined =>
  value && /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value) ? value : undefined;

function fonts(base: string | undefined): string {
  if (base === undefined) return '';
  const root = base.replace(/\/$/, '');
  return `@font-face{font-family:"PNC Sans";src:url("${root}/inter.woff2") format("woff2");font-weight:400 800;font-style:normal;font-display:swap}
@font-face{font-family:"PNC Serif";src:url("${root}/playfair-display.woff2") format("woff2");font-weight:400 900;font-style:normal;font-display:swap}
@font-face{font-family:"PNC Serif";src:url("${root}/playfair-display-italic.woff2") format("woff2");font-weight:400 900;font-style:italic;font-display:swap}`;
}

/** Card faces and backs as custom properties, then one short rule per card. */
function cardRules(theme: Theme): string {
  const options = artOptions(theme);
  const radius = `${(theme.card.borderRadius * 0.9 / CARD_WIDTH * 100).toFixed(2)}% / ${(theme.card.borderRadius * 0.9 / CARD_HEIGHT * 100).toFixed(2)}%`;
  const s = Math.min(1, Math.max(0, theme.card.shadow));
  const shadow = s === 0 ? 'none' : `0 .04rem .08rem rgba(0,0,0,${(0.38 * s).toFixed(2)}),0 .28rem .7rem rgba(0,0,0,${(0.5 * s).toFixed(2)})`;
  const glow = safeHex(theme.board.highlight, '#f2d08a'), trim = metal(theme.table.trimColor);
  let variables = `--pnc-back:url("${cardDataUrl(undefined, theme.card, options)}");`;
  let rules = `
${ROOT} .card-container .front{background-image:var(--pnc-back) !important;background-size:100% 100%;border-radius:${radius};box-shadow:${shadow}}
${ROOT} .card-container .card{border-radius:${radius};box-shadow:${shadow}}
${ROOT} .card-container.sneak .card::before{background-image:var(--pnc-back);background-size:100% 100%;opacity:.42;border-radius:${radius}}
${ROOT} .table-cards .card-container.semi-hide{opacity:1}
${ROOT} .table-cards .card-container.semi-hide .card,${ROOT} .table-cards .card-container.semi-hide .front{filter:brightness(.5) saturate(.6);transition:filter .5s ease}
${ROOT} .card-container.up .card{box-shadow:0 0 0 .07rem ${trim.high},0 0 1.1rem ${rgba(glow, 0.7)},0 .5rem 1.1rem rgba(0,0,0,.5)}
${ROOT} .card-container.up .card::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(112deg,transparent 38%,rgba(255,255,255,.55) 50%,transparent 62%);background-size:260% 100%;background-position:140% 0;animation:pnc-foil 1.1s var(--pnc-ease) .12s 1 both;pointer-events:none;z-index:4}
${ROOT} .you-player .table-player-cards .card-container{transition:translate .28s var(--pnc-ease),scale .28s var(--pnc-ease),top .5s var(--pnc-ease)}
${ROOT} .you-player .table-player-cards:not(.hide):hover .card-container{translate:0 -.26rem;scale:1.05}
${ROOT} .table-player-cards.hide .card,${ROOT} .table-player-cards.hide .front{filter:brightness(.42) saturate(.7)}
${ROOT} .table-player-cards.hide-cards{transition:opacity .22s ease-out,top .3s ease-out}`;
  if (theme.card.face !== 'native') {
    // PokerNow's own rank and suit text stays in the page for assistive tools; only its ink is hidden.
    rules += `
${ROOT} .card-container .card{background-color:${safeHex(theme.card.faceColor, '#fbf7ec')};background-size:100% 100%;background-repeat:no-repeat}
${ROOT} .card-container .card>.value,${ROOT} .card-container .card>.suit{opacity:0}`;
    for (const [suit, letter] of SUITS) {
      for (const rank of RANKS) {
        const key = `${rankClass(rank)}${letter}`;
        variables += `--pnc-${key}:url("${cardDataUrl({ rank, suit }, theme.card, options)}");`;
        rules += `\n${ROOT} .card-container.card-${letter}.card-s-${rankClass(rank)} .card{background-image:var(--pnc-${key})}`;
        if (suit === 'diamonds' || suit === 'clubs') {
          variables += `--pnc4-${key}:url("${cardDataUrl({ rank, suit }, theme.card, { ...options, fourColor: true })}");`;
          rules += `\n${ROOT} .four-color .card-container.card-${letter}.card-s-${rankClass(rank)} .card{background-image:var(--pnc4-${key})}`;
        }
      }
    }
  }
  return `${ROOT}{${variables}}${rules}`;
}

export function buildSkinCss(theme: Theme, options: SkinOptions = {}): string {
  const table = theme.table;
  const trim = metal(table.trimColor);
  const glow = safeHex(theme.board.highlight, '#f2d08a');
  const room = safeHex(table.backgroundColor, '#0a0e0c');
  const ink = '#f4efe3';
  const onMetal = '#1a150b';
  const upload = safeImage(table.backgroundImage);
  const backdrop = upload
    ? `radial-gradient(ellipse 80% 66% at 50% 44%,rgba(0,0,0,.25) 0%,rgba(0,0,0,.72) 100%),url("${upload}") center/cover no-repeat`
    : `radial-gradient(ellipse 78% 64% at 50% 44%,transparent 0 52%,rgba(0,0,0,.6) 100%),radial-gradient(ellipse 54% 48% at 50% 42%,${rgba(trim.mid, 0.17)},transparent 72%),url("${roomPatternUrl(table)}"),radial-gradient(ellipse 110% 92% at 50% 38%,${lighten(room, 0.1)},${room} 56%,${darken(room, 0.55)})`;
  const puck = (letter: string) => `url("${svgDataUrl(puckSvg(table.trimColor, letter, table.motif))}")`;
  const puckKeyframes = Array.from({ length: 10 }, (_, index) =>
    `@keyframes pnc-puck-${index + 1}{0%{transform:translateY(0) rotate(0) scale(1)}38%{transform:translateY(-.42rem) rotate(-9deg) scale(1.14)}72%{transform:translateY(.03rem) rotate(2deg) scale(.985)}100%{transform:none}}
${ROOT} .dealer-button-ctn.dealer-position-${index + 1} .button{animation:pnc-puck-${index + 1} .75s var(--pnc-ease) both}`).join('\n');
  const plate = 'linear-gradient(180deg,rgba(36,36,40,.95) 0%,rgba(17,17,20,.97) 100%)';

  return `${fonts(options.fontBase)}
${ROOT}{
--pnc-trim:${trim.mid};--pnc-trim-hi:${trim.high};--pnc-trim-lo:${trim.low};--pnc-trim-spec:${trim.spec};--pnc-glow:${glow};--pnc-ink:${ink};
--pnc-sans:"PNC Sans",Inter,Mulish,system-ui,-apple-system,"Segoe UI",sans-serif;--pnc-serif:"PNC Serif","Playfair Display",Georgia,"Times New Roman",serif;
--pnc-ease:cubic-bezier(.16,1,.3,1);--pnc-ease-in-out:cubic-bezier(.65,0,.35,1);
--pnc-spring:linear(0,.009,.035 2.1%,.141 4.4%,.723 12.9%,.938 16.7%,1.017,1.077,1.121,1.149 24.3%,1.159,1.163,1.161,1.154 29.9%,1.129 32.8%,1.051 39.6%,1.017 43.1%,.991,.977 51%,.974 53.8%,.975 57.1%,.997 69.8%,1.003 76.9%,1.004 83.8%,1);
--pnc-table-l:url("${landscapeTableUrl(table)}");--pnc-table-p:url("${portraitTableUrl(table)}");--pnc-puck:${puck('D')};--pnc-puck-s:${puck('S')};
}
@keyframes pnc-breathe{0%,100%{opacity:.62;transform:scale(.96)}50%{opacity:1;transform:scale(1.04)}}
@keyframes pnc-ring{0%,100%{box-shadow:inset 0 0 0 .07rem var(--pnc-trim-hi),inset 0 .05rem 0 rgba(255,255,255,.22),0 0 .9rem ${rgba(glow, 0.3)},0 .5rem 1.1rem rgba(0,0,0,.55)}50%{box-shadow:inset 0 0 0 .07rem var(--pnc-trim-spec),inset 0 .05rem 0 rgba(255,255,255,.3),0 0 1.7rem ${rgba(glow, 0.55)},0 .5rem 1.1rem rgba(0,0,0,.55)}}
@keyframes pnc-win{0%{opacity:0;transform:scale(.7)}22%{opacity:1;transform:scale(1.18)}100%{opacity:.85;transform:scale(1)}}
@keyframes pnc-sheen{0%{transform:translateX(-130%) skewX(-18deg)}100%{transform:translateX(130%) skewX(-18deg)}}
@keyframes pnc-foil{0%{background-position:140% 0}100%{background-position:-40% 0}}
@keyframes pnc-pop{0%{transform:scale(.4);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes pnc-rise{0%{transform:translateY(.9rem) scale(.96);opacity:0}100%{transform:none;opacity:1}}
@keyframes pnc-urgent{0%{filter:brightness(1)}100%{filter:brightness(1.6)}}
@keyframes pnc-settle{0%{transform:translateY(-.3rem) scale(.9);opacity:0}100%{transform:none;opacity:1}}

/* Room */
${ROOT} .game-main-container{background:${backdrop} !important;background-size:auto,auto,56px 56px,auto !important;font-family:var(--pnc-sans)}
${upload ? `${ROOT} .game-main-container{background-size:auto,cover !important}` : ''}
${ROOT} #canvas{box-shadow:0 0 0 .05rem ${rgba(trim.mid, 0.14)},0 0 3rem rgba(0,0,0,.6)}
${ROOT} .blind-value{color:${rgba(ink, 0.72)};font-family:var(--pnc-sans);letter-spacing:.05em}
${ROOT} .owner-table-name{color:${rgba(trim.high, 0.82)};font-family:var(--pnc-sans);letter-spacing:.22em;font-weight:600}

/* Table */
${ROOT}.landscape .table:not(.red){background-image:var(--pnc-table-l) !important;background-size:100% 100%;background-position:center}
${ROOT}.portrait .table:not(.red){background-image:var(--pnc-table-p) !important}

/* Pot */
${ROOT} .table-pot-size .main-value{font-family:var(--pnc-serif);font-weight:700;font-size:1.2rem;letter-spacing:.012em;font-variant-numeric:lining-nums tabular-nums;font-feature-settings:"lnum","tnum";color:var(--pnc-trim-hi);background:linear-gradient(180deg,var(--pnc-trim-spec) 8%,var(--pnc-trim-hi) 46%,var(--pnc-trim) 78%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 .05rem .04rem rgba(0,0,0,.7));padding:0}
${ROOT}.portrait .table-pot-size .main-value{font-size:.74rem}
${ROOT} .table-pot-size::before{content:"POT";position:absolute;left:0;right:0;top:-.56rem;text-align:center;text-indent:.36em;font:600 .34rem/1 var(--pnc-sans);letter-spacing:.36em;color:${rgba(trim.high, 0.7)};pointer-events:none}
${ROOT}.portrait .table-pot-size::before{top:-.42rem;font-size:.26rem}
${ROOT} .table-pot-size .main-value{padding-left:var(--pnc-pot-pad,0);box-sizing:border-box;white-space:nowrap;width:max-content;min-width:100%;transition:padding .35s var(--pnc-ease)}
${ROOT} .table-pot-size::after{content:"";position:absolute;left:.42rem;bottom:.2rem;width:var(--pnc-chips-w,0);height:var(--pnc-chips-h,0);background:var(--pnc-chips,none) no-repeat center/100% 100%;pointer-events:none;animation:pnc-settle .35s var(--pnc-spring) both}
${ROOT} .table-pot-size .add-on{background:rgba(0,0,0,.42);color:${rgba(ink, 0.86)};font-family:var(--pnc-sans);font-weight:600;border-radius:2rem;backdrop-filter:none;box-shadow:inset 0 0 0 .03rem ${rgba(trim.mid, 0.3)};font-variant-numeric:tabular-nums}
${ROOT} .table-pot-size .add-on small{color:${rgba(trim.high, 0.75)};letter-spacing:.14em;text-transform:uppercase}
${ROOT} .table-pot-size .bomb-pot-signal{font-family:var(--pnc-sans);letter-spacing:.12em}

/* Seats */
${ROOT} .table-player-infos-ctn{background:${plate};border-radius:.52rem;font-family:var(--pnc-sans);box-shadow:inset 0 .05rem 0 rgba(255,255,255,.1),inset 0 0 0 .04rem ${rgba(trim.mid, 0.2)},0 .1rem .18rem rgba(0,0,0,.55),0 .5rem 1.1rem rgba(0,0,0,.5);transition:background .45s var(--pnc-ease),box-shadow .45s var(--pnc-ease),opacity .45s ease,filter .45s ease}
${ROOT} .table-player-name{color:${rgba(ink, 0.64)};font-weight:600;letter-spacing:.015em}
${ROOT} .table-player-name a{color:inherit;text-decoration-line:underline;text-decoration-style:dotted;text-decoration-thickness:.05rem;text-underline-offset:.12rem;text-decoration-color:${rgba(ink, 0.18)}}
${ROOT} .table-player-infos-ctn .table-player-stack{color:${ink};font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.01em;transition:color .4s ease}
${ROOT} .you-player .table-player-infos-ctn{box-shadow:inset 0 .05rem 0 rgba(255,255,255,.12),inset 0 0 0 .05rem ${rgba(trim.mid, 0.46)},0 .1rem .18rem rgba(0,0,0,.55),0 .5rem 1.1rem rgba(0,0,0,.5)}
${ROOT} .you-player .table-player-infos-ctn .table-player-stack{color:var(--pnc-trim-hi)}

/* The player to act: the plate lifts into the light and holds a slow, calm pulse. */
${ROOT} .table-player.decision-current .table-player-infos-ctn{background:linear-gradient(180deg,${mix('#2a2a2e', trim.mid, 0.2)} 0%,${mix('#131316', trim.mid, 0.08)} 100%);animation:pnc-ring 2.4s ease-in-out infinite}
${ROOT} .table-player.decision-current .table-player-name,${ROOT} .table-player.decision-current .table-player-name a{color:${ink};text-decoration-color:${rgba(ink, 0.3)}}
${ROOT} .table-player.decision-current .table-player-stack{color:#fff}
${ROOT} .table-player.decision-current::before,${ROOT} .table-player.winner::before{left:-24%;right:-24%;top:-70%;width:auto;height:240%;border-radius:50%;box-shadow:none;background:radial-gradient(ellipse at center,${rgba(glow, 0.3)} 0%,${rgba(glow, 0.1)} 38%,transparent 68%);pointer-events:none}
${ROOT} .table-player.decision-current::before{animation:pnc-breathe 2.4s ease-in-out infinite}

/* The winner: gold plate, one pass of light, and the prize set in metal. */
${ROOT} .table-player.winner .table-player-infos-ctn{background:linear-gradient(180deg,${mix('#2d2a22', trim.mid, 0.3)} 0%,${mix('#15130f', trim.mid, 0.12)} 100%);box-shadow:inset 0 0 0 .08rem var(--pnc-trim-hi),inset 0 .05rem 0 rgba(255,255,255,.3),0 0 1.8rem ${rgba(glow, 0.5)},0 .5rem 1.1rem rgba(0,0,0,.55)}
${ROOT} .table-player.winner .table-player-infos-ctn::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 20%,rgba(255,255,255,.34) 50%,transparent 80%);animation:pnc-sheen 1.15s var(--pnc-ease) .1s 1 both;pointer-events:none}
${ROOT} .table-player.winner .table-player-name,${ROOT} .table-player.winner .table-player-name a{color:${ink};text-decoration-color:${rgba(ink, 0.3)}}
${ROOT} .table-player.winner .table-player-stack{color:#fff}
${ROOT} .table-player.winner::before{animation:pnc-win .9s var(--pnc-ease) both;background:radial-gradient(ellipse at center,${rgba(glow, 0.42)} 0%,${rgba(glow, 0.14)} 40%,transparent 70%)}
${ROOT} .table-player-infos-ctn .table-player-stack{white-space:nowrap}
${ROOT} .table-player-stack-prize{display:inline-block;font-size:.56rem;line-height:.8rem;vertical-align:top;margin-left:.06rem;background:linear-gradient(180deg,var(--pnc-trim-spec),var(--pnc-trim) 80%);color:${onMetal};border-radius:2rem;padding:0 .32rem;font-weight:800;box-shadow:0 0 .6rem ${rgba(glow, 0.5)};animation:pnc-pop .55s var(--pnc-spring) both}
${ROOT} .table-player-stack-prize.red{background:#a8232c;color:#fff;box-shadow:none}

/* Folded: present, legible, out of the light. */
${ROOT} .table-player.fold .table-player-infos-ctn{opacity:.6;filter:saturate(.5)}
${ROOT} .table-player-status-icon{color:${rgba(ink, 0.44)};font-family:var(--pnc-sans);font-weight:600;letter-spacing:.24em}
${ROOT} .table-player-status-icon::after{opacity:.26}
${ROOT} .table-player-status-icon.fold{color:${rgba(ink, 0.36)}}

/* Clock */
${ROOT} .time-to-talk{background:rgba(255,255,255,.1);height:.16rem}
${ROOT} .time-to-talk .normal-time{background:linear-gradient(90deg,var(--pnc-trim),var(--pnc-trim-spec));box-shadow:0 0 .4rem ${rgba(glow, 0.6)};transition:width .25s linear}
${ROOT} .time-to-talk .time-bank{background:linear-gradient(90deg,#6f58c9,#a48cf2)}
${ROOT} .time-to-talk .red{background:linear-gradient(90deg,#c9302f,#ff6a5c);box-shadow:0 0 .5rem rgba(255,90,80,.7);animation:pnc-urgent .5s ease-in-out infinite alternate}

/* Bets */
${ROOT} .table-player-bet-value{background:linear-gradient(180deg,rgba(26,26,29,.9),rgba(9,9,11,.92));color:${ink};font-family:var(--pnc-sans);font-weight:700;font-size:.72rem;font-variant-numeric:tabular-nums;letter-spacing:.012em;line-height:1;padding:.24rem .56rem;border-radius:2rem;box-shadow:inset 0 0 0 .04rem ${rgba(trim.mid, 0.42)},inset 0 .05rem 0 rgba(255,255,255,.1),0 .2rem .5rem rgba(0,0,0,.5);animation:pnc-settle .32s var(--pnc-spring) both}
${ROOT} .table-player-bet-value.check{background:rgba(10,10,12,.62);color:${rgba(ink, 0.8)};font-size:.44rem;font-weight:600;letter-spacing:.26em;text-transform:uppercase;padding:.3rem .5rem .3rem .62rem;box-shadow:inset 0 0 0 .04rem rgba(255,255,255,.14),0 .2rem .5rem rgba(0,0,0,.4)}
${ROOT} .table-player-bet-value::before{content:"";position:absolute;right:calc(100% + .14rem);bottom:-.14rem;width:var(--pnc-chips-w,0);height:var(--pnc-chips-h,0);background:var(--pnc-chips,none) no-repeat center/100% 100%;pointer-events:none;animation:pnc-settle .3s var(--pnc-spring) var(--pnc-chips-delay,0s) both}
${ROOT} .table-player-3 .table-player-bet-value::before,${ROOT} .table-player-4 .table-player-bet-value::before,${ROOT} .table-player-5 .table-player-bet-value::before{right:auto;left:calc(100% + .14rem)}

/* Showdown label */
${ROOT} .player-hand-message-ctn .player-hand-message{background:rgba(9,9,11,.92);color:var(--pnc-trim-hi);font-family:var(--pnc-sans);font-weight:700;letter-spacing:.12em;border-radius:2rem;box-shadow:inset 0 0 0 .04rem ${rgba(trim.mid, 0.5)},0 .2rem .5rem rgba(0,0,0,.55)}
${ROOT} .player-hand-message-ctn .player-hand-message .name.active{background:linear-gradient(180deg,var(--pnc-trim-spec),var(--pnc-trim) 85%);color:${onMetal}}
${ROOT} .player-hand-message-ctn .player-hand-message .second{background:rgba(70,22,26,.92)}

/* Table talk */
${ROOT} .table-player-chat-message{background:rgba(14,14,17,.94);color:${ink};font-family:var(--pnc-sans);border-radius:.4rem;box-shadow:inset 0 0 0 .04rem ${rgba(trim.mid, 0.4)},0 .3rem .7rem rgba(0,0,0,.5)}
${ROOT} .table-player-chat-message::after{border-top-color:rgba(14,14,17,.94)}

/* Open seats */
${ROOT} .table-player-seat{border:.05rem dashed ${rgba(trim.mid, 0.26)};border-radius:.52rem;background:rgba(0,0,0,.14);transition:border-color .3s ease,background .3s ease,box-shadow .3s ease}
${ROOT} .table-player-seat:hover,${ROOT} .table-player-seat.selected{border-color:${rgba(trim.high, 0.8)};background:${rgba(trim.mid, 0.07)};box-shadow:0 0 1.3rem ${rgba(glow, 0.16)}}
${ROOT} .table-player-seat-button{color:${rgba(ink, 0.46)};font-family:var(--pnc-sans);font-weight:600;font-size:.48rem;letter-spacing:.46em;transition:color .3s ease}
${ROOT} .table-player-seat:hover .table-player-seat-button,${ROOT} .table-player-seat.selected .table-player-seat-button{color:var(--pnc-trim-hi)}
${ROOT} .table-player-seat-position-number{color:${rgba(ink, 0.24)};font-family:var(--pnc-serif);font-weight:500}
${ROOT} .table-player-seat:hover .table-player-seat-position-number{color:${rgba(trim.high, 0.8)}}

/* Dealer puck: lifts, rolls and settles whenever it changes seats. */
${ROOT} .dealer-button-ctn{transition:top .7s var(--pnc-ease-in-out),left .7s var(--pnc-ease-in-out),right .7s var(--pnc-ease-in-out),bottom .7s var(--pnc-ease-in-out)}
${ROOT} .dealer-button-ctn .button{background-image:var(--pnc-puck) !important;background-size:contain;background-repeat:no-repeat;background-position:center}
${ROOT} .dealer-button-ctn.live-straddle .button{background-image:var(--pnc-puck-s) !important}
${puckKeyframes}

/* Decision bar */
${ROOT} .game-decisions-ctn .action-buttons .action-button{--b:150,150,160;position:relative;border:0;border-radius:.66rem;height:3.4rem;min-width:5.4rem;padding:0 1.25rem;font-family:var(--pnc-sans);font-weight:700;font-size:.72rem;letter-spacing:.15em;color:${ink};background:linear-gradient(180deg,rgba(var(--b),.3) 0%,rgba(var(--b),.12) 100%),linear-gradient(180deg,#2b2b30,#141417);box-shadow:inset 0 .06rem 0 rgba(255,255,255,.2),inset 0 0 0 .06rem rgba(var(--b),.55),0 .12rem .2rem rgba(0,0,0,.5),0 .6rem 1.3rem rgba(0,0,0,.45),0 0 1.5rem rgba(var(--b),.12);transition:transform .2s var(--pnc-ease),filter .2s ease,box-shadow .3s ease}
${ROOT} .game-decisions-ctn .action-buttons .action-button.green,${ROOT} .game-decisions-ctn .action-buttons .action-button.green-2{--b:52,196,120;color:#d9ffe9}
${ROOT} .game-decisions-ctn .action-buttons .action-button.red{--b:236,82,78;color:#ffe1dd}
${ROOT} .game-decisions-ctn .action-buttons .action-button.blue{--b:127,125,245;color:#e7e6ff}
${ROOT} .game-decisions-ctn .action-buttons .action-button.yellow{--b:236,200,90;color:#fff3cf}
${ROOT} .game-decisions-ctn .action-buttons .action-button:not(:disabled):hover{transform:translateY(-.09rem);filter:brightness(1.18)}
${ROOT} .game-decisions-ctn .action-buttons .action-button:not(:disabled):active{transform:translateY(.05rem) scale(.985);filter:brightness(.94);transition-duration:.06s}
${ROOT} .game-decisions-ctn .action-buttons .action-button:focus-visible{outline:.1rem solid var(--pnc-trim-hi);outline-offset:.14rem}
${ROOT} .game-decisions-ctn .action-buttons .action-button.highlighted{background:linear-gradient(180deg,rgba(var(--b),.92),rgba(var(--b),.7));color:#0d0d10;box-shadow:inset 0 .06rem 0 rgba(255,255,255,.45),0 0 0 .08rem rgba(var(--b),1),0 0 1.8rem rgba(var(--b),.45),0 .6rem 1.3rem rgba(0,0,0,.45)}
${ROOT} .game-decisions-ctn .action-buttons .action-button:disabled{opacity:.3}
${ROOT} .game-decisions-ctn .action-buttons .action-button.with-tip::before{top:.3rem;right:.34rem;width:auto;min-width:.46rem;padding:.08rem .18rem;font:600 .36rem/1 var(--pnc-sans);letter-spacing:.04em;text-transform:uppercase;color:rgba(var(--b),1);background:rgba(0,0,0,.5);border:.03rem solid rgba(var(--b),.4);border-radius:.18rem}
${ROOT} .game-decisions-ctn:not(.low) .action-buttons .action-button{animation:pnc-rise .5s var(--pnc-spring) both}
${ROOT} .game-decisions-ctn:not(.low) .action-buttons .action-button:nth-child(2){animation-delay:.05s}
${ROOT} .game-decisions-ctn:not(.low) .action-buttons .action-button:nth-child(3){animation-delay:.1s}
${ROOT} .game-decisions-ctn:not(.low) .action-buttons .action-button:nth-child(n+4){animation-delay:.15s}

/* Portrait keeps PokerNow's stacked layout; only its solid fills are replaced. */
${ROOT}.portrait .table-player-name,${ROOT}.portrait .table-player-stack,${ROOT}.portrait .table-player.decision-current .table-player-name,${ROOT}.portrait .table-player.winner .table-player-name,${ROOT}.portrait .table-player.decision-current .table-player-stack,${ROOT}.portrait .table-player.winner .table-player-stack{background:transparent}
${ROOT}.portrait .table-player.decision-current::before,${ROOT}.portrait .table-player.winner::before{top:auto;bottom:-1.2rem;height:4.4rem}
${ROOT}.portrait .table-player.decision-current .table-player-infos-ctn,${ROOT}.portrait .table-player.winner .table-player-infos-ctn{outline:.06rem solid var(--pnc-trim-hi);outline-offset:-.06rem}
${ROOT}.portrait .table-pot-size::after{left:.1rem;bottom:.08rem;scale:.5;transform-origin:left bottom}
${ROOT}.portrait .table-pot-size .main-value{padding-left:calc(var(--pnc-pot-pad,0rem)*.5)}
${ROOT}.portrait .table-player-bet-value::before{scale:.72;transform-origin:right bottom}
${ROOT}.portrait .table-player-3 .table-player-bet-value::before,${ROOT}.portrait .table-player-4 .table-player-bet-value::before,${ROOT}.portrait .table-player-5 .table-player-bet-value::before{transform-origin:left bottom}
${ROOT}.portrait .table-player-bet-value{font-size:.56rem;padding:.2rem .44rem}

/*
 * A newly placed card stays hidden until the runtime has decided its fate
 * (an animation takes it over, or it is released to show at once). The hold
 * ends by itself after one second, so a card can never stay hidden if the
 * runtime does nothing.
 */
@keyframes pnc-hold{0%,100%{opacity:0}}
${ROOT} [data-pnc-concealed="true"]{opacity:0!important}
${ROOT}[data-pnc-cards="animated"] .table-cards .card-container:not([data-pnc-released]),${ROOT}[data-pnc-cards="animated"] .table-player-cards .card-container:not([data-pnc-released]){animation:pnc-hold 2.5s steps(1,end) 1}

${cardRules(theme)}

@media (prefers-reduced-motion:reduce){
${ROOT} *,${ROOT} *::before,${ROOT} *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important}
}
${ROOT}[data-pnc-motion="reduced"] *,${ROOT}[data-pnc-motion="reduced"] *::before,${ROOT}[data-pnc-motion="reduced"] *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important}
`;
}

/** Accent tones the stage reuses so overlay effects match the stylesheet. */
export function skinTones(theme: Theme): { trim: ReturnType<typeof metal>; glow: string; felt: string; feltHigh: string } {
  return { trim: metal(theme.table.trimColor), glow: safeHex(theme.board.highlight, '#f2d08a'), felt: safeHex(theme.table.feltColor), feltHigh: shade(theme.table.feltColor, 0.1) };
}
