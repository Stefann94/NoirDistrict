// Secțiuni care încap pe un singur ecran:
// - hero: rama se vede întreagă la încărcare; dacă textul nu încape, îl micșorăm cât trebuie;
// - tabla de prețuri: micșorată exact cât să încapă; sub pragul de lizibilitate (telefon),
//   rămâne la mărimea normală și se derulează.
// Folosim CSS `zoom`, care rearanjează textul (rămâne clar, nu e o imagine scalată).
// Rulează la încărcare, după fonturi și la fiecare redimensionare.

const PRICES_MIN = 0.72;
const HERO_MIN = 0.55;

const chromeHeight = () =>
  (document.querySelector<HTMLElement>('.header')?.offsetHeight ?? 0) +
  (document.querySelector<HTMLElement>('.tabbar')?.offsetHeight ?? 0);

function fitHero() {
  const hero = document.querySelector<HTMLElement>('.hero');
  const content = hero?.querySelector<HTMLElement>('.hero-content');
  if (!hero || !content) return;
  hero.style.removeProperty('--hero-fit');
  // Marginea de jos a conținutului lasă deja loc pentru banda cu adresa și programul.
  const zoom = Math.min(1, hero.clientHeight / content.offsetHeight);
  if (zoom < 1) hero.style.setProperty('--hero-fit', Math.max(zoom, HERO_MIN).toFixed(3));
}

function fitPrices() {
  const section = document.querySelector<HTMLElement>('.prices');
  const board = section?.querySelector<HTMLElement>('.board');
  if (!section || !board) return;
  // Spațiu disponibil: fereastra minus header, bara de jos (telefon) și o margine pentru rama dublă.
  const available = innerHeight - chromeHeight() - 2 * 24 - 32;
  board.style.removeProperty('--fit');
  section.classList.remove('is-fit');
  const zoom = Math.min(1, available / board.offsetHeight);
  if (zoom >= PRICES_MIN) {
    section.classList.add('is-fit');
    board.style.setProperty('--fit', zoom.toFixed(3));
  }
}

// Programarea, doar pe desktop: formularul se potrivește în zona vizibilă la încărcare.
// (Pe telefon nu: un formular micșorat ar face iPhone-ul să mărească ecranul la tastare.)
// Când alegi o zi apar orele și formularul crește: atunci se derulează, nu se mai micșorează sub ochii tăi.
const BOOKING_MIN = 0.78;
function fitBooking() {
  const box = document.querySelector<HTMLElement>('.booking-section [data-center]');
  if (!box) return;
  box.style.removeProperty('--booking-fit');
  if (!matchMedia('(min-width: 64rem)').matches) return;
  const available = innerHeight - chromeHeight() - 2 * 20;
  const zoom = Math.min(1, available / box.offsetHeight);
  if (zoom < 1) box.style.setProperty('--booking-fit', Math.max(zoom, BOOKING_MIN).toFixed(3));
}

export function fit() {
  fitHero();
  fitPrices();
  fitBooking();
}

let frame = 0;
const schedule = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(fit);
};

fit();
document.fonts?.ready.then(schedule);
addEventListener('resize', schedule, { passive: true });
