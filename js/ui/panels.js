// Panneaux partagés : Règles, Joueurs, Menu (langue, économie de batterie), nouveau joueur.
import { html, icon, esc } from './dom.js';
import { openSheet } from './sheet.js';
import { t, getLang, setLang, fmtDate } from '../i18n/i18n.js';
import { search, highlight } from '../core/search.js';
import { playerStats, podium, PODIUM_MIN_GAMES } from '../core/stats.js';
import { state, createPlayer, savePlayer, nameExists } from './state.js';

/* ---------- Règles ---------- */
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function openRules(start = 'simple') {
  const body = html('<div class="rules"></div>');
  const tabs = `<div class="tabs" role="tablist">
    <button data-t="simple">${esc(t.tabSimple)}</button>
    <button data-t="full">${esc(t.tabFull)}</button>
    <button data-t="search" aria-label="${esc(t.search)}">${icon('search')}</button></div>`;
  const s = openSheet({ title: t.rules, body });
  s.el.querySelector('.head').insertAdjacentHTML('afterend', tabs);
  const show = which => {
    s.el.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === which));
    if (which === 'search') return renderSearch(body);
    const list = which === 'simple' ? t.rulesSimple : t.rulesFull;
    body.innerHTML = list.map(r => `<h3>${esc(r.title)}</h3>${r.html}`).join('');
    body.scrollTop = 0;
  };
  s.el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => show(b.dataset.t));
  show(start);
}

function renderSearch(body) {
  body.innerHTML = `<input class="field q" type="search" enterkeyhint="search" placeholder="${esc(t.searchPlaceholder)}" autocomplete="off">
    <div class="results"></div>`;
  const entries = [
    ...t.faq.map((f, i) => ({ id: 'f' + i, title: f.q, text: f.a, kind: 'faq' })),
    ...t.rulesFull.map((r, i) => ({ id: 'r' + i, title: r.title, text: strip(r.html), kind: 'rule' })),
  ];
  const input = body.querySelector('.q'), out = body.querySelector('.results');
  const run = () => {
    const q = input.value;
    if (!q.trim()) { out.innerHTML = t.faq.slice(0, 6).map(f => res({ title: f.q, text: f.a, kind: 'faq' }, '')).join(''); return; }
    const r = search(entries, q);
    out.innerHTML = r.length ? r.map(e => res(e, q)).join('') : `<p class="muted">${esc(t.searchNone)}</p>`;
  };
  const res = (e, q) => `<div class="res"><div class="rt"><span class="tag">${e.kind === 'faq' ? t.tabFaq : t.rules}</span>${highlight(esc(e.title), q)}</div>
    <div class="rx">${highlight(esc(e.kind === 'rule' ? snippet(e.text, q) : e.text), q)}</div></div>`;
  input.addEventListener('input', run);
  run();
  setTimeout(() => input.focus(), 250);
}

function snippet(text, q) {
  if (text.length < 220) return text;
  const words = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
  const norm = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let at = -1;
  for (const w of words) { at = norm.indexOf(w); if (at !== -1) break; }
  const from = Math.max(0, at - 80);
  return (from ? '… ' : '') + text.slice(from, from + 220) + '…';
}

/* ---------- Menu ⋮ ---------- */
export function settingsRows() {
  const eco = document.documentElement.classList.contains('eco');
  return `<div class="li"><span class="ic-wrap">${icon('globe')}</span><span class="grow">${esc(t.language)}</span>
      <div class="seg lang" style="width:120px"><button data-l="fr" class="${getLang() === 'fr' ? 'on' : ''}">FR</button><button data-l="en" class="${getLang() === 'en' ? 'on' : ''}">EN</button></div></div>
    <div class="li tap eco-row" role="switch" aria-checked="${eco}"><span>${icon('leaf')}</span>
      <span class="grow wrap">${esc(t.ecoMode)}<br><span class="hint" style="margin:0">${esc(t.ecoHint)}</span></span><span class="switch ${eco ? 'on' : ''}"></span></div>`;
}
export function bindSettingsRows(root, onLang) {
  root.querySelectorAll('.lang button').forEach(b => b.onclick = () => { setLang(b.dataset.l); onLang && onLang(); });
  const row = root.querySelector('.eco-row');
  if (row) row.onclick = () => {
    const on = !document.documentElement.classList.contains('eco');
    setEco(on);
    row.querySelector('.switch').classList.toggle('on', on);
    row.setAttribute('aria-checked', on);
  };
}
export function setEco(on) {
  document.documentElement.classList.toggle('eco', on);
  try { localStorage.setItem('mai69.eco', on ? '1' : '0'); } catch { /* */ }
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = on ? '#000000' : '#FBF8F3';
}
export function openMenu(onLang) {
  const body = html(`<div class="list">${settingsRows()}</div>`);
  const s = openSheet({ title: t.settings, body });
  bindSettingsRows(body, () => { s.close(); onLang && onLang(); });
}

/* ---------- Nouveau joueur ---------- */
export function askPlayerName({ title = t.newPlayer, initial = '', exceptId = null } = {}) {
  return new Promise(resolve => {
    let done = false;
    const body = html(`<form><input class="field" maxlength="24" placeholder="${esc(t.playerName)}" value="${esc(initial)}" autocomplete="off" enterkeyhint="done">
      <div class="err"></div><button class="btn primary" type="submit">${esc(t.validate)}</button></form>`);
    const s = openSheet({ title, body, onClose: () => { if (!done) resolve(null); } });
    const input = body.querySelector('input'), err = body.querySelector('.err');
    body.onsubmit = e => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      if (nameExists(name, exceptId)) { err.textContent = t.nameTaken; return; }
      done = true; resolve(name); s.close();
    };
    setTimeout(() => input.focus(), 250);
  });
}

/* ---------- Joueurs ---------- */
export function openPlayers() {
  let sort = 'alpha';
  const body = html('<div></div>');
  const s = openSheet({ title: t.players, body });
  const render = () => {
    const stats = playerStats(state.players, state.games);
    const pod = podium(stats);
    const list = Object.values(stats).sort((a, b) => sort === 'alpha'
      ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      : b.ratio - a.ratio || b.played - a.played || a.name.localeCompare(b.name));
    const pct = r => Math.round(r * 100) + ' %';
    const slot = (p, i) => p ? `<div class="p p${i + 1}"><div class="pn">${esc(p.name)}</div><div class="pr">${pct(p.ratio)}</div><div class="blk">${i + 1}</div></div>`
      : `<div class="p p${i + 1}"><div class="pn">&nbsp;</div><div class="pr">&nbsp;</div><div class="blk" style="opacity:.35">${i + 1}</div></div>`;
    body.innerHTML = `
      <div class="podium">${slot(pod[1], 1)}${slot(pod[0], 0)}${slot(pod[2], 2)}</div>
      <p class="hint" style="text-align:center">${esc(pod.length ? t.podiumHint(PODIUM_MIN_GAMES) : t.podiumEmpty + ' ' + t.podiumHint(PODIUM_MIN_GAMES))}</p>
      <div class="seg sort" style="margin:14px 0 6px"><button data-s="alpha" class="${sort === 'alpha' ? 'on' : ''}">${t.sortAlpha}</button><button data-s="ratio" class="${sort === 'ratio' ? 'on' : ''}">${t.sortRatio}</button></div>
      <ul class="list">${list.map(p => `<li class="li tap" data-id="${p.id}"><span class="grow">${esc(p.name)}</span><span class="ratio">${p.played ? pct(p.ratio) : '—'}</span></li>`).join('')
        || `<li class="li muted">${esc(t.noPlayers)}</li>`}
        <li class="li tap add" style="color:var(--accent)">${icon('plus')}<span class="grow">${esc(t.newPlayer)}</span></li></ul>`;
    body.querySelectorAll('.sort button').forEach(b => b.onclick = () => { sort = b.dataset.s; render(); });
    body.querySelectorAll('li[data-id]').forEach(li => li.onclick = () => openPlayerCard(li.dataset.id, stats[li.dataset.id], render));
    body.querySelector('.add').onclick = async () => { const n = await askPlayerName(); if (n) { await createPlayer(n); render(); } };
  };
  render();
  return s;
}

function openPlayerCard(id, st, onChange) {
  const p = state.players.find(x => x.id === id);
  const body = html('<div></div>');
  const s = openSheet({ title: p.name, body });
  body.innerHTML = `<dl class="kv">
    <dt>${t.played}</dt><dd>${st.played}</dd>
    <dt>${t.wins}</dt><dd>${st.wins}</dd>
    <dt>${t.losses}</dt><dd>${st.losses}</dd>
    <dt>${t.ratio}</dt><dd>${st.played ? Math.round(st.ratio * 100) + ' %' : '—'}</dd>
    <dt>${t.highest}</dt><dd>${st.highest ?? '—'}</dd>
    <dt>${t.joined}</dt><dd>${fmtDate(p.createdAt)}</dd>
    <dt>${t.lastGame}</dt><dd>${fmtDate(st.lastPlayed)}</dd></dl>
    <button class="btn ren">${icon('edit')}${esc(t.rename)}</button>`;
  body.querySelector('.ren').onclick = async () => {
    const n = await askPlayerName({ title: t.rename, initial: p.name, exceptId: p.id });
    if (n) { p.name = n; await savePlayer(p); s.setTitle(n); onChange && onChange(); }
  };
}
