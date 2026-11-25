// État en mémoire + persistance.
import { db, uid } from '../data/db.js';

export const state = { players: [], games: [] };

export async function load() {
  [state.players, state.games] = await Promise.all([db.all('players'), db.all('games')]);
}

export const playerById = id => state.players.find(p => p.id === id);
export const gameById = id => state.games.find(g => g.id === id);

export async function savePlayer(p) {
  if (!state.players.includes(p)) state.players.push(p);
  await db.put('players', p);
}
export async function createPlayer(name) {
  const p = { id: uid(), name: name.trim(), createdAt: new Date().toISOString() };
  await savePlayer(p);
  return p;
}
export const nameExists = (name, exceptId) =>
  state.players.some(p => p.id !== exceptId && p.name.trim().toLowerCase() === name.trim().toLowerCase());

export async function saveGame(g) {
  if (!state.games.includes(g)) state.games.push(g);
  await db.put('games', g);
}
export async function deleteGame(g) {
  state.games = state.games.filter(x => x !== g);
  await db.del('games', g.id);
}

/** Nom affiché d'un participant (surnom de partie sinon nom de la fiche). */
export function displayName(game, pid) {
  const part = game.participants.find(p => p.pid === pid);
  return (part && part.alias) || (playerById(pid) || {}).name || '?';
}

export const SIX_MONTHS = 183 * 24 * 3600 * 1000;

/** Archivage automatique des parties inactives depuis 6 mois. */
export async function autoArchive(now = Date.now()) {
  for (const g of state.games) {
    if (g.status !== 'active' || g.noAutoArchive) continue;
    const last = Date.parse(g.lastRoundAt || g.createdAt);
    if (now - last > SIX_MONTHS) { g.status = 'archived'; g.archivedAt = new Date(now).toISOString(); await saveGame(g); }
  }
}
