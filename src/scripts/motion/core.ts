// Nucleul animațiilor: scroll fin (Lenis) sincronizat cu GSAP ScrollTrigger, plus intro-ul la prima vizită.
// Clasa `motion` pe <html> e pusă de scriptul inline din <head>; fără ea (animații reduse, economisire date)
// nu se încarcă nimic de aici și pagina rămâne statică.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

export const root = document.documentElement;
export const desktop = '(min-width: 64rem)';
export const finePointer = matchMedia('(pointer: fine)').matches;

const header = document.querySelector<HTMLElement>('.header');

export const lenis = new Lenis({
  autoRaf: false,
  lerp: 0.085,
  anchors: { offset: -(header?.offsetHeight ?? 0) },
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/** Se rezolvă când cortina de intro s-a ridicat (sau imediat, dacă nu e intro). */
export const introDone = new Promise<void>((resolve) => {
  const curtain = document.querySelector<HTMLElement>('.curtain');
  if (!root.classList.contains('intro') || !curtain) {
    root.classList.remove('intro');
    resolve();
    return;
  }
  try {
    sessionStorage.setItem('nd-intro', '1');
  } catch {
    /* fără sessionStorage: intro-ul apare la fiecare vizită, nu e grav */
  }
  lenis.stop();
  const mono = curtain.querySelector('.curtain-mono');
  const line = curtain.querySelector('.curtain-line');
  const inner = curtain.querySelector('.curtain-inner');
  gsap
    .timeline({
      onComplete() {
        root.classList.remove('intro');
        lenis.start();
      },
    })
    .fromTo(mono, { opacity: 0, scale: 0.86, filter: 'blur(12px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out' })
    .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, 0.2)
    .to(inner, { opacity: 0, y: -24, duration: 0.5, ease: 'power2.in' }, 1.2)
    .to(curtain, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, 1.35)
    .add(resolve, 1.6);
});

/** Bara de progres de sus și headerul care se ascunde la derulare în jos. */
export function chrome() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  if (header) {
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        const y = self.scroll();
        header.classList.toggle('is-scrolled', y > 8);
        header.classList.toggle('is-hidden', self.direction === 1 && y > innerHeight * 0.5);
      },
    });
  }
}
