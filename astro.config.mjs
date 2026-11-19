// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { SITE_URL } from './src/data/site.mjs';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  // Site-ul rămâne static; doar rutele cu `export const prerender = false` (src/pages/api/) rulează
  // pe server, ca funcții Vercel.
  adapter: vercel(),
  // Secrete, citite doar pe server (Vercel → Settings → Environment Variables). Nu ajung niciodată în browser.
  env: {
    schema: {
      // Baza de date (Supabase → Project Settings → API): adresa proiectului și cheia „service_role”.
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Emailuri către clienți: contul Gmail al frizeriei și o „parolă de aplicație” (nu parola contului).
      GMAIL_USER: envField.string({ context: 'server', access: 'secret', optional: true }),
      GMAIL_APP_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Mesaj pe WhatsApp-ul lui Orlando la fiecare programare / anulare / reprogramare.
      CALLMEBOT_PHONE: envField.string({ context: 'server', access: 'secret', optional: true }),
      CALLMEBOT_APIKEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Parola paginii de administrare (/admin) și cheia cu care Vercel pornește mementourile zilnice.
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  build: {
    format: 'directory',
    // CSS-ul e mic: îl punem inline și eliminăm request-urile care blochează randarea.
    inlineStylesheets: 'always',
  },
  compressHTML: true,
  // Bara de unelte Astro (doar în `npm run dev`) acoperă butoanele din bara de jos de pe telefon.
  devToolbar: { enabled: false },
  // Paginile private (administrare, programarea personală) și 404 nu apar în sitemap.
  integrations: [sitemap({ filter: (page) => !['/404', '/admin', '/programare/', '/confirmare/'].some((p) => page.includes(p)) })],
  fonts: [
    {
      name: 'Bodoni Moda',
      cssVariable: '--font-display',
      provider: fontProviders.local(),
      fallbacks: ['Georgia', 'serif'],
      display: 'swap',
      options: {
        variants: [
          {
            src: ['@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2'],
            weight: '400 900',
            style: 'normal',
            unicodeRange: ['U+0000-00FF', 'U+0131', 'U+0152-0153', 'U+02BB-02BC', 'U+02C6', 'U+02DA', 'U+02DC', 'U+0304', 'U+0308', 'U+0329', 'U+2000-206F', 'U+20AC', 'U+2122', 'U+2191', 'U+2193', 'U+2212', 'U+2215', 'U+FEFF', 'U+FFFD'],
          },
          {
            // ă, ș, ț
            src: ['@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-ext-wght-normal.woff2'],
            weight: '400 900',
            style: 'normal',
            unicodeRange: ['U+0100-02BA', 'U+02BD-02C5', 'U+02C7-02CC', 'U+02CE-02D7', 'U+02DD-02FF', 'U+1E00-1E9F', 'U+20A0-20AB', 'U+20AD-20C0', 'U+2C60-2C7F', 'U+A720-A7FF'],
          },
        ],
      },
    },
  ],
});
