// Logica programărilor de pe server, folosită de API, pagina personală, pagina de confirmare și administrare.
import { business, serviceGroups } from '../data/business';
import { SITE_URL } from '../data/site.mjs';
import { store, type Booking, type Interval } from './store';
import { addDays, freeSlots, local, toInstant, toMinutes, type Busy, type SlotRules } from './schedule';
import { emailClient, orlandoText, whatsappOrlando } from './notify';

export const rules: SlotRules = { hours: business.hours, slotMinutes: business.slotMinutes, leadMinutes: 30 };
/** Clientul poate anula singur o programare confirmată cu cel puțin atâtea minute înainte. */
export const CHANGE_LIMIT_MINUTES = 120;
/** Cât ține ora rezervată o cerere pe care Orlando n-a confirmat-o încă. */
export const PENDING_HOURS = 12;

export const services = new Map(serviceGroups.flatMap((g) => g.services).map((s) => [s.name, s]));

/**
 * Până când așteaptă o cerere confirmarea: 12 ore, dar cel târziu cu o oră înainte de programare
 * (ca clientul să afle la timp). Pentru o oră foarte apropiată, Orlando are măcar 15 minute.
 */
export function pendingUntil(startsAt: string, now = Date.now()) {
  const start = Date.parse(startsAt);
  const latest = Math.min(now + PENDING_HOURS * 3_600_000, start - 60 * 60_000);
  return new Date(Math.max(latest, Math.min(now + 15 * 60_000, start))).toISOString();
}

/**
 * Cererile pe care Orlando nu le-a confirmat la timp: se marchează „expirate”, ora se eliberează,
 * clientul primește email, iar Orlando un mesaj. Rulează la fiecare citire a orelor libere (deci la
 * fiecare vizită pe site) și zilnic din cron; baza de date garantează că fiecare cerere e anunțată o dată.
 */
export async function sweepExpired() {
  const expired = await store().expireDue(new Date().toISOString());
  await Promise.all(
    expired.map((b) => Promise.all([emailClient('expired', b, manageUrl(SITE_URL, b.token)), whatsappOrlando(orlandoText('expired', b))])),
  );
  return expired.length;
}

/** Orele ocupate (cereri în așteptare, programări confirmate, ore blocate) pe zile, în minute. */
export async function availability() {
  await sweepExpired().catch((error) => console.error('Expirarea cererilor:', error));
  const today = local().day;
  const last = addDays(today, business.bookingDays);
  const intervals = await store().busy(toInstant(today, 0).toISOString(), toInstant(last, 0).toISOString());
  const days: Record<string, Busy[]> = {};
  for (const i of intervals) addInterval(days, i);
  return { today, days };
}

/** Un interval (care poate trece peste miezul nopții, ex. un concediu) → minute pe fiecare zi atinsă. */
function addInterval(days: Record<string, Busy[]>, i: Interval) {
  const start = local(new Date(i.starts_at));
  const end = local(new Date(i.ends_at));
  for (let day = start.day; day <= end.day; day = addDays(day, 1)) {
    const s = day === start.day ? start.minutes : 0;
    const e = day === end.day ? end.minutes : 24 * 60;
    if (e > s) (days[day] ??= []).push([s, e]);
  }
}

/** Ora aleasă e încă liberă și în program (verificare pe server, înainte de salvare). */
export async function isBookable(day: string, slot: string, duration: number) {
  const { days } = await availability();
  return freeSlots(day, duration, days[day] ?? [], rules).includes(slot);
}

export const interval = (day: string, slot: string, duration: number) => {
  const start = toInstant(day, toMinutes(slot));
  return { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + duration * 60_000).toISOString() };
};

/**
 * Clientul mai poate anula singur: o cerere neconfirmată, oricând înainte de oră; o programare
 * confirmată, cu cel puțin 2 ore înainte (după aceea sună).
 */
export function canCancel(b: Booking) {
  const left = Date.parse(b.starts_at) - Date.now();
  if (b.status === 'pending') return left > 0;
  return b.status === 'confirmed' && left >= CHANGE_LIMIT_MINUTES * 60_000;
}

/** Linkul clientului (vede programarea și o poate anula). */
export const manageUrl = (origin: string, token: string) => new URL(`/programare/${token}/`, origin).href;
/** Linkul lui Orlando (confirmă sau refuză cererea), trimis pe WhatsApp. */
export const confirmUrl = (origin: string, adminToken: string) => new URL(`/confirmare/${adminToken}/`, origin).href;
export const isToken = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{30,60}$/.test(s);

export const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/* ---- Limite de cereri (în memorie; frânează abuzul, nu e o garanție) ---- */
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

export function clientIp(request: Request, clientAddress?: () => string) {
  try {
    return clientAddress?.() ?? 'necunoscut';
  } catch {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'necunoscut';
  }
}

/** Cererile care schimbă date trebuie să vină de pe site-ul nostru. */
export const sameOrigin = (request: Request, url: URL) => {
  const origin = request.headers.get('origin');
  return !origin || new URL(origin).host === url.host;
};
