import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalAdjust, applySwaps, playRound, computeGame, entryScore, nextStarter } from '../js/core/score.js';
import { progress, mostAdvanced } from '../js/core/endConditions.js';
import { playerStats, podium } from '../js/core/stats.js';
import { search } from '../js/core/search.js';

// Applique les deux étapes à des scores "après manche" (sans repasser par roundPoints)
function adjust(after) {
  const step1 = {};
  for (const [k, v] of Object.entries(after)) step1[k] = personalAdjust(v).value;
  return applySwaps(step1).scores;
}

test('1 — règle perso avant échange', () => {
  assert.deepEqual(adjust({ J1: 96, J2: 48, J3: 138 }), { J1: 138, J2: 48, J3: 69 });
});
test('2 — une seule règle perso', () => {
  assert.deepEqual(adjust({ J1: 100, J2: 111 }), { J1: 100, J2: 50 });
});
test('3 — chaîne de 3', () => {
  assert.deepEqual(adjust({ a: 38, b: 76, c: 152 }), { a: 152, b: 76, c: 38 });
});
test('4 — chaîne de 4', () => {
  assert.deepEqual(adjust({ a: 10, b: 20, c: 40, d: 80 }), { a: 80, b: 40, c: 20, d: 10 });
});
test('5 — chaîne de 5', () => {
  assert.deepEqual(adjust({ a: 10, b: 20, c: 40, d: 80, e: 160 }), { a: 160, b: 80, c: 40, d: 20, e: 10 });
});
test('6 — égalité face à un double', () => {
  assert.deepEqual(adjust({ J1: 28, J2: 28, J3: 56 }), { J1: 56, J2: 56, J3: 28 });
});
test('7 — égalité dans une chaîne', () => {
  assert.deepEqual(adjust({ A: 20, B: 20, C: 40, D: 80 }), { A: 80, B: 80, C: 40, D: 20 });
});
test('8 — égalités des deux côtés', () => {
  assert.deepEqual(adjust({ A: 30, B: 30, C: 60, D: 60 }), { A: 60, B: 60, C: 30, D: 30 });
});
test('9 — deux chaînes indépendantes', () => {
  assert.deepEqual(adjust({ a: 15, b: 30, c: 22, d: 44 }), { a: 30, b: 15, c: 44, d: 22 });
});
test('10 — pénalité avantageuse 17+3+30 = 50 → 0', () => {
  const r = playRound({ A: 17, B: 40 }, { A: 3, B: 2 }, 'A');
  assert.equal(r.pts.A, 33);
  assert.equal(r.scores.A, 0);
});
test('11 — égalité au plus bas = pénalité', () => {
  const r = playRound({ A: 0, B: 0 }, { A: 3, B: 3 }, 'A');
  assert.equal(r.pts.A, 33);
  const ok = playRound({ A: 0, B: 0 }, { A: 2, B: 3 }, 'A');
  assert.equal(ok.pts.A, 2);
});
test('12 — main vide, score inchangé 50 → 0', () => {
  const r = playRound({ A: 50, B: 7 }, { A: 0, B: 4 }, 'empty');
  assert.equal(r.scores.A, 0);
  assert.equal(r.penalty, null);
});
test('13 — main vide, 69 → 96', () => {
  const r = playRound({ A: 69, B: 7 }, { A: 0, B: 4 }, 'empty');
  assert.equal(r.scores.A, 96);
});
test('14 — 0 reste 0', () => {
  assert.deepEqual(personalAdjust(0), { value: 0, rule: null });
});
test('15 — 25 et 50 échangent', () => {
  assert.deepEqual(adjust({ J1: 100, J2: 25 }), { J1: 25, J2: 50 });
});
test('16 — chiffres répétés', () => {
  assert.equal(personalAdjust(1111).value, 1000);
  assert.equal(personalAdjust(2222).value, 2000);
  assert.equal(personalAdjust(999).value, 900);
  assert.equal(personalAdjust(555).value, 500);
  assert.equal(personalAdjust(11).value, 11);
});
test('17 — 69/96', () => {
  assert.equal(personalAdjust(169).value, 196);
  assert.equal(personalAdjust(196).value, 169);
  assert.equal(personalAdjust(1069).value, 1096);
  assert.equal(personalAdjust(69).value, 96);
  assert.equal(personalAdjust(96).value, 69);
});
test('18 — entrée d’un joueur à la moyenne arrondie au-dessus', () => {
  assert.equal(entryScore({ a: 49, b: 37, c: 15, d: 35, e: 29 }), 33);
  assert.equal(entryScore({ a: 10, b: 11 }), 11);
});
test('18b — 1111 et 2222 puis échange', () => {
  assert.deepEqual(adjust({ J1: 1111, J2: 2222 }), { J1: 2000, J2: 1000 });
});
test('multiples de 50', () => {
  assert.equal(personalAdjust(50).value, 0);
  assert.equal(personalAdjust(150).value, 100);
  assert.equal(personalAdjust(300).value, 250);
});

test('recalcul complet, arrivée et départ de joueurs', () => {
  const game = {
    participants: [
      { pid: 'a', joinRound: 0, startScore: 0, leftRound: null },
      { pid: 'b', joinRound: 0, startScore: 0, leftRound: 2 },
      { pid: 'c', joinRound: 1, startScore: 12, leftRound: null },
    ],
    rounds: [
      { stopper: 'a', raw: { a: 3, b: 9 } },
      { stopper: 'empty', raw: { a: 4, b: 0, c: 7 } },
      { stopper: 'c', raw: { a: 5, c: 1 } },
    ],
  };
  const g = computeGame(game);
  assert.deepEqual(g.history[0], { a: 0, b: 0 });
  assert.deepEqual(g.history[1], { a: 3, b: 9, c: 12 });
  // manche 2 : a 7, b 9, c 19 ; puis b part
  assert.deepEqual(g.history[2], { a: 7, c: 19 });
  // manche 3 : c arrête avec 1 < 5 : pas de pénalité → a 12, c 20
  assert.deepEqual(g.totals, { a: 12, c: 20 });
  assert.equal(g.rows[2].pts.c, 1);
});

test('détail des ajustements', () => {
  const r = playRound({ J1: 90, J2: 40, J3: 130 }, { J1: 6, J2: 8, J3: 8 }, 'J2');
  // J2 a 8 = égalité, pénalité → 40+38 = 78 ; J1 96 → 69 ; J3 138 → échange avec 69
  assert.equal(r.scores.J1, 138);
  assert.equal(r.scores.J3, 69);
  assert.equal(r.details.J1[0].type, 'personal');
  assert.equal(r.details.J1[1].type, 'swap');
  assert.deepEqual(r.details.J1[1].with, ['J3']);
});

test('joueur qui commence', () => {
  assert.equal(nextStarter(['a', 'b', 'c'], []), 'a');
  assert.equal(nextStarter(['a', 'b', 'c'], [{ starter: 'a' }]), 'b');
  assert.equal(nextStarter(['a', 'b', 'c'], [{ starter: 'c' }]), 'a');
});

test('conditions de fin', () => {
  const ctx = { totals: { a: 49, b: 37 }, roundsPlayed: 4, playedMs: 40 * 60000 };
  const conds = [{ type: 'time', x: 60 }, { type: 'one', x: 100 }, { type: 'rounds', x: 5 }];
  const m = mostAdvanced(conds, ctx);
  assert.equal(m.type, 'rounds');
  const p = progress([{ type: 'all', x: 37 }, { type: 'total', x: 100 }], ctx);
  assert.equal(p[0].reached, true);
  assert.equal(p[1].reached, false);
});

test('statistiques et podium', () => {
  const players = ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), createdAt: '2026-01-01' }));
  const mk = (raw, status = 'archived') => ({
    status, lastRoundAt: '2026-05-01',
    participants: Object.keys(raw).map(pid => ({ pid, joinRound: 0, startScore: 0, leftRound: null })),
    rounds: [{ stopper: 'empty', raw, at: '2026-05-01' }],
  });
  const games = [];
  for (let i = 0; i < 5; i++) games.push(mk({ a: 2, b: 5, c: 2 }));
  games.push(mk({ a: 9, b: 1, c: 3 }, 'active'));
  const s = playerStats(players, games);
  assert.equal(s.a.played, 5);
  assert.equal(s.a.wins, 5);
  assert.equal(s.c.wins, 5);
  assert.equal(s.b.losses, 5);
  assert.equal(s.b.highest, 5);
  const pod = podium(s);
  assert.equal(pod.length, 3);
  assert.equal(pod[2].id, 'b');
});

test('recherche insensible aux accents', () => {
  const e = [{ id: 1, title: 'Rapidité', text: 'On pose sans repiocher', kind: 'rule' }, { id: 2, title: 'As', text: 'vaut 1', kind: 'faq' }];
  assert.equal(search(e, 'rapidite')[0].id, 1);
});
