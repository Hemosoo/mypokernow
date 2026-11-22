/**
 * PokerNow's screen around the table: the menu on the left, the sound and
 * pause buttons on the right, the log and the chat along the bottom. Recreated
 * for the before-and-after recordings (`preview.html?chrome=1`) so both sides
 * show the whole screen a player sees. The extension never restyles or hides
 * any of these, so they look the same on both sides.
 *
 * Plain elements with their own `replica-chrome` classes: nothing here uses
 * PokerNow's class names, so the adapter and the skin never pick them up.
 * Drawn with CSS and simple icons made for this project.
 */
const icon = (body: string, box = '0 0 24 24'): string => `<svg viewBox="${box}" aria-hidden="true" fill="currentColor">${body}</svg>`;
const ICONS = {
  menu: icon('<rect x="3" y="4" width="18" height="3.2" rx="1"/><rect x="3" y="10.4" width="18" height="3.2" rx="1"/><rect x="3" y="16.8" width="18" height="3.2" rx="1"/>'),
  leave: icon('<path d="M10 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h4v-3H6.5V7H10Z"/><path d="M13 7.5V10H8.5v4H13v2.5l7.5-4.5Z"/>'),
  back: icon('<path d="M5.2 3.5c1.6-.7 2.6.4 3 1.7l2.4 7.3h6.6c1.5 0 2.3 1.4 1.6 2.6l-.6 1.1H8.6L4.5 6.3c-.4-1.2-.2-2.3.7-2.8Z"/><rect x="11" y="17" width="2.2" height="3.2"/><rect x="7.5" y="19.6" width="9.6" height="1.9" rx=".9"/>'),
  sound: icon('<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="M15 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  play: icon('<path d="M6 4v16l14-8Z"/>'),
  stop: icon('<rect x="5" y="5" width="14" height="14" rx="1"/>'),
  chat: icon('<path d="M12 4C6.5 4 2.5 7.4 2.5 11.6c0 2.3 1.2 4.3 3.1 5.7L4.5 21l4.4-2.3c1 .2 2 .4 3.1.4 5.5 0 9.5-3.4 9.5-7.5S17.5 4 12 4Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="11.6" r="1.3"/><circle cx="12" cy="11.6" r="1.3"/><circle cx="16" cy="11.6" r="1.3"/>'),
  up: icon('<path d="m6 12 6-5 6 5M6 18l6-5 6 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  camera: icon('<rect x="2.5" y="7" width="13" height="10" rx="1.5"/><path d="m16.5 11 5-3v8l-5-3Z"/>'),
  mic: icon('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  lock: icon('<circle cx="12" cy="12" r="11" fill="#f3e94a"/><rect x="8" y="11" width="8" height="6" rx="1" fill="#222"/><path d="M9.5 11V9.3a2.5 2.5 0 0 1 5 0V11" fill="none" stroke="#222" stroke-width="1.6"/>'),
};

const MARKUP = `
<div class="rc-logo">POKER NOW</div>
<nav class="rc-side">
  <span>${ICONS.menu}<small>Options</small></span>
  <span>${ICONS.leave}<small>Leave seat</small></span>
  <span>${ICONS.back}<small>I'm back</small></span>
</nav>
<div class="rc-right"><span>${ICONS.sound}</span><span>${ICONS.play}<i>P</i></span><span>${ICONS.stop}</span></div>
<div class="rc-log"><span>Log / Ledger</span><i>L</i></div>
<div class="rc-club">Create a private<br><u>Poker Club</u></div>
<div class="rc-chat"><p>It's a bit quiet here.<br>Click on the balloon and send a Message!</p><b class="rc-up">${ICONS.up}</b><div class="rc-send"><i>M</i>${ICONS.chat}</div></div>
<div class="rc-video"><b>Join ${ICONS.lock}</b><span>${ICONS.camera}${ICONS.mic}</span></div>`;

/** Adds the screen around the table once; the table itself is untouched. */
export function addChrome(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLElement>('#canvas');
  if (!canvas || canvas.querySelector('.replica-chrome')) return;
  const chrome = root.ownerDocument.createElement('div');
  chrome.className = 'replica-chrome';
  chrome.setAttribute('aria-hidden', 'true');
  chrome.innerHTML = MARKUP;
  canvas.append(chrome);
}
