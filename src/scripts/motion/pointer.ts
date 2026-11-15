// Doar pe dispozitive cu mouse: butoanele „magnetice”, care se apleacă ușor spre cursor.
import { gsap } from './core';

export function pointer() {
  document.querySelectorAll<HTMLElement>('.btn').forEach((btn) => {
    const bx = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
    const by = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      bx((e.clientX - (r.left + r.width / 2)) * 0.28);
      by((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    btn.addEventListener('pointerleave', () => {
      bx(0);
      by(0);
    });
  });
}
