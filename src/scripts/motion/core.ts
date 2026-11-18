// Nucleul animațiilor: scroll fin (Lenis) sincronizat cu GSAP ScrollTrigger, navigarea lină spre
// secțiuni și intro-ul la prima vizită.
// Clasa `motion` pe <html> e pusă de scriptul inline din <head>; fără ea (animații reduse, economisire date)
// nu se încarcă nimic de aici și pagina rămâne statică (link-urile spre secțiuni merg nativ).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, SplitText);
// Pe telefon, bara de adresă care apare/dispare schimbă înălțimea ecranului: fără asta,
// toate pozițiile s-ar recalcula în timpul derulării și pagina ar sări.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText };

// Doar în dezvoltare (dispare din build): acces din consolă / teste.
if (import.meta.env.DEV) Object.assign(window, { __ST: ScrollTrigger });

export const root = document.documentElement;
export const desktop = '(min-width: 64rem)';

const header = document.querySelector<HTMLElement>('.header');

// Poziția la reîncărcare o stabilim noi (după ce secțiunile fixate pe ecran și-au calculat înălțimea).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

export const lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.95 });
if (import.meta.env.DEV) Object.assign(window, { __lenis: lenis });
lenis.on('scroll', ScrollTrigger.update);
// Secțiunile fixate pe ecran lungesc pagina; Lenis trebuie să afle imediat, altfel ar tăia derularea
// la vechea limită (și butoanele spre secțiunile de jos s-ar opri mai sus).
ScrollTrigger.addEventListener('refresh', () => lenis.resize());
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------------- Navigare spre secțiuni ---------------- */

// Accelerare și frânare line; durata crește cu distanța, dar rămâne sub 2 secunde.
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

function targetOf(hash: string) {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  if (!id || id === 'top') return 0;
  return document.getElementById(id);
}

// Cât timp derularea vine dintr-un buton, headerul rămâne vizibil: acoperă exact spațiul lăsat
// deasupra secțiunii și poți apăsa imediat alt buton. Se ascunde din nou doar când derulezi tu.
let navigating = false;
const release = () => (navigating = false);
addEventListener('wheel', release, { passive: true });
addEventListener('touchstart', release, { passive: true });
addEventListener('keydown', (e) => {
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', 'Home', 'End'].includes(e.code)) release();
});

// Poziția secțiunii, măsurată acum (din derularea reală a paginii, nu din cea internă a Lenis).
// Butoanele aduc conținutul secțiunii (elementul cu `data-center`, altfel secțiunea) centrat în zona
// vizibilă dintre header și marginea de jos (bara de jos pe telefon):
// - încape → exact pe centru;
// - e marcat `data-center="fill"` (galeria fixată, cât tot ecranul) → umple ecranul, cum a fost gândit;
// - e mai înalt decât zona vizibilă → începe imediat sub header, cu puțin aer.
function yOf(target: HTMLElement | 0) {
  if (target === 0) return 0;
  const el = target.querySelector<HTMLElement>('[data-center]') ?? target;
  const r = el.getBoundingClientRect();
  const top = r.top + scrollY;
  const head = header?.offsetHeight ?? 0;
  const tab = document.querySelector<HTMLElement>('.tabbar');
  const bottom = tab && getComputedStyle(tab).display !== 'none' ? tab.offsetHeight : 0;
  const visible = innerHeight - head - bottom;
  // „fill” doar când chiar ocupă tot ecranul (pe telefon galeria e un carusel normal și se centrează).
  if (el.dataset.center === 'fill' && r.height > visible && r.height <= innerHeight + 2) return Math.round(top);
  if (r.height <= visible) return Math.round(top + r.height / 2 - (head + visible / 2));
  return Math.round(top - head - 16);
}

// Secțiunile care se animă pe măsură ce derulezi prin ele (galeria pe orizontală).
// Un buton care ar trece prin ele nu derulează, ci face o tăietură: estompare scurtă, salt, revenire.
function crossesScrollScene(from: number, to: number) {
  const [a, b] = from < to ? [from, to] : [to, from];
  return ['.works'].some((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    // Doar când chiar e fixată pe ecran (pe telefon, galeria e un carusel normal).
    if (!el || el.offsetHeight < innerHeight * 1.5) return false;
    const top = el.getBoundingClientRect().top + scrollY;
    // Drumul intră în porțiunea în care secțiunea e fixată și se animă (nu doar ajunge la începutul ei).
    return a < top + el.offsetHeight - innerHeight && b > top + 2;
  });
}

let veil: HTMLElement | null = null;
function cut(y: number, done: () => void) {
  if (!veil) {
    veil = document.createElement('div');
    veil.className = 'nav-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.append(veil);
  }
  gsap.killTweensOf(veil);
  gsap.to(veil, {
    opacity: 1,
    duration: 0.32,
    ease: 'power2.in',
    onComplete() {
      gsap.to(veil, { opacity: 0, duration: 0.55, ease: 'power2.out', delay: 0.08 });
      lenis.scrollTo(y, { immediate: true, force: true });
      ScrollTrigger.update();
      // Animațiile legate de scroll ajung direct în poziția finală, fără să „recupereze” sub ochii tăi.
      // (getTween() întoarce netezirea scrub-ului, sau 0 când animația nu are netezire.)
      ScrollTrigger.getAll().forEach((st) => {
        const smoothing = st.getTween();
        if (smoothing) smoothing.progress(1);
      });
      done();
    },
  });
}

/** Derulează lin (sau instant) la `#id`. Întoarce false dacă ținta nu există pe pagină. */
export function scrollToHash(hash: string, immediate = false, retry = true) {
  const target = targetOf(hash);
  if (target === null) return false;
  lenis.resize();
  const y = yOf(target);
  const distance = Math.abs(y - scrollY);
  navigating = true;
  header?.classList.remove('is-hidden');

  const arrive = () => {
    // Dacă pagina și-a schimbat înălțimea pe drum (fonturi, poze), mai facem un pas scurt până la țintă.
    if (retry && Math.abs(yOf(target) - scrollY) > 2) {
      scrollToHash(hash, true, false);
      return;
    }
    // Pentru tastatură și cititoare de ecran: focusul ajunge în secțiune.
    if (target instanceof HTMLElement) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  };

  if (!immediate && crossesScrollScene(scrollY, y)) {
    lenis.stop();
    cut(y, () => {
      lenis.start();
      arrive();
    });
    return true;
  }

  lenis.scrollTo(y, {
    immediate,
    force: true,
    duration: Math.min(0.9 + distance / 5000, 1.9),
    easing: easeInOutQuart,
    onComplete: arrive,
  });
  return true;
}

// Orice link spre aceeași pagină (cu sau fără #) e preluat aici: fără saltul brusc al browserului.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname) return;
  const hash = url.hash || '#top';
  if (!scrollToHash(hash)) return;
  e.preventDefault();
  history.replaceState(null, '', hash === '#top' ? location.pathname : hash);
});

/* ---------------- Poziția păstrată la redimensionare ---------------- */

// Când fereastra își schimbă mărimea, totul se rescalează și pagina își schimbă înălțimea.
// Ținem minte în ce secțiune ești și cât din ea ai parcurs, apoi te readucem exact acolo.
let anchor: { el: Element; ratio: number } | null = null;
let resizing = false;

const blocks = () => [...document.querySelectorAll('main > section, main > div, footer')];
function remember() {
  if (resizing) return;
  const y = scrollY;
  for (const el of blocks()) {
    const r = el.getBoundingClientRect();
    const top = r.top + y;
    if (y < top + r.height) {
      anchor = { el, ratio: r.height ? (y - top) / r.height : 0 };
      return;
    }
  }
}
lenis.on('scroll', () => {
  if (!resizing) requestAnimationFrame(remember);
});

// Contează doar schimbarea lățimii: pe telefon, bara de adresă schimbă doar înălțimea.
let lastWidth = innerWidth;
addEventListener('resize', () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  resizing = true; // poziția rămâne cea reținută la ultima derulare, dinainte de redimensionare
});
ScrollTrigger.addEventListener('refresh', () => {
  if (!resizing) return;
  resizing = false;
  if (!anchor || !anchor.el.isConnected) return;
  const r = anchor.el.getBoundingClientRect();
  const y = r.top + scrollY + anchor.ratio * r.height;
  lenis.scrollTo(Math.round(y), { immediate: true, force: true });
  ScrollTrigger.update();
});

// La „Înapoi” sau la reîncărcare, revii exact unde erai.
const memoryKey = `nd-scroll:${location.pathname}`;
addEventListener('pagehide', () => {
  try {
    sessionStorage.setItem(memoryKey, String(Math.round(lenis.scroll)));
  } catch {
    /* fără sessionStorage: se pornește de sus */
  }
});

/** Apelat după ce toate animațiile paginii sunt create: poziția corectă la sosire. */
export function settle() {
  const nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
  let saved: string | null = null;
  try {
    saved = sessionStorage.getItem(memoryKey);
  } catch {
    /* ignorăm */
  }
  const hashTarget = location.hash ? targetOf(location.hash) : null;
  // Unde trebuie să fie pagina: poziția memorată (Înapoi / reîncărcare), secțiunea din adresă sau sus.
  const where = (): number =>
    (nav === 'back_forward' || nav === 'reload') && saved !== null
      ? Number(saved)
      : hashTarget !== null
        ? yOf(hashTarget)
        : 0;

  let interacted = false;
  const apply = () => {
    if (interacted) return;
    ScrollTrigger.refresh();
    lenis.scrollTo(where(), { immediate: true, force: true });
    ScrollTrigger.update();
    remember();
  };
  apply();
  // Fonturile și pozele pot muta secțiunile după prima așezare: reaplicăm, cât timp nu ai derulat tu.
  const stop = () => (interacted = true);
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(ev, stop, { once: true, passive: true });
  document.fonts?.ready.then(apply);
  if (document.readyState === 'complete') requestAnimationFrame(apply);
  else addEventListener('load', apply, { once: true });
  setTimeout(stop, 4000);
}

/* ---------------- Intro ---------------- */

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
    .fromTo(mono, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 1, ease: 'expo.out' })
    .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'expo.inOut' }, 0.15)
    .to(inner, { opacity: 0, y: -24, duration: 0.45, ease: 'power2.in' }, 1)
    .to(curtain, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, 1.1)
    .add(resolve, 1.3);
});

/* ---------------- Bara de progres, header ---------------- */

/** Bara de progres de sus și headerul care se ascunde la derulare în jos. */
export function chrome() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  if (header) {
    let hidden = false;
    let scrolled = false;
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        const y = self.scroll();
        const nextScrolled = y > 8;
        const nextHidden = !navigating && self.direction === 1 && y > innerHeight * 0.5;
        // Atingem DOM-ul doar când starea chiar se schimbă.
        if (nextScrolled !== scrolled) header.classList.toggle('is-scrolled', (scrolled = nextScrolled));
        if (nextHidden !== hidden) header.classList.toggle('is-hidden', (hidden = nextHidden));
      },
    });
  }
}
