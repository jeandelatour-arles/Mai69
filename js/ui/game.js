// Page de jeu : bandeau, noms, totaux, manches, saisie, panneaux.
import { html, icon, esc } from './dom.js';
import { openSheet, confirmBox, toast } from './sheet.js';
import { gestures } from './gestures.js';
import { t } from '../i18n/i18n.js';
import { computeGame, activeAt, nextStarter, entryScore, EMPTY_HAND } from '../core/score.js';
import { progress, mostAdvanced } from '../core/endConditions.js';
import { state, saveGame, displayName, createPlayer } from './state.js';
import { openRules, askPlayerName, settingsRows, bindSettingsRows } from './panels.js';
import { condEditor } from './newgame.js';

let session = null; // { game, start, tick, onVis }

const current = g => g.participants.filter(p => p.leftRound == null && p.joinRound <= g.rounds.length);
const colorOf = (g, pid) => (g.participants.find(p => p.pid === pid) || {}).color ?? 0;
const orderedCurrent = g => {
  const cur = current(g).map(p => p.pid);
  return g.order.filter(pid => cur.includes(pid)).concat(cur.filter(pid => !g.order.includes(pid)));
};
const playedMs = g => g.playedMs + (session && session.game === g && session.start ? Date.now() - session.start : 0);

/* ---------- chrono : compté seulement quand la partie est ouverte et visible ---------- */
function flushTime() {
  if (!session || !session.start) return;
  session.game.playedMs += Date.now() - session.start;
  session.start = null;
  saveGame(session.game);
}
export function leaveGame() {
  if (!session) return;
  flushTime();
  clearInterval(session.tick);
  document.removeEventListener('visibilitychange', session.onVis);
  session = null;
}

export function renderGame(root, game, { onHome }) {
  leaveGame();
  const screen = html('<div class="screen game"></div>');
  root.replaceChildren(screen);
  session = { game, start: document.hidden ? null : Date.now(), tick: null, onVis: null };
  session.onVis = () => {
    if (document.hidden) flushTime();
    else if (session && !session.start) { session.start = Date.now(); updateBanner(); }
  };
  document.addEventListener('visibilitychange', session.onVis);

  let comp = computeGame(game);
  const ctx = () => ({ totals: comp.totals, roundsPlayed: game.rounds.length, playedMs: playedMs(game) });

  function render() {
    comp = computeGame(game);
    const ids = orderedCurrent(game);
    const starter = nextStarter(game.order, game.rounds);
    screen.style.setProperty('--n', ids.length);
    screen.innerHTML = `
      <button class="banner" aria-live="polite"></button>
      <div class="grid names">${ids.map(pid => `<button class="name c${colorOf(game, pid)} ${pid === starter ? 'is-starter' : ''}" data-pid="${pid}"
          title="${pid === starter ? esc(t.starterHint) : ''}">${esc(displayName(game, pid))}<span class="starter"></span></button>`).join('')}</div>
      <div class="grid totals">${ids.map(pid => `<button class="total" data-pid="${pid}">${comp.totals[pid] ?? 0}${comp.lastDetails[pid] ? '<span class="star">★</span>' : ''}</button>`).join('')}</div>
      <div class="scroll rounds">${game.rounds.map((r, i) => {
        const row = comp.rows[i];
        return `<div class="round" data-r="${i}"><div class="under"><span>${icon('trash')}</span><span>${icon('edit')}</span></div>
          <div class="inner grid">${ids.map(pid => {
            const v = row.pts[pid];
            const pen = v != null && r.raw[pid] != null && v !== Number(r.raw[pid]);
            return `<div class="cell ${pen ? 'pen' : ''}" data-pid="${pid}">${v ?? ''}${row.details[pid] ? '<span class="star">★</span>' : ''}</div>`;
          }).join('')}</div></div>`;
      }).join('')}</div>
      <nav class="bar">
        <button class="ib b-rules" aria-label="${t.rules}">${icon('book')}</button>
        <button class="ib b-chart" aria-label="${t.chart}">${icon('chart')}</button>
        <button class="fab b-add" aria-label="+">${icon('plus')}</button>
        <button class="ib b-set" aria-label="${t.settings}">${icon('gear')}</button>
        <button class="ib b-end" aria-label="${t.endTitle}">${icon('flag')}</button>
      </nav>`;
    const sc = screen.querySelector('.rounds');
    sc.scrollTop = sc.scrollHeight;
    updateBanner();

    screen.querySelector('.banner').onclick = openConds;
    screen.querySelectorAll('.name').forEach(b => b.onclick = () => renameInGame(b.dataset.pid));
    screen.querySelectorAll('.total').forEach(b => b.onclick = () => {
      if (game.rounds.length && comp.lastDetails[b.dataset.pid]) openDetails(game.rounds.length - 1);
    });
    screen.querySelectorAll('.round').forEach(rowEl => {
      const r = Number(rowEl.dataset.r);
      gestures(rowEl, {
        onTap: e => { const c = e.target.closest('.cell'); if (c && comp.rows[r].details[c.dataset.pid]) openDetails(r); else if (comp.rows[r] && Object.keys(comp.rows[r].details).length && c && c.querySelector('.star')) openDetails(r); },
        onLeft: () => openEntry(r),
        onRight: () => deleteRound(r),
        onLongStart: () => roundMenu(r),
      });
    });
    screen.querySelector('.b-rules').onclick = () => openRules();
    screen.querySelector('.b-chart').onclick = openChart;
    screen.querySelector('.b-add').onclick = () => openEntry(null);
    screen.querySelector('.b-set').onclick = openSettings;
    screen.querySelector('.b-end').onclick = openEnd;
  }

  /* ---------- bandeau ---------- */
  function bannerText() {
    if (!game.conds.length) return { text: '', over: false };
    const m = mostAdvanced(game.conds, ctx());
    if (!m) return { text: '', over: false };
    const left = Math.ceil(m.x - m.current);
    switch (m.type) {
      case 'time': {
        const ms = Math.max(0, m.x * 60000 - playedMs(game));
        const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
        const str = (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
        return { text: t.banner.time(str, ms <= 0), over: ms <= 0 };
      }
      case 'one': return { text: t.banner.one(left, m.leader ? displayName(game, m.leader) : ''), over: left <= 0 };
      default: return { text: t.banner[m.type](left), over: left <= 0 };
    }
  }
  function updateBanner() {
    const b = screen.querySelector('.banner');
    if (!b) return;
    const { text, over } = bannerText();
    b.textContent = text;
    b.classList.toggle('over', over);
    // Notification unique à l'expiration du chrono
    const tc = game.conds.find(c => c.type === 'time');
    if (tc && !game.timeUpShown && playedMs(game) >= tc.x * 60000) {
      game.timeUpShown = true; saveGame(game); toast(t.timeUp, 4000);
    }
  }
  clearInterval(session.tick);
  session.tick = setInterval(() => {
    if (document.hidden || !game.conds.some(c => c.type === 'time')) return;
    updateBanner();
  }, 1000);

  function openConds() {
    const p = progress(game.conds, ctx());
    if (!p.length) return;
    const fmt = c => c.type === 'time' ? `${Math.floor(c.current)} / ${c.x} min` : `${Math.round(c.current)} / ${c.x}`;
    openSheet({
      title: t.endRules,
      body: `<ul class="list">${p.map(c => `<li class="li"><span class="grow">${esc(t.cond[c.type].label)}${c.type === 'one' && c.leader ? ` <span class="muted">(${esc(displayName(game, c.leader))})</span>` : ''}</span>
        <span class="${c.reached ? '' : 'muted'}" style="font-variant-numeric:tabular-nums">${fmt(c)}</span></li>`).join('')}</ul>`,
    });
  }

  /* ---------- noms ---------- */
  function renameInGame(pid) {
    const part = game.participants.find(p => p.pid === pid);
    const body = html(`<form><input class="field" maxlength="24" value="${esc(displayName(game, pid))}" autocomplete="off" enterkeyhint="done">
      <p class="hint">${esc(t.renameInGameHint)}</p><button class="btn primary" type="submit">${esc(t.validate)}</button></form>`);
    const s = openSheet({ title: t.renameInGame, body });
    const input = body.querySelector('input');
    body.onsubmit = async e => {
      e.preventDefault();
      const v = input.value.trim();
      const base = (state.players.find(p => p.id === pid) || {}).name;
      part.alias = v && v !== base ? v : null;
      await saveGame(game); s.close(); render();
    };
    setTimeout(() => { input.focus(); input.select(); }, 250);
  }

  /* ---------- détail des ajustements ---------- */
  function openDetails(r) {
    const row = comp.rows[r];
    const round = game.rounds[r];
    const items = [];
    for (const pid of Object.keys(row.pts)) {
      const lines = [];
      if (round.raw[pid] != null && row.pts[pid] !== Number(round.raw[pid])) lines.push(t.penaltyNote);
      for (const d of row.details[pid] || []) {
        if (d.type === 'personal') lines.push(t.adjFrom(d.from, d.to, t.adjPersonal[d.rule]));
        else lines.push(t.adjSwap(d.from, d.to, d.with.map(w => displayName(game, w)).join(', ')));
      }
      if (lines.length) items.push(`<div class="adj"><div class="who c${colorOf(game, pid)}">${esc(displayName(game, pid))}</div>${lines.map(l => `<div class="what">${esc(l)}</div>`).join('')}</div>`);
    }
    openSheet({ title: `${t.adjustTitle} · ${t.roundActions(r + 1)}`, body: items.join('') || `<p class="muted">—</p>` });
  }

  /* ---------- manche : menu, suppression ---------- */
  function roundMenu(r) {
    const body = html(`<div><button class="btn e">${icon('edit')}${esc(t.edit)}</button><button class="btn danger d">${icon('trash')}${esc(t.delete)}</button></div>`);
    const s = openSheet({ title: t.roundActions(r + 1), body });
    body.querySelector('.e').onclick = () => { s.close(); openEntry(r); };
    body.querySelector('.d').onclick = () => { s.close(); deleteRound(r); };
  }
  async function deleteRound(r) {
    if (!(await confirmBox(t.confirmDeleteRound(r + 1), { ok: t.delete, danger: true }))) return;
    game.rounds.splice(r, 1);
    // les arrivées/départs programmés après cette manche reculent d'une manche
    for (const p of game.participants) {
      if (p.joinRound > r) p.joinRound--;
      if (p.leftRound != null && p.leftRound > r) p.leftRound--;
    }
    game.lastRoundAt = game.rounds.length ? game.rounds[game.rounds.length - 1].at : null;
    await saveGame(game); render();
  }

  /* ---------- saisie d'une manche ---------- */
  function openEntry(r) {
    const editing = r != null;
    const idx = editing ? r : game.rounds.length;
    const act = activeAt(game, idx).map(p => p.pid);
    const ids = game.order.filter(pid => act.includes(pid)).concat(act.filter(pid => !game.order.includes(pid)));
    const old = editing ? game.rounds[r] : null;
    const data = { stopper: old ? old.stopper : null, raw: old ? { ...old.raw } : {} };
    let step = 0; // 0 = qui a arrêté ; 1..n = joueurs
    let saved = false;
    const body = html('<div class="entry"></div>');
    const s = openSheet({ title: editing ? t.roundActions(r + 1) : '', body });

    const dots = () => `<div class="steps">${[0, ...ids].map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
    const draw = () => {
      if (step === 0) {
        body.innerHTML = `${dots()}<div class="entry-name" style="font-size:20px">${esc(t.whoStopped)}</div>
          <div class="choice" style="margin-top:12px">${ids.map(pid => `<button data-pid="${pid}" class="c${colorOf(game, pid)}" style="${data.stopper === pid ? 'outline:2px solid currentColor' : ''}">${esc(displayName(game, pid))}</button>`).join('')}
          <button class="wide" data-pid="${EMPTY_HAND}" style="${data.stopper === EMPTY_HAND ? 'outline:2px solid var(--accent)' : ''}">${esc(t.emptyHand)}</button></div>`;
        body.querySelectorAll('.choice button').forEach(b => b.onclick = () => { data.stopper = b.dataset.pid; step = 1; draw(); });
        return;
      }
      const pid = ids[step - 1];
      const isStopper = data.stopper === pid;
      body.innerHTML = `${dots()}<form autocomplete="off">
        <div class="entry-name c${colorOf(game, pid)}">${esc(displayName(game, pid))}${isStopper ? ' <span class="muted" style="font-size:14px;font-weight:500">✋</span>' : ''}</div>
        <p class="hint" style="text-align:center;margin:0 0 10px">${esc(t.rawHint)}</p>
        <input class="field entry-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${data.raw[pid] ?? ''}" aria-label="${esc(t.pointsOf)} ${esc(displayName(game, pid))}">
        <div class="err"></div>
        <div class="row2"><button type="button" class="btn ghost prev">${icon('back')}${esc(t.back)}</button><button class="btn primary">${esc(t.validate)}</button></div></form>`;
      const form = body.querySelector('form'), input = form.querySelector('input'), err = form.querySelector('.err');
      form.querySelector('.prev').onclick = () => { step--; draw(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const v = input.value.trim();
        if (!/^\d{1,2}$/.test(v) || Number(v) > 50) { err.textContent = t.invalidPoints; input.select(); return; }
        data.raw[pid] = Number(v);
        if (step < ids.length) { step++; draw(); return; }
        // contrôles finaux
        if (data.stopper === EMPTY_HAND && !ids.some(id => data.raw[id] === 0)) { err.textContent = t.emptyNeedsZero; return; }
        if (data.stopper !== EMPTY_HAND && data.raw[data.stopper] > 5) {
          if (!(await confirmBox(t.stopperTooHigh(displayName(game, data.stopper))))) return;
        }
        const raw = {};
        for (const id of ids) raw[id] = data.raw[id];
        if (editing) Object.assign(game.rounds[r], { stopper: data.stopper, raw });
        else {
          const at = new Date().toISOString();
          game.rounds.push({ at, starter: nextStarter(game.order, game.rounds), stopper: data.stopper, raw });
          game.lastRoundAt = at;
        }
        saved = true;
        await saveGame(game);
        s.close();
        render();
        if (!editing) checkEnd();
      };
      setTimeout(() => { input.focus(); input.select(); }, 60);
    };
    draw();
    return saved;
  }

  /* ---------- fin de partie proposée ---------- */
  function checkEnd() {
    const reached = progress(game.conds, ctx()).filter(c => c.reached && !(game.dismissed || []).includes(c.type));
    if (!reached.length) return;
    game.dismissed = [...(game.dismissed || []), ...reached.map(c => c.type)];
    saveGame(game);
    const body = html(`<div><p style="margin:0 0 4px">${esc(t.condReachedText)}</p>
      <p class="hint">${reached.map(c => esc(t.cond[c.type].label)).join(' · ')}</p>
      <button class="btn primary end">${icon('flag')}${esc(t.endAndArchive)}</button><button class="btn ghost cont">${esc(t.continue)}</button></div>`);
    const s = openSheet({ title: t.condReached, body });
    body.querySelector('.cont').onclick = () => s.close();
    body.querySelector('.end').onclick = () => archiveNow();
  }

  async function archiveNow() {
    flushTime();
    const totals = computeGame(game).totals;
    const vals = Object.entries(totals);
    const min = Math.min(...vals.map(([, v]) => v));
    const winners = vals.filter(([, v]) => v === min).map(([pid]) => displayName(game, pid));
    game.status = 'archived';
    game.archivedAt = new Date().toISOString();
    await saveGame(game);
    leaveGame();
    await onHome();
    if (winners.length) toast(t.winners(winners.join(', ')), 3500);
  }

  /* ---------- drapeau ---------- */
  function openEnd() {
    const body = html(`<div><button class="btn home">${icon('home')}${esc(t.backHome)}</button>
      <button class="btn primary end">${icon('archive')}${esc(t.endGame)}</button></div>`);
    openSheet({ title: t.endTitle, body });
    body.querySelector('.home').onclick = () => { leaveGame(); onHome(); };
    body.querySelector('.end').onclick = async () => {
      if (await confirmBox(t.confirmEnd, { ok: t.archive })) archiveNow();
    };
  }

  /* ---------- courbe ---------- */
  function openChart() {
    const ids = orderedCurrent(game);
    const hist = comp.history;
    if (hist.length < 2) return openSheet({ title: t.chart, body: `<p class="muted">${esc(t.chartEmpty)}</p>` });
    const W = 340, H = 220, L = 30, R = 10, T = 12, B = 22;
    const max = Math.max(10, ...hist.flatMap(h => ids.map(id => h[id] ?? 0)));
    const X = i => L + (i / (hist.length - 1)) * (W - L - R);
    const Y = v => T + (1 - v / max) * (H - T - B);
    const gridV = [0, Math.round(max / 2), max];
    const lines = ids.map(id => {
      const pts = hist.map((h, i) => (id in h ? [X(i), Y(h[id]), h[id], i] : null)).filter(Boolean);
      const c = `var(--c${colorOf(game, id)})`;
      return `<polyline fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`
        + pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.4" fill="${c}" data-v="${p[2]}" data-i="${p[3]}" data-id="${id}"/>`
          + `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="12" fill="transparent" data-v="${p[2]}" data-i="${p[3]}" data-id="${id}"/>`).join('');
    }).join('');
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t.chart)}">
      ${gridV.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join('')}
      <text x="${L}" y="${H - 6}" font-size="10" fill="var(--muted)">0</text><text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="10" fill="var(--muted)">${hist.length - 1}</text>
      ${lines}<text class="tip" x="${W - R}" y="12" text-anchor="end" font-size="12" font-weight="600" fill="var(--text)"></text></svg>`;
    const legend = `<div class="legend">${ids.map(id => `<span class="c${colorOf(game, id)}"><i class="swatch"></i><span style="color:var(--text)">${esc(displayName(game, id))}</span></span>`).join('')}</div>`;
    const s = openSheet({ title: t.chart, body: `<div class="chart">${svg}${legend}</div>` });
    const tip = s.body.querySelector('.tip');
    s.body.querySelectorAll('circle[data-v]').forEach(c => c.addEventListener('click', () => {
      tip.textContent = `${displayName(game, c.dataset.id)} · ${t.roundActions(Number(c.dataset.i))} : ${c.dataset.v}`;
    }));
  }

  /* ---------- paramètres ---------- */
  function openSettings() {
    const body = html('<div></div>');
    const s = openSheet({ title: t.settings, body });
    const draw = () => {
      body.innerHTML = `<div class="section-t" style="margin-top:4px">${esc(t.endRules)}</div>`;
      body.append(condEditor(game.conds, async () => { game.dismissed = []; game.timeUpShown = false; await saveGame(game); updateBanner(); }));
      body.insertAdjacentHTML('beforeend', `<div class="section-t">${esc(t.players)}</div>
        <ul class="list"><li class="li tap add" style="color:var(--accent)">${icon('plus')}<span class="grow">${esc(t.addPlayer)}</span></li>
        <li class="li tap rem">${icon('trash')}<span class="grow">${esc(t.removePlayer)}</span></li></ul>
        <div class="section-t">${esc(t.settings)}</div>
        <div class="list"><div class="li tap noarch"><span class="grow wrap">${esc(t.noAutoArchive)}</span><span class="switch ${game.noAutoArchive ? 'on' : ''}"></span></div>
        ${settingsRows()}</div>`);
      body.querySelector('.add').onclick = addPlayerFlow;
      body.querySelector('.rem').onclick = removePlayerFlow;
      body.querySelector('.noarch').onclick = async () => { game.noAutoArchive = !game.noAutoArchive; await saveGame(game); draw(); };
      bindSettingsRows(body, () => { s.close(); render(); });
    };
    draw();
  }

  async function addPlayerFlow() {
    const inGame = current(game).map(p => p.pid);
    const avail = state.players.filter(p => !inGame.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
    if (inGame.length >= 7) return toast(t.maxPlayers);
    const body = html(`<ul class="list">${avail.map(p => `<li class="li tap" data-id="${p.id}"><span class="grow">${esc(p.name)}</span></li>`).join('')}
      <li class="li tap new" style="color:var(--accent)">${icon('plus')}<span class="grow">${esc(t.newPlayer)}</span></li></ul>`);
    const s = openSheet({ title: t.addPlayer, body });
    const pick = pid => { s.close(); choosePlace(pid); };
    body.querySelectorAll('li[data-id]').forEach(li => li.onclick = () => pick(li.dataset.id));
    body.querySelector('.new').onclick = async () => { const n = await askPlayerName(); if (n) pick((await createPlayer(n)).id); };
  }

  function choosePlace(pid) {
    const ids = orderedCurrent(game);
    const score = entryScore(comp.totals);
    const body = html(`<div><p class="hint" style="margin-top:0">${esc(t.addPlayerHint(score))}</p>
      <div class="section-t">${esc(t.insertAfter)}</div>
      <ul class="list"><li class="li tap" data-after=""><span class="grow">${esc(t.atStart)}</span></li>
      ${ids.map(id => `<li class="li tap" data-after="${id}"><span class="grow">${esc(t.after(displayName(game, id)))}</span></li>`).join('')}</ul></div>`);
    const s = openSheet({ title: (state.players.find(p => p.id === pid) || {}).name, body });
    body.querySelectorAll('li').forEach(li => li.onclick = async () => {
      const used = current(game).map(p => p.color);
      const color = [0, 1, 2, 3, 4, 5, 6].find(c => !used.includes(c)) ?? 0;
      const existing = game.participants.find(p => p.pid === pid);
      const n = game.rounds.length;
      if (existing) Object.assign(existing, { joinRound: n, startScore: score, leftRound: null, color });
      else game.participants.push({ pid, alias: null, color, joinRound: n, startScore: score, leftRound: null });
      game.order = game.order.filter(x => x !== pid);
      const after = li.dataset.after;
      const at = after ? game.order.indexOf(after) + 1 : 0;
      game.order.splice(at, 0, pid);
      await saveGame(game);
      s.close(); render();
    });
  }

  function removePlayerFlow() {
    const ids = orderedCurrent(game);
    const body = html(`<ul class="list">${ids.map(id => `<li class="li tap" data-id="${id}"><span class="swatch c${colorOf(game, id)}"></span><span class="grow">${esc(displayName(game, id))}</span>${icon('trash')}</li>`).join('')}</ul>`);
    const s = openSheet({ title: t.removePlayer, body });
    body.querySelectorAll('li').forEach(li => li.onclick = async () => {
      if (ids.length <= 2) return toast(t.minPlayers);
      const id = li.dataset.id;
      if (!(await confirmBox(t.confirmRemove(displayName(game, id)), { ok: t.delete, danger: true }))) return;
      const part = game.participants.find(p => p.pid === id);
      const n = game.rounds.length;
      if (part.joinRound >= n && !game.rounds.some(r => id in r.raw)) game.participants = game.participants.filter(p => p !== part);
      else part.leftRound = n;
      game.order = game.order.filter(x => x !== id);
      await saveGame(game);
      s.close(); render();
    });
  }

  render();
}
