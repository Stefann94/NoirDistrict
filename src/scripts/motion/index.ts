// Punctul de intrare, încărcat pe toate paginile. Nucleul (GSAP + Lenis) se descarcă doar dacă
// scriptul din <head> a pus clasa `motion`; altfel pagina rămâne statică și nu se încarcă nimic.
const root = document.documentElement;

async function start() {
  (window as unknown as { __motion: boolean }).__motion = true;
  const [{ chrome, introDone, finePointer }, { reveals }, { pointer }] = await Promise.all([
    import('./core'),
    import('./reveals'),
    import('./pointer'),
  ]);
  chrome();
  reveals();
  if (finePointer) pointer();
  if (document.body.dataset.page === 'home') {
    const { home } = await import('./home');
    home(introDone);
  }
}

if (root.classList.contains('motion')) {
  start().catch(() => {
    // Dacă ceva eșuează, conținutul nu rămâne ascuns.
    root.classList.remove('motion', 'intro');
  });
}
