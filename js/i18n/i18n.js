import fr from './fr.js';
import en from './en.js';

const dicts = { fr, en };
let lang = 'fr';
try { lang = localStorage.getItem('mai69.lang') || (navigator.language || 'fr').slice(0, 2); } catch { /* */ }
if (!dicts[lang]) lang = 'fr';

export const t = new Proxy({}, { get: (_, k) => dicts[lang][k] ?? dicts.fr[k] });
export const getLang = () => lang;
export function setLang(l) {
  lang = dicts[l] ? l : 'fr';
  try { localStorage.setItem('mai69.lang', lang); } catch { /* */ }
  document.documentElement.lang = lang;
}
export const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
