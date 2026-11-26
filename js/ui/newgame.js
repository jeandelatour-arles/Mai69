// Écran Nouvelle partie : joueurs + ordre de jeu, puis conditions de fin.
import { html, icon, esc } from './dom.js';
import { t } from '../i18n/i18n.js';
import { state, createPlayer, saveGame } from './state.js';
import { askPlayerName } from './panels.js';
import { uid } from '../data/db.js';
import { COND_TYPES } from '../core/endConditions.js';

export const DEFAULT_X = { time: 60, rounds: 10, total: 500, one: 150, all: 100 };
const MAX = 7, MIN = 2;

/** Éditeur de conditions réutilisé dans les Paramètres. conds = [{type, x}] (modifié sur place via onChange) */
export function condEditor(conds, onChange) {
  const el = html('<div class="conds"></div>');
  const render = () => {
    el.innerHTML = COND_TYPES.map(type => {
      const c = conds.find(k => k.type === type);
      const lab = t.cond[type];
      return `<div class="cond-row ${c ? 'on' : ''}" data-type="${type}">
        <button class="check" aria-label="${esc(lab.label)}">${icon('check')}</button>
        <span class="grow">${esc(lab.label)}</span>
        <input class="field num" type="number" inputmode="numeric" min="1" max="9999" value="${c ? c.x : DEFAULT_X[type]}" ${c ? '' : 'disabled style="opacity:.35"'}>
        <span class="muted" style="width:56px;font-size:13px">${esc(lab.unit)}</span></div>`;
    }).join('');
    el.querySelectorAll('.cond-row').forEach(row => {
      const type = row.dataset.type, input = row.querySelector('input');
      row.querySelector('.check').onclick = () => {
        const i = conds.findIndex(k => k.type === type);
        if (i >= 0) conds.splice(i, 1); else conds.push({ type, x: Math.max(1, parseInt(input.value, 10) || DEFAULT_X[type]) });
        render(); onChange && onChange();
      };
      input.onchange = () => {
        const c = conds.find(k => k.type === type);
        const v = Math.max(1, Math.min(9999, parseInt(input.value, 10) || DEFAULT_X[type]));
        input.value = v;
        if (c) { c.x = v; onChange && onChange(); }
      };
    });
  };
  render();
  return el;
}

export function renderNewGame(root, { onCancel, onCreated }) {
  const selected = [];
  const conds = [];
  let step = 1;

  const screen = html('<div class="screen"></div>');
  root.replaceChildren(screen);

  const render = () => {
    const name = id => (state.players.find(p => p.id === id) || {}).name || '?';
    screen.innerHTML = `
      <div class="topbar"><button class="ib back" aria-label="${t.back}">${icon('back')}</button><h1>${esc(t.newGame)}</h1></div>
      <div class="scroll pad"></div>
      <div class="footer"><button class="btn primary go"></button><div class="err" style="text-align:center"></div></div>`;
    const sc = screen.querySelector('.scroll'), go = screen.querySelector('.go'), err = screen.querySelector('.err');
    screen.querySelector('.back').onclick = () => { if (step === 2) { step = 1; render(); } else onCancel(); };

    if (step === 1) {
      const sorted = [...state.players].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      sc.innerHTML = `
        ${selected.length ? `<div class="section-t">${esc(t.orderHint)}</div>
        <ul class="list order">${selected.map((id, i) => `<li class="li" data-id="${id}"><span class="swatch c${i}"></span>
          <span class="grow">${i + 1}. ${esc(name(id))}</span><span class="handle" aria-label="drag">${icon('grip')}</span></li>`).join('')}</ul>` : ''}
        <div class="section-t">${esc(t.choosePlayers)} <span style="text-transform:none;letter-spacing:0">— ${esc(t.choosePlayersHint)}</span></div>
        <ul class="list pick">${sorted.map(p => `<li class="li tap ${selected.includes(p.id) ? 'on' : ''}" data-id="${p.id}">
            <span class="check">${icon('check')}</span><span class="grow">${esc(p.name)}</span></li>`).join('')}
          <li class="li tap add" style="color:var(--accent)">${icon('plus')}<span class="grow">${esc(t.newPlayer)}</span></li></ul>`;
      sc.querySelectorAll('.pick li[data-id]').forEach(li => li.onclick = () => {
        const id = li.dataset.id, i = selected.indexOf(id);
        if (i >= 0) selected.splice(i, 1);
        else if (selected.length >= MAX) { err.textContent = t.maxPlayers; return; }
        else selected.push(id);
        const top = sc.scrollTop; render(); screen.querySelector('.scroll').scrollTop = top;
      });
      sc.querySelector('.add').onclick = async () => {
        const n = await askPlayerName();
        if (!n) return;
        const p = await createPlayer(n);
        if (selected.length < MAX) selected.push(p.id);
        render();
      };
      enableDrag(sc.querySelector('.order'), selected, render);
      go.textContent = t.next;
      go.disabled = selected.length < MIN;
      if (selected.length < MIN) err.textContent = t.minPlayers;
      go.onclick = () => { step = 2; render(); };
    } else {
      sc.innerHTML = `<div class="section-t">${esc(t.endRules)}</div><p class="hint" style="margin-top:0">${esc(t.endRulesHint)}</p>`;
      sc.append(condEditor(conds));
      go.textContent = t.start;
      go.onclick = async () => {
        // valeurs saisies non validées par "change"
        sc.querySelectorAll('.cond-row.on').forEach(r => r.querySelector('input').dispatchEvent(new Event('change')));
        const g = {
          id: uid(), createdAt: new Date().toISOString(), lastRoundAt: null, status: 'active',
          conds: conds.map(c => ({ ...c })), noAutoArchive: false, playedMs: 0, dismissed: [],
          order: [...selected],
          participants: selected.map((pid, i) => ({ pid, alias: null, color: i, joinRound: 0, startScore: 0, leftRound: null })),
          rounds: [],
        };
        await saveGame(g);
        onCreated(g);
      };
    }
  };
  render();
}

/** Glisser-déposer pour réordonner (poignée). */
export function enableDrag(ul, arr, rerender) {
  if (!ul) return;
  ul.querySelectorAll('.handle').forEach(h => {
    const li = h.closest('li');
    let y0 = 0, from = 0, rowH = 52, dy = 0;
    h.addEventListener('pointerdown', e => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      y0 = e.clientY; dy = 0; from = [...ul.children].indexOf(li); rowH = li.getBoundingClientRect().height;
      li.classList.add('drag');
    });
    h.addEventListener('pointermove', e => {
      if (!li.classList.contains('drag')) return;
      dy = e.clientY - y0;
      li.style.transform = `translateY(${dy}px)`;
    });
    const up = () => {
      if (!li.classList.contains('drag')) return;
      li.classList.remove('drag'); li.style.transform = '';
      const to = Math.max(0, Math.min(arr.length - 1, from + Math.round(dy / rowH)));
      if (to !== from) { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); }
      rerender();
    };
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });
}
