// Efecte generale, declarate în HTML prin atribute:
//   data-split    titlu care urcă rând cu rând, din spatele unei măști
//   data-reveal   element care apare de jos (opțional data-delay="0.2")
//   data-stagger  copiii apar pe rând
//   data-img      <picture> dezvăluit de jos în sus, cu poza care se așază și parallax ușor
// Starea inițială (ascunsă) e în motion.css, ca să nu existe nicio clipire înainte de JavaScript.
import { gsap, SplitText } from './core';

const START = 'clamp(top 88%)';

export function reveals(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        gsap.set(el, { opacity: 1 });
        return gsap.from(self.lines, {
          yPercent: 118,
          rotate: 2,
          duration: 1.25,
          ease: 'expo.out',
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: START, once: true },
        });
      },
    });
  });

  scope.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.fromTo(
      el,
      { y: 44, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1.2,
        delay: Number(el.dataset.delay ?? 0),
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: START, once: true },
      },
    );
  });

  scope.querySelectorAll<HTMLElement>('[data-stagger]').forEach((el) => {
    gsap.fromTo(
      el.children,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: START, once: true },
      },
    );
  });

  scope.querySelectorAll<HTMLElement>('[data-img]').forEach((el) => {
    const img = el.querySelector('img');
    // Capacul din motion.css (::before) se retrage în sus: doar transform, fără redesenare.
    gsap.fromTo(
      el,
      { '--cover': 1 },
      {
        '--cover': 0,
        duration: 1.4,
        ease: 'expo.inOut',
        scrollTrigger: { trigger: el, start: START, once: true },
      },
    );
    if (!img) return;
    gsap.fromTo(img, { scale: 1.32 }, { scale: 1.08, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: START, once: true } });
    gsap.fromTo(
      img,
      { yPercent: -4 },
      { yPercent: 4, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  });
}
