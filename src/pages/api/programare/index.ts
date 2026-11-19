// Cererea de programare: verifică totul din nou (nu ne bazăm pe browser) și o salvează în baza de date
// ca „în așteptare” (ora e rezervată; baza garantează că nu se suprapune cu alta). Clientul primește
// pe email „am primit cererea”, iar Orlando un WhatsApp cu linkul din care o confirmă sau o refuză.
// Rulează pe server (funcție Vercel).
import type { APIRoute } from 'astro';
import { checkEmail, checkName, checkPhone } from '../../../scripts/validate';
import { business } from '../../../data/business';
import { addDays, isDayKey, isRealDay, local } from '../../../lib/schedule';
import { NotConfigured, SlotTaken, store } from '../../../lib/store';
import { emailClient, orlandoText, whatsappOrlando } from '../../../lib/notify';
import {
  clientIp,
  confirmUrl,
  interval,
  isBookable,
  json,
  limited,
  manageUrl,
  pendingUntil,
  sameOrigin,
  services,
} from '../../../lib/booking-server';

export const prerender = false;

const fail = (status: number, error: string, field?: string) => json(status, { ok: false, error, field });

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  if (!sameOrigin(request, url)) return fail(403, 'Cerere nepermisă.');
  if (!request.headers.get('content-type')?.includes('application/json')) return fail(415, 'Cerere nepermisă.');
  const text = await request.text();
  if (text.length > 4000) return fail(413, 'Cerere prea mare.');
  if (limited(`ip:${clientIp(request, () => clientAddress)}`, 20, 10 * 60_000)) {
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
  // Capcana pentru roboți: răspundem „ok”, dar nu salvăm și nu trimitem nimic.
  if (body.website) return json(200, { ok: true });

  const service = typeof body.service === 'string' ? services.get(body.service) : undefined;
  if (!service) return fail(422, 'Alege un serviciu din listă.', 'service');

  const day = isDayKey(body.day) && isRealDay(body.day) ? body.day : '';
  const today = local().day;
  if (!day || day < today || day >= addDays(today, business.bookingDays)) return fail(422, 'Alege ziua din listă.', 'day');
  const slot = typeof body.slot === 'string' && /^\d{2}:\d{2}$/.test(body.slot) ? body.slot : '';
  if (!slot) return fail(422, 'Alege ora.', 'slot');

  const name = checkName(typeof body.name === 'string' ? body.name : '');
  if (!name.ok) return fail(422, name.error, 'name');
  const phone = checkPhone(typeof body.phone === 'string' ? body.phone : '');
  if (!phone.ok) return fail(422, phone.error, 'phone');
  const email = checkEmail(typeof body.email === 'string' ? body.email : '');
  if (!email.ok) return fail(422, email.error, 'email');
  if (limited(`tel:${phone.value.replace(/\D/g, '')}`, 3, 30 * 60_000)) {
    return fail(429, 'Ai făcut deja câteva programări de pe acest număr. Dacă vrei să schimbi ceva, folosește linkul din email sau sună-ne.');
  }

  let booking;
  try {
    if (!(await isBookable(day, slot, service.duration))) throw new SlotTaken();
    const when = interval(day, slot, service.duration);
    booking = await store().create({
      service: service.name,
      price: service.price,
      duration: service.duration,
      ...when,
      name: name.value,
      phone: phone.value,
      email: email.value,
      source: 'site',
      status: 'pending',
      expires_at: pendingUntil(when.starts_at),
    });
  } catch (error) {
    if (error instanceof SlotTaken) return fail(409, 'Ora aleasă tocmai a fost ocupată. Alege, te rog, altă oră.', 'slot');
    if (error instanceof NotConfigured) return fail(503, 'Programările online nu sunt încă active.');
    console.error('Programarea nu a putut fi salvată:', error);
    return fail(500, 'Nu am putut salva programarea acum.');
  }

  // Cererea e salvată. Notificările nu o mai pot anula: dacă una pică, rămâne în jurnal (și în /admin/).
  const link = manageUrl(url.origin, booking.token);
  const [emailSent] = await Promise.all([
    emailClient('received', booking, link),
    whatsappOrlando(orlandoText('new', booking, confirmUrl(url.origin, booking.admin_token))),
  ]);
  return json(200, { ok: true, manage: link, emailSent });
};

export const ALL: APIRoute = () => fail(405, 'Metodă nepermisă.');
