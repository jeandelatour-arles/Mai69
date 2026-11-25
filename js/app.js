// Mai 69 — démarrage, navigation, accueil.
import { html, icon, esc } from './ui/dom.js';
import { openSheet, closeAll, confirmBox, toast } from './ui/sheet.js';
import { gestures } from './ui/gestures.js';
import { t, getLang, setLang, fmtDate } from './i18n/i18n.js';
import { computeGame } from './core/score.js';
import { state, load, gameById, saveGame, deleteGame, displayName, autoArchive } from './ui/state.js';
import { persist } from './data/db.js';
import { openRules, openPlayers, openMenu, setEco } from './ui/panels.js';
import { renderNewGame } from './ui/newgame.js';
import { renderGame, leaveGame } from './ui/game.js';

const root = document.getElementById('app');

async function go(hash) {
  await closeAll();
  if (location.hash === hash) route();
  else if (hash === '#/') location.replace('#/');
  else location.hash = hash;
}

function route() {
  const h = location.hash || '#/';
  if (h !== '#/' && !h.startsWith('#/g/')) leaveGame();
  if (h === '#/new') {
    leaveGame();
    return renderNewGame(root, { onCancel: () => history.back(), onCreated: g => { location.replace('#/g/' + g.id); } });
  }
  if (h.startsWith('#/g/')) {
    const g = gameById(h.slice(4));
    if (g && g.status === 'active') return renderGame(root, g, { onHome: () => go('#/') });
  }
  leaveGame();
  renderHome();
}

/* ---------- Accueil ---------- */
function renderHome() {
  const games = state.games.filter(g => g.status === 'active')
    .sort((a, b) => (b.lastRoundAt || b.createdAt).localeCompare(a.lastRoundAt || a.createdAt));
  const screen = html(`<div class="screen home">
    <header class="home-head"><img class="logo-img" src="icons/logo-mai69.svg" alt=""><h1 class="sr">${esc(t.appName)}</h1></header>
    <div class="scroll"><ul class="games"></ul></div>
    <nav class="bar home-bar">
      <div class="side"><button class="ib b-rules" aria-label="${t.rules}">${icon('book')}</button>
        <button class="ib b-players" aria-label="${t.players}">${icon('users')}</button></div>
      <button class="pill b-new">${icon('plus')}${esc(t.newGame)}</button>
      <div class="side r"><button class="ib b-menu" aria-label="${t.settings}">${icon('dots')}</button></div>
    </nav></div>`);
  root.replaceChildren(screen);
  const ul = screen.querySelector('.games');
  if (!games.length) ul.innerHTML = `<li class="empty">${t.homeEmpty}</li>`;
  for (const g of games) {
    const { totals } = computeGame(g);
    const ids = g.order.filter(pid => pid in totals);
    const vals = Object.values(totals);
    const range = vals.length && g.rounds.length ? `${Math.min(...vals)}–${Math.max(...vals)}` : t.rounds(0);
    const li = html(`<li class="game-row">
      <div class="under"><span>${icon('archive')}</span><span>${icon('trash')}</span></div>
      <div class="inner">
        <div class="main"><div class="l1">${esc(t.nPlayers(ids.length))} · ${range}</div>
          <div class="l2">${ids.map(pid => `<span class="c${(g.participants.find(p => p.pid === pid) || {}).color ?? 0}">${esc(displayName(g, pid))}</span>`).join(', ')}</div></div>
        <div class="date">${fmtDate(g.lastRoundAt || g.createdAt)}</div>
      </div></li>`);
    let preview = null;
    gestures(li, {
      onTap: () => go('#/g/' + g.id),
      onLongStart: () => { preview = openPreview(g); },
      onLongEnd: () => { if (preview) { preview.close(); preview = null; } },
      onLeft: () => gameActions(g),
      onRight: () => gameActions(g),
    });
    ul.append(li);
  }
  screen.querySelector('.b-new').onclick = () => go('#/new');
  screen.querySelector('.b-rules').onclick = () => openRules();
  screen.querySelector('.b-players').onclick = () => openPlayers();
  screen.querySelector('.b-menu').onclick = () => openMenu(() => renderHome());
}

function openPreview(g) {
  const { totals } = computeGame(g);
  const ids = g.order.filter(pid => pid in totals);
  return openSheet({
    title: `${fmtDate(g.lastRoundAt || g.createdAt)} · ${t.rounds(g.rounds.length)}`,
    cls: 'preview',
    body: `<div class="pv">${ids.map(pid => `<span class="c${(g.participants.find(p => p.pid === pid) || {}).color ?? 0}">${esc(displayName(g, pid))}</span><b>${totals[pid]}</b>`).join('')}</div>`,
  });
}

function gameActions(g) {
  const body = html(`<div><button class="btn primary a">${icon('archive')}${esc(t.archive)}</button>
    <button class="btn danger d">${icon('trash')}${esc(t.delete)}</button></div>`);
  const s = openSheet({ title: `${t.nPlayers(g.participants.filter(p => p.leftRound == null).length)} · ${fmtDate(g.lastRoundAt || g.createdAt)}`, body });
  body.querySelector('.a').onclick = async () => {
    s.close();
    if (await confirmBox(t.confirmArchiveGame, { ok: t.archive })) { g.status = 'archived'; g.archivedAt = new Date().toISOString(); await saveGame(g); renderHome(); }
  };
  body.querySelector('.d').onclick = async () => {
    s.close();
    if (await confirmBox(t.confirmDeleteGame, { ok: t.delete, danger: true })) { await deleteGame(g); renderHome(); }
  };
}

/* ---------- Service worker ---------- */
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const prompt = w => toast(t.updateReady, 0, () => { w.postMessage('skipWaiting'); });
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); });
    });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

/* ---------- Démarrage ---------- */
(async function boot() {
  try { setEco(localStorage.getItem('mai69.eco') === '1'); } catch { /* */ }
  setLang(getLang());
  await load();
  await autoArchive();
  persist();
  window.addEventListener('hashchange', route);
  route();
  registerSW();
})();
