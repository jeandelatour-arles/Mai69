// Aides DOM et icônes SVG (traits fins, currentColor).

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Crée un élément depuis du HTML. */
export function html(str) {
  const tpl = document.createElement('template');
  tpl.innerHTML = str.trim();
  return tpl.content.firstElementChild;
}

const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/>',
  chart: '<path d="M4 19h16"/><path d="M5 15l4.5-5 4 3.5L19 7"/>',
  gear: '<circle cx="12" cy="12" r="2.8"/><path d="M10.4 3.5h3.2l.5 2.4 1.9 1.1 2.3-.8 1.6 2.8-1.8 1.6v2.2l1.8 1.6-1.6 2.8-2.3-.8-1.9 1.1-.5 2.4h-3.2l-.5-2.4-1.9-1.1-2.3.8-1.6-2.8 1.8-1.6v-2.2L4.1 9l1.6-2.8 2.3.8 1.9-1.1z"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M15.5 14.2c2.6-.3 4.5 1.3 5 4.3"/>',
  dots: '<circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  grip: '<path d="M8 7h8M8 12h8M8 17h8"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  archive: '<path d="M4 5h16v4H4zM5.5 9v10h13V9M10 13h4"/>',
  edit: '<path d="M5 19l1-4L16 5l3 3L9 18z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  home: '<path d="M4 11l8-7 8 7M6.5 9.5V20h11V9.5"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const LOGO = `<svg class="logo" viewBox="0 0 512 512" aria-hidden="true"><g transform="translate(0 12)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><g stroke-width="17"><path d="M180 140V84l28 38 28-38v56"/><path d="M262 140l24-56 24 56M270 122h32"/><path d="M336 84v56"/></g><g stroke-width="38"><circle cx="170" cy="330" r="66"/><path d="M104 330c0-94 44-136 118-140"/><circle cx="342" cy="250" r="66"/><path d="M408 250c0 94-44 136-118 140"/></g></g></svg>`;

/** Vibration courte si disponible (retour tactile discret). */
export const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch { /* */ } };
