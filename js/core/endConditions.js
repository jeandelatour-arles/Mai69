// Conditions de fin de partie. Module pur.
// cond = { type: 'time' | 'rounds' | 'total' | 'one' | 'all', x: number }

export const COND_TYPES = ['time', 'rounds', 'total', 'one', 'all'];

/** Avancement de chaque condition. ctx = { totals: {id: score}, roundsPlayed, playedMs } */
export function progress(conds, ctx) {
  const vals = Object.values(ctx.totals);
  return conds.filter(c => c && c.x > 0).map(c => {
    let current = 0, leader = null;
    switch (c.type) {
      case 'time': current = ctx.playedMs / 60000; break;
      case 'rounds': current = ctx.roundsPlayed; break;
      case 'total': current = vals.reduce((a, b) => a + b, 0); break;
      case 'one': {
        let best = -Infinity;
        for (const [id, v] of Object.entries(ctx.totals)) if (v > best) { best = v; leader = id; }
        current = vals.length ? best : 0; break;
      }
      case 'all': current = vals.length ? Math.min(...vals) : 0; break;
    }
    const ratio = c.x ? current / c.x : 0;
    return { ...c, current, ratio, reached: current >= c.x, leader };
  });
}

/** La condition la plus avancée (en %). */
export function mostAdvanced(conds, ctx) {
  const p = progress(conds, ctx);
  if (!p.length) return null;
  return p.reduce((a, b) => (b.ratio > a.ratio ? b : a));
}
