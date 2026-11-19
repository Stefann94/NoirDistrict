// Prima pagină, doar pe telefon:
// - prețurile pe file (Tuns / Barbă / Pachete): text mare, câte o categorie, glisare stânga/dreapta;
// - galeria: contorul 01/06 și bara de progres urmăresc glisarea.
// Pe desktop nu face nimic (acolo galeria e animată de GSAP, iar tabla are trei coloane).
import { fit } from './fit';

const phone = matchMedia('(max-width: 47.99rem)');

/* ---------------- Prețuri pe file ---------------- */

const board = document.querySelector<HTMLElement>('.board');
const tablist = board?.querySelector<HTMLElement>('.board-tabs');
const tabs = [...(tablist?.querySelectorAll<HTMLButtonElement>('.board-tab') ?? [])];
const groupsBox = board?.querySelector<HTMLElement>('.board-groups');
const groups = [...(board?.querySelectorAll<HTMLElement>('.board-group') ?? [])];
let active = 0;

function select(index: number, focus = false) {
  active = (index + tabs.length) % tabs.length;
  tabs.forEach((tab, i) => {
    const on = i === active;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  });
  groups.forEach((g, i) => g.classList.toggle('is-active', i === active));
  if (focus) tabs[active].focus();
}

function setupTabs() {
  if (!board || !tablist || !groupsBox || !tabs.length) return;
  const on = phone.matches;
  board.classList.toggle('has-tabs', on);
  tablist.hidden = !on;
  groups.forEach((g, i) => {
    if (on) {
      g.setAttribute('role', 'tabpanel');
      g.setAttribute('aria-labelledby', `fila-${i}`);
    } else {
      g.removeAttribute('role');
      g.setAttribute('aria-labelledby', `grup-${i}`);
    }
  });
  groupsBox.style.minHeight = '';
  const keep = active; // măsurătoarea de mai jos trece prin toate filele; revenim apoi la cea aleasă
  if (on) {
    // Înălțimea celei mai lungi categorii: pagina nu sare când schimbi fila.
    let tallest = 0;
    groups.forEach((_, i) => {
      select(i);
      tallest = Math.max(tallest, groupsBox.offsetHeight);
    });
    groupsBox.style.minHeight = `${tallest}px`;
  }
  select(on ? keep : 0);
  fit();
}

tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
tablist?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') select(active + 1, true);
  else if (e.key === 'ArrowLeft') select(active - 1, true);
  else return;
  e.preventDefault();
});

// Glisare stânga/dreapta pe listă = fila următoare / anterioară.
let startX = 0;
let startY = 0;
groupsBox?.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });
groupsBox?.addEventListener('touchend', (e) => {
  if (!board?.classList.contains('has-tabs')) return;
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) select(active + (dx < 0 ? 1 : -1));
}, { passive: true });

/* ---------------- Galeria: contor și bară de progres ---------------- */

const track = document.querySelector<HTMLElement>('.works-track');
const bar = document.querySelector<HTMLElement>('.works-progress-bar span');
const count = document.querySelector<HTMLElement>('.works-progress-count b');
const photos = track ? track.querySelectorAll('.work:not(.work-more)').length : 0;
let raf = 0;

function updateProgress() {
  raf = 0;
  if (!track || !phone.matches) return;
  const max = track.scrollWidth - track.clientWidth;
  const p = max > 0 ? track.scrollLeft / max : 0;
  // Bara arată poza curentă din total (1/6 … 6/6), nu doar cât ai derulat.
  const current = Math.min(photos, Math.round(p * (photos - 1)) + 1);
  if (bar) bar.style.transform = `scaleX(${current / photos})`;
  if (count) count.textContent = String(current).padStart(2, '0');
}
track?.addEventListener('scroll', () => {
  if (!raf) raf = requestAnimationFrame(updateProgress);
}, { passive: true });

/* ---------------- Pornire și schimbarea orientării ---------------- */

setupTabs();
updateProgress();
phone.addEventListener('change', () => {
  setupTabs();
  updateProgress();
});
