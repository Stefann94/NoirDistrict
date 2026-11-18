# Noir District – site

Site static pentru frizeria Noir District din Piatra Neamț. Construit cu [Astro](https://astro.build): HTML generat la build, CSS inline, imagini AVIF/WebP responsive, animații la scroll (GSAP + Lenis).

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
| Domeniul | Vercel → Settings → Domains (preluat automat de `src/data/site.mjs`) |
| Poze galerie | `src/assets/galerie/`, numite `01-carare-skin-fade.jpg`… (numărul dă ordinea). Titlul și textul `alt` se scriu în `src/lib/gallery.ts`. |
| Logo | `src/assets/brand/`: `logo-wordmark.png` (navbar), `logo-lockup.png` (hero, footer), `logo-monogram.png` (sursa iconițelor). Alb pe transparent, decupate din grafica originală. |
| Iconițe | `public/favicon.ico`, `favicon.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (monograma NDO pe negru) |
| Imaginea de share (Facebook/WhatsApp) | `public/og-image.jpg`, 1200×630 |
| Design (culori, spațiere, componente) | `src/styles/*.css` |

Orice modificare din `business.ts` se propagă automat în pagini, footer, meta tag-uri și datele structurate pentru Google (JSON-LD `HairSalon`).

## Arhitectură

- `src/layouts/Base.astro`: `<head>` complet (SEO, Open Graph, canonical, JSON-LD, speculation rules pentru navigare instantanee).
- Tot CSS-ul stă în `src/styles/` (fără stiluri în componente), deci HTML-ul generat e curat.
- **Mobil** (< 768px): bară de navigare fixă jos, cu programarea în centru, plus buton de apel în header. Galeria e un carusel cu scroll-snap.
- **Desktop**: navigare clasică în header, galerie în grilă.

### Prima pagină

- Hero: sigla completă în centru, încadrată de două portrete reale în alb-negru (pe mobil, portretele stau sub siglă).
- Ordinea: hero, bandă cu servicii, lucrări pe orizontală, tabla de prețuri cu rama din siglă, programare, locație și program.
- Paleta e strict alb-negru, ca sigla. Rombul din siglă e motivul recurent (etichete, separatoare, butonul de programare de pe mobil).

### Animații

| Ce | Unde |
| --- | --- |
| Pornire, scroll fin (Lenis), intro, bara de progres, header care se ascunde | `src/scripts/motion/core.ts` |
| Efecte generale, puse în HTML prin atribute: `data-split` (titlu pe rânduri), `data-reveal`, `data-stagger`, `data-img` | `src/scripts/motion/reveals.ts` |
| Prima pagină: hero, lucrări, prețuri, secțiunea activă din meniu | `src/scripts/motion/home.ts` |
| Hero și tabla de prețuri potrivite pe un ecran | `src/scripts/fit.ts` |
| Stări inițiale, cortina de intro, tranziții între pagini | `src/styles/motion.css` |

- Un script mic din `<head>` pune clasa `motion` pe `<html>` înainte de randare. Fără ea, pagina e statică și complet vizibilă: cine are „reducere animații” sau „economisire date” nu descarcă GSAP deloc. Dacă JavaScript-ul nu pornește în 3,5 s, clasa se scoate, ca nimic să nu rămână ascuns.
- Intro-ul (monograma NDO, apoi o cortină care se ridică) apare o singură dată pe sesiune, doar pe prima pagină.
- GSAP + Lenis (~51 KB gzip) se încarcă pe toate paginile.

### Poze

- Pozele trimise ca screenshot de pe telefon se decupează înainte: fără bara de status, fără butoanele aplicației și fără controalele video.
- Pentru poze noi: cât mai drepte, de preferat portret (4:5 sau 3:4), cu tunsoarea în centru.

### Programări

Formularul (serviciu → zi → oră → nume/telefon) generează sloturile din program și trimite cererea gata completată pe WhatsApp. Nu există server și nici verificare de disponibilitate: Orlando confirmă manual. Dacă `bookingUrl` e completat, formularul e înlocuit de un buton către platforma externă.
- Același HTML și același URL pentru ambele interfețe (recomandarea Google pentru mobile-first indexing); diferențele țin doar de CSS.
- Fără Google Maps embed (~1 MB JS + cookie-uri): butoanele deschid direct Google Maps/Waze.
- Găzduit pe Vercel (se publică automat la fiecare push pe `main`). `vercel.json`: cache permanent pentru `/_astro/*`, headere de securitate și slash la final de URL.

## Înainte de lansare

1. Înlocuiește toate valorile `PLACEHOLDER` din `src/data/business.ts`: telefon, WhatsApp, program, prețuri, coordonatele exacte (`geo`).
2. Confirmă cu Orlando programul și prețurile.
3. Leagă domeniul în Vercel (Settings → Domains). Adresa din canonical, sitemap și Open Graph se ia automat de acolo.
4. Creează/revendică Google Business Profile cu **exact** același nume, adresă și telefon, și pune link-ul site-ului acolo.
5. Trimite `https://<domeniu>/sitemap-index.xml` în Google Search Console.
