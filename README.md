# Noir District – site

Site static pentru frizeria Noir District din Piatra Neamț. Construit cu [Astro](https://astro.build): HTML generat la build, CSS inline, imagini AVIF/WebP responsive. Prima pagină are o scenă 3D la scroll (Three.js) și formular de programare; subpaginile au **zero JavaScript**.

## Comenzi

```sh
npm install
npm run dev       # server local cu reîncărcare: http://localhost:4321
npm run build     # generează site-ul în dist/
npm run preview   # servește dist/ local
npm run check     # verificare de tipuri
```

## Ce se editează și unde

| Ce | Unde |
| --- | --- |
| Nume, telefon, adresă, coordonate, program, social | `src/data/business.ts` |
| Programări: număr WhatsApp, interval sloturi, zile în avans, link extern (Mero/Booksy) | `src/data/business.ts` |
| Servicii și prețuri | `src/data/business.ts` → `serviceGroups` |
| Domeniul | `src/data/site.mjs` |
| Poze galerie | `src/assets/galerie/`, numite `01-skin-fade.jpg`, `02-aranjat-barba.jpg`… (numărul dă ordinea, restul numelui devine textul `alt`) |
| Imaginea de share (Facebook/WhatsApp) | `public/og-image.jpg`, 1200×630 |
| Design (culori, spațiere, componente) | `src/styles/*.css` |
| Scena 3D: obiecte / cadre de cameră | `src/scripts/experience/models.ts`, `head.ts` / `stage.ts` |

Orice modificare din `business.ts` se propagă automat în pagini, footer, meta tag-uri și datele structurate pentru Google (JSON-LD `HairSalon`).

## Arhitectură

- `src/layouts/Base.astro`: `<head>` complet (SEO, Open Graph, canonical, JSON-LD, speculation rules pentru navigare instantanee).
- Tot CSS-ul stă în `src/styles/` (fără stiluri în componente), deci HTML-ul generat e curat.
- **Mobil** (< 768px): bară de navigare fixă jos, cu programarea în centru, plus buton de apel în header. Galeria e un carusel cu scroll-snap.
- **Desktop**: navigare clasică în header, galerie în grilă.

### Scena 3D (prima pagină)

- Fiecare capitol din `index.astro` are `data-chapter`; în lumea 3D îi corespunde o „stație” (foarfecă → mașină → fade → brici → programare). Scroll-ul nativ mută camera între stații; nu e deturnat.
- Ustensilele și bustul sunt generate din cod (zero fișiere de model). Când vor exista modele reale (`.glb`) sau filmări 360° ale frizurilor, se înlocuiesc în `models.ts` / `head.ts`.
- Three.js (~150 KB gzip) se descarcă abia după ce pagina e complet încărcată. Textul și SEO-ul nu depind de el.
- Fără efecte (pagină statică normală) pentru: „reducere animații” activată, „economisire date”, browsere fără WebGL2.
- Pe telefoane: mai puține fire de păr, rezoluție plafonată, iar dacă dispozitivul nu ține 60 fps, rezoluția scade automat.

### Programări

Formularul (serviciu → zi → oră → nume/telefon) generează sloturile din program și trimite cererea gata completată pe WhatsApp. Nu există server și nici verificare de disponibilitate: Orlando confirmă manual. Dacă `bookingUrl` e completat, formularul e înlocuit de un buton către platforma externă.
- Același HTML și același URL pentru ambele interfețe (recomandarea Google pentru mobile-first indexing); diferențele țin doar de CSS.
- Fără Google Maps embed (~1 MB JS + cookie-uri): butoanele deschid direct Google Maps/Waze.
- `public/_headers`: cache permanent pentru `/_astro/*` și headere de securitate (Cloudflare Pages / Netlify).

## Înainte de lansare

1. Înlocuiește toate valorile `PLACEHOLDER` din `src/data/business.ts` (inclusiv numărul de WhatsApp).
2. Pune pozele reale.
3. Setează domeniul în `src/data/site.mjs`.
4. Creează/revendică Google Business Profile cu **exact** același nume, adresă și telefon, și pune link-ul site-ului acolo.
5. Trimite `https://<domeniu>/sitemap-index.xml` în Google Search Console.
