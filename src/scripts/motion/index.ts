// Punctul de intrare, încărcat pe toate paginile. Nucleul (GSAP + Lenis) se descarcă doar dacă
// scriptul din <head> a pus clasa `motion`; altfel pagina rămâne statică și nu se încarcă nimic.
const root = document.documentElement;

async function start() {
  (window as unknown as { __motion: boolean }).__motion = true;
  const [{ chrome, introDone, settle }, { reveals }] = await Promise.all([import('./core'), import('./reveals')]);
  chrome();
  reveals();
  if (document.body.dataset.page === 'home') {
    const { home } = await import('./home');
    home(introDone);
  }
  // După ce toate secțiunile fixate pe ecran și-au calculat înălțimea: poziția corectă la sosire.
  settle();
}

if (root.classList.contains('motion')) {
  start().catch(() => {
    // Dacă ceva eșuează, conținutul nu rămâne ascuns.
    root.classList.remove('motion', 'intro');
  });
}
