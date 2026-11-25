// Glisser à gauche / à droite, appui long, appui court — sur un élément .inner dans une ligne.
import { buzz } from './dom.js';

const LONG_MS = 450, SWIPE_PX = 72, SLOP = 9;

export function gestures(row, { onTap, onLeft, onRight, onLongStart, onLongEnd } = {}) {
  const inner = row.querySelector('.inner') || row;
  let x0, y0, dx = 0, mode = null, timer = null, longFired = false, id = null;

  const reset = () => { clearTimeout(timer); timer = null; inner.style.transform = ''; mode = null; id = null; };

  inner.addEventListener('pointerdown', e => {
    if (e.button && e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; mode = 'press'; longFired = false; id = e.pointerId;
    timer = setTimeout(() => {
      if (mode === 'press') {
        mode = 'long'; longFired = true; buzz();
        try { inner.setPointerCapture(id); } catch { /* */ }
        onLongStart && onLongStart();
      }
    }, LONG_MS);
  });
  inner.addEventListener('pointermove', e => {
    if (id !== e.pointerId || !mode) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (mode === 'press') {
      if (Math.abs(my) > SLOP && Math.abs(my) > Math.abs(mx)) { reset(); return; }
      if (Math.abs(mx) > SLOP && (onLeft || onRight)) {
        mode = 'swipe'; clearTimeout(timer);
        try { inner.setPointerCapture(e.pointerId); } catch { /* */ }
      }
    }
    if (mode === 'swipe') {
      dx = mx;
      if ((dx < 0 && !onLeft) || (dx > 0 && !onRight)) dx = 0;
      inner.style.transition = 'none';
      inner.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px)`;
    }
  });
  const end = e => {
    if (id !== e.pointerId) return;
    const m = mode;
    inner.style.transition = '';
    clearTimeout(timer);
    if (m === 'long') { onLongEnd && onLongEnd(); }
    else if (m === 'swipe') {
      if (dx <= -SWIPE_PX && onLeft) onLeft();
      else if (dx >= SWIPE_PX && onRight) onRight();
    } else if (m === 'press' && e.type === 'pointerup' && !longFired) { onTap && onTap(e); }
    reset();
  };
  inner.addEventListener('pointerup', end);
  inner.addEventListener('pointercancel', end);
  inner.addEventListener('contextmenu', e => e.preventDefault());
}
