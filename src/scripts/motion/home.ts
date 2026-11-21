// Animațiile primei pagini: hero, lucrări pe orizontală, tabla de prețuri, secțiunea activă din meniu.
import { gsap, ScrollTrigger, SplitText, desktop } from './core';

const $ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = document) => scope.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = document) => [
  ...scope.querySelectorAll<T>(sel),
];

export function home(introDone: Promise<void>) {
  // În ordinea din pagină: galeria fixată pe ecran adaugă înălțime,
  // iar tot ce e sub ele trebuie calculat după ele.
  hero(introDone);
  works();
  board();
  spy();
  ScrollTrigger.sort();
}

/* ---------------- Secțiunea curentă, marcată în meniu și în bara de jos ---------------- */

function spy() {
  const links = $$<HTMLAnchorElement>('.header-nav a[data-section], .tabbar a[data-section]');
  // Pe prima pagină, „activ” înseamnă secțiunea în care ești, nu pagina.
  links.forEach((a) => a.removeAttribute('aria-current'));
  const ids = [...new Set(links.map((a) => a.dataset.section!))];
  let current = '';
  const activate = (id: string) => {
    if (id === current) return;
    current = id;
    links.forEach((a) => a.classList.toggle('is-active', a.dataset.section === id));
  };
  ids.forEach((id) => {
    const el = id === 'top' ? $('.hero') : document.getElementById(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => self.isActive && activate(id),
    });
  });
}

/* ---------------- Hero ---------------- */

function hero(introDone: Promise<void>) {
  const section = $('.hero');
  if (!section) return;
  const bg = $('.hero-bg', section)!;
  const img = $('img', bg);
  const frame = $('.hero-frame', section);
  const corners = $$('.frame-corner', section);
  const lockup = $('.hero-lockup', section);
  const words = $('.hero-words', section)!;
  const title = $('.hero-title', section)!;
  const ctas = $$('.hero-addr, .hero-ctas > *', section);
  const foot = $('.hero-foot', section);
  const content = $('.hero-content', section)!;

  introDone.then(() => {
    const lines = SplitText.create(words, { type: 'lines', mask: 'lines' });
    const kicker = SplitText.create(title, { type: 'lines', mask: 'lines' });
    gsap.set([words, title], { opacity: 1 });
    gsap
      .timeline({ defaults: { ease: 'expo.out' } })
      .fromTo(bg, { '--cover': 1 }, { '--cover': 0, duration: 1.7, ease: 'expo.inOut' }, 0)
      .fromTo(img, { scale: 1.12 }, { scale: 1, duration: 2.6, clearProps: 'transform' }, 0.15)
      .fromTo(frame, { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: 1.6 }, 0.5)
      .fromTo(corners, { scale: 0 }, { scale: 1, duration: 0.8, stagger: 0.06, ease: 'back.out(3)' }, 0.9)
      .fromTo(lockup, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.4 }, 0.45)
      .from(lines.lines, { yPercent: 110, duration: 1.4, stagger: 0.12 }, 0.6)
      .from(kicker.lines, { yPercent: 110, duration: 1.2, stagger: 0.08 }, 1.05)
      .fromTo(ctas, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, 1.15)
      .fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 1.2 }, 1.4);
  });

  // La derulare: poza coboară mai încet decât pagina, textul se retrage, rama se estompează.
  gsap
    .timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true },
    })
    .to(bg, { yPercent: 18 }, 0)
    .to(content, { yPercent: -12, opacity: 0.1 }, 0)
    .to([foot, frame], { opacity: 0 }, 0);
}

/* ---------------- Lucrări: galerie pe orizontală, fixată pe ecran (desktop) ---------------- */

function works() {
  const section = $('.works');
  const track = $('.works-track');
  if (!section || !track) return;
  const pin = $('.works-pin', section)!;
  const count = $('.works-count b', section);
  const cards = $$('.work', track);
  const photos = cards.filter((c) => !c.classList.contains('work-more'));

  gsap.matchMedia().add(desktop, () => {
    const distance = () => track.scrollWidth - track.clientWidth;
    const move = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        pin: true,
        start: 'top top',
        end: () => `+=${distance()}`,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          if (!count) return;
          const n = Math.min(photos.length, Math.floor(self.progress * photos.length) + 1);
          count.textContent = String(n).padStart(2, '0');
        },
      },
    });
    // Fiecare poză alunecă ușor în ramă, în sens opus mișcării.
    cards.forEach((card) => {
      const img = $('img', card);
      if (!img) return;
      gsap.fromTo(
        img,
        { xPercent: -6, scale: 1.14 },
        {
          xPercent: 6,
          scale: 1.14,
          ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: move, start: 'left right', end: 'right left', scrub: true },
        },
      );
    });
  });

  // Intrarea cardurilor (toate ecranele)
  gsap.fromTo(
    photos.map((c) => $('picture', c)),
    { '--cover': 1 },
    {
      '--cover': 0,
      duration: 1.4,
      ease: 'expo.inOut',
      stagger: 0.1,
      scrollTrigger: { trigger: track, start: 'top 85%', once: true },
    },
  );

  // Pozele din dreapta (în afara ecranului pe orizontală) se descarcă din timp, ca să nu apară goale.
  new IntersectionObserver(
    ([entry], obs) => {
      if (!entry.isIntersecting) return;
      $$<HTMLImageElement>('img', track).forEach((img) => (img.loading = 'eager'));
      obs.disconnect();
    },
    { rootMargin: '150% 0px' },
  ).observe(section);
}

/* ---------------- Tabla de prețuri ---------------- */

function board() {
  const el = $('.board');
  if (!el) return;
  const rows = $$('.service', el);
  const dots = $$('.service-dots', el);
  const prices = $$('.service-price', el);
  const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 78%', once: true } });
  tl.fromTo(el, { '--cover': 1 }, { '--cover': 0, duration: 1.4, ease: 'expo.inOut' })
    .fromTo($$('.frame-corner', el), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'back.out(3)' }, 0.9)
    .fromTo($$('.board-head > *, .board-group-title', el), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.07, ease: 'expo.out' }, 0.7)
    .fromTo(rows, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.06, ease: 'expo.out' }, 0.95)
    .fromTo(dots, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 1.2, stagger: 0.06, ease: 'expo.out' }, 1.05);
  prices.forEach((p, i) => {
    const value = parseInt(p.textContent ?? '', 10);
    if (!value) return;
    const counter = { v: 0 };
    p.textContent = '0 lei';
    tl.to(counter, {
      v: value,
      duration: 1.3,
      ease: 'power3.out',
      onUpdate: () => (p.textContent = `${Math.round(counter.v)} lei`),
    }, 1.05 + i * 0.06);
  });
}
