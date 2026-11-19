// Primește cererea de programare din formular, o verifică din nou complet (nu ne bazăm pe browser)
// și o trimite pe WhatsApp-ul lui Orlando prin CallMeBot. Rulează pe server (funcție Vercel).
//
// Secrete (Vercel → Settings → Environment Variables):
//   CALLMEBOT_PHONE   numărul lui Orlando, cu prefixul țării, ex. +40745123456
//   CALLMEBOT_APIKEY  cheia primită de la CallMeBot după activare
// Fără ele: local (npm run dev) trimiterea e simulată în consolă; online, formularul cere să suni.
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { business, serviceGroups, type DayCode } from '../../data/business';
import { checkName, checkPhone } from '../../scripts/validate';

export const prerender = false;

const services = new Map(serviceGroups.flatMap((g) => g.services).map((s) => [s.name, s]));
const WEEK: DayCode[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const fail = (status: number, error: string, field?: string) => json(status, { ok: false, error, field });

/* ---- Limite de cereri ----
   Pe adresă: 20 de încercări la 10 minute (mulți clienți pe mobil au aceeași adresă de internet,
   deci limita e largă; oprește doar abuzul). Pe număr de telefon: 3 programări trimise la 30 de minute. */
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // memorie limitată
  return recent.length > max;
}

/** Data și ora curente în România (serverul rulează în UTC). */
function bucharestNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { date: Date.UTC(+p.year, +p.month - 1, +p.day), minutes: +p.hour * 60 + +p.minute };
}

const longDate = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  // Doar de pe site-ul nostru, doar JSON, doar cereri mici.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return fail(403, 'Cerere nepermisă.');
  if (!request.headers.get('content-type')?.includes('application/json')) return fail(415, 'Cerere nepermisă.');
  const text = await request.text();
  if (text.length > 4000) return fail(413, 'Cerere prea mare.');

  let ip = 'necunoscut';
  try {
    ip = clientAddress;
  } catch {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ip;
  }
  if (limited(`ip:${ip}`, 20, 10 * 60_000)) {
    return fail(429, 'Prea multe cereri într-un timp scurt. Încearcă peste câteva minute sau sună-ne.');
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return fail(400, 'Cerere invalidă.');
  }

  // Capcana pentru roboți: răspundem „ok”, dar nu trimitem nimic.
  if (body.website) return json(200, { ok: true });

  // Serviciul: doar din listă.
  const service = typeof body.service === 'string' ? services.get(body.service) : undefined;
  if (!service) return fail(422, 'Alege un serviciu din listă.', 'service');

  // Ziua: dată reală, de azi încolo, în intervalul de programare, într-o zi în care e deschis.
  const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : '';
  const [y, m, d] = day.split('-').map(Number);
  const date = day ? Date.UTC(y, m - 1, d) : NaN;
  if (!day || new Date(date).getUTCDate() !== d) return fail(422, 'Alege ziua din listă.', 'day');
  const now = bucharestNow();
  const offset = Math.round((date - now.date) / 86_400_000);
  if (offset < 0 || offset >= business.bookingDays) return fail(422, 'Ziua aleasă nu mai e disponibilă.', 'day');
  const schedule = business.hours.find((h) => (h.days as readonly DayCode[]).includes(WEEK[new Date(date).getUTCDay()]));
  if (!schedule) return fail(422, 'În ziua aleasă suntem închiși.', 'day');

  // Ora: în program, pe intervalele de programare, cu timp pentru serviciu înainte de închidere.
  const slot = typeof body.slot === 'string' && /^\d{2}:\d{2}$/.test(body.slot) ? body.slot : '';
  const t = slot ? toMinutes(slot) : NaN;
  const opens = toMinutes(schedule.opens);
  if (!slot || t < opens || t + service.duration > toMinutes(schedule.closes) || (t - opens) % business.slotMinutes) {
    return fail(422, 'Ora aleasă nu e disponibilă.', 'slot');
  }
  if (offset === 0 && t <= now.minutes) return fail(422, 'Ora aleasă a trecut deja.', 'slot');

  // Numele și telefonul: aceleași reguli ca în formular.
  const name = checkName(typeof body.name === 'string' ? body.name : '');
  if (!name.ok) return fail(422, name.error, 'name');
  const phone = checkPhone(typeof body.phone === 'string' ? body.phone : '');
  if (!phone.ok) return fail(422, phone.error, 'phone');

  const digits = phone.value.replace(/\D/g, '');
  if (limited(`tel:${digits}`, 3, 30 * 60_000)) {
    return fail(429, 'Ai trimis deja câteva cereri de pe acest număr. Te contactăm în curând; dacă e urgent, sună-ne.');
  }
  const message = [
    '💈 Programare nouă – Noir District',
    '',
    `Serviciu: ${service.name} (${service.price} lei, ${service.duration} min)`,
    `Ziua: ${longDate.format(date)}`,
    `Ora: ${slot}`,
    '',
    `Client: ${name.value}`,
    `Telefon: ${phone.value}`,
    `Răspunde pe WhatsApp: https://wa.me/${digits}`,
  ].join('\n');

  const to = getSecret('CALLMEBOT_PHONE');
  const apiKey = getSecret('CALLMEBOT_APIKEY');
  if (!to || !apiKey) {
    if (import.meta.env.DEV) {
      console.info(`\n[programare simulată – lipsesc cheile CallMeBot]\n${message}\n`);
      return json(200, { ok: true, simulated: true });
    }
    return fail(503, 'Programările online nu sunt încă active.');
  }

  try {
    const api = new URL('https://api.callmebot.com/whatsapp.php');
    api.searchParams.set('phone', to);
    api.searchParams.set('text', message);
    api.searchParams.set('apikey', apiKey);
    const res = await fetch(api, { signal: AbortSignal.timeout(10_000) });
    const reply = res.ok ? (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    // CallMeBot nu documentează textul de succes; considerăm reușit orice răspuns 200 fără mesaj de eroare.
    if (!res.ok || /invalid|error|not allowed|blocked|wrong/i.test(reply)) throw new Error(reply || `HTTP ${res.status}`);
    console.info('CallMeBot:', reply);
  } catch (error) {
    console.error('CallMeBot nu a trimis mesajul:', error);
    return fail(502, 'Nu am putut trimite cererea acum.');
  }
  return json(200, { ok: true });
};

// Orice altă metodă (GET etc.): nu.
export const ALL: APIRoute = () => fail(405, 'Metodă nepermisă.');
