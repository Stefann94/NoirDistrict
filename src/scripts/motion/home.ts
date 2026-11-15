// Animațiile primei pagini: hero, bandă, ritualul cu foarfeca 3D, lucrări pe orizontală, prețuri, „by Orlando”.
import { gsap, ScrollTrigger, SplitText, desktop } from './core';

const $ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = document) => scope.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = document) => [
  ...scope.querySelectorAll<T>(sel),
];

export function home(introDone: Promise<void>) {
  // În ordinea din pagină: secțiunile fixate pe ecran (lucrări, ritual) adaugă înălțime,
  // iar tot ce e sub ele trebuie calculat după ele.
  hero(introDone);
  ticker();
  works();
  board();
  orlando();
  ritual();
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

/* ---------------- Hero ---------------- */

function hero(introDone: Promise<void>) {
  const section = $('.hero');
  if (!section) return;
  const photos = $$('.hero-photo', section);
  const imgs = photos.map((p) => $('img', p));
  const center = $('.hero-center', section)!;
  const lockup = $('.hero-lockup', section);
  const title = $('.hero-title', section)!;
  const rest = $$('.hero-address, .hero-ctas > *', section);

  introDone.then(() => {
    const split = SplitText.create(title, { type: 'lines', mask: 'lines' });
    gsap.set([lockup, title], { opacity: 1 });
    gsap
      .timeline({ defaults: { ease: 'expo.out' } })
      .fromTo(photos, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.7, ease: 'expo.inOut', stagger: 0.14 })
      .fromTo(imgs, { scale: 1.4 }, { scale: 1, duration: 2.4, stagger: 0.14 }, 0.2)
      .fromTo(lockup, { opacity: 0, y: 40, scale: 0.94, filter: 'blur(10px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.8 }, 0.35)
      .from(split.lines, { yPercent: 115, duration: 1.3, stagger: 0.1 }, 0.75)
      .fromTo(rest, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, 0.95);
  });

  // La derulare: portretele se depărtează și primesc culoare, sigla se retrage.
  gsap.matchMedia().add(
    { desk: desktop, mob: '(max-width: 63.99rem)' },
    (ctx) => {
      const { desk } = ctx.conditions as { desk: boolean };
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true },
      });
      tl.to(section, { '--gs': 0 }, 0);
      if (desk) {
        tl.to(photos[0], { xPercent: -14, rotate: -4, yPercent: 8 }, 0)
          .to(photos[1], { xPercent: 14, rotate: 4, yPercent: 8 }, 0)
          .to(center, { scale: 0.84, yPercent: 22, opacity: 0.15 }, 0);
      } else {
        tl.to(photos[0], { yPercent: -10, rotate: -2 }, 0).to(photos[1], { yPercent: -22, rotate: 2 }, 0);
      }
    },
  );
}

/* ---------------- Banda cu servicii: viteza și direcția urmează scroll-ul ---------------- */

function ticker() {
  const band = $('.ticker');
  if (!band) return;
  const tracks = $$('.ticker-track', band);
  const loop = gsap.to(tracks, { xPercent: -100, duration: 38, ease: 'none', repeat: -1 });
  // Pornim „departe” în timp, ca să poată merge și înapoi fără să se oprească la 0.
  loop.totalTime(loop.duration() * 500);
  const items = $$('li', band);
  const skew = gsap.quickTo(items, 'skewX', { duration: 0.5, ease: 'power3' });

  let dir = 1;
  let boost = 0;
  ScrollTrigger.create({
    trigger: band,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate(self) {
      const v = self.getVelocity();
      dir = self.direction;
      boost = Math.min(Math.abs(v) / 250, 6);
      skew(gsap.utils.clamp(-14, 14, v / -120));
    },
  });
  gsap.ticker.add(() => {
    boost *= 0.92;
    const target = dir * (1 + boost);
    loop.timeScale(loop.timeScale() + (target - loop.timeScale()) * 0.1);
    if (boost < 0.05) skew(0);
  });
}

/* ---------------- Ritualul: foarfeca 3D fixată pe ecran ---------------- */

function ritual() {
  const section = $('.ritual');
  const canvas = $<HTMLCanvasElement>('.ritual-canvas');
  if (!section || !canvas) return;
  const steps = $$('.ritual-step', section);
  const head = $('.ritual-head', section);
  const bar = $('.ritual-bar span', section);

  let stage: import('../scissors/stage').ScissorsStage | undefined;
  let progress = 0;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate(self) {
        progress = self.progress;
        stage?.setProgress(progress);
      },
    },
  });
  tl.to(bar, { scaleX: 1, duration: 1 }, 0);
  tl.to(head, { opacity: 0.25, duration: 0.1 }, 0.12);
  const span = 0.27;
  steps.forEach((step, i) => {
    const at = 0.14 + i * span;
    tl.fromTo(step, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.07, ease: 'power2.out' }, at);
    if (i < steps.length - 1) tl.to(step, { opacity: 0, y: -50, duration: 0.06, ease: 'power2.in' }, at + span - 0.07);
  });
  tl.to([head, ...steps.slice(-1)], { opacity: 0, duration: 0.06 }, 0.93);

  const webgl = (() => {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  })();
  if (!webgl) {
    section.classList.add('ritual-static');
    return;
  }

  // Three.js se descarcă abia când secțiunea se apropie de ecran; randarea rulează doar cât e vizibilă.
  let visible = false;
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (stage) stage.setActive(visible);
      else if (visible || entry.intersectionRatio > 0) load();
    },
    { rootMargin: '120% 0px' },
  ).observe(section);

  let loading = false;
  function load() {
    if (loading) return;
    loading = true;
    import('../scissors/stage')
      .then(({ createScissorsStage }) => {
        stage = createScissorsStage(canvas!);
        stage.setProgress(progress);
        stage.setActive(visible);
        gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 1.2 });
      })
      .catch(() => section!.classList.add('ritual-static'));
  }
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
    cards.map((c) => $('picture', c)),
    { clipPath: 'inset(100% 0% 0% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.5,
      ease: 'expo.inOut',
      stagger: 0.1,
      scrollTrigger: { trigger: track, start: 'clamp(top 85%)', once: true },
    },
  );
}

/* ---------------- Tabla de prețuri ---------------- */

function board() {
  const el = $('.board');
  if (!el) return;
  const rows = $$('.service', el);
  const dots = $$('.service-dots', el);
  const prices = $$('.service-price', el);
  const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'clamp(top 78%)', once: true } });
  tl.fromTo(
    el,
    { clipPath: 'inset(-14px -14px 100% -14px)' },
    { clipPath: 'inset(-14px -14px -14px -14px)', duration: 1.5, ease: 'expo.inOut' },
  )
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

/* ---------------- „by Orlando” ---------------- */

function orlando() {
  const name = $('.about-name');
  const mark = $('.about-mark');
  if (!name || !mark) return;
  SplitText.create(name, {
    // Fără mască: literele cursive ies din cutia lor și ar fi tăiate.
    type: 'chars',
    onSplit(self) {
      gsap.set(name, { opacity: 1 });
      return gsap.from(self.chars, {
        yPercent: 70,
        opacity: 0,
        rotate: 10,
        duration: 1.4,
        ease: 'expo.out',
        stagger: 0.05,
        scrollTrigger: { trigger: name, start: 'clamp(top 88%)', once: true },
      });
    },
  });
  gsap.fromTo(
    mark,
    { xPercent: -10 },
    { xPercent: 6, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true } },
  );
}
