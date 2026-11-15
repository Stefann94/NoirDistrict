// Adresa publică a site-ului: canonical, sitemap și Open Graph o preiau automat.
// Pe Vercel se folosește domeniul de producție al proiectului (domeniul propriu, dacă e legat,
// altfel adresa *.vercel.app). În rest (local), domeniul final.
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = vercel ? `https://${vercel}` : 'https://noirdistrict.ro';
