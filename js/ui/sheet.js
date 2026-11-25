// Panneaux en surimpression (bottom sheets) + boîtes de confirmation.
// Chaque panneau ajoute une entrée d'historique : le bouton retour du téléphone le ferme.
import { html, icon, esc } from './dom.js';
import { t } from '../i18n/i18n.js';

const stack = [];
let ignorePop = 0;
let waiters = [];

window.addEventListener('popstate', () => {
  if (ignorePop > 0) {
    ignorePop--;
    if (!ignorePop) { const w = waiters; waiters = []; w.forEach(f => f()); }
    return;
  }
  if (stack.length) removeTop();
});

/** Attend que les retours d'historique en cours soient traités. */
const settled = () => new Promise(res => {
  if (!ignorePop) return res();
  waiters.push(res);
  setTimeout(() => { ignorePop = 0; res(); }, 500);
});

function removeTop() {
  const s = stack.pop();
  if (!s) return;
  s.el.classList.remove('on');
  s.scrim.classList.remove('on');
  const done = () => { s.el.remove(); s.scrim.remove(); };
  setTimeout(done, 200);
  s.onClose && s.onClose();
}

/**
 * openSheet({ title, body (Element | string), tabs, onClose, headExtra })
 * Retourne { el, body, close, setTitle }
 */
export function openSheet({ title = '', body = '', onClose, cls = '', headExtra = '' } = {}) {
  const scrim = html('<div class="scrim"></div>');
  const el = html(`<section class="sheet ${cls}" role="dialog" aria-label="${esc(title)}">
    <div class="grab"></div>
    <div class="head"><h2>${esc(title)}</h2>${headExtra}<button class="ib x" aria-label="${t.close}">${icon('close')}</button></div>
    <div class="body"></div></section>`);
  if (!title && !headExtra) el.querySelector('.head').classList.add('hidden');
  const bodyEl = el.querySelector('.body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
  document.body.append(scrim, el);
  const entry = { el, scrim, onClose };
  stack.push(entry);
  settled().then(() => history.pushState({ sheet: true }, ''));
  requestAnimationFrame(() => { scrim.classList.add('on'); el.classList.add('on'); });

  const api = {
    el, body: bodyEl,
    close() {
      if (stack[stack.length - 1] !== entry) return;
      removeTop(); ignorePop++; history.back();
    },
    setTitle(s) { el.querySelector('.head h2').textContent = s; },
  };
  scrim.addEventListener('click', api.close);
  el.querySelector('.x').addEventListener('click', api.close);
  dragToClose(el, api.close);
  return api;
}

function dragToClose(el, close) {
  const grab = el.querySelector('.grab');
  const head = el.querySelector('.head');
  let y0 = null, dy = 0;
  const down = e => { y0 = e.clientY; dy = 0; el.style.transition = 'none'; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; };
  const up = () => {
    if (y0 == null) return;
    el.style.transition = ''; el.style.transform = '';
    if (dy > 80) close();
    y0 = null;
  };
  for (const h of [grab, head]) {
    h.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; down(e); });
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  }
}

/** Ferme tous les panneaux (sans animation), puis résout. */
export async function closeAll() {
  await settled();
  const n = stack.length;
  if (!n) return;
  while (stack.length) { const s = stack.pop(); s.el.remove(); s.scrim.remove(); }
  ignorePop++;
  history.go(-n);
  await settled();
}

export const sheetsOpen = () => stack.length;

/** Confirmation. Retourne une promesse booléenne. */
export function confirmBox(text, { ok = t.confirm, danger = false } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const body = html(`<div><p style="margin:4px 0 8px;font-size:16px">${esc(text)}</p>
      <button class="btn ${danger ? 'danger' : 'primary'} ok">${esc(ok)}</button>
      <button class="btn ghost no">${esc(t.cancel)}</button></div>`);
    const s = openSheet({ body, onClose: () => { if (!answered) resolve(false); } });
    body.querySelector('.ok').onclick = () => { answered = true; resolve(true); s.close(); };
    body.querySelector('.no').onclick = () => { answered = true; resolve(false); s.close(); };
  });
}

/** Petit message temporaire. */
export function toast(text, ms = 2600, onTap) {
  const el = html(`<div class="toast" role="status">${esc(text)}</div>`);
  document.body.append(el);
  if (onTap) { el.style.cursor = 'pointer'; el.onclick = onTap; }
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}
