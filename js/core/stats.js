// Statistiques des joueurs, calculées sur les parties archivées. Module pur.
import { computeGame } from './score.js';

export const PODIUM_MIN_GAMES = 5;

export function playerStats(players, games) {
  const stats = {};
  for (const p of players) {
    stats[p.id] = { id: p.id, name: p.name, createdAt: p.createdAt, played: 0, wins: 0, losses: 0, ratio: 0, highest: null, lastPlayed: null };
  }
  for (const g of games) {
    // Dernière partie : toutes parties confondues, date de la dernière manche
    if (g.rounds.length) {
      const last = g.lastRoundAt || g.rounds[g.rounds.length - 1].at;
      for (const part of g.participants) {
        const s = stats[part.pid];
        if (s && (!s.lastPlayed || last > s.lastPlayed)) s.lastPlayed = last;
      }
    }
    if (g.status !== 'archived') continue;
    const { totals, history } = computeGame(g);
    const finalists = g.participants.filter(p => p.leftRound == null && p.pid in totals);
    if (!finalists.length) continue;
    const min = Math.min(...finalists.map(p => totals[p.pid]));
    for (const part of finalists) {
      const s = stats[part.pid];
      if (!s) continue;
      s.played++;
      if (totals[part.pid] === min) s.wins++; else s.losses++;
      for (const h of history) {
        if (part.pid in h && (s.highest == null || h[part.pid] > s.highest)) s.highest = h[part.pid];
      }
    }
  }
  for (const s of Object.values(stats)) s.ratio = s.played ? s.wins / s.played : 0;
  return stats;
}

export function podium(stats) {
  return Object.values(stats)
    .filter(s => s.played >= PODIUM_MIN_GAMES)
    .sort((a, b) => b.ratio - a.ratio || b.played - a.played || a.name.localeCompare(b.name))
    .slice(0, 3);
}
