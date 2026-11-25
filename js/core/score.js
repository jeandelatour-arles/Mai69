// Mai 69 — calcul des scores. Module pur (aucune dépendance au DOM).

export const PENALTY = 30;
export const EMPTY_HAND = 'empty';

/** Étape 1 : une seule règle personnelle. Retourne { value, rule } (rule = null si rien). */
export function personalAdjust(s) {
  if (s === 0) return { value: 0, rule: null };
  if (s % 50 === 0) return { value: s - 50, rule: 'fifty' };
  const last2 = s % 100;
  if (last2 === 69) return { value: s + 27, rule: 'sixtynine' };
  if (last2 === 96) return { value: s - 27, rule: 'sixtynine' };
  const str = String(s);
  if (str.length >= 3 && /^(\d)\1+$/.test(str)) {
    return { value: Number(str[0]) * 10 ** (str.length - 1), rule: 'repdigit' };
  }
  return { value: s, rule: null };
}

/** Étape 2 : échanges. scores = { id: valeur }. Retourne { scores, swaps: { id: { from, to } } } */
export function applySwaps(scores) {
  const values = new Set(Object.values(scores).filter(v => v > 0));
  const mapping = new Map();
  for (const v of values) {
    const isStart = !(v % 2 === 0 && values.has(v / 2));
    if (!isStart) continue;
    const chain = [v];
    while (values.has(chain[chain.length - 1] * 2)) chain.push(chain[chain.length - 1] * 2);
    if (chain.length < 2) continue;
    const k = chain.length;
    chain.forEach((val, i) => { if (i !== k - 1 - i) mapping.set(val, chain[k - 1 - i]); });
  }
  const out = {};
  const swaps = {};
  for (const [id, v] of Object.entries(scores)) {
    if (mapping.has(v)) {
      out[id] = mapping.get(v);
      swaps[id] = { from: v, to: out[id] };
    } else out[id] = v;
  }
  return { scores: out, swaps };
}

/** Points de la manche avec la pénalité éventuelle. raw = { id: points bruts } */
export function roundPoints(raw, stopper) {
  const pts = { ...raw };
  let penalty = null;
  if (stopper && stopper !== EMPTY_HAND && stopper in raw) {
    const mine = raw[stopper];
    const others = Object.entries(raw).filter(([id]) => id !== stopper).map(([, v]) => v);
    const strictlyLowest = others.every(v => mine < v);
    if (!strictlyLowest) { pts[stopper] = mine + PENALTY; penalty = stopper; }
  }
  return { pts, penalty };
}

/** Une manche complète : prev = { id: score avant }, raw = { id: points }. */
export function playRound(prev, raw, stopper) {
  const { pts, penalty } = roundPoints(raw, stopper);
  const summed = {};
  for (const id of Object.keys(raw)) summed[id] = (prev[id] ?? 0) + pts[id];
  const step1 = {};
  const details = {};
  for (const [id, s] of Object.entries(summed)) {
    const { value, rule } = personalAdjust(s);
    step1[id] = value;
    if (rule) (details[id] ??= []).push({ type: 'personal', rule, from: s, to: value });
  }
  const { scores, swaps } = applySwaps(step1);
  for (const [id, sw] of Object.entries(swaps)) {
    const partners = Object.keys(step1).filter(o => step1[o] === sw.to);
    (details[id] ??= []).push({ type: 'swap', from: sw.from, to: sw.to, with: partners });
  }
  return { pts, penalty, summed, scores, details };
}

/** Joueurs actifs à la manche r (index 0). */
export function activeAt(game, r) {
  return game.participants.filter(p => p.joinRound <= r && (p.leftRound == null || p.leftRound > r));
}

/**
 * Recalcule toute la partie à partir des données brutes.
 * game = { participants: [{ pid, joinRound, startScore, leftRound }], rounds: [{ stopper, raw }] }
 * Retourne { rows, totals, history, lastDetails }
 *  - rows[r] = { pts, details }      (pts = points de la manche +30 compris)
 *  - history[r] = scores après la manche r-1 (history[0] = départ), seulement les joueurs présents
 */
export function computeGame(game) {
  const current = {};
  const history = [];
  const rows = [];
  const enter = r => {
    for (const p of game.participants) {
      if (p.joinRound === r && (p.leftRound == null || p.leftRound > r)) current[p.pid] = p.startScore ?? 0;
      if (p.leftRound === r) delete current[p.pid];
    }
  };
  enter(0);
  history.push({ ...current });
  game.rounds.forEach((round, r) => {
    const ids = activeAt(game, r).map(p => p.pid);
    const raw = {};
    for (const id of ids) raw[id] = Number(round.raw[id] ?? 0);
    const res = playRound(current, raw, round.stopper);
    for (const id of ids) current[id] = res.scores[id];
    rows.push({ pts: res.pts, details: res.details });
    enter(r + 1);
    history.push({ ...current });
  });
  // arrivées/départs programmés après la dernière manche
  const n = game.rounds.length;
  for (const p of game.participants) {
    if (p.joinRound > n && (p.leftRound == null)) current[p.pid] = p.startScore ?? 0;
  }
  const lastDetails = rows.length ? rows[rows.length - 1].details : {};
  return { rows, totals: { ...current }, history, lastDetails };
}

/** Score d'entrée d'un nouveau joueur : moyenne arrondie au-dessus. */
export function entryScore(totals) {
  const v = Object.values(totals);
  if (!v.length) return 0;
  return Math.ceil(v.reduce((a, b) => a + b, 0) / v.length);
}

/** Joueur qui commence la prochaine manche (ordre = liste des pid dans le sens horaire). */
export function nextStarter(order, rounds) {
  if (!order.length) return null;
  if (!rounds.length) return order[0];
  const last = rounds[rounds.length - 1].starter;
  const i = order.indexOf(last);
  if (i === -1) return order[0];
  return order[(i + 1) % order.length];
}
