// Anularea de către client, din linkul personal primit pe email (fără cont, fără parolă).
// Ora se eliberează pe site, Orlando primește pe WhatsApp ziua și ora anulate, clientul o confirmare pe email.
// O programare confirmată se poate anula cu cel puțin 2 ore înainte; după aceea, clientul e rugat să sune.
import type { APIRoute } from 'astro';
import { business } from '../../../data/business';
import { NotConfigured, store } from '../../../lib/store';
import { emailClient, orlandoText, whatsappOrlando } from '../../../lib/notify';
import { canCancel, clientIp, isToken, json, limited, manageUrl, sameOrigin } from '../../../lib/booking-server';

export const prerender = false;

const fail = (status: number, error: string) => json(status, { ok: false, error });

export const POST: APIRoute = async ({ request, params, url, clientAddress }) => {
  if (!sameOrigin(request, url)) return fail(403, 'Cerere nepermisă.');
  if (limited(`ip:${clientIp(request, () => clientAddress)}`, 30, 10 * 60_000)) return fail(429, 'Prea multe cereri. Încearcă peste câteva minute.');
  if (!isToken(params.token)) return fail(404, 'Programarea nu a fost găsită.');

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 1000) throw new Error();
    body = JSON.parse(text);
    if (!body || typeof body !== 'object') throw new Error();
  } catch {
    return fail(400, 'Cerere invalidă.');
  }
  if (body.action !== 'cancel') return fail(400, 'Acțiune necunoscută.');

  try {
    const booking = await store().byToken(params.token);
    if (!booking) return fail(404, 'Programarea nu a fost găsită.');
    if (booking.status !== 'pending' && booking.status !== 'confirmed') return fail(409, 'Programarea nu mai e activă.');
    if (!canCancel(booking)) {
      return fail(403, `Mai sunt mai puțin de 2 ore până la programare. Te rugăm să ne suni: ${business.phoneDisplay}.`);
    }
    // Atomic: dacă Orlando a refuzat-o sau a expirat chiar acum, anularea nu se mai face (și nu se trimite nimic).
    const cancelled = await store().decide(booking.id, ['pending', 'confirmed'], 'cancelled');
    if (!cancelled) return fail(409, 'Programarea nu mai e activă.');
    await Promise.all([
      emailClient('cancelled', cancelled, manageUrl(url.origin, cancelled.token)),
      whatsappOrlando(orlandoText('cancelled', cancelled)),
    ]);
    return json(200, { ok: true, status: 'cancelled' });
  } catch (error) {
    if (error instanceof NotConfigured) return fail(503, 'Programările online nu sunt încă active.');
    console.error('Programare – anulare:', error);
    return fail(500, 'Nu am putut anula acum. Te rugăm să ne suni.');
  }
};

export const ALL: APIRoute = () => fail(405, 'Metodă nepermisă.');
