// Recherche hors ligne dans les règles et la FAQ. Module pur.

export const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const STOP = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'on', 'il', 'que', 'qui', 'quoi', 'est', 'en', 'a', 'au', 'aux', 'ce', 'se', 'si', 'je', 'pas', 'peut', 'the', 'an', 'of', 'to', 'is', 'can', 'what', 'how', 'do', 'in', 'on', 'it', 'if', 'i', 'and', 'or']);

export function tokens(q) {
  return normalize(q).split(/[^a-z0-9]+/).filter(t => t && (t.length > 1 || /\d/.test(t)) && !STOP.has(t));
}

/** entries = [{ id, title, text, kind }] ; retourne les entrées triées par pertinence. */
export function search(entries, q) {
  const toks = tokens(q);
  if (!toks.length) return [];
  const res = [];
  for (const e of entries) {
    const t = normalize(e.title), x = normalize(e.text);
    let score = 0, hits = 0;
    for (const tok of toks) {
      const inT = t.includes(tok), inX = x.includes(tok);
      if (inT || inX) hits++;
      if (inT) score += 3;
      if (inX) score += 1 + Math.min(3, x.split(tok).length - 2) * 0.25;
    }
    if (hits) res.push({ ...e, score: score + hits * 2 + (hits === toks.length ? 4 : 0) + (e.kind === 'faq' ? 1 : 0) });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, 12);
}

/** Entoure les mots trouvés de <mark> (texte déjà échappé). */
export function highlight(escaped, q) {
  const toks = tokens(q);
  if (!toks.length) return escaped;
  const norm = normalize(escaped);
  const marks = new Array(escaped.length).fill(false);
  for (const tok of toks) {
    let i = norm.indexOf(tok);
    while (i !== -1) { for (let k = i; k < i + tok.length; k++) marks[k] = true; i = norm.indexOf(tok, i + tok.length); }
  }
  let out = '', open = false;
  for (let i = 0; i < escaped.length; i++) {
    if (marks[i] && !open) { out += '<mark>'; open = true; }
    if (!marks[i] && open) { out += '</mark>'; open = false; }
    out += escaped[i];
  }
  return open ? out + '</mark>' : out;
}
